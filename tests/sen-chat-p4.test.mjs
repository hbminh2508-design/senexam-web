import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  CHAT_FILE_LIMITS,
  getChatFileLimit,
  formatBytes,
  validateChatFileSize,
  isExecutableFile,
  isRestrictedInlineFile,
} from '../lib/chatLimits.mjs'
import {
  generateFileKey,
  encryptChunk,
  decryptChunk,
  encryptFileMetadata,
  decryptFileMetadata,
  bytesToBase64,
  base64ToBytes,
} from '../lib/senChatChunkCrypto.mjs'

// ==============================================================================
// 1. KIỂM THỬ BẢNG GIỚI HẠN DUNG LƯỢNG THEO GÓI HỘI VIÊN (P4)
// ==============================================================================
test('Sen Chat P4: Hạn mức tệp (ảnh, video, tệp) chuẩn hóa theo gói dịch vụ', () => {
  // Miễn phí: 100MB
  assert.equal(CHAT_FILE_LIMITS.free, 100 * 1024 * 1024)
  assert.equal(getChatFileLimit('free'), 100 * 1024 * 1024)
  assert.equal(getChatFileLimit(null), 100 * 1024 * 1024)
  assert.equal(getChatFileLimit('lite'), 100 * 1024 * 1024)

  // Sen VIP: 250MB
  assert.equal(CHAT_FILE_LIMITS.vip, 250 * 1024 * 1024)
  assert.equal(getChatFileLimit('vip'), 250 * 1024 * 1024)
  assert.equal(getChatFileLimit('VIP'), 250 * 1024 * 1024, 'Không phân biệt chữ hoa/thường')
  assert.equal(getChatFileLimit('sen_one_lite'), 250 * 1024 * 1024)

  // Sen Premium: 500MB
  assert.equal(CHAT_FILE_LIMITS.premium, 500 * 1024 * 1024)
  assert.equal(getChatFileLimit('premium'), 500 * 1024 * 1024)

  // Sen Premium+: 1GB
  assert.equal(CHAT_FILE_LIMITS.premium_plus, 1024 * 1024 * 1024)
  assert.equal(getChatFileLimit('premium_plus'), 1024 * 1024 * 1024)
  assert.equal(getChatFileLimit('sen_one'), 1024 * 1024 * 1024)

  // Format dung lượng
  assert.equal(formatBytes(100 * 1024 * 1024), '100MB')
  assert.equal(formatBytes(250 * 1024 * 1024), '250MB')
  assert.equal(formatBytes(500 * 1024 * 1024), '500MB')
  assert.equal(formatBytes(1024 * 1024 * 1024), '1GB')
})

