import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'

// ==============================================================================
// 1. KIỂM THỬ PHIÊN BẢN SEN CHAT VÀ CHANGELOG
// ==============================================================================
test('Sen Chat: Phiên bản hiện tại là 1.0.2 và ghi log chính xác', () => {
  assert.equal(SEN_CHAT_CURRENT_VERSION, '1.0.2', 'Phiên bản Sen Chat phải là 1.0.2')
  assert.ok(Array.isArray(SEN_CHAT_CHANGELOG), 'SEN_CHAT_CHANGELOG phải là mảng')
  assert.ok(SEN_CHAT_CHANGELOG.length >= 2, 'Phải có ít nhất 2 phiên bản trong changelog')

  const latest = SEN_CHAT_CHANGELOG[0]
  assert.equal(latest.version, '1.0.2')
  assert.equal(latest.isLatest, true)
  assert.equal(latest.title, 'Bắt lại những con bò đang bay trên các vì sao')
  assert.ok(
    latest.changes.includes('Bắt lại những con bò đang bay trên các vì sao'),
    'Changelog 1.0.2 phải chứa mục "Bắt lại những con bò đang bay trên các vì sao"'
  )

  const v101 = SEN_CHAT_CHANGELOG.find((l) => l.version === '1.0.1')
  assert.ok(v101, 'Phải có phiên bản 1.0.1 trong lịch sử')
  assert.ok(
    v101.changes.some((c) => c.includes('Lưu trữ tin nhắn bền vững trong Local Storage')),
    'Changelog phải có mục lưu trữ bền vững'
  )
  assert.ok(
    v101.changes.some((c) => c.includes('Giữ nguyên danh sách người trò chuyện')),
    'Changelog phải có mục giữ nguyên danh sách người trò chuyện'
  )
  assert.ok(
    v101.changes.some((c) => c.includes('Tắt tính năng che mờ màn hình')),
    'Changelog phải có mục tắt che mờ màn hình'
  )
  assert.ok(
    v101.changes.some((c) => c.includes('Di chuyển thanh E2EE Chuẩn Thiết Bị')),
    'Changelog phải có mục di chuyển thanh E2EE'
  )

  const v100 = SEN_CHAT_CHANGELOG.find((l) => l.version === '1.0.0')
  assert.ok(v100, 'Phải có phiên bản 1.0.0 trong lịch sử')
})

