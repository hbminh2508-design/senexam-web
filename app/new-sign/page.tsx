'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Zap,
  GraduationCap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Sun,
  Moon,
  Send,
  HelpCircle,
} from 'lucide-react'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, hexToRgba, getAccentHex } from '@/app/components/modernTheme'
import { signInWithGoogle } from '@/lib/authHelper'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newsign-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newsign-body' })

export default function NewSignPage() {
  const router = useRouter()
  const { themeColor, animationsEnabled } = useNewUiPrefs()

  const [mode, setMode] = useState<'login' | 'signup' | 'magic-link'>('login')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isDark, setIsDark] = useState(false)

  // Form Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Trạng thái chờ xác nhận email thật
  const [verificationPending, setVerificationPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Hướng dẫn Supabase Google Provider
  const [showGoogleGuide, setShowGoogleGuide] = useState(false)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    // Đọc lỗi từ query params nếu có (ví dụ khi callback OAuth trả về lỗi)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error_description') || params.get('error')
      if (err) {
        setErrorMsg(err.includes('bad_oauth_state') || err.includes('OAuth state')
          ? 'Phiên đăng nhập Google đã hết hạn hoặc bị gián đoạn. Vui lòng nhấn nút Google bên dưới để thử lại.'
          : decodeURIComponent(err))
      }
    }
  }, [])

  // Đếm ngược gửi lại email
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Đăng nhập / Đăng ký bằng Google OAuth
  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setErrorMsg('')
    try {
      await signInWithGoogle('/new-dashboard')
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('provider is not enabled')
          ? 'Google OAuth chưa được kích hoạt trên Supabase. Xem hướng dẫn bên dưới để bật.'
          : err.message || 'Đăng nhập Google thất bại.'
      )
      setGoogleLoading(false)
    }
  }

  // Xử lý gửi Form chính
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/new-dashboard` : undefined

      if (mode === 'login') {
        // ĐĂNG NHẬP
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        if (data.user) {
          await ensureStudentProfile(data.user.id)
        }
        router.push('/new-dashboard')
      } else if (mode === 'signup') {
        // ĐĂNG KÝ
        if (!fullName.trim()) {
          throw new Error('Vui lòng nhập họ và tên của bạn.')
        }
        if (password.length < 6) {
          throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự.')
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: redirectUrl,
          },
        })

        if (error) throw error

        if (data.user) {
          await ensureStudentProfile(data.user.id)
          // Cập nhật họ tên vào profiles nếu có
          if (fullName.trim()) {
            await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', data.user.id)
          }
        }

        // Kiểm tra xem hệ thống có yêu cầu xác thực email không
        if (data.user && !data.session) {
          // Cần xác nhận email
          setVerificationPending(true)
          setPendingEmail(email.trim())
          setResendCooldown(60)
        } else {
          // Tự động đăng nhập được luôn
          router.push('/new-dashboard')
        }
      } else if (mode === 'magic-link') {
        // ĐĂNG NHẬP QUA MAGIC LINK / EMAIL
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
        setSuccessMsg('Liên kết đăng nhập bảo mật đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư!')
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setErrorMsg('Email hoặc mật khẩu không chính xác. Vui lòng thử lại.')
      } else if (err.message?.includes('User already registered')) {
        setErrorMsg('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.')
      } else {
        setErrorMsg(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Gửi lại email xác nhận
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !pendingEmail) return
    setResendLoading(true)
    setErrorMsg('')
    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/new-dashboard` : undefined
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })
      if (error) throw error
      setSuccessMsg('Đã gửi lại email xác thực thành công!')
      setResendCooldown(60)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi lại email xác nhận.')
    } finally {
      setResendLoading(false)
    }
  }

  const vars = getModernThemeVars(themeColor, isDark)
  const accent = getAccentHex(themeColor, isDark)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden transition-colors duration-500 font-sans`}
      style={{
        ...vars,
        backgroundColor: isDark ? '#080C14' : '#F4F7FB',
        color: 'var(--text)',
      }}
    >
      {/* 🔮 ANIMATED BACKGROUND: Các khối cầu phát sáng chuyển động mượt mà 60fps */}
      <div className="bg-anim-container pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="anim-blob blob-1 fixed rounded-full blur-[90px] sm:blur-[120px] opacity-40 dark:opacity-25"
          style={{ backgroundColor: accent }}
        />
        <div
          className="anim-blob blob-2 fixed rounded-full blur-[100px] sm:blur-[140px] opacity-40 dark:opacity-25 bg-amber-400 dark:bg-amber-500"
        />
        <div
          className="anim-blob blob-3 fixed rounded-full blur-[90px] sm:blur-[130px] opacity-35 dark:opacity-20 bg-rose-500 dark:bg-rose-600"
        />
        <div
          className="anim-blob blob-4 fixed rounded-full blur-[110px] sm:blur-[150px] opacity-35 dark:opacity-20 bg-teal-400 dark:bg-teal-500"
        />

        {/* Lớp lưới tinh tế overlay */}
        <div
          className="fixed inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(var(--text) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top right quick controls: Dark Mode & Home */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur-xl transition hover:scale-105"
          title="Chuyển đổi Sáng/Tối"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </button>
        <Link
          href="/dashboard"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 px-3.5 py-2 text-xs font-bold shadow-sm backdrop-blur-xl transition hover:scale-105"
        >
          Dashboard cũ
        </Link>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[500px] flex flex-col items-center">
        
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur-xl">
            <Sparkles className="w-4 h-4 text-amber-500" /> Nền Tảng Luyện Thi SenExam 2026
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-newsign-heading)' }}
          >
            SenExam<span style={{ color: accent }}>.ME</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 max-w-sm mx-auto" style={{ fontFamily: 'var(--font-newsign-body)' }}>
            Hệ thống khảo thí thông minh — Hành trang toàn diện chinh phục THPTQG, HSA & TSA.
          </p>
        </div>

        {/* Card Form */}
        <div className="w-full rounded-[32px] border border-black/10 dark:border-white/15 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300">
          
          {/* MÀN HÌNH CHỜ XÁC NHẬN EMAIL (NẾU CÓ) */}
          {verificationPending ? (
            <div className="text-center space-y-5 py-4 animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-md">
                <Mail className="h-8 w-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newsign-heading)' }}>
                  Xác Thực Email Của Bạn
                </h2>
                <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  Chúng tôi đã gửi một liên kết xác thực tới hòm thư <strong>{pendingEmail}</strong>. Vui lòng mở email và nhấn xác nhận để kích hoạt tài khoản!
                </p>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {successMsg}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {errorMsg}
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resendLoading || resendCooldown > 0}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-black/15 dark:border-white/20 bg-white/80 dark:bg-slate-800/80 py-3 text-xs font-bold transition hover:bg-black/5 disabled:opacity-50"
                >
                  {resendLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại email xác nhận'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerificationPending(false)
                    setMode('login')
                  }}
                  className="text-xs font-bold text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white transition"
                >
                  ← Trở về màn hình Đăng nhập
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Switcher: Đăng Nhập / Đăng Ký / Magic Link */}
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-black/5 dark:bg-white/5 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-800 text-[#1A1A1A] dark:text-white shadow-sm'
                      : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-slate-800 text-[#1A1A1A] dark:text-white shadow-sm'
                      : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Đăng Ký Mới
                </button>
              </div>

              {/* NÚT GOOGLE AUTH 1-CHẠM */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 py-3.5 px-4 text-sm font-bold text-[#1A1A1A] dark:text-white shadow-sm transition hover:scale-[1.01] hover:shadow-md active:scale-[0.99] disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {/* Official Google Icon */}
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{mode === 'signup' ? 'Đăng ký nhanh với Google' : 'Tiếp tục với Google'}</span>
                  </>
                )}
              </button>

              {/* Đường kẻ phân cách */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="w-full border-t border-black/10 dark:border-white/10" />
                <span className="absolute bg-white/90 dark:bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                  Hoặc bằng Email
                </span>
              </div>

              {/* FORM NHẬP LIỆU */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Họ và tên (chỉ hiện khi đăng ký) */}
                {mode === 'signup' && (
                  <div className="relative group animate-in fade-in slide-in-from-top-2">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-slate-400 group-focus-within:text-amber-500" />
                    <input
                      type="text"
                      placeholder="Họ và tên của bạn"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                )}

                {/* Email */}
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-slate-400 group-focus-within:text-amber-500" />
                  <input
                    type="email"
                    placeholder="Địa chỉ Email chính xác"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                {/* Mật khẩu (ẩn khi dùng Magic Link) */}
                {mode !== 'magic-link' && (
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-slate-400 group-focus-within:text-amber-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Mật khẩu bảo mật (tối thiểu 6 ký tự)' : 'Mật khẩu của bạn'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-11 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}

                {/* Thông báo lỗi / thành công */}
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-start gap-2 animate-in fade-in zoom-in-95">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-start gap-2 animate-in fade-in zoom-in-95">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Nút Submit chính */}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-3.5 px-4 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] hover:opacity-95 active:scale-[0.99] disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login' ? 'Đăng Nhập Ngay' : mode === 'signup' ? 'Tạo Tài Khoản' : 'Gửi Mã Xác Thực'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Extra Links: Magic Link / Quên mật khẩu */}
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#6B7280] dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'magic-link' ? 'login' : 'magic-link')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className="hover:text-black dark:hover:text-white transition underline"
                >
                  {mode === 'magic-link' ? 'Dùng mật khẩu thông thường' : 'Đăng nhập không cần mật khẩu'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                  className="flex items-center gap-1 hover:text-black dark:hover:text-white transition"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> Trợ giúp
                </button>
              </div>

              {/* Hướng Dẫn Supabase Google Provider (khi cần) */}
              {showGoogleGuide && (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-[#4B5563] dark:text-slate-300 space-y-2 animate-in fade-in zoom-in-95">
                  <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-500" /> Cấu hình Google Auth trên Supabase:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                    <li>Vào <strong>Google Cloud Console</strong> → Tạo OAuth Client ID.</li>
                    <li>Điền Redirect URI: <code className="rounded bg-black/5 dark:bg-white/10 px-1 font-mono">https://&lt;ref&gt;.supabase.co/auth/v1/callback</code>.</li>
                    <li>Vào <strong>Supabase Dashboard</strong> → Auth → Providers → Bật Google.</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Features */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#6B7280] dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ngân hàng đề thi 2026
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Chấm điểm tức thì
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Trợ lý SenAI Studio
          </span>
        </div>
      </div>

      {/* 🌟 CSS ANIMATIONS KEYFRAMES */}
      <style jsx>{`
        .bg-anim-container {
          perspective: 1000px;
        }

        .anim-blob {
          will-change: transform;
        }

        .blob-1 {
          width: 550px;
          height: 550px;
          top: -15%;
          left: -10%;
          animation: float-1 18s ease-in-out infinite alternate;
        }

        .blob-2 {
          width: 480px;
          height: 480px;
          bottom: -15%;
          right: -10%;
          animation: float-2 22s ease-in-out infinite alternate;
        }

        .blob-3 {
          width: 400px;
          height: 400px;
          top: 40%;
          left: 60%;
          animation: float-3 16s ease-in-out infinite alternate;
        }

        .blob-4 {
          width: 420px;
          height: 420px;
          bottom: 20%;
          left: -10%;
          animation: float-4 20s ease-in-out infinite alternate;
        }

        @keyframes float-1 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(80px, 60px) scale(1.15) rotate(20deg);
          }
          100% {
            transform: translate(-40px, 120px) scale(0.9) rotate(-15deg);
          }
        }

        @keyframes float-2 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(-100px, -80px) scale(1.2) rotate(-25deg);
          }
          100% {
            transform: translate(50px, -40px) scale(0.95) rotate(15deg);
          }
        }

        @keyframes float-3 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(-80px, 70px) scale(1.1) rotate(30deg);
          }
          100% {
            transform: translate(60px, -60px) scale(0.85) rotate(-20deg);
          }
        }

        @keyframes float-4 {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(90px, -50px) scale(1.1) rotate(-15deg);
          }
          100% {
            transform: translate(-50px, -90px) scale(0.95) rotate(25deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-blob {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
