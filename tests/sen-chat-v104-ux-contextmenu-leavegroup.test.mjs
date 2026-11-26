import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'

import {
  initDeviceRelay,
  broadcastConversationRemoved,
  triggerFullDeviceSync,
} from '../lib/senChatDeviceRelay.mjs'

import {
  saveLocalConversation,
  getLocalConversations,
  saveLocalMessage,
  getLocalMessages,
} from '../lib/senChatStorage.mjs'

function setupMockBrowser() {
  const store = new Map()
  const dispatchedEvents = []
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }
  globalThis.window = {
    dispatchEvent: (ev) => {
      dispatchedEvents.push(ev)
    },
  }
  return { store, dispatchedEvents }
}

// ==============================================================================
// 1. KIỂM THỬ RỜI NHÓM TRIỆT ĐỂ (BACKEND + MODAL + MULTI-DEVICE RELAY)
// ==============================================================================
test('Sen Chat v1.0.4 UX: DELETE /api/chat/mls/members và ChatMlsGroupModal xử lý rời nhóm chuẩn xác (kể cả owner)', () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'app/api/chat/mls/members/route.ts'),
    'utf8'
  )
  assert.ok(routeCode.includes('isSelfLeave'), 'Route DELETE phải phân biệt tự rời nhóm (isSelfLeave)')
  assert.ok(
    routeCode.includes("callerMember?.role === 'owner'") && routeCode.includes("update({ role: 'owner' })"),
    'Route DELETE phải tự động chuyển quyền owner cho thành viên kỳ cựu trước khi owner rời nhóm'
  )
  assert.ok(
    routeCode.includes(".from('chat_members')") && routeCode.includes('.delete()') && routeCode.includes('mls_epoch'),
    'Route DELETE phải có fallback xóa trực tiếp chat_members và cập nhật mls_epoch để rời nhóm thành công 100%'
  )

  const modalCode = fs.readFileSync(
    path.join(process.cwd(), 'components/chat/ChatMlsGroupModal.tsx'),
    'utf8'
  )
  assert.ok(modalCode.includes('Rời khỏi nhóm'), 'ChatMlsGroupModal phải có nút Rời khỏi nhóm nổi bật ở chân modal')
  assert.ok(modalCode.includes('deleteLocalConversation'), 'ChatMlsGroupModal phải xóa conversation local khi rời nhóm')
  assert.ok(modalCode.includes('clearAllLocalMessages'), 'ChatMlsGroupModal phải xóa local messages khi rời nhóm')
  assert.ok(modalCode.includes('broadcastConversationRemoved'), 'ChatMlsGroupModal phải broadcast sự kiện rời nhóm tới các thiết bị khác')
  assert.ok(modalCode.includes('onGroupLeft'), 'ChatMlsGroupModal phải hỗ trợ callback onGroupLeft')
})

test('Sen Chat v1.0.4 UX: broadcastConversationRemoved đồng bộ gỡ nhóm âm thầm giữa các thiết bị', () => {
  const { dispatchedEvents } = setupMockBrowser()

  saveLocalConversation({
    id: 'group_leave_test',
    partnerId: 'group_leave_test',
    partnerName: 'Nhóm test rời',
    partnerIdentifier: 'MLS_GROUP',
    unreadCount: 0,
    updatedAt: Date.now(),
    isGroup: true,
  })
  saveLocalMessage('group_leave_test', {
    id: 'm1',
    conversationId: 'group_leave_test',
    senderId: 'u2',
    senderName: 'Bạn',
    receiverId: 'group_leave_test',
    content: 'Xin chào',
    type: 'text',
    createdAt: new Date().toISOString(),
    status: 'received',
  })

  const listeners = new Map()
  const mockChannel = {
    on: (_type, filter, cb) => {
      listeners.set(filter.event, cb)
      return mockChannel
    },
    send: (msg) => {
      if (msg.event === 'conversation_removed') {
        const cb = listeners.get('conversation_removed')
        if (cb) {
          cb({
            payload: {
              ...msg.payload,
              senderDeviceId: 'other_device_999',
            },
          })
        }
      }
    },
    subscribe: () => mockChannel,
  }

  initDeviceRelay({
    userId: 'user_1',
    supabaseClient: { channel: () => mockChannel, removeChannel: () => {} },
  })

  broadcastConversationRemoved('group_leave_test')

  const remainingConvs = getLocalConversations()
  assert.equal(
    remainingConvs.some((c) => c.id === 'group_leave_test'),
    false,
    'Nhóm đã rời phải bị gỡ khỏi localStorage sau khi nhận broadcast conversation_removed'
  )
  assert.equal(getLocalMessages('group_leave_test').length, 0, 'Tin nhắn của nhóm đã rời phải được dọn sạch')
  assert.ok(
    dispatchedEvents.some((ev) => ev.type === 'senchat-conversation-removed' && ev.detail?.conversationId === 'group_leave_test'),
    'Phải phát CustomEvent senchat-conversation-removed'
  )
})

