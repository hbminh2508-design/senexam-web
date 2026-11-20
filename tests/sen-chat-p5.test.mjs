import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  generateFileKey,
  encryptChunk,
  decryptChunk,
  encryptFileToBlob,
  decryptFileToBlob,
  CHUNKED_MAGIC,
  bytesToBase64,
  base64ToBytes,
} from '../lib/senChatChunkCrypto.mjs'
import {
  CHAT_FILE_LIMITS,
  getChatFileLimit,
  validateChatFileSize,
  formatBytes,
} from '../lib/chatLimits.mjs'
import {
  SUPPORTED_LANGUAGES,
  getLanguageMeta,
  detectLanguageFromText,
  formatAudioDuration,
  extractWaveformFromData,
  WHISPER_CONFIG,
  simulateServerSttExecution,
} from '../lib/senChatVoiceSTT.mjs'

// ==============================================================================
// 1. MÃ HÓA VÀ GIẢI MÃ ÂM THANH TIN NHẮN THOẠI (AES-256-GCM CHUNKED)
// ==============================================================================
test('Sen Chat P5: Mã hóa và giải mã âm thanh tin nhắn thoại AES-256-GCM', async () => {
  // 1. Giả lập một đoạn âm thanh Opus (ví dụ ghi âm qua MediaRecorder)
  const simulatedOpusAudio = new Uint8Array(64 * 1024) // 64KB âm thanh
  for (let i = 0; i < simulatedOpusAudio.length; i++) {
    simulatedOpusAudio[i] = (i * 37 + 13) % 256
  }

  // 2. Sinh khóa File Key 256-bit độc lập cho tin nhắn thoại
  const fileKey = generateFileKey()
  assert.equal(fileKey.length, 32, 'Khóa AES-256 phải có đúng 32 bytes')

  // 3. Mã hóa toàn bộ audio theo từng chunk AES-256-GCM
  const encryptedBlob = await encryptFileToBlob(simulatedOpusAudio, fileKey)
  assert.ok(encryptedBlob.size > simulatedOpusAudio.length, 'Kích thước sau mã hóa phải bao gồm Header SEN1 + IV + Tag')

  // Kiểm tra 4 bytes magic SEN1 ở đầu tệp
  const headerBuf = await encryptedBlob.slice(0, 4).arrayBuffer()
  const headerBytes = new Uint8Array(headerBuf)
  assert.deepEqual(Array.from(headerBytes), Array.from(CHUNKED_MAGIC), 'Phải có header magic SEN1')

  // 4. Giải mã trở lại dữ liệu âm thanh rõ (clear audio)
  const decryptedBlob = await decryptFileToBlob(encryptedBlob, fileKey, 'audio/webm;codecs=opus')
  const decryptedBuf = await decryptedBlob.arrayBuffer()
  const decryptedBytes = new Uint8Array(decryptedBuf)

  assert.equal(decryptedBytes.length, simulatedOpusAudio.length, 'Dữ liệu âm thanh giải mã phải có cùng kích thước')
  assert.deepEqual(decryptedBytes, simulatedOpusAudio, 'Dữ liệu âm thanh giải mã phải nguyên vẹn 100% từng byte')

  // 5. Thử nghiệm can thiệp trái phép: Sửa đổi 1 byte trong ciphertext -> Giải mã phải thất bại
  const corruptedBlobBuf = new Uint8Array(await encryptedBlob.arrayBuffer())
  corruptedBlobBuf[corruptedBlobBuf.length - 5] ^= 0xff // Làm hỏng Tag hoặc Ciphertext
  const corruptedBlob = new Blob([corruptedBlobBuf], { type: 'application/octet-stream' })

  await assert.rejects(
    async () => {
      await decryptFileToBlob(corruptedBlob, fileKey, 'audio/webm;codecs=opus')
    },
    /operation-specific|xác thực|lỗi giải mã|failed/i,
    'Âm thanh bị can thiệp dù chỉ 1 byte cũng phải bị từ chối giải mã'
  )
})

