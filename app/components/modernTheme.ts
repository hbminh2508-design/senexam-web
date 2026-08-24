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
    ['--bg' as any]: isDark ? '#141310' : '#F2EFE9',
    ['--surface' as any]: isDark ? '#201E1A' : '#FFFFFF',
    ['--border' as any]: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(30,25,20,0.08)',
    ['--text' as any]: isDark ? '#EDEAE3' : '#231F1B',
    ['--text-muted' as any]: isDark ? '#A6A196' : '#6B6558',
    ['--accent' as any]: accent,
    ['--accent-soft' as any]: hexToRgba(accent, isDark ? 0.16 : 0.1),
    ['--glass-surface' as any]: isDark ? 'rgba(32,30,26,0.72)' : 'rgba(255,255,255,0.72)',
    ['--glass-blur' as any]: '18px',
    ['--glass-shadow' as any]: isDark ? '0 8px 32px rgba(0,0,0,0.35)' : '0 8px 28px rgba(35,31,27,0.09)',
  }
}

export function getGlassThemeVars(themeColor: string, isDark: boolean): React.CSSProperties {
  const accent = getAccentHex(themeColor, isDark)
  return {
    ['--bg' as any]: isDark ? '#080C14' : '#F0F4FD',
    ['--surface' as any]: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.68)',
    ['--surface-elevated' as any]: isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    ['--border' as any]: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.7)',
    ['--border-refract' as any]: isDark
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(56, 189, 248, 0.2) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(99, 102, 241, 0.3) 100%)',
    ['--text' as any]: isDark ? '#F8FAFC' : '#0F172A',
    ['--text-muted' as any]: isDark ? '#94A3B8' : '#475569',
    ['--accent' as any]: accent,
    ['--accent-soft' as any]: hexToRgba(accent, isDark ? 0.22 : 0.14),
    ['--glass-surface' as any]: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255, 255, 255, 0.65)',
    ['--glass-blur' as any]: '24px',
    ['--glass-shadow' as any]: isDark
      ? '0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15)'
      : '0 20px 45px rgba(30, 58, 138, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
  }
}


