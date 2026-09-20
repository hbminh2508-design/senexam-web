'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { isExamInFolder } from '@/lib/sebFolderUtils'
import ExamStudentProctorModal from '@/app/components/ExamStudentProctorModal'
import {
  Folder,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Award,
  Users,
  Eye,
  Lock,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  HelpCircle,
  Sliders,
  ArrowLeft,
  Sparkles,
  Image as ImageIcon,
  Check,
  X,
  FileUp,
  Settings2,
  BookOpen,
  Phone,
  Ban,
  Camera,
  VideoOff,
  School,
  GraduationCap,
  RefreshCw,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-body' })

type SebAdminTab = 'exams' | 'create_exam' | 'folders' | 'submissions'

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

  // 4. Nhận diện dự phòng từ tên phần thi
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

export default function SebAdminPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<SebAdminTab>('exams')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  // Dữ liệu
  const [examsList, setExamsList] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [managingExamStudents, setManagingExamStudents] = useState<any | null>(null)
  const [subSearch, setSubSearch] = useState('')
  const [subStatusFilter, setSubStatusFilter] = useState('all')
  const [subExamFilter, setSubExamFilter] = useState('all')
  const [viewingEvidenceSub, setViewingEvidenceSub] = useState<any | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null)

  // Form Tạo Đề Thi (Giống new-admin)
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examMaxScore, setExamMaxScore] = useState('10')
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [hasSeparateAnswerFile, setHasSeparateAnswerFile] = useState(false)
  const [answerPdfFile, setAnswerPdfFile] = useState<File | null>(null)
  const [creatingExam, setCreatingExam] = useState(false)

  // SEB & Folder Settings
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [requireSeb, setRequireSeb] = useState(true)
  const [partInstructions, setPartInstructions] = useState({
    part1: true, // Trắc nghiệm 4 lựa chọn
    part2: true, // Trắc nghiệm Đúng/Sai 4 ý
    part3: true, // Trả lời ngắn / Điền số
  })

  // AI Assistant State (Gemini 3.5 Flash Lite)
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

  // Quản lý Thư mục Mẹ - Con Modal State
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderModalMode, setFolderModalMode] = useState<'create_parent' | 'create_child' | 'edit'>('create_parent')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [folderNameInput, setFolderNameInput] = useState('')
  const [folderParentSelect, setFolderParentSelect] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  // Quản lý đề thi trong Thư Mục Con (Admin Modal)
  const [selectedAdminChildFolder, setSelectedAdminChildFolder] = useState<any | null>(null)
  const [showAdminFolderExamModal, setShowAdminFolderExamModal] = useState<boolean>(false)
  const [adminFolderExamSearch, setAdminFolderExamSearch] = useState<string>('')
  const [updatingAdminFolderExams, setUpdatingAdminFolderExams] = useState<boolean>(false)

  const handleToggleExamInChildFolder = async (examId: string, currentInFolder: boolean) => {
    if (!selectedAdminChildFolder) return
    setUpdatingAdminFolderExams(true)
    try {
      const res = await fetch('/api/seb/folder-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedAdminChildFolder.id,
          ...(currentInFolder ? { unassignExamId: examId } : { assignExamId: examId }),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setExamsList((prev) =>
          prev.map((e) =>
            e.id === examId ? { ...e, folder_id: currentInFolder ? 'none' : selectedAdminChildFolder.id } : e
          )
        )
      }
    } catch (e) {
      console.error('Lỗi cập nhật đề vào thư mục:', e)
    } finally {
      setUpdatingAdminFolderExams(false)
    }
  }

  // Tải dữ liệu ban đầu
  const fetchAllData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        router.replace('/seb-login')
        return
      }
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle()
      const email = user.email?.toLowerCase() || ''
      if (profile?.role !== 'admin' && profile?.role !== 'collab' && email !== 'hoangbinhminh2508@gmail.com') {
        alert('Chỉ Quản trị viên mới có quyền truy cập vào cổng Seb Admin!')
        router.replace('/seb-dashboard')
        return
      }

      // 1. Tải folders
      const fRes = await fetch('/api/seb/folders')
      const fData = await fRes.json()
      setFolders(fData.folders || [])

      // 2. Tải exams
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
      setExamsList(exData || [])

      // 3. Tải bài nộp đầy đủ dữ liệu giám sát
      const { data: subData } = await supabase
        .from('submissions')
        .select(`
          id,
          user_id,
          exam_id,
          score,
          is_graded,
          is_disqualified,
          disqualification_reason,
          tab_switches,
          blur_count,
          submitted_at,
          created_at,
          phone_number,
          school,
          class_name,
          province,
          exams(id, title, subject, duration),
          profiles(id, full_name, email, phone_number, phone, school, class_name, grade, province)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      // 4. Tải nhật ký giám thị AI (kèm bằng chứng chụp ảnh)
      const { data: logData } = await supabase
        .from('exam_proctoring_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

      setSubmissions(subData || [])
      setProctorLogs(logData || [])
    } catch (err) {
      console.error('Lỗi tải dữ liệu Seb Admin:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    fetchAllData()
  }, [])

  // Danh sách các Thư Mục Con để gán đề
  const allChildFolders = useMemo(() => {
    const list: any[] = []
    folders.forEach((parent) => {
      if (parent.children) {
        parent.children.forEach((child: any) => {
          list.push({ ...child, parentName: parent.name })
        })
      }
    })
    return list
  }, [folders])

  // Danh sách bài nộp được làm giàu dữ liệu giám sát & SĐT
  const enrichedSubmissions = useMemo(() => {
    return submissions.map((sub) => {
      const p = sub.profiles || {}
      const sLogs = proctorLogs.filter((l) => l.user_id === sub.user_id && (!sub.exam_id || l.exam_id === sub.exam_id))
      const evidenceList = sLogs.filter((l) => l.snapshot_url && l.violation_type !== 'none' && l.violation_type !== 'no_camera')
      const noCamLog = sLogs.find((l) => l.violation_type === 'no_camera' || l.has_camera === false)
      const phoneViolation = sLogs.some((l) => l.violation_type === 'phone_detected' || l.is_disqualified)

      const isDisqualified = Boolean(sub.is_disqualified || phoneViolation)
      const hasNoCamera = Boolean(noCamLog || sub.has_camera === false)
      const tabCount = Number(sub.tab_switches || sub.blur_count || 0)
      const hasViolations = Boolean(isDisqualified || tabCount > 0 || evidenceList.length > 0)

      const fullName = p.full_name || 'Học sinh'
      const email = p.email || ''
      const phone = p.phone_number || p.phone || sub.phone_number || ''
      const school = p.school || sub.school || 'Chưa cập nhật'
      const className = p.class_name || p.grade || sub.class_name || 'Chưa cập nhật'
      const province = p.province || sub.province || ''
      const examTitle = sub.exams?.title || 'Đề thi SEB'
      const examSubject = sub.exams?.subject || ''

      return {
        ...sub,
        fullName,
        email,
        phone,
        school,
        className,
        province,
        examTitle,
        examSubject,
        isDisqualified,
        hasNoCamera,
        tabCount,
        hasViolations,
        evidenceList,
        logs: sLogs,
      }
    })
  }, [submissions, proctorLogs])

  const filteredSubmissions = useMemo(() => {
    return enrichedSubmissions.filter((sub) => {
      // Tìm kiếm theo từ khóa
      if (subSearch.trim()) {
        const q = subSearch.toLowerCase().trim()
        const matchName = sub.fullName.toLowerCase().includes(q)
        const matchEmail = sub.email.toLowerCase().includes(q)
        const matchPhone = sub.phone.toLowerCase().includes(q)
        const matchSchool = sub.school.toLowerCase().includes(q)
        const matchClass = sub.className.toLowerCase().includes(q)
        const matchExam = sub.examTitle.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchPhone && !matchSchool && !matchClass && !matchExam) {
          return false
        }
      }

      // Lọc theo trạng thái kỷ luật / nộp bài
      if (subStatusFilter === 'disqualified' && !sub.isDisqualified) return false
      if (subStatusFilter === 'warning' && (!sub.hasViolations || sub.isDisqualified)) return false
      if (subStatusFilter === 'no_camera' && !sub.hasNoCamera) return false
      if (subStatusFilter === 'completed' && !sub.submitted_at && !sub.is_graded) return false
      if (subStatusFilter === 'in_progress' && (sub.submitted_at || sub.is_graded)) return false

      // Lọc theo đề thi
      if (subExamFilter !== 'all' && sub.exam_id !== subExamFilter) {
        return false
      }

      return true
    })
  }, [enrichedSubmissions, subSearch, subStatusFilter, subExamFilter])

  // Thống kê bài nộp
  const subStats = useMemo(() => {
    const total = enrichedSubmissions.length
    const disqualified = enrichedSubmissions.filter((s) => s.isDisqualified).length
    const warnings = enrichedSubmissions.filter((s) => s.hasViolations && !s.isDisqualified).length
    const noCam = enrichedSubmissions.filter((s) => s.hasNoCamera).length
    const inProgress = enrichedSubmissions.filter((s) => !s.submitted_at && !s.is_graded).length
    const completed = enrichedSubmissions.filter((s) => s.submitted_at || s.is_graded).length
    return { total, disqualified, warnings, noCam, inProgress, completed }
  }, [enrichedSubmissions])

  // Admin cưỡng chế đình chỉ bài thi gian lận
  const handleAdminDisqualify = async (sub: any) => {
    if (!confirm(`Bạn có chắc chắn muốn ĐÌNH CHỈ & HỦY ĐIỂM (0 điểm) của thí sinh "${sub.fullName}" do vi phạm quy chế không?`)) return
    try {
      await supabase.from('submissions').update({
        score: 0,
        is_disqualified: true,
        disqualification_reason: 'Quản trị viên đình chỉ do vi phạm quy chế thi cử',
      }).eq('id', sub.id)

      await supabase.from('exam_proctoring_logs').insert({
        exam_id: String(sub.exam_id || ''),
        user_id: sub.user_id,
        user_name: sub.fullName,
        user_email: sub.email,
        user_phone: sub.phone,
        school: sub.school,
        class_name: sub.className,
        province: sub.province,
        violation_type: 'phone_detected',
        severity: 'critical',
        is_disqualified: true,
        details: 'Quản trị viên đình chỉ bài thi trực tiếp từ trang Admin',
      })

      alert('Đã đình chỉ bài thi thành công!')
      fetchAllData()
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    }
  }

  // Admin xóa bài nộp
  const handleDeleteSubmission = async (subId: string) => {
    if (!confirm('Bạn có chắc chắn muốn XÓA vĩnh viễn bài nộp này không?')) return
    try {
      await supabase.from('submissions').delete().eq('id', subId)
      setSubmissions((prev) => prev.filter((s) => s.id !== subId))
    } catch (e: any) {
      alert('Lỗi khi xóa bài nộp: ' + e.message)
    }
  }

  // Thống kê tổng điểm và tổng số câu của toàn đề
  const totalExamPoints = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (Number(sec.totalPoints) || 0), 0)
  }, [examSections])

  const totalQuestionCount = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (parseInt(String(sec.questionCount)) || 0), 0)
  }, [examSections])

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
          // Là ảnh hoặc định dạng khác
          answerFileBase64 = await fileToBase64(targetAnswerFile)
          answerMimeType = targetAnswerFile.type || 'image/jpeg'
        }
      }

      let res: Response

      // Nếu bóc tách được text đề thi sạch sẽ, gửi qua JSON siêu nhẹ (~20KB)
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

      // Xử lý an toàn phản hồi từ server, tuyệt đối không để crash JSON.parse
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

  // Xuất bản đề thi mới
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
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

      const examPayload: any = {
        title: examTitle.trim(),
        exam_type: examTypeVal,
        duration: parseInt(examDuration) || 50,
        drive_file_id: driveFileId,
        exam_structure: synchronizedSections,
        allow_review: examAllowReview,
        is_hidden: examIsHidden,
        access_code: accessCode,
        max_attempts: parseInt(maxAttempts) || 1,
        folder_id: selectedFolderId || null,
        require_seb: requireSeb,
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
      setActiveTab('exams')
      alert(`🎉 Đã xuất bản đề thi SEB thành công! ${accessCode ? `Mã code: ${accessCode}` : ''}`)
    } catch (err: any) {
      alert('Lỗi xuất bản đề thi: ' + err.message)
    } finally {
      setCreatingExam(false)
    }
  }

  // Quản lý Thư mục: Lưu thư mục Mẹ / Con
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderNameInput.trim()) return

    setFolderSaving(true)
    try {
      const payload: any = {
        action: editingFolderId ? 'update' : 'create',
        folderId: editingFolderId,
        name: folderNameInput.trim(),
        parentId: folderParentSelect || null,
        userRole: 'admin',
      }

      const res = await fetch('/api/seb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu thư mục')

      setShowFolderModal(false)
      setFolderNameInput('')
      setEditingFolderId(null)
      await fetchAllData()
      alert('Đã cập nhật thư mục thành công!')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFolderSaving(false)
    }
  }

  // Xóa thư mục
  const handleDeleteFolder = async (fId: string, fName: string) => {
    if (!confirm(`Xác nhận xóa thư mục "${fName}" và toàn bộ các thư mục con bên trong?`)) return
    try {
      const res = await fetch('/api/seb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', folderId: fId, userRole: 'admin' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa thư mục')
      await fetchAllData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div
      className={`min-h-screen w-full bg-slate-50 flex flex-col text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-sebadm-body)' }}
    >
      {/* Top Navbar */}
      <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/seb-dashboard"
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <SebLogo size={34} showText={true} />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'exams'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quản Lý Đề Thi ({examsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create_exam')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              activeTab === 'create_exam'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tạo Đề Mới</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('folders')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              activeTab === 'folders'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Thư Mục Mẹ - Con</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'submissions'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bài Nộp ({submissions.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
        {/* ======================================================== */}
        {/* TAB 1: DANH SÁCH ĐỀ THI */}
        {/* ======================================================== */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-xl font-black text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  Danh Sách Đề Thi Safe Exam Browser
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đề thi được bảo mật và phân quyền theo Thư Mục Mẹ - Con
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create_exam')}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-sky-500/20"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo Đề Thi Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examsList.map((exam) => (
                <div
                  key={exam.id}
                  className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {exam.exam_type || 'THPTQG'}
                      </span>
                      {exam.require_seb && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Yêu cầu SEB</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2">{exam.title}</h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                      <span>{exam.duration || 50} phút</span>
                      <span>•</span>
                      <span>Số lần thi tối đa: {exam.max_attempts || 1}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setManagingExamStudents(exam)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 transition flex items-center gap-1 shadow-2xs hover:scale-102"
                      title="Quản lý học sinh theo trường/lớp & Giám sát AI"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Quản lý học sinh</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/seb-exam/${exam.id}`}
                        target="_blank"
                        className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Thử làm đề</span>
                      </Link>

                      <a
                        href={`/api/seb/config?examId=${exam.id}&download=1`}
                        className="text-xs font-bold text-slate-600 hover:text-sky-700 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 transition"
                        title="Tải cấu hình .seb cho đề thi này"
                      >
                        Tải .seb
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TẠO ĐỀ THI MỚI (TƯƠNG TỰ NEW-ADMIN) */}
        {/* ======================================================== */}
        {activeTab === 'create_exam' && (
          <form onSubmit={handleCreateExam} className="space-y-6">
            {/* 1. TẢI FILE ĐỀ THI & ĐÁP ÁN (PHÂN TÍCH BẰNG AI) */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 via-sky-50 to-blue-50 border border-indigo-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      className="text-lg font-black text-indigo-950 flex items-center gap-2 flex-wrap"
                      style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                    >
                      <span>1. Tải Lên Đề Thi & Đáp Án (Phân Tích Bằng AI Gemini)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider">
                        AI Tự Động
                      </span>
                    </h2>
                    <p className="text-xs text-indigo-700/80">
                      Tự động đọc, trích xuất cấu trúc đề thi, số phần, số câu và đối chiếu bảng đáp án chuẩn xác.
                    </p>
                  </div>
                </div>
              </div>

              {/* HỎI TRƯỚC: BẠN ĐÃ CÓ FILE ĐÁP ÁN CHƯA? */}
              <div className="p-4 rounded-2xl bg-white/90 border border-indigo-200/90 shadow-2xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-black text-slate-800">
                      Bạn đã có sẵn file / bảng đáp án riêng của đề thi này chưa?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setHasSeparateAnswerFile(false)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        !hasSeparateAnswerFile
                          ? 'bg-white text-indigo-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
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
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Đã có file đáp án (Khuyên dùng)</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
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
                    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-indigo-600" />
                          <span>1. File Đề Thi (PDF) *</span>
                        </span>
                        {examPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!examPdfFile ? (
                        <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setExamPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-indigo-950 block">
                              Chọn File PDF Đề Thi
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Kéo thả hoặc bấm để chọn tệp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <label className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer transition shrink-0">
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
                    <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>2. File Đáp Án (PDF hoặc Ảnh) *</span>
                        </span>
                        {answerPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!answerPdfFile ? (
                        <label className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setAnswerPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-emerald-950 block">
                              Chọn File Đáp Án (PDF hoặc Ảnh)
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Bảng đáp án trắc nghiệm, lời giải hoặc ảnh chụp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate block">
                                {answerPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(answerPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer transition">
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
                              className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
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
                      onClick={() => handleAiAnalyze(examPdfFile, answerPdfFile)}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <label className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white/70 hover:bg-white rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition text-center group shadow-xs">
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
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition flex items-center justify-center">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-indigo-950 block">
                          Bấm vào đây để chọn File PDF Đề Thi (hoặc kéo thả file vào đây)
                        </span>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Khi tải file PDF lên, hệ thống sẽ tự động gửi tới Gemini để phân tích cấu trúc và tự giải đề ngay lập tức
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                ✓ File PDF Đã Chọn
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition">
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
                            onClick={() => handleAiAnalyze(examPdfFile, null)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50"
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
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center gap-2.5 text-xs text-indigo-900 font-bold animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                  <span>
                    {aiStatusMessage || 'AI đang xử lý file đề thi và ma trận đáp án... Vui lòng đợi trong giây lát.'}
                  </span>
                </div>
              )}
            </div>

            {/* 2. THÔNG TIN CHUNG ĐỀ THI */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-5">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                2. Thông Tin Chung Đề Thi (AI Tự Động Điền)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Tên Đề Thi *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Tự động điền sau khi tải file PDF, hoặc nhập thủ công..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thời Gian Làm Bài (Phút)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    min={5}
                    max={300}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Số Lần Thi Tối Đa (Max Attempts)</label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    min={1}
                    max={10}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Thang Điểm Đề Thi</label>
                    <span className="text-[10px] text-sky-600 font-bold">Quy đổi chuẩn hóa về thang 10</span>
                  </div>
                  <input
                    type="number"
                    value={examMaxScore}
                    onChange={(e) => setExamMaxScore(e.target.value)}
                    placeholder="Ví dụ: 10, 20, 50, 100..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
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
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Gán Vào Thư Mục Môn Thi (SEB Dashboard)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  >
                    <option value="">-- Chọn thư mục môn thi tương ứng --</option>
                    {allChildFolders.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.parentName} ➔ {child.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Bảo Mật Safe Exam Browser (SEB) */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-4">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                3. Bảo Mật Safe Exam Browser (SEB)
              </h2>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
                <input
                  type="checkbox"
                  id="requireSebCheck"
                  checked={requireSeb}
                  onChange={(e) => setRequireSeb(e.target.checked)}
                  className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <label htmlFor="requireSebCheck" className="text-xs font-bold text-sky-900 cursor-pointer">
                  Khóa môi trường thi bằng Safe Exam Browser (Chặn Alt+Tab, chụp màn hình, mở ứng dụng ngoài, bắt buộc chạy đúng môi trường SEB)
                </label>
              </div>
            </div>

            {/* 4. Cấu Trúc Đề Thi & Bảng Đáp Án Linh Hoạt */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2
                    className="text-xl font-black text-slate-900"
                    style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                  >
                    4. Cấu Trúc Các Phần Thi & Hướng Dẫn Tự Viết
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tùy biến số phần thi, số câu hỏi, cách tính điểm, hướng dẫn riêng và ảnh minh họa cho từng phần.
                  </p>
                </div>

                {/* Thống kê và Nút Thêm Phần */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200">
                    <span>{examSections.length} Phần thi</span>
                    <span>•</span>
                    <span>{totalQuestionCount} Câu hỏi</span>
                    <span>•</span>
                    <span className={totalExamPoints === 10 ? 'text-emerald-700' : 'text-amber-700'}>
                      Tổng: {totalExamPoints.toFixed(1)} / 10.0 đ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-500/20"
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
                      key={section.id}
                      className="p-5 rounded-3xl border border-slate-200 bg-slate-50/50 space-y-5"
                    >
                      {/* Tiêu đề phần thi & nút xóa */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="h-7 w-7 rounded-xl bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'name', e.target.value)}
                            placeholder={`Tên phần thi (Ví dụ: Phần ${sIdx + 1}: Trắc nghiệm...)`}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSection(sIdx)}
                          className="h-8 w-8 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition shrink-0"
                          title="Xóa phần thi này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Các tham số cấu hình: Số câu, Tổng điểm, Chế độ chia điểm, Thể loại câu hỏi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 text-xs">
                        {/* 1. Số lượng câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Số Câu Hỏi</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={section.questionCount}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                        </div>

                        {/* 2. Tổng điểm phần này */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Tổng Điểm Phần Này</label>
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={10}
                            value={section.totalPoints}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'totalPoints', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                        </div>

                        {/* 3. Chế độ chia điểm */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Cách Tính Điểm</label>
                          <select
                            value={section.scoringMode}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'scoringMode', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          >
                            <option value="auto_divide">
                              Chia đều ({pointsPerQ.toFixed(2)}đ/câu)
                            </option>
                            <option value="custom_points">Tùy chỉnh điểm từng câu</option>
                          </select>
                        </div>

                        {/* 4. Thể loại câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Thể Loại Câu Hỏi</label>
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
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-indigo-600" />
                              <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                                Phân Định Dải Câu Hỏi (Chế Độ Hỗn Hợp)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'thptqg')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shadow-2xs"
                              >
                                Preset THPTQG (18-4-6)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'hsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shadow-2xs"
                              >
                                Preset HSA (40-10)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'tsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shadow-2xs"
                              >
                                Preset TSA (30-6-4)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddMixedRange(sIdx)}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1 transition"
                              >
                                <Plus className="h-3.5 w-3.5" /> Thêm dải câu
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(section.mixedRanges || []).map((range: any, rIdx: number) => (
                              <div
                                key={rIdx}
                                className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white border border-indigo-100 text-xs shadow-2xs"
                              >
                                <span className="text-indigo-900 font-black text-[11px]">Dải #{rIdx + 1}:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 text-[11px] font-semibold">Từ câu</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.start}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'start', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 font-mono font-bold text-center text-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 text-[11px] font-semibold">đến</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.end}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'end', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 font-mono font-bold text-center text-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 text-[11px] font-semibold">Dạng câu:</span>
                                  <select
                                    value={range.type}
                                    onChange={(e) => handleUpdateMixedRange(sIdx, rIdx, 'type', e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold"
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
                                  className="ml-auto text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
                                  title="Xóa dải câu này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {(!section.mixedRanges || section.mixedRanges.length === 0) && (
                              <p className="text-xs text-indigo-900/60 italic py-1">
                                Chưa có dải câu nào được thiết lập. Hãy bấm "+ Thêm dải câu" hoặc chọn một mẫu Preset có sẵn ở trên.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hướng Dẫn Tự Viết & Ảnh Minh Họa Cho Phần Này */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
                        {/* Hướng dẫn tự viết */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                            <span>Hướng Dẫn Làm Bài Cho Phần Này (Admin tự viết):</span>
                          </label>
                          <textarea
                            value={section.instructions}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'instructions', e.target.value)}
                            placeholder="Nhập hướng dẫn làm bài chi tiết cho phần này (thí sinh sẽ đọc tại phòng chờ)..."
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed"
                          />
                        </div>

                        {/* Hình ảnh hướng dẫn (nếu có) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                              <span>Hình Ảnh Hướng Dẫn (Nếu có):</span>
                            </span>
                            {section.instructionImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateSectionField(sIdx, 'instructionImage', '')}
                                className="text-[11px] text-rose-600 font-bold hover:underline"
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
                              className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                            <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition flex items-center gap-1 shrink-0">
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
                            <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-28 bg-slate-100 flex items-center justify-center">
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
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Bảng Nhập Đáp Án ({section.questionCount} câu hỏi):</span>
                          {section.scoringMode === 'custom_points' && (
                            <span className="text-[11px] text-amber-700 font-normal">
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
                                className="p-3 rounded-2xl bg-white border border-slate-200 text-xs shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-600">Câu {qIdx + 1}</span>
                                    <span
                                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                        qType === 'single_choice'
                                          ? 'bg-blue-100 text-blue-700'
                                          : qType === 'true_false'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : qType === 'short_answer'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-purple-100 text-purple-700'
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
                                        className="w-12 px-1 py-0.5 rounded border border-slate-200 text-center font-bold text-[11px]"
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
                                    className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold bg-slate-50"
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
                                        className={`flex-1 h-7 rounded-lg font-black transition ${
                                          ans === opt
                                            ? 'bg-sky-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                              ans?.[sub] === 'Đ'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            Đ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'S')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                              ans?.[sub] === 'S'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                                      className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
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
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-bold"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={creatingExam}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-sky-500/20"
              >
                {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                <span>Xuất Bản Đề Thi SEB</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ THƯ MỤC MẸ & CON */}
        {/* ======================================================== */}
        {activeTab === 'folders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-xl font-black text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  Quản Lý Cây Thư Mục Mẹ - Con
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thư mục Mẹ đại diện cho khối thi/kỳ thi, thư mục Con đại diện cho các môn thi cụ thể
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFolderModalMode('create_parent')
                    setFolderNameInput('')
                    setFolderParentSelect('')
                    setEditingFolderId(null)
                    setShowFolderModal(true)
                  }}
                  className="px-3.5 py-2 rounded-2xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>+ Thư Mục Mẹ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFolderModalMode('create_child')
                    setFolderNameInput('')
                    setFolderParentSelect(folders[0]?.id || '')
                    setEditingFolderId(null)
                    setShowFolderModal(true)
                  }}
                  className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-500/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thư Mục Con (Môn Thi)</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {folders.map((parent) => (
                <div key={parent.id} className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Folder className="h-5 w-5 text-sky-600" />
                      <h3 className="text-base font-bold text-slate-900">{parent.name}</h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {parent.children?.length || 0} môn thi
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(parent.id, parent.name)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl transition"
                      title="Xóa thư mục mẹ này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Danh sách Thư mục con */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {parent.children?.map((child: any) => {
                      const realExamCount = examsList.filter((ex) => !ex.is_hidden && isExamInFolder(ex, child)).length

                      return (
                        <div
                          key={child.id}
                          className="p-3 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-sky-500" />
                            <span className="text-xs font-bold text-slate-800 truncate">{child.name}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 font-mono">
                              {realExamCount} đề
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAdminChildFolder(child)
                                setShowAdminFolderExamModal(true)
                              }}
                              className="text-slate-400 hover:text-sky-600 p-1 rounded-lg transition"
                              title="Quản lý / Gán đề thi cho môn này"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFolder(child.id, child.name)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                              title="Xóa thư mục con này"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Quản Lý Đề Thi Trong Thư Mục Con (Admin) */}
            {showAdminFolderExamModal && selectedAdminChildFolder && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-2xl rounded-3xl bg-white border border-sky-100 shadow-2xl p-6 flex flex-col max-h-[85vh] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">
                        Phân Bổ Đề Thi Thư Mục Con
                      </span>
                      <h3
                        className="text-lg font-black text-slate-900"
                        style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                      >
                        Môn: {selectedAdminChildFolder.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tick chọn để gán đề thủ công hoặc gỡ bỏ khỏi môn thi này. Hệ thống vẫn tự động nhận diện nếu đề chưa được gán.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdminFolderExamModal(false)}
                      className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Tìm kiếm đề thi */}
                  <div className="relative">
                    <input
                      type="text"
                      value={adminFolderExamSearch}
                      onChange={(e) => setAdminFolderExamSearch(e.target.value)}
                      placeholder="Tìm kiếm đề thi cần gán..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Danh sách đề thi */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
                    {examsList
                      .filter((ex) => {
                        if (ex.is_hidden) return false
                        if (!adminFolderExamSearch.trim()) return true
                        return ex.title?.toLowerCase().includes(adminFolderExamSearch.toLowerCase())
                      })
                      .map((ex) => {
                        const isDirect = ex.folder_id === selectedAdminChildFolder.id
                        const isAuto = !isDirect && isExamInFolder(ex, selectedAdminChildFolder)
                        const isInFolder = isDirect || isAuto

                        return (
                          <div
                            key={ex.id}
                            className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-sky-200 transition flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono">
                                  {ex.exam_type || 'ĐỀ THI'}
                                </span>
                                {isDirect ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ Đã gán thủ công
                                  </span>
                                ) : isAuto ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                                    ⚡ Tự động nhận diện
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                    Chưa có trong môn
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-800 truncate">{ex.title}</h4>
                            </div>

                            <button
                              type="button"
                              disabled={updatingAdminFolderExams}
                              onClick={() => handleToggleExamInChildFolder(ex.id, isInFolder)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                isInFolder
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-sky-600 text-white hover:bg-sky-700 shadow-2xs'
                              }`}
                            >
                              {isInFolder ? 'Gỡ Khỏi Môn' : '+ Gán Vào Môn'}
                            </button>
                          </div>
                        )
                      })}
                  </div>

                  {/* Footer Modal */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Tổng số đề trong môn: {examsList.filter((ex) => !ex.is_hidden && isExamInFolder(ex, selectedAdminChildFolder)).length} đề
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdminFolderExamModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: BÀI NỘP VÀ GIÁM SÁT THI TRỰC TIẾP (QUẢN LÝ NGHIÊM NGẶT & ĐA CHIỀU) */}
        {/* ======================================================== */}
        {activeTab === 'submissions' && (
          <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2
                  className="text-xl font-black text-slate-900 flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  <ShieldCheck className="h-6 w-6 text-sky-600" />
                  <span>Quản Lý Bài Nộp & Giám Sát Kỷ Luật Thi SEB</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi danh sách thí sinh, kiểm soát gian lận, điện thoại, che cam và kỷ luật phòng thi thời gian thực.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAllData}
                className="self-start md:self-auto px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Làm Mới Dữ Liệu</span>
              </button>
            </div>

            {/* BỘ THẺ THỐNG KÊ TOÀN DIỆN */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 block">Tổng Bài Thi</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">{subStats.total}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200">
                <span className="text-[11px] font-bold text-sky-700 block">Đang Làm Bài</span>
                <span className="text-xl font-black text-sky-800 mt-1 block">{subStats.inProgress}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-700 block">Đã Hoàn Thành</span>
                <span className="text-xl font-black text-emerald-800 mt-1 block">{subStats.completed}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300">
                <span className="text-[11px] font-bold text-rose-700 block">🚨 Đình Chỉ (Điện thoại)</span>
                <span className="text-xl font-black text-rose-800 mt-1 block">{subStats.disqualified}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300">
                <span className="text-[11px] font-bold text-amber-700 block">⚠️ Có Vi Phạm AI</span>
                <span className="text-xl font-black text-amber-800 mt-1 block">{subStats.warnings}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-300">
                <span className="text-[11px] font-bold text-slate-600 block">🟡 Không Dùng Cam</span>
                <span className="text-xl font-black text-slate-800 mt-1 block">{subStats.noCam}</span>
              </div>
            </div>

            {/* THANH TÌM KIẾM & BỘ LỌC CĂNG */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Tìm theo Tên thí sinh, SĐT, Email, Trường, Đề thi..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="disqualified">🚨 Bị đình chỉ thi (Dùng điện thoại)</option>
                  <option value="warning">⚠️ Có vi phạm (Phao / Che cam / Tab)</option>
                  <option value="no_camera">🟡 Không có camera</option>
                  <option value="completed">🟢 Đã nộp bài</option>
                  <option value="in_progress">⏳ Đang làm bài</option>
                </select>

                <select
                  value={subExamFilter}
                  onChange={(e) => setSubExamFilter(e.target.value)}
                  className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 max-w-[180px] truncate"
                >
                  <option value="all">Tất cả đề thi</option>
                  {examsList.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BẢNG BÀI NỘP ĐA DỮ LIỆU & QUẢN LÝ KỶ LUẬT */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Thí Sinh & Thông Tin</th>
                    <th className="p-3.5">Đề Thi & Môn</th>
                    <th className="p-3.5 text-center">Điểm Số</th>
                    <th className="p-3.5">Giám Sát Chống Gian Lận (SEB)</th>
                    <th className="p-3.5 text-center">Thời Điểm</th>
                    <th className="p-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-xs">
                        Không tìm thấy bài nộp nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className={`transition ${
                          sub.isDisqualified
                            ? 'bg-rose-50/50 hover:bg-rose-50'
                            : sub.hasViolations
                            ? 'bg-amber-50/30 hover:bg-amber-50/60'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Cột 1: Thông tin Thí Sinh & SĐT */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{sub.fullName}</span>
                            {sub.isDisqualified && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase">
                                Đình chỉ
                              </span>
                            )}
                          </div>

                          <div className="mt-1 space-y-0.5">
                            {/* Số điện thoại */}
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700">
                              <Phone className="h-3 w-3 text-sky-600 shrink-0" />
                              <span>{sub.phone || 'Chưa có SĐT'}</span>
                            </div>

                            {/* Email */}
                            <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                              {sub.email}
                            </div>

                            {/* Trường & Lớp */}
                            <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                              <School className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]">
                                {sub.school} {sub.className !== 'Chưa cập nhật' ? `• ${sub.className}` : ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Cột 2: Đề Thi */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800 line-clamp-2 max-w-[200px]">
                            {sub.examTitle}
                          </div>
                          {sub.examSubject && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {sub.examSubject}
                            </span>
                          )}
                        </td>

                        {/* Cột 3: Điểm Số */}
                        <td className="p-3.5 text-center">
                          {sub.isDisqualified ? (
                            <div>
                              <span className="text-rose-600 font-black text-base">0.00</span>
                              <span className="block text-[10px] font-bold text-rose-500">Hủy điểm</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-black text-sky-700 text-base">
                                {Number(sub.score || 0).toFixed(2)}
                              </span>
                              <span className="block text-[10px] text-slate-400 font-medium">
                                {sub.submitted_at || sub.is_graded ? 'Đã chấm' : 'Chưa nộp'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Cột 4: Giám Sát Chống Gian Lận (LÀM CĂNG) */}
                        <td className="p-3.5 space-y-1.5">
                          {/* Tình trạng kỷ luật */}
                          {sub.isDisqualified ? (
                            <div className="flex items-center gap-1 text-rose-700 font-black text-[11px] bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-lg w-fit animate-pulse">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                              <span>🚨 BỊ ĐÌNH CHỈ THI (DÙNG ĐIỆN THOẠI)</span>
                            </div>
                          ) : sub.evidenceList.length > 0 ? (
                            <div className="flex items-center gap-1 text-amber-700 font-bold text-[11px] bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg w-fit">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>⚠️ Phát hiện {sub.evidenceList.length} nghi vấn vi phạm</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>✓ Nghiêm túc</span>
                            </div>
                          )}

                          {/* Chi tiết chuyển tab & camera */}
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            {/* Rời màn hình / chuyển tab */}
                            {sub.tabCount > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                ⚠️ Chuyển tab {sub.tabCount} lần
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">Chuyển tab: 0</span>
                            )}

                            {/* Trạng thái camera */}
                            {sub.hasNoCamera ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <VideoOff className="h-2.5 w-2.5" /> Không có cam
                              </span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <Camera className="h-2.5 w-2.5" /> Có camera
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cột 5: Thời Điểm */}
                        <td className="p-3.5 text-center text-slate-500 font-medium">
                          {sub.isDisqualified ? (
                            <span className="text-rose-600 font-bold text-[11px] block">
                              🛑 Bị đình chỉ
                            </span>
                          ) : sub.submitted_at ? (
                            <div>
                              <span className="font-bold text-slate-800 text-[11px] block">
                                {new Date(sub.submitted_at).toLocaleTimeString('vi-VN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 font-bold text-[10px] inline-block">
                              ⏳ Đang làm bài
                            </span>
                          )}
                        </td>

                        {/* Cột 6: Thao Tác Quản Trị */}
                        <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                          {/* Nút Xem bằng chứng ảnh nếu có */}
                          {sub.evidenceList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewingEvidenceSub(sub)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 transition inline-flex items-center gap-1 cursor-pointer"
                              title="Xem ảnh chụp bằng chứng vi phạm"
                            >
                              <Camera className="h-3 w-3 text-amber-600" />
                              <span>Bằng chứng ({sub.evidenceList.length})</span>
                            </button>
                          )}

                          {/* Nút Xem bài nộp */}
                          <Link
                            href={`/exams/${sub.exam_id || ''}/review`}
                            target="_blank"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Xem bài</span>
                          </Link>

                          {/* Nút Đình chỉ thi nếu chưa bị đình chỉ */}
                          {!sub.isDisqualified && (
                            <button
                              type="button"
                              onClick={() => handleAdminDisqualify(sub)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 transition inline-flex items-center gap-1 cursor-pointer"
                              title="Hủy kết quả & Đình chỉ thi"
                            >
                              <Ban className="h-3 w-3 text-rose-600" />
                              <span>Đình chỉ</span>
                            </button>
                          )}

                          {/* Nút Xóa bài nộp */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubmission(sub.id)}
                            className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition inline-block cursor-pointer"
                            title="Xóa bài nộp này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa Thư Mục */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-sky-100 shadow-2xl space-y-4">
            <h3
              className="text-lg font-black text-slate-900"
              style={{ fontFamily: 'var(--font-sebadm-heading)' }}
            >
              {folderModalMode === 'create_parent'
                ? 'Tạo Thư Mục Mẹ (Khối Thi / Kỳ Thi)'
                : 'Tạo Thư Mục Con (Môn Thi)'}
            </h3>

            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tên Thư Mục *</label>
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder={
                    folderModalMode === 'create_parent'
                      ? 'Ví dụ: Kỳ Thi THPT Quốc Gia'
                      : 'Ví dụ: Vật Lí Kỹ Thuật'
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              {folderModalMode === 'create_child' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thuộc Thư Mục Mẹ *</label>
                  <select
                    value={folderParentSelect}
                    onChange={(e) => setFolderParentSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs"
                    required
                  >
                    {folders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={folderSaving}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  {folderSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Lưu Thư Mục</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ HỌC SINH THEO TRƯỜNG / LỚP & GIÁM THỊ AI */}
      <ExamStudentProctorModal
        isOpen={Boolean(managingExamStudents)}
        onClose={() => setManagingExamStudents(null)}
        exam={managingExamStudents}
      />

      {/* MODAL XEM BẰNG CHỨNG GIAN LẬN AI GHI LẠI (ẢNH CHỤP CAMERA) */}
      {viewingEvidenceSub && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3
                  className="text-lg font-black text-rose-700 flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  <span>Bằng Chứng Vi Phạm Kỷ Luật (AI Gemini 3.8 Live)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thí sinh: <strong className="text-slate-800">{viewingEvidenceSub.fullName}</strong> • SĐT: <strong className="text-sky-700">{viewingEvidenceSub.phone || 'N/A'}</strong> • Trường: {viewingEvidenceSub.school} ({viewingEvidenceSub.className})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingEvidenceSub(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {viewingEvidenceSub.evidenceList?.map((ev: any, idx: number) => (
                <div key={ev.id || idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <span>{ev.details || ev.violation_type}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(ev.created_at).toLocaleTimeString('vi-VN')} {new Date(ev.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {ev.snapshot_url && (
                    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-slate-300 flex items-center justify-center">
                      <img
                        src={ev.snapshot_url}
                        alt="Bằng chứng gian lận"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Độ tin cậy AI: <strong>{ev.confidence || 95}%</strong></span>
                    <span className="text-slate-400 font-medium">Lưu trữ tự động: 7 ngày</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingEvidenceSub(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
