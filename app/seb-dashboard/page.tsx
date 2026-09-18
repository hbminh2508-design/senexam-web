'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import { isExamInFolder } from '@/lib/sebFolderUtils'
import ProfileCompletionModal from '@/app/components/ProfileCompletionModal'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Award,
  Play,
  LogOut,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ExternalLink,
  Lock,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  KeyRound,
  Sliders,
  X,
  Loader2,
  Download,
  AlertTriangle,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-body' })

interface SebChildFolder {
  id: string
  name: string
  parent_id: string
  exam_count?: number
  icon?: string
}

interface SebParentFolder {
  id: string
  name: string
  parent_id: string | null
  icon?: string
  children: SebChildFolder[]
}

export default function SebDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Cây thư mục Mẹ - Con
  const [folders, setFolders] = useState<SebParentFolder[]>([])
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({})
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [selectedFolderObj, setSelectedFolderObj] = useState<SebChildFolder | null>(null)

  // Đề thi & Lượt làm bài của học sinh
  const [exams, setExams] = useState<any[]>([])
  const [userSubmissionsCount, setUserSubmissionsCount] = useState<Record<string, number>>({})
  const [userHighestScores, setUserHighestScores] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Cấp Mã 6 Số & Xác Nhận Vào Phòng Thi An Toàn
  const [selectedExamForEntry, setSelectedExamForEntry] = useState<any | null>(null)
  const [accessCode, setAccessCode] = useState<string>('')
  const [generatingCode, setGeneratingCode] = useState<boolean>(false)
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [enteringExam, setEnteringExam] = useState<boolean>(false)

  // Modal Admin Quản Lý Đề Thi Trong Thư Mục Con
  const [showFolderExamModal, setShowFolderExamModal] = useState<boolean>(false)
  const [folderExamSearch, setFolderExamSearch] = useState<string>('')
  const [updatingFolderExams, setUpdatingFolderExams] = useState<boolean>(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')

    const initDashboard = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          router.replace('/seb-login')
          return
        }
        setCurrentUser(user)

        // Lấy thông tin profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        setUserProfile(profile)
        const email = user.email?.toLowerCase() || ''
        if (
          profile?.role === 'admin' ||
          profile?.role === 'collab' ||
          email === 'hoangbinhminh2508@gmail.com'
        ) {
          setIsAdmin(true)
        }

        // 1. Tải cây thư mục Mẹ - Con từ API
        const fRes = await fetch('/api/seb/folders')
        const fData = await fRes.json()
        const folderTree: SebParentFolder[] = fData?.folders || []
        setFolders(folderTree)

        // Mặc định mở rộng thư mục mẹ đầu tiên và chọn thư mục con đầu tiên
        if (folderTree.length > 0) {
          const firstParent = folderTree[0]
          setExpandedParents({ [firstParent.id]: true })
          if (firstParent.children && firstParent.children.length > 0) {
            const firstChild = firstParent.children[0]
            setSelectedChildId(firstChild.id)
            setSelectedFolderObj(firstChild)
          }
        }

        // 2. Lấy toàn bộ đề thi
        const { data: examsData } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false })

        setExams(examsData || [])

        // 3. Lấy số lần đã thi và điểm số cao nhất của người dùng này cho từng đề thi từ bảng submissions dùng chung
        const { data: userSubs } = await supabase
          .from('submissions')
          .select('exam_id, score')
          .eq('user_id', user.id)

        const subCounts: Record<string, number> = {}
        const highestMap: Record<string, number> = {}
        ;(userSubs || []).forEach((s) => {
          if (s.exam_id) {
            subCounts[s.exam_id] = (subCounts[s.exam_id] || 0) + 1
            const sc = Number(s.score) || 0
            if (highestMap[s.exam_id] === undefined || sc > highestMap[s.exam_id]) {
              highestMap[s.exam_id] = sc
            }
          }
        })
        setUserSubmissionsCount(subCounts)
        setUserHighestScores(highestMap)
      } catch (err) {
        console.error('Lỗi khởi tạo SEB Dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    initDashboard()
  }, [router])

  // Đóng/mở Folder Mẹ
  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  // Chọn Folder Con
  const handleSelectChild = (child: SebChildFolder) => {
    setSelectedChildId(child.id)
    setSelectedFolderObj(child)
  }

  // Chọn Xem Tất Cả Đề Thi (Cả SenExam & SEB)
  const handleSelectAllExams = () => {
    setSelectedChildId('')
    setSelectedFolderObj(null)
  }

  // Đăng xuất
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/seb-login')
  }

  // Đếm số lượng đề thi thực tế theo thời gian thực cho từng thư mục con
  const folderExamCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach((parent) => {
      ;(parent.children || []).forEach((child) => {
        counts[child.id] = exams.filter((ex) => !ex.is_hidden && isExamInFolder(ex, child)).length
      })
    })
    return counts
  }, [folders, exams])

  // Lọc danh sách đề thi theo thư mục con đang chọn & thanh tìm kiếm
  const displayedExams = useMemo(() => {
    return exams.filter((ex) => {
      if (ex.is_hidden === true) return false

      const matchesSearch =
        !searchTerm.trim() ||
        ex.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ex.exam_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(ex.subjects) &&
          ex.subjects.some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase())))

      if (!matchesSearch) return false

      // Nếu đang ở chế độ xem tất cả
      if (!selectedChildId || !selectedFolderObj) {
        return true
      }

      return isExamInFolder(ex, selectedFolderObj)
    })
  }, [exams, searchTerm, selectedChildId, selectedFolderObj])

  // Mở modal cấp mã 6 số & xác nhận vào thi
  const handleOpenEntryModal = async (exam: any) => {
    setSelectedExamForEntry(exam)
    setAccessCode('')
    setCopiedCode(false)
    setGeneratingCode(true)

    try {
      const res = await fetch('/api/seb/exam-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_code',
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          examId: exam.id,
        }),
      })
      const data = await res.json()
      if (data.success && data.code) {
        setAccessCode(data.code)
      } else {
        setAccessCode(Math.floor(100000 + Math.random() * 900000).toString())
      }
    } catch (err) {
      console.warn('Lỗi sinh mã 6 số:', err)
      setAccessCode(Math.floor(100000 + Math.random() * 900000).toString())
    } finally {
      setGeneratingCode(false)
    }
  }

  // Sao chép mã 6 số
  const handleCopyCode = () => {
    if (!accessCode) return
    navigator.clipboard.writeText(accessCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 3000)
  }

  // Bắt đầu vào thi & Chấm dứt phiên tất cả các thiết bị khác
  const handleConfirmStartExam = async () => {
    if (!selectedExamForEntry) return
    setEnteringExam(true)

    try {
      // 1. Kick các session khác từ client Supabase
      await supabase.auth.signOut({ scope: 'others' }).catch(() => {})

      // 2. Gọi backend hủy kích hoạt phiên trên các máy khác trong database
      await fetch('/api/seb/exam-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enter_exam_and_terminate_others',
          userId: currentUser?.id,
          examId: selectedExamForEntry.id,
        }),
      }).catch(() => {})

      // 3. Chuyển hướng vào trang thi
      router.push(`/seb-exam/${selectedExamForEntry.id}`)
    } catch (err) {
      console.error('Lỗi khi vào phòng thi:', err)
      router.push(`/seb-exam/${selectedExamForEntry.id}`)
    } finally {
      setEnteringExam(false)
    }
  }

  // Admin: Gán hoặc gỡ đề thi khỏi thư mục con đang chọn
  const handleToggleExamInFolder = async (examId: string, currentInFolder: boolean) => {
    if (!selectedChildId) return
    setUpdatingFolderExams(true)
    try {
      const res = await fetch('/api/seb/folder-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedChildId,
          ...(currentInFolder ? { unassignExamId: examId } : { assignExamId: examId }),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setExams((prev) =>
          prev.map((e) =>
            e.id === examId ? { ...e, folder_id: currentInFolder ? 'none' : selectedChildId } : e
          )
        )
      }
    } catch (e) {
      console.error('Lỗi cập nhật đề vào thư mục:', e)
    } finally {
      setUpdatingFolderExams(false)
    }
  }

  return (
    <div
      className={`min-h-screen w-full bg-slate-50 flex flex-col text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-seb-body)' }}
    >
      {/* Top Navbar */}
      <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <SebLogo size={36} showText={true} />
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/seb-admin"
              className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Award className="h-3.5 w-3.5" />
              <span>Quản Trị SEB</span>
            </Link>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Môi trường bảo mật SEB sẵn sàng</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất"
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Split Layout: Left 30% / Right 70% */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto p-4 sm:p-6 gap-6">
        {/* ======================================================== */}
        {/* CỘT TRÁI (LEFT PANE - 28%~30%): AVATAR -> PROFILE & FOLDER TREE */}
        {/* ======================================================== */}
        <aside className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          {/* Card 1: User Avatar & Quick Profile Link */}
          <Link
            href="/seb-profile"
            className="group block p-4 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-200 relative overflow-hidden"
          >
            <div className="flex items-center gap-3.5">
              {/* Avatar người dùng bấm vào xem seb-profile */}
              <div className="relative">
                <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                  {userProfile?.full_name
                    ? userProfile.full_name.charAt(0).toUpperCase()
                    : currentUser?.email?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-sky-600 transition">
                    {userProfile?.full_name || currentUser?.email?.split('@')[0] || 'Thí Sinh'}
                  </h3>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {currentUser?.email || 'N/A'}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md">
                  Xem hồ sơ & bài đã làm
                </span>
              </div>
            </div>
          </Link>

          {/* Card 2: Folder Tree (Thư Mục Mẹ & Thư Mục Con) */}
          <div className="flex-1 rounded-3xl bg-white border border-sky-100 shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-600" />
                <span
                  className="font-black text-xs text-slate-800 uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-seb-heading)' }}
                >
                  Danh Mục Môn Thi
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">
                {folders.reduce((acc, p) => acc + (p.children?.length || 0), 0)} Môn
              </span>
            </div>

            {/* Nút Xem Tất Cả Đề Thi Hệ Thống (SenExam & SEB) */}
            <button
              type="button"
              onClick={handleSelectAllExams}
              className={`w-full flex items-center justify-between p-3 mb-2 rounded-2xl border transition text-left text-xs font-black ${
                !selectedChildId
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/20 border-transparent'
                  : 'bg-sky-50/50 hover:bg-sky-100/60 text-sky-900 border-sky-100'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="truncate">Tất Cả Đề Thi (SenExam & SEB)</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  !selectedChildId
                    ? 'bg-white/20 text-white font-bold'
                    : 'bg-white text-sky-700 border border-sky-200'
                }`}
              >
                {exams.filter((e) => !e.is_hidden).length}
              </span>
            </button>

            {/* Folder Tree Items */}
            <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
              {folders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Đang tải danh mục môn thi...
                </div>
              ) : (
                folders.map((parent) => {
                  const isExpanded = Boolean(expandedParents[parent.id])
                  const hasChildren = parent.children && parent.children.length > 0

                  return (
                    <div key={parent.id} className="rounded-2xl border border-slate-100/90 overflow-hidden">
                      {/* Thư Mục Mẹ (Parent Folder) */}
                      <button
                        type="button"
                        onClick={() => toggleParent(parent.id)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50/70 hover:bg-sky-50/60 transition text-left text-xs font-bold text-slate-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <FolderOpen className="h-4 w-4 text-sky-600 shrink-0" />
                          ) : (
                            <Folder className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{parent.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-200/60 font-mono">
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
                        <div className="p-1.5 bg-white space-y-1 border-t border-slate-100">
                          {parent.children.map((child) => {
                            const isSelected = selectedChildId === child.id

                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleSelectChild(child)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                                  isSelected
                                    ? 'bg-sky-500 text-white font-black shadow-sm shadow-sky-500/20'
                                    : 'text-slate-600 hover:bg-slate-100/80 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`h-2 w-2 rounded-full ${
                                      isSelected ? 'bg-white' : 'bg-sky-400'
                                    }`}
                                  />
                                  <span className="truncate">{child.name}</span>
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                                    isSelected
                                      ? 'bg-white/20 text-white font-bold'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {folderExamCounts[child.id] ?? (child.exam_count || 0)} đề
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

            {/* Quick SEB Notice */}
            <div className="mt-4 p-3 rounded-2xl bg-sky-50/70 border border-sky-100 text-[11px] text-sky-800 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                Bài thi được bảo vệ chống sao chép và gian lận qua cấu hình Safe Exam Browser.
              </span>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* CỘT PHẢI (RIGHT PANE - 70%~72% KHÔNG GIAN): DANH SÁCH ĐỀ THI */}
        {/* ======================================================== */}
        <main className="flex-1 flex flex-col gap-4">
          {/* Header Môn thi đang chọn & Search */}
          <div className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sky-600 mb-1">
                  <span>Môn Thi Đang Chọn</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <h2
                  className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-seb-heading)' }}
                >
                  {selectedFolderObj?.name || 'Tất Cả Đề Thi Trực Tuyến'}
                </h2>
              </div>

              {isAdmin && selectedChildId && (
                <button
                  type="button"
                  onClick={() => setShowFolderExamModal(true)}
                  className="mt-1 sm:mt-0 px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Quản Lý Đề Trong Môn Này</span>
                </button>
              )}
            </div>

            {/* Thanh tìm kiếm */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm đề thi..."
                className="w-full pl-9 pr-3.5 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Danh Sách Đề Thi (Chiếm phần to nhất 70%) */}
          {displayedExams.length === 0 ? (
            <div className="flex-1 min-h-[400px] rounded-3xl bg-white border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-3xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                <FileText className="h-8 w-8 opacity-60" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Chưa có đề thi nào trong danh mục này
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Vui lòng chọn môn thi khác ở danh mục bên trái hoặc liên hệ giáo viên phụ trách để cập nhật đề thi mới.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedExams.map((exam) => {
                const userAttempts = userSubmissionsCount[exam.id] || 0
                const maxAttempts = exam.max_attempts || 1
                const isOutOfAttempts = maxAttempts > 0 && userAttempts >= maxAttempts
                const highestScore = userHighestScores[exam.id]
                const isSebRequired = exam.require_seb === true

                return (
                  <div
                    key={exam.id}
                    className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between relative group"
                  >
                    {/* Corner Badge: SỐ LẦN THI Ở GÓC NHỎ MỖI ĐỀ THI */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                          {exam.exam_type || 'ĐỀ THI'}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            isSebRequired
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isSebRequired ? '🛡️ SEB' : '📘 SenExam'}
                        </span>
                      </div>

                      {/* Huy hiệu số lần thi nhỏ ở góc */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isOutOfAttempts
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : userAttempts > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        Số lần thi: {userAttempts}/{maxAttempts > 0 ? maxAttempts : '∞'}
                      </span>
                    </div>

                    {/* Tiêu đề đề thi */}
                    <div>
                      <h4 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition line-clamp-2">
                        {exam.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {exam.duration || 50} phút
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          {Array.isArray(exam.exam_structure)
                            ? exam.exam_structure.reduce(
                                (acc: number, s: any) => acc + (parseInt(s.questionCount) || 0),
                                0
                              )
                            : 40}{' '}
                          câu hỏi
                        </span>
                      </div>

                      {/* Điểm kỷ lục đã đạt được trước đây từ SenExam hoặc SEB */}
                      {highestScore !== undefined && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-100 w-fit">
                          <span>🏆 Kỷ lục của bạn:</span>
                          <span className="text-emerald-800 font-black">
                            {highestScore.toFixed(1)}
                            {exam.exam_type === 'HSA' ? 'đ' : exam.exam_type === 'TSA' ? '/100đ' : '/10đ'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Thẻ: Nút Vào Thi SEB */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                        <span>{isSebRequired ? 'Yêu cầu Safe Exam Browser' : 'Hệ sinh thái SenExam'}</span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfAttempts}
                        onClick={() => handleOpenEntryModal(exam)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                          isOutOfAttempts
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20'
                        }`}
                      >
                        <span>{isOutOfAttempts ? 'Hết Lượt Thi' : 'Vào Phòng Thi'}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CẤP MÃ 6 SỐ VÀO THI & CHẤM DỨT PHIÊN ĐA THIẾT BỊ */}
      {/* ======================================================== */}
      {selectedExamForEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-sky-100 shadow-2xl p-6 sm:p-7 space-y-5 text-center relative overflow-hidden">
            {/* Background security pattern */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-36 h-36 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Modal */}
            <div className="flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 mb-3">
                <KeyRound className="h-7 w-7" />
              </div>
              <span className="text-[11px] font-black uppercase text-sky-600 tracking-wider">
                Xác Nhận & Cấp Mã Phòng Thi SEB
              </span>
              <h3
                className="text-lg sm:text-xl font-black text-slate-900 mt-1 line-clamp-2"
                style={{ fontFamily: 'var(--font-seb-heading)' }}
              >
                {selectedExamForEntry.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>{selectedExamForEntry.duration || 50} phút</span>
                <span>•</span>
                <span>{selectedExamForEntry.exam_type || 'Đề chuẩn'}</span>
              </div>
            </div>

            {/* Khối hiển thị mã 6 số */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="text-xs font-bold text-slate-500">
                Mã dự thi 6 số bảo mật của bạn (hiệu lực trong 30 phút):
              </div>

              {generatingCode ? (
                <div className="py-6 flex items-center justify-center gap-2 text-sky-600 text-xs font-bold">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Đang khởi tạo mã phòng thi an toàn...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {accessCode.split('').map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-14 sm:w-12 sm:h-16 rounded-2xl bg-white border-2 border-sky-300 text-sky-900 font-mono font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xs"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200 transition shadow-2xs"
                  >
                    {copiedCode ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedCode ? 'Đã sao chép mã 6 số!' : 'Sao chép mã vào thi'}</span>
                  </button>
                </>
              )}

              {/* TỰ ĐỘNG ĐĂNG NHẬP THÔNG MINH KHI MỞ SEB */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-sky-500/15 border-2 border-emerald-300 text-left space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-black text-emerald-950 text-xs">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>TỰ ĐỘNG ĐĂNG NHẬP: KHÔNG CẦN NHẬP MÃ 6 SỐ!</span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed font-semibold">
                  Hệ thống đã tích hợp xác thực tài khoản của bạn vào liên kết Safe Exam Browser. Khi bấm <strong>"Mở Trực Tiếp SEB"</strong> hoặc mở file <strong>.seb</strong>, SEB sẽ <strong>tự động đăng nhập và đưa bạn vào thẳng bài thi</strong>.
                </p>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  💡 <span className="italic">Dự phòng:</span> Nếu bạn tự tay mở ứng dụng SEB từ desktop, hãy nhập mã 6 số ở trên.
                </div>
              </div>
            </div>

            {/* Cảnh báo bảo mật & chấm dứt phiên */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5">
              <div className="flex items-center gap-2 font-black text-slate-800 text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>BẢO MẬT TÀI KHOẢN PHÒNG THI:</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                • Bắt đầu vào thi sẽ <strong>CHẤM DỨT PHIÊN ĐĂNG NHẬP TRÊN CÁC THIẾT BỊ KHÁC</strong> của bạn.
              </p>
            </div>

            {/* Action Buttons: 2 Cách Mở SEB Tự Động Đăng Nhập */}
            {(() => {
              const host = typeof window !== 'undefined' ? window.location.host : ''
              const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
              const directAutoParam = accessCode ? `?auto_code=${encodeURIComponent(accessCode)}` : ''
              const directSebUrl = protocol === 'https:'
                ? `sebs://${host}/seb-exam/${selectedExamForEntry.id}${directAutoParam}`
                : `seb://${host}/seb-exam/${selectedExamForEntry.id}${directAutoParam}`
              const directConfigUrl = `/api/seb/config?examId=${selectedExamForEntry.id}${accessCode ? `&code=${encodeURIComponent(accessCode)}` : ''}&download=1`

              return (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <a
                      href={directSebUrl}
                      onClick={() => {
                        supabase.auth.signOut({ scope: 'others' }).catch(() => {})
                        fetch('/api/seb/exam-access', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'enter_exam_and_terminate_others',
                            userId: currentUser?.id,
                            examId: selectedExamForEntry.id,
                          }),
                        }).catch(() => {})
                      }}
                      className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-sky-500/25 uppercase tracking-wider"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Mở Trực Tiếp SEB (Tự Đăng Nhập)</span>
                    </a>

                    <a
                      href={directConfigUrl}
                      download
                      onClick={() => {
                        supabase.auth.signOut({ scope: 'others' }).catch(() => {})
                      }}
                      className="w-full sm:w-auto py-3.5 px-4 rounded-2xl border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                      title="Tải file .seb về máy rồi click đúp để mở SEB và tự động đăng nhập"
                    >
                      <Download className="h-4 w-4 text-sky-600" />
                      <span>Tải File .seb</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={enteringExam || generatingCode}
                      onClick={handleConfirmStartExam}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span>Vào Phòng Chờ Trên Trình Duyệt Web</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedExamForEntry(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-bold transition"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADMIN QUẢN LÝ ĐỀ THI TRONG THƯ MỤC CON */}
      {/* ======================================================== */}
      {showFolderExamModal && selectedFolderObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-sky-100 shadow-2xl p-6 flex flex-col max-h-[85vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">
                  Quản Trị Thư Mục Con
                </span>
                <h3
                  className="text-lg font-black text-slate-900"
                  style={{ fontFamily: 'var(--font-seb-heading)' }}
                >
                  Quản Lý Đề Thi Trong Môn: {selectedFolderObj.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Các đề thi khớp tên hoặc môn vẫn sẽ tự động xuất hiện. Bạn có thể chủ động gán thêm hoặc bỏ bớt đề thi cho môn này.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowFolderExamModal(false)}
                className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tìm kiếm đề thi trong modal */}
            <div className="relative">
              <input
                type="text"
                value={folderExamSearch}
                onChange={(e) => setFolderExamSearch(e.target.value)}
                placeholder="Tìm tên đề thi để gán vào môn này..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Danh sách đề thi */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {exams
                .filter((ex) => {
                  if (ex.is_hidden) return false
                  if (!folderExamSearch.trim()) return true
                  return ex.title?.toLowerCase().includes(folderExamSearch.toLowerCase())
                })
                .map((ex) => {
                  const isDirect = ex.folder_id === selectedFolderObj.id
                  const isAuto = !isDirect && isExamInFolder(ex, selectedFolderObj)
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
                        disabled={updatingFolderExams}
                        onClick={() => handleToggleExamInFolder(ex.id, isInFolder)}
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
                Số đề hiển thị trong môn này: {folderExamCounts[selectedFolderObj.id] ?? 0} đề
              </span>
              <button
                type="button"
                onClick={() => setShowFolderExamModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bổ Sung Hồ Sơ Học Sinh (Nếu Chưa Có Trường/Lớp) */}
      <ProfileCompletionModal />
    </div>
  )
}
