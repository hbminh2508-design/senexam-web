'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewExclusiveStoreRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=exclusive')
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="purple"
      title="SenExam Cửa Hàng Độc Quyền"
      subtitle="Đang chuyển hướng đến kho ưu đãi & vật phẩm giới hạn..."
    />
  )
}
