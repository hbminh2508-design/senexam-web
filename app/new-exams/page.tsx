'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { isExamInFolder, SebFolderLike } from '@/lib/sebFolderUtils'
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

export default function NewExamsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
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

        // 2. Lấy danh sách toàn bộ đề thi từ hệ thống
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false })

        // 3. Lấy số lượt thi của user
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('exam_id')
          .eq('user_id', user.id)

        if (examsError) {
          console.error('Error fetching exams:', examsError)
        } else {
          // Lọc hiển thị đề:
          // - Đề do chính học sinh/người dùng tạo ra (created_by === user.id) thì luôn thấy (Chế độ ngầm)
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

  // Đóng/mở Folder Mẹ
  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  // Chọn Thư mục Con (Môn thi)
  const handleSelectChild = (child: SebChildFolder) => {
    if (selectedChildId === child.id) {
      // Toggle unselect
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
      .filter((p): p is SebParentFolder => p !== null)
  }, [folders, folderSearch])

  // Tự động mở rộng các thư mục mẹ có kết quả tìm kiếm khớp
  useEffect(() => {
    if (folderSearch.trim()) {
      const exp: Record<string, boolean> = {}
      filteredFolders.forEach((p) => {
        exp[p.id] = true
      })
      setExpandedParents((prev) => ({ ...prev, ...exp }))
    }
  }, [folderSearch, filteredFolders])

  // Lọc danh sách đề thi theo thư mục & từ khóa & phân loại
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
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
  }, [exams, deferredQuery, selectedType, selectedChildId, selectedFolderObj])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        title="SenExam Ngân Hàng Đề Thi"
        subtitle="Đang đồng bộ kho đề thi KaTeX & cây thư mục phân loại..."
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
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Sparkles className="inline h-3 w-3 mr-1" /> Ngân Hàng Đề Chuẩn 2026
                </span>
                <span className="hidden sm:inline-block rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Cấu trúc Cây Thư Mục SEB
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
                Kho Đề Thi & Khảo Thí
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Quản lý và tổ chức khoa học theo khối thi, kỳ thi và môn học cụ thể.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* ========================================================================= */}
        {/* BỐ CỤC 2 CỘT HIỆN ĐẠI THEO SEB (CỘT TRÁI: CÂY THƯ MỤC / CỘT PHẢI: KHO ĐỀ) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] gap-6 items-start">
          
          {/* ======================================================================= */}
          {/* CỘT TRÁI: SIDEBAR CÂY THƯ MỤC MẸ - CON                                  */}
          {/* ======================================================================= */}
          <aside
            className={`
              ${mobileFolderOpen ? 'fixed inset-x-4 top-20 z-40 max-h-[80vh] shadow-2xl overflow-y-auto' : 'hidden'}
              md:block md:static md:z-auto md:max-h-none md:shadow-none
              space-y-4
            `}
          >
            {/* Card Cây Thư Mục Mẹ & Con */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur-xl flex flex-col">
              
              {/* Header Thư Mục */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/5 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Cây Thư Mục Khảo Thí
                  </span>
                </div>
                {mobileFolderOpen && (
                  <button
                    type="button"
                    onClick={() => setMobileFolderOpen(false)}
                    className="md:hidden p-1 rounded-lg hover:bg-black/5 text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <span className="hidden md:inline-block text-[11px] font-bold text-slate-400">
                  {folders.reduce((acc, p) => acc + (p.children?.length || 0), 0)} Môn
                </span>
              </div>

              {/* Ô tìm kiếm nhanh Thư mục / Môn thi */}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm môn thi, khối thi..."
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  className="h-8.5 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] pl-8.5 pr-7 text-xs font-semibold outline-none transition focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
                {folderSearch && (
                  <button
                    type="button"
                    onClick={() => setFolderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Nút Xem Tất Cả Đề Thi */}
              <button
                type="button"
                onClick={handleSelectAllExams}
                className={`w-full flex items-center justify-between p-3 mb-2 rounded-2xl border transition text-left text-xs font-black cursor-pointer ${
                  !selectedChildId
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 border-transparent'
                    : 'bg-white/60 dark:bg-slate-800/60 hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 border-black/5 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="truncate">Tất Cả Đề Thi Hệ Thống</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    !selectedChildId
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {exams.length}
                </span>
              </button>

              {/* Danh sách Thư Mục Mẹ và Thư Mục Con */}
              <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
                {filteredFolders.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    {folderSearch ? 'Không tìm thấy thư mục nào phù hợp' : 'Đang tải danh mục môn thi...'}
                  </div>
                ) : (
                  filteredFolders.map((parent) => {
                    const isExpanded = Boolean(expandedParents[parent.id])
                    const hasChildren = parent.children && parent.children.length > 0

                    return (
                      <div
                        key={parent.id}
                        className="rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]"
                      >
                        {/* Thư Mục Mẹ (Parent Folder) */}
                        <button
                          type="button"
                          onClick={() => toggleParent(parent.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 transition text-left text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <FolderOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                            ) : (
                              <Folder className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{parent.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400 bg-white/70 dark:bg-slate-800/70 px-1.5 py-0.5 rounded-md border border-black/5 dark:border-white/10 font-mono">
                              {parent.children?.length || 0}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Thư Mục Con (Child Folders) */}
                        {isExpanded && hasChildren && (
                          <div className="p-1.5 bg-white/80 dark:bg-slate-900/80 space-y-1 border-t border-black/5 dark:border-white/5">
                            {parent.children.map((child) => {
                              const isSelected = selectedChildId === child.id
                              const realCount = folderExamCounts[child.id] || 0

                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSelectChild(child)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-black shadow-sm shadow-indigo-500/20'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`h-2 w-2 rounded-full ${
                                        isSelected ? 'bg-white' : 'bg-indigo-400'
                                      }`}
                                    />
                                    <span className="truncate">{child.name}</span>
                                  </div>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                                      isSelected
                                        ? 'bg-white/20 text-white font-bold'
                                        : 'bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {realCount}
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
            </div>

            {/* Hộp Thông Tin Trợ Giúp */}
            <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-4 shadow-sm backdrop-blur-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Award className="h-4 w-4 text-amber-500" />
                <span>Cấu trúc Đề Chuẩn KaTeX</span>
              </div>
              <p className="text-[11px] text-[#6B7280] dark:text-slate-400 leading-relaxed">
                Các đề thi hiển thị công thức toán học, lí, hóa chuẩn LaTeX với phản hồi tức thì và bảng điểm chi tiết.
              </p>
            </div>
          </aside>

          {/* ======================================================================= */}
          {/* CỘT PHẢI: BANNER THƯ MỤC ĐANG CHỌN, TÌM KIẾM & DANH SÁCH ĐỀ THI        */}
          {/* ======================================================================= */}
          <div className="space-y-5">
            
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
                <h2 className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
                  {selectedFolderObj ? selectedFolderObj.name : 'Tất Cả Đề Thi Trong Kho'}
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  {selectedFolderObj?.description ||
                    'Tổng hợp tất cả các bộ đề thi thử bám sát ma trận đề thi chính thức.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {filteredExams.length}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đề Khả Dụng</div>
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
                    placeholder="Tìm tên đề thi, mã đề, môn học..."
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

            {/* Grid Danh Sách Đề Thi */}
            {filteredExams.length === 0 ? (
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
                      {/* Top gradient stripe */}
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400" />

                      <div>
                        {/* Badge header */}
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
                                try { struct = JSON.parse(struct) } catch { struct = [] }
                              }
                              if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray(struct.sections)) {
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
                              const isValidDriveId = typeof exam.drive_file_id === 'string' && exam.drive_file_id.trim().length > 10 && !exam.drive_file_id.includes('null')
                              const isValidPdfUrl = typeof exam.pdf_url === 'string' && exam.pdf_url.trim().length > 10 && !exam.pdf_url.includes('null')
                              const isKatex = exam.format === 'katex' || hasQuestionsInStructure || (!isValidDriveId && !isValidPdfUrl)

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

                        {/* Title */}
                        <h3 className="mt-3 text-lg font-black leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2" style={{ fontFamily: 'var(--font-newexams-heading)' }}>
                          {exam.title}
                        </h3>

                        {/* Meta Info */}
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

                      {/* Actions */}
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
        </div>
      </div>

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
