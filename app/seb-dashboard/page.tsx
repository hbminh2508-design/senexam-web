'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
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
  const [searchTerm, setSearchTerm] = useState('')

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

        // 3. Lấy số lần đã thi của người dùng này cho từng đề thi
        const { data: userSubs } = await supabase
          .from('submissions')
          .select('exam_id')
          .eq('user_id', user.id)

        const subCounts: Record<string, number> = {}
        ;(userSubs || []).forEach((s) => {
          if (s.exam_id) {
            subCounts[s.exam_id] = (subCounts[s.exam_id] || 0) + 1
          }
        })
        setUserSubmissionsCount(subCounts)
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

  // Đăng xuất
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/seb-login')
  }

  // Lọc danh sách đề thi theo thư mục con đang chọn & thanh tìm kiếm
  const displayedExams = exams.filter((ex) => {
    const matchesSearch =
      !searchTerm.trim() ||
      ex.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.exam_type?.toLowerCase().includes(searchTerm.toLowerCase())

    // Nếu đề thi có folder_id khớp với thư mục con đang chọn
    if (selectedChildId) {
      const matchesFolder =
        ex.folder_id === selectedChildId ||
        (Array.isArray(ex.subjects) &&
          ex.subjects.some((s: string) =>
            selectedFolderObj?.name?.toLowerCase().includes(s.toLowerCase())
          ))
      return matchesSearch && matchesFolder
    }

    return matchesSearch
  })

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
                                  {child.exam_count || 0} đề
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

                return (
                  <div
                    key={exam.id}
                    className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between relative group"
                  >
                    {/* Corner Badge: SỐ LẦN THI Ở GÓC NHỎ MỖI ĐỀ THI */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80">
                        {exam.exam_type || 'Đề Thi SEB'}
                      </span>

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

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
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
                    </div>

                    {/* Footer Thẻ: Nút Vào Thi SEB */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <ShieldAlert className="h-3.5 w-3.5 text-sky-600" />
                        <span>Chống gian lận SEB</span>
                      </div>

                      <Link
                        href={`/seb-exam/${exam.id}`}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                          isOutOfAttempts
                            ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20'
                        }`}
                      >
                        <span>{isOutOfAttempts ? 'Hết Lượt Thi' : 'Vào Phòng Thi'}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
