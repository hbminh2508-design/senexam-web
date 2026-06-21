'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { 
  Mail, Lock, ArrowRight, Loader2, Zap, GraduationCap, 
  Eye, EyeOff, CheckCircle2, AlertCircle, Bot, Sparkles 
} from 'lucide-react'

// 🌟 APPLE'S LIQUID GLASS CSS CONSTANTS
const glassCardStyles = "bg-white/70 dark:bg-[#1A1A1A]/70 backdrop-blur-3xl backdrop-saturate-[2] border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
const inputStyles = "w-full bg-white/50 dark:bg-[#0A0A0A]/50 backdrop-blur-md rounded-2xl pl-12 pr-12 py-4 outline-none border-2 border-transparent focus:border-blue-500/50 focus:bg-white dark:focus:bg-[#121212] shadow-inner transition-all text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500"

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Đồng bộ Dark Mode từ hệ thống (nếu có)
  useEffect(() => {
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-center p-4 relative text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-500">
      
      {/* 🌟 LIQUID BACKGROUND ORBS 🌟 */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-blue-400/30 to-indigo-500/20 dark:from-blue-600/20 dark:to-indigo-900/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-tl from-purple-400/20 to-pink-400/20 dark:from-purple-900/20 dark:to-pink-900/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
      <div className="fixed top-[20%] right-[15%] w-[300px] h-[300px] bg-emerald-400/15 dark:bg-emerald-900/20 rounded-full blur-[90px] animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-[1100px] flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
        
        {/* ========================================================= */}
        {/* CỘT TRÁI: BRANDING & LINH VẬT SENAI */}
        {/* ========================================================= */}
        <div className="flex-1 w-full text-center lg:text-left space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 pt-8 lg:pt-0">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-full text-[11px] font-black uppercase tracking-widest border border-white/50 dark:border-white/10 shadow-sm mx-auto lg:mx-0">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Nền tảng luyện thi AI 2026
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter drop-shadow-sm leading-tight text-slate-900 dark:text-white">
            SenExam<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">.ME</span>
          </h1>
          
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium max-w-md mx-auto lg:mx-0 leading-relaxed">
            Hệ thống đánh giá năng lực và khảo thí thông minh. Hành trang toàn diện chinh phục THPTQG, HSA & TSA.
          </p>
          
          <div className="hidden sm:flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm font-bold text-slate-500 dark:text-slate-400 pt-2">
            <span className="flex items-center gap-1.5 bg-white/40 dark:bg-white/5 px-3 py-1.5 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ngân hàng đề chuẩn</span>
            <span className="flex items-center gap-1.5 bg-white/40 dark:bg-white/5 px-3 py-1.5 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Chấm điểm tức thì</span>
          </div>

          {/* 🌟 WIDGET LINH VẬT SENAI ROBOT CUTE 🌟 */}
          <div className="hidden lg:flex items-end gap-5 mt-12 animate-in zoom-in fade-in duration-1000 delay-300">
            {/* Robot Avatar */}
            <div className="relative shrink-0 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-[2rem] flex items-center justify-center shadow-[0_10px_40px_rgba(99,102,241,0.4)] border border-white/20 relative z-10">
                <Bot className="w-12 h-12 text-white drop-shadow-md" />
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0A0A0A] animate-pulse z-20">
                <Sparkles className="w-4 h-4 text-yellow-900" />
              </div>
              {/* Bóng đổ của Robot xuống sàn */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/10 dark:bg-white/5 blur-sm rounded-[100%]"></div>
            </div>

            {/* Chat Bubble */}
            <div className="relative bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-xl px-5 py-4 rounded-2xl rounded-bl-none border border-slate-200 dark:border-white/10 shadow-xl mb-4 group hover:scale-105 transition-transform">
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug max-w-[220px]">
                {isLogin 
                  ? "Chào sĩ tử! Nạp năng lượng và bắt đầu luyện đề ngày hôm nay thôi! 🚀" 
                  : "Tạo tài khoản để mình làm gia sư AI cá nhân hóa lộ trình cho bạn nhé! 🎯"}
              </p>
              {/* Mũi nhọn bóng thoại */}
              <div className="absolute bottom-0 left-[-12px] w-0 h-0 border-b-[16px] border-b-white/90 dark:border-b-[#1E1E1E]/90 border-l-[16px] border-l-transparent"></div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ (LIQUID GLASS) */}
        {/* ========================================================= */}
        <div className="w-full max-w-md lg:max-w-[420px] animate-in fade-in slide-in-from-right-8 duration-700 delay-150 relative z-20">
          <div className={`${glassCardStyles} rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden group`}>
            
            {/* Hiệu ứng Shine bóng kính */}
            <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent skew-x-12 group-hover:left-[200%] transition-all duration-1000 ease-in-out pointer-events-none"></div>

            <div className="relative z-10">
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5 shadow-[0_8px_20px_rgba(59,130,246,0.3)]">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isLogin ? 'Welcome Back' : 'Tạo tài khoản'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
                  {isLogin ? 'Đăng nhập để tiếp tục' : 'Tham gia cộng đồng sĩ tử'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="relative group/input">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors z-10" />
                  <input 
                    type="email" 
                    placeholder="Địa chỉ Email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputStyles}
                  />
                </div>

                <div className="relative group/input">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors z-10" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Mật khẩu bảo mật" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputStyles}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors z-10"
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
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500 py-4 mt-2 rounded-[1.2rem] font-black shadow-[0_8px_20px_rgba(79,70,229,0.3)] text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 group/btn"
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
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {isLogin ? 'Chưa có tài khoản?' : 'Đã là thành viên?'}
                  <button 
                    onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#202020] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {isLogin ? 'Đăng ký' : 'Đăng nhập'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}