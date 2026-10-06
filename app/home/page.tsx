'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
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
  GraduationCap,
  Calculator,
  Check,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import SenExamCanvas from '@/app/components/SenExamCanvas'

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
      try { localStorage.setItem('theme', 'dark') } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }

  const themeVars = getModernThemeVars(themeColor || 'indigo', isDark)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 relative selection:bg-indigo-500 selection:text-white overflow-x-hidden`}
      style={{
        ...themeVars,
        fontFamily: 'var(--font-home-body), sans-serif',
      }}
    >
      {/* 🚀 LỚP CANVAS 2D SIÊU NHẸ (THAY THẾ TOÀN BỘ KIẾN TRÚC DOM BLOBS CŨ) */}
      <SenExamCanvas isDark={isDark} />

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/home" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <span
                className="text-lg sm:text-xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-home-heading)' }}
              >
                SenExam<span className="text-indigo-600 dark:text-indigo-400">.ME</span>
              </span>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 -mt-1">
                Khảo Thí Trực Tuyến
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
              Phòng thi SEB
            </a>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Quy chế
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
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
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Đăng nhập
            </Link>

            <Link
              href="/idp"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <span>Vào Cổng IDP</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-14 sm:pt-20 pb-12 px-4 sm:px-6 text-center max-w-4xl mx-auto">
        {/* Badge Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-5 backdrop-blur-xl">
          <GraduationCap className="h-4 w-4 text-indigo-500" />
          <span>Hệ Thống Khảo Thí & Luyện Thi Chuẩn Cấu Trúc Mới</span>
        </div>

        {/* Main Heading */}
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] mb-5 text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-home-heading)' }}
        >
          Khảo Thí Trực Tuyến Toàn Diện <br />
          <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-amber-500 bg-clip-text text-transparent">
            THPT Quốc Gia, HSA & TSA
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed font-semibold">
          Nền tảng thi thử và quản lý bài thi tinh gọn, tích hợp hiển thị công thức toán học <strong>KaTeX Live</strong> siêu tốc, phòng thi bảo mật <strong>Safe Exam Browser (SEB)</strong> và cổng định danh tập trung <strong>SenExam IDP</strong>.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-12">
          <Link
            href="/new-exams"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25 hover:scale-105 active:scale-95 transition"
          >
            <BookOpen className="h-4 w-4" />
            <span>Làm Đề Thi Thử Ngay</span>
          </Link>

          <Link
            href="/idp"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs shadow-xs backdrop-blur-xl hover:scale-105 active:scale-95 transition"
          >
            <span>Cổng Định Danh IDP</span>
            <ArrowRight className="h-4 w-4 text-indigo-500" />
          </Link>
        </div>

        {/* 4 Highlight Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-xs backdrop-blur-xl">
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400" style={{ fontFamily: 'var(--font-home-heading)' }}>10,000+</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Câu hỏi chuẩn ma trận</p>
          </div>
          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-xs backdrop-blur-xl">
            <p className="text-2xl font-black text-amber-500" style={{ fontFamily: 'var(--font-home-heading)' }}>3 Dạng thức</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Trắc nghiệm, Đúng/Sai, Điền số</p>
          </div>
          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-xs backdrop-blur-xl">
            <p className="text-2xl font-black text-emerald-500" style={{ fontFamily: 'var(--font-home-heading)' }}>0.05s</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Hiển thị KaTeX tức thì</p>
          </div>
          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 shadow-xs backdrop-blur-xl">
            <p className="text-2xl font-black text-sky-500" style={{ fontFamily: 'var(--font-home-heading)' }}>SEB Lock</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Khảo thí bảo mật cao</p>
          </div>
        </div>
      </section>

      {/* CORE PILLARS SECTION */}
      <section id="features" className="relative z-10 py-14 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Tính Năng Cốt Lõi
          </span>
          <h2
            className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-home-heading)' }}
          >
            Trải Nghiệm Khảo Thí Tinh Gọn & Hiện Đại
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-semibold">
            Thiết kế tối giản, tập trung vào tốc độ, độ chính xác và tính bảo mật của kỳ thi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-xs backdrop-blur-xl space-y-3 hover:-translate-y-0.5 transition duration-300">
            <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Soạn Đề & KaTeX Live Tức Thì
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Render công thức Toán, Lý, Hóa chuẩn xác sắc nét từng pixel. Hỗ trợ bàn phím ảo toán học với hơn 80 ký hiệu chuyên biệt giúp giáo viên và học sinh thao tác nhanh chóng.
            </p>
          </div>

          {/* Card 2 */}
          <div id="proctor" className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-xs backdrop-blur-xl space-y-3 hover:-translate-y-0.5 transition duration-300">
            <div className="h-11 w-11 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Phòng Thi Safe Exam Browser (SEB)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Môi trường khảo thí bảo mật cao, hỗ trợ khóa ứng dụng, chống chuyển tab, ngăn chặn chụp ảnh màn hình và kết nối đồng bộ phòng thi thời gian thực.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-xs backdrop-blur-xl space-y-3 hover:-translate-y-0.5 transition duration-300">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Đầy Đủ 3 Định Dạng Đề Thi Mới
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Bám sát ma trận mới của Bộ GD&ĐT: Trắc nghiệm 4 phương án, câu hỏi Đúng/Sai lũy tiến điểm (4 ý a, b, c, d) và câu hỏi trả lời ngắn điền số.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-xs backdrop-blur-xl space-y-3 hover:-translate-y-0.5 transition duration-300">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-home-heading)' }}>
              Cổng Định Danh & Tra Cứu Bài Thi
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Xem lại toàn bộ bài làm, đối chiếu đáp án chi tiết, theo dõi phổ điểm và quản lý hồ sơ học tập tập trung qua SenExam IDP.
            </p>
          </div>
        </div>
      </section>

      {/* EXAM CATEGORIES SECTION */}
      <section id="exams" className="relative z-10 py-14 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Khung Đề Thi
          </span>
          <h2
            className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-home-heading)' }}
          >
            Các Kỳ Thi Trọng Điểm Đang Được Hỗ Trợ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-semibold">
            Học sinh có thể truy cập kho đề trực tuyến và làm bài thử nghiệm ngay lập tức.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card THPTQG */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase">
                Tốt nghiệp THPT 2026
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Kỳ Thi THPT Quốc Gia</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                Đề thi Toán học, Vật lý, Hóa học, Sinh học bám sát định dạng cấu trúc 3 phần: Trắc nghiệm 4 lựa chọn, Đúng/Sai và Điền số.
              </p>
            </div>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline pt-2"
            >
              Xem đề thi THPTQG <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Card HSA */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                ĐHQGHN • HSA
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Đánh Giá Năng Lực (HSA)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                Khung đề thi gồm 3 phần: Tư duy định lượng (Toán), Tư duy định tính (Văn học) và Khoa học Tự nhiên / Xã hội.
              </p>
            </div>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline pt-2"
            >
              Xem đề thi HSA <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Card TSA */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                ĐH Bách Khoa • TSA
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Đánh Giá Tư Duy (TSA)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                Đề thi 3 phần: Tư duy Toán học, Tư duy Đọc hiểu và Tư duy Khoa học / Giải quyết vấn đề theo chuẩn Đại học Bách Khoa Hà Nội.
              </p>
            </div>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 hover:underline pt-2"
            >
              Xem đề thi TSA <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 py-10 px-4 sm:px-6 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-[10px]">
              S
            </div>
            <span>© 2026 SenExam.ME • Nền tảng khảo thí trực tuyến</span>
          </div>

          <div className="flex items-center gap-5 font-bold">
            <Link href="/home" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Giới thiệu
            </Link>
            <Link href="/new-exams" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Đề thi
            </Link>
            <Link href="/idp" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Cổng IDP
            </Link>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Điều khoản
            </Link>
            <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Bảo mật
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
