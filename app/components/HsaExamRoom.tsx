'use client'

import React, { useState, useEffect, useMemo, useRef, Component } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { preprocessLatexContent } from '@/lib/latexExamParser'
import TikzRenderer from '@/app/components/TikzRenderer'
import {
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  FileText,
  User,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

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
    console.warn('LaTeX Markdown render error in HSA room:', error)
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
              // Render hình vẽ TikZ tự động
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

export interface HsaExamRoomProps {
  exam: any
  studentInfo: {
    name: string
    email: string
    avatar?: string | null
    school?: string
    grade?: string
  }
  isMobileView?: boolean
  onExit?: () => void
}

// 12 TỔ HỢP TỰ CHỌN CHUẨN HSA ĐHQGHN (Phần 3 - Image 5)
const HSA_SUBJECT_COMBINATIONS = [
  { id: 'combo_1', code: 'Q01', name: 'LÍ - HÓA - SINH (TỰ CHỌN)', subjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
  { id: 'combo_2', code: 'Q02', name: 'LÍ - HÓA - SỬ (TỰ CHỌN)', subjects: ['Vật lí', 'Hóa học', 'Lịch sử'] },
  { id: 'combo_3', code: 'Q03', name: 'LÍ - HÓA - ĐỊA (TỰ CHỌN)', subjects: ['Vật lí', 'Hóa học', 'Địa lí'] },
  { id: 'combo_4', code: 'Q04', name: 'LÍ - SINH - SỬ (TỰ CHỌN)', subjects: ['Vật lí', 'Sinh học', 'Lịch sử'] },
  { id: 'combo_5', code: 'Q05', name: 'LÍ - SINH - ĐỊA (TỰ CHỌN)', subjects: ['Vật lí', 'Sinh học', 'Địa lí'] },
  { id: 'combo_6', code: 'Q06', name: 'HÓA - SINH - SỬ (TỰ CHỌN)', subjects: ['Hóa học', 'Sinh học', 'Lịch sử'] },
  { id: 'combo_7', code: 'Q07', name: 'HÓA - SINH - ĐỊA (TỰ CHỌN)', subjects: ['Hóa học', 'Sinh học', 'Địa lí'] },
  { id: 'combo_8', code: 'Q08', name: 'SỬ - ĐỊA - LÍ (TỰ CHỌN)', subjects: ['Lịch sử', 'Địa lí', 'Vật lí'] },
  { id: 'combo_9', code: 'Q09', name: 'SỬ - ĐỊA - HÓA (TỰ CHỌN)', subjects: ['Lịch sử', 'Địa lí', 'Hóa học'] },
  { id: 'combo_10', code: 'Q10', name: 'SỬ - ĐỊA - SINH (TỰ CHỌN)', subjects: ['Lịch sử', 'Địa lí', 'Sinh học'] },
  { id: 'combo_11', code: 'Q11', name: 'TIẾNG ANH (TỰ CHỌN)', subjects: ['Tiếng Anh'] },
  { id: 'combo_12', code: 'Q12', name: 'KHOA HỌC TỰ NHIÊN TOÀN DIỆN', subjects: ['Khoa học Tự nhiên'] },
]

export default function HsaExamRoom({
  exam,
  studentInfo,
  isMobileView = false,
  onExit,
}: HsaExamRoomProps) {
  // Trạng thái màn hình:
  // 'transition': Màn hình chờ 120s trước phần thi (Image 1)
  // 'exam': Màn hình làm bài thi chính thức (Image 2 & Image 3)
  // 'warning_end': Màn hình nhắc nhở kết thúc phần thi (Image 4)
  // 'choose_combo': Màn hình lựa chọn tổ hợp phần 3 (Image 5)
  // 'result': Bảng điểm kết quả chuẩn HSA
  const [screenStage, setScreenStage] = useState<'transition' | 'exam' | 'warning_end' | 'choose_combo' | 'result'>('transition')

  // Chỉ số phần thi hiện tại: 0 (P1: Định lượng), 1 (P2: Định tính), 2 (P3: Khoa học / Tiếng Anh)
  const [currentPartIdx, setCurrentPartIdx] = useState<number>(0)

  // Thời gian đếm ngược 120 giây giữa các phần thi (Image 1)
  const [transitionTimeLeft, setTransitionTimeLeft] = useState<number>(120)

  // Thời gian đếm ngược của phần thi hiện tại (giây)
  const [partTimeLeft, setPartTimeLeft] = useState<number>(75 * 60)

  // Quản lý câu hỏi & đáp án
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Tổ hợp được chọn cho Phần 3
  const [selectedComboId, setSelectedComboId] = useState<string>('combo_1')

  // Bảng điểm kết quả
  const [hsaResult, setHsaResult] = useState<{
    scoreP1: number
    scoreP2: number
    scoreP3: number
    totalScore: number
    correctCount: number
    totalCount: number
    sectionScores: { name: string; score: number; maxScore: number; correct: number; total: number }[]
    submissionId?: string
  } | null>(null)

  // Bóc tách cấu trúc đề thi từ database
  const parsedSections = useMemo(() => {
    if (!exam?.exam_structure) return []
    let struct = exam.exam_structure
    if (typeof struct === 'string') {
      try {
        struct = JSON.parse(struct)
      } catch {
        struct = []
      }
    }
    if (!Array.isArray(struct)) {
      if (struct && typeof struct === 'object' && Array.isArray(struct.sections)) {
        struct = struct.sections
      } else {
        return []
      }
    }
    return struct
  }, [exam])

  // Chuẩn hóa 3 phần thi HSA
  const hsaParts = useMemo(() => {
    const p1Raw = parsedSections[0] || {}
    let p1Questions = Array.isArray(p1Raw.questions) ? p1Raw.questions : []
    if (p1Questions.length === 0 && Array.isArray(exam?.questions)) {
      p1Questions = exam.questions.slice(0, 50)
    }

    const p2Raw = parsedSections[1] || {}
    let p2Questions = Array.isArray(p2Raw.questions) ? p2Raw.questions : []
    if (p2Questions.length === 0 && Array.isArray(exam?.questions) && exam.questions.length > 50) {
      p2Questions = exam.questions.slice(50, 100)
    }

    const p3Raw = parsedSections[2] || {}
    let p3Questions = Array.isArray(p3Raw.questions) ? p3Raw.questions : []
    if (p3Questions.length === 0 && Array.isArray(exam?.questions) && exam.questions.length > 100) {
      p3Questions = exam.questions.slice(100, 150)
    }

    const createPlaceholderQuestions = (startNum: number, count: number, sectionName: string) => {
      return Array.from({ length: count }).map((_, i) => {
        const num = startNum + i
        return {
          id: `hsa_q_${num}`,
          number: num,
          text: `Câu hỏi số ${num} thuộc ${sectionName}. Hãy chọn một đáp án đúng nhất.`,
          options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
          correctAnswer: 'A',
          explanation: `Giải thích chi tiết cho câu hỏi ${num}.`,
          points: 1,
          type: num % 10 === 0 ? 'short_answer' : 'single_choice',
        }
      })
    }

    const finalP1Questions =
      p1Questions.length > 0
        ? p1Questions.map((q: any, i: number) => ({ ...q, number: i + 1 }))
        : createPlaceholderQuestions(1, 50, 'Phần 1: Tư duy định lượng (Toán học)')

    const finalP2Questions =
      p2Questions.length > 0
        ? p2Questions.map((q: any, i: number) => ({
            ...q,
            number: 50 + i + 1,
            passage:
              q.passage ||
              (i >= 30 && i <= 34
                ? 'Câu 81 - 85:\n\nĐọc đoạn trích dưới đây và trả lời 5 câu hỏi tiếp theo.\n\nMột đảo nhỏ xa xôi ngoài biển rộng\nVẫn tiếng làng tiếng nước của riêng ta\nTiếng chẳng mất khi Loa thành đã mất\nNàng Mỵ Châu quỳ xuống lạy cha già\nTiếng thao thức lòng trai ôm ngọc sáng\nDưới cát vùi sóng dập chẳng hề nguôi\nTiếng tủi cực kẻ ăn cầu ngủ quán\nThành Nguyễn Du văng vặc nỗi thương đời\nTrái đất rộng giàu sang bao thứ tiếng\nCao quý thâm trầm rực rỡ vui tươi\nTiếng Việt rung rinh nhịp đập trái tim người\nNhư tiếng sáo như dây đàn máu nhỏ\n\n(Lưu Quang Vũ, "Tiếng Việt", Gió và tình yêu thổi trên đất nước tôi, Nxb Hội Nhà văn, HN, 2010, tr. 104)'
                : undefined),
          }))
        : createPlaceholderQuestions(51, 50, 'Phần 2: Tư duy định tính (Ngữ văn)')

    const finalP3Questions =
      p3Questions.length > 0
        ? p3Questions.map((q: any, i: number) => ({ ...q, number: 100 + i + 1 }))
        : createPlaceholderQuestions(101, 50, 'Phần 3: Khoa học / Ngoại ngữ')

    return [
      {
        partId: 1,
        title: 'TOÁN HỌC VÀ XỬ LÝ SỐ LIỆU (TƯ DUY ĐỊNH LƯỢNG)',
        shortTitle: 'TƯ DUY ĐỊNH LƯỢNG',
        durationMinutes: 75,
        maxScore: 50,
        startNumber: 1,
        endNumber: 50,
        questions: finalP1Questions,
      },
      {
        partId: 2,
        title: 'NGÔN NGỮ - VĂN HỌC (TƯ DUY ĐỊNH TÍNH)',
        shortTitle: 'TƯ DUY ĐỊNH TÍNH',
        durationMinutes: 60,
        maxScore: 50,
        startNumber: 51,
        endNumber: 100,
        questions: finalP2Questions,
      },
      {
        partId: 3,
        title: 'KHOA HỌC hoặc TIẾNG ANH',
        shortTitle: 'KHOA HỌC / NGOẠI NGỮ',
        durationMinutes: 60,
        maxScore: 50,
        startNumber: 101,
        endNumber: 150,
        questions: finalP3Questions,
      },
    ]
  }, [parsedSections, exam])

  const currentPart = hsaParts[currentPartIdx] || hsaParts[0]

  // Danh sách các câu hỏi chưa làm trong phần hiện tại (dùng cho modal nhắc nhở)
  const unansweredQuestionsInCurrentPart = useMemo(() => {
    return currentPart.questions.filter((q: any) => {
      const val = answers[String(q.number)]
      return val === undefined || val === null || val === ''
    })
  }, [currentPart, answers])

  // Bộ đếm thời gian cho màn hình chờ 120s (Image 1)
  useEffect(() => {
    if (screenStage !== 'transition') return

    const timer = setInterval(() => {
      setTransitionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleStartCurrentPart()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [screenStage, currentPartIdx])

  // Bộ đếm thời gian cho phần thi đang diễn ra (Image 2)
  useEffect(() => {
    if (screenStage !== 'exam' || partTimeLeft <= 0) return

    const timer = setInterval(() => {
      setPartTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setScreenStage('warning_end')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [screenStage, partTimeLeft])

  // Bắt đầu phần thi hiện tại
  const handleStartCurrentPart = () => {
    setPartTimeLeft(currentPart.durationMinutes * 60)
    setCurrentQuestionNumber(currentPart.startNumber)
    setScreenStage('exam')
  }

  // Xác nhận kết thúc phần thi
  const handleConfirmEndSection = async () => {
    if (currentPartIdx === 0) {
      setCurrentPartIdx(1)
      setTransitionTimeLeft(120)
      setScreenStage('transition')
    } else if (currentPartIdx === 1) {
      setScreenStage('choose_combo')
    } else {
      await handleSubmitFullExam()
    }
  }

  // Bắt đầu Phần 3 sau khi chọn tổ hợp
  const handleStartPart3WithCombo = () => {
    setCurrentPartIdx(2)
    setTransitionTimeLeft(120)
    setScreenStage('transition')
  }

  // Chấm điểm và nộp bài
  const handleSubmitFullExam = async () => {
    setSubmitting(true)
    try {
      let p1Correct = 0
      let p2Correct = 0
      let p3Correct = 0

      hsaParts[0]?.questions.forEach((q: any) => {
        if (answers[String(q.number)] && answers[String(q.number)] === q.correctAnswer) p1Correct++
      })
      hsaParts[1]?.questions.forEach((q: any) => {
        if (answers[String(q.number)] && answers[String(q.number)] === q.correctAnswer) p2Correct++
      })
      hsaParts[2]?.questions.forEach((q: any) => {
        if (answers[String(q.number)] && answers[String(q.number)] === q.correctAnswer) p3Correct++
      })

      const totalCorrect = p1Correct + p2Correct + p3Correct
      const totalScore = p1Correct + p2Correct + p3Correct

      setHsaResult({
        scoreP1: p1Correct,
        scoreP2: p2Correct,
        scoreP3: p3Correct,
        totalScore,
        correctCount: totalCorrect,
        totalCount: 150,
        sectionScores: [
          { name: 'Tư duy định lượng (Toán học)', score: p1Correct, maxScore: 50, correct: p1Correct, total: 50 },
          { name: 'Tư duy định tính (Ngữ văn)', score: p2Correct, maxScore: 50, correct: p2Correct, total: 50 },
          { name: 'Khoa học / Tiếng Anh', score: p3Correct, maxScore: 50, correct: p3Correct, total: 50 },
        ],
      })
      setScreenStage('result')
    } catch (err) {
      console.error('HSA submit error:', err)
      setScreenStage('result')
    } finally {
      setSubmitting(false)
    }
  }

  // Cuộn tới câu hỏi khi bấm vào dải số câu hỏi
  const scrollToQuestion = (qNum: number) => {
    setCurrentQuestionNumber(qNum)
    const el = document.getElementById(`hsa-q-item-${qNum}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // ==========================================================================
  // MÀN HÌNH 1: MÀN HÌNH CHỜ TRƯỚC PHẦN THI ĐỊNH LƯỢNG & ĐỊNH TÍNH (Image 1)
  // ==========================================================================
  if (screenStage === 'transition') {
    return (
      <div className="min-h-screen bg-[#3a6344] p-2 md:p-6 flex items-center justify-center font-sans select-none">
        {/* Khung giao diện cửa sổ màu trắng */}
        <div className="w-full max-w-5xl bg-white border border-[#b8b8b8] shadow-2xl flex flex-col min-h-[580px]">
          {/* Header xám trên cùng */}
          <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-green-600 bg-white flex items-center justify-center text-[10px] text-green-700 font-bold">
                ✓
              </div>
            </div>
            <div className="text-[12px] md:text-[13px] font-bold text-[#555555] uppercase tracking-wide">
              {exam?.title || 'ĐỀ THI THAM KHẢO SỐ 2 - ĐÁNH GIÁ NĂNG LỰC HỌC SINH THPT 2025'}
            </div>
            <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
              <User className="w-5 h-5" />
            </div>
          </div>

          {/* Phần thân căn giữa đúng 100% Ảnh 1 */}
          <div className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-slate-700 font-medium mb-1">Bài thi bao gồm các phần:</p>
            <p className="text-xs font-bold text-[#1a237e] uppercase">
              TOÁN HỌC VÀ XỬ LÝ SỐ LIỆU (TƯ DUY ĐỊNH LƯỢNG)
            </p>
            <p className="text-xs font-bold text-[#1a237e] uppercase">
              NGÔN NGỮ - VĂN HỌC (TƯ DUY ĐỊNH TÍNH)
            </p>
            <p className="text-xs font-bold text-[#1a237e] uppercase mb-3">
              KHOA HỌC hoặc TIẾNG ANH
            </p>

            <p className="text-[11px] text-slate-600 mb-6">
              Bạn phải làm tuần tự các phần thi ở trên và không thể quay lại phần thi đã làm trước đó.
            </p>

            {/* Hàng mũi tên chevron xanh lá cây (Image 1) */}
            <div className="flex items-center gap-3 mb-6 flex-wrap justify-center">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-8 h-8 border-2 border-[#5c9d5f] flex items-center justify-center text-[#5c9d5f] font-bold text-sm bg-white">
                  ▶
                </div>
              ))}
            </div>

            {/* Tiêu đề phần thi chuẩn bị bắt đầu */}
            <h2 className="text-sm md:text-base font-bold text-[#2d6a36] uppercase tracking-wide mb-2">
              {currentPart.title}
            </h2>
            <p className="text-xs text-slate-700 mb-0.5">
              Thời gian hoàn thành phần thi thứ {currentPartIdx + 1}: {currentPart.durationMinutes} phút
            </p>
            <p className="text-xs text-slate-700 mb-6">
              Tổng điểm phần thi: {currentPart.maxScore} điểm
            </p>

            {/* Logo 3 khối vuông lớn: [H] xám, [S] xanh lá, [A] đỏ */}
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-[#666666] flex items-center justify-center text-white text-3xl font-serif font-bold shadow-xs">
                H
              </div>
              <div className="w-16 h-16 bg-[#2d6a36] flex items-center justify-center text-white text-3xl font-serif font-bold shadow-xs">
                S
              </div>
              <div className="w-16 h-16 bg-[#d32f2f] flex items-center justify-center text-white text-3xl font-serif font-bold shadow-xs">
                A
              </div>
            </div>

            <p className="text-[11px] text-slate-700 mb-0.5">
              Phần {currentPartIdx + 1} tự động bắt đầu sau 120 giây.
            </p>
            <p className="text-[11px] text-slate-700 mb-3">
              Nếu đã sẵn sàng, bạn có thể bấm nút &lt;BẮT ĐẦU&gt; dưới đây để bắt đầu phần thi.
            </p>

            {/* Số đếm ngược to màu đỏ thẫm */}
            <div className="text-2xl font-bold text-[#d32f2f] mb-4 font-mono">
              {transitionTimeLeft}
            </div>

            {/* Nút bấm xanh lá cổ điển */}
            <button
              type="button"
              onClick={handleStartCurrentPart}
              className="px-6 py-1.5 bg-[#5c9d5f] hover:bg-[#4d8650] text-white font-bold text-xs rounded-xs border border-[#4d8650] shadow-xs uppercase tracking-wider cursor-pointer"
            >
              BẮT ĐẦU
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH 5: LỰA CHỌN PHẦN THI THỨ 3 (Image 5)
  // ==========================================================================
  if (screenStage === 'choose_combo') {
    return (
      <div className="min-h-screen bg-[#3a6344] p-2 md:p-6 flex items-center justify-center font-sans select-none">
        <div className="w-full max-w-5xl bg-white border border-[#b8b8b8] shadow-2xl flex flex-col min-h-[580px]">
          {/* Header xám trên cùng */}
          <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-green-600 bg-white flex items-center justify-center text-[10px] text-green-700 font-bold">
                ✓
              </div>
            </div>
            <div className="text-[12px] md:text-[13px] font-bold text-[#555555] uppercase tracking-wide">
              {exam?.title || 'ĐỀ THI THAM KHẢO SỐ 2 - ĐÁNH GIÁ NĂNG LỰC HỌC SINH THPT 2025'}
            </div>
            <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
              <User className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 p-6 md:p-8 flex flex-col">
            {/* Hàng biểu tượng hình thoi caro xanh lá (Image 5) */}
            <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-7 h-7 rotate-45 border border-[#2d6a36] bg-[#5c9d5f] flex items-center justify-center">
                  <div className="w-3 h-3 bg-white" />
                </div>
              ))}
            </div>

            <div className="text-center mb-4">
              <p className="text-xs font-bold text-slate-800">Kích chọn một trong các phần thi sau đây</p>
              <p className="text-[11px] text-slate-600 italic">
                (Phần thi được chọn có nền màu hồng, phần thi không được chọn có nền màu xanh)
              </p>
            </div>

            {/* Danh sách 12 tổ hợp môn */}
            <div className="space-y-2 max-w-3xl w-full mx-auto flex-1 overflow-y-auto pr-1">
              {HSA_SUBJECT_COMBINATIONS.map((combo) => {
                const isSelected = selectedComboId === combo.id
                return (
                  <button
                    key={combo.id}
                    type="button"
                    onClick={() => setSelectedComboId(combo.id)}
                    className={`w-full py-2.5 px-4 text-center text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-[#fae1d0] text-[#7030a0] border-[#e8c0a8]'
                        : 'bg-[#edf5fc] text-[#1b5b96] border-[#d6e5f5] hover:bg-[#e4eff9]'
                    }`}
                  >
                    {isSelected && <span className="text-[#2d6a36] text-sm font-black">✔</span>}
                    <span>
                      {combo.code}: {combo.name}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="text-center pt-4 border-t border-slate-200 mt-4">
              <button
                type="button"
                onClick={handleStartPart3WithCombo}
                className="px-8 py-1.5 bg-[#5c9d5f] hover:bg-[#4d8650] text-white font-bold text-xs rounded-xs border border-[#4d8650] shadow-xs uppercase tracking-wider cursor-pointer"
              >
                BẮT ĐẦU PHẦN 3
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH 4: NHẮC NHỞ TRƯỚC KHI NỘP BÀI / KẾT THÚC PHẦN THI (Image 4)
  // ==========================================================================
  if (screenStage === 'warning_end') {
    const unansweredNumbers = unansweredQuestionsInCurrentPart.map((q: any) => q.number).join(', ')

    return (
      <div className="min-h-screen bg-[#3a6344] p-2 md:p-6 flex items-center justify-center font-sans select-none">
        <div className="w-full max-w-5xl bg-white border border-[#b8b8b8] shadow-2xl flex flex-col min-h-[580px]">
          {/* Header xám trên cùng */}
          <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-green-600 bg-white flex items-center justify-center text-[10px] text-green-700 font-bold">
                ✓
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="w-4 h-4 border border-black flex items-center justify-center text-[9px] font-bold">
                    ▶
                  </div>
                ))}
                <span className="text-green-700 font-bold text-sm ml-1">{currentPartIdx + 1}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-bold text-[#555555] uppercase">
                {exam?.title || 'ĐỀ THI THAM KHẢO SỐ 2 - ĐÁNH GIÁ NĂNG LỰC HỌC SINH THPT 2025'}
              </div>
              <div className="inline-block bg-[#5b9bd5] text-white px-2 py-0.5 text-[10px] font-bold uppercase mt-0.5">
                {currentPart.title}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-red-600 font-bold font-mono text-sm">
                {formatSeconds(partTimeLeft)}
              </div>
              <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
                <User className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Dải số câu hỏi */}
          <div className="w-full bg-[#f0f0f0] border-b border-[#cccccc] px-2 py-1.5 overflow-x-auto flex gap-1 items-center">
            {currentPart.questions.map((q: any) => {
              const qNum = q.number
              const isAnswered = answers[String(qNum)] !== undefined && answers[String(qNum)] !== ''
              return (
                <div
                  key={qNum}
                  className={`w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                    isAnswered
                      ? 'bg-[#555555] text-white border-[#333333]'
                      : 'bg-white text-slate-800 border-slate-400'
                  }`}
                >
                  {qNum}
                </div>
              )
            })}
          </div>

          {/* Nội dung cảnh báo kết thúc phần thi (Đúng chuẩn Ảnh 4) */}
          <div className="flex-1 flex flex-col justify-end p-6 md:p-8 text-center pb-8">
            {unansweredNumbers ? (
              <p className="text-[12px] text-red-600 font-semibold mb-2">
                Bạn chưa làm câu: {unansweredNumbers}
              </p>
            ) : (
              <p className="text-[12px] text-green-700 font-semibold mb-2">
                Bạn đã hoàn thành tất cả {currentPart.questions.length} câu hỏi của phần thi này!
              </p>
            )}

            <p className="text-[12px] text-slate-800 font-normal mb-1">
              Khi đã kết thúc phần thi, bạn sẽ không quay lại phần thi được nữa.
            </p>
            <p className="text-[12px] text-slate-800 font-bold mb-4">
              Bạn chắc chắn KẾT THÚC phần thi này?
            </p>

            {/* 2 nút Có và Không (Image 4) */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleConfirmEndSection}
                className="px-6 py-1 bg-[#5b9bd5] hover:bg-[#4885c2] text-white text-xs font-bold border border-[#4885c2] rounded-xs cursor-pointer shadow-xs"
              >
                Có
              </button>
              <button
                type="button"
                onClick={() => setScreenStage('exam')}
                className="px-6 py-1 bg-[#5b9bd5] hover:bg-[#4885c2] text-white text-xs font-bold border border-[#4885c2] rounded-xs cursor-pointer shadow-xs"
              >
                Không
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // MÀN HÌNH KẾT QUẢ: BẢNG ĐIỂM CHUẨN HSA
  // ==========================================================================
  if (screenStage === 'result' && hsaResult) {
    return (
      <div className="min-h-screen bg-[#3a6344] p-2 md:p-6 flex items-center justify-center font-sans select-none">
        <div className="w-full max-w-4xl bg-white border border-[#b8b8b8] shadow-2xl p-6 md:p-8 flex flex-col">
          <div className="text-center pb-4 border-b border-slate-300 mb-6">
            <h1 className="text-lg md:text-xl font-bold uppercase text-slate-800 tracking-wider">
              KẾT QUẢ BÀI THI ĐÁNH GIÁ NĂNG LỰC HỌC SINH THPT (HSA)
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Trung tâm Khảo thí Đại học Quốc gia Hà Nội • Hệ thống Sen Portal Khảo Thí
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-300 p-4 mb-6 text-xs text-slate-800 space-y-1">
            <p>Thí sinh: <strong>{studentInfo.name.toUpperCase()}</strong></p>
            <p>Số báo danh: <strong>{exam?.access_code || 'HSA-2026-DHQG'}</strong></p>
            <p>Đề thi: <strong>{exam?.title || 'Đề thi Khảo thí HSA'}</strong></p>
          </div>

          <div className="border border-slate-300 mb-6 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#e6e6e6] border-b border-slate-300 text-slate-800 font-bold">
                  <th className="p-2.5 border-r border-slate-300">Phần thi</th>
                  <th className="p-2.5 border-r border-slate-300 text-center">Số câu đúng</th>
                  <th className="p-2.5 border-r border-slate-300 text-center">Điểm số</th>
                  <th className="p-2.5 text-center">Thang điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2.5 border-r border-slate-300 font-medium">Phần 1: Tư duy định lượng (Toán học)</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold text-blue-700">{hsaResult.scoreP1}/50</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold">{hsaResult.scoreP1}</td>
                  <td className="p-2.5 text-center text-slate-500">50</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-300 font-medium">Phần 2: Tư duy định tính (Ngữ văn)</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold text-blue-700">{hsaResult.scoreP2}/50</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold">{hsaResult.scoreP2}</td>
                  <td className="p-2.5 text-center text-slate-500">50</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-300 font-medium">Phần 3: Khoa học / Ngoại ngữ</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold text-blue-700">{hsaResult.scoreP3}/50</td>
                  <td className="p-2.5 border-r border-slate-300 text-center font-bold">{hsaResult.scoreP3}</td>
                  <td className="p-2.5 text-center text-slate-500">50</td>
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className="p-3 border-r border-slate-300 uppercase">TỔNG ĐIỂM CHUNG TOÀN BÀI THI</td>
                  <td className="p-3 border-r border-slate-300 text-center text-emerald-700">{hsaResult.correctCount}/150</td>
                  <td className="p-3 border-r border-slate-300 text-center text-red-600 text-base">{hsaResult.totalScore}</td>
                  <td className="p-3 text-center text-slate-700">150</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setScreenStage('transition')
                setCurrentPartIdx(0)
                setTransitionTimeLeft(120)
                setAnswers({})
              }}
              className="px-6 py-2 bg-[#5c9d5f] hover:bg-[#4d8650] text-white text-xs font-bold rounded-xs cursor-pointer"
            >
              Làm lại bài thi
            </button>
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
  // MÀN HÌNH 2 & 3: GIAO DIỆN THI CHÍNH THỨC HSA (Images 2 & 3)
  // ==========================================================================
  const isPart2Literature = currentPartIdx === 1

  return (
    <div className="min-h-screen bg-[#3a6344] p-1 md:p-4 flex flex-col font-sans select-none">
      <div className="w-full max-w-7xl mx-auto bg-white border border-[#b8b8b8] shadow-2xl flex flex-col h-[calc(100vh-2rem)]">
        {/* ================= HEADER BAR (Images 2 & 3) ================= */}
        <div className="w-full bg-[#e6e6e6] border-b border-[#cccccc] px-4 py-2 flex items-center justify-between shrink-0">
          {/* Bên trái: Logo tròn + 3 ô vuông phần thi + số phần màu xanh lá */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-green-600 bg-white flex items-center justify-center text-[10px] text-green-700 font-bold">
              ✓
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`w-4 h-4 border border-black flex items-center justify-center text-[9px] font-bold ${
                    currentPartIdx + 1 === num ? 'bg-slate-300' : 'bg-white'
                  }`}
                >
                  ▶
                </div>
              ))}
              <span className="text-green-700 font-bold text-base ml-1">{currentPartIdx + 1}</span>
            </div>
          </div>

          {/* Ở giữa: Tiêu đề đề thi & Huy hiệu tên phần thi */}
          <div className="text-center">
            <div className="text-[11px] md:text-[12px] font-bold text-[#555555] uppercase">
              {exam?.title || 'ĐỀ THI THAM KHẢO SỐ 2 - ĐÁNH GIÁ NĂNG LỰC HỌC SINH THPT 2025'}
            </div>
            <div className="inline-block bg-[#5b9bd5] text-white px-3 py-0.5 text-[10px] md:text-[11px] font-bold uppercase mt-0.5">
              {currentPart.title}
            </div>
          </div>

          {/* Bên phải: Đồng hồ đếm ngược số to đỏ + Avatar + Nút kết thúc */}
          <div className="flex items-center gap-3">
            <div className="text-red-600 font-bold font-mono text-base md:text-lg">
              {formatSeconds(partTimeLeft)}
            </div>
            <div className="w-7 h-8 border border-slate-300 bg-white flex items-center justify-center text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={() => setScreenStage('warning_end')}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-xs uppercase tracking-wider cursor-pointer"
              title="Kết thúc phần thi hiện tại"
            >
              Nộp bài
            </button>
          </div>
        </div>

        {/* ================= QUESTION BAR: DẢI SỐ CÂU HỎI (Images 2 & 3) ================= */}
        <div className="w-full bg-[#f0f0f0] border-b border-[#cccccc] px-3 py-1.5 overflow-x-auto flex gap-1 items-center shrink-0">
          {currentPart.questions.map((q: any) => {
            const qNum = q.number
            const isAnswered = answers[String(qNum)] !== undefined && answers[String(qNum)] !== ''
            const isViewing = currentQuestionNumber === qNum

            return (
              <button
                key={qNum}
                type="button"
                onClick={() => scrollToQuestion(qNum)}
                className={`w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border cursor-pointer transition ${
                  isViewing
                    ? 'ring-2 ring-blue-600 ring-offset-0.5 bg-[#555555] text-white'
                    : isAnswered
                    ? 'bg-[#555555] text-white border-[#333333]'
                    : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-100'
                }`}
                title={`Chuyển tới Câu ${qNum}`}
              >
                {qNum}
              </button>
            )
          })}
        </div>

        {/* ================= NỘI DUNG ĐỀ THI HSA ================= */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {isPart2Literature ? (
            /* Image 3: BỐ CỤC 2 CỘT CHUẨN HSA CHO PHẦN NGỮ VĂN */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-300 h-full overflow-hidden">
              {/* Cột trái: Đoạn trích ngữ liệu chung */}
              <div className="h-full overflow-y-auto p-4 md:p-6 bg-[#edf2fa] text-xs md:text-sm text-slate-800 leading-relaxed font-serif">
                <div className="font-sans font-bold text-slate-700 mb-2 italic">
                  Câu 81 - 85:
                </div>
                <div className="font-sans font-bold text-slate-900 mb-3">
                  Đọc đoạn trích dưới đây và trả lời 5 câu hỏi tiếp theo.
                </div>
                <div className="whitespace-pre-wrap italic leading-loose text-slate-900">
                  <SafeMathRenderer
                    content={
                      currentPart.questions[30]?.passage ||
                      `Một đảo nhỏ xa xôi ngoài biển rộng\nVẫn tiếng làng tiếng nước của riêng ta\nTiếng chẳng mất khi Loa thành đã mất\nNàng Mỵ Châu quỳ xuống lạy cha già\nTiếng thao thức lòng trai ôm ngọc sáng\nDưới cát vùi sóng dập chẳng hề nguôi\nTiếng tủi cực kẻ ăn cầu ngủ quán\nThành Nguyễn Du văng vặc nỗi thương đời\nTrái đất rộng giàu sang bao thứ tiếng\nCao quý thâm trầm rực rỡ vui tươi\nTiếng Việt rung rinh nhịp đập trái tim người\nNhư tiếng sáo như dây đàn máu nhỏ\n\n(Lưu Quang Vũ, "Tiếng Việt", Gió và tình yêu thổi trên đất nước tôi, Nxb Hội Nhà văn, HN, 2010, tr. 104)`
                    }
                  />
                </div>
              </div>

              {/* Cột phải: Danh sách các câu hỏi con */}
              <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
                {currentPart.questions.map((q: any) => (
                  <div key={q.id || q.number} id={`hsa-q-item-${q.number}`} className="pb-4 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-start gap-1.5 mb-2">
                      <span className="bg-[#2d6a36] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-xs shrink-0">
                        Câu {q.number}.
                      </span>
                      <div className="text-xs md:text-[13px] font-bold text-slate-900 leading-snug flex-1">
                        <SafeMathRenderer content={q.text} />
                      </div>
                    </div>

                    {renderOptions(q)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Image 2: DANH SÁCH CÂU HỎI CUỘN LIÊN TỤC CHO PHẦN TOÁN & KHOA HỌC */
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {currentPart.questions.map((q: any) => (
                <div
                  key={q.id || q.number}
                  id={`hsa-q-item-${q.number}`}
                  className="pb-5 border-b border-slate-200 last:border-b-0"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="bg-[#2d6a36] text-white text-[11px] font-bold px-2 py-0.5 rounded-xs shrink-0">
                      Câu {q.number}.
                    </span>
                    <div className="text-xs md:text-[13px] font-medium text-slate-900 leading-relaxed flex-1">
                      <SafeMathRenderer content={q.text} />
                    </div>
                  </div>

                  {renderOptions(q)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Hàm render phương án (A) ○, (B) ○, (C) ○, (D) ○ chuẩn 100% Ảnh 2 & 3
  function renderOptions(question: any) {
    if (!question) return null

    // Câu điền số / Trả lời ngắn
    if (question.type === 'short_answer') {
      const currentVal = answers[String(question.number)] || ''
      return (
        <div className="pl-6 pt-1 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Đáp số:</span>
          <input
            type="text"
            value={currentVal}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [String(question.number)]: e.target.value,
              }))
            }
            placeholder="Nhập số..."
            className="w-40 px-2 py-1 border border-slate-400 bg-white font-mono text-xs outline-none focus:border-blue-600"
          />
        </div>
      )
    }

    // Câu trắc nghiệm 4 phương án
    const options = Array.isArray(question.options) ? question.options : []
    const selectedLetter = answers[String(question.number)]

    return (
      <div className="pl-4 md:pl-6 space-y-1.5 pt-1">
        {options.map((optText: string, oIdx: number) => {
          const letter = String.fromCharCode(65 + oIdx)
          const isSelected = selectedLetter === letter

          return (
            <label
              key={oIdx}
              className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 py-0.5 px-1 rounded-xs select-none"
              onClick={() => {
                setAnswers((prev) => ({
                  ...prev,
                  [String(question.number)]: letter,
                }))
              }}
            >
              <div className="flex items-center gap-1 shrink-0 font-bold text-xs text-slate-900 mt-0.5">
                <span>({letter})</span>
                <input
                  type="radio"
                  name={`hsa_q_${question.number}`}
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 accent-[#2d6a36] cursor-pointer"
                />
              </div>
              <div className="text-xs text-slate-800 leading-relaxed flex-1">
                <SafeMathRenderer content={optText} className="inline" />
              </div>
            </label>
          )
        })}
      </div>
    )
  }
}
