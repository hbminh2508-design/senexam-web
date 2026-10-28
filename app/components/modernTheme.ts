import type React from 'react'

export type ThemeColorKey =
  | 'sky' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'terracotta' | 'violet'

export const THEME_COLORS: { key: ThemeColorKey; label: string; light: string; dark: string }[] = [
  { key: 'sky', label: 'Xanh SenExam (Mặc định)', light: '#0284C7', dark: '#38BDF8' },
  { key: 'indigo', label: 'Xanh Lam', light: '#2563EB', dark: '#60A5FA' },
  { key: 'emerald', label: 'Ngọc lục bảo', light: '#059669', dark: '#34D399' },
  { key: 'rose', label: 'Hồng đào', light: '#E11D48', dark: '#FB7185' },
  { key: 'amber', label: 'Hổ phách', light: '#D97706', dark: '#FBBF24' },
  { key: 'terracotta', label: 'Đất nung', light: '#BD5D3A', dark: '#E28560' },
  { key: 'violet', label: 'Tím oải hương', light: '#7C3AED', dark: '#A78BFA' },
]

export const DEFAULT_THEME_COLOR: ThemeColorKey = 'sky'

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
  const accent = getAccentHex(themeColor || 'sky', isDark)
  return {
    ['--bg' as any]: isDark ? '#080C14' : '#F8FAFC',
    ['--surface' as any]: isDark ? '#0F172A' : '#FFFFFF',
    ['--border' as any]: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.12)',
    ['--text' as any]: isDark ? '#F8FAFC' : '#0F172A',
    ['--text-muted' as any]: isDark ? '#94A3B8' : '#475569',
    ['--accent' as any]: accent,
    ['--accent-soft' as any]: hexToRgba(accent, isDark ? 0.2 : 0.1),
    ['--glass-surface' as any]: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.82)',
    ['--glass-blur' as any]: '20px',
    ['--glass-shadow' as any]: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 30px rgba(2,132,199,0.08)',
  }
}

export function getGlassThemeVars(themeColor: string, isDark: boolean): React.CSSProperties {
  const accent = getAccentHex(themeColor || 'sky', isDark)
  return {
    ['--bg' as any]: isDark ? '#080C14' : '#F0F6FF',
    ['--surface' as any]: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.75)',
    ['--surface-elevated' as any]: isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.9)',
    ['--border' as any]: isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(14, 165, 233, 0.25)',
    ['--border-refract' as any]: isDark
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(56, 189, 248, 0.2) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(14, 165, 233, 0.3) 100%)',
    ['--text' as any]: isDark ? '#F8FAFC' : '#0F172A',
    ['--text-muted' as any]: isDark ? '#94A3B8' : '#475569',
    ['--accent' as any]: accent,
    ['--accent-soft' as any]: hexToRgba(accent, isDark ? 0.24 : 0.14),
    ['--glass-surface' as any]: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.72)',
    ['--glass-blur' as any]: '24px',
    ['--glass-shadow' as any]: isDark
      ? '0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15)'
      : '0 20px 45px rgba(2, 132, 199, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.85)',
  }
}


