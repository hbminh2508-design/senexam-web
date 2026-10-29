'use client'

import React, { useState, useEffect, useMemo, useRef, Component } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { preprocessLatexContent } from '@/lib/latexExamParser'
import TikzRenderer from '@/app/components/TikzRenderer'
import {
  Clock,
  Flag,
  User,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Send,
  AlertTriangle,
  ExternalLink,
  Zap,
  ShieldCheck,
  BookOpen,
  Wifi,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

// Error boundary cho KaTeX
interface ErrorBoundaryProps {
  fallback?: React.ReactNode
  children: React.ReactNode
  resetKey?: any
}

interface ErrorBoundaryState {
  hasError: boolean
}

class MarkdownErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: any) {
    console.warn('LaTeX Markdown render error in UniversityExamRoom:', error)
  }
  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <span className="text-red-600 text-xs font-mono">[Lỗi công thức KaTeX]</span>
        )
      )
    }
    return this.props.children
  }
}

export const UetSafeMath = React.memo(
  ({ content, className }: { content: string; className?: string }) => {
    const rawStr = typeof content === 'string' ? content : String(content ?? '')
    const safeContent = preprocessLatexContent(rawStr)

    return (
      <MarkdownErrorBoundary resetKey={safeContent} fallback={<span className="text-xs font-mono">{safeContent}</span>}>
        <div className={className}>
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[
              [
                rehypeKatex,
                {
                  throwOnError: false,
                  errorColor: '#dc3545',
                  strict: false,
                },
              ],
            ]}
            components={{
              code: ({ className: codeClass, children, ...props }: any) => {
                const isTikz = /language-tikz/i.test(codeClass || '')
                if (isTikz) {
                  return <TikzRenderer code={String(children).trim()} />
                }
                return (
                  <code className={`${codeClass || ''} font-mono text-[12px] bg-slate-100 px-1 py-0.5 border border-slate-300 rounded-none`} {...props}>
                    {children}
                  </code>
                )
              },
              img: ({ node, ...props }: any) => (
                <span className="block my-2 text-center">
                  <img
                    {...props}
                    alt={props.alt || 'Hình vẽ minh họa'}
                    className="max-h-[320px] max-w-full border border-slate-300 mx-auto object-contain bg-white cursor-zoom-in rounded-none"
                    onClick={() => {
                      if (props.src) window.open(props.src, '_blank')
                    }}
                  />
                  {props.alt && props.alt !== 'Hình vẽ minh họa' && (
                    <span className="block text-[11px] text-slate-500 italic mt-0.5 font-sans">
                      {props.alt}
                    </span>
                  )}
                </span>
              ),
            }}
          >
            {safeContent}
          </ReactMarkdown>
        </div>
      </MarkdownErrorBoundary>
    )
  }
)
UetSafeMath.displayName = 'UetSafeMath'

export interface UniversityExamRoomProps {
  exam: any
  studentInfo: {
    id?: string
    name: string
    email: string
    avatar?: string | null
    studentId?: string
    school?: string
    courseName?: string
  }
  onExit?: () => void
  initialReviewData?: any
}

// Format giây thành mm:ss hoặc hh:mm:ss
function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

