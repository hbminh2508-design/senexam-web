'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Mail, Lock, ArrowRight, Loader2, Zap, GraduationCap, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
// 🌟 APPLE'S LIQUID GLASS CSS CONSTANTS
const glassCardStyles = "liquid-panel-strong"
const inputStyles = "liquid-input w-full rounded-2xl pl-12 pr-12 py-4 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner transition-all text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true) // Toggle Đăng nhập / Đăng ký
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
        router.push('/dashboard')
      } else {
        // Xử lý đăng ký
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        
        // Sau khi đăng ký thành công, tự động tạo một profile rỗng để kích hoạt Onboarding
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { error: profileError } = await supabase.from('profiles').insert({ id: user.id, role: 'student' })
          if (profileError && profileError.code !== '23505') throw profileError // Bỏ qua lỗi duplicate nếu đã có
        }
        
        router.push('/dashboard')
      }
    } catch (error: any) {
      setErrorMsg(error.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không chính xác.' : error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell min-h-screen bg-transparent flex items-center justify-center p-4 relative text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* 🌟 LIQUID BACKGROUND ORBS 🌟 */}
      <div className="fixed top-[-15%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-800/35 dark:to-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 bounce-float pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-tl from-purple-400/24 to-pink-400/18 dark:from-purple-800/28 dark:to-pink-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[130px] opacity-70 bounce-float-delayed pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="fixed top-[20%] right-[20%] w-[300px] h-[300px] bg-emerald-300/18 dark:bg-emerald-900/24 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-60 bounce-float pointer-events-none" style={{ animationDelay: '4s' }}></div>

      <div className="relative z-10 w-full max-w-[1000px] flex flex-col md:flex-row items-center gap-10 md:gap-20">
        
        {/* CỘT TRÁI: BRANDING & THÔNG ĐIỆP */}
        <div className="flex-1 text-center md:text-left space-y-6 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 dark:bg-slate-800/40 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/30 shadow-sm mx-auto md:mx-0">
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> Hệ thống thi cử thông minh
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight drop-shadow-md leading-tight">
            SenExam<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">.COM</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl font-medium max-w-md mx-auto md:mx-0 leading-relaxed drop-shadow-sm">
            Nền tảng đánh giá năng lực cá nhân hóa. Chinh phục kỳ thi THPTQG, HSA và TSA ngay hôm nay.
          </p>
          <div className="hidden md:flex items-center gap-4 text-sm font-bold text-slate-500 dark:text-slate-400 mt-8">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Đề thi chuẩn hóa</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Chấm điểm tức thì</span>
          </div>
        </div>

        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ (LIQUID GLASS) */}
        <div className="w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
          <div className={`${glassCardStyles} rounded-[2.5rem] p-8 md:p-10 border-t-white/70 border-l-white/70 dark:border-t-white/20 dark:border-l-white/20 relative overflow-hidden`}>
            
            {/* Glass Highlight */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none rounded-[2.5rem]"></div>

            <div className="relative z-10">
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30 transform rotate-3">
                  <GraduationCap className="w-8 h-8 text-white -rotate-3" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white drop-shadow-sm">
                  {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                  {isLogin ? 'Nhập thông tin để tiếp tục lộ trình học' : 'Tham gia cộng đồng sĩ tử toàn quốc'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-5">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="email" 
                    placeholder="Địa chỉ Email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputStyles}
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">{errorMsg}</p>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading || !email || !password}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:from-slate-400/50 disabled:to-slate-400/50 py-4 rounded-2xl font-black shadow-[0_8px_20px_rgba(59,130,246,0.3)] text-base transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      {isLogin ? 'Đăng nhập vào hệ thống' : 'Đăng ký tài khoản'}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  {isLogin ? 'Chưa có tài khoản?' : 'Đã là thành viên?'}
                  <button 
                    onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:underline transition-all"
                  >
                    {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
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