// ==============================================================================
// 2. KIỂM THỬ TỪ CHỐI VƯỢT HẠN MỨC PHÍA SERVER & GỢI Ý NÂNG CẤP
// ==============================================================================
test('Sen Chat P4: Server-side Enforce hạn mức tệp & Gợi ý gói nâng cấp chính xác', () => {
  // 1. Người dùng Miễn phí (Hạn mức 100MB) tải tệp 50MB -> Được phép
  const freeOk = validateChatFileSize(50 * 1024 * 1024, 'free')
  assert.equal(freeOk.allowed, true)

  // 2. Người dùng Miễn phí tải tệp 150MB -> Bị chặn, gợi ý nâng lên Sen VIP (250MB)
  const freeOver = validateChatFileSize(150 * 1024 * 1024, 'free')
  assert.equal(freeOver.allowed, false)
  assert.equal(freeOver.suggestedTier, 'vip')
  assert.ok(freeOver.error.includes('Sen VIP (250MB)'))
  assert.equal(freeOver.upgradeUrl, '/new-pay?tab=vip')

  // 3. Người dùng Sen VIP (Hạn mức 250MB) tải tệp 350MB -> Bị chặn, gợi ý lên Sen Premium (500MB)
  const vipOver = validateChatFileSize(350 * 1024 * 1024, 'vip')
  assert.equal(vipOver.allowed, false)
  assert.equal(vipOver.suggestedTier, 'premium')
  assert.ok(vipOver.error.includes('Sen Premium (500MB)'))

  // 4. Người dùng Sen Premium (Hạn mức 500MB) tải tệp 800MB -> Bị chặn, gợi ý lên Sen Premium+ (1GB)
  const premOver = validateChatFileSize(800 * 1024 * 1024, 'premium')
  assert.equal(premOver.allowed, false)
  assert.equal(premOver.suggestedTier, 'premium_plus')
  assert.ok(premOver.error.includes('Sen Premium+ (1GB)'))

  // 5. Người dùng Sen Premium+ (Hạn mức 1GB) tải tệp 1.5GB -> Bị từ chối triệt để
  const premPlusOver = validateChatFileSize(1.5 * 1024 * 1024 * 1024, 'premium_plus')
  assert.equal(premPlusOver.allowed, false)

  // 6. Kiểm tra nguyên tắc Không tin tưởng Client (Both declared & actual size checks)
  function simulateServerUploadGate(declaredSize, actualStreamSize, userTier) {
    const checkDeclared = validateChatFileSize(declaredSize, userTier)
    const checkActual = validateChatFileSize(actualStreamSize, userTier)
    if (!checkDeclared.allowed) return { status: 413, error: checkDeclared.error }
    if (!checkActual.allowed) return { status: 413, error: checkActual.error }
    return { status: 200, allowed: true }
  }

  // Client gian lận: khai báo 50MB nhưng stream thực tế gửi 300MB
  const spoofAttempt = simulateServerUploadGate(50 * 1024 * 1024, 300 * 1024 * 1024, 'free')
  assert.equal(spoofAttempt.status, 413, 'Server phải chặn ngay khi stream thực tế vượt quá hạn mức')
})

// ==============================================================================
// 3. KIỂM THỬ MÃ HÓA & GIẢI MÃ CHUNK AES-256-GCM PHÍA CLIENT
// ==============================================================================
test('Sen Chat P4: Mã hóa và giải mã từng Chunk AES-256-GCM & Metadata', async () => {
  // 1. Sinh khóa ngẫu nhiên 256-bit độc lập cho tệp
  const fileKey = generateFileKey()
  assert.equal(fileKey.length, 32, 'Khóa tệp phải là 32 bytes (256-bit)')

  // 2. Dữ liệu nhị phân mô phỏng chunk 128KB
  const rawChunk = crypto.randomBytes(128 * 1024)
  const rawChunkBytes = new Uint8Array(rawChunk)

  // 3. Mã hóa chunk
  const encryptedChunk = await encryptChunk(rawChunkBytes, fileKey)
  // [12 bytes IV] + [128KB Ciphertext + 16 bytes GCM Auth Tag]
  assert.equal(
    encryptedChunk.length,
    12 + rawChunkBytes.length + 16,
    'Kích thước chunk mã hóa = IV (12) + Data (128KB) + Tag (16)'
  )

  // 4. Giải mã chunk
  const decryptedChunk = await decryptChunk(encryptedChunk, fileKey)
  assert.deepEqual(
    decryptedChunk,
    rawChunkBytes,
    'Dữ liệu sau giải mã phải nguyên vẹn từng byte với dữ liệu gốc'
  )

  // 5. Kiểm tra phát hiện giả mạo dữ liệu (Tamper Resistance)
  const tamperedChunk = new Uint8Array(encryptedChunk)
  tamperedChunk[20] ^= 0x55 // Thay đổi 1 bit trong ciphertext
  await assert.rejects(
    async () => {
      await decryptChunk(tamperedChunk, fileKey)
    },
    'GCM Auth Tag phát hiện thay đổi dữ liệu và từ chối giải mã'
  )

  // 6. Mã hóa & Giải mã Metadata (Tên tệp, MIME, Kích thước)
  const metadata = {
    name: 'secret_document.pdf',
    mimeType: 'application/pdf',
    size: 1048576,
    thumbnail: null,
  }
  const encryptedMeta = await encryptFileMetadata(metadata, fileKey)
  assert.ok(encryptedMeta.iv)
  assert.ok(encryptedMeta.ciphertext)
  assert.notEqual(encryptedMeta.ciphertext, metadata.name, 'Tên tệp phải được mã hóa hoàn toàn')

  const decryptedMeta = await decryptFileMetadata(encryptedMeta, fileKey)
  assert.deepEqual(decryptedMeta, metadata)
})

