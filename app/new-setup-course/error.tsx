'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCcw, ArrowLeft, AlertCircle } from 'lucide-react'

export default function SetupCourseError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Lỗi cổng soạn đề & khóa học:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FA] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 p-6 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertCircle className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Không thể tải Cổng Soạn đề
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Hệ thống phát hiện lỗi khi đồng bộ danh sách đề thi hoặc quyền tài khoản.
          </p>
          {error?.message && (
            <p className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-mono text-amber-800 dark:text-amber-200 break-words text-left">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white py-3 text-xs font-black shadow-md hover:bg-emerald-700 transition active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Tải lại trang
          </button>
          <Link
            href="/new-dashboard"
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 py-3 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
