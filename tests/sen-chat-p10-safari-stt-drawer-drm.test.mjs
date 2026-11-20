import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  checkDeviceCompliance,
  isScreenCaptureKey,
} from '../lib/senChatDeviceCompliance.mjs'

// ==============================================================================
// 1. KIỂM THỬ XÁC THỰC TOKEN KHI TẢI TỆP & GHI ÂM (FIX LỖI CHƯA ĐĂNG NHẬP SAFARI)
// ==============================================================================
test('Sen Chat P10: ChatAttachmentModal và ChatVoiceRecorder gửi đầy đủ Bearer token và token param', () => {
  const attachmentModalPath = path.join(process.cwd(), 'components/chat/ChatAttachmentModal.tsx')
  assert.ok(fs.existsSync(attachmentModalPath), 'ChatAttachmentModal.tsx phải tồn tại')
  const attachmentModalCode = fs.readFileSync(attachmentModalPath, 'utf8')

  // Kiểm tra lấy session và refresh token trước khi upload
  assert.ok(attachmentModalCode.includes('supabase.auth.getSession()'), 'Modal đính kèm phải lấy session')
  assert.ok(attachmentModalCode.includes('supabase.auth.refreshSession()'), 'Modal đính kèm phải refresh session nếu sắp hết hạn')
  assert.ok(attachmentModalCode.includes("Authorization: `Bearer ${token}`"), 'Modal đính kèm phải truyền Authorization: Bearer token')
  assert.ok(attachmentModalCode.includes('?token='), 'Modal đính kèm phải truyền token fallback qua query param')

  const voiceRecorderPath = path.join(process.cwd(), 'components/chat/ChatVoiceRecorder.tsx')
  assert.ok(fs.existsSync(voiceRecorderPath), 'ChatVoiceRecorder.tsx phải tồn tại')
  const voiceRecorderCode = fs.readFileSync(voiceRecorderPath, 'utf8')

  assert.ok(voiceRecorderCode.includes('supabase.auth.getSession()'), 'Voice recorder phải lấy session')
  assert.ok(voiceRecorderCode.includes('supabase.auth.refreshSession()'), 'Voice recorder phải refresh session nếu sắp hết hạn')
  assert.ok(voiceRecorderCode.includes("Authorization: `Bearer ${token}`"), 'Voice recorder phải truyền Authorization: Bearer token')
  assert.ok(voiceRecorderCode.includes('?token='), 'Voice recorder phải truyền token fallback qua query param')

  // Kiểm tra endpoint upload xử lý đúng token từ getUserFromRequest
  const uploadRoutePath = path.join(process.cwd(), 'app/api/chat/attachments/upload/route.ts')
  const uploadRouteCode = fs.readFileSync(uploadRoutePath, 'utf8')
  assert.ok(uploadRouteCode.includes('getUserFromRequest(request)'), 'Upload route phải xác thực user từ request')

  // Kiểm tra getUserFromRequest hỗ trợ chunked cookie và base64 cookie
  const supabaseAdminCode = fs.readFileSync(path.join(process.cwd(), 'lib/supabaseAdmin.ts'), 'utf8')
  assert.ok(supabaseAdminCode.includes('base64-'), 'getUserFromRequest phải giải mã base64- cookie của Supabase')
  assert.ok(supabaseAdminCode.includes('authCookieKeys'), 'getUserFromRequest phải hỗ trợ ghép nối chunked cookies .0, .1')
})

