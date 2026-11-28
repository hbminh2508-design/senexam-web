import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'
import {
  getDeviceId,
  getDeviceNodeName,
  setDeviceNodeName,
  reconcileMessages,
  initDeviceRelay,
  broadcastDeviceSettings,
} from '../lib/senChatDeviceRelay.mjs'

// ==============================================================================
// 1. KIỂM THỬ PHIÊN BẢN V1.0.2 VÀ CHANGELOG
// ==============================================================================
test('Sen Chat v1.0.2: Phiên bản hiện tại là 1.0.2 hoặc mới hơn và ghi log chính xác', () => {
  assert.ok(
    ['1.0.2', '1.0.3'].includes(SEN_CHAT_CURRENT_VERSION) || SEN_CHAT_CURRENT_VERSION >= '1.0.2',
    'Phiên bản Sen Chat phải >= 1.0.2'
  )
  assert.ok(Array.isArray(SEN_CHAT_CHANGELOG), 'SEN_CHAT_CHANGELOG phải là mảng')
  assert.ok(SEN_CHAT_CHANGELOG.length >= 3, 'Phải có ít nhất 3 phiên bản')

  const v102 = SEN_CHAT_CHANGELOG.find((v) => v.version === '1.0.2')
  assert.ok(v102, 'Phải có mục changelog cho phiên bản 1.0.2')
  assert.equal(v102.version, '1.0.2')
  assert.equal(v102.isBugFixOnly, true)
  assert.equal(v102.releaseDate, '24/11/2026')
  assert.equal(v102.title, 'Bắt lại những con bò đang bay trên các vì sao')

  assert.ok(
    v102.changes.includes('Bắt lại những con bò đang bay trên các vì sao'),
    'Phải có câu thần chú "Bắt lại những con bò đang bay trên các vì sao"'
  )
  assert.ok(
    v102.changes.some((c) => c.includes('lệch khung hiển thị của bảng kiểm tra chuẩn an toàn thiết bị')),
    'Phải có mục sửa lỗi lệch khung hiển thị'
  )
  assert.ok(
    v102.changes.some((c) => c.includes('Sửa triệt để lỗi tải tệp Supabase và lỗi giải mã ảnh từ Google Drive')),
    'Phải có mục sửa lỗi tải tệp và giải mã ảnh'
  )
  assert.ok(
    v102.changes.some((c) => c.includes('đồng bộ đa thiết bị')),
    'Phải có mục đồng bộ đa thiết bị'
  )
  assert.ok(
    v102.changes.some((c) => c.includes('Tự động đồng bộ cài đặt tính năng cá nhân hóa')),
    'Phải có mục đồng bộ cài đặt'
  )
  assert.ok(
    v102.changes.some((c) => c.includes('Tối ưu độ tương phản và giao diện thẻ tệp đính kèm')),
    'Phải có mục tối ưu độ tương phản'
  )
})

// ==============================================================================
// 2. KIỂM THỬ SỬA LỖI TẢI TỆP SUPABASE & LỖI GIẢI MÃ ẢNH GOOGLE DRIVE
// ==============================================================================
test('Sen Chat v1.0.2: ChatAttachmentBubble truyền token xác thực, đọc lỗi chi tiết và kiểm tra blob trước khi giải mã AES', () => {
  const bubbleFilePath = path.join(process.cwd(), 'components/chat/ChatAttachmentBubble.tsx')
  const bubbleCode = fs.readFileSync(bubbleFilePath, 'utf8')

  // Xác thực token trước khi gọi fetch stream
  assert.ok(
    bubbleCode.includes('supabase.auth.getSession()'),
    'ChatAttachmentBubble phải lấy access token từ Supabase session'
  )
  assert.ok(
    bubbleCode.includes("headers['Authorization'] = `Bearer ${token}`"),
    'Phải đính kèm Authorization header với Bearer token'
  )
  assert.ok(
    bubbleCode.includes("query.set('token', token)"),
    'Phải đính kèm query param token'
  )

  // Đọc lỗi chi tiết nếu !res.ok thay vì để rỗng statusText
  assert.ok(
    bubbleCode.includes('await res.text()'),
    'Phải đọc res.text() khi response không ok'
  )

  // Kiểm tra blob trước khi giải mã AES
  assert.ok(
    bubbleCode.includes("encryptedBlob.type.includes('application/json')") ||
    bubbleCode.includes("encryptedBlob.type.includes('text/')"),
    'Phải kiểm tra blob type có phải text/json trước khi cố giải mã AES'
  )

  // Không hardcode 'Không thể giải mã ảnh' khi có lỗi từ server
  assert.ok(
    bubbleCode.includes('err?.message'),
    'Phải hiển thị err.message thật từ server thay vì cố định một chuỗi lỗi'
  )
})

