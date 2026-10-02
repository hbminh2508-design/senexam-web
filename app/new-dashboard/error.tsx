'use client'

import { useEffect } from 'react'
import { Sparkles, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function NewDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('New Dashboard Route Error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FDF6EC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 sm:p-8 shadow-xl text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Sự cố đồng bộ Dashboard
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {error?.message || 'Không thể đồng bộ dữ liệu thời gian thực của tài khoản. Vui lòng bấm thử lại để tiếp tục.'}
        </p>
        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
          <Link
            href="/idp"
            className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Quay về Cổng IDP</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