// ==============================================================================
// 2. KIỂM THỬ CUSTOM CONTEXT MENU (PORTAL, VIEWPORT CLAMPING, 2 CHẾ ĐỘ)
// ==============================================================================
test('Sen Chat v1.0.4 UX: ChatContextMenu.tsx dùng createPortal và hỗ trợ menu tin nhắn + menu cuộc trò chuyện', () => {
  const menuPath = path.join(process.cwd(), 'components/chat/ChatContextMenu.tsx')
  assert.ok(fs.existsSync(menuPath), 'components/chat/ChatContextMenu.tsx phải tồn tại')

  const menuCode = fs.readFileSync(menuPath, 'utf8')
  assert.ok(menuCode.includes('createPortal'), 'ChatContextMenu phải render qua createPortal(..., document.body)')
  assert.ok(menuCode.includes('z-[9999]'), 'ChatContextMenu phải có z-[9999]')
  assert.ok(menuCode.includes("mode === 'message'") && menuCode.includes("mode === 'conversation'"), 'ChatContextMenu phải hỗ trợ cả 2 chế độ message & conversation')
  assert.ok(menuCode.includes('Trả lời tin nhắn') && menuCode.includes('Sao chép nội dung'), 'Menu tin nhắn phải có Trả lời & Sao chép')
  assert.ok(menuCode.includes('Ghim cuộc trò chuyện') && menuCode.includes('Rời khỏi nhóm'), 'Menu cuộc trò chuyện phải có Ghim & Rời khỏi nhóm')
  assert.ok(menuCode.includes("e.key === 'Escape'"), 'ChatContextMenu phải đóng khi bấm Escape')
})

// ==============================================================================
// 3. KIỂM THỬ LONG-PRESS IPHONE/IPAD & ONCONTEXTMENU DESKTOP + MOBILE
// ==============================================================================
test('Sen Chat v1.0.4 UX: Desktop & Mobile hỗ trợ onContextMenu và Long-press iPhone/iPad (-webkit-touch-callout: none)', () => {
  for (const relPath of ['app/chat/page.tsx', 'app/m/chat/page.tsx']) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
    assert.ok(code.includes('ChatContextMenu'), `${relPath} phải tích hợp ChatContextMenu`)
    assert.ok(code.includes('onContextMenu'), `${relPath} phải chặn menu trình duyệt bằng onContextMenu`)
    assert.ok(code.includes('onTouchStart') && code.includes('onTouchEnd'), `${relPath} phải hỗ trợ long-press touch cho iPhone/iPad`)
    assert.ok(code.includes('WebkitTouchCallout'), `${relPath} phải tắt touch callout mặc định của iOS Safari`)
  }
})

// ==============================================================================
// 4. KIỂM THỬ SILENT CONTINUOUS SYNC (KHÔNG BANNER THÔNG BÁO)
// ==============================================================================
test('Sen Chat v1.0.4 UX: Không còn banner thông báo đồng bộ, chạy Silent Continuous Background Sync', () => {
  for (const relPath of ['app/chat/page.tsx', 'app/m/chat/page.tsx']) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
    assert.equal(code.includes('showSyncBanner'), false, `${relPath} không được chứa showSyncBanner`)
    assert.equal(code.includes('Phát hiện dữ liệu chưa đồng bộ'), false, `${relPath} không được hiện banner thông báo đồng bộ`)
    assert.ok(code.includes('runSilentBackgroundSync'), `${relPath} phải có runSilentBackgroundSync`)
    assert.ok(code.includes('visibilitychange'), `${relPath} phải đồng bộ ngầm khi quay lại tab`)
  }

  const settingsCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatSettingsModal.tsx'), 'utf8')
  assert.ok(
    settingsCode.includes('Tự động đồng bộ ngầm liên tục giữa các thiết bị'),
    'ChatSettingsModal phải hiển thị trạng thái đồng bộ ngầm nhẹ nhàng'
  )
})