// ==============================================================================
// 2. KIỂM THỬ TÍNH NĂNG STT CHO TIN NHẮN THOẠI (WEB SPEECH API + SERVER ENDPOINT)
// ==============================================================================
test('Sen Chat P10: Hỗ trợ Web Speech API và hiển thị văn bản chuyển đổi tin nhắn thoại trên cả desktop và mobile', () => {
  const voiceRecorderCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatVoiceRecorder.tsx'), 'utf8')
  assert.ok(
    voiceRecorderCode.includes('webkitSpeechRecognition') || voiceRecorderCode.includes('SpeechRecognition'),
    'Voice recorder phải hỗ trợ nhận dạng giọng nói on-device qua Web Speech API'
  )
  assert.ok(voiceRecorderCode.includes('transcribeAudioServerSide'), 'Voice recorder phải hỗ trợ fallback STT máy chủ')

  const voiceBubbleCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatVoiceMessageBubble.tsx'), 'utf8')
  assert.ok(voiceBubbleCode.includes('currentText'), 'Voice bubble phải hiển thị văn bản chuyển đổi')
  assert.ok(voiceBubbleCode.includes('transcribeAudioOnDevice'), 'Voice bubble phải có tính năng chuyển văn bản on-device')
  assert.ok(voiceBubbleCode.includes('transcribeAudioServerSide'), 'Voice bubble phải có tùy chọn server STT')
  assert.ok(voiceBubbleCode.includes('supabase.auth.refreshSession()'), 'Voice bubble phải làm mới session trước khi STT máy chủ')

  // Mobile Chat Parity: Đảm bảo app/m/chat/page.tsx có đầy đủ chức năng ghi âm và STT
  const mobileChatCode = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(mobileChatCode.includes('ChatVoiceRecorder'), 'Mobile chat phải tích hợp ChatVoiceRecorder')
  assert.ok(mobileChatCode.includes('handleSendVoiceMessage'), 'Mobile chat phải có hàm handleSendVoiceMessage')
  assert.ok(mobileChatCode.includes('handleUpdateMessageTranscription'), 'Mobile chat phải có hàm handleUpdateMessageTranscription')
  assert.ok(mobileChatCode.includes('onUpdateTranscription'), 'Mobile chat phải truyền onUpdateTranscription vào ChatVoiceMessageBubble')
})

// ==============================================================================
// 3. KIỂM THỬ TẮT NÚT NỔI SENAI MÀU HỒNG/TÍM Ở GÓC DƯỚI
// ==============================================================================
test('Sen Chat P10: Bong bóng nổi SenAI bị tắt hoàn toàn ở /chat và /m/chat', () => {
  const bubbleCode = fs.readFileSync(path.join(process.cwd(), 'app/components/SenChatFloatingBubble.tsx'), 'utf8')
  assert.ok(
    bubbleCode.includes("pathname?.startsWith('/chat')"),
    'SenChatFloatingBubble phải loại trừ pathname /chat'
  )
  assert.ok(
    bubbleCode.includes("pathname?.startsWith('/m/chat')"),
    'SenChatFloatingBubble phải loại trừ pathname /m/chat'
  )
})

// ==============================================================================
// 4. KIỂM THỬ NGĂN KÉO THU GỌN (COLLAPSIBLE DRAWER) ĐẦY ĐỦ TÍNH NĂNG
// ==============================================================================
test('Sen Chat P10: ChatInfoDrawer thu gọn mặc định và đầy đủ 5 tính năng quản lý', () => {
  const drawerPath = path.join(process.cwd(), 'components/chat/ChatInfoDrawer.tsx')
  assert.ok(fs.existsSync(drawerPath), 'components/chat/ChatInfoDrawer.tsx phải tồn tại')
  const drawerCode = fs.readFileSync(drawerPath, 'utf8')

  // Đầy đủ các phân mục
  assert.ok(drawerCode.includes('localSearch'), 'Phải có ô tìm kiếm tin nhắn cục bộ trong hội thoại')
  assert.ok(drawerCode.includes('sharedMedia') && drawerCode.includes('sharedDocs'), 'Phải có quản lý tệp đã chia sẻ (Media, Tài liệu)')
  assert.ok(drawerCode.includes('sharedLinks'), 'Phải có trích xuất và quản lý danh sách liên kết')
  assert.ok(drawerCode.includes('groupMembers') || drawerCode.includes('Trưởng nhóm'), 'Phải có quản lý thành viên nhóm MLS với vai trò rõ ràng')
  assert.ok(drawerCode.includes('ChatSafetyWidget'), 'Phải tích hợp Mã an toàn Safety Number')
  assert.ok(drawerCode.includes('ChatDisappearingMessages'), 'Phải tích hợp Tin nhắn tự hủy')
  assert.ok(drawerCode.includes('fixed inset-0') && drawerCode.includes('onClick={onClose}'), 'Phải có backdrop overlay đóng drawer khi nhấp ra ngoài')
  assert.ok(drawerCode.includes('effectiveMembers'), 'Phải có logic dự phòng thành viên nhóm effectiveMembers')

  // Kiểm tra ban đầu trong desktop chat showInfoSidebar phải mặc định false
  const desktopChatCode = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(
    desktopChatCode.includes('useState(false)') && desktopChatCode.includes('showInfoSidebar'),
    'showInfoSidebar trong app/chat/page.tsx phải mặc định là false khi chưa bấm nút "i"'
  )
})

