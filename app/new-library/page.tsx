'use client'

import { Suspense } from 'react'
import ModernLoading from '@/app/components/ModernLoading'
import LibraryClient from './LibraryClient'

export default function NewLibraryPage() {
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
