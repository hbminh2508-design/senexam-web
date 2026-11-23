import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'

// ==============================================================================
// 1. KIỂM THỬ PHIÊN BẢN SEN CHAT V1.0.1 VÀ CHANGELOG
// ==============================================================================
test('Sen Chat v1.0.1: Phiên bản hiện tại là 1.0.1 và ghi log chính xác', () => {
  assert.equal(SEN_CHAT_CURRENT_VERSION, '1.0.1', 'Phiên bản Sen Chat phải là 1.0.1')
  assert.ok(Array.isArray(SEN_CHAT_CHANGELOG), 'SEN_CHAT_CHANGELOG phải là mảng')
  assert.ok(SEN_CHAT_CHANGELOG.length >= 2, 'Phải có ít nhất 2 phiên bản trong changelog')

  const latest = SEN_CHAT_CHANGELOG[0]
  assert.equal(latest.version, '1.0.1')
  assert.equal(latest.isLatest, true)
  assert.equal(latest.title, 'Bắt lại những con bò đang bay trên các vì sao')
  assert.ok(
    latest.changes.includes('Bắt lại những con bò đang bay trên các vì sao'),
    'Changelog 1.0.1 phải chứa mục "Bắt lại những con bò đang bay trên các vì sao"'
  )
  assert.ok(
    latest.changes.some((c) => c.includes('Lưu trữ tin nhắn bền vững trong Local Storage')),
    'Changelog phải có mục lưu trữ bền vững'
  )
  assert.ok(
    latest.changes.some((c) => c.includes('Giữ nguyên danh sách người trò chuyện')),
    'Changelog phải có mục giữ nguyên danh sách người trò chuyện'
  )
  assert.ok(
    latest.changes.some((c) => c.includes('Tắt tính năng che mờ màn hình')),
    'Changelog phải có mục tắt che mờ màn hình'
  )
  assert.ok(
    latest.changes.some((c) => c.includes('Di chuyển thanh E2EE Chuẩn Thiết Bị')),
    'Changelog phải có mục di chuyển thanh E2EE'
  )

  const v100 = SEN_CHAT_CHANGELOG.find((l) => l.version === '1.0.0')
  assert.ok(v100, 'Phải có phiên bản 1.0.0 trong lịch sử')
})

// ==============================================================================
// 2. KIỂM THỬ LƯU TRỮ BỀN VỮNG & BẢO TOÀN DANH SÁCH CUỘC TRÒ CHUYỆN
// ==============================================================================
test('Sen Chat v1.0.1: Lưu trữ chat bền vững trong Local Storage và bảo toàn người nhắn tin', () => {
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
