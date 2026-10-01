'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'

export default function IdpError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.warn('Lỗi cục bộ tại Cổng IDP được bắt và xử lý:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 font-sans">
      <div className="max-w-md w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Cổng Xác Thực Sẵn Sàng
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Đã phát hiện chuyển hướng phiên đăng nhập. Bạn có thể nhấn nút bên dưới để tải lại biểu mẫu đăng nhập ngay lập tức.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử lại ngay</span>
          </button>

          <Link
            href="/home"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-black/10 dark:hover:bg-white/10 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về Trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
