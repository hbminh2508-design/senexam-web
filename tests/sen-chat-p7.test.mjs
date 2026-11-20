import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  generateIdempotencyKey,
  createOfflineQueue,
} from '../lib/senChatOfflineQueue.mjs'

import {
  createBackButtonDispatcher,
  isChatPath,
  isHomePath,
  isExamPath,
  resolveSafeDownload,
  DOUBLE_PRESS_DELAY_MS,
} from '../lib/capacitorBridge.mjs'

import {
  isFlagSecureEnabled,
  setFlagSecure,
  toggleFlagSecure,
  isAppLockConfigured,
  getAppLockConfig,
  setupAppLock,
  verifyAppLockPin,
  verifyBiometricAuth,
  disableAppLock,
  isSessionLocked,
  lockSession,
  unlockSession,
  storeIdentityPrivateKey,
  retrieveIdentityPrivateKey,
  deleteIdentityPrivateKey,
  formatE2eePushPayload,
  validatePushPayloadSecurity,
} from '../lib/senChatMobileSecurity.mjs'

// ==============================================================================
// 1. HÀNG ĐỢI GỬI LẠI KHI MẤT MẠNG (OFFLINE QUEUE) VỚI IDEMPOTENCY KEY
// ==============================================================================
test('Sen Chat P7: Hàng đợi ngoại tuyến với Idempotency Key & Loại bỏ tin nhắn trùng lặp', async () => {
  const queue = createOfflineQueue({
    queueKey: 'test_p7_queue_' + Date.now(),
    processedKey: 'test_p7_processed_' + Date.now(),
    maxRetries: 3,
  })

  // 1. Sinh khóa Idempotency Key đảm bảo tính duy nhất và cấu trúc chuẩn
  const key1 = generateIdempotencyKey('user_123', 'conv_456', 1700000000000, 'abc1')
  const key2 = generateIdempotencyKey('user_123', 'conv_456', 1700000000001, 'abc2')
  assert.ok(key1.startsWith('idem_'))
  assert.notEqual(key1, key2)

  // 2. Thêm tin nhắn vào hàng đợi ngoại tuyến theo thứ tự FIFO
  const msgA = {
    idempotencyKey: key1,
    conversationId: 'conv_456',
    senderId: 'user_123',
    receiverId: 'user_789',
    content: 'Tin nhắn ngoại tuyến A',
    timestamp: 100,
  }
  const resA = queue.enqueue(msgA)
  assert.equal(resA.duplicate, false)
  assert.equal(resA.status, 'queued')

  const msgB = {
    idempotencyKey: key2,
    conversationId: 'conv_456',
    senderId: 'user_123',
    receiverId: 'user_789',
    content: 'Tin nhắn ngoại tuyến B',
    timestamp: 200,
  }
  const resB = queue.enqueue(msgB)
  assert.equal(resB.duplicate, false)

  assert.equal(queue.getPendingCount(), 2)

  // 3. Chống gửi trùng (Idempotency): Đẩy lại key1 khi đang trong hàng đợi -> Bị từ chối trùng lặp
  const resADup = queue.enqueue(msgA)
  assert.equal(resADup.duplicate, true)
  assert.equal(queue.getPendingCount(), 2, 'Không được tăng số lượng tin trong hàng đợi khi trùng key')

  // 4. Xả hàng đợi tự động (drainQueue) khi có mạng kết nối lại
  const sentLog = []
  const drainRes = await queue.drainQueue(async (item) => {
    sentLog.push(item.idempotencyKey)
    return { success: true }
  })

  assert.equal(drainRes.sent, 2)
  assert.equal(drainRes.failed, 0)
  assert.equal(drainRes.remaining, 0)
  assert.deepEqual(sentLog, [key1, key2], 'Tin nhắn phải được gửi theo đúng thứ tự FIFO')

  // 5. Kiểm tra key đã được đánh dấu processed: Đẩy lại key1 vào hàng đợi sau khi đã gửi -> Bị từ chối
  assert.equal(queue.isProcessed(key1), true)
  const resAAfterSent = queue.enqueue(msgA)
  assert.equal(resAAfterSent.duplicate, true)
  assert.equal(resAAfterSent.status, 'already_processed')

  // 6. Deduplicate tin nhắn hợp nhất
  const unmerged = [
    { id: '1', idempotencyKey: 'k1', content: 'Xin chào' },
    { id: '2', idempotencyKey: 'k2', content: 'Bạn khỏe không' },
    { id: '1', idempotencyKey: 'k1', content: 'Xin chào (trùng)' },
    { id: '3', idempotencyKey: 'k3', content: 'OK' },
  ]
  const deduplicated = queue.deduplicateMessages(unmerged)
  assert.equal(deduplicated.length, 3)
  assert.equal(deduplicated[0].content, 'Xin chào')
})

