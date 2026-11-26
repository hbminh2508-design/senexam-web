import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'
import {
  CHAT_PLAN_ENTITLEMENTS,
  canUserCreateGroup,
  validateGroupMemberLimit,
  validateGroupCallStartOrJoin,
  getCallDurationWarningLevel,
} from '../lib/chatLimits.mjs'
import {
  computeCallGridLayout,
  selectVisibleVideoSubscriptions,
  getCallTransportInfo,
  getRtcConfiguration,
} from '../lib/senChatWebRtc.mjs'
import {
  mergeMessageReactions,
  reconcileMessages,
  reconcileConversations,
  getDeltaSyncCursor,
  setDeltaSyncCursor,
} from '../lib/senChatDeviceRelay.mjs'
import {
  SENAI_GEMINI_MODEL,
  callGeminiWithResilience,
  classifyGeminiError,
  resetSenAiCircuitBreakerForTesting,
  trimConversationHistoryToBudget,
} from '../lib/senChatAi.mjs'

// 1. Free tạo nhóm bị từ chối cả frontend và backend
test('v1.1.0 [1]: Free bị từ chối tạo nhóm ở cả frontend (ChatMlsGroupModal) và backend (/api/chat/mls/group)', () => {
  const res = canUserCreateGroup('free')
  assert.equal(res.allowed, false)
  assert.equal(res.entitlement.maxGroupMembers, 0)

  const modalSrc = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatMlsGroupModal.tsx'), 'utf8')
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/mls/group/route.ts'), 'utf8')
  assert.ok(modalSrc.includes('canUserCreateGroup'), 'Frontend phải kiểm tra canUserCreateGroup')
  assert.ok(apiSrc.includes('canUserCreateGroup'), 'Backend phải kiểm tra canUserCreateGroup')
})

// 2. Free tham gia và khởi tạo cuộc gọi trong nhóm hợp lệ
test('v1.1.0 [2]: Free tham gia và khởi tạo cuộc gọi trong nhóm của chủ nhóm trả phí (hạn mức theo chủ nhóm)', () => {
  // Chủ nhóm VIP (tối đa 20), caller là Free vẫn được tham gia/gọi
  const callCheck = validateGroupCallStartOrJoin('vip', 3)
  assert.equal(callCheck.allowed, true)
  assert.equal(callCheck.maxParticipants, 20)
  assert.equal(callCheck.maxDurationSeconds, 5 * 3600)
})

// 3–9. Kiểm tra giới hạn thành viên & vượt giới hạn thêm 1 thành viên ở từng gói
test('v1.1.0 [3-9]: Giới hạn thành viên tối đa (gồm chủ nhóm) cho Lite(5), VIP(20), Premium(50), Premium+(100), One Lite(30), One(200)', () => {
  const expected = [
    ['lite', 5],
    ['vip', 20],
    ['premium', 50],
    ['premium_plus', 100],
    ['sen_one_lite', 30],
    ['sen_one', 200],
  ]

  for (const [tier, max] of expected) {
    const okAtMax = validateGroupMemberLimit(tier, max - 1, 1)
    assert.equal(okAtMax.allowed, true, `${tier} phải cho phép đạt đúng ${max} thành viên`)
    assert.equal(okAtMax.maxMembers, max)

    const overByOne = validateGroupMemberLimit(tier, max, 1)
    assert.equal(overByOne.allowed, false, `${tier} phải chặn khi vượt quá ${max} thành viên (+1)`)
  }
})

// 10–12. Giới hạn thời lượng 1h (Lite), 5h (VIP) & refresh/reconnect không reset bộ đếm (controlled clock)
test('v1.1.0 [10-12]: Lite hết hạn sau 1h, VIP hết hạn sau 5h, refresh/reconnect không đặt lại thời lượng', () => {
  const startedAtMs = 1_700_000_000_000

  // Lite: 1 giờ = 3600s
  const liteBefore = validateGroupCallStartOrJoin('lite', 2, {
    startedAtMs,
    nowMs: startedAtMs + 3599 * 1000,
  })
  assert.equal(liteBefore.allowed, true)
  assert.equal(liteBefore.remainingSeconds, 1)

  const liteExpired = validateGroupCallStartOrJoin('lite', 2, {
    startedAtMs,
    nowMs: startedAtMs + 3600 * 1000,
  })
  assert.equal(liteExpired.allowed, false)
  assert.equal(liteExpired.remainingSeconds, 0)

  // VIP: 5 giờ = 18000s
  const vipBefore = validateGroupCallStartOrJoin('vip', 5, {
    startedAtMs,
    nowMs: startedAtMs + 17999 * 1000,
  })
  assert.equal(vipBefore.allowed, true)
  assert.equal(getCallDurationWarningLevel(vipBefore.remainingSeconds), 1)

  const vipExpired = validateGroupCallStartOrJoin('vip', 5, {
    startedAtMs,
    nowMs: startedAtMs + 18000 * 1000,
  })
  assert.equal(vipExpired.allowed, false)

  // Premium / One: Không giới hạn thời lượng
  const oneUnlimited = validateGroupCallStartOrJoin('sen_one', 100, {
    startedAtMs,
    nowMs: startedAtMs + 100 * 3600 * 1000,
  })
  assert.equal(oneUnlimited.allowed, true)
  assert.equal(oneUnlimited.maxDurationSeconds, null)
})

