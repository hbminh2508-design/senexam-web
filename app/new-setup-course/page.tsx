'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import ExamStudentProctorModal from '@/app/components/ExamStudentProctorModal'
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
} from 'lucide-react'

// Render toán học KaTeX chuẩn xác
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-setup-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-setup-body' })

export interface KatexQuestion {
  id: string
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  text: string
  options: string[]
  correctAnswer: any
  explanation: string
  points: number
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

export default function NewSetupCoursePage() {
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
  // STATE: SOẠN ĐỀ PDF & SEB (DI DỜI TỪ NEW-ADMIN)
  // ==========================================
  const [pdfExamTitle, setPdfExamTitle] = useState('')
  const [pdfExamType, setPdfExamType] = useState('THPTQG')
  const [pdfExamDuration, setPdfExamDuration] = useState('50')
  const [pdfExamMaxScore, setPdfExamMaxScore] = useState('10')
  const [pdfExamAllowReview, setPdfExamAllowReview] = useState(true)
  const [pdfExamIsHidden, setPdfExamIsHidden] = useState(false)
  const [pdfExamCustomCode, setPdfExamCustomCode] = useState('')
  const [pdfExamBlock, setPdfExamBlock] = useState('A00')
  const [pdfSelectedSubjects, setPdfSelectedSubjects] = useState<string[]>(['Toán học'])
  const [pdfMaxAttempts, setPdfMaxAttempts] = useState('1')
  const [pdfGradingMethod, setPdfGradingMethod] = useState('highest')
  const [pdfRequireProctoring, setPdfRequireProctoring] = useState(false)
  const [pdfExamFile, setPdfExamFile] = useState<File | null>(null)
  const [pdfHasSeparateAnswerFile, setPdfHasSeparateAnswerFile] = useState(false)
  const [pdfAnswerFile, setPdfAnswerFile] = useState<File | null>(null)
  const [creatingPdfExam, setCreatingPdfExam] = useState(false)
  const [requireSeb, setRequireSeb] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [folders, setFolders] = useState<any[]>([])

  // PDF Sections
  const [pdfSections, setPdfSections] = useState<SectionItem[]>([
    {
      id: 'sec-1',
      name: 'Phần 1: Trắc nghiệm 4 phương án (Chọn 1)',
      totalPoints: 4.5,
      scoringMode: 'auto_divide',
      questionCount: 18,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-2',
      name: 'Phần 2: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)',
      totalPoints: 4.0,
      scoringMode: 'auto_divide',
      questionCount: 4,
      questionTypeMode: 'uniform',
      type: 'true_false',
      instructions: 'Thí sinh chọn Đúng hoặc Sai cho mỗi ý a, b, c, d. Điểm tính theo số ý đúng.',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-3',
      name: 'Phần 3: Trả lời ngắn / Điền số',
      totalPoints: 1.5,
      scoringMode: 'auto_divide',
      questionCount: 6,
      questionTypeMode: 'uniform',
      type: 'short_answer',
      instructions: 'Thí sinh điền kết quả dạng số nguyên hoặc số thập phân vào ô trống.',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
  ])

  // Theme Variables
  const themeVars = useMemo(() => getModernThemeVars('emerald', isDark), [isDark])

  // Kiểm tra quyền và tải danh sách đề
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const initPage = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) {
          router.replace('/new-sign')
          return
        }

        await ensureStudentProfile(user.id)
        setCurrentUser(user)

        // Kiểm tra role người dùng
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        const role = (profile?.role || 'student') as 'admin' | 'collab' | 'teacher' | 'student'
        setUserRole(role)

        // Tải danh sách đề thi:
        // - Admin/Colab/Teacher: tải toàn bộ đề thi trong hệ thống
        // - Student: chỉ tải các đề thi do chính sinh viên đó tạo ra (created_by === user.id)
        let query = supabase.from('exams').select('*').order('created_at', { ascending: false })
        if (role === 'student') {
          query = query.eq('created_by', user.id)
        }

        const { data: exData, error: exErr } = await query
        if (!exErr && exData) {
          setExamsList(exData)
        }

        // Tải danh sách thư mục SEB
        const { data: fData } = await supabase.from('seb_folders').select('*, children:seb_subfolders(*)').order('created_at', { ascending: true })
        if (fData) setFolders(fData)
      } catch (err) {
        console.error('Lỗi khởi tạo Setup Course:', err)
      } finally {
        setLoading(false)
      }
    }

    initPage()
  }, [router])

  // Lọc đề thi hiển thị
  const filteredExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase()
    if (!q) return examsList
    return examsList.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.exam_type?.toLowerCase().includes(q) ||
        e.access_code?.toLowerCase().includes(q)
    )
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

  // ==========================================
  // XỬ LÝ LƯU ĐỀ THI PDF & SEB (DI DỜI TỪ NEW-ADMIN)
  // ==========================================
  const handleSavePdfExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pdfExamTitle.trim() || !pdfExamFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    setCreatingPdfExam(true)
    try {
      // 1. Upload Google Drive
      const uploadUrl = await initGoogleDriveUpload(pdfExamFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, pdfExamFile, pdfExamTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      const isStudent = userRole === 'student'
      const isHiddenEffective = isStudent ? true : pdfExamIsHidden
      const accessCode = isHiddenEffective
        ? pdfExamCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      const parsedMaxScore = parseFloat(pdfExamMaxScore) || 10
      const totalQs = pdfSections.reduce((sum, s) => sum + (parseInt(String(s.questionCount)) || 0), 0)

      const examPayload: any = {
        title: pdfExamTitle.trim(),
        exam_type: pdfExamType,
        duration: parseInt(pdfExamDuration) || 50,
        drive_file_id: driveFileId,
        exam_structure: pdfSections,
        allow_review: pdfExamAllowReview,
        is_hidden: isHiddenEffective,
        access_code: accessCode,
        subjects: pdfSelectedSubjects,
        max_attempts: parseInt(pdfMaxAttempts) || 1,
        grading_method: pdfGradingMethod,
        require_proctoring: pdfRequireProctoring,
        folder_id: selectedFolderId || null,
        require_seb: requireSeb,
        created_by: currentUser?.id,
        max_score: parsedMaxScore,
      }

      const { data, error } = await supabase.from('exams').insert(examPayload).select('*').single()
      if (error) throw error

      setExamsList([data, ...examsList])
      setPdfExamTitle('')
      setPdfExamFile(null)
      setActiveTab('manage')
      alert(`🎉 Đã xuất bản đề thi PDF thành công (${totalQs} câu hỏi)!`)
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi PDF: ${err.message}`)
    } finally {
      setCreatingPdfExam(false)
    }
  }

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
          {userRole === 'admin' && (
            <Link
              href="/new-admin"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Về Admin Portal
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
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
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
                {filteredExams.map((exam) => {
                  const isKatexFormat = !exam.drive_file_id && !exam.pdf_url
                  const questionCount =
                    exam.exam_structure?.reduce(
                      (acc: number, s: any) => acc + (s.questions?.length || s.questionCount || 0),
                      0
                    ) || 0

                  return (
                    <div
                      key={exam.id}
                      className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
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
                      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                        <Link
                          href={`/new-exams/${exam.id}`}
                          className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" /> Xem đề thi
                        </Link>

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
                {MATH_KEYBOARD_TABS.find((t) => t.id === activeKeyboardTab)?.keys.map((k, kIdx) => (
                  <button
                    key={kIdx}
                    type="button"
                    onClick={() => handleInsertMathKey(k.insert)}
                    className="h-10 min-w-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-400 text-xs font-bold transition flex items-center justify-center shadow-sm active:scale-95"
                    title={`Chèn: ${k.insert}`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {`$${k.display}$`}
                    </ReactMarkdown>
                  </button>
                ))}
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI SOẠN TRỰC TIẾP */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                  2. Danh sách câu hỏi ({katexQuestions.length} câu)
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

              {katexQuestions.map((q, qIdx) => (
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
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.text || '*(Chưa có nội dung câu hỏi)*'}
                        </ReactMarkdown>
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
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {optText}
                                    </ReactMarkdown>
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
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {q.explanation}
                        </ReactMarkdown>
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
        {/* ==================================================== */}
        {activeTab === 'create_pdf' && (
          <form onSubmit={handleSavePdfExam} className="space-y-8">
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                1. Đính kèm File Đề Thi PDF & Cấu hình SEB
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Tên đề thi PDF *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đề thi thử THPT Quốc gia 2026 - Môn Toán (Mã đề 101)"
                    value={pdfExamTitle}
                    onChange={(e) => setPdfExamTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Loại kỳ thi</label>
                  <select
                    value={pdfExamType}
                    onChange={(e) => setPdfExamType(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
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
                    value={pdfExamDuration}
                    onChange={(e) => setPdfExamDuration(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                {/* File PDF Đề Thi */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">File PDF đề thi *</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    required
                    onChange={(e) => setPdfExamFile(e.target.files?.[0] || null)}
                    className="w-full text-xs font-bold file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                  />
                </div>

                {/* Thanh gạt SEB */}
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="requireSeb"
                    checked={requireSeb}
                    onChange={(e) => setRequireSeb(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <label htmlFor="requireSeb" className="text-xs font-bold cursor-pointer select-none">
                    Yêu cầu Safe Exam Browser (SEB)
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="pdfExamAllowReview"
                    checked={pdfExamAllowReview}
                    onChange={(e) => setPdfExamAllowReview(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <label htmlFor="pdfExamAllowReview" className="text-xs font-bold cursor-pointer select-none">
                    Cho phép học sinh xem lại đáp án
                  </label>
                </div>
              </div>
            </div>

            {/* Nút lưu */}
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
                disabled={creatingPdfExam}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50"
              >
                {creatingPdfExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Tải lên & Xuất bản đề PDF
              </button>
            </div>
          </form>
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
    </main>
  )
}
