'use client'

import type React from 'react'
import { getModernThemeVars } from '@/app/components/modernTheme'

interface ModernLoadingProps {
  themeColor: string
  isDark: boolean
  label?: string
  fullScreen?: boolean
}

/**
 * Shared Modern/Beta loading screen. Three pulsing dots orbiting the accent
 * color — used instead of a plain spinner so loading states feel consistent
 * with the flat Modern design system across every page.
 */
export default function ModernLoading({ themeColor, isDark, label = 'Đang tải...', fullScreen = true }: ModernLoadingProps) {
  const vars = getModernThemeVars(themeColor, isDark)
  return (
    <div
      className={fullScreen ? 'min-h-screen flex flex-col items-center justify-center font-sans' : 'w-full py-16 flex flex-col items-center justify-center font-sans'}
      style={{ ...vars, background: fullScreen ? 'var(--bg)' : 'transparent', color: 'var(--text)' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 mb-4" role="status" aria-label={label}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full modern-loading-dot"
            style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` } as React.CSSProperties}
          />
        ))}
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
