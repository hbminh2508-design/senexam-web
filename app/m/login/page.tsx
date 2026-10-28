'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { signInWithGoogle } from '@/lib/authHelper'
import ModernLoading from '@/app/components/ModernLoading'
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  QrCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

export default function MobileLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/m'

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function checkExistingUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          router.replace(returnUrl)
          return
        }
      } catch (e) {
        console.warn('Auth check error:', e)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkExistingUser()
  }, [router, returnUrl])

  const syncCrossDomainCookie = (session: any) => {
    if (typeof document === 'undefined' || !session) return
    try {
      const host = window.location.hostname
      const hostParts = host.split('.')
      const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
      const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
      const isLocal = host === 'localhost' || isIp
      const cookieDomain = isLocal ? '' : `; domain=.${rootDomain}`
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : ''
      const payload = encodeURIComponent(
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      )
      document.cookie = `sen_sb_session=${payload}${cookieDomain}; path=/; max-age=2592000${isSecure}; SameSite=Lax`
    } catch {}
  }

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true)
      setErrorMsg('')
      await signInWithGoogle(returnUrl)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối tài khoản Google')
      setGoogleLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      if (tab === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        if (data.session) {
          syncCrossDomainCookie(data.session)
        }
        setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...')
        router.replace(returnUrl)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || 'Sĩ Tử SenExam',
            },
          },
        })
        if (error) throw error
        if (data.session) {
          syncCrossDomainCookie(data.session)
          setSuccessMsg('Tạo tài khoản thành công! Đang chuyển hướng...')
          router.replace(returnUrl)
        } else {
          setSuccessMsg('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận kích hoạt tài khoản.')
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xác thực, vui lòng kiểm tra lại thông tin.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <ModernLoading
        title="SenExam Mobile IDP"
        subtitle="Đang kiểm tra phiên đăng nhập và bảo mật..."
      />
    )
  }

  return (
    <div className="flex-1 w-full p-5 flex flex-col justify-between animate-in fade-in pb-12">
      <div className="space-y-6 pt-6">
        {/* Logo & Welcome */}
        <div className="text-center space-y-3">
          <div className="w-18 h-18 mx-auto flex items-center justify-center p-2 rounded-3xl bg-sky-50 dark:bg-sky-950/50 border border-sky-100 dark:border-sky-900/50 shadow-inner">
            <img
              src="/logo.png"
              alt="SenExam Logo"
              className="w-full h-full object-contain drop-shadow-md select-none"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>SenExam Mobile</span>
              <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 text-[10px] font-black uppercase">
                IDP
              </span>
            </h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Đăng nhập để đồng bộ đề thi, điểm số và ví Cash Mobile từ hệ sinh thái PC.
            </p>
          </div>
        </div>

        {/* 1-Tap Google Login */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleSignIn}
            className="w-full h-12 rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm active:scale-98 transition flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Tiếp tục bằng tài khoản Google</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] uppercase font-bold text-slate-400">Hoặc Email</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg('') }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'login'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setErrorMsg(''); setSuccessMsg('') }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'signup'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tạo tài khoản
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {tab === 'signup' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="tenban@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-11.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs shadow-md shadow-sky-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <span>{tab === 'login' ? 'ĐĂNG NHẬP NGAY' : 'TẠO TÀI KHOẢN MỚI'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Full IDP & Help shortcuts */}
        <div className="pt-2 flex flex-col items-center gap-2 text-center">
          <Link
            href={`/new-idp?returnUrl=${encodeURIComponent(returnUrl)}`}
            className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Mở Cổng Đăng Nhập SenExam IDP Đầy Đủ (QR / Khôi phục)</span>
          </Link>
          <Link
            href="/new-reset-password"
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Quên mật khẩu?
          </Link>
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-400 font-mono pt-4 border-t border-slate-100 dark:border-slate-800">
        SenExam Mobile IDP v{MOBILE_VERSION}
      </div>
    </div>
  )
}
