'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewCodesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=giftcode')
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="amber"
      title="SenExam Mã Quà Tặng & Giftcode"
      subtitle="Đang kết nối trung tâm kích hoạt mã ưu đãi..."
    />
  )
}