// ==============================================================================
// 2. KIỂM THỬ LƯU TRỮ BỀN VỮNG & BẢO TOÀN DANH SÁCH CUỘC TRÒ CHUYỆN (SOURCE & RUNTIME)
// ==============================================================================
test('Sen Chat v1.0.1: Lưu trữ chat bền vững trong Local Storage và bảo toàn người nhắn tin', async () => {
  const storageFilePath = path.join(process.cwd(), 'lib/senChatStorage.ts')
  const code = fs.readFileSync(storageFilePath, 'utf8')

  // Mặc định lưu trữ bền vững (false)
  assert.ok(
    code.includes('if (saved === null) return false'),
    'isEphemeralStorageEnabled phải trả về false theo mặc định để lưu trữ bền vững'
  )

  // setupEphemeralCleanupListener là no-op khi lưu trữ bền vững
  assert.ok(
    code.includes('if (!isEphemeralStorageEnabled()) {\n    return () => {}\n  }'),
    'setupEphemeralCleanupListener phải là no-op khi không bật ephemeral storage'
  )

  // Khi xóa dữ liệu tin nhắn, danh sách hội thoại vẫn được giữ lại
  assert.ok(
    code.includes('STORAGE_KEYS.CONVERSATIONS, JSON.stringify(sanitizedConvs)'),
    'clearAllEphemeralMessages phải lưu lại sanitizedConvs vào STORAGE_KEYS.CONVERSATIONS'
  )
  assert.ok(
    !code.includes('localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS)'),
    'clearAllLocalChatData tuyệt đối KHÔNG được xóa key CONVERSATIONS khi đăng xuất'
  )

  // RUNTIME TEST với mock Storage
  const {
    getLocalConversations,
    saveLocalConversation,
    getLocalMessages,
    saveLocalMessage,
    clearAllEphemeralMessages,
    clearAllLocalMessages,
    clearAllLocalChatData,
    isEphemeralStorageEnabled,
    getStorageUsageSummary,
  } = await import('../lib/senChatStorage.mjs')

  const store = new Map()
  const mockLocalStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    get length() {
      return store.size
    },
    key: (i) => Array.from(store.keys())[i] || null,
  }

  // Gắn mock vào global window
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  globalThis.window = {}
  globalThis.localStorage = mockLocalStorage

  try {
    // 1. Mặc định lưu trữ bền vững
    assert.equal(isEphemeralStorageEnabled(), false, 'isEphemeralStorageEnabled phải trả về false mặc định')
    const initialStats = getStorageUsageSummary()
    assert.equal(initialStats.ephemeralEnabled, false, 'getStorageUsageSummary phải trả về ephemeralEnabled: false')

    // 2. Thêm 3 cuộc hội thoại với mốc thời gian khác nhau
    const conv1 = {
      id: 'user_1',
      partnerId: 'user_1',
      partnerName: 'Nguyễn Văn A',
      partnerIdentifier: '0901234567',
      avatarUrl: 'https://avatar.com/1.png',
      updatedAt: 1000,
      unreadCount: 2,
    }
    const conv2 = {
      id: 'user_2',
      partnerId: 'user_2',
      partnerName: 'Trần Thị B',
      partnerIdentifier: 'b@senexam.me',
      avatarUrl: 'https://avatar.com/2.png',
      updatedAt: 3000,
      unreadCount: 1,
    }
    const conv3 = {
      id: 'group_mls_1',
      partnerId: 'group_mls_1',
      partnerName: 'Nhóm Học Tập MLS',
      partnerIdentifier: 'Nhóm MLS',
      isGroup: true,
      avatarUrl: 'https://avatar.com/group.png',
      updatedAt: 2000,
      unreadCount: 5,
    }

    saveLocalConversation(conv1)
    saveLocalConversation(conv2)
    saveLocalConversation(conv3)

    // Thêm tin nhắn vào các cuộc hội thoại
    saveLocalMessage('user_1', {
      id: 'm1',
      conversationId: 'user_1',
      senderId: 'user_1',
      senderName: 'Nguyễn Văn A',
      receiverId: 'me',
      content: 'Chào bạn',
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'received',
    })
    saveLocalMessage('group_mls_1', {
      id: 'm2',
      conversationId: 'group_mls_1',
      senderId: 'user_2',
      senderName: 'Trần Thị B',
      receiverId: 'group_mls_1',
      content: 'Bài tập 3 đã xong',
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'received',
    })

    // Thứ tự trước khi xóa: Do group_mls_1 và user_1 vừa nhận tin nhắn, chúng có updatedAt mới nhất
    const convListBefore = getLocalConversations()
    assert.equal(convListBefore.length, 3)
    const expectedOrderBefore = convListBefore.map((c) => c.id)
    assert.equal(getLocalMessages('user_1').length, 1)
    assert.equal(getLocalMessages('group_mls_1').length, 1)

    // 3. Thực hiện Xóa tin nhắn tạm thời (clearAllEphemeralMessages)
    clearAllEphemeralMessages()

    // Kiểm tra: Mọi tin nhắn đã bị xóa
    assert.equal(getLocalMessages('user_1').length, 0, 'Tin nhắn của user_1 phải bị xóa')
    assert.equal(getLocalMessages('group_mls_1').length, 0, 'Tin nhắn của group_mls_1 phải bị xóa')

    // Kiểm tra: Danh sách hội thoại VẪN GIỮ NGUYÊN và ĐÚNG THỨ TỰ THỜI GIAN SO VỚI TRƯỚC KHI XÓA
    const convListAfter = getLocalConversations()
    assert.equal(convListAfter.length, 3, 'Danh sách cuộc hội thoại phải được bảo toàn đầy đủ 3 cuộc trò chuyện')
    assert.deepEqual(
      convListAfter.map((c) => c.id),
      expectedOrderBefore,
      'Thứ tự các cuộc hội thoại sau khi xóa tin nhắn phải được bảo toàn tuyệt đối theo đúng thứ tự từ trước'
    )

    // Kiểm tra chi tiết từng người nhắn tin
    const c1 = convListAfter.find((c) => c.id === 'user_1')
    assert.equal(c1.partnerName, 'Nguyễn Văn A')
    assert.equal(c1.partnerIdentifier, '0901234567')
    assert.equal(c1.avatarUrl, 'https://avatar.com/1.png')
    assert.equal(c1.unreadCount, 0, 'unreadCount phải được reset về 0')
    assert.equal(c1.lastMessage, undefined, 'lastMessage phải được dọn sạch')

    const cGroup = convListAfter.find((c) => c.id === 'group_mls_1')
    assert.equal(cGroup.partnerName, 'Nhóm Học Tập MLS')
    assert.equal(cGroup.isGroup, true, 'isGroup phải được giữ nguyên')

    // 4. Kiểm tra clearAllLocalChatData (khi Đăng xuất): CONVERSATIONS vẫn được giữ lại theo đúng thứ tự
    clearAllLocalChatData()
    const convListAfterLogout = getLocalConversations()
    assert.equal(convListAfterLogout.length, 3, 'Khi đăng xuất, danh sách người nhắn tin vẫn được bảo toàn')
    assert.deepEqual(
      convListAfterLogout.map((c) => c.id),
      expectedOrderBefore,
      'Khi đăng xuất, thứ tự cuộc trò chuyện vẫn được giữ nguyên'
    )
  } finally {
    globalThis.window = originalWindow
    globalThis.localStorage = originalLocalStorage
  }
})

