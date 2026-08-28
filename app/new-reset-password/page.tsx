'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-reset-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-reset-body' })

export default function NewResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password.length < 6) {
      setErrorMsg('Mật khẩu mới phải chứa ít nhất 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu không khớp.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccessMsg('🎉 Đặt lại mật khẩu thành công! Đang chuyển hướng bạn tới Dashboard...')
      setTimeout(() => {
        router.push('/new-dashboard')
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.15), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(224, 231, 255, 0.6), transparent 30%), #F4F7FB',
      }}
    >
      {/* Dark Mode toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur-xl transition hover:scale-105"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur-xl">
            <Sparkles className="w-4 h-4 text-indigo-500" /> Bảo Mật Tài Khoản
          </div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-reset-heading)' }}>
            Thiết Lập Mật Khẩu Mới
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-slate-400">
            Nhập mật khẩu bảo mật mới cho tài khoản SenExam của bạn.
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/15 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-5">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {/* Mật khẩu mới */}
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-slate-400 group-focus-within:text-indigo-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-11 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 dark:focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="relative group">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-slate-400 group-focus-within:text-indigo-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>

            {/* Thông báo lỗi / thành công */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Lưu Mật Khẩu Mới
            </button>
          </form>

          <div className="text-center pt-2">
            <Link
              href="/new-sign"
              className="text-xs font-bold text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white"
            >
              ← Quay lại trang Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
