'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FepnResetPasswordRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/sen-cap-lai-mat-khau')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3 p-6">
        <div className="h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600 font-sans">
          Đang chuyển hướng tới Cổng Cấp Lại Mật Khẩu FEPN...
        </p>
      </div>
    </div>
  )
}
