'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Brain,
  Zap,
  Lock,
  BookOpen,
  Award,
  Users,
  Clock,
  Compass,
  FileText,
  Star,
  Layers,
  Crown,
  Sun,
  Moon,
  ChevronRight,
  Flame,
  Check,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-home-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-home-body' })

export default function HomePage() {
  const { themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))
  }, [])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const themeVars = getModernThemeVars(themeColor || 'indigo', isDark)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 relative selection:bg-indigo-500 selection:text-white`}
      style={{
        ...themeVars,
        fontFamily: 'var(--font-home-body), sans-serif',
      }}
    >
      {/* Background Animated Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full bg-indigo-500/15 dark:bg-indigo-600/20 blur-[130px]" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-amber-500/15 dark:bg-amber-600/15 blur-[140px]" />
        <div className="absolute -bottom-32 left-1/4 h-[550px] w-[550px] rounded-full bg-rose-500/15 dark:bg-rose-600/15 blur-[150px]" />
        <div
          className="fixed inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(var(--text) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand */}
          <Link href="/home" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span
                className="text-xl sm:text-2xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-home-heading)' }}
              >
                SenExam<span className="text-indigo-600 dark:text-indigo-400">.ME</span>
              </span>
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 -mt-1">
                Sen UI 3.0 Platform
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Tính năng
            </a>
            <a href="#exams" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Ngân hàng đề
            </a>
            <a href="#proctor" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Khảo thí SEB
            </a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Bảng giá VIP
            </a>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Quy chế
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xs hover:scale-105 transition cursor-pointer"
              title="Đổi giao diện Sáng / Tối"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </button>

            <Link
              href="/idp"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Đăng nhập
            </Link>

            <Link
              href="/idp"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <span>Vào IDP Ngay</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-6 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Hệ Thống Khảo Thí & Luyện Thi Thông Minh Thế Hệ Mới</span>
        </div>

        {/* Main Heading */}
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-home-heading)' }}
        >
          Chinh Phục Mọi Đỉnh Cao <br />
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 bg-clip-text text-transparent">
            THPTQG, HSA & TSA
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-semibold">
          Nền tảng khảo thí toàn diện tích hợp <strong>KaTeX Live</strong> siêu tốc, phòng thi an toàn <strong>Safe Exam Browser (SEB)</strong>, trợ lý AI chấm thi thông minh và cổng định danh duy nhất <strong>SenExam IDP</strong>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/idp"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition"
          >
            <span>Bắt Đầu Luyện Thi Miễn Phí</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/new-exams"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-sm shadow-sm backdrop-blur-xl hover:scale-105 active:scale-95 transition"
          >
            <BookOpen className="h-4 w-4 text-indigo-500" />
            <span>Khám Phá Ngân Hàng Đề</span>
          </Link>
        </div>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm backdrop-blur-xl">
            <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400" style={{ fontFamily: 'var(--font-home-heading)' }}>10,000+</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Đề thi chuẩn cấu trúc</p>
          </div>
          <div className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm backdrop-blur-xl">
            <p className="text-3xl font-black text-amber-500" style={{ fontFamily: 'var(--font-home-heading)' }}>50,000+</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Học sinh & Thí sinh tin dùng</p>
          </div>
          <div className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm backdrop-blur-xl">
            <p className="text-3xl font-black text-emerald-500" style={{ fontFamily: 'var(--font-home-heading)' }}>0.05s</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Tốc độ render KaTeX tức thì</p>
          </div>
          <div className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-sm backdrop-blur-xl">
            <p className="text-3xl font-black text-rose-500" style={{ fontFamily: 'var(--font-home-heading)' }}>99.8%</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Độ chính xác chấm điểm AI</p>
          </div>
        </div>
      </section>

      {/* CORE FEATURES SECTION */}
      <section id="features" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Công Nghệ Dẫn Đầu
          </span>
          <h2
            className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-home-heading)' }}
          >
            Được Thiết Kế Cho Trải Nghiệm Học Tập Tột Đỉnh
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-semibold">
            Kết hợp kiến trúc phân luồng Sen Heart 1.0.2 với các giải pháp AI và hiển thị toán học hàng đầu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-8 shadow-lg backdrop-blur-xl space-y-4 hover:-translate-y-1 transition duration-300">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Zap className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              KaTeX Live & Bàn Phím Toán Học
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Trình soạn đề và hiển thị công thức toán học chuẩn LaTeX sắc nét từng pixel. Bàn phím ảo toán học với hơn 80 ký hiệu chuyên biệt giúp giáo viên và học sinh soạn đề trực tiếp nhanh gấp 5 lần.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-8 shadow-lg backdrop-blur-xl space-y-4 hover:-translate-y-1 transition duration-300">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Lock className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Phòng Thi Safe Exam Browser (SEB)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Môi trường khảo thí an toàn tuyệt đối, khóa màn hình chống chuyển tab, ngăn chặn chụp ảnh màn hình và kết hợp AI Gemini Live giám sát qua webcam để đảm bảo tính minh bạch của kỳ thi.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-8 shadow-lg backdrop-blur-xl space-y-4 hover:-translate-y-1 transition duration-300">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Brain className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Trợ Lý AI Giải Đề Thông Minh
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Tích hợp các mô hình Gemini thế hệ mới để tự động phân tích ma trận kiến thức, chỉ ra lỗ hổng tư duy của học sinh, đồng thời sinh lời giải chi tiết và gợi ý các câu hỏi luyện tập tương tự.
            </p>
          </div>
        </div>
      </section>

      {/* EXAM CATEGORIES */}
      <section id="exams" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-black/[0.02] dark:bg-white/[0.02] rounded-[40px] my-10">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Ngân Hàng Khảo Thí
          </span>
          <h2
            className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-home-heading)' }}
          >
            Đầy Đủ Cấu Trúc Các Kỳ Thi Trọng Điểm
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-semibold">
            Bám sát định dạng cấu trúc đề thi chính thức của Bộ Giáo dục & Đào tạo cũng như các Đại học hàng đầu Việt Nam.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Category 1: THPTQG */}
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 space-y-4">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">
              Chương trình 2025 - 2026
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Kỳ Thi Tốt Nghiệp THPT</h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Toán học, Vật lý, Hóa học, Sinh học
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ngữ văn, Lịch sử, Địa lý, Tiếng Anh
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Dạng trắc nghiệm 4 lựa chọn, Đúng/Sai, Điền số
              </li>
            </ul>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline pt-2"
            >
              Vào làm đề THPTQG ngay <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Category 2: HSA */}
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 space-y-4">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">
              ĐHQGHN • HSA
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Đánh Giá Năng Lực HSA</h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Phần 1: Tư duy định lượng (Toán học 50 câu)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Phần 2: Tư duy định tính (Ngữ văn 50 câu)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Phần 3: Khoa học tự nhiên & xã hội (50 câu)
              </li>
            </ul>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline pt-2"
            >
              Luyện thi HSA ngay <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Category 3: TSA */}
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 space-y-4">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black">
              Bách Khoa Hà Nội • TSA
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Đánh Giá Tư Duy TSA</h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tư duy Toán học (60 phút)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tư duy Đọc hiểu văn bản (30 phút)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tư duy Khoa học & Giải quyết vấn đề (60 phút)
              </li>
            </ul>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 hover:underline pt-2"
            >
              Luyện đề TSA Bách Khoa <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING PLANS */}
      <section id="pricing" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Các Gói Thành Viên
          </span>
          <h2
            className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-home-heading)' }}
          >
            Linh Hoạt Cho Mọi Nhu Cầu Luyện Thi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-semibold">
            Bắt đầu miễn phí và nâng cấp khi bạn muốn mở khóa toàn bộ sức mạnh của ngân hàng đề và AI giải đề chi tiết.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Plan 1: Free */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Cơ bản</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Miễn Phí</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white my-4">0đ</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Làm bài thi công khai</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Chấm điểm tự động</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Bảng xếp hạng & streak</li>
              </ul>
            </div>
            <Link
              href="/idp"
              className="mt-6 w-full py-3 rounded-2xl border border-black/10 dark:border-white/10 text-center font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Bắt đầu miễn phí
            </Link>
          </div>

          {/* Plan 2: VIP */}
          <div className="rounded-[32px] border border-indigo-500/30 bg-white/90 dark:bg-slate-900/90 p-6 flex flex-col justify-between shadow-lg">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-indigo-500">Phổ biến</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Sen VIP</h3>
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 my-4">49.000đ<span className="text-xs text-slate-400 font-bold">/tháng</span></p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Toàn bộ quyền lợi Free</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Xem lời giải KaTeX chi tiết</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Trợ lý SenAI giải thích câu hỏi</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Tặng 50 SenCash (SC)</li>
              </ul>
            </div>
            <Link
              href="/idp"
              className="mt-6 w-full py-3 rounded-2xl bg-indigo-600 text-white text-center font-black text-xs hover:bg-indigo-700 shadow-md transition"
            >
              Đăng ký Sen VIP
            </Link>
          </div>

          {/* Plan 3: Premium+ */}
          <div className="rounded-[32px] border-2 border-amber-500 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Khuyên Dùng
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-500">Đặc quyền cao cấp</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Premium+</h3>
              <p className="text-3xl font-black text-amber-500 my-4">89.000đ<span className="text-xs text-slate-400 font-bold">/tháng</span></p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-semibold">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Toàn bộ quyền lợi Sen VIP</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Mở khóa đề thi độc quyền HSA/TSA</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> AI phân tích biểu đồ năng lực</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Huy hiệu Hoàng Kim Premium+</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Tặng 120 SenCash (SC)</li>
              </ul>
            </div>
            <Link
              href="/idp"
              className="mt-6 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-center font-black text-xs hover:brightness-105 shadow-md transition"
            >
              Sở hữu Premium+
            </Link>
          </div>

          {/* Plan 4: Sen One */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 text-white p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-400">Flagship All-In-One</p>
              <h3 className="text-2xl font-black text-white mt-1">Sen One</h3>
              <p className="text-3xl font-black text-cyan-400 my-4">149.000đ<span className="text-xs text-slate-400 font-bold">/tháng</span></p>
              <ul className="text-xs text-slate-300 space-y-2 font-semibold">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Trọn bộ toàn bộ tính năng cao nhất</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Giám sát phòng thi SEB không giới hạn</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> SenAI Studio không giới hạn lượt hỏi</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-400" /> Tặng 250 SenCash (SC) mỗi tháng</li>
              </ul>
            </div>
            <Link
              href="/idp"
              className="mt-6 w-full py-3 rounded-2xl bg-cyan-500 text-slate-950 text-center font-black text-xs hover:bg-cyan-400 transition"
            >
              Kích hoạt Sen One
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl mt-20 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-3">
              <span className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-home-heading)' }}>
                SenExam<span className="text-indigo-600 dark:text-indigo-400">.ME</span>
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Nền tảng khảo thí thông minh — Hành trang vững chắc cho mọi học sinh, sinh viên và giáo viên trong kỷ nguyên số.
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Tính Năng</p>
              <ul className="text-xs space-y-2 font-semibold text-slate-600 dark:text-slate-300">
                <li><Link href="/new-exams" className="hover:underline">Ngân hàng đề thi</Link></li>
                <li><Link href="/new-setup-course" className="hover:underline">Soạn đề KaTeX Live</Link></li>
                <li><Link href="/seb-dashboard" className="hover:underline">Phòng thi SEB an toàn</Link></li>
                <li><Link href="/fepn-dashboard" className="hover:underline">Chuyên trang FEPN VNU</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Pháp Lý & An Toàn</p>
              <ul className="text-xs space-y-2 font-semibold text-slate-600 dark:text-slate-300">
                <li><Link href="/terms" className="hover:underline">Điều khoản dịch vụ</Link></li>
                <li><Link href="/privacy" className="hover:underline">Chính sách quyền riêng tư</Link></li>
                <li><Link href="/idp" className="hover:underline">Cổng định danh IDP</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Hỗ Trợ</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                Email: support@senexam.me<br />
                Hotline: (+84) 98-765-4321<br />
                ĐHQGHN, Hà Nội, Việt Nam
              </p>
            </div>
          </div>

          <div className="border-t border-black/5 dark:border-white/5 pt-6 text-center text-xs text-slate-400 font-semibold">
            © 2026 SenExam Platform. Mọi quyền được bảo lưu. Phát triển bởi SenExam Core Team.
          </div>
        </div>
      </footer>
    </div>
  )
}
