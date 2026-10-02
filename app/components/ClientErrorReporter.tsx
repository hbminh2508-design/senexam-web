'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { CURRENT_APP_VERSION } from '@/lib/systemRelease'

const MAX_REPORTS_PER_SESSION = 20

// Bắt lỗi JS runtime + promise rejection chưa xử lý ở phía trình duyệt người dùng,
// gửi về bảng client_error_log để Admin xem trong tab "Cập nhật hệ thống" trước khi
// quyết định đẩy bản mới cho tất cả người dùng.
export default function ClientErrorReporter() {
  useEffect(() => {
    let reportCount = 0

    const report = (message: string, stack?: string) => {
      if (reportCount >= MAX_REPORTS_PER_SESSION) return
      reportCount++
      try {
        supabase.auth.getSession().then((sessionRes) => {
          const userId = sessionRes?.data?.session?.user?.id ?? null
          supabase.from('client_error_log').insert({
            user_id: userId,
            message: String(message || 'Unknown error').slice(0, 2000),
            stack: stack ? String(stack).slice(0, 4000) : null,
            url: typeof window !== 'undefined' ? window.location.href : '',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            app_version: CURRENT_APP_VERSION,
          }).then(() => {}, () => {})
        }).catch(() => {})
      } catch {}
    }

    const handleError = (event: ErrorEvent) => {
      report(event.message || 'Unknown error', event.error?.stack)
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason?.message || String(reason)
      // Bỏ qua lỗi refresh-token đã được lib/supabaseClient.ts tự xử lý riêng
      if (message.includes('Refresh Token Not Found') || message.includes('Invalid Refresh Token')) return
      report(message, reason?.stack)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
