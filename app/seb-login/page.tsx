'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SebLoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.set('service', 'seb')
      router.replace(`/idp?${params.toString()}`)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F6FA] dark:bg-[#070A11] text-slate-600 dark:text-slate-300">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold font-mono">Đang chuyển hướng Safe Exam Browser đến SenExam IDP...</p>
      </div>
    </div>
  )
}
