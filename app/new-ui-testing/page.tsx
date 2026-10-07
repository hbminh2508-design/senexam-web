'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewUiTestingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/new-dashboard')
  }, [router])

  return (
    <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-sm backdrop-blur-xl">
        <span className="font-bold text-sm">Đang chuyển về Dashboard...</span>
      </div>
    </div>
  )
}