// ==============================================================================
// 3. KIỂM THỬ TẮT CHE MỜ MÀN HÌNH VÀ DI CHUYỂN HUY HIỆU E2EE
// ==============================================================================
test('Sen Chat v1.0.1: Tắt hoàn toàn che mờ màn hình và gỡ bỏ fixed bottom-3 left-3 đè avatar', () => {
  const drmPath = path.join(process.cwd(), 'components/chat/ChatDrmProtection.tsx')
  const code = fs.readFileSync(drmPath, 'utf8')

  // Tắt che mờ màn hình
  assert.ok(!code.includes('isBlackedOut'), 'Không còn cờ isBlackedOut che mờ màn hình')
  assert.ok(!code.includes('backdropFilter: \'blur(50px)'), 'Không còn backdropFilter blur che tối màn hình')

  // Gỡ bỏ fixed bottom-3 left-3 đè avatar
  assert.ok(
    !code.includes('fixed bottom-3 left-3'),
    'ChatDrmProtection tuyệt đối không được set fixed bottom-3 left-3'
  )
  assert.ok(
    code.includes('export function ChatDeviceComplianceBadge'),
    'Phải export component ChatDeviceComplianceBadge'
  )
})

// ==============================================================================
// 4. KIỂM THỬ CLICK LOGO MỞ CHAT VERSION MODAL TRÊN DESKTOP VÀ MOBILE
// ==============================================================================
test('Sen Chat v1.0.1: Bấm vào Logo Sen Chat mở ChatVersionModal trên cả Desktop và Mobile', () => {
  // 1. Component ChatVersionModal
  const modalPath = path.join(process.cwd(), 'components/chat/ChatVersionModal.tsx')
  assert.ok(fs.existsSync(modalPath), 'components/chat/ChatVersionModal.tsx phải tồn tại')
  const modalCode = fs.readFileSync(modalPath, 'utf8')
  assert.ok(modalCode.includes('SEN_CHAT_CURRENT_VERSION'), 'ChatVersionModal phải hiển thị phiên bản hiện tại')
  assert.ok(modalCode.includes('SEN_CHAT_CHANGELOG'), 'ChatVersionModal phải hiển thị danh sách changelog')

  // 2. Desktop Chat (app/chat/page.tsx)
  const desktopChat = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(
    desktopChat.includes('ChatVersionModal'),
    'Desktop Chat phải import và sử dụng ChatVersionModal'
  )
  assert.ok(
    desktopChat.includes('setShowVersionModal(true)'),
    'Desktop Chat phải có sự kiện click mở version modal khi bấm Logo'
  )
  assert.ok(
    desktopChat.includes('ChatDeviceComplianceBadge'),
    'Desktop Chat phải tích hợp ChatDeviceComplianceBadge trong header'
  )

  // 3. Mobile Chat (app/m/chat/page.tsx)
  const mobileChat = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(
    mobileChat.includes('ChatVersionModal'),
    'Mobile Chat phải import và sử dụng ChatVersionModal'
  )
  assert.ok(
    mobileChat.includes('setShowVersionModal(true)'),
    'Mobile Chat phải có sự kiện click mở version modal khi bấm Logo'
  )
  assert.ok(
    mobileChat.includes('ChatDeviceComplianceBadge'),
    'Mobile Chat phải tích hợp ChatDeviceComplianceBadge trong header'
  )
})
