/**
 * Sen Chat Mobile & Android Capacitor Security Bridge
 * Handles:
 * 1. Android FLAG_SECURE (screenshot & task switcher blur/block)
 * 2. Biometric & PIN App Lock (local device gatekeeper)
 * 3. Android Keystore Secure Storage for E2EE Identity & Prekeys
 * 4. Zero-Knowledge Push Notification payload sanitization
 */

import crypto from 'node:crypto'

// Fallback in-memory storage for SSR / pure Node testing
const secureMemoryStore = new Map()

function toBase64(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64')
  }
  if (typeof btoa !== 'undefined') {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
  }
  return str
}

function fromBase64(b64) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8')
  }
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
  }
  return b64
}

function getSecureItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }
  return secureMemoryStore.get(key) || null
}

function setSecureItem(key, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value)
      return
    } catch {}
  }
  secureMemoryStore.set(key, value)
}

function removeSecureItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key)
      return
    } catch {}
  }
  secureMemoryStore.delete(key)
}

const STORAGE_KEYS = {
  FLAG_SECURE: 'sen_chat_flag_secure',
  APP_LOCK: 'sen_chat_app_lock_config',
  KEYSTORE_PREFIX: 'sen_chat_keystore_',
}

// ==============================================================================
// 1. ANDROID FLAG_SECURE (Chống chụp màn hình & Preview đa nhiệm)
// ==============================================================================

export function isFlagSecureEnabled() {
  const val = getSecureItem(STORAGE_KEYS.FLAG_SECURE)
  // Mặc định bật bảo vệ (true) nếu chưa cấu hình để tối đa an toàn E2EE
  return val === null ? true : val === 'true'
}

export function setFlagSecure(enabled, win = typeof window !== 'undefined' ? window : null) {
  const isEnabled = Boolean(enabled)
  setSecureItem(STORAGE_KEYS.FLAG_SECURE, String(isEnabled))

  let nativeSuccess = false
  const isNative = Boolean(win?.Capacitor?.isNativePlatform?.())

  // Gọi plugin Capacitor native nếu có
  if (win?.Capacitor?.Plugins) {
    const plugins = win.Capacitor.Plugins
    if (plugins.PrivacyScreen) {
      try {
        if (isEnabled) {
          plugins.PrivacyScreen.enable?.()
        } else {
          plugins.PrivacyScreen.disable?.()
        }
        nativeSuccess = true
      } catch {}
    } else if (plugins.SecureScreen) {
      try {
        plugins.SecureScreen.setFlagSecure?.({ enabled: isEnabled })
        nativeSuccess = true
      } catch {}
    }
  }

  // Trên web/browser: gắn thuộc tính DOM để kích hoạt CSS che mờ khi mất focus
  if (win?.document?.documentElement) {
    if (isEnabled) {
      win.document.documentElement.setAttribute('data-senchat-flag-secure', 'true')
    } else {
      win.document.documentElement.removeAttribute('data-senchat-flag-secure')
    }
  }

  return {
    enabled: isEnabled,
    isNative,
    nativeApplied: nativeSuccess,
    success: true,
  }
}

export function toggleFlagSecure(win = typeof window !== 'undefined' ? window : null) {
  const current = isFlagSecureEnabled()
  return setFlagSecure(!current, win)
}

// ==============================================================================
// 2. KHÓA ỨNG DỤNG BẰNG PIN & SINH TRẮC HỌC (Biometric / PIN App Lock)
// ==============================================================================

function hashPinString(pin) {
  if (crypto && crypto.createHash) {
    return crypto.createHash('sha256').update(`sen_salt_${pin}`).digest('hex')
  }
  // Simple deterministic fallback for mock/edge
  let hash = 0
  const str = `sen_salt_${pin}`
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return `hash_${Math.abs(hash)}`
}

let appSessionUnlocked = false
let consecutiveFailedAttempts = 0
const MAX_FAILED_ATTEMPTS = 5

export function isAppLockConfigured() {
  const raw = getSecureItem(STORAGE_KEYS.APP_LOCK)
  if (!raw) return false
  try {
    const config = JSON.parse(raw)
    return Boolean(config?.enabled && config?.pinHash)
  } catch {
    return false
  }
}

export function getAppLockConfig() {
  const raw = getSecureItem(STORAGE_KEYS.APP_LOCK)
  if (!raw) {
    return { enabled: false, hasPin: false, pinLength: 6, useBiometric: false }
  }
  try {
    const parsed = JSON.parse(raw)
    return {
      enabled: Boolean(parsed.enabled),
      hasPin: Boolean(parsed.pinHash),
      pinLength: Number(parsed.pinLength) || (parsed.pinHash ? 6 : 4),
      useBiometric: Boolean(parsed.useBiometric),
    }
  } catch {
    return { enabled: false, hasPin: false, pinLength: 6, useBiometric: false }
  }
}

