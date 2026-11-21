import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateChatFileSize,
  getChatFileLimit,
  formatBytes,
} from '../lib/chatLimits.mjs'

// ==============================================================================
// 1. KIỂM THỬ PRE-CHECK HẠN MỨC GÓI & THÔNG BÁO LỖI THÂN THIỆN CHO TỆP 145.6MB
// ==============================================================================
test('Sen Chat P11: Pre-check hạn mức gói cho tệp 145.6MB & thông báo nâng cấp VIP', () => {
  const gtaFileSizeBytes = 145.6 * 1024 * 1024 // 145.6MB

  // 1. Người dùng gói Miễn phí (Free): Bị từ chối vì vượt quá 100MB
  const freeCheck = validateChatFileSize(gtaFileSizeBytes, 'free')
  assert.equal(freeCheck.allowed, false, 'Gói Miễn phí phải từ chối tệp 145.6MB')
  assert.equal(freeCheck.suggestedTier, 'vip', 'Phải gợi ý nâng cấp lên gói Sen VIP')
  assert.equal(freeCheck.upgradeUrl, '/new-pay?tab=vip')
  assert.ok(
    freeCheck.error.includes('145.6MB') &&
    freeCheck.error.includes('100MB') &&
    freeCheck.error.includes('Miễn phí') &&
    freeCheck.error.includes('Sen VIP'),
    'Thông báo lỗi phải thân thiện và nêu rõ hạn mức gói Miễn phí cùng gợi ý Sen VIP'
  )

  // 2. Người dùng gói Sen VIP (250MB): Được phép tải tệp 145.6MB
  const vipCheck = validateChatFileSize(gtaFileSizeBytes, 'vip')
  assert.equal(vipCheck.allowed, true, 'Gói Sen VIP (250MB) phải cho phép tải tệp 145.6MB')

  // 3. Người dùng gói Sen Premium (500MB) và Sen Premium+ (1GB): Được phép tải tệp 145.6MB
  const premiumCheck = validateChatFileSize(gtaFileSizeBytes, 'premium')
  assert.equal(premiumCheck.allowed, true, 'Gói Sen Premium (500MB) phải cho phép tải tệp 145.6MB')
  const premiumPlusCheck = validateChatFileSize(gtaFileSizeBytes, 'premium_plus')
  assert.equal(premiumPlusCheck.allowed, true, 'Gói Sen Premium+ (1GB) phải cho phép tải tệp 145.6MB')
})

// ==============================================================================
// 2. KIỂM THỬ DIRECT STORAGE UPLOAD CHO TỆP LỚN & SAFE RESPONSE PARSING
// ==============================================================================
test('Sen Chat P11: Upload endpoint hỗ trợ prepare_upload & complete_direct_upload; Client có safe parsing', () => {
  const uploadRoutePath = path.join(process.cwd(), 'app/api/chat/attachments/upload/route.ts')
  assert.ok(fs.existsSync(uploadRoutePath), 'Upload route phải tồn tại')
  const uploadRouteCode = fs.readFileSync(uploadRoutePath, 'utf8')

  // Kiểm tra hỗ trợ direct storage upload flow
  assert.ok(uploadRouteCode.includes("action === 'prepare_upload'"), 'Route phải hỗ trợ action prepare_upload')
  assert.ok(uploadRouteCode.includes("action === 'complete_direct_upload'"), 'Route phải hỗ trợ action complete_direct_upload')
  assert.ok(uploadRouteCode.includes('createSignedUploadUrl'), 'Route phải tạo signed upload URL cho client upload trực tiếp')
  assert.ok(uploadRouteCode.includes('chat_attachments'), 'Route phải thao tác với bucket chat_attachments')

  // Kiểm tra ChatAttachmentModal
  const modalPath = path.join(process.cwd(), 'components/chat/ChatAttachmentModal.tsx')
  assert.ok(fs.existsSync(modalPath), 'ChatAttachmentModal.tsx phải tồn tại')
  const modalCode = fs.readFileSync(modalPath, 'utf8')

  // Client phải phân luồng tải trực tiếp cho file lớn (> 4MB hoặc binary)
  assert.ok(modalCode.includes('isDirectStorageUpload'), 'Modal phải có cờ phân luồng direct upload')
  assert.ok(modalCode.includes('prepare_upload'), 'Modal phải gọi prepare_upload')
  assert.ok(modalCode.includes('complete_direct_upload'), 'Modal phải gọi complete_direct_upload')

  // Safe response parsing: đọc text() và bọc try/catch, tuyệt đối không gọi response.json() trần
  assert.ok(modalCode.includes('.text()'), 'Modal phải đọc response.text() trước khi parse')
  assert.ok(modalCode.includes('JSON.parse('), 'Modal phải bọc JSON.parse an toàn')
  assert.ok(
    modalCode.includes('Dung lượng tệp vượt quá hạn mức tải lên của máy chủ hoặc gói cước hiện tại.'),
    'Modal phải có thông báo lỗi 413 rõ ràng không văng uncaught JSON syntax error'
  )
})