// ==============================================================================
// 2. HÀNH VI NÚT BACK PHẦN CỨNG ANDROID THEO NGỮ CẢNH (CAPACITOR BACK BUTTON)
// ==============================================================================
test('Sen Chat P7: Hành vi nút Back Android: Trong hội thoại -> Thoát về danh sách -> Bấm 2 lần trong 2s để thoát app', () => {
  const dispatcher = createBackButtonDispatcher()

  // 1. Nhận diện tuyến đường chat di động
  assert.equal(isChatPath('/m/chat'), true)
  assert.equal(isChatPath('/m/chat/'), true)
  assert.equal(isChatPath('/chat'), true)
  assert.equal(isChatPath('/m/exams/123'), false)
  assert.equal(isChatPath('/m/profile'), false)

  // 2. Khi đang mở cuộc trò chuyện cụ thể trên /m/chat:
  // Bấm Back -> Thoát hội thoại quay về danh sách (close_chat_conversation)
  const backInChat = dispatcher.handleBackPress({
    currentPath: '/m/chat',
    hasOpenChatConversation: true,
  })
  assert.equal(backInChat.action, 'close_chat_conversation')
  assert.equal(backInChat.shouldExit, false)
  assert.equal(backInChat.message, 'Quay lại danh sách hội thoại')

  // 3. Khi đang mở modal trên /m/chat:
  // Bấm Back -> Đóng modal / quay về danh sách
  const backInModal = dispatcher.handleBackPress({
    currentPath: '/m/chat',
    hasOpenModal: true,
  })
  assert.equal(backInModal.action, 'close_chat_conversation')
  assert.equal(backInModal.shouldExit, false)

  // 4. Khi đã ở danh sách hội thoại của /m/chat (không mở chat hay modal nào):
  // Áp dụng quy tắc "nhấn lần nữa trong 2 giây để thoát" của /m
  dispatcher.resetTimer()

  // Lần nhấn thứ 1: Hiện toast nhắc nhở
  const press1 = dispatcher.handleBackPress({
    currentPath: '/m/chat',
    hasOpenChatConversation: false,
    hasOpenModal: false,
  })
  assert.equal(press1.action, 'prompt_exit_toast')
  assert.equal(press1.shouldExit, false)
  assert.ok(press1.message.includes('trong 2 giây để thoát'))

  // Lần nhấn thứ 2 (ngay sau đó < 2000ms): Thoát ứng dụng
  const press2 = dispatcher.handleBackPress({
    currentPath: '/m/chat',
    hasOpenChatConversation: false,
    hasOpenModal: false,
  })
  assert.equal(press2.action, 'exit_app')
  assert.equal(press2.shouldExit, true)

  // 5. Custom handler đăng ký động có quyền ưu tiên cao nhất
  let customTriggered = false
  const unregister = dispatcher.registerHandler(() => {
    customTriggered = true
    return true
  })
  const handled = dispatcher.triggerCustomHandler()
  assert.equal(handled, true)
  assert.equal(customTriggered, true)
  unregister()
  assert.equal(dispatcher.triggerCustomHandler(), false)
})

// ==============================================================================
// 3. ANDROID FLAG_SECURE: CHỐNG CHỤP MÀN HÌNH VÀ PREVIEW ĐA NHIỆM
// ==============================================================================
test('Sen Chat P7: Android FLAG_SECURE bật/tắt và bảo vệ màn hình đa nhiệm', () => {
  // Mock window với Capacitor PrivacyScreen plugin
  let privacyScreenEnabled = false
  const mockWin = {
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: {
        PrivacyScreen: {
          enable: () => { privacyScreenEnabled = true },
          disable: () => { privacyScreenEnabled = false },
        },
      },
    },
    document: {
      documentElement: {
        setAttribute: () => {},
        removeAttribute: () => {},
      },
    },
  }

  // Bật FLAG_SECURE
  const turnOn = setFlagSecure(true, mockWin)
  assert.equal(turnOn.enabled, true)
  assert.equal(privacyScreenEnabled, true)
  assert.equal(isFlagSecureEnabled(), true)

  // Tắt FLAG_SECURE
  const turnOff = setFlagSecure(false, mockWin)
  assert.equal(turnOff.enabled, false)
  assert.equal(privacyScreenEnabled, false)
  assert.equal(isFlagSecureEnabled(), false)

  // Chuyển đổi trạng thái (toggle)
  const toggled = toggleFlagSecure(mockWin)
  assert.equal(toggled.enabled, true)
  assert.equal(privacyScreenEnabled, true)
})

