import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  compressChatMessage,
  decompressChatMessage,
  compressChatMessageSync,
  decompressChatMessageSync,
  isCompressedChatMessage,
  getCompressionStats,
} from '../lib/senChatCompression.mjs'

import {
  SENAI_STUDIO_CONVERSATION_ID,
  SENAI_STUDIO_CONVERSATION,
  ensureSenAiStudioInConversations,
  TEXT_MESSAGE_RETENTION_MS,
  getChatFontSize,
  setChatFontSize,
  getChatSendKey,
  setChatSendKey,
  getChatNotificationSettings,
  setChatNotificationSettings,
  getDetailedStorageBreakdown,
  exportAllChatDataJson,
} from '../lib/senChatStorage.mjs'

// ==============================================================================
// 1. KIỂM THỬ NÉN & GIẢI NÉN TIN NHẮN (SEN CHAT COMPRESSION)
// ==============================================================================
test('Sen Chat: Nén và giải nén tin nhắn đồng bộ và bất đồng bộ chuẩn xác', async () => {
  const longText = 'Đây là nội dung tin nhắn rất dài nhằm mục đích kiểm tra tỷ lệ nén của gzip/deflate trong Sen Chat. '.repeat(100)

  // Async roundtrip
  const compressedAsync = await compressChatMessage(longText)
  assert.ok(isCompressedChatMessage(compressedAsync), 'Tin nhắn nén phải có tiền tố SEN_Z:')
  const decompressedAsync = await decompressChatMessage(compressedAsync)
  assert.equal(decompressedAsync, longText, 'Giải nén async phải trả về chuỗi ban đầu')

  // Sync roundtrip
  const compressedSync = compressChatMessageSync(longText)
  assert.ok(isCompressedChatMessage(compressedSync), 'Tin nhắn nén sync phải có tiền tố SEN_Z:')
  const decompressedSync = decompressChatMessageSync(compressedSync)
  assert.equal(decompressedSync, longText, 'Giải nén sync phải trả về chuỗi ban đầu')

  // Stats
  const stats = getCompressionStats(longText, compressedSync)
  assert.ok(stats.compressedBytes < stats.originalBytes, 'Dung lượng sau nén phải nhỏ hơn ban đầu')
  assert.ok(stats.savingsPercent > 0, 'Tỷ lệ tiết kiệm dung lượng phải lớn hơn 0%')

  // Transparent handling: Tin nhắn thường (legacy) không bị lỗi và giữ nguyên
  const legacyText = 'Xin chào, đây là tin nhắn chưa qua nén!'
  assert.equal(isCompressedChatMessage(legacyText), false)
  assert.equal(decompressChatMessageSync(legacyText), legacyText)
  assert.equal(await decompressChatMessage(legacyText), legacyText)

  // Chuỗi rỗng
  assert.equal(await compressChatMessage(''), '')
  assert.equal(compressChatMessageSync(''), '')
  assert.equal(decompressChatMessageSync(''), '')
})

// ==============================================================================
// 2. KIỂM THỬ SENAI STUDIO GHIM ĐẦU & PHIÊN TRÒ CHUYỆN VĨNH VIỄN
// ==============================================================================
test('Sen Chat: SenAI Studio luôn được ghim ở đầu (index 0) và không bị xóa', () => {
  assert.equal(SENAI_STUDIO_CONVERSATION_ID, 'senai-studio')
  assert.equal(SENAI_STUDIO_CONVERSATION.id, 'senai-studio')
  assert.equal(SENAI_STUDIO_CONVERSATION.isPinned, true)

  // Danh sách ban đầu rỗng
  const emptyList = []
  const pinnedList = ensureSenAiStudioInConversations(emptyList)
  assert.equal(pinnedList.length, 1)
  assert.equal(pinnedList[0].id, 'senai-studio')
  assert.equal(pinnedList[0].isPinned, true)

  // Danh sách có các cuộc trò chuyện khác
  const mockConvs = [
    { id: 'conv-1', name: 'Nhóm Toán 12', isPinned: true },
    { id: 'conv-2', name: 'Bạn An', isPinned: false },
    { id: 'senai-studio', name: 'SenAI Studio', isPinned: false },
  ]
  const reordered = ensureSenAiStudioInConversations(mockConvs)
  assert.equal(reordered.length, 3)
  assert.equal(reordered[0].id, 'senai-studio', 'SenAI Studio phải luôn ở index 0')
  assert.equal(reordered[0].isPinned, true, 'SenAI Studio phải luôn có isPinned = true')
  assert.equal(reordered[1].id, 'conv-1')
  assert.equal(reordered[2].id, 'conv-2')
})

