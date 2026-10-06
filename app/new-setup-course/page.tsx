'use client'

import Link from 'next/link'
import { Sparkles, ArrowLeft } from 'lucide-react'

export default function HiddenSetupCourseOldPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Cổng Soạn Đề Tạm Ẩn
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Tuyến đường này đang được tạm ẩn để phục vụ kiểm thử hệ thống.
        </p>

        <div className="pt-2">
          <Link
            href="/new-dashboard"
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
