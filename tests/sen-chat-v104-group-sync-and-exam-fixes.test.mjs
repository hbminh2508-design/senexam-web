import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'

import {
  reconcileConversations,
  initDeviceRelay,
  checkDeviceSyncStatus,
  triggerFullDeviceSync,
} from '../lib/senChatDeviceRelay.mjs'

import {
  SENAI_STUDIO_CONVERSATION_ID,
  getLocalConversations,
  saveLocalConversation,
  togglePinConversation,
  markConversationUnread,
  saveLocalMessage,
  getLocalMessages,
  toggleMessageReaction,
  getConversationDraft,
  saveConversationDraft,
  clearConversationDraft,
} from '../lib/senChatStorage.mjs'

function setupMockBrowser() {
  const store = new Map()
  const dispatchedEvents = []
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (i) => Array.from(store.keys())[i] || null,
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
// 1. KIỂM THỬ PHIÊN BẢN 1.0.4 VÀ CHANGELOG
// ==============================================================================
test('Sen Chat v1.0.4: Phiên bản hiện tại >= 1.0.4 và changelog ghi log đầy đủ', () => {
  assert.ok(SEN_CHAT_CURRENT_VERSION >= '1.0.4')
  const v104 = SEN_CHAT_CHANGELOG.find((c) => c.version === '1.0.4')
  assert.ok(v104)
  assert.equal(v104.version, '1.0.4')
  assert.equal(v104.releaseDate, '25/11/2026')
  assert.ok(v104.changes.some((c) => c.includes('đồng bộ nhóm')))
  assert.ok(v104.changes.some((c) => c.includes('Reply') || c.includes('Trả lời')))
  assert.ok(v104.changes.some((c) => c.includes('SenExam')))

  const v103 = SEN_CHAT_CHANGELOG.find((c) => c.version === '1.0.3')
  assert.ok(v103)
  assert.equal(v103.isLatest, false)
})

// ==============================================================================
// 2. KIỂM THỬ ĐỒNG BỘ NHÓM ĐA THIẾT BỊ (reconcileConversations, relay, triggerFullDeviceSync)
// ==============================================================================
test('Sen Chat v1.0.4: reconcileConversations hợp nhất nhóm từ server & thiết bị khác chuẩn xác', () => {
  const local = [
    { id: SENAI_STUDIO_CONVERSATION_ID, partnerName: 'Old Name', isPinned: false, updatedAt: 100 },
    {
      id: 'group_1',
      partnerId: 'mls_1',
      partnerName: 'Nhóm Toán 12',
      isGroup: true,
      isPinned: true,
      unreadCount: 2,
      lastMessage: 'Tin cũ',
      lastMessageTime: '09:00',
      updatedAt: 1000,
    },
  ]

  const remote = [
    {
      id: 'group_1',
      partnerId: 'mls_1',
      partnerName: 'Nhóm Toán 12',
      isGroup: true,
      mlsGroupId: 'mls_1',
      role: 'member',
      isPinned: false,
      unreadCount: 0,
      lastMessage: 'Tin mới hơn từ máy khác',
      lastMessageTime: '10:05',
      updatedAt: 2000,
    },
    {
      id: 'group_2',
      partnerId: 'mls_2',
      partnerName: 'Nhóm Lý Chuyên',
      isGroup: true,
      mlsGroupId: 'mls_2',
      role: 'owner',
      unreadCount: 0,
      updatedAt: 1500,
    },
  ]

  const merged = reconcileConversations(local, remote)

  assert.equal(merged[0].id, SENAI_STUDIO_CONVERSATION_ID, 'SenAI Studio luôn ở đầu')
  assert.equal(merged[0].isPinned, true)
  assert.equal(merged.length, 3, 'Không trùng lặp ID')

  const g1 = merged.find((c) => c.id === 'group_1')
  assert.equal(g1.isPinned, true, 'Bảo toàn isPinned từ local')
  assert.equal(g1.unreadCount, 2, 'Bảo toàn unreadCount')
  assert.equal(g1.lastMessage, 'Tin mới hơn từ máy khác', 'Lấy lastMessage mới hơn')
  assert.equal(g1.mlsGroupId, 'mls_1')

  const g2 = merged.find((c) => c.id === 'group_2')
  assert.ok(g2, 'Nhóm mới từ server phải được thêm vào')
  assert.equal(g2.isGroup, true)
  assert.equal(g2.role, 'owner')

  // group_1 được ghim nên đứng ngay sau SenAI Studio
  assert.equal(merged[1].id, 'group_1')
  assert.equal(merged[2].id, 'group_2')
})

test('Sen Chat v1.0.4: initDeviceRelay đồng bộ danh sách nhóm trống qua P2P response_conversations_sync', () => {
  setupMockBrowser()
  saveLocalConversation({
    id: 'group_empty',
    partnerId: 'mls_empty',
    partnerName: 'Nhóm Mới Tạo Chưa Có Tin',
    isGroup: true,
    updatedAt: 5000,
    unreadCount: 0,
  })

  const handlers = {}
  const sentPayloads = []
  const mockSupabase = {
    channel: () => ({
      on: (_type, filter, cb) => {
        handlers[filter.event] = cb
      },
      send: (msg) => {
        sentPayloads.push(msg)
      },
      subscribe: () => {},
    }),
  }

  let reconciledCallbackResult = null
  const relay = initDeviceRelay({
    userId: 'user_A',
    supabaseClient: mockSupabase,
    onConversationsReconciled: (convs) => {
      reconciledCallbackResult = convs
    },
  })

  // Giả lập thiết bị khác gửi request_message_sync
  handlers['request_message_sync']({
    payload: { requestingDeviceId: 'dev_other' },
  })

  const convSyncMsg = sentPayloads.find((m) => m.event === 'response_conversations_sync')
  assert.ok(convSyncMsg, 'Phải gửi response_conversations_sync ngay cả khi nhóm chưa có tin nhắn')
  assert.equal(convSyncMsg.payload.targetDeviceId, 'dev_other')
  assert.ok(convSyncMsg.payload.conversations.some((c) => c.id === 'group_empty'))

  // Giả lập nhận response_conversations_sync từ thiết bị khác
  handlers['response_conversations_sync']({
    payload: {
      targetDeviceId: relay.deviceId,
      senderDeviceId: 'dev_other',
      conversations: [
        {
          id: 'group_remote',
          partnerId: 'mls_remote',
          partnerName: 'Nhóm Từ Máy Khác',
          isGroup: true,
          updatedAt: 9000,
          unreadCount: 0,
        },
      ],
    },
  })

  assert.ok(reconciledCallbackResult, 'onConversationsReconciled phải được gọi')
  assert.ok(reconciledCallbackResult.some((c) => c.id === 'group_remote'))
  assert.ok(getLocalConversations().some((c) => c.id === 'group_remote'))
  relay.cleanup()
})

test('Sen Chat v1.0.4: checkDeviceSyncStatus phát hiện nhóm thiếu trên server và triggerFullDeviceSync kéo nhóm về', async () => {
  const { dispatchedEvents } = setupMockBrowser()

  const status = await checkDeviceSyncStatus('user_1', 'dev_1', {
    devices: [{ device_id: 'dev_1', is_active: true }],
    serverConversations: [
      { id: 'group_server_only', partnerName: 'Nhóm Trên Server', isGroup: true, updatedAt: Date.now() },
    ],
  })
  assert.equal(status.needsSync, true)
  assert.equal(status.reason, 'missing_server_conversations')
  assert.equal(status.missingConversationsCount, 1)

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (url.includes('/api/chat/mls/group')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          conversations: [
            {
              id: 'group_server_only',
              partnerId: 'mls_srv',
              partnerName: 'Nhóm Trên Server',
              isGroup: true,
              mlsGroupId: 'mls_srv',
              role: 'member',
              updatedAt: Date.now(),
              unreadCount: 0,
            },
          ],
        }),
      }
    }
    if (url.includes('/api/chat/sync')) {
      return {
        ok: true,
        json: async () => ({ success: true, messages: [] }),
      }
    }
    return { ok: true, json: async () => ({ devices: [] }) }
  }

  try {
    const syncRes = await triggerFullDeviceSync('user_1', 'dev_1', {
      devices: [{ device_id: 'dev_1', is_active: true }],
      accessToken: 'tok_test',
    })
    assert.equal(syncRes.success, true)
    assert.equal(syncRes.syncedConversationsCount, 1)
    assert.ok(getLocalConversations().some((c) => c.id === 'group_server_only'))
    assert.ok(dispatchedEvents.some((e) => e.type === 'senchat-conversations-reconciled'))
    assert.ok(dispatchedEvents.some((e) => e.type === 'senchat-sync-completed'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ==============================================================================
// 3. KIỂM THỬ CÁC TÍNH NĂNG MỚI SEN CHAT (Reply, Reaction, Pin, Unread, Draft)
// ==============================================================================
test('Sen Chat v1.0.4: Pin/Unpin, Mark Unread, Emoji Reactions và Input Drafts hoạt động chính xác', () => {
  setupMockBrowser()

  saveLocalConversation({
    id: 'conv_a',
    partnerId: 'user_a',
    partnerName: 'Bạn A',
    partnerIdentifier: 'a@senexam.me',
    unreadCount: 0,
    updatedAt: 1000,
  })
  saveLocalConversation({
    id: 'conv_b',
    partnerId: 'user_b',
    partnerName: 'Bạn B',
    partnerIdentifier: 'b@senexam.me',
    unreadCount: 0,
    updatedAt: 2000,
  })

  // Pin conv_a -> đứng ngay dưới SenAI Studio dù updatedAt nhỏ hơn conv_b
  const pinnedList = togglePinConversation('conv_a')
  assert.equal(pinnedList[0].id, SENAI_STUDIO_CONVERSATION_ID)
  assert.equal(pinnedList[1].id, 'conv_a')
  assert.equal(pinnedList[1].isPinned, true)

  // Mark Unread
  const unreadList = markConversationUnread('conv_b', 3)
  assert.equal(unreadList.find((c) => c.id === 'conv_b').unreadCount, 3)

  // Reactions toggle
  saveLocalMessage('conv_a', {
    id: 'm_react',
    conversationId: 'conv_a',
    senderId: 'user_a',
    senderName: 'Bạn A',
    receiverId: 'me',
    content: 'Hello',
    type: 'text',
    createdAt: new Date().toISOString(),
    status: 'received',
  })
  let msgs = toggleMessageReaction('conv_a', 'm_react', '❤️', 'me')
  assert.deepEqual(msgs[0].reactions['❤️'], ['me'])
  msgs = toggleMessageReaction('conv_a', 'm_react', '❤️', 'me')
  assert.equal(msgs[0].reactions['❤️'], undefined, 'Bấm lại cùng emoji phải gỡ reaction')
  assert.equal(getLocalMessages('conv_a').length, 1)

  // Input Drafts
  saveConversationDraft('conv_a', 'Đang gõ dở câu trả lời...')
  assert.equal(getConversationDraft('conv_a'), 'Đang gõ dở câu trả lời...')
  assert.equal(getConversationDraft('conv_b'), '')
  clearConversationDraft('conv_a')
  assert.equal(getConversationDraft('conv_a'), '')
})

// ==============================================================================
// 4. KIỂM THỬ API & SENEXAM FIXES & QUY TẮC BẮT BUỘC
// ==============================================================================
test('Sen Chat v1.0.4 & SenExam: Kiểm tra API sync nhóm, UI Desktop/Mobile, quy tắc app/m/ và bản vá SenExam', () => {
  const mlsGroupRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/mls/group/route.ts'), 'utf8')
  assert.ok(mlsGroupRoute.includes('export async function GET'), 'app/api/chat/mls/group/route.ts phải có GET handler')
  assert.ok(mlsGroupRoute.includes('chat_members') && mlsGroupRoute.includes('chat_conversations'))

  const syncRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/sync/route.ts'), 'utf8')
  assert.ok(syncRoute.includes('sync_conversations'), 'app/api/chat/sync/route.ts phải hỗ trợ sync_conversations')

  const desktopChat = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(desktopChat.includes('togglePinConversation'))
  assert.ok(desktopChat.includes('markConversationUnread'))
  assert.ok(desktopChat.includes('changeChatReaction'))
  assert.ok(desktopChat.includes('saveConversationDraft'))
  assert.ok(desktopChat.includes('senchat-conversations-reconciled'))

  const mobileChat = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(mobileChat.includes('togglePinConversation'))
  assert.ok(mobileChat.includes('markConversationUnread'))
  assert.ok(mobileChat.includes('changeChatReaction'))
  assert.ok(mobileChat.includes('saveConversationDraft'))
  assert.ok(mobileChat.includes('senchat-conversations-reconciled'))

  // Quy tắc cấm "SC" / "SenCash" trong app/m/chat/page.tsx
  assert.equal(mobileChat.includes('SenCash'), false)
  assert.equal(mobileChat.match(/\bSC\b|SC(?=[^m]|$)/g), null)

  // SenExam fixes
  const examEngine = fs.readFileSync(path.join(process.cwd(), 'lib/useExamEngine.ts'), 'utf8')
  assert.ok(examEngine.includes('tabSwitchesRef'), 'useExamEngine phải dùng tabSwitchesRef tránh reset interval')
  assert.ok(examEngine.includes('beforeunload'), 'useExamEngine phải lưu nháp khi beforeunload')
  assert.ok(examEngine.includes('300'), 'useExamEngine phải có debounce 300ms khi selectAnswer')
  assert.ok(examEngine.includes('Authorization'), 'useExamEngine submit phải gửi Bearer token')
  assert.ok(examEngine.includes('idempotencyKey'), 'useExamEngine submit phải gửi idempotencyKey')
  assert.ok(examEngine.includes('!apiRes.ok'), 'useExamEngine submit phải kiểm tra !apiRes.ok trước khi parse JSON')

  const examSubmitRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/exams/submit/route.ts'), 'utf8')
  assert.ok(examSubmitRoute.includes('!isNaN(serverElapsed)'), 'submit route phải kiểm tra !isNaN(serverElapsed)')

  const mobileExam = fs.readFileSync(path.join(process.cwd(), 'app/m/exams/[id]/page.tsx'), 'utf8')
  assert.ok(mobileExam.includes('handleSubmitExamRef'), 'mobile exam phải dùng handleSubmitExamRef tránh stale closure')
})

test('Sen Chat v1.0.4: checkDeviceSyncStatus tự resolve token từ supabaseClient và triggerFullDeviceSync giữ SenAI Studio ở đầu khi có tin nhắn mới', async () => {
  const { store, dispatchedEvents } = setupMockBrowser()
  const origFetch = globalThis.fetch

  try {
    let fetchedGroupWithAuth = false
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('/api/chat/device-management')) {
        return { ok: true, json: async () => ({ devices: [{ device_id: 'dev_a', is_active: true }] }) }
      }
      if (String(url).includes('/api/chat/mls/group')) {
        if (init?.headers?.Authorization === 'Bearer session_tok_123') {
          fetchedGroupWithAuth = true
          return {
            ok: true,
            json: async () => ({
              conversations: [{ id: 'grp_session_1', type: 'group', isGroup: true, partnerName: 'Nhóm Session', updatedAt: Date.now() }],
            }),
          }
        }
        return { ok: false, status: 401, json: async () => ({}) }
      }
      if (String(url).includes('/api/chat/sync')) {
        return {
          ok: true,
          json: async () => ({
            messages: [
              {
                id: 'msg_transit_1',
                conversationId: 'conv_new_peer',
                senderId: 'peer_1',
                senderName: 'Bạn B',
                receiverId: 'u_test',
                content: 'Chào bạn',
                type: 'text',
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        }
      }
      return { ok: true, json: async () => ({}) }
    }

    const mockSupabase = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'session_tok_123' } } }),
      },
    }

    const status = await checkDeviceSyncStatus('u_test', 'dev_a', {
      supabaseClient: mockSupabase,
    })
    assert.equal(fetchedGroupWithAuth, true, 'checkDeviceSyncStatus phải tự resolve access_token từ supabaseClient.auth.getSession()')
    assert.equal(status.needsSync, true)
    assert.equal(status.reason, 'missing_server_conversations')

    await triggerFullDeviceSync('u_test', 'dev_a', {
      supabaseClient: mockSupabase,
      devices: [{ device_id: 'dev_a', is_active: true }],
    })

    const saved = JSON.parse(store.get('sen_chat_conversations') || '[]')
    assert.equal(saved[0].id, SENAI_STUDIO_CONVERSATION_ID, 'SENAI_STUDIO_CONVERSATION phải luôn ở index 0')
    assert.ok(saved.some((c) => c.id === 'grp_session_1'), 'Phải có nhóm từ server')
    assert.ok(saved.some((c) => c.id === 'conv_new_peer'), 'Phải có hội thoại mới từ transit pull')
    assert.ok(
      dispatchedEvents.some((e) => e.type === 'senchat-conversations-reconciled'),
      'Phải phát senchat-conversations-reconciled khi có hội thoại mới'
    )
  } finally {
    globalThis.fetch = origFetch
  }
})