// ==============================================================================
// 3. KIỂM THỬ CHẶN CHỤP MÀN HÌNH CHUẨN DRM HARDWARE KIỂU NETFLIX (KHÔNG DÙNG POPUP)
// ==============================================================================
test('Sen Chat P11: DRM Hardware filter che mờ sâu kiểu Netflix, xóa hoàn toàn popup thô sơ', () => {
  const drmPath = path.join(process.cwd(), 'components/chat/ChatDrmProtection.tsx')
  assert.ok(fs.existsSync(drmPath), 'ChatDrmProtection.tsx phải tồn tại')
  const drmCode = fs.readFileSync(drmPath, 'utf8')

  // Gỡ bỏ hoàn toàn popup cũ
  assert.ok(
    !drmCode.includes('Blackout Curtain Active'),
    'Phải gỡ bỏ hoàn toàn banner Blackout Curtain Active'
  )
  assert.ok(
    !drmCode.includes('Nhấp chuột hoặc quay lại cửa sổ để tiếp tục'),
    'Phải gỡ bỏ hoàn toàn nút bấm popup thủ công'
  )

  // Áp dụng lớp che mờ sâu và chống phản chiếu (Hardware DRM obfuscation filter)
  assert.ok(
    drmCode.includes('filter: blur(50px) brightness(0.02) contrast(150%)'),
    'Phải áp dụng bộ lọc CSS GPU acceleration blur(50px) brightness(0.02) contrast(150%)'
  )
  assert.ok(
    drmCode.includes('transform: translateZ(0)'),
    'Phải kích hoạt phần cứng GPU acceleration qua transform: translateZ(0)'
  )
  assert.ok(
    drmCode.includes('pointer-events: none'),
    'Lớp bảo vệ phải có pointer-events: none để không gây cản trở trải nghiệm khi quay lại'
  )

  // Giữ nguyên bảo vệ in ấn
  assert.ok(drmCode.includes('@media print'), 'Phải giữ nguyên bảo vệ in ấn @media print')
  assert.ok(drmCode.includes('display: none !important'), 'Print CSS phải display none')
})

// ==============================================================================
// 4. KIỂM THỬ CUỘC GỌI THOẠI & VIDEO WEBRTC E2EE
// ==============================================================================
test('Sen Chat P11: Component ChatCallModal đầy đủ WebRTC MediaStream, Signaling và tích hợp Desktop/Mobile', () => {
  const callModalPath = path.join(process.cwd(), 'components/chat/ChatCallModal.tsx')
  assert.ok(fs.existsSync(callModalPath), 'ChatCallModal.tsx phải tồn tại')
  const callModalCode = fs.readFileSync(callModalPath, 'utf8')

  // WebRTC MediaStream thật
  assert.ok(callModalCode.includes('navigator.mediaDevices.getUserMedia'), 'Phải yêu cầu quyền micro & camera qua getUserMedia')
  assert.ok(callModalCode.includes('RTCPeerConnection'), 'Phải khởi tạo kết nối P2P RTCPeerConnection')
  assert.ok(callModalCode.includes('localVideoRef'), 'Phải có ref cho local video')
  assert.ok(callModalCode.includes('remoteVideoRef'), 'Phải có ref cho remote video')

  // Bộ điều khiển cuộc gọi
  assert.ok(callModalCode.includes('toggleMic'), 'Phải có chức năng bật/tắt micro')
  assert.ok(callModalCode.includes('toggleCamera'), 'Phải có chức năng bật/tắt camera')
  assert.ok(callModalCode.includes('switchCameraFacing'), 'Phải có chức năng đổi camera trước/sau')
  assert.ok(callModalCode.includes('handleEndCall'), 'Phải có chức năng kết thúc cuộc gọi')

  // Badge bảo mật E2EE & Timer
  assert.ok(callModalCode.includes('Mã hóa WebRTC E2EE P2P'), 'Phải có badge bảo mật WebRTC E2EE P2P')
  assert.ok(callModalCode.includes('formatDuration'), 'Phải có bộ đếm thời gian cuộc gọi')

  // Hộp thoại chuông cuộc gọi đến
  assert.ok(callModalCode.includes('ChatIncomingCallDialog'), 'Phải xuất khẩu component ChatIncomingCallDialog')

  // Tích hợp vào app/chat/page.tsx
  const desktopChatCode = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(desktopChatCode.includes('ChatCallModal'), 'Desktop chat phải tích hợp ChatCallModal')
  assert.ok(desktopChatCode.includes('ChatIncomingCallDialog'), 'Desktop chat phải tích hợp ChatIncomingCallDialog')
  assert.ok(desktopChatCode.includes('call_request'), 'Desktop chat phải lắng nghe sự kiện call_request')

  // Tích hợp vào app/m/chat/page.tsx
  const mobileChatCode = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(mobileChatCode.includes('ChatCallModal'), 'Mobile chat phải tích hợp ChatCallModal')
  assert.ok(mobileChatCode.includes('ChatIncomingCallDialog'), 'Mobile chat phải tích hợp ChatIncomingCallDialog')
  assert.ok(mobileChatCode.includes('call_request'), 'Mobile chat phải lắng nghe sự kiện call_request')
  assert.ok(mobileChatCode.includes("setActiveCallMode('voice')"), 'Mobile chat phải có nút kích hoạt gọi thoại')
  assert.ok(mobileChatCode.includes("setActiveCallMode('video')"), 'Mobile chat phải có nút kích hoạt gọi video')
})
