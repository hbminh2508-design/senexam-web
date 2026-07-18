'use client'

import { useEffect, useState } from 'react'

// Đọc cờ "Giao diện mới (Beta)" + màu chủ đề từ localStorage (đồng bộ từ Supabase
// ngay khi tải Dashboard) để các trang khác không phải fetch profile riêng chỉ để biết cờ này.
export function useNewUiPrefs() {
  const [newUiEnabled, setNewUiEnabled] = useState(false)
  const [themeColor, setThemeColor] = useState('terracotta')

  useEffect(() => {
    setNewUiEnabled(localStorage.getItem('senexam_new_ui') === '1')
    setThemeColor(localStorage.getItem('senexam_theme_color') || 'terracotta')
  }, [])

  return { newUiEnabled, themeColor }
}
