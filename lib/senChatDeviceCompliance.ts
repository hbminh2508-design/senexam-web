/**
 * Sen Chat Device Compliance & DRM Security Guard
 * 
 * 1. Device Compliance Check:
 *    - Secure Context (window.isSecureContext)
 *    - Web Crypto API (crypto.subtle)
 *    - IndexedDB persistence
 *    - Developer Tools detection
 * 
 * 2. DRM Anti-Screen Capture & Blackout Protection:
 *    - PrintScreen & OS screenshot shortcuts interception
 *    - Window blur / visibilitychange blackout
 *    - Print stylesheet neutralization (@media print { body { display: none !important; } })
 */

export interface DeviceComplianceStatus {
  isCompliant: boolean
  secureContext: boolean
  webCrypto: boolean
  indexedDb: boolean
  devToolsOpen: boolean
  warnings: string[]
  score: number // 0 - 100
}

/**
 * Kiểm tra các tiêu chuẩn bảo mật thiết bị chạy Sen Chat E2EE
 */
export function checkDeviceCompliance(win: Window | null = typeof window !== 'undefined' ? window : null): DeviceComplianceStatus {
  if (!win) {
    // Môi trường SSR / Node
    return {
      isCompliant: true,
      secureContext: true,
      webCrypto: true,
      indexedDb: true,
      devToolsOpen: false,
      warnings: [],
      score: 100,
    }
  }

  const warnings: string[] = []
  let score = 100

  // 1. Secure Context Check (HTTPS / localhost bắt buộc cho E2EE)
  const isSecure = Boolean(win.isSecureContext || win.location?.hostname === 'localhost' || win.location?.hostname === '127.0.0.1')
  if (!isSecure) {
    warnings.push('Kết nối không an toàn (Yêu cầu HTTPS hoặc localhost để bảo vệ khóa E2EE)')
    score -= 30
  }

  // 2. Web Crypto API Subtle Check (AES-256-GCM, ECDH, HKDF)
  const hasWebCrypto = Boolean(win.crypto && win.crypto.subtle && typeof win.crypto.subtle.encrypt === 'function')
  if (!hasWebCrypto) {
    warnings.push('Thiết bị thiếu Web Crypto API (Không thể thực thi mã hóa AES-256-GCM phần cứng)')
    score -= 35
  }

  // 3. IndexedDB Check (Lưu trữ an toàn Signal Prekeys & Ratchet Session)
  const hasIndexedDb = Boolean(win.indexedDB && typeof win.indexedDB.open === 'function')
  if (!hasIndexedDb) {
    warnings.push('Trình duyệt không hỗ trợ hoặc vô hiệu hóa IndexedDB (Khóa bảo mật có thể bị mất khi đóng tab)')
    score -= 15
  }

  // 4. Phát hiện Developer Tools mở
  let devToolsOpen = false
  try {
    const threshold = 160
    const widthDiff = win.outerWidth - win.innerWidth > threshold
    const heightDiff = win.outerHeight - win.innerHeight > threshold
    if (widthDiff || heightDiff) {
      devToolsOpen = true
      warnings.push('Phát hiện Developer Tools đang mở (Có thể làm lộ dữ liệu trong bộ nhớ tạm)')
      score -= 20
    }
  } catch {}

  const isCompliant = isSecure && hasWebCrypto && hasIndexedDb && !devToolsOpen

  return {
    isCompliant,
    secureContext: isSecure,
    webCrypto: hasWebCrypto,
    indexedDb: hasIndexedDb,
    devToolsOpen,
    warnings,
    score: Math.max(0, score),
  }
}

/**
 * Kiểm tra xem phím gõ có thuộc tổ hợp chụp màn hình hoặc devtools không
 */
export function isScreenCaptureKey(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }): boolean {
  const k = e.key
  // PrintScreen
  if (k === 'PrintScreen' || k === 'Snapshot') {
    return true
  }

  // Windows: Win+Shift+S (trình duyệt nhận Shift+S hoặc S kèm metaKey/ctrlKey)
  // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5, Cmd+Ctrl+Shift+3/4
  const isCmdOrCtrl = Boolean(e.metaKey || e.ctrlKey)
  if (isCmdOrCtrl && e.shiftKey) {
    if (['3', '4', '5', 's', 'S'].includes(k)) {
      return true
    }
  }

  // DevTools: F12 hoặc Ctrl/Cmd+Shift+I/J/C
  if (k === 'F12') {
    return true
  }
  if (isCmdOrCtrl && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(k)) {
    return true
  }

  return false
}
