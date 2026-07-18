'use client'

import { useEffect, useState } from 'react'

export type UiDensity = 'comfortable' | 'compact'

// Đọc cờ "Giao diện mới (Beta)" + màu chủ đề + mật độ/animation từ localStorage
// (đồng bộ từ Supabase ngay khi tải Dashboard) để các trang khác không phải fetch
// profile riêng chỉ để biết các cờ này.
export function useNewUiPrefs() {
  const [newUiEnabled, setNewUiEnabled] = useState(false)
  const [themeColor, setThemeColor] = useState('terracotta')
  const [density, setDensity] = useState<UiDensity>('comfortable')
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  useEffect(() => {
    setNewUiEnabled(localStorage.getItem('senexam_new_ui') === '1')
    setThemeColor(localStorage.getItem('senexam_theme_color') || 'terracotta')
    setDensity(localStorage.getItem('senexam_density') === 'compact' ? 'compact' : 'comfortable')
    setAnimationsEnabled(localStorage.getItem('senexam_animations') !== '0')
  }, [])

  return { newUiEnabled, themeColor, density, animationsEnabled }
}
