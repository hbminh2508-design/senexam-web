'use client'

import React, { useState, useEffect, useMemo, Component } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { signInWithGoogle } from '@/lib/authHelper'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, getAccentHex } from '@/app/components/modernTheme'
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
  HelpCircle,
  Building2,
  MapPin,
  Phone,
  ShieldAlert,
  UserPlus,
  KeyRound,
  Crown,
  Clock,
  Coins,
  Check,
  Flame,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-body' })

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

type IdpMode = 'login' | 'signup' | 'forgot' | 'magic-link' | 'grant'

function IdpAuthContent() {
  const router = useRouter()
  const { themeColor } = useNewUiPrefs()

  const [mode, setMode] = useState<IdpMode>('login')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isDark, setIsDark] = useState(false)

  // Hệ thống nhận diện bối cảnh dịch vụ: SEB hoặc SenExam mặc định
  const [targetService, setTargetService] = useState<'senexam' | 'seb'>('senexam')
  const [redirectPath, setRedirectPath] = useState<string>('')

  // Kiểm tra quyền Admin / Collab của người dùng hiện tại (nếu đã đăng nhập để mở tab 4)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [adminCheckDone, setAdminCheckDone] = useState(false)

  // Form Fields - Đăng nhập / Đăng ký
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [className, setClassName] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')

  // Trạng thái chờ xác nhận email thật
  const [verificationPending, setVerificationPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Trợ giúp học sinh
  const [showStudentHelp, setShowStudentHelp] = useState(false)

  // Phòng thủ Brute-force & Khóa đăng nhập
  const [lockoutTimer, setLockoutTimer] = useState<number>(0)

  // ==========================================
  // STATE CHO TAB 4: CẤP TÀI KHOẢN (ADMIN GRANT)
  // ==========================================
  const [grantEmail, setGrantEmail] = useState('')
  const [grantPassword, setGrantPassword] = useState('')
  const [grantFullName, setGrantFullName] = useState('')
  const [grantRole, setGrantRole] = useState<'student' | 'teacher' | 'collab' | 'admin'>('student')
  const [grantPhone, setGrantPhone] = useState('')
  const [grantClass, setGrantClass] = useState('')
  const [grantSchool, setGrantSchool] = useState('')
  const [grantProvince, setGrantProvince] = useState('')
  const [grantPlanTier, setGrantPlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'>('free')
  const [grantVipDays, setGrantVipDays] = useState('30')
  const [grantSenCash, setGrantSenCash] = useState('0')
  const [grantLoading, setGrantLoading] = useState(false)

  // Khởi tạo giao diện, nhận diện bối cảnh FEPN / SEB & Kiểm tra Brute-Force lockout an toàn
  useEffect(() => {
    let isMounted = true

    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    if (isMounted) setIsDark(Boolean(dark))

    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search)
        const serviceParam = (params.get('service') || '').toLowerCase()
        const fromParam = (params.get('from') || '').toLowerCase()
        const targetParam = (params.get('target') || '').toLowerCase()
        const nextParam = params.get('next') || params.get('redirect') || ''
        const host = window.location.hostname.toLowerCase()
        const ref = (document.referrer || '').toLowerCase()

        // Nếu phát hiện yêu cầu rõ ràng từ FEPN qua query hoặc subdomain: Chuyển hướng sang Cổng Đăng Nhập FEPN độc lập
        const detectedFepn =
          serviceParam === 'fepn' ||
          fromParam === 'fepn' ||
          targetParam === 'fepn' ||
          host.startsWith('fepn.') ||
          host.startsWith('tsv.fepn.')

        if (detectedFepn) {
          router.replace(`/fepn-login${window.location.search || ''}`)
          return
        }

        if (isMounted) {
          if (serviceParam === 'seb' || nextParam.includes('seb')) {
            setTargetService('seb')
          } else {
            setTargetService('senexam')
          }

          if (nextParam) {
            setRedirectPath(nextParam)
          }

          const err = params.get('error_description') || params.get('error')
          if (err) {
            setErrorMsg(
              err.includes('bad_oauth_state') || err.includes('OAuth state')
                ? 'Phiên đăng nhập Google đã hết hạn hoặc bị gián đoạn. Vui lòng thử lại.'
                : decodeURIComponent(err)
            )
          }

          // Kiểm tra lockout còn hiệu lực không
          const lockoutUntil = parseInt(localStorage.getItem('idp_lockout_until') || '0', 10)
          const now = Date.now()
          if (lockoutUntil > now) {
            setLockoutTimer(Math.ceil((lockoutUntil - now) / 1000))
          }
        }
      } catch (paramErr) {
        console.warn('Lỗi đọc tham số IDP:', paramErr)
      }
    }

    // Kiểm tra xem phiên hiện tại có phải Admin không để kích hoạt Tab 4
    const checkAdminSession = async () => {
      try {
        const sessionRes = await supabase.auth.getSession().catch(() => null)
        const user = sessionRes?.data?.session?.user
        if (user && isMounted) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()
            if (isMounted && (profile?.role === 'admin' || profile?.role === 'collab')) {
              setIsAdminUser(true)
            }
          } catch (e) {
            console.warn('Lỗi đọc role profile:', e)
          }
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra session admin IDP:', e)
      } finally {
        if (isMounted) {
          setAdminCheckDone(true)
        }
      }
    }

    checkAdminSession()

    return () => {
      isMounted = false
    }
  }, [])

  // Đếm ngược mở khóa Brute-force
  useEffect(() => {
    if (lockoutTimer <= 0) return
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem('idp_lockout_until')
            localStorage.setItem('idp_failed_attempts', '0')
          } catch {}
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [lockoutTimer])

  // Đếm ngược gửi lại email xác nhận
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

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

  // Đo độ mạnh của mật khẩu (Password Strength Meter)
  const passwordStrength = useMemo(() => {
    const pwd = mode === 'grant' ? grantPassword : password
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-300' }
    let s = 0
    if (pwd.length >= 6) s += 1
    if (pwd.length >= 10) s += 1
    if (/[A-Z]/.test(pwd)) s += 1
    if (/[0-9]/.test(pwd)) s += 1
    if (/[^A-Za-z0-9]/.test(pwd)) s += 1

    if (s <= 2) return { score: 1, label: 'Mật khẩu yếu', color: 'bg-rose-500' }
    if (s <= 3) return { score: 2, label: 'Mật khẩu trung bình', color: 'bg-amber-500' }
    return { score: 3, label: 'Mật khẩu mạnh & an toàn', color: 'bg-emerald-500' }
  }, [password, grantPassword, mode])

  // Ghi nhận lần nhập sai để chống Brute-force
  const recordFailedAttempt = () => {
    try {
      const current = parseInt(localStorage.getItem('idp_failed_attempts') || '0', 10) + 1
      localStorage.setItem('idp_failed_attempts', String(current))
      if (current >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000
        localStorage.setItem('idp_lockout_until', String(lockUntil))
        setLockoutTimer(LOCKOUT_SECONDS)
        setErrorMsg(`Hệ thống bảo vệ Sen Heart đã tạm khóa do nhập sai liên tiếp ${MAX_FAILED_ATTEMPTS} lần. Vui lòng chờ 60 giây.`)
      }
    } catch {}
  }

  const clearFailedAttempts = () => {
    try {
      localStorage.removeItem('idp_failed_attempts')
      localStorage.removeItem('idp_lockout_until')
      setLockoutTimer(0)
    } catch {}
  }

  // Điều hướng sau khi đăng nhập thành công
  const navigatePostLogin = (userEmail: string) => {
    clearFailedAttempts()

    if (redirectPath) {
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath
      } else {
        router.push(redirectPath)
      }
      return
    }

    const emailLower = (userEmail || '').toLowerCase().trim()
    const isVnu = emailLower.endsWith('@vnu.edu.vn') || emailLower.endsWith('.vnu.edu.vn')

    if (targetService === 'seb') {
      router.push('/seb-dashboard')
      return
    }

    if (isVnu) {
      if (typeof window !== 'undefined') {
        if (window.location.hostname.startsWith('tsv.fepn.') || window.location.hostname.startsWith('fepn.')) {
          router.push('/fepn-dashboard')
          return
        }
        if (window.location.hostname === 'localhost') {
          router.push('/fepn-dashboard')
          return
        }
        window.location.href = 'https://tsv.fepn.senexam.me/fepn-dashboard'
        return
      }
      router.push('/fepn-dashboard')
      return
    }

    try {
      router.push(redirectPath || '/new-dashboard')
    } catch {
      if (typeof window !== 'undefined') {
        window.location.assign(redirectPath || '/new-dashboard')
      }
    }
  }

  // Đăng nhập bằng Google OAuth
  const handleGoogleAuth = async () => {
    if (lockoutTimer > 0) return
    setGoogleLoading(true)
    setErrorMsg('')
    try {
      const dest = redirectPath || (targetService === 'seb' ? '/seb-dashboard' : '/new-dashboard')
      await signInWithGoogle(dest)
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('provider is not enabled')
          ? 'Google OAuth chưa được kích hoạt trên hệ thống. Vui lòng sử dụng đăng nhập bằng Email.'
          : err.message || 'Đăng nhập Google thất bại.'
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  // Xử lý gửi Form chính (Login, Signup, Magic-Link, Forgot)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockoutTimer > 0) {
      setErrorMsg(`Vui lòng chờ hết thời gian khóa (${lockoutTimer}s) để thử lại.`)
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/new-dashboard` : undefined

      if (mode === 'login') {
        // ĐĂNG NHẬP
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          recordFailedAttempt()
          throw error
        }

        if (data.user) {
          try {
            await ensureStudentProfile(data.user.id)
          } catch {}
        }
        navigatePostLogin(data.user?.email || email.trim())
      } else if (mode === 'signup') {
        // ĐĂNG KÝ
        if (!fullName.trim()) throw new Error('Vui lòng nhập họ và tên của bạn.')
        if (!phone.trim()) throw new Error('Vui lòng nhập số điện thoại của bạn.')
        if (!className.trim()) throw new Error('Vui lòng nhập lớp học của bạn (ví dụ: 12A1).')
        if (!school.trim()) throw new Error('Vui lòng nhập tên trường học của bạn.')
        if (!province.trim()) throw new Error('Vui lòng nhập tỉnh/thành phố bạn đang ở.')
        if (password.length < 6) throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự.')

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: phone.trim(),
              phone: phone.trim(),
              class_name: className.trim(),
              school: school.trim(),
              province: province.trim(),
            },
            emailRedirectTo: redirectUrl,
          },
        })

        if (error) throw error

        if (data.user) {
          try {
            await ensureStudentProfile(data.user.id)
            await supabase
              .from('profiles')
              .update({
                full_name: fullName.trim(),
                phone_number: phone.trim(),
                phone: phone.trim(),
                class_name: className.trim(),
                school: school.trim(),
                province: province.trim(),
              })
              .eq('id', data.user.id)
          } catch {}
        }

        if (data.user && !data.session) {
          setVerificationPending(true)
          setPendingEmail(email.trim())
          setResendCooldown(60)
        } else {
          navigatePostLogin(data.user?.email || email.trim())
        }
      } else if (mode === 'magic-link') {
        // ĐĂNG NHẬP QUA MAGIC LINK
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
        setSuccessMsg('Liên kết đăng nhập bảo mật đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư!')
      } else if (mode === 'forgot') {
        // QUÊN MẬT KHẨU
        const resetRedirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/new-reset-password` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: resetRedirectUrl,
        })
        if (error) throw error
        setSuccessMsg('Liên kết khôi phục mật khẩu đã được gửi đến email của bạn! Vui lòng kiểm tra hộp thư đến hoặc mục Thư rác (Spam).')
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setErrorMsg('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.')
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

  // ==========================================
  // XỬ LÝ TAB 4: ADMIN CẤP TÀI KHOẢN CHO NGƯỜI DÙNG
  // ==========================================
  const handleAdminProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setGrantLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      if (!grantEmail.trim() || !grantPassword || !grantFullName.trim()) {
        throw new Error('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu khởi tạo.')
      }

      if (grantPassword.length < 6) {
        throw new Error('Mật khẩu phải từ 6 ký tự trở lên.')
      }

      const res = await fetch('/api/admin/provision-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: grantEmail.trim(),
          password: grantPassword,
          fullName: grantFullName.trim(),
          role: grantRole,
          phone: grantPhone.trim() || undefined,
          className: grantClass.trim() || undefined,
          school: grantSchool.trim() || undefined,
          province: grantProvince.trim() || undefined,
          planTier: grantPlanTier,
          vipDays: grantPlanTier !== 'free' ? parseInt(grantVipDays || '30', 10) : undefined,
          sencashBalance: parseInt(grantSenCash || '0', 10),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cấp tài khoản thất bại.')
      }

      setSuccessMsg(
        `✓ Đã cấp tài khoản thành công cho: ${data.data.email} (Vai trò: ${data.data.role}, Gói: ${data.data.plan_tier}). Người dùng có thể đăng nhập ngay!`
      )
      // Reset form
      setGrantEmail('')
      setGrantPassword('')
      setGrantFullName('')
      setGrantPhone('')
      setGrantClass('')
      setGrantSchool('')
      setGrantProvince('')
      setGrantSenCash('0')
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cấp tài khoản hệ thống.')
    } finally {
      setGrantLoading(false)
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
      {/* Tinh chỉnh nền nhẹ - GlobalCanvasEngine đã đảm nhận hạt và hiệu ứng động */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
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
        <Link
          href="/home"
          className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm backdrop-blur-xl transition hover:scale-105"
        >
          Giới thiệu
        </Link>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur-xl transition hover:scale-105 cursor-pointer"
          title="Chuyển đổi Sáng/Tối"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </button>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[500px] flex flex-col items-center">
        
        {/* BRAND HEADER: SENEXAM IDP & SEB EXAM IDP */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Cổng Định Danh Tập Trung • SenExam New-IDP</span>
          </div>

          <h1
            className="text-3xl sm:text-5xl font-black tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-idp-heading)' }}
          >
            {targetService === 'seb' ? (
              <>
                SEB Exam<span style={{ color: accent }}> IDP</span>
              </>
            ) : (
              <>
                SenExam<span style={{ color: accent }}> IDP</span>
              </>
            )}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto" style={{ fontFamily: 'var(--font-idp-body)' }}>
            {targetService === 'seb'
              ? 'Cổng Xác Thực Safe Exam Browser — Khảo thí an toàn & chống gian lận.'
              : 'Cổng Định Danh Tập Trung — Một tài khoản cho toàn bộ hệ sinh thái SenExam.'}
          </p>
        </div>

        {/* Card Form */}
        <div className="w-full rounded-[32px] border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300">
          
          {/* CẢNH BÁO BRUTE-FORCE LOCKOUT (NẾU ĐANG BỊ KHÓA) */}
          {lockoutTimer > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 font-black text-sm">
                <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
                <span>Hệ thống bảo vệ tạm khóa truy cập</span>
              </div>
              <p className="text-[11px] font-semibold leading-relaxed">
                Đã phát hiện nhiều lần thử sai liên tiếp. Để bảo vệ an toàn cho tài khoản, vui lòng đợi hết thời gian khóa dưới đây:
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                  ⏳ {lockoutTimer} giây
                </span>
                <span className="text-[10px] uppercase tracking-wider text-rose-500 font-mono">
                  Sen Heart Armor Active
                </span>
              </div>
            </div>
          )}

          {/* MÀN HÌNH CHỜ XÁC NHẬN EMAIL */}
          {verificationPending ? (
            <div className="text-center space-y-5 py-4 animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-md">
                <Mail className="h-8 w-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-idp-heading)' }}>
                  Xác Thực Email Của Bạn
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-black/15 dark:border-white/20 bg-white/80 dark:bg-slate-800/80 py-3 text-xs font-bold transition hover:bg-black/5 disabled:opacity-50 cursor-pointer"
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
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition cursor-pointer"
                >
                  ← Trở về màn hình Đăng nhập
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB SWITCHER: 3 TABS CHO USER HOẶC 4 TABS CHO ADMIN/COLLAB */}
              <div
                className={`grid ${
                  isAdminUser ? 'grid-cols-4' : 'grid-cols-3'
                } gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 mb-6`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`rounded-xl py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
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
                  className={`rounded-xl py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Đăng Ký
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`rounded-xl py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    mode === 'forgot'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Quên MK
                </button>

                {/* TAB THỨ 4: CẤP TÀI KHOẢN (CHỈ DÀNH CHO ADMIN / COLLAB) */}
                {isAdminUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('grant')
                      setErrorMsg('')
                      setSuccessMsg('')
                    }}
                    className={`rounded-xl py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                      mode === 'grant'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-sm'
                        : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                    }`}
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>Cấp TK</span>
                  </button>
                )}
              </div>

              {/* ==================================================== */}
              {/* TAB 4: MÀN HÌNH ADMIN CẤP TÀI KHOẢN CHO NGƯỜI DÙNG */}
              {/* ==================================================== */}
              {mode === 'grant' ? (
                <form onSubmit={handleAdminProvisionUser} className="space-y-3.5 animate-in fade-in zoom-in-95">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-black text-amber-900 dark:text-amber-200">
                        Cổng Cấp Tài Khoản Hệ Thống (Admin Portal)
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed text-[11px]">
                        Tài khoản sẽ được tạo trực tiếp với trạng thái đã xác thực email, sẵn sàng đăng nhập ngay lập tức.
                      </p>
                    </div>
                  </div>

                  {/* Họ tên */}
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                    <input
                      type="text"
                      placeholder="Họ và tên người nhận tài khoản *"
                      value={grantFullName}
                      onChange={(e) => setGrantFullName(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Email & Mật khẩu */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                      <input
                        type="email"
                        placeholder="Email người nhận *"
                        value={grantEmail}
                        onChange={(e) => setGrantEmail(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div className="relative group">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mật khẩu khởi tạo *"
                        value={grantPassword}
                        onChange={(e) => setGrantPassword(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-11 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black dark:hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Thanh đo mật khẩu */}
                  {grantPassword && (
                    <div className="space-y-1">
                      <div className="flex h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-right">
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}

                  {/* Vai trò & Gói VIP */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Vai trò phân quyền:
                      </label>
                      <select
                        value={grantRole}
                        onChange={(e) => setGrantRole(e.target.value as any)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none"
                      >
                        <option value="student">🎓 Học sinh (Student)</option>
                        <option value="teacher">👨‍🏫 Giáo viên (Teacher)</option>
                        <option value="collab">🤝 Cộng tác viên (Collab)</option>
                        <option value="admin">👑 Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Gói tài khoản kích hoạt:
                      </label>
                      <select
                        value={grantPlanTier}
                        onChange={(e) => setGrantPlanTier(e.target.value as any)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none"
                      >
                        <option value="free">Cơ bản (Miễn phí)</option>
                        <option value="premium">Sen VIP (Premium)</option>
                        <option value="premium_plus">Premium+ (Vip Đặc Quyền)</option>
                        <option value="sen_one">Gói Sen One (Flagship)</option>
                        <option value="sen_one_lite">Gói Sen One Lite</option>
                      </select>
                    </div>
                  </div>

                  {/* Hạn sử dụng VIP nếu chọn gói */}
                  {grantPlanTier !== 'free' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="number"
                          placeholder="Số ngày VIP (ví dụ: 30)"
                          value={grantVipDays}
                          onChange={(e) => setGrantVipDays(e.target.value)}
                          className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-bold outline-none"
                        />
                      </div>

                      <div className="relative group">
                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                        <input
                          type="number"
                          placeholder="Tặng SenCash (ví dụ: 50)"
                          value={grantSenCash}
                          onChange={(e) => setGrantSenCash(e.target.value)}
                          className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Thông tin mở rộng: Lớp, Trường, SĐT, Tỉnh/thành (tùy chọn) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Lớp (tùy chọn)"
                      value={grantClass}
                      onChange={(e) => setGrantClass(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-4 text-xs font-semibold outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Số điện thoại (tùy chọn)"
                      value={grantPhone}
                      onChange={(e) => setGrantPhone(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-4 text-xs font-semibold outline-none"
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
                    disabled={grantLoading || !grantEmail || !grantPassword || !grantFullName}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black py-3.5 px-4 text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:brightness-105 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                  >
                    {grantLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>Kích Hoạt & Cấp Tài Khoản</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* ==================================================== */
                /* CÁC CHẾ ĐỘ: ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU */
                /* ==================================================== */
                <>
                  {/* NÚT GOOGLE AUTH (Khi login hoặc signup) */}
                  {mode !== 'forgot' && (
                    <>
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={googleLoading || lockoutTimer > 0}
                        className="w-full flex items-center justify-center gap-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 py-3.5 px-4 text-sm font-bold text-slate-900 dark:text-white shadow-sm transition hover:scale-[1.01] hover:shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                      >
                        {googleLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
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

                      {/* Phân cách */}
                      <div className="relative my-5 flex items-center justify-center">
                        <div className="w-full border-t border-black/10 dark:border-white/10" />
                        <span className="absolute bg-white/90 dark:bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Hoặc bằng Email
                        </span>
                      </div>
                    </>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {/* Thông tin học sinh khi đăng ký mới (đầy đủ các trường từ new-sign) */}
                    {mode === 'signup' && (
                      <>
                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                          <input
                            type="text"
                            placeholder="Họ và tên của bạn *"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>

                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                          <input
                            type="tel"
                            placeholder="Số điện thoại của bạn (bắt buộc) *"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-2">
                          <div className="relative group">
                            <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                            <input
                              type="text"
                              placeholder="Lớp (vd: 12A1) *"
                              value={className}
                              onChange={(e) => setClassName(e.target.value)}
                              required
                              className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>

                          <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                            <input
                              type="text"
                              placeholder="Tỉnh / Thành phố *"
                              value={province}
                              onChange={(e) => setProvince(e.target.value)}
                              required
                              className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>

                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                          <input
                            type="text"
                            placeholder="Trường THPT / Đại học của bạn *"
                            value={school}
                            onChange={(e) => setSchool(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </>
                    )}

                    {/* Email */}
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                      <input
                        type="email"
                        placeholder="Địa chỉ Email của bạn *"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    {/* Mật khẩu */}
                    {mode !== 'magic-link' && mode !== 'forgot' && (
                      <div className="space-y-1.5">
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-amber-500" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={mode === 'signup' ? 'Mật khẩu bảo mật (tối thiểu 6 ký tự) *' : 'Mật khẩu của bạn *'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-11 text-xs sm:text-sm font-semibold outline-none transition focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black dark:hover:text-white cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Thanh đo mật khẩu khi đăng ký mới */}
                        {mode === 'signup' && password && (
                          <div className="space-y-1">
                            <div className="flex h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                                style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-right">
                              {passwordStrength.label}
                            </p>
                          </div>
                        )}

                        {mode === 'login' && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setMode('forgot')
                                setErrorMsg('')
                                setSuccessMsg('')
                              }}
                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              Quên mật khẩu?
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hướng dẫn khi ở mode Quên mật khẩu */}
                    {mode === 'forgot' && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                        Nhập địa chỉ email tài khoản của bạn. SenExam IDP sẽ gửi liên kết bảo mật để bạn thiết lập mật khẩu mới ngay lập tức.
                      </p>
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
                      disabled={loading || !email || lockoutTimer > 0}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 px-4 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] hover:opacity-95 active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span>
                            {mode === 'login'
                              ? 'Đăng Nhập Ngay'
                              : mode === 'signup'
                              ? 'Tạo Tài Khoản IDP'
                              : mode === 'forgot'
                              ? 'Gửi Link Đặt Lại Mật Khẩu'
                              : 'Gửi Mã Xác Thực'}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Đồng ý điều khoản & bảo mật */}
                  <p className="mt-3 text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    Bằng cách tiếp tục, bạn đồng ý với{' '}
                    <Link href="/terms" target="_blank" className="font-bold underline hover:text-indigo-600 dark:hover:text-indigo-400">
                      Điều khoản dịch vụ
                    </Link>{' '}
                    và{' '}
                    <Link href="/privacy" target="_blank" className="font-bold underline hover:text-indigo-600 dark:hover:text-indigo-400">
                      Chính sách bảo mật
                    </Link>{' '}
                    của chúng tôi.
                  </p>

                  {/* Extra Links: Magic Link & Trợ giúp học sinh */}
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === 'magic-link' ? 'login' : 'magic-link')
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                      className="hover:text-black dark:hover:text-white transition underline cursor-pointer"
                    >
                      {mode === 'magic-link' ? 'Dùng mật khẩu thông thường' : 'Đăng nhập không cần mật khẩu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStudentHelp(!showStudentHelp)}
                      className="flex items-center gap-1 hover:text-black dark:hover:text-white transition cursor-pointer"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-amber-500" /> Trợ giúp học sinh
                    </button>
                  </div>

                  {/* TRUNG TÂM TRỢ GIÚP HỌC SINH */}
                  {showStudentHelp && (
                    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2.5 animate-in fade-in zoom-in-95">
                      <p className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-sm">
                        <Sparkles className="h-4 w-4 text-amber-500" /> Hướng Dẫn & Trợ Giúp Học Sinh:
                      </p>
                      <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed font-semibold">
                        <li>
                          <strong>Chưa nhận được email xác thực:</strong> Hãy kiểm tra thêm mục <em>Thư rác (Spam)</em> hoặc <em>Quảng cáo</em> trong Gmail của bạn.
                        </li>
                        <li>
                          <strong>Đăng nhập nhanh 1-chạm:</strong> Sử dụng nút <em>"Tiếp tục với Google"</em> phía trên để đăng nhập tự động bằng Gmail trường hoặc cá nhân.
                        </li>
                        <li>
                          <strong>Sinh viên ĐHQGHN:</strong> Sử dụng email đuôi <code>@vnu.edu.vn</code> để được tự động kết nối thẳng vào hệ thống FEPN Dashboard.
                        </li>
                        <li>
                          <strong>Quên mật khẩu:</strong> Chọn tab <em>"Quên MK"</em> để nhận liên kết khôi phục mật khẩu trực tiếp trong vòng 60 giây.
                        </li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Chân trang IDP */}
        <div className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <p>© 2026 SenExam Identity Provider • Sen Heart Security Platform</p>
          <div className="flex items-center justify-center gap-3 font-semibold text-[10px]">
            <Link href="/home" className="hover:underline">Giới thiệu</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Điều khoản</Link>
            <span>•</span>
            <Link href="/privacy" className="hover:underline">Bảo mật</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function IdpAuthPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-600 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs font-bold font-mono">Đang kết nối Cổng Xác Thực Tập Trung...</p>
      </div>
    )
  }

  return <IdpAuthContent />
}
