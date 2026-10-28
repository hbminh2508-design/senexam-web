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
  const displayTitle = title || 'SenExam'
  const displaySubtitle = subtitle || label || 'Đang tải dữ liệu & tối ưu trải nghiệm...'

  const content = (
    <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-sky-100 dark:border-sky-950/40 bg-white/95 dark:bg-slate-900/95 px-8 py-7 shadow-[0_20px_50px_rgba(2,132,199,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl max-w-sm w-full mx-4 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 opacity-25 blur-md animate-pulse" />
        <img
          src="/logo.png"
          alt="SenExam Logo"
          className="relative h-16 w-16 object-contain drop-shadow-md select-none animate-pulse"
        />
        <div className="absolute inset-0 rounded-full border-2 border-sky-400/40 border-t-sky-500 animate-spin pointer-events-none" style={{ animationDuration: '1.8s' }} />
      </div>

      <div className="space-y-1 w-full">
        <h3
          className="font-black text-base text-slate-900 dark:text-white tracking-tight"
          style={{ fontFamily: 'var(--font-newdash-heading, var(--font-heading, inherit))' }}
        >
          {displayTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative mt-1">
        <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 rounded-full sen-loading-shimmer" />
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
      className={`min-h-screen grid place-items-center bg-[#F8FAFC] dark:bg-[#080C14] text-slate-900 dark:text-slate-100 transition-colors ${
        isDark !== undefined ? (isDark ? 'dark' : '') : ''
      }`}
    >
      {content}
    </div>
  )
}
