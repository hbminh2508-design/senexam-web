'use client'

import { useState, useEffect, useMemo, useDeferredValue, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { isExamInFolder, SebFolderLike } from '@/lib/sebFolderUtils'
import type { ExamCollection } from '@/lib/examCollectionStore'
import {
  ArrowLeft,
  Search,
  Clock,
  BookOpen,
  Rocket,
  Crown,
  KeyRound,
  FileText,
  Download,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  History,
  ShieldCheck,
  Folder,
  FolderOpen,
  Layers,
  Filter,
  X,
  Award,
  Package,
  Shuffle,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit,
  SlidersHorizontal,
  CheckCircle2,
  ListOrdered,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Zap,
  Target,
  Trophy,
  Flame,
  Eye,
  Calendar,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-hub-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-hub-body' })

type ExamItem = {
  id: string
  title: string
  exam_type: string
  subject?: string | null
  description?: string | null
  duration?: number
  is_free?: boolean
  price?: number
  price_vnd?: number
  is_vip?: boolean
  vip_discount_percent?: number
  tags?: string[]
  drive_file_id?: string
  pdf_url?: string
  access_code?: string
  exam_structure?: any
  require_seb?: boolean
  folder_id?: string | null
  parent_folder_id?: string | null
  is_hidden?: boolean
  created_by?: string | null
}

type SubmissionItem = {
  id: string
  exam_id: string
  user_id: string
  score: number | null
  time_spent: number | null
  is_graded: boolean
  feedback: string | null
  created_at: string
  exams?: {
    id?: string
    title?: string
    exam_type?: string
    subject?: string
    duration?: number
    pdf_url?: string | null
    solution_pdf_url?: string | null
    drive_file_id?: string | null
    allow_review?: boolean
  } | null
}

interface SebChildFolder {
  id: string
  name: string
  parent_id?: string | null
  exam_count?: number
  icon?: string
  description?: string
}

interface SebParentFolder {
  id: string
  name: string
  parent_id: string | null
  icon?: string
  description?: string
  children: SebChildFolder[]
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'ĐGTD']
const HISTORY_EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

// Trợ thủ phân tích tổng số câu hỏi theo từng loại (Trắc nghiệm, Đúng/Sai, Trả lời ngắn)
function getExamQuestionsBreakdown(examList: ExamItem[]) {
  let choiceCount = 0
  let tfCount = 0
  let saCount = 0

  examList.forEach((ex) => {
    let struct = ex.exam_structure
    if (typeof struct === 'string') {
      try {
        struct = JSON.parse(struct)
      } catch {
        struct = []
      }
    }
    if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray(struct.sections)) {
      struct = struct.sections
    }
    if (!Array.isArray(struct)) return

    struct.forEach((section: any) => {
      const questions = Array.isArray(section?.questions) ? section.questions : []
      if (questions.length > 0) {
        questions.forEach((q: any) => {
          const qType = String(q?.type || section?.type || 'single_choice').toLowerCase().trim()
          if (qType === 'true_false') tfCount++
          else if (qType === 'short_answer') saCount++
          else choiceCount++
        })
      } else {
        const count = parseInt(section?.questionCount) || 0
        const sType = String(section?.type || 'single_choice').toLowerCase().trim()
        if (sType === 'true_false') tfCount += count
        else if (sType === 'short_answer') saCount += count
        else choiceCount += count
      }
    })
  })

  return { choiceCount, tfCount, saCount, total: choiceCount + tfCount + saCount }
}

function UnifiedHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<'exams' | 'history'>('exams')
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [exams, setExams] = useState<ExamItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Cây Thư Mục Mẹ - Con theo kiến trúc SEB
  const [folders, setFolders] = useState<SebParentFolder[]>([])
  const [folderSearch, setFolderSearch] = useState('')
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({})
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [selectedFolderObj, setSelectedFolderObj] = useState<SebChildFolder | null>(null)
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false)

  // Tab Kho Đề states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')

  // Tuyển tập đề states
  const [collections, setCollections] = useState<ExamCollection[]>([])
  const [activeCollection, setActiveCollection] = useState<ExamCollection | null>(null)
  const [showAdminPackageModal, setShowAdminPackageModal] = useState(false)
  const [packagingEditingId, setPackagingEditingId] = useState<string | null>(null)
  const [packagingSubject, setPackagingSubject] = useState('')
  const [packagingTitle, setPackagingTitle] = useState('')
  const [packagingDesc, setPackagingDesc] = useState('')
  const [packagingSelectedExamIds, setPackagingSelectedExamIds] = useState<string[]>([])
  const [packagingExamSearch, setPackagingExamSearch] = useState('')
  const [packagingError, setPackagingError] = useState('')
  const [packagingLoading, setPackagingLoading] = useState(false)

  // Modal trộn đề (Student)
  const [showMixModal, setShowMixModal] = useState(false)
  const [mixIncludeChoice, setMixIncludeChoice] = useState(true)
  const [mixIncludeTF, setMixIncludeTF] = useState(true)
  const [mixIncludeSA, setMixIncludeSA] = useState(true)
  const [mixQuestionCount, setMixQuestionCount] = useState(40)
  const [mixDuration, setMixDuration] = useState(50)
  const [mixTitle, setMixTitle] = useState('')
  const [mixError, setMixError] = useState('')
  const [mixLoading, setMixLoading] = useState(false)
  const [showDetailedMix, setShowDetailedMix] = useState(false)
  const [examMixConfigs, setExamMixConfigs] = useState<Record<string, { enabled: boolean; count: number }>>({})

  // Nhập mã truy cập đề riêng tư
  const [accessCode, setAccessCode] = useState('')
  const [accessCodeError, setAccessCodeError] = useState('')
  const [accessCodeLoading, setAccessCodeLoading] = useState(false)

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  // Tab Lịch Sử Bài Nộp states
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historySelectedType, setHistorySelectedType] = useState('Tất cả')
  const [filterScoreStatus, setFilterScoreStatus] = useState<'all' | 'high' | 'low' | 'graded'>('all')
  const [chartExamFilter, setChartExamFilter] = useState('Tất cả')
  const [showChart, setShowChart] = useState(true)
  const [chartZoom, setChartZoom] = useState(1)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; title: string; score: number; date: string } | null>(null)

  const deferredQuery = useDeferredValue(searchQuery)
  const deferredHistoryQuery = useDeferredValue(historySearchQuery)

  // Đọc tab từ search params
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history') {
      setActiveTab('history')
    } else if (tabParam === 'exams') {
      setActiveTab('exams')
    }
  }, [searchParams])

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const initData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          router.replace('/new-idp')
          return
        }

        setCurrentUserId(user.id)
        setUserEmail(user.email || null)
        await ensureStudentProfile(user.id)

        // Kiểm tra quyền Admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single()

        const hasAdminRole =
          profile?.role === 'admin' ||
          profile?.role === 'collab' ||
          profile?.is_admin === true ||
          user.email === 'admin@senexam.com'
        setIsAdmin(hasAdminRole)

        // 1. Tải cây Thư mục Mẹ - Con (SEB folders)
        try {
          const fRes = await fetch('/api/seb/folders')
          const fData = await fRes.json()
          const folderTree: SebParentFolder[] = fData?.folders || []
          setFolders(folderTree)
          // Mở rộng tất cả thư mục mẹ mặc định
          const initExp: Record<string, boolean> = {}
          folderTree.forEach((p) => {
            initExp[p.id] = true
          })
          setExpandedParents(initExp)
        } catch (fErr) {
          console.warn('Lỗi tải danh mục thư mục đề thi:', fErr)
        }

        // 2. Tải danh sách tuyển tập đề
        try {
          const res = await fetch('/api/exam-collections')
          if (res.ok) {
            const cData = await res.json()
            if (cData.collections) {
              setCollections(cData.collections)
            }
          }
        } catch (colErr) {
          console.error('Lỗi tải tuyển tập đề:', colErr)
        }

        // 3. Tải toàn bộ đề thi từ hệ thống
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false })

        // 4. Tải lịch sử bài nộp chi tiết của user
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('*, exams(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (examsError) {
          console.error('Error fetching exams:', examsError)
        } else {
          // LỌC ĐỀ HIỂN THỊ KHO ĐỀ:
          // Tuyệt đối không hiển thị đề trộn (is_hidden: true hoặc tiêu đề bắt đầu bằng [Trộn đề])
          const visibleExams = (examsData || []).filter((ex: any) => {
            if (ex.is_hidden === true) return false
            if (ex.title && ex.title.startsWith('[Trộn đề]')) return false
            if (ex.is_mixed === true) return false

            if (ex.created_by && ex.created_by === user.id) return true
            const code = String(ex.exam_code || ex.access_code || '')
            const is12DigitClassExam = code.length === 12 && /^\d{12}$/.test(code)
            if (is12DigitClassExam) return false
            return true
          })
          setExams(visibleExams)
        }

        setSubmissions((submissionsData as any) || [])
      } catch (e) {
        console.error('Lỗi khởi tạo new-exams-history-submissions:', e)
      } finally {
        setLoading(false)
      }
    }

    initData()
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

  // Danh sách ID các đề đã gom vào bất kỳ tuyển tập nào
  const bundledExamIds = useMemo(() => {
    const ids = new Set<string>()
    collections.forEach((c) => {
      ;(c.exam_ids || []).forEach((id) => ids.add(id))
    })
    return ids
  }, [collections])

  // Đếm số lượng đề thi cho từng thư mục con
  const folderExamCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach((parent) => {
      ;(parent.children || []).forEach((child) => {
        counts[child.id] = exams.filter((ex) => isExamInFolder(ex, child)).length
      })
    })
    return counts
  }, [folders, exams])

  // Lọc cây thư mục theo ô tìm kiếm thư mục
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return folders
    const q = folderSearch.toLowerCase().trim()

    return folders
      .map((parent) => {
        const parentMatches =
          parent.name.toLowerCase().includes(q) ||
          (parent.description && parent.description.toLowerCase().includes(q))
        const matchingChildren = (parent.children || []).filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.description && c.description.toLowerCase().includes(q))
        )

        if (parentMatches) {
          return parent
        }
        if (matchingChildren.length > 0) {
          return {
            ...parent,
            children: matchingChildren,
          }
        }
        return null
      })
      .filter(Boolean) as SebParentFolder[]
  }, [folders, folderSearch])

  useEffect(() => {
    if (folderSearch.trim()) {
      const exp: Record<string, boolean> = {}
      filteredFolders.forEach((p) => {
        exp[p.id] = true
      })
      setExpandedParents((prev) => ({ ...prev, ...exp }))
    }
  }, [folderSearch, filteredFolders])

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  const handleSelectChild = (child: SebChildFolder) => {
    if (selectedChildId === child.id) {
      setSelectedChildId('')
      setSelectedFolderObj(null)
    } else {
      setSelectedChildId(child.id)
      setSelectedFolderObj(child)
      setActiveCollection(null)
    }
    setMobileFolderOpen(false)
  }

  const handleSelectAllExams = () => {
    setSelectedChildId('')
    setSelectedFolderObj(null)
    setActiveCollection(null)
    setMobileFolderOpen(false)
  }

  // Tra cứu mã truy cập đề riêng tư
  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessCode.trim()) return

    setAccessCodeLoading(true)
    setAccessCodeError('')

    try {
      const code = accessCode.trim().toUpperCase()
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('access_code', code)
        .single()

      if (error || !data) {
        setAccessCodeError('Mã truy cập không hợp lệ hoặc đề thi không tồn tại.')
      } else {
        if (data.require_seb) {
          router.push(`/seb-exam/${data.id}`)
        } else {
          router.push(`/new-exams/${data.id}`)
        }
      }
    } catch {
      setAccessCodeError('Không tìm thấy đề thi với mã này.')
    } finally {
      setAccessCodeLoading(false)
    }
  }

  // Lọc đề thi độc lập (chưa gom vào tuyển tập)
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (bundledExamIds.has(exam.id)) return false

      const query = deferredQuery.toLowerCase().trim()
      const matchSearch =
        !query ||
        exam.title.toLowerCase().includes(query) ||
        (exam.subject && exam.subject.toLowerCase().includes(query)) ||
        (exam.description && exam.description.toLowerCase().includes(query)) ||
        (exam.tags && exam.tags.some((t) => t.toLowerCase().includes(query)))

      if (!matchSearch) return false

      if (selectedType !== 'Tất cả') {
        const typeMatch = (exam.exam_type || '').toUpperCase().includes(selectedType.toUpperCase())
        if (!typeMatch) return false
      }

      if (selectedChildId && selectedFolderObj) {
        return isExamInFolder(exam, selectedFolderObj)
      }

      return true
    })
  }, [exams, deferredQuery, selectedType, selectedChildId, selectedFolderObj, bundledExamIds])

  // Lọc tuyển tập đề hiển thị
  const filteredCollections = useMemo(() => {
    return collections.filter((col) => {
      const query = deferredQuery.toLowerCase().trim()
      const matchSearch =
        !query ||
        col.subject.toLowerCase().includes(query) ||
        col.title.toLowerCase().includes(query) ||
        (col.description && col.description.toLowerCase().includes(query))

      if (!matchSearch) return false

      if (selectedChildId && selectedFolderObj) {
        const folderName = (selectedFolderObj.name || '').toLowerCase()
        const colSubject = col.subject.toLowerCase()
        return folderName.includes(colSubject) || colSubject.includes(folderName)
      }

      return true
    })
  }, [collections, deferredQuery, selectedChildId, selectedFolderObj])

  // Dữ liệu tuyển tập đang mở xem chi tiết
  const activeCollectionExams = useMemo(() => {
    if (!activeCollection) return []
    return (activeCollection.exam_ids || [])
      .map((id) => exams.find((e) => e.id === id))
      .filter(Boolean) as ExamItem[]
  }, [activeCollection, exams])

  const activeCollectionBreakdown = useMemo(() => {
    return getExamQuestionsBreakdown(activeCollectionExams)
  }, [activeCollectionExams])

  const activeCollectionSumDuration = useMemo(() => {
    return activeCollectionExams.reduce((sum, e) => sum + (e.duration || 50), 0)
  }, [activeCollectionExams])

  const activeCollectionMaxDuration = useMemo(() => {
    return activeCollectionSumDuration + 30
  }, [activeCollectionSumDuration])

  const currentMaxAvailableQuestions = useMemo(() => {
    let count = 0
    if (mixIncludeChoice) count += activeCollectionBreakdown.choiceCount
    if (mixIncludeTF) count += activeCollectionBreakdown.tfCount
    if (mixIncludeSA) count += activeCollectionBreakdown.saCount
    return count
  }, [mixIncludeChoice, mixIncludeTF, mixIncludeSA, activeCollectionBreakdown])

  // Tính số câu hỏi khả dụng của 1 đề cụ thể theo các dạng câu được tick
  const getSingleExamAvailableCount = (ex: ExamItem) => {
    const bd = getExamQuestionsBreakdown([ex])
    let count = 0
    if (mixIncludeChoice) count += bd.choiceCount
    if (mixIncludeTF) count += bd.tfCount
    if (mixIncludeSA) count += bd.saCount
    return count
  }

  // Danh sách các đề được tick chọn trong tùy chọn chi tiết
  const detailedSelectedExams = useMemo(() => {
    return activeCollectionExams.filter((ex) => examMixConfigs[ex.id]?.enabled)
  }, [activeCollectionExams, examMixConfigs])

  // Tổng số câu hỏi được chỉ định lấy từ các đề đã tick
  const detailedTotalQuestionsCount = useMemo(() => {
    return detailedSelectedExams.reduce((sum, ex) => sum + (examMixConfigs[ex.id]?.count || 0), 0)
  }, [detailedSelectedExams, examMixConfigs])

  // Tổng thời gian các đề được chọn cộng lại + 30 phút trong chế độ chi tiết
  const detailedSumDuration = useMemo(() => {
    return detailedSelectedExams.reduce((sum, e) => sum + (e.duration || 50), 0)
  }, [detailedSelectedExams])

  const detailedMaxDuration = useMemo(() => {
    const base = detailedSumDuration > 0 ? detailedSumDuration : activeCollectionSumDuration
    return base + 30
  }, [detailedSumDuration, activeCollectionSumDuration])

  const effectiveMaxDuration = showDetailedMix ? detailedMaxDuration : activeCollectionMaxDuration

  // Mở modal đóng gói tuyển tập (Admin)
  const handleOpenCreatePackageModal = () => {
    setPackagingEditingId(null)
    setPackagingSubject('')
    setPackagingTitle('')
    setPackagingDesc('')
    setPackagingSelectedExamIds([])
    setPackagingExamSearch('')
    setPackagingError('')
    setShowAdminPackageModal(true)
  }

  // Mở modal sửa tuyển tập (Admin)
  const handleOpenEditPackageModal = (col: ExamCollection) => {
    setPackagingEditingId(col.id)
    setPackagingSubject(col.subject)
    setPackagingTitle(col.title)
    setPackagingDesc(col.description || '')
    setPackagingSelectedExamIds([...(col.exam_ids || [])])
    setPackagingExamSearch('')
    setPackagingError('')
    setShowAdminPackageModal(true)
  }

  // Xóa / giải tán tuyển tập (Admin)
  const handleDeleteCollection = async (colId: string) => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn giải tán tuyển tập đề này? Các đề thi bên trong sẽ xuất hiện trở lại tại trang khảo thí chung.'
      )
    ) {
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const queryUrl = `/api/exam-collections?id=${encodeURIComponent(colId)}&userId=${encodeURIComponent(
        currentUserId || ''
      )}&userEmail=${encodeURIComponent(userEmail || '')}`

      const res = await fetch(queryUrl, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        setCollections((prev) => prev.filter((c) => c.id !== colId))
        if (activeCollection?.id === colId) {
          setActiveCollection(null)
        }
      } else {
        alert(data.error || 'Lỗi khi xóa tuyển tập')
      }
    } catch {
      alert('Không thể kết nối đến máy chủ để xóa tuyển tập.')
    }
  }

  // Lưu đóng gói tuyển tập (Admin)
  const handleSavePackaging = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!packagingSubject.trim()) {
      setPackagingError('Vui lòng nhập tên môn học (ví dụ: Toán học, Vật lí, Hóa học...)')
      return
    }
    if (packagingSelectedExamIds.length === 0) {
      setPackagingError('Vui lòng chọn ít nhất 1 đề thi để đóng gói vào tuyển tập.')
      return
    }

    setPackagingLoading(true)
    setPackagingError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/exam-collections', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: packagingEditingId || undefined,
          subject: packagingSubject.trim(),
          title: packagingTitle.trim() || `Tuyển tập đề thi môn ${packagingSubject.trim()}`,
          description: packagingDesc.trim() || `Gồm ${packagingSelectedExamIds.length} đề thi tuyển chọn chất lượng cao.`,
          exam_ids: packagingSelectedExamIds,
          userId: currentUserId,
          userEmail: userEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi lưu tuyển tập đề')
      }

      setCollections(data.collections)
      setShowAdminPackageModal(false)

      if (activeCollection && activeCollection.id === data.collection.id) {
        setActiveCollection(data.collection)
      }
    } catch (err: any) {
      setPackagingError(err.message || 'Lỗi lưu tuyển tập đề')
    } finally {
      setPackagingLoading(false)
    }
  }

  // Mở modal trộn đề (Student)
  const handleOpenMixModal = () => {
    setMixIncludeChoice(true)
    setMixIncludeTF(true)
    setMixIncludeSA(true)
    setShowDetailedMix(false)

    const initialConfigs: Record<string, { enabled: boolean; count: number }> = {}
    activeCollectionExams.forEach((ex) => {
      const bd = getExamQuestionsBreakdown([ex])
      initialConfigs[ex.id] = {
        enabled: true,
        count: bd.total,
      }
    })
    setExamMixConfigs(initialConfigs)

    const available = activeCollectionBreakdown.total
    setMixQuestionCount(Math.min(40, Math.max(1, available)))
    setMixDuration(Math.min(activeCollectionSumDuration || 50, activeCollectionMaxDuration))
    setMixTitle(`[Trộn đề] Tuyển tập ${activeCollection?.subject || 'Đề thi'}`)
    setMixError('')
    setShowMixModal(true)
  }

  // Thực hiện trộn đề
  const handleExecuteMix = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCollection) return

    if (!mixIncludeChoice && !mixIncludeTF && !mixIncludeSA) {
      setMixError('Vui lòng chọn ít nhất 1 dạng câu hỏi (trắc nghiệm, đúng sai hoặc trả lời ngắn).')
      return
    }

    if (!showDetailedMix && currentMaxAvailableQuestions <= 0) {
      setMixError('Không có câu hỏi nào thuộc các phần đã chọn để trộn.')
      return
    }

    if (showDetailedMix && detailedTotalQuestionsCount <= 0) {
      setMixError('Vui lòng chọn ít nhất 1 đề thi và đặt số câu hỏi muốn lấy lớn hơn 0.')
      return
    }

    setMixLoading(true)
    setMixError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const payload: any = {
        collection_id: activeCollection.id,
        include_choice: mixIncludeChoice,
        include_true_false: mixIncludeTF,
        include_short_answer: mixIncludeSA,
        question_count: showDetailedMix ? detailedTotalQuestionsCount : mixQuestionCount,
        custom_duration: mixDuration,
        custom_title: mixTitle,
        userId: currentUserId,
        userEmail: userEmail,
      }

      if (showDetailedMix) {
        payload.exam_configs = detailedSelectedExams
          .filter((ex) => (examMixConfigs[ex.id]?.count || 0) > 0)
          .map((ex) => ({
            exam_id: ex.id,
            count: examMixConfigs[ex.id].count,
          }))
      }

      const res = await fetch('/api/exam-collections/mix', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Trộn đề thất bại')
      }

      setShowMixModal(false)
      // Chuyển thẳng đến phòng thi của đề đã trộn
      router.push(`/new-exams/${data.examId}`)
    } catch (err: any) {
      setMixError(err.message || 'Lỗi khi trộn đề thi')
    } finally {
      setMixLoading(false)
    }
  }

  // --- LOGIC CHO TAB LỊCH SỬ BÀI NỘP ---
  const chartData = useMemo(() => {
    let list = [...submissions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (chartExamFilter !== 'Tất cả') {
      list = list.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (chartExamFilter === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (chartExamFilter === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (chartExamFilter === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(chartExamFilter.toUpperCase())
      })
    }

    const gradedItems = list.filter((s) => s.score !== null && s.score !== undefined)
    const count = gradedItems.length
    if (count === 0) return { count: 0, points: [], avg: '0', max: '0', min: '0', trend: 0, maxScoreRange: 10, gridSteps: [0, 2.5, 5, 7.5, 10], svgWidth: 650, svgHeight: 200 }

    const scores = gradedItems.map((s) => s.score || 0)
    const rawMax = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = (scores.reduce((a, b) => a + b, 0) / count).toFixed(1)

    const maxScoreVal = Math.max(10, rawMax)
    const maxScoreRange = maxScoreVal <= 10 ? 10 : maxScoreVal <= 100 ? 100 : maxScoreVal <= 150 ? 150 : Math.ceil(maxScoreVal / 50) * 50
    const gridSteps = maxScoreRange === 10
      ? [0, 2.5, 5, 7.5, 10]
      : [0, Math.round(maxScoreRange * 0.25), Math.round(maxScoreRange * 0.5), Math.round(maxScoreRange * 0.75), maxScoreRange]

    const recentScores = scores.slice(-3)
    const initialScores = scores.slice(0, 3)
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const initialAvg = initialScores.reduce((a, b) => a + b, 0) / initialScores.length
    const trend = parseFloat((recentAvg - initialAvg).toFixed(1))

    const baseWidth = Math.max(650, count * 55)
    const svgWidth = baseWidth * chartZoom
    const svgHeight = 200
    const paddingX = 50
    const paddingY = 30

    const points = gradedItems.map((item, idx) => {
      const x = count === 1 ? svgWidth / 2 : paddingX + (idx / (count - 1)) * (svgWidth - paddingX * 2)
      const rawScore = item.score || 0
      const clampedRatio = Math.max(0, Math.min(1, rawScore / maxScoreRange))
      const y = svgHeight - paddingY - clampedRatio * (svgHeight - paddingY * 2)

      return {
        x,
        y,
        score: rawScore,
        date: new Date(item.created_at).toLocaleDateString('vi-VN'),
        title: item.exams?.title || 'Đề thi tự luyện',
      }
    })

    const pathString = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    }, '')

    const areaPath = points.length > 0
      ? `${pathString} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
      : ''

    return {
      count,
      points,
      avg,
      max: rawMax.toFixed(1),
      min: min.toFixed(1),
      trend,
      maxScoreRange,
      gridSteps,
      svgWidth,
      svgHeight,
      pathString,
      areaPath,
    }
  }, [submissions, chartExamFilter, chartZoom])

  const filteredSubmissions = useMemo(() => {
    let result = [...submissions]

    const q = deferredHistoryQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((item) => {
        const title = (item.exams?.title || '').toLowerCase()
        const subject = (item.exams?.subject || '').toLowerCase()
        return title.includes(q) || subject.includes(q)
      })
    }

    if (historySelectedType !== 'Tất cả') {
      result = result.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (historySelectedType === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (historySelectedType === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (historySelectedType === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(historySelectedType.toUpperCase())
      })
    }

    if (filterScoreStatus === 'high') {
      result = result.filter((item) => (item.score ?? 0) >= 8.0)
    } else if (filterScoreStatus === 'low') {
      result = result.filter((item) => item.score !== null && (item.score ?? 0) < 5.0)
    } else if (filterScoreStatus === 'graded') {
      result = result.filter((item) => item.is_graded || item.score !== null)
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0)
      return 0
    })

    return result
  }, [submissions, deferredHistoryQuery, historySelectedType, filterScoreStatus, sortBy])

  const historyStats = useMemo(() => {
    const total = submissions.length
    const graded = submissions.filter((s) => s.score !== null && s.score !== undefined)
    const scores = graded.map((s) => s.score || 0)
    const highest = scores.length > 0 ? Math.max(...scores).toFixed(1) : '—'
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
    const highCount = submissions.filter((s) => (s.score ?? 0) >= 8.0).length

    const totalSecs = submissions.reduce((acc, s) => acc + (s.time_spent || 0), 0)
    const totalMinutes = Math.round(totalSecs / 60)

    return { total, highest, avg, highCount, totalMinutes }
  }, [submissions])

  const themeVars = getModernThemeVars(activeTab === 'history' ? 'teal' : 'indigo', isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        themeColor={activeTab === 'history' ? 'teal' : 'indigo'}
        title="SenExam Khảo Thí & Lịch Sử Bài Nộp"
        subtitle="Đang đồng bộ kho đề thi KaTeX & dữ liệu phân tích kết quả..."
      />
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1
                className="text-2xl sm:text-3xl font-black leading-tight"
                style={{ fontFamily: 'var(--font-hub-heading)' }}
              >
                {activeTab === 'exams' ? 'Kho Đề Thi & Khảo Thí' : 'Lịch Sử Bài Nộp & Phân Tích Điểm'}
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                {activeTab === 'exams'
                  ? 'Quản lý tuyển tập đề theo môn, tổ chức theo khối thi và luyện thi thông minh.'
                  : 'Tra cứu kết quả thi, phân tích tiến độ điểm số và xem lại lời giải chi tiết.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Tạo Tuyển Tập Đề - Chỉ Admin Mới Thấy (hiện rõ nút chữ và icon như cũ) */}
            {isAdmin && activeTab === 'exams' && (
              <button
                type="button"
                onClick={handleOpenCreatePackageModal}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 text-xs font-bold shadow-sm transition hover:scale-105 cursor-pointer"
              >
                <Package className="h-4 w-4" />
                <span>Tạo tuyển tập đề</span>
              </button>
            )}

            {/* Nút bật/tắt Drawer trên Mobile (khi ở tab Kho Đề) */}
            {activeTab === 'exams' && (
              <button
                type="button"
                onClick={() => setMobileFolderOpen(!mobileFolderOpen)}
                className="md:hidden flex h-10 px-3.5 items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-xs font-bold shadow-sm transition hover:scale-105"
              >
                <Filter className="h-4 w-4 text-indigo-500" />
                <span>{selectedFolderObj ? selectedFolderObj.name : 'Danh mục môn'}</span>
              </button>
            )}

            {/* Nút Thu gọn/Xem biểu đồ (khi ở tab Lịch sử) */}
            {activeTab === 'history' && (
              <button
                type="button"
                onClick={() => setShowChart((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
                title={showChart ? 'Thu gọn biểu đồ' : 'Xem biểu đồ'}
              >
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
              title="Chuyển chế độ Sáng / Tối"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {/* Nút Lịch Sử Bài Thi - Chỉ còn mỗi logo icon */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'exams' ? 'history' : 'exams')}
              title={activeTab === 'exams' ? 'Xem lịch sử bài thi & điểm số' : 'Quay lại kho đề thi'}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm transition hover:scale-105 cursor-pointer ${
                activeTab === 'history'
                  ? 'border-teal-500 bg-teal-500 text-white shadow-teal-500/20'
                  : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-teal-500 hover:bg-black/5'
              }`}
            >
              <History className="h-5 w-5" />
            </button>

            <a
              href="https://seb.thicu.tailieufepn.senexam.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-sky-600 hover:to-blue-700"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Thi Bảo Mật Cao</span>
            </a>
          </div>
        </div>

        {/* TAB CHUYỂN ĐỔI: KHO ĐỀ THI & LỊCH SỬ BÀI NỘP */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 max-w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'exams'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Kho Đề Thi & Tuyển Tập</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="h-4 w-4 text-teal-500" />
            <span>Lịch Sử Bài Nộp</span>
            {submissions.length > 0 && (
              <span className="rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 px-1.5 py-0.2 text-[10px] font-black">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        {/* NỘI DUNG CHÍNH TAB 1: KHO ĐỀ THI & KHẢO THÍ */}
        {activeTab === 'exams' && (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] gap-6 items-start animate-in fade-in">
            {/* CỘT TRÁI: SIDEBAR CÂY THƯ MỤC MẸ - CON */}
            <aside
              className={`space-y-4 md:block ${
                mobileFolderOpen
                  ? 'fixed inset-0 z-50 bg-white/95 dark:bg-slate-900/95 p-6 overflow-y-auto backdrop-blur-xl'
                  : 'hidden'
              }`}
            >
              {mobileFolderOpen && (
                <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10 md:hidden">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Danh mục cây môn học
                  </h3>
                  <button
                    onClick={() => setMobileFolderOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Ô TÌM KIẾM MÔN & CÂY THƯ MỤC */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc môn học..."
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    className="h-8 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-8 pr-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Nút Xem Tất Cả */}
                <button
                  type="button"
                  onClick={handleSelectAllExams}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                    !selectedChildId && !activeCollection
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Tất cả đề thi & tuyển tập</span>
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{exams.length}</span>
                </button>
              </div>

              {/* Cây Thư Mục Mẹ - Con */}
              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-3 shadow-sm backdrop-blur-xl max-h-[500px] overflow-y-auto space-y-1">
                {filteredFolders.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy thư mục</div>
                ) : (
                  filteredFolders.map((parent) => {
                    const isExp = expandedParents[parent.id] ?? true
                    const hasChildren = parent.children && parent.children.length > 0

                    return (
                      <div key={parent.id} className="space-y-0.5">
                        {/* Thư mục mẹ */}
                        <button
                          type="button"
                          onClick={() => toggleParent(parent.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {isExp ? (
                              <FolderOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Folder className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            )}
                            <span className="truncate">{parent.name}</span>
                          </span>
                          {hasChildren && (
                            <span className="text-slate-400">
                              {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </span>
                          )}
                        </button>

                        {/* Các thư mục con */}
                        {isExp && hasChildren && (
                          <div className="pl-3 space-y-0.5 border-l border-black/5 dark:border-white/5 ml-3">
                            {parent.children.map((child) => {
                              const isSelected = selectedChildId === child.id
                              const count = folderExamCounts[child.id] || 0

                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSelectChild(child)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  <span className="truncate">{child.name}</span>
                                  <span
                                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-black/5 dark:bg-white/5 text-slate-400'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* KHỐI NHẬP MÃ TRUY CẬP ĐỀ THI */}
              <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-4 shadow-sm backdrop-blur-xl space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-black/5 dark:border-white/5">
                  <KeyRound className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Vào Thi Bằng Mã Đề
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                  Nhập mã đề riêng tư hoặc đề lớp học do thầy cô cấp.
                </p>

                <form onSubmit={handleAccessCodeSubmit} className="space-y-2">
                  <input
                    type="text"
                    placeholder="VD: TOAN12A, SINH01..."
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-indigo-500"
                  />
                  {accessCodeError && <p className="text-[11px] font-bold text-rose-500">{accessCodeError}</p>}
                  <button
                    type="submit"
                    disabled={accessCodeLoading || !accessCode.trim()}
                    className="w-full h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                  >
                    {accessCodeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Vào phòng thi'}
                  </button>
                </form>
              </div>

              {/* Box Đóng gói đề (Admin only) */}
              {isAdmin && (
                <div className="rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Package className="h-4 w-4" /> Quản Trị Tuyển Tập
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Đóng gói các đề thi liên quan theo môn và cấu hình trộn đề tự động cho thí sinh.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreatePackageModal}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tạo tuyển tập đề
                  </button>
                </div>
              )}
            </aside>

            {/* CỘT PHẢI: KHO ĐỀ & TUYỂN TẬP */}
            <div className="space-y-6">
              {/* THANH TÌM KIẾM & CHỌN KHỐI THI */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên đề thi, mã đề, môn học hoặc từ khóa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs font-medium shadow-sm backdrop-blur-xl outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {EXAM_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedType === type
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* BẢNG CHI TIẾT TUYỂN TẬP ĐANG MỞ (NẾU CÓ) */}
              {activeCollection && (
                <div className="p-5 sm:p-6 rounded-[28px] border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-white/80 to-indigo-500/10 dark:via-slate-900/80 shadow-md backdrop-blur-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                          Tuyển tập môn {activeCollection.subject}
                        </span>
                        <span className="text-xs text-slate-500 font-bold font-mono">
                          {activeCollectionExams.length} đề thi
                        </span>
                      </div>
                      <h2
                        className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white"
                        style={{ fontFamily: 'var(--font-hub-heading)' }}
                      >
                        {activeCollection.title}
                      </h2>
                      {activeCollection.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
                          {activeCollection.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenMixModal}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 cursor-pointer"
                      >
                        <Shuffle className="h-4 w-4" />
                        <span>Trộn đề ôn luyện</span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditPackageModal(activeCollection)}
                            className="p-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-black/5"
                            title="Sửa tuyển tập"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCollection(activeCollection.id)}
                            className="p-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                            title="Giải tán tuyển tập"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveCollection(null)}
                        className="p-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600"
                        title="Đóng xem chi tiết"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* THỐNG KÊ CÂU HỎI TRONG TUYỂN TẬP */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-purple-500/15">
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Tổng số đề</div>
                      <div className="text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                        {activeCollectionExams.length} đề thi
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Trắc nghiệm (TN)</div>
                      <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {activeCollectionBreakdown.choiceCount} câu
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Đúng / Sai (Đ/S)</div>
                      <div className="text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                        {activeCollectionBreakdown.tfCount} câu
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Trả lời ngắn (TLN)</div>
                      <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                        {activeCollectionBreakdown.saCount} câu
                      </div>
                    </div>
                  </div>

                  {/* DANH SÁCH CÁC ĐỀ BÊN TRONG TUYỂN TẬP: ĐỀ SỐ 1, 2, 3... */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Danh sách các đề thi trong tuyển tập:
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeCollectionExams.map((ex, idx) => {
                        const hasSubmitted = submissions.some((s) => s.exam_id === ex.id)
                        return (
                          <div
                            key={ex.id}
                            className="p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-2xs hover:shadow-xs transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black font-mono">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  Đề số {idx + 1}: {ex.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>{ex.duration || 50} phút</span>
                                  {hasSubmitted && (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ Đã làm
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Link
                              href={`/new-exams/${ex.id}`}
                              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                            >
                              <span>Vào thi</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PHẦN 1: DANH SÁCH TUYỂN TẬP ĐỀ (NẾU CHƯA MỞ XEM CHI TIẾT) */}
              {!activeCollection && filteredCollections.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <h2
                        className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800 dark:text-slate-200"
                        style={{ fontFamily: 'var(--font-hub-heading)' }}
                      >
                        Tuyển Tập Đề Thi Theo Môn
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-bold font-mono">
                      {filteredCollections.length} tuyển tập
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCollections.map((col) => {
                      const colExams = (col.exam_ids || [])
                        .map((id) => exams.find((e) => e.id === id))
                        .filter(Boolean) as ExamItem[]
                      const breakdown = getExamQuestionsBreakdown(colExams)

                      return (
                        <div
                          key={col.id}
                          className="group relative overflow-hidden rounded-[26px] border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-white/80 to-indigo-500/5 dark:via-slate-900/80 dark:to-indigo-500/10 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                        >
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400" />

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                Tuyển tập • {col.subject}
                              </span>
                              <span className="rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono">
                                {col.exam_ids.length} đề thi
                              </span>
                            </div>

                            <h3
                              className="mt-3 text-base font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {col.title}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {col.description || `Tuyển chọn ${col.exam_ids.length} đề thi môn ${col.subject}.`}
                            </p>

                            <div className="mt-3 grid grid-cols-3 gap-1.5 py-2 px-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-center text-[10px] font-mono">
                              <div>
                                <span className="text-slate-400">TN:</span>{' '}
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {breakdown.choiceCount}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Đ/S:</span>{' '}
                                <span className="font-bold text-sky-600 dark:text-sky-400">
                                  {breakdown.tfCount}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">TLN:</span>{' '}
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  {breakdown.saCount}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                            {/* Nút Tuỳ Chỉnh Tuyển Tập Đề (Admin only: Sửa & Xóa) */}
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenEditPackageModal(col)
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                  title="Sửa tuyển tập"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteCollection(col.id)
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                  title="Giải tán tuyển tập"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                type="button"
                                onClick={() => setActiveCollection(col)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 text-xs font-bold transition shadow-xs cursor-pointer"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                <span>Mở tuyển tập</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCollection(col)
                                  setTimeout(() => handleOpenMixModal(), 100)
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 py-2 px-3 text-xs font-bold transition cursor-pointer"
                                title="Trộn đề ôn luyện từ tuyển tập này"
                              >
                                <Shuffle className="h-3.5 w-3.5" />
                                <span>Trộn đề</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PHẦN 2: DANH SÁCH ĐỀ THI ĐỘC LẬP / CÁC ĐỀ KHÔNG GỘP VÀO TUYỂN TẬP */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    <h2
                      className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800 dark:text-slate-200"
                      style={{ fontFamily: 'var(--font-hub-heading)' }}
                    >
                      {activeCollection ? 'Các Đề Thi Khác' : 'Kho Đề Thi KaTeX Chuẩn'}
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 font-bold font-mono">
                    {filteredExams.length} đề thi
                  </span>
                </div>

                {filteredExams.length === 0 ? (
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 p-8 text-center backdrop-blur-xl">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Không tìm thấy đề thi độc lập nào phù hợp với bộ lọc hiện tại.
                    </p>
                    {bundledExamIds.size > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        (Các đề thi đã gộp vào tuyển tập đề theo môn sẽ chỉ hiển thị bên trong tuyển tập đó)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExams.map((exam) => {
                      const hasSubmitted = submissions.some((s) => s.exam_id === exam.id)

                      return (
                        <div
                          key={exam.id}
                          className="group relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                {exam.exam_type || 'THPTQG'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {hasSubmitted && (
                                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    ✓ Đã nộp bài
                                  </span>
                                )}
                                {exam.is_vip && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    <Crown className="h-3 w-3" /> VIP
                                  </span>
                                )}
                              </div>
                            </div>

                            <h3
                              className="mt-3 text-base font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {exam.title}
                            </h3>

                            {exam.description && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {exam.description}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span>{exam.duration || 50} phút</span>
                              </span>
                              {exam.subject && (
                                <span className="flex items-center gap-1 truncate">
                                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                  <span className="truncate">{exam.subject}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                            <Link
                              href={exam.require_seb ? `/seb-exam/${exam.id}` : `/new-exams/${exam.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-xs font-bold transition shadow-xs"
                            >
                              <span>{hasSubmitted ? 'Làm lại đề' : 'Bắt đầu thi'}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>

                            {exam.pdf_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewPdfUrl(exam.pdf_url!)
                                  setPreviewPdfTitle(exam.title)
                                }}
                                className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition"
                                title="Xem trước file PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NỘI DUNG CHÍNH TAB 2: LỊCH SỬ BÀI NỘP & PHÂN TÍCH ĐIỂM */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in">
            {/* KPI CARDS THỐNG KÊ NHANH */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng bài đã nộp</span>
                  <FileText className="h-4 w-4 text-teal-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-slate-900 dark:text-white"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.total}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Bài thi trên hệ thống</p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm cao nhất</span>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.highest}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Kỷ lục điểm số của bạn</p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm trung bình</span>
                  <Award className="h-4 w-4 text-indigo-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-indigo-600 dark:text-indigo-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.avg}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {historyStats.highCount} bài đạt điểm giỏi (≥ 8.0)
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Thời gian luyện đề</span>
                  <Clock className="h-4 w-4 text-sky-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-sky-600 dark:text-sky-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.totalMinutes} <span className="text-xs font-bold text-slate-500">phút</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Tổng thời gian ngồi làm bài</p>
              </div>
            </section>

            {/* BIỂU ĐỒ TIẾN TRÌNH ĐIỂM SỐ (SVG CHART VỚI ZOOM & TOOLTIP) */}
            {showChart && chartData.count > 0 && (
              <section className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Biểu đồ tiến độ phong độ điểm thi
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {chartData.count} lần thi đã chấm • Xu hướng gần đây:{' '}
                        <span
                          className={`font-bold ${
                            chartData.trend > 0
                              ? 'text-emerald-500'
                              : chartData.trend < 0
                              ? 'text-rose-500'
                              : 'text-slate-500'
                          }`}
                        >
                          {chartData.trend > 0 ? `+${chartData.trend}` : chartData.trend} điểm
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                      {['Tất cả', 'THPTQG', 'HSA', 'TSA'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setChartExamFilter(tab)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                            chartExamFilter === tab
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-black/10 dark:border-white/10">
                      <button
                        onClick={() => setChartZoom((z) => Math.max(1, z - 0.25))}
                        className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                        title="Thu nhỏ"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-mono text-slate-500">{chartZoom.toFixed(2)}x</span>
                      <button
                        onClick={() => setChartZoom((z) => Math.min(2.5, z + 0.25))}
                        className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                        title="Phóng to"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* SVG DRAWING AREA */}
                <div className="relative overflow-x-auto pb-2 scrollbar-thin">
                  <div style={{ minWidth: `${chartData.svgWidth}px` }} className="relative h-[200px]">
                    <svg
                      width={chartData.svgWidth}
                      height={chartData.svgHeight}
                      className="overflow-visible"
                    >
                      <defs>
                        <linearGradient id="hubGradTeal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Lưới ngang Grid Lines */}
                      {chartData.gridSteps.map((step) => {
                        const ratio = step / chartData.maxScoreRange
                        const y = chartData.svgHeight - 30 - ratio * (chartData.svgHeight - 60)
                        return (
                          <g key={step}>
                            <line
                              x1={40}
                              y1={y}
                              x2={chartData.svgWidth - 20}
                              y2={y}
                              stroke="currentColor"
                              strokeDasharray="3 3"
                              className="text-black/10 dark:text-white/10"
                            />
                            <text
                              x={10}
                              y={y + 3}
                              className="text-[9px] fill-slate-400 font-mono font-bold"
                            >
                              {step}
                            </text>
                          </g>
                        )
                      })}

                      {/* Vùng mờ Area Path */}
                      {chartData.areaPath && (
                        <path d={chartData.areaPath} fill="url(#hubGradTeal)" />
                      )}

                      {/* Đường line kết nối */}
                      {chartData.pathString && (
                        <path
                          d={chartData.pathString}
                          fill="none"
                          stroke="#0D9488"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Các điểm dữ liệu Data Points */}
                      {chartData.points.map((p, idx) => (
                        <g key={idx} className="cursor-pointer group">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            className="fill-teal-500 stroke-white dark:stroke-slate-900 stroke-2 transition-transform duration-200 group-hover:scale-125"
                            onMouseEnter={() => setHoveredPoint(p)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Tooltip hiển thị khi hover vào điểm */}
                    {hoveredPoint && (
                      <div
                        className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/90 text-white p-2 rounded-xl text-xs shadow-lg backdrop-blur-md border border-white/10 whitespace-nowrap"
                        style={{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }}
                      >
                        <p className="font-bold truncate max-w-[200px]">{hoveredPoint.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-teal-300 font-mono">
                          <span>Điểm: {hoveredPoint.score}</span>
                          <span>•</span>
                          <span>{hoveredPoint.date}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* BỘ LỌC & DANH SÁCH BÀI LÀM ĐÃ NỘP */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bài nộp theo tên đề thi hoặc môn..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs font-medium outline-none focus:border-teal-500"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    {HISTORY_EXAM_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setHistorySelectedType(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                          historySelectedType === t
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-black/5'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <select
                    value={filterScoreStatus}
                    onChange={(e: any) => setFilterScoreStatus(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Tất cả điểm số</option>
                    <option value="high">Điểm giỏi (≥ 8.0)</option>
                    <option value="low">Cần cải thiện (&lt; 5.0)</option>
                    <option value="graded">Đã có điểm</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="newest">Mới nhất trước</option>
                    <option value="oldest">Cũ nhất trước</option>
                    <option value="highest">Điểm cao nhất</option>
                    <option value="lowest">Điểm thấp nhất</option>
                  </select>
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                  <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Không tìm thấy bài nộp nào phù hợp
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hãy thử đổi từ khóa tìm kiếm hoặc làm thêm các đề thi trong Kho Đề.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSubmissions.map((sub) => {
                    const exam = sub.exams
                    const score = sub.score !== null && sub.score !== undefined ? sub.score.toFixed(1) : null
                    const minutes = sub.time_spent ? Math.round(sub.time_spent / 60) : null
                    const dateStr = new Date(sub.created_at).toLocaleString('vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })

                    return (
                      <div
                        key={sub.id}
                        className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`h-12 w-12 shrink-0 rounded-2xl flex flex-col items-center justify-center font-black ${
                              score !== null && parseFloat(score) >= 8
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : score !== null && parseFloat(score) >= 5
                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                : score !== null
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                            }`}
                          >
                            <span className="text-base leading-none">{score ?? '—'}</span>
                            <span className="text-[9px] uppercase tracking-wider font-bold opacity-75">Điểm</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase">
                                {exam?.exam_type || 'THPTQG'}
                              </span>
                              {exam?.subject && (
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  {exam.subject}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">• {dateStr}</span>
                            </div>

                            <h3
                              className="text-sm font-bold text-slate-900 dark:text-white"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {exam?.title || 'Đề thi tự luyện'}
                            </h3>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {minutes !== null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Làm bài trong {minutes} phút
                                </span>
                              )}
                              <span>•</span>
                              <span>{sub.is_graded ? 'Đã chấm điểm' : 'Đang xử lý kết quả'}</span>
                            </div>

                            {sub.feedback && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                💬 Nhận xét: {sub.feedback}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {exam?.solution_pdf_url && (
                            <button
                              onClick={() => {
                                setPreviewPdfUrl(exam.solution_pdf_url!)
                                setPreviewPdfTitle(`Lời giải: ${exam.title}`)
                              }}
                              className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                              title="Xem đáp án PDF"
                            >
                              <FileText className="h-3.5 w-3.5 text-amber-500" />
                              <span className="hidden sm:inline">Đáp án PDF</span>
                            </button>
                          )}

                          {sub.exam_id && (
                            <Link
                              href={`/new-exams/${sub.exam_id}`}
                              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                              title="Làm lại đề thi này"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Làm lại</span>
                            </Link>
                          )}

                          <Link
                            href={`/new-history-submissions/${sub.id}`}
                            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Xem chi tiết</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* MODAL ĐÓNG GÓI TUYỂN TẬP ĐỀ (ADMIN ONLY) */}
      {showAdminPackageModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    className="text-lg font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-hub-heading)' }}
                  >
                    {packagingEditingId ? 'Cập Nhật Tuyển Tập Đề' : 'Tạo Tuyển Tập Đề Mới'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gộp các đề liên quan theo môn và cấu hình trọn gói cho học sinh.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPackageModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePackaging} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Môn học đóng gói <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Toán học, Vật lí, Hóa học..."
                    value={packagingSubject}
                    onChange={(e) => setPackagingSubject(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên tuyển tập đề:
                  </label>
                  <input
                    type="text"
                    placeholder={`Tuyển tập đề thi ${packagingSubject || 'môn học'}`}
                    value={packagingTitle}
                    onChange={(e) => setPackagingTitle(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả ngắn gọn về tuyển tập:
                </label>
                <textarea
                  placeholder="Gồm các đề thi thử chọn lọc từ các trường THPT Chuyên, chuẩn ma trận Bộ GD&ĐT..."
                  value={packagingDesc}
                  onChange={(e) => setPackagingDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 p-3 text-xs font-medium outline-none focus:border-indigo-500 h-16"
                />
              </div>

              {/* CHỌN CÁC ĐỀ THI ĐƯA VÀO TUYỂN TẬP */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chọn đề thi đưa vào tuyển tập ({packagingSelectedExamIds.length} đề đã chọn):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Các đề được chọn sẽ được gom gọn vào tuyển tập này.
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc nhanh đề theo tên để chọn..."
                    value={packagingExamSearch}
                    onChange={(e) => setPackagingExamSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {exams
                    .filter((ex) => {
                      if (!packagingExamSearch.trim()) return true
                      return ex.title.toLowerCase().includes(packagingExamSearch.toLowerCase())
                    })
                    .map((ex) => {
                      const isSelected = packagingSelectedExamIds.includes(ex.id)
                      return (
                        <div
                          key={ex.id}
                          onClick={() => {
                            setPackagingSelectedExamIds((prev) =>
                              isSelected ? prev.filter((id) => id !== ex.id) : [...prev, ex.id]
                            )
                          }}
                          className={`p-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-white" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span className="truncate">{ex.title}</span>
                          </div>
                          <span className="shrink-0 text-[10px] opacity-75 font-mono">
                            {ex.duration || 50}p
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {packagingError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {packagingError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminPackageModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={packagingLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {packagingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>Lưu Tuyển Tập</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRỘN ĐỀ THI DÀNH CHO THÍ SINH */}
      {showMixModal && activeCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Shuffle className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    className="text-lg font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-hub-heading)' }}
                  >
                    Trộn Đề Thi Ôn Luyện
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tuyển tập môn {activeCollection.subject} ({activeCollectionExams.length} đề thi)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMixModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteMix} className="space-y-4">
              {/* PHẦN 1: CHỌN CÁC DẠNG CÂU HỎI ĐƯA VÀO TRỘN */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  1. Chọn các phần câu hỏi đưa vào trộn đề:
                </label>
                <p className="text-[11px] text-slate-500">
                  Bỏ chọn phần nào thì hệ thống sẽ không chọn câu hỏi thuộc phần đó.
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeChoice
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Trắc nghiệm</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeChoice}
                        onChange={(e) => setMixIncludeChoice(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.choiceCount} câu
                    </div>
                  </label>

                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeTF
                        ? 'border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Đúng / Sai</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeTF}
                        onChange={(e) => setMixIncludeTF(e.target.checked)}
                        className="h-4 w-4 rounded accent-sky-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.tfCount} câu
                    </div>
                  </label>

                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeSA
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Trả lời ngắn</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeSA}
                        onChange={(e) => setMixIncludeSA(e.target.checked)}
                        className="h-4 w-4 rounded accent-amber-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.saCount} câu
                    </div>
                  </label>
                </div>
              </div>

              {/* TÙY CHỌN CHI TIẾT TỪNG ĐỀ (NÚT CHI TIẾT) */}
              <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Tùy chọn chi tiết từng đề:
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {showDetailedMix
                        ? 'Đang bật: Chọn cụ thể đề nào và số câu lấy từ mỗi đề.'
                        : 'Mặc định: Tự động gom & trộn đều từ toàn bộ tuyển tập.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showDetailedMix
                      setShowDetailedMix(next)
                      if (next) {
                        const hasAny = Object.values(examMixConfigs).some((c) => c.enabled && c.count > 0)
                        if (!hasAny) {
                          const initialConfigs: Record<string, { enabled: boolean; count: number }> = {}
                          activeCollectionExams.forEach((ex) => {
                            const avail = getSingleExamAvailableCount(ex)
                            initialConfigs[ex.id] = { enabled: true, count: avail }
                          })
                          setExamMixConfigs(initialConfigs)
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition hover:bg-indigo-500/20 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{showDetailedMix ? 'Đóng chi tiết' : 'Chi tiết'}</span>
                    {showDetailedMix ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {showDetailedMix && (
                  <div className="space-y-2.5 p-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 dark:bg-indigo-500/10 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Chọn đề thi & số câu cần lấy:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...examMixConfigs }
                            activeCollectionExams.forEach((ex) => {
                              const avail = getSingleExamAvailableCount(ex)
                              next[ex.id] = { enabled: true, count: avail }
                            })
                            setExamMixConfigs(next)
                          }}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-slate-400">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...examMixConfigs }
                            activeCollectionExams.forEach((ex) => {
                              next[ex.id] = { enabled: false, count: 0 }
                            })
                            setExamMixConfigs(next)
                          }}
                          className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                        >
                          Bỏ chọn hết
                        </button>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {activeCollectionExams.map((ex, idx) => {
                        const cfg = examMixConfigs[ex.id] || { enabled: false, count: 0 }
                        const available = getSingleExamAvailableCount(ex)
                        const bd = getExamQuestionsBreakdown([ex])

                        return (
                          <div
                            key={ex.id}
                            className={`p-2.5 rounded-xl border transition ${
                              cfg.enabled
                                ? 'border-indigo-500/40 bg-white dark:bg-slate-800 shadow-2xs'
                                : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={cfg.enabled}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setExamMixConfigs((prev) => ({
                                    ...prev,
                                    [ex.id]: {
                                      enabled: checked,
                                      count: checked ? (prev[ex.id]?.count > 0 ? prev[ex.id].count : available) : 0,
                                    },
                                  }))
                                }}
                                className="mt-1 h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    Đề số {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {ex.title}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  Khả dụng: <span className="font-bold text-slate-700 dark:text-slate-300">{available} câu</span>
                                  {' '}({bd.choiceCount} TN · {bd.tfCount} Đ/S · {bd.saCount} TLN) · {ex.duration || 50} phút
                                </div>
                              </div>

                              {cfg.enabled && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] text-slate-500">Lấy:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={available}
                                    value={cfg.count}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(available, parseInt(e.target.value) || 0))
                                      setExamMixConfigs((prev) => ({
                                        ...prev,
                                        [ex.id]: { enabled: true, count: val },
                                      }))
                                    }}
                                    className="w-14 h-8 rounded-lg border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-1.5 text-center text-xs font-mono font-bold outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[11px] text-slate-500">câu</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold border-t border-black/5 dark:border-white/5">
                      <span>Đã chọn: {detailedSelectedExams.length} / {activeCollectionExams.length} đề thi</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                        Tổng số câu lấy: {detailedTotalQuestionsCount} câu
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PHẦN 2: TUỲ CHỌN SỐ CÂU HỎI ĐỂ TRỘN */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    2. Số câu hỏi cần trộn:
                  </label>
                  <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {showDetailedMix ? detailedTotalQuestionsCount : mixQuestionCount} câu (Tối đa: {currentMaxAvailableQuestions} câu)
                  </span>
                </div>

                {showDetailedMix ? (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                    Số câu hỏi đang được tính theo tùy chọn chi tiết từng đề ở trên ({detailedTotalQuestionsCount} câu từ {detailedSelectedExams.length} đề thi được chọn).
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max={Math.max(1, currentMaxAvailableQuestions)}
                        value={Math.min(mixQuestionCount, Math.max(1, currentMaxAvailableQuestions))}
                        onChange={(e) => setMixQuestionCount(Number(e.target.value))}
                        disabled={currentMaxAvailableQuestions === 0}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, currentMaxAvailableQuestions)}
                        value={mixQuestionCount}
                        onChange={(e) => setMixQuestionCount(Number(e.target.value))}
                        disabled={currentMaxAvailableQuestions === 0}
                        className="w-20 h-9 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-2 text-center text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tối đa là tổng số câu hỏi các đề có ở từng phần cộng dồn lại (đã trừ bớt nếu bỏ chọn phần tương ứng).
                    </p>
                  </>
                )}
              </div>

              {/* PHẦN 3: TUỲ CHỌN THỜI GIAN LÀM BÀI */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    3. Thời gian làm bài thi (phút):
                  </label>
                  <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                    {mixDuration} phút (Tối đa: {effectiveMaxDuration} phút)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max={effectiveMaxDuration}
                    value={Math.min(mixDuration, effectiveMaxDuration)}
                    onChange={(e) => setMixDuration(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="5"
                    max={effectiveMaxDuration}
                    value={Math.min(mixDuration, effectiveMaxDuration)}
                    onChange={(e) => setMixDuration(Number(e.target.value))}
                    className="w-20 h-9 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-2 text-center text-xs font-mono font-bold outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Tối đa cho phép: Tổng thời gian các đề {showDetailedMix ? 'được chọn' : ''} cộng lại ({showDetailedMix ? detailedSumDuration : activeCollectionSumDuration} phút) + 30 phút ={' '}
                  {effectiveMaxDuration} phút.
                </p>
              </div>

              {/* PHẦN 4: TIÊU ĐỀ ĐỀ TRỘN */}
              <div className="space-y-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Đặt tên cho đề thi trộn (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder={`[Trộn đề] Tuyển tập ${activeCollection.subject}`}
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              {mixError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {mixError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMixModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    mixLoading ||
                    (!showDetailedMix && currentMaxAvailableQuestions === 0) ||
                    (showDetailedMix && detailedTotalQuestionsCount === 0)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {mixLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang trộn đề...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" /> Bắt đầu làm bài thi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC FILE PDF */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="max-w-4xl w-full h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm truncate pr-2 text-slate-900 dark:text-white">
                {previewPdfTitle}
              </h3>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold hover:bg-black/10 transition"
              >
                Đóng
              </button>
            </div>
            <iframe src={previewPdfUrl} className="flex-1 w-full border-none" />
          </div>
        </div>
      )}
    </main>
  )
}

export default function NewExamsAndHistorySubmissionsPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          title="SenExam Khảo Thí & Lịch Sử Bài Nộp"
          subtitle="Đang tải dữ liệu bài thi..."
        />
      }
    >
      <UnifiedHubContent />
    </Suspense>
  )
}
