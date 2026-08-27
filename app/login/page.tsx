'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  Mail, Lock, ArrowRight, Loader2, Zap, GraduationCap,
  Eye, EyeOff, CheckCircle2, AlertCircle,
} from 'lucide-react'

import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, hexToRgba } from '@/app/components/modernTheme'
import { signInWithGoogle } from '@/lib/authHelper'

// Linh vật SenAI vẽ tay bằng SVG, dùng làm nền lớn cho trang đăng nhập thay cho robot nhỏ nảy
// nảy trước đây — cùng một nhân vật, chỉ đổi vai trò từ "mascot cạnh form" sang "nền trang trí".
// Tô màu hoàn toàn bằng CSS var(--accent)/var(--bg) nên tự đổi theo màu chủ đề người dùng chọn.
function RobotBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 640"
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* Vầng sáng sau lưng */}
      <ellipse cx="260" cy="360" rx="230" ry="260" fill="var(--accent)" opacity="0.12" />

      {/* Ăng-ten */}
      <circle cx="260" cy="30" r="14" fill="var(--accent)" opacity="0.9" className="modern-loading-dot" />
      <rect x="253" y="40" width="14" height="54" rx="7" fill="var(--accent)" opacity="0.85" />

      {/* Đầu */}
      <rect x="140" y="90" width="240" height="190" rx="56" fill="var(--accent)" opacity="0.85" />
      {/* Mặt kính */}
      <rect x="172" y="132" width="176" height="96" rx="34" fill="var(--bg)" opacity="0.9" />
      {/* Mắt */}
      <rect x="206" y="158" width="26" height="42" rx="13" fill="var(--accent)" />
      <rect x="288" y="158" width="26" height="42" rx="13" fill="var(--accent)" />

      {/* Cổ */}
      <rect x="235" y="278" width="50" height="38" fill="var(--accent)" opacity="0.85" />

      {/* Vai */}
      <circle cx="112" cy="352" r="36" fill="var(--accent)" opacity="0.8" />
      <circle cx="408" cy="352" r="36" fill="var(--accent)" opacity="0.8" />

      {/* Tay */}
      <rect x="42" y="340" width="66" height="190" rx="33" fill="var(--accent)" opacity="0.75" transform="rotate(-9 75 435)" />
      <rect x="412" y="340" width="66" height="190" rx="33" fill="var(--accent)" opacity="0.75" transform="rotate(9 445 435)" />

      {/* Thân */}
      <rect x="108" y="316" width="304" height="270" rx="72" fill="var(--accent)" opacity="0.85" />
      {/* Lõi năng lượng ở ngực */}
      <circle cx="260" cy="432" r="56" fill="var(--bg)" opacity="0.9" />
      <circle cx="260" cy="432" r="34" fill="var(--accent)" opacity="0.5" />
      <circle cx="260" cy="432" r="14" fill="var(--accent)" />

      {/* Chân — cắt ở mép dưới khung để có cảm giác robot đứng vươn lên từ đáy trang */}
      <rect x="164" y="560" width="72" height="90" rx="30" fill="var(--accent)" opacity="0.85" />
      <rect x="284" y="560" width="72" height="90" rx="30" fill="var(--accent)" opacity="0.85" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const [googleLoading, setGoogleLoading] = useState(false)

  // Đồng bộ Dark Mode từ hệ thống (nếu có) & bắt lỗi OAuth từ URL
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error_description') || params.get('error')
      if (err) {
        setErrorMsg(err.includes('bad_oauth_state') || err.includes('OAuth state')
          ? 'Phiên đăng nhập Google đã hết hạn hoặc bị gián đoạn. Vui lòng bấm nút Google bên dưới để thử lại.'
          : decodeURIComponent(err))
      }
    }
  }, [])

  const vars = {
    ...getModernThemeVars(themeColor, isDark),
    '--accent': isDark ? '#60a5fa' : '#2563eb',
    '--accent-soft': isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
  }
  const accent = vars['--accent']

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setErrorMsg('')
    try {
      await signInWithGoogle('/dashboard')
    } catch (error: any) {
      setErrorMsg(error.message || 'Đăng nhập Google thất bại.')
      setGoogleLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      if (isLogin) {
        // Xử lý đăng nhập
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await ensureStudentProfile(user.id)
        router.push('/dashboard')
      } else {
        // Xử lý đăng ký
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        // Sau khi đăng ký thành công, tự động tạo một profile rỗng để kích hoạt Onboarding
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await ensureStudentProfile(user.id)

        router.push('/dashboard')
      }
    } catch (error: any) {
      setErrorMsg(error.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không chính xác.' : error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative font-sans overflow-hidden transition-colors duration-500"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={{ ...vars, backgroundColor: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
    >
      {/* Quầng sáng nền theo màu chủ đề đã chọn */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] bounce-float pointer-events-none" style={{ backgroundColor: hexToRgba(accent, isDark ? 0.16 : 0.22) }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[120px] bounce-float-delayed pointer-events-none" style={{ backgroundColor: hexToRgba(accent, isDark ? 0.1 : 0.14) }} />

      {/* Linh vật SenAI khổ lớn làm nền — neo bên phải, chỉ hiện từ màn hình rộng để không đè lên form trên di động */}
      <RobotBackdrop className="hidden lg:block fixed bottom-0 right-[2%] w-[420px] xl:w-[480px] h-auto pointer-events-none select-none animate-in fade-in zoom-in-95 duration-1000" />

      <div className="relative z-10 w-full max-w-[560px] flex flex-col items-center gap-8">

        {/* Thương hiệu — đặt phía trên form, giao thoa giữa chữ đậm phong cách cũ và tông màu chủ đề mới */}
        <div className="text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border ms-glass"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: accent }} /> Nền tảng luyện thi AI 2026
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter drop-shadow-sm leading-tight" style={{ color: 'var(--text)' }}>
            SenExam<span style={{ color: accent }}>.ME</span>
          </h1>
          <p className="text-sm sm:text-base font-medium max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Hệ thống đánh giá năng lực và khảo thí thông minh. Hành trang toàn diện chinh phục THPTQG, HSA & TSA.
          </p>
          <div className="hidden sm:flex flex-wrap items-center justify-center gap-4 text-sm font-bold pt-1" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ms-glass"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> Ngân hàng đề chuẩn</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ms-glass"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> Chấm điểm tức thì</span>
          </div>
        </div>

        {/* Form đăng nhập / đăng ký */}
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 relative z-20">
          <div className="ms-glass rounded-[2.5rem] p-8 sm:p-10 relative border" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-8 text-center">
              <div
                className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5 shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
                style={{ backgroundColor: accent }}
              >
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
              </h2>
              <p className="font-bold text-xs uppercase tracking-widest mt-2" style={{ color: 'var(--text-muted)' }}>
                {isLogin ? 'Đăng nhập để tiếp tục' : 'Tham gia cộng đồng sĩ tử'}
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 rounded-2xl border py-3.5 px-4 text-sm font-bold shadow-sm transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isLogin ? 'Tiếp tục với Google' : 'Đăng ký với Google'}</span>
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
                <span className="absolute px-3 text-[11px] font-bold uppercase tracking-wider ms-glass rounded-md" style={{ color: 'var(--text-muted)' }}>
                  Hoặc bằng Email
                </span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-5 mt-4">
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="Địa chỉ Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-2xl pl-12 pr-12 py-4 outline-none border-2 transition-all duration-200 text-sm font-bold"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div className="relative group/input">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu bảo mật"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl pl-12 pr-12 py-4 outline-none border-2 transition-all duration-200 text-sm font-bold"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors z-10 hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-4 mt-2 rounded-[1.2rem] font-black text-sm uppercase tracking-wider transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 group/btn disabled:opacity-50 text-white"
                style={{ backgroundColor: accent, boxShadow: `0 8px 20px ${hexToRgba(accent, 0.3)}` }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    {isLogin ? 'Đăng Nhập' : 'Đăng Ký Ngay'}
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {isLogin ? 'Chưa có tài khoản?' : 'Đã là thành viên?'}
                <button
                  onClick={() => { setIsLogin(!isLogin); setErrorMsg('') }}
                  className="ml-2 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--accent-soft)', color: accent }}
                >
                  {isLogin ? 'Đăng ký' : 'Đăng nhập'}
                </button>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