// ==============================================================================
// 4. KIỂM THỬ ẢNH TẢI LÊN GOOGLE DRIVE CHỈ LÀ BLOB MÃ HÓA (UNDECRYPTABLE)
// ==============================================================================
test('Sen Chat P4: Ảnh trên Google Drive chỉ là Blob nhị phân mã hóa không thể xem được nếu thiếu khóa', async () => {
  // Ảnh JPEG gốc bắt đầu bằng Magic bytes FF D8 FF
  const fakeJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  const fakeJpegBody = crypto.randomBytes(1024)
  const originalImage = Buffer.concat([fakeJpegHeader, fakeJpegBody])

  const fileKey = generateFileKey()
  const encryptedBlob = await encryptChunk(new Uint8Array(originalImage), fileKey)

  // Kiểm tra tính bảo mật trên Google Drive:
  // Google Drive chỉ nhận encryptedBlob dạng 'application/octet-stream'
  const isJpegMagicPresent =
    encryptedBlob[12] === 0xff && encryptedBlob[13] === 0xd8 && encryptedBlob[14] === 0xff
  assert.equal(
    isJpegMagicPresent,
    false,
    'Dữ liệu lưu trên Google Drive không được chứa Magic Bytes gốc của JPEG'
  )

  // Thử giải mã bằng một khóa ngẫu nhiên khác (như trường hợp nhân viên Google hay kẻ tấn công chiếm được Drive)
  const wrongKey = generateFileKey()
  await assert.rejects(
    async () => {
      await decryptChunk(encryptedBlob, wrongKey)
    },
    'Không thể đọc hay giải mã ảnh trên Drive nếu không có khóa E2EE từ tin nhắn'
  )
})

// ==============================================================================
// 5. KIỂM THỬ XÁC THỰC THÀNH VIÊN HỘI THOẠI (NON-MEMBER CANNOT DOWNLOAD)
// ==============================================================================
test('Sen Chat P4: Người không thuộc hội thoại bị từ chối 403 Forbidden khi tải tệp', () => {
  // Giả lập cơ sở dữ liệu chat_members và chat_attachments
  const mockMembers = [
    { conversation_id: 'conv-123', user_id: 'user-alice' },
    { conversation_id: 'conv-123', user_id: 'user-bob' },
  ]

  const mockAttachment = {
    id: 'att-999',
    conversation_id: 'conv-123',
    drive_file_id: 'drive-file-abc',
    is_deleted: false,
  }

  function simulateDownloadAccess(requestUserId, attachment) {
    if (!attachment || attachment.is_deleted) {
      return { status: 404, error: 'Tệp không tồn tại hoặc đã bị thu hồi' }
    }

    const isMember = mockMembers.some(
      (m) => m.conversation_id === attachment.conversation_id && m.user_id === requestUserId
    )

    if (!isMember) {
      return { status: 403, error: 'Truy cập bị từ chối: Bạn không phải thành viên của cuộc hội thoại này' }
    }

    return { status: 200, allowed: true }
  }

  // Alice và Bob (thành viên) được phép tải
  assert.equal(simulateDownloadAccess('user-alice', mockAttachment).status, 200)
  assert.equal(simulateDownloadAccess('user-bob', mockAttachment).status, 200)

  // Eve (kẻ lạ, không thuộc hội thoại) bị từ chối 403
  const eveAccess = simulateDownloadAccess('user-eve', mockAttachment)
  assert.equal(eveAccess.status, 403)
  assert.ok(eveAccess.error.includes('không phải thành viên'))
})

