'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { isDomainEmail } from '@/lib/authHelper'
import { Loader2, AlertCircle } from 'lucide-react'

const getCookie = (name: string): string => {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '')
  return ''
}

const clearDomainCookie = (name: string) => {
  if (typeof document === 'undefined') return
  const host = window.location.hostname
  const hostParts = host.split('.')
  const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
  document.cookie = `${name}=; domain=.${rootDomain}; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

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

        const isSebSource =
          searchParams.get('from_seb') === '1' ||
          Boolean(searchParams.get('seb_origin')) ||
          Boolean(getCookie('seb_login')) ||
          Boolean(getCookie('seb_target')) ||
          (typeof window !== 'undefined' &&
            (window.location.hostname.startsWith('seb.') ||
              window.location.hostname.startsWith('thicu.') ||
              window.location.hostname.includes('seb.thicu.tailieufepn.')))

        if (error || errorCode) {
          const detail = errorDescription || error || errorCode || 'Lỗi xác thực OAuth'
          if (active) {
            setErrorMsg(`Đăng nhập Google không thành công: ${detail}`)
          }
          const failRedirect = isSebSource ? '/seb-login' : '/new-sign'
          setTimeout(() => {
            if (active) {
              router.replace(`${failRedirect}?error=${encodeURIComponent(detail)}`)
            }
          }, 3000)
          return
        }

        // Kiểm tra session hiện tại (Supabase client tự động lấy token từ URL hash hoặc PKCE code)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        const handleRedirect = (currentUser: any) => {
          // 1. ƯU TIÊN SỐ 1: Chuyển hướng về Hệ thống thi cử SEB nếu đăng nhập từ SEB
          const fromSebParam = searchParams.get('from_seb') === '1'
          const sebOriginParam = searchParams.get('seb_origin')
          const sebTargetCookie = getCookie('seb_target')
          const sebOriginCookie = getCookie('seb_origin')
          const sebLoginCookie = getCookie('seb_login')
          const sebStorageTarget = typeof window !== 'undefined' ? localStorage.getItem('seb_oauth_target') : null
          const isSebHost =
            typeof window !== 'undefined' &&
            (window.location.hostname.startsWith('seb.') ||
              window.location.hostname.startsWith('thicu.') ||
              window.location.hostname.includes('seb.thicu.tailieufepn.'))

          const isSebFlow =
            fromSebParam ||
            Boolean(sebOriginParam) ||
            Boolean(sebTargetCookie) ||
            Boolean(sebOriginCookie) ||
            sebLoginCookie === '1' ||
            Boolean(sebStorageTarget) ||
            isSebHost ||
            next.includes('seb-')

          if (isSebFlow) {
            clearDomainCookie('seb_target')
            clearDomainCookie('seb_origin')
            clearDomainCookie('seb_login')
            try {
              localStorage.removeItem('seb_oauth_target')
              localStorage.removeItem('seb_oauth_origin')
            } catch (e) {}

            let sebDestination = ''
            if (sebTargetCookie && sebTargetCookie.startsWith('http')) {
              sebDestination = sebTargetCookie
            } else if (sebStorageTarget && sebStorageTarget.startsWith('http')) {
              sebDestination = sebStorageTarget
            } else if (sebOriginParam) {
              sebDestination = `${decodeURIComponent(sebOriginParam)}/seb-dashboard`
            } else if (sebOriginCookie) {
              sebDestination = `${sebOriginCookie}/seb-dashboard`
            } else if (isSebHost) {
              sebDestination = '/seb-dashboard'
            } else {
              const host = window.location.hostname
              const hostParts = host.split('.')
              const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
              const protocol = window.location.protocol
              sebDestination = `${protocol}//seb.thicu.tailieufepn.${rootDomain}/seb-dashboard`
            }

            if (sebDestination.startsWith('http')) {
              window.location.href = sebDestination
            } else {
              router.replace(sebDestination)
            }
            return
          }

          // 2. Chuyển hướng FEPN
          const userEmail = currentUser?.email?.toLowerCase() || ''
          const isVnu = userEmail.endsWith('@vnu.edu.vn') || isDomainEmail(userEmail, currentUser)
          const isFepn =
            typeof window !== 'undefined' &&
            (window.location.hostname.startsWith('tsv.fepn.') ||
              window.location.hostname.startsWith('fepn.') ||
              next.includes('fepn'))

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

          // 3. Mặc định SenExam
          if (next.startsWith('http')) {
            window.location.href = next
          } else {
            router.replace(next)
          }
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
            if (next.startsWith('http')) {
              window.location.href = next
            } else {
              router.replace(next)
            }
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
