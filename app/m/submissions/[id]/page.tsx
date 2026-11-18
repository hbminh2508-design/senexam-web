'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import ModernLoading from '@/app/components/ModernLoading'
import { normalizeLatexQuestion, preprocessLatexContent } from '@/lib/latexExamParser'
import TikzRenderer from '@/app/components/TikzRenderer'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  RotateCcw,
  Clock,
  Check,
  X,
  Filter,
  ListOrdered,
  Eye,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { APP_VERSION as MOBILE_VERSION } from '@/lib/version'

interface ReviewQuestion {
  id: string
  number: number
  question: string
  type: string
  options: string[]
  correct_answer: any
  student_answer: any
  is_correct: boolean
  explanation?: string
}

function SafeMathRenderer({ content, className }: { content: string; className?: string }) {
  const rawStr = typeof content === 'string' ? content : String(content ?? '')
  const safeContent = preprocessLatexContent(rawStr)

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#ef4444', strict: false }]]}
        components={{
          code: ({ className: codeClass, children, ...props }: any) => {
            const isTikz = /language-tikz/i.test(codeClass || '')
            if (isTikz) {
              return <TikzRenderer code={String(children).trim()} />
            }
            return (
              <code className={codeClass} {...props}>
                {children}
              </code>
            )
          },
          img: ({ node, ...props }) => (
            <span className="block my-2 text-center">
              <img
                {...props}
                alt={props.alt || 'Hình minh họa câu hỏi'}
                className="max-h-[250px] max-w-full rounded-xl border border-slate-200 dark:border-white/10 shadow-sm mx-auto object-contain cursor-zoom-in bg-white"
                onClick={() => {
                  if (props.src) window.open(props.src, '_blank')
                }}
              />
            </span>
          ),
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
}

export default function MobileSubmissionReviewPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState<any>(null)
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all')
  const [showDrawer, setShowDrawer] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    async function fetchSubmissionData() {
      if (!submissionId) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace(`/m/login?returnUrl=/m/submissions/${submissionId}`)
          return
        }

        const { data, error } = await supabase
          .from('submissions')
          .select('*, exams(*)')
          .eq('id', submissionId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (error || !data) {
          alert('Không tìm thấy bài làm hoặc bạn không có quyền xem.')
          router.replace('/m/sen-ground?tab=history')
          return
        }

        setSubmission(data)

        // Phân tích câu hỏi và đối chiếu bài làm
        const studentAnswers = data.answers || data.student_answers || {}
        const exam = data.exams || {}
        let struct = exam.exam_structure

        if (typeof struct === 'string') {
          try {
            struct = JSON.parse(struct)
          } catch {
            struct = []
          }
        }
        if (!Array.isArray(struct) && struct && typeof struct === 'object' && Array.isArray(struct.sections)) {
          struct = struct.sections
        }

        const parsedList: ReviewQuestion[] = []
        let qNum = 1

        if (Array.isArray(struct) && struct.length > 0) {
          struct.forEach((sec: any) => {
            if (sec && Array.isArray(sec.questions)) {
              sec.questions.forEach((rawQ: any) => {
                const q = normalizeLatexQuestion(rawQ)
                const qText = q?.text || q?.question || `Câu hỏi số ${qNum}`
                const qKey = `q_${qNum}`
                const sAns = studentAnswers[qKey] !== undefined ? studentAnswers[qKey] : studentAnswers[String(qNum)]
                const cAns = q?.correctAnswer || q?.correct_answer || sec.correctAnswers?.[qNum - 1] || 'A'

                const isCorrect = String(sAns || '').trim().toUpperCase() === String(cAns || '').trim().toUpperCase()

                parsedList.push({
                  id: q?.id || qKey,
                  number: qNum++,
                  question: qText,
                  type: q?.type || sec.type || 'single_choice',
                  options: Array.isArray(q?.options) && q.options.length > 0 ? q.options : ['A', 'B', 'C', 'D'],
                  correct_answer: cAns,
                  student_answer: sAns,
                  is_correct: isCorrect,
                  explanation: q?.explanation || q?.solution || '',
                })
              })
            }
          })
        }

        // Fallback nếu không có structure
        if (parsedList.length === 0) {
          const totalQ = data.total_questions || 40
          for (let i = 1; i <= totalQ; i++) {
            const qKey = `q_${i}`
            const sAns = studentAnswers[qKey]
            parsedList.push({
              id: qKey,
              number: i,
              question: `Câu hỏi số ${i}`,
              type: 'single_choice',
              options: ['A', 'B', 'C', 'D'],
              correct_answer: 'A',
              student_answer: sAns,
              is_correct: sAns === 'A',
            })
          }
        }

        setQuestions(parsedList)
      } catch (err) {
        console.error('Lỗi nạp bài nộp:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissionData()
  }, [submissionId, router])

  const filteredQuestions = useMemo(() => {
    if (filterMode === 'wrong') return questions.filter((q) => !q.is_correct)
    if (filterMode === 'correct') return questions.filter((q) => q.is_correct)
    return questions
  }, [questions, filterMode])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <ModernLoading title="Xem lại bài thi" subtitle="Đang nạp chi tiết câu trả lời & lời giải..." />
      </div>
    )
  }

  const score = submission?.score || 0
  const isGood = score >= 8.0
  const isPass = score >= 5.0
  const correctCount = submission?.correct_count || questions.filter((q) => q.is_correct).length
  const totalCount = questions.length || submission?.total_questions || 1

  return (
    <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900 pb-16 space-y-4">
      {/* 1. TOPBAR QUAY LẠI */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between shadow-xs">
        <Link
          href="/m/sen-ground?tab=history"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Lịch sử
        </Link>
        <span className="text-xs font-black uppercase text-sky-600 dark:text-sky-400">
          Xem Lại Bài Thi
        </span>
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
        >
          <ListOrdered className="h-3.5 w-3.5" /> Bảng câu
        </button>
      </header>

      <div className="px-4 space-y-4">
        {/* 2. CARD TỔNG KẾT BÀI THI */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400">
                {submission?.exams?.exam_type || 'Khảo Thí'}
              </span>
              <h1 className="text-sm font-black text-slate-900 dark:text-white mt-1 line-clamp-2">
                {submission?.exams?.title || 'Đề thi đã hoàn thành'}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Nộp lúc: {new Date(submission?.created_at).toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-2xl font-black ${isGood ? 'text-emerald-500' : isPass ? 'text-amber-500' : 'text-rose-500'}`}>
                {score} <span className="text-xs font-bold text-slate-400">/ 10</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Đúng {correctCount}/{totalCount} câu
              </span>
            </div>
          </div>

          {/* Nút lọc câu hỏi */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`py-1.5 rounded-xl text-[11px] font-bold text-center transition ${
                filterMode === 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400'
              }`}
            >
              Tất cả ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('wrong')}
              className={`py-1.5 rounded-xl text-[11px] font-bold text-center transition ${
                filterMode === 'wrong'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              Câu sai ({questions.filter((q) => !q.is_correct).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('correct')}
              className={`py-1.5 rounded-xl text-[11px] font-bold text-center transition ${
                filterMode === 'correct'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              Câu đúng ({questions.filter((q) => q.is_correct).length})
            </button>
          </div>
        </div>

        {/* 3. DANH SÁCH CHI TIẾT CÂU HỎI */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-black/5 dark:border-white/5">
              Không có câu hỏi nào theo bộ lọc này.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              return (
                <div
                  key={q.id}
                  id={`review-q-${q.number}`}
                  className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-3"
                >
                  {/* TIÊU ĐỀ CÂU HỎI */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                        q.is_correct
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {q.is_correct ? '✓ Đúng' : '✗ Sai'} • Câu {q.number}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Bạn chọn: <strong>{q.student_answer || '(Chưa làm)'}</strong>
                    </span>
                  </div>

                  {/* NỘI DUNG CÂU HỎI */}
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                    <SafeMathRenderer content={q.question} />
                  </div>

                  {/* CÁC PHƯƠNG ÁN */}
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx)
                      const isStudentSelected = q.student_answer === letter
                      const isAnswerCorrect = q.correct_answer === letter

                      let itemStyle = 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                      if (isAnswerCorrect) {
                        itemStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold'
                      } else if (isStudentSelected && !q.is_correct) {
                        itemStyle = 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200 font-bold'
                      }

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition ${itemStyle}`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-black shrink-0">
                              {letter}
                            </span>
                            <div className="flex-1">
                              <SafeMathRenderer content={opt} />
                            </div>
                          </div>
                          {isAnswerCorrect && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                          {isStudentSelected && !q.is_correct && <X className="h-4 w-4 text-rose-600 shrink-0" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* LỜI GIẢI CHI TIẾT */}
                  {q.explanation && (
                    <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-900 dark:text-sky-100 space-y-1">
                      <span className="font-black text-[10px] uppercase text-sky-600 dark:text-sky-400 block">
                        💡 Lời giải chi tiết:
                      </span>
                      <SafeMathRenderer content={q.explanation} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 4. DRAWER BẢNG SỐ CÂU HỎI */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-4/5 max-w-xs h-full bg-white dark:bg-slate-900 p-4 space-y-4 shadow-2xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ListOrdered className="h-4 w-4 text-sky-600" /> Bảng câu hỏi ({questions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="p-1 rounded text-slate-400 hover:text-black dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5 max-h-[70vh] overflow-y-auto p-1">
                {questions.map((q) => {
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setShowDrawer(false)
                        const el = document.getElementById(`review-q-${q.number}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`h-9 rounded-xl text-xs font-bold flex items-center justify-center border transition ${
                        q.is_correct
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {q.number}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center font-mono">
              SenExam Review v{MOBILE_VERSION}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
