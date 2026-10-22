'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newexams-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newexams-body' })

type ExamItem = {
  id: string
  title: string
  exam_type: string
  subject?: string | null
  subjects?: string[] | string | null
  folder_id?: string | null
  duration: number
  pdf_url?: string | null
  drive_file_id?: string | null
  solution_pdf_url?: string | null
  created_at: string
  is_hidden?: boolean
  access_code?: string | null
  is_vip?: boolean | null
  require_seb?: boolean | null
  created_by?: string | null
  format?: string | null
  exam_structure?: any
}

interface SebChildFolder {
  id: string
  name: string
  parent_id: string
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

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

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

export default function NewExamsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [exams, setExams] = useState<ExamItem[]>([])
  const [userSubmissions, setUserSubmissions] = useState<{ exam_id: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Cây Thư Mục Mẹ - Con theo kiến trúc SEB
  const [folders, setFolders] = useState<SebParentFolder[]>([])
  const [folderSearch, setFolderSearch] = useState('')
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({})
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [selectedFolderObj, setSelectedFolderObj] = useState<SebChildFolder | null>(null)
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false)

  // Tuyển tập đề (Collections)
  const [collections, setCollections] = useState<ExamCollection[]>([])
  const [activeCollection, setActiveCollection] = useState<ExamCollection | null>(null)

  // Modal đóng gói tuyển tập (Admin only)
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
  // Tùy chọn chi tiết từng đề khi trộn
  const [showDetailedMix, setShowDetailedMix] = useState(false)
  const [examMixConfigs, setExamMixConfigs] = useState<Record<string, { enabled: boolean; count: number }>>({})

  // Nhập mã truy cập đề riêng tư
  const [accessCode, setAccessCode] = useState('')
  const [accessCodeError, setAccessCodeError] = useState('')
  const [accessCodeLoading, setAccessCodeLoading] = useState(false)

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  const deferredQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const initData = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
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
          .select('role, email')
          .eq('id', user.id)
          .maybeSingle()

        const metaRole = (user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase().trim()
        const adminCheck =
          profile?.role === 'admin' ||
          profile?.role === 'collab' ||
          metaRole === 'admin' ||
          metaRole === 'collab' ||
          user.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com'
        setIsAdmin(adminCheck)

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
          const cRes = await fetch('/api/exam-collections')
          const cData = await cRes.json()
          if (cData?.collections) {
            setCollections(cData.collections)
          }
        } catch (cErr) {
          console.warn('Lỗi tải danh sách tuyển tập đề:', cErr)
        }

