'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
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
  TrendingDown,
  FileCheck,
  Zap,
  Target,
  Trophy,
  Flame,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newhist-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newhist-body' })

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
    solution_pdf_url?: string | null
    allow_review?: boolean
  } | null
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

export default function NewHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')
  const [chartExamFilter, setChartExamFilter] = useState('Tất cả')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')

  // Tooltip state for score chart
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; title: string; score: number; date: string } | null>(null)

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  const deferredQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchHistory = async () => {
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

    fetchHistory()
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

  // Dữ liệu đồ thị chuyển biến điểm số qua các lần thi
  const chartData = useMemo(() => {
    // Sắp xếp theo thứ tự thời gian tăng dần để vẽ đường xu hướng
    let list = [...submissions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (chartExamFilter !== 'Tất cả') {
      list = list.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (chartExamFilter === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (chartExamFilter === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (chartExamFilter === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(chartExamFilter.toUpperCase())
      })
    }

    const gradedItems = list.filter((s) => s.score !== null && s.score !== undefined)
    const count = gradedItems.length
    if (count === 0) return { count: 0, points: [], avg: '0', max: '0', min: '0', trend: 0 }

    const scores = gradedItems.map((s) => s.score || 0)
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = (scores.reduce((a, b) => a + b, 0) / count).toFixed(1)

    // Tính trend so sánh 3 bài gần nhất so với các bài trước
    const recentScores = scores.slice(-3)
    const initialScores = scores.slice(0, 3)
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const initialAvg = initialScores.reduce((a, b) => a + b, 0) / initialScores.length
    const trend = parseFloat((recentAvg - initialAvg).toFixed(1))

    // Tạo tọa độ SVG (width = 600, height = 180)
    const svgWidth = 600
    const svgHeight = 180
    const paddingX = 40
    const paddingY = 25

    const points = gradedItems.map((item, idx) => {
      const x = count === 1 ? svgWidth / 2 : paddingX + (idx / (count - 1)) * (svgWidth - paddingX * 2)
      const score = item.score || 0
      // Scale 0 -> 10 to SVG height
      const y = svgHeight - paddingY - (score / 10) * (svgHeight - paddingY * 2)
      return {
        x,
        y,
        score,
        date: new Date(item.created_at).toLocaleDateString('vi-VN'),
        title: item.exams?.title || 'Đề thi tự luyện',
      }
    })

    const pathString = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    }, '')

    const areaPath = points.length > 0
      ? `${pathString} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
      : ''

    return { count, points, avg, max: max.toFixed(1), min: min.toFixed(1), trend, pathString, areaPath }
  }, [submissions, chartExamFilter])

  // Xếp hạng phong độ theo từng thể loại / môn thi
  const subjectRankings = useMemo(() => {
    const groupMap: Record<string, { count: number; maxScore: number; totalScore: number }> = {}

    submissions.forEach((item) => {
      if (item.score === null || item.score === undefined) return
      const key = item.exams?.exam_type || item.exams?.subject || 'Kỳ thi thử'
      if (!groupMap[key]) groupMap[key] = { count: 0, maxScore: 0, totalScore: 0 }
      groupMap[key].count += 1
      groupMap[key].maxScore = Math.max(groupMap[key].maxScore, item.score || 0)
      groupMap[key].totalScore += item.score || 0
    })

    return Object.entries(groupMap).map(([name, data]) => {
      const avgScore = (data.totalScore / data.count).toFixed(1)
      const numAvg = parseFloat(avgScore)
      let tier = 'Hạng Đồng'
      let tierColor = 'text-amber-700 bg-amber-500/10 border-amber-500/20'

      if (numAvg >= 9.0) {
        tier = 'Kim Cương'
        tierColor = 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
      } else if (numAvg >= 8.0) {
        tier = 'Hạng Vàng'
        tierColor = 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30'
      } else if (numAvg >= 6.5) {
        tier = 'Hạng Bạc'
        tierColor = 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 border-indigo-500/30'
      }

      return {
        name,
        count: data.count,
        maxScore: data.maxScore.toFixed(1),
        avgScore,
        tier,
        tierColor,
      }
    })
  }, [submissions])

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const total = submissions.length
    if (total === 0) return { total: 0, avg: '0', max: '0', totalTimeMin: 0 }

    const graded = submissions.filter((s) => s.score !== null && s.score !== undefined)
    const sumScore = graded.reduce((acc, curr) => acc + (curr.score || 0), 0)
    const avgScore = graded.length > 0 ? (sumScore / graded.length).toFixed(1) : '0'
    const maxScore = graded.length > 0 ? Math.max(...graded.map((s) => s.score || 0)).toFixed(1) : '0'

    const totalSeconds = submissions.reduce((acc, curr) => acc + (curr.time_spent || 0), 0)
    const totalMinutes = Math.round(totalSeconds / 60)

    return {
      total,
      avg: avgScore,
      max: maxScore,
      totalTimeMin: totalMinutes,
    }
  }, [submissions])

  // Lọc và sắp xếp danh sách
  const filteredSubmissions = useMemo(() => {
    let result = submissions.filter((item) => {
      const title = item.exams?.title || 'Đề thi tự luyện'
      const matchSearch = title.toLowerCase().includes(deferredQuery.toLowerCase().trim())
      const matchType = selectedType === 'Tất cả' || item.exams?.exam_type === selectedType
      return matchSearch && matchType
    })

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0)
      return 0
    })

    return result
  }, [submissions, deferredQuery, selectedType, sortBy])

  const formatTimeSpent = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return 'Dưới 1 phút'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs} giây`
    return `${mins} phút ${secs > 0 ? `${secs}s` : ''}`
  }

  const formatScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return { text: 'Chờ chấm', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' }
    }
    if (score >= 8.0) {
      return { text: `${score.toFixed(1)} / 10`, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
    }
    if (score >= 5.0) {
      return { text: `${score.toFixed(1)} / 10`, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    }
    return { text: `${score.toFixed(1)} / 10`, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải lịch sử thi và phân tích biểu đồ...</span>
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
        
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Trophy className="inline h-3 w-3 mr-1" /> Hồ Sơ & Bảng Điểm
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
                Lịch Sử Làm Bài & Đồ Thị Điểm Số
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Theo dõi quỹ đạo tiến bộ, xếp hạng phong độ môn thi và xem chi tiết bài giải.
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
              <span className="text-[11px] font-bold uppercase tracking-wider">Đã hoàn thành</span>
              <FileCheck className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
              {stats.total} <span className="text-xs font-semibold text-[#6B7280]">bài</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Điểm trung bình</span>
              <BarChart3 className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
              {stats.avg} <span className="text-xs font-semibold text-[#6B7280]">/ 10</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Điểm cao nhất</span>
              <Award className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
              {stats.max} <span className="text-xs font-semibold text-[#6B7280]">/ 10</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Thời gian tích luỹ</span>
              <Clock className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
              {stats.totalTimeMin} <span className="text-xs font-semibold text-[#6B7280]">phút</span>
            </p>
          </div>
        </div>

        {/* SECTION 1: ĐỒ THỊ CHUYỂN BIẾN ĐIỂM SỐ (SCORE TRAJECTORY GRAPH) */}
        <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
                  Quỹ Đạo Chuyển Biến Điểm Số
                </h2>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Biểu đồ diễn biến phong độ thi qua từng lần làm bài liên tiếp
              </p>
            </div>

            {/* Filter Buttons for Graph */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['Tất cả', 'THPTQG', 'HSA', 'TSA'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setChartExamFilter(tab)}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition whitespace-nowrap ${
                    chartExamFilter === tab
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {chartData.count === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B7280] dark:text-slate-400">
              Chưa có dữ liệu bài thi cho danh mục {chartExamFilter}.
            </div>
          ) : (
            <div className="relative">
              {/* Insight Badges */}
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs">
                <span className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 font-bold">
                  Đỉnh cao: {chartData.max}đ
                </span>
                <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 font-bold">
                  Trung bình: {chartData.avg}đ
                </span>
                {chartData.trend !== 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                    chartData.trend > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {chartData.trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    Xu hướng: {chartData.trend > 0 ? `+${chartData.trend}` : chartData.trend}đ
                  </span>
                )}
              </div>

              {/* Interactive SVG Chart */}
              <div className="relative w-full overflow-hidden rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] p-2">
                <svg viewBox="0 0 600 180" className="w-full h-44 overflow-visible">
                  <defs>
                    <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 2.5, 5, 7.5, 10].map((val) => {
                    const y = 180 - 25 - (val / 10) * (180 - 50)
                    return (
                      <g key={val}>
                        <line x1="40" y1={y} x2="560" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                        <text x="32" y={y + 3} textAnchor="end" fill="currentColor" opacity="0.4" fontSize="9" fontWeight="bold">
                          {val}
                        </text>
                      </g>
                    )
                  })}

                  {/* Area fill */}
                  {chartData.areaPath && (
                    <path d={chartData.areaPath} fill="url(#scoreAreaGrad)" />
                  )}

                  {/* Line stroke */}
                  {chartData.pathString && (
                    <path
                      d={chartData.pathString}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive Nodes */}
                  {chartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r="5.5"
                      fill="#fff"
                      stroke="#4F46E5"
                      strokeWidth="3"
                      className="cursor-pointer transition-transform hover:scale-150"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </svg>

                {/* Hover Tooltip */}
                {hoveredPoint && (
                  <div
                    className="pointer-events-none absolute z-20 rounded-xl bg-slate-900 text-white p-2.5 text-xs shadow-xl border border-white/20 -translate-x-1/2 -translate-y-full"
                    style={{ left: `${(hoveredPoint.x / 600) * 100}%`, top: `${(hoveredPoint.y / 180) * 100}%` }}
                  >
                    <p className="font-bold truncate max-w-[180px]">{hoveredPoint.title}</p>
                    <p className="text-[11px] text-amber-400 font-black">Điểm: {hoveredPoint.score}/10</p>
                    <p className="text-[10px] text-slate-400">{hoveredPoint.date}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: BẢNG XẾP HẠNG PHONG ĐỘ THEO THỂ LOẠI (TIER RANKINGS) */}
        {subjectRankings.length > 0 && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-black/10 dark:border-white/10">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
                Xếp Hạng Phong Độ Theo Kỳ Thi
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectRankings.map((sub, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm">{sub.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border ${sub.tierColor}`}>
                      {sub.tier}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400">
                    <span>Số bài: <strong>{sub.count}</strong></span>
                    <span>Đỉnh cao: <strong className="text-amber-600 dark:text-amber-400">{sub.maxScore}đ</strong></span>
                    <span>TB: <strong className="text-indigo-600 dark:text-indigo-400">{sub.avgScore}đ</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: BỘ LỌC VÀ TÌM KIẾM DANH SÁCH BÀI THI */}
        <div className="mt-6 rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Tìm bài thi đã làm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400 whitespace-nowrap">Sắp xếp:</span>
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
                    : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 4: DANH SÁCH BÀI NỘP */}
        <div className="mt-6 space-y-3.5">
          {filteredSubmissions.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-12 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">Chưa có bài thi nào phù hợp</h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                Bạn chưa làm bài thi nào hoặc không tìm thấy bài thi theo tiêu chí lọc hiện tại.
              </p>
              <Link
                href="/new-exams"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:opacity-90 mt-2"
              >
                Khám phá kho đề thi ngay <ChevronRight className="h-4 w-4" />
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
                        <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-slate-400">
                          <Clock className="h-3 w-3" /> {formatTimeSpent(sub.time_spent)}
                        </span>
                      </div>

                      <h3 className="text-lg font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
                        {examTitle}
                      </h3>

                      {sub.feedback && (
                        <p className="text-xs text-[#4B5563] dark:text-slate-300 line-clamp-1 italic">
                          💬 Nhận xét: {sub.feedback}
                        </p>
                      )}
                    </div>

                    {/* Right: Score Badge & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                      
                      {/* Score Badge */}
                      <div className={`rounded-2xl border px-3.5 py-2 text-center font-black ${scoreBadge.color}`}>
                        <span className="text-[10px] uppercase tracking-wider block opacity-75 font-bold">Điểm số</span>
                        <span className="text-base sm:text-lg" style={{ fontFamily: 'var(--font-newhist-heading)' }}>
                          {scoreBadge.text}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        
                        {/* Nút Xem bài làm & Lời giải */}
                        <Link
                          href={`/submissions/${sub.id}/review`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-3 py-2 text-xs font-bold shadow-sm transition"
                        >
                          <FileText className="h-3.5 w-3.5" /> Lời giải
                        </Link>

                        {/* Nút Xem Đề PDF nếu có */}
                        {pdfUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewPdfUrl(pdfUrl)
                              setPreviewPdfTitle(examTitle)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                            title="Xem và tải file PDF đề thi"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-500" /> PDF
                          </button>
                        )}

                        {/* Nút Làm lại tại new-exams/[id] */}
                        {sub.exam_id && (
                          <Link
                            href={`/new-exams/${sub.exam_id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                            title="Làm lại đề thi này"
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