// ==============================================================================
// 3. KIỂM THỬ VÒNG ĐỜI TIN NHẮN 30 NGÀY & BẢO TOÀN NHÓM VĨNH VIỄN
// ==============================================================================
test('Sen Chat: Quy định 30 ngày cho tin nhắn văn bản và bảo tồn nhóm vĩnh viễn', () => {
  assert.equal(TEXT_MESSAGE_RETENTION_MS, 30 * 24 * 60 * 60 * 1000)

  // Kiểm tra mã nguồn senChatStorage.ts và senChatStorage.mjs
  const tsStorage = fs.readFileSync(path.join(process.cwd(), 'lib/senChatStorage.ts'), 'utf8')
  assert.ok(tsStorage.includes('TEXT_MESSAGE_RETENTION_DAYS = 30'))
  assert.ok(tsStorage.includes('TEXT_MESSAGE_RETENTION_MS'))
  assert.ok(
    tsStorage.includes('SENAI_STUDIO_CONVERSATION_ID') &&
    (tsStorage.includes('conversationId === SENAI_STUDIO_CONVERSATION_ID') || tsStorage.includes("conversationId === 'senai-studio'")),
    'Tin nhắn SenAI Studio được bảo lưu vĩnh viễn'
  )
  assert.ok(tsStorage.includes('attachmentId || m.storagePath || m.driveFileId'), 'Tin nhắn chứa tệp đính kèm tuân theo vòng đời độc lập')

  // Kiểm tra thông báo hiển thị trên giao diện chat
  const chatPage = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(chatPage.includes('CHAT_RETENTION_POLICY_NOTICE') || chatPage.includes('30 ngày'), 'Hiển thị chính sách bảo mật 30 ngày')
  assert.ok(tsStorage.includes('CHAT_RETENTION_POLICY_NOTICE'), 'Định nghĩa CHAT_RETENTION_POLICY_NOTICE')

  const mobileChatPage = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(mobileChatPage.includes('CHAT_RETENTION_POLICY_NOTICE') || mobileChatPage.includes('30 ngày'), 'Mobile chat hiển thị thông báo chính sách bảo mật 30 ngày')
})

// ==============================================================================
// 4. KIỂM THỬ CÀI ĐẶT MỚI: CỠ CHỮ, PHÍM GỬI, THÔNG BÁO, QUẢN LÝ DUNG LƯỢNG & EXPORT JSON
// ==============================================================================
test('Sen Chat: Tùy chọn cài đặt nâng cao và sao lưu JSON', () => {
  // Mock localStorage
  const store = {}
  global.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }

  // Cỡ chữ
  assert.equal(getChatFontSize(), 'normal')
  setChatFontSize('large')
  assert.equal(getChatFontSize(), 'large')

  // Phím gửi
  assert.equal(getChatSendKey(), 'enter')
  setChatSendKey('shift_enter')
  assert.equal(getChatSendKey(), 'shift_enter')

  // Cài đặt thông báo
  const initialNotifs = getChatNotificationSettings()
  assert.equal(initialNotifs.messageSound, true)
  assert.equal(initialNotifs.callSound, true)
  assert.equal(initialNotifs.mentionSen, true)

  setChatNotificationSettings({ messageSound: false, callSound: true, mentionSen: false })
  const updatedNotifs = getChatNotificationSettings()
  assert.equal(updatedNotifs.messageSound, false)
  assert.equal(updatedNotifs.mentionSen, false)

  // Thống kê dung lượng chi tiết
  const breakdown = getDetailedStorageBreakdown()
  assert.ok(typeof breakdown.totalBytes === 'number')
  assert.ok(typeof breakdown.compressedMessages.bytes === 'number')
  assert.ok(typeof breakdown.images.bytes === 'number')
  assert.ok(typeof breakdown.videos.bytes === 'number')
  assert.ok(typeof breakdown.files.bytes === 'number')
  assert.ok(typeof breakdown.audio.bytes === 'number')

  // Export JSON
  const exported = exportAllChatDataJson()
  assert.ok(exported.includes('"conversations"'))
  assert.ok(exported.includes('"exportedAt"'))
  const parsed = JSON.parse(exported)
  assert.ok(Array.isArray(parsed.conversations))
})

// ==============================================================================
// 5. KIỂM THỬ XEM TRƯỚC FILE (ChatFilePreviewModal) & XƯỞNG AI (ChatSenAiStudioView)
// ==============================================================================
test('Sen Chat: ChatFilePreviewModal và ChatSenAiStudioView được triển khai đầy đủ', () => {
  const modalPath = path.join(process.cwd(), 'components/chat/ChatFilePreviewModal.tsx')
  assert.ok(fs.existsSync(modalPath), 'ChatFilePreviewModal.tsx phải tồn tại')
  const modalContent = fs.readFileSync(modalPath, 'utf8')
  assert.ok(modalContent.includes('image/*') || modalContent.includes('zoom'), 'Hỗ trợ xem ảnh phóng to')
  assert.ok(modalContent.includes('<audio') || modalContent.includes('wavesurfer') || modalContent.includes('Trình phát âm thanh'), 'Hỗ trợ phát âm thanh')
  assert.ok(modalContent.includes('<video'), 'Hỗ trợ phát video')
  assert.ok(modalContent.includes('application/pdf') || modalContent.includes('PDF'), 'Hỗ trợ PDF')
  assert.ok(modalContent.includes('SHA-256') || modalContent.includes('Mã băm SHA-256'), 'Hỗ trợ thẻ File Inspector với SHA-256')

  const studioPath = path.join(process.cwd(), 'components/chat/ChatSenAiStudioView.tsx')
  assert.ok(fs.existsSync(studioPath), 'ChatSenAiStudioView.tsx phải tồn tại')
  const studioContent = fs.readFileSync(studioPath, 'utf8')
  assert.ok(studioContent.includes('deepThink') || studioContent.includes('Suy nghĩ sâu'), 'Hỗ trợ DeepThink')
  assert.ok(studioContent.includes('Phiên mới') || studioContent.includes('senai_studio_sessions'), 'Hỗ trợ chuyển phiên và lưu trữ')
  assert.ok(studioContent.includes('STARTER_PROMPTS') || studioContent.includes('Toán học 12'), 'Hỗ trợ Starter Prompts')
})