test('Sen Chat v1.0.2: getDriveFileStream trả về ReadableStream chuẩn và có cơ chế fallback Supabase Storage', () => {
  const driveServicePath = path.join(process.cwd(), 'lib/senChatDriveService.ts')
  const driveServiceCode = fs.readFileSync(driveServicePath, 'utf8')

  // getDriveFileStream trả về ReadableStream hoặc Buffer fallback
  assert.ok(
    driveServiceCode.includes('ReadableStream<Uint8Array>') || driveServiceCode.includes('bodyStream as ReadableStream'),
    'getDriveFileStream phải hỗ trợ trả về ReadableStream chuẩn'
  )

  const streamRoutePath = path.join(process.cwd(), 'app/api/chat/attachments/stream/route.ts')
  const streamRouteCode = fs.readFileSync(streamRoutePath, 'utf8')

  // Fallback sang Supabase Storage
  assert.ok(
    streamRouteCode.includes('fallbackPath') && streamRouteCode.includes('sen-chat-attachments'),
    'Route stream phải có cơ chế fallback sang Supabase Storage nếu Drive stream gặp lỗi'
  )
})

test('Sen Chat v1.0.2: Độ tương phản và thẩm mỹ của thẻ tệp đính kèm với prop isMe', () => {
  const bubbleFilePath = path.join(process.cwd(), 'components/chat/ChatAttachmentBubble.tsx')
  const bubbleCode = fs.readFileSync(bubbleFilePath, 'utf8')

  assert.ok(bubbleCode.includes('isMe?: boolean'), 'ChatAttachmentBubbleProps phải khai báo isMe?: boolean')
  assert.ok(bubbleCode.includes('text-white font-bold'), 'Tên tệp phải màu trắng nổi bật khi isMe là true')
  assert.ok(bubbleCode.includes('text-sky-100/90') || bubbleCode.includes('text-emerald-100/90'), 'Kích thước / nguồn tệp phải có màu chữ sáng khi isMe là true')
  assert.ok(bubbleCode.includes('bg-white/15 hover:bg-white/20 border border-white/20'), 'Hộp tệp đính kèm phải có nền bg-white/15')

  // Kiểm tra app/chat/page.tsx và app/m/chat/page.tsx có truyền isMe={isMe}
  const deskChatPath = path.join(process.cwd(), 'app/chat/page.tsx')
  const deskChatCode = fs.readFileSync(deskChatPath, 'utf8')
  assert.ok(deskChatCode.includes('isMe={isMe}'), 'app/chat/page.tsx phải truyền isMe={isMe} vào ChatAttachmentBubble')

  const mobChatPath = path.join(process.cwd(), 'app/m/chat/page.tsx')
  const mobChatCode = fs.readFileSync(mobChatPath, 'utf8')
  assert.ok(mobChatCode.includes('isMe={isMe}'), 'app/m/chat/page.tsx phải truyền isMe={isMe} vào ChatAttachmentBubble')
})

