'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

export default function LoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      router.replace(`/new-idp${search}`)
    }
  }, [router])

  return (
    <ModernLoading
      themeColor="indigo"
      title="SenExam Định Danh & Đăng Nhập"
      subtitle="Đang chuyển hướng đến cổng xác thực tập trung SenExam IDP 2.0..."
    />
  )
}
