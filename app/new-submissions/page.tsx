'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewSubmissionsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      router.replace(`/new-history-submissions${search}`)
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="teal"
      title="SenExam Lịch Sử Bài Nộp"
      subtitle="Đang chuyển hướng đến cổng bài làm đã nộp..."
    />
  )
}
