'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'
import {
  Zap,
  BookOpen,
  History,
  Crown,
  Search,
  Sparkles,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Award,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  Coins,
  Wallet,
  Users,
  BarChart3,
  Compass,
  Edit,
  Calculator,
  FlaskConical,
  Gauge,
  Video,
  ShoppingBag,
  Wind,
  Mail,
  GraduationCap,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

interface ExamItem {
  id: string
  title: string
  subject?: string
  exam_type?: string
  duration?: number
  total_questions?: number
  created_at: string
}

interface DocItem {
  id: string
  title: string
  drive_file_id: string
  created_at: string
  is_vip_only?: boolean
}

export default function MobileDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string>('Sĩ Tử SenExam')
  const [isVip, setIsVip] = useState(false)
  const [senCash, setSenCash] = useState<number>(0)
  const [submissionCount, setSubmissionCount] = useState<number>(0)
  const [highestScore, setHighestScore] = useState<number>(0)

  const [exams, setExams] = useState<ExamItem[]>([])
  const [docs, setDocs] = useState<DocItem[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const subjects = [
    { key: 'all', label: 'Tất cả' },
    { key: 'Toán', label: 'Toán học' },
    { key: 'Vật lý', label: 'Vật lý' },
    { key: 'Hóa học', label: 'Hóa học' },
    { key: 'Sinh học', label: 'Sinh học' },
    { key: 'Tiếng Anh', label: 'Tiếng Anh' },
    { key: 'Ngữ văn', label: 'Ngữ văn' },
    { key: 'Lịch sử', label: 'Lịch sử' },
    { key: 'Địa lý', label: 'Địa lý' },
    { key: 'Tin học', label: 'Tin học' },
  ]

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Sĩ Tử SenExam'
          setUserName(name)

          // Check Profile & VIP & SenCash
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_vip, role, sencash_balance, sen_cash')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.is_vip || profile?.role === 'admin') {
            setIsVip(true)
          }
          if (profile) {
            setSenCash(profile.sencash_balance || profile.sen_cash || 0)
          }

          // Submissions stats
          const { data: subs } = await supabase
            .from('submissions')
            .select('score')
            .eq('user_id', user.id)
          if (subs && subs.length > 0) {
            setSubmissionCount(subs.length)
            setHighestScore(Math.max(...subs.map((s) => s.score || 0)))
          }
        }

        // Load 12 recent exams
        const { data: examData } = await supabase
          .from('exams')
          .select('id, title, subject, exam_type, duration, total_questions, created_at')
          .order('created_at', { ascending: false })
          .limit(12)
        if (examData) setExams(examData)

        // Load 6 recent library docs
        const { data: docData } = await supabase
          .from('library_documents')
          .select('id, title, drive_file_id, created_at, is_vip_only')
          .order('created_at', { ascending: false })
          .limit(6)
        if (docData) setDocs(docData)
      } catch (err) {
        console.error('Mobile dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <ModernLoading
        title="Bảng Điều Khiển SenExam Mobile"
        subtitle={`Đang tải dữ liệu học tập & khảo thí trên điện thoại (v${MOBILE_VERSION})...`}
      />
    )
  }

  const filteredExams = exams.filter((ex) => {
    const matchSub = selectedSubject === 'all' || (ex.subject && ex.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
    const matchQuery = !searchQuery.trim() || ex.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSub && matchQuery
  })

  return (
    <div className="flex-1 w-full p-4 space-y-4">
      {/* 🌟 BANNER ĐẶC BIỆT: KỶ NIỆM 1 NĂM SINH NHẬT WEB SENEXAM (2025 - 2026) */}
      <div className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-600/20 border border-amber-500/30 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-pink-500 flex items-center justify-center text-white text-lg shadow-md shrink-0">
              🎂
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Kỷ Niệm 1 Năm SenExam
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 text-white font-black text-[9px] uppercase shadow-xs">
                  1st Anniversary
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                Hành trình 1 năm đồng hành cùng sĩ tử chinh phục điểm 9+ và kỳ thi quốc gia!
              </p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-amber-500 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
        </div>
      </div>

      {/* 1. TOP HEADER BAR */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 p-0.5 shadow-md flex items-center justify-center text-white font-black text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Xin chào 👋</span>
              {isVip && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase">
                  <Crown className="h-2.5 w-2.5" /> VIP
                </span>
              )}
            </div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[170px]">
              {userName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/m/pay"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold active:scale-95 transition"
          >
            <Crown className="h-3.5 w-3.5" />
            <span className="text-[11px]">Nâng VIP</span>
          </Link>
        </div>
      </header>

      {/* 2. THANH TÌM KIẾM NHANH */}
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm đề thi, tài liệu ôn tập..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-10 pr-3 text-xs outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 transition"
        />
      </div>

      {/* 3. HERO BANNER: LUYỆN THI THUẦN MOBILE */}
      <div className="relative rounded-3xl overflow-hidden p-5 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-800 text-white shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
            <Flame className="h-3 w-3 text-amber-300" /> SenExam Mobile 2026
          </span>
          <span className="text-[11px] font-mono opacity-80">m.senexam.me</span>
        </div>
        <div>
          <h2 className="text-lg font-black leading-tight">
            Khảo Thí Chuẩn Hóa Trên Điện Thoại
          </h2>
          <p className="text-xs text-violet-100/80 mt-1 line-clamp-2">
            Giao diện cảm ứng 100%, đề KaTeX rõ nét, PDF gọn gàng, tự động lưu bài và đồng bộ điểm số.
          </p>
        </div>
        <div className="pt-1 flex items-center gap-2">
          <Link
            href="/m/sen-ground?tab=exams"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-950 font-black text-xs shadow-md active:scale-95 transition"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Vào Kho Đề Ngay
          </Link>
          <Link
            href="/m/sen-ground?tab=library"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 text-white font-bold text-xs hover:bg-white/25 active:scale-95 transition"
          >
            <BookOpen className="h-3.5 w-3.5" /> Thư Viện Sen
          </Link>
        </div>
      </div>

      {/* 4. STATS ROW: THỐNG KÊ NHANH CÁ NHÂN */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs text-center">
          <span className="text-[9px] text-slate-400 font-bold block">Bài thi đã làm</span>
          <p className="text-sm font-black text-slate-900 dark:text-white">{submissionCount}</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs text-center">
          <span className="text-[9px] text-slate-400 font-bold block">Điểm cao nhất</span>
          <p className="text-sm font-black text-amber-500">{highestScore}</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs text-center">
          <span className="text-[9px] text-slate-400 font-bold block">Ví SenCash</span>
          <p className="text-sm font-black text-violet-600">{senCash} SC</p>
        </div>
      </div>

      {/* 5. PHÍM TẮT TOÀN BỘ HỆ SINH THÁI TÍNH NĂNG PC */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-500">
          <span>Hệ Sinh Thái Tính Năng</span>
          <span className="text-[10px] text-slate-400 font-normal">Đầy đủ như PC</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* Kho Đề */}
          <Link
            href="/m/sen-ground?tab=exams"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Kho Đề</span>
          </Link>

          {/* Thư Viện */}
          <Link
            href="/m/sen-ground?tab=library"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Thư Viện</span>
          </Link>

          {/* Lịch Sử */}
          <Link
            href="/m/sen-ground?tab=history"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <History className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Lịch Sử</span>
          </Link>

          {/* Cửa Hàng VIP */}
          <Link
            href="/m/pay"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Crown className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Gói VIP</span>
          </Link>

          {/* Ví SenCash */}
          <Link
            href="/m/pay?tab=wallet"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Ví Sen</span>
          </Link>

          {/* SenGraph */}
          <Link
            href="/sengraph"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">SenGraph</span>
          </Link>

          {/* Lớp Học / Quỹ Lớp */}
          <Link
            href="/nopquylop"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Quỹ Lớp</span>
          </Link>

          {/* Hạn mức SenAI */}
          <Link
            href="/m/pay?tab=quota"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Hạn Mức AI</span>
          </Link>

          {/* Tính điểm thi */}
          <Link
            href="/new-mark-calculate"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calculator className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Tính Điểm</span>
          </Link>

          {/* Phòng thí nghiệm ảo */}
          <Link
            href="/new-labs"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Lab Ảo</span>
          </Link>

          {/* Chế độ Focus */}
          <Link
            href="/new-focus"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Gauge className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Focus</span>
          </Link>

          {/* Sen Video */}
          <Link
            href="/new-video"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center">
              <Video className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Video</span>
          </Link>

          {/* SenRead */}
          <Link
            href="/read"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">SenRead</span>
          </Link>

          {/* Lịch Học & Lịch Thi */}
          <Link
            href="/new-schedule"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Lịch Thi</span>
          </Link>

          {/* Lớp Học Của Tôi */}
          <Link
            href="/new-student"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Lớp Học</span>
          </Link>

          {/* Cửa Hàng Độc Quyền */}
          <Link
            href="/new-exclusive-store"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Cửa Hàng</span>
          </Link>

          {/* Hòm Thư SenMail */}
          <Link
            href="/sen-mail"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">SenMail</span>
          </Link>

          {/* Breathe-U */}
          <Link
            href="/breathe-u"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-xs active:scale-95 transition space-y-1 text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Wind className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Breathe-U</span>
          </Link>
        </div>
      </div>

      {/* 6. THANH CUỘN MÔN HỌC (CHIPS) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Khối Môn Học</span>
          <span className="text-[10px] text-slate-400">Cuộn ngang</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {subjects.map((sub) => (
            <button
              key={sub.key}
              type="button"
              onClick={() => setSelectedSubject(sub.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedSubject === sub.key
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/10'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>

      {/* 7. DANH SÁCH ĐỀ THI MỚI NHẤT (CARD MOBILE) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-violet-500" /> Đề Thi Mới Nhất
          </h3>
          <Link
            href="/m/sen-ground?tab=exams"
            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 flex items-center gap-0.5"
          >
            Xem tất cả <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {filteredExams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center text-xs text-slate-400">
            Không có đề thi nào phù hợp với bộ lọc môn học này.
          </div>
        ) : (
          filteredExams.slice(0, 6).map((exam) => (
            <div
              key={exam.id}
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      {exam.exam_type || 'Đề Khảo Thí'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {exam.duration || 50} phút • {exam.total_questions || 40} câu
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                    {exam.title}
                  </h4>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                <span className="text-[10px] text-slate-400 font-medium">
                  {exam.subject || 'Tổng hợp'}
                </span>
                <Link
                  href={`/m/exams/${exam.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs shadow-xs active:scale-95 transition"
                >
                  <Zap className="h-3 w-3" />
                  <span>Vào thi ngay</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 8. TÀI LIỆU ÔN TẬP HOT TRONG THƯ VIỆN SEN ONLINE */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-sky-500" /> Tài Liệu Ôn Tập Mới
          </h3>
          <Link
            href="/m/sen-ground?tab=library"
            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-0.5"
          >
            Thư viện <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-2">
          {docs.slice(0, 4).map((doc) => (
            <Link
              key={doc.id}
              href="/m/sen-ground?tab=library"
              className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs active:scale-98 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {doc.title}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* FOOTER BẢN QUYỀN MOBILE */}
      <footer className="pt-4 pb-2 text-center text-[10px] text-slate-400 space-y-1">
        <p>SenExam Mobile Platform • Phiên bản thuần di động <span className="font-mono font-bold text-violet-600 dark:text-violet-400">v{MOBILE_VERSION}</span></p>
        <p>
          Mở trên máy tính?{' '}
          <a href="https://senexam.me?desktop=true" className="text-violet-600 dark:text-violet-400 underline font-bold">
            Chuyển sang bản Desktop
          </a>
        </p>
      </footer>
    </div>
  )
}
