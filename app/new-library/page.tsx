'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernLoading from '@/app/components/ModernLoading'

function NewLibraryRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const folder = searchParams?.get('folder')
    const query = folder ? `&folder=${folder}` : ''
    router.replace(`/new-sen-ground?tab=library${query}`)
  }, [router, searchParams])

  return (
    <ModernLoading
      themeColor="indigo"
      title="Thư Viện Sen Online"
      subtitle="Đang chuyển tiếp vào không gian Thư viện Sen Online tại Sen Ground..."
    />
  )
}

export default function NewLibraryRedirectPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="indigo"
          title="Thư Viện Sen Online"
          subtitle="Đang chuyển tiếp vào không gian Thư viện Sen Online tại Sen Ground..."
        />
      }
    >
      <NewLibraryRedirectInner />
    </Suspense>
  )
}