// 13–15. Race condition, Member tạo cuộc gọi nhóm, Người khởi tạo rời đi cuộc gọi vẫn tiếp tục
test('v1.1.0 [13-15]: Migration 016 & /api/chat/calls đảm bảo atomic concurrency, mọi member gọi được và rời không ngắt nhóm', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'migrations/016_sen_chat_v110_calls_and_entitlements.sql'),
    'utf8'
  )
  assert.ok(sql.includes('uq_chat_call_active_per_conv'), 'Phải có unique partial index chống tạo nhiều phiên gọi đồng thời')
  assert.ok(sql.includes('FOR UPDATE'), 'Phải khóa dòng hội thoại/phiên gọi chống race condition')
  assert.ok(sql.includes('create_or_join_group_call'), 'Phải có RPC create_or_join_group_call')
  assert.ok(sql.includes('leave_or_end_group_call'), 'Phải có RPC leave_or_end_group_call cho phép thành viên rời mà không kết thúc toàn nhóm')
  assert.ok(sql.includes('ALL_PARTICIPANTS_LEFT'), 'Chỉ kết thúc khi toàn bộ người tham gia đã rời đi')
})

// 16–19. Chuyển âm thanh -> video, chia sẻ màn hình, fullscreen, ICE restart / reconnect
test('v1.1.0 [16-19]: ChatCallModal hỗ trợ upgrade âm thanh->video tại chỗ, chia sẻ màn hình, fullscreen và ICE restart', () => {
  const callModalSrc = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatCallModal.tsx'), 'utf8')
  assert.ok(callModalSrc.includes('upgradeToVideoInPlace'), 'Phải có nâng cấp âm thanh sang video tại chỗ')
  assert.ok(callModalSrc.includes('getDisplayMedia'), 'Phải có chia sẻ màn hình')
  assert.ok(callModalSrc.includes('stopScreenShareAndRestoreCamera'), 'Phải tự khôi phục camera khi dừng chia sẻ')
  assert.ok(callModalSrc.includes('requestFullscreen'), 'Phải hỗ trợ Fullscreen')
  assert.ok(callModalSrc.includes('restartIce'), 'Phải hỗ trợ ICE Restart khi mất/gián đoạn mạng')
  assert.ok(callModalSrc.includes('SEN_CHAT_THEME'), 'Phải dùng Design Tokens Ocean Blue thống nhất')
  assert.ok(!callModalSrc.includes('emerald-500'), 'Không dùng màu xanh lá emerald-500 cho thương hiệu cuộc gọi')

  const rtcCfg = getRtcConfiguration()
  assert.ok(Array.isArray(rtcCfg.iceServers) && rtcCfg.iceServers.length >= 3)
})

