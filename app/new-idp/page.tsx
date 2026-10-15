'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Smartphone,
  Copy,
  Download,
  Users,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  Layers,
  Shield,
  ArrowLeft,
  QrCode,
  LayoutDashboard,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-idp-body' })

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

type IdpMode = 'login' | 'signup' | 'forgot' | 'magic-link' | 'mfa' | 'grant' | 'batch_grant'

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

  // ==========================================
  // STATE CHO TAB CẤP 1 TÀI KHOẢN (ADMIN GRANT)
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

  // ==============================================================
  // STATE CHO TAB CẤP HÀNG LOẠT (BATCH GRANT: 0001 - 9999 @ domain)
  // ==============================================================
  const [batchPrefix, setBatchPrefix] = useState('student')
  const [batchStartNum, setBatchStartNum] = useState('1')
  const [batchEndNum, setBatchEndNum] = useState('20')
  const [batchPadLength, setBatchPadLength] = useState('4') // 0001
  const [batchDomain, setBatchDomain] = useState('@senexam.edu.vn')
  const [batchPasswordMode, setBatchPasswordMode] = useState<'common' | 'pattern' | 'random'>('common')
  const [batchCommonPassword, setBatchCommonPassword] = useState('SenExam@2025')
  const [batchNamePattern, setBatchNamePattern] = useState('Học sinh [num]')
  const [batchRole, setBatchRole] = useState<'student' | 'teacher' | 'collab' | 'admin'>('student')
  const [batchClass, setBatchClass] = useState('')
  const [batchSchool, setBatchSchool] = useState('')
  const [batchProvince, setBatchProvince] = useState('')
  const [batchPlanTier, setBatchPlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'>('free')
  const [batchVipDays, setBatchVipDays] = useState('30')
  const [batchSenCash, setBatchSenCash] = useState('0')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<
    Array<{
      email: string
      password: string
      fullName: string
      id?: string
      success: boolean
      error?: string
    }>
  >([])
  const [copiedBatchList, setCopiedBatchList] = useState(false)

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
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500))
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
        } else if (isMounted) {
          try {
            localStorage.removeItem('sen_cached_role')
            sessionStorage.removeItem('sen_cached_role')
          } catch {}
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra session IDP:', e)
      } finally {
        if (isMounted) {
          setAdminCheckDone(true)
        }
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
            setPendingEmail(email.trim())
            setStep('authenticator_verify')
            setLoading(false)
            return
          }
        }

        navigatePostLogin(data.user?.email || email)
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
          email: email.trim(),
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
              email: email.trim().toLowerCase(),
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
            navigatePostLogin(data.user.email || email)
            return
          }

          // Nếu cần xác thực email
          setPendingEmail(email.trim())
          setVerificationPending(true)
          setResendCooldown(60)
        }
        return
      }

      if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
        setPendingEmail(email.trim())
        setVerificationPending(true)
        setResendCooldown(60)
        setSuccessMsg('Liên kết đăng nhập bảo mật đã được gửi tới email của bạn!')
        return
      }

      if (mode === 'forgot') {
        const resetRedirect =
          typeof window !== 'undefined' ? `${window.location.origin}/new-reset-password` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolledFactorId,
        code: cleanCode,
      })

      if (error) throw error

      clearFailedAttempts()
      navigatePostLogin(pendingEmail || email)
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

  // ==========================================
  // XỬ LÝ TAB CẤP 1 TÀI KHOẢN (ADMIN GRANT)
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
        `✓ Đã cấp tài khoản thành công cho: ${data.user?.email || grantEmail} (Vai trò: ${grantRole}, Gói: ${grantPlanTier}). Người dùng có thể đăng nhập ngay!`
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

  // ==========================================================
  // XỬ LÝ CẤP TÀI KHOẢN HÀNG LOẠT (BATCH PROVISION 0001 - 9999)
  // ==========================================================
  const handleBatchProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    setBatchLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    setBatchResults([])
    setBatchProgress(10)

    try {
      const start = parseInt(batchStartNum || '1', 10)
      const end = parseInt(batchEndNum || '1', 10)
      const pad = parseInt(batchPadLength || '4', 10)

      if (isNaN(start) || isNaN(end) || end < start) {
        throw new Error('Khoảng số bắt đầu và kết thúc không hợp lệ.')
      }

      const total = end - start + 1
      if (total > 150) {
        throw new Error('Số lượng tài khoản cấp mỗi lượt tối đa là 150 tài khoản.')
      }

      setBatchProgress(30)

      const res = await fetch('/api/admin/provision-users-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: batchPrefix.trim(),
          startNum: start,
          endNum: end,
          padLength: pad,
          domain: batchDomain.trim(),
          passwordMode: batchPasswordMode,
          commonPassword: batchCommonPassword,
          namePattern: batchNamePattern.trim() || 'Học sinh [num]',
          role: batchRole,
          className: batchClass.trim() || undefined,
          school: batchSchool.trim() || undefined,
          province: batchProvince.trim() || undefined,
          planTier: batchPlanTier,
          vipDays: batchPlanTier !== 'free' ? parseInt(batchVipDays || '30', 10) : undefined,
          senCash: parseInt(batchSenCash || '0', 10),
        }),
      })

      setBatchProgress(85)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cấp tài khoản hàng loạt thất bại.')
      }

      setBatchProgress(100)
      setBatchResults(data.users || [])
      setSuccessMsg(
        `✓ Đã cấp hàng loạt xong! Thành công: ${data.createdCount}/${data.totalRequested} tài khoản. ${
          data.failedCount > 0 ? `(${data.failedCount} tài khoản lỗi hoặc đã tồn tại)` : ''
        }`
      )
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cấp tài khoản hàng loạt.')
    } finally {
      setBatchLoading(false)
    }
  }

  // Sao chép danh sách tài khoản đã cấp
  const handleCopyBatchResults = () => {
    if (!batchResults.length) return
    const text = batchResults
      .filter((u) => u.success)
      .map((u) => `${u.email}\t${u.password}\t${u.fullName}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopiedBatchList(true)
    setTimeout(() => setCopiedBatchList(false), 2000)
  }

  // Xuất file CSV danh sách tài khoản
  const handleExportCsv = () => {
    if (!batchResults.length) return
    const header = 'Email,Mật khẩu,Họ và tên,Trạng thái\n'
    const rows = batchResults
      .map((u) => `"${u.email}","${u.password}","${u.fullName}","${u.success ? 'Thành công' : u.error || 'Lỗi'}"`)
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Danh_sach_tai_khoan_SenExam_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Xuất file TXT danh sách tài khoản
  const handleExportTxt = () => {
    if (!batchResults.length) return
    const rows = batchResults
      .map((u) => `Email: ${u.email} | Mật khẩu: ${u.password} | Tên: ${u.fullName} | Trạng thái: ${u.success ? 'OK' : u.error}`)
      .join('\n')
    const blob = new Blob([rows], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Danh_sach_tai_khoan_SenExam_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Tính toán bản xem trước danh sách tài khoản hàng loạt
  const batchPreview = useMemo(() => {
    const start = parseInt(batchStartNum || '1', 10) || 1
    const end = parseInt(batchEndNum || '1', 10) || 1
    const pad = parseInt(batchPadLength || '4', 10) || 0
    let cleanDomain = (batchDomain || '').trim()
    if (cleanDomain && !cleanDomain.startsWith('@')) cleanDomain = '@' + cleanDomain
    if (!cleanDomain) cleanDomain = '@senexam.edu.vn'

    const formatNum = (num: number) => (pad > 0 ? String(num).padStart(pad, '0') : String(num))
    const firstNum = formatNum(start)
    const lastNum = formatNum(Math.max(start, end))
    const total = Math.max(0, end - start + 1)

    const firstEmail = `${batchPrefix.trim()}${firstNum}${cleanDomain}`.toLowerCase()
    const lastEmail = `${batchPrefix.trim()}${lastNum}${cleanDomain}`.toLowerCase()

    let samplePwd = ''
    if (batchPasswordMode === 'pattern') {
      samplePwd = `Sen@${firstNum}${new Date().getFullYear()}`
    } else if (batchPasswordMode === 'random') {
      samplePwd = `Sen#ab12${firstNum}`
    } else {
      samplePwd = batchCommonPassword.trim() || `SenExam@${firstNum}`
    }

    return { firstEmail, lastEmail, samplePwd, total }
  }, [batchPrefix, batchStartNum, batchEndNum, batchPadLength, batchDomain, batchPasswordMode, batchCommonPassword])

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

      {/* Top right quick controls: Dark Mode & Dashboard/Home */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2">
        {currentUser ? (
          <Link
            href="/new-dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm backdrop-blur-xl transition hover:scale-105"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-500" />
            <span>Dashboard</span>
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
      <div
        className={`relative z-10 w-full flex flex-col items-center transition-all duration-300 ${
          mode === 'batch_grant' ? 'max-w-[760px]' : 'max-w-[520px]'
        }`}
      >
        {/* BRAND HEADER */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SenExam IDP • Sen Heart Defense</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
              2FA TOTP Ready
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

          {/* MÀN HÌNH BƯỚC 2: XÁC THỰC MÃ AUTHENTICATOR (CHO TÀI KHOẢN ĐÃ BẬT 2FA) */}
          {step === 'authenticator_verify' ? (
            <form onSubmit={handleVerifyTotpLogin} className="space-y-4 animate-in fade-in zoom-in-95">
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-base">
                    Xác Thực Bảo Mật 2 Lớp (TOTP)
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Tài khoản <strong>{pendingEmail || email}</strong> đã kích hoạt bảo vệ 2FA.
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
              {/* TAB SWITCHER: ĐỒNG BỘ VỚI PHONG CÁCH SENEXAM DASHBOARD */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 rounded-2xl bg-black/5 dark:bg-white/5 p-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`flex-1 min-w-[75px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
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
                  className={`flex-1 min-w-[75px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
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
                    setMode('mfa')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`flex-1 min-w-[80px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                    mode === 'mfa'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>2FA Auth</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className={`flex-1 min-w-[70px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    mode === 'forgot'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Quên MK
                </button>

                {/* TABS DÀNH CHO ADMIN / COLLAB */}
                {isAdminUser && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('grant')
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                      className={`flex-1 min-w-[85px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                        mode === 'grant'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-sm'
                          : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                      }`}
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Cấp 1 TK</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('batch_grant')
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                      className={`flex-1 min-w-[110px] rounded-xl py-2 px-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                        mode === 'batch_grant'
                          ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black shadow-sm'
                          : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>Cấp hàng loạt</span>
                    </button>
                  </>
                )}
              </div>

              {/* ==================================================== */}
              {/* TAB: BẢO MẬT 2 LỚP AUTHENTICATOR (TOTP NHƯ FEPN) */}
              {/* ==================================================== */}
              {mode === 'mfa' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-black text-indigo-900 dark:text-indigo-200 text-sm">
                      <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0" />
                      <span>Bảo Mật 2 Lớp Bằng Ứng Dụng Authenticator (TOTP)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                      Hỗ trợ Google Authenticator, Microsoft Authenticator hoặc Apple Passwords. Mỗi lần đăng nhập, mã xác thực 6 số trên điện thoại sẽ ngăn chặn 100% các cuộc tấn công chiếm đoạt tài khoản.
                    </p>
                  </div>

                  {!currentUser ? (
                    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-5 text-center space-y-3">
                      <Lock className="h-8 w-8 text-indigo-500 mx-auto" />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          Yêu cầu đăng nhập để cấu hình 2FA
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Vui lòng đăng nhập vào tài khoản của bạn để liên kết ứng dụng Authenticator hoặc kiểm tra trạng thái bảo mật.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md transition hover:bg-indigo-700 cursor-pointer"
                      >
                        Chuyển sang Đăng Nhập
                      </button>
                    </div>
                  ) : hasMfaEnrolled ? (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <Check className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white text-sm">
                            Bảo Mật 2 Lớp Authenticator Đang Bật
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Tài khoản {currentUser.email} đã được bảo vệ bởi mã TOTP.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> FEPN Standard Armor
                        </span>
                        <button
                          type="button"
                          onClick={handleDisableMfa}
                          disabled={mfaLoading}
                          className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer"
                        >
                          {mfaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Tắt xác thực 2 lớp'}
                        </button>
                      </div>
                    </div>
                  ) : mfaQrCode ? (
                    /* FORM QUÉT QR & NHẬP MÃ KÍCH HOẠT */
                    <form onSubmit={handleConfirmMfaEnrollment} className="space-y-4">
                      <div className="text-center space-y-2">
                        <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                          1. Mở Google Authenticator trên điện thoại và quét mã QR:
                        </p>
                        <div className="p-3 bg-white rounded-2xl inline-block shadow-md border border-slate-200">
                          {mfaQrCode.startsWith('data:') ? (
                            <img src={mfaQrCode} alt="MFA QR Code" className="w-44 h-44 mx-auto" />
                          ) : (
                            <div
                              className="w-44 h-44 mx-auto [&>svg]:w-full [&>svg]:h-full"
                              dangerouslySetInnerHTML={{ __html: mfaQrCode }}
                            />
                          )}
                        </div>

                        {mfaSecret && (
                          <div className="pt-2 space-y-1">
                            <p className="text-[11px] text-slate-500">Hoặc nhập mã khóa thủ công:</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold">
                              <span>{mfaSecret}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(mfaSecret)
                                  setCopiedSecret(true)
                                  setTimeout(() => setCopiedSecret(false), 2000)
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:scale-110 transition cursor-pointer"
                                title="Sao chép"
                              >
                                {copiedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block text-center mb-1 text-xs">
                          2. Nhập mã 6 chữ số từ ứng dụng để xác nhận:
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          inputMode="numeric"
                          placeholder="••••••"
                          value={mfaSetupCode}
                          onChange={(e) => setMfaSetupCode(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full text-center tracking-[0.5em] font-mono text-xl font-black py-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                        disabled={mfaLoading || mfaSetupCode.trim().length !== 6}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg transition hover:scale-[1.01] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        <span>Xác Nhận & Bật Bảo Mật 2 Lớp</span>
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-4 space-y-4">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <QrCode className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-base">
                          Kích Hoạt Google Authenticator
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                          Tạo mã QR để liên kết ứng dụng xác thực hai bước ngay bây giờ.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={initAuthenticatorEnrollment}
                        disabled={mfaLoading}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg transition hover:scale-[1.01] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                        <span>Bắt Đầu Thiết Lập Authenticator</span>
                      </button>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> {successMsg}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB: CẤP TÀI KHOẢN HÀNG LOẠT (BATCH PROVISION 0001 - 9999) */}
              {/* ========================================================== */}
              {mode === 'batch_grant' && (
                <form onSubmit={handleBatchProvision} className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 border border-rose-500/20 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-black text-rose-900 dark:text-rose-200 text-sm">
                      <Users className="h-5 w-5 text-rose-500 shrink-0" />
                      <span>Cấp Hàng Loạt Tài Khoản Tự Động (0001 - 9999 @ domain)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                      Hệ thống sẽ tự động khởi tạo hàng loạt tài khoản học sinh/giáo viên với dãy số tuần tự, kích hoạt sẵn email và cấp quyền VIP ngay lập tức.
                    </p>
                  </div>

                  {/* Cấu hình tiền tố & Dải số tuần tự */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Tiền tố (Prefix):
                      </label>
                      <input
                        type="text"
                        placeholder="student"
                        value={batchPrefix}
                        onChange={(e) => setBatchPrefix(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Từ số:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={batchStartNum}
                        onChange={(e) => setBatchStartNum(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Đến số:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={batchEndNum}
                        onChange={(e) => setBatchEndNum(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Định dạng số:
                      </label>
                      <select
                        value={batchPadLength}
                        onChange={(e) => setBatchPadLength(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-2 text-xs font-bold outline-none focus:border-rose-500"
                      >
                        <option value="4">4 số: 0001</option>
                        <option value="3">3 số: 001</option>
                        <option value="2">2 số: 01</option>
                        <option value="0">Không thêm 0: 1</option>
                      </select>
                    </div>
                  </div>

                  {/* Đuôi Domain & Mẫu tên */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Đuôi email (@domain tùy chọn):
                      </label>
                      <input
                        type="text"
                        placeholder="@senexam.edu.vn"
                        value={batchDomain}
                        onChange={(e) => setBatchDomain(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Mẫu họ tên ([num] là số):
                      </label>
                      <input
                        type="text"
                        placeholder="Học sinh [num]"
                        value={batchNamePattern}
                        onChange={(e) => setBatchNamePattern(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {/* Chế độ mật khẩu */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Kiểu tạo mật khẩu:
                      </label>
                      <select
                        value={batchPasswordMode}
                        onChange={(e) => setBatchPasswordMode(e.target.value as any)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none"
                      >
                        <option value="common">Chung một mật khẩu</option>
                        <option value="pattern">Tự sinh theo số: Sen@[num]2025</option>
                        <option value="random">Ngẫu nhiên an toàn cho từng bạn</option>
                      </select>
                    </div>

                    {batchPasswordMode === 'common' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          Mật khẩu dùng chung:
                        </label>
                        <input
                          type="text"
                          value={batchCommonPassword}
                          onChange={(e) => setBatchCommonPassword(e.target.value)}
                          className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-bold outline-none focus:border-rose-500"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Phân quyền & Gói VIP */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Vai trò người dùng:
                      </label>
                      <select
                        value={batchRole}
                        onChange={(e) => setBatchRole(e.target.value as any)}
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
                        Gói VIP kích hoạt:
                      </label>
                      <select
                        value={batchPlanTier}
                        onChange={(e) => setBatchPlanTier(e.target.value as any)}
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

                  {/* Hạn VIP & SenCash */}
                  {batchPlanTier !== 'free' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="number"
                          placeholder="Số ngày VIP (ví dụ: 30)"
                          value={batchVipDays}
                          onChange={(e) => setBatchVipDays(e.target.value)}
                          className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-bold outline-none"
                        />
                      </div>

                      <div className="relative group">
                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                        <input
                          type="number"
                          placeholder="Tặng SenCash (ví dụ: 50)"
                          value={batchSenCash}
                          onChange={(e) => setBatchSenCash(e.target.value)}
                          className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Thông tin lớp, trường */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Lớp (vd: 12A1)"
                      value={batchClass}
                      onChange={(e) => setBatchClass(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-semibold outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Trường (vd: THPT Chuyên)"
                      value={batchSchool}
                      onChange={(e) => setBatchSchool(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-semibold outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Tỉnh/Thành phố"
                      value={batchProvince}
                      onChange={(e) => setBatchProvince(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-slate-800/70 py-3 px-3 text-xs font-semibold outline-none"
                    />
                  </div>

                  {/* KHUNG XEM TRƯỚC (LIVE PREVIEW) */}
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-xs space-y-1.5 font-mono">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-sans font-bold text-[11px]">
                      <span>Xem trước dải tài khoản:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-black">
                        Tổng cộng: {batchPreview.total} tài khoản
                      </span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-200">
                      • Mẫu đầu: <strong>{batchPreview.firstEmail}</strong> (MK: <em>{batchPreview.samplePwd}</em>)
                    </div>
                    <div className="text-slate-700 dark:text-slate-200">
                      • Mẫu cuối: <strong>{batchPreview.lastEmail}</strong>
                    </div>
                  </div>

                  {/* Thanh tiến trình khi đang chạy */}
                  {batchLoading && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Đang xử lý tạo tài khoản qua Service Role...</span>
                        <span>{batchProgress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
                          style={{ width: `${batchProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

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
                    disabled={batchLoading || batchPreview.total <= 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 text-white font-black py-3.5 px-4 text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:brightness-105 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                  >
                    {batchLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        <span>Tiến Hành Cấp {batchPreview.total} Tài Khoản</span>
                      </>
                    )}
                  </button>

                  {/* DANH SÁCH KẾT QUẢ ĐÃ TẠO */}
                  {batchResults.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                          Kết quả ({batchResults.filter((u) => u.success).length} thành công):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleCopyBatchResults}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[11px] font-bold hover:bg-black/10 transition cursor-pointer"
                          >
                            {copiedBatchList ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedBatchList ? 'Đã sao chép' : 'Sao chép tất cả'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportCsv}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[11px] font-bold hover:bg-black/10 transition cursor-pointer"
                          >
                            <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
                            <span>Tải CSV</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportTxt}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[11px] font-bold hover:bg-black/10 transition cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-indigo-500" />
                            <span>Tải TXT</span>
                          </button>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 text-[11px]">
                        {batchResults.map((u, i) => (
                          <div key={i} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="truncate">
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{u.email}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                MK: <code className="font-mono">{u.password}</code> • {u.fullName}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                u.success
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {u.success ? '✓ OK' : u.error || 'Lỗi'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* ==================================================== */}
              {/* TAB: CẤP 1 TÀI KHOẢN (ADMIN SINGLE GRANT) */}
              {/* ==================================================== */}
              {mode === 'grant' && (
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

                  {/* Thông tin mở rộng */}
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
              )}

              {/* ==================================================== */}
              {/* CÁC CHẾ ĐỘ: ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU */}
              {/* ==================================================== */}
              {mode !== 'grant' && mode !== 'batch_grant' && mode !== 'mfa' && (
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

                    {/* Email */}
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
                      <input
                        type="email"
                        placeholder="Địa chỉ Email của bạn *"
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-600 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs font-bold font-mono">Đang kết nối Cổng Xác Thực Tập Trung...</p>
      </div>
    )
  }

  return <IdpAuthContent />
}