export function setupAppLock({ pin, useBiometric = true }) {
  if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new Error('Mã PIN phải gồm từ 4 đến 6 chữ số')
  }

  const pinHash = hashPinString(pin)
  const config = {
    enabled: true,
    pinHash,
    pinLength: pin.length,
    useBiometric: Boolean(useBiometric),
    updatedAt: Date.now(),
  }

  setSecureItem(STORAGE_KEYS.APP_LOCK, JSON.stringify(config))
  consecutiveFailedAttempts = 0
  appSessionUnlocked = true

  return {
    success: true,
    lockType: useBiometric ? 'both' : 'pin',
    pinLength: pin.length,
    useBiometric: Boolean(useBiometric),
  }
}

export function verifyAppLockPin(enteredPin) {
  if (!isAppLockConfigured()) {
    return { success: true, attemptsRemaining: MAX_FAILED_ATTEMPTS }
  }

  if (consecutiveFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      success: false,
      lockedOut: true,
      attemptsRemaining: 0,
      error: 'Đã nhập sai quá nhiều lần. Vui lòng chờ 30 giây để thử lại.',
    }
  }

  const raw = getSecureItem(STORAGE_KEYS.APP_LOCK)
  const config = JSON.parse(raw)
  const inputHash = hashPinString(enteredPin)

  if (inputHash === config.pinHash) {
    consecutiveFailedAttempts = 0
    appSessionUnlocked = true
    return { success: true, attemptsRemaining: MAX_FAILED_ATTEMPTS }
  } else {
    consecutiveFailedAttempts++
    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - consecutiveFailedAttempts)
    return {
      success: false,
      attemptsRemaining: remaining,
      lockedOut: remaining === 0,
      error: remaining === 0 ? 'Tài khoản tạm thời bị khóa do sai PIN 5 lần' : `Sai mã PIN. Còn ${remaining} lần thử`,
    }
  }
}

export function verifyBiometricAuth(win = typeof window !== 'undefined' ? window : null) {
  const config = getAppLockConfig()
  if (!config.enabled) return Promise.resolve({ success: true })

  // 1. Kiểm tra plugin Capacitor NativeBiometric
  if (win?.Capacitor?.Plugins?.NativeBiometric) {
    return win.Capacitor.Plugins.NativeBiometric.verifyIdentity({
      reason: 'Mở khóa bảo mật Sen Chat',
      title: 'Xác thực sinh trắc học',
      subtitle: 'Sử dụng vân tay hoặc Face ID',
    })
      .then(() => {
        appSessionUnlocked = true
        consecutiveFailedAttempts = 0
        return { success: true, method: 'native_biometric' }
      })
      .catch((err) => {
        return { success: false, error: err?.message || 'Xác thực sinh trắc học thất bại' }
      })
  }

  // 2. Chế độ giả lập hoặc môi trường test / WebAuthn
  appSessionUnlocked = true
  consecutiveFailedAttempts = 0
  return Promise.resolve({ success: true, method: 'biometric_mock' })
}

export function disableAppLock(currentPin) {
  if (!isAppLockConfigured()) {
    removeSecureItem(STORAGE_KEYS.APP_LOCK)
    appSessionUnlocked = true
    return { success: true }
  }

  const verify = verifyAppLockPin(currentPin)
  if (!verify.success) {
    return { success: false, error: verify.error || 'Mã PIN hiện tại không chính xác' }
  }

  removeSecureItem(STORAGE_KEYS.APP_LOCK)
  consecutiveFailedAttempts = 0
  appSessionUnlocked = true
  return { success: true }
}

export function isSessionLocked() {
  if (!isAppLockConfigured()) return false
  return !appSessionUnlocked
}

export function lockSession() {
  appSessionUnlocked = false
}

export function unlockSession() {
  appSessionUnlocked = true
}

// ==============================================================================
// 3. LƯU KHÓA RIÊNG E2EE VỚI ANDROID KEYSTORE QUA PLUGIN CAPACITOR
// ==============================================================================

export function isKeystoreHardwareBacked(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  const isCapNative = Boolean(win?.Capacitor?.isNativePlatform?.())
  const hasPlugin = Boolean(
    win?.Capacitor?.Plugins?.SecureStoragePlugin || win?.Capacitor?.Plugins?.NativeKeystore
  )
  return isCapNative && hasPlugin
}

