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
  TrendingDown,
  FileCheck,
  Zap,
  Target,
  Trophy,
  Flame,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-history-subs-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-history-subs-body' })

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
    drive_file_id?: string | null
    allow_review?: boolean
  } | null
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

export default function NewHistorySubmissionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')
  const [filterScoreStatus, setFilterScoreStatus] = useState<'all' | 'high' | 'low' | 'graded'>('all')
  const [chartExamFilter, setChartExamFilter] = useState('Tất cả')
  const [showChart, setShowChart] = useState(true)
  const [chartZoom, setChartZoom] = useState(1)
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

    const fetchHistorySubmissions = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-idp')
        return
      }

      await ensureStudentProfile(user.id)

      const { data, error } = await supabase
        .from('submissions')
        .select('*, exams(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching submissions history:', error)
      } else {
        setSubmissions((data as any) || [])
      }
      setLoading(false)
    }

    fetchHistorySubmissions()
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
    if (count === 0) return { count: 0, points: [], avg: '0', max: '0', min: '0', trend: 0, maxScoreRange: 10, gridSteps: [0, 2.5, 5, 7.5, 10], svgWidth: 650, svgHeight: 200 }

    const scores = gradedItems.map((s) => s.score || 0)
    const rawMax = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = (scores.reduce((a, b) => a + b, 0) / count).toFixed(1)

    // Thang điểm tối đa thích ứng (10 cho THPTQG, 100/150 cho ĐGNL/TSA)
    const maxScoreVal = Math.max(10, rawMax)
    const maxScoreRange = maxScoreVal <= 10 ? 10 : maxScoreVal <= 100 ? 100 : maxScoreVal <= 150 ? 150 : Math.ceil(maxScoreVal / 50) * 50
    const gridSteps = maxScoreRange === 10
      ? [0, 2.5, 5, 7.5, 10]
      : [0, Math.round(maxScoreRange * 0.25), Math.round(maxScoreRange * 0.5), Math.round(maxScoreRange * 0.75), maxScoreRange]

    // Tính trend so sánh 3 bài gần nhất so với các bài ban đầu
    const recentScores = scores.slice(-3)
    const initialScores = scores.slice(0, 3)
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const initialAvg = initialScores.reduce((a, b) => a + b, 0) / initialScores.length
    const trend = parseFloat((recentAvg - initialAvg).toFixed(1))

    // Tạo tọa độ SVG thích ứng với Zoom
    const baseWidth = Math.max(650, count * 55)
    const svgWidth = baseWidth * chartZoom
    const svgHeight = 200
    const paddingX = 50
    const paddingY = 30

    const points = gradedItems.map((item, idx) => {
      const x = count === 1 ? svgWidth / 2 : paddingX + (idx / (count - 1)) * (svgWidth - paddingX * 2)
      const rawScore = item.score || 0
      const clampedRatio = Math.max(0, Math.min(1, rawScore / maxScoreRange))
      const y = svgHeight - paddingY - clampedRatio * (svgHeight - paddingY * 2)

      return {
        x,
        y,
        score: rawScore,
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

    return {
      count,
      points,
      avg,
      max: rawMax.toFixed(1),
      min: min.toFixed(1),
      trend,
      maxScoreRange,
      gridSteps,
      svgWidth,
      svgHeight,
      pathString,
      areaPath,
    }
  }, [submissions, chartExamFilter, chartZoom])

  // Lọc và sắp xếp danh sách bài nộp
  const filteredSubmissions = useMemo(() => {
    let result = [...submissions]

    // 1. Tìm kiếm theo tên hoặc môn
    const q = deferredQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((item) => {
        const title = (item.exams?.title || '').toLowerCase()
        const subject = (item.exams?.subject || '').toLowerCase()
        return title.includes(q) || subject.includes(q)
      })
    }

    // 2. Lọc theo thể loại đề thi
    if (selectedType !== 'Tất cả') {
      result = result.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (selectedType === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (selectedType === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (selectedType === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(selectedType.toUpperCase())
      })
    }

    // 3. Lọc theo trạng thái điểm số (tích hợp từ new-submissions)
    if (filterScoreStatus === 'high') {
      result = result.filter((item) => (item.score ?? 0) >= 8.0)
    } else if (filterScoreStatus === 'low') {
      result = result.filter((item) => item.score !== null && (item.score ?? 0) < 5.0)
    } else if (filterScoreStatus === 'graded') {
      result = result.filter((item) => item.is_graded || item.score !== null)
    }

    // 4. Sắp xếp
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0)
      return 0
    })

    return result
  }, [submissions, deferredQuery, selectedType, filterScoreStatus, sortBy])

  // Thống kê tổng hợp
  const stats = useMemo(() => {
    const total = submissions.length
    const graded = submissions.filter((s) => s.score !== null && s.score !== undefined)
    const scores = graded.map((s) => s.score || 0)
    const highest = scores.length > 0 ? Math.max(...scores).toFixed(1) : '—'
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
    const highCount = submissions.filter((s) => (s.score ?? 0) >= 8.0).length

    // Tổng thời gian làm bài (giây sang phút)
    const totalSecs = submissions.reduce((acc, s) => acc + (s.time_spent || 0), 0)
    const totalMinutes = Math.round(totalSecs / 60)

    return { total, highest, avg, highCount, totalMinutes }
  }, [submissions])

  const themeVars = getModernThemeVars('teal', isDark)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Đang tải Lịch sử Bài nộp...</p>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen pb-24 text-slate-800 dark:text-slate-100 transition-colors font-sans`}
      style={themeVars}
    >
      {/* HEADER TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-history-subs-heading)' }}>
                  Lịch sử Bài nộp
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  Tra cứu kết quả thi, phân tích tiến độ điểm số và xem lại lời giải chi tiết
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChart((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
              title="Ẩn/Hiện biểu đồ"
            >
              <BarChart3 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">{showChart ? 'Thu gọn biểu đồ' : 'Xem biểu đồ'}</span>
              {showChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition"
              title={isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI CARDS THỐNG KÊ NHANH */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng bài đã nộp</span>
              <FileText className="h-4 w-4 text-teal-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-history-subs-heading)' }}>
              {stats.total}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Bài thi trên hệ thống</p>
          </div>

          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm cao nhất</span>
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400" style={{ fontFamily: 'var(--font-history-subs-heading)' }}>
              {stats.highest}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Kỷ lục điểm số của bạn</p>
          </div>

          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm trung bình</span>
              <Award className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-indigo-600 dark:text-indigo-400" style={{ fontFamily: 'var(--font-history-subs-heading)' }}>
              {stats.avg}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{stats.highCount} bài đạt điểm giỏi (≥ 8.0)</p>
          </div>

          <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Thời gian luyện đề</span>
              <Clock className="h-4 w-4 text-sky-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-sky-600 dark:text-sky-400" style={{ fontFamily: 'var(--font-history-subs-heading)' }}>
              {stats.totalMinutes} <span className="text-xs font-bold text-slate-500">phút</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Tổng thời gian ngồi làm bài</p>
          </div>
        </section>

        {/* BIỂU ĐỒ TIẾN TRÌNH ĐIỂM SỐ (SVG CHART VỚI ZOOM & TOOLTIP) */}
        {showChart && chartData.count > 0 && (
          <section className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Đồ Thị Tiến Trình Điểm Số
                  </h2>
                  <p className="text-xs text-slate-500">
                    Theo dõi biến động phong độ qua từng đề thi (Tổng cộng {chartData.count} lần thi)
                  </p>
                </div>
              </div>

              {/* Lọc thể loại đồ thị & Zoom */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                  {['Tất cả', 'THPTQG', 'HSA', 'TSA'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartExamFilter(t)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        chartExamFilter === t
                          ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setChartZoom((z) => Math.max(1, z - 0.25))}
                    disabled={chartZoom <= 1}
                    className="px-2 py-0.5 rounded font-bold hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40"
                    title="Thu nhỏ"
                  >
                    -
                  </button>
                  <span className="px-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                    {Math.round(chartZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setChartZoom((z) => Math.min(2.5, z + 0.25))}
                    disabled={chartZoom >= 2.5}
                    className="px-2 py-0.5 rounded font-bold hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40"
                    title="Phóng to"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* SVG Interactive Canvas */}
            <div className="relative overflow-x-auto rounded-2xl border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/40 p-2">
              <div style={{ width: chartData.svgWidth, minWidth: '100%' }} className="relative h-56">
                <svg
                  width={chartData.svgWidth}
                  height={chartData.svgHeight}
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0D9488" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Lưới ngang (Grid lines) */}
                  {chartData.gridSteps.map((stepVal, idx) => {
                    const ratio = stepVal / chartData.maxScoreRange
                    const y = chartData.svgHeight - 30 - ratio * (chartData.svgHeight - 60)
                    return (
                      <g key={idx}>
                        <line
                          x1={40}
                          y1={y}
                          x2={chartData.svgWidth - 20}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-800"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={15}
                          y={y + 4}
                          className="fill-slate-400 text-[10px] font-mono font-semibold"
                        >
                          {stepVal}
                        </text>
                      </g>
                    )
                  })}

                  {/* Vùng diện tích gradient */}
                  {chartData.areaPath && (
                    <path d={chartData.areaPath} fill="url(#chartGradient)" />
                  )}

                  {/* Đường line biểu đồ */}
                  {chartData.pathString && (
                    <path
                      d={chartData.pathString}
                      fill="none"
                      stroke="#0D9488"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Các điểm nút (Points) */}
                  {chartData.points.map((p, idx) => (
                    <g key={idx} className="cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="5"
                        className="fill-white dark:fill-slate-900 stroke-teal-600 dark:stroke-teal-400 stroke-2 transition-transform hover:scale-150"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  ))}
                </svg>

                {/* Tooltip nổi khi hover điểm */}
                {hoveredPoint && (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900/90 text-white p-2.5 text-xs shadow-xl backdrop-blur-md border border-white/10"
                    style={{ left: hoveredPoint.x, top: hoveredPoint.y - 10 }}
                  >
                    <p className="font-bold text-amber-400 truncate max-w-[200px]">{hoveredPoint.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-300">
                      <span>Điểm: <strong className="text-white text-sm">{hoveredPoint.score}</strong></span>
                      <span>Ngày: {hoveredPoint.date}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* THANH TÌM KIẾM, BỘ LỌC VÀ SẮP XẾP */}
        <section className="p-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Input tìm kiếm */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm bài làm theo tên đề thi, môn học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>

            {/* Sắp xếp */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="highest">Điểm cao nhất</option>
                <option value="lowest">Điểm thấp nhất</option>
              </select>
            </div>
          </div>

          {/* Hàng bộ lọc: Kỳ thi & Trạng thái điểm */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/5 dark:border-white/5">
            {/* Lọc thể loại */}
            <div className="flex flex-wrap items-center gap-1.5">
              {EXAM_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    selectedType === type
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Lọc thang điểm (high / low / all) */}
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl text-xs">
              <button
                onClick={() => setFilterScoreStatus('all')}
                className={`px-2.5 py-0.5 rounded-lg font-bold transition ${
                  filterScoreStatus === 'all'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Tất cả điểm
              </button>
              <button
                onClick={() => setFilterScoreStatus('high')}
                className={`px-2.5 py-0.5 rounded-lg font-bold transition ${
                  filterScoreStatus === 'high'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                ≥ 8.0 Giỏi
              </button>
              <button
                onClick={() => setFilterScoreStatus('low')}
                className={`px-2.5 py-0.5 rounded-lg font-bold transition ${
                  filterScoreStatus === 'low'
                    ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                &lt; 5.0 Cần ôn
              </button>
            </div>
          </div>
        </section>

        {/* DANH SÁCH BÀI THI ĐÃ NỘP */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span>Danh sách kết quả</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 font-bold">
                {filteredSubmissions.length} bài
              </span>
            </h2>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-dashed border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-900/40">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3 opacity-60" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy bài nộp nào phù hợp</p>
              <p className="text-xs text-slate-500 mt-1">Thử thay đổi từ khóa hoặc điều chỉnh bộ lọc xem nhé</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSubmissions.map((sub) => {
                const exam = sub.exams
                const score = sub.score
                const isHigh = score !== null && score !== undefined && score >= 8.0
                const isLow = score !== null && score !== undefined && score < 5.0
                const scoreColor = isHigh
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : isLow
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20'

                const timeMins = sub.time_spent ? Math.round(sub.time_spent / 60) : 0

                return (
                  <div
                    key={sub.id}
                    className="p-4 sm:p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xs hover:border-teal-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Cột thông tin đề */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Huy hiệu điểm số nổi bật */}
                      <div
                        className={`h-14 w-14 shrink-0 rounded-2xl border flex flex-col items-center justify-center font-black ${scoreColor}`}
                        style={{ fontFamily: 'var(--font-history-subs-heading)' }}
                      >
                        <span className="text-lg leading-none">{score !== null && score !== undefined ? score : '—'}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">Điểm</span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5">
                            {exam?.exam_type || 'Đề luyện tập'}
                          </span>
                          {exam?.subject && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                              {exam.subject}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeMins > 0 ? `${timeMins} phút` : 'Chưa ghi nhận'}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(sub.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {exam?.title || 'Đề thi không xác định'}
                        </h3>

                        {sub.feedback && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                            💬 Nhận xét: {sub.feedback}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cột nút hành động */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Xem lời giải PDF nếu có */}
                      {exam?.solution_pdf_url && (
                        <button
                          onClick={() => {
                            setPreviewPdfUrl(exam.solution_pdf_url!)
                            setPreviewPdfTitle(`Lời giải: ${exam.title}`)
                          }}
                          className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                          title="Xem đáp án PDF"
                        >
                          <FileText className="h-3.5 w-3.5 text-amber-500" />
                          <span className="hidden sm:inline">Đáp án PDF</span>
                        </button>
                      )}

                      {/* Làm lại đề */}
                      {sub.exam_id && (
                        <Link
                          href={`/new-exams/${sub.exam_id}`}
                          className="p-2 sm:px-3 sm:py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                          title="Làm lại đề thi này"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Làm lại</span>
                        </Link>
                      )}

                      {/* Xem lại bài làm chi tiết */}
                      <Link
                        href={`/new-history-submissions/${sub.id}`}
                        className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Xem chi tiết</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* MODAL XEM TRƯỚC FILE PDF */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="max-w-4xl w-full h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm truncate pr-2 text-slate-900 dark:text-white">
                {previewPdfTitle}
              </h3>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold hover:bg-black/10 transition"
              >
                Đóng
              </button>
            </div>
            <iframe src={previewPdfUrl} className="flex-1 w-full border-none" />
          </div>
        </div>
      )}
    </main>
  )
}