// ==============================================================================
// 6. KIỂM THỬ SUNSET SENAI STUDIO VÀ SEN CHAT TRÊN DASHBOARD
// ==============================================================================
test('Sen Chat & Dashboard: Thẻ Sen Chat và cơ chế dừng hoạt động SenAI Studio 15/12/2026', () => {
  const dashboardPath = path.join(process.cwd(), 'app/new-dashboard/page.tsx')
  const dashContent = fs.readFileSync(dashboardPath, 'utf8')
  assert.ok(dashContent.includes("key: 'sen-chat'"), 'Dashboard phải có thẻ Sen Chat')
  assert.ok(dashContent.includes("href: '/chat'"), 'Thẻ Sen Chat trỏ tới /chat')
  assert.ok(dashContent.includes('1797267600000'), 'Dashboard phải chứa mốc thời gian dừng hoạt động 15/12/2026 (1797267600000)')

  const studioPagePath = path.join(process.cwd(), 'app/new-senai-studio/page.tsx')
  const studioPageContent = fs.readFileSync(studioPagePath, 'utf8')
  assert.ok(
    studioPageContent.includes('Sen AI Studio nay sẽ được chuyển thành Sen Chat. Sau ngày 15/12/2026, Sen AI Studio chính thức sẽ dừng hoạt động.'),
    'Trang Sen AI Studio phải có thanh thông báo chuyển đổi chính xác'
  )
  assert.ok(studioPageContent.includes('THỬ NGAY'), 'Thanh thông báo có nút THỬ NGAY')
  assert.ok(studioPageContent.includes('1797267600000'), 'Trang Sen AI Studio sử dụng mốc 1797267600000 ms')
  assert.ok(studioPageContent.includes('Sen AI Studio đã dừng hoạt động'), 'Có modal thông báo khi đến hoặc sau ngày 15/12/2026')

  // Kiểm tra navigation di động và m/page.tsx tự động chuyển tiếp/thay thế sau 15/12/2026
  const bottomNavPath = path.join(process.cwd(), 'app/components/MobileBottomNav.tsx')
  const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8')
  assert.ok(bottomNavContent.includes("key: 'sen_chat'"), 'MobileBottomNav phải có thẻ Sen Chat')
  assert.ok(bottomNavContent.includes('1797267600000'), 'MobileBottomNav kiểm tra mốc dừng hoạt động 1797267600000')

  const mHomePath = path.join(process.cwd(), 'app/m/page.tsx')
  const mHomeContent = fs.readFileSync(mHomePath, 'utf8')
  assert.ok(mHomeContent.includes('1797267600000'), 'm/page.tsx tự động chuyển đổi sang Sen Chat khi qua mốc 1797267600000')
})

// ==============================================================================
// 7. KIỂM THỬ BẢO VỆ GIAO DIỆN MOBILE CHAT: TUYỆT ĐỐI KHÔNG CHỨA CHUỖI CẤM "SC" HOẶC "SenCash"
// ==============================================================================
test('Sen Chat: app/m/chat/page.tsx không chứa chuỗi cấm "SC" hoặc "SenCash"', () => {
  const mobileChatContent = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  const hasForbiddenSC = /\bSC\b/.test(mobileChatContent)
  const hasForbiddenSenCash = /SenCash/i.test(mobileChatContent)
  assert.equal(hasForbiddenSC, false, 'app/m/chat/page.tsx tuyệt đối không được chứa từ "SC"')
  assert.equal(hasForbiddenSenCash, false, 'app/m/chat/page.tsx tuyệt đối không được chứa từ "SenCash"')

  const inbox = fs.readFileSync(path.join(process.cwd(), 'lib/senChatInbox.ts'), 'utf8')
  const runtime = fs.readFileSync(path.join(process.cwd(), 'app/components/SenChatRuntime.tsx'), 'utf8')
  assert.ok(mobileChatContent.includes('deliverLocalMessage(newMessage, activeConversation)'))
  assert.ok(inbox.includes('await compressChatMessage(message.content)'))
  assert.ok(inbox.includes('await decompressChatMessage(incoming.content)'))
  assert.ok(runtime.includes("event: 'inbox-change'") && runtime.includes('pullChatInbox(userId'))
  assert.ok(mobileChatContent.includes('getChatSendKey'), 'Mobile chat tôn trọng tùy chọn phím gửi Enter / Shift+Enter')
})