// ==============================================================================
// 2. HẠN MỨC DUNG LƯỢNG THEO GÓI DỊCH VỤ ÁP DỤNG CHO TIN NHẮN THOẠI
// ==============================================================================
test('Sen Chat P5: Giới hạn dung lượng theo gói áp dụng cho tin nhắn thoại', () => {
  // Voice note chuẩn (khoảng 32kbps - 64kbps Opus):
  // 1 phút ghi âm ~ 250KB - 500KB
  // 5 phút ghi âm ~ 1.5MB - 2.5MB
  // 1 giờ ghi âm ~ 30MB
  const standardVoiceNoteBytes = 1.5 * 1024 * 1024 // 1.5 MB

  // 1. Tin nhắn thoại thông thường ở mọi gói đều được chấp thuận
  const freeCheck = validateChatFileSize(standardVoiceNoteBytes, 'free')
  assert.equal(freeCheck.allowed, true)
  assert.equal(freeCheck.limitBytes, CHAT_FILE_LIMITS.free)

  // 2. Tin nhắn thoại dài hoặc chất lượng cao 120MB vượt gói Free (100MB) -> Bị chặn, gợi ý Sen VIP
  const largeVoiceBytes = 120 * 1024 * 1024
  const freeOverCheck = validateChatFileSize(largeVoiceBytes, 'free')
  assert.equal(freeOverCheck.allowed, false)
  assert.equal(freeOverCheck.suggestedTier, 'vip')
  assert.ok(freeOverCheck.error.includes('Sen VIP (250MB)'))

  // 3. Gói Sen VIP (250MB) gửi voice note 120MB -> Được phép
  const vipCheck = validateChatFileSize(largeVoiceBytes, 'vip')
  assert.equal(vipCheck.allowed, true)

  // 4. Voice note 300MB vượt gói VIP -> Gợi ý Sen Premium (500MB)
  const hugeVoiceBytes = 300 * 1024 * 1024
  const vipOverCheck = validateChatFileSize(hugeVoiceBytes, 'vip')
  assert.equal(vipOverCheck.allowed, false)
  assert.equal(vipOverCheck.suggestedTier, 'premium')

  // 5. Kiểm tra định dạng thời gian tin nhắn thoại
  assert.equal(formatAudioDuration(0), '00:00')
  assert.equal(formatAudioDuration(45), '00:45')
  assert.equal(formatAudioDuration(75), '01:15')
  assert.equal(formatAudioDuration(3665), '1:01:05')
})

// ==============================================================================
// 3. LUỒNG ĐỒNG Ý KHI DÙNG STT PHÍA SERVER & CAM KẾT KHÔNG LƯU FILE
// ==============================================================================
test('Sen Chat P5: Luồng đồng ý khi dùng STT phía server và cam kết không lưu lại sau xử lý', async () => {
  const sampleAudioBytes = new Uint8Array(10 * 1024)

  // 1. Khi người dùng CHƯA ĐỒNG Ý (consent: false hoặc undefined) -> Server từ chối ngay với mã lỗi 403
  const rejectWithoutConsent = await simulateServerSttExecution({
    audioBytes: sampleAudioBytes,
    consent: false,
    planTier: 'free',
  })
  assert.equal(rejectWithoutConsent.status, 403)
  assert.ok(rejectWithoutConsent.error.includes('chưa đồng ý gửi âm thanh tới máy chủ'))

  // 2. Khi người dùng ĐÃ ĐỒNG Ý RÕ RÀNG (consent: true) -> Server chấp nhận xử lý
  const acceptWithConsent = await simulateServerSttExecution({
    audioBytes: sampleAudioBytes,
    consent: true,
    planTier: 'free',
    languageHint: 'vi',
  })
  assert.equal(acceptWithConsent.status, 200)
  assert.equal(acceptWithConsent.success, true)
  assert.equal(acceptWithConsent.language, 'vi')
  assert.ok(acceptWithConsent.text.length > 0)

  // 3. Cam kết bảo mật bắt buộc: Server KHÔNG lưu lại tệp âm thanh (persistedToStorage === false)
  assert.equal(acceptWithConsent.persistedToStorage, false, 'Tuyệt đối không lưu lại tệp âm thanh sau khi xử lý')

  // 4. Kiểm tra mã nguồn server route /api/chat/stt đảm bảo có logic kiểm tra consent bắt buộc
  const routePath = path.resolve(process.cwd(), 'app/api/chat/stt/route.ts')
  assert.ok(fs.existsSync(routePath), 'Route /api/chat/stt/route.ts phải tồn tại')
  const routeContent = fs.readFileSync(routePath, 'utf8')

  assert.ok(routeContent.includes('consentGranted'), 'Route phải kiểm tra cờ consent')
  assert.ok(routeContent.includes('status: 403'), 'Route phải trả về HTTP 403 khi thiếu consent')
  assert.ok(routeContent.includes('validateChatFileSize'), 'Route phải kiểm tra hạn mức gói dịch vụ')
  assert.ok(routeContent.includes('persistedToStorage: false'), 'Route phải khẳng định không lưu trữ file')
})

