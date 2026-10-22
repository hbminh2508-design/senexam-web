'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

function SetupCourseRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
    if (!params.has('tab')) {
      params.set('tab', 'create')
    }
    const query = params.toString() ? `?${params.toString()}` : ''
    router.replace(`/new-sen-ground${query}`)
  }, [router, searchParams])

  return (
    <ModernLoading
      themeColor="emerald"
      title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
      subtitle="Đang chuyển hướng đến cổng Tạo đề & Soạn đề..."
    />
  )
}

export default function NewSetupCourseRedirectPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="emerald"
          title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
          subtitle="Đang chuyển hướng đến cổng Tạo đề & Soạn đề..."
        />
      }
    >
      <SetupCourseRedirectInner />
    </Suspense>
  )
}
