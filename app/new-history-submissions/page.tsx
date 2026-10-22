'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewHistorySubmissionsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search ? `${window.location.search}&tab=history` : '?tab=history'
      router.replace(`/new-exams-history-submissions${search}`)
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="teal"
      title="SenExam Lịch Sử Bài Nộp"
      subtitle="Đang chuyển hướng sang cổng Kho đề & Lịch sử thi thống nhất..."
    />
  )
}
