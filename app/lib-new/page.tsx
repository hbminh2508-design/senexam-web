'use client'

import { Suspense } from 'react'
import ModernLoading from '@/app/components/ModernLoading'
import LibraryClient from '@/app/new-library/LibraryClient'

export default function LibNewRootPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="indigo"
          title="Thư Viện SenExam"
          subtitle="Đang tải dữ liệu thư viện từ máy chủ..."
        />
      }
    >
      <LibraryClient />
    </Suspense>
  )
}
