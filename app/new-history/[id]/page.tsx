'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function NewHistoryIdRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id

  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      router.replace(`/new-history-submissions/${id}`)
    }
  }, [router, id])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F6FA] dark:bg-[#070A11] text-slate-600 dark:text-slate-300">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold font-mono">Đang chuyển tiếp đến chi tiết bài làm...</p>
      </div>
    </div>
  )
}
