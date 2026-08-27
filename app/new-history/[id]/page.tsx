'use client'

import { useEffect, useState, useMemo } from 'react'
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
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newrev-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newrev-body' })

export default function NewHistorySubmissionReviewPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)

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
        router.replace('/new-sign')
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
        router.replace('/new-history')
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
  const handleAskAiExplain = async (key: string, questionLabel: string, studentAns: any, correctAns: any) => {
    const userPrompt = (questionInputs[key] || '').trim()
    const userImg = questionImages[key] || ''

    if (!userPrompt && !userImg) {
      alert('Vui lòng nhập nội dung câu hỏi hoặc tải lên hình ảnh đề bài để SenAI phân tích.')
      return
    }

    setAiLoadingKey(key)
    try {
      const fullMessage = `Hãy giải thích chi tiết phương pháp giải cho ${questionLabel} trong bài thi "${submission.exams?.title || 'Đề thi'}".
Nội dung câu hỏi: "${userPrompt || '(Xem hình ảnh đính kèm)'}".
Đáp án đúng: "${typeof correctAns === 'object' ? JSON.stringify(correctAns) : correctAns}".
Lựa chọn của học sinh: "${typeof studentAns === 'object' ? JSON.stringify(studentAns) : (studentAns || 'Chưa làm')}".
Hãy giải thích từng bước rõ ràng, sử dụng công thức KaTeX LaTeX ($...$ hoặc $$...$$) và chỉ ra phương pháp giải tối ưu nhất.`

      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullMessage,
          image: userImg,
          model: 'gemini-3.5-flash-lite',
          deepThink: false,
        }),
      })

      const data = await res.json()
      if (data.reply || data.text) {
        setAiExplains((prev) => ({ ...prev, [key]: data.reply || data.text }))
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

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải chi tiết bài làm & đáp án...</span>
        </div>
      </div>
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
            href="/new-history"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Về lịch sử bài thi"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="truncate">
            <h2 className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-newrev-heading)' }}>
              {submission.exams?.title || 'Xem lại bài thi'}
            </h2>
            <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
              {submission.exams?.exam_type} • Nộp ngày {new Date(submission.created_at).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Score Badge */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center font-black">
            <span className="text-[9px] uppercase tracking-wider block opacity-75 font-bold text-amber-800 dark:text-amber-300">Kết quả</span>
            <span className="text-sm sm:text-base text-amber-600 dark:text-amber-400 font-black">
              {submission.score} <span className="text-xs font-semibold opacity-75">{parseFloat(submission.score) <= 10 ? '/ 10' : 'đ'}</span>
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

      {/* BODY: SPLIT VIEW (PDF LEFT - DETAILED ANSWERS RIGHT) */}
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
                    const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
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
                            <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white ${
                              isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}>
                              {globalNum}
                            </span>
                            <span className="text-xs font-bold">Câu hỏi {globalNum}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                              isCorrect ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
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
                                  <Sparkles className="h-4 w-4 text-amber-500" /> Giải thích chi tiết từ SenAI (Gemini 3.5 Flash Lite):
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
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Nhờ SenAI (Gemini 3.5 Flash Lite) giải câu {globalNum}:
                                </span>
                              </div>

                              <textarea
                                rows={2}
                                value={questionInputs[key] || ''}
                                onChange={(e) => setQuestionInputs({ ...questionInputs, [key]: e.target.value })}
                                placeholder="Dán hoặc gõ nội dung đề bài câu này để SenAI giải thích..."
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2.5 text-xs outline-none focus:border-indigo-500"
                              />

                              {/* Image upload / Preview */}
                              {questionImages[key] ? (
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
                              ) : null}

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
                                      <Send className="h-3.5 w-3.5" /> Hỏi Lời Giải (Flash Lite)
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
    </main>
  )
}
