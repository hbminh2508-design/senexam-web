'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function NewSetupCourseRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      router.replace(`/new-setup-courses${search}`)
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="emerald"
      title="SenExam Quản Trị Khóa Học & Soạn Đề"
      subtitle="Đang chuyển hướng đến cổng thiết lập khóa học & soạn đề KaTeX..."
    />
  )
}
