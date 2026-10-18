'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  ShieldAlert,
  Copy,
  ArrowLeft,
  Sun,
  Moon,
  Smartphone,
  Sparkles,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-chg-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-chg-body' })

export default function NewChangePasswordPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)

  // Form inputs
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Account status from API
  const [checkingAccount, setCheckingAccount] = useState(false)
  const [accountChecked, setAccountChecked] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [isProvisioned, setIsProvisioned] = useState(false)
  const [passwordChangeCount, setPasswordChangeCount] = useState(0)
  const [canChangeDirectly, setCanChangeDirectly] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [has2FA, setHas2FA] = useState(false)

  // Verification
  const [verificationMethod, setVerificationMethod] = useState<'direct' | 'totp' | 'email_otp'>('email_otp')
  const [totpCode, setTotpCode] = useState('')
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [copiedEmail, setCopiedEmail] = useState(false)

  // Submitting
  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const dark =
      document.documentElement.classList.contains('dark') ||
      (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark')
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))

    // Pre-fill email from URL if present
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      const e = p.get('email')
      if (e) {
        setEmail(e)
      }
    }
  }, [])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      try { localStorage.setItem('theme', 'dark') } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }

  // Cooldown countdown for sending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Real-time password criteria
  const hasMinLength = newPassword.length >= 8
  const hasUpperCase = /[A-Z]/.test(newPassword)
  const hasLowerCase = /[a-z]/.test(newPassword)
  const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)
  const isPasswordMatched = Boolean(newPassword && confirmPassword && newPassword === confirmPassword)
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumberOrSpecial && isPasswordMatched

  // Check account status
  const handleCheckAccount = async (targetEmail = email) => {
    const cleanEmail = (targetEmail || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAccountError('Vui lòng nhập địa chỉ email hợp lệ.')
      setAccountChecked(false)
      return
    }

    try {
      setCheckingAccount(true)
      setAccountError('')
      setFeedbackMsg(null)

      const res = await fetch(`/api/auth/password-change?email=${encodeURIComponent(cleanEmail)}`)
      const data = await res.json()

      if (!res.ok) {
        setAccountError(data.error || 'Không tìm thấy tài khoản với email này trên hệ thống.')
        setAccountChecked(false)
        return
      }

      setIsProvisioned(Boolean(data.isProvisioned))
      setPasswordChangeCount(Number(data.passwordChangeCount || 0))
      setCanChangeDirectly(Boolean(data.canChangeDirectly))
      setIsLocked(Boolean(data.isLocked))
      setHas2FA(Boolean(data.has2FA))
      setAccountChecked(true)

      // Set default verification mode
      if (data.canChangeDirectly) {
        setVerificationMethod('direct')
      } else if (data.has2FA) {
        setVerificationMethod('totp')
      } else {
        setVerificationMethod('email_otp')
      }
    } catch (err: any) {
      setAccountError(err.message || 'Lỗi khi kiểm tra tài khoản.')
      setAccountChecked(false)
    } finally {
      setCheckingAccount(false)
    }
  }

  // Trigger check on email blur or when prefilled
  const handleEmailBlur = () => {
    if (email && email.includes('@') && !accountChecked) {
      handleCheckAccount()
    }
  }

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập email tài khoản của bạn.' })
      return
    }

    if (resendCooldown > 0) return

    try {
      setSendingOtp(true)
      setFeedbackMsg(null)

      const res = await fetch('/api/auth/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email_otp',
          email: cleanEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi mã OTP')
      }

      setResendCooldown(60)
      setFeedbackMsg({
        type: 'success',
        text: `Đã gửi mã OTP 6 số đến email ${cleanEmail}. Vui lòng kiểm tra hộp thư đến hoặc mục Spam.`,
      })
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi gửi mã OTP' })
    } finally {
      setSendingOtp(false)
    }
  }

  // Switch to Email OTP when 2FA is active
  const handleSwitchToEmailOtp = () => {
    setVerificationMethod('email_otp')
    if (resendCooldown <= 0) {
      handleSendEmailOtp()
    }
  }

  // Copy email support
  const handleCopySupportEmail = () => {
    navigator.clipboard.writeText('minhhb.cv@gmail.com')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  // Submit password change
  const handleSubmitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập email tài khoản.' })
      return
    }

    if (!accountChecked) {
      await handleCheckAccount(cleanEmail)
    }

    if (isLocked) {
      setFeedbackMsg({
        type: 'error',
        text: 'Tài khoản được cấp chỉ được đổi mật khẩu lần 1 trực tiếp. Kể từ lần 2, vui lòng liên hệ minhhb.cv@gmail.com để được hỗ trợ.',
      })
      return
    }

    if (!isPasswordValid) {
      setFeedbackMsg({
        type: 'error',
        text: 'Vui lòng đáp ứng đầy đủ tất cả các tiêu chí bảo mật mật khẩu bên dưới.',
      })
      return
    }

    if (!canChangeDirectly) {
      if (verificationMethod === 'totp') {
        const cleanTotp = totpCode.trim().replace(/[^0-9]/g, '')
        if (cleanTotp.length !== 6) {
          setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ 6 chữ số mã xác thực Sen 2FA (TOTP).' })
          return
        }
      } else if (verificationMethod === 'email_otp') {
        const cleanOtp = emailOtpCode.trim().replace(/[^0-9]/g, '')
        if (cleanOtp.length !== 6) {
          setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập mã xác thực OTP 6 số đã được gửi qua email.' })
          return
        }
      }
    }

    try {
      setSubmitting(true)
      setFeedbackMsg(null)

      const res = await fetch('/api/auth/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_and_update',
          email: cleanEmail,
          newPassword,
          confirmPassword,
          verificationMethod,
          otpCode: verificationMethod === 'totp' ? totpCode.trim() : emailOtpCode.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.isLocked) {
          setIsLocked(true)
        }
        throw new Error(data.error || 'Cập nhật mật khẩu thất bại')
      }

      setFeedbackMsg({
        type: 'success',
        text: '🎉 Đổi mật khẩu thành công! Tất cả thiết bị cũ đã được đăng xuất an toàn. Hệ thống đang chuyển bạn đến màn hình đăng nhập...',
      })

      await supabase.auth.signOut({ scope: 'global' }).catch(() => {})

      setTimeout(() => {
        window.location.href = '/new-idp?password_changed=1'
      }, 1500)
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi khi đặt lại mật khẩu' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${headingFont.variable} ${bodyFont.variable}`}
      style={{
        ...getModernThemeVars(isDark, 'emerald'),
        fontFamily: 'var(--font-chg-body)',
      }}
    >
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-bl from-rose-500/20 to-purple-500/10 blur-3xl pointer-events-none" />

      {/* Header controls (Dark Mode Toggle & Back Link) */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-10">
        <Link
          href="/new-idp"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
          title="Về trang Đăng nhập"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
          title="Chuyển chế độ Sáng / Tối"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </button>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-lg rounded-[32px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6 z-10 animate-in fade-in zoom-in-95 duration-300 mt-12 sm:mt-0">
        {/* Header Section */}
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white shadow-lg shadow-amber-500/20">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight pt-1"
            style={{ fontFamily: 'var(--font-chg-heading)' }}
          >
            Đặt Lại Mật Khẩu
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            Xác thực OTP & Chuẩn An Toàn SenExam 2026. Tự động đăng xuất mọi thiết bị cũ sau khi hoàn tất.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitChangePassword} className="space-y-4">
          {/* Ô 1: Nhập Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Email tài khoản của bạn:</span>
              {accountChecked && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã nhận diện
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setAccountChecked(false)
                  setAccountError('')
                }}
                onBlur={handleEmailBlur}
                placeholder="name@example.com"
                required
                className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-3 pl-10 pr-24 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 transition shadow-inner"
              />
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => handleCheckAccount()}
                disabled={checkingAccount || !email}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1.5 text-[11px] font-black transition hover:opacity-90 disabled:opacity-40"
              >
                {checkingAccount ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kiểm tra'}
              </button>
            </div>
            {accountError && (
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 pt-0.5">
                <AlertCircle className="h-3 w-3 shrink-0" /> {accountError}
              </p>
            )}
          </div>

          {/* BANNER 1: TÀI KHOẢN ĐƯỢC CẤP LẦN 1 */}
          {accountChecked && isProvisioned && canChangeDirectly && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-black block">Tài khoản được cấp hệ thống:</span>
                Thay đổi mật khẩu <strong>lần 1 không cần xác minh OTP/2FA</strong>. Vui lòng thiết lập mật khẩu cá nhân mới bên dưới để bảo vệ tài khoản.
              </div>
            </div>
          )}

          {/* BANNER 2: TÀI KHOẢN ĐƯỢC CẤP TỪ LẦN 2 (BỊ KHÓA) */}
          {accountChecked && isProvisioned && isLocked && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2.5 text-rose-800 dark:text-rose-300 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-black text-rose-900 dark:text-rose-200">
                    Tài khoản được cấp đã hoàn thành đổi mật khẩu lần 1!
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Theo chính sách bảo mật hệ thống, tài khoản được cấp chỉ được đổi mật khẩu trực tiếp ở lần 1. Kể từ lần 2 trở đi, để đặt lại mật khẩu bạn vui lòng liên hệ quản trị viên qua email:
                  </p>
                  <p className="font-black text-xs text-rose-700 dark:text-rose-400 bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-rose-500/20 inline-block font-mono">
                    minhhb.cv@gmail.com
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-500/20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySupportEmail}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-500/30 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-700 transition"
                >
                  <Copy className="h-3 w-3" />
                  {copiedEmail ? 'Đã sao chép!' : 'Sao chép Email'}
                </button>
                <a
                  href="mailto:minhhb.cv@gmail.com?subject=[SenExam]%20Yêu%20cầu%20đặt%20lại%20mật%20khẩu%20tài%20khoản"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-[11px] font-black transition shadow-xs"
                >
                  <Send className="h-3 w-3" />
                  Gửi thư hỗ trợ
                </a>
              </div>
            </div>
          )}

          {/* Ô 2: Mật khẩu mới & Xác nhận mật khẩu mới */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  disabled={isLocked}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 pl-3 pr-8 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  disabled={isLocked}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 pl-3 pr-8 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Tiêu chí an toàn mật khẩu (Checklist) */}
          <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 p-3 space-y-1.5">
            <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Yêu cầu an toàn mật khẩu:
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'}`}>
                {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                Tối thiểu 8 ký tự
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpperCase && hasLowerCase ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'}`}>
                {hasUpperCase && hasLowerCase ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                Chữ hoa & thường
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumberOrSpecial ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'}`}>
                {hasNumberOrSpecial ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                Có số / ký tự đặc biệt
              </div>
              <div className={`flex items-center gap-1.5 ${isPasswordMatched ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'}`}>
                {isPasswordMatched ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                Khớp mật khẩu
              </div>
            </div>
          </div>

          {/* Ô 3: XÁC THỰC BẢO MẬT (NẾU KHÔNG PHẢI TÀI KHOẢN ĐƯỢC CẤP LẦN 1) */}
          {!canChangeDirectly && !isLocked && (
            <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-3">
              {/* TRƯỜNG HỢP A: TÀI KHOẢN CÓ SEN 2FA (TOTP) -> ƯU TIÊN TOTP TRƯỚC */}
              {has2FA && verificationMethod === 'totp' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                      Mã xác thực Sen 2FA (TOTP):
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                      Bảo vệ 2 lớp
                    </span>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Nhập 6 số từ ứng dụng Authenticator"
                    className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.04] py-2.5 px-3.5 text-center text-sm font-black tracking-[0.3em] font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />

                  {/* Dòng chữ nhỏ chuyển sang OTP qua email */}
                  <div className="flex items-center justify-center pt-1">
                    <button
                      type="button"
                      onClick={handleSwitchToEmailOtp}
                      className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      Chưa có mã TOTP? Gửi mã OTP xác nhận qua Email
                    </button>
                  </div>
                </div>
              )}

              {/* TRƯỜNG HỢP B: XÁC THỰC QUA EMAIL OTP */}
              {(!has2FA || verificationMethod === 'email_otp') && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Mã OTP xác thực qua email:</span>
                    {has2FA && (
                      <button
                        type="button"
                        onClick={() => setVerificationMethod('totp')}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        ← Dùng mã Sen 2FA
                      </button>
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtpCode}
                      onChange={(e) => setEmailOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Mã 6 số..."
                      className="flex-1 rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 px-3.5 text-center text-sm font-black tracking-[0.2em] font-mono text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />

                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingOtp || resendCooldown > 0 || !email}
                      className="rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-black transition hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : resendCooldown > 0 ? (
                        <span>Gửi lại ({resendCooldown}s)</span>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Gửi mã OTP</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback Message */}
          {feedbackMsg && (
            <div
              className={`rounded-2xl p-3.5 text-xs font-bold flex items-start gap-2 animate-in fade-in ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedbackMsg.text}</span>
            </div>
          )}

          {/* Nút Submit chính */}
          <button
            type="submit"
            disabled={submitting || isLocked || !isPasswordValid || (!canChangeDirectly && verificationMethod === 'totp' && totpCode.length !== 6) || (!canChangeDirectly && verificationMethod === 'email_otp' && emailOtpCode.length !== 6)}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-rose-600 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-black text-xs py-3.5 transition shadow-lg shadow-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xác thực & cập nhật...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Xác Nhận & Đặt Lại Mật Khẩu</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <Link
            href="/new-idp"
            className="font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại Đăng Nhập
          </Link>
          <span className="font-semibold">SenExam IDP 2.0</span>
        </div>
      </div>
    </div>
  )
}
