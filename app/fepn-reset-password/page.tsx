'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
  ShieldCheck,
  GraduationCap,
  ArrowLeft,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export default function FepnResetPasswordPage() {
  const router = useRouter()
  const isDark = false

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Đảm bảo Light mode & tiêu đề FEPN
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (typeof document !== 'undefined') {
      document.title = 'Tài liệu FEPN - Đặt Lại Mật Khẩu'
      const iconSelectors = ["link[rel*='icon']", "link[rel='shortcut icon']", "link[rel='apple-touch-icon']"]
      let updated = false
      iconSelectors.forEach((sel) => {
        document.querySelectorAll<HTMLLinkElement>(sel).forEach((el) => {
          el.href = '/fepn-logo.png'
          updated = true
        })
      })
      if (!updated) {
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.href = '/fepn-logo.png'
        document.head.appendChild(newLink)
      }
    }
  }, [])

  // Kiểm tra độ mạnh mật khẩu theo tiêu chuẩn FEPN: 8 ký tự, 1 hoa, 1 ký tự đặc biệt, 1 số
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const isPasswordValid = hasMinLength && hasUppercase && hasSpecialChar && hasDigit

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!isPasswordValid) {
      setErrorMsg('Mật khẩu mới chưa đạt tiêu chuẩn: Tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại!')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccessMsg('🎉 Đặt lại mật khẩu thành công! Đang chuyển hướng bạn về màn hình Đăng nhập...')
      setTimeout(() => {
        router.push('/fepn-login')
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn hoặc không hợp lệ.')
    } finally {
      setLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', false)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50/40 to-slate-100 text-slate-900`}
      style={{
        ...themeVars,
      }}
    >
      {/* Hiệu ứng nền nhẹ nhàng */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-300/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        
        {/* LOGO & BRANDING FEPN */}
        <div className="text-center space-y-3">
          <div className="mx-auto relative h-20 w-20 overflow-hidden rounded-2xl border border-sky-200 bg-white p-1 shadow-md shadow-sky-500/10">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 border border-sky-200 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-800">
              <GraduationCap className="h-3.5 w-3.5 text-sky-600" /> FEPN • UET • VNU
            </div>
            <h1
              className="mt-2 text-2xl sm:text-3xl font-black text-slate-900"
              style={{ fontFamily: 'var(--font-fepn-heading)' }}
            >
              Đặt Lại Mật Khẩu
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Thiết lập mật khẩu mới cho tài khoản sinh viên FEPN (@vnu.edu.vn)
            </p>
          </div>
        </div>

        {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-600 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-700 flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* BIỂU MẪU ĐẶT LẠI MẬT KHẨU */}
        <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700">Mật khẩu mới:</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu mới"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-800 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Checklist độ an toàn mật khẩu */}
            <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Yêu cầu độ bảo mật mật khẩu:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 font-bold transition ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasMinLength ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>Tối thiểu 8 ký tự</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasUppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasUppercase ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 chữ hoa (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasSpecialChar ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasSpecialChar ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 ký tự đặc biệt (@#$)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasDigit ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasDigit ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 chữ số (0-9)</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700">Xác nhận mật khẩu mới:</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <span>Xác Nhận Đổi Mật Khẩu</span>
          </button>
        </form>

        <div className="pt-2 text-center">
          <Link
            href="/fepn-login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại màn hình Đăng nhập</span>
          </Link>
        </div>

      </div>
    </main>
  )
}
