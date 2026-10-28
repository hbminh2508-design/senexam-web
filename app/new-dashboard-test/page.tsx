'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'
import {
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  Clock,
  ArrowRight,
  ChevronRight,
  Flame,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Award,
  FileText,
  BarChart3,
  Sun,
  Moon,
  User,
  LogOut,
  Crown,
  Compass,
  Layers,
  Lock,
  Bell,
  Play,
  Filter,
  ExternalLink,
  Coins,
  Bot,
  Calendar,
  KeyRound,
  Grid,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-dash-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-dash-body' })

interface ExamItem {
  id: string
  title: string
  subject?: string
  duration?: number
  total_questions?: number
  created_at?: string
  access_code?: string
}

interface DocItem {
  id: string
  title: string
  created_at?: string
}

const SUBJECT_LIST = [
  { key: 'all', label: 'Tất cả môn', icon: '✨' },
  { key: 'Toán', label: 'Toán học', icon: '📐' },
  { key: 'Vật lý', label: 'Vật lý', icon: '⚡' },
  { key: 'Hóa học', label: 'Hóa học', icon: '🧪' },
  { key: 'Sinh học', label: 'Sinh học', icon: '🧬' },
  { key: 'Tiếng Anh', label: 'Tiếng Anh', icon: '🌐' },
  { key: 'Ngữ văn', label: 'Ngữ văn', icon: '📖' },
  { key: 'Lịch sử', label: 'Lịch sử', icon: '🏛️' },
  { key: 'Địa lý', label: 'Địa lý', icon: '🌏' },
  { key: 'Tin học', label: 'Tin học', icon: '💻' },
]

export default function NewDashboardTestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  const [exams, setExams] = useState<ExamItem[]>([])
  const [docs, setDocs] = useState<DocItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [quickExamCode, setQuickExamCode] = useState('')

  useEffect(() => {
    // Check dark mode
    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    setIsDark(Boolean(dark))

    async function loadData() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const currentUser = authData?.user || null
        setUser(currentUser)

        if (currentUser) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle()
          setProfile(profData)
        }

        // Fetch public / latest exams
        const { data: examData } = await supabase
          .from('exams')
          .select('id, title, subject, duration, total_questions, created_at, access_code')
          .order('created_at', { ascending: false })
          .limit(8)
        if (examData && examData.length > 0) {
          setExams(examData)
        }

        // Fetch latest docs
        const { data: docData } = await supabase
          .from('library_documents')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(4)
        if (docData && docData.length > 0) {
          setDocs(docData)
        }
      } catch (err) {
        console.warn('Dashboard test load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
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

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {})
    router.push('/new-idp')
  }

  const handleQuickJoinExam = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickExamCode.trim()) return
    router.push(`/new-exams?code=${encodeURIComponent(quickExamCode.trim())}`)
  }

  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      const matchSub =
        selectedSubject === 'all' ||
        (ex.subject && ex.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
      const matchQuery =
        !searchQuery.trim() ||
        ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.subject && ex.subject.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchSub && matchQuery
    })
  }, [exams, selectedSubject, searchQuery])

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Sĩ Tử SenExam'
  const isVip = Boolean(profile?.is_vip)
  const senCash = profile?.sencash_balance || profile?.sen_cash || 0

  if (loading) {
    return (
      <ModernLoading
        title="SenExam Dashboard Soft Blue"
        subtitle="Đang tối ưu không gian học tập & giao diện hoa sen mềm mại..."
      />
    )
  }

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-500 font-sans`}
      style={{
        fontFamily: 'var(--font-dash-body)',
        background: isDark
          ? 'radial-gradient(circle at 12% 8%, rgba(14, 165, 233, 0.14), transparent 40%), radial-gradient(circle at 88% 15%, rgba(59, 130, 246, 0.12), transparent 35%), radial-gradient(circle at 50% 85%, rgba(2, 132, 199, 0.1), transparent 40%), #080C14'
          : 'radial-gradient(circle at 10% 8%, rgba(186, 230, 253, 0.55), transparent 45%), radial-gradient(circle at 90% 12%, rgba(191, 219, 254, 0.5), transparent 40%), radial-gradient(circle at 50% 85%, rgba(224, 242, 254, 0.6), transparent 50%), #F8FAFC',
      }}
    >
      {/* ========================================================================= */}
      {/* TOP NAVIGATION BAR — SẮC XANH HOA SEN MỀM MẠI, BO TRÒN TINH TẾ             */}
      {/* ========================================================================= */}
      <nav className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/75 dark:bg-slate-900/75 border-b border-sky-100 dark:border-sky-950/40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <Link href="/new-dashboard-test" className="flex items-center gap-3.5 group select-none">
            <div className="relative h-12 w-12 rounded-[22px] p-1.5 bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-md shadow-sky-500/25 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:rotate-1">
              <img
                src="/logo.png"
                alt="SenExam Logo"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-black tracking-tight text-slate-900 dark:text-white"
                  style={{ fontFamily: 'var(--font-dash-heading)' }}
                >
                  Sen<span className="text-sky-600 dark:text-sky-400">Exam</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  Soft Blue 2.0
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                Hệ Sinh Thái Khảo Thí & Học Tập Hiện Đại
              </span>
            </div>
          </Link>

          {/* Quick Universal Search in Navbar (Desktop) */}
          <div className="hidden lg:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500" />
              <input
                type="text"
                placeholder="Tìm nhanh đề thi, chuyên đề, môn học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-sky-50/70 dark:bg-slate-800/70 border border-sky-200/60 dark:border-sky-800/40 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition shadow-inner"
              />
            </div>
          </div>

          {/* Top Actions: Theme Toggle, SC Balance, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* SenCash Pill */}
            <Link
              href="/new-pay?tab=sencash"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-black shadow-xs hover:scale-105 transition"
              title="Số dư SenCash của bạn"
            >
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span>{senCash.toLocaleString('vi-VN')} SC</span>
            </Link>

            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDarkMode}
              className="h-10 w-10 rounded-2xl flex items-center justify-center border border-sky-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm transition hover:scale-105 active:scale-95"
              title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-sky-600" />}
            </button>

            {/* User Profile Pill */}
            <Link
              href="/new-profile"
              className="flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border border-sky-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 shadow-sm hover:border-sky-300 transition hover:scale-102"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[100px] sm:max-w-[130px]">
                  {fullName}
                </span>
                <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                  {isVip ? 'Thành Viên VIP' : 'Sĩ Tử'}
                </span>
              </div>
            </Link>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex h-10 w-10 rounded-2xl items-center justify-center border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95"
              title="Đăng xuất tài khoản an toàn"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* MAIN CONTAINER — BỐ CỤC 3 KHỐI THÔNG MINH, TIỆN DỤNG TỐI ĐA                */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 1. HERO BANNER CHÀO MỪNG & TRUNG TÂM HÀNH ĐỘNG 1 CHẠM */}
        <section className="relative overflow-hidden rounded-[36px] border border-sky-100/80 dark:border-sky-900/40 bg-gradient-to-br from-white/95 via-sky-50/70 to-blue-50/80 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-sky-950/40 p-6 sm:p-10 shadow-[0_20px_50px_rgba(2,132,199,0.08)] backdrop-blur-2xl">
          {/* Subtle Ambient Lotus Glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-gradient-to-br from-sky-400/20 to-blue-600/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-300/15 to-indigo-500/15 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-700 dark:text-sky-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-sky-500 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Không Gian Thi Cử Chuẩn Hóa Quốc Gia</span>
              </div>
              <h1
                className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]"
                style={{ fontFamily: 'var(--font-dash-heading)' }}
              >
                Chào buổi học tập,{' '}
                <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-sky-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  {fullName}
                </span>
                ! 🌸
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Hệ sinh thái SenExam đồng hành cùng bạn bứt phá điểm 9+ với kho đề thi cập nhật liên tục, chấm điểm tức thì và phân tích AI thông minh.
              </p>

              {/* Nhập mã đề thi nhanh 1 chạm */}
              <form onSubmit={handleQuickJoinExam} className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                <div className="relative w-full">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500" />
                  <input
                    type="text"
                    placeholder="Nhập mã đề (VD: TOAN12A, SINH9P)..."
                    value={quickExamCode}
                    onChange={(e) => setQuickExamCode(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800/60 text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-sky-500/25 hover:shadow-lg transition hover:scale-102 active:scale-98 shrink-0 flex items-center justify-center gap-2"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Vào Thi Ngay</span>
                </button>
              </form>
            </div>

            {/* Quick 4 Feature Cards (Pill Design) */}
            <div className="grid grid-cols-2 gap-3.5 w-full lg:w-auto shrink-0">
              <Link
                href="/new-exams"
                className="group p-4 rounded-3xl bg-white/90 dark:bg-slate-800/90 border border-sky-100 dark:border-sky-900/50 shadow-sm hover:border-sky-400 dark:hover:border-sky-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="h-10 w-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Kho Đề Thi</h4>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Luyện thi trắc nghiệm</p>
              </Link>

              <Link
                href="/new-library"
                className="group p-4 rounded-3xl bg-white/90 dark:bg-slate-800/90 border border-sky-100 dark:border-sky-900/50 shadow-sm hover:border-sky-400 dark:hover:border-sky-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="h-10 w-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Thư Viện PDF</h4>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Tài liệu, giáo trình</p>
              </Link>

              <Link
                href="/new-senai"
                className="group p-4 rounded-3xl bg-white/90 dark:bg-slate-800/90 border border-sky-100 dark:border-sky-900/50 shadow-sm hover:border-sky-400 dark:hover:border-sky-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="h-10 w-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
                  <Bot className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Trợ Giảng AI</h4>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Giải đáp 24/7</p>
              </Link>

              <Link
                href="/new-schedule"
                className="group p-4 rounded-3xl bg-white/90 dark:bg-slate-800/90 border border-sky-100 dark:border-sky-900/50 shadow-sm hover:border-sky-400 dark:hover:border-sky-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition">
                  <Calendar className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Lịch Học Tập</h4>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Nhắc hẹn & thời khóa biểu</p>
              </Link>
            </div>
          </div>
        </section>

        {/* 2. BỘ LỌC MÔN HỌC CUỘN NGANG DẠNG VIÊN THUỐC MỀM MẠI (PILLS) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"
              style={{ fontFamily: 'var(--font-dash-heading)' }}
            >
              <Filter className="h-4 w-4 text-sky-500" />
              <span>Khám Phá Theo Môn Học</span>
            </h3>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
              {filteredExams.length} đề thi sẵn sàng
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {SUBJECT_LIST.map((sub) => {
              const active = selectedSubject === sub.key
              return (
                <button
                  key={sub.key}
                  onClick={() => setSelectedSubject(sub.key)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black shrink-0 transition-all duration-300 flex items-center gap-1.5 select-none ${
                    active
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 scale-105'
                      : 'bg-white/80 dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-slate-700 border border-sky-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span>{sub.icon}</span>
                  <span>{sub.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 3. DANH SÁCH ĐỀ THI ĐƯỢC THIẾT KẾ BO TRÒN THEO ĐƯỜNG CONG HOA SEN */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3
                className="text-xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-dash-heading)' }}
              >
                Đề Thi Nổi Bật & Mới Nhất
              </h3>
              <p className="text-xs font-semibold text-slate-400">
                Lựa chọn từ kho dữ liệu thi chuẩn hóa quốc gia
              </p>
            </div>
            <Link
              href="/new-exams"
              className="text-xs font-black text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center gap-1 group"
            >
              <span>Xem tất cả đề thi</span>
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </Link>
          </div>

          {filteredExams.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 dark:border-slate-800 p-12 text-center space-y-3 bg-sky-50/30 dark:bg-slate-900/30">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-sky-100 dark:bg-slate-800 text-sky-500 flex items-center justify-center">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Không tìm thấy đề thi phù hợp với từ khóa & môn học đã chọn.
              </p>
              <button
                onClick={() => {
                  setSelectedSubject('all')
                  setSearchQuery('')
                }}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white font-bold text-xs shadow-sm hover:bg-sky-600 transition"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className="group relative flex flex-col justify-between rounded-[28px] border border-sky-100 dark:border-sky-950/40 bg-white/90 dark:bg-slate-900/90 p-5 shadow-[0_8px_30px_rgba(2,132,199,0.05)] hover:shadow-[0_16px_40px_rgba(2,132,199,0.12)] transition-all duration-300 hover:-translate-y-1.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                        {exam.subject || 'Đề Tổng Hợp'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-sky-500" />
                        {exam.duration ? `${exam.duration} phút` : '45 phút'}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                      {exam.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400 pt-1">
                      <span>{exam.total_questions || 40} câu hỏi</span>
                      <span>•</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">
                        {exam.access_code ? `#${exam.access_code}` : 'Tự do'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <Link
                      href={`/new-exams/${exam.id}`}
                      className="w-full py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-500 text-sky-600 hover:text-white dark:bg-slate-800 dark:hover:bg-sky-500 dark:text-sky-300 dark:hover:text-white font-black text-xs transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Bắt Đầu Làm Bài</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. LIÊN KẾT HỆ SINH THÁI ĐẶC QUYỀN (SEB CANVAS, FEPN, NỘP QUỸ LỚP) */}
        <section className="rounded-[32px] p-6 sm:p-8 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-xl shadow-sky-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-200" />
                <span>Hệ Thống Thi Chuyên Nghiệp Khép Kín</span>
              </div>
              <h3
                className="text-2xl sm:text-3xl font-black tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-dash-heading)' }}
              >
                Cổng Thi An Toàn SEB Exam Canvas
              </h3>
              <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-medium">
                Môi trường thi trực tuyến chống gian lận đa tầng, bảo vệ khóa màn hình, camera giám sát AI và mã hóa bài nộp độc lập.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://seb.thicu.tailieufepn.senexam.me/dashboard"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-2xl bg-white text-blue-600 hover:bg-sky-50 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition hover:scale-105 active:scale-95 flex items-center gap-2 shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Mở Cổng Thi SEB</span>
              </a>
              <Link
                href="/new-change-password"
                className="px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-xs transition active:scale-95"
              >
                Đổi Mật Khẩu
              </Link>
            </div>
          </div>
        </section>

        {/* 5. GỢI Ý THƯ VIỆN TÀI LIỆU PDF & CÔNG CỤ HỌC TẬP */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Tài liệu mới cập nhật */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"
                style={{ fontFamily: 'var(--font-dash-heading)' }}
              >
                <FileText className="h-4 w-4 text-sky-500" />
                <span>Tài Liệu Ôn Thi PDF Mới Cập Nhật</span>
              </h3>
              <Link href="/new-library" className="text-xs font-bold text-sky-600 dark:text-sky-400">
                Mở Thư Viện
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {docs.length === 0 ? (
                <div className="col-span-2 p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-800 text-center text-xs text-slate-400">
                  Đang đồng bộ tài liệu từ Google Drive...
                </div>
              ) : (
                docs.map((doc) => (
                  <Link
                    key={doc.id}
                    href="/new-library"
                    className="p-4 rounded-3xl bg-white/80 dark:bg-slate-800/80 border border-sky-100 dark:border-sky-950/40 hover:border-sky-400 dark:hover:border-sky-500 shadow-sm transition hover:-translate-y-1 flex items-start gap-3 group"
                  >
                    <div className="h-10 w-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                        {doc.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 block mt-1">Định dạng PDF • Đọc trực tuyến</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Cột phải: Lối tắt các phân hệ nhanh */}
          <div className="space-y-3">
            <h3
              className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"
              style={{ fontFamily: 'var(--font-dash-heading)' }}
            >
              <Grid className="h-4 w-4 text-sky-500" />
              <span>Phân Hệ Tiện Ích</span>
            </h3>

            <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-800/80 border border-sky-100 dark:border-sky-950/40 space-y-2.5 shadow-sm">
              <Link
                href="/nopquylop"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-sky-50 dark:hover:bg-slate-700/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                    💵
                  </div>
                  <div>
                    <h6 className="text-xs font-black text-slate-900 dark:text-white">Nộp Quỹ Lớp</h6>
                    <p className="text-[10px] text-slate-400">Minh bạch thu chi tự động</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 group-hover:text-sky-500 transition" />
              </Link>

              <Link
                href="/tsv-fepn"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-sky-50 dark:hover:bg-slate-700/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
                    📚
                  </div>
                  <div>
                    <h6 className="text-xs font-black text-slate-900 dark:text-white">Tài Liệu FEPN</h6>
                    <p className="text-[10px] text-slate-400">Khoa VLKT & Công nghệ Nano</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 group-hover:text-sky-500 transition" />
              </Link>

              <Link
                href="/sengraph"
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-sky-50 dark:hover:bg-slate-700/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">
                    📈
                  </div>
                  <div>
                    <h6 className="text-xs font-black text-slate-900 dark:text-white">SenGraph AI</h6>
                    <p className="text-[10px] text-slate-400">Phân tích biểu đồ & đồ thị</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 group-hover:text-sky-500 transition" />
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