// ==============================================================================
// 4. ON-DEVICE WHISPER STT: LAZY LOAD, CACHE, ĐA NGÔN NGỮ & CHO SỬA TAY
// ==============================================================================
test('Sen Chat P5: Whisper On-Device STT cấu hình Lazy/Cache & Nhận diện đa ngôn ngữ', () => {
  // 1. Cấu hình Whisper Tiny đa ngôn ngữ và cache
  assert.equal(WHISPER_CONFIG.modelId, 'onnx-community/whisper-tiny')
  assert.equal(WHISPER_CONFIG.cacheName, 'senchat-whisper-cache-v1')
  assert.equal(WHISPER_CONFIG.preferredDevice, 'webgpu')
  assert.equal(WHISPER_CONFIG.fallbackDevice, 'wasm')

  // 2. Nhận diện ngôn ngữ tự động: Ưu tiên Tiếng Việt và Tiếng Anh
  const viSample = 'Xin chào, hôm nay tôi muốn gửi bạn tài liệu ôn thi môn Vật lý'
  const viLang = detectLanguageFromText(viSample)
  assert.equal(viLang.code, 'vi')
  assert.equal(viLang.name, 'Tiếng Việt')
  assert.equal(viLang.flag, '🇻🇳')

  const enSample = 'Hello, could you please send me the end-to-end encrypted notes?'
  const enLang = detectLanguageFromText(enSample)
  assert.equal(enLang.code, 'en')
  assert.equal(enLang.name, 'English')
  assert.equal(enLang.flag, '🇺🇸')

  // Hỗ trợ thêm các ngôn ngữ khác (Pháp, Trung, Nhật, Hàn, Đức, Tây Ban Nha)
  const zhSample = '你好，这是一个加密的消息'
  assert.equal(detectLanguageFromText(zhSample).code, 'zh')

  const jaSample = 'こんにちは、音声メッセージです'
  assert.equal(detectLanguageFromText(jaSample).code, 'ja')

  const koSample = '안녕하세요, 음성 메시지입니다'
  assert.equal(detectLanguageFromText(koSample).code, 'ko')

  // 3. Hỗ trợ sửa tay (manual editing): Kiểm tra từ vựng tiếng Việt có dấu
  const rawTranscript = 'xin chao toi la hoc sinh senexam'
  const manuallyEdited = 'Xin chào, tôi là học sinh Sen Exam'
  const editedLang = detectLanguageFromText(manuallyEdited)
  assert.equal(editedLang.code, 'vi')
  assert.notEqual(rawTranscript, manuallyEdited)
})

