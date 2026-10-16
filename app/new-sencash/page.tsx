'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewSenCashRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=wallet')
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="amber"
      title="SenExam Ví SenCash"
      subtitle="Đang chuyển hướng đến quản lý số dư Ví Sen & giao dịch..."
    />
  )
}