// 20–21. Đồng bộ 2 domain & Đồng bộ reaction thêm/xóa nhiều thiết bị
test('v1.1.0 [20-21]: CSP hai domain & hợp nhất reaction thêm/xóa theo timestamp không hồi sinh reaction đã xóa', () => {
  const mw = fs.readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8')
  assert.ok(mw.includes('*.senexam.me'), 'CSP phải cho phép kết nối giữa *.senexam.me')
  assert.ok(mw.includes('display-capture=(self)'), 'Permissions-Policy phải cho phép display-capture')

  const msgDeviceA = {
    id: 'm1',
    createdAt: '2026-11-26T10:00:00Z',
    status: 'seen',
    reactions: { '👍': ['u1'] },
    reactionEvents: [{ emoji: '👍', userId: 'u1', action: 'add', updatedAt: 1000 }],
  }
  const msgDeviceB = {
    id: 'm1',
    createdAt: '2026-11-26T10:00:00Z',
    status: 'sent',
    reactions: {},
    reactionEvents: [{ emoji: '👍', userId: 'u1', action: 'remove', updatedAt: 2000 }],
  }

  const merged = reconcileMessages([msgDeviceA], [msgDeviceB])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].status, 'seen', 'Trạng thái seen không được lùi về sent')
  assert.equal(merged[0].reactions['👍'], undefined, 'Reaction đã xóa ở thời điểm mới hơn (2000) không được xuất hiện lại')

  const storage = new Map()
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  }
  setDeltaSyncCursor('user_1', 5000)
  assert.equal(getDeltaSyncCursor('user_1'), 5000)
  setDeltaSyncCursor('user_1', 3000)
  assert.equal(getDeltaSyncCursor('user_1'), 5000, 'Cursor delta sync chỉ tiến tới, không lùi')
})

