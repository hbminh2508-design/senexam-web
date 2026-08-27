'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
  Download,
  RotateCcw,
  Award,
  BarChart3,
  BookOpen,
  Sparkles,
  Loader2,
  ChevronRight,
  Sun,
  Moon,
  TrendingUp,
  FileCheck,
  Zap,
  Eye,
  Filter,
  Trophy,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newsubs-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newsubs-body' })

type SubmissionItem = {
  id: string
  exam_id: string
  user_id: string
  score: number | null
  time_spent: number | null
  is_graded: boolean
  feedback: string | null
  created_at: string
  exams?: {
    id?: string
    title?: string
    exam_type?: string
    subject?: string
    duration?: number
    pdf_url?: string | null
    drive_file_id?: string | null
    allow_review?: boolean
  } | null
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

export default function NewSubmissionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')
  const [filterStatus, setFilterStatus] = useState<'all' | 'high' | 'low'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  const deferredQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchSubmissions = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)

      const { data, error } = await supabase
        .from('submissions')
        .select('*, exams(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching submissions:', error)
      } else {
        setSubmissions((data as any) || [])
      }
      setLoading(false)
    }

    fetchSubmissions()
  }, [router])

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

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const total = submissions.length
    if (total === 0) return { total: 0, avg: '0', max: '0', passedCount: 0 }

    const graded = submissions.filter((s) => s.score !== null && s.score !== undefined)
    const sumScore = graded.reduce((acc, curr) => acc + (curr.score || 0), 0)
    const avgScore = graded.length > 0 ? (sumScore / graded.length).toFixed(1) : '0'
    const maxScore = graded.length > 0 ? Math.max(...graded.map((s) => s.score || 0)).toFixed(1) : '0'
    const passedCount = graded.filter((s) => (s.score || 0) >= 5).length

    return { total, avg: avgScore, max: maxScore, passedCount }
  }, [submissions])

  // Lọc và sắp xếp
  const filteredSubmissions = useMemo(() => {
    let result = submissions.filter((item) => {
      const title = item.exams?.title || 'Đề thi tự luyện'
      const matchSearch = title.toLowerCase().includes(deferredQuery.toLowerCase().trim())
      const matchType = selectedType === 'Tất cả' || item.exams?.exam_type === selectedType

      let matchStatus = true
      if (filterStatus === 'high') matchStatus = (item.score || 0) >= 8.0
      if (filterStatus === 'low') matchStatus = (item.score || 0) < 5.0

      return matchSearch && matchType && matchStatus
    })

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0)
      return 0
    })

    return result
  }, [submissions, deferredQuery, selectedType, filterStatus, sortBy])

  const formatScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return { text: 'Chờ chấm', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' }
    }
    if (score >= 8.0) {
      return { text: `${score}đ`, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
    }
    if (score >= 5.0) {
      return { text: `${score}đ`, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    }
    return { text: `${score}đ`, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải danh sách bài thi đã làm...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <FileCheck className="inline h-3 w-3 mr-1" /> Quản Lý Bài Thi Đã Làm
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
                Tra Cứu & Xem Lại Đáp Án
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Xem lại chi tiết bài làm, đối chiếu đáp án đúng và làm lại các bài thi để nâng cao điểm số.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" /> Làm đề mới
            </Link>
          </div>
        </div>

        {/* 4 Stat Overview Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Tổng lượt thi</span>
              <FileCheck className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
              {stats.total} <span className="text-xs font-semibold text-[#6B7280]">bài</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Điểm trung bình</span>
              <BarChart3 className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
              {stats.avg} <span className="text-xs font-semibold text-[#6B7280]">{parseFloat(stats.avg) <= 10 ? '/ 10' : 'đ'}</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Điểm cao nhất</span>
              <Award className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
              {stats.max} <span className="text-xs font-semibold text-[#6B7280]">{parseFloat(stats.max) <= 10 ? '/ 10' : 'đ'}</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bài đạt &gt;= 5.0đ</span>
              <Trophy className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
              {stats.passedCount} <span className="text-xs font-semibold text-[#6B7280]">bài</span>
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-6 rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Tìm kiếm bài thi theo tên đề..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500"
              />
            </div>

            {/* Sort & Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="h-10 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-3 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="all">Tất cả kết quả</option>
                <option value="high">Điểm cao (&gt;= 8.0)</option>
                <option value="low">Cần cải thiện (&lt; 5.0)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-3 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="newest">Mới nhất trước</option>
                <option value="oldest">Cũ nhất trước</option>
                <option value="highest">Điểm cao nhất</option>
                <option value="lowest">Điểm thấp nhất</option>
              </select>
            </div>
          </div>

          {/* Exam Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
            {EXAM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  selectedType === type
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions List */}
        <div className="mt-6 space-y-3.5">
          {filteredSubmissions.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-12 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">Không tìm thấy bài thi nào</h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                Bạn chưa nộp bài thi nào hoặc các bài thi không khớp với điều kiện tìm kiếm.
              </p>
              <Link
                href="/new-exams"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:opacity-90 mt-2"
              >
                Làm bài thi ngay <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            filteredSubmissions.map((sub) => {
              const examTitle = sub.exams?.title || 'Đề thi luyện tập'
              const examType = sub.exams?.exam_type || 'Tổng hợp'
              const pdfUrl = sub.exams?.drive_file_id
                ? `https://drive.google.com/file/d/${sub.exams.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`
                : sub.exams?.pdf_url
              const scoreBadge = formatScoreBadge(sub.score)
              const dateStr = new Date(sub.created_at).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })

              return (
                <div
                  key={sub.id}
                  className="group relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md hover:border-black/20 dark:hover:border-white/20"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    
                    {/* Left: Exam Info */}
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {examType}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-slate-400">
                          <Calendar className="h-3 w-3" /> {dateStr}
                        </span>
                        {sub.time_spent && (
                          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-slate-400">
                            <Clock className="h-3 w-3" /> {Math.round(sub.time_spent / 60)} phút
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
                        {examTitle}
                      </h3>

                      {sub.feedback && (
                        <p className="text-xs text-[#4B5563] dark:text-slate-300 line-clamp-1 italic">
                          💬 {sub.feedback}
                        </p>
                      )}
                    </div>

                    {/* Right: Score Badge & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                      
                      {/* Score Badge */}
                      <div className={`rounded-2xl border px-4 py-2 text-center font-black ${scoreBadge.color}`}>
                        <span className="text-[10px] uppercase tracking-wider block opacity-75 font-bold">Điểm số</span>
                        <span className="text-base sm:text-lg" style={{ fontFamily: 'var(--font-newsubs-heading)' }}>
                          {scoreBadge.text}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Xem Lời Giải & Chi Tiết */}
                        <Link
                          href={`/new-submissions/${sub.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-3.5 py-2 text-xs font-bold shadow-sm transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Xem chi tiết
                        </Link>

                        {/* Xem Đề PDF */}
                        {pdfUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewPdfUrl(pdfUrl)
                              setPreviewPdfTitle(examTitle)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                            title="Xem lại đề thi PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-500" /> PDF
                          </button>
                        )}

                        {/* Thi lại */}
                        {sub.exam_id && (
                          <Link
                            href={`/new-exams/${sub.exam_id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                            title="Làm lại bài thi này"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-amber-500" /> Thi lại
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[85vh] rounded-[30px] border border-white/20 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/80">
              <div className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm truncate max-w-md">{previewPdfTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-bold transition hover:bg-amber-400"
                >
                  <Download className="h-3.5 w-3.5" /> Mở trong tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPdfUrl(null)}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="flex-1 w-full bg-slate-950">
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
