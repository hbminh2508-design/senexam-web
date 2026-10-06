'use client'

import React, { useState, useEffect, useMemo, useRef, Component } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import ExamStudentProctorModal from '@/app/components/ExamStudentProctorModal'
import { senHeart } from '@/lib/senheart'
import {
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  Users,
  FileText,
  AlertCircle,
  Sparkles,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  Zap,
  Lock,
  Unlock,
  UploadCloud,
  Layers,
  BookOpen,
  Calculator,
  Compass,
  Edit3,
  Sliders,
  HelpCircle,
  RotateCcw,
  Eye,
  Settings,
  FolderOpen,
  GraduationCap,
  Brain,
  Hash,
  KeyRound,
  FileUp,
  Image as ImageIcon,
} from 'lucide-react'

// Render toán học KaTeX chuẩn xác
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

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
    console.warn('LaTeX Markdown render error caught:', error)
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
    const safeContent = typeof content === 'string' ? content : String(content ?? '')
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
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {safeContent}
          </ReactMarkdown>
        </div>
      </MarkdownErrorBoundary>
    )
  }
)
SafeMathRenderer.displayName = 'SafeMathRenderer'

const MathKeyButton = React.memo(
  ({ k, onInsert }: { k: any; onInsert: (val: string) => void }) => {
    return (
      <button
        type="button"
        onClick={() => onInsert(k.insert)}
        className="h-10 min-w-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-400 text-xs font-bold transition flex items-center justify-center shadow-sm active:scale-95 cursor-pointer"
        title={`Chèn: ${k.insert}`}
      >
        <SafeMathRenderer content={`$${k.display}$`} gfm={false} />
      </button>
    )
  }
)
MathKeyButton.displayName = 'MathKeyButton'

function getExamQuestionCount(exam: any): number {
  if (!exam) return 0
  try {
    let struct = exam.exam_structure
    if (typeof struct === 'string') {
      try {
        struct = JSON.parse(struct)
      } catch {
        struct = []
      }
    }
    if (Array.isArray(struct)) {
      return struct.reduce((acc: number, s: any) => {
        const count =
          parseInt(s?.questionCount) ||
          (Array.isArray(s?.questions) ? s.questions.length : 0) ||
          0
        return acc + count
      }, 0)
    }
    if (struct && typeof struct === 'object') {
      if (Array.isArray(struct.sections)) {
        return struct.sections.reduce((acc: number, s: any) => {
          const count =
            parseInt(s?.questionCount) ||
            (Array.isArray(s?.questions) ? s.questions.length : 0) ||
            0
          return acc + count
        }, 0)
      }
    }
  } catch {
    return 0
  }
  return 0
}

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-setup-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-setup-body' })

interface KatexQuestion {
  id: string
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  text: string
  options: string[]
  correctAnswer: any
  explanation: string
  points: number
}


function normalizeQuestionType(
  rawType: any,
  section?: any,
  qIdx?: number
): 'single_choice' | 'true_false' | 'short_answer' | 'essay' {
  // 1. Kiểm tra nếu có dải câu mixedRanges
  if (section?.mixedRanges && Array.isArray(section.mixedRanges) && qIdx !== undefined) {
    const range = section.mixedRanges.find(
      (r: any) => (qIdx + 1) >= (Number(r.start) || 1) && (qIdx + 1) <= (Number(r.end) || 999)
    )
    if (range?.type) {
      return normalizeQuestionType(range.type)
    }
  }

  // 2. Kiểm tra tùy chỉnh từng câu (custom questionTypes)
  if (section?.questionTypeMode === 'custom' && section?.questionTypes && qIdx !== undefined) {
    if (section.questionTypes[qIdx]) {
      return normalizeQuestionType(section.questionTypes[qIdx])
    }
  }

  // 3. Tự động nhận diện từ đáp án đúng (correctAnswers) nếu có
  if (section?.correctAnswers && qIdx !== undefined) {
    const ans = section.correctAnswers[qIdx] ?? section.correctAnswers[String(qIdx)]
    if (ans !== undefined && ans !== null) {
      if (typeof ans === 'object' && !Array.isArray(ans)) {
        const keys = Object.keys(ans)
        if (keys.some((k) => ['a', 'b', 'c', 'd'].includes(k.toLowerCase()))) {
          return 'true_false'
        }
      }
      if (typeof ans === 'string') {
        const trimmed = ans.trim()
        if (/^[A-D]$/i.test(trimmed)) {
          return 'single_choice'
        }
        if (/^[\d.,+-]+$/.test(trimmed) && trimmed.length > 0) {
          return 'short_answer'
        }
        if (trimmed.length > 30) {
          return 'essay'
        }
      }
    }
  }

  let type = (rawType || section?.type || '').toString().toLowerCase().trim()

  if (
    type.includes('true') ||
    type.includes('tf') ||
    type.includes('dung_sai') ||
    type.includes('đúng') ||
    type.includes('sai')
  ) {
    return 'true_false'
  }

  if (
    type.includes('short') ||
    type.includes('ngắn') ||
    type.includes('điền') ||
    type.includes('fill') ||
    type.includes('dien_so') ||
    type === 'sa'
  ) {
    return 'short_answer'
  }

  if (
    type.includes('essay') ||
    type.includes('luận') ||
    type.includes('tu_luan')
  ) {
    return 'essay'
  }

  const secName = (section?.name || '').toLowerCase()
  if (secName.includes('đúng') || secName.includes('sai') || secName.includes('phần ii') || secName.includes('phần 2')) {
    return 'true_false'
  }
  if (secName.includes('ngắn') || secName.includes('điền số') || secName.includes('phần iii') || secName.includes('phần 3')) {
    return 'short_answer'
  }
  if (secName.includes('tự luận')) {
    return 'essay'
  }

  return 'single_choice'
}

export interface SectionItem {
  id: string
  name: string
  totalPoints: number
  scoringMode: 'auto_divide' | 'custom_points'
  pointsPerQuestion?: Record<number, number>
  questionCount: number
  questionTypeMode: 'uniform' | 'custom' | 'mixed'
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay' | 'mixed'
  questionTypes?: Record<number, string>
  instructions: string
  instructionImage?: string
  correctAnswers: Record<string, any>
  optionsCount?: number
  mixedRanges?: Array<{
    start: number
    end: number
    type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
    optionsCount?: number
  }>
}

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'Kiểm tra 1 tiết', 'Học kỳ']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học' },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh' },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học' },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí' },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh' },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)' },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)' },
]

// BÀN PHÍM ẢO TOÁN HỌC (VIRTUAL MATH KEYBOARD) VỚI CÔNG THỨC RENDER ĐẸP
const MATH_KEYBOARD_TABS = [
  {
    id: 'basic',
    name: 'Cơ bản',
    keys: [
      { label: '\\frac{a}{b}', insert: '\\frac{a}{b}', display: '\\frac{a}{b}' },
      { label: '\\sqrt{x}', insert: '\\sqrt{x}', display: '\\sqrt{x}' },
      { label: '\\sqrt[n]{x}', insert: '\\sqrt[n]{x}', display: '\\sqrt[n]{x}' },
      { label: 'x^2', insert: '^{2}', display: 'x^2' },
      { label: 'x^n', insert: '^{n}', display: 'x^n' },
      { label: 'x_n', insert: '_{n}', display: 'x_n' },
      { label: '\\pm', insert: '\\pm', display: '\\pm' },
      { label: '\\times', insert: '\\times', display: '\\times' },
      { label: '\\div', insert: '\\div', display: '\\div' },
      { label: '\\ne', insert: '\\neq', display: '\\neq' },
      { label: '\\le', insert: '\\le', display: '\\le' },
      { label: '\\ge', insert: '\\ge', display: '\\ge' },
      { label: '\\approx', insert: '\\approx', display: '\\approx' },
      { label: '\\infty', insert: '\\infty', display: '\\infty' },
      { label: '\\pi', insert: '\\pi', display: '\\pi' },
    ],
  },
  {
    id: 'calculus',
    name: 'Giải tích',
    keys: [
      { label: '\\int', insert: '\\int_{a}^{b} f(x)dx', display: '\\int_a^b' },
      { label: '\\int f(x)', insert: '\\int f(x)dx', display: '\\int f(x)' },
      { label: '\\sum', insert: '\\sum_{i=1}^{n}', display: '\\sum_{i=1}^n' },
      { label: '\\lim', insert: '\\lim_{x \\to x_0}', display: '\\lim_{x\\to x_0}' },
      { label: 'f\'(x)', insert: 'f\'(x)', display: 'f\'(x)' },
      { label: '\\frac{dy}{dx}', insert: '\\frac{dy}{dx}', display: '\\frac{dy}{dx}' },
      { label: '\\in', insert: '\\in', display: '\\in' },
      { label: '\\notin', insert: '\\notin', display: '\\notin' },
      { label: '\\subset', insert: '\\subset', display: '\\subset' },
      { label: '\\cup', insert: '\\cup', display: '\\cup' },
      { label: '\\cap', insert: '\\cap', display: '\\cap' },
      { label: '\\varnothing', insert: '\\emptyset', display: '\\emptyset' },
      { label: '\\mathbb{R}', insert: '\\mathbb{R}', display: '\\mathbb{R}' },
    ],
  },
  {
    id: 'trig',
    name: 'Lượng giác & Ký hiệu',
    keys: [
      { label: '\\sin', insert: '\\sin(x)', display: '\\sin(x)' },
      { label: '\\cos', insert: '\\cos(x)', display: '\\cos(x)' },
      { label: '\\tan', insert: '\\tan(x)', display: '\\tan(x)' },
      { label: '\\cot', insert: '\\cot(x)', display: '\\cot(x)' },
      { label: '\\alpha', insert: '\\alpha', display: '\\alpha' },
      { label: '\\beta', insert: '\\beta', display: '\\beta' },
      { label: '\\gamma', insert: '\\gamma', display: '\\gamma' },
      { label: '\\theta', insert: '\\theta', display: '\\theta' },
      { label: '\\Delta', insert: '\\Delta', display: '\\Delta' },
      { label: '\\lambda', insert: '\\lambda', display: '\\lambda' },
      { label: '\\omega', insert: '\\omega', display: '\\omega' },
      { label: '^{\\circ}', insert: '^{\\circ}', display: '30^{\\circ}' },
    ],
  },
  {
    id: 'geometry',
    name: 'Hình học & Vector',
    keys: [
      { label: '\\vec{v}', insert: '\\vec{v}', display: '\\vec{v}' },
      { label: '\\vec{AB}', insert: '\\vec{AB}', display: '\\vec{AB}' },
      { label: '|\\vec{a}|', insert: '|\\vec{a}|', display: '|\\vec{a}|' },
      { label: '\\Delta ABC', insert: '\\Delta ABC', display: '\\Delta ABC' },
      { label: '\\widehat{A}', insert: '\\widehat{ABC}', display: '\\widehat{ABC}' },
      { label: '\\perp', insert: '\\perp', display: '\\perp' },
      { label: '\\parallel', insert: '\\parallel', display: '\\parallel' },
      { label: '\\equiv', insert: '\\equiv', display: '\\equiv' },
    ],
  },
]

class PageErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('Lỗi giao diện Cổng Thiết Lập Khóa Học:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FA] dark:bg-[#080D1A] p-6 text-center">
          <div className="max-w-md w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Không thể tải Cổng Soạn Đề</h2>
            <p className="text-xs text-slate-500">Đang phục hồi phiên làm việc bảo mật Sen Heart 1.2.1...</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { this.setState({ hasError: false }) }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition cursor-pointer"
              >
                Tiếp tục
              </button>
              <button
                type="button"
                onClick={() => { this.setState({ hasError: false }); if (typeof window !== 'undefined') window.location.reload() }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Tải lại trang
              </button>
              <Link
                href="/new-dashboard"
                prefetch={false}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-center transition cursor-pointer"
              >
                Về Dashboard
              </Link>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function SetupCourseMainContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<'admin' | 'collab' | 'teacher' | 'student'>('student')

  // Tabs: 'manage' (Quản lý đề) | 'create_katex' (Tạo đề KaTeX) | 'create_pdf' (Soạn đề PDF/SEB)
  const [activeTab, setActiveTab] = useState<'manage' | 'create_katex' | 'create_pdf'>('manage')

  // Danh sách đề thi
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [managingExamStudents, setManagingExamStudents] = useState<any | null>(null)

  // ==========================================
  // STATE: TẠO ĐỀ KATEX TRỰC TIẾP
  // ==========================================
  const [katexTitle, setKatexTitle] = useState('')
  const [katexSubject, setKatexSubject] = useState('Toán học')
  const [katexExamType, setKatexExamType] = useState('THPTQG')
  const [katexDuration, setKatexDuration] = useState('50')
  const [katexMaxScore, setKatexMaxScore] = useState('10')
  const [katexAllowReview, setKatexAllowReview] = useState(true)
  const [katexIsHidden, setKatexIsHidden] = useState(false)
  const [katexQuestions, setKatexQuestions] = useState<KatexQuestion[]>([
    {
      id: 'q-1',
      type: 'single_choice',
      text: 'Cho hàm số $y = f(x)$ có đạo hàm $f\'(x) = (x-1)^2(x+2)$. Điểm cực tiểu của hàm số đã cho là:',
      options: [
        '$x = -2$',
        '$x = 1$',
        '$x = 2$',
        '$x = -1$',
      ],
      correctAnswer: 'A',
      explanation: 'Ta có bảng biến thiên: đạo hàm $f\'(x)$ đổi dấu từ âm sang dương khi qua $x = -2$ (nghiệm bội lẻ) và không đổi dấu khi qua $x = 1$ (nghiệm bội chẵn). Do đó $x = -2$ là điểm cực tiểu của hàm số.',
      points: 1,
    },
  ])

  // Focus tracking cho Bàn phím ảo toán học
  const [focusedField, setFocusedField] = useState<{
    qIdx: number
    field: 'text' | 'explanation' | 'option'
    optIdx?: number
  } | null>(null)
  const [activeKeyboardTab, setActiveKeyboardTab] = useState('basic')
  const [savingKatexExam, setSavingKatexExam] = useState(false)

  // AI Generator Modal State (Gemini Đa tầng)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('Khảo sát hàm số, cực trị và tiệm cận đồ thị hàm số Toán 12 chương 1')
  const [aiQuestionCount, setAiQuestionCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('Vận dụng')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null)
  const [aiStatusMessage, setAiStatusMessage] = useState('')

    // ==========================================
  // STATE: SOẠN ĐỀ PDF & SEB (PRO MULTI-SECTION BUILDER TỪ NEW-ADMIN)
  // ==========================================
  const currentUserId = currentUser?.id || ''
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examMaxScore, setExamMaxScore] = useState('10')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examBlock, setExamBlock] = useState('A00')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Toán học'])
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [gradingMethod, setGradingMethod] = useState('highest')
  const [requireProctoring, setRequireProctoring] = useState(false)
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [hasSeparateAnswerFile, setHasSeparateAnswerFile] = useState(false)
  const [answerPdfFile, setAnswerPdfFile] = useState<File | null>(null)
  const [creatingExam, setCreatingExam] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [folders, setFolders] = useState<any[]>([])
  const [requireSeb, setRequireSeb] = useState(false)
  const [analyzingWithAi, setAnalyzingWithAi] = useState(false)
  const [examSections, setExamSections] = useState<SectionItem[]>([
    {
      id: 'sec-1',
      name: 'Phần 1: Câu trắc nghiệm nhiều phương án lựa chọn',
      totalPoints: 4.5,
      scoringMode: 'auto_divide',
      questionCount: 18,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-2',
      name: 'Phần 2: Câu trắc nghiệm Đúng / Sai (4 ý a, b, c, d)',
      totalPoints: 4.0,
      scoringMode: 'auto_divide',
      questionCount: 4,
      questionTypeMode: 'uniform',
      type: 'true_false',
      instructions: 'Trong mỗi câu có 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý. Điểm số tính lũy tiến theo số ý đúng.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-3',
      name: 'Phần 3: Câu trắc nghiệm trả lời ngắn / Điền số',
      totalPoints: 1.5,
      scoringMode: 'auto_divide',
      questionCount: 6,
      questionTypeMode: 'uniform',
      type: 'short_answer',
      instructions: 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống (dạng số thập phân hoặc số nguyên, ví dụ: 2.5 hoặc -4).',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
  ])
  const [quickAnswersModalSecId, setQuickAnswersModalSecId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

  // Danh sách các Thư Mục Con để gán đề
  const allChildFolders = useMemo(() => {
    if (!Array.isArray(folders)) return []
    const list: any[] = []
    folders.forEach((parent: any) => {
      if (parent && Array.isArray(parent.children)) {
        parent.children.forEach((child: any) => {
          list.push({ ...child, parentName: parent.name || 'Thư mục' })
        })
      }
    })
    return list
  }, [folders])

  // Thống kê tổng điểm và tổng số câu của toàn đề
  const totalExamPoints = useMemo(() => {
    if (!Array.isArray(examSections)) return 0
    return examSections.reduce((acc, sec) => acc + (Number(sec?.totalPoints) || 0), 0)
  }, [examSections])

  const totalQuestionCount = useMemo(() => {
    if (!Array.isArray(examSections)) return 0
    return examSections.reduce((acc, sec) => acc + (parseInt(String(sec?.questionCount)) || 0), 0)
  }, [examSections])

  const themeVars = useMemo(() => getModernThemeVars('emerald', isDark), [isDark])

  // Kiểm tra quyền và tải danh sách đề
  useEffect(() => {
    let isMounted = true

    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))

    const initPage = async () => {
      await senHeart.runGuarded('course:setup_init', async () => {
        try {
          const { data: sessionRes } = await supabase.auth.getSession()
        let user = sessionRes?.session?.user || null
        if (!user) {
          try {
            const { data: authData } = await supabase.auth.getUser()
            user = authData?.user || null
          } catch {}
        }
        if (!isMounted) return

        if (!user) {
          router.replace('/idp')
          return
        }

        setCurrentUser(user)

        try {
          await ensureStudentProfile(user.id)
        } catch (e) {
          console.warn('ensureStudentProfile warning:', e)
        }
        if (!isMounted) return

        // Kiểm tra role người dùng an toàn (tránh văng lỗi single())
        let role: 'admin' | 'collab' | 'teacher' | 'student' = 'student'
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.role) {
            role = profile.role as 'admin' | 'collab' | 'teacher' | 'student'
          }
        } catch (e) {
          console.warn('Lỗi lấy role profile:', e)
        }
        if (!isMounted) return
        setUserRole(role)

        // Tải danh sách đề thi:
        // - Admin/Colab/Teacher: tải toàn bộ đề thi trong hệ thống
        // - Student: chỉ tải các đề thi do chính sinh viên đó tạo ra (created_by === user.id)
        let query = supabase.from('exams').select('*').order('created_at', { ascending: false })
        if (role === 'student') {
          query = query.eq('created_by', user.id)
        }

        try {
          const { data: exData, error: exErr } = await query
          if (isMounted) {
            if (!exErr && Array.isArray(exData)) {
              setExamsList(exData)
            } else {
              setExamsList([])
            }
          }
        } catch (e) {
          if (isMounted) setExamsList([])
        }
        if (!isMounted) return

        // Tải danh sách thư mục SEB
        try {
          const fRes = await fetch('/api/seb/folders')
          if (fRes.ok) {
            const fData = await fRes.json()
            if (isMounted && fData?.folders && Array.isArray(fData.folders)) {
              setFolders(fData.folders)
            }
          }
        } catch (e) {
          console.warn('Lỗi tải folders:', e)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || String(err).includes('aborted')) return
        console.error('Lỗi khởi tạo Setup Course:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }, undefined, 'high')
  }

    initPage()

    return () => {
      isMounted = false
    }
  }, [router])

  // Lọc đề thi hiển thị an toàn
  const filteredExams = useMemo(() => {
    if (!Array.isArray(examsList)) return []
    const q = examSearch.trim().toLowerCase()
    if (!q) return examsList
    return examsList.filter((e) => {
      if (!e) return false
      const titleMatch = e.title ? String(e.title).toLowerCase().includes(q) : false
      const typeMatch = e.exam_type ? String(e.exam_type).toLowerCase().includes(q) : false
      const codeMatch = e.access_code ? String(e.access_code).toLowerCase().includes(q) : false
      return titleMatch || typeMatch || codeMatch
    })
  }, [examsList, examSearch])

  // Toggle Dark Mode
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

  // ==========================================
  // XỬ LÝ CHÈN KÝ HIỆU TỪ BÀN PHÍM ẢO TOÁN HỌC
  // ==========================================
  const handleInsertMathKey = (insertText: string) => {
    if (!focusedField) {
      alert('Vui lòng nhấp vào ô văn bản (Nội dung câu hỏi, Phương án, hoặc Lời giải) trước khi bấm phím toán học!')
      return
    }

    setKatexQuestions((prev) => {
      const next = [...prev]
      const targetQ = { ...next[focusedField.qIdx] }

      if (focusedField.field === 'text') {
        targetQ.text = (targetQ.text || '') + (targetQ.text?.endsWith('$') ? insertText : ` $${insertText}$ `)
      } else if (focusedField.field === 'explanation') {
        targetQ.explanation = (targetQ.explanation || '') + (targetQ.explanation?.endsWith('$') ? insertText : ` $${insertText}$ `)
      } else if (focusedField.field === 'option' && focusedField.optIdx !== undefined) {
        const nextOpts = [...targetQ.options]
        const currentOpt = nextOpts[focusedField.optIdx] || ''
        nextOpts[focusedField.optIdx] = currentOpt + (currentOpt.endsWith('$') ? insertText : ` $${insertText}$ `)
        targetQ.options = nextOpts
      }

      next[focusedField.qIdx] = targetQ
      return next
    })
  }

  // ==========================================
  // XỬ LÝ SOẠN ĐỀ BẰNG AI GEMINI ĐA TẦNG
  // ==========================================
  const handleGenerateAiKatexExam = async () => {
    if (!aiPrompt.trim()) {
      alert('Vui lòng nhập chủ đề hoặc nội dung cần AI soạn đề!')
      return
    }

    setAiLoading(true)
    setAiStatusMessage('Đang kết nối Gemini AI (Ưu tiên gemini-3.8-flash)...')

    try {
      const res = await fetch('/api/generate-katex-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          subject: katexSubject,
          grade: 'Lớp 12',
          questionCount: aiQuestionCount,
          difficulty: aiDifficulty,
          questionType: 'single_choice',
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi xử lý từ hệ thống AI.')
      }

      const generated = json.data
      setAiModelUsed(json.usedModel)

      if (generated.title) {
        setKatexTitle(generated.title)
      }
      if (generated.duration) {
        setKatexDuration(String(generated.duration))
      }

      if (Array.isArray(generated.questions) && generated.questions.length > 0) {
        const formattedQuestions: KatexQuestion[] = generated.questions.map((q: any, idx: number) => ({
          id: `q-${Date.now()}-${idx}`,
          type: q.type || 'single_choice',
          text: q.text || `Câu hỏi ${idx + 1}`,
          options: Array.isArray(q.options) ? q.options : ['A. Phương án 1', 'B. Phương án 2', 'C. Phương án 3', 'D. Phương án 4'],
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation || 'Lời giải chi tiết đang được cập nhật.',
          points: 1,
        }))

        setKatexQuestions(formattedQuestions)
        setShowAiModal(false)
        alert(
          `🎉 AI đã soạn thành công ${formattedQuestions.length} câu hỏi KaTeX chuẩn xác!\n(Mô hình sử dụng: ${json.usedModel || 'Gemini'})`
        )
      }
    } catch (err: any) {
      console.error('Lỗi AI soạn đề KaTeX:', err)
      alert(err.message || 'Không thể kết nối đến Gemini. Vui lòng thử lại!')
    } finally {
      setAiLoading(false)
      setAiStatusMessage('')
    }
  }

  // ==========================================
  // XỬ LÝ LƯU ĐỀ THI KATEX VÀO SUPABASE
  // ==========================================
  const handleSaveKatexExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!katexTitle.trim()) {
      alert('Vui lòng nhập tên đề thi KaTeX!')
      return
    }

    if (katexQuestions.length === 0) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi vào đề!')
      return
    }

    setSavingKatexExam(true)
    try {
      const isStudent = userRole === 'student'
      // 2 CHẾ ĐỘ NGẦM (STEALTH MODE):
      // - Admin/Colab/Teacher: is_hidden = false (Hiện trên toàn bộ hệ thống cho mọi học sinh xem)
      // - Student: is_hidden = true (Chỉ mình học sinh tạo đề đó thấy trong kho đề và phòng thi của mình)
      const isHiddenEffective = isStudent ? true : katexIsHidden

      const accessCode = isHiddenEffective
        ? Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // Đóng gói cấu trúc Sections chuẩn để new-exams/[id] đọc mượt mà
      const parsedMaxScore = parseFloat(katexMaxScore) || 10
      const correctAnswersMap: Record<string, any> = {}
      katexQuestions.forEach((q, idx) => {
        correctAnswersMap[idx] = q.correctAnswer
      })

      const examSections: SectionItem[] = [
        {
          id: 'sec-katex-main',
          name: 'Phần thi KaTeX trực tiếp',
          totalPoints: parsedMaxScore,
          scoringMode: 'auto_divide',
          questionCount: katexQuestions.length,
          questionTypeMode: 'uniform',
          type: 'single_choice',
          instructions: 'Đề thi được soạn trực tiếp bằng KaTeX sắc nét, không dùng file PDF.',
          correctAnswers: correctAnswersMap,
          // Đính kèm danh sách câu hỏi KaTeX chi tiết
          questions: katexQuestions as any,
        } as any,
      ]

      const examPayload: any = {
        title: katexTitle.trim(),
        exam_type: katexExamType,
        duration: parseInt(katexDuration) || 50,
        drive_file_id: null, // Không cần PDF Google Drive
        pdf_url: null,
        exam_structure: examSections,
        allow_review: katexAllowReview,
        is_hidden: isHiddenEffective,
        access_code: accessCode,
        subjects: [katexSubject],
        max_attempts: 1,
        grading_method: 'highest',
        require_proctoring: false,
        require_seb: false,
        created_by: currentUser?.id,
        max_score: parsedMaxScore,
      }

      const { data, error } = await supabase.from('exams').insert(examPayload).select('*').single()
      if (error) throw error

      setExamsList([data, ...examsList])
      setActiveTab('manage')
      alert(
        isStudent
          ? `🎉 Đã tạo đề thi KaTeX cá nhân thành công!\n(Đề được lưu riêng cho tài khoản của bạn tại mục Quản lý đề và Kho đề)`
          : `🎉 Xuất bản đề thi KaTeX toàn hệ thống thành công!\n(Tất cả học sinh có thể truy cập vào thi tại Kho đề mới)`
      )
    } catch (err: any) {
      console.error('Lỗi lưu đề KaTeX:', err)
      alert('Lỗi lưu đề thi: ' + (err.message || 'Vui lòng thử lại.'))
    } finally {
      setSavingKatexExam(false)
    }
  }

  const handleLoadPresetTHPT2026 = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
        totalPoints: 4.5,
        scoringMode: 'auto_divide',
        questionCount: 18,
        questionTypeMode: 'uniform',
        type: 'single_choice',
        instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
        totalPoints: 4.0,
        scoringMode: 'auto_divide',
        questionCount: 4,
        questionTypeMode: 'uniform',
        type: 'true_false',
        instructions: 'Trong mỗi câu có 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý. Điểm số tính lũy tiến theo số ý đúng.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_3',
        name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
        totalPoints: 1.5,
        scoringMode: 'auto_divide',
        questionCount: 6,
        questionTypeMode: 'uniform',
        type: 'short_answer',
        instructions: 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống (dạng số thập phân hoặc số nguyên, ví dụ: 2.5 hoặc -4).',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
    ])
  }

  const handleLoadPresetHSA = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Định lượng & Toán học',
        totalPoints: 7.0,
        scoringMode: 'auto_divide',
        questionCount: 35,
        questionTypeMode: 'uniform',
        type: 'single_choice',
        instructions: 'Thí sinh chọn 1 phương án đúng.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Điền đáp án ngắn',
        totalPoints: 3.0,
        scoringMode: 'auto_divide',
        questionCount: 15,
        questionTypeMode: 'uniform',
        type: 'short_answer',
        instructions: 'Thí sinh nhập đáp số tính toán.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
    ])
  }

  // Thêm một phần thi mới
  const handleAddSection = () => {
    const newIdx = examSections.length + 1
    const newSec: SectionItem = {
      id: `sec-${Date.now()}`,
      name: `Phần ${newIdx}: Phần thi mới`,
      totalPoints: 2.0,
      scoringMode: 'auto_divide',
      questionCount: 5,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh đọc kỹ đề bài và chọn đáp án chính xác.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    }
    setExamSections((prev) => [...prev, newSec])
  }

  // Xóa một phần thi
  const handleRemoveSection = (secIdx: number) => {
    if (examSections.length <= 1) {
      alert('Đề thi phải có ít nhất 1 phần thi!')
      return
    }
    if (!confirm(`Bạn có chắc muốn xóa "${examSections[secIdx].name}"?`)) return
    setExamSections((prev) => prev.filter((_, idx) => idx !== secIdx))
  }

  // Cập nhật thông tin chung của phần thi
  const handleUpdateSectionField = (secIdx: number, field: keyof SectionItem, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      next[secIdx] = { ...next[secIdx], [field]: value }
      return next
    })
  }

  // Cập nhật điểm tùy chỉnh cho từng câu
  const handleSetQuestionPoint = (secIdx: number, qIdx: number, points: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.pointsPerQuestion = { ...sec.pointsPerQuestion, [qIdx]: points }
      next[secIdx] = sec
      return next
    })
  }

  // Cập nhật thể loại câu hỏi khi ở chế độ tùy ý từng câu
  const handleSetQuestionType = (secIdx: number, qIdx: number, type: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.questionTypes = { ...sec.questionTypes, [qIdx]: type }
      next[secIdx] = sec
      return next
    })
  }

  // Thêm một dải câu hỏi mới cho phần thi hỗn hợp
  const handleAddMixedRange = (secIdx: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      const ranges = sec.mixedRanges ? [...sec.mixedRanges] : []
      const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : 0
      const totalQ = sec.questionCount || 10
      const start = lastEnd + 1 <= totalQ ? lastEnd + 1 : totalQ
      const end = Math.min(totalQ, start + 4)
      ranges.push({
        start,
        end,
        type: 'single_choice',
        optionsCount: 4,
      })
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Cập nhật một dải câu hỏi trong phần thi hỗn hợp
  const handleUpdateMixedRange = (secIdx: number, rIdx: number, field: string, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (!sec.mixedRanges) return prev
      const ranges = [...sec.mixedRanges]
      ranges[rIdx] = { ...ranges[rIdx], [field]: value }
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Xóa một dải câu hỏi trong phần thi hỗn hợp
  const handleRemoveMixedRange = (secIdx: number, rIdx: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (!sec.mixedRanges) return prev
      const ranges = sec.mixedRanges.filter((_, idx) => idx !== rIdx)
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Áp dụng nhanh cấu trúc mẫu cho phần thi hỗn hợp
  const handleApplyMixedPreset = (secIdx: number, preset: 'thptqg' | 'hsa' | 'tsa') => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (preset === 'thptqg') {
        sec.questionCount = 28
        sec.totalPoints = 10
        sec.mixedRanges = [
          { start: 1, end: 18, type: 'single_choice', optionsCount: 4 },
          { start: 19, end: 22, type: 'true_false', optionsCount: 4 },
          { start: 23, end: 28, type: 'short_answer', optionsCount: 4 },
        ]
      } else if (preset === 'hsa') {
        sec.questionCount = 50
        sec.totalPoints = 50
        sec.mixedRanges = [
          { start: 1, end: 40, type: 'single_choice', optionsCount: 4 },
          { start: 41, end: 50, type: 'short_answer', optionsCount: 4 },
        ]
      } else if (preset === 'tsa') {
        sec.questionCount = 40
        sec.totalPoints = 40
        sec.mixedRanges = [
          { start: 1, end: 30, type: 'single_choice', optionsCount: 4 },
          { start: 31, end: 36, type: 'true_false', optionsCount: 4 },
          { start: 37, end: 40, type: 'short_answer', optionsCount: 4 },
        ]
      }
      next[secIdx] = sec
      return next
    })
  }

  // Xử lý upload ảnh hướng dẫn làm bài cho phần thi
  const handleUploadInstructionImage = (secIdx: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      handleUpdateSectionField(secIdx, 'instructionImage', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Helper chuyển file sang Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  // Trích xuất toàn bộ văn bản từ file PDF trên client bằng pdfjs-dist
  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      }

      const fileToArrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise

      let fullTextContent = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ')
        fullTextContent += `\n[--- TRANG ${i} ---]\n` + pageText
      }

      return fullTextContent.trim()
    } catch (err: any) {
      console.warn('Không thể trích xuất văn bản từ PDF qua pdfjs:', err)
      return ''
    }
  }

  // Kích hoạt Gemini phân tích file PDF & đối chiếu đáp án nếu có
  const handleAiAnalyze = async (fileToAnalyze?: File, answerFileToAnalyze?: File | null) => {
    const targetFile = fileToAnalyze || examPdfFile
    const targetAnswerFile = answerFileToAnalyze !== undefined ? answerFileToAnalyze : answerPdfFile

    if (!targetFile) {
      alert('Vui lòng chọn hoặc kéo thả file PDF đề thi!')
      return
    }

    if (hasSeparateAnswerFile && !targetAnswerFile) {
      alert('Bạn đã chọn chế độ "Đã có file đáp án riêng", vui lòng tải lên file đáp án (PDF hoặc ảnh) ở cột bên phải!')
      return
    }

    setAnalyzingWithAi(true)
    setAiStatusMessage('Đang quét và bóc tách nội dung văn bản từ file PDF đề thi...')

    try {
      // 1. Thử trích xuất văn bản đề thi trên client bằng PDF.js
      const extractedExamText = await extractTextFromPdf(targetFile)

      // 2. Thử trích xuất văn bản file đáp án nếu có
      let extractedAnswerText = ''
      let answerFileBase64 = ''
      let answerMimeType = ''

      if (targetAnswerFile) {
        setAiStatusMessage('Đang đọc và xử lý file đáp án...')
        if (targetAnswerFile.type.includes('pdf') || targetAnswerFile.name.toLowerCase().endsWith('.pdf')) {
          extractedAnswerText = await extractTextFromPdf(targetAnswerFile)
        } else {
          answerFileBase64 = await fileToBase64(targetAnswerFile)
          answerMimeType = targetAnswerFile.type || 'image/jpeg'
        }
      }

      let res: Response

      const canSendJson =
        extractedExamText && extractedExamText.length > 50 &&
        (!targetAnswerFile || extractedAnswerText.length > 10 || answerFileBase64)

      if (canSendJson) {
        setAiStatusMessage(
          targetAnswerFile
            ? 'Đã bóc tách dữ liệu! AI đang phân tích cấu trúc đề và đối chiếu bảng đáp án chính thức...'
            : 'Đã trích xuất xong đề thi! AI đang phân tích các phần thi và giải ma trận đáp án...'
        )
        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examText: extractedExamText,
            answerText: extractedAnswerText,
            answerFileBase64: answerFileBase64 || undefined,
            answerMimeType: answerMimeType || undefined,
            hasSeparateAnswer: Boolean(targetAnswerFile),
          }),
        })
      } else {
        setAiStatusMessage('Đang tải các file lên và gửi tới AI để nhận diện nội dung...')
        const formData = new FormData()
        if (extractedExamText && extractedExamText.length > 50) {
          formData.append('examText', extractedExamText)
        } else {
          formData.append('file', targetFile)
        }

        if (targetAnswerFile) {
          if (extractedAnswerText && extractedAnswerText.length > 10) {
            formData.append('answerText', extractedAnswerText)
          } else {
            formData.append('answerFile', targetAnswerFile)
          }
        }
        formData.append('hasSeparateAnswer', targetAnswerFile ? '1' : '0')

        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          body: formData,
        })
      }

      const resText = await res.text()
      let json: any = null
      try {
        json = JSON.parse(resText)
      } catch {
        if (res.status === 413) {
          throw new Error('Dung lượng file đề thi vượt quá giới hạn máy chủ (413 Payload Too Large). Vui lòng thử nén file hoặc dùng file PDF có lớp văn bản.')
        }
        if (res.status === 504 || res.status === 502) {
          throw new Error('Quá thời gian phản hồi từ máy chủ (Gateway Timeout). Vui lòng thử lại.')
        }
        throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${res.status}): ${resText.slice(0, 100)}...`)
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Không thể phân tích đề thi bằng AI.')
      }

      const data = json.data
      if (data.title) {
        setExamTitle(data.title)
      }
      if (data.duration) {
        setExamDuration(String(data.duration))
      }
      if (data.exam_type) {
        setExamTypeVal(data.exam_type)
      }

      if (Array.isArray(data.sections) && data.sections.length > 0) {
        const mappedSections: SectionItem[] = data.sections.map((s: any, idx: number) => ({
          id: s.id || `sec-${Date.now()}-${idx}`,
          name: s.name || `Phần ${idx + 1}`,
          totalPoints: Number(s.totalPoints) || 0,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          questionCount: parseInt(s.questionCount) || 1,
          questionTypeMode: s.questionTypeMode || 'uniform',
          type: normalizeQuestionType(s.type, s, idx),
          questionTypes: s.questionTypes || {},
          instructions: s.instructions || '',
          instructionImage: s.instructionImage || '',
          correctAnswers: s.correctAnswers || {},
        }))

        setExamSections(mappedSections)
        alert(
          targetAnswerFile
            ? `🎉 Phân tích đề và đối chiếu đáp án thành công!\nĐã nhận diện ${mappedSections.length} phần thi và nạp chuẩn xác 100% bảng đáp án từ tài liệu bạn cung cấp.`
            : `🎉 Phân tích file PDF thành công bằng Gemini!\nĐã nhận diện ${mappedSections.length} phần thi và tự động giải sẵn bảng đáp án. Bạn có thể kiểm tra lại thông tin và bảng đáp án bên dưới.`
        )
      }
    } catch (err: any) {
      console.error('Lỗi phân tích AI:', err)
      alert('Lỗi phân tích file đề thi: ' + (err.message || 'Vui lòng kiểm tra lại file.'))
    } finally {
      setAnalyzingWithAi(false)
      setAiStatusMessage('')
    }
  }

  // Cập nhật câu trả lời đúng cho một câu hỏi
  const handleSetCorrectAnswer = (secIdx: number, qIdx: number, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: value }
      next[secIdx] = targetSec
      return next
    })
  }

  // Cập nhật câu trả lời Đúng/Sai 4 ý
  const handleSetCorrectAnswerTF = (secIdx: number, qIdx: number, subLabel: string, val: string) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      const currentQ = { ...(targetSec.correctAnswers?.[qIdx] || {}) }
      currentQ[subLabel] = val
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: currentQ }
      next[secIdx] = targetSec
      return next
    })
  }

  const handleApplyQuickAnswers = (sectionId: string, text: string) => {
    const secIdx = examSections.findIndex((s) => s.id === sectionId)
    if (secIdx === -1) return
    const sec = examSections[secIdx]

    const answers: Record<number, any> = { ...(sec.correctAnswers || {}) }

    if (sec.type === 'single_choice') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([A-D])/gi))
      if (matches.length > 0) {
        matches.forEach((m) => {
          const qNum = parseInt(m[1]) - 1
          if (qNum >= 0 && qNum < sec.questionCount) {
            answers[qNum] = m[2].toUpperCase()
          }
        })
      } else {
        const letters = text.replace(/[^a-dA-D]/g, '').toUpperCase().split('')
        letters.forEach((l, idx) => {
          if (idx < sec.questionCount) answers[idx] = l
        })
      }
    } else if (sec.type === 'true_false') {
      const lines = text.split('\n')
      lines.forEach((line) => {
        const m = line.match(/(\d+)[\s.:)]*([ĐDSđds\-\/]+)/i)
        if (m) {
          const qNum = parseInt(m[1]) - 1
          const raw = m[2].replace(/[^ĐDSđds]/gi, '').toUpperCase()
          const tfObj: any = {}
          ;['a', 'b', 'c', 'd'].forEach((sub, subIdx) => {
            const ch = raw[subIdx]
            tfObj[sub] = ch === 'Đ' || ch === 'D' ? 'D' : 'S'
          })
          if (qNum >= 0 && qNum < sec.questionCount) answers[qNum] = tfObj
        }
      })
    } else if (sec.type === 'short_answer') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([-\d.,]+)/g))
      matches.forEach((m) => {
        const qNum = parseInt(m[1]) - 1
        if (qNum >= 0 && qNum < sec.questionCount) {
          answers[qNum] = m[2].trim()
        }
      })
    }

    handleUpdateSectionField(secIdx, 'correctAnswers', answers)
    setQuickAnswersModalSecId(null)
    setQuickAnswersText('')
    alert(`Đã nạp nhanh đáp án cho ${Object.keys(answers).length} câu hỏi!`)
  }

  // TẠO ĐỀ THI ĐẦY ĐỦ VỚI THANH GẠT SEB & GOOGLE DRIVE
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    if (examSections.length === 0) {
      alert('Vui lòng tạo ít nhất 1 phần thi cho đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload file PDF lên Google Drive qua Resumable Upload
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Chế độ ngầm: Học sinh tạo đề -> tự động là đề ẩn (chỉ mình học sinh thấy), Admin/Colab -> công khai hoặc theo tùy chọn
      const isStudent = userRole === 'student'
      const isHiddenEffective = isStudent ? true : examIsHidden
      const accessCode = isHiddenEffective
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // Đồng bộ cấu trúc đề thi để cả SenExam lẫn SEB đều đọc được chuẩn xác
      const parsedMaxScore = parseFloat(examMaxScore) || 10
      const synchronizedSections = examSections.map((s) => {
        const pts = Number(s.totalPoints) || 10
        return {
          ...s,
          totalPoints: pts,
          sectionTotalPoints: pts,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          customPoints: s.pointsPerQuestion || {},
          custom_max_score: parsedMaxScore,
        }
      })

      const totalQs = examSections.reduce((sum, s) => sum + (parseInt(String(s.questionCount)) || 0), 0)

      const examPayload: any = {
        title: examTitle.trim(),
        exam_type: examTypeVal,
        duration: parseInt(examDuration) || 50,
        drive_file_id: driveFileId,
        exam_structure: synchronizedSections,
        allow_review: examAllowReview,
        is_hidden: isHiddenEffective,
        access_code: accessCode,
        subjects: selectedSubjects,
        max_attempts: parseInt(maxAttempts) || 1,
        grading_method: gradingMethod,
        require_proctoring: requireProctoring,
        folder_id: selectedFolderId || null,
        require_seb: requireSeb, // THANH GẠT YÊU CẦU SEB
        part_instructions: examSections.map((s) => ({
          id: s.id,
          name: s.name,
          instructions: s.instructions,
          instructionImage: s.instructionImage,
        })),
        created_by: currentUserId,
      }

      let newExam: any = null
      const { data: firstTryData, error: firstTryErr } = await supabase
        .from('exams')
        .insert({ ...examPayload, max_score: parsedMaxScore })
        .select('*')
        .single()

      if (firstTryErr) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('exams')
          .insert(examPayload)
          .select('*')
          .single()
        if (fallbackErr) throw fallbackErr
        newExam = fallbackData
      } else {
        newExam = firstTryData
      }

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setAnswerPdfFile(null)
      setHasSeparateAnswerFile(false)
      setExamIsHidden(false)
      setExamCustomCode('')
      setActiveTab('manage')
      alert(
        isStudent
          ? `🎉 Đã xuất bản đề thi PDF của bạn thành công (${totalQs} câu hỏi)!\n(Chế độ cá nhân: chỉ bạn thấy đề thi này trong danh sách đề của bạn)`
          : `🎉 Đã xuất bản đề thi thành công (${totalQs} câu hỏi)! ${accessCode ? `Mã code: ${accessCode}` : ''} ${requireSeb ? '(Yêu cầu Safe Exam Browser)' : '(Web trực tuyến)'}`
      )
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // TẠO THÔNG BÁO MỚI CHO NGƯỜI DÙNG

  // Xóa đề thi
  const handleDeleteExam = async (examId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi: "${title}" không? Hành động này không thể hoàn tác.`)) {
      return
    }

    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId)
      if (error) throw error
      setExamsList((prev) => prev.filter((e) => e.id !== examId))
      alert('Đã xóa đề thi thành công!')
    } catch (err: any) {
      alert('Lỗi xóa đề thi: ' + err.message)
    }
  }

  // Bật/tắt allow_review
  const handleToggleReview = async (examId: string, currentVal: boolean) => {
    try {
      const nextVal = !currentVal
      const { error } = await supabase.from('exams').update({ allow_review: nextVal }).eq('id', examId)
      if (error) throw error
      setExamsList((prev) => prev.map((e) => (e.id === examId ? { ...e, allow_review: nextVal } : e)))
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-bold">Đang tải Cổng Thiết lập Khóa học & Soạn đề KaTeX...</p>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#F4F7FA] dark:bg-[#080D1A] text-[#1E293B] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={themeVars}
    >
      {/* HEADER ĐIỀU HƯỚNG */}
      <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            prefetch={false}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm transition hover:scale-105"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                Thiết Lập Khóa Học & Soạn Đề KaTeX
              </h1>
              {/* BADGE 2 CHẾ ĐỘ NGẦM */}
              {userRole === 'admin' || userRole === 'collab' || userRole === 'teacher' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" /> Toàn hệ thống (Admin/Colab)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <GraduationCap className="h-3 w-3" /> Tự học cá nhân (Học sinh)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:block">
              Quản lý đề thi, soạn đề KaTeX trực tiếp không cần PDF và hỗ trợ AI Gemini đa tầng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/new-dashboard"
            prefetch={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Trang chủ</span>
          </Link>

          {(userRole === 'admin' || userRole === 'collab') && (
            <Link
              href="/new-admin"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Admin Portal</span>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
        </div>
      </header>

      {/* SUB-NAV TABS */}
      <div className="border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 px-4 sm:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'manage'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Layers className="h-4 w-4" /> Quản lý đề thi ({examsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create_katex')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'create_katex'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-300" /> Tạo đề KaTeX (Không cần PDF)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create_pdf')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'create_pdf'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <UploadCloud className="h-4 w-4" /> Soạn đề PDF & SEB
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* ==================================================== */}
        {/* TAB 1: QUẢN LÝ ĐỀ THI */}
        {/* ==================================================== */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi theo tên, loại đề hoặc mã code..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('create_katex')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 text-xs font-black shadow-md hover:opacity-95 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tạo đề KaTeX mới
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('create_pdf')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-black shadow-md transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Tải đề PDF lên
                </button>
              </div>
            </div>

            {/* Danh sách đề thi */}
            {filteredExams.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white/40 dark:bg-slate-900/40">
                <FileText className="h-12 w-12 mx-auto text-slate-400 mb-3 opacity-60" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có đề thi nào phù hợp</h3>
                <p className="text-xs text-slate-500 mt-1">Bấm nút "Tạo đề KaTeX mới" hoặc "Tải đề PDF lên" để bắt đầu soạn đề thi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExams.map((exam, idx) => {
                  if (!exam) return null
                  const isKatexFormat = !exam.drive_file_id && !exam.pdf_url
                  const questionCount = getExamQuestionCount(exam)

                  return (
                    <div
                      key={exam.id || `exam-${idx}`}
                      className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between transform-gpu"
                    >
                      <div>
                        {/* Tags */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2.5 py-1 border border-slate-200 dark:border-slate-700">
                            {exam.exam_type}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isKatexFormat ? (
                              <span className="rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 text-[9px] font-black px-2 py-0.5">
                                KaTeX Live
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black px-2 py-0.5">
                                PDF Drive
                              </span>
                            )}

                            {exam.require_seb && (
                              <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-black px-2 py-0.5">
                                SEB Lock
                              </span>
                            )}

                            {exam.is_hidden ? (
                              <span className="rounded-full bg-slate-500/10 text-slate-500 text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5">
                                <Lock className="h-2.5 w-2.5" /> Riêng tư
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5">
                                <Unlock className="h-2.5 w-2.5" /> Công khai
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-black text-sm line-clamp-2 mb-2" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                          {exam.title}
                        </h3>

                        {/* Meta info */}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 font-semibold">
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" /> Thời gian: {exam.duration} phút • {questionCount} câu hỏi
                          </p>
                          {exam.access_code && (
                            <p className="flex items-center gap-1.5 font-mono text-emerald-600 dark:text-emerald-400">
                              <Hash className="h-3 w-3" /> Mã truy cập: <strong>{exam.access_code}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/new-exams/${exam.id}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem đề thi
                          </Link>

                          <button
                            type="button"
                            onClick={() => setManagingExamStudents(exam)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="Quản lý học sinh làm bài & Giám sát vi phạm"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>Thí sinh</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleReview(exam.id, exam.allow_review)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition ${
                              exam.allow_review
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                            title={exam.allow_review ? 'Đang bật xem lại lời giải' : 'Đang tắt xem lại lời giải'}
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExam(exam.id, exam.title)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TẠO ĐỀ KATEX TRỰC TIẾP & BÀN PHÍM ẢO TOÁN HỌC */}
        {/* ==================================================== */}
        {activeTab === 'create_katex' && (
          <form onSubmit={handleSaveKatexExam} className="space-y-8">
            {/* Top Banner AI Assistant */}
            <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                    AI Gemini Soạn Đề KaTeX Đa Tầng
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Tự động tạo câu hỏi trắc nghiệm kèm công thức toán học KaTeX và lời giải chi tiết (Hỗ trợ dự phòng thông minh)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition"
              >
                <Sparkles className="h-4 w-4" /> Mở AI Soạn Đề Tự Động
              </button>
            </div>

            {/* Thông tin chung của đề */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                1. Thông tin tổng quan đề thi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Tên đề thi KaTeX *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đề Ôn Tập Tích Phân & Ứng Dụng (Chuẩn KaTeX 2026)"
                    value={katexTitle}
                    onChange={(e) => setKatexTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Môn học</label>
                  <select
                    value={katexSubject}
                    onChange={(e) => setKatexSubject(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lí">Vật lí</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tin học">Tin học</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Loại kỳ thi</label>
                  <select
                    value={katexExamType}
                    onChange={(e) => setKatexExamType(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Thời gian làm bài (phút)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={katexDuration}
                    onChange={(e) => setKatexDuration(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Thang điểm tối đa</label>
                  <input
                    type="number"
                    value={katexMaxScore}
                    onChange={(e) => setKatexMaxScore(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="katexAllowReview"
                    checked={katexAllowReview}
                    onChange={(e) => setKatexAllowReview(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <label htmlFor="katexAllowReview" className="text-xs font-bold cursor-pointer select-none">
                    Cho phép học sinh xem lại lời giải chi tiết
                  </label>
                </div>

                {userRole !== 'student' && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="katexIsHidden"
                      checked={katexIsHidden}
                      onChange={(e) => setKatexIsHidden(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <label htmlFor="katexIsHidden" className="text-xs font-bold cursor-pointer select-none">
                      Đặt đề thi ẩn (yêu cầu mã code)
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* BÀN PHÍM ẢO TOÁN HỌC TRỰC QUAN (VIRTUAL MATH KEYBOARD) */}
            <div className="sticky top-16 z-20 rounded-3xl border border-indigo-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3 border-b border-black/5 dark:border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Bàn phím ảo toán học KaTeX
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                    (Nhấp vào ô soạn thảo rồi bấm phím để chèn công thức chuẩn)
                  </span>
                </div>

                {/* Tabs bàn phím */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {MATH_KEYBOARD_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveKeyboardTab(tab.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                        activeKeyboardTab === tab.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lưới các nút phím render bằng KaTeX chuẩn xịn */}
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {(MATH_KEYBOARD_TABS.find((t) => t.id === activeKeyboardTab)?.keys || []).map((k, kIdx) => (
                  <MathKeyButton
                    key={k.insert + '-' + kIdx}
                    k={k}
                    onInsert={handleInsertMathKey}
                  />
                ))}
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI SOẠN TRỰC TIẾP */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                  2. Danh sách câu hỏi ({katexQuestions?.length || 0} câu)
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    const newId = `q-${Date.now()}`
                    setKatexQuestions([
                      ...katexQuestions,
                      {
                        id: newId,
                        type: 'single_choice',
                        text: 'Câu hỏi mới $y = f(x)$...',
                        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
                        correctAnswer: 'A',
                        explanation: 'Lời giải chi tiết...',
                        points: 1,
                      },
                    ])
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <Plus className="h-4 w-4" /> Thêm câu hỏi
                </button>
              </div>

              {(katexQuestions || []).map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4"
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs">
                        {qIdx + 1}
                      </span>
                      <span className="text-xs font-black">Câu hỏi {qIdx + 1}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const nextType = e.target.value as any
                          setKatexQuestions((prev) => {
                            const next = [...prev]
                            next[qIdx].type = nextType
                            return next
                          })
                        }}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold outline-none"
                      >
                        <option value="single_choice">Trắc nghiệm (1 đáp án)</option>
                        <option value="true_false">Đúng / Sai</option>
                        <option value="short_answer">Điền số / Trả lời ngắn</option>
                        <option value="essay">Tự luận</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          if (katexQuestions.length <= 1) {
                            alert('Đề thi phải có ít nhất 1 câu hỏi!')
                            return
                          }
                          setKatexQuestions(katexQuestions.filter((_, idx) => idx !== qIdx))
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nội dung câu hỏi & Xem trước trực tiếp (Live KaTeX Preview) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Nội dung câu hỏi (hỗ trợ công thức $...$)
                      </label>
                      <textarea
                        rows={4}
                        value={q.text}
                        onFocus={() => setFocusedField({ qIdx, field: 'text' })}
                        onChange={(e) => {
                          const val = e.target.value
                          setKatexQuestions((prev) => {
                            const next = [...prev]
                            next[qIdx].text = val
                            return next
                          })
                        }}
                        placeholder="Nhập nội dung câu hỏi, ví dụ: Tính tích phân $I = \int_0^1 x^2 dx$..."
                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-xs font-mono outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* LIVE KATEX PREVIEW BOX */}
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-2">
                        <Eye className="h-3 w-3" /> Xem trước KaTeX trực tiếp
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                        <SafeMathRenderer content={q.text || '*(Chưa có nội dung câu hỏi)*'} />
                      </div>
                    </div>
                  </div>

                  {/* Các phương án lựa chọn (cho trắc nghiệm single_choice) */}
                  {q.type === 'single_choice' && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                        Phương án lựa chọn & Đáp án đúng:
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                          const isSelected = q.correctAnswer === letter
                          const optText = q.options[optIdx] || ''

                          return (
                            <div
                              key={letter}
                              className={`rounded-2xl border p-3 transition flex items-start gap-2.5 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setKatexQuestions((prev) => {
                                    const next = [...prev]
                                    next[qIdx].correctAnswer = letter
                                    return next
                                  })
                                }}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black transition ${
                                  isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {letter}
                              </button>

                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={optText}
                                  onFocus={() => setFocusedField({ qIdx, field: 'option', optIdx })}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setKatexQuestions((prev) => {
                                      const next = [...prev]
                                      const nextOpts = [...next[qIdx].options]
                                      nextOpts[optIdx] = val
                                      next[qIdx].options = nextOpts
                                      return next
                                    })
                                  }}
                                  placeholder={`Nội dung phương án ${letter}...`}
                                  className="w-full bg-transparent text-xs font-medium outline-none"
                                />

                                {optText && (
                                  <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-black/5 dark:border-white/5 pt-1">
                                    <SafeMathRenderer content={optText} gfm={false} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lời giải chi tiết */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Lời giải chi tiết (Hiển thị cho học sinh khi xem lại bài):
                    </label>
                    <textarea
                      rows={3}
                      value={q.explanation}
                      onFocus={() => setFocusedField({ qIdx, field: 'explanation' })}
                      onChange={(e) => {
                        const val = e.target.value
                        setKatexQuestions((prev) => {
                          const next = [...prev]
                          next[qIdx].explanation = val
                          return next
                        })
                      }}
                      placeholder="Giải thích từng bước có công thức KaTeX..."
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs font-mono outline-none focus:border-indigo-500"
                    />

                    {q.explanation && (
                      <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20 p-3 text-xs">
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                          Xem trước lời giải:
                        </span>
                        <SafeMathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={savingKatexExam}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50"
              >
                {savingKatexExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Xuất bản đề thi KaTeX
              </button>
            </div>
          </form>
        )}

        {/* ==================================================== */}
        {/* TAB 3: SOẠN ĐỀ PDF & SEB TRUYỀN THỐNG (DI DỜI TỪ NEW-ADMIN) */}
        {/* TAB 3: PRO MULTI-SECTION EXAM BUILDER TỪ NEW-ADMIN */}
        {activeTab === 'create_pdf' && (
          <form onSubmit={handleCreateExam} className="space-y-6 max-w-5xl mx-auto">
            {/* 1. TẢI FILE ĐỀ THI & ĐÁP ÁN (PHÂN TÍCH BẰNG AI GEMINI) */}
            <div className="p-6 sm:p-8 rounded-[32px] bg-gradient-to-br from-indigo-50/90 via-sky-50/80 to-blue-50/90 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-900/90 border border-indigo-200/80 dark:border-indigo-500/20 shadow-xl backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2
                      className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap"
                      style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
                    >
                      <span>1. Tải Lên Đề Thi & Đáp Án (Phân Tích Bằng AI Gemini)</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider shadow-xs">
                        AI Tự Động
                      </span>
                    </h2>
                    <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                      Tự động đọc, trích xuất cấu trúc đề thi, số phần, số câu và đối chiếu bảng đáp án chuẩn xác.
                    </p>
                  </div>
                </div>

                {/* Nút nạp nhanh mẫu đề thi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadPresetTHPT2026}
                    className="rounded-xl border border-indigo-500/30 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition hover:bg-indigo-500/20 shadow-2xs"
                  >
                    🎯 Mẫu THPT 2026
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadPresetHSA}
                    className="rounded-xl border border-teal-500/30 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 transition hover:bg-teal-500/20 shadow-2xs"
                  >
                    ⚡ Mẫu HSA
                  </button>
                </div>
              </div>

              {/* HỎI TRƯỚC: BẠN ĐÃ CÓ FILE ĐÁP ÁN CHƯA? */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-indigo-200/90 dark:border-indigo-500/20 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      Bạn đã có sẵn file / bảng đáp án riêng của đề thi này chưa?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setHasSeparateAnswerFile(false)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        !hasSeparateAnswerFile
                          ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Chưa có (AI tự giải)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSeparateAnswerFile(true)}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                        hasSeparateAnswerFile
                          ? 'bg-indigo-600 text-white shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Đã có file đáp án (Khuyên dùng)</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {hasSeparateAnswerFile
                    ? '💡 Bạn tải 1 bên File Đề Thi và 1 bên File Đáp Án (PDF/Ảnh). Gemini sẽ đối chiếu trực tiếp để nạp đáp án chuẩn 100%, nhanh chóng và giảm tải tính toán cho AI.'
                    : '💡 Bạn chỉ cần tải 1 file Đề Thi, Gemini sẽ tự động đọc câu hỏi và suy luận giải toàn bộ bảng đáp án.'}
                </p>
              </div>

              {/* KHU VỰC TẢI FILE: 1 BÊN ĐỀ VÀ 1 BÊN ĐÁP ÁN (HOẶC 1 CỘT KHI CHƯA CÓ ĐÁP ÁN) */}
              {hasSeparateAnswerFile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CỘT 1: BÊN TẢI FILE ĐỀ THI */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-200 dark:border-indigo-500/20 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>1. File Đề Thi (PDF) *</span>
                        </span>
                        {examPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!examPdfFile ? (
                        <label className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setExamPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">
                              Chọn File PDF Đề Thi
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Kéo thả hoặc bấm để chọn tệp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <label className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer transition shrink-0">
                            <span>Đổi file</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) setExamPdfFile(f)
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* CỘT 2: BÊN TẢI FILE ĐÁP ÁN */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-500/20 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span>2. File Đáp Án (PDF hoặc Ảnh) *</span>
                        </span>
                        {answerPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!answerPdfFile ? (
                        <label className="border-2 border-dashed border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setAnswerPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 block">
                              Chọn File Đáp Án (PDF hoặc Ảnh)
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Bảng đáp án trắc nghiệm, lời giải hoặc ảnh chụp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {answerPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(answerPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer transition">
                              <span>Đổi file</span>
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) setAnswerPdfFile(f)
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setAnswerPdfFile(null)}
                              className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 transition"
                              title="Xóa file đáp án"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NÚT BẮT ĐẦU PHÂN TÍCH ĐỀ & ĐỐI CHIẾU ĐÁP ÁN */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      disabled={analyzingWithAi || !examPdfFile}
                      onClick={() => handleAiAnalyze(examPdfFile || undefined, answerPdfFile)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {analyzingWithAi ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang Phân Tích & Đối Chiếu Đáp Án...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>✨ Bắt Đầu Phân Tích Đề & Nạp Đáp Án Bằng AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 1 CỘT (CHỈ CÓ FILE ĐỀ THI, AI TỰ GIẢI) */
                <>
                  {!examPdfFile ? (
                    <label className="border-2 border-dashed border-indigo-300 dark:border-indigo-500/30 hover:border-indigo-500 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition text-center group shadow-xs">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) {
                            setExamPdfFile(f)
                            handleAiAnalyze(f, null)
                          }
                        }}
                      />
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition flex items-center justify-center">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-indigo-950 dark:text-indigo-200 block">
                          Bấm vào đây để chọn File PDF Đề Thi (hoặc kéo thả file vào đây)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                          Khi tải file PDF lên, hệ thống sẽ tự động gửi tới Gemini để phân tích cấu trúc và tự giải đề ngay lập tức
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/20 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/40">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                                ✓ File PDF Đã Chọn
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition">
                            <span>Đổi file PDF khác</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) {
                                  setExamPdfFile(f)
                                  handleAiAnalyze(f, null)
                                }
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            disabled={analyzingWithAi}
                            onClick={() => handleAiAnalyze(examPdfFile || undefined, null)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                          >
                            {analyzingWithAi ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang Phân Tích & Giải...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Phân Tích Lại Bằng AI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {analyzingWithAi && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/30 flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-bold animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    {aiStatusMessage || 'AI đang xử lý file đề thi và ma trận đáp án... Vui lòng đợi trong giây lát.'}
                  </span>
                </div>
              )}
            </div>

            {/* 2. THÔNG TIN CHUNG ĐỀ THI */}
            <div className="p-6 sm:p-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 shadow-xl backdrop-blur-xl space-y-5">
              <h2
                className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
              >
                2. Thông Tin Chung Đề Thi (AI Tự Động Điền)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 dark:text-slate-300">Tên Đề Thi *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Tự động điền sau khi tải file PDF, hoặc nhập thủ công..."
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Loại Kỳ Thi</label>
                  <select
                    value={examTypeVal}
                    onChange={(e) => setExamTypeVal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Thời Gian Làm Bài (Phút)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={5}
                    max={300}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Số Lần Thi Tối Đa (Max Attempts)</label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={1}
                    max={10}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300">Thang Điểm Đề Thi</label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Quy đổi chuẩn hóa về thang 10</span>
                  </div>
                  <input
                    type="number"
                    value={examMaxScore}
                    onChange={(e) => setExamMaxScore(e.target.value)}
                    placeholder="Ví dụ: 10, 20, 50, 100..."
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={1}
                    max={1000}
                    step="any"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Hệ thống sẽ tự động chuẩn hóa điểm bài làm của thí sinh về thang 10 để đồng bộ toàn hệ thống.
                  </p>
                </div>

                {/* Chọn Thư Mục Con (Môn Thi) Cho Đề */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">
                    Gán Vào Thư Mục Môn Thi (Tùy chọn)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Chọn thư mục môn thi tương ứng --</option>
                    {allChildFolders.map((child: any) => (
                      <option key={child.id} value={child.id}>
                        {child.parentName} ➔ {child.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tùy chọn Đề Ẩn / Mã Code Bí Mật & Giám sát */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-black text-slate-900 dark:text-white">Đề thi ẩn (Cấp mã Access Code)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={examIsHidden}
                        onChange={(e) => setExamIsHidden(e.target.checked)}
                        className="h-4 w-4 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                    {examIsHidden && (
                      <input
                        type="text"
                        placeholder="Mã mở đề (VD: TOAN12, HSA2026...)"
                        value={examCustomCode}
                        onChange={(e) => setExamCustomCode(e.target.value.toUpperCase())}
                        className="h-9 w-full font-mono font-bold uppercase rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-rose-500" />
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">Bật giám sát chống gian lận</p>
                        <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-normal">Cảnh báo & đếm số lần thoát tab</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireProctoring}
                      onChange={(e) => setRequireProctoring(e.target.checked)}
                      className="h-4 w-4 accent-rose-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. THANH GẠT YÊU CẦU SAFE EXAM BROWSER (SEB) */}
            <div className={`p-6 sm:p-7 rounded-[32px] border transition-all shadow-xl backdrop-blur-xl ${
              requireSeb
                ? 'bg-sky-50/90 dark:bg-sky-950/30 border-sky-300 dark:border-sky-500/40 ring-2 ring-sky-500/20'
                : 'bg-white/85 dark:bg-slate-900/85 border-black/10 dark:border-white/10'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${
                      requireSeb ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}>
                      3. Yêu Cầu Thi Bằng Safe Exam Browser (SEB)
                    </h3>
                    {requireSeb ? (
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-600 text-white shadow-xs">
                        🛡️ ĐANG BẬT (Bắt buộc SEB)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        🌐 ĐANG TẮT (Thi web thường)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {requireSeb
                      ? '🔒 Đề thi được bảo mật toàn diện: Gắn nhãn số 🛡️ SEB trên trang danh sách đề thi SenExam. Thí sinh bắt buộc phải cài đặt Safe Exam Browser và khởi chạy phòng thi bảo mật cao (chặn Alt+Tab, chặn chụp màn hình, chặn phần mềm bên thứ ba).'
                      : 'Thí sinh có thể làm bài trực tiếp trên trình duyệt web thông thường (Chrome, Edge, Safari...). Hãy gạt thanh công tắc bên cạnh sang BẬT nếu đây là kỳ thi chuẩn hóa đòi hỏi tính trung thực cao.'}
                  </p>
                </div>

                {/* THANH GẠT (TOGGLE SWITCH) */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requireSeb}
                      onChange={(e) => setRequireSeb(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-16 h-8 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-8 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-[26px] after:w-[26px] after:transition-all peer-checked:bg-sky-600 shadow-inner"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* 4. CẤU TRÚC ĐỀ THI & BẢNG ĐÁP ÁN LINH HOẠT */}
            <div className="p-6 sm:p-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 shadow-xl backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
                <div>
                  <h2
                    className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
                  >
                    4. Cấu Trúc Các Phần Thi & Hướng Dẫn Tự Viết
                  </h2>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                    Tùy biến số phần thi, số câu hỏi, cách tính điểm, hướng dẫn riêng và ảnh minh họa cho từng phần.
                  </p>
                </div>

                {/* Thống kê và Nút Thêm Phần */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                    <span>{examSections.length} Phần thi</span>
                    <span>•</span>
                    <span>{totalQuestionCount} Câu hỏi</span>
                    <span>•</span>
                    <span className={totalExamPoints === 10 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                      Tổng: {totalExamPoints.toFixed(1)} / 10.0 đ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Phần Thi</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các phần thi */}
              <div className="space-y-6">
                {(examSections || []).map((section, sIdx) => {
                  const qCount = parseInt(String(section.questionCount)) || 0
                  const pointsPerQ = section.totalPoints / (qCount || 1)

                  return (
                    <div
                      key={section.id || sIdx}
                      className="p-5 sm:p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.015] space-y-5"
                    >
                      {/* Tiêu đề phần thi & nút xóa */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'name', e.target.value)}
                            placeholder={`Tên phần thi (Ví dụ: Phần ${sIdx + 1}: Trắc nghiệm...)`}
                            className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQuickAnswersModalSecId(section.id)}
                            className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500/20"
                          >
                            ⚡ Nhập nhanh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sIdx)}
                            className="h-8 w-8 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center justify-center transition shrink-0"
                            title="Xóa phần thi này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Các tham số cấu hình: Số câu, Tổng điểm, Chế độ chia điểm, Thể loại câu hỏi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-black/10 dark:border-white/10 text-xs">
                        {/* 1. Số lượng câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Số Câu Hỏi</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={section.questionCount}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* 2. Tổng điểm phần này */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Tổng Điểm Phần Này</label>
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={10}
                            value={section.totalPoints}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'totalPoints', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* 3. Chế độ chia điểm */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Cách Tính Điểm</label>
                          <select
                            value={section.scoringMode}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'scoringMode', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="auto_divide">
                              Chia đều ({pointsPerQ.toFixed(2)}đ/câu)
                            </option>
                            <option value="custom_points">Tùy chỉnh điểm từng câu</option>
                          </select>
                        </div>

                        {/* 4. Thể loại câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Thể Loại Câu Hỏi</label>
                          <select
                            value={
                              section.type === 'mixed' || section.questionTypeMode === 'mixed'
                                ? 'mixed'
                                : section.questionTypeMode === 'custom'
                                ? 'custom'
                                : section.type
                            }
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'custom') {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'custom')
                              } else if (val === 'mixed') {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'mixed')
                                handleUpdateSectionField(sIdx, 'type', 'mixed')
                                const count = section.questionCount || 10
                                if (!section.mixedRanges || section.mixedRanges.length === 0) {
                                  const splitPoint = Math.max(1, Math.floor(count * 0.6))
                                  handleUpdateSectionField(sIdx, 'mixedRanges', [
                                    { start: 1, end: splitPoint, type: 'single_choice', optionsCount: 4 },
                                    { start: splitPoint + 1, end: count, type: 'short_answer', optionsCount: 4 },
                                  ])
                                }
                              } else {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'uniform')
                                handleUpdateSectionField(sIdx, 'type', val)
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="single_choice">🔵 Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                            <option value="true_false">🟢 Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)</option>
                            <option value="short_answer">🟠 Trả lời ngắn / Điền số</option>
                            <option value="essay">🟣 Tự luận</option>
                            <option value="mixed">🔀 Đề hỗn hợp (Theo dải câu / Nhiều dạng)</option>
                            <option value="custom">⚙️ Tùy chọn từng câu</option>
                          </select>
                        </div>
                      </div>

                      {/* Quản lý dải câu hỏi hỗn hợp (mixedRanges) */}
                      {(section.type === 'mixed' || section.questionTypeMode === 'mixed') && (
                        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 dark:border-indigo-500/20 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                                Phân Định Dải Câu Hỏi (Chế Độ Hỗn Hợp)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'thptqg')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset THPTQG (18-4-6)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'hsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset HSA (40-10)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'tsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset TSA (30-6-4)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddMixedRange(sIdx)}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" /> Thêm dải câu
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(section.mixedRanges || []).map((range: any, rIdx: number) => (
                              <div
                                key={rIdx}
                                className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-500/20 text-xs shadow-2xs"
                              >
                                <span className="text-indigo-900 dark:text-indigo-200 font-black text-[11px]">Dải #{rIdx + 1}:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">Từ câu</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.start}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'start', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 font-mono font-bold text-center text-xs bg-slate-50 dark:bg-slate-900"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">đến</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.end}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'end', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 font-mono font-bold text-center text-xs bg-slate-50 dark:bg-slate-900"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">Dạng câu:</span>
                                  <select
                                    value={range.type}
                                    onChange={(e) => handleUpdateMixedRange(sIdx, rIdx, 'type', e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                                  >
                                    <option value="single_choice">🔵 Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                                    <option value="true_false">🟢 Đúng / Sai (4 ý a, b, c, d)</option>
                                    <option value="short_answer">🟠 Điền số / Trả lời ngắn</option>
                                    <option value="essay">🟣 Tự luận</option>
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMixedRange(sIdx, rIdx)}
                                  className="ml-auto text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title="Xóa dải câu này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {(!section.mixedRanges || section.mixedRanges.length === 0) && (
                              <p className="text-xs text-indigo-900/60 dark:text-indigo-300/60 italic py-1">
                                Chưa có dải câu nào được thiết lập. Hãy bấm "+ Thêm dải câu" hoặc chọn một mẫu Preset có sẵn ở trên.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hướng Dẫn Tự Viết & Ảnh Minh Họa Cho Phần Này */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-black/10 dark:border-white/10">
                        {/* Hướng dẫn tự viết */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Hướng Dẫn Làm Bài Cho Phần Này (Admin tự viết):</span>
                          </label>
                          <textarea
                            value={section.instructions}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'instructions', e.target.value)}
                            placeholder="Nhập hướng dẫn làm bài chi tiết cho phần này (thí sinh sẽ đọc tại phòng chờ)..."
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                          />
                        </div>

                        {/* Hình ảnh hướng dẫn (nếu có) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Hình Ảnh Hướng Dẫn (Nếu có):</span>
                            </span>
                            {section.instructionImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateSectionField(sIdx, 'instructionImage', '')}
                                className="text-[11px] text-rose-600 dark:text-rose-400 font-bold hover:underline"
                              >
                                Xóa ảnh
                              </button>
                            )}
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={section.instructionImage || ''}
                              onChange={(e) => handleUpdateSectionField(sIdx, 'instructionImage', e.target.value)}
                              placeholder="Dán URL ảnh hoặc tải ảnh từ máy tính ➔"
                              className="flex-1 px-2.5 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <label className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition flex items-center gap-1 shrink-0">
                              <FileUp className="h-3.5 w-3.5" />
                              <span>Tải ảnh</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleUploadInstructionImage(sIdx, f)
                                }}
                              />
                            </label>
                          </div>

                          {section.instructionImage && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-h-28 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                              <img
                                src={section.instructionImage}
                                alt="Ảnh hướng dẫn"
                                className="max-h-28 w-auto object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bảng nhập đáp án & điểm cho các câu hỏi của phần này */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>Bảng Nhập Đáp Án ({section.questionCount} câu hỏi):</span>
                          {section.scoringMode === 'custom_points' && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-normal">
                              ⚠️ Đang bật chế độ tùy chỉnh điểm từng câu
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          {Array.from({ length: qCount }).map((_, qIdx) => {
                            const ans = section.correctAnswers?.[qIdx]
                            const rawQType =
                              section.questionTypeMode === 'custom' && section.questionTypes?.[qIdx]
                                ? section.questionTypes[qIdx]
                                : section.type
                            const qType = normalizeQuestionType(rawQType, section, qIdx)

                            const currentPoint =
                              section.scoringMode === 'custom_points'
                                ? section.pointsPerQuestion?.[qIdx] ?? pointsPerQ
                                : pointsPerQ

                            return (
                              <div
                                key={qIdx}
                                className="p-3 rounded-2xl bg-white dark:bg-slate-800/95 border border-black/10 dark:border-white/10 text-xs shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-600 dark:text-slate-400">Câu {qIdx + 1}</span>
                                    <span
                                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                        qType === 'single_choice'
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                                          : qType === 'true_false'
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                          : qType === 'short_answer'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                          : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400'
                                      }`}
                                    >
                                      {qType === 'single_choice'
                                        ? 'TN'
                                        : qType === 'true_false'
                                        ? 'Đ/S'
                                        : qType === 'short_answer'
                                        ? 'Số'
                                        : 'Luận'}
                                    </span>
                                  </div>

                                  {/* Điểm tùy chỉnh nếu bật custom_points */}
                                  {section.scoringMode === 'custom_points' ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={currentPoint}
                                        onChange={(e) =>
                                          handleSetQuestionPoint(sIdx, qIdx, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-12 px-1 py-0.5 rounded border border-black/10 dark:border-white/15 text-center font-bold text-[11px] bg-slate-50 dark:bg-slate-900"
                                      />
                                      <span className="text-[10px] text-slate-400">đ</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {pointsPerQ.toFixed(2)}đ
                                    </span>
                                  )}
                                </div>

                                {/* Lựa chọn thể loại câu nếu ở chế độ custom */}
                                {section.questionTypeMode === 'custom' && (
                                  <select
                                    value={qType}
                                    onChange={(e) => handleSetQuestionType(sIdx, qIdx, e.target.value)}
                                    className="w-full px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 text-[10px] font-bold bg-slate-50 dark:bg-slate-900"
                                  >
                                    <option value="single_choice">4 Lựa chọn</option>
                                    <option value="true_false">Đúng / Sai</option>
                                    <option value="short_answer">Điền số</option>
                                    <option value="essay">Tự luận</option>
                                  </select>
                                )}

                                {/* Nhập đáp án cho dạng trắc nghiệm 4 lựa chọn */}
                                {qType === 'single_choice' && (
                                  <div className="flex gap-1 pt-1">
                                    {['A', 'B', 'C', 'D'].map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleSetCorrectAnswer(sIdx, qIdx, opt)}
                                        className={`flex-1 h-7 rounded-lg font-black transition cursor-pointer ${
                                          ans === opt
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Nhập đáp án cho dạng Đúng / Sai 4 ý */}
                                {qType === 'true_false' && (
                                  <div className="space-y-1 pt-1">
                                    {['a', 'b', 'c', 'd'].map((sub) => (
                                      <div key={sub} className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold uppercase text-slate-400">{sub}:</span>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'Đ')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer ${
                                              ans?.[sub] === 'Đ' || ans?.[sub] === 'D'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                            }`}
                                          >
                                            Đ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'S')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer ${
                                              ans?.[sub] === 'S'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                            }`}
                                          >
                                            S
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Nhập đáp án cho dạng trả lời ngắn / điền số */}
                                {qType === 'short_answer' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Đáp số..."
                                      className="w-full px-2 py-1.5 rounded-lg border border-black/10 dark:border-white/15 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}

                                {/* Dạng tự luận */}
                                {qType === 'essay' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Barem / từ khóa..."
                                      className="w-full px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 text-[11px] bg-slate-50 dark:bg-slate-900"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nút Xuất Bản */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={creatingExam}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-xl shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
              >
                {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                <span>Xuất Bản Toàn Bộ Đề Thi Lên Hệ Thống</span>
              </button>
            </div>
          </form>
        )}

        {/* MODAL NHẬP ĐÁP ÁN NHANH BẰNG TEXT */}
        {quickAnswersModalSecId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}>
                ⚡ Nhập Chuỗi Đáp Án Nhanh
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Dán chuỗi đáp án (VD: <code>1A 2B 3C 4D...</code> hoặc <code>1Đ-S-Đ-S 2S-Đ-Đ-S...</code> hoặc dán chuỗi chữ cái <code>ABCDADCB...</code>):
              </p>

              <textarea
                rows={5}
                value={quickAnswersText}
                onChange={(e) => setQuickAnswersText(e.target.value)}
                placeholder="Dán chuỗi đáp án vào đây..."
                className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-indigo-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAnswersModalSecId(null)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickAnswers(quickAnswersModalSecId, quickAnswersText)}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Nạp Đáp Án
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL AI SOẠN ĐỀ GEMINI ĐA TẦNG */}
      {/* ==================================================== */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                  AI Gemini Soạn Đề KaTeX
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Chủ đề / Yêu cầu cụ thể cho AI:
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ví dụ: Tạo 5 câu trắc nghiệm Toán 12 về Nguyên hàm - Tích phân có công thức KaTeX đẹp và lời giải chi tiết..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số lượng câu hỏi</label>
                  <select
                    value={aiQuestionCount}
                    onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold outline-none"
                  >
                    <option value={3}>3 câu</option>
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu</option>
                    <option value={15}>15 câu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Mức độ tư duy</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="Nhận biết - Thông hiểu">Nhận biết - Thông hiểu</option>
                    <option value="Vận dụng">Vận dụng</option>
                    <option value="Vận dụng cao">Vận dụng cao (Phân hóa)</option>
                  </select>
                </div>
              </div>

              {aiStatusMessage && (
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>{aiStatusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                disabled={aiLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleGenerateAiKatexExam}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 text-xs font-black shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Bắt đầu soạn đề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL QUẢN LÝ HỌC SINH & GIÁM SÁT VI PHẠM THI CỬ */}
      {managingExamStudents && (
        <ExamStudentProctorModal
          isOpen={Boolean(managingExamStudents)}
          onClose={() => setManagingExamStudents(null)}
          exam={managingExamStudents}
        />
      )}
    </main>
  )
}

export default function NewSetupCoursePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-bold">Đang tải Cổng Thiết lập Khóa học & Soạn đề KaTeX...</p>
      </div>
    )
  }

  return (
    <PageErrorBoundary>
      <SetupCourseMainContent />
    </PageErrorBoundary>
  )
}
