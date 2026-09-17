'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import SebLogo from '@/components/SebLogo'
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Shield,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-body' })

export default function SebLoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'quick_code'>('login')
  const [accountInput, setAccountInput] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Mã dự thi 6 số
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Đảm bảo giao diện luôn áp dụng Light Mode phong cách trắng - xanh
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Tự động chuẩn hóa và gắn đuôi @gmail.com nếu thí sinh chỉ nhập tên người dùng
  const resolveEmail = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    if (trimmed.includes('@')) return trimmed.toLowerCase()
    return `${trimmed}@gmail.com`.toLowerCase()
  }

  // Đăng nhập bằng Google OAuth
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true)
      setErrorMsg('')

      if (typeof window === 'undefined') return
      const host = window.location.hostname
      const origin = window.location.origin
      const hostParts = host.split('.')
      const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : ''

      // Lưu cookie nhận diện SEB OAuth trên toàn bộ tên miền gốc (.senexam.me / .senexam.com)
      document.cookie = `auth_source=seb; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
      document.cookie = `auth_next=${encodeURIComponent('/seb-dashboard')}; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
      document.cookie = `seb_target=${encodeURIComponent(origin + '/seb-dashboard')}; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
      document.cookie = `seb_origin=${encodeURIComponent(origin)}; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
      document.cookie = `seb_login=1; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`

      // Lưu fallback vào localStorage
      try {
        localStorage.setItem('auth_source', 'seb')
        localStorage.setItem('auth_next', '/seb-dashboard')
        localStorage.setItem('seb_oauth_target', origin + '/seb-dashboard')
        localStorage.setItem('seb_oauth_origin', origin)
      } catch (e) {}

      const callbackUrl = `${origin}/auth/callback?source=seb&next=${encodeURIComponent('/seb-dashboard')}&from_seb=1&seb_origin=${encodeURIComponent(origin)}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đăng nhập bằng Google')
      setGoogleLoading(false)
    }
  }

  // Đăng nhập nhanh bằng Mã dự thi 6 số
  const handleQuickCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = examCode.trim().replace(/\s+/g, '')
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Vui lòng nhập chính xác 6 chữ số mã dự thi!')
      return
    }

    setCodeLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/seb/exam-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_and_login',
          code: cleanCode,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Mã dự thi không hợp lệ hoặc đã hết hạn!')
      }

      // Xác thực đăng nhập qua token hash nếu có
      if (data.tokenHash) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'magiclink',
        })
        if (vErr) {
          console.warn('Lỗi verifyOtp magiclink:', vErr)
        }
      } else if (data.actionLink) {
        window.location.href = data.actionLink
        return
      }

      // Kích hoạt hủy phiên các thiết bị khác khi đăng nhập qua mã thi
      if (data.userId) {
        await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
        await fetch('/api/seb/exam-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'enter_exam_and_terminate_others',
            userId: data.userId,
            examId: data.examId,
          }),
        }).catch(() => {})
      }

      setSuccessMsg('Đăng nhập thành công! Đang chuyển vào phòng thi an toàn...')
      setTimeout(() => {
        router.replace(data.examId ? `/seb-exam/${data.examId}` : '/seb-dashboard')
      }, 700)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xác thực mã thi')
    } finally {
      setCodeLoading(false)
    }
  }

  // Xử lý gửi Form Đăng nhập / Đăng ký / Quên mật khẩu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const email = resolveEmail(accountInput)
    if (!email) {
      setErrorMsg('Vui lòng nhập email hoặc tài khoản!')
      return
    }

    // 1. Chế độ Quên Mật Khẩu
    if (mode === 'forgot') {
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/seb-login?reset=1`,
        })
        if (error) throw error
        setSuccessMsg(`Đã gửi liên kết khôi phục mật khẩu tới ${email}. Vui lòng kiểm tra hộp thư!`)
      } catch (err: any) {
        setErrorMsg(err.message || 'Không thể gửi email khôi phục mật khẩu.')
      } finally {
        setLoading(false)
      }
      return
    }

    // 2. Chế độ Đăng Ký Tài Khoản
    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Vui lòng nhập họ và tên của bạn!')
        return
      }
      if (!password || password.length < 6) {
        setErrorMsg('Mật khẩu cần tối thiểu 6 ký tự!')
        return
      }
      if (password !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không trùng khớp!')
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })
        if (error) throw error

        if (data.user) {
          await ensureStudentProfile(data.user.id, fullName.trim())
        }

        setSuccessMsg('Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.')
        setMode('login')
      } catch (err: any) {
        setErrorMsg(err.message || 'Đăng ký tài khoản thất bại.')
      } finally {
        setLoading(false)
      }
      return
    }

    // 3. Chế độ Đăng Nhập
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu!')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      if (data.user) {
        await ensureStudentProfile(data.user.id)
      }

      router.push('/seb-dashboard')
    } catch (err: any) {
      setErrorMsg(err.message || 'Tài khoản hoặc mật khẩu không chính xác.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`min-h-screen w-full bg-gradient-to-br from-slate-50 via-sky-50/50 to-blue-50/60 flex flex-col justify-between text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-seb-body)' }}
    >
      {/* Top Navigation Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-sky-100/80 bg-white/70 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <SebLogo size={38} showText={true} />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <ShieldCheck className="h-4 w-4 text-sky-600" />
          <span className="hidden sm:inline">Môi Trường Khảo Thí An Toàn SEB</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-sky-100 shadow-xl shadow-sky-500/5 p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
          {/* Decorative Glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-6 relative">
            <div className="inline-flex p-3 rounded-2xl bg-sky-50 border border-sky-100 mb-3 shadow-xs">
              <SebLogo size={44} showText={false} />
            </div>
            <h1
              className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: 'var(--font-seb-heading)' }}
            >
              {mode === 'login'
                ? 'Đăng Nhập Khảo Thí'
                : mode === 'signup'
                ? 'Đăng Ký Tài Khoản Thi'
                : mode === 'quick_code'
                ? 'Vào Thi Bằng Mã 6 Số'
                : 'Khôi Phục Mật Khẩu'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {mode === 'login'
                ? 'Hệ thống thi cử trực tuyến tích hợp Safe Exam Browser'
                : mode === 'signup'
                ? 'Tạo tài khoản nhanh chóng để tham gia các kỳ thi trực tuyến'
                : mode === 'quick_code'
                ? 'Nhập mã dự thi 6 số được cấp trên dashboard để đăng nhập tức thì'
                : 'Nhập email hoặc tài khoản để nhận liên kết đặt lại mật khẩu'}
            </p>
          </div>

          {/* Tab Switcher: Login / Quick Code / Signup */}
          {mode !== 'forgot' && (
            <div className="flex rounded-2xl bg-slate-100/90 p-1 mb-6 border border-slate-200/60 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  mode === 'login'
                    ? 'bg-white text-sky-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('quick_code')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1 ${
                  mode === 'quick_code'
                    ? 'bg-white text-sky-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <KeyRound className="h-3 w-3" />
                <span>Mã 6 Số</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className={`flex-1 py-2 rounded-xl transition ${
                  mode === 'signup'
                    ? 'bg-white text-sky-700 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Đăng Ký
              </button>
            </div>
          )}

          {/* Error & Success Alerts */}
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Chế độ 1: Đăng nhập nhanh bằng Mã Dự Thi 6 Số */}
          {mode === 'quick_code' ? (
            <form onSubmit={handleQuickCodeLogin} className="space-y-4">
              <div className="space-y-2 text-center">
                <label className="text-xs font-bold text-slate-700 block">
                  Mã Dự Thi 6 Chữ Số Của Bạn
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.4em] text-3xl font-mono font-black py-3 px-4 rounded-2xl border-2 border-sky-300 bg-sky-50/40 text-sky-950 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 transition"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 font-medium">
                  Nhập mã 6 số xuất hiện khi bạn bấm chọn bài thi trên SEB Dashboard
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left text-[11px] text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Cơ chế bảo mật phòng thi:</span>
                </div>
                <p>
                  Đăng nhập qua mã 6 số sẽ tự động đồng bộ tài khoản thí sinh và chấm dứt phiên trên các thiết bị khác.
                </p>
              </div>

              <button
                type="submit"
                disabled={codeLoading || examCode.length !== 6}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {codeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang xác thực mã thi...</span>
                  </>
                ) : (
                  <>
                    <span>Vào Phòng Thi Ngay</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <>
              {/* Google Quick Sign-In */}
              {mode !== 'forgot' && (
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs hover:shadow-sm"
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
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
                    <span>Đăng nhập trực tiếp bằng Google</span>
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="bg-white px-2">Hoặc tiếp tục với email</span>
                    </div>
                  </div>
                </div>
              )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Input (Signup mode only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-sky-600" />
                  Họ và Tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  required
                />
              </div>
            )}

            {/* Account / Email Input with Auto @gmail.com completion */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-sky-600" />
                  Tài khoản / Email
                </label>
                {!accountInput.includes('@') && accountInput.trim().length > 0 && (
                  <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md">
                    Tự thêm: @gmail.com
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder="Nhập tên tài khoản hoặc email (vd: hoangbinhminh)"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                * Hỗ trợ mọi email (@gmail.com, trường học, cá nhân).
              </p>
            </div>

            {/* Password Input */}
            {mode !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-sky-600" />
                    Mật Khẩu
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                      className="text-[11px] font-bold text-sky-600 hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Signup mode only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                  Xác Nhận Mật Khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  required
                />
              </div>
            )}

            {/* Remember Me Toggle */}
            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'Vào Hệ Thống Thi'
                      : mode === 'signup'
                      ? 'Hoàn Tất Đăng Ký'
                      : 'Gửi Yêu Cầu Khôi Phục'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
          </>
          )}

          {/* Back to Login from Forgot Mode */}
          {mode === 'forgot' && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className="text-xs font-bold text-sky-600 hover:underline"
              >
                Quay lại màn hình đăng nhập
              </button>
            </div>
          )}

          {/* Security Info Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2.5 text-[11px] text-slate-400">
            <Shield className="h-4 w-4 text-sky-500 shrink-0" />
            <span>Kỳ thi bảo mật cao kết hợp Safe Exam Browser chống mở tài liệu và gian lận.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-sky-100/60 bg-white/40">
        © 2026 Safe Exam Platform. Hệ thống khảo thí trực tuyến bảo mật cao.
      </footer>
    </div>
  )
}
