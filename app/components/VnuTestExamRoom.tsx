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
  Maximize2,
  Minimize2,
  Bookmark,
  Award,
  Layers,
  Check,
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
    console.warn('LaTeX Markdown render error in VnuTestExamRoom:', error)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <span className="text-rose-500 text-xs italic">[Lỗi hiển thị công thức toán KaTeX]</span>
        )
      )
    }
    return this.props.children
  }
}

export const SafeMathRenderer = React.memo(
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
                  errorColor: '#ef4444',
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
                  <code className={codeClass} {...props}>
                    {children}
                  </code>
                )
              },
              img: ({ node, ...props }: any) => (
                <span className="block my-2 text-center">
                  <img
                    {...props}
                    alt={props.alt || 'Hình minh họa câu hỏi'}
                    className="max-h-[340px] max-w-full border border-slate-300 mx-auto object-contain bg-white cursor-zoom-in"
                    onClick={() => {
                      if (props.src) window.open(props.src, '_blank')
                    }}
                  />
                  {props.alt && props.alt !== 'Hình minh họa câu hỏi' && (
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
SafeMathRenderer.displayName = 'SafeMathRenderer'

export interface VnuTestExamRoomProps {
  exam: any
  studentInfo: {
    id?: string
    name: string
    email: string
    avatar?: string | null
    school?: string
    studentId?: string
  }
  isMobileView?: boolean
  onExit?: () => void
}

export default function VnuTestExamRoom({
  exam,
  studentInfo,
  isMobileView = false,
  onExit,
}: VnuTestExamRoomProps) {
  const router = useRouter()

  // Giai đoạn màn hình:
  // 'welcome': Giao diện chào mừng siêu cổ điển HSA (hiện môn, số câu, thời gian, logo VNU IDT)
  // 'exam': Màn hình làm bài chính thức (giao diện HSA 1 phần duy nhất, cuộn dọc 1..N)
  // 'warning_end': Màn hình nhắc nhở & kiểm tra câu chưa làm trước khi nộp (Ảnh 4 HSA)
  // 'result': Bảng điểm kết quả chuẩn HSA
  const [screenStage, setScreenStage] = useState<'welcome' | 'exam' | 'warning_end' | 'result'>('welcome')

  // Thời gian làm bài linh hoạt (tự chọn theo đề thi, mặc định 60p nếu chưa cài)
  const examDurationMinutes = Number(exam?.duration) > 0 ? Number(exam.duration) : 60
  const [timeLeft, setTimeLeft] = useState<number>(examDurationMinutes * 60)

  // Trạng thái câu hỏi & đáp án
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [notedQuestions, setNotedQuestions] = useState<Record<number, boolean>>({}) // Tính năng bôi vàng (Note)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Kết quả sau khi nộp
  const [vnuResult, setVnuResult] = useState<{
    totalScore: number
    maxScore: number
    correctCount: number
    totalCount: number
  } | null>(null)

  // Bóc tách toàn bộ câu hỏi (CHUNG MỘT PHẦN DUY NHẤT 1..N)
  const questions = useMemo(() => {
    let list: any[] = []

    // 1. Kiểm tra exam_structure
    if (exam?.exam_structure) {
      let struct = exam.exam_structure
      if (typeof struct === 'string') {
        try {
          struct = JSON.parse(struct)
        } catch {
          struct = []
        }
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

    // 2. Kiểm tra exam.questions trực tiếp
    if (list.length === 0 && Array.isArray(exam?.questions)) {
      list = [...exam.questions]
    }

    // 3. Fallback nếu chưa có câu hỏi
    if (list.length === 0) {
      const count = Number(exam?.total_questions) || 40
      list = Array.from({ length: count }).map((_, i) => ({
        id: `vnu_q_${i + 1}`,
        number: i + 1,
        text: `Câu hỏi số ${i + 1} môn ${exam?.subject || 'VNU TEST'}. Chọn phương án đúng nhất:`,
        options: [
          'Phương án A: Nội dung lựa chọn thứ nhất',
          'Phương án B: Nội dung lựa chọn thứ hai',
          'Phương án C: Nội dung lựa chọn thứ ba',
          'Phương án D: Nội dung lựa chọn thứ tư',
        ],
        correctAnswer: 'A',
        explanation: `Hướng dẫn giải chi tiết cho câu hỏi ${i + 1}.`,
        points: 1,
        type: 'single_choice',
      }))
    }

    // Đảm bảo số thứ tự câu hỏi liên tục từ 1 đến N
    return list.map((q: any, idx: number) => ({
      ...q,
      number: idx + 1,
      text: q.text || q.question || `Câu hỏi ${idx + 1}`,
      options: Array.isArray(q.options)
        ? q.options
        : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correctAnswer: q.correctAnswer || q.answer || q.correct_answer || 'A',
      explanation: q.explanation || q.solution || '',
      type: q.type || 'single_choice',
    }))
  }, [exam])

  // Danh sách các câu chưa làm
  const unansweredQuestions = useMemo(() => {
    return questions.filter(
      (q) => answers[String(q.number)] === undefined || answers[String(q.number)] === ''
    )
  }, [questions, answers])

  // Đếm ngược thời gian làm bài
  useEffect(() => {
    if (screenStage !== 'exam') return

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
  }, [screenStage])

  // Toàn màn hình
  const triggerFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
      } else {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
      }
    } catch {}
  }

  // Bắt đầu làm bài thi
  const handleStartExam = () => {
    setTimeLeft(examDurationMinutes * 60)
    setCurrentQuestionNumber(1)
    setScreenStage('exam')
    triggerFullscreen()
  }

  // Bật/tắt Note vàng câu hỏi
  const toggleNoteQuestion = (qNum: number) => {
    setNotedQuestions((prev) => ({
      ...prev,
      [qNum]: !prev[qNum],
    }))
  }

  // Chọn đáp án
  const handleSelectAnswer = (qNum: number, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [String(qNum)]: value,
    }))
  }

  // Cuộn tới câu hỏi
  const scrollToQuestion = (qNum: number) => {
    setCurrentQuestionNumber(qNum)
    const el = document.getElementById(`vnu-q-item-${qNum}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Định dạng thời gian
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Chấm điểm & Nộp bài
  const handleSubmitExam = async () => {
    setSubmitting(true)
    try {
      let correctCount = 0
      questions.forEach((q) => {
        const studentAns = String(answers[String(q.number)] || '').trim().toUpperCase()
        const correctAns = String(q.correctAnswer || '').trim().toUpperCase()
        if (studentAns && studentAns === correctAns) {
          correctCount++
        }
      })

      const totalCount = questions.length || 1
      const totalScore = Number(((correctCount / totalCount) * 10).toFixed(2))
      const timeSpentSeconds = Math.max(1, (examDurationMinutes * 60) - timeLeft)

      // Đồng bộ nộp bài vào bảng submissions của Supabase để hiện trên Lịch sử làm bài
      try {
        const { data: authData } = await supabase.auth.getUser()
        const currentUserId = authData?.user?.id || studentInfo?.id

        if (currentUserId && exam?.id) {
          const insertPayload: any = {
            exam_id: exam.id,
            user_id: currentUserId,
            score: totalScore,
            correct_count: correctCount,
            total_questions: totalCount,
            answers: answers,
            time_spent: timeSpentSeconds,
            is_graded: true,
            created_at: new Date().toISOString(),
          }

          const { error: insertErr } = await supabase
            .from('submissions')
            .insert(insertPayload)

          if (insertErr) {
            console.warn('Lỗi khi nộp bài VNU TEST (có thể thiếu cột), thử payload cơ bản:', insertErr.message)
            const minPayload: any = {
              exam_id: exam.id,
              user_id: currentUserId,
              score: totalScore,
              answers: answers,
              is_graded: true,
            }
            await supabase.from('submissions').insert(minPayload)
          }

          // Xóa draft tạm nếu có
          try {
            localStorage.removeItem(`vnu_test_draft_${exam.id}_${currentUserId}`)
          } catch {}
        }
      } catch (subErr) {
        console.error('Lỗi khi lưu submission VNU TEST vào Supabase:', subErr)
      }

      setVnuResult({
        totalScore,
        maxScore: 10,
        correctCount,
        totalCount,
      })
      setScreenStage('result')
    } catch (err) {
      console.error('Lỗi nộp bài VNU TEST:', err)
      setScreenStage('result')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    handleSubmitExam()
  }

  // Render options theo chuẩn HSA cổ điển
  const renderOptions = (q: any) => {
    const qNum = q.number
    const currentAns = answers[String(qNum)]

    if (q.type === 'short_answer') {
      return (
        <div className="mt-3 flex items-center gap-2 max-w-sm">
          <span className="text-xs font-bold text-slate-700">Đáp án:</span>
          <input
            type="text"
            value={currentAns || ''}
            onChange={(e) => handleSelectAnswer(qNum, e.target.value)}
            placeholder="Nhập đáp số..."
            className="flex-1 px-3 py-1.5 border border-slate-400 bg-white text-xs font-bold rounded-xs outline-none focus:border-[#2d6a36]"
          />
        </div>
      )
    }

    const optionLabels = ['A', 'B', 'C', 'D']
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
        {q.options.map((opt: any, optIdx: number) => {
          const optLabel = optionLabels[optIdx] || String.fromCharCode(65 + optIdx)
          const isSelected = String(currentAns || '').toUpperCase() === optLabel

          return (
            <label
              key={optIdx}
              onClick={() => handleSelectAnswer(qNum, optLabel)}
              className={`flex items-start gap-2 p-2.5 rounded-xs border cursor-pointer transition select-none ${
                isSelected
                  ? 'bg-[#edf5fc] border-[#5b9bd5] text-[#1b5b96] font-bold'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`vnu_q_${qNum}`}
                checked={isSelected}
                onChange={() => handleSelectAnswer(qNum, optLabel)}
                className="mt-0.5 accent-[#2d6a36]"
              />
              <span className="font-bold shrink-0">{optLabel}.</span>
              <div className="flex-1 text-xs md:text-[13px] leading-relaxed">
                <SafeMathRenderer content={opt} />
              </div>
            </label>
          )
        })}
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH CHÀO MỪNG: SIÊU CỔ ĐIỂN CHUẨN HSA VỚI LOGO VNU IDT
  // ==========================================================================
  if (screenStage === 'welcome') {
    return (
      <div className="w-screen h-screen bg-white flex flex-col font-sans select-none overflow-hidden">
        {/* Header xám chuẩn HSA */}
        <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <img src="/vnu-idt-logo.png" alt="VNU IDT" className="w-6 h-6 object-contain" />
            <span className="text-[12px] font-bold text-[#2d6a36] uppercase tracking-wide">
              VNU - IDT
            </span>
          </div>
          <div className="text-[12px] md:text-[13px] font-bold text-[#555555] uppercase tracking-wide">
            {exam?.title || 'BÀI THI CHUẨN VNU TEST (ĐHQGHN)'}
          </div>
          <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
            <User className="w-5 h-5" />
          </div>
        </div>

        {/* Nội dung trung tâm màn hình chờ */}
        <div className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center text-center overflow-y-auto bg-white">
          <div className="mb-4">
            <img
              src="/vnu-idt-logo.png"
              alt="VNU IDT"
              className="w-20 h-20 md:w-24 md:h-24 object-contain mx-auto drop-shadow-xs"
            />
          </div>

          <h1 className="text-sm md:text-base font-bold text-[#1a237e] uppercase tracking-wider mb-2">
            {exam?.title || 'BÀI THI KHẢO THÍ CHUẨN VNU TEST (ĐHQGHN)'}
          </h1>

          <div className="inline-block bg-[#5b9bd5] text-white px-4 py-1 text-xs font-bold uppercase mb-4 shadow-2xs">
            MÔN THI: {exam?.subject ? String(exam.subject).toUpperCase() : 'TỔNG HỢP'}
          </div>

          {/* Bảng thông tin thí sinh và quy chế thi cổ điển */}
          <div className="max-w-md w-full bg-[#f9f9f9] border border-[#cccccc] p-4 text-left text-xs space-y-2 mb-6 shadow-xs">
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="text-slate-600 font-medium">Thí sinh:</span>
              <span className="font-bold text-slate-900">{studentInfo.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="text-slate-600 font-medium">Số câu hỏi:</span>
              <span className="font-bold text-[#1a237e]">{questions.length} câu (Chung 1 phần duy nhất)</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="text-slate-600 font-medium">Thời gian làm bài:</span>
              <span className="font-bold text-red-600">{examDurationMinutes} phút</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">Hình thức thi:</span>
              <span className="font-bold text-green-700">VNU TEST (Trắc nghiệm & Điền đáp số KaTeX)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 max-w-lg mb-6 leading-relaxed">
            * Lưu ý: Khi bấm bắt đầu, hệ thống sẽ tự động kích hoạt chế độ <strong>Toàn màn hình (Full Screen)</strong> và đếm ngược thời gian. Bạn có thể sử dụng nút <strong>Note</strong> để bôi vàng các câu hỏi cần xem lại sau.
          </p>

          <button
            type="button"
            onClick={handleStartExam}
            className="px-8 py-2.5 bg-[#5c9d5f] hover:bg-[#4d8650] text-white font-bold text-xs md:text-sm rounded-xs border border-[#4d8650] shadow-xs uppercase tracking-wider cursor-pointer transition hover:scale-102"
          >
            BẮT ĐẦU LÀM BÀI (FULL SCREEN)
          </button>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH NHẮC NHỞ TRƯỚC KHI NỘP BÀI (GIỐNG HỆT ẢNH 4 HSA)
  // ==========================================================================
  if (screenStage === 'warning_end') {
    const unansweredNumbers = unansweredQuestions.map((q) => q.number).join(', ')

    return (
      <div className="w-screen h-screen bg-white flex flex-col font-sans select-none overflow-hidden">
        {/* Header xám trên cùng */}
        <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <img src="/vnu-idt-logo.png" alt="VNU IDT" className="w-5 h-5 object-contain" />
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 border border-black bg-slate-300 flex items-center justify-center text-[9px] font-bold">
                ▶
              </div>
              <span className="text-green-700 font-bold text-sm ml-1">1</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold text-[#555555] uppercase">
              {exam?.title || 'BÀI THI CHUẨN VNU TEST (ĐHQGHN)'}
            </div>
            <div className="inline-block bg-[#5b9bd5] text-white px-2 py-0.5 text-[10px] font-bold uppercase mt-0.5">
              {exam?.subject ? `MÔN: ${exam.subject.toUpperCase()}` : 'VNU TEST'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-red-600 font-bold font-mono text-sm">
              {formatSeconds(timeLeft)}
            </div>
            <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Dải số câu hỏi */}
        <div className="w-full bg-[#f0f0f0] border-b border-[#cccccc] px-2 py-1.5 overflow-x-auto flex gap-1 items-center shrink-0">
          {questions.map((q) => {
            const qNum = q.number
            const isAnswered = answers[String(qNum)] !== undefined && answers[String(qNum)] !== ''
            const isNoted = notedQuestions[qNum]

            return (
              <div
                key={qNum}
                className={`w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                  isNoted
                    ? 'bg-[#f59e0b] text-black border-amber-600'
                    : isAnswered
                    ? 'bg-[#555555] text-white border-[#333333]'
                    : 'bg-white text-slate-800 border-slate-400'
                }`}
              >
                {qNum}
              </div>
            )
          })}
        </div>

        {/* Nội dung cảnh báo kết thúc phần thi đúng 100% Ảnh 4 HSA */}
        <div className="flex-1 flex flex-col justify-end p-6 md:p-8 text-center pb-12">
          {unansweredNumbers ? (
            <p className="text-[12px] text-red-600 font-semibold mb-2">
              Bạn chưa làm câu: {unansweredNumbers}
            </p>
          ) : (
            <p className="text-[12px] text-green-700 font-semibold mb-2">
              Bạn đã hoàn thành tất cả {questions.length} câu hỏi của bài thi!
            </p>
          )}

          <p className="text-[12px] text-slate-800 font-normal mb-1">
            Khi đã kết thúc bài thi, bạn sẽ không quay lại làm bài được nữa.
          </p>
          <p className="text-[12px] text-slate-800 font-bold mb-4">
            Bạn chắc chắn KẾT THÚC bài thi này?
          </p>

          {/* 2 nút Có và Không đúng màu sắc Ảnh 4 HSA */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitExam}
              className="px-6 py-1 bg-[#5b9bd5] hover:bg-[#4885c2] text-white text-xs font-bold border border-[#4885c2] rounded-xs cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Đang nộp...' : 'Có'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setScreenStage('exam')}
              className="px-6 py-1 bg-[#5b9bd5] hover:bg-[#4885c2] text-white text-xs font-bold border border-[#4885c2] rounded-xs cursor-pointer shadow-xs"
            >
              Không
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH KẾT QUẢ: BẢNG ĐIỂM CHUẨN HSA
  // ==========================================================================
  if (screenStage === 'result' && vnuResult) {
    return (
      <div className="w-screen h-screen bg-white p-4 md:p-8 flex items-center justify-center font-sans select-none overflow-y-auto">
        <div className="w-full max-w-4xl border border-[#b8b8b8] shadow-lg p-6 md:p-8 flex flex-col bg-white">
          <div className="text-center pb-4 border-b border-slate-300 mb-6">
            <img src="/vnu-idt-logo.png" alt="VNU IDT" className="w-16 h-16 object-contain mx-auto mb-2" />
            <h1 className="text-lg md:text-xl font-bold uppercase text-slate-800 tracking-wider">
              KẾT QUẢ BÀI THI VNU TEST (ĐHQGHN)
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase">
              {exam?.title} • MÔN: {exam?.subject || 'TỔNG HỢP'}
            </p>
          </div>

          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-[#e6e6e6] border-b border-slate-300 text-slate-700 font-bold">
                  <th className="p-2.5 text-left border-r border-slate-300">Nội dung bài thi</th>
                  <th className="p-2.5 text-center border-r border-slate-300">Số câu đúng</th>
                  <th className="p-2.5 text-center border-r border-slate-300">Điểm số (Thang 10)</th>
                  <th className="p-2.5 text-center">Thang điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2.5 border-r border-slate-300 font-medium">
                    Toàn bộ bài thi VNU TEST (Chung 1 phần)
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold text-blue-700">
                    {vnuResult.correctCount}/{vnuResult.totalCount}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold">
                    {vnuResult.totalScore}
                  </td>
                  <td className="p-2.5 text-center text-slate-500">10</td>
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className="p-3 border-r border-slate-300 uppercase">TỔNG ĐIỂM CHUNG TOÀN BÀI THI</td>
                  <td className="p-3 border-r border-slate-300 text-center text-emerald-700">
                    {vnuResult.correctCount}/{vnuResult.totalCount} ({Math.round((vnuResult.correctCount / vnuResult.totalCount) * 100)}%)
                  </td>
                  <td className="p-3 border-r border-slate-300 text-center text-red-600 text-base">
                    {vnuResult.totalScore}
                  </td>
                  <td className="p-3 text-center text-slate-700">10</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setScreenStage('welcome')
                setTimeLeft(examDurationMinutes * 60)
                setAnswers({})
                setNotedQuestions({})
              }}
              className="px-6 py-2 bg-[#5c9d5f] hover:bg-[#4d8650] text-white text-xs font-bold rounded-xs cursor-pointer"
            >
              Làm lại bài thi
            </button>
            <Link
              href="/new-sen-ground?tab=history"
              className="px-6 py-2 bg-[#2d6a36] hover:bg-[#23532a] text-white text-xs font-bold rounded-xs cursor-pointer inline-flex items-center gap-1"
            >
              Xem lịch sử bài thi
            </Link>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-6 py-2 bg-[#5b9bd5] hover:bg-[#4885c2] text-white text-xs font-bold rounded-xs cursor-pointer"
              >
                Rời phòng thi
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH THI CHÍNH THỨC HSA (Images 2 & 3): FULLSCREEN 100% CỬA SỔ
  // ==========================================================================
  return (
    <div className="w-screen h-screen bg-white flex flex-col font-sans select-none overflow-hidden">
      {/* ================= HEADER BAR (ĐÚNG CHUẨN MÀU SẮC HSA) ================= */}
      <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-3 md:px-4 py-2 flex items-center justify-between shrink-0">
        {/* Bên trái: Logo VNU IDT + Biểu tượng ô vuông + Số 1 màu xanh lá */}
        <div className="flex items-center gap-2">
          <img src="/vnu-idt-logo.png" alt="VNU IDT" className="w-6 h-6 object-contain" />
          <span className="text-[11px] font-bold text-[#2d6a36] uppercase tracking-wide hidden sm:inline">
            VNU - IDT
          </span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 border border-black bg-slate-300 flex items-center justify-center text-[9px] font-bold">
              ▶
            </div>
            <span className="text-green-700 font-bold text-base ml-1">1</span>
          </div>
        </div>

        {/* Ở giữa: Tiêu đề đề thi & Huy hiệu tên môn thi */}
        <div className="text-center">
          <div className="text-[11px] md:text-[12px] font-bold text-[#555555] uppercase">
            {exam?.title || 'BÀI THI CHUẨN VNU TEST (ĐHQGHN)'}
          </div>
          <div className="inline-block bg-[#5b9bd5] text-white px-3 py-0.5 text-[10px] md:text-[11px] font-bold uppercase mt-0.5">
            {exam?.subject ? `MÔN: ${String(exam.subject).toUpperCase()}` : 'VNU TEST - BÀI THI TỔNG HỢP'}
          </div>
        </div>

        {/* Bên phải: Nút Toàn màn hình + Đồng hồ đếm ngược đỏ + User icon + Nút Nộp bài */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={triggerFullscreen}
            className="hidden sm:flex items-center gap-1 text-[10px] text-slate-600 hover:text-black border border-slate-300 bg-white px-2 py-0.5 rounded-xs"
            title="Bật / Tắt Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>Toàn màn hình</span>
          </button>

          <div className="text-red-600 font-bold font-mono text-base md:text-lg">
            {formatSeconds(timeLeft)}
          </div>
          <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
            <User className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={() => setScreenStage('warning_end')}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-xs uppercase tracking-wider cursor-pointer shadow-xs"
            title="Nộp bài thi VNU TEST"
          >
            NỘP BÀI
          </button>
        </div>
      </div>

      {/* ================= QUESTION BAR: DẢI SỐ CÂU HỎI (CHUẨN HSA) ================= */}
      {/* HIỆN TOÀN BỘ CÂU HỎI 1..N CHUNG 1 PHẦN DUY NHẤT */}
      <div className="w-full bg-[#f0f0f0] border-b border-[#cccccc] px-3 py-1.5 overflow-x-auto flex gap-1 items-center shrink-0">
        {questions.map((q) => {
          const qNum = q.number
          const isAnswered = answers[String(qNum)] !== undefined && answers[String(qNum)] !== ''
          const isViewing = currentQuestionNumber === qNum
          const isNoted = notedQuestions[qNum]

          return (
            <button
              key={qNum}
              type="button"
              onClick={() => scrollToQuestion(qNum)}
              className={`w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border cursor-pointer transition ${
                isNoted
                  ? 'bg-[#f59e0b] text-black border-amber-600 ring-2 ring-amber-300 font-black'
                  : isViewing
                  ? 'ring-2 ring-blue-600 ring-offset-0.5 bg-[#555555] text-white'
                  : isAnswered
                  ? 'bg-[#555555] text-white border-[#333333]'
                  : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-100'
              }`}
              title={`Chuyển tới Câu ${qNum} ${isNoted ? '(Đã bôi vàng)' : ''}`}
            >
              {qNum}
            </button>
          )
        })}
      </div>

      {/* ================= DANH SÁCH CÂU HỎI CUỘN LIÊN TỤC CHUẨN HSA ================= */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
        {questions.map((q) => {
          const isNoted = notedQuestions[q.number]
          return (
            <div
              key={q.id || q.number}
              id={`vnu-q-item-${q.number}`}
              onClick={() => setCurrentQuestionNumber(q.number)}
              className={`pb-5 border-b border-slate-200 last:border-b-0 p-2 rounded-xs transition ${
                isNoted ? 'bg-amber-50/60 border-l-4 border-l-amber-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-2">
                <div className="flex items-start gap-1.5 flex-1">
                  <span className="bg-[#2d6a36] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-xs shrink-0">
                    Câu {q.number}.
                  </span>
                  <div className="text-xs md:text-[13px] font-bold text-slate-900 leading-snug flex-1">
                    <SafeMathRenderer content={q.text} />
                  </div>
                </div>

                {/* Nút bôi vàng ghi chú làm sau chuẩn HSA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleNoteQuestion(q.number)
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold border shrink-0 transition ${
                    isNoted
                      ? 'bg-amber-400 text-black border-amber-500'
                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-amber-100'
                  }`}
                  title="Bôi vàng để xem lại câu hỏi này sau"
                >
                  {isNoted ? '📌 Bôi vàng' : '☆ Note'}
                </button>
              </div>

              {renderOptions(q)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