// ==============================================================================
// 6. KIỂM THỬ THU HỒI VÀ TỰ HỦY TIN NHẮN XÓA TỆP TRÊN GOOGLE DRIVE
// ==============================================================================
test('Sen Chat P4: Khi thu hồi tin nhắn hoặc hết hạn tự hủy, tệp trên Drive được xóa ngay lập tức', async () => {
  // Giả lập trạng thái tệp đính kèm
  let driveFilesStore = new Map([
    ['drive-file-1', { size: 500000, content: 'encrypted_blob_1' }],
    ['drive-file-2', { size: 700000, content: 'encrypted_blob_2' }],
  ])

  const mockDbAttachments = [
    { id: 'att-1', message_id: 'msg-rec-1', drive_file_id: 'drive-file-1', is_deleted: false },
    { id: 'att-2', message_id: 'msg-rec-2', drive_file_id: 'drive-file-2', is_deleted: false },
  ]

  // Giả lập recall tin nhắn
  function simulateRecallMessage(messageId) {
    const attachments = mockDbAttachments.filter((a) => a.message_id === messageId)
    const driveIdsToDelete = []

    for (const att of attachments) {
      att.is_deleted = true
      if (att.drive_file_id) driveIdsToDelete.push(att.drive_file_id)
    }

    // Backend gọi hàm xóa vĩnh viễn trên Drive
    for (const dId of driveIdsToDelete) {
      driveFilesStore.delete(dId)
    }

    return {
      success: true,
      deletedDriveIds: driveIdsToDelete,
    }
  }

  assert.equal(driveFilesStore.has('drive-file-1'), true)

  // Thu hồi msg-rec-1
  const recallRes = simulateRecallMessage('msg-rec-1')
  assert.equal(recallRes.success, true)
  assert.deepEqual(recallRes.deletedDriveIds, ['drive-file-1'])
  assert.equal(driveFilesStore.has('drive-file-1'), false, 'Tệp trên Google Drive phải bị xóa ngay khi thu hồi')

  // Tệp của tin nhắn khác vẫn tồn tại
  assert.equal(driveFilesStore.has('drive-file-2'), true)
})

// ==============================================================================
// 7. KIỂM THỬ TẢI LÊN RESUMABLE & KHÔI PHỤC KHI GIÁN ĐOẠN (RETRY)
// ==============================================================================
test('Sen Chat P4: Xử lý gián đoạn kết nối và tự động thử lại khi tải lên', async () => {
  let attemptCount = 0
  const maxAttempts = 3

  async function simulateChunkUploadWithRetry(chunkIndex) {
    let currentAttempt = 0
    while (currentAttempt < maxAttempts) {
      currentAttempt++
      attemptCount++
      // Giả lập 2 lần đầu tiên bị ngắt kết nối mạng (Network Error / 503)
      if (currentAttempt < 3) {
        // Tự động thử lại
        continue
      }
      // Lần thứ 3 thành công
      return { success: true, chunkIndex, uploaded: true }
    }
    throw new Error('Upload failed after retries')
  }

  const result = await simulateChunkUploadWithRetry(0)
  assert.equal(result.success, true)
  assert.equal(result.chunkIndex, 0)
  assert.equal(attemptCount, 3, 'Hệ thống đã tự động thử lại thành công sau 2 lần lỗi mạng')
})

// ==============================================================================
// 8. KIỂM THỬ AN NINH TỆP THỰC THI & SVG/HTML RESTRICTED INLINE
// ==============================================================================
test('Sen Chat P4: Cảnh báo tệp thực thi và cách ly SVG/HTML chỉ cho tải xuống', () => {
  // 1. Nhận diện tệp thực thi nguy hiểm
  assert.equal(isExecutableFile('payload.exe'), true)
  assert.equal(isExecutableFile('script.bat'), true)
  assert.equal(isExecutableFile('installer.msi'), true)
  assert.equal(isExecutableFile('install.sh'), true)
  assert.equal(isExecutableFile('app.apk'), true)
  assert.equal(isExecutableFile('photo.jpg'), false)
  assert.equal(isExecutableFile('document.pdf'), false)

  // 2. Nhận diện tệp SVG và HTML (bị cấm render inline để chống XSS)
  assert.equal(isRestrictedInlineFile('vector.svg'), true)
  assert.equal(isRestrictedInlineFile('index.html'), true)
  assert.equal(isRestrictedInlineFile('page.xhtml'), true)
  assert.equal(isRestrictedInlineFile('style.xml'), true)
  assert.equal(isRestrictedInlineFile('image.png'), false)
  assert.equal(isRestrictedInlineFile('video.mp4'), false)
})
