'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewSubmissionsIdRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id

  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      router.replace(`/new-history-submissions/${id}`)
    }
  }, [router, id])

  return (
    <ModernLoading
      themeColor="teal"
      title="SenExam Chi Tiết Bài Làm"
      subtitle="Đang chuyển tiếp đến chi tiết bài làm & bảng điểm..."
    />
  )
}