// ==============================================================================
// 3. KIỂM THỬ SỬA LỖI LỆCH KHUNG HIỂN THỊ (LAYOUT MISALIGNMENT)
// ==============================================================================
test('Sen Chat v1.0.2: DeviceComplianceDetailModal sử dụng createPortal vào document.body tránh bị kẹp trong header backdrop-filter', () => {
  const drmPath = path.join(process.cwd(), 'components/chat/ChatDrmProtection.tsx')
  const drmCode = fs.readFileSync(drmPath, 'utf8')

  assert.ok(drmCode.includes('createPortal'), 'ChatDrmProtection phải import createPortal từ react-dom')
  assert.ok(drmCode.includes('createPortal(modalContent, document.body)'), 'Modal phải được portal trực tiếp vào document.body')
  assert.ok(drmCode.includes("typeof document !== 'undefined'"), 'Phải kiểm tra SSR an toàn với typeof document')
  assert.ok(drmCode.includes('fixed inset-0 z-[9999]'), 'Modal backdrop phải phủ toàn màn hình với z-index cao')
})

test('Sen Chat v1.0.2: Thanh thông báo 30 ngày có z-index và relative không bị che khuất', () => {
  const deskChatCode = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  const mobChatCode = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')

  assert.ok(
    deskChatCode.includes('relative z-10 flex items-center justify-between px-4 py-1.5 bg-blue-500/10') ||
      deskChatCode.includes('relative z-10 flex items-center justify-between px-4 py-1.5 bg-emerald-500/10'),
    'Desktop chat banner 30 ngày phải có relative z-10'
  )
  assert.ok(
    mobChatCode.includes('relative z-10 flex items-center justify-between px-3 py-1 bg-blue-500/10') ||
      mobChatCode.includes('relative z-10 flex items-center justify-between px-3 py-1 bg-emerald-500/10'),
    'Mobile chat banner 30 ngày phải có relative z-10'
  )
})

// ==============================================================================
// 4. KIỂM THỬ TÍNH NĂNG ĐỒNG BỘ ĐA THIẾT BỊ (MULTI-DEVICE TRANSIT & RELAY NODE)
// ==============================================================================
test('Sen Chat v1.0.2: Quản lý thiết bị Node và định danh duy nhất', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }

  const devId = getDeviceId()
  assert.ok(devId.startsWith('dev_'), 'DeviceId phải có tiền tố dev_')
  assert.equal(getDeviceId(), devId, 'DeviceId phải ổn định sau lần tạo đầu tiên')

  setDeviceNodeName('Máy tính bàn Trạm làm việc')
  assert.equal(getDeviceNodeName(), 'Máy tính bàn Trạm làm việc')
})

test('Sen Chat v1.0.2: Hàm đối soát tin nhắn reconcileMessages khử trùng lặp và sắp xếp theo thời gian', () => {
  const existing = [
    { id: 'msg_1', content: 'Chào bạn', createdAt: '2026-11-24T00:00:00.000Z', isLocalOnly: true, status: 'sending' },
    { id: 'msg_3', content: 'Bạn khỏe không?', createdAt: '2026-11-24T00:02:00.000Z', status: 'seen' },
  ]

  const incoming = [
    { id: 'msg_1', content: 'Chào bạn (server)', createdAt: '2026-11-24T00:00:00.000Z', decryptedUrl: 'blob:safe-url', status: 'sent' },
    { id: 'msg_2', content: 'Tin nhắn chen giữa từ thiết bị khác', createdAt: '2026-11-24T00:01:00.000Z', status: 'sent' },
    { id: 'msg_3', content: 'Bạn khỏe không?', createdAt: '2026-11-24T00:02:00.000Z', status: 'delivered' },
    { id: 'msg_4', content: 'Tin mới nhất', createdAt: '2026-11-24T00:03:00.000Z' },
  ]

  const merged = reconcileMessages(existing, incoming)

  assert.equal(merged.length, 4, 'Sau khi đối soát phải có đúng 4 tin nhắn không trùng lặp')
  assert.equal(merged[0].id, 'msg_1')
  assert.equal(merged[1].id, 'msg_2')
  assert.equal(merged[2].id, 'msg_3')
  assert.equal(merged[3].id, 'msg_4')

  // Kiểm tra việc bảo tồn các trường cục bộ
  assert.equal(merged[0].isLocalOnly, true, 'Trường isLocalOnly phải được bảo tồn')
  assert.equal(merged[0].decryptedUrl, 'blob:safe-url', 'Trường decryptedUrl từ incoming phải được kết hợp')
  assert.equal(merged[0].status, 'sent', 'Trạng thái sending phải được nâng lên sent')
  assert.equal(merged[2].status, 'seen', 'Trạng thái seen cao hơn phải được bảo toàn')
})

