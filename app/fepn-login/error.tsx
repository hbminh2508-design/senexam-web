'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function FepnLoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('FEPN Login Route Error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-indigo-50/40 to-slate-100 text-slate-800">
      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 sm:p-8 shadow-xl text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">
          Đã xảy ra lỗi kết nối FEPN
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {error?.message || 'Không thể thiết lập kết nối an toàn với máy chủ Khảo Thí FEPN. Vui lòng thử lại.'}
        </p>
        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
          <Link
            href="/fepn-dashboard"
            className="w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về FEPN Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
