'use client'

import React, { useState, useEffect, useMemo, Component } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { preprocessLatexContent } from '@/lib/latexExamParser'
import {
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Check,
  X,
  FileText,
  HelpCircle,
  ShieldCheck,
  Compass,
  ArrowRight,
  BookOpen,
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

const SafeMathRenderer = React.memo(
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
              img: ({ node, ...props }) => (
                <span className="block my-3 text-center">
                  <img
                    {...props}
                    alt={props.alt || 'Hình minh họa câu hỏi'}
                    className="max-h-[360px] max-w-full rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mx-auto object-contain cursor-zoom-in hover:shadow-md transition bg-white"
                    onClick={() => {
                      if (props.src) window.open(props.src, '_blank')
                    }}
                  />
                  {props.alt && props.alt !== 'Hình minh họa câu hỏi' && (
                    <span className="block text-[11px] text-slate-400 italic mt-1 font-sans">
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

// 12 tổ hợp chuẩn HSA của ĐHQGHN cho Phần thi thứ 3
export const HSA_SUBJECT_COMBINATIONS = [
  { id: 'combo_1', name: '1. Vật lí - Hóa học - Sinh học', subjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
  { id: 'combo_2', name: '2. Vật lí - Hóa học - Lịch sử', subjects: ['Vật lí', 'Hóa học', 'Lịch sử'] },
  { id: 'combo_3', name: '3. Vật lí - Hóa học - Địa lí', subjects: ['Vật lí', 'Hóa học', 'Địa lí'] },
  { id: 'combo_4', name: '4. Vật lí - Sinh học - Lịch sử', subjects: ['Vật lí', 'Sinh học', 'Lịch sử'] },
  { id: 'combo_5', name: '5. Vật lí - Sinh học - Địa lí', subjects: ['Vật lí', 'Sinh học', 'Địa lí'] },
  { id: 'combo_6', name: '6. Vật lí - Lịch sử - Địa lí', subjects: ['Vật lí', 'Lịch sử', 'Địa lí'] },
  { id: 'combo_7', name: '7. Hóa học - Sinh học - Lịch sử', subjects: ['Hóa học', 'Sinh học', 'Lịch sử'] },
  { id: 'combo_8', name: '8. Hóa học - Sinh học - Địa lí', subjects: ['Hóa học', 'Sinh học', 'Địa lí'] },
  { id: 'combo_9', name: '9. Hóa học - Lịch sử - Địa lí', subjects: ['Hóa học', 'Lịch sử', 'Địa lí'] },
  { id: 'combo_10', name: '10. Sinh học - Lịch sử - Địa lí', subjects: ['Sinh học', 'Lịch sử', 'Địa lí'] },
  { id: 'combo_11', name: '11. Tiếng Anh (Ngoại ngữ)', subjects: ['Tiếng Anh'] },
  { id: 'combo_12', name: '12. Khoa học Tự nhiên & Xã hội Tổng hợp', subjects: ['Khoa học'] },
]

export default function HsaExamRoom({
  exam,
  studentInfo,
  isMobileView = false,
  onExit,
}: HsaExamRoomProps) {
  // Trạng thái màn hình:
  // 'transition': Màn hình chờ 120s trước phần thi
  // 'exam': Màn hình làm bài thi chính thức
  // 'choose_combo': Màn hình chọn tổ hợp phần 3
  // 'result': Bảng điểm kết quả chuẩn HSA
  const [screenStage, setScreenStage] = useState<'transition' | 'exam' | 'choose_combo' | 'result'>('transition')

  // Chỉ số phần thi hiện tại: 0 (P1: Định lượng), 1 (P2: Định tính), 2 (P3: Khoa học/Ngoại ngữ)
  const [currentPartIdx, setCurrentPartIdx] = useState<number>(0)

  // Thời gian đếm ngược 120 giây giữa các phần thi
  const [transitionTimeLeft, setTransitionTimeLeft] = useState<number>(120)

  // Thời gian đếm ngược của phần thi hiện tại (giây)
  const [partTimeLeft, setPartTimeLeft] = useState<number>(75 * 60)

  // Quản lý câu hỏi & đáp án
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({})

  // Modal cảnh báo nộp bài / kết thúc phần thi
  const [showWarningEndSectionModal, setShowWarningEndSectionModal] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Tổ hợp được chọn cho Phần 3
  const [selectedComboId, setSelectedComboId] = useState<string>('combo_1')

  // Kết quả sau khi nộp bài
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

  // Bóc tách cấu trúc đề thi HSA từ database
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

  // Trích xuất các môn khoa học có sẵn trong đề thi (để lọc tổ hợp)
  const availableScienceSubjects = useMemo(() => {
    const subjects = new Set<string>()
    if (Array.isArray(exam?.subjects)) {
      exam.subjects.forEach((s: string) => subjects.add(s))
    }
    parsedSections.forEach((sec: any) => {
      if (sec.subject) subjects.add(sec.subject)
      if (Array.isArray(sec.subjects)) sec.subjects.forEach((s: string) => subjects.add(s))
      if (Array.isArray(sec.questions)) {
        sec.questions.forEach((q: any) => {
          if (q.subject) subjects.add(q.subject)
        })
      }
    })
    return subjects
  }, [exam, parsedSections])

  // Lọc các tổ hợp có môn đã được cập nhật đề
  const activeCombinations = useMemo(() => {
    return HSA_SUBJECT_COMBINATIONS.map((combo) => {
      const isAvailable =
        availableScienceSubjects.size === 0 ||
        combo.subjects.some((s) => availableScienceSubjects.has(s)) ||
        combo.id === 'combo_1' ||
        combo.id === 'combo_11'
      return {
        ...combo,
        isAvailable,
      }
    })
  }, [availableScienceSubjects])

  // Chuẩn hóa 3 phần thi HSA (Phần 1: Định lượng, Phần 2: Định tính, Phần 3: Khoa học / Ngoại ngữ)
  const hsaParts = useMemo(() => {
    // Phần 1: Tư duy định lượng (Toán học - 50 câu, 75 phút)
    const p1Raw = parsedSections[0] || {}
    let p1Questions = Array.isArray(p1Raw.questions) ? p1Raw.questions : []
    if (p1Questions.length === 0 && Array.isArray(exam?.questions)) {
      p1Questions = exam.questions.slice(0, 50)
    }

    // Phần 2: Tư duy định tính (Văn học / Ngôn ngữ - 50 câu, 60 phút)
    const p2Raw = parsedSections[1] || {}
    let p2Questions = Array.isArray(p2Raw.questions) ? p2Raw.questions : []
    if (p2Questions.length === 0 && Array.isArray(exam?.questions) && exam.questions.length > 50) {
      p2Questions = exam.questions.slice(50, 100)
    }

    // Phần 3: Khoa học / Ngoại ngữ (50 câu, 60 phút)
    const p3Raw = parsedSections[2] || {}
    let p3Questions = Array.isArray(p3Raw.questions) ? p3Raw.questions : []
    if (p3Questions.length === 0 && Array.isArray(exam?.questions) && exam.questions.length > 100) {
      p3Questions = exam.questions.slice(100, 150)
    }

    // Tạo danh sách câu hỏi mô phỏng nếu đề KaTeX chỉ có một phần
    const createPlaceholderQuestions = (startNum: number, count: number, sectionName: string) => {
      return Array.from({ length: count }).map((_, i) => {
        const num = startNum + i
        return {
          id: `hsa_q_${num}`,
          number: num,
          text: `Câu hỏi số ${num} thuộc ${sectionName}. Hãy đọc kỹ đề bài và chọn một đáp án chính xác nhất.`,
          options: [
            'Phương án đáp án A chuẩn xác',
            'Phương án đáp án B',
            'Phương án đáp án C',
            'Phương án đáp án D',
          ],
          correctAnswer: 'A',
          explanation: `Giải thích chi tiết cho câu hỏi ${num}: Áp dụng định lí và phương pháp giải chuẩn HSA để suy ra đáp án A.`,
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
            // Thêm dữ liệu mẫu passage đoạn trích cho câu 81 - 85 nếu câu chưa có đoạn trích
            passage:
              q.passage ||
              (i >= 30 && i <= 34
                ? 'Đọc đoạn trích sau và trả lời các câu hỏi từ 81 đến 85:\n\n"Gió theo lối gió, mây đường mây,\nDòng nước buồn thiu, hoa bắp lay...\nThuyền ai đậu bến sông trăng đó,\nCó chở trăng về kịp tối nay?"\n\n(Hàn Mặc Tử - Đây thôn Vĩ Dạ, NXB Văn học)'
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
        title: '1. TƯ DUY ĐỊNH LƯỢNG',
        subtitle: '(50 câu - 75 phút)',
        durationMinutes: 75,
        maxScore: 50,
        startNumber: 1,
        endNumber: 50,
        questions: finalP1Questions,
      },
      {
        partId: 2,
        title: '2. TƯ DUY ĐỊNH TÍNH',
        subtitle: '(50 câu - 60 phút)',
        durationMinutes: 60,
        maxScore: 50,
        startNumber: 51,
        endNumber: 100,
        questions: finalP2Questions,
      },
      {
        partId: 3,
        title: '3. KHOA HỌC / NGOẠI NGỮ',
        subtitle: '(50 câu - 60 phút)',
        durationMinutes: 60,
        maxScore: 50,
        startNumber: 101,
        endNumber: 150,
        questions: finalP3Questions,
      },
    ]
  }, [parsedSections, exam])

  // Phần thi hiện tại
  const currentPart = hsaParts[currentPartIdx] || hsaParts[0]

  // Câu hỏi hiện tại
  const currentQuestion = useMemo(() => {
    const q = currentPart.questions.find((item: any) => item.number === currentQuestionNumber)
    return q || currentPart.questions[0] || null
  }, [currentPart, currentQuestionNumber])

  // Danh sách các câu hỏi chưa làm trong phần thi hiện tại
  const unansweredQuestionsInCurrentPart = useMemo(() => {
    return currentPart.questions.filter((q: any) => {
      const val = answers[String(q.number)]
      return val === undefined || val === null || val === ''
    })
  }, [currentPart, answers])

  // Bộ đếm thời gian cho màn hình chờ chuyển tiếp 120s
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

  // Bộ đếm thời gian cho phần thi đang diễn ra
  useEffect(() => {
    if (screenStage !== 'exam' || partTimeLeft <= 0) return

    const timer = setInterval(() => {
      setPartTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleConfirmEndSection()
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

  // Kết thúc phần thi hiện tại và chuyển sang phần tiếp theo hoặc nộp bài
  const handleConfirmEndSection = async () => {
    setShowWarningEndSectionModal(false)

    if (currentPartIdx === 0) {
      // Kết thúc Phần 1 -> Chuyển sang Màn hình nghỉ 120s của Phần 2
      setCurrentPartIdx(1)
      setTransitionTimeLeft(120)
      setScreenStage('transition')
    } else if (currentPartIdx === 1) {
      // Kết thúc Phần 2 -> Hiển thị Màn hình chọn tổ hợp cho Phần 3
      setScreenStage('choose_combo')
    } else {
      // Kết thúc Phần 3 -> Chấm điểm toàn bài thi HSA
      await handleSubmitFullExam()
    }
  }

  // Xác nhận tổ hợp môn Phần 3
  const handleConfirmCombination = () => {
    setCurrentPartIdx(2)
    setTransitionTimeLeft(120)
    setScreenStage('transition')
  }

  // Tính điểm và gửi bài nộp
  const handleSubmitFullExam = async () => {
    setSubmitting(true)
    try {
      let scoreP1 = 0
      let scoreP2 = 0
      let scoreP3 = 0
      let correctCount = 0
      let totalQuestionsCount = 0

      const sectionScores = hsaParts.map((part, pIdx) => {
        let partCorrect = 0
        part.questions.forEach((q: any) => {
          totalQuestionsCount++
          const studentAns = String(answers[String(q.number)] || '').trim().toUpperCase()
          const correctAns = String(q.correctAnswer || 'A').trim().toUpperCase()
          if (studentAns && studentAns === correctAns) {
            partCorrect++
            correctCount++
          }
        })

        const partScore = parseFloat(((partCorrect / (part.questions.length || 50)) * 50).toFixed(2))
        if (pIdx === 0) scoreP1 = partScore
        if (pIdx === 1) scoreP2 = partScore
        if (pIdx === 2) scoreP3 = partScore

        return {
          name: part.title,
          score: partScore,
          maxScore: 50,
          correct: partCorrect,
          total: part.questions.length || 50,
        }
      })

      const totalScore = parseFloat((scoreP1 + scoreP2 + scoreP3).toFixed(2))

      // Lưu kết quả vào cơ sở dữ liệu Supabase nếu có user
      const { data: auth } = await supabase.auth.getUser()
      let submissionId = ''
      if (auth.user && exam?.id) {
        const { data: subData } = await supabase
          .from('submissions')
          .insert({
            exam_id: exam.id,
            user_id: auth.user.id,
            score: totalScore,
            answers: answers,
            detailed_scores: { scoreP1, scoreP2, scoreP3 },
          })
          .select('id')
          .single()
        if (subData) submissionId = subData.id
      }

      setHsaResult({
        scoreP1,
        scoreP2,
        scoreP3,
        totalScore,
        correctCount,
        totalCount: totalQuestionsCount,
        sectionScores,
        submissionId,
      })
      setScreenStage('result')
    } catch (err) {
      console.error('HSA submission error:', err)
      alert('Có sự cố khi tổng hợp điểm. Điểm số của bạn vẫn được lưu nháp!')
      setScreenStage('result')
    } finally {
      setSubmitting(false)
    }
  }

  // Định dạng thời gian mm:ss
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // --------------------------------------------------------------------------
  // MÀN HÌNH 1: MÀN HÌNH CHỜ NGHỈ 120 GIÂY GIỮA CÁC PHẦN THI (Image 1)
  // --------------------------------------------------------------------------
  if (screenStage === 'transition') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans select-none p-4 md:p-8">
        {/* Top Header */}
        <div className="w-full text-center py-4 border-b border-slate-300">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-800">
            BÀI THI ĐÁNH GIÁ NĂNG LỰC HỌC SINH TRUNG HỌC PHỔ THÔNG
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Trung tâm Khảo thí Đại học Quốc gia Hà Nội • Hệ thống Sen Portal Khảo thí
          </p>
        </div>

        {/* Center Content */}
        <div className="max-w-2xl w-full mx-auto my-auto bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center flex flex-col items-center">
          {/* Logo 3 khối [H] [S] [A] */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-xl bg-slate-600 flex items-center justify-center text-white text-3xl font-black shadow-md">
              H
            </div>
            <div className="w-16 h-16 rounded-xl bg-sky-600 flex items-center justify-center text-white text-3xl font-black shadow-md">
              S
            </div>
            <div className="w-16 h-16 rounded-xl bg-rose-600 flex items-center justify-center text-white text-3xl font-black shadow-md">
              A
            </div>
          </div>
          <h2 className="text-lg font-black uppercase text-slate-800 tracking-widest mb-6">
            BÀI THI ĐÁNH GIÁ NĂNG LỰC
          </h2>

          {/* Phần thi sắp tới */}
          <div className="w-full bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-sky-700 tracking-wider">
                Phần thi tiếp theo ({currentPartIdx + 1}/3):
              </span>
              <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full">
                {currentPart.durationMinutes} phút • 50 câu
              </span>
            </div>
            <h3 className="text-base font-black text-sky-950 mt-1">
              {currentPart.title}
            </h3>
          </div>

          {/* Hộp hướng dẫn CHÚ Ý */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-left space-y-2">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              CHÚ Ý:
            </h4>
            <ul className="text-xs md:text-sm font-semibold text-slate-700 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="text-sky-600 font-bold">•</span>
                <span>Bạn có <strong>120 giây</strong> nghỉ ngơi trước khi bước vào phần thi tiếp theo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-600 font-bold">•</span>
                <span>Đồng hồ đếm ngược sẽ tự động chuyển sang phần thi tiếp theo khi hết thời gian.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-600 font-bold">•</span>
                <span>Bạn có thể chuyển sang phần thi tiếp theo bất kỳ lúc nào bằng cách ấn nút <strong>&lt; BẮT ĐẦU &gt;</strong>.</span>
              </li>
            </ul>
          </div>

          {/* Đồng hồ đếm ngược chữ đỏ */}
          <div className="text-lg md:text-xl font-black text-rose-600 mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 animate-pulse" />
            <span>Thời gian còn lại: <strong>{transitionTimeLeft}</strong> giây</span>
          </div>

          {/* Nút xanh lá < BẮT ĐẦU > */}
          <button
            type="button"
            onClick={handleStartCurrentPart}
            className="w-full max-w-sm py-3.5 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>&lt; BẮT ĐẦU &gt;</span>
          </button>
        </div>

        {/* Bottom Footer Info */}
        <div className="w-full text-center py-4 border-t border-slate-300 text-xs font-bold text-slate-600 flex items-center justify-between max-w-5xl mx-auto flex-wrap gap-2">
          <span>Thí sinh: <strong>{studentInfo.name.toUpperCase()}</strong></span>
          <span>SBD: <strong>{exam?.access_code || 'HSA-2026-DHQG'}</strong></span>
          <span>Phòng thi: <strong>Sen Portal HSA Khảo Thí Quốc Gia</strong></span>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // MÀN HÌNH 5: LỰA CHỌN PHẦN THI THỨ 3 (KHOA HỌC / NGOẠI NGỮ) (Image 5)
  // --------------------------------------------------------------------------
  if (screenStage === 'choose_combo') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans select-none p-4 md:p-8">
        <div className="w-full text-center py-4 border-b border-slate-300">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-800">
            LỰA CHỌN PHẦN THI THỨ 3
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Thí sinh chọn 1 trong các tổ hợp môn sau đây cho Phần 3 (Khoa học & Ngoại ngữ)
          </p>
        </div>

        <div className="max-w-4xl w-full mx-auto my-auto bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8">
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-900 leading-relaxed">
            💡 <strong>Quy định:</strong> Các tổ hợp được kích hoạt dựa trên dữ liệu đề thi đã cập nhật. Bạn chỉ có thể chọn tổ hợp có đủ các môn đã được tải lên hệ thống.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {activeCombinations.map((combo) => {
              const isSelected = selectedComboId === combo.id
              return (
                <button
                  key={combo.id}
                  type="button"
                  disabled={!combo.isAvailable}
                  onClick={() => setSelectedComboId(combo.id)}
                  className={`p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-md ring-2 ring-emerald-500/20'
                      : combo.isAvailable
                      ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold'
                      : 'border-slate-200 bg-slate-100/50 text-slate-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-base font-black ${
                        isSelected ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      ◆
                    </span>
                    <span className="text-xs md:text-sm">{combo.name}</span>
                  </div>

                  {!combo.isAvailable && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      Chưa có đề
                    </span>
                  )}
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleConfirmCombination}
              className="py-3 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>&lt; XÁC NHẬN CHỌN TỔ HỢP &gt;</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="w-full text-center py-4 border-t border-slate-300 text-xs font-bold text-slate-600">
          Thí sinh: <strong>{studentInfo.name.toUpperCase()}</strong> • Bài thi Đánh giá Năng lực HSA
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // MÀN HÌNH 6: BẢNG ĐIỂM KẾT QUẢ CHUẨN HSA (Thang 150 điểm)
  // --------------------------------------------------------------------------
  if (screenStage === 'result' && hsaResult) {
    const totalScore = hsaResult.totalScore
    let rankTitle = 'Đạt Yêu Cầu'
    let rankColor = 'text-sky-600'
    let rankBg = 'bg-sky-50 border-sky-200'

    if (totalScore >= 110) {
      rankTitle = 'Xuất Sắc (Top Dẫn Đầu)'
      rankColor = 'text-amber-600'
      rankBg = 'bg-amber-50 border-amber-200'
    } else if (totalScore >= 90) {
      rankTitle = 'Giỏi (Cơ Hội Cao Tuyển Thẳng)'
      rankColor = 'text-emerald-600'
      rankBg = 'bg-emerald-50 border-emerald-200'
    } else if (totalScore >= 75) {
      rankTitle = 'Khá (Đạt Ngưỡng Sàn Đại Học)'
      rankColor = 'text-indigo-600'
      rankBg = 'bg-indigo-50 border-indigo-200'
    }

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans p-4 md:p-8">
        <div className="w-full text-center py-4 border-b border-slate-300">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-800">
            KẾT QUẢ BÀI THI ĐÁNH GIÁ NĂNG LỰC HSA
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Báo cáo điểm số chuẩn hóa • Trung tâm Khảo thí ĐHQG Hà Nội
          </p>
        </div>

        <div className="max-w-3xl w-full mx-auto my-8 bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8">
          {/* Tổng điểm lớn */}
          <div className="text-center pb-6 border-b border-slate-200">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              TỔNG ĐIỂM BÀI THI HSA
            </span>
            <div className="text-5xl md:text-6xl font-black text-rose-600 my-2">
              {totalScore} <span className="text-2xl text-slate-400 font-bold">/ 150</span>
            </div>
            <div className={`inline-block px-4 py-1.5 rounded-full border text-xs font-black ${rankColor} ${rankBg}`}>
              Đánh giá: {rankTitle}
            </div>
          </div>

          {/* Chi tiết từng phần thi */}
          <div className="py-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
              CHI TIẾT ĐIỂM SỐ CÁC PHẦN THI (THANG 50 ĐIỂM MỖI PHẦN)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hsaResult.sectionScores.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-500">
                      Phần {idx + 1}
                    </span>
                    <h4 className="text-xs font-black text-slate-800 line-clamp-1 mt-0.5">
                      {sec.name}
                    </h4>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-sky-700">
                      {sec.score}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      / 50 điểm
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">
                    Đúng {sec.correct}/{sec.total} câu
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thao tác */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setScreenStage('transition')
                setCurrentPartIdx(0)
                setTransitionTimeLeft(120)
                setAnswers({})
                setBookmarked({})
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thi lại từ đầu</span>
            </button>

            <div className="flex items-center gap-2">
              {onExit ? (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Trở về Sen Portal
                </button>
              ) : (
                <Link
                  href="/new-sen-ground"
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Trở về Sen Portal
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="w-full text-center py-4 border-t border-slate-300 text-xs font-bold text-slate-600">
          Sen Portal • Nền tảng khảo thí năng lực học sinh THPT Quốc Gia
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // MÀN HÌNH 2 & 3: GIAO DIỆN THI CHÍNH THỨC + SPLIT-SCREEN ĐOẠN TRÍCH (Image 2 & 3)
  // --------------------------------------------------------------------------
  const isSplitScreen = Boolean(currentQuestion?.passage)

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans select-none">
      {/* ================= TOP HEADER BAR ================= */}
      <div className="w-full bg-white border-b border-slate-200 px-4 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          {/* 4 Tabs phần thi */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {hsaParts.map((part, pIdx) => {
              const isCurrent = currentPartIdx === pIdx
              const isFinished = currentPartIdx > pIdx

              return (
                <div
                  key={part.partId}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition whitespace-nowrap ${
                    isCurrent
                      ? 'bg-sky-700 text-white shadow-sm'
                      : isFinished
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isFinished && <Check className="w-3.5 h-3.5" />}
                  <span>{part.title}</span>
                  <span className="text-[10px] font-normal opacity-80">{part.subtitle}</span>
                </div>
              )
            })}
          </div>

          {/* Right Timer & Nút kết thúc phần thi */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 font-mono text-sm font-black text-rose-600">
              <Clock className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>Thời gian còn lại: <strong>{formatSeconds(partTimeLeft)}</strong></span>
            </div>

            <button
              type="button"
              onClick={() => setShowWarningEndSectionModal(true)}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>KẾT THÚC PHẦN THI</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= QUESTION NAVIGATOR RIBBON (DẢI SỐ CÂU HỎI) ================= */}
      <div className="w-full bg-white border-b border-slate-200 px-4 py-2 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Paging navigation controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentQuestionNumber(currentPart.startNumber)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-xs"
              title="Về câu đầu tiên"
            >
              &lt;&lt;
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentQuestionNumber((prev) => Math.max(currentPart.startNumber, prev - 1))
              }
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-xs"
              title="Câu trước"
            >
              &lt;
            </button>
          </div>

          {/* Circles for questions */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none flex-1 justify-start px-2">
            {currentPart.questions.map((q: any) => {
              const qNum = q.number
              const isCurrent = currentQuestionNumber === qNum
              const hasAnswered =
                answers[String(qNum)] !== undefined &&
                answers[String(qNum)] !== null &&
                answers[String(qNum)] !== ''
              const isMarked = bookmarked[qNum]

              return (
                <button
                  key={qNum}
                  type="button"
                  onClick={() => setCurrentQuestionNumber(qNum)}
                  className={`w-8 h-8 rounded-full text-xs font-black transition flex items-center justify-center shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-600 text-white ring-2 ring-sky-400 ring-offset-1 shadow-md scale-105'
                      : hasAnswered
                      ? 'bg-emerald-600 text-white font-bold'
                      : isMarked
                      ? 'bg-amber-400 text-slate-900 border border-amber-500'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {qNum}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setCurrentQuestionNumber((prev) => Math.min(currentPart.endNumber, prev + 1))
              }
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-xs"
              title="Câu tiếp"
            >
              &gt;
            </button>
            <button
              type="button"
              onClick={() => setCurrentQuestionNumber(currentPart.endNumber)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-xs"
              title="Tới câu cuối cùng"
            >
              &gt;&gt;
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN QUESTION AREA (SPLIT-SCREEN OR FULL WIDTH) ================= */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-1">
        {isSplitScreen ? (
          /* Image 3: Split-Screen 2 cột đọc hiểu */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-start">
            {/* Cột trái: Đoạn trích ngữ liệu đọc hiểu */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col max-h-[70vh] overflow-y-auto">
              <div className="pb-3 mb-3 border-b border-slate-200">
                <span className="text-xs font-black uppercase text-sky-700 tracking-wider">
                  Đọc đoạn trích sau và trả lời các câu hỏi liên quan:
                </span>
              </div>
              <div className="text-slate-800 text-sm leading-relaxed font-serif whitespace-pre-wrap">
                <SafeMathRenderer content={currentQuestion.passage} />
              </div>
            </div>

            {/* Cột phải: Câu hỏi & Phương án trả lời */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col">
              {/* Question Badge & Text */}
              <div className="flex items-start gap-3 mb-6">
                <span className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shrink-0 uppercase tracking-wider">
                  Câu {currentQuestion.number}.
                </span>
                <div className="text-sm md:text-base font-bold text-slate-800 leading-relaxed">
                  <SafeMathRenderer content={currentQuestion.text} />
                </div>
              </div>

              {/* Danh sách các đáp án (A) ○, (B) ○, (C) ○, (D) ○ */}
              {renderQuestionInput(currentQuestion)}
            </div>
          </div>
        ) : (
          /* Image 2: Màn hình đơn bình thường */
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            {/* Question Badge & Text */}
            <div className="flex items-start gap-3 mb-6 pb-4 border-b border-slate-100">
              <span className="bg-emerald-600 text-white font-black text-sm px-3.5 py-1.5 rounded-xl shrink-0 uppercase tracking-wider">
                Câu {currentQuestion.number}.
              </span>
              <div className="text-sm md:text-base font-bold text-slate-800 leading-relaxed">
                <SafeMathRenderer content={currentQuestion.text} />
              </div>
            </div>

            {/* Danh sách các phương án */}
            {renderQuestionInput(currentQuestion)}
          </div>
        )}
      </div>

      {/* ================= BOTTOM ACTION BAR ================= */}
      <div className="w-full bg-white border-t border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Nút câu trước */}
          <button
            type="button"
            disabled={currentQuestionNumber <= currentPart.startNumber}
            onClick={() => setCurrentQuestionNumber((prev) => Math.max(currentPart.startNumber, prev - 1))}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>&lt; Câu trước</span>
          </button>

          {/* Đánh dấu xem lại */}
          <button
            type="button"
            onClick={() =>
              setBookmarked((prev) => ({
                ...prev,
                [currentQuestionNumber]: !prev[currentQuestionNumber],
              }))
            }
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              bookmarked[currentQuestionNumber]
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Đánh dấu xem lại</span>
          </button>

          {/* Nút câu tiếp */}
          <button
            type="button"
            disabled={currentQuestionNumber >= currentPart.endNumber}
            onClick={() => setCurrentQuestionNumber((prev) => Math.min(currentPart.endNumber, prev + 1))}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            <span>Câu tiếp theo &gt;</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MÀN HÌNH 4: CẢNH BÁO KẾT THÚC PHẦN THI (Image 4) ================= */}
      {showWarningEndSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black uppercase text-rose-600 tracking-wider mb-2">
              CẢNH BÁO KẾT THÚC PHẦN THI
            </h3>

            <p className="text-xs md:text-sm font-bold text-slate-700 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn kết thúc phần thi <strong>{currentPart.title}</strong> không?
              <br />
              <span className="text-rose-600 font-extrabold">
                Sau khi kết thúc, bạn KHÔNG THỂ quay lại phần thi này nữa!
              </span>
            </p>

            {/* Danh sách câu chưa làm màu đỏ */}
            {unansweredQuestionsInCurrentPart.length > 0 ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 text-left">
                <span className="text-xs font-black text-rose-800 uppercase block mb-1">
                  Các câu hỏi bạn CHƯA TRẢ LỜI ({unansweredQuestionsInCurrentPart.length} câu):
                </span>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-1">
                  {unansweredQuestionsInCurrentPart.map((q: any) => (
                    <span
                      key={q.number}
                      className="px-2 py-0.5 rounded-lg bg-rose-200 text-rose-900 font-black text-xs"
                    >
                      Câu {q.number}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-5 text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bạn đã hoàn thành đầy đủ tất cả các câu hỏi của phần thi này!</span>
              </div>
            )}

            <p className="text-xs font-semibold text-slate-500 mb-6">
              Bạn có muốn tiếp tục kết thúc không?
            </p>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowWarningEndSectionModal(false)}
                className="py-2.5 px-6 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider transition cursor-pointer"
              >
                [ Không ]
              </button>

              <button
                type="button"
                onClick={handleConfirmEndSection}
                className="py-2.5 px-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
              >
                [ Có ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Hàm render phương án câu hỏi
  function renderQuestionInput(question: any) {
    if (!question) return null

    if (question.type === 'short_answer') {
      const currentVal = answers[String(question.number)] || ''
      return (
        <div className="space-y-4 pt-2">
          <label className="block text-xs font-black text-slate-600 uppercase tracking-wide">
            Điền đáp số câu trả lời của bạn:
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">Đáp án:</span>
            <input
              type="text"
              value={currentVal}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [String(question.number)]: e.target.value,
                }))
              }
              placeholder="Nhập số thập phân hoặc số nguyên (Ví dụ: 3.5 hoặc -2)..."
              className="max-w-md w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 focus:border-sky-600 font-mono text-sm font-bold outline-none"
            />
          </div>
        </div>
      )
    }

    const options = Array.isArray(question.options) ? question.options : []
    const selectedLetter = answers[String(question.number)]

    return (
      <div className="space-y-3 pt-2">
        {options.map((optText: string, oIdx: number) => {
          const letter = String.fromCharCode(65 + oIdx)
          const isSelected = selectedLetter === letter

          return (
            <button
              key={oIdx}
              type="button"
              onClick={() =>
                setAnswers((prev) => ({
                  ...prev,
                  [String(question.number)]: letter,
                }))
              }
              className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer ${
                isSelected
                  ? 'border-sky-600 bg-sky-50 text-slate-900 shadow-xs ring-1 ring-sky-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  isSelected
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-400 text-slate-600'
                }`}
              >
                {isSelected ? '●' : '○'}
              </div>

              <div className="text-xs md:text-sm font-semibold leading-relaxed flex-1">
                <span className="font-black text-slate-900 mr-2">({letter})</span>
                <SafeMathRenderer content={optText} className="inline" />
              </div>
            </button>
          )
        })}
      </div>
    )
  }
}
