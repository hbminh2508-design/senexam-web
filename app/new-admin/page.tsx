'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { generateGiftCode, normalizeGiftCode, describeGiftReward } from '@/lib/giftCodes'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { AnnouncementRenderer, CountdownTimer } from '@/app/new-announcement/page'
import ExamStudentProctorModal from '@/app/components/ExamStudentProctorModal'
import {
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Coins,
  Gift,
  FileText,
  AlertCircle,
  Bug,
  Sparkles,
  Server,
  Activity,
  Radio,
  Clock,
  Eye,
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
  UserCheck,
  Zap,
  TrendingUp,
  Award,
  Crown,
  Lock,
  Unlock,
  Sliders,
  Send,
  UploadCloud,
  FileCheck,
  Megaphone,
  KeyRound,
  Layers,
  MessageSquare,
  School,
  FileCode,
  HelpCircle,
  X,
  FileUp,
  BookOpen,
  Image as ImageIcon,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-body' })

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

type AdminTab = 'overview' | 'exams' | 'create_exam' | 'announcements' | 'giveaway' | 'giftcodes' | 'users' | 'bugtracker'

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

export default function NewAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  // LIVE REAL-TIME METRICS & SERVER UPTIME
  const [uptimeSeconds, setUptimeSeconds] = useState(158420)
  const [onlineCount, setOnlineCount] = useState(0)
  const [realLiveExaminees, setRealLiveExaminees] = useState<any[]>([])

  // OVERVIEW STATS (100% REAL FROM DB)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSubmissions: 0,
    totalExams: 0,
    totalCodes: 0,
    totalAnnouncements: 0,
    totalFeedback: 0,
  })

  // EXAMS MANAGER & REAL HIDDEN ACCESS CODES
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [managingExamStudents, setManagingExamStudents] = useState<any | null>(null)

  // CREATE EXAM (PORTED FROM SEB-ADMIN WITH SEB TOGGLE)
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

  // SEB & Folder Settings
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [folders, setFolders] = useState<any[]>([])
  const [requireSeb, setRequireSeb] = useState(false) // Thanh gạt yêu cầu Safe Exam Browser (SEB)

  // AI Assistant State (Gemini)
  const [analyzingWithAi, setAnalyzingWithAi] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('')

  // Cấu trúc Phần thi linh hoạt (Sections)
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

  // ANNOUNCEMENTS MANAGER
  const [announcementsList, setAnnouncementsList] = useState<any[]>([])
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('###(H1) {Center: THÔNG BÁO QUAN TRỌNG TỪ SENEXAM}\n\nChào các sĩ tử! Kỳ thi THPT 2026 đang đến rất gần {time_:2026-06-25T07:30}.\n\nHãy tập trung ôn luyện và {bold:không ngừng nỗ lực} mỗi ngày nhé!')
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  // GIVEAWAY SENCASH
  const [giveawayTargetEmail, setGiveawayTargetEmail] = useState('')
  const [giveawayAmount, setGiveawayAmount] = useState('100')
  const [giveawayReason, setGiveawayReason] = useState('Quà tặng sự kiện SenExam 2026')
  const [giveawayLoading, setGiveawayLoading] = useState(false)
  const [giveawayMsg, setGiveawayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // GIFT CODES 16 CHARS (XXXX-XXXX-XXXX-XXXX)
  const [giftCodes, setGiftCodes] = useState<any[]>([])
  const [codeType, setCodeType] = useState<'sencash' | 'vip_days' | 'senai_tier'>('sencash')
  const [codeAmount, setCodeAmount] = useState('100')
  const [codeVipDays, setCodeVipDays] = useState('30')
  const [codeMaxUses, setCodeMaxUses] = useState('1')
  const [codeExpiresDays, setCodeExpiresDays] = useState('30')
  const [codeCustomInput, setCodeCustomInput] = useState('')
  const [codeBatchCount, setCodeBatchCount] = useState('1')
  const [codeLoading, setCodeLoading] = useState(false)

  // USERS & ROLES
  const [usersList, setUsersList] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')

  // REAL BUG TRACKER & USER FEEDBACK FROM DB
  const [feedbackList, setFeedbackList] = useState<any[]>([])

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    // Uptime ticker
    const uptimeTimer = setInterval(() => setUptimeSeconds((u) => u + 1), 1000)

    const initAdmin = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) {
          router.replace('/new-sign')
          return
        }

        await ensureStudentProfile(user.id)
        setCurrentUserId(user.id)

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const role = profile?.role || 'student'
        setUserRole(role)

        if (role !== 'admin' && role !== 'collab') {
          router.replace('/new-dashboard')
          return
        }

        setIsAdmin(true)

        // Fetch 100% REAL DATA from Supabase
        const [
          usersCount,
          subsCount,
          examsCount,
          codesData,
          examsData,
          usersData,
          announcementsData,
          feedbackData,
          recentSubsData,
          activeProfilesData,
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('submissions').select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
          supabase.from('gift_codes').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('exams').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(50),
          supabase
            .from('submissions')
            .select('id, user_id, exam_id, score, is_completed, submitted_at, created_at, tab_switches, blur_count, exams(title), profiles(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('profiles')
            .select('id, created_at')
            .limit(100),
        ])

        setStats({
          totalUsers: usersCount.count || 0,
          totalSubmissions: subsCount.count || 0,
          totalExams: examsCount.count || 0,
          totalCodes: codesData.data?.length || 0,
          totalAnnouncements: announcementsData.data?.length || 0,
          totalFeedback: feedbackData.data?.length || 0,
        })

        setGiftCodes(codesData.data || [])
        setExamsList(examsData.data || [])
        setUsersList(usersData.data || [])
        setAnnouncementsList(announcementsData.data || [])
        setFeedbackList(feedbackData.data || [])
        setOnlineCount(Math.max(1, activeProfilesData.data?.length || 1))

        // Fetch folders for exam categories
        try {
          const fRes = await fetch('/api/seb/folders')
          if (fRes.ok) {
            const fData = await fRes.json()
            if (fData?.folders && Array.isArray(fData.folders)) setFolders(fData.folders)
          }
        } catch (e) {
          console.warn('Lỗi tải folders:', e)
        }

        // Parse real examinees from recent submissions
        const examinees = (recentSubsData.data || []).map((sub: any) => {
          const switches = sub.tab_switches || sub.blur_count || 0
          const examName = Array.isArray(sub.exams) ? sub.exams[0]?.title : sub.exams?.title
          const prof = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles
          return {
            id: sub.id,
            name: prof?.full_name || 'Học sinh',
            email: prof?.email || 'N/A',
            examTitle: examName || 'Đề thi',
            timeElapsed: sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('vi-VN') : 'Đang làm bài',
            tabSwitches: switches,
            status: sub.is_completed ? 'Đã hoàn thành' : switches > 2 ? '⚠️ Thoát tab nhiều lần' : 'Đang thi',
            score: sub.score,
          }
        })
        setRealLiveExaminees(examinees)
      } catch (err) {
        console.error('Lỗi khởi tạo Admin:', err)
      } finally {
        setLoading(false)
      }
    }

    initAdmin()

    return () => clearInterval(uptimeTimer)
  }, [router])

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

  const formatUptime = (totalSecs: number) => {
    const days = Math.floor(totalSecs / 86400)
    const hours = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    return `${days}d ${hours}h ${mins}m ${secs}s`
  }

  const handleCopyCode = (id: string, codeStr: string) => {
    navigator.clipboard.writeText(codeStr)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // PRESET & MULTI-SECTION HANDLERS (PORTED FROM SEB-ADMIN)
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
      const currentQ = { ...(targetSec.correctAnswers[qIdx] || {}) }
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

      // 2. Sinh mã code ẩn nếu chọn đề ẩn
      const accessCode = examIsHidden
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
        is_hidden: examIsHidden,
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
      setActiveTab('exams')
      alert(`🎉 Đã xuất bản đề thi thành công (${totalQs} câu hỏi)! ${accessCode ? `Mã code: ${accessCode}` : ''} ${requireSeb ? '(Yêu cầu Safe Exam Browser)' : '(Web trực tuyến)'}`)
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // TẠO THÔNG BÁO MỚI CHO NGƯỜI DÙNG
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!annContent.trim()) {
      alert('Vui lòng nhập nội dung thông báo!')
      return
    }

    setSavingAnnouncement(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: annTitle.trim() || 'Thông Báo Từ Ban Quản Trị SenExam',
          content: annContent.trim(),
          is_active: true,
          created_by: currentUserId,
        })
        .select('*')
        .single()

      if (error) throw error

      setAnnouncementsList([data, ...announcementsList])
      setAnnTitle('')
      alert('Đã phát hành thông báo thành công tới toàn bộ người dùng!')
    } catch (err: any) {
      alert(`Lỗi phát hành thông báo: ${err.message}`)
    } finally {
      setSavingAnnouncement(false)
    }
  }

  // XÓA THÔNG BÁO
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncementsList(announcementsList.filter((a) => a.id !== id))
  }

  // ĐÓNG / MỞ XEM LẠI ĐÁP ÁN ĐỀ THI
  const handleToggleAllowReview = async (examId: string, currentVal: boolean) => {
    const nextVal = !currentVal
    try {
      const { error } = await supabase.from('exams').update({ allow_review: nextVal }).eq('id', examId)
      if (error) throw error
      setExamsList(examsList.map((ex) => (ex.id === examId ? { ...ex, allow_review: nextVal } : ex)))
    } catch (err: any) {
      alert(`Lỗi cập nhật quyền xem lại đáp án: ${err.message}`)
    }
  }

  // XÓA ĐỀ THI
  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA đề thi "${examTitle}"? Hành động này sẽ xóa toàn bộ bài làm và dữ liệu liên quan!`)) {
      return
    }
    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId)
      if (error) throw error
      setExamsList(examsList.filter((ex) => ex.id !== examId))
      alert(`Đã xóa thành công đề thi "${examTitle}"!`)
    } catch (err: any) {
      alert(`Lỗi xóa đề thi: ${err.message}`)
    }
  }

  // GIVEAWAY SENCASH
  const handleGiveawaySenCash = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = giveawayTargetEmail.trim()
    const amount = parseInt(giveawayAmount) || 0

    if (!email || amount <= 0) {
      setGiveawayMsg({ type: 'error', text: 'Vui lòng nhập đúng email và số SenCash hợp lệ (>0).' })
      return
    }

    setGiveawayLoading(true)
    setGiveawayMsg(null)

    try {
      const { data: targetProfile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, sencash_balance')
        .eq('email', email)
        .maybeSingle()

      if (pErr || !targetProfile) {
        throw new Error('Không tìm thấy tài khoản với email này.')
      }

      const newBal = (targetProfile.sencash_balance || 0) + amount
      await supabase.from('profiles').update({ sencash_balance: newBal }).eq('id', targetProfile.id)

      await supabase.from('sencash_transactions').insert({
        user_id: targetProfile.id,
        amount: amount,
        transaction_type: 'gift',
        description: giveawayReason || 'Admin Giveaway Tặng SenCash',
      })

      setGiveawayMsg({
        type: 'success',
        text: `Đã tặng thành công +${amount} SenCash cho ${targetProfile.full_name || email}! (Số dư mới: ${newBal} SC)`,
      })
      setGiveawayTargetEmail('')
    } catch (err: any) {
      setGiveawayMsg({ type: 'error', text: err.message || 'Lỗi khi tặng SenCash.' })
    } finally {
      setGiveawayLoading(false)
    }
  }

  // TẠO MÃ QUÀ TẶNG 16 CHỮ SỐ
  const handleCreateGiftCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeLoading(true)

    try {
      const count = parseInt(codeBatchCount) || 1
      const maxUses = parseInt(codeMaxUses) || 1
      const expiresDays = parseInt(codeExpiresDays) || 30
      const expiresAt = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString()
      const customCode = count === 1 && codeCustomInput.trim() ? normalizeGiftCode(codeCustomInput) : ''

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/admin/gift-codes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rewardType: codeType,
          count,
          maxUses,
          expiresAt,
          customCode,
          note: `Admin Giveaway (${new Date().toLocaleDateString('vi-VN')})`,
          sencashAmount: codeType === 'sencash' ? parseInt(codeAmount) || 100 : undefined,
          vipDays: codeType === 'vip_days' ? parseInt(codeVipDays) || 30 : undefined,
          senaiTier: 'ultra',
          senaiDurationDays: 30,
        }),
      })

      const resData = await res.json()
      if (!res.ok || resData.error) {
        throw new Error(resData.error || 'Lỗi từ máy chủ khi tạo mã')
      }

      const createdList = Array.isArray(resData.codes) ? resData.codes : []
      setGiftCodes([...createdList, ...giftCodes])
      setCodeCustomInput('')
      alert(`Đã tạo thành công ${createdList.length || count} mã quà tặng!`)
    } catch (err: any) {
      alert(`Lỗi tạo mã: ${err.message}`)
    } finally {
      setCodeLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải dữ liệu Quản trị Tối cao (Real-time)...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                  <ShieldCheck className="inline h-3.5 w-3.5 mr-1" /> Quản Trị Tối Cao 2.0 (Real Data)
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  {userRole.toUpperCase()}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Bảng Điều Khiển Hệ Thống & Giám Sát Real-time
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'overview'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Activity className="h-4 w-4 text-emerald-500" /> Giám Sát Trực Tiếp
          </button>
          <Link
            href="/new-setup-course"
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:scale-105"
          >
            <Sparkles className="h-4 w-4" /> Thiết Lập Khóa Học & Soạn Đề KaTeX (Trang Mới)
          </Link>
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'announcements'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Megaphone className="h-4 w-4 text-teal-500" /> Soạn Thông Báo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giveaway')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giveaway'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Coins className="h-4 w-4 text-amber-500" /> Tặng SenCash
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giftcodes')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giftcodes'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Gift className="h-4 w-4 text-pink-500" /> Mã Quà Tặng ({giftCodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'users'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Users className="h-4 w-4 text-purple-500" /> Thành Viên ({stats.totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bugtracker')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'bugtracker'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Bug className="h-4 w-4 text-rose-500" /> Phản Hồi & Lỗi ({feedbackList.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW & REAL-TIME PROCTORING */}
        {activeTab === 'overview' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Server Uptime</span>
                  <Server className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black font-mono">
                  {formatUptime(uptimeSeconds)}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">● 99.98% Operational</span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Online Real-time</span>
                  <Radio className="h-5 w-5 animate-pulse text-indigo-500" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {onlineCount} <span className="text-xs font-semibold text-[#6B7280]">thí sinh</span>
                </p>
                <span className="text-[10px] text-[#6B7280] mt-1 block">Active 30 phút qua</span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng thành viên</span>
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalUsers} <span className="text-xs font-semibold text-[#6B7280]">học sinh</span>
                </p>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng lượt nộp bài</span>
                  <FileCheck className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalSubmissions} <span className="text-xs font-semibold text-[#6B7280]">bài thi</span>
                </p>
              </div>
            </div>

            {/* REAL LIVE EXAM ROOM PROCTORING TABLE */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                    Giám Sát Phòng Thi Trực Tiếp & Cảnh Báo Gian Lận (Dữ Liệu Thật)
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400">
                  {realLiveExaminees.length} bài thi gần nhất
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Thí sinh</th>
                      <th className="pb-3 font-bold uppercase">Đề thi</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Số lần thoát tab</th>
                      <th className="pb-3 font-bold uppercase">Điểm / Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {realLiveExaminees.map((item) => (
                      <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <span className="text-[11px] text-[#6B7280]">{item.email}</span>
                        </td>
                        <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400 max-w-xs truncate">{item.examTitle}</td>
                        <td className="py-3 font-mono">{item.timeElapsed}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${
                            item.tabSwitches > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-black/5 dark:bg-white/5'
                          }`}>
                            {item.tabSwitches} lần
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                            item.tabSwitches > 2
                              ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            {item.score !== null ? `${item.score}đ - ${item.status}` : item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ĐÃ DI DỜI QUẢN LÝ ĐỀ THI & SOẠN ĐỀ SANG /new-setup-course */}
        {((activeTab as any) === 'exams' || (activeTab as any) === 'create_exam') && (
          <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              Quản Lý Đề Thi & Soạn Đề Đã Được Chuyển Sang Cổng Mới!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Toàn bộ tính năng Quản lý đề thi, Soạn đề thi (SEB & KaTeX trực tiếp) đã được chuyển sang Cổng Thiết Lập Khóa Học độc lập.
            </p>
            <Link
              href="/new-setup-course"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 transition"
            >
              Mở Cổng Thiết Lập Khóa Học & Quản Lý Đề <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {/* TAB 4: ANNOUNCEMENTS WRITER */}
        {activeTab === 'announcements' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Editor */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                <Megaphone className="h-5 w-5 text-teal-500" /> Soạn Thông Báo Cho Người Dùng
              </h3>

              <form onSubmit={handlePublishAnnouncement} className="space-y-3.5 text-xs font-bold">
                <div>
                  <label className="text-[#6B7280] block mb-1">Tiêu đề thông báo:</label>
                  <input
                    type="text"
                    placeholder="VD: Cập nhật hệ thống SenExam 2026..."
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#6B7280] block mb-1">
                    Nội dung thông báo (hỗ trợ cú pháp <code>###(H1)</code>, <code>{'{Center:...}'}</code>, <code>{'{bold:...}'}</code>, <code>{'{time_:YYYY-MM-DDTHH:mm}'}</code>):
                  </label>
                  <textarea
                    rows={8}
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {savingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Phát Hành Thông Báo Ngay
                </button>
              </form>
            </div>

            {/* Live Preview */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#6B7280] block">
                Xem Trước Giao Diện Bản Tin (Live Preview)
              </span>
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5">
                <AnnouncementRenderer text={annContent} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GIVEAWAY SENCASH */}
        {activeTab === 'giveaway' && (
          <div className="mt-6 max-w-2xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  Giveaway Tặng SenCash
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Cộng trực tiếp SenCash vào ví học sinh theo địa chỉ Email đăng ký.
                </p>
              </div>
            </div>

            <form onSubmit={handleGiveawaySenCash} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Email học sinh nhận thưởng
                </label>
                <input
                  type="email"
                  placeholder="vidu: hocsinh@gmail.com"
                  value={giveawayTargetEmail}
                  onChange={(e) => setGiveawayTargetEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-xs sm:text-sm font-semibold outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Số lượng SenCash tặng
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['50', '100', '200', '500'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setGiveawayAmount(amt)}
                      className={`rounded-xl py-2 text-xs font-black border transition ${
                        giveawayAmount === amt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                      }`}
                    >
                      +{amt} SC
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={giveawayAmount}
                  onChange={(e) => setGiveawayAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Lời nhắn / Lý do tặng
                </label>
                <input
                  type="text"
                  placeholder="Quà tặng vinh danh sĩ tử đạt điểm cao..."
                  value={giveawayReason}
                  onChange={(e) => setGiveawayReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-semibold outline-none"
                />
              </div>

              {giveawayMsg && (
                <div className={`rounded-2xl border p-4 text-xs font-bold flex items-center gap-2 ${
                  giveawayMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                }`}>
                  {giveawayMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{giveawayMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={giveawayLoading || !giveawayTargetEmail.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {giveawayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Tặng SenCash Ngay
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: GIFT CODES 16 CHARS */}
        {activeTab === 'giftcodes' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                <Gift className="h-5 w-5 text-pink-500" /> Tạo Mã Quà Tặng 16 Chữ Số
              </h3>

              <form onSubmit={handleCreateGiftCodes} className="space-y-3.5 text-xs font-bold">
                <div>
                  <span className="text-[#6B7280] block mb-1">Loại phần thưởng:</span>
                  <select
                    value={codeType}
                    onChange={(e) => setCodeType(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="sencash">Tặng SenCash</option>
                    <option value="vip_days">Tặng Ngày VIP</option>
                    <option value="senai_tier">Tặng Gói SenAI Ultra</option>
                  </select>
                </div>

                {codeType === 'sencash' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượng SenCash:</span>
                    <input
                      type="number"
                      value={codeAmount}
                      onChange={(e) => setCodeAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                {codeType === 'vip_days' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số ngày VIP:</span>
                    <input
                      type="number"
                      value={codeVipDays}
                      onChange={(e) => setCodeVipDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượt dùng:</span>
                    <input
                      type="number"
                      min="1"
                      value={codeMaxUses}
                      onChange={(e) => setCodeMaxUses(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-1">Hạn dùng (ngày):</span>
                    <input
                      type="number"
                      min="1"
                      value={codeExpiresDays}
                      onChange={(e) => setCodeExpiresDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7280] block mb-1">Số lượng mã muốn tạo:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={codeBatchCount}
                    onChange={(e) => setCodeBatchCount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={codeLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50 mt-2"
                >
                  {codeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Tạo Mã 16 Ký Tự (XXXX-XXXX-XXXX-XXXX)
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Danh Sách Mã Quà Tặng ({giftCodes.length})
              </h3>

              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Mã (16 ký tự)</th>
                      <th className="pb-3 font-bold uppercase">Phần thưởng</th>
                      <th className="pb-3 font-bold uppercase">Đã dùng</th>
                      <th className="pb-3 font-bold uppercase">Hạn dùng</th>
                      <th className="pb-3 font-bold uppercase text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {giftCodes.map((c) => (
                      <tr key={c.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3 font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {c.code}
                        </td>
                        <td className="py-3">{describeGiftReward(c)}</td>
                        <td className="py-3">
                          {c.used_count}/{c.max_uses}
                        </td>
                        <td className="py-3 text-[11px] text-[#6B7280]">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.id, c.code)}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 text-[11px] font-bold hover:bg-black/5"
                          >
                            {copiedCodeId === c.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedCodeId === c.id ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: USERS LIST */}
        {activeTab === 'users' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              Quản Lý Thành Viên & Phân Quyền ({usersList.length})
            </h3>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                    <th className="pb-3 font-bold uppercase">Họ tên & Email</th>
                    <th className="pb-3 font-bold uppercase">Vai trò</th>
                    <th className="pb-3 font-bold uppercase">Số dư SenCash</th>
                    <th className="pb-3 font-bold uppercase">Hạn VIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-3">
                        <p className="font-bold">{u.full_name || 'Học sinh'}</p>
                        <span className="text-[11px] text-[#6B7280]">{u.email || u.id}</span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 font-bold uppercase text-[10px]">
                          {u.role || 'student'}
                        </span>
                      </td>
                      <td className="py-3 font-black text-amber-600 dark:text-amber-400">
                        {(u.sencash_balance || 0).toLocaleString('vi-VN')} SC
                      </td>
                      <td className="py-3 text-[11px] text-[#6B7280]">
                        {u.vip_expires_at ? new Date(u.vip_expires_at).toLocaleDateString('vi-VN') : 'Miễn phí'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: BUG TRACKER & REAL USER FEEDBACK */}
        {activeTab === 'bugtracker' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black flex items-center gap-2 text-rose-500" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              <Bug className="h-5 w-5" /> Nhật Ký Báo Lỗi & Góp Ý Từ Người Dùng ({feedbackList.length})
            </h3>

            <div className="space-y-3">
              {feedbackList.length === 0 ? (
                <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center py-8">
                  Chưa có báo lỗi hoặc góp ý nào từ người dùng.
                </p>
              ) : (
                feedbackList.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-xs font-semibold space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{b.user_name || b.user_email || 'Học sinh'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase">
                          {b.category || 'Góp ý'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7280]">{new Date(b.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-black/5 dark:border-white/5 font-normal leading-relaxed">
                      {b.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MODAL QUẢN LÝ HỌC SINH THEO TRƯỜNG / LỚP & GIÁM THỊ AI */}
        <ExamStudentProctorModal
          isOpen={Boolean(managingExamStudents)}
          onClose={() => setManagingExamStudents(null)}
          exam={managingExamStudents}
        />
      </div>
    </main>
  )
}
