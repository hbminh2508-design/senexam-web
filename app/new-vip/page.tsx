'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewVipRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=vip')
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="purple"
      title="SenExam Thành Viên VIP"
      subtitle="Đang chuyển hướng đến đặc quyền & gói nâng cấp VIP..."
    />
  )
}
