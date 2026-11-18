'use client'

import {
  DOUBLE_PRESS_DELAY_MS,
  isNativeCapacitor,
  isExamPath,
  isHomePath,
  createBackButtonDispatcher,
  resolveSafeDownload,
} from './capacitorBridge.mjs'

export {
  DOUBLE_PRESS_DELAY_MS,
  isNativeCapacitor,
  isExamPath,
  isHomePath,
  createBackButtonDispatcher,
  resolveSafeDownload,
}

// Global dispatcher instance
export const globalBackButtonDispatcher = createBackButtonDispatcher()

/**
 * Trigger download or external opening safely across platforms
 */
export function openSafeDownload(url: string, filename?: string) {
  if (typeof window === 'undefined') return
  const isNative = isNativeCapacitor(window)
  const resolved = resolveSafeDownload(url, isNative)
  if (!resolved.canDownload) return

  if (resolved.target === '_system') {
    // Ủy quyền cho trình duyệt ngoài trên Android
    window.open(resolved.url, '_system')
  } else {
    // Trình duyệt web chuẩn
    const link = document.createElement('a')
    link.href = resolved.url
    if (filename) link.download = filename
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * Setup virtual keyboard viewport auto-scroll on input focus
 */
export function setupVirtualKeyboardHelper() {
  if (typeof window === 'undefined') return () => {}

  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')
    ) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }

  window.addEventListener('focusin', handleFocusIn, { passive: true })
  return () => {
    window.removeEventListener('focusin', handleFocusIn)
  }
}