// ==============================================================================
// 4. KHÓA ỨNG DỤNG BẰNG PIN & SINH TRẮC HỌC (BIOMETRIC / PIN APP LOCK)
// ==============================================================================
test('Sen Chat P7: Khóa ứng dụng bằng PIN & Sinh trắc học', async () => {
  // 1. Kiểm tra từ chối mã PIN không hợp lệ (ít hơn 4 số hoặc có chữ cái)
  assert.throws(() => setupAppLock({ pin: '12' }), /từ 4 đến 6 chữ số/)
  assert.throws(() => setupAppLock({ pin: 'abcd' }), /từ 4 đến 6 chữ số/)

  // 2. Thiết lập mã PIN hợp lệ
  const setup = setupAppLock({ pin: '123456', useBiometric: true })
  assert.equal(setup.success, true)
  assert.equal(setup.lockType, 'both')
  assert.equal(isAppLockConfigured(), true)

  const config = getAppLockConfig()
  assert.equal(config.enabled, true)
  assert.equal(config.hasPin, true)
  assert.equal(config.useBiometric, true)

  // 3. Khóa phiên làm việc
  lockSession()
  assert.equal(isSessionLocked(), true)

  // 4. Xác thực sai mã PIN
  const wrongRes = verifyAppLockPin('999999')
  assert.equal(wrongRes.success, false)
  assert.equal(isSessionLocked(), true)
  assert.ok(wrongRes.attemptsRemaining < 5)

  // 5. Xác thực đúng mã PIN
  const rightRes = verifyAppLockPin('123456')
  assert.equal(rightRes.success, true)
  assert.equal(isSessionLocked(), false)

  // 6. Xác thực bằng sinh trắc học
  lockSession()
  const bioRes = await verifyBiometricAuth()
  assert.equal(bioRes.success, true)
  assert.equal(isSessionLocked(), false)

  // 7. Tắt khóa ứng dụng yêu cầu đúng PIN hiện tại
  const badDisable = disableAppLock('000000')
  assert.equal(badDisable.success, false)
  assert.equal(isAppLockConfigured(), true)

  const goodDisable = disableAppLock('123456')
  assert.equal(goodDisable.success, true)
  assert.equal(isAppLockConfigured(), false)
})

// ==============================================================================
// 5. LƯU KHÓA RIÊNG E2EE BẰNG ANDROID KEYSTORE QUA PLUGIN CAPACITOR
// ==============================================================================
test('Sen Chat P7: Lưu trữ và bảo vệ khóa riêng E2EE bằng Android Keystore', async () => {
  const mockKeystore = new Map()
  const mockWin = {
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: {
        SecureStoragePlugin: {
          set: async ({ key, value }) => { mockKeystore.set(key, value) },
          get: async ({ key }) => ({ value: mockKeystore.get(key) || null }),
          remove: async ({ key }) => { mockKeystore.delete(key) },
        },
      },
    },
  }

  const testAlias = 'senchat_identity_priv_p7'
  const testPrivateKey = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgMockPrivateKeyForSenChatP71234567890'

  // 1. Lưu khóa riêng vào Android Keystore
  const storeRes = await storeIdentityPrivateKey(testAlias, testPrivateKey, mockWin)
  assert.equal(storeRes.success, true)
  assert.equal(storeRes.storageType, 'android_keystore')
  assert.equal(storeRes.hardwareBacked, true)

  // 2. Lấy lại khóa riêng chính xác
  const retrievedKey = await retrieveIdentityPrivateKey(testAlias, mockWin)
  assert.equal(retrievedKey, testPrivateKey)

  // 3. Xóa khóa an toàn khỏi Keystore
  const delRes = await deleteIdentityPrivateKey(testAlias, mockWin)
  assert.equal(delRes.success, true)
  const afterDel = await retrieveIdentityPrivateKey(testAlias, mockWin)
  assert.equal(afterDel, null)
})

