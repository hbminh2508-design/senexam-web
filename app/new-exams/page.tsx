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
  Clock,
  BookOpen,
  Rocket,
  Crown,
  Lock,
  KeyRound,
  FileText,
  Download,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronRight,
  Sun,
  Moon,
  TrendingUp,
  History,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newexams-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newexams-body' })

type ExamItem = {
  id: string
  title: string
  exam_type: string
  subject?: string | null
  duration: number
  pdf_url?: string | null
  solution_pdf_url?: string | null
  created_at: string
  is_hidden?: boolean
  access_code?: string | null
  is_vip?: boolean | null
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

export default function NewExamsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [exams, setExams] = useState<ExamItem[]>([])
  const [userSubmissions, setUserSubmissions] = useState<{ exam_id: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')

  // Nhập mã truy cập đề riêng tư
  const [accessCode, setAccessCode] = useState('')
  const [accessCodeError, setAccessCodeError] = useState('')
  const [accessCodeLoading, setAccessCodeLoading] = useState(false)

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  const deferredQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchExams = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)

      // 1. Lấy danh sách đề thi công khai (không bị ẩn và không phải đề riêng của lớp)
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*, class_exams(id, class_id)')
        .or('is_hidden.eq.false,is_hidden.is.null')
        .order('created_at', { ascending: false })

      // 2. Lấy số lượt thi của user
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('exam_id')
        .eq('user_id', user.id)

      if (examsError) {
        console.error('Error fetching exams:', examsError)
      } else {
        // Chỉ lấy các đề thi công khai chung của hệ thống (không gán vào lớp học riêng)
        const publicExams = (examsData || []).filter((ex: any) => {
          if (Array.isArray(ex.class_exams) && ex.class_exams.length > 0) return false
          if (ex.is_hidden) return false
          return true
        })
        setExams(publicExams)
      }

      setUserSubmissions(submissionsData || [])
      setLoading(false)
    }

    fetchExams()
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

  // Mở đề thi bằng mã bí mật (Private Exam)
  const handleUnlockPrivateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessCode.trim()) return

    setAccessCodeLoading(true)
    setAccessCodeError('')

    try {
      const code = accessCode.trim().toUpperCase()
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('access_code', code)
        .single()

      if (error || !data) {
        setAccessCodeError('Mã truy cập không hợp lệ hoặc đề thi không tồn tại.')
      } else {
        router.push(`/new-exams/${data.id}`)
      }
    } catch (err: any) {
      setAccessCodeError('Không tìm thấy đề thi với mã này.')
    } finally {
      setAccessCodeLoading(false)
    }
  }

  // Đếm số lần user đã làm đề này
  const getAttemptCount = (examId: string) => {
    return userSubmissions.filter((s) => s.exam_id === examId).length
  }

  // Lọc đề thi
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchSearch = exam.title.toLowerCase().includes(deferredQuery.toLowerCase().trim())
      const matchType = selectedType === 'Tất cả' || exam.exam_type === selectedType
      return matchSearch && matchType
    })
  }, [exams, deferredQuery, selectedType])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải ngân hàng đề thi SenExam...</span>
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
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Sparkles className="inline h-3 w-3 mr-1" /> Ngân Hàng Đề 2026
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
                Kho Đề Thi & Khảo Thí
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Toàn bộ các bộ đề bám sát cấu trúc thi chuẩn THPTQG, HSA, TSA do giáo viên biên soạn.
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
              href="/new-history"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold shadow-sm transition hover:bg-black/5"
            >
              <History className="h-4 w-4 text-teal-500" /> Xem lịch sử thi
            </Link>
          </div>
        </div>

        {/* Search Toolbar & Private Exam Code Box */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
          
          {/* Main Filter & Search */}
          <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Tìm đề thi: THPTQG Toán, ĐGNL HSA, Lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500"
              />
            </div>

            {/* Exam Type Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
              {EXAM_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
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

          {/* Nhập mã đề thi riêng tư */}
          <form
            onSubmit={handleUnlockPrivateExam}
            className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                <KeyRound className="h-4 w-4" /> Đề thi có mã bảo mật
              </div>
              <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1">
                Nhập mã đề do giáo viên cung cấp để mở đề thi ẩn.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Mã đề (VD: THPT2026)"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-3 text-xs font-black uppercase tracking-wider outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={accessCodeLoading || !accessCode.trim()}
                className="h-9 rounded-xl bg-amber-500 text-slate-950 px-3 text-xs font-bold transition hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {accessCodeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mở đề'}
              </button>
            </div>
            {accessCodeError && (
              <p className="mt-1 text-[10px] font-bold text-rose-500">{accessCodeError}</p>
            )}
          </form>
        </div>

        {/* Exams Grid */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
              Danh sách đề thi ({filteredExams.length})
            </h2>
          </div>

          {filteredExams.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-12 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                <BookOpen className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">Không tìm thấy đề thi phù hợp</h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục đề thi khác.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredExams.map((exam) => {
                const attemptCount = getAttemptCount(exam.id)
                const isVip = exam.is_vip

                return (
                  <div
                    key={exam.id}
                    className="group relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                  >
                    {/* Top gradient stripe */}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-500" />

                    <div>
                      {/* Badge header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {exam.exam_type}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isVip && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase">
                              <Crown className="h-3 w-3" /> VIP
                            </span>
                          )}
                          {attemptCount > 0 && (
                            <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                              Đã làm {attemptCount} lần
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="mt-3 text-lg font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
                        {exam.title}
                      </h3>

                      {/* Meta Info */}
                      <div className="mt-3 flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="h-3.5 w-3.5 text-amber-500" /> {exam.duration || 50} phút
                        </span>
                        {exam.subject && (
                          <span className="flex items-center gap-1 font-semibold">
                            <BookOpen className="h-3.5 w-3.5 text-teal-500" /> {exam.subject}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-3.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                      {exam.pdf_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPdfUrl(exam.pdf_url!)
                            setPreviewPdfTitle(exam.title)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                          title="Xem trước file PDF"
                        >
                          <FileText className="h-3.5 w-3.5 text-rose-500" /> Xem đề PDF
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6B7280] dark:text-slate-400 font-semibold">
                          Đề thi trực tuyến
                        </span>
                      )}

                      <Link
                        href={`/new-exams/${exam.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:opacity-90 active:scale-95"
                      >
                        <Rocket className="h-3.5 w-3.5" /> Vào thi
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[85vh] rounded-[30px] border border-white/20 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
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

            {/* Modal Body: PDF Iframe */}
            <div className="flex-1 w-full bg-slate-950">
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