        // 3. Lấy danh sách toàn bộ đề thi từ hệ thống
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false })

        // 4. Lấy số lượt thi của user
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('exam_id')
          .eq('user_id', user.id)

        if (examsError) {
          console.error('Error fetching exams:', examsError)
        } else {
          // Lọc hiển thị đề:
          // - Đề do chính học sinh/người dùng tạo ra (created_by === user.id) thì luôn thấy
          // - Không bị đặt cờ ẩn (is_hidden !== true)
          // - Không phải đề riêng của lớp (không có mã 12 số định danh lớp)
          const visibleExams = (examsData || []).filter((ex: any) => {
            if (ex.created_by && ex.created_by === user.id) return true
            if (ex.is_hidden === true) return false
            const code = String(ex.exam_code || ex.access_code || '')
            const is12DigitClassExam = code.length === 12 && /^\d{12}$/.test(code)
            if (is12DigitClassExam) return false
            return true
          })
          setExams(visibleExams)
        }

        setUserSubmissions(submissionsData || [])
      } catch (e) {
        console.error('Lỗi khởi tạo new-exams:', e)
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

  // Tập hợp các ID đề thi đã được gộp vào tuyển tập
  const bundledExamIds = useMemo(() => {
    const ids = new Set<string>()
    collections.forEach((col) => {
      ;(col.exam_ids || []).forEach((id) => ids.add(id))
    })
    return ids
  }, [collections])

  // Đóng/mở Folder Mẹ
  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  // Chọn Thư mục Con (Môn thi)
  const handleSelectChild = (child: SebChildFolder) => {
    setActiveCollection(null)
    if (selectedChildId === child.id) {
      setSelectedChildId('')
      setSelectedFolderObj(null)
    } else {
      setSelectedChildId(child.id)
      setSelectedFolderObj(child)
    }
    setMobileFolderOpen(false)
  }

  // Chọn Xem Tất Cả Đề Thi
  const handleSelectAllExams = () => {
    setActiveCollection(null)
    setSelectedChildId('')
    setSelectedFolderObj(null)
    setMobileFolderOpen(false)
  }

  // Mở đề thi bằng mã bí mật (Private Exam)
  const handleUnlockPrivateExam = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setAccessCodeError('Không tìm thấy đề thi với mã này.')
    } finally {
      setAccessCodeLoading(false)
    }
  }

  // Đếm số lần user đã làm đề này
  const getAttemptCount = (examId: string) => {
    return userSubmissions.filter((s) => s.exam_id === examId).length
  }

  // Tính số lượng đề thi thời gian thực cho từng thư mục con
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

  // Lọc danh sách đề thi gốc ngoài cùng (loại bỏ những đề đã được đóng gói vào tuyển tập)
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // Đề đã gộp vào bất kỳ tuyển tập nào sẽ không hiển thị ở ngoài cùng trang khảo thí mới
      if (bundledExamIds.has(exam.id)) return false

      const query = deferredQuery.toLowerCase().trim()
      const matchSearch =
        !query ||
        exam.title.toLowerCase().includes(query) ||
        (exam.exam_type && exam.exam_type.toLowerCase().includes(query)) ||
        (exam.subject && exam.subject.toLowerCase().includes(query))

      const matchType = selectedType === 'Tất cả' || exam.exam_type === selectedType

      if (!matchSearch || !matchType) return false

      // Lọc theo thư mục con nếu đang chọn
      if (selectedChildId && selectedFolderObj) {
        return isExamInFolder(exam, selectedFolderObj)
      }

      return true
    })
  }, [exams, deferredQuery, selectedType, selectedChildId, selectedFolderObj, bundledExamIds])

  // Lọc tuyển tập đề hiển thị ở ngoài cùng
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

  // Thời gian tối đa được chọn khi trộn đề = Tổng thời gian các đề cộng lại + 30 phút
  const activeCollectionMaxDuration = useMemo(() => {
    return activeCollectionSumDuration + 30
  }, [activeCollectionSumDuration])

  // Tính số lượng câu hỏi tối đa hiện tại của đề trộn theo các checkbox được tick
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
      setPackagingError('Vui lòng chọn ít nhất 1 đề thi để gộp vào tuyển tập này.')
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
          title: packagingTitle.trim() || `Tuyển tập đề ${packagingSubject.trim()}`,
          description: packagingDesc.trim(),
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

    // Khởi tạo cấu hình mặc định cho từng đề trong tuyển tập
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

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        title="SenExam Ngân Hàng Đề Thi"
        subtitle="Đang đồng bộ kho đề thi KaTeX & tuyển tập đề..."
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
                style={{ fontFamily: 'var(--font-newexams-heading)' }}
              >
                Kho Đề Thi & Khảo Thí
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Quản lý tuyển tập đề theo môn, tổ chức theo khối thi và luyện thi thông minh.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Đóng Gói Tuyển Tập Đề - Chỉ Admin Mới Thấy (chỉ logo) */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenCreatePackageModal}
                title="Đóng gói tuyển tập đề (Admin)"
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition hover:scale-105 cursor-pointer"
              >
                <Package className="h-5 w-5" />
              </button>
            )}

            {/* Nút bật/tắt Drawer trên Mobile */}
            <button
              type="button"
              onClick={() => setMobileFolderOpen(!mobileFolderOpen)}
              className="md:hidden flex h-10 px-3.5 items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-xs font-bold shadow-sm transition hover:scale-105"
            >
              <Filter className="h-4 w-4 text-indigo-500" />
              <span>{selectedFolderObj ? selectedFolderObj.name : 'Danh mục môn'}</span>
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
              title="Chuyển chế độ Sáng / Tối"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            <Link
              href="/new-history"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold shadow-sm transition hover:bg-black/5"
            >
              <History className="h-4 w-4 text-teal-500" />
              <span className="hidden sm:inline">Lịch sử thi</span>
            </Link>

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

        {/* BỐ CỤC 2 CỘT (CỘT TRÁI: CÂY THƯ MỤC / CỘT PHẢI: KHO ĐỀ & TUYỂN TẬP) */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] gap-6 items-start">
          {/* CỘT TRÁI: SIDEBAR CÂY THƯ MỤC MẸ - CON */}
          <aside
            className={`space-y-4 md:block ${
              mobileFolderOpen
                ? 'fixed inset-x-4 top-20 z-40 max-h-[80vh] overflow-y-auto rounded-3xl border border-black/10 bg-white/95 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95'
                : 'hidden'
            }`}
          >
            {/* Header Thư Mục */}
            <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  <span>Danh Mục Môn & Khối</span>
                </div>
                {mobileFolderOpen && (
                  <button
                    type="button"
                    onClick={() => setMobileFolderOpen(false)}
                    className="md:hidden text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Ô tìm kiếm nhanh thư mục môn */}
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

            {/* Bảng Nút Đóng Gói Tuyển Tập Đề (Chỉ Admin Thấy) */}
            {isAdmin && (
              <div className="rounded-[24px] border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent p-4 shadow-sm backdrop-blur-xl text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-indigo-700 dark:text-indigo-300">
                    <Package className="h-4 w-4 text-indigo-500" />
                    <span>Quản Trị Tuyển Tập Đề</span>
                  </div>
                  <span className="rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[9px] font-black uppercase">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Đóng gói các đề thi liên quan theo môn và cấu hình trộn đề tự động cho thí sinh.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreatePackageModal}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Đóng gói tuyển tập đề
                </button>
              </div>
            )}
          </aside>

          {/* CỘT PHẢI: CHI TIẾT TUYỂN TẬP HOẶC DANH SÁCH GỐC */}
          <div className="space-y-5">
            {/* VIEW 1: CHI TIẾT TUYỂN TẬP ĐỀ (KHI BẤM VÀO 1 TUYỂN TẬP) */}
            {activeCollection ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header Tuyển Tập Đề */}
                <div className="rounded-[28px] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-white/90 dark:to-slate-900/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveCollection(null)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Quay lại kho đề thi
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3 py-0.5 text-xs font-black uppercase">
                        Tuyển tập đề • {activeCollection.subject}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPackageModal(activeCollection)}
                            className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-1.5 transition"
                            title="Chỉnh sửa tuyển tập"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCollection(activeCollection.id)}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 p-1.5 transition"
                            title="Giải tán tuyển tập"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h2
                      className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white"
                      style={{ fontFamily: 'var(--font-newexams-heading)' }}
                    >
                      {activeCollection.title}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      {activeCollection.description ||
                        `Tổng hợp các đề thi chất lượng cao môn ${activeCollection.subject}.`}
                    </p>
                  </div>

                  {/* Thống kê câu hỏi & thời gian */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
                    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-center">
                      <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {activeCollectionExams.length}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Đề thành phần</div>
                    </div>
                    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-center">
                      <div className="text-lg font-black text-teal-600 dark:text-teal-400 font-mono">
                        {activeCollectionBreakdown.choiceCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Trắc nghiệm</div>
                    </div>
                    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-center">
                      <div className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                        {activeCollectionBreakdown.tfCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Đúng / Sai</div>
                    </div>
                    <div className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-center">
                      <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                        {activeCollectionBreakdown.saCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Trả lời ngắn</div>
                    </div>
                  </div>

                  {/* Nút hành động chính: TRỘN ĐỀ THI */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>
                        Hệ thống hỗ trợ trộn câu hỏi ngẫu nhiên từ toàn bộ các đề trong tuyển tập theo đúng cấu trúc mong
                        muốn.
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenMixModal}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 transition transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                    >
                      <Shuffle className="h-4 w-4" />
                      <span>Trộn đề / Đảo đề ôn luyện</span>
                    </button>
                  </div>
                </div>

                {/* Danh Sách Đề Số 1, 2, 3, 4... Trong Tuyển Tập */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-indigo-500" />
                      <span>Danh sách đề thi thành phần ({activeCollectionExams.length} đề)</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Nhấn vào từng đề để làm bài trực tiếp hoặc dùng nút Trộn đề
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                    {activeCollectionExams.map((exam, index) => {
                      const examNumber = index + 1
                      const attemptCount = getAttemptCount(exam.id)

                      return (
                        <div
                          key={exam.id}
                          className="group relative overflow-hidden rounded-[24px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                        >
                          <div>
                            {/* Header đề số */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-xl bg-indigo-600 text-white px-3 py-1 text-xs font-black tracking-wide">
                                Đề số {examNumber}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                  {exam.exam_type || 'Đề thi'}
                                </span>
                                {attemptCount > 0 && (
                                  <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                                    Đã làm {attemptCount} lần
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title */}
                            <h4
                              className="mt-2.5 text-base font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2"
                              style={{ fontFamily: 'var(--font-newexams-heading)' }}
                            >
                              {exam.title}
                            </h4>

                            {/* Meta Info */}
                            <div className="mt-2 flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                              <span className="flex items-center gap-1 font-semibold">
                                <Clock className="h-3.5 w-3.5 text-amber-500" /> {exam.duration || 50} phút
                              </span>
                              {exam.subject && (
                                <span className="flex items-center gap-1 font-semibold">
                                  <BookOpen className="h-3.5 w-3.5 text-teal-500" /> {exam.subject}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action */}
                          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                            {exam.pdf_url && typeof exam.pdf_url === 'string' && exam.pdf_url.trim().length > 10 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewPdfUrl(exam.pdf_url!)
                                  setPreviewPdfTitle(exam.title)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-xs font-bold transition hover:bg-black/10 cursor-pointer"
                              >
                                <FileText className="h-3 w-3 text-rose-500" /> Xem đề
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">KaTeX Online</span>
                            )}

                            <Link
                              href={exam.require_seb ? `/seb-exam/${exam.id}` : `/new-exams/${exam.id}`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition hover:opacity-90 active:scale-95"
                            >
                              <Play className="h-3 w-3" /> Làm bài
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* VIEW 2: KHO ĐỀ THI CHÍNH (TUYỂN TẬP ĐỀ + CÁC ĐỀ KHẢ DỤNG) */
              <>
                {/* Banner Thông Tin Thư Mục Đang Chọn */}
                <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {selectedFolderObj ? 'Môn Thi Đã Chọn' : 'Toàn Bộ Hệ Thống'}
                      </span>
                      {selectedFolderObj && (
                        <button
                          type="button"
                          onClick={handleSelectAllExams}
                          className="text-[11px] text-rose-500 hover:underline font-bold"
                        >
                          Bỏ chọn bộ lọc môn
                        </button>
                      )}
                    </div>
                    <h2
                      className="text-xl sm:text-2xl font-black"
                      style={{ fontFamily: 'var(--font-newexams-heading)' }}
                    >
                      {selectedFolderObj ? selectedFolderObj.name : 'Tất Cả Đề Thi Trong Kho'}
                    </h2>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400">
                      {selectedFolderObj?.description ||
                        'Tổng hợp các bộ đề thi thử và tuyển tập đề bám sát cấu trúc đề thi chính thức.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {filteredCollections.length > 0 && (
                      <div className="text-right">
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                          {filteredCollections.length}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Tuyển Tập
                        </div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {filteredExams.length}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Đề Độc Lập
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thanh Tìm Kiếm, Phân Loại & Mã Riêng Tư */}
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  {/* Tìm Kiếm & Tabs Kỳ Thi */}
                  <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
                    <div className="relative w-full">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                      <input
                        type="text"
                        placeholder="Tìm tên đề thi, mã đề, môn học, tuyển tập..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500"
                      />
                    </div>

                    {/* Exam Type Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
                      {EXAM_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedType(type)}
                          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedType === type
                              ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                              : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nhập mã đề thi riêng tư */}
                  <form
                    onSubmit={handleUnlockPrivateExam}
                    className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                        <KeyRound className="h-4 w-4" /> Đề Thi Có Mã Bảo Mật
                      </div>
                      <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1">
                        Nhập mã bảo mật để vào thẳng đề thi được cấp riêng.
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="MÃ ĐỀ (VD: THPT2026)"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                        className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-3 text-xs font-black uppercase tracking-wider outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={accessCodeLoading || !accessCode.trim()}
                        className="h-9 rounded-xl bg-amber-500 text-slate-950 px-3 text-xs font-bold transition hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {accessCodeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mở đề'}
                      </button>
                    </div>
                    {accessCodeError && (
                      <p className="mt-1 text-[10px] font-bold text-rose-500">{accessCodeError}</p>
                    )}
                  </form>
                </div>

                {/* PHẦN 1: DANH SÁCH CÁC BỘ TUYỂN TẬP ĐỀ (NẾU CÓ) */}
                {filteredCollections.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Tuyển tập đề thi môn ({filteredCollections.length} bộ)
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Bao gồm các đề đã đóng gói và hỗ trợ tính năng trộn đề
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
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
                                className="mt-3 text-lg font-black leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition line-clamp-2"
                                style={{ fontFamily: 'var(--font-newexams-heading)' }}
                              >
                                {col.title}
                              </h3>

                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                {col.description || `Tổng hợp toàn bộ các đề thi môn ${col.subject}.`}
                              </p>

                              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {breakdown.total} câu hỏi
                                </span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Shuffle className="h-3.5 w-3.5 text-indigo-500" /> Hỗ trợ đảo đề
                                </span>
                              </div>
                            </div>

                            <div className="mt-5 pt-3.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPackageModal(col)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-black/5 dark:hover:bg-white/5 transition"
                                    title="Sửa tuyển tập"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCollection(col.id)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-black/5 dark:hover:bg-white/5 transition"
                                    title="Giải tán tuyển tập"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => setActiveCollection(col)}
                                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                <ListOrdered className="h-3.5 w-3.5" /> Mở tuyển tập đề
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* PHẦN 2: DANH SÁCH ĐỀ THI ĐỘC LẬP */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-500" />
                      <span>Đề thi khả dụng ({filteredExams.length} đề)</span>
                    </h3>
                  </div>

                  {filteredExams.length === 0 && filteredCollections.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-12 text-center space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <BookOpen className="h-7 w-7" />
                      </div>
                      <h3 className="text-lg font-bold">Không tìm thấy đề thi phù hợp</h3>
                      <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                        Hãy thử chọn môn thi khác trong cây thư mục hoặc tìm kiếm với từ khóa khác.
                      </p>
                      {selectedFolderObj && (
                        <button
                          type="button"
                          onClick={handleSelectAllExams}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700 transition"
                        >
                          Xem tất cả đề thi
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                      {filteredExams.map((exam) => {
                        const attemptCount = getAttemptCount(exam.id)
                        const isVip = exam.is_vip

                        return (
                          <div
                            key={exam.id}
                            className="group relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                          >
                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400" />

                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                  {exam.exam_type || 'Đề thi'}
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {exam.created_by && exam.created_by === currentUserId && (
                                    <span className="flex items-center gap-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[10px] font-black uppercase shadow-2xs">
                                      🎯 Của bạn
                                    </span>
                                  )}
                                  {(() => {
                                    let struct = exam.exam_structure
                                    if (typeof struct === 'string') {
                                      try {
                                        struct = JSON.parse(struct)
                                      } catch {
                                        struct = []
                                      }
                                    }
                                    if (
                                      struct &&
                                      typeof struct === 'object' &&
                                      !Array.isArray(struct) &&
                                      Array.isArray(struct.sections)
                                    ) {
                                      struct = struct.sections
                                    }
                                    const hasQuestionsInStructure =
                                      Array.isArray(struct) &&
                                      struct.some(
                                        (s: any) =>
                                          (Array.isArray(s?.questions) && s.questions.length > 0) ||
                                          s?.format === 'katex' ||
                                          s?.is_katex === true ||
                                          s?.id === 'sec-katex-main'
                                      )
                                    const isValidDriveId =
                                      typeof exam.drive_file_id === 'string' &&
                                      exam.drive_file_id.trim().length > 10 &&
                                      !exam.drive_file_id.includes('null')
                                    const isValidPdfUrl =
                                      typeof exam.pdf_url === 'string' &&
                                      exam.pdf_url.trim().length > 10 &&
                                      !exam.pdf_url.includes('null')
                                    const isKatex =
                                      exam.format === 'katex' ||
                                      hasQuestionsInStructure ||
                                      (!isValidDriveId && !isValidPdfUrl)

                                    if (isKatex) {
                                      return (
                                        <span className="flex items-center gap-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-2 py-0.5 text-[10px] font-bold">
                                          ✨ KaTeX
                                        </span>
                                      )
                                    }
                                    return (
                                      <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold">
                                        📄 Đề PDF
                                      </span>
                                    )
                                  })()}
                                  {exam.require_seb && (
                                    <span className="flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[10px] font-black uppercase shadow-2xs">
                                      🛡️ SEB
                                    </span>
                                  )}
                                  {isVip && (
                                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase">
                                      <Crown className="h-3 w-3" /> VIP
                                    </span>
                                  )}
                                  {attemptCount > 0 && (
                                    <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                                      Đã làm {attemptCount} lần
                                    </span>
                                  )}
                                </div>
                              </div>

                              <h3
                                className="mt-3 text-lg font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2"
                                style={{ fontFamily: 'var(--font-newexams-heading)' }}
                              >
                                {exam.title}
                              </h3>

                              <div className="mt-3 flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="h-3.5 w-3.5 text-amber-500" /> {exam.duration || 50} phút
                                </span>
                                {exam.subject && (
                                  <span className="flex items-center gap-1 font-semibold">
                                    <BookOpen className="h-3.5 w-3.5 text-teal-500" /> {exam.subject}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 pt-3.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                              {exam.pdf_url && typeof exam.pdf_url === 'string' && exam.pdf_url.trim().length > 10 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewPdfUrl(exam.pdf_url!)
                                    setPreviewPdfTitle(exam.title)
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10 cursor-pointer"
                                  title="Xem trước file PDF"
                                >
                                  <FileText className="h-3.5 w-3.5 text-rose-500" /> Xem đề PDF
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#6B7280] dark:text-slate-400 font-semibold">
                                  Đề thi trực tuyến KaTeX
                                </span>
                              )}

                              <Link
                                href={exam.require_seb ? `/seb-exam/${exam.id}` : `/new-exams/${exam.id}`}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:opacity-90 active:scale-95 ${
                                  exam.require_seb
                                    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                                    : 'bg-[#111827] dark:bg-white text-white dark:text-slate-900'
                                }`}
                              >
                                <Rocket className="h-3.5 w-3.5" /> Vào thi
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
                    style={{ fontFamily: 'var(--font-newexams-heading)' }}
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
                  {/* Trắc nghiệm */}
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

                  {/* Đúng / Sai */}
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

                  {/* Trả lời ngắn */}
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

                {/* BẢNG TÙY CHỌN TỪNG ĐỀ (HIỆN KHI BẤM CHI TIẾT) */}
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

                              {/* Input số câu lấy từ đề này */}
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

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMixModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
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

      {/* MODAL ĐÓNG GÓI TUYỂN TẬP ĐỀ (DÀNH CHO ADMIN) */}
      {showAdminPackageModal && (
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
                    style={{ fontFamily: 'var(--font-newexams-heading)' }}
                  >
                    {packagingEditingId ? 'Chỉnh Sửa Tuyển Tập Đề' : 'Đóng Gói Tuyển Tập Đề Theo Môn'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gộp các đề thi liên quan lại với nhau để hiển thị theo danh sách Đề số 1, 2, 3...
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
              {/* Tên môn */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Tên Môn Học <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Toán học, Vật lí, Hóa học, Tiếng Anh..."
                  value={packagingSubject}
                  onChange={(e) => {
                    setPackagingSubject(e.target.value)
                    if (!packagingTitle || packagingTitle.startsWith('Tuyển tập đề')) {
                      setPackagingTitle(`Tuyển tập đề ${e.target.value}`)
                    }
                  }}
                  required
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold outline-none focus:border-indigo-500"
                />

                {/* Quick Subject Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {['Toán học', 'Vật lí', 'Hóa học', 'Sinh học', 'Tiếng Anh', 'Lịch sử', 'Địa lí', 'Tin học'].map(
                    (sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setPackagingSubject(sub)
                          setPackagingTitle(`Tuyển tập đề ${sub}`)
                        }}
                        className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-600 transition"
                      >
                        {sub}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tiêu đề tuyển tập */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tiêu đề tuyển tập đề:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tuyển tập đề Toán học luyện thi THPTQG 2026"
                  value={packagingTitle}
                  onChange={(e) => setPackagingTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mô tả tuyển tập */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mô tả ngắn (tùy chọn):</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả cấu trúc hoặc thông tin trọng tâm của tuyển tập này..."
                  value={packagingDesc}
                  onChange={(e) => setPackagingDesc(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 p-3 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              {/* Chọn các đề thi gộp vào */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Chọn các đề thi gộp vào tuyển tập:
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    Đã chọn {packagingSelectedExamIds.length} đề thi
                  </span>
                </div>

                {/* Tìm kiếm đề thi trong modal */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc tìm đề thi theo tên hoặc môn..."
                    value={packagingExamSearch}
                    onChange={(e) => setPackagingExamSearch(e.target.value)}
                    className="h-8 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-8 pr-3 text-xs outline-none"
                  />
                </div>

                {/* Danh sách đề thi */}
                <div className="max-h-60 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 p-1 bg-black/2 dark:bg-white/2">
                  {exams
                    .filter((ex) => {
                      if (!packagingExamSearch.trim()) return true
                      const q = packagingExamSearch.toLowerCase().trim()
                      return (
                        ex.title.toLowerCase().includes(q) ||
                        (ex.subject && ex.subject.toLowerCase().includes(q)) ||
                        (ex.exam_type && ex.exam_type.toLowerCase().includes(q))
                      )
                    })
                    .map((ex) => {
                      const isChecked = packagingSelectedExamIds.includes(ex.id)
                      const otherCol = collections.find(
                        (c) => c.id !== packagingEditingId && (c.exam_ids || []).includes(ex.id)
                      )

                      return (
                        <label
                          key={ex.id}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPackagingSelectedExamIds((prev) => [...prev, ex.id])
                                } else {
                                  setPackagingSelectedExamIds((prev) => prev.filter((id) => id !== ex.id))
                                }
                              }}
                              className="h-4 w-4 rounded accent-indigo-600 shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{ex.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>{ex.exam_type || 'Đề thi'}</span>
                                <span>•</span>
                                <span>{ex.duration || 50} phút</span>
                                {ex.subject && (
                                  <>
                                    <span>•</span>
                                    <span>{ex.subject}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {otherCol && (
                            <span className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              Đang trong: {otherCol.subject}
                            </span>
                          )}
                        </label>
                      )
                    })}
                </div>
              </div>

              {packagingError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {packagingError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminPackageModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
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
                    <>
                      <Package className="h-4 w-4" /> {packagingEditingId ? 'Cập nhật' : 'Đóng gói tuyển tập'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[85vh] rounded-[30px] border border-white/20 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/80">
              <div className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm truncate max-w-md">{previewPdfTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-bold transition hover:bg-amber-400"
                >
                  <Download className="h-3.5 w-3.5" /> Mở trong tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPdfUrl(null)}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Modal Body: PDF Iframe */}
            <div className="flex-1 w-full bg-slate-950">
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
