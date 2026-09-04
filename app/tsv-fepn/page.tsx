'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function FepnIndexPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host.startsWith('tsv.fepn.') || host.startsWith('fepn.')) {
        router.replace('/dashboard')
      } else {
        router.replace('/tsv-fepn/dashboard')
      }
    }
  }, [router])

  return (
    <div className="min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14]">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl">
        <div className="relative h-16 w-16">
          <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
        </div>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
            Đang chuyển hướng tới Dashboard FEPN...
          </span>
        </div>
      </div>
    </div>
  )
}
