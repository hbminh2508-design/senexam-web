'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

function NewExamsHistorySubmissionsRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams ? searchParams.toString() : ''
    router.replace(`/new-sen-ground${query ? `?${query}` : ''}`)
  }, [router, searchParams])

  return (
    <ModernLoading
      themeColor="indigo"
      title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
      subtitle="Đang chuyển tiếp vào không gian khảo thí & soạn đề Sen Ground..."
    />
  )
}

export default function NewExamsAndHistorySubmissionsPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="indigo"
          title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
          subtitle="Đang chuyển tiếp vào không gian khảo thí & soạn đề Sen Ground..."
        />
      }
    >
      <NewExamsHistorySubmissionsRedirectInner />
    </Suspense>
  )
}