// ==============================================================================
// 5. KIỂM THỬ TÔNG MÀU XANH NƯỚC BIỂN & LOG PHIÊN BẢN 1.0.4
// ==============================================================================
test('Sen Chat v1.0.4 UX: Bong bóng chat isMe & giao diện chính dùng tông xanh nước biển (blue-600 / sky-500) và log v1.0.4 đầy đủ', () => {
  for (const relPath of ['app/chat/page.tsx', 'app/m/chat/page.tsx']) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
    assert.ok(
      code.includes('from-blue-600 to-sky-500'),
      `${relPath} phải dùng tông xanh nước biển from-blue-600 to-sky-500 cho bong bóng chat isMe`
    )
    assert.ok(
      code.includes('overscroll-contain') && code.includes('transform-gpu'),
      `${relPath} phải tối ưu độ mượt cuộn với overscroll-contain và transform-gpu`
    )
  }

  assert.ok(SEN_CHAT_CURRENT_VERSION >= '1.0.4')
  const v104 = SEN_CHAT_CHANGELOG.find((c) => c.version === '1.0.4')
  assert.ok(v104)
  assert.ok(v104.changes.some((c) => c.includes('rời được khỏi nhóm')))
  assert.ok(v104.changes.some((c) => c.includes('Custom Context Menu')))
  assert.ok(v104.changes.some((c) => c.includes('đồng bộ ngầm liên tục')))
  assert.ok(v104.changes.some((c) => c.includes('xanh nước biển')))
})

// ==============================================================================
// 6. KIỂM TRA TỪ CẤM "SC" / "SenCash" TRONG app/m/
// ==============================================================================
test('Sen Chat v1.0.4 UX: app/m/chat/page.tsx TUYỆT ĐỐI KHÔNG chứa chuỗi cấm "SC" hoặc "SenCash"', () => {
  const mobileContent = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.equal(mobileContent.includes('SenCash'), false, 'app/m/chat/page.tsx không được chứa "SenCash"')
  const forbiddenScRegex = /\bSC\b|SC(?=[^m]|$)/g
  const scMatches = mobileContent.match(forbiddenScRegex)
  assert.equal(scMatches, null, `app/m/chat/page.tsx không được chứa "SC" lẻ loi: ${JSON.stringify(scMatches)}`)
})

// ==============================================================================
// 7. KIỂM THỬ PRUNE NHÓM ĐÃ RỜI KHI OFFLINE SYNC & CHỐNG GHOST CLICK SAU LONG-PRESS
// ==============================================================================
test('Sen Chat v1.0.4 UX: triggerFullDeviceSync tự gỡ nhóm đã rời khi thiết bị offline đồng bộ lại & chống ghost click', async () => {
  setupMockBrowser()
  saveLocalConversation({
    id: 'group_already_left_on_other_device',
    partnerId: 'group_already_left_on_other_device',
    partnerName: 'Nhóm đã rời ở máy khác',
    partnerIdentifier: 'MLS_GROUP',
    unreadCount: 0,
    updatedAt: Date.now(),
    isGroup: true,
  })
  saveLocalMessage('group_already_left_on_other_device', {
    id: 'm_stale',
    conversationId: 'group_already_left_on_other_device',
    senderId: 'u2',
    senderName: 'Bạn',
    receiverId: 'group_already_left_on_other_device',
    content: 'Tin cũ',
    type: 'text',
    createdAt: new Date().toISOString(),
    status: 'received',
  })

  const origFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/chat/mls/group')) {
      return {
        ok: true,
        json: async () => ({ success: true, conversations: [] }),
      }
    }
    if (String(url).includes('/api/chat/sync')) {
      return {
        ok: true,
        json: async () => ({ success: true, messages: [] }),
      }
    }
    return { ok: true, json: async () => ({ devices: [] }) }
  }

  try {
    await triggerFullDeviceSync('user_1', 'dev_offline', {
      devices: [{ device_id: 'dev_offline', is_active: true }],
      accessToken: 'tok_valid',
    })
    assert.equal(
      getLocalConversations().some((c) => c.id === 'group_already_left_on_other_device'),
      false,
      'Thiết bị từng offline phải tự động gỡ nhóm không còn trên server khi đồng bộ lại'
    )
    assert.equal(
      getLocalMessages('group_already_left_on_other_device').length,
      0,
      'Tin nhắn của nhóm đã rời phải được dọn sạch'
    )
  } finally {
    globalThis.fetch = origFetch
  }

  for (const relPath of ['app/chat/page.tsx', 'app/m/chat/page.tsx']) {
    const code = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
    assert.ok(code.includes('longPressTriggeredRef'), `${relPath} phải chặn ghost click sau long-press`)
    assert.ok(code.includes('onTouchCancel'), `${relPath} phải xử lý onTouchCancel`)
  }
})
