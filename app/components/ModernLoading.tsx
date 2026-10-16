'use client'

import type React from 'react'

interface ModernLoadingProps {
  themeColor?: string
  isDark?: boolean
  title?: string
  subtitle?: string
  label?: string
  fullScreen?: boolean
}

/**
 * Shared SenExam 2.0 Modern Loading Screen
 * Unified squircle 'S' card with ambient pulse glow, spinning accent ring,
 * feature-specific title & subtitle, and animated shimmer bar.
 */
export default function ModernLoading({
  themeColor,
  isDark,
  title,
  subtitle,
  label,
  fullScreen = true,
}: ModernLoadingProps) {
  const displayTitle = title || 'SenExam 2.0'
  const displaySubtitle = subtitle || label || 'Đang tải dữ liệu & tối ưu trải nghiệm...'

  const spinnerBorderColor =
    themeColor === 'amber'
      ? 'border-amber-500/40'
      : themeColor === 'emerald' || themeColor === 'teal'
      ? 'border-teal-500/40'
      : themeColor === 'purple' || themeColor === 'pink'
      ? 'border-purple-500/40'
      : 'border-indigo-500/40'

  const content = (
    <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-2xl max-w-sm w-full mx-4 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center shrink-0">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 sen-loading-glow opacity-80 blur-xs" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-2xl shadow-md select-none">
          S
        </div>
        <div className={`absolute inset-0 rounded-2xl border-2 ${spinnerBorderColor} sen-loading-spinner pointer-events-none`} />
      </div>

      <div className="space-y-1 w-full">
        <h3
          className="font-black text-base text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-newdash-heading, var(--font-heading, inherit))' }}
        >
          {displayTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden relative mt-1">
        <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 rounded-full sen-loading-shimmer" />
      </div>
    </div>
  )

  if (!fullScreen) {
    return (
      <div className={`w-full py-8 grid place-items-center ${isDark ? 'dark' : ''}`}>
        {content}
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#0B1120] text-[#2B2B2B] dark:text-slate-100 transition-colors ${
        isDark !== undefined ? (isDark ? 'dark' : '') : ''
      }`}
    >
      {content}
    </div>
  )
}
