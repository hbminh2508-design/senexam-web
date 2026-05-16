'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowRight, Zap, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react'

// Apple Liquid Glass Constants
const glassCardStyles = "bg-white/10 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"

export default function HomePage() {
  const router = useRouter()

  // Bật sẵn Dark Mode cho Landing Page thêm phần huyền ảo
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white relative font-sans overflow-hidden">
      
      {/* 🌟 LIQUID BACKGROUND ORBS 🌟 */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-600/40 to-indigo-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tl from-purple-600/40 to-pink-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 w-full max-w-5xl p-6 text-center flex flex-col items-center">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider border border-white/20 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Nền tảng Đánh giá Năng lực 2025
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tight drop-shadow-lg mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
          SenExam<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">.COM</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          Hệ sinh thái thi thử THPTQG, HSA & TSA trực tuyến. Giao diện Liquid Glass mượt mà, hệ thống chống gian lận thông minh và lưu trữ phi tập trung.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500">
          <button 
            onClick={() => router.push('/login')} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-[0_8px_30px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2 transition-all hover:-translate-y-1 group"
          >
            Đăng nhập / Đăng ký <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* CÁC TÍNH NĂNG NỔI BẬT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-700 delay-700">
          <div className={`${glassCardStyles} p-6 rounded-3xl text-left`}>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 border border-blue-500/30"><GraduationCap className="w-6 h-6 text-blue-400"/></div>
            <h3 className="text-lg font-bold mb-2">Đề thi chuẩn hóa</h3>
            <p className="text-sm text-slate-400 font-medium">Bám sát cấu trúc mới nhất của Bộ GD&ĐT, bao gồm dạng Đúng/Sai 4 ý.</p>
          </div>
          <div className={`${glassCardStyles} p-6 rounded-3xl text-left`}>
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/30"><ShieldCheck className="w-6 h-6 text-emerald-400"/></div>
            <h3 className="text-lg font-bold mb-2">Chống gian lận (Anti-Cheat)</h3>
            <p className="text-sm text-slate-400 font-medium">Khóa F12, giám sát chuyển Tab và tự động thu bài khi vi phạm 3 lần.</p>
          </div>
          <div className={`${glassCardStyles} p-6 rounded-3xl text-left`}>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 border border-purple-500/30"><Sparkles className="w-6 h-6 text-purple-400"/></div>
            <h3 className="text-lg font-bold mb-2">Trải nghiệm Liquid Glass</h3>
            <p className="text-sm text-slate-400 font-medium">Thiết kế UI/UX theo tiêu chuẩn Human Interface Guidelines của Apple.</p>
          </div>
        </div>

      </div>
    </div>
  )
}