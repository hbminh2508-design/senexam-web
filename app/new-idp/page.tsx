'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { signInWithGoogle } from '@/lib/authHelper'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, getAccentHex } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  GraduationCap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Sun,
  Moon,
  HelpCircle,
  Building2,
  MapPin,
  Phone,
  ShieldAlert,
  Smartphone,
  Copy,
  Check,
  ArrowLeft,
  QrCode,
  LayoutDashboard,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-body' })

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

type IdpMode = 'login' | 'signup' | 'forgot' | 'magic-link' | 'mfa'

function IdpAuthContent() {
  const router = useRouter()
  const { themeColor } = useNewUiPrefs()

  const [mode, setMode] = useState<IdpMode>('login')
  const [step, setStep] = useState<'form' | 'authenticator_verify'>('form')
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

  // Current session & Admin / Collab status (với bộ nhớ đệm cache tức thì)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdminUser, setIsAdminUser] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedRole = localStorage.getItem('sen_cached_role') || sessionStorage.getItem('sen_cached_role')
        return cachedRole === 'admin' || cachedRole === 'collab'
      } catch {
        return false
      }
    }
    return false
  })

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
  // STATE CHO AUTHENTICATOR (2FA TOTP NHƯ FEPN)
  // ==========================================
  const [enrolledFactorId, setEnrolledFactorId] = useState('')
  const [totpVerifyInput, setTotpVerifyInput] = useState('')
  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaSetupCode, setMfaSetupCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

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

          if (params.get('password_changed') === '1' || params.get('changed') === '1') {
            setSuccessMsg('Đổi mật khẩu thành công! Tất cả thiết bị cũ đã được đăng xuất an toàn. Vui lòng đăng nhập lại với mật khẩu mới.')
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

    // Tối ưu tốc độ kiểm tra tài khoản (Non-blocking & timeout protection)
    const checkSessionAndMfa = async () => {
      try {
        const isPasswordChanged = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('password_changed') === '1' || new URLSearchParams(window.location.search).get('changed') === '1')
        if (isPasswordChanged) {
          await supabase.auth.signOut().catch(() => {})
          if (isMounted) setCurrentUser(null)
          return
        }

        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        const sessionPromise = supabase.auth.getSession().then((res) => res?.data?.session || null).catch(() => null)
        const session = await Promise.race([sessionPromise, timeoutPromise])

        const user = session?.user
        if (user && isMounted) {
          setCurrentUser(user)

          // 1. Kiểm tra quyền Admin / Collab
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()

            const role = profile?.role
            if (isMounted) {
              const isAdmin = role === 'admin' || role === 'collab'
              setIsAdminUser(isAdmin)
              try {
                if (isAdmin) {
                  localStorage.setItem('sen_cached_role', role)
                  sessionStorage.setItem('sen_cached_role', role)
                } else {
                  localStorage.removeItem('sen_cached_role')
                  sessionStorage.removeItem('sen_cached_role')
                }
              } catch {}
            }
          } catch (e) {
            console.warn('Lỗi đọc role profile:', e)
          }

          // 2. Kiểm tra xem tài khoản đã kích hoạt MFA TOTP chưa
          try {
            const { data: factorsData } = await supabase.auth.mfa.listFactors()
            const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified')
            if (isMounted && verifiedFactor) {
              setHasMfaEnrolled(true)
              setEnrolledFactorId(verifiedFactor.id)
            }
          } catch (mfaErr) {
            console.warn('Lỗi kiểm tra MFA factors:', mfaErr)
          }
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra session IDP:', e)
      }
    }

    checkSessionAndMfa()

    return () => {
      isMounted = false
    }
  }, [router])

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
    if (!password) return { score: 0, label: '', color: 'bg-slate-300' }
    let s = 0
    if (password.length >= 6) s += 1
    if (password.length >= 10) s += 1
    if (/[A-Z]/.test(password)) s += 1
    if (/[0-9]/.test(password)) s += 1
    if (/[^A-Za-z0-9]/.test(password)) s += 1

    if (s <= 2) return { score: 1, label: 'Mật khẩu yếu', color: 'bg-rose-500' }
    if (s <= 3) return { score: 2, label: 'Mật khẩu trung bình', color: 'bg-amber-500' }
    return { score: 3, label: 'Mật khẩu mạnh & an toàn', color: 'bg-emerald-500' }
  }, [password])

  // Ghi nhận lần nhập sai để chống Brute-force
  const recordFailedAttempt = () => {
    try {
      const current = parseInt(localStorage.getItem('idp_failed_attempts') || '0', 10) + 1
      localStorage.setItem('idp_failed_attempts', String(current))
      if (current >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000
        localStorage.setItem('idp_lockout_until', String(lockUntil))
        setLockoutTimer(LOCKOUT_SECONDS)
        setErrorMsg(`Hệ thống bảo vệ đã tạm khóa do nhập sai liên tiếp ${MAX_FAILED_ATTEMPTS} lần. Vui lòng chờ 60 giây.`)
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
  const navigatePostLogin = async (userEmail: string, userId?: string) => {
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

    // Nếu người dùng là Quản trị viên (Admin) hoặc Cộng tác viên -> Điều hướng thẳng đến new-admin-dashboard!
    try {
      let role = ''
      if (userId) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        role = p?.role || ''
      } else {
        role = localStorage.getItem('sen_cached_role') || ''
      }

      if (
        role === 'admin' ||
        role === 'collab' ||
        emailLower === 'admin@senexam.me' ||
        emailLower === 'hoangbinhminh2508@gmail.com'
      ) {
        try {
          localStorage.setItem('sen_cached_role', role || 'admin')
          sessionStorage.setItem('sen_cached_role', role || 'admin')
        } catch {}
        router.push('/new-admin-dashboard')
        return
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra quyền Admin khi điều hướng:', e)
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
      let targetEmail = email.trim()

      // Hỗ trợ đăng nhập nhanh bằng username 'admin'
      if (targetEmail.toLowerCase() === 'admin') {
        targetEmail = 'admin@senexam.me'
      }

      if (mode === 'login') {
        // Tự động kiểm tra và khởi tạo tài khoản admin nếu người dùng nhập mật khẩu admin-d/m/y
        if (
          targetEmail.toLowerCase() === 'admin@senexam.me' &&
          password.startsWith('admin-')
        ) {
          try {
            await fetch('/api/admin/ensure-admin-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: targetEmail, password }),
            })
          } catch (ensureErr) {
            console.warn('Lỗi auto ensure admin:', ensureErr)
          }
        }

        // ĐĂNG NHẬP
        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
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

          // Kiểm tra xem tài khoản này đã kích hoạt Authenticator (TOTP) chưa
          let activeTotpFactorId = ''
          try {
            const userFactors = (data.user as any)?.factors || []
            const verifiedUserFactor = userFactors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified')
            if (verifiedUserFactor) {
              activeTotpFactorId = verifiedUserFactor.id
            } else {
              const { data: factorsData } = await supabase.auth.mfa.listFactors()
              const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified')
              if (verifiedFactor) {
                activeTotpFactorId = verifiedFactor.id
              }
            }
          } catch (mfaErr) {
            console.warn('Lỗi kiểm tra TOTP factors:', mfaErr)
          }

          // Nếu tài khoản ĐÃ bật Authenticator -> Chuyển sang màn hình nhập mã 6 số
          if (activeTotpFactorId) {
            setEnrolledFactorId(activeTotpFactorId)
            setPendingEmail(targetEmail)
            setStep('authenticator_verify')
            setLoading(false)
            return
          }
        }

        navigatePostLogin(data.user?.email || targetEmail, data.user?.id)
        return
      }

      if (mode === 'signup') {
        // ĐĂNG KÝ
        if (!fullName.trim()) throw new Error('Vui lòng nhập họ và tên của bạn.')
        if (!phone.trim()) throw new Error('Vui lòng nhập số điện thoại để kích hoạt tài khoản.')
        if (!className.trim()) throw new Error('Vui lòng nhập lớp học của bạn.')
        if (!school.trim()) throw new Error('Vui lòng nhập tên trường THPT hoặc Đại học.')
        if (!province.trim()) throw new Error('Vui lòng nhập tỉnh hoặc thành phố của bạn.')
        if (password.length < 6) throw new Error('Mật khẩu phải từ 6 ký tự trở lên.')

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim(),
              phone_number: phone.trim(),
              phone: phone.trim(),
              class_name: className.trim(),
              school: school.trim(),
              province: province.trim(),
            },
          },
        })

        if (error) throw error

        if (data.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: targetEmail.toLowerCase(),
              full_name: fullName.trim(),
              phone_number: phone.trim(),
              phone: phone.trim(),
              class_name: className.trim(),
              school: school.trim(),
              province: province.trim(),
              role: 'student',
              plan_tier: 'free',
            })
          } catch (pErr) {
            console.warn('Lỗi lưu thông tin profile đăng ký:', pErr)
          }

          if (data.session) {
            navigatePostLogin(data.user.email || targetEmail, data.user.id)
            return
          }

          setPendingEmail(targetEmail)
          setVerificationPending(true)
          setResendCooldown(60)
        }
        return
      }

      if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
        setPendingEmail(targetEmail)
        setVerificationPending(true)
        setResendCooldown(60)
        setSuccessMsg('Liên kết đăng nhập bảo mật đã được gửi tới email của bạn!')
        return
      }

      if (mode === 'forgot') {
        const resetRedirect =
          typeof window !== 'undefined' ? `${window.location.origin}/new-reset-password` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: resetRedirect,
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

  // Xử lý xác nhận mã Authenticator (TOTP Login Verification)
  const handleVerifyTotpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = totpVerifyInput.trim().replace(/[^0-9]/g, '')
    if (cleanCode.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolledFactorId,
        code: cleanCode,
      })

      if (error) throw error

      clearFailedAttempts()
      navigatePostLogin(pendingEmail || email, data?.user?.id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã xác thực từ ứng dụng không chính xác hoặc đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }

  // Khởi tạo quy trình thiết lập Authenticator (MFA TOTP Enrollment)
  const initAuthenticatorEnrollment = async () => {
    setMfaLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'SenExam',
      })

      if (error) throw error

      if (data) {
        setMfaFactorId(data.id)
        if (data.totp?.qr_code) {
          setMfaQrCode(data.totp.qr_code)
        }
        if (data.totp?.secret) {
          setMfaSecret(data.totp.secret)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể khởi tạo mã cài đặt Authenticator. Vui lòng thử lại sau.')
    } finally {
      setMfaLoading(false)
    }
  }

  // Xác nhận kích hoạt Authenticator lần đầu
  const handleConfirmMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = mfaSetupCode.trim().replace(/[^0-9]/g, '')
    if (cleanCode.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }

    if (!mfaFactorId) {
      setErrorMsg('Phiên kích hoạt đã hết hạn. Vui lòng tải lại trang.')
      return
    }

    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: cleanCode,
      })

      if (error) throw error

      setHasMfaEnrolled(true)
      setEnrolledFactorId(mfaFactorId)
      setMfaQrCode('')
      setMfaSecret('')
      setMfaSetupCode('')
      setSuccessMsg('🎉 Kích hoạt bảo mật 2 lớp qua Authenticator thành công!')
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã xác thực không đúng hoặc đã hết hạn. Vui lòng thử lại!')
    } finally {
      setMfaLoading(false)
    }
  }

  // Tắt xác thực 2 lớp Authenticator
  const handleDisableMfa = async () => {
    if (!enrolledFactorId) return
    const conf = window.confirm('Bạn có chắc chắn muốn tắt tính năng bảo mật 2 lớp Authenticator không?')
    if (!conf) return

    setMfaLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: enrolledFactorId,
      })
      if (error) throw error

      setHasMfaEnrolled(false)
      setEnrolledFactorId('')
      setSuccessMsg('Đã hủy kích hoạt xác thực 2 lớp thành công.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể hủy xác thực 2 lớp. Vui lòng thử lại.')
    } finally {
      setMfaLoading(false)
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
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(244, 63, 94, 0.08), transparent 30%), #0F172A'
          : 'radial-gradient(circle at 10% 10%, rgba(254, 215, 170, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(199, 210, 254, 0.35), transparent 30%), #F4F7FB',
        color: 'var(--text)',
      }}
    >
      {/* Nền nhẹ trang trí */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="fixed inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(var(--text) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top right quick controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2">
        {currentUser ? (
          <Link
            href={isAdminUser ? '/new-admin-dashboard' : '/new-dashboard'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm backdrop-blur-xl transition hover:scale-105"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-500" />
            <span>{isAdminUser ? 'Admin Portal' : 'Dashboard'}</span>
          </Link>
        ) : (
          <Link
            href="/home"
            className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm backdrop-blur-xl transition hover:scale-105"
          >
            Giới thiệu
          </Link>
        )}
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
        {/* BRAND HEADER */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SenExam IDP</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
              Sen 2FA Ready
            </span>
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

          <p
            className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto"
            style={{ fontFamily: 'var(--font-idp-body)' }}
          >
            {targetService === 'seb'
              ? 'Cổng Xác Thực Safe Exam Browser — Khảo thí an toàn, chống gian lận & bảo mật 2 lớp.'
              : 'Cổng Định Danh Tập Trung — Một tài khoản cho toàn bộ hệ sinh thái SenExam.'}
          </p>
        </div>

        {/* Card Form */}
        <div className="w-full rounded-[32px] border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300">
          {/* CẢNH BÁO BRUTE-FORCE LOCKOUT */}
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
                  Sen Protection Active
                </span>
              </div>
            </div>
          )}

          {/* MÀN HÌNH BƯỚC 2: XÁC THỰC MÃ AUTHENTICATOR (CHO TÀI KHOẢN ĐÃ BẬT 2FA) */}
          {step === 'authenticator_verify' ? (
            <form onSubmit={handleVerifyTotpLogin} className="space-y-4 animate-in fade-in zoom-in-95">
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-base">
                    Xác Thực Sen 2FA (TOTP)
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Tài khoản <strong>{pendingEmail || email}</strong> đã kích hoạt bảo vệ Sen 2FA.
                  </p>
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  Mở ứng dụng Google Authenticator hoặc Microsoft Authenticator để lấy mã 6 số.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-center mb-1 text-xs">
                  Nhập mã 6 chữ số hiển thị trên điện thoại:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  placeholder="••••••"
                  value={totpVerifyInput}
                  onChange={(e) => setTotpVerifyInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl font-black py-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                  required
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || totpVerifyInput.trim().length !== 6}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg shadow-indigo-500/25 transition hover:scale-[1.01] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>Xác Nhận & Đăng Nhập</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('form')
                    setErrorMsg('')
                  }}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Quay lại đăng nhập
                </button>
              </div>
            </form>
          ) : verificationPending ? (
            /* MÀN HÌNH CHỜ XÁC NHẬN EMAIL */
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
              {/* TAB SWITCHER: 3 TAB XÁC THỰC CÔNG KHAI (ĐĂNG NHẬP, ĐĂNG KÝ, QUÊN MK) */}
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`rounded-xl py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
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
                  className={`rounded-xl py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
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
                  className={`rounded-xl py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    mode === 'forgot'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Quên MK
                </button>
              </div>

              {/* ==================================================== */}
              {/* CÁC CHẾ ĐỘ: ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU */}
              {/* ==================================================== */}
              <>
                  {/* NÚT GOOGLE AUTH */}
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
                    {/* Thông tin học sinh khi đăng ký mới */}
                    {mode === 'signup' && (
                      <>
                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                          <input
                            type="text"
                            placeholder="Họ và tên của bạn *"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                          <input
                            type="tel"
                            placeholder="Số điện thoại của bạn (bắt buộc) *"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-2">
                          <div className="relative group">
                            <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                            <input
                              type="text"
                              placeholder="Lớp (vd: 12A1) *"
                              value={className}
                              onChange={(e) => setClassName(e.target.value)}
                              required
                              className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>

                          <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                            <input
                              type="text"
                              placeholder="Tỉnh / Thành phố *"
                              value={province}
                              onChange={(e) => setProvince(e.target.value)}
                              required
                              className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        </div>

                        <div className="relative group animate-in fade-in slide-in-from-top-2">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                          <input
                            type="text"
                            placeholder="Trường THPT / Đại học của bạn *"
                            value={school}
                            onChange={(e) => setSchool(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </>
                    )}

                    {/* Email / Tên tài khoản */}
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                      <input
                        type="text"
                        placeholder={mode === 'login' ? 'Email hoặc tên tài khoản (vd: admin) *' : 'Địa chỉ Email của bạn *'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    {/* Mật khẩu */}
                    {mode !== 'magic-link' && mode !== 'forgot' && (
                      <div className="space-y-1.5">
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={mode === 'signup' ? 'Mật khẩu bảo mật (tối thiểu 6 ký tự) *' : 'Mật khẩu của bạn *'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3.5 pl-11 pr-11 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
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
                        <ShieldCheck className="h-4 w-4 text-amber-500" /> Hướng Dẫn & Trợ Giúp:
                      </p>
                      <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed font-semibold">
                        <li>
                          <strong>Chưa nhận được email xác thực:</strong> Hãy kiểm tra thêm mục <em>Thư rác (Spam)</em> hoặc <em>Quảng cáo</em> trong Gmail của bạn.
                        </li>
                        <li>
                          <strong>Đăng nhập nhanh 1-chạm:</strong> Sử dụng nút <em>"Tiếp tục với Google"</em> phía trên để đăng nhập tự động.
                        </li>
                        <li>
                          <strong>Sinh viên ĐHQGHN:</strong> Sử dụng email đuôi <code>@vnu.edu.vn</code> để được tự động kết nối vào hệ thống FEPN Dashboard.
                        </li>
                        <li>
                          <strong>Quản trị viên (Admin):</strong> Nhập tên tài khoản <code>admin</code> và mật khẩu để chuyển trực tiếp đến New-Admin Portal.
                        </li>
                      </ul>
                    </div>
                  )}
                </>
            </>
          )}
        </div>

        {/* Chân trang IDP */}
        <div className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <p>© 2026 SenExam Identity Provider • FEPN Defense Platform</p>
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
      <ModernLoading
        themeColor="indigo"
        title="SenExam Cổng Định Danh IDP 2.0"
        subtitle="Đang kết nối cổng xác thực tập trung & bảo mật phiên làm việc..."
      />
    )
  }

  return <IdpAuthContent />
}
