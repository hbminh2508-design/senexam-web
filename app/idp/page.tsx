'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function IdpRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      router.replace(`/new-idp${search}`)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F6FA] dark:bg-[#070A11] text-slate-600 dark:text-slate-300">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold font-mono">Đang chuyển tiếp đến SenExam New-IDP...</p>
      </div>
    </div>
  )
}
