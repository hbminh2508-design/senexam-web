'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCcw, ArrowLeft, ShieldAlert } from 'lucide-react'

export default function ExamRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Lỗi phòng thi:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 p-6 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Không thể tải phòng thi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Hệ thống gặp sự cố khi khởi tạo cấu trúc đề thi hoặc phiên làm bài.
          </p>
          {error?.message && (
            <p className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-mono text-rose-700 dark:text-rose-300 break-words text-left">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white py-3 text-xs font-black shadow-md hover:bg-indigo-700 transition active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Thử tải lại
          </button>
          <Link
            href="/new-exams"
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 py-3 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kho đề thi
          </Link>
        </div>
      </div>
    </div>
  )
}