// ==============================================================================
// 6. THÔNG BÁO ĐẨY ZERO-KNOWLEDGE: TUYỆT ĐỐI KHÔNG CHỨA NỘI DUNG TIN NHẮN
// ==============================================================================
test('Sen Chat P7: Thông báo đẩy chuẩn bảo mật E2EE không bao giờ chứa nội dung tin nhắn', () => {
  // 1. Thông báo cho cuộc trò chuyện cá nhân
  const directPush = formatE2eePushPayload({
    senderName: 'Nguyễn Văn A',
    isGroup: false,
    conversationId: 'conv_123',
    // Giả lập ai đó vô tình truyền nội dung nhạy cảm vào hàm:
    content: 'Đáp án câu 5 là B nhé bạn',
    ciphertext: '3f9a8b1c4e...',
    transcription: 'Bản dịch tin nhắn thoại tuyệt mật',
  })

  assert.equal(directPush.title, 'Sen Chat')
  assert.equal(directPush.body, 'Bạn có tin nhắn mới từ Nguyễn Văn A')
  assert.equal(directPush.data.conversationId, 'conv_123')
  assert.equal(directPush.data.isGroup, false)

  // Kiểm định 0% rò rỉ nội dung
  const directSecurity = validatePushPayloadSecurity(directPush, [
    'Đáp án',
    '3f9a8b1c4e',
    'tuyệt mật',
  ])
  assert.equal(directSecurity.isSecure, true)
  assert.equal(directSecurity.leaksDetected.length, 0)

  // 2. Thông báo cho nhóm học tập MLS
  const groupPush = formatE2eePushPayload({
    senderName: 'Trần Thị B',
    isGroup: true,
    groupName: 'Ôn Thi HSA ĐHQGHN',
    conversationId: 'group_mls_456',
    rawMessage: { text: 'Bảo mật tuyệt đối' },
  })

  assert.equal(groupPush.title, 'Sen Chat')
  assert.equal(groupPush.body, 'Bạn có tin nhắn mới trong nhóm Ôn Thi HSA ĐHQGHN')
  assert.equal(groupPush.data.isGroup, true)

  const groupSecurity = validatePushPayloadSecurity(groupPush, ['Bảo mật tuyệt đối'])
  assert.equal(groupSecurity.isSecure, true)
})

// ==============================================================================
// 7. TẢI TỆP TIN AN TOÀN QUA OPENSAFEDOWNLOAD
// ==============================================================================
test('Sen Chat P7: Tải tệp tin trong WebView Android chuyển đổi sang _system intent', () => {
  const downloadUrl = 'https://drive.google.com/uc?export=download&id=sen_chat_file_123'

  // Trên Android Native Capacitor
  const androidDownload = resolveSafeDownload(downloadUrl, true)
  assert.equal(androidDownload.canDownload, true)
  assert.equal(androidDownload.target, '_system')
  assert.equal(androidDownload.strategy, 'external_browser_intent')

  // Trên trình duyệt Web thông thường
  const webDownload = resolveSafeDownload(downloadUrl, false)
  assert.equal(webDownload.canDownload, true)
  assert.equal(webDownload.target, '_blank')
  assert.equal(webDownload.strategy, 'standard_browser')
})

// ==============================================================================
// 8. ĐỒNG BỘ PARITY PC & MOBILE VÀ TUÂN THỦ QUY CHUẨN THƯƠNG HIỆU
// ==============================================================================
test('Sen Chat P7: Mobile Web & Android Parity đầy đủ và Tuyệt đối không xuất hiện chữ SC/SenCash trong app/m/chat', () => {
  // 1. Tồn tại trang di động /m/chat và layout
  const chatPagePath = path.join(process.cwd(), 'app', 'm', 'chat', 'page.tsx')
  const chatLayoutPath = path.join(process.cwd(), 'app', 'm', 'chat', 'layout.tsx')
  assert.ok(fs.existsSync(chatPagePath), 'app/m/chat/page.tsx phải tồn tại')
  assert.ok(fs.existsSync(chatLayoutPath), 'app/m/chat/layout.tsx phải tồn tại')

  const chatContent = fs.readFileSync(chatPagePath, 'utf8')

  // 2. Chứa đầy đủ 3 màn hình chuyển đổi di động (list, conversation, room-info)
  assert.match(chatContent, /view === 'list'/)
  assert.match(chatContent, /view === 'conversation'/)
  assert.match(chatContent, /view === 'room-info'/)

  // 3. Vùng chạm tối thiểu ≥ 44px
  assert.match(chatContent, /min-h-\[44px\]/)
  assert.match(chatContent, /min-w-\[44px\]/)

  // 4. Tích hợp FLAG_SECURE, App Lock và Keystore
  assert.match(chatContent, /isFlagSecureEnabled/)
  assert.match(chatContent, /setupAppLock/)
  assert.match(chatContent, /openSafeDownload/)

  // 5. Tuyệt đối không có chuỗi "SC" (đứng riêng lẻ) hay "SenCash" trong app/m/chat/
  const hasSenCash = /sencash/i.test(chatContent)
  const hasIsolatedSc = /\bSC\b/.test(chatContent)
  assert.equal(hasSenCash, false, 'Không được có chữ SenCash trong app/m/chat/')
  assert.equal(hasIsolatedSc, false, 'Không được có chữ SC trong app/m/chat/')

  // 6. Kiểm tra MOBILE_PARITY.md đã được cập nhật
  const matrixPath = path.join(process.cwd(), 'MOBILE_PARITY.md')
  const matrixContent = fs.readFileSync(matrixPath, 'utf8')
  assert.match(matrixContent, /Sen Chat \(Mã Hóa E2EE & MLS\)/)
  assert.match(matrixContent, /Đã hoàn thiện P7/)
})