export default function UniversityExamRoom({
  exam,
  studentInfo,
  onExit,
  initialReviewData,
}: UniversityExamRoomProps) {
  const router = useRouter()

  // Giai đoạn: 'waiting' (chọn chế độ & quy chế), 'exam' (làm bài), 'summary' (bảng tóm tắt), 'review' (xem lại)
  const [viewState, setViewState] = useState<'waiting' | 'exam' | 'summary' | 'review'>(
    initialReviewData ? 'review' : 'waiting'
  )

  // Chế độ thi: 'exam' (Thi thật - có thời gian) | 'practice' (Luyện tập - không giới hạn thời gian, xem lời giải tức thì)
  const [examMode, setExamMode] = useState<'exam' | 'practice'>('exam')

  // Trạng thái kiểm tra đáp án tức thì trong Chế độ Luyện tập: { [qNum]: boolean }
  const [revealedInPractice, setRevealedInPractice] = useState<Record<number, boolean>>({})

  // Danh sách cờ đỏ (Flag question)
  const [flags, setFlags] = useState<Record<number, boolean>>({})

  // Đáp án của sinh viên { [questionNumber]: answerValue }
  const [answers, setAnswers] = useState<Record<number, any>>({})

  // Thời gian bắt đầu và kết thúc
  const [startTime, setStartTime] = useState<Date>(new Date())
  const [finishTime, setFinishTime] = useState<Date | null>(null)

  // Thời gian làm bài còn lại (giây) - Chỉ áp dụng trong Chế độ Thi thật
  const examDurationMinutes = Number(exam?.duration) > 0 ? Number(exam.duration) : 60
  const [timeLeft, setTimeLeft] = useState<number>(examDurationMinutes * 60)

  // Modal xác nhận nộp bài
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Trạng thái đồng bộ Supabase Online
  const [isOnlineSynced, setIsOnlineSynced] = useState(true)

  // Kết quả sau khi nộp
  const [reviewResult, setReviewResult] = useState<any>(initialReviewData || null)

  // Đóng gói danh sách câu hỏi chuẩn hóa
  const questions = useMemo(() => {
    let list: any[] = []

    // 1. Kiểm tra cấu trúc exam_structure
    if (exam?.exam_structure) {
      let struct = exam.exam_structure
      if (typeof struct === 'string') {
        try {
          struct = JSON.parse(struct)
        } catch {}
      }
      if (Array.isArray(struct)) {
        struct.forEach((sec: any) => {
          if (Array.isArray(sec?.questions)) {
            list.push(...sec.questions)
          }
        })
      } else if (struct && typeof struct === 'object' && Array.isArray(struct.sections)) {
        struct.sections.forEach((sec: any) => {
          if (Array.isArray(sec?.questions)) {
            list.push(...sec.questions)
          }
        })
      }
    }

    // 2. Kiểm tra mảng questions trực tiếp
    if (list.length === 0 && Array.isArray(exam?.questions)) {
      list = [...exam.questions]
    }

    // 3. Chuẩn hóa câu hỏi
    const normalized = list.map((q: any, idx: number) => {
      const qNum = typeof q.number === 'number' ? q.number : idx + 1
      const qText = q.text || q.content || q.prompt || q.question || `Câu hỏi số ${qNum}`
      const qType = q.type || (Array.isArray(q.options) && q.options.length > 0 ? 'single_choice' : 'short_answer')
      const qOptions = Array.isArray(q.options) ? q.options : []
      const qCorrect = q.correctAnswer || q.answer || 'A'
      const qExplanation = q.explanation || q.solution || ''
      const qPoints = typeof q.points === 'number' ? q.points : 1.0

      return {
        id: q.id || `q_${qNum}`,
        number: qNum,
        text: qText,
        type: qType,
        options: qOptions,
        correctAnswer: qCorrect,
        explanation: qExplanation,
        points: qPoints,
        subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions : undefined,
      }
    })

    // Sắp xếp theo số thứ tự
    normalized.sort((a, b) => a.number - b.number)

    return normalized
  }, [exam])

  // Phục hồi bản nháp từ LocalStorage khi khởi tạo
  useEffect(() => {
    if (exam?.id && studentInfo?.id && !initialReviewData) {
      const draftKey = `uet_draft_${exam.id}_${studentInfo.id}`
      try {
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.answers) setAnswers(parsed.answers)
          if (parsed.flags) setFlags(parsed.flags)
          if (parsed.examMode) setExamMode(parsed.examMode)
          if (parsed.revealedInPractice) setRevealedInPractice(parsed.revealedInPractice)
        }
      } catch {}
    }
  }, [exam?.id, studentInfo?.id, initialReviewData])

  // Tự động lưu bản nháp sau mỗi thay đổi
  useEffect(() => {
    if (exam?.id && studentInfo?.id && viewState === 'exam') {
      const draftKey = `uet_draft_${exam.id}_${studentInfo.id}`
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            answers,
            flags,
            examMode,
            revealedInPractice,
            savedAt: Date.now(),
          })
        )
      } catch {}
    }
  }, [answers, flags, examMode, revealedInPractice, exam?.id, studentInfo?.id, viewState])

  // Đếm ngược thời gian làm bài (CHỈ KHI Ở CHẾ ĐỘ THI THẬT)
  useEffect(() => {
    if (viewState !== 'exam' || examMode !== 'exam' || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [viewState, examMode, timeLeft])

  // Tự động nộp bài khi hết giờ (Chế độ thi thật)
  const handleAutoSubmit = () => {
    handleSubmitAllAndFinish()
  }

  // Bắt đầu làm bài thi (Chuyển từ Waiting sang Exam)
  const handleStartAttempt = async (mode: 'exam' | 'practice') => {
    setExamMode(mode)
    setStartTime(new Date())
    setTimeLeft(examDurationMinutes * 60)
    setViewState('exam')
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // ĐỒNG BỘ SUPABASE: Báo cáo trạng thái phiên làm bài online
    if (studentInfo?.id && exam?.id) {
      try {
        await supabase
          .from('submissions')
          .insert({
            exam_id: exam.id,
            user_id: studentInfo.id,
            score: 0,
            earned_points: 0,
            total_points: questions.length,
            correct_count: 0,
            total_questions: questions.length,
            time_spent: 0,
            details: {
              status: 'in_progress',
              mode: mode,
              started_at: new Date().toISOString(),
              client: 'portal_uet',
            },
          })
        setIsOnlineSynced(true)
      } catch (e) {
        console.warn('Sync online attempt status:', e)
      }
    }
  }

  // Bật / tắt đặt cờ (Flag) cho câu hỏi
  const toggleFlag = (qNum: number) => {
    setFlags((prev) => ({
      ...prev,
      [qNum]: !prev[qNum],
    }))
  }

  // Cuộn tới câu hỏi cụ thể
  const scrollToQuestion = (qNum: number) => {
    if (viewState !== 'exam' && viewState !== 'review') {
      setViewState('exam')
    }
    setTimeout(() => {
      const el = document.getElementById(`uet-question-block-${qNum}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  // Cập nhật đáp án
  const handleSelectOption = (qNum: number, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qNum]: value,
    }))
  }

  // Xóa lựa chọn của tôi (Clear my choice)
  const handleClearChoice = (qNum: number) => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[qNum]
      return next
    })
    if (examMode === 'practice') {
      setRevealedInPractice((prev) => ({ ...prev, [qNum]: false }))
    }
  }

  // Kiểm tra đáp án ngay (Chế độ Luyện tập)
  const handleCheckPracticeQuestion = (qNum: number) => {
    setRevealedInPractice((prev) => ({
      ...prev,
      [qNum]: true,
    }))
  }

  // Xử lý nộp bài và chấm điểm Portal UET
  const handleSubmitAllAndFinish = async () => {
    setIsSubmitting(true)
    const end = new Date()
    setFinishTime(end)

    try {
      let earnedPoints = 0
      let maxPoints = 0
      let correctCount = 0

      const questionResults = questions.map((q) => {
        const userAns = answers[q.number]
        const pts = q.points || 1.0
        maxPoints += pts

        let isCorrect = false
        let isPartial = false

        if (q.type === 'short_answer') {
          const strAns = String(userAns || '').trim().toLowerCase()
          const strCorrect = String(q.correctAnswer || '').trim().toLowerCase()
          if (strAns && strAns === strCorrect) {
            isCorrect = true
            earnedPoints += pts
            correctCount++
          }
        } else if (q.type === 'true_false' && Array.isArray(q.subQuestions)) {
          let trueCount = 0
          q.subQuestions.forEach((sub: any, sIdx: number) => {
            const subVal = userAns ? userAns[sIdx] : undefined
            if (subVal !== undefined && subVal === sub.isCorrect) {
              trueCount++
            }
          })
          if (trueCount === q.subQuestions.length) {
            isCorrect = true
            earnedPoints += pts
            correctCount++
          } else if (trueCount > 0) {
            isPartial = true
            const fraction = pts * (trueCount / q.subQuestions.length)
            earnedPoints += fraction
          }
        } else {
          // Trắc nghiệm ABCD
          const strAns = String(userAns || '').trim().toUpperCase()
          const strCorrect = String(q.correctAnswer || 'A').trim().toUpperCase()
          if (strAns && strAns === strCorrect) {
            isCorrect = true
            earnedPoints += pts
            correctCount++
          }
        }

        return {
          questionNumber: q.number,
          userAnswer: userAns,
          correctAnswer: q.correctAnswer,
          isCorrect,
          isPartial,
          pointsEarned: isCorrect ? pts : 0,
          maxPoints: pts,
          explanation: q.explanation,
        }
      })

      // Điểm số theo thang 10 (chuẩn đại học)
      const gradeOn10 = maxPoints > 0 ? (earnedPoints / maxPoints) * 10 : 0
      const durationSeconds = Math.round((end.getTime() - startTime.getTime()) / 1000)

      const resultPayload = {
        examId: exam.id,
        examTitle: exam.title,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        startTime: startTime.toISOString(),
        finishTime: end.toISOString(),
        durationSeconds,
        earnedPoints: Math.round(earnedPoints * 100) / 100,
        maxPoints: Math.round(maxPoints * 100) / 100,
        gradeOn10: Math.round(gradeOn10 * 100) / 100,
        percentage: maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0,
        correctCount,
        totalQuestions: questions.length,
        examMode: examMode,
        isOnline: true,
        questionResults,
      }

      // ĐỒNG BỘ SUPABASE: Lưu kết quả chính thức vào bảng submissions
      if (studentInfo.id) {
        try {
          await supabase.from('submissions').insert({
            exam_id: exam.id,
            user_id: studentInfo.id,
            answers: answers,
            score: Math.round(gradeOn10 * 100) / 100,
            earned_points: earnedPoints,
            total_points: maxPoints,
            correct_count: correctCount,
            total_questions: questions.length,
            time_spent: durationSeconds,
            details: resultPayload,
          })

          // Xóa draft
          const draftKey = `uet_draft_${exam.id}_${studentInfo.id}`
          localStorage.removeItem(draftKey)
          setIsOnlineSynced(true)
        } catch (err) {
          console.error('Lỗi khi lưu submission Portal UET vào Supabase:', err)
        }
      }

      setReviewResult(resultPayload)
      setShowConfirmModal(false)
      setViewState('review')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Lỗi nộp bài:', err)
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Định dạng ngày giờ chuẩn Portal
  const formatDateString = (d: Date) => {
    return d.toLocaleString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Hiển thị phần lựa chọn phương án cho câu hỏi
  const renderQuestionInput = (q: any, isReview = false) => {
    const userVal = answers[q.number]
    const isPracticeRevealed = examMode === 'practice' && revealedInPractice[q.number]
    const effectiveReview = isReview || isPracticeRevealed
    const qRes = reviewResult?.questionResults?.find((r: any) => r.questionNumber === q.number)

    // Dạng 1: Trả lời ngắn (Short answer)
    if (q.type === 'short_answer') {
      const isShortCorrect =
        effectiveReview &&
        String(userVal || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()

      return (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-slate-800">Câu trả lời:</span>
            {effectiveReview ? (
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 text-[13px] font-mono border rounded-none ${
                    isShortCorrect
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-bold'
                      : 'bg-rose-50 text-rose-800 border-rose-400 font-bold'
                  }`}
                >
                  {userVal ? String(userVal) : '(Bỏ trống)'}
                </span>
                {isShortCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 inline" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 inline" />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={userVal || ''}
                onChange={(e) => handleSelectOption(q.number, e.target.value)}
                placeholder="Nhập câu trả lời của bạn..."
                className="w-72 max-w-full px-2.5 py-1 text-[13px] border border-[#ced4da] rounded-none focus:outline-hidden focus:border-[#0f6cbf] focus:ring-1 focus:ring-[#0f6cbf] bg-white font-sans"
              />
            )}
          </div>
        </div>
      )
    }

    // Dạng 2: Đúng / Sai theo 4 ý a, b, c, d
    if (q.type === 'true_false' && Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
      return (
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
          <div className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
            Chọn Đúng hoặc Sai cho mỗi phát biểu sau:
          </div>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse rounded-none">
            <thead>
              <tr className="bg-[#f2f4f8] border-b border-slate-300 text-slate-800">
                <th className="p-2 border-r border-slate-300 font-bold">Phát biểu</th>
                <th className="p-2 border-r border-slate-300 text-center w-20 font-bold">Đúng</th>
                <th className="p-2 text-center w-20 font-bold">Sai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {q.subQuestions.map((sub: any, sIdx: number) => {
                const subLetter = ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`
                const currentVal = userVal ? userVal[sIdx] : undefined
                return (
                  <tr key={sIdx} className="hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-300">
                      <span className="font-bold mr-1.5">{subLetter})</span>
                      <UetSafeMath content={sub.text || sub.content || ''} className="inline" />
                    </td>
                    <td className="p-2 border-r border-slate-300 text-center">
                      <input
                        type="radio"
                        disabled={isReview}
                        name={`tf_${q.number}_${sIdx}`}
                        checked={currentVal === true}
                        onChange={() => {
                          const updated = { ...(userVal || {}) }
                          updated[sIdx] = true
                          handleSelectOption(q.number, updated)
                        }}
                        className="w-4 h-4 rounded-none accent-[#003366] cursor-pointer"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="radio"
                        disabled={isReview}
                        name={`tf_${q.number}_${sIdx}`}
                        checked={currentVal === false}
                        onChange={() => {
                          const updated = { ...(userVal || {}) }
                          updated[sIdx] = false
                          handleSelectOption(q.number, updated)
                        }}
                        className="w-4 h-4 rounded-none accent-[#003366] cursor-pointer"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    // Dạng 3: Trắc nghiệm ABCD (Single Choice - Chuẩn Portal UET)
    const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f']
    const hasAnswer = userVal !== undefined && userVal !== null && userVal !== ''

    return (
      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
        <div className="text-[12px] text-slate-600 mb-1 font-sans">
          Hãy chọn một câu trả lời đúng nhất:
        </div>

        <div className="space-y-1.5">
          {q.options.map((opt: string, optIdx: number) => {
            const letter = optionLetters[optIdx] || String(optIdx + 1)
            const upperLetter = letter.toUpperCase()
            const isSelected = String(userVal || '').toUpperCase() === upperLetter

            let isCorrectOption = false
            let isWrongSelection = false

            if (effectiveReview) {
              const correctLetter = String(q.correctAnswer || 'A').toUpperCase()
              if (upperLetter === correctLetter) {
                isCorrectOption = true
              }
              if (isSelected && upperLetter !== correctLetter) {
                isWrongSelection = true
              }
            }

            return (
              <label
                key={optIdx}
                className={`flex items-start gap-2.5 p-2 transition cursor-pointer border rounded-none ${
                  effectiveReview
                    ? isCorrectOption
                      ? 'bg-emerald-50 border-emerald-500 text-slate-900 font-semibold'
                      : isWrongSelection
                      ? 'bg-rose-50 border-rose-400 text-slate-900'
                      : 'border-transparent bg-transparent'
                    : isSelected
                    ? 'bg-[#e7f3fe] border-[#b8daff] text-slate-900'
                    : 'border-transparent hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <input
                    type="radio"
                    name={`uet_q_${q.number}`}
                    disabled={isReview}
                    checked={isSelected}
                    onChange={() => handleSelectOption(q.number, upperLetter)}
                    className="w-3.5 h-3.5 rounded-none accent-[#003366] cursor-pointer"
                  />
                </div>

                <div className="flex-1 text-[13px] leading-relaxed">
                  <span className="font-bold mr-1.5">{letter}.</span>
                  <UetSafeMath content={opt} className="inline" />
                </div>

                {effectiveReview && isCorrectOption && (
                  <span className="text-emerald-700 text-xs font-bold shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đúng
                  </span>
                )}
                {effectiveReview && isWrongSelection && (
                  <span className="text-rose-700 text-xs font-bold shrink-0 flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-600" /> Sai
                  </span>
                )}
              </label>
            )
          })}
        </div>

        {/* Nút Xóa lựa chọn và Nút Kiểm tra trong Chế độ Luyện tập */}
        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
          {!isReview && hasAnswer && (
            <button
              type="button"
              onClick={() => handleClearChoice(q.number)}
              className="text-[11px] text-[#0f6cbf] hover:underline cursor-pointer font-sans"
            >
              Xoá lựa chọn của tôi
            </button>
          )}

          {/* CHẾ ĐỘ LUYỆN TẬP: Nút Kiểm tra đáp án tức thì */}
          {examMode === 'practice' && !isReview && hasAnswer && !isPracticeRevealed && (
            <button
              type="button"
              onClick={() => handleCheckPracticeQuestion(q.number)}
              className="px-3 py-1 bg-[#003366] hover:bg-[#002244] text-white text-[11px] font-bold rounded-none border border-[#001933] cursor-pointer flex items-center gap-1 shadow-xs ml-auto"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Kiểm tra câu này
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================================================
  // VIEW 0: MÀN HÌNH CHỜ & LỰA CHỌN CHẾ ĐỘ THI (Waiting Screen)
  // ==========================================================================
  if (viewState === 'waiting') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800 select-none">
        {/* Top Navbar xanh Navy UET có LOGO CHÍNH THỨC */}
        <div className="w-full bg-[#003366] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#002244] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white border border-slate-300 p-0.5 rounded-none flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/uet-logo.png"
                alt="Logo Đại học Công nghệ"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-bold tracking-wide uppercase">
                HỆ THỐNG THI TRỰC TUYẾN - TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)
              </h1>
              <p className="text-[11px] text-slate-200">
                CỔNG THÔNG TIN KHẢO THÍ PORTAL UET
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-emerald-700/80 px-2.5 py-1 text-white border border-emerald-500/50">
              <Wifi className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>Hệ thống trực tuyến</span>
            </div>
          </div>
        </div>

        {/* Breadcrumbs bar */}
        <div className="w-full bg-[#e9ecef] border-b border-[#dee2e6] px-4 py-2 text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
          <Link href="/new-sen-ground" className="text-[#0f6cbf] hover:underline">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#0f6cbf]">Các khóa học</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">{exam?.title || 'Đề thi Đại học'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Phòng chờ thi</span>
        </div>

        {/* Thân trang phòng chờ */}
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="bg-white border border-[#dee2e6] shadow-xs p-6 md:p-8 rounded-none">
            {/* Header thông tin với logo UET lớn */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-slate-200 text-center sm:text-left">
              <div className="w-20 h-20 bg-white border border-slate-300 p-1 rounded-none flex items-center justify-center shadow-xs shrink-0">
                <img
                  src="/uet-logo.png"
                  alt="Logo Trường Đại học Công nghệ"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <span className="inline-block bg-[#003366] text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider mb-1">
                  ĐỘC QUYỀN ĐỀ THI ĐẠI HỌC • PORTAL UET
                </span>
                <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
                  {exam?.title || 'BÀI KIỂM TRA ĐẠI HỌC TRỰC TUYẾN'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Học phần: {exam?.subjects?.[0] || 'Toán cao cấp / Kỹ thuật máy tính'} • Thí sinh: <strong>{studentInfo.name}</strong> ({studentInfo.studentId || studentInfo.email})
                </p>
              </div>
            </div>

            {/* Thông số bài kiểm tra */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
              <div className="border border-slate-200 p-3 bg-[#f8f9fa] text-center">
                <span className="text-[11px] text-slate-500 block">Số câu hỏi</span>
                <strong className="text-base text-slate-900">{questions.length} câu</strong>
              </div>
              <div className="border border-slate-200 p-3 bg-[#f8f9fa] text-center">
                <span className="text-[11px] text-slate-500 block">Thời gian quy định</span>
                <strong className="text-base text-red-600">{examDurationMinutes} phút</strong>
              </div>
              <div className="border border-slate-200 p-3 bg-[#f8f9fa] text-center">
                <span className="text-[11px] text-slate-500 block">Thang điểm</span>
                <strong className="text-base text-[#003366]">10,00 điểm</strong>
              </div>
              <div className="border border-slate-200 p-3 bg-[#f8f9fa] text-center">
                <span className="text-[11px] text-slate-500 block">Phương pháp tính</span>
                <strong className="text-base text-slate-900">Điểm cao nhất</strong>
              </div>
            </div>

            {/* LỰA CHỌN CHẾ ĐỘ THI CHUẨN: THI THẬT vs LUYỆN TẬP */}
            <div className="my-6 border border-slate-300 p-5 bg-[#fbfcfe]">
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wide mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Lựa chọn chế độ làm bài:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lựa chọn 1: Thi thật */}
                <div
                  onClick={() => setExamMode('exam')}
                  className={`p-4 border-2 transition cursor-pointer rounded-none relative ${
                    examMode === 'exam'
                      ? 'border-[#003366] bg-blue-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="exam_mode_select"
                      checked={examMode === 'exam'}
                      onChange={() => setExamMode('exam')}
                      className="mt-1 w-4 h-4 accent-[#003366] cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>🛡️ Chế độ Thi thật (Tính giờ)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        • <strong>Có tính thời gian đếm ngược</strong> ({examDurationMinutes} phút).<br />
                        • Khóa đáp án và giải thích trong lúc làm bài.<br />
                        • Nộp bài xong mới xem điểm và lời giải chi tiết.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lựa chọn 2: Luyện tập */}
                <div
                  onClick={() => setExamMode('practice')}
                  className={`p-4 border-2 transition cursor-pointer rounded-none relative ${
                    examMode === 'practice'
                      ? 'border-[#003366] bg-amber-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="exam_mode_select"
                      checked={examMode === 'practice'}
                      onChange={() => setExamMode('practice')}
                      className="mt-1 w-4 h-4 accent-[#003366] cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>⚡ Chế độ Luyện tập (Tự do)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        • <strong>KHÔNG GIỚI HẠN THỜI GIAN</strong> (Làm bài thoải mái).<br />
                        • Có nút "Kiểm tra" để biết Đúng/Sai ngay sau mỗi câu.<br />
                        • Xem ngay lời giải Feedback KaTeX chi tiết để ôn tập.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quy định và cam kết */}
            <div className="text-xs text-slate-600 space-y-1 mb-8 p-3 bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-800">Quy chế bài kiểm tra trực tuyến:</div>
              <p>• Các câu hỏi được hiển thị cuộn liên tục, thí sinh chỉ cần kéo xuống để làm câu tiếp theo.</p>
              <p>• Hệ thống tự động lưu bản nháp trực tuyến lên Supabase để chống mất bài thi khi gặp sự cố mạng.</p>
              <p>• Nhấn vào nút "Đặt cờ" để đánh dấu những câu cần xem lại trước khi nộp bài.</p>
            </div>

            {/* 2 nút Bắt đầu và Thoát */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#e9ecef] hover:bg-[#dee2e6] text-slate-800 text-xs font-bold rounded-none border border-slate-300 cursor-pointer"
                >
                  Quay lại khóa học
                </button>
              )}

              <button
                type="button"
                onClick={() => handleStartAttempt(examMode)}
                className="w-full sm:w-auto px-8 py-2.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-none border border-[#001933] shadow-xs cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>Bắt đầu làm bài thi ({examMode === 'exam' ? 'Thi thật' : 'Luyện tập'})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // VIEW 2: MÀN HÌNH TÓM TẮT BÀI LÀM TRƯỚC KHI NỘP (Summary of attempt)
  // ==========================================================================
  if (viewState === 'summary') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] font-sans select-none text-slate-800">
        {/* Header Portal UET Navy có Logo */}
        <div className="w-full bg-[#003366] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#002244] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white border border-slate-300 p-0.5 rounded-none flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/uet-logo.png"
                alt="Logo Đại học Công nghệ"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-bold tracking-wide uppercase">
                HỆ THỐNG THI TRỰC TUYẾN - TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)
              </h1>
              <p className="text-[11px] text-slate-200">
                {exam?.title || 'BÀI THI KẾT THÚC HỌC PHẦN'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {examMode === 'exam' ? (
              <span className="text-xs font-mono bg-[#002244] px-2 py-1 text-amber-300 font-bold border border-slate-600">
                {formatTime(timeLeft)}
              </span>
            ) : (
              <span className="text-xs bg-amber-500 text-slate-900 font-bold px-2 py-1 border border-amber-600">
                ⚡ Luyện tập tự do
              </span>
            )}
          </div>
        </div>

        {/* Breadcrumbs bar */}
        <div className="w-full bg-[#e9ecef] border-b border-[#dee2e6] px-4 py-2 text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
          <Link href="/new-sen-ground" className="text-[#0f6cbf] hover:underline">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#0f6cbf]">Các khóa học</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">{exam?.title || 'Đề thi Đại học'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Tóm tắt bài làm</span>
        </div>

        {/* Nội dung Tóm tắt */}
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="bg-white border border-[#dee2e6] shadow-xs p-6 rounded-none">
            <h2 className="text-lg md:text-xl font-bold text-[#003366] pb-3 border-b border-slate-200 mb-4">
              Tóm tắt bài kiểm tra ({examMode === 'exam' ? 'Chế độ Thi thật' : 'Chế độ Luyện tập'})
            </h2>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-[#e9ecef] border-b border-slate-300 text-slate-800">
                    <th className="p-2.5 border-r border-slate-300 font-bold w-28">Câu hỏi</th>
                    <th className="p-2.5 border-r border-slate-300 font-bold">Trạng thái</th>
                    <th className="p-2.5 font-bold text-center w-28">Đánh dấu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {questions.map((q) => {
                    const ans = answers[q.number]
                    const hasAns = ans !== undefined && ans !== null && ans !== ''
                    const isFlagged = flags[q.number]

                    return (
                      <tr
                        key={q.number}
                        onClick={() => scrollToQuestion(q.number)}
                        className="hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="p-2.5 border-r border-slate-300 font-bold text-[#0f6cbf]">
                          Câu {q.number}
                        </td>
                        <td className="p-2.5 border-r border-slate-300">
                          {hasAns ? (
                            <span className="text-slate-800 font-medium">Đã lưu câu trả lời</span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa trả lời</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isFlagged ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]">
                              <Flag className="w-3.5 h-3.5 fill-red-600 text-red-600" /> Có cờ
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 2 nút điều hướng chuẩn Portal UET */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewState('exam')}
                className="w-full sm:w-auto px-5 py-2 bg-[#6c757d] hover:bg-[#5a6268] text-white text-xs font-bold rounded-none cursor-pointer border border-[#545b62]"
              >
                Quay lại làm bài
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full sm:w-auto px-6 py-2 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-none cursor-pointer border border-[#001933] shadow-xs"
              >
                Nộp bài và kết thúc tất cả...
              </button>
            </div>
          </div>
        </div>

        {/* Modal xác nhận nộp bài (Popup chuẩn Moodle Portal UET) */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-400 shadow-2xl max-w-md w-full p-6 rounded-none animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Nộp bài và kết thúc tất cả?
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Khi bạn nộp bài, hệ thống sẽ tính điểm và lưu kết quả bài kiểm tra lên máy chủ Portal UET.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#e9ecef] hover:bg-[#dee2e6] text-slate-800 text-xs font-semibold rounded-none border border-slate-300 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAllAndFinish}
                  disabled={isSubmitting}
                  className="px-5 py-1.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-none border border-[#001933] cursor-pointer"
                >
                  {isSubmitting ? 'Đang chấm điểm...' : 'Nộp bài và kết thúc'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================================================
  // VIEW 3: MÀN HÌNH XEM LẠI BÀI THI (Review attempt - Chuẩn Portal UET)
  // ==========================================================================
  if (viewState === 'review' && reviewResult) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
        {/* Top Navbar xanh Navy UET có LOGO */}
        <div className="w-full bg-[#003366] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#002244] shadow-xs sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white border border-slate-300 p-0.5 rounded-none flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/uet-logo.png"
                alt="Logo Đại học Công nghệ"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-bold tracking-wide uppercase">
                HỆ THỐNG THI TRỰC TUYẾN - TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)
              </h1>
              <p className="text-[11px] text-slate-200">
                Xem lại lần thi • {exam?.title || 'Đề thi Đại học'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-none border border-white/30 cursor-pointer"
              >
                Rời bài thi
              </button>
            ) : (
              <Link
                href="/new-sen-ground"
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-none border border-white/30"
              >
                Về Portal
              </Link>
            )}
          </div>
        </div>

        {/* Breadcrumbs bar */}
        <div className="w-full bg-[#e9ecef] border-b border-[#dee2e6] px-4 py-2 text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
          <Link href="/new-sen-ground" className="text-[#0f6cbf] hover:underline">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#0f6cbf]">Các khóa học</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">{exam?.title || 'Đề thi'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Xem lại lần làm bài</span>
        </div>

        {/* Main Layout 2 Cột */}
        <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cột trái (Chiếm 3/4): Bảng tổng kết + Toàn bộ câu hỏi cuộn dọc */}
          <div className="lg:col-span-3 space-y-6">
            {/* BẢNG TỔNG KẾT LẦN LÀM BÀI (Summary of your attempt) */}
            <div className="bg-white border border-[#dee2e6] shadow-xs p-4 rounded-none">
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold w-40 text-slate-700">
                      Bắt đầu vào
                    </th>
                    <td className="p-2.5 text-slate-800 font-mono">
                      {formatDateString(startTime)}
                    </td>
                  </tr>
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold text-slate-700">
                      Chế độ
                    </th>
                    <td className="p-2.5 text-slate-800 font-bold">
                      {reviewResult.examMode === 'practice' ? '⚡ Chế độ Luyện tập' : '🛡️ Chế độ Thi thật'}
                    </td>
                  </tr>
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold text-slate-700">
                      Trạng thái
                    </th>
                    <td className="p-2.5 text-emerald-700 font-bold uppercase">
                      Đã hoàn thành
                    </td>
                  </tr>
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold text-slate-700">
                      Đã hoàn thành lúc
                    </th>
                    <td className="p-2.5 text-slate-800 font-mono">
                      {finishTime ? formatDateString(finishTime) : formatDateString(new Date())}
                    </td>
                  </tr>
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold text-slate-700">
                      Thời gian thực hiện
                    </th>
                    <td className="p-2.5 text-slate-800">
                      {Math.floor(reviewResult.durationSeconds / 60)} phút {reviewResult.durationSeconds % 60} giây
                    </td>
                  </tr>
                  <tr>
                    <th className="p-2.5 bg-[#f8f9fa] border-r border-slate-300 font-bold text-slate-700">
                      Điểm số
                    </th>
                    <td className="p-2.5 text-slate-800 font-bold">
                      <span className="text-[#003366] text-base">{reviewResult.earnedPoints}</span> / {reviewResult.maxPoints} ({reviewResult.percentage}%)
                    </td>
                  </tr>
                  <tr className="bg-amber-50/70">
                    <th className="p-2.5 bg-amber-100/60 border-r border-slate-300 font-bold text-slate-800">
                      Đánh giá (Thang điểm 10)
                    </th>
                    <td className="p-2.5 font-bold text-red-600 text-base">
                      {reviewResult.gradeOn10} / 10,00
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DANH SÁCH TỪNG CÂU HỎI CUỘN DỌC KÈM GIẢI THÍCH FEEDBACK */}
            <div className="space-y-6">
              {questions.map((q) => {
                const qRes = reviewResult.questionResults?.find((r: any) => r.questionNumber === q.number)
                const isCorrect = qRes?.isCorrect
                const isPartial = qRes?.isPartial
                const isFlagged = flags[q.number]

                return (
                  <div
                    key={q.number}
                    id={`uet-question-block-${q.number}`}
                    className="border border-[#dee2e6] bg-white shadow-xs rounded-none grid grid-cols-1 md:grid-cols-12 overflow-hidden"
                  >
                    {/* Cột trái (Info Box Moodle) */}
                    <div className="md:col-span-3 bg-[#f8f9fa] border-b md:border-b-0 md:border-r border-[#dee2e6] p-3 text-xs flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="font-bold text-[#003366] text-sm">
                          Câu hỏi {q.number}
                        </div>
                        <div>
                          {isCorrect ? (
                            <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[11px]">
                              Đúng
                            </span>
                          ) : isPartial ? (
                            <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold border border-amber-300 text-[11px]">
                              Một phần
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold border border-rose-300 text-[11px]">
                              Không đúng
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          Đạt điểm {qRes?.pointsEarned || 0} trên {q.points || 1.0}
                        </div>
                      </div>

                      {isFlagged && (
                        <div className="pt-2 text-red-600 text-[10px] flex items-center gap-1 font-bold">
                          <Flag className="w-3 h-3 fill-red-600 text-red-600" /> Đã đặt cờ
                        </div>
                      )}
                    </div>

                    {/* Cột phải (Content Box & Feedback) */}
                    <div className="md:col-span-9 p-4 flex flex-col justify-between bg-white">
                      <div>
                        {/* Đề bài KaTeX */}
                        <div className="text-[13px] md:text-sm font-medium text-slate-900 leading-relaxed">
                          <UetSafeMath content={q.text} />
                        </div>

                        {/* Các lựa chọn đáp án */}
                        {renderQuestionInput(q, true)}
                      </div>

                      {/* KHUNG PHẢN HỒI FEEDBACK / GIẢI THÍCH (Chuẩn Moodle UET nền vàng nhạt) */}
                      <div className="mt-4 p-3 bg-[#fff3cd] border border-[#ffeeba] text-[#856404] text-xs rounded-none space-y-1.5">
                        <div className="font-bold">
                          {isCorrect ? '✔ Câu trả lời của bạn là chính xác.' : '✖ Câu trả lời của bạn chưa chính xác.'}
                        </div>
                        {q.correctAnswer && (
                          <div className="text-[12px]">
                            Câu trả lời đúng là: <strong className="font-mono text-[#003366]">{q.correctAnswer}</strong>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="pt-2 border-t border-[#ffe8a1] mt-2">
                            <span className="font-bold block mb-1">Lời giải chi tiết:</span>
                            <div className="text-slate-900 leading-relaxed">
                              <UetSafeMath content={q.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Nút Kết thúc xem lại */}
            <div className="text-right pt-4">
              <button
                type="button"
                onClick={() => {
                  if (onExit) onExit()
                  else router.push('/new-sen-ground')
                }}
                className="px-6 py-2 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-none border border-[#001933] shadow-xs cursor-pointer"
              >
                Kết thúc xem lại...
              </button>
            </div>
          </div>

          {/* Cột phải (Chiếm 1/4): Điều hướng bài kiểm tra sticky */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#dee2e6] shadow-xs p-4 rounded-none sticky top-16 space-y-4">
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wide border-b border-slate-200 pb-2">
                Điều hướng bài kiểm tra
              </h3>

              {/* Thông tin thí sinh */}
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-none bg-[#003366] text-white flex items-center justify-center font-bold text-xs">
                  {studentInfo.name ? studentInfo.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-[11px] leading-tight overflow-hidden">
                  <div className="font-bold text-slate-800 truncate">{studentInfo.name}</div>
                  <div className="text-slate-500 font-mono text-[10px] truncate">{studentInfo.email}</div>
                </div>
              </div>

              {/* Lưới các ô số câu hỏi có tô màu đúng / sai */}
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q) => {
                  const qRes = reviewResult.questionResults?.find((r: any) => r.questionNumber === q.number)
                  const isCorrect = qRes?.isCorrect
                  const isPartial = qRes?.isPartial

                  return (
                    <button
                      key={q.number}
                      type="button"
                      onClick={() => scrollToQuestion(q.number)}
                      title={`Câu hỏi ${q.number}: ${isCorrect ? 'Đúng' : isPartial ? 'Một phần' : 'Sai'}`}
                      className={`h-8 border rounded-none text-xs font-bold flex flex-col items-center justify-center cursor-pointer transition ${
                        isCorrect
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : isPartial
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-rose-600 text-white border-rose-700'
                      }`}
                    >
                      <span>{q.number}</span>
                    </button>
                  )
                })}
              </div>

              <div className="pt-2 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onExit) onExit()
                    else router.push('/new-sen-ground')
                  }}
                  className="text-xs text-[#0f6cbf] hover:underline font-semibold cursor-pointer"
                >
                  Kết thúc xem lại...
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // VIEW 1: MÀN HÌNH LÀM BÀI THI CHÍNH THỨC PORTAL UET (Continuous Scroll)
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800 select-none">
      {/* Top Navbar xanh Navy UET (#003366) có LOGO */}
      <div className="w-full bg-[#003366] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#002244] shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-300 p-0.5 rounded-none flex items-center justify-center shadow-xs shrink-0">
            <img
              src="/uet-logo.png"
              alt="Logo Đại học Công nghệ"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold tracking-wide uppercase">
              HỆ THỐNG THI TRỰC TUYẾN - TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)
            </h1>
            <p className="text-[11px] text-slate-200">
              {exam?.title || 'BÀI THI KẾT THÚC HỌC PHẦN'}
            </p>
          </div>
        </div>

        {/* Thông tin sinh viên & Nút nộp bài */}
        <div className="flex items-center gap-3">
          {/* Badge chế độ */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold border border-white/20 bg-white/10 text-white">
            {examMode === 'practice' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Chế độ Luyện tập</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Chế độ Thi thật</span>
              </>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-right">
            <div className="text-[11px] text-slate-200 leading-tight">
              <div className="font-bold text-white">{studentInfo.name}</div>
              <div className="font-mono text-[10px] text-slate-300">
                {studentInfo.studentId || studentInfo.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewState('summary')}
            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-none border border-red-900 cursor-pointer uppercase tracking-wider"
          >
            Nộp bài...
          </button>
        </div>
      </div>

      {/* Breadcrumbs bar xám #e9ecef */}
      <div className="w-full bg-[#e9ecef] border-b border-[#dee2e6] px-4 py-2 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href="/new-sen-ground" className="text-[#0f6cbf] hover:underline">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#0f6cbf]">Các khóa học của tôi</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">{exam?.title || 'Đề thi Đại học'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Bài làm ({examMode === 'practice' ? 'Luyện tập' : 'Thi thật'})</span>
        </div>

        <div className="text-[11px] text-slate-500 italic">
          Kéo xuống liên tục để làm các câu tiếp theo
        </div>
      </div>

      {/* Main Layout 2 Cột: Cột chính cuộn liên tục + Cột điều hướng sticky */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* CỘT TRÁI (3/4): DANH SÁCH CÂU HỎI CUỘN DỌC LIÊN TỤC */}
        <div className="lg:col-span-3 space-y-6">
          {questions.map((q) => {
            const hasAnswer = answers[q.number] !== undefined && answers[q.number] !== null && answers[q.number] !== ''
            const isFlagged = flags[q.number]
            const isPracticeRevealed = examMode === 'practice' && revealedInPractice[q.number]
            const userVal = answers[q.number]
            const isCorrectInPractice =
              isPracticeRevealed &&
              String(userVal || '').trim().toUpperCase() === String(q.correctAnswer || 'A').trim().toUpperCase()

            return (
              <div
                key={q.number}
                id={`uet-question-block-${q.number}`}
                className="border border-[#dee2e6] bg-white shadow-xs rounded-none grid grid-cols-1 md:grid-cols-12 overflow-hidden scroll-mt-20"
              >
                {/* INFO BOX BÊN TRÁI (Chuẩn Moodle LMS / Portal UET) */}
                <div className="md:col-span-3 bg-[#f8f9fa] border-b md:border-b-0 md:border-r border-[#dee2e6] p-3 text-xs flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#003366] text-sm">
                      Câu hỏi {q.number}
                    </div>
                    <div>
                      {hasAnswer ? (
                        <span className="text-slate-800 font-bold text-[11px]">
                          Đã trả lời
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">
                          Chưa trả lời
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      Đạt điểm {q.points || 1.0}
                    </div>

                    {/* Huy hiệu trạng thái khi đang ở Chế độ Luyện tập */}
                    {isPracticeRevealed && (
                      <div className="pt-1">
                        {isCorrectInPractice ? (
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px]">
                            ✔ Chính xác
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold border border-rose-300 text-[10px]">
                            ✖ Chưa đúng
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nút Đặt cờ (Flag question) có icon cờ đỏ */}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => toggleFlag(q.number)}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 border rounded-none font-semibold transition cursor-pointer ${
                        isFlagged
                          ? 'bg-rose-50 border-rose-400 text-rose-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Flag
                        className={`w-3.5 h-3.5 ${
                          isFlagged ? 'fill-red-600 text-red-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{isFlagged ? 'Xóa cờ' : 'Đặt cờ'}</span>
                    </button>
                  </div>
                </div>

                {/* CONTENT BOX BÊN PHẢI (Nội dung câu hỏi KaTeX + Radio / Input vuông vắn) */}
                <div className="md:col-span-9 p-4 flex flex-col justify-between bg-white">
                  <div>
                    {/* Thân câu hỏi bằng KaTeX / TikZ */}
                    <div className="text-[13px] md:text-sm font-medium text-slate-900 leading-relaxed">
                      <UetSafeMath content={q.text} />
                    </div>

                    {/* Vùng lựa chọn đáp án */}
                    {renderQuestionInput(q, false)}

                    {/* HIỂN THỊ FEEDBACK LỜI GIẢI TỨC THÌ (CHỈ TRONG CHẾ ĐỘ LUYỆN TẬP KHI BẤM KIỂM TRA) */}
                    {isPracticeRevealed && (
                      <div className="mt-4 p-3 bg-[#fff3cd] border border-[#ffeeba] text-[#856404] text-xs rounded-none space-y-1.5 animate-in fade-in">
                        <div className="font-bold">
                          {isCorrectInPractice ? '✔ Câu trả lời của bạn là chính xác.' : '✖ Câu trả lời của bạn chưa chính xác.'}
                        </div>
                        {q.correctAnswer && (
                          <div className="text-[12px]">
                            Câu trả lời đúng là: <strong className="font-mono text-[#003366]">{q.correctAnswer}</strong>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="pt-2 border-t border-[#ffe8a1] mt-2">
                            <span className="font-bold block mb-1">Lời giải chi tiết:</span>
                            <div className="text-slate-900 leading-relaxed">
                              <UetSafeMath content={q.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Nút Chuyển trang / Nộp bài ở cuối danh sách câu hỏi */}
          <div className="flex items-center justify-between pt-4 pb-12 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Đã đến câu hỏi cuối cùng của đề thi.
            </span>
            <button
              type="button"
              onClick={() => setViewState('summary')}
              className="px-6 py-2.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-none border border-[#001933] shadow-xs cursor-pointer"
            >
              Nộp bài và kết thúc...
            </button>
          </div>
        </div>

        {/* CỘT PHẢI (1/4): ĐIỀU HƯỚNG BÀI KIỂM TRA (STICKY) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-[#dee2e6] shadow-xs p-4 rounded-none sticky top-16 space-y-4">
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wide border-b border-slate-200 pb-2">
              Điều hướng bài kiểm tra
            </h3>

            {/* Thông tin thí sinh */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-none bg-[#003366] text-white flex items-center justify-center font-bold text-xs">
                {studentInfo.name ? studentInfo.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-[11px] leading-tight overflow-hidden">
                <div className="font-bold text-slate-800 truncate">{studentInfo.name}</div>
                <div className="text-slate-500 font-mono text-[10px] truncate">{studentInfo.email}</div>
              </div>
            </div>

            {/* ĐỒNG HỒ ĐẾM NGƯỢC (CHỈ KHI THI THẬT) HOẶC THÔNG BÁO TỰ DO (KHI LUYỆN TẬP) */}
            {examMode === 'exam' ? (
              <div className="bg-red-50 border border-red-300 p-2 text-center rounded-none">
                <div className="text-[10px] text-red-700 uppercase font-bold tracking-wider">
                  Thời gian còn lại
                </div>
                <div className="text-xl font-mono font-bold text-red-600 mt-0.5">
                  {formatTime(timeLeft)}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-300 p-2 text-center rounded-none">
                <div className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">
                  Chế độ luyện tập
                </div>
                <div className="text-xs font-bold text-amber-700 mt-0.5">
                  Không giới hạn thời gian
                </div>
              </div>
            )}

            {/* LƯỚI Ô VUÔNG SỐ CÂU HỎI (GÓC VUÔNG ROUNDED-NONE CHUẨN MOODLE) */}
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q) => {
                const hasAnswer = answers[q.number] !== undefined && answers[q.number] !== null && answers[q.number] !== ''
                const isFlagged = flags[q.number]
                const isPracticeRevealed = examMode === 'practice' && revealedInPractice[q.number]
                const userVal = answers[q.number]
                const isCorrect =
                  isPracticeRevealed &&
                  String(userVal || '').trim().toUpperCase() === String(q.correctAnswer || 'A').trim().toUpperCase()

                return (
                  <button
                    key={q.number}
                    type="button"
                    onClick={() => scrollToQuestion(q.number)}
                    className="relative w-full h-8 border border-slate-400 rounded-none text-xs font-bold flex flex-col items-stretch overflow-hidden cursor-pointer hover:border-[#003366] transition group"
                  >
                    {/* Nửa trên: Số câu hỏi */}
                    <div
                      className={`flex-1 flex items-center justify-center text-[11px] ${
                        isPracticeRevealed
                          ? isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      {q.number}
                    </div>

                    {/* Nửa dưới: Tô xám tối khi đã trả lời, trắng khi chưa làm */}
                    <div
                      className={`h-2.5 transition-colors ${
                        hasAnswer ? 'bg-slate-500' : 'bg-slate-100'
                      }`}
                    />

                    {/* Cờ đỏ góc tam giác trên bên phải khi được đặt cờ (Flag) */}
                    {isFlagged && (
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-8 border-t-red-600 border-l-8 border-l-transparent" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Chú thích màu sắc */}
            <div className="text-[10px] text-slate-500 space-y-1 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-slate-400 bg-white" />
                <span>Chưa trả lời</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-slate-400 bg-slate-500" />
                <span>Đã trả lời</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flag className="w-3 h-3 fill-red-600 text-red-600" />
                <span>Đã đặt cờ (xem lại sau)</span>
              </div>
            </div>

            {/* Link nộp bài */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => setViewState('summary')}
                className="text-xs text-[#0f6cbf] hover:underline font-semibold cursor-pointer"
              >
                Nộp bài và kết thúc...
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
