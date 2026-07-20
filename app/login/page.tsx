'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  Mail, Lock, ArrowRight, Loader2, Zap, GraduationCap,
  Eye, EyeOff, CheckCircle2, AlertCircle, Bot, Sparkles
} from 'lucide-react'

import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, hexToRgba } from '@/app/components/modernTheme'

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

  // Đồng bộ Dark Mode từ hệ thống (nếu có)
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

  const vars = getModernThemeVars(themeColor, isDark)
  const accent = (vars as any)['--accent'] as string

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

      <div className="relative z-10 w-full max-w-[1100px] flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">

        {/* ========================================================= */}
        {/* CỘT TRÁI: BRANDING & LINH VẬT SENAI */}
        {/* ========================================================= */}
        <div className="flex-1 w-full text-center lg:text-left space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 pt-8 lg:pt-0">

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border mx-auto lg:mx-0 ms-glass"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: accent }} /> Nền tảng luyện thi AI 2026
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter drop-shadow-sm leading-tight" style={{ color: 'var(--text)' }}>
            SenExam<span style={{ color: accent }}>.ME</span>
          </h1>

          <p className="text-base sm:text-lg font-medium max-w-md mx-auto lg:mx-0 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Hệ thống đánh giá năng lực và khảo thí thông minh. Hành trang toàn diện chinh phục THPTQG, HSA & TSA.
          </p>

          <div className="hidden sm:flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm font-bold pt-2" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ms-glass"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> Ngân hàng đề chuẩn</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ms-glass"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> Chấm điểm tức thì</span>
          </div>

          {/* Linh vật SenAI */}
          <div className="hidden lg:flex items-end gap-5 mt-12 animate-in zoom-in fade-in duration-1000 delay-300">
            <div className="relative shrink-0 bounce-float" >
              <div
                className="w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.15)] border relative z-10"
                style={{ backgroundColor: accent, borderColor: 'var(--border)' }}
              >
                <Bot className="w-12 h-12 text-white drop-shadow-md" />
              </div>
              <div
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 z-20"
                style={{ backgroundColor: '#FBBF24', borderColor: 'var(--bg)' }}
              >
                <Sparkles className="w-4 h-4 text-yellow-900" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/10 dark:bg-white/5 blur-sm rounded-[100%]"></div>
            </div>

            <div
              className="relative px-5 py-4 rounded-2xl rounded-bl-none border shadow-xl mb-4 ms-glass"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-black leading-snug max-w-[220px]" style={{ color: 'var(--text)' }}>
                {isLogin
                  ? 'Chào sĩ tử! Nạp năng lượng và bắt đầu luyện đề ngày hôm nay thôi! 🚀'
                  : 'Tạo tài khoản để mình làm gia sư AI cá nhân hóa lộ trình cho bạn nhé! 🎯'}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        {/* ========================================================= */}
        <div className="w-full max-w-md lg:max-w-[420px] animate-in fade-in slide-in-from-right-8 duration-700 delay-150 relative z-20">
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

            <form onSubmit={handleAuth} className="space-y-5">
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
