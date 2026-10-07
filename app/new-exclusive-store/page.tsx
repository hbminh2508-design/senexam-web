'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewExclusiveStoreRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=exclusive')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF6EC] dark:bg-[#080C14] text-slate-600 dark:text-slate-300">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold font-mono">Đang chuyển tiếp đến Cửa Hàng Độc Quyền trong Cửa hàng Sen...</p>
      </div>
    </div>
  )
}