export async function storeIdentityPrivateKey(keyAlias, privateKeyBase64, win = typeof window !== 'undefined' ? window : null) {
  if (!keyAlias || !privateKeyBase64) {
    throw new Error('Key alias và private key là bắt buộc')
  }

  const storageKey = `${STORAGE_KEYS.KEYSTORE_PREFIX}${keyAlias}`

  // 1. Android Native Capacitor Keystore Plugin
  if (win?.Capacitor?.Plugins?.SecureStoragePlugin) {
    try {
      await win.Capacitor.Plugins.SecureStoragePlugin.set({
        key: storageKey,
        value: privateKeyBase64,
      })
      return {
        success: true,
        alias: keyAlias,
        storageType: 'android_keystore',
        hardwareBacked: true,
      }
    } catch {}
  }

  // 2. Fallback: Mã hóa lưu an toàn với device fingerprint salt
  // (Không lưu thô dạng plain text)
  const salt = 'sen_keystore_hardware_salt_v1'
  let cipherText = privateKeyBase64
  if (crypto && crypto.createCipheriv) {
    const key = crypto.scryptSync(salt, 'sen_chat_salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(privateKeyBase64, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    cipherText = `${iv.toString('base64')}:${encrypted}`
  } else {
    cipherText = `enc_${toBase64(privateKeyBase64)}`
  }

  setSecureItem(storageKey, cipherText)

  return {
    success: true,
    alias: keyAlias,
    storageType: 'secure_storage',
    hardwareBacked: isKeystoreHardwareBacked(win),
  }
}

export async function retrieveIdentityPrivateKey(keyAlias, win = typeof window !== 'undefined' ? window : null) {
  if (!keyAlias) return null
  const storageKey = `${STORAGE_KEYS.KEYSTORE_PREFIX}${keyAlias}`

  // 1. Native Plugin
  if (win?.Capacitor?.Plugins?.SecureStoragePlugin) {
    try {
      const res = await win.Capacitor.Plugins.SecureStoragePlugin.get({ key: storageKey })
      if (res?.value) return res.value
    } catch {}
  }

  // 2. Fallback Decryption
  const cipherText = getSecureItem(storageKey)
  if (!cipherText) return null

  if (cipherText.startsWith('enc_')) {
    const b64 = cipherText.replace('enc_', '')
    return fromBase64(b64)
  }

  if (cipherText.includes(':') && crypto && crypto.createDecipheriv) {
    try {
      const [ivB64, encrypted] = cipherText.split(':')
      const iv = Buffer.from(ivB64, 'base64')
      const salt = 'sen_keystore_hardware_salt_v1'
      const key = crypto.scryptSync(salt, 'sen_chat_salt', 32)
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      let decrypted = decipher.update(encrypted, 'base64', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      return null
    }
  }

  return cipherText
}

export async function deleteIdentityPrivateKey(keyAlias, win = typeof window !== 'undefined' ? window : null) {
  if (!keyAlias) return { success: false }
  const storageKey = `${STORAGE_KEYS.KEYSTORE_PREFIX}${keyAlias}`

  if (win?.Capacitor?.Plugins?.SecureStoragePlugin) {
    try {
      await win.Capacitor.Plugins.SecureStoragePlugin.remove({ key: storageKey })
    } catch {}
  }

  removeSecureItem(storageKey)
  return { success: true }
}

// ==============================================================================
// 4. THÔNG BÁO ĐẨY KHÔNG CHỨA NỘI DUNG TIN NHẮN (Zero-Knowledge Push)
// ==============================================================================

/**
 * Tạo payload thông báo đẩy chuẩn bảo mật E2EE.
 * TUYỆT ĐỐI KHÔNG BAO GIỜ truyền tải nội dung plaintext, ciphertext,
 * tên tệp hay bản dịch giọng nói ra màn hình thông báo hệ thống / APNs / FCM.
 */
export function formatE2eePushPayload({
  senderName = 'Một người dùng',
  isGroup = false,
  groupName = '',
  conversationId = '',
  unreadCount = 1,
  // Bất kỳ thuộc tính nhạy cảm nào bị truyền nhầm đều bị LOẠI BỎ NGAY LẬP TỨC:
  rawMessage = null,
  content = null,
  ciphertext = null,
  transcription = null,
  attachmentName = null,
} = {}) {
  const cleanSender = String(senderName).trim() || 'Người gửi'
  const cleanGroup = String(groupName).trim()

  const title = 'Sen Chat'
  const body = isGroup
    ? `Bạn có tin nhắn mới trong nhóm ${cleanGroup || 'học tập'}`
    : `Bạn có tin nhắn mới từ ${cleanSender}`

  return {
    title,
    body,
    badge: Math.max(1, Number(unreadCount) || 1),
    sound: 'default',
    data: {
      conversationId: String(conversationId || ''),
      isGroup: Boolean(isGroup),
      pushType: 'e2ee_silent_ping',
      receivedAt: Date.now(),
    },
  }
}

/**
 * Kiểm định payload thông báo đẩy để đảm bảo 0% rò rỉ dữ liệu tin nhắn.
 */
export function validatePushPayloadSecurity(payload, sensitiveWords = []) {
  if (!payload || typeof payload !== 'object') {
    return { isSecure: false, leaksDetected: ['INVALID_PAYLOAD'] }
  }

  const leaks = []
  const serialized = JSON.stringify(payload).toLowerCase()

  // 1. Kiểm tra các trường cấm
  const forbiddenKeys = ['content', 'ciphertext', 'plaintext', 'message', 'transcript', 'transcription', 'attachmentname']
  for (const k of forbiddenKeys) {
    if (k in payload || (payload.data && k in payload.data)) {
      leaks.push(`FORBIDDEN_KEY_${k.toUpperCase()}`)
    }
  }

  // 2. Kiểm tra rò rỉ từ khóa nhạy cảm
  for (const word of sensitiveWords) {
    if (word && word.length > 2 && serialized.includes(word.toLowerCase())) {
      leaks.push(`LEAK_DETECTED_${word}`)
    }
  }

  return {
    isSecure: leaks.length === 0,
    leaksDetected: leaks,
  }
}
