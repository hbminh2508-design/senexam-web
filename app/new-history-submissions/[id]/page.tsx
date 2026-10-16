'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Calendar,
  FileText,
  Download,
  RotateCcw,
  Award,
  BookOpen,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Send,
  Maximize2,
  Minimize2,
  AlertTriangle,
  BrainCircuit,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  FileQuestion,
  Check,
  X,
  Layers,
  LayoutList,
  Eye,
  CheckSquare2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import ModernLoading from '@/app/components/ModernLoading'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newrev-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newrev-body' })

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: any) {
    console.warn('[KaTeX/Markdown Render Error]', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-3 text-xs bg-rose-500/10 text-rose-500 rounded-xl font-mono">
            Lỗi hiển thị công thức toán.
          </div>
        )
      )
    }
    return this.props.children
  }
}

const SafeMathRenderer = React.memo(
  ({
    content,
    className,
    gfm = true,
  }: {
    content: string
    className?: string
    gfm?: boolean
  }) => {
    const remarkPlugins = gfm ? [remarkMath, remarkGfm] : [remarkMath]
    const rehypePlugins: any[] = [
      [
        rehypeKatex,
        {
          throwOnError: false,
          errorColor: '#ef4444',
          strict: false,
        },
      ],
    ]

    return (
      <MarkdownErrorBoundary fallback={<span className="text-xs font-mono">{content}</span>}>
        <div className={className}>
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {content}
          </ReactMarkdown>
        </div>
      </MarkdownErrorBoundary>
    )
  }
)
SafeMathRenderer.displayName = 'SafeMathRenderer'

/**
 * Trích xuất nội dung mệnh đề dạng Đúng / Sai 4 ý đa định dạng
 */
