import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function FepnGpaLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 font-sans">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl">
        <div className="relative h-16 w-16">
          <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
        </div>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <span className="font-bold text-sm tracking-wide">Đang tải FEPN GPA...</span>
        </div>
      </div>
    </div>
  )
}
