'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

function HistorySubmissionsRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
    if (!params.has('tab')) {
      params.set('tab', 'history')
    }
    const query = params.toString() ? `?${params.toString()}` : ''
    router.replace(`/new-sen-ground${query}`)
  }, [router, searchParams])

  return (
    <ModernLoading
      themeColor="teal"
      title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
      subtitle="Đang chuyển hướng sang lịch sử bài làm..."
    />
  )
}

export default function NewHistorySubmissionsRedirectPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="teal"
          title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
          subtitle="Đang chuyển hướng sang lịch sử bài làm..."
        />
      }
    >
      <HistorySubmissionsRedirectInner />
    </Suspense>
  )
}
