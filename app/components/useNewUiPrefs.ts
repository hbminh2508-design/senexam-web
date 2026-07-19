'use client'

import { useEffect, useState } from 'react'

export type UiDensity = 'comfortable' | 'compact'

// Sự kiện tùy chỉnh phát ra ngay khi Dashboard ghi cờ UI mới vào localStorage,
// để các component khác đang mounted (vd. bong bóng chat SenAI) cập nhật tức thời
// mà không cần tải lại trang — sự kiện 'storage' mặc định của trình duyệt chỉ bắn
// ở các tab/trang KHÁC, không bắn trong cùng tab đã ghi.
export const UI_PREFS_CHANGED_EVENT = 'senexam-ui-prefs-changed'

function readPrefs() {
  if (typeof window === 'undefined') {
    return { newUiEnabled: false, themeColor: 'terracotta', density: 'comfortable' as UiDensity, animationsEnabled: true, isBetaTester: false }
  }
  return {
    newUiEnabled: localStorage.getItem('senexam_new_ui') === '1',
    themeColor: localStorage.getItem('senexam_theme_color') || 'terracotta',
    density: (localStorage.getItem('senexam_density') === 'compact' ? 'compact' : 'comfortable') as UiDensity,
    animationsEnabled: localStorage.getItem('senexam_animations') !== '0',
    isBetaTester: localStorage.getItem('senexam_beta_tester') === '1',
  }
}

// Đọc cờ "Giao diện mới (Beta)" + màu chủ đề + mật độ/animation từ localStorage
// (đồng bộ từ Supabase ngay khi tải Dashboard) để các trang khác không phải fetch
// profile riêng chỉ để biết các cờ này. Tự cập nhật real-time khi cờ thay đổi.
export function useNewUiPrefs() {
  const [prefs, setPrefs] = useState(readPrefs)

  useEffect(() => {
    setPrefs(readPrefs())
    const handleChange = () => setPrefs(readPrefs())
    window.addEventListener(UI_PREFS_CHANGED_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(UI_PREFS_CHANGED_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  return prefs
}
