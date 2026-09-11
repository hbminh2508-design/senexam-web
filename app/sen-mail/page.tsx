'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SenMailPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/fepn-dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm font-bold">
      Đang chuyển hướng về Kho Học Liệu FEPN...
    </div>
  )
}
