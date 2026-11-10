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

class MarkdownErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
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
      return this.props.fallback || <span className="text-red-500 font-mono text-xs">Lỗi hiển thị công thức</span>
    }
    return this.props.children
  }
}

const SafeMathRenderer = React.memo(
  ({ content, className }: { content: string; className?: string }) => {
    const rawStr = typeof content === 'string' ? content : String(content ?? '')
    const safeContent = preprocessLatexContent(rawStr)

    return (
      <MarkdownErrorBoundary resetKey={safeContent} fallback={<span className="text-xs font-mono">{safeContent}</span>}>
        <div className={`${className || ''} overflow-x-auto max-w-full`}>
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
  // 'welcome': Giao diện chào mừng (hiện môn, số câu, thời gian, chuẩn bị full screen)
  // 'exam': Màn hình làm bài thi chính thức (giao diện HSA 1 phần duy nhất)
  // 'warning_end': Màn hình cảnh báo & kiểm tra câu chưa làm trước khi nộp
  // 'result': Bảng điểm kết quả VNU TEST
  const [screenStage, setScreenStage] = useState<'welcome' | 'exam' | 'warning_end' | 'result'>('welcome')

  // Thời gian làm bài linh hoạt (tự chọn theo đề thi)
  const examDurationMinutes = Number(exam?.duration) > 0 ? Number(exam.duration) : 60
  const [timeLeft, setTimeLeft] = useState<number>(examDurationMinutes * 60)

  // Trạng thái câu hỏi & đáp án
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [notedQuestions, setNotedQuestions] = useState<Record<number, boolean>>({}) // Tính năng bôi vàng (Note)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Kết quả sau khi nộp
  const [examResult, setExamResult] = useState<{
    totalScore: number
    maxScore: number
    correctCount: number
    totalCount: number
    submissionId?: string
  } | null>(null)

  // Bóc tách toàn bộ câu hỏi (CHUNG MỘT PHẦN DUY NHẤT)
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

    // 3. Nếu vẫn chưa có câu hỏi, tạo fallback
    if (list.length === 0) {
      const count = Number(exam?.total_questions) || 40
      list = Array.from({ length: count }).map((_, i) => ({
        id: `vnu_q_${i + 1}`,
        number: i + 1,
        text: `Câu hỏi số ${i + 1} môn ${exam?.subject || 'VNU TEST'}. Chọn phương án đúng nhất.`,
        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        correctAnswer: 'A',
        explanation: `Hướng dẫn giải chi tiết cho câu hỏi ${i + 1}.`,
        points: 1,
        type: 'single_choice',
      }))
    }

    // Đảm bảo số thứ tự câu hỏi từ 1 đến N
    return list.map((q: any, idx: number) => ({
      ...q,
      number: idx + 1,
      options: Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'],
      correctAnswer: q.correctAnswer || q.answer || q.correct_answer || 'A',
      explanation: q.explanation || q.solution || '',
      type: q.type || 'single_choice',
    }))
  }, [exam])

  // Lấy câu hỏi hiện tại
  const currentQuestion = useMemo(() => {
    return questions.find((q) => q.number === currentQuestionNumber) || questions[0]
  }, [questions, currentQuestionNumber])

  // Danh sách các câu chưa làm
  const unansweredQuestions = useMemo(() => {
    return questions.filter((q) => answers[String(q.number)] === undefined || answers[String(q.number)] === '')
  }, [questions, answers])

  // Đếm ngược thời gian làm bài
  useEffect(() => {
    if (screenStage !== 'exam') return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [screenStage])

  // Tự động kích hoạt Toàn màn hình (Full Screen)
  const triggerFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {})
      } else {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => {})
      }
    } catch {}
  }

  // Bắt đầu làm bài từ Màn hình Chào Mừng -> Tự động Full Screen
  const handleStartExamFromWelcome = () => {
    setTimeLeft(examDurationMinutes * 60)
    setCurrentQuestionNumber(1)
    setScreenStage('exam')
    triggerFullscreen()
  }

  // Bật / tắt đánh dấu câu hỏi làm sau (Note vàng kiểu HSA)
  const toggleNoteQuestion = (qNum: number) => {
    setNotedQuestions((prev) => ({
      ...prev,
      [qNum]: !prev[qNum],
    }))
  }

  // Chọn đáp án
  const handleSelectAnswer = (qNum: number, value: any) => {
    setAnswers((prev) => {
      const next = { ...prev, [String(qNum)]: value }
      try {
        localStorage.setItem(`vnu_test_ans_${exam?.id || 'temp'}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Nộp bài và tính điểm VNU TEST
  const handleSubmitExam = async () => {
    setSubmitting(true)
    try {
      let correct = 0
      questions.forEach((q) => {
        const studentAns = answers[String(q.number)]
        if (studentAns && String(studentAns).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()) {
          correct++
        }
      })

      const total = questions.length || 1
      const rawScore = (correct / total) * 10
      const finalScore = parseFloat(rawScore.toFixed(2))

      setExamResult({
        totalScore: finalScore,
        maxScore: 10,
        correctCount: correct,
        totalCount: total,
      })

      // Lưu submission lên Supabase nếu có user
      if (studentInfo.id || studentInfo.email) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          const userId = studentInfo.id || user?.id
          if (userId && exam?.id) {
            await supabase.from('submissions').insert([
              {
                exam_id: exam.id,
                user_id: userId,
                score: finalScore,
                correct_count: correct,
                total_questions: total,
                answers: answers,
                created_at: new Date().toISOString(),
              },
            ])
          }
        } catch (e) {
          console.warn('Lỗi lưu submission VNU TEST vào Supabase:', e)
        }
      }

      setScreenStage('result')
    } catch (err) {
      console.error('VNU TEST submit error:', err)
      setScreenStage('result')
    } finally {
      setSubmitting(false)
    }
  }

  // Định dạng thời gian MM:SS
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ==========================================================================
  // GIAI ĐOẠN 1: GIAO DIỆN CHÀO MỪNG (HIỆN TÊN MÔN, SỐ CÂU, THỜI GIAN, FULLSCREEN)
  // ==========================================================================
  if (screenStage === 'welcome') {
    return (
      <div className="w-screen h-screen bg-[#f3f4f6] flex items-center justify-center font-sans p-4 select-none">
        <div className="w-full max-w-2xl bg-white border border-[#b8b8b8] shadow-2xl p-6 md:p-8 flex flex-col justify-between">
          <div>
            {/* Header Chào mừng VNU TEST */}
            <div className="text-center pb-4 border-b border-slate-300">
              <div className="inline-block bg-[#003366] text-white px-3 py-0.5 text-xs font-bold uppercase tracking-widest mb-2 shadow-xs">
                HỆ THỐNG KHẢO THÍ CHUẨN HÓA • VNU TEST
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight leading-snug">
                {exam?.title || 'BÀI KIỂM TRA ĐÁNH GIÁ NĂNG LỰC VNU TEST'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Kỳ thi Đánh giá năng lực chuyên biệt ĐHQGHN • Giao diện khảo thí tập trung 1 phần duy nhất
              </p>
            </div>

            {/* 3 THÔNG SỐ CỐT LÕI YÊU CẦU: TÊN MÔN, SỐ CÂU, THỜI GIAN LÀM BÀI */}
            <div className="grid grid-cols-3 gap-3 my-6">
              <div className="border border-sky-300 bg-sky-50/70 p-3.5 text-center">
                <span className="text-[11px] font-bold text-sky-800 uppercase block">Môn thi</span>
                <strong className="text-base md:text-lg text-[#003366] font-black block mt-0.5 truncate">
                  {exam?.subject || 'Đa môn VNU'}
                </strong>
              </div>

              <div className="border border-amber-300 bg-amber-50/70 p-3.5 text-center">
                <span className="text-[11px] font-bold text-amber-800 uppercase block">Số câu hỏi</span>
                <strong className="text-base md:text-lg text-amber-900 font-black block mt-0.5">
                  {questions.length} câu
                </strong>
              </div>

              <div className="border border-red-300 bg-red-50/70 p-3.5 text-center">
                <span className="text-[11px] font-bold text-red-800 uppercase block">Thời gian làm bài</span>
                <strong className="text-base md:text-lg text-red-600 font-black block mt-0.5">
                  {examDurationMinutes} phút
                </strong>
              </div>
            </div>

            {/* Thông tin thí sinh & Quy chế làm bài */}
            <div className="bg-[#f8f9fa] border border-slate-300 p-4 space-y-2 text-xs text-slate-700 leading-relaxed mb-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Thí sinh: <strong>{studentInfo.name.toUpperCase()}</strong></span>
                <span>Mã số: <strong>{studentInfo.studentId || exam?.access_code || 'VNU-2026-ONLINE'}</strong></span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Bài thi diễn ra trong <strong>1 phần duy nhất</strong> từ câu 1 đến câu {questions.length}.</li>
                <li>Bạn có thể tự do di chuyển qua lại giữa các câu hỏi, thay đổi câu trả lời hoặc bôi vàng (Note) để làm sau.</li>
                <li>Khi bấm nút <strong>BẮT ĐẦU LÀM BÀI</strong>, hệ thống sẽ tự động kích hoạt chế độ <strong>Toàn màn hình (Full Screen)</strong> và tính giờ làm bài.</li>
              </ul>
            </div>
          </div>

          {/* Nút Bắt đầu làm bài & Thoát */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (onExit) onExit()
                else router.push('/new-sen-ground')
              }}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer border border-slate-300 transition"
            >
              Quay lại kho đề
            </button>

            <button
              type="button"
              onClick={handleStartExamFromWelcome}
              className="px-8 py-2.5 bg-[#003366] hover:bg-[#002244] text-white font-black text-xs uppercase tracking-wider cursor-pointer border border-[#001933] shadow-md transition flex items-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>BẮT ĐẦU LÀM BÀI (FULL SCREEN)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // GIAI ĐOẠN 3: MÀN HÌNH CẢNH BÁO TRƯỚC KHI NỘP BÀI (WARNING END)
  // ==========================================================================
  if (screenStage === 'warning_end') {
    const unansweredNumbers = unansweredQuestions.map((q) => q.number).join(', ')

    return (
      <div className="w-screen h-screen bg-white flex flex-col font-sans select-none overflow-hidden">
        {/* Header xám chuẩn HSA */}
        <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-blue-600 bg-white flex items-center justify-center text-[10px] text-blue-700 font-bold">
              ✓
            </div>
            <span className="text-[#003366] font-bold text-sm">VNU TEST</span>
          </div>

          <div className="text-center">
            <div className="text-[11px] font-bold text-[#555555] uppercase">
              {exam?.title || 'BÀI KIỂM TRA ĐÁNH GIÁ NĂNG LỰC VNU TEST'}
            </div>
            <div className="inline-block bg-[#003366] text-white px-2 py-0.5 text-[10px] font-bold uppercase mt-0.5">
              MÔN: {exam?.subject || 'TỔNG HỢP'} • {questions.length} CÂU
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
            const isAnswered = answers[String(q.number)] !== undefined && answers[String(q.number)] !== ''
            const isNoted = notedQuestions[q.number]

            return (
              <div
                key={q.number}
                className={`w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                  isNoted
                    ? 'bg-[#f59e0b] text-black border-amber-600'
                    : isAnswered
                    ? 'bg-[#555555] text-white border-[#333333]'
                    : 'bg-white text-slate-800 border-slate-400'
                }`}
              >
                {q.number}
              </div>
            )
          })}
        </div>

        {/* Nội dung xác nhận nộp bài */}
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
            Khi đã nộp bài, hệ thống sẽ tính điểm và bạn không thể chỉnh sửa đáp án được nữa.
          </p>
          <p className="text-[12px] text-slate-800 font-bold mb-4">
            Bạn có chắc chắn muốn NỘP BÀI và kết thúc bài thi VNU TEST?
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitExam}
              className="px-6 py-1.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold border border-[#001933] rounded-xs cursor-pointer shadow-xs"
            >
              {submitting ? 'Đang chấm điểm...' : 'Có, nộp bài'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setScreenStage('exam')}
              className="px-6 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold border border-slate-300 rounded-xs cursor-pointer shadow-xs"
            >
              Không, làm tiếp
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // GIAI ĐOẠN 4: MÀN HÌNH KẾT QUẢ VNU TEST
  // ==========================================================================
  if (screenStage === 'result' && examResult) {
    return (
      <div className="w-screen h-screen bg-white p-4 md:p-8 flex items-center justify-center font-sans select-none overflow-y-auto">
        <div className="w-full max-w-3xl border border-[#b8b8b8] shadow-lg p-6 md:p-8 flex flex-col bg-white">
          <div className="text-center pb-4 border-b border-slate-300 mb-6">
            <h1 className="text-lg md:text-xl font-bold uppercase text-slate-800 tracking-wider">
              KẾT QUẢ BÀI THI ĐÁNH GIÁ NĂNG LỰC VNU TEST
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Hệ thống Khảo thí ĐHQGHN • Bài thi 1 phần tập trung
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-300 p-4 mb-6 text-xs text-slate-800 space-y-1">
            <p>Thí sinh: <strong>{studentInfo.name.toUpperCase()}</strong></p>
            <p>Môn thi: <strong>{exam?.subject || 'Đa môn VNU TEST'}</strong></p>
            <p>Đề thi: <strong>{exam?.title || 'Đề thi VNU TEST'}</strong></p>
          </div>

          <div className="border border-slate-300 mb-6 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#e6e6e6] border-b border-slate-300 text-slate-800 font-bold">
                  <th className="p-2.5 border-r border-slate-300">Nội dung</th>
                  <th className="p-2.5 border-r border-slate-300 text-center">Số câu đúng</th>
                  <th className="p-2.5 border-r border-slate-300 text-center">Điểm số (Thang 10)</th>
                  <th className="p-2.5 text-center">Tỷ lệ chính xác</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-amber-50/50 font-bold">
                  <td className="p-3 border-r border-slate-300 uppercase">TOÀN BỘ BÀI KIỂM TRA VNU TEST</td>
                  <td className="p-3 border-r border-slate-300 text-center text-emerald-700">
                    {examResult.correctCount}/{examResult.totalCount}
                  </td>
                  <td className="p-3 border-r border-slate-300 text-center text-red-600 text-base">
                    {examResult.totalScore}
                  </td>
                  <td className="p-3 text-center text-slate-700">
                    {Math.round((examResult.correctCount / examResult.totalCount) * 100)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setScreenStage('welcome')
                setTimeLeft(examDurationMinutes * 60)
                setAnswers({})
                setNotedQuestions({})
                setCurrentQuestionNumber(1)
              }}
              className="px-6 py-2 bg-[#5c9d5f] hover:bg-[#4d8650] text-white text-xs font-bold rounded-xs cursor-pointer"
            >
              Làm lại bài thi
            </button>
            <button
              type="button"
              onClick={() => {
                if (onExit) onExit()
                else router.push('/new-sen-ground')
              }}
              className="px-6 py-2 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-xs cursor-pointer"
            >
              Rời phòng thi
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // GIAI ĐOẠN 2: MÀN HÌNH LÀM BÀI CHÍNH THỨC (GIỐNG HỆT HSA NHƯNG 1 PHẦN DUY NHẤT)
  // ==========================================================================
  const isNoted = notedQuestions[currentQuestionNumber]

  return (
    <div className="w-screen h-screen bg-white flex flex-col font-sans select-none overflow-hidden">
      {/* 1. HEADER BAR CHUẨN HSA */}
      <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-3 md:px-4 py-2 flex items-center justify-between shrink-0">
        {/* Bên trái: Biểu trưng VNU TEST */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-blue-600 bg-white flex items-center justify-center text-[10px] text-blue-700 font-bold">
            ✓
          </div>
          <span className="text-[#003366] font-black text-sm tracking-wide">VNU TEST</span>
        </div>

        {/* Ở giữa: Tiêu đề đề thi & Môn thi */}
        <div className="text-center">
          <div className="text-[11px] md:text-[12px] font-bold text-[#555555] uppercase truncate max-w-md">
            {exam?.title || 'BÀI KIỂM TRA ĐÁNH GIÁ NĂNG LỰC VNU TEST'}
          </div>
          <div className="inline-block bg-[#003366] text-white px-3 py-0.5 text-[10px] md:text-[11px] font-bold uppercase mt-0.5">
            MÔN: {exam?.subject || 'TỔNG HỢP'} • {questions.length} CÂU
          </div>
        </div>

        {/* Bên phải: Đồng hồ đếm ngược đỏ + User + Toàn màn hình + Nộp bài */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={triggerFullscreen}
            className="hidden sm:flex items-center gap-1 text-[10px] text-slate-600 hover:text-black border border-slate-300 bg-white px-2 py-0.5 rounded-xs cursor-pointer"
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
            title="Nộp bài và kết thúc"
          >
            NỘP BÀI
          </button>
        </div>
      </div>

      {/* 2. DẢI SỐ CÂU HỎI KIỂU HSA (1 PHẦN DUY NHẤT TOÀN BỘ CÂU HỎI) */}
      <div className="w-full bg-[#f0f0f0] border-b border-[#cccccc] px-2 py-1.5 flex items-center gap-1 shrink-0 overflow-hidden">
        {/* Nút điều hướng đầu/trước */}
        <button
          type="button"
          onClick={() => setCurrentQuestionNumber(1)}
          className="w-5 h-5 border border-slate-400 bg-white text-[9px] font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer shrink-0"
          title="Về câu đầu tiên"
        >
          ◀◀
        </button>
        <button
          type="button"
          onClick={() => setCurrentQuestionNumber((prev) => Math.max(1, prev - 1))}
          className="w-5 h-5 border border-slate-400 bg-white text-[9px] font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer shrink-0"
          title="Câu trước"
        >
          ◀
        </button>

        {/* Dải số tròn cuộn ngang */}
        <div className="flex-1 overflow-x-auto flex gap-1 items-center px-1 scrollbar-none py-0.5">
          {questions.map((q) => {
            const isCurrent = q.number === currentQuestionNumber
            const isAnswered = answers[String(q.number)] !== undefined && answers[String(q.number)] !== ''
            const qNoted = notedQuestions[q.number]

            return (
              <button
                key={q.number}
                type="button"
                onClick={() => setCurrentQuestionNumber(q.number)}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border cursor-pointer transition ${
                  isCurrent
                    ? 'ring-2 ring-[#003366] bg-[#003366] text-white border-[#003366] scale-110 shadow-xs'
                    : qNoted
                    ? 'bg-[#f59e0b] text-black border-amber-600 font-black'
                    : isAnswered
                    ? 'bg-[#555555] text-white border-[#333333]'
                    : 'bg-white text-slate-800 border-slate-400 hover:border-black'
                }`}
                title={`Câu ${q.number} ${isAnswered ? '(Đã làm)' : '(Chưa làm)'} ${qNoted ? '[Đã Note]' : ''}`}
              >
                {q.number}
              </button>
            )
          })}
        </div>

        {/* Nút điều hướng sau/cuối */}
        <button
          type="button"
          onClick={() => setCurrentQuestionNumber((prev) => Math.min(questions.length, prev + 1))}
          className="w-5 h-5 border border-slate-400 bg-white text-[9px] font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer shrink-0"
          title="Câu tiếp theo"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setCurrentQuestionNumber(questions.length)}
          className="w-5 h-5 border border-slate-400 bg-white text-[9px] font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer shrink-0"
          title="Đến câu cuối cùng"
        >
          ▶▶
        </button>
      </div>

      {/* 3. NỘI DUNG CÂU HỎI CHÍNH (GIAO DIỆN CHUẨN HSA CỔ ĐIỂN) */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden p-4 md:p-6">
        {/* Thanh công cụ câu hỏi: Số câu & Nút Bôi vàng (Note) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-slate-900">
              Câu {currentQuestionNumber}:
            </span>
            {isNoted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                ★ Đã đánh dấu xem lại sau
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => toggleNoteQuestion(currentQuestionNumber)}
            className={`px-3 py-1 text-xs font-bold rounded-xs border flex items-center gap-1.5 cursor-pointer transition ${
              isNoted
                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="Bôi vàng lại câu hỏi để làm sau"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isNoted ? 'fill-black' : ''}`} />
            <span>{isNoted ? 'Bỏ bôi vàng (Note)' : 'Bôi vàng câu hỏi (Note)'}</span>
          </button>
        </div>

        {/* Nội dung đề thi KaTeX cuộn nếu dài */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Đề câu hỏi */}
          <div className="text-sm md:text-base leading-relaxed text-slate-900 font-serif">
            <SafeMathRenderer content={currentQuestion.text || ''} />
          </div>

          {/* Các phương án lựa chọn A, B, C, D */}
          {currentQuestion.type === 'short_answer' ? (
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-none space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Điền đáp án câu trả lời ngắn:
              </label>
              <input
                type="text"
                placeholder="Nhập đáp án số hoặc chữ..."
                value={answers[String(currentQuestionNumber)] || ''}
                onChange={(e) => handleSelectAnswer(currentQuestionNumber, e.target.value)}
                className="w-full max-w-xs h-10 px-3 border border-slate-400 bg-white text-sm font-bold outline-none focus:border-[#003366]"
              />
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((opt: string, optIdx: number) => {
                const optLetter = String.fromCharCode(65 + optIdx) // A, B, C, D
                const isChecked = answers[String(currentQuestionNumber)] === optLetter

                return (
                  <label
                    key={optIdx}
                    className={`flex items-start gap-3 p-3 border transition cursor-pointer ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`vnu_question_${currentQuestionNumber}`}
                      checked={isChecked}
                      onChange={() => handleSelectAnswer(currentQuestionNumber, optLetter)}
                      className="mt-1 h-4 w-4 text-[#003366] cursor-pointer"
                    />
                    <div className="flex-1 text-xs md:text-sm text-slate-800">
                      <span className="font-bold mr-1.5">{optLetter}.</span>
                      <SafeMathRenderer content={opt} className="inline-block" />
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Thanh chân trang điều hướng câu hỏi */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentQuestionNumber <= 1}
            onClick={() => setCurrentQuestionNumber((prev) => Math.max(1, prev - 1))}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 text-xs font-bold cursor-pointer border border-slate-300"
          >
            ◀ Câu trước
          </button>

          <div className="text-xs font-bold text-slate-600">
            Câu {currentQuestionNumber} / {questions.length}
          </div>

          <button
            type="button"
            disabled={currentQuestionNumber >= questions.length}
            onClick={() => setCurrentQuestionNumber((prev) => Math.min(questions.length, prev + 1))}
            className="px-4 py-1.5 bg-[#003366] hover:bg-[#002244] disabled:opacity-40 text-white text-xs font-bold cursor-pointer border border-[#001933]"
          >
            Câu tiếp theo ▶
          </button>
        </div>
      </div>
    </div>
  )
}
