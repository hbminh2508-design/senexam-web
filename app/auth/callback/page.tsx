'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { Loader2, AlertCircle } from 'lucide-react'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true

    const processAuth = async () => {
      try {
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        const errorCode = searchParams.get('error_code')
        const next = searchParams.get('next') || '/dashboard'

        if (error || errorCode) {
          const detail = errorDescription || error || errorCode || 'Lỗi xác thực OAuth'
          if (active) {
            setErrorMsg(`Đăng nhập Google không thành công: ${detail}`)
          }
          // Redirect về trang đăng nhập sau 3s nếu có lỗi
          setTimeout(() => {
            if (active) {
              router.replace(`/new-sign?error=${encodeURIComponent(detail)}`)
            }
          }, 3000)
          return
        }

        // Kiểm tra session hiện tại (Supabase client tự động lấy token từ URL hash hoặc PKCE code)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        const handleRedirect = (currentUser: any) => {
          const userEmail = currentUser?.email?.toLowerCase() || ''
          const isVnu = userEmail.endsWith('@vnu.edu.vn')
          const isFepn =
            typeof window !== 'undefined' &&
            (window.location.hostname.startsWith('tsv.fepn.') || window.location.hostname.startsWith('fepn.'))

          if (isVnu || isFepn) {
            if (typeof window !== 'undefined') {
              if (window.location.hostname.startsWith('tsv.fepn.') || window.location.hostname.startsWith('fepn.')) {
                router.replace('/fepn-dashboard')
              } else if (window.location.hostname === 'localhost') {
                router.replace('/fepn-dashboard')
              } else {
                window.location.href = 'https://tsv.fepn.senexam.me/fepn-dashboard'
              }
              return
            }
          }
          router.replace(next)
        }

        if (session?.user) {
          await ensureStudentProfile(session.user.id)
          if (active) {
            handleRedirect(session.user)
          }
          return
        }

        // Lắng nghe sự kiện đăng nhập khi Supabase client hoàn thành xử lý background
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
            await ensureStudentProfile(newSession.user.id)
            if (active) {
              handleRedirect(newSession.user)
            }
          }
        })

        // Safety fallback timeout
        const timer = setTimeout(() => {
          if (active) {
            router.replace(next)
          }
        }, 3500)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timer)
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || 'Không thể thiết lập phiên đăng nhập.')
          setTimeout(() => router.replace('/new-sign'), 3000)
        }
      }
    }

    processAuth()

    return () => {
      active = false
    }
  }, [router, searchParams])

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl max-w-md w-full text-center">
      {errorMsg ? (
        <div className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="font-black text-lg text-rose-600 dark:text-rose-400">Đăng Nhập Thất Bại</h2>
          <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">{errorMsg}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-slate-400">Đang chuyển hướng về trang đăng nhập...</p>
        </div>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <div>
            <h2 className="font-black text-lg">Đang xác thực tài khoản Google...</h2>
            <p className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">Vui lòng chờ trong giây lát</p>
          </div>
        </>
      )}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100 p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-xl">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="font-bold text-sm">Đang tải...</span>
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
