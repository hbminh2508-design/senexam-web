'use client'

import React, { useEffect, useState, useRef, useMemo, Component } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import ModernLoading from '@/app/components/ModernLoading'
import { normalizeLatexQuestion, preprocessLatexContent } from '@/lib/latexExamParser'
import ProtectedExamPdfViewer from '@/app/components/ProtectedExamPdfViewer'
import HsaExamRoom from '@/app/components/HsaExamRoom'
import UniversityExamRoom from '@/app/components/UniversityExamRoom'
import TikzRenderer from '@/app/components/TikzRenderer'
import { isUniversityExam } from '@/lib/universityExamHelper'

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
    console.warn('LaTeX Markdown render error in exam room:', error)
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
          <span className="text-rose-500 text-xs italic">[Lỗi hiển thị công thức toán]</span>
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
    const rawStr = typeof content === 'string' ? content : String(content ?? '')
    const safeContent = preprocessLatexContent(rawStr)
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
      <MarkdownErrorBoundary resetKey={safeContent} fallback={<span className="text-xs font-mono">{safeContent}</span>}>
        <div className={className}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
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
import {
  Clock,
  ArrowLeft,
  Send,
  FileQuestion,
  LayoutList,
  Bookmark,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Eye,
  EyeOff,
  Award,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Move,
  UploadCloud,
  FileText,
  Sparkles,
  Maximize2,
  Minimize2,
  RotateCcw,
  User,
  GraduationCap,
  School,
  Check,
  X,
  Zap,
  Shuffle,
  Crown,
  AlertCircle,
  Trash2,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newroom-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newroom-body' })

export default function NewExamRoomPage() {
  const params = useParams()
  const router = useRouter()
  const examId = (params?.id as string) || ''

  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Người dùng & Trạng thái VIP
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isUserVip, setIsUserVip] = useState(false)
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false)
  const [hasUnfinishedSession, setHasUnfinishedSession] = useState(false)

  // Thông tin thí sinh
  const [studentInfo, setStudentInfo] = useState<{
    name: string
    email: string
    avatar: string | null
    school: string
    grade: string
  }>({
    name: 'Thí sinh',
    email: '',
    avatar: null,
    school: '',
    grade: '12',
  })

  // Test state
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submittedResult, setSubmittedResult] = useState<{ submissionId: string; score: number } | null>(null)

  // KaTeX Exam Mode & Chế độ Luyện tập
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0)
  const [isStudyMode, setIsStudyMode] = useState(true) // Chế độ học sinh biết đáp án ngay
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({}) // Câu đã kiểm tra

  // Layout view mode
  const [pdfFullscreen, setPdfFullscreen] = useState(false)
  const [cachedPdfUrl, setCachedPdfUrl] = useState('')

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchExam = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }
      setCurrentUser(user)

      await ensureStudentProfile(user.id)

      // Lấy thông tin profile học sinh & Trạng thái VIP
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const isVip = Boolean(
        pData?.is_vip ||
        (pData?.vip_until && new Date(pData.vip_until) > new Date()) ||
        pData?.role === 'admin' ||
        pData?.role === 'collab' ||
        pData?.role === 'teacher'
      )
      setIsUserVip(isVip)

      setStudentInfo({
        name: pData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Thí sinh',
        email: user.email || '',
        avatar: pData?.avatar_url || user.user_metadata?.avatar_url || null,
        school: pData?.school || '',
        grade: pData?.grade || '12',
      })

      const { data, error } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle()
      if (error || !data) {
        alert('Không tìm thấy đề thi hoặc đề thi đã bị xóa!')
        router.replace('/new-exams')
        return
      }

      if (data.require_seb) {
        router.replace(`/seb-exam/${examId}`)
        return
      }

      if (data.drive_file_id) {
        setCachedPdfUrl(`https://drive.google.com/file/d/${data.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`)
      } else if (data.pdf_url) {
        setCachedPdfUrl(data.pdf_url)
      }

      // Khôi phục nháp bài làm từ LocalStorage nếu có
      const draftKey = `senexam_draft_${examId}_${user.id}`
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft)
          if (parsed.answers && Object.keys(parsed.answers).length > 0) {
            setAnswers(parsed.answers)
            setHasUnfinishedSession(true)
          }
          if (parsed.bookmarked) setBookmarked(parsed.bookmarked)
          if (parsed.revealedAnswers) setRevealedAnswers(parsed.revealedAnswers)
          if (parsed.isStudyMode !== undefined) setIsStudyMode(Boolean(parsed.isStudyMode))
        } catch (e) {
          console.error('Error loading draft answers:', e)
        }
      }

      setExam(data)
      setTimeLeft((data.duration || 50) * 60)
      setLoading(false)
    }

    fetchExam()
  }, [examId, router])

  // Timer đếm ngược
  useEffect(() => {
    if (!hasStarted || loading || timeLeft <= 0 || submittedResult || submitting) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, loading, timeLeft, submittedResult, submitting])

  // Tự động lưu tiến độ vào LocalStorage
  useEffect(() => {
    if (!hasStarted || !examId) return
    const timer = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const draftKey = `senexam_draft_${examId}_${auth.user.id}`
        localStorage.setItem(
          draftKey,
          JSON.stringify({ answers, bookmarked, revealedAnswers, isStudyMode, updatedAt: Date.now() })
        )
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [answers, bookmarked, revealedAnswers, isStudyMode, examId, hasStarted])

  // Cảnh báo và tự động bảo lưu khi thoát bằng trình duyệt web
  useEffect(() => {
    if (!hasStarted || submittedResult) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Hệ thống ghi nhận bạn đang làm bài thi. Khi rời khỏi web, tiến độ câu trả lời đã được lưu lại và tính là xác nhận kết thúc.'
      return 'Hệ thống ghi nhận bạn đang làm bài thi. Khi rời khỏi web, tiến độ câu trả lời đã được lưu lại và tính là xác nhận kết thúc.'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasStarted, submittedResult])


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

  // Cập nhật câu trả lời
  const handleAnswer = (key: string, value: any) => {
    // Chế độ luyện tập: khi đã kiểm tra đáp án thì không được chọn lại các đáp án khác nữa
    if (isStudyMode && revealedAnswers[key]) {
      return
    }
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  // Đánh dấu xem lại
  const toggleBookmark = (key: string) => {
    setBookmarked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Chấp nhận câu trả lời và xem ngay lời giải
  const handleAcceptAnswer = (key: string) => {
    setRevealedAnswers((prev) => ({ ...prev, [key]: true }))
  }

  // Chỉ lấy các phần có câu hỏi
  const activeSections = useMemo(() => {
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
    return struct.filter(
      (s: any) =>
        s &&
        ((parseInt(s?.questionCount) || 0) > 0 || (Array.isArray(s?.questions) && s.questions.length > 0))
    )
  }, [exam])

  // Offset câu hỏi toàn cục theo từng phần
  const computedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let running = 0
    if (Array.isArray(activeSections)) {
      activeSections.forEach((section: any) => {
        if (!section?.id) return
        offsets[section.id] = running
        const qCount =
          parseInt(section.questionCount) || (Array.isArray(section.questions) ? section.questions.length : 0) || 0
        running += qCount
      })
    }
    return offsets
  }, [activeSections])

  // Kiểm tra đề có câu hỏi KaTeX trực tiếp không
  const isKatexExam = useMemo(() => {
    if (!exam) return false
    if (exam.format === 'katex') return true

    // 1. ƯU TIÊN SỐ 1: Nếu cấu trúc đề thi có chứa mảng questions (có câu hỏi KaTeX chi tiết)
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

    // 2. Chỉ coi là PDF khi có URL hoặc drive_file_id THỰC SỰ hợp lệ (độ dài > 10 ký tự)
    const isValidDriveId =
      typeof exam.drive_file_id === 'string' &&
      exam.drive_file_id.trim().length > 10 &&
      !exam.drive_file_id.includes('null') &&
      !exam.drive_file_id.includes('undefined')
    const isValidPdfUrl =
      typeof exam.pdf_url === 'string' &&
      exam.pdf_url.trim().length > 10 &&
      !exam.pdf_url.includes('null')
    const hasPdf = Boolean(isValidDriveId || isValidPdfUrl || exam.format === 'pdf')

    if (hasPdf) return false

    return true
  }, [exam, activeSections])


  // Trạng thái xáo trộn đề KaTeX
  const [shuffledQuestionKeys, setShuffledQuestionKeys] = useState<string[] | null>(null)
  const [shuffledOptionMap, setShuffledOptionMap] = useState<Record<string, number[]> | null>(null)

  // Kiểm tra đề có bật đảo câu / đảo đáp án không (chỉ áp dụng đề KaTeX, đề PDF cố định)
  const shouldShuffleQuestions = useMemo(() => {
    if (!isKatexExam || !exam) return false
    return Boolean(exam.shuffle_questions || activeSections.some((s: any) => s?.shuffle_questions))
  }, [isKatexExam, exam, activeSections])

  const shouldShuffleOptions = useMemo(() => {
    if (!isKatexExam || !exam) return false
    return Boolean(exam.shuffle_options || activeSections.some((s: any) => s?.shuffle_options))
  }, [isKatexExam, exam, activeSections])

  // Cờ kiểm tra đề thi có yêu cầu tài khoản VIP không
  const isExamVip = useMemo(() => {
    if (!exam) return false
    return Boolean(
      exam.is_vip ||
      activeSections.some((s: any) => s?.is_vip) ||
      exam.exam_structure?.[0]?.is_vip
    )
  }, [exam, activeSections])

  // Danh sách phẳng các câu hỏi ban đầu theo thứ tự đề gốc
  const baseFlatQuestions = useMemo(() => {
    const list: Array<{
      key: string
      sectionId: string
      sectionName: string
      sectionTotalPoints?: number
      qIdx: number
      globalNum: number
      label: string
      qData: any
      type: string
    }> = []

    if (!Array.isArray(activeSections)) return list

    activeSections.forEach((section: any, sIdx: number) => {
      if (!section) return
      const qCount =
        parseInt(section.questionCount) || (Array.isArray(section.questions) ? section.questions.length : 0) || 0
      const offset = (computedOffsets && computedOffsets[section.id]) || 0
      for (let i = 0; i < qCount; i++) {
        const key = `${section.id || sIdx}-${i}`
        const rawQData = Array.isArray(section.questions) ? section.questions[i] : null
        const qData = rawQData ? normalizeLatexQuestion(rawQData) : null
        let qType = qData?.type || section.type || 'single_choice'
        if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
          const range = section.mixedRanges.find(
            (r: any) => i + 1 >= (Number(r?.start) || 0) && i + 1 <= (Number(r?.end) || 999)
          )
          if (range?.type) qType = range.type
        }
        list.push({
          key,
          sectionId: section.id || `sec-${sIdx}`,
          sectionName: section.name || section.title || `Phần ${sIdx + 1}`,
          sectionTotalPoints: section.totalPoints,
          qIdx: i,
          globalNum: offset + i + 1,
          label: `Câu ${offset + i + 1}`,
          qData,
          type: qType,
        })
      }
    })

    return list
  }, [activeSections, computedOffsets])

  // Khởi tạo hoặc đọc thứ tự xáo trộn đề / đáp án đã lưu
  useEffect(() => {
    if (!exam?.id || baseFlatQuestions.length === 0) return

    const userKey = currentUser?.id || 'guest'
    const storageKeyQ = `senexam_q_order_${exam.id}_${userKey}`
    const storageKeyOpt = `senexam_opt_order_${exam.id}_${userKey}`

    // 1. XỬ LÝ ĐẢO THỨ TỰ CÂU HỎI
    if (shouldShuffleQuestions) {
      try {
        const savedQOrder = localStorage.getItem(storageKeyQ)
        if (savedQOrder) {
          const parsed = JSON.parse(savedQOrder)
          if (Array.isArray(parsed) && parsed.length === baseFlatQuestions.length) {
            setShuffledQuestionKeys(parsed)
          } else {
            throw new Error('invalid')
          }
        } else {
          const keys = baseFlatQuestions.map((q) => q.key)
          for (let i = keys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[keys[i], keys[j]] = [keys[j], keys[i]]
          }
          localStorage.setItem(storageKeyQ, JSON.stringify(keys))
          setShuffledQuestionKeys(keys)
        }
      } catch {
        const keys = baseFlatQuestions.map((q) => q.key)
        for (let i = keys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[keys[i], keys[j]] = [keys[j], keys[i]]
        }
        setShuffledQuestionKeys(keys)
      }
    } else {
      setShuffledQuestionKeys(null)
    }

    // 2. XỬ LÝ ĐẢO CÁC ĐÁP ÁN TRONG CÂU
    if (shouldShuffleOptions) {
      try {
        const savedOptOrder = localStorage.getItem(storageKeyOpt)
        let optMap: Record<string, number[]> = {}
        if (savedOptOrder) {
          optMap = JSON.parse(savedOptOrder)
        }
        baseFlatQuestions.forEach((q) => {
          if ((q.type === 'single_choice' || q.type === 'multiple_choice' || !q.type) && Array.isArray(q.qData?.options)) {
            const optLen = q.qData.options.length
            if (!optMap[q.key] || optMap[q.key].length !== optLen) {
              const arr = Array.from({ length: optLen }, (_, idx) => idx)
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
              }
              optMap[q.key] = arr
            }
          }
        })
        localStorage.setItem(storageKeyOpt, JSON.stringify(optMap))
        setShuffledOptionMap(optMap)
      } catch {
        const optMap: Record<string, number[]> = {}
        baseFlatQuestions.forEach((q) => {
          if ((q.type === 'single_choice' || q.type === 'multiple_choice' || !q.type) && Array.isArray(q.qData?.options)) {
            const optLen = q.qData.options.length
            const arr = Array.from({ length: optLen }, (_, idx) => idx)
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[arr[i], arr[j]] = [arr[j], arr[i]]
            }
            optMap[q.key] = arr
          }
        })
        setShuffledOptionMap(optMap)
      }
    } else {
      setShuffledOptionMap(null)
    }
  }, [exam?.id, currentUser?.id, baseFlatQuestions, shouldShuffleQuestions, shouldShuffleOptions])

  // flatQuestions thực tế được hiển thị (đã qua xáo trộn nếu có bật và viết lại đáp án chuẩn theo vị trí mới)
  const flatQuestions = useMemo(() => {
    let list = baseFlatQuestions
    if (shouldShuffleQuestions && shuffledQuestionKeys && shuffledQuestionKeys.length === baseFlatQuestions.length) {
      const keyMap = new Map(baseFlatQuestions.map((q) => [q.key, q]))
      const reordered: typeof baseFlatQuestions = []
      shuffledQuestionKeys.forEach((key, idx) => {
        const item = keyMap.get(key)
        if (item) {
          reordered.push({
            ...item,
            globalNum: idx + 1,
            label: `Câu ${idx + 1}`,
          })
        }
      })
      if (reordered.length === baseFlatQuestions.length) {
        list = reordered
      }
    }

    // ========================================================
    // HỆ THỐNG VIẾT LẠI ĐÚNG VỊ TRÍ CÂU ĐÁP ÁN ĐÚNG KHI ĐẢO ĐỀ / ĐẢO ĐÁP ÁN
    // ========================================================
    const parseOrigIndex = (val: any): number => {
      if (val === undefined || val === null) return -1
      if (typeof val === 'number') return val
      const s = String(val).trim().toUpperCase()
      if (s.length === 1 && s >= 'A' && s <= 'Z') {
        return s.charCodeAt(0) - 65
      }
      const num = parseInt(s, 10)
      if (!isNaN(num)) return num
      return -1
    }

    return list.map((item) => {
      const isChoiceType = item.type === 'single_choice' || item.type === 'multiple_choice' || !item.type
      const rawOptions = item.qData?.options
      const hasOptions = Array.isArray(rawOptions) && rawOptions.length > 0
      const optOrder = shouldShuffleOptions && shuffledOptionMap ? shuffledOptionMap[item.key] : null

      // 1. Viết lại danh sách phương án lựa chọn theo vị trí hiển thị thực tế
      let effectiveOptions = rawOptions
      if (isChoiceType && hasOptions && optOrder && optOrder.length === rawOptions.length) {
        effectiveOptions = optOrder.map((origIdx) => rawOptions[origIdx])
      }

      // 2. Lấy đáp án đúng ban đầu trong cơ sở dữ liệu
      const origCorrectAns =
        item.qData?.correctAnswer ??
        activeSections.find((s: any) => s.id === item.sectionId)?.correctAnswers?.[item.qIdx]

      // 3. Viết lại vị trí đáp án đúng chính xác theo vị trí mới của phương án
      let effectiveCorrectAnswer = origCorrectAns

      if (
        isChoiceType &&
        hasOptions &&
        optOrder &&
        optOrder.length === rawOptions.length &&
        origCorrectAns !== undefined &&
        origCorrectAns !== null &&
        origCorrectAns !== ''
      ) {
        if (item.type === 'multiple_choice') {
          // Xử lý câu nhiều đáp án đúng (ví dụ ['A', 'C'] hoặc 'A, C')
          const origList: any[] = Array.isArray(origCorrectAns)
            ? origCorrectAns
            : String(origCorrectAns).split(/[,;]/).map((s) => s.trim().toUpperCase())

          const newLetters = origList
            .map((ansItem) => {
              const origIdx = parseOrigIndex(ansItem)
              if (origIdx >= 0) {
                const newSlotIdx = optOrder.indexOf(origIdx)
                if (newSlotIdx !== -1) {
                  return String.fromCharCode(65 + newSlotIdx)
                }
              }
              return String(ansItem).trim().toUpperCase()
            })
            .sort()

          effectiveCorrectAnswer = Array.isArray(origCorrectAns) ? newLetters : newLetters.join(', ')
        } else {
          // Xử lý câu 1 đáp án (single_choice: 'A', 'B', 'C', 'D'...)
          const origIdx = parseOrigIndex(origCorrectAns)
          if (origIdx >= 0) {
            const newSlotIdx = optOrder.indexOf(origIdx)
            if (newSlotIdx !== -1) {
              effectiveCorrectAnswer = String.fromCharCode(65 + newSlotIdx)
            }
          }
        }
      }

      return {
        ...item,
        effectiveOptions: effectiveOptions || rawOptions,
        effectiveCorrectAnswer,
        origCorrectAns,
        qData: {
          ...item.qData,
          options: effectiveOptions || rawOptions,
          correctAnswer: effectiveCorrectAnswer,
          originalCorrectAnswer: origCorrectAns,
        },
      }
    })
  }, [baseFlatQuestions, shouldShuffleQuestions, shuffledQuestionKeys, shouldShuffleOptions, shuffledOptionMap, activeSections])

  const questionMeta = useMemo(() => {
    return {
      totalCount: flatQuestions.length,
      flatList: flatQuestions,
    }
  }, [flatQuestions])

  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((k) => {
      if (k.startsWith('_')) return false
      const val = answers[k]
      if (val === undefined || val === null || val === '') return false
      if (typeof val === 'object' && Object.keys(val).length === 0) return false
      return true
    }).length
  }, [answers])

  // Hàm đánh giá câu trả lời Đúng / Sai
  const evaluateAnswer = (type: string, studentAns: any, correctAns: any) => {
    if (studentAns === undefined || studentAns === null || studentAns === '') {
      return { isCorrect: false, scorePercent: 0 }
    }

    if (type === 'true_false') {
      let correctSubCount = 0
      ;['a', 'b', 'c', 'd'].forEach((sub, sIdx) => {
        let sVal = ''
        if (studentAns && typeof studentAns === 'object' && !Array.isArray(studentAns)) {
          sVal = String(studentAns[sub] || studentAns[sub.toUpperCase()] || studentAns[sIdx] || '').toUpperCase()
        } else if (Array.isArray(studentAns)) {
          sVal = String(studentAns[sIdx] || '').toUpperCase()
        }

        let cVal = ''
        if (correctAns && typeof correctAns === 'object' && !Array.isArray(correctAns)) {
          cVal = String(correctAns[sub] || correctAns[sub.toUpperCase()] || correctAns[sIdx] || '').toUpperCase()
        } else if (Array.isArray(correctAns)) {
          cVal = String(correctAns[sIdx] || '').toUpperCase()
        } else if (typeof correctAns === 'string') {
          const cleaned = correctAns.replace(/[\s,;-]+/g, '')
          if (cleaned.length === 4) cVal = cleaned[sIdx].toUpperCase()
        }

        const sT = sVal === 'Đ' || sVal === 'D' || sVal === 'T' || sVal === 'TRUE' || sVal === '1'
        const sF = sVal === 'S' || sVal === 'F' || sVal === 'FALSE' || sVal === '0'
        const cT = cVal === 'Đ' || cVal === 'D' || cVal === 'T' || cVal === 'TRUE' || cVal === '1'
        const cF = cVal === 'S' || cVal === 'F' || cVal === 'FALSE' || cVal === '0'
        if ((sT && cT) || (sF && cF)) correctSubCount++
      })
      const isCorrect = correctSubCount === 4
      let scorePercent = 0
      if (correctSubCount === 1) scorePercent = 0.1
      else if (correctSubCount === 2) scorePercent = 0.25
      else if (correctSubCount === 3) scorePercent = 0.5
      else if (correctSubCount === 4) scorePercent = 1.0
      return { isCorrect, scorePercent, correctSubCount }
    }

    if (type === 'multiple_choice') {
      const sArr = Array.isArray(studentAns)
        ? studentAns.map((v: any) => String(v).trim().toUpperCase())
        : []
      const cArr = Array.isArray(correctAns)
        ? correctAns.map((v: any) => String(v).trim().toUpperCase())
        : String(correctAns || '')
            .split(/[,;]/)
            .map((v: any) => v.trim().toUpperCase())
            .filter(Boolean)
      if (sArr.length > 0 && sArr.length === cArr.length && sArr.every((v) => cArr.includes(v))) {
        return { isCorrect: true, scorePercent: 1.0 }
      }
      return { isCorrect: false, scorePercent: 0 }
    }

    // single_choice hoặc short_answer
    const sStr = String(studentAns).trim().toUpperCase().replace(/\s+/g, '')
    const cStr = String(correctAns || '').trim().toUpperCase().replace(/\s+/g, '')
    const sNorm = sStr.replace(',', '.')
    const cNorm = cStr.replace(',', '.')
    const isCorrect = sStr.length > 0 && (sStr === cStr || sNorm === cNorm)
    return { isCorrect, scorePercent: isCorrect ? 1.0 : 0 }
  }

  // Định dạng hiển thị đáp án đúng
  const formatCorrectAnswerDisplay = (type: string, correctAns: any) => {
    if (!correctAns) return 'Chưa có'
    if (type === 'true_false') {
      if (correctAns && typeof correctAns === 'object' && !Array.isArray(correctAns)) {
        const a = correctAns.a || correctAns.A || '?'
        const b = correctAns.b || correctAns.B || '?'
        const c = correctAns.c || correctAns.C || '?'
        const d = correctAns.d || correctAns.D || '?'
        return `a: ${a}, b: ${b}, c: ${c}, d: ${d}`
      }
      if (Array.isArray(correctAns) && correctAns.length >= 4) {
        return `a: ${correctAns[0] || '?'}, b: ${correctAns[1] || '?'}, c: ${correctAns[2] || '?'}, d: ${correctAns[3] || '?'}`
      }
    }
    if (Array.isArray(correctAns)) {
      return correctAns.join(', ')
    }
    return String(correctAns)
  }

  // Xử lý nộp bài & chấm điểm
  const handleSubmitExam = async () => {
    setShowSubmitModal(false)
    setSubmitting(true)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Phiên đăng nhập đã hết hạn')

      let totalPoints = 0
      let hasEssay = false
      const detailedScores: Record<string, number> = {}

      activeSections.forEach((section: any, sIdx: number) => {
        const qCount = parseInt(section.questionCount) || (section.questions?.length) || 1
        const isAutoDivide = section.scoringMode !== 'custom' && section.scoringMode !== 'custom_points'

        let secPoints = Number(section.totalPoints ?? section.sectionTotalPoints)
        if (!secPoints || isNaN(secPoints)) {
          if (exam?.exam_type === 'HSA') secPoints = qCount || 50
          else if (exam?.exam_type === 'TSA') secPoints = Math.round(100 / (activeSections.length || 1))
          else secPoints = 10
        }
        const perQuestionPoints = secPoints / qCount

        Array.from({ length: qCount }).forEach((_, qIdx) => {
          const key = `${section.id || sIdx}-${qIdx}`
          const customVal = Number(section.customPoints?.[qIdx] ?? section.pointsPerQuestion?.[qIdx])
          const qPoint = isAutoDivide ? perQuestionPoints : (!isNaN(customVal) && customVal > 0 ? customVal : perQuestionPoints)
          let earned = 0

          let currentType = section.questions?.[qIdx]?.type || section.type || 'single_choice'
          if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
            const range = section.mixedRanges.find((r: any) => qIdx + 1 >= r.start && qIdx + 1 <= r.end)
            if (range) currentType = range.type || 'single_choice'
          }

          if (currentType === 'essay') {
            hasEssay = true
          } else {
            const studentAns = answers[key]
            const qItem = flatQuestions.find((q: any) => q.key === key)
            const correctAns =
              qItem?.effectiveCorrectAnswer ??
              qItem?.qData?.correctAnswer ??
              section.questions?.[qIdx]?.correctAnswer ??
              (section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)])

            const evaluation = evaluateAnswer(currentType, studentAns, correctAns)
            earned = qPoint * evaluation.scorePercent
          }

          detailedScores[key] = parseFloat(earned.toFixed(2))
          totalPoints += detailedScores[key]
        })
      })

      const finalScore = parseFloat(totalPoints.toFixed(2))
      const timeSpentSeconds = (exam.duration || 50) * 60 - Math.max(0, timeLeft)

      // Lưu ánh xạ đáp án chuẩn thực tế (sau khi đảo vị trí nếu có) để phục vụ xem lại lịch sử
      const effectiveCorrectAnswersMap: Record<string, any> = {}
      // Lưu mảng options thực tế hiển thị cho học sinh (đã đảo nếu có) để xem lại chuẩn 100%
      const effectiveOptionsMap: Record<string, any[]> = {}
      // Lưu danh sách keys câu hỏi theo đúng thứ tự hiển thị thực tế khi thi
      const displayedQuestionKeys: string[] = flatQuestions.map((q: any) => q.key)

      flatQuestions.forEach((q: any) => {
        if (q.key) {
          if (q.effectiveCorrectAnswer !== undefined) {
            effectiveCorrectAnswersMap[q.key] = q.effectiveCorrectAnswer
          }
          const opts = q.effectiveOptions || q.qData?.options
          if (Array.isArray(opts)) {
            effectiveOptionsMap[q.key] = opts
          }
        }
      })

      const submissionAnswers = {
        ...answers,
        _effectiveCorrectAnswers: effectiveCorrectAnswersMap,
        _shuffledQuestionKeys: displayedQuestionKeys,
        _shuffledOptionMap: shuffledOptionMap || null,
        _effectiveOptionsMap: effectiveOptionsMap,
      }

      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .insert({
          exam_id: exam.id,
          user_id: user.id,
          answers: submissionAnswers,
          score: finalScore,
          detailed_scores: detailedScores,
          time_spent: timeSpentSeconds,
          is_graded: !hasEssay,
        })
        .select('id')
        .single()

      if (subError) throw subError

      // Xóa bản nháp lưu tạm và thứ tự xáo trộn đề
      localStorage.removeItem(`senexam_draft_${exam.id}_${user.id}`)
      localStorage.removeItem(`senexam_q_order_${exam.id}_${user.id}`)
      localStorage.removeItem(`senexam_opt_order_${exam.id}_${user.id}`)

      setSubmittedResult({
        submissionId: subData?.id || '',
        score: finalScore,
      })
    } catch (err: any) {
      alert(`Lỗi nộp bài: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    handleSubmitExam()
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        title="SenExam Phòng Thi 2.0"
        subtitle="Đang chuẩn bị đề thi & kết nối phòng thi ảo an toàn..."
      />
    )
  }

  // PHÒNG THI ĐÁNH GIÁ NĂNG LỰC HSA (ĐHQGHN)
  const isHsaFormat = Boolean(
    exam?.exam_type === 'HSA' ||
    exam?.format === 'hsa' ||
    String(exam?.title || '').toUpperCase().includes('HSA') ||
    String(exam?.title || '').toUpperCase().includes('ĐÁNH GIÁ NĂNG LỰC') ||
    String(exam?.title || '').toUpperCase().includes('ĐGNL')
  )

  if (isHsaFormat && (!isExamVip || isUserVip)) {
    return (
      <HsaExamRoom
        exam={exam}
        studentInfo={studentInfo}
        onExit={() => router.push('/new-sen-ground')}
      />
    )
  }

  // PHÒNG THI ĐẠI HỌC PORTAL UET (ĐỘC QUYỀN ĐỀ THI CÓ TAG ĐẠI HỌC)
  const isUniversityFormat = isUniversityExam(exam)

  if (isUniversityFormat && (!isExamVip || isUserVip)) {
    return (
      <UniversityExamRoom
        exam={exam}
        studentInfo={{
          id: studentInfo.id,
          name: studentInfo.name,
          email: studentInfo.email,
          avatar: studentInfo.avatar,
          studentId: '2202' + (studentInfo.id ? studentInfo.id.slice(0, 4) : '0001'),
          school: 'Trường Đại học Công nghệ (VNU-UET)',
        }}
        onExit={() => router.push('/new-sen-ground')}
      />
    )
  }

  // PHÒNG CHỜ BẮT ĐẦU THI
  if (!hasStarted) {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 p-4 font-sans`}
        style={{
          ...themeVars,
          background: isDark
            ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
            : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
        }}
      >
        <div className="w-full max-w-2xl rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-5">
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Thoát ra kho đề
            </Link>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isExamVip && (
                <span className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                  <Crown className="h-3 w-3" /> VIP Only
                </span>
              )}
              {isKatexExam ? (
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-bold border border-emerald-500/20">
                  ✨ KaTeX Trực Tiếp
                </span>
              ) : (
                <span className="rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-3 py-1 text-xs font-bold border border-sky-500/20">
                  📄 Đề PDF Truyền Thống
                </span>
              )}
              <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 text-xs font-bold border border-indigo-500/20">
                {exam?.exam_type || 'Đề thi'}
              </span>
              {shouldShuffleQuestions && (
                <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 text-xs font-bold border border-purple-500/20 flex items-center gap-1">
                  <Shuffle className="h-3 w-3" /> Đảo câu
                </span>
              )}
              {shouldShuffleOptions && (
                <span className="rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2.5 py-1 text-xs font-bold border border-violet-500/20 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Đảo đáp án
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md mb-4">
              <FileQuestion className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              {exam?.title || 'Đề thi SenExam'}
            </h1>
            <p className="mt-2 text-xs text-[#6B7280] dark:text-slate-400 font-semibold">
              Thời gian: <strong>{exam?.duration || 50} phút</strong> • Tổng số câu: <strong>{questionMeta.totalCount} câu</strong>
            </p>
          </div>

          {/* Candidate Card in Lobby */}
          <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center gap-3.5">
            {studentInfo.avatar ? (
              <img src={studentInfo.avatar} alt={studentInfo.name} className="h-12 w-12 rounded-xl object-cover border" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 text-white font-black text-lg flex items-center justify-center">
                {studentInfo.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Thí sinh dự thi:
              </span>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">{studentInfo.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">{studentInfo.school ? `${studentInfo.school} • Lớp ${studentInfo.grade}` : studentInfo.email}</p>
            </div>
          </div>

          {/* THÔNG BÁO PHIÊN LÀM BÀI TRƯỚC CHƯA KẾT THÚC */}
          {hasUnfinishedSession && Object.keys(answers).length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
                <AlertCircle className="h-4 w-4" />
                <span>Hệ thống phát hiện phiên làm bài dở dang trước đó</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Bạn có một phiên làm bài chưa kết thúc với <strong>{answeredCount} câu đã trả lời</strong> được lưu tự động. Bạn muốn nộp bài đã làm hay tiếp tục làm tiếp?
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setHasStarted(true)
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Tiếp tục làm bài
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSubmitExam()
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đồng ý nộp bài ngay
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Bạn có chắc muốn xóa toàn bộ câu trả lời cũ để làm lại từ đầu không?')) {
                      if (currentUser?.id) {
                        localStorage.removeItem(`senexam_draft_${examId}_${currentUser.id}`)
                        localStorage.removeItem(`senexam_q_order_${examId}_${currentUser.id}`)
                        localStorage.removeItem(`senexam_opt_order_${examId}_${currentUser.id}`)
                      }
                      setAnswers({})
                      setBookmarked({})
                      setRevealedAnswers({})
                      setHasUnfinishedSession(false)
                    }
                  }}
                  className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Làm lại từ đầu
                </button>
              </div>
            </div>
          )}

          {/* Quy chế phòng thi */}
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-[#4B5563] dark:text-slate-300 space-y-2">
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> Tính năng phòng thi mới:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>{isKatexExam ? 'Giao diện thi KaTeX chia 2 cột: Cột trái hiện đề & đáp án, cột phải hiện thông tin thí sinh & bảng câu hỏi.' : 'Giao diện xem đề song song phiếu trả lời.'}</li>
              <li>Hỗ trợ <strong>Chế độ luyện tập</strong>: Học sinh biết ngay Đúng/Sai và xem Lời giải chi tiết KaTeX khi chấp nhận câu trả lời.</li>
              <li>Tự động lưu bài làm và đếm ngược thời gian chính xác.</li>
            </ul>
          </div>

          {/* LỰA CHỌN CHẾ ĐỘ THI TRƯỚC KHI VÀO BÀI (KHÔNG THỂ THAY ĐỔI KHI ĐANG LÀM BÀI) */}
          <div className="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap className="h-4 w-4 text-amber-500" /> Lựa chọn chế độ làm bài:
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isStudyMode
                    ? '⚡ Chế độ Luyện tập: Kiểm tra đáp án & xem lời giải KaTeX ngay sau từng câu (sau khi kiểm tra sẽ khóa không chọn lại).'
                    : '🛡️ Chế độ Thi Chuẩn: Không hiện đáp án trong khi thi, tính giờ nghiêm túc và nộp bài để xem điểm tổng thể.'}
                </p>
              </div>

              {/* Nút bật/tắt dạng Switch Button */}
              <button
                type="button"
                onClick={() => setIsStudyMode(!isStudyMode)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer p-0.5 ${
                  isStudyMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title="Bật/Tắt chế độ luyện tập"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                    isStudyMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 2 Thẻ lựa chọn trực quan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsStudyMode(true)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                  isStudyMode
                    ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-200 shadow-xs'
                    : 'border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-black/5'
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isStudyMode ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-400'
                  }`}
                >
                  {isStudyMode && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>⚡ Chế độ Luyện Tập</span>
                    {isStudyMode && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded-md">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-85">
                    Biết Đúng/Sai tức thì & xem lời giải chi tiết KaTeX ngay khi xác nhận đáp án.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsStudyMode(false)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                  !isStudyMode
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-950 dark:text-indigo-200 shadow-xs'
                    : 'border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-black/5'
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    !isStudyMode ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-400'
                  }`}
                >
                  {!isStudyMode && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>🛡️ Chế độ Thi Chuẩn</span>
                    {!isStudyMode && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/20 px-1.5 py-0.2 rounded-md">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-85">
                    Mô phỏng thi thực tế, không lộ đáp án cho tới khi hoàn tất nộp bài.
                  </p>
                </div>
              </button>
            </div>

            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 italic">
              * Lưu ý: Chế độ làm bài thi được lựa chọn tại đây và sẽ được <strong>cố định</strong> trong suốt quá trình làm bài (không thể bật/tắt khi đã vào phòng thi).
            </p>
          </div>

          {/* Nút bắt đầu thi hoặc Paywall VIP */}
          {isExamVip && !isUserVip ? (
            <div className="mt-6 rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-transparent p-6 text-center space-y-4 shadow-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  👑 Đề Thi Đặc Quyền Dành Cho VIP
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  Đề thi này được thiết kế và biên soạn độc quyền cho học sinh nâng cấp gói VIP SenExam. Hãy nâng cấp tài khoản VIP để mở khóa đề thi và nhận toàn bộ lời giải chi tiết cùng kho tài liệu chuyên sâu!
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/new-vip"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95"
                >
                  <Crown className="h-4 w-4" /> Nâng Cấp VIP Ngay
                </Link>
                <Link
                  href="/new-exams"
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5"
                >
                  Xem đề miễn phí khác
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setHasStarted(true)
                  try {
                    const docEl = document.documentElement as any
                    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {})
                    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {})
                  } catch (e) {}
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Bắt đầu làm bài thi ngay <ChevronRight className="h-4 w-4" />
              </button>

              {/* CHỈ HIỂN THỊ NÚT PORTAL UET CHO ĐỀ THI CÓ TAG ĐẠI HỌC */}
              {isUniversityFormat && (
                <Link
                  href={`/university-exams/${examId}`}
                  className="px-4 py-3.5 rounded-2xl border border-sky-600/30 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs font-bold transition hover:bg-sky-100 flex items-center justify-center gap-1.5 shrink-0"
                  title="Mở đề thi với giao diện Portal UET (Góc vuông, cuộn dọc Moodle)"
                >
                  <img src="/uet-logo.png" alt="UET" className="w-4 h-4 object-contain inline" />
                  <span>Portal UET</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    )
  }

  const currentQ = flatQuestions[activeQuestionIdx] || flatQuestions[0]
  const currentSection = activeSections.find((s: any) => s.id === currentQ?.sectionId) || activeSections[0]

  // PHÒNG THI CHÍNH
  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} h-screen flex flex-col bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 font-sans overflow-hidden select-none`}
      style={themeVars}
    >
      {/* FLOATING HEADER */}
      <header className="h-16 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 px-4 sm:px-6 flex items-center justify-between backdrop-blur-xl z-20">
        {/* Left: Exam title */}
        <div className="flex items-center gap-3 max-w-sm sm:max-w-md">
          <button
            type="button"
            onClick={() => setShowExitConfirmModal(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105 cursor-pointer text-slate-700 dark:text-slate-200"
            title="Thoát và nộp bài thi"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="truncate">
            <h2 className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              {exam?.title || 'Đề thi'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
              <span>{exam?.exam_type || 'THPT'}</span>
              <span>•</span>
              <span>Đã làm {answeredCount}/{flatQuestions.length} câu</span>
              {isKatexExam && <span className="text-emerald-500 font-black">KaTeX Live</span>}
            </div>
          </div>
        </div>

        {/* Center: Timer Countdown */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-2xl px-4 py-1.5 border font-mono font-black text-sm sm:text-base shadow-inner ${
              timeLeft < 300
                ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const doc = document as any
              if (doc.fullscreenElement || doc.webkitFullscreenElement) {
                if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {})
                else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(() => {})
              } else {
                const docEl = document.documentElement as any
                if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {})
                else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {})
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Bật/Tắt Toàn màn hình"
          >
            <Maximize2 className="h-4 w-4 text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Nộp bài
          </button>
        </div>
      </header>

      {/* BODY: GIAO DIỆN THI MỚI (SPLIT VIEW) */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================== */}
        {/* CỘT TRÁI: ĐỀ THI & LỰA CHỌN ĐÁP ÁN (KATEX HOẶC PDF) */}
        {/* ======================================================== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/40 border-r border-black/10 dark:border-white/10">
          {isKatexExam ? (
            currentQ ? (
              /* GIAO DIỆN THI KATEX TRỰC TIẾP */
              <div className="flex-1 flex flex-col overflow-hidden">
              {/* Stepper Top Bar */}
              <div className="h-12 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-6 flex items-center justify-between backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="h-7 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                    Câu {currentQ.globalNum} / {flatQuestions.length}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                    {currentQ.sectionName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                    {currentQ.type === 'single_choice'
                      ? 'Trắc nghiệm đơn'
                      : currentQ.type === 'true_false'
                      ? 'Đúng / Sai 4 ý'
                      : currentQ.type === 'short_answer'
                      ? 'Điền số ngắn'
                      : 'Tự luận'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleBookmark(currentQ.key)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${
                      bookmarked[currentQ.key]
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-black/5'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {bookmarked[currentQ.key] ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={activeQuestionIdx <= 0}
                      onClick={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
                      className="h-8 w-8 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-30"
                      title="Câu trước"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={activeQuestionIdx >= flatQuestions.length - 1}
                      onClick={() => setActiveQuestionIdx((prev) => Math.min(flatQuestions.length - 1, prev + 1))}
                      className="h-8 w-8 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-30"
                      title="Câu sau"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Question Content & Answer Input Area (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
                {/* 1. NỘI DUNG ĐỀ BÀI (KATEX) */}
                <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center">
                        #
                      </span>
                      <h3
                        className="text-base sm:text-lg font-black text-slate-900 dark:text-white"
                        style={{ fontFamily: 'var(--font-newroom-heading)' }}
                      >
                        Đề bài câu hỏi số {currentQ.globalNum}
                      </h3>
                    </div>
                  </div>

                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                    <SafeMathRenderer
                      content={(() => {
                        const rawText = currentQ.qData?.text || currentQ.qData?.content || `Câu hỏi số ${currentQ.globalNum}`
                        if (currentQ.type === 'true_false') {
                          const splitPattern = /(?:^|\n|\r|\s{2,}|\$\s*|\.\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
                          const splitParts = rawText.split(splitPattern)
                          if (splitParts.length >= 5 && splitParts[0].trim()) {
                            return splitParts[0].trim()
                          }
                        }
                        return rawText
                      })()}
                    />
                  </div>
                </div>

                {/* 2. LỰA CHỌN ĐÁP ÁN */}
                <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h4
                      className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2"
                      style={{ fontFamily: 'var(--font-newroom-heading)' }}
                    >
                      <LayoutList className="h-4 w-4 text-indigo-500" />
                      Lựa chọn đáp án của bạn:
                    </h4>

                    {isStudyMode && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          ⚡ Chế độ Luyện tập bật
                        </span>
                        {revealedAnswers[currentQ.key] && (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center gap-1 shadow-2xs">
                            🔒 Đã khóa đáp án
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Render Options by Type */}
                  {/* TYPE: SINGLE CHOICE */}
                  {(currentQ.type === 'single_choice' || currentQ.type === 'multiple_choice' || !currentQ.type) && (
                    <div className="space-y-3">
                      {(() => {
                        const rawOpts = currentQ.effectiveOptions || currentQ.qData?.options
                        const optionsToRender: string[] =
                          Array.isArray(rawOpts) && rawOpts.length > 0
                            ? rawOpts
                            : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D']

                        const effectiveCorrect =
                          currentQ.effectiveCorrectAnswer ??
                          currentQ.qData?.correctAnswer ??
                          currentSection?.correctAnswers?.[currentQ.qIdx]

                        return optionsToRender.map((optContent, slotIdx) => {
                          const slotLetter = String.fromCharCode(65 + slotIdx)
                          const currentAns = answers[currentQ.key]
                          const isSelected =
                            currentQ.type === 'multiple_choice'
                              ? Array.isArray(currentAns) && currentAns.includes(slotLetter)
                              : currentAns === slotLetter

                          const isRevealed = isStudyMode && revealedAnswers[currentQ.key]
                          const isThisCorrect =
                            currentQ.type === 'multiple_choice'
                              ? Array.isArray(effectiveCorrect)
                                ? effectiveCorrect.includes(slotLetter)
                                : typeof effectiveCorrect === 'string' &&
                                  effectiveCorrect
                                    .split(/[,;]/)
                                    .map((s: string) => s.trim().toUpperCase())
                                    .includes(slotLetter)
                              : effectiveCorrect === slotLetter
                          const isThisWrong = isSelected && !isThisCorrect

                          return (
                            <button
                              key={`${currentQ.key}-${slotIdx}`}
                              type="button"
                              disabled={Boolean(isRevealed)}
                              onClick={() => {
                                if (isRevealed) return
                                if (currentQ.type === 'multiple_choice') {
                                  const prevArr = Array.isArray(currentAns) ? currentAns : []
                                  const nextArr = prevArr.includes(slotLetter)
                                    ? prevArr.filter((x: string) => x !== slotLetter)
                                    : [...prevArr, slotLetter].sort()
                                  handleAnswer(currentQ.key, nextArr)
                                } else {
                                  handleAnswer(currentQ.key, slotLetter)
                                }
                              }}
                              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                                isRevealed
                                  ? isThisCorrect
                                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 ring-2 ring-emerald-500/40 shadow-xs cursor-default'
                                    : isThisWrong
                                    ? 'border-rose-500 bg-rose-500/10 dark:bg-rose-500/20 ring-2 ring-rose-500/40 shadow-xs cursor-default'
                                    : 'border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] opacity-50 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/30 cursor-pointer'
                                  : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs cursor-pointer'
                              }`}
                            >
                              <span
                                className={`h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition ${
                                  isRevealed
                                    ? isThisCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : isThisWrong
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-black/10 dark:bg-white/10 text-slate-500'
                                    : isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isRevealed && isThisCorrect ? (
                                  <Check className="h-4 w-4" />
                                ) : isRevealed && isThisWrong ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  slotLetter
                                )}
                              </span>
                              <div className="flex-1 pt-1 prose prose-sm dark:prose-invert max-w-none text-sm font-semibold text-slate-800 dark:text-slate-200">
                                <SafeMathRenderer content={optContent || `Phương án ${slotLetter}`} gfm={false} />
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  )}

                  {/* TYPE: TRUE / FALSE (4 Ý) */}
                  {currentQ.type === 'true_false' && (
                    <div className="space-y-3">
                      {['a', 'b', 'c', 'd'].map((sub, sIdx) => {
                        const rawOpts = currentQ.effectiveOptions || currentQ.qData?.options
                        let subContent = ''

                        // 1. Kiểm tra options dạng Array (options[0], options[1]...)
                        if (Array.isArray(rawOpts)) {
                          subContent = rawOpts[sIdx] || ''
                        } else if (rawOpts && typeof rawOpts === 'object') {
                          // 2. Kiểm tra options dạng Object ({ a: '...', b: '...' } hoặc { A: '...', B: '...' })
                          subContent =
                            rawOpts[sub] ||
                            rawOpts[sub.toUpperCase()] ||
                            rawOpts[sIdx] ||
                            rawOpts[String(sIdx)] ||
                            ''
                        }

                        // 3. Fallback: Kiểm tra trong subQuestions (dạng AI sentaobai: subQuestions: [{ text: '...' }])
                        if (!subContent && currentQ.qData?.subQuestions && Array.isArray(currentQ.qData.subQuestions)) {
                          const sq = currentQ.qData.subQuestions[sIdx]
                          subContent = typeof sq === 'object' ? sq?.text || sq?.question || sq?.content : sq
                        }
                        // 4. Fallback: Kiểm tra trong statements hoặc items
                        if (!subContent && currentQ.qData?.statements && Array.isArray(currentQ.qData.statements)) {
                          const st = currentQ.qData.statements[sIdx]
                          subContent = typeof st === 'object' ? st?.text || st?.statement : st
                        }
                        if (!subContent && currentQ.qData?.items && Array.isArray(currentQ.qData.items)) {
                          const it = currentQ.qData.items[sIdx]
                          subContent = typeof it === 'object' ? it?.text || it?.content : it
                        }

                        // 5. Fallback mạnh mẽ: Nếu đề chưa tách được options mà vẫn còn nguyên trong question text
                        if (!subContent && (currentQ.qData?.text || currentQ.qData?.content)) {
                          const fullText = String(currentQ.qData?.text || currentQ.qData?.content || '')
                          const splitPattern = /(?:^|\n|\r|\s{2,}|\$\s*|\.\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/gi
                          const parts = fullText.split(splitPattern)
                          if (parts.length >= 5 && parts[sIdx + 1]) {
                            subContent = parts[sIdx + 1].trim()
                          }
                        }

                        if (!subContent) {
                          subContent = `Mệnh đề ${sub})`
                        }

                        // Làm sạch tiền tố trùng lặp (ví dụ "a) ..." hoặc "a. ...") để giao diện gọn gàng
                        const cleanSubContent = subContent.replace(/^(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i, '') || subContent

                        const currentAns = answers[currentQ.key]
                        let val = ''
                        if (currentAns && typeof currentAns === 'object' && !Array.isArray(currentAns)) {
                          val = currentAns[sub] || currentAns[sub.toUpperCase()] || currentAns[sIdx] || ''
                        } else if (Array.isArray(currentAns)) {
                          val = currentAns[sIdx] || ''
                        }
                        if (val) {
                          const vu = String(val).toUpperCase()
                          if (vu === 'Đ' || vu === 'D' || vu === 'T' || vu === 'TRUE' || vu === '1') val = 'Đ'
                          else if (vu === 'S' || vu === 'F' || vu === 'FALSE' || vu === '0') val = 'S'
                        }

                        const isRevealed = isStudyMode && revealedAnswers[currentQ.key]
                        
                        let correctSub = ''
                        const rawCA =
                          currentQ.effectiveCorrectAnswer ??
                          currentQ.qData?.correctAnswer ??
                          currentSection?.correctAnswers?.[currentQ.qIdx]

                        if (rawCA && typeof rawCA === 'object' && !Array.isArray(rawCA)) {
                          correctSub = rawCA[sub] || rawCA[sub.toUpperCase()] || rawCA[sIdx] || ''
                        } else if (Array.isArray(rawCA)) {
                          correctSub = rawCA[sIdx] || ''
                        } else if (typeof rawCA === 'string') {
                          const cleaned = rawCA.replace(/[\s,;-]+/g, '')
                          if (cleaned.length === 4) {
                            correctSub = cleaned[sIdx]
                          }
                        }

                        if (correctSub) {
                          const cu = String(correctSub).toUpperCase()
                          if (cu === 'Đ' || cu === 'D' || cu === 'T' || cu === 'TRUE' || cu === '1') correctSub = 'Đ'
                          else if (cu === 'S' || cu === 'F' || cu === 'FALSE' || cu === '0') correctSub = 'S'
                        }

                        return (
                          <div
                            key={sub}
                            className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <span className="h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 uppercase">
                                  {sub}
                                </span>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  <SafeMathRenderer content={cleanSubContent} gfm={false} />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={Boolean(isRevealed)}
                                  onClick={() => {
                                    if (isRevealed) return
                                    const nextAns = typeof currentAns === 'object' && currentAns !== null && !Array.isArray(currentAns)
                                      ? { ...currentAns, [sub]: 'Đ' }
                                      : { [sub]: 'Đ' }
                                    handleAnswer(currentQ.key, nextAns)
                                  }}
                                  className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                                    isRevealed ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                  } ${
                                    val === 'Đ'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-black/5 disabled:opacity-50'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(isRevealed)}
                                  onClick={() => {
                                    if (isRevealed) return
                                    const nextAns = typeof currentAns === 'object' && currentAns !== null && !Array.isArray(currentAns)
                                      ? { ...currentAns, [sub]: 'S' }
                                      : { [sub]: 'S' }
                                    handleAnswer(currentQ.key, nextAns)
                                  }}
                                  className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                                    isRevealed ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                  } ${
                                    val === 'S'
                                      ? 'bg-rose-600 text-white shadow-sm'
                                      : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-black/5 disabled:opacity-50'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>

                            {isRevealed && (
                              <div className="text-[11px] pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-slate-500">
                                <span>
                                  Đáp án chuẩn:{' '}
                                  <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                                    {correctSub === 'Đ' ? 'Đúng' : correctSub === 'S' ? 'Sai' : (correctSub || 'Chưa có')}
                                  </strong>
                                </span>
                                {val && (
                                  <span className={val === correctSub ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                    {val === correctSub ? '✓ Chính xác' : '✗ Chưa đúng'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* TYPE: SHORT ANSWER */}
                  {currentQ.type === 'short_answer' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        disabled={Boolean(isStudyMode && revealedAnswers[currentQ.key])}
                        placeholder={isStudyMode && revealedAnswers[currentQ.key] ? "Đã khóa kết quả sau khi kiểm tra" : "Nhập kết quả số hoặc biểu thức của bạn..."}
                        value={answers[currentQ.key] || ''}
                        onChange={(e) => handleAnswer(currentQ.key, e.target.value)}
                        className="h-12 w-full rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm font-black font-mono outline-none focus:border-indigo-500 shadow-inner disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04] disabled:cursor-not-allowed disabled:text-slate-600 dark:disabled:text-slate-300"
                      />
                    </div>
                  )}

                  {/* TYPE: ESSAY */}
                  {currentQ.type === 'essay' && (
                    <textarea
                      rows={4}
                      disabled={Boolean(isStudyMode && revealedAnswers[currentQ.key])}
                      placeholder={isStudyMode && revealedAnswers[currentQ.key] ? "Đã khóa lời giải sau khi kiểm tra" : "Gõ lời giải tóm tắt hoặc ghi chú..."}
                      value={answers[currentQ.key]?.text || answers[currentQ.key] || ''}
                      onChange={(e) => handleAnswer(currentQ.key, e.target.value)}
                      className="w-full rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-slate-800 p-4 text-xs font-medium outline-none focus:border-indigo-500 disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04] disabled:cursor-not-allowed disabled:text-slate-600 dark:disabled:text-slate-300"
                    />
                  )}

                  {/* CHẾ ĐỘ LUYỆN TẬP: NÚT CHẤP NHẬN CÂU TRẢ LỜI & XEM LỜI GIẢI NGAY */}
                  {isStudyMode && !revealedAnswers[currentQ.key] && (
                    <div className="pt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={!answers[currentQ.key]}
                        onClick={() => handleAcceptAnswer(currentQ.key)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Chấp Nhận Câu Trả Lời & Kiểm Tra Ngay
                      </button>
                    </div>
                  )}

                  {/* KẾT QUẢ ĐÁNH GIÁ & LỜI GIẢI KATEX CHI TIẾT */}
                  {isStudyMode && revealedAnswers[currentQ.key] && (
                    <div className="space-y-4 pt-3">
                      {(() => {
                        const correctOpt =
                          currentQ.effectiveCorrectAnswer ??
                          currentQ.qData?.correctAnswer ??
                          currentSection?.correctAnswers?.[currentQ.qIdx]
                        const studentAns = answers[currentQ.key]
                        const evalRes = evaluateAnswer(currentQ.type, studentAns, correctOpt)

                        return (
                          <>
                            <div
                              className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                                evalRes.isCorrect
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {evalRes.isCorrect ? (
                                  <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Check className="h-5 w-5" />
                                  </div>
                                ) : (
                                  <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <X className="h-5 w-5" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-black text-sm block">
                                    {evalRes.isCorrect ? 'Chính xác! Làm rất tốt 🎉' : 'Chưa chính xác!'}
                                  </span>
                                  <span className="text-xs opacity-80">
                                    Đáp án chuẩn:{' '}
                                    <strong className="underline">
                                      {formatCorrectAnswerDisplay(currentQ.type, correctOpt)}
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={activeQuestionIdx >= flatQuestions.length - 1}
                                onClick={() => {
                                  if (activeQuestionIdx < flatQuestions.length - 1) {
                                    setActiveQuestionIdx(activeQuestionIdx + 1)
                                  }
                                }}
                                className="rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs font-black shadow-xs hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-1 shrink-0 disabled:opacity-30"
                              >
                                Câu tiếp theo <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* LỜI GIẢI KATEX CHI TIẾT */}
                            {currentQ.qData?.explanation ? (
                              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/80 dark:from-slate-800/90 dark:via-slate-900/90 dark:to-slate-800/90 p-5 shadow-sm space-y-3 backdrop-blur-xl">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    <Sparkles className="h-4 w-4" /> Lời Giải Chi Tiết (KaTeX Sắc Nét)
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full">
                                    SenExam Solution Engine
                                  </span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                                  <SafeMathRenderer content={currentQ.qData.explanation} />
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                                💡 Đề thi chưa tích hợp lời giải KaTeX cho câu hỏi này.
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <FileQuestion className="h-12 w-12 text-slate-400 mb-3 opacity-60" />
              <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">Đề thi chưa có câu hỏi</h3>
              <p className="text-xs text-slate-500 mt-1">Đề thi này chưa được cấu hình câu hỏi KaTeX hoặc đang cập nhật.</p>
            </div>
          )
        ) : (
          /* GIAO DIỆN XEM PDF NẾU ĐỀ THI LÀ PDF */
            <div className="flex-1 flex flex-col bg-slate-900 relative">
              {cachedPdfUrl ? (
                <ProtectedExamPdfViewer
                  pdfUrl={cachedPdfUrl}
                  title={examData?.title || 'Đề thi (PDF)'}
                  isFullscreen={pdfFullscreen}
                  onToggleFullscreen={() => setPdfFullscreen(!pdfFullscreen)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400">
                  <div>
                    <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-bold text-sm">Đề thi hiển thị trực tiếp trên phiếu làm bài</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI: THÔNG TIN THÍ SINH & BẢNG TRUY CẬP NHANH CÂU HỎI */}
        {/* ======================================================== */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] xl:w-[460px] flex flex-col bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border-l border-black/10 dark:border-white/10 ${
            pdfFullscreen ? 'hidden' : 'flex'
          }`}
        >
          {/* 1. THẺ THÔNG TIN THÍ SINH */}
          <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {studentInfo.avatar ? (
                  <img
                    src={studentInfo.avatar}
                    alt={studentInfo.name}
                    className="h-12 w-12 rounded-2xl object-cover border-2 border-indigo-500/30 shadow-md shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-600 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    {studentInfo.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3
                    className="text-sm sm:text-base font-black truncate text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-newroom-heading)' }}
                  >
                    {studentInfo.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {studentInfo.school
                      ? `${studentInfo.school} • Lớp ${studentInfo.grade || '12'}`
                      : studentInfo.email || 'Thí sinh SenExam'}
                  </p>
                </div>
              </div>

              {/* Countdown Timer Badge */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border font-mono font-black text-xs sm:text-sm shrink-0 shadow-inner ${
                  timeLeft < 300
                    ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTimer(timeLeft)}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Tiến độ làm bài</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black">
                  {answeredCount} / {flatQuestions.length} câu (
                  {Math.round((answeredCount / (flatQuestions.length || 1)) * 100)}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((answeredCount / (flatQuestions.length || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Chế độ làm bài đã cố định (Không cho phép bật/tắt trong khi thi) */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Chế độ làm bài:
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  isStudyMode
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                }`}
                title="Chế độ làm bài thi đã được cố định từ trước khi bắt đầu"
              >
                {isStudyMode ? '⚡ Luyện tập (Cố định)' : '🛡️ Thi Chuẩn (Cố định)'}
              </span>
            </div>
          </div>

          {/* 2. BẢNG TRUY CẬP NHANH CÂU HỎI (QUESTION GRID PALETTE) */}
          <div
            className={`p-4 bg-white/80 dark:bg-slate-900/80 flex flex-col ${
              isKatexExam ? 'flex-1 overflow-hidden' : 'border-b border-black/10 dark:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5 shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Bảng Câu Hỏi ({flatQuestions.length} câu)
              </span>
              <div className="flex items-center gap-2.5 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" /> Đã làm
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Xem lại
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400" /> Chưa làm
                </span>
              </div>
            </div>

            <div
              className={`grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-6 gap-2 p-1 overflow-y-auto ${
                isKatexExam ? 'flex-1 pr-1.5' : 'max-h-48'
              }`}
            >
              {flatQuestions.map((item, idx) => {
                const ans = answers[item.key]
                const isAnswered =
                  ans !== undefined &&
                  ans !== null &&
                  ans !== '' &&
                  (typeof ans !== 'object' || Object.keys(ans).length > 0)
                const isMarked = bookmarked[item.key]
                const isActive = activeQuestionIdx === idx
                const isRevealed = isStudyMode && revealedAnswers[item.key]
                const correctOpt =
                  item.effectiveCorrectAnswer ??
                  item.qData?.correctAnswer ??
                  activeSections.find((s: any) => s.id === item.sectionId)?.correctAnswers?.[item.qIdx]
                const evalRes = isRevealed ? evaluateAnswer(item.type, ans, correctOpt) : null

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveQuestionIdx(idx)
                      if (!isKatexExam) {
                        const el = document.getElementById(`q-${item.key}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }}
                    className={`h-9 rounded-xl text-xs font-black flex flex-col items-center justify-center relative transition-all duration-150 ${
                      isActive
                        ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 scale-105 shadow-md z-10'
                        : ''
                    } ${
                      isRevealed
                        ? evalRes?.isCorrect
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-500 text-white'
                        : isMarked
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : isAnswered
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-black/10'
                    }`}
                  >
                    <span>{item.globalNum}</span>
                    {isMarked && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-200" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* NẾU LÀ ĐỀ THI PDF: HIỂN THỊ DANH SÁCH Ô TRẢ LỜI CÂU HỎI CUỘN DƯỚI ĐÂY */}
          {!isKatexExam && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {activeSections.map((section: any, sIdx: number) => {
                const offset = computedOffsets[section.id] || 0
                return (
                  <div key={section.id || sIdx} className="space-y-4">
                    <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-indigo-900 dark:text-indigo-200">
                      <h3 className="font-black text-sm" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                        {section.name || section.title || `Phần ${sIdx + 1}`}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {Array.from({ length: section.questionCount || 0 }).map((_, qIdx) => {
                        const key = `${section.id}-${qIdx}`
                        const globalNum = offset + qIdx + 1
                        const isMarked = bookmarked[key]
                        const currentAns = answers[key]
                        const options = ['A', 'B', 'C', 'D']

                        return (
                          <div
                            key={key}
                            id={`q-${key}`}
                            className={`rounded-2xl border p-4 transition-all ${
                              isMarked
                                ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
                                : 'border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                              <span className="text-xs font-black">Câu {globalNum}</span>
                              <button
                                type="button"
                                onClick={() => toggleBookmark(key)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                  isMarked ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                                }`}
                              >
                                {isMarked ? 'Đã đánh dấu' : 'Đánh dấu'}
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {options.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleAnswer(key, opt)}
                                  className={`h-9 min-w-9 px-3.5 rounded-xl text-xs font-black transition ${
                                    currentAns === opt
                                      ? 'bg-indigo-600 text-white shadow-md'
                                      : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700 hover:bg-black/5'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick jump navigation footer */}
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 flex gap-2">
            <button
              type="button"
              disabled={activeQuestionIdx <= 0}
              onClick={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
              className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Câu trước
            </button>
            <button
              type="button"
              disabled={activeQuestionIdx >= flatQuestions.length - 1}
              onClick={() => setActiveQuestionIdx((prev) => Math.min(flatQuestions.length - 1, prev + 1))}
              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow transition disabled:opacity-40"
            >
              Câu sau <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRM SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Send className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              Xác nhận nộp bài thi?
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Bạn đã trả lời <strong>{answeredCount}/{flatQuestions.length}</strong> câu hỏi. Hệ thống sẽ chấm điểm ngay lập tức.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2.5 text-xs font-bold"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2.5 text-xs font-black shadow"
              >
                Nộp ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMISSION RESULT MODAL */}
      {submittedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-8 shadow-2xl text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-emerald-500/20">
                Hoàn thành bài thi
              </span>
              <h2 className="text-2xl font-black mt-3" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                Chúc mừng bạn đã nộp bài!
              </h2>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Điểm số đạt được:
              </span>
              <p
                className="text-4xl font-black text-amber-600 dark:text-amber-400 mt-1"
                style={{ fontFamily: 'var(--font-newroom-heading)' }}
              >
                {submittedResult.score} <span className="text-lg font-bold text-[#6B7280]">/ 10</span>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {exam?.allow_review !== false ? (
                <Link
                  href={`/new-history-submissions/${submittedResult.submissionId}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  <Eye className="h-4 w-4" /> Xem Lời Giải & Chi Tiết
                </Link>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                  🔒 Giáo viên / Quản trị viên đã khóa xem lại đáp án cho đề thi này.
                </div>
              )}
              <Link
                href="/new-sen-ground?tab=history"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2.5 text-xs font-bold transition hover:bg-black/10"
              >
                Về Lịch Sử Bài Thi
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* EXIT & CONFIRM SUBMIT MODAL */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                  Xác nhận kết thúc & nộp bài
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Bạn có muốn rời khỏi phòng thi ngay bây giờ?
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                Khi xác nhận rời đi, hệ thống sẽ <strong>tự động nộp bài và chấm điểm</strong> dựa trên <strong>{answeredCount}/{flatQuestions.length} câu</strong> bạn đã trả lời.
              </p>
              <p className="text-[11px] text-slate-500">
                Thời gian làm bài còn lại: <strong className="font-mono text-amber-600 dark:text-amber-400">{formatTimer(timeLeft)}</strong>
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="flex-1 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-3 text-xs font-bold hover:bg-black/10 transition"
              >
                Quay lại làm tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false)
                  handleSubmitExam()
                }}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 text-xs font-black shadow-lg transition"
              >
                Đồng ý nộp bài & Thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