function resolveStatementContent(qData: any, sub: string, sIdx: number) {
  const rawOpts = qData?.options
  let subContent = ''

  if (Array.isArray(rawOpts)) {
    subContent = rawOpts[sIdx] || ''
  } else if (rawOpts && typeof rawOpts === 'object') {
    subContent =
      rawOpts[sub] ||
      rawOpts[sub.toUpperCase()] ||
      rawOpts[sIdx] ||
      rawOpts[String(sIdx)] ||
      ''
  }

  if (!subContent && qData?.subQuestions && Array.isArray(qData.subQuestions)) {
    const sq = qData.subQuestions[sIdx]
    subContent = typeof sq === 'object' ? sq?.text || sq?.question || sq?.content : sq
  }
  if (!subContent && qData?.statements && Array.isArray(qData.statements)) {
    const st = qData.statements[sIdx]
    subContent = typeof st === 'object' ? st?.text || st?.statement : st
  }
  if (!subContent && qData?.items && Array.isArray(qData.items)) {
    const it = qData.items[sIdx]
    subContent = typeof it === 'object' ? it?.text || it?.content : it
  }

  if (!subContent && (qData?.text || qData?.content)) {
    const fullText = String(qData?.text || qData?.content || '')
    const splitPattern = /(?:^|\n|\r|\s{2,}|\$\s*|\.\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/gi
    const parts = fullText.split(splitPattern)
    if (parts.length >= 5 && parts[sIdx + 1]) {
      subContent = parts[sIdx + 1].trim()
    }
  }

  if (!subContent) {
    subContent = `Mệnh đề ${sub})`
  }

  return subContent.replace(/^(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i, '') || subContent
}

/**
 * Làm sạch phần câu hỏi cho dạng đúng sai
 */
function cleanQuestionPrompt(rawText: string, type: string) {
  if (type === 'true_false') {
    const splitPattern = /(?:^|\n|\r|\s{2,}|\$\s*|\.\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
    const splitParts = rawText.split(splitPattern)
    if (splitParts.length >= 5 && splitParts[0].trim()) {
      return splitParts[0].trim()
    }
  }
  return rawText
}

export default function NewHistorySubmissionReviewPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'katex' | 'pdf'>('katex')

  // AI Explain State per question
  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null)
  const [aiExplains, setAiExplains] = useState<Record<string, string>>({})
  const [showAiInput, setShowAiInput] = useState<Record<string, boolean>>({})
  const [questionInputs, setQuestionInputs] = useState<Record<string, string>>({})
  const [questionImages, setQuestionImages] = useState<Record<string, string>>({})

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchSubmission = async () => {
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
        .eq('id', submissionId)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        alert('Không tìm thấy bài thi hoặc bạn không có quyền xem.')
        router.replace('/new-history-submissions')
        return
      }

      setSubmission(data)
      setLoading(false)
    }

    fetchSubmission()
  }, [submissionId, router])

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

  // Xử lý upload ảnh câu hỏi
  const handleImageUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Vui lòng chọn ảnh dung lượng dưới 10MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setQuestionImages((prev) => ({ ...prev, [key]: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  // Yêu cầu SenAI giải thích chi tiết câu hỏi (Model: gemini-3.5-flash-lite)
  const handleAskAiExplain = async (
    key: string,
    questionLabel: string,
    studentAns: any,
    correctAns: any,
    qText?: string
  ) => {
    const userPrompt = (questionInputs[key] || qText || '').trim()
    const userImg = questionImages[key] || ''

    if (!userPrompt && !userImg) {
      alert('Vui lòng nhập nội dung câu hỏi hoặc tải lên hình ảnh đề bài để SenAI phân tích.')
      return
    }

    setAiLoadingKey(key)
    try {
      let token: string | null = null
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        token = session?.access_token || null
      } catch (authErr) {
        console.warn('Lỗi lấy session:', authErr)
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const fullMessage = `Hãy giải thích chi tiết phương pháp giải cho ${questionLabel} trong bài thi "${submission.exams?.title || 'Đề thi'}".
Nội dung câu hỏi: "${userPrompt || '(Xem hình ảnh đính kèm)'}".
Đáp án đúng: "${typeof correctAns === 'object' ? JSON.stringify(correctAns) : correctAns}".
Lựa chọn của học sinh: "${typeof studentAns === 'object' ? JSON.stringify(studentAns) : (studentAns || 'Chưa làm')}".
Hãy giải thích từng bước rõ ràng, sử dụng công thức KaTeX LaTeX ($...$ hoặc $$...$$) và chỉ ra phương pháp giải tối ưu nhất.`

      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: fullMessage,
          image: userImg,
          model: 'gemini-3.5-flash-lite',
          deepThink: false,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setAiExplains((prev) => ({ ...prev, [key]: `⚠️ ${data.error || 'SenAI chưa thể phân tích câu hỏi này ngay bây giờ.'}` }))
      } else if (data.reply || data.text) {
        setAiExplains((prev) => ({ ...prev, [key]: data.reply || data.text }))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('senai-quota-updated', { detail: data }))
          try {
            localStorage.setItem('senai_quota_updated_at', Date.now().toString())
          } catch {}
        }
      } else {
        setAiExplains((prev) => ({ ...prev, [key]: 'SenAI chưa thể phân tích câu hỏi này ngay bây giờ.' }))
      }
    } catch (e: any) {
      setAiExplains((prev) => ({ ...prev, [key]: `Lỗi: ${e.message}` }))
    } finally {
      setAiLoadingKey(null)
    }
  }

  const activeSections = useMemo(() => {
    if (!submission?.exams?.exam_structure || !Array.isArray(submission.exams.exam_structure)) return []
    return submission.exams.exam_structure.filter((s: any) => s && (s.questionCount || 0) > 0)
  }, [submission])

  const computedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let running = 0
    activeSections.forEach((section: any) => {
      offsets[section.id] = running
      running += section.questionCount || 0
    })
    return offsets
  }, [activeSections])

  const pdfUrl = useMemo(() => {
    if (submission?.exams?.drive_file_id) {
      return `https://drive.google.com/file/d/${submission.exams.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`
    }
    return submission?.exams?.pdf_url || ''
  }, [submission])

  // Xác định đề có nội dung KaTeX chi tiết không
  const isKatexExam = useMemo(() => {
    if (!submission?.exams) return false
    if (submission.exams.format === 'katex') return true

    const hasQuestionsInStructure =
      Array.isArray(activeSections) &&
      activeSections.some(
        (s: any) =>
          (Array.isArray(s?.questions) && s.questions.length > 0) ||
          s?.format === 'katex' ||
          s?.is_katex === true ||
          s?.id === 'sec-katex-main'
      )
    if (hasQuestionsInStructure) return true

    const isValidDriveId =
      typeof submission.exams.drive_file_id === 'string' &&
      submission.exams.drive_file_id.trim().length > 10
    const isValidPdfUrl =
      typeof submission.exams.pdf_url === 'string' &&
      submission.exams.pdf_url.trim().length > 10

    return !isValidDriveId && !isValidPdfUrl
  }, [submission, activeSections])

  const hasBothPdfAndKatex = useMemo(() => {
    const hasPdf = Boolean(pdfUrl && pdfUrl.length > 10)
    const hasQuestions =
      Array.isArray(activeSections) &&
      activeSections.some((s: any) => Array.isArray(s?.questions) && s.questions.length > 0)
    return hasPdf && hasQuestions
  }, [pdfUrl, activeSections])

  // Tự động chọn chế độ xem mặc định phù hợp nhất
  useEffect(() => {
    if (isKatexExam) {
      setViewMode('katex')
    } else if (pdfUrl) {
      setViewMode('pdf')
    }
  }, [isKatexExam, pdfUrl])

  // Danh sách câu hỏi làm phẳng để duyệt và lập bảng điều hướng
  const flatReviewQuestions = useMemo(() => {
    const list: Array<{
      key: string
      sectionId: string
      sectionName: string
      qIdx: number
      globalNum: number
      qData: any
      type: string
      earnedPoint: number
      studentAns: any
      correctAns: any
      isCorrect: boolean
      isAnswered: boolean
    }> = []

    activeSections.forEach((section: any, sIdx: number) => {
      const qCount =
        parseInt(section.questionCount) ||
        (Array.isArray(section.questions) ? section.questions.length : 0) ||
        0
      const offset = computedOffsets[section.id] || 0

      for (let qIdx = 0; qIdx < qCount; qIdx++) {
        const key = `${section.id}-${qIdx}`
        const globalNum = offset + qIdx + 1
        const qData = Array.isArray(section.questions) ? section.questions[qIdx] : null

        let qType = qData?.type || section.type || 'single_choice'
        if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
          const range = section.mixedRanges.find(
            (r: any) => qIdx + 1 >= (Number(r?.start) || 0) && qIdx + 1 <= (Number(r?.end) || 999)
          )
          if (range?.type) qType = range.type
        }

        const studentAns = submission?.answers?.[key]
        const correctAns =
          submission?.answers?._effectiveCorrectAnswers?.[key] ??
          qData?.correctAnswer ??
          (section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)])
        const earnedPoint = Number(submission?.detailed_scores?.[key] || 0)
        const isCorrect = earnedPoint > 0
        const isAnswered =
          studentAns !== undefined &&
          studentAns !== null &&
          studentAns !== '' &&
          (typeof studentAns !== 'object' || Object.keys(studentAns).length > 0)

        list.push({
          key,
          sectionId: section.id || `sec-${sIdx}`,
          sectionName: section.name || section.title || `Phần ${sIdx + 1}`,
          qIdx,
          globalNum,
          qData,
          type: qType,
          earnedPoint,
          studentAns,
          correctAns,
          isCorrect,
          isAnswered,
        })
      }
    })

    return list
  }, [activeSections, computedOffsets, submission])

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = flatReviewQuestions.length
    const correct = flatReviewQuestions.filter((q) => q.isCorrect).length
    const answered = flatReviewQuestions.filter((q) => q.isAnswered).length
    const incorrect = answered - correct
    const unanswered = total - answered
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    return { total, correct, incorrect, unanswered, accuracy }
  }, [flatReviewQuestions])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        title="SenExam Chi Tiết Bài Làm"
        subtitle="Đang tải dữ liệu bài làm & hiển thị công thức KaTeX..."
      />
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} h-screen flex flex-col bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 font-sans overflow-hidden select-none`}
      style={themeVars}
    >
      {/* HEADER */}
      <header className="h-16 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 px-4 sm:px-6 flex items-center justify-between backdrop-blur-xl z-20">
        <div className="flex items-center gap-3 max-w-sm sm:max-w-md">
          <Link
            href="/new-history-submissions"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Về Lịch sử Bài nộp"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="truncate">
            <h2 className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-newrev-heading)' }}>
              {submission.exams?.title || 'Xem lại bài thi'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
                {submission.exams?.exam_type || 'Đề thi'} • Nộp ngày {new Date(submission.created_at).toLocaleDateString('vi-VN')}
              </span>
              {isKatexExam && (
                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  KaTeX Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chuyển đổi chế độ xem nếu đề hỗ trợ cả KaTeX và PDF */}
        <div className="flex items-center gap-3">
          {hasBothPdfAndKatex && (
            <div className="flex items-center rounded-xl border border-black/10 dark:border-white/10 p-0.5 bg-black/5 dark:bg-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('katex')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'katex'
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3 text-amber-500" /> Xem KaTeX
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'pdf'
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <FileText className="h-3 w-3 text-amber-500" /> Tệp PDF
              </button>
            </div>
          )}

          {/* Score Badge */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center font-black">
            <span className="text-[9px] uppercase tracking-wider block opacity-75 font-bold text-amber-800 dark:text-amber-300">
              Kết quả
            </span>
            <span className="text-sm sm:text-base text-amber-600 dark:text-amber-400 font-black">
              {submission.score}{' '}
              <span className="text-xs font-semibold opacity-75">
                {parseFloat(submission.score) <= 10 ? '/ 10' : 'đ'}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>

          {submission.exam_id && (
            <Link
              href={`/new-exams/${submission.exam_id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow transition hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Thi lại
            </Link>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* 1. CHẾ ĐỘ XEM ĐỀ KATEX CHI TIẾT (ĐẦY ĐỦ CÔNG THỨC TOÁN)  */}
      {/* ======================================================== */}
      {viewMode === 'katex' && (
        <div className="flex-1 flex overflow-hidden">
          {/* CỘT TRÁI / CHÍNH: DANH SÁCH CÂU HỎI VÀ ĐÁP ÁN KATEX */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
            {activeSections.map((section: any, sIdx: number) => {
              const secQuestions = flatReviewQuestions.filter((q) => q.sectionId === (section.id || `sec-${sIdx}`))

              return (
                <div key={section.id || sIdx} className="space-y-5">
                  <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-sm sm:text-base" style={{ fontFamily: 'var(--font-newrev-heading)' }}>
                        {section.name || section.title || `Phần ${sIdx + 1}`}
                      </h3>
                      {section.description && (
                        <p className="text-xs opacity-75 mt-0.5">{section.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xs border border-indigo-500/20">
                      {secQuestions.length} câu hỏi
                    </span>
                  </div>

                  <div className="space-y-6">
                    {secQuestions.map((item) => {
                      const { key, globalNum, type, earnedPoint, studentAns, correctAns, isCorrect, qData } = item
                      const promptRaw = qData?.text || qData?.content || `Câu hỏi số ${globalNum}`
                      const cleanPrompt = cleanQuestionPrompt(promptRaw, type)

                      return (
                        <div
                          key={key}
                          id={`q-${key}`}
                          className={`rounded-3xl border p-5 sm:p-7 shadow-sm bg-white/95 dark:bg-slate-900/95 space-y-5 transition scroll-mt-6 ${
                            isCorrect
                              ? 'border-emerald-500/30 ring-1 ring-emerald-500/20'
                              : 'border-rose-500/30 ring-1 ring-rose-500/20'
                          }`}
                        >
                          {/* Top Question Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black text-white shadow-xs ${
                                  isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              >
                                {globalNum}
                              </span>
                              <span
                                className="text-sm font-black text-slate-900 dark:text-white"
                                style={{ fontFamily: 'var(--font-newrev-heading)' }}
                              >
                                Câu hỏi {globalNum}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-slate-500">
                                {type === 'true_false'
                                  ? 'Đúng / Sai 4 ý'
                                  : type === 'multiple_choice'
                                  ? 'Nhiều đáp án'
                                  : type === 'short_answer'
                                  ? 'Điền số / kết quả ngắn'
                                  : type === 'essay'
                                  ? 'Tự luận'
                                  : 'Trắc nghiệm'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-black px-3 py-1 rounded-xl border flex items-center gap-1 ${
                                  isCorrect
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                }`}
                              >
                                {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                +{earnedPoint} đ
                              </span>
                            </div>
                          </div>

                          {/* 1. THÂN ĐỀ BÀI (KATEX) */}
                          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                            <SafeMathRenderer content={cleanPrompt} />
                          </div>

                          {/* 2. CÁC PHƯƠNG ÁN / MỆNH ĐỀ & ĐÁNH GIÁ ĐÁP ÁN */}
                          {/* DẠNG 1: TRẮC NGHIỆM 1 HOẶC NHIỀU ĐÁP ÁN */}
                          {(type === 'single_choice' || type === 'multiple_choice' || !type) && (
                            <div className="space-y-3 pt-2">
                              {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                                const rawOpts = qData?.options
                                const optContent = Array.isArray(rawOpts)
                                  ? rawOpts[optIdx]
                                  : rawOpts && typeof rawOpts === 'object'
                                  ? rawOpts[letter] || rawOpts[letter.toLowerCase()] || rawOpts[optIdx]
                                  : `Phương án ${letter}`

                                const isStudentChosen =
                                  type === 'multiple_choice'
                                    ? Array.isArray(studentAns) && studentAns.includes(letter)
                                    : studentAns === letter

                                const isOfficialCorrect =
                                  type === 'multiple_choice'
                                    ? Array.isArray(correctAns)
                                      ? correctAns.includes(letter)
                                      : String(correctAns || '')
                                          .split(/[,;]/)
                                          .map((s) => s.trim().toUpperCase())
                                          .includes(letter)
                                    : correctAns === letter

                                return (
                                  <div
                                    key={letter}
                                    className={`p-3.5 rounded-2xl border transition flex items-start gap-3.5 ${
                                      isStudentChosen && isOfficialCorrect
                                        ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 ring-2 ring-emerald-500/30'
                                        : isStudentChosen && !isOfficialCorrect
                                        ? 'border-rose-500 bg-rose-500/10 dark:bg-rose-500/20 ring-2 ring-rose-500/30'
                                        : isOfficialCorrect
                                        ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10 border-dashed'
                                        : 'border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] opacity-70'
                                    }`}
                                  >
                                    <span
                                      className={`h-7 w-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                        isStudentChosen && isOfficialCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : isStudentChosen && !isOfficialCorrect
                                          ? 'bg-rose-600 text-white'
                                          : isOfficialCorrect
                                          ? 'bg-emerald-600/80 text-white'
                                          : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      {isStudentChosen && isOfficialCorrect ? (
                                        <Check className="h-4 w-4" />
                                      ) : isStudentChosen && !isOfficialCorrect ? (
                                        <X className="h-4 w-4" />
                                      ) : (
                                        letter
                                      )}
                                    </span>

                                    <div className="flex-1 pt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      <SafeMathRenderer content={optContent || `Phương án ${letter}`} gfm={false} />
                                    </div>

                                    {/* Nhãn trạng thái phương án */}
                                    <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold">
                                      {isStudentChosen && isOfficialCorrect && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                                          Lựa chọn của bạn ✓
                                        </span>
                                      )}
                                      {isStudentChosen && !isOfficialCorrect && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                          Lựa chọn của bạn ✗
                                        </span>
                                      )}
                                      {!isStudentChosen && isOfficialCorrect && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                          Đáp án đúng chuẩn
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* DẠNG 2: ĐÚNG / SAI (4 Ý A, B, C, D) */}
                          {type === 'true_false' && (
                            <div className="space-y-3 pt-2">
                              {['a', 'b', 'c', 'd'].map((sub, sIdx) => {
                                const statementContent = resolveStatementContent(qData, sub, sIdx)
                                const sVal =
                                  typeof studentAns === 'object' && studentAns !== null
                                    ? studentAns[sub] || studentAns[sub.toUpperCase()] || studentAns[sIdx]
                                    : undefined
                                const cVal =
                                  typeof correctAns === 'object' && correctAns !== null
                                    ? correctAns[sub] || correctAns[sub.toUpperCase()] || correctAns[sIdx]
                                    : Array.isArray(correctAns)
                                    ? correctAns[sIdx]
                                    : undefined

                                const sNorm = sVal === 'Đ' || sVal === 'D' || sVal === 'T' || sVal === '1' ? 'Đúng' : sVal === 'S' || sVal === 'F' || sVal === '0' ? 'Sai' : null
                                const cNorm = cVal === 'Đ' || cVal === 'D' || cVal === 'T' || cVal === '1' ? 'Đúng' : cVal === 'S' || cVal === 'F' || cVal === '0' ? 'Sai' : 'Chưa có'
                                const isSubCorrect = sNorm !== null && sNorm === cNorm

                                return (
                                  <div
                                    key={sub}
                                    className={`p-3.5 rounded-2xl border space-y-2 ${
                                      isSubCorrect
                                        ? 'border-emerald-500/30 bg-emerald-500/5'
                                        : sNorm !== null
                                        ? 'border-rose-500/30 bg-rose-500/5'
                                        : 'border-black/10 dark:border-white/10 bg-black/[0.01]'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-2.5">
                                        <span className="h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 uppercase">
                                          {sub}
                                        </span>
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs font-semibold text-slate-800 dark:text-slate-200">
                                          <SafeMathRenderer content={statementContent} gfm={false} />
                                        </div>
                                      </div>

                                      {/* Kết quả lựa chọn của học sinh vs Đáp án */}
                                      <div className="flex items-center gap-2 shrink-0 text-xs">
                                        <span className="text-[11px] text-slate-500 font-medium">Bạn chọn:</span>
                                        <span
                                          className={`px-2.5 py-0.5 rounded-lg font-black text-xs ${
                                            isSubCorrect
                                              ? 'bg-emerald-600 text-white'
                                              : sNorm !== null
                                              ? 'bg-rose-600 text-white'
                                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                          }`}
                                        >
                                          {sNorm || 'Chưa làm'}
                                        </span>

                                        <span className="text-[11px] text-slate-500 font-medium ml-1">Đáp án:</span>
                                        <span className="px-2.5 py-0.5 rounded-lg font-black text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                          {cNorm}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* DẠNG 3: TRẢ LỜI NGẮN / ĐIỀN SỐ */}
                          {type === 'short_answer' && (
                            <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-bold">Câu trả lời của bạn:</span>
                                <strong className={`font-black font-mono text-sm ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {studentAns || '(Chưa điền)'}
                                </strong>
                              </div>
                              <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                                <span className="text-slate-500 font-bold">Đáp án chính xác:</span>
                                <strong className="font-black font-mono text-sm text-emerald-600 dark:text-emerald-400">
                                  {correctAns || 'Chưa có'}
                                </strong>
                              </div>
                            </div>
                          )}

                          {/* DẠNG 4: TỰ LUẬN */}
                          {type === 'essay' && (
                            <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-3 text-xs">
                              <div>
                                <span className="text-slate-500 font-bold block mb-1">Bài làm của thí sinh:</span>
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 whitespace-pre-wrap">
                                  {studentAns?.text || studentAns || '(Chưa làm bài tự luận)'}
                                </div>
                              </div>
                              {correctAns && (
                                <div>
                                  <span className="text-slate-500 font-bold block mb-1">Hướng dẫn chấm / Đáp án gợi ý:</span>
                                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                                    <SafeMathRenderer content={String(correctAns)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. LỜI GIẢI CHI TIẾT TỪ ĐỀ THI (OFFICIAL EXPLANATION) */}
                          {qData?.explanation && (
                            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 text-xs leading-relaxed space-y-2">
                              <span className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                                <Sparkles className="h-4 w-4 text-amber-500" /> Lời giải chi tiết từ đề thi:
                              </span>
                              <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-slate-800 dark:text-slate-200">
                                <SafeMathRenderer content={qData.explanation} />
                              </div>
                            </div>
                          )}

                          {/* 4. HỎI THÊM SENAI VỀ CÂU NÀY */}
                          <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-2.5">
                            {aiExplains[key] ? (
                              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-xs leading-relaxed space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                                    <BrainCircuit className="h-4 w-4 text-amber-500" /> Phân tích chuyên sâu từ SenAI:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowAiInput((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold hover:underline"
                                  >
                                    {showAiInput[key] ? 'Đóng ô hỏi' : 'Hỏi lại câu này'}
                                  </button>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {aiExplains[key]}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ) : null}

                            {(!aiExplains[key] || showAiInput[key]) && (
                              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Nhờ SenAI phân tích & giải thích thêm câu {globalNum}:
                                  </span>
                                </div>

                                <textarea
                                  rows={2}
                                  value={questionInputs[key] || ''}
                                  onChange={(e) => setQuestionInputs({ ...questionInputs, [key]: e.target.value })}
                                  placeholder={cleanPrompt.slice(0, 80) + '... (Gõ thắc mắc hoặc nhấn nút bên dưới để hỏi ngay)'}
                                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2.5 text-xs outline-none focus:border-indigo-500"
                                />

                                {questionImages[key] && (
                                  <div className="relative inline-block">
                                    <img
                                      src={questionImages[key]}
                                      alt="Đề bài"
                                      className="max-h-28 rounded-xl border border-black/10 dark:border-white/10 object-contain"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setQuestionImages({ ...questionImages, [key]: '' })}
                                      className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white shadow-md transition hover:scale-110"
                                      title="Xóa ảnh"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-black/5 transition">
                                    <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                                    <span>{questionImages[key] ? 'Đổi ảnh đính kèm' : 'Đính kèm ảnh'}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleImageUpload(key, e)}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    disabled={aiLoadingKey === key}
                                    onClick={() => handleAskAiExplain(key, `Câu hỏi ${globalNum}`, studentAns, correctAns, cleanPrompt)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-40"
                                  >
                                    {aiLoadingKey === key ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang giải thích...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-3.5 w-3.5" /> Hỏi SenAI giải thích
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* CỘT PHẢI: BẢNG TRUY CẬP NHANH CÂU HỎI & TỔNG QUAN ĐIỂM SỐ */}
          <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 border-l border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl flex flex-col overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* 1. THẺ THỐNG KÊ KẾT QUẢ */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Tổng quan kết quả
                </span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  Độ chính xác {stats.accuracy}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">Đúng</span>
                  <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {stats.correct}
                  </strong>
                </div>

                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-2.5">
                  <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">Sai</span>
                  <strong className="text-lg font-black text-rose-600 dark:text-rose-400">
                    {stats.incorrect}
                  </strong>
                </div>

                <div className="rounded-2xl bg-slate-500/10 border border-slate-500/20 p-2.5">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Chưa làm</span>
                  <strong className="text-lg font-black text-slate-700 dark:text-slate-300">
                    {stats.unanswered}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Tiến độ hoàn thành:</span>
                  <span>{stats.correct + stats.incorrect}/{stats.total} câu</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex">
                  <div
                    style={{ width: `${(stats.correct / (stats.total || 1)) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all"
                  />
                  <div
                    style={{ width: `${(stats.incorrect / (stats.total || 1)) * 100}%` }}
                    className="bg-rose-500 h-full transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 2. BẢNG TRUY CẬP CÂU HỎI (QUESTION PALETTE) */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <LayoutList className="h-3.5 w-3.5 text-indigo-500" /> Bảng câu hỏi
                </h4>
                <span className="text-[10px] text-slate-400 font-semibold">Nhấn để cuộn tới câu</span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-6 gap-2 p-1 overflow-y-auto max-h-[360px]">
                {flatReviewQuestions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`q-${item.key}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className={`h-9 rounded-xl text-xs font-black flex items-center justify-center transition hover:scale-105 active:scale-95 shadow-2xs ${
                      item.isCorrect
                        ? 'bg-emerald-600 text-white'
                        : item.isAnswered
                        ? 'bg-rose-600 text-white'
                        : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                    }`}
                  >
                    {item.globalNum}
                  </button>
                ))}
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-2">
              <Link
                href="/new-history-submissions"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-3 text-xs font-bold transition hover:bg-black/10"
              >
                Về Lịch Sử Bài Nộp
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CHẾ ĐỘ XEM ĐỀ PDF TRUYỀN THỐNG (KÈM PHIẾU ĐÁP ÁN)      */}
      {/* ======================================================== */}
      {viewMode === 'pdf' && (
        <div className="flex-1 flex overflow-hidden">
          {/* PDF VIEW */}
          <div className={`flex-1 flex flex-col bg-slate-900 border-r border-black/10 dark:border-white/10 transition-all ${pdfFullscreen ? 'w-full' : 'hidden md:flex'}`}>
            {pdfUrl ? (
              <div className="relative w-full h-full flex flex-col">
                <div className="h-9 bg-slate-950 px-4 flex items-center justify-between text-xs text-slate-400 border-b border-white/10">
                  <span className="font-bold flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-400" /> Đề thi đính kèm (PDF)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPdfFullscreen(!pdfFullscreen)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {pdfFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    {pdfFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                  </button>
                </div>
                <iframe src={pdfUrl} className="flex-1 w-full h-full border-none" title="Exam PDF" />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400">
                <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-bold text-sm">Đề thi không có tệp PDF đính kèm</p>
              </div>
            )}
          </div>

          {/* ANSWERS REVIEW COLUMN */}
          <div className={`w-full md:w-[520px] lg:w-[600px] xl:w-[680px] flex flex-col bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-y-auto p-4 sm:p-6 space-y-6 ${pdfFullscreen ? 'hidden' : 'flex'}`}>
            {activeSections.map((section: any, sIdx: number) => {
              const offset = computedOffsets[section.id] || 0

              return (
                <div key={section.id || sIdx} className="space-y-4">
                  <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-indigo-900 dark:text-indigo-200">
                    <h3 className="font-black text-sm" style={{ fontFamily: 'var(--font-newrev-heading)' }}>
                      {section.name || section.title || `Phần ${sIdx + 1}`}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount || 0 }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const globalNum = offset + qIdx + 1
                      const studentAns = submission.answers?.[key]
                      const correctAns =
                        submission.answers?._effectiveCorrectAnswers?.[key] ??
                        section.questions?.[qIdx]?.correctAnswer ??
                        (section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)])
                      const earnedPoint = submission.detailed_scores?.[key] || 0

                      let currentType = section.type || 'single_choice'
                      if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
                        const range = section.mixedRanges.find((r: any) => qIdx + 1 >= r.start && qIdx + 1 <= r.end)
                        if (range) currentType = range.type || 'single_choice'
                        else currentType = 'single_choice'
                      }

                      const isCorrect = earnedPoint > 0

                      return (
                        <div
                          key={key}
                          className={`rounded-2xl border p-4 shadow-sm bg-white/90 dark:bg-slate-800/90 space-y-3 ${
                            isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'
                          }`}
                        >
                          {/* Question Title & Score */}
                          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white ${
                                  isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              >
                                {globalNum}
                              </span>
                              <span className="text-xs font-bold">Câu hỏi {globalNum}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                                  isCorrect
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                }`}
                              >
                                +{earnedPoint} đ
                              </span>
                            </div>
                          </div>

                          {/* Answer comparison */}
                          <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[#6B7280] dark:text-slate-400 font-semibold">Lựa chọn của bạn:</span>
                              <strong className={`font-black ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {typeof studentAns === 'object' ? JSON.stringify(studentAns) : (studentAns || 'Chưa làm')}
                              </strong>
                            </div>

                            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-1.5">
                              <span className="text-[#6B7280] dark:text-slate-400 font-semibold">Đáp án chính xác:</span>
                              <strong className="font-black text-emerald-600 dark:text-emerald-400">
                                {typeof correctAns === 'object' ? JSON.stringify(correctAns) : (correctAns || 'Chưa có')}
                              </strong>
                            </div>
                          </div>

                          {/* AI Explanation Box */}
                          <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-2.5">
                            {aiExplains[key] ? (
                              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-xs leading-relaxed space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-xs">
                                    <Sparkles className="h-4 w-4 text-amber-500" /> Giải thích chi tiết từ SenAI:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowAiInput((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold hover:underline"
                                  >
                                    {showAiInput[key] ? 'Đóng ô hỏi' : 'Hỏi lại câu này'}
                                  </button>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {aiExplains[key]}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ) : null}

                            {(!aiExplains[key] || showAiInput[key]) && (
                              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Nhờ SenAI giải câu {globalNum}:
                                  </span>
                                </div>

                                <textarea
                                  rows={2}
                                  value={questionInputs[key] || ''}
                                  onChange={(e) => setQuestionInputs({ ...questionInputs, [key]: e.target.value })}
                                  placeholder="Dán hoặc gõ nội dung đề bài câu này để SenAI giải thích..."
                                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2.5 text-xs outline-none focus:border-indigo-500"
                                />

                                {questionImages[key] && (
                                  <div className="relative inline-block">
                                    <img
                                      src={questionImages[key]}
                                      alt="Đề bài"
                                      className="max-h-28 rounded-xl border border-black/10 dark:border-white/10 object-contain"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setQuestionImages({ ...questionImages, [key]: '' })}
                                      className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white shadow-md transition hover:scale-110"
                                      title="Xóa ảnh"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-black/5 transition">
                                    <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                                    <span>{questionImages[key] ? 'Đổi ảnh đề bài' : 'Tải ảnh chụp đề bài'}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleImageUpload(key, e)}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    disabled={aiLoadingKey === key || (!questionInputs[key]?.trim() && !questionImages[key])}
                                    onClick={() => handleAskAiExplain(key, `Câu hỏi ${globalNum}`, studentAns, correctAns)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-40"
                                  >
                                    {aiLoadingKey === key ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> SenAI đang giải thích...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-3.5 w-3.5" /> Hỏi Lời Giải Chi Tiết
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