test('Sen Chat v1.0.2: Route /api/chat/sync xử lý relay_stream và sync_messages', () => {
  const syncRouteCode = fs.readFileSync(path.join(process.cwd(), 'app/api/chat/sync/route.ts'), 'utf8')

  assert.ok(
    syncRouteCode.includes("action === 'relay_stream'"),
    'Route sync phải hỗ trợ action relay_stream'
  )
  assert.ok(
    syncRouteCode.includes("action === 'sync_messages'"),
    'Route sync phải hỗ trợ action sync_messages'
  )
  assert.ok(
    syncRouteCode.includes('streamTicket'),
    'Route sync phải xử lý streamTicket cho luồng trung chuyển'
  )
})

test('Sen Chat v1.0.2: initDeviceRelay, broadcastRequestMessageSync và broadcastFileTransitReady được tích hợp vào cả Desktop và Mobile', () => {
  const deskChatCode = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  const mobChatCode = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')

  assert.ok(
    deskChatCode.includes('initDeviceRelay'),
    'Desktop chat phải gọi initDeviceRelay'
  )
  assert.ok(
    mobChatCode.includes('initDeviceRelay'),
    'Mobile chat phải gọi initDeviceRelay'
  )

  // Kiểm tra broadcastRequestMessageSync được gọi thực tế
  assert.ok(
    deskChatCode.includes('broadcastRequestMessageSync('),
    'Desktop chat phải gọi broadcastRequestMessageSync khi chuyển phòng/kết nối'
  )
  assert.ok(
    mobChatCode.includes('broadcastRequestMessageSync('),
    'Mobile chat phải gọi broadcastRequestMessageSync khi chuyển phòng/kết nối'
  )

  // Kiểm tra broadcastFileTransitReady được gọi khi tải tệp
  assert.ok(
    deskChatCode.includes('broadcastFileTransitReady('),
    'Desktop chat phải gọi broadcastFileTransitReady khi gửi tệp'
  )
  assert.ok(
    mobChatCode.includes('broadcastFileTransitReady('),
    'Mobile chat phải gọi broadcastFileTransitReady khi gửi tệp'
  )
})

test('Sen Chat v1.0.2: Xem trước mở ngoài hội thoại và tệp có nút lưu', () => {
  const previewModalCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatFilePreviewModal.tsx'), 'utf8')
  const bubbleCode = fs.readFileSync(path.join(process.cwd(), 'components/chat/ChatAttachmentBubble.tsx'), 'utf8')

  assert.ok(
    previewModalCode.includes('createPortal(modalContent, document.body)'),
    'ChatFilePreviewModal phải sử dụng createPortal vào document.body'
  )
  assert.ok(
    bubbleCode.includes('Lưu tệp') && !bubbleCode.includes('showExtendModal'),
    'ChatAttachmentBubble dùng nút lưu tệp'
  )
})

test('Sen Chat: app/m/chat/page.tsx không chứa chuỗi cấm "SC" hoặc "SenCash"', () => {
  const mobileFile = path.join(process.cwd(), 'app/m/chat/page.tsx')
  const content = fs.readFileSync(mobileFile, 'utf8')

  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    // Cho phép "SCm" hoặc "SCmWallet" nhưng cấm SC đứng độc lập hoặc SenCash
    const cleaned = line.replace(/SCm/g, '___SCM___')
    assert.ok(
      !cleaned.includes('SenCash'),
      `Dòng ${idx + 1} trong app/m/chat/page.tsx chứa từ cấm "SenCash": ${line}`
    )
    const scWordRegex = /\bSC\b/
    assert.ok(
      !scWordRegex.test(cleaned),
      `Dòng ${idx + 1} trong app/m/chat/page.tsx chứa từ cấm "SC": ${line}`
    )
  })
})