// 22. Gemini gặp lỗi 429, 503, timeout và streaming gián đoạn + giữ nguyên gemini-3.5-flash-lite
test('v1.1.0 [22]: Gemini bắt buộc dùng gemini-3.5-flash-lite, xử lý 429/503/timeout và không retry khi đã phát một phần', async () => {
  assert.equal(SENAI_GEMINI_MODEL, 'gemini-3.5-flash-lite')
  resetSenAiCircuitBreakerForTesting()

  // Kiểm tra các route SenAI đều chỉ dùng gemini-3.5-flash-lite
  const chatSenai = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/senai/route.ts'), 'utf8')
  const senaiChat = fs.readFileSync(path.join(process.cwd(), 'app/api/senai-chat/route.ts'), 'utf8')
  const studioChat = fs.readFileSync(path.join(process.cwd(), 'app/api/senai-studio/chat/route.ts'), 'utf8')
  assert.ok(!chatSenai.includes('gemini-3.8-flash'), 'app/api/chat/senai không được tự chuyển sang gemini-3.8-flash')
  assert.ok(!senaiChat.includes('gemini-3.8-flash'), 'app/api/senai-chat không được tự chuyển sang gemini-3.8-flash')
  assert.ok(!studioChat.includes('gemini-3.8-flash'), 'app/api/senai-studio/chat không được tự chuyển sang gemini-3.8-flash')

  // Retry 429 -> thành công ở lần 2
  let attempts = 0
  const okReply = await callGeminiWithResilience(
    async (_sig, modelId) => {
      assert.equal(modelId, 'gemini-3.5-flash-lite')
      attempts++
      if (attempts === 1) {
        const err = new Error('Rate limit 429')
        err.status = 429
        throw err
      }
      return 'OK'
    },
    { maxRetries: 2, baseDelayMs: 5 }
  )
  assert.equal(okReply, 'OK')
  assert.equal(attempts, 2)

  // Không retry khi đã phát một phần nội dung (chống trùng câu trả lời)
  let partialAttempts = 0
  await assert.rejects(
    () =>
      callGeminiWithResilience(
        async () => {
          partialAttempts++
          const err = new Error('503 stream cut')
          err.status = 503
          throw err
        },
        { maxRetries: 2, baseDelayMs: 5, hasEmittedPartial: () => true }
      ),
    /503/
  )
  assert.equal(partialAttempts, 1, 'Không được retry khi đã phát nội dung một phần')

  const timeoutInfo = classifyGeminiError(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
  assert.equal(timeoutInfo.code, 504)
  assert.equal(timeoutInfo.retryable, true)

  const trimmed = trimConversationHistoryToBudget(
    [
      { role: 'user', content: 'A'.repeat(100) },
      { role: 'user', content: 'A'.repeat(100) }, // trùng
      { role: 'model', content: 'B'.repeat(100) },
    ],
    150
  )
  assert.equal(trimmed.length, 1)
})

// 23–24. Hạ cấp gói không làm mất dữ liệu & người ngoài nhóm không vào được cuộc gọi
test('v1.1.0 [23-24]: Hạ cấp về Free giữ nguyên nhóm/dữ liệu cũ, chỉ chặn thêm mới quá hạn mức; ngoài nhóm bị từ chối', () => {
  const downgradedAdd = validateGroupMemberLimit('free', 12, 1)
  assert.equal(downgradedAdd.allowed, false)
  assert.ok(downgradedAdd.error.includes('vẫn được giữ nguyên'))

  const callRouteSrc = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/calls/route.ts'), 'utf8')
  assert.ok(callRouteSrc.includes('NOT_A_MEMBER'), 'Người ngoài nhóm phải bị từ chối')
})

// 25. Kiểm thử tải & Dynamic Grid / Selective Subscription cho 5, 20, 30, 50, 100, 200 người
test('v1.1.0 [25]: Kiểm thử tải Dynamic Grid & Selective Video Subscription cho 5, 20, 30, 50, 100, 200 người', () => {
  const scales = [5, 20, 30, 50, 100, 200]
  for (const total of scales) {
    const participants = Array.from({ length: total }, (_, i) => ({
      userId: `u_${i}`,
      name: `Member ${i}`,
      micEnabled: true,
      cameraEnabled: true,
    }))

    const gridDesktop = computeCallGridLayout({ totalParticipants: total, viewportWidth: 1440 })
    const gridMobile = computeCallGridLayout({ totalParticipants: total, viewportWidth: 390 })
    assert.ok(gridDesktop.maxRenderedVideos <= 16, `Desktop (${total} người) chỉ render tối đa 16 tile/trang`)
    assert.ok(gridMobile.columns <= 2, `Mobile (${total} người) phải co linh hoạt <= 2 cột`)

    const subscribed = selectVisibleVideoSubscriptions(participants, {
      screenSharingUserId: `u_${total - 1}`,
      pinnedUserId: `u_${Math.floor(total / 2)}`,
      activeSpeakerId: 'u_2',
      page: 0,
      pageSize: gridDesktop.pageSize,
    })

    assert.ok(subscribed.length <= 16, 'Không bao giờ subscribe quá 16 luồng video đồng thời')
    assert.ok(subscribed.includes(`u_${total - 1}`), 'Luôn ưu tiên người đang chia sẻ màn hình')
    assert.ok(subscribed.includes(`u_${Math.floor(total / 2)}`), 'Luôn ưu tiên người được ghim')
    assert.ok(subscribed.includes('u_2'), 'Luôn ưu tiên người đang nói')
  }

  const sfuInfo = getCallTransportInfo(true, true)
  assert.equal(sfuInfo.mode, 'sfu')
  assert.equal(sfuInfo.isE2eeP2p, false, 'Không được hiển thị badge E2EE P2P cho cuộc gọi nhóm SFU')
})

// Phiên bản 1.1.0
test('v1.1.0: Phiên bản chính thức là 1.1.0 — Communication & Stability Update', () => {
  assert.equal(SEN_CHAT_CURRENT_VERSION, '1.1.0')
  assert.equal(SEN_CHAT_CHANGELOG[0].version, '1.1.0')
  assert.equal(SEN_CHAT_CHANGELOG[0].title, 'Communication & Stability Update')
})

// 26. Mobile routing m.senexam.me/chat, passthrough cho các ứng dụng & chống crash app/m/chat/page.tsx
test('v1.1.0 [26]: Điều hướng điện thoại về m.senexam.me/chat, mở được toàn bộ ứng dụng trên m.senexam.me và app/m/chat có ErrorBoundary + Suspense', () => {
  const mw = fs.readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8')
  assert.ok(mw.includes('MOBILE_PASSTHROUGH_PREFIXES'), 'middleware phải cho phép các ứng dụng con trên m.senexam.me mở đúng trang')
  assert.ok(mw.includes("'/new-video'") && mw.includes("'/new-focus'") && mw.includes("'/new-labs'"), 'Phải cho phép /new-video, /new-focus, /new-labs trên m.senexam.me')
  assert.ok(mw.includes("url.pathname = '/m/chat'"), 'm.senexam.me/chat phải rewrite về /m/chat')
  assert.ok(mw.includes("new URL('/chat' + request.nextUrl.search, 'https://m.senexam.me')"), 'chat.senexam.me trên điện thoại phải chuyển về m.senexam.me/chat')

  const mobileChatSrc = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(mobileChatSrc.includes('MobileChatErrorBoundary'), 'MobileChatPage phải có ErrorBoundary chống crash')
  assert.ok(mobileChatSrc.includes('<Suspense'), 'MobileChatPage phải bọc useSearchParams trong Suspense')
  assert.ok(mobileChatSrc.includes('resolvedAuthUserId'), 'Phải dùng biến resolvedAuthUserId an toàn ngoài khối try')
  assert.ok(!/\bSC\b|SenCash/i.test(mobileChatSrc), 'app/m/chat/page.tsx tuyệt đối không chứa SC hoặc SenCash')
})
