'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { signInWithGoogle } from '@/lib/authHelper'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  KeyRound,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export default function FepnLoginPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  // Form states
  const [mssv, setMssv] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [isSubdomain, setIsSubdomain] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(savedTheme === 'dark' || (!savedTheme && prefersDark))

    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      setIsSubdomain(host.startsWith('tsv.fepn.') || host.startsWith('fepn.'))
    }
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

  // Chuẩn hóa email VNU từ MSSV nhập vào
  const getFullVnuEmail = (input: string) => {
    const clean = input.trim().toLowerCase()
    if (clean.includes('@')) {
      return clean
    }
    return `${clean}@vnu.edu.vn`
  }

  // Điểm đến sau khi đăng nhập thành công
  const getPostLoginDestination = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host.startsWith('tsv.fepn.') || host.startsWith('fepn.')) {
        return '/fepn-dashboard'
      }
      if (host === 'localhost') {
        return '/fepn-dashboard'
      }
      return 'https://tsv.fepn.senexam.me/fepn-dashboard'
    }
    return '/fepn-dashboard'
  }

  const navigateAfterLogin = () => {
    const dest = getPostLoginDestination()
    if (dest.startsWith('http')) {
      window.location.href = dest
    } else {
      router.push(dest)
    }
  }

  // Đăng nhập / Đăng ký bằng MSSV + Mật khẩu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!mssv.trim()) {
      setErrorMsg('Vui lòng nhập Mã số sinh viên (MSSV) của bạn.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải chứa ít nhất 6 ký tự.')
      return
    }

    const fullEmail = getFullVnuEmail(mssv)
    setLoading(true)

    try {
      if (mode === 'login') {
        // ĐĂNG NHẬP
        const { data, error } = await supabase.auth.signInWithPassword({
          email: fullEmail,
          password,
        })

        if (error) throw error

        if (data.user) {
          await ensureStudentProfile(data.user.id)
        }

        navigateAfterLogin()
      } else {
        // ĐĂNG KÝ
        if (!fullName.trim()) {
          throw new Error('Vui lòng nhập họ và tên của bạn.')
        }

        const { data, error } = await supabase.auth.signUp({
          email: fullEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              mssv: mssv.trim(),
            },
          },
        })

        if (error) throw error

        if (data.user) {
          await ensureStudentProfile(data.user.id)
          try {
            await supabase.from('profiles').update({
              full_name: fullName.trim(),
            }).eq('id', data.user.id)
          } catch {}
        }

        if (data.user && !data.session) {
          setSuccessMsg(
            `Đăng ký thành công! Một email xác nhận đã được gửi đến ${fullEmail}. Vui lòng kiểm tra hòm thư VNU của bạn.`
          )
        } else {
          navigateAfterLogin()
        }
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setErrorMsg('Mã số sinh viên hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!')
      } else if (err.message?.includes('User already registered')) {
        setErrorMsg('Tài khoản với MSSV này đã tồn tại. Vui lòng chuyển sang tab Đăng Nhập!')
      } else {
        setErrorMsg(err.message || 'Đã xảy ra lỗi khi xử lý. Vui lòng thử lại!')
      }
    } finally {
      setLoading(false)
    }
  }

  // Đăng nhập / Đăng ký bằng Google OAuth
  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setErrorMsg('')
    try {
      const dest = getPostLoginDestination()
      await signInWithGoogle(dest)
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập Google thất bại.')
      setGoogleLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors duration-500 font-sans relative overflow-hidden`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 15% 15%, rgba(2, 132, 199, 0.25), transparent 40%), radial-gradient(circle at 85% 85%, rgba(30, 58, 138, 0.35), transparent 50%), #070B14'
          : 'radial-gradient(circle at 15% 15%, rgba(224, 242, 254, 0.9), transparent 40%), radial-gradient(circle at 85% 85%, rgba(224, 231, 255, 0.9), transparent 50%), #F4F7FB',
      }}
    >
      {/* Nút đổi theme góc trên */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-md backdrop-blur-xl transition hover:scale-105"
          title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md rounded-3xl border border-sky-500/20 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        {/* LOGO & BRANDING FEPN */}
        <div className="text-center space-y-3">
          <div className="mx-auto relative h-20 w-20 overflow-hidden rounded-2xl border border-sky-500/30 bg-white p-1 shadow-lg">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
              <GraduationCap className="h-3.5 w-3.5" /> FEPN • UET • VNU
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              {mode === 'login' ? 'Đăng Nhập FEPN' : 'Đăng Ký Tài Khoản FEPN'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Khoa Vật lý kỹ thuật & Công nghệ Nano — ĐH Công nghệ
            </p>
          </div>
        </div>

        {/* TAB SWITCHER: ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="flex rounded-2xl bg-black/5 dark:bg-white/5 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setErrorMsg('')
              setSuccessMsg('')
            }}
            className={`w-1/2 py-2.5 rounded-xl transition font-black uppercase tracking-wider ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-500 hover:text-black dark:hover:text-white'
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
            className={`w-1/2 py-2.5 rounded-xl transition font-black uppercase tracking-wider ${
              mode === 'signup'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-500 hover:text-black dark:hover:text-white'
            }`}
          >
            Đăng Ký
          </button>
        </div>

        {/* ALERTS */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-600 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Họ tên (Chỉ hiện khi Đăng ký) */}
          {mode === 'signup' && (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Họ và tên sinh viên / cán bộ:
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="Ví dụ: Hoàng Bình Minh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-4 pr-4 py-3 outline-none font-bold text-xs focus:border-sky-500 transition"
                  required
                />
              </div>
            </div>
          )}

          {/* Ô Nhập MSSV với đuôi cố định @vnu.edu.vn */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Mã Số Sinh Viên (MSSV):</span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">Email VNU</span>
            </label>
            <div className="mt-1 flex items-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 overflow-hidden focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition">
              <input
                type="text"
                placeholder="Nhập MSSV (vd: 23020001)"
                value={mssv}
                onChange={(e) => {
                  let val = e.target.value.trim()
                  // Nếu dán cả email @vnu.edu.vn, tự động lọc lấy phần MSSV
                  if (val.includes('@vnu.edu.vn')) {
                    val = val.replace('@vnu.edu.vn', '')
                  }
                  setMssv(val)
                }}
                className="flex-1 bg-transparent px-4 py-3 outline-none font-mono font-bold text-xs"
                required
              />
              <span className="px-3 py-3 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-mono font-black text-xs border-l border-black/5 dark:border-white/10 select-none">
                @vnu.edu.vn
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Sinh viên chỉ cần điền đúng MSSV, hệ thống sẽ tự động ghép đuôi @vnu.edu.vn.
            </p>
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Mật khẩu:
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-4 pr-11 py-3 outline-none font-bold text-xs focus:border-sky-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-black dark:hover:text-white transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Nút Submit chính */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            <span>
              {mode === 'login' ? 'Đăng Nhập FEPN' : 'Đăng Ký Tài Khoản'}
            </span>
          </button>
        </form>

        {/* PHÂN CÁCH HOẶC */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-black/10 dark:border-white/10" />
          <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            HOẶC
          </span>
        </div>

        {/* NÚT ĐĂNG NHẬP / ĐĂNG KÝ BẰNG GOOGLE (Chữ: Đăng nhập với email VNU) */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 p-3 text-xs font-black shadow-sm transition hover:scale-[1.02] disabled:opacity-50 text-slate-700 dark:text-slate-200"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
          ) : (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
          <span>
            {mode === 'signup' ? 'Đăng ký với email VNU' : 'Đăng nhập với email VNU'}
          </span>
        </button>

        {/* FOOTER LINK */}
        <div className="text-center pt-2">
          <Link
            href="https://senexam.me"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-black dark:hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Về Cổng Thi Trắc Nghiệm SenExam
          </Link>
        </div>
      </div>
    </div>
  )
}
