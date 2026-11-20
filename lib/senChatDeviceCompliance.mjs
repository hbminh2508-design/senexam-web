/**
 * Sen Chat Device Compliance & DRM Security Guard (ESM)
 */

export function checkDeviceCompliance(win = typeof window !== 'undefined' ? window : null) {
  if (!win) {
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

  const warnings = []
  let score = 100

  const isSecure = Boolean(win.isSecureContext || win.location?.hostname === 'localhost' || win.location?.hostname === '127.0.0.1')
  if (!isSecure) {
    warnings.push('Kết nối không an toàn (Yêu cầu HTTPS hoặc localhost để bảo vệ khóa E2EE)')
    score -= 30
  }

  const hasWebCrypto = Boolean(win.crypto && win.crypto.subtle && typeof win.crypto.subtle.encrypt === 'function')
  if (!hasWebCrypto) {
    warnings.push('Thiết bị thiếu Web Crypto API (Không thể thực thi mã hóa AES-256-GCM phần cứng)')
    score -= 35
  }

  const hasIndexedDb = Boolean(win.indexedDB && typeof win.indexedDB.open === 'function')
  if (!hasIndexedDb) {
    warnings.push('Trình duyệt không hỗ trợ hoặc vô hiệu hóa IndexedDB (Khóa bảo mật có thể bị mất khi đóng tab)')
    score -= 15
  }

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

export function isScreenCaptureKey(e) {
  const k = e.key
  if (k === 'PrintScreen' || k === 'Snapshot') {
    return true
  }

  const isCmdOrCtrl = Boolean(e.metaKey || e.ctrlKey)
  if (isCmdOrCtrl && e.shiftKey) {
    if (['3', '4', '5', 's', 'S'].includes(k)) {
      return true
    }
  }

  if (k === 'F12') {
    return true
  }
  if (isCmdOrCtrl && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(k)) {
    return true
  }

  return false
}
