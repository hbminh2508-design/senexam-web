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
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
  if (!isIp && host !== 'localhost') {
    document.cookie = `${name}=; domain=.${rootDomain}; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
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
        const sourceParam = searchParams.get('source')
        const fromSebParam = searchParams.get('from_seb') === '1'
        const sebOriginParam = searchParams.get('seb_origin')
        const rawNext = searchParams.get('next')

        const authSourceCookie = getCookie('auth_source')
        const authNextCookie = getCookie('auth_next')
        const sebTargetCookie = getCookie('seb_target')
        const sebOriginCookie = getCookie('seb_origin')
        const sebLoginCookie = getCookie('seb_login')

        let storageSource: string | null = null
        let storageNext: string | null = null
        let sebStorageTarget: string | null = null
        try {
          storageSource = localStorage.getItem('auth_source')
          storageNext = localStorage.getItem('auth_next')
          sebStorageTarget = localStorage.getItem('seb_oauth_target')
        } catch (e) {}

        const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
        const isSebHost =
          currentHost.startsWith('seb.') ||
          currentHost.startsWith('thicu.') ||
          currentHost.includes('seb.thicu.tailieufepn.')

        const isFepnHost =
          currentHost.startsWith('tsv.fepn.') ||
          currentHost.startsWith('fepn.')

        // 1. Phân loại luồng SEB
        const isSebFlow =
          sourceParam === 'seb' ||
          fromSebParam ||
          Boolean(sebOriginParam) ||
          authSourceCookie === 'seb' ||
          storageSource === 'seb' ||
          Boolean(sebTargetCookie) ||
          Boolean(sebOriginCookie) ||
          sebLoginCookie === '1' ||
          Boolean(sebStorageTarget) ||
          isSebHost ||
          Boolean(rawNext && rawNext.includes('seb-')) ||
          Boolean(authNextCookie && authNextCookie.includes('seb-'))

        // 2. Phân loại luồng FEPN
        const isFepnFlow =
          !isSebFlow &&
          (sourceParam === 'fepn' ||
            authSourceCookie === 'fepn' ||
            storageSource === 'fepn' ||
            isFepnHost ||
            Boolean(rawNext && rawNext.includes('fepn')) ||
            Boolean(authNextCookie && authNextCookie.includes('fepn')))

        if (error || errorCode) {
          const detail = errorDescription || error || errorCode || 'Lỗi xác thực OAuth'
          if (active) {
            setErrorMsg(`Đăng nhập Google không thành công: ${detail}`)
          }
          const failRedirect = isSebFlow ? '/new-idp?service=seb' : isFepnFlow ? '/fepn-login' : '/new-idp'
          setTimeout(() => {
            if (active) {
              const separator = failRedirect.includes('?') ? '&' : '?'
              router.replace(`${failRedirect}${separator}error=${encodeURIComponent(detail)}`)
            }
          }, 3000)
          return
        }

        // 1. Nếu có authorization code (PKCE flow từ Supabase OAuth), đổi session ngay
        const code = searchParams.get('code')
        let session: any = null

        if (code) {
          try {
            const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
            if (!codeErr && codeData?.session) {
              session = codeData.session
            }
          } catch (cErr) {
            console.warn('exchangeCodeForSession error:', cErr)
          }
        }

        // Hỗ trợ Direct Google OAuth từ Azure (nếu có id_token)
        const googleIdToken = searchParams.get('google_id_token')
        const tokenHash = searchParams.get('token_hash')
        const emailOtp = searchParams.get('email_otp')
        const emailParam = searchParams.get('email')

        let lastAuthError = ''

        if (!session && googleIdToken) {
          try {
            const { data: idTokenData, error: idTokenErr } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: googleIdToken,
            })
            if (idTokenErr) {
              console.warn('signInWithIdToken error:', idTokenErr)
              lastAuthError = idTokenErr.message
            } else if (idTokenData?.session) {
              session = idTokenData.session
            }
          } catch (e: any) {
            console.warn('signInWithIdToken catch:', e)
            lastAuthError = e?.message || String(e)
          }
        }

        if (!session && tokenHash) {
          try {
            const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'magiclink',
            })
            if (!otpErr && otpData?.session) {
              session = otpData.session
            } else if (otpErr) {
              lastAuthError = otpErr.message
            }
          } catch (e: any) {
            console.warn('verifyOtp tokenHash error:', e)
            lastAuthError = e?.message || String(e)
          }
        }

        if (!session && emailOtp && emailParam) {
          try {
            const { data: emailData, error: emailErr } = await supabase.auth.verifyOtp({
              email: emailParam,
              token: emailOtp,
              type: 'email',
            })
            if (!emailErr && emailData?.session) {
              session = emailData.session
            } else if (emailErr) {
              lastAuthError = emailErr.message
            }
          } catch (e: any) {
            console.warn('verifyOtp email error:', e)
            lastAuthError = e?.message || String(e)
          }
        }

        // Kiểm tra session hiện tại từ Supabase client (cookie / URL hash / localStorage)
        if (!session) {
          const sessionRes = await supabase.auth.getSession().catch(() => null)
          session = sessionRes?.data?.session || null
        }

        const handleRedirect = (currentUser: any) => {
          // Dọn dẹp cookie và storage tạm thời
          clearDomainCookie('auth_source')
          clearDomainCookie('auth_next')
          clearDomainCookie('seb_target')
          clearDomainCookie('seb_origin')
          clearDomainCookie('seb_login')
          try {
            localStorage.removeItem('auth_source')
            localStorage.removeItem('auth_next')
            localStorage.removeItem('seb_oauth_target')
            localStorage.removeItem('seb_oauth_origin')
          } catch (e) {}

          // 1. ƯU TIÊN SỐ 1: Chuyển hướng về Hệ thống thi cử SEB nếu đăng nhập từ SEB
          if (isSebFlow) {
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
              if (host === 'localhost') {
                sebDestination = '/seb-dashboard'
              } else {
                const hostParts = host.split('.')
                const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
                const protocol = window.location.protocol
                sebDestination = `${protocol}//seb.thicu.tailieufepn.${rootDomain}/seb-dashboard`
              }
            }

            if (sebDestination.startsWith('http')) {
              window.location.href = sebDestination
            } else {
              router.replace(sebDestination)
            }
            return
          }

          // 2. Chuyển hướng FEPN: Khi đăng nhập từ FEPN hoặc tài khoản có email VNU (@vnu.edu.vn)
          const userEmail = currentUser?.email?.toLowerCase() || ''
          const isVnu =
            userEmail.endsWith('@vnu.edu.vn') ||
            userEmail.endsWith('.vnu.edu.vn') ||
            isDomainEmail(userEmail, currentUser)

          if (isFepnFlow || isVnu) {
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

          // 3. Mặc định SenExam (New-Sign): Luôn đưa về /new-dashboard (hoặc đường dẫn cụ thể nếu có)
          const destination =
            rawNext && rawNext !== '/dashboard' && !rawNext.includes('fepn')
              ? rawNext
              : authNextCookie && authNextCookie !== '/dashboard' && !authNextCookie.includes('fepn')
              ? authNextCookie
              : storageNext && storageNext !== '/dashboard' && !storageNext.includes('fepn')
              ? storageNext
              : '/new-dashboard'

          if (destination.startsWith('http')) {
            window.location.href = destination
          } else {
            router.replace(destination)
          }
        }

        if (session?.user) {
          try {
            await ensureStudentProfile(session.user.id)
          } catch {}
          if (active) {
            handleRedirect(session.user)
          }
          return
        }

        // Nếu có lỗi xác thực từ trước hoặc không lấy được session
        if (lastAuthError) {
          if (active) {
            setErrorMsg(`Lỗi kết nối cơ sở dữ liệu: ${lastAuthError}. Vui lòng kiểm tra dự án trên Supabase Dashboard (nếu đang ở trạng thái Paused, hãy bấm Restore).`)
          }
          return
        }

        // Lắng nghe sự kiện đăng nhập khi Supabase client hoàn thành xử lý background
        const authChangeRes = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
            try {
              await ensureStudentProfile(newSession.user.id)
            } catch {}
            if (active) {
              handleRedirect(newSession.user)
            }
          }
        })
        const subscription = authChangeRes?.data?.subscription

        // Safety fallback timeout
        const timer = setTimeout(() => {
          if (active) {
            if (isSebFlow) {
              router.replace('/seb-dashboard')
            } else if (isFepnFlow) {
              if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !isFepnHost) {
                window.location.href = 'https://tsv.fepn.senexam.me/fepn-dashboard'
              } else {
                router.replace('/fepn-dashboard')
              }
            } else {
              router.replace('/new-dashboard')
            }
          }
        }, 5000)

        return () => {
          try {
            subscription?.unsubscribe?.()
          } catch {}
          clearTimeout(timer)
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || 'Không thể thiết lập phiên đăng nhập.')
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
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="font-black text-lg text-rose-600 dark:text-rose-400">Xác Thực Chưa Hoàn Tất</h2>
          <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">{errorMsg}</p>
          <div className="pt-2">
            <button
              onClick={() => router.replace('/new-idp')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-900/20"
            >
              Quay lại trang Đăng nhập
            </button>
          </div>
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
