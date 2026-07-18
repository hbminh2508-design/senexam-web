import type React from 'react'

export type ThemeColorKey =
  | 'terracotta' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet'

export const THEME_COLORS: { key: ThemeColorKey; label: string; light: string; dark: string }[] = [
  { key: 'terracotta', label: 'Đất nung', light: '#BD5D3A', dark: '#E28560' },
  { key: 'indigo', label: 'Chàm', light: '#4F46E5', dark: '#818CF8' },
  { key: 'emerald', label: 'Ngọc lục bảo', light: '#059669', dark: '#34D399' },
  { key: 'rose', label: 'Hồng đào', light: '#E11D48', dark: '#FB7185' },
  { key: 'amber', label: 'Hổ phách', light: '#D97706', dark: '#FBBF24' },
  { key: 'sky', label: 'Xanh trời', light: '#0284C7', dark: '#38BDF8' },
  { key: 'violet', label: 'Tím oải hương', light: '#7C3AED', dark: '#A78BFA' },
]

export const DEFAULT_THEME_COLOR: ThemeColorKey = 'terracotta'

export function getAccentHex(key: string, isDark: boolean): string {
  const found = THEME_COLORS.find(c => c.key === key) ?? THEME_COLORS[0]
  return isDark ? found.dark : found.light
}

// Chuyển hex sang rgba với alpha cho nền accent nhạt
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getModernThemeVars(themeColor: string, isDark: boolean): React.CSSProperties {
  const accent = getAccentHex(themeColor, isDark)
  return {
    ['--bg' as any]: isDark ? '#171614' : '#FAF8F4',
    ['--surface' as any]: isDark ? '#1E1D1A' : '#FFFFFF',
    ['--border' as any]: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,25,20,0.09)',
    ['--text' as any]: isDark ? '#EDEAE3' : '#231F1B',
    ['--text-muted' as any]: isDark ? '#A6A196' : '#6B6558',
    ['--accent' as any]: accent,
    ['--accent-soft' as any]: hexToRgba(accent, isDark ? 0.16 : 0.1),
  }
}
