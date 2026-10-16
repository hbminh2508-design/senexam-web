'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewSenAiRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      router.replace('/new-pay?tab=quota')
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="pink"
      title="SenExam Hạn Mức SenAI"
      subtitle="Đang chuyển hướng đến gói lượt hỏi & mở rộng trí tuệ nhân tạo..."
    />
  )
}
