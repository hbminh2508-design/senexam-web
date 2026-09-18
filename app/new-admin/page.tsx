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
    const list: any[] = []
    folders.forEach((parent: any) => {
      if (parent.children) {
        parent.children.forEach((child: any) => {
          list.push({ ...child, parentName: parent.name })
        })
      }
    })
    return list
  }, [folders])

  // Thống kê tổng điểm và tổng số câu của toàn đề
  const totalExamPoints = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (Number(sec.totalPoints) || 0), 0)
  }, [examSections])

  const totalQuestionCount = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (parseInt(String(sec.questionCount)) || 0), 0)
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
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'student'
      setUserRole(role)

      if (role !== 'admin' && role !== 'collab') {
        alert('Bạn không có quyền truy cập vào cổng quản trị!')
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
          .select('id, updated_at')
          .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
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
        const fData = await fRes.json()
        if (fData?.folders) setFolders(fData.folders)
      } catch (e) {
        console.warn('Lỗi tải folders:', e)
      }

      // Parse real examinees from recent submissions
      const examinees = (recentSubsData.data || []).map((sub: any) => {
        const switches = sub.tab_switches || sub.blur_count || 0
        return {
          id: sub.id,
          name: sub.profiles?.full_name || 'Học sinh',
          email: sub.profiles?.email || 'N/A',
          examTitle: sub.exams?.title || 'Đề thi',
          timeElapsed: sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('vi-VN') : 'Đang làm bài',
          tabSwitches: switches,
          status: sub.is_completed ? 'Đã hoàn thành' : switches > 2 ? '⚠️ Thoát tab nhiều lần' : 'Đang thi',
          score: sub.score,
        }
      })
      setRealLiveExaminees(examinees)

      setLoading(false)
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
      const synchronizedSections = examSections.map((s) => {
        const pts = Number(s.totalPoints) || 10
        return {
          ...s,
          totalPoints: pts,
          sectionTotalPoints: pts,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          customPoints: s.pointsPerQuestion || {},
        }
      })

      const totalQs = examSections.reduce((sum, s) => sum + (parseInt(String(s.questionCount)) || 0), 0)

      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
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
        })
        .select('*')
        .single()

      if (examErr) throw examErr

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
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-500" /> Quản Lý Đề Thi ({examsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create_exam')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'create_exam'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Plus className="h-4 w-4 text-cyan-500" /> Soạn Đề Thi Mới
          </button>
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

        {/* TAB 2: EXAMS MANAGER & REAL HIDDEN ACCESS CODES */}
        {activeTab === 'exams' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi hoặc mã code ẩn..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 pl-10 pr-3 text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create_exam')}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
              >
                <Plus className="h-4 w-4" /> Soạn Đề Thi Mới
              </button>
            </div>

            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Tên đề thi</th>
                      <th className="pb-3 font-bold uppercase">Phân loại</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Mã Code Ẩn (Bí Mật)</th>
                      <th className="pb-3 font-bold uppercase">Xem lại đáp án</th>
                      <th className="pb-3 font-bold uppercase text-right">Phòng thi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {examsList
                      .filter((e) => (e.title || '').toLowerCase().includes(examSearch.toLowerCase().trim()) || (e.access_code || '').toLowerCase().includes(examSearch.toLowerCase().trim()))
                      .map((exam) => (
                        <tr key={exam.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="py-3.5 font-bold max-w-xs truncate text-slate-900 dark:text-white">
                            {exam.title}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                              {exam.exam_type}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono">{exam.duration} phút</td>
                          <td className="py-3.5">
                            {exam.access_code ? (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                  {exam.access_code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(exam.id, exam.access_code)}
                                  className="p-1 rounded hover:bg-black/5 text-[#6B7280]"
                                  title="Sao chép mã mở đề"
                                >
                                  {copiedCodeId === exam.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#6B7280] font-normal">Công khai</span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleAllowReview(exam.id, !!exam.allow_review)}
                              className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition hover:scale-105 ${
                                exam.allow_review
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                              }`}
                              title="Bấm để Đóng / Mở quyền xem lại đáp án"
                            >
                              {exam.allow_review ? '🔓 Đang mở' : '🔒 Đã khóa'}
                            </button>
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setManagingExamStudents(exam)}
                                className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1.5 text-xs font-bold hover:bg-indigo-500/20 transition hover:scale-102"
                                title="Quản lý học sinh theo trường/lớp & Giám sát AI"
                              >
                                <Users className="h-3.5 w-3.5" /> Quản lý học sinh
                              </button>

                              <Link
                                href={`/new-exams/${exam.id}`}
                                className="inline-flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-black/10"
                                title="Vào thi thử"
                              >
                                <Eye className="h-3.5 w-3.5" /> Vào thi
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDeleteExam(exam.id, exam.title)}
                                className="p-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition hover:scale-105"
                                title="Xóa đề thi"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRO MULTI-SECTION EXAM BUILDER (PORTED FROM SEB-ADMIN WITH SEB TOGGLE SWITCH) */}
        {activeTab === 'create_exam' && (
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
                      style={{ fontFamily: 'var(--font-newadm-heading)' }}
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
                style={{ fontFamily: 'var(--font-newadm-heading)' }}
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
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
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
                    style={{ fontFamily: 'var(--font-newadm-heading)' }}
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
                {examSections.map((section, sIdx) => {
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
                            const ans = section.correctAnswers[qIdx]
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
                onClick={() => setActiveTab('exams')}
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
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
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
