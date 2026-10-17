'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  ExternalLink,
  Copy,
  Smartphone,
} from 'lucide-react'

interface SecurePasswordChangeCardProps {
  userEmail?: string
  isDark?: boolean
  defaultCollapsed?: boolean
  className?: string
}

export default function SecurePasswordChangeCard({
  userEmail: initialEmail = '',
  isDark = false,
  defaultCollapsed = false,
  className = '',
}: SecurePasswordChangeCardProps) {
  const router = useRouter()

  // State thu gọn / mở rộng
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  // Thông tin người dùng & quyền đổi mật khẩu
  const [userEmail, setUserEmail] = useState(initialEmail)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [isProvisioned, setIsProvisioned] = useState(false)
  const [passwordChangeCount, setPasswordChangeCount] = useState(0)
  const [canChangeDirectly, setCanChangeDirectly] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [has2FA, setHas2FA] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')

  // Form input states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Phương thức xác thực: 'direct' | 'totp' | 'email_otp'
  const [verificationMethod, setVerificationMethod] = useState<'direct' | 'totp' | 'email_otp'>('email_otp')
  const [totpCode, setTotpCode] = useState('')
  const [emailOtpCode, setEmailOtpCode] = useState('')

  // Trạng thái gửi OTP qua email
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpSentMessage, setOtpSentMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Trạng thái thực thi lưu mật khẩu
  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedEmail, setCopiedEmail] = useState(false)

  // Kiểm tra độ mạnh mật khẩu (Security Checklist)
  const hasMinLength = newPassword.length >= 8
  const hasUpperCase = /[A-Z]/.test(newPassword)
  const hasLowerCase = /[a-z]/.test(newPassword)
  const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)
  const isPasswordMatched = Boolean(confirmPassword && newPassword === confirmPassword)
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumberOrSpecial && isPasswordMatched

  // Đếm lùi thời gian gửi lại OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Lấy trạng thái tài khoản & xác minh 2FA / Provisioned
  useEffect(() => {
    let mounted = true
    const checkSecurityStatus = async () => {
      try {
        setCheckingStatus(true)
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (mounted) setCheckingStatus(false)
          return
        }

        if (session.user.email && !userEmail) {
          setUserEmail(session.user.email)
        }

        // 1. Kiểm tra qua API bảo mật phía server
        const res = await fetch('/api/auth/password-change', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (mounted) {
            setIsProvisioned(Boolean(data.isProvisioned))
            setPasswordChangeCount(Number(data.passwordChangeCount || 0))
            setCanChangeDirectly(Boolean(data.canChangeDirectly))
            setIsLocked(Boolean(data.isLocked))
            setHas2FA(Boolean(data.has2FA))

            if (data.email) {
              setUserEmail(data.email)
            }

            // Quyết định phương thức xác thực mặc định:
            if (data.canChangeDirectly) {
              setVerificationMethod('direct')
            } else if (data.has2FA) {
              setVerificationMethod('totp')
            } else {
              setVerificationMethod('email_otp')
            }
          }
        }

        // 2. Kiểm tra MFA Factor ID phía client (để challengeAndVerify TOTP)
        try {
          const { data: factorsData } = await supabase.auth.mfa.listFactors()
          const verifiedTotp = factorsData?.totp?.find((f) => f.status === 'verified')
          if (verifiedTotp && mounted) {
            setMfaFactorId(verifiedTotp.id)
            setHas2FA(true)
            if (!canChangeDirectly) {
              setVerificationMethod('totp')
            }
          }
        } catch (mfaErr) {
          console.warn('Lỗi kiểm tra TOTP factors:', mfaErr)
        }
      } catch (err) {
        console.warn('Lỗi tải trạng thái bảo mật mật khẩu:', err)
      } finally {
        if (mounted) setCheckingStatus(false)
      }
    }

    checkSecurityStatus()
    return () => {
      mounted = false
    }
  }, [])

  // Gửi mã OTP qua email
  const handleSendEmailOtp = async () => {
    if (resendCooldown > 0 || sendingOtp) return
    try {
      setSendingOtp(true)
      setFeedbackMsg(null)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setFeedbackMsg({ type: 'error', text: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' })
        return
      }

      const res = await fetch('/api/auth/password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'send_email_otp' }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gửi mã OTP thất bại')
      }

      setResendCooldown(60)
      setOtpSentMessage(data.message || `Đã gửi mã OTP đến ${userEmail}!`)
      setFeedbackMsg({
        type: 'success',
        text: `Đã gửi mã OTP 6 chữ số đến hộp thư ${userEmail}. Vui lòng nhập mã để xác nhận!`,
      })
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi khi gửi mã OTP' })
    } finally {
      setSendingOtp(false)
    }
  }

  // Chuyển sang Email OTP từ TOTP
  const handleSwitchToEmailOtp = () => {
    setVerificationMethod('email_otp')
    if (resendCooldown <= 0) {
      handleSendEmailOtp()
    }
  }

  // Xử lý đổi mật khẩu chính
  const handleSubmitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked) {
      setFeedbackMsg({
        type: 'error',
        text: 'Tài khoản được cấp chỉ được đổi mật khẩu lần 1. Kể từ lần 2, vui lòng liên hệ minhhb.cv@gmail.com để được hỗ trợ.',
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

    // Kiểm tra mã xác thực nếu không phải tài khoản cấp lần 1
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

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')
      }

      // Nếu dùng TOTP: Xác thực trước qua Supabase Auth MFA
      if (!canChangeDirectly && verificationMethod === 'totp' && mfaFactorId) {
        const cleanTotp = totpCode.trim().replace(/[^0-9]/g, '')
        const { error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code: cleanTotp,
        })
        if (challengeErr) {
          throw new Error('Mã xác thực Sen 2FA (TOTP) không chính xác hoặc đã hết hạn!')
        }
      }

      // Gửi yêu cầu cập nhật mật khẩu lên Server
      const res = await fetch('/api/auth/password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'verify_and_update',
          newPassword,
          confirmPassword,
          verificationMethod,
          otpCode: emailOtpCode.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.isLocked) {
          setIsLocked(true)
        }
        throw new Error(data.error || 'Cập nhật mật khẩu thất bại')
      }

      // Thông báo thành công và đăng xuất toàn bộ thiết bị cũ
      setFeedbackMsg({
        type: 'success',
        text: '🎉 Đổi mật khẩu thành công! Tất cả thiết bị cũ đã được đăng xuất an toàn. Hệ thống đang chuyển bạn đến màn hình đăng nhập...',
      })

      // Đăng xuất toàn bộ phiên Supabase
      try {
        await supabase.auth.signOut({ scope: 'global' })
      } catch (soErr) {
        console.warn('Lỗi signOut global:', soErr)
      }

      // Chuyển hướng về cổng IDP sau 1.6s
      setTimeout(() => {
        router.push('/new-idp?password_changed=1')
      }, 1600)
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi khi cập nhật mật khẩu.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyAdminEmail = () => {
    navigator.clipboard.writeText('minhhb.cv@gmail.com')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  return (
    <div
      className={`rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 md:p-6 shadow-sm transition-all duration-300 ${className}`}
    >
      {/* HEADER CARD CÓ NÚT THU GỌN / MỞ RỘNG */}
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-xs">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white flex items-center gap-2">
              Đổi Mật Khẩu Bảo Mật
              {isProvisioned && canChangeDirectly && (
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase">
                  Lần 1 miễn OTP
                </span>
              )}
              {isLocked && (
                <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 text-[9px] font-black uppercase">
                  Khóa lần 2
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Xác thực email 2 bước • Chuẩn an toàn 2026
            </p>
          </div>
        </div>

        {/* Nút thu gọn / mở rộng */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
          title={isCollapsed ? 'Mở rộng bảng đổi mật khẩu' : 'Thu gọn bảng đổi mật khẩu'}
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Mở rộng</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>

      {/* NỘI DUNG FORM (KHI MỞ RỘNG) */}
      {!isCollapsed && (
        <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-4 animate-in fade-in duration-200">
          {checkingStatus ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              <span>Đang kiểm tra cơ chế bảo mật tài khoản...</span>
            </div>
          ) : isLocked ? (
            /* TRƯỜNG HỢP TÀI KHOẢN ĐƯỢC CẤP TỪ LẦN 2 TRỞ ĐI: KHÓA VÀ YÊU CẦU LIÊN HỆ */
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-200">
                <Lock className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Tài khoản được cấp đã hoàn thành đổi mật khẩu lần 1
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    Theo quy chuẩn an toàn học đường SenExam, với tài khoản được cấp bởi Quản trị viên / Nhà trường,
                    bạn chỉ được phép tự thay đổi mật khẩu <strong>1 lần đầu tiên</strong>. Kể từ lần 2 trở đi, để tránh
                    chiếm đoạt hoặc mất tài khoản, vui lòng liên hệ Quản trị viên để được cấp lại mật khẩu mới.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-500/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                    minhhb.cv@gmail.com
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCopyAdminEmail}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-black/10 transition cursor-pointer"
                  >
                    {copiedEmail ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedEmail ? 'Đã sao chép' : 'Sao chép Email'}</span>
                  </button>
                  <a
                    href="mailto:minhhb.cv@gmail.com?subject=Yêu%20cầu%20đổi%20mật%20khẩu%20tài%20khoản%20được%20cấp%20SenExam"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Gửi Email Yêu Cầu</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitChangePassword} className="space-y-3.5">
              {/* THÔNG BÁO CHO TÀI KHOẢN ĐƯỢC CẤP LẦN 1 */}
              {canChangeDirectly && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-black">Tài khoản được cấp: Thay đổi mật khẩu lần 1 không cần xác minh</p>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      Bạn có thể đặt lại mật khẩu của riêng bạn ngay bên dưới mà không cần mã OTP hay 2FA. (Lưu ý: Kể từ lần 2 bạn sẽ cần liên hệ qua email minhhb.cv@gmail.com).
                    </p>
                  </div>
                </div>
              )}

              {/* Ô 1: MẬT KHẨU MỚI */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 pl-3.5 pr-10 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Ô 2: XÁC NHẬN MẬT KHẨU MỚI */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới..."
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 pl-3.5 pr-10 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* YÊU CẦU AN TOÀN TÀI KHOẢN (CHECKLIST NHƯ ẢNH) */}
              <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-3.5 space-y-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  YÊU CẦU AN TOÀN TÀI KHOẢN:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {hasMinLength ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                    )}
                    Tối thiểu 8 ký tự
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasUpperCase && hasLowerCase
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {hasUpperCase && hasLowerCase ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                    )}
                    Chữ hoa & thường
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasNumberOrSpecial ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {hasNumberOrSpecial ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                    )}
                    Có số / ký tự đặc biệt
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${
                      isPasswordMatched ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {isPasswordMatched ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                    )}
                    Khớp mật khẩu
                  </div>
                </div>
              </div>

              {/* Ô NHẬP MÃ XÁC THỰC (OTP / TOTP) CHO TÀI KHOẢN CẦN XÁC MINH */}
              {!canChangeDirectly && (
                <div className="pt-1 space-y-2 border-t border-black/5 dark:border-white/5">
                  {verificationMethod === 'totp' ? (
                    /* KÊNH 1: SEN 2FA (TOTP) ƯU TIÊN TRƯỚC */
                    <div className="space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-indigo-500" /> Mã xác thực Sen 2FA (TOTP)
                        </label>
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Nhập 6 số từ Google Authenticator..."
                        className="w-full rounded-2xl border border-indigo-500/40 bg-indigo-500/5 py-2.5 px-3.5 text-sm font-black tracking-widest text-center text-indigo-700 dark:text-indigo-300 outline-none focus:border-indigo-600 font-mono"
                      />
                      {/* DÒNG CHỮ NHỎ: GỬI OTP QUA EMAIL */}
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Mở ứng dụng Authenticator trên điện thoại để lấy mã 6 số.
                        </p>
                        <button
                          type="button"
                          onClick={handleSwitchToEmailOtp}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          gửi OTP qua email
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* KÊNH 2: GỬI MÃ OTP QUA EMAIL */
                    <div className="space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-amber-500" /> Mã OTP gửi về email ({userEmail || 'email'})
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={emailOtpCode}
                          onChange={(e) => setEmailOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Nhập 6 chữ số OTP..."
                          className="flex-1 rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2.5 px-3.5 text-sm font-black tracking-widest text-center text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleSendEmailOtp}
                          disabled={sendingOtp || resendCooldown > 0}
                          className="shrink-0 px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
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

                      {/* NẾU ĐÃ CÓ 2FA THÌ CHO PHÉP QUAY LẠI TOTP */}
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {otpSentMessage || 'Bấm "Gửi mã OTP" để nhận mã xác minh 6 số qua hộp thư.'}
                        </p>
                        {has2FA && (
                          <button
                            type="button"
                            onClick={() => setVerificationMethod('totp')}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Dùng mã Sen 2FA (TOTP)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LƯU Ý ĐĂNG XUẤT CÁC THIẾT BỊ CŨ */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>
                  Sau khi đổi mật khẩu, <strong>tất cả thiết bị cũ sẽ bị đăng xuất</strong> và bạn cần đăng nhập lại.
                </span>
              </div>

              {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
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

              {/* NÚT XÁC NHẬN SUBMIT CHÍNH (THEO PHONG CÁCH GRADIENT TRONG ẢNH) */}
              <button
                type="submit"
                disabled={submitting || !isPasswordValid}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 hover:opacity-95 text-white font-black text-xs md:text-sm py-3 px-4 transition shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang xác thực & cập nhật mật khẩu...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>
                      {canChangeDirectly
                        ? 'Xác Nhận & Đổi Mật Khẩu (Lần 1)'
                        : 'Xác Nhận & Hoàn Tất Đổi Mật Khẩu'}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