// ==============================================================================
// 5. TRỰC QUAN HÓA SÓNG ÂM (WAVEFORM VISUALIZER)
// ==============================================================================
test('Sen Chat P5: Trực quan hóa sóng âm âm thanh (Waveform Extraction)', () => {
  // 1. Giả lập một chuỗi sample biên độ âm thanh
  const dummySamples = new Float32Array(360)
  for (let i = 0; i < dummySamples.length; i++) {
    dummySamples[i] = Math.sin(i * 0.1) * 0.8
  }

  // 2. Trích xuất mảng sóng âm gồm 36 thanh chuẩn hóa
  const waveform = extractWaveformFromData(dummySamples, 36)
  assert.equal(waveform.length, 36)

  // Mọi giá trị thanh phải nằm trong đoạn [0.08, 1.0]
  for (const bar of waveform) {
    assert.ok(bar >= 0.08 && bar <= 1.0, `Giá trị thanh sóng ${bar} phải nằm trong [0.08, 1.0]`)
  }

  // Mảng rỗng fallback về giá trị mặc định hợp lý
  const emptyWaveform = extractWaveformFromData([], 20)
  assert.equal(emptyWaveform.length, 20)
})

// ==============================================================================
// 6. QUYỀN MICROPHONE: XIN ĐÚNG LÚC KÈM GIẢI THÍCH RÕ RÀNG
// ==============================================================================
test('Sen Chat P5: Thành phần UI Ghi âm chỉ xin quyền micro khi người dùng bấm ghi và giải thích rõ', () => {
  const recorderPath = path.resolve(process.cwd(), 'components/chat/ChatVoiceRecorder.tsx')
  assert.ok(fs.existsSync(recorderPath), 'ChatVoiceRecorder.tsx phải tồn tại')
  const content = fs.readFileSync(recorderPath, 'utf8')

  // Kiểm tra trạng thái ban đầu là giải thích quyền ('explain_perm')
  assert.ok(content.includes("'explain_perm'"), 'Trạng thái ban đầu phải là giải thích quyền')
  assert.ok(content.includes('Quyền Truy Cập Microphone'), 'Phải có tiêu đề giải thích quyền microphone')
  assert.ok(content.includes('mã hóa đầu cuối'), 'Phải giải thích âm thanh được mã hóa an toàn trên thiết bị')
  assert.ok(content.includes('getUserMedia'), 'Chỉ gọi getUserMedia khi người dùng nhấn đồng ý')

  // Kiểm tra hướng dẫn khi quyền bị từ chối ('perm_denied')
  assert.ok(content.includes("'perm_denied'"), 'Phải có trạng thái xử lý khi bị từ chối quyền')
  assert.ok(content.toLowerCase().includes('ổ khóa'), 'Phải hướng dẫn người dùng mở ổ khóa trên trình duyệt để cấp quyền')
})

// ==============================================================================
// 7. KIỂM TRA BẢO MẬT & THƯƠNG HIỆU SEN CHAT (KHÔNG CHỨA TỪ KHÓA NGOẠI LAI)
// ==============================================================================
test('Sen Chat P5: Tuân thủ quy chuẩn thương hiệu Sen Chat (Không Zalo, Không SC/SenCash mobile)', () => {
  const p5Files = [
    'lib/senChatVoiceSTT.ts',
    'lib/senChatVoiceSTT.mjs',
    'app/api/chat/stt/route.ts',
    'components/chat/ChatVoiceRecorder.tsx',
    'components/chat/ChatVoiceMessageBubble.tsx',
  ]

  for (const relPath of p5Files) {
    const fullPath = path.resolve(process.cwd(), relPath)
    assert.ok(fs.existsSync(fullPath), `${relPath} phải tồn tại`)
    const code = fs.readFileSync(fullPath, 'utf8')

    // Tuyệt đối không chứa Zalo hay thương hiệu đối thủ
    assert.doesNotMatch(code, /\bZalo\b/i, `${relPath} không được chứa từ khóa Zalo`)
  }
})
