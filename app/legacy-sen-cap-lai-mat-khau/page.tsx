'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield,
  KeyRound,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  ChevronRight,
  GraduationCap,
  Lock,
} from 'lucide-react'
import { headingFont, bodyFont, getModernThemeVars } from '@/lib/fepnTheme'

type StepType = 'enter_mssv' | 'verify_authenticator' | 'verify_email_otp' | 'set_new_password' | 'success'

export default function SenCapLaiMatKhauPage() {
  const router = useRouter()

  // State quản lý luồng
  const [step, setStep] = useState<StepType>('enter_mssv')
  const [mssv, setMssv] = useState('')
  const [email, setEmail] = useState('')
  const [hasAuthenticator, setHasAuthenticator] = useState(false)

  // Mã xác thực
  const [authenticatorCode, setAuthenticatorCode] = useState('')
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Mật khẩu mới
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Trạng thái giao diện
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [mailProviderInfo, setMailProviderInfo] = useState('')
  const [previewOtpHint, setPreviewOtpHint] = useState('')

  // Đếm ngược gửi lại OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Kiểm tra tiêu chuẩn mật khẩu mới
  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)
  const hasDigit = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isPasswordValid = hasMinLength && hasUppercase && hasSpecialChar && hasDigit && passwordsMatch

  // =========================================================
  // BƯỚC 1: TRA CỨU TÀI KHOẢN THEO MSSV
  // =========================================================
  const handleCheckAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanMssv = mssv.trim().toLowerCase().replace(/@.*$/, '')
    if (!cleanMssv) {
      setErrorMsg('Vui lòng nhập Mã số sinh viên (MSSV) của bạn.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/fepn-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_method',
          mssv: cleanMssv,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tìm thấy tài khoản')
      }

      setEmail(data.email)
      setHasAuthenticator(!!data.hasAuthenticator)

      // Nếu tài khoản ĐÃ kích hoạt Authenticator -> Ưu tiên yêu cầu mã Authenticator trước!
      if (data.hasAuthenticator) {
        setStep('verify_authenticator')
        setSuccessMsg('Tài khoản đã bật bảo mật Authenticator. Vui lòng mở ứng dụng để lấy mã.')
      } else {
        // Chưa bật Authenticator -> Tự động gửi mã 8 số về email VNU
        await triggerSendEmailOtp(cleanMssv)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kiểm tra thông tin tài khoản')
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // BƯỚC 2A: XÁC MINH MÃ 6 SỐ AUTHENTICATOR
  // =========================================================
  const handleVerifyAuthenticator = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = authenticatorCode.trim().replace(/\D/g, '')
    if (cleanCode.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/fepn-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_authenticator',
          mssv,
          code: cleanCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Xác thực Authenticator thất bại')
      }

      setResetToken(data.resetToken)
      setStep('set_new_password')
      setSuccessMsg('Xác thực danh tính thành công! Hãy nhập mật khẩu mới.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã Authenticator không chính xác')
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // BƯỚC 2B: GỬI VÀ XÁC MINH MÃ 8 SỐ EMAIL VNU
  // =========================================================
  const triggerSendEmailOtp = async (targetMssv?: string) => {
    setErrorMsg('')
    setSuccessMsg('')
    const mssvToUse = targetMssv || mssv
    setLoading(true)
    try {
      const res = await fetch('/api/fepn-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email_otp',
          mssv: mssvToUse,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi mã xác nhận về email')
      }

      setEmail(data.email)
      setStep('verify_email_otp')
      setResendCooldown(60)
      setMailProviderInfo(data.provider || '')
      if (data.previewOtp) {
        setPreviewOtpHint(data.previewOtp)
      }
      setSuccessMsg(`Đã gửi mã xác nhận 8 chữ số đến ${data.email}. Vui lòng kiểm tra hộp thư.`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi gửi mã xác thực qua email')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = emailOtpCode.trim().replace(/\D/g, '')
    if (cleanCode.length !== 8) {
      setErrorMsg('Vui lòng nhập đủ 8 chữ số từ email VNU.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/fepn-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_email_otp',
          mssv,
          code: cleanCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Mã xác thực không hợp lệ')
      }

      setResetToken(data.resetToken)
      setStep('set_new_password')
      setSuccessMsg('Xác thực email VNU thành công! Hãy nhập mật khẩu mới.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã xác minh không chính xác')
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // BƯỚC 3: CẬP NHẬT MẬT KHẨU MỚI
  // =========================================================
  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!isPasswordValid) {
      setErrorMsg('Vui lòng đảm bảo mật khẩu mới đáp ứng đủ 4 tiêu chuẩn bảo mật và khớp nhau.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/fepn-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_new_password',
          mssv,
          resetToken,
          newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật mật khẩu mới')
      }

      setStep('success')
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cập nhật mật khẩu mới')
    } finally {
      setLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', false)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50/40 to-slate-100 text-slate-900`}
      style={{ ...themeVars }}
    >
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-300/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-300/25 blur-3xl pointer-events-none" />

      {/* Main Card Container */}
      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        
        {/* LOGO & BRANDING FEPN */}
        <div className="text-center space-y-3">
          <div className="mx-auto relative h-20 w-20 overflow-hidden rounded-2xl border border-sky-200 bg-white p-1 shadow-md shadow-sky-500/10">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 border border-sky-200 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-800">
              <GraduationCap className="h-3.5 w-3.5 text-sky-600" /> Cấp Lại Mật Khẩu • FEPN
            </div>
            <h1
              className="mt-2 text-2xl sm:text-3xl font-black text-slate-900"
              style={{ fontFamily: 'var(--font-fepn-heading)' }}
            >
              Khôi Phục Mật Khẩu
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Cổng xác thực danh tính sinh viên Khoa VLKT & CN Nano (UET - VNU)
            </p>
          </div>
        </div>

        {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-bold text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-bold text-emerald-700 flex items-start gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* GỢI Ý MÃ TEST TRONG MÔI TRƯỜNG DEV */}
        {previewOtpHint && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between">
            <div>
              <span className="font-bold">Mã xác thực nhanh (Dev Preview): </span>
              <span className="font-mono font-black text-sm tracking-widest text-amber-900">{previewOtpHint}</span>
            </div>
            <button
              type="button"
              onClick={() => setEmailOtpCode(previewOtpHint)}
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 transition"
            >
              Điền mã
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 1: NHẬP MSSV                                         */}
        {/* ======================================================== */}
        {step === 'enter_mssv' && (
          <form onSubmit={handleCheckAccount} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700">Mã số sinh viên (MSSV):</label>
              <div className="mt-1.5 flex items-center rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20 transition">
                <input
                  type="text"
                  placeholder="Nhập MSSV (ví dụ: 21020001)"
                  value={mssv}
                  onChange={(e) => setMssv(e.target.value.trim())}
                  className="flex-1 bg-transparent px-4 py-3.5 outline-none font-mono font-bold text-base sm:text-xs"
                  required
                  autoFocus
                />
                <span className="px-3.5 py-3.5 bg-sky-50 text-sky-700 font-mono font-black text-xs border-l border-slate-200 select-none">
                  @vnu.edu.vn
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Hệ thống sẽ kiểm tra phương thức bảo mật (Authenticator hoặc Email VNU) cho tài khoản này.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !mssv.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              <span>Tiếp Tục Xác Minh</span>
            </button>

            <div className="text-center pt-2">
              <Link
                href="/fepn-login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Quay lại trang Đăng nhập</span>
              </Link>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 2A: XÁC MINH BẰNG AUTHENTICATOR (ƯU TIÊN KHI ĐÃ CÓ)  */}
        {/* ======================================================== */}
        {step === 'verify_authenticator' && (
          <form onSubmit={handleVerifyAuthenticator} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-1">
              <div className="flex items-center gap-2 font-bold text-indigo-900">
                <Smartphone className="h-4 w-4 text-indigo-600" />
                <span>Xác thực qua ứng dụng Authenticator</span>
              </div>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Tài khoản <span className="font-mono font-bold">{email}</span> đã được bảo vệ bằng Ứng dụng Authenticator (Google Authenticator / Microsoft Authenticator).
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700">Mã bảo mật 6 chữ số:</label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="VD: 123456"
                  value={authenticatorCode}
                  onChange={(e) => setAuthenticatorCode(e.target.value.trim().replace(/\D/g, ''))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none font-mono text-center tracking-[0.4em] font-black text-xl focus:border-indigo-500 focus:bg-white transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || authenticatorCode.length !== 6}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-indigo-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              <span>Xác Nhận Mã Authenticator</span>
            </button>

            {/* NÚT QUAN TRỌNG: CHUYỂN SANG GỬI EMAIL VNU KHI KHÔNG CÓ AUTHENTICATOR */}
            <div className="pt-2 border-t border-slate-100 text-center space-y-2">
              <button
                type="button"
                onClick={() => triggerSendEmailOtp()}
                disabled={loading}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-sky-700 hover:text-sky-800 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4 text-sky-600" />
                <span>Không thể xác nhận bằng Authenticator?</span>
              </button>
              <p className="text-[11px] text-slate-400">
                Nhấn vào đây để nhận mã xác minh 8 số gửi trực tiếp về email VNU của bạn.
              </p>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_mssv')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Nhập lại MSSV khác</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 2B: XÁC MINH QUA MÃ 8 CHỮ SỐ EMAIL VNU              */}
        {/* ======================================================== */}
        {step === 'verify_email_otp' && (
          <form onSubmit={handleVerifyEmailOtp} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <Mail className="h-4 w-4 text-sky-600" />
                <span>Đã gửi mã xác nhận 8 số về Email VNU</span>
              </div>
              <p className="text-[11px] text-sky-700 leading-relaxed">
                Hệ thống FEPN đã gửi mã xác thực 8 chữ số đến hòm thư:{' '}
                <span className="font-mono font-black text-sky-800">{email}</span>.
              </p>
              {mailProviderInfo && (
                <p className="text-[10px] text-sky-600 font-mono">Kênh phát: {mailProviderInfo}</p>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700">Mã xác thực 8 chữ số (Email VNU):</label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="VD: 12345678"
                  value={emailOtpCode}
                  onChange={(e) => setEmailOtpCode(e.target.value.trim().replace(/\D/g, ''))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 outline-none font-mono text-center tracking-[0.35em] font-black text-xl focus:border-sky-500 focus:bg-white transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || emailOtpCode.length !== 8}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Xác Nhận Mã 8 Chữ Số</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => triggerSendEmailOtp()}
                disabled={loading || resendCooldown > 0}
                className="font-bold text-sky-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Gửi lại mã sau (${resendCooldown}s)` : 'Gửi lại mã OTP 8 số'}</span>
              </button>

              {hasAuthenticator && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('verify_authenticator')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  Dùng Authenticator
                </button>
              )}
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_mssv')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Nhập lại MSSV khác</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 3: ĐẶT MẬT KHẨU MỚI                                 */}
        {/* ======================================================== */}
        {step === 'set_new_password' && (
          <form onSubmit={handleConfirmNewPassword} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Xác minh danh tính thành công!</span>
              </p>
              <p className="text-[11px] text-emerald-700">
                Hãy nhập mật khẩu mới cho tài khoản <span className="font-mono font-bold">{email}</span>.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700">Mật khẩu mới:</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu mới an toàn"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3.5 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 p-0.5 text-slate-400 hover:text-slate-800 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700">Nhập lại mật khẩu mới:</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Xác nhận lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3.5 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            {/* Visual Checklist tiêu chuẩn mật khẩu */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Yêu cầu độ bảo mật mật khẩu FEPN:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className={`flex items-center gap-1.5 font-bold transition ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasMinLength ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>Tối thiểu 8 ký tự</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasUppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasUppercase ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 chữ in hoa (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasSpecialChar ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasSpecialChar ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 ký tự đặc biệt (!@#$)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold transition ${hasDigit ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasDigit ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>1 chữ số (0-9)</span>
                </div>
                <div className={`col-span-2 flex items-center gap-1.5 font-bold transition ${passwordsMatch ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {passwordsMatch ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
                  <span>Mật khẩu xác nhận trùng khớp</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              <span>Cập Nhật Mật Khẩu Mới</span>
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* BƯỚC 4: THÀNH CÔNG                                       */}
        {/* ======================================================== */}
        {step === 'success' && (
          <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">Đổi Mật Khẩu Thành Công!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mật khẩu cho tài khoản sinh viên <span className="font-mono font-bold text-slate-800">{email}</span> đã được cập nhật thành công trên hệ thống FEPN.
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/fepn-login"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] inline-flex items-center justify-center gap-2"
              >
                <span>Đăng Nhập Ngay</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