// ==============================================================================
// 5. KIỂM THỬ CHỐNG CHỤP MÀN HÌNH DRM KIỂU NETFLIX (BLACKOUT CURTAIN & COMPLIANCE)
// ==============================================================================
test('Sen Chat P10: DRM Blackout Protection phát hiện phím chụp màn hình và DevTools', () => {
  // Phím PrintScreen
  assert.equal(isScreenCaptureKey({ key: 'PrintScreen' }), true)
  assert.equal(isScreenCaptureKey({ key: 'Snapshot' }), true)

  // Windows shortcut Win+Shift+S (trình duyệt nhận Shift+S kèm ctrl/meta)
  assert.equal(isScreenCaptureKey({ key: 'S', shiftKey: true, metaKey: true }), true)
  assert.equal(isScreenCaptureKey({ key: 's', shiftKey: true, ctrlKey: true }), true)

  // Mac screenshot shortcuts Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
  assert.equal(isScreenCaptureKey({ key: '3', shiftKey: true, metaKey: true }), true)
  assert.equal(isScreenCaptureKey({ key: '4', shiftKey: true, metaKey: true }), true)
  assert.equal(isScreenCaptureKey({ key: '5', shiftKey: true, metaKey: true }), true)

  // Phím bình thường không kích hoạt
  assert.equal(isScreenCaptureKey({ key: 'Enter' }), false)
  assert.equal(isScreenCaptureKey({ key: 'a' }), false)
  assert.equal(isScreenCaptureKey({ key: 'Escape' }), false)

  // DevTools shortcut F12
  assert.equal(isScreenCaptureKey({ key: 'F12' }), true)

  // Kiểm tra độ chuẩn thiết bị (Device Compliance)
  // Mock giả lập thiết bị không an toàn (HTTP thường, không crypto)
  const mockInsecureWin = {
    isSecureContext: false,
    location: { hostname: 'example.com' },
    crypto: null,
    indexedDB: null,
    outerWidth: 1000,
    innerWidth: 1000,
    outerHeight: 800,
    innerHeight: 800,
  }
  const reportBad = checkDeviceCompliance(mockInsecureWin)
  assert.equal(reportBad.isCompliant, false)
  assert.ok(reportBad.warnings.length >= 2)
  assert.ok(reportBad.score < 50)

  // Mock giả lập thiết bị đạt chuẩn hoàn toàn (HTTPS, WebCrypto, IndexedDB, DevTools đóng)
  const mockSecureWin = {
    isSecureContext: true,
    location: { hostname: 'senexam.me' },
    crypto: { subtle: { encrypt: () => {} } },
    indexedDB: { open: () => {} },
    outerWidth: 1000,
    innerWidth: 990,
    outerHeight: 800,
    innerHeight: 790,
  }
  const reportGood = checkDeviceCompliance(mockSecureWin)
  assert.equal(reportGood.isCompliant, true)
  assert.equal(reportGood.secureContext, true)
  assert.equal(reportGood.webCrypto, true)
  assert.equal(reportGood.indexedDb, true)
  assert.equal(reportGood.devToolsOpen, false)
  assert.equal(reportGood.warnings.length, 0)
  assert.equal(reportGood.score, 100)

  // Kiểm tra CSS chống in ấn
  const drmComponentCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatDrmProtection.tsx'), 'utf8')
  assert.ok(drmComponentCode.includes('@media print'), 'Phải có CSS @media print')
  assert.ok(drmComponentCode.includes('display: none !important'), 'Print CSS phải ẩn hoàn toàn body')
})
