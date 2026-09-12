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
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  KeyRound,
  Mail,
  Smartphone,
  Copy,
  ArrowRight,
  RefreshCw,
  ArrowLeft,
  QrCode,
  AlertTriangle,
  Timer,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

type AuthStep = 'credentials' | 'otp' | 'authenticator_setup' | 'authenticator_verify'

// Helper phát hiện thiết bị người dùng
function getClientDeviceInfo() {
  if (typeof window === 'undefined') return { browser: 'Trình duyệt Web', os: 'Hệ điều hành', deviceName: 'Thiết bị Web' }
  const ua = navigator.userAgent
  let browser = 'Trình duyệt'
  if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('Chrome/')) browser = 'Google Chrome'
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari'

  let os = 'Hệ điều hành'
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone')) os = 'iPhone'
  else if (ua.includes('iPad')) os = 'iPad'
  else if (ua.includes('Linux')) os = 'Linux'

  const deviceName = `${browser} trên ${os}`
  return { browser, os, deviceName }
}

export default function FepnLoginPage() {
  const router = useRouter()
  // Cố định Light Mode cho các trang FEPN
  const isDark = false

  const [step, setStep] = useState<AuthStep>('credentials')
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'qr'>('credentials')

  // Form states
  const [mssv, setMssv] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Khóa đăng nhập lũy tiến
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [isPermanentLocked, setIsPermanentLocked] = useState(false)

  // Fast QR Login states
  const [qrToken, setQrToken] = useState('')
  const [qrShortCode, setQrShortCode] = useState('')
  const [qrVerifyDigit, setQrVerifyDigit] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [qrExpiresIn, setQrExpiresIn] = useState(180)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrApproved, setQrApproved] = useState(false)

  // Fast QR Login 2-way verification states (Challenge-Response)
  const [qrStep, setQrStep] = useState<'qr' | 'awaiting_code'>('qr')
  const [completionCodeInput, setCompletionCodeInput] = useState('')
  const [isSubmittingCode, setIsSubmittingCode] = useState(false)
  const [codeErrorMsg, setCodeErrorMsg] = useState('')
  const [approverDeviceName, setApproverDeviceName] = useState('')

  // Forgot password states
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request')
  const [resetOtpCode, setResetOtpCode] = useState('')
  const [newResetPassword, setNewResetPassword] = useState('')
  const [confirmResetPassword, setConfirmResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)

  // OTP Verification states
  const [pendingEmail, setPendingEmail] = useState('')
  const [otpType, setOtpType] = useState<'signup' | 'email'>('signup')
  const [otpCode, setOtpCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Authenticator (TOTP) states
  const [enrolledFactorId, setEnrolledFactorId] = useState('')
  const [totpVerifyInput, setTotpVerifyInput] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [totpInput, setTotpInput] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // 1. Enforce Light Mode & FEPN Branding
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    if (typeof document !== 'undefined') {
      document.title = 'Tài liệu FEPN - Đăng Nhập Xác Thực VNU'
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

  // Đọc dữ liệu Lưu đăng nhập (Remember Me) từ localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMssv = localStorage.getItem('fepn_saved_mssv')
      const savedRemember = localStorage.getItem('fepn_remember_me')
      if (savedMssv) {
        setMssv(savedMssv)
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === 'true')
      }
    }
  }, [])

  // Đếm ngược khóa tài khoản lũy tiến
  useEffect(() => {
    if (lockoutSeconds <= 0) return
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [lockoutSeconds])

  // Cooldown đếm ngược gửi lại OTP đăng nhập / đăng ký
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Cooldown đếm ngược gửi lại mã đặt lại mật khẩu
  useEffect(() => {
    if (resetCooldown <= 0) return
    const timer = setInterval(() => {
      setResetCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resetCooldown])

  // Chuẩn hóa email sinh viên VNU: nhận MSSV và tự động gắn đuôi @vnu.edu.vn
  const getFullVnuEmail = (input: string) => {
    const clean = input.trim().toLowerCase()
    if (clean.includes('@')) {
      return clean
    }
    return `${clean}@vnu.edu.vn`
  }

  // Định dạng thời gian khóa (phút:giây hoặc giờ phút)
  const formatLockoutTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h} giờ ${m.toString().padStart(2, '0')} phút ${s.toString().padStart(2, '0')} giây`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Khởi tạo mã QR đăng nhập nhanh
  const initQrCode = async () => {
    setQrLoading(true)
    setErrorMsg('')
    setCodeErrorMsg('')
    setQrStep('qr')
    setCompletionCodeInput('')
    setApproverDeviceName('')
    try {
      const dev = getClientDeviceInfo()
      const res = await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          deviceInfo: {
            browser: dev.browser,
            os: dev.os,
            deviceName: dev.deviceName,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setQrToken(data.token)
        setQrShortCode(data.shortCode)
        setQrVerifyDigit(data.verifyDigit || '')
        setQrImageUrl(data.qrImageUrl)
        setQrExpiresIn(data.expiresInSeconds || 180)
        setQrApproved(false)
      } else {
        setErrorMsg(data.error || 'Không thể tạo mã QR đăng nhập.')
      }
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối máy chủ tạo mã QR.')
    } finally {
      setQrLoading(false)
    }
  }

  // Tự động khởi tạo QR khi chuyển sang chế độ QR
  useEffect(() => {
    if (loginMethod === 'qr' && !qrToken) {
      initQrCode()
    }
  }, [loginMethod])

  // Đếm ngược thời hạn mã QR (3 phút)
  useEffect(() => {
    if (loginMethod !== 'qr' || qrExpiresIn <= 0) return
    const t = setInterval(() => {
      setQrExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(t)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [loginMethod, qrExpiresIn])

  // Polling trạng thái phê duyệt mã QR từ Máy B
  useEffect(() => {
    if (loginMethod !== 'qr' || !qrToken || qrApproved || qrExpiresIn <= 0) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/fepn-auth/qr-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', token: qrToken }),
        })
        const data = await res.json()

        // BƯỚC BẢO MẬT 2 CHIỀU: MÁY B ĐÃ PHÊ DUYỆT -> YÊU CẦU MÁY A NHẬP MÃ 6 SỐ
        if (data.status === 'awaiting_code') {
          setQrStep('awaiting_code')
          if (data.deviceName) {
            setApproverDeviceName(data.deviceName)
          }
        }

        if (data.status === 'approved') {
          setQrApproved(true)
          clearInterval(interval)
          setSuccessMsg('🎉 Đã xác nhận đăng nhập thành công từ thiết bị!')

          // Kích hoạt phiên đăng nhập Supabase nếu có authTokenHash
          if (data.authTokenHash) {
            try {
              await supabase.auth.verifyOtp({
                token_hash: data.authTokenHash,
                type: 'magiclink',
              })
            } catch (vErr) {
              console.warn('verifyOtp notice:', vErr)
            }
          }

          // Ghi nhận session thiết bị
          const devInfo = getClientDeviceInfo()
          let devId = localStorage.getItem('fepn_device_id')
          if (!devId) {
            devId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
            localStorage.setItem('fepn_device_id', devId)
          }
          await fetch('/api/fepn-auth/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record',
              email: data.email,
              deviceId: devId,
              deviceName: devInfo.deviceName,
              browser: devInfo.browser,
              os: devInfo.os,
            }),
          }).catch(() => {})

          setTimeout(() => {
            navigateAfterLogin()
          }, 800)
        }
      } catch (e) {}
    }, 2000)

    return () => clearInterval(interval)
  }, [loginMethod, qrToken, qrApproved, qrExpiresIn])

  // Máy A gửi mã xác thực 6 số (Challenge-Response) để hoàn tất đăng nhập
  const handleCompleteQrLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCode = completionCodeInput.replace(/[\s-]/g, '').trim()
    if (cleanCode.length < 6) {
      setCodeErrorMsg('Vui lòng nhập đủ 6 số xác thực hiển thị trên thiết bị của bạn.')
      return
    }

    setIsSubmittingCode(true)
    setCodeErrorMsg('')
    try {
      const res = await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_login',
          token: qrToken,
          completionCode: cleanCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Mã xác thực không hợp lệ')
      }

      setQrApproved(true)
      setSuccessMsg('🎉 Xác thực thành công! Đang chuyển hướng vào hệ thống...')

      if (data.authTokenHash) {
        try {
          await supabase.auth.verifyOtp({
            token_hash: data.authTokenHash,
            type: 'magiclink',
          })
        } catch (vErr) {
          console.warn('verifyOtp notice:', vErr)
        }
      }

      // Ghi nhận session thiết bị
      const devInfo = getClientDeviceInfo()
      let devId = localStorage.getItem('fepn_device_id')
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
        localStorage.setItem('fepn_device_id', devId)
      }

      await fetch('/api/fepn-auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          email: data.email,
          deviceId: devId,
          deviceName: devInfo.deviceName,
          browser: devInfo.browser,
          os: devInfo.os,
        }),
      }).catch(() => {})

      setTimeout(() => {
        navigateAfterLogin()
      }, 600)
    } catch (err: any) {
      setCodeErrorMsg(err.message || 'Mã xác thực không đúng. Vui lòng kiểm tra lại 6 số trên màn hình thiết bị kia.')
    } finally {
      setIsSubmittingCode(false)
    }
  }

  // Quy chuẩn mật khẩu: Tối thiểu 8 ký tự, 1 hoa, 1 ký tự đặc biệt, 1 số
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const isPasswordValid = hasMinLength && hasUppercase && hasSpecialChar && hasDigit

  // Điểm đến sau khi hoàn tất đăng nhập
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

  // Khởi tạo quy trình thiết lập Authenticator App (MFA TOTP)
  const initAuthenticatorSetup = async () => {
    setMfaLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'FEPN - UET',
      })

      if (error) {
        // Nếu MFA chưa được bật trong cài đặt Supabase, người dùng vẫn có thể bỏ qua
        console.warn('MFA Enroll notice:', error.message)
      } else if (data) {
        setMfaFactorId(data.id)
        if (data.totp?.qr_code) {
          setMfaQrCode(data.totp.qr_code)
        }
        if (data.totp?.secret) {
          setMfaSecret(data.totp.secret)
        }
      }
    } catch (err: any) {
      console.warn('Không thể khởi tạo MFA:', err.message)
    } finally {
      setMfaLoading(false)
    }
  }

  // Bước 1: Xử lý Đăng Nhập / Đăng Ký thông tin
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!mssv.trim()) {
      setErrorMsg('Vui lòng nhập Mã số sinh viên (MSSV) của bạn.')
      return
    }

    // Chỉ kiểm tra tiêu chuẩn mật khẩu mạnh khi ĐĂNG KÝ
    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Vui lòng nhập họ và tên của bạn.')
        return
      }
      if (!isPasswordValid) {
        setErrorMsg(
          'Mật khẩu chưa đáp ứng tiêu chuẩn an toàn: Tối thiểu 8 ký tự, có ít nhất 1 chữ viết hoa, 1 ký tự đặc biệt và 1 chữ số.'
        )
        return
      }
    } else {
      // ĐĂNG NHẬP: chỉ cần mật khẩu không rỗng
      if (!password) {
        setErrorMsg('Vui lòng nhập mật khẩu của bạn.')
        return
      }

      // Kiểm tra trạng thái khóa tài khoản hiện tại
      if (isPermanentLocked) {
        setErrorMsg('Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá 30 lần. Vui lòng liên hệ với minhhb@senexam.me để được hỗ trợ.')
        return
      }
      if (lockoutSeconds > 0) {
        setErrorMsg(`Tài khoản đang bị tạm khóa. Vui lòng thử lại sau: ${formatLockoutTime(lockoutSeconds)}`)
        return
      }
    }

    const fullEmail = getFullVnuEmail(mssv)
    setPendingEmail(fullEmail)
    setLoading(true)

    const redirectUrl =
      typeof window !== 'undefined'
        ? window.location.hostname === 'localhost'
          ? `${window.location.origin}/fepn-dashboard`
          : 'https://tsv.fepn.senexam.me/fepn-dashboard'
        : undefined

    try {
      if (mode === 'login') {
        // Kiểm tra lockout trước khi gọi Supabase
        try {
          const chkRes = await fetch('/api/fepn-auth/login-lockout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check', email: fullEmail }),
          })
          const chkData = await chkRes.json()
          if (chkData.isLocked) {
            if (chkData.isPermanent) {
              setIsPermanentLocked(true)
              setErrorMsg('Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá 30 lần. Vui lòng liên hệ với minhhb@senexam.me để được hỗ trợ.')
              setLoading(false)
              return
            }
            setLockoutSeconds(chkData.remainingSeconds || 60)
            setErrorMsg(`Tài khoản đang bị tạm khóa (${chkData.lockoutLevel || 'tạm thời'}). Vui lòng thử lại sau: ${formatLockoutTime(chkData.remainingSeconds || 60)}`)
            setLoading(false)
            return
          }
        } catch (lockCheckErr) {
          console.warn('Lỗi kiểm tra khóa:', lockCheckErr)
        }

        // ĐĂNG NHẬP: Xác thực mật khẩu
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fullEmail,
          password,
        })

        if (signInError) {
          // Ghi nhận lần nhập sai để tính lũy tiến khóa 1p, 3p, 5p, 10p, 1h, 3h hoặc vĩnh viễn
          try {
            const failRes = await fetch('/api/fepn-auth/login-lockout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'record_fail', email: fullEmail }),
            })
            const failData = await failRes.json()
            if (failData.isLocked) {
              if (failData.isPermanent) {
                setIsPermanentLocked(true)
                setErrorMsg('Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá 30 lần. Vui lòng liên hệ với minhhb@senexam.me để được hỗ trợ.')
                setLoading(false)
                return
              } else {
                setLockoutSeconds(failData.remainingSeconds || 60)
                setErrorMsg(`Tài khoản đã bị tạm khóa ${failData.lockoutLevel} do nhập sai liên tiếp ${failData.failedAttempts} lần. Vui lòng thử lại sau: ${formatLockoutTime(failData.remainingSeconds || 60)}`)
                setLoading(false)
                return
              }
            } else {
              const nextTier = (Math.floor(failData.failedAttempts / 5) + 1) * 5
              const remainingTries = nextTier - failData.failedAttempts
              setErrorMsg(`Mã số sinh viên hoặc mật khẩu không chính xác! Bạn đã nhập sai ${failData.failedAttempts} lần (còn ${remainingTries} lần thử trước khi bị tạm khóa).`)
              setLoading(false)
              return
            }
          } catch (lockErr) {}
          throw signInError
        }

        // Đăng nhập thành công -> Xử lý Remember Me
        if (rememberMe) {
          localStorage.setItem('fepn_saved_mssv', mssv.trim())
          localStorage.setItem('fepn_remember_me', 'true')
        } else {
          localStorage.removeItem('fepn_saved_mssv')
          localStorage.setItem('fepn_remember_me', 'false')
        }

        // Reset lockout về 0
        fetch('/api/fepn-auth/login-lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', email: fullEmail }),
        }).catch(() => {})

        // Ghi nhận session thiết bị
        const devInfo = getClientDeviceInfo()
        let devId = localStorage.getItem('fepn_device_id')
        if (!devId) {
          devId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
          localStorage.setItem('fepn_device_id', devId)
        }
        fetch('/api/fepn-auth/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record',
            userId: signInData.user.id,
            email: fullEmail,
            deviceId: devId,
            deviceName: devInfo.deviceName,
            browser: devInfo.browser,
            os: devInfo.os,
          }),
        }).catch(() => {})

        // Kiểm tra xem tài khoản đã liên kết ứng dụng Authenticator (TOTP) hay chưa
        let activeTotpFactorId = ''
        try {
          const userFactors = (signInData.user as any)?.factors || []
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
          console.warn('Lỗi kiểm tra factors:', mfaErr)
        }

        // Nếu người dùng ĐÃ liên kết Authenticator -> Hỏi mã 6 số từ Authenticator thay vì gửi mail!
        if (activeTotpFactorId) {
          setEnrolledFactorId(activeTotpFactorId)
          setStep('authenticator_verify')
          setTotpVerifyInput('')
          setSuccessMsg('Tài khoản đã liên kết Authenticator. Vui lòng nhập mã xác thực từ ứng dụng.')
          return
        }

        // Nếu CHƯA liên kết Authenticator -> Gửi mã OTP xác minh về email VNU (kèm URL callback về FEPN)
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: fullEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectUrl,
          },
        })

        if (otpError) {
          console.warn('Gửi OTP login cảnh báo:', otpError.message)
        }

        setOtpType('magiclink' as any)
        setStep('otp')
        setResendCooldown(60)
        setSuccessMsg(`Mã OTP xác thực đăng nhập đã được gửi về hòm thư ${fullEmail}.`)
      } else {
        // ĐĂNG KÝ: Tạo tài khoản mới
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: fullEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim(),
              mssv: mssv.trim(),
            },
          },
        })

        if (signUpError) throw signUpError

        if (signUpData.user) {
          await ensureStudentProfile(signUpData.user.id)
          try {
            await supabase.from('profiles').update({
              full_name: fullName.trim(),
            }).eq('id', signUpData.user.id)
          } catch {}
        }

        setOtpType('signup')
        setStep('otp')
        setResendCooldown(60)
        setSuccessMsg(`Mã OTP kích hoạt tài khoản đã được gửi về hòm thư ${fullEmail}.`)
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

  // Xác nhận đăng nhập bằng mã 6 số từ ứng dụng Authenticator
  const handleVerifyAuthenticatorLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = totpVerifyInput.trim()
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }

    if (!enrolledFactorId) {
      navigateAfterLogin()
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolledFactorId,
        code: cleanCode,
      })

      if (error) throw error

      navigateAfterLogin()
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã Authenticator không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại!')
    } finally {
      setLoading(false)
    }
  }

  // Fallback: Khi người dùng không thể truy cập Authenticator -> Chuyển sang xác minh qua Email
  const handleFallbackToEmailOtp = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const redirectUrl =
      typeof window !== 'undefined'
        ? window.location.hostname === 'localhost'
          ? `${window.location.origin}/fepn-dashboard`
          : 'https://tsv.fepn.senexam.me/fepn-dashboard'
        : undefined

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: pendingEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectUrl,
        },
      })

      if (otpError) throw otpError

      setOtpType('magiclink' as any)
      setStep('otp')
      setResendCooldown(60)
      setSuccessMsg(`Đã chuyển sang xác minh Email. Mã OTP đã được gửi về hòm thư ${pendingEmail}.`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi mã OTP về email. Vui lòng thử lại sau!')
    } finally {
      setLoading(false)
    }
  }

  // Bước 2: Xác nhận mã OTP Email
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanOtp = otpCode.trim()
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg('Vui lòng nhập đầy đủ mã OTP (từ 6 đến 8 chữ số).')
      return
    }

    setLoading(true)
    try {
      // 1. Kiểm tra nếu phiên đăng nhập đã có hiệu lực (ví dụ vừa click link trong mail ở tab khác)
      const { data: currentSessionData } = await supabase.auth.getSession()
      const currentSessionUser = currentSessionData.session?.user
      const currentEmail = currentSessionUser?.email?.toLowerCase()
      if (currentSessionUser && currentEmail && currentEmail === pendingEmail.toLowerCase()) {
        await ensureStudentProfile(currentSessionUser.id)
        setStep('authenticator_setup')
        initAuthenticatorSetup()
        return
      }

      // 2. Thử tuần tự các kiểu OTP hợp lệ của Supabase (magiclink cho đăng nhập, signup cho đăng ký)
      const candidateTypes: ('magiclink' | 'signup' | 'email')[] =
        otpType === 'signup'
          ? ['signup', 'magiclink', 'email']
          : ['magiclink', 'email', 'signup']

      let verifyResult: any = null
      let lastError: any = null

      for (const t of candidateTypes) {
        const res = await supabase.auth.verifyOtp({
          email: pendingEmail,
          token: cleanOtp,
          type: t,
        })
        if (!res.error && (res.data?.session || res.data?.user)) {
          verifyResult = res
          break
        }
        lastError = res.error
      }

      if (!verifyResult) {
        // Kiểm tra lại phiên đăng nhập phòng trường hợp đã kích hoạt ngầm
        const { data: recheckSession } = await supabase.auth.getSession()
        const recheckUser = recheckSession.session?.user
        if (recheckUser && recheckUser.email?.toLowerCase() === pendingEmail.toLowerCase()) {
          verifyResult = { data: { user: recheckUser, session: recheckSession.session } }
        } else {
          throw lastError || new Error('Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại!')
        }
      }

      const verifiedUser = verifyResult?.data?.user
      if (verifiedUser?.id) {
        await ensureStudentProfile(verifiedUser.id)
      }

      // Chuyển sang bước tuỳ chọn thiết lập Authenticator App
      setStep('authenticator_setup')
      initAuthenticatorSetup()
    } catch (err: any) {
      if (err.message?.includes('Token has expired or is invalid')) {
        setErrorMsg('Mã OTP không chính xác hoặc đã hết hạn. Bạn vui lòng bấm "Gửi lại mã OTP" bên dưới và lấy mã trong email mới nhất!')
      } else {
        setErrorMsg(err.message || 'Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại!')
      }
    } finally {
      setLoading(false)
    }
  }

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingEmail) return
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    const redirectUrl =
      typeof window !== 'undefined'
        ? window.location.hostname === 'localhost'
          ? `${window.location.origin}/fepn-dashboard`
          : 'https://tsv.fepn.senexam.me/fepn-dashboard'
        : undefined

    try {
      if (otpType === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: pendingEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: pendingEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectUrl,
          },
        })
        if (error) throw error
      }

      setResendCooldown(60)
      setSuccessMsg(`Đã gửi lại mã OTP mới về email ${pendingEmail}.`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau!')
    } finally {
      setLoading(false)
    }
  }

  // Bước 3: Kích hoạt ứng dụng Authenticator (TOTP)
  const handleVerifyAuthenticator = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanCode = totpInput.trim()
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }

    if (!mfaFactorId) {
      // Nếu không có factor id, chuyển thẳng vào dashboard
      navigateAfterLogin()
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: cleanCode,
      })

      if (error) throw error

      // Lưu trạng thái kích hoạt và secret vào user_metadata để hỗ trợ xác minh khi cấp lại mật khẩu
      await supabase.auth
        .updateUser({
          data: {
            fepn_mfa_enrolled: true,
            fepn_mfa_secret: mfaSecret,
            fepn_mfa_factor_id: mfaFactorId,
          },
        })
        .catch((e) => console.warn('Lỗi cập nhật metadata MFA:', e))

      alert('🎉 Đã kích hoạt bảo mật ứng dụng Authenticator thành công!')
      navigateAfterLogin()
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã xác thực từ ứng dụng không hợp lệ. Vui lòng kiểm tra lại!')
    } finally {
      setLoading(false)
    }
  }

  // Yêu cầu gửi mã OTP khôi phục mật khẩu về email VNU
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (!mssv.trim()) {
      setErrorMsg('Vui lòng nhập Mã số sinh viên (MSSV) của bạn.')
      return
    }
    const fullEmail = getFullVnuEmail(mssv)
    setPendingEmail(fullEmail)
    setLoading(true)

    const resetRedirectUrl =
      typeof window !== 'undefined'
        ? window.location.hostname === 'localhost'
          ? `${window.location.origin}/fepn-reset-password`
          : 'https://tsv.fepn.senexam.me/fepn-reset-password'
        : undefined

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fullEmail, {
        redirectTo: resetRedirectUrl,
      })
      if (error) throw error
      setSuccessMsg(`Mã xác nhận khôi phục mật khẩu đã được gửi đến email ${fullEmail}. Vui lòng kiểm tra hộp thư đến hoặc mục Thư rác (Spam).`)
      setForgotStep('reset')
      setResetCooldown(60)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng kiểm tra lại MSSV!')
    } finally {
      setLoading(false)
    }
  }

  // Xác nhận đổi mật khẩu mới bằng mã OTP trực tiếp trên giao diện
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanOtp = resetOtpCode.trim()
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg('Vui lòng nhập đầy đủ mã OTP 6 số từ email VNU của bạn.')
      return
    }

    const hasMin = newResetPassword.length >= 8
    const hasUpper = /[A-Z]/.test(newResetPassword)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newResetPassword)
    const hasDig = /[0-9]/.test(newResetPassword)
    if (!hasMin || !hasUpper || !hasSpecial || !hasDig) {
      setErrorMsg('Mật khẩu mới chưa đáp ứng tiêu chuẩn: Tối thiểu 8 ký tự, 1 chữ hoa, 1 ký tự đặc biệt và 1 chữ số.')
      return
    }

    if (newResetPassword !== confirmResetPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setLoading(true)
    try {
      // 1. Xác thực OTP loại 'recovery'
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: cleanOtp,
        type: 'recovery',
      })
      if (verifyErr) throw verifyErr

      // 2. Cập nhật mật khẩu mới
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newResetPassword,
      })
      if (updateErr) throw updateErr

      setSuccessMsg('🎉 Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.')
      setPassword(newResetPassword)
      setMode('login')
      setForgotStep('request')
      setResetOtpCode('')
      setNewResetPassword('')
      setConfirmResetPassword('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại!')
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

  const copySecretKey = () => {
    if (!mfaSecret) return
    navigator.clipboard.writeText(mfaSecret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2500)
  }

  const themeVars = getModernThemeVars('indigo', false)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50/40 to-slate-100 text-slate-900`}
      style={{
        ...themeVars,
      }}
    >
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-300/20 blur-3xl pointer-events-none" />

      {/* Main Card Container */}
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
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              {step === 'otp'
                ? 'Xác Thực Mã OTP'
                : step === 'authenticator_verify'
                ? 'Xác Thực Authenticator'
                : step === 'authenticator_setup'
                ? 'Bảo Mật Authenticator'
                : mode === 'forgot'
                ? 'Khôi Phục Mật Khẩu'
                : mode === 'login'
                ? 'Đăng Nhập FEPN'
                : 'Đăng Ký Tài Khoản'}
            </h1>
            <p className="text-xs text-slate-500">
              {mode === 'forgot'
                ? 'Thiết lập lại mật khẩu tài khoản sinh viên FEPN (@vnu.edu.vn)'
                : 'Khoa Vật lý kỹ thuật & Công nghệ Nano — ĐH Công nghệ'}
            </p>
          </div>
        </div>

        {/* ALERTS */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-600 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-700 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* ----------------- BƯỚC 1: NHẬP THÔNG TIN TÀI KHOẢN / QUÊN MẬT KHẨU ----------------- */}
        {step === 'credentials' && (
          <>
            {mode === 'forgot' ? (
              /* GIAO DIỆN QUÊN MẬT KHẨU CHO SINH VIÊN */
              <div className="space-y-4">
                {forgotStep === 'request' ? (
                  <form onSubmit={handleForgotPasswordRequest} className="space-y-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700">
                        Mã số sinh viên (MSSV):
                      </label>
                      <div className="mt-1 flex items-center rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20 transition">
                        <input
                          type="text"
                          placeholder="Nhập MSSV (ví dụ: 21020001)"
                          value={mssv}
                          onChange={(e) => setMssv(e.target.value.trim())}
                          className="flex-1 bg-transparent px-4 py-3 outline-none font-mono font-bold text-base sm:text-xs"
                          required
                        />
                        <span className="px-3 py-3 bg-sky-50 text-sky-700 font-mono font-black text-xs border-l border-slate-200 select-none">
                          @vnu.edu.vn
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                        Hệ thống sẽ gửi mã OTP 6 số cùng liên kết đặt lại mật khẩu về hòm thư sinh viên của bạn.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      <span>Gửi Mã Xác Nhận Khôi Phục</span>
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login')
                          setErrorMsg('')
                          setSuccessMsg('')
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Quay lại Đăng nhập</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs space-y-1">
                      <p className="font-bold text-sky-900">
                        Đã gửi mã xác nhận đến: <span className="font-mono text-sky-700 font-black">{pendingEmail}</span>
                      </p>
                      <p className="text-[11px] text-sky-700 leading-relaxed">
                        Nhập mã OTP 6 số từ email VNU cùng mật khẩu mới để đổi ngay tại đây (hoặc nhấn trực tiếp link trong email).
                      </p>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700">Mã xác thực OTP (6 chữ số):</label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="VD: 123456"
                          value={resetOtpCode}
                          onChange={(e) => setResetOtpCode(e.target.value.trim().replace(/\D/g, ''))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none font-mono text-center tracking-[0.4em] font-black text-lg focus:border-sky-500 focus:bg-white transition"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700">Mật khẩu mới:</label>
                      <div className="relative mt-1">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          placeholder="Nhập mật khẩu mới an toàn"
                          value={newResetPassword}
                          onChange={(e) => setNewResetPassword(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(!showResetPassword)}
                          className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-800 transition"
                          tabIndex={-1}
                        >
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700">Nhập lại mật khẩu mới:</label>
                      <div className="relative mt-1">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          placeholder="Xác nhận lại mật khẩu mới"
                          value={confirmResetPassword}
                          onChange={(e) => setConfirmResetPassword(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Xác Nhận Đổi Mật Khẩu</span>
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={handleForgotPasswordRequest}
                        disabled={loading || resetCooldown > 0}
                        className="font-bold text-sky-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        {resetCooldown > 0 ? `Gửi lại mã sau (${resetCooldown}s)` : 'Gửi lại mã OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login')
                          setErrorMsg('')
                          setSuccessMsg('')
                        }}
                        className="font-bold text-slate-500 hover:text-slate-800 transition"
                      >
                        Quay lại Đăng nhập
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* GIAO DIỆN ĐĂNG NHẬP / ĐĂNG KÝ MẶC ĐỊNH */
              <>
                {/* TAB SWITCHER: ĐĂNG NHẬP / ĐĂNG KÝ */}
                <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMsg('')
                      setSuccessMsg('')
                    }}
                    className={`w-1/2 py-2.5 rounded-xl transition font-black uppercase tracking-wider ${
                      mode === 'login'
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
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
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Đăng Ký
                  </button>
                </div>

                {/* Khi ở chế độ Đăng Nhập: Có tuỳ chọn Đăng Nhập Mật Khẩu hoặc Quét QR Đăng Nhập Nhanh */}
                {mode === 'login' && (
                  <div className="flex rounded-xl bg-sky-50/80 p-1 text-xs font-bold border border-sky-100">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('credentials')
                        setErrorMsg('')
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 text-xs font-bold ${
                        loginMethod === 'credentials'
                          ? 'bg-white text-sky-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Nhập Mật Khẩu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('qr')
                        setErrorMsg('')
                        if (!qrToken) initQrCode()
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 text-xs font-bold ${
                        loginMethod === 'qr'
                          ? 'bg-white text-sky-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Đăng Nhập Mã QR</span>
                    </button>
                  </div>
                )}

                {/* GIAO DIỆN QUÉT MÃ QR ĐĂNG NHẬP NHANH */}
                {mode === 'login' && loginMethod === 'qr' ? (
                  <div className="space-y-4 text-center">
                    {/* TRƯỜNG HỢP 1: MÁY B ĐÃ DUYỆT VÀ CHỜ MÁY A NHẬP MÃ 6 SỐ XÁC THỰC */}
                    {qrStep === 'awaiting_code' ? (
                      <div className="space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 space-y-1.5 shadow-sm">
                          <div className="inline-flex p-2 rounded-full bg-emerald-100 text-emerald-600 mb-1">
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                          <h4 className="text-sm font-black text-emerald-900 uppercase tracking-wide">
                            Thiết Bị Của Bạn Đã Phê Duyệt!
                          </h4>
                          <p className="text-xs text-emerald-700 leading-relaxed font-semibold">
                            Vui lòng nhập <strong>mã số gồm 6 chữ số</strong> đang hiển thị trên màn hình thiết bị đó để hoàn tất:
                          </p>
                          {approverDeviceName && (
                            <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 py-1 px-3 rounded-xl w-fit mx-auto">
                              Xác nhận từ: {approverDeviceName}
                            </div>
                          )}
                        </div>

                        {codeErrorMsg && (
                          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{codeErrorMsg}</span>
                          </div>
                        )}

                        <form onSubmit={handleCompleteQrLogin} className="space-y-3.5">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-600">
                              Mã xác nhận bảo mật 2 chiều (6 số):
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                maxLength={8}
                                placeholder="VD: 729 415"
                                value={completionCodeInput}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9\s]/g, '')
                                  setCompletionCodeInput(val)
                                }}
                                className="w-full text-center tracking-[0.25em] font-mono text-2xl font-black py-3 px-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:bg-white transition"
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setQrStep('qr')
                                setCompletionCodeInput('')
                                setCodeErrorMsg('')
                              }}
                              className="w-1/3 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                            >
                              Quay Lại QR
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingCode || completionCodeInput.replace(/[\s-]/g, '').length < 6}
                              className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isSubmittingCode ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                              <span>Hoàn Tất Đăng Nhập</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      /* TRƯỜNG HỢP 2: HIỂN THỊ MÃ QR CHỜ QUÉT HOẶC NHẬP 6 SỐ BAN ĐẦU */
                      <div className="space-y-4 text-center">
                        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-1">
                          <p className="text-xs font-black text-slate-800">
                            Quét mã QR để đăng nhập ngay
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Dùng thiết bị đã đăng nhập FEPN (điện thoại hoặc máy tính khác) để xác nhận.
                          </p>
                        </div>

                        {qrLoading ? (
                          <div className="py-8 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
                            <span className="text-xs font-bold text-slate-500">Đang khởi tạo mã xác thực...</span>
                          </div>
                        ) : qrImageUrl ? (
                          <div className="space-y-3">
                            <div className="relative mx-auto w-fit p-3 rounded-2xl border-2 border-dashed border-sky-300 bg-white shadow-md">
                              <img
                                src={qrImageUrl}
                                alt="QR Đăng nhập FEPN"
                                className={`h-48 w-48 object-contain transition ${
                                  qrExpiresIn <= 0 ? 'opacity-20 blur-xs' : ''
                                }`}
                              />
                              {qrExpiresIn <= 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 p-4 rounded-2xl space-y-2">
                                  <AlertCircle className="h-6 w-6 text-amber-500" />
                                  <p className="text-xs font-black text-slate-800">Mã QR đã hết hạn</p>
                                  <button
                                    type="button"
                                    onClick={initQrCode}
                                    className="px-3 py-1.5 rounded-xl bg-sky-600 text-white font-black text-xs hover:bg-sky-700 transition"
                                  >
                                    Làm mới mã QR
                                  </button>
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-slate-500">Hoặc nhập mã 6 số trên thiết bị đã đăng nhập:</p>
                              <div className="mt-1 inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-lg font-black tracking-widest text-slate-800 select-all">
                                {qrShortCode ? `${qrShortCode.slice(0, 3)} ${qrShortCode.slice(3)}` : '••••••'}
                              </div>
                            </div>

                            {qrVerifyDigit && (
                              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center space-y-0.5">
                                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">
                                  Mã kiểm chứng an toàn (2 số)
                                </span>
                                <span className="font-mono text-xl font-black text-indigo-950 tracking-widest">
                                  {qrVerifyDigit}
                                </span>
                                <p className="text-[10px] text-indigo-600 font-medium">
                                  Thiết bị quét sẽ đối chiếu số này để đảm bảo an toàn tuyệt đối
                                </p>
                              </div>
                            )}

                            {qrExpiresIn > 0 && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                <Timer className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                                <span>
                                  Hiệu lực còn:{' '}
                                  <span className="font-mono text-sky-700 font-black">
                                    {Math.floor(qrExpiresIn / 60)}:{(qrExpiresIn % 60).toString().padStart(2, '0')}
                                  </span>
                                </span>
                              </div>
                            )}

                            <div className="text-[11px] text-slate-600 leading-relaxed text-left bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <p className="font-bold text-slate-800">Hướng dẫn nhanh:</p>
                              <p>1. Mở FEPN trên thiết bị đã đăng nhập, bấm nút <strong>Quét QR</strong> trên thanh điều hướng.</p>
                              <p>2. Quét camera hoặc nhập mã 6 số hiển thị ở trên.</p>
                              <p>3. Thiết bị kia sẽ cấp mã 6 số để bạn nhập xác nhận tại đây!</p>
                            </div>

                            <button
                              type="button"
                              onClick={initQrCode}
                              disabled={qrLoading}
                              className="text-xs font-bold text-sky-600 hover:text-sky-800 inline-flex items-center gap-1 transition"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                              <span>Làm mới mã QR</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  /* FORM ĐĂNG NHẬP / ĐĂNG KÝ BẰNG MẬT KHẨU */
                  <form onSubmit={handleCredentialsSubmit} className="space-y-4 text-xs">
                    {/* BẢNG CẢNH BÁO KHÓA TÀI KHOẢN LŨY TIẾN */}
                    {mode === 'login' && isPermanentLocked && (
                      <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 text-center space-y-2">
                        <AlertTriangle className="h-7 w-7 text-rose-600 mx-auto" />
                        <h4 className="text-sm font-black text-rose-900">Tài Khoản Đã Bị Khóa</h4>
                        <p className="text-xs text-rose-700 leading-relaxed font-semibold">
                          Bạn đã nhập sai mật khẩu quá 30 lần. Hệ thống đã khóa tài khoản này để đảm bảo an toàn.
                        </p>
                        <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs font-mono font-black text-rose-900 select-all">
                          Liên hệ hỗ trợ: minhhb@senexam.me
                        </div>
                      </div>
                    )}

                    {mode === 'login' && !isPermanentLocked && lockoutSeconds > 0 && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center space-y-2">
                        <Timer className="h-6 w-6 text-amber-600 mx-auto animate-pulse" />
                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                          Tài khoản đang bị tạm khóa
                        </h4>
                        <div className="text-2xl font-black font-mono text-amber-700 tracking-wider">
                          {formatLockoutTime(lockoutSeconds)}
                        </div>
                        <p className="text-[11px] text-amber-700">
                          Mỗi 5 lần nhập sai sẽ bị khóa lần lượt: 1p, 3p, 5p, 10p, 1h, 3h. Vui lòng chờ đếm ngược để thử lại.
                        </p>
                      </div>
                    )}

                    {/* Họ tên (Chỉ hiện khi Đăng ký) */}
                    {mode === 'signup' && (
                      <div>
                        <label className="font-bold text-slate-700">
                          Họ và tên sinh viên / cán bộ:
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="text"
                            placeholder="Ví dụ: Hoàng Bình Minh"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Ô Nhập MSSV Cố Định Đuôi @vnu.edu.vn */}
                    <div>
                      <label className="font-bold text-slate-700">
                        Mã số sinh viên (MSSV):
                      </label>
                      <div className="mt-1 flex items-center rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20 transition">
                        <input
                          type="text"
                          placeholder="Nhập MSSV (ví dụ: 21020001)"
                          value={mssv}
                          onChange={(e) => setMssv(e.target.value.trim())}
                          className="flex-1 bg-transparent px-4 py-3 outline-none font-mono font-bold text-base sm:text-xs"
                          required
                        />
                        <span className="px-3 py-3 bg-sky-50 text-sky-700 font-mono font-black text-xs border-l border-slate-200 select-none">
                          @vnu.edu.vn
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Cổng xác thực danh tính sinh viên VNU — Khoa FEPN.
                      </p>
                    </div>

                    {/* Mật khẩu */}
                    <div>
                      <label className="font-bold text-slate-700">
                        Mật khẩu:
                      </label>
                      <div className="relative mt-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={mode === 'signup' ? 'Tạo mật khẩu an toàn' : 'Nhập mật khẩu'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-11 py-3 outline-none font-bold text-base sm:text-xs focus:border-sky-500 focus:bg-white transition"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-800 transition"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Hàng "Lưu đăng nhập" & "Quên mật khẩu?" bên Đăng Nhập */}
                      {mode === 'login' && (
                        <div className="flex items-center justify-between mt-2.5">
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600 hover:text-slate-900">
                            <input
                              type="checkbox"
                              checked={rememberMe}
                              onChange={(e) => setRememberMe(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 transition cursor-pointer"
                            />
                            <span>Lưu đăng nhập</span>
                          </label>
                          <Link
                            href="/sen-cap-lai-mat-khau"
                            className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline transition"
                          >
                            Quên mật khẩu?
                          </Link>
                        </div>
                      )}

                      {/* Tiêu chuẩn kiểm tra mật khẩu CHỈ HIỂN THỊ KHI ĐĂNG KÝ */}
                      {mode === 'signup' && (
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
                      )}
                    </div>

                    {/* Nút Submit */}
                    <button
                      type="submit"
                      disabled={loading || (mode === 'login' && (isPermanentLocked || lockoutSeconds > 0))}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>
                        {mode === 'login'
                          ? isPermanentLocked
                            ? 'Tài Khoản Đang Bị Khóa'
                            : lockoutSeconds > 0
                            ? `Tạm Khóa (${formatLockoutTime(lockoutSeconds)})`
                            : 'Đăng Nhập & Nhận Mã OTP'
                          : 'Đăng Ký & Nhận Mã OTP'}
                      </span>
                    </button>
                  </form>
                )}

                {/* HOẶC */}
                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-slate-200" />
                  <span className="bg-white px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    HOẶC
                  </span>
                </div>

                {/* NÚT ĐĂNG NHẬP / ĐĂNG KÝ BẰNG GOOGLE */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 text-xs font-black shadow-sm transition hover:scale-[1.02] disabled:opacity-50 text-slate-700"
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
              </>
            )}
          </>
        )}

        {/* ----------------- BƯỚC 2: XÁC THỰC MÃ OTP EMAIL VNU ----------------- */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
            <div className="rounded-2xl bg-sky-50 border border-sky-200/80 p-4 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-800">
                  Mã OTP đã được gửi tới:
                </p>
                <p className="font-mono font-black text-sky-700 text-sm mt-0.5">
                  {pendingEmail}
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Vui lòng mở hộp thư email VNU để lấy mã xác minh an toàn.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block text-center mb-1">
                Nhập mã OTP (8 chữ số):
              </label>
              <input
                type="text"
                maxLength={8}
                inputMode="numeric"
                autoFocus
                placeholder="••••••••"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center tracking-[0.3em] sm:tracking-[0.4em] font-mono text-lg sm:text-xl font-black py-3 rounded-2xl border border-slate-300 bg-slate-50 outline-none focus:border-sky-500 focus:bg-white transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.trim().length < 6}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              <span>Xác Nhận Mã OTP</span>
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Đổi tài khoản
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 disabled:text-slate-400 transition"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ----------------- BƯỚC: XÁC THỰC MÃ AUTHENTICATOR (CHO TÀI KHOẢN ĐÃ LIÊN KẾT) ----------------- */}
        {step === 'authenticator_verify' && (
          <form onSubmit={handleVerifyAuthenticatorLogin} className="space-y-4 text-xs">
            <div className="rounded-2xl bg-indigo-50 border border-indigo-200/80 p-4 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-sm">
                  Xác Thực Ứng Dụng Authenticator
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tài khoản {pendingEmail} đã bật bảo mật 2 lớp.
                </p>
              </div>
              <p className="text-[11px] text-indigo-700 font-bold">
                Mở Google Authenticator hoặc Microsoft Authenticator để lấy mã 6 số.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block text-center mb-1">
                Nhập mã 6 chữ số:
              </label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                value={totpVerifyInput}
                onChange={(e) => setTotpVerifyInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center tracking-[0.5em] font-mono text-xl font-black py-3 rounded-2xl border border-slate-300 bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || totpVerifyInput.trim().length < 6}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-indigo-500/25 transition hover:scale-[1.02] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              <span>Xác Nhận Mã Authenticator</span>
            </button>

            {/* Nút chuyển sang xác nhận bằng mail khi không thể truy cập Authenticator */}
            <div className="pt-2 text-center space-y-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleFallbackToEmailOtp}
                disabled={loading}
                className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Không thể truy cập Authenticator? Xác minh qua Email</span>
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials')
                    setErrorMsg('')
                    setSuccessMsg('')
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Quay lại đăng nhập
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ----------------- BƯỚC: TUỲ CHỌN THIẾT LẬP AUTHENTICATOR APP (TOTP) ----------------- */}
        {step === 'authenticator_setup' && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200/80 p-4 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">
                Thêm Vào Ứng Dụng Authenticator
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tăng cường bảo mật với Google Authenticator hoặc Microsoft Authenticator trên điện thoại của bạn.
              </p>
            </div>

            {/* QR Code / Secret Key */}
            {mfaLoading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                <span className="text-[11px] font-bold">Đang chuẩn bị mã bảo mật...</span>
              </div>
            ) : mfaQrCode || mfaSecret ? (
              <div className="space-y-3">
                {mfaQrCode && (
                  <div className="mx-auto flex justify-center p-2 rounded-2xl border border-slate-200 bg-white w-fit shadow-sm">
                    {/* Render QR code */}
                    {mfaQrCode.startsWith('data:image') || mfaQrCode.startsWith('http') ? (
                      <img src={mfaQrCode} alt="TOTP QR Code" className="h-36 w-36 object-contain" />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: mfaQrCode }}
                        className="h-36 w-36 flex items-center justify-center overflow-hidden"
                      />
                    )}
                  </div>
                )}

                {mfaSecret && (
                  <div>
                    <label className="font-bold text-slate-600 block text-[11px] mb-1">
                      Hoặc nhập Secret Key thủ công:
                    </label>
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] font-bold text-slate-800">
                      <span className="flex-1 truncate">{mfaSecret}</span>
                      <button
                        type="button"
                        onClick={copySecretKey}
                        className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-black transition"
                        title="Sao chép Secret Key"
                      >
                        {copiedSecret ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Form xác nhận mã từ Authenticator */}
                <form onSubmit={handleVerifyAuthenticator} className="space-y-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nhập mã 6 số hiển thị trong ứng dụng:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="vd: 123456"
                      value={totpInput}
                      onChange={(e) => setTotpInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full text-center tracking-[0.4em] font-mono text-base font-black py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || totpInput.trim().length < 6}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-md transition disabled:opacity-50"
                  >
                    Kích Hoạt Authenticator & Tiếp Tục
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-center text-[11px] text-slate-500 py-2">
                Hệ thống xác thực Authenticator đã sẵn sàng. Bạn có thể kích hoạt sau trong phần cài đặt hoặc bỏ qua bước này.
              </p>
            )}

            {/* NÚT BỎ QUA BƯỚC NÀY (RÕ RÀNG) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={navigateAfterLogin}
                className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-black uppercase text-xs tracking-wider shadow-sm transition hover:scale-[1.01] inline-flex items-center justify-center gap-1.5"
              >
                <span>Bỏ Qua Bước Này (Vào Dashboard)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
