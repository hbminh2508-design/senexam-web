/**
 * Capacitor Android & Mobile WebView Bridge Utilities
 * Handles hardware back button, safe external downloads, and virtual keyboard viewports.
 * Compatible with pure Node tests and browser runtime.
 */

export const DOUBLE_PRESS_DELAY_MS = 2000

/**
 * Checks whether the current window environment is a native Capacitor container.
 */
export function isNativeCapacitor(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  if (win?.Capacitor?.isNativePlatform && typeof win.Capacitor.isNativePlatform === 'function') {
    return win.Capacitor.isNativePlatform()
  }
  const ua = win?.navigator?.userAgent || ''
  return /Capacitor|wv|Android.*Version\/[0-9.]+\s+Chrome/i.test(ua)
}

/**
 * Determines whether a given path is an active exam room.
 */
export function isExamPath(path) {
  if (!path || typeof path !== 'string') return false
  return /^\/m\/exams\/[^/]+/.test(path) || /^\/new-exams\/[^/]+/.test(path) || /^\/seb-exam\/[^/]+/.test(path)
}

/**
 * Determines whether a given path is a root / home screen.
 */
export function isHomePath(path) {
  if (!path || typeof path !== 'string') return false
  return path === '/m' || path === '/m/' || path === '/'
}

/**
 * Creates a stateful back-button dispatcher with standard Android lifecycle semantics.
 */
export function createBackButtonDispatcher() {
  let lastPressTimestamp = 0

  return {
    handleBackPress({ currentPath, hasActiveExam = false }) {
      const now = Date.now()

      // 1. Nếu đang làm bài thi: Chặn thoát và yêu cầu xác nhận nộp bài
      if (hasActiveExam || isExamPath(currentPath)) {
        return {
          action: 'confirm_exam_exit',
          message: 'Bạn có chắc muốn thoát? Bài thi sẽ được nộp tự động',
          shouldExit: false,
        }
      }

      // 2. Nếu đang ở trang chủ: Bấm 2 lần trong 2 giây để thoát
      if (isHomePath(currentPath)) {
        if (now - lastPressTimestamp < DOUBLE_PRESS_DELAY_MS) {
          lastPressTimestamp = 0
          return {
            action: 'exit_app',
            message: 'Đang thoát ứng dụng...',
            shouldExit: true,
          }
        } else {
          lastPressTimestamp = now
          return {
            action: 'prompt_exit_toast',
            message: 'Nhấn một lần nữa trong 2 giây để thoát ứng dụng',
            shouldExit: false,
          }
        }
      }

      // 3. Các trang khác: Quay lại trang trước
      return {
        action: 'navigate_back',
        shouldExit: false,
      }
    },
    resetTimer() {
      lastPressTimestamp = 0
    },
    getLastPressTimestamp() {
      return lastPressTimestamp
    },
  }
}

/**
 * Resolves safe download strategy for Android WebView vs Standard Browsers.
 */
export function resolveSafeDownload(url, isNative = false) {
  if (!url || typeof url !== 'string') {
    return { canDownload: false, url: '' }
  }

  // Trên Android Capacitor WebView, thẻ <a download> thường bị nuốt.
  // Mở bằng target="_system" để ủy quyền cho trình duyệt ngoài & Android DownloadManager
  if (isNative) {
    return {
      canDownload: true,
      url,
      target: '_system',
      strategy: 'external_browser_intent',
    }
  }

  return {
    canDownload: true,
    url,
    target: '_blank',
    strategy: 'standard_browser',
  }
}
