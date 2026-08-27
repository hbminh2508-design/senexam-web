'use client'

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  ArrowLeft,
  Search,
  Folder,
  FileText,
  Download,
  Eye,
  PlusCircle,
  Trash2,
  Edit,
  Crown,
  ChevronRight,
  Sun,
  Moon,
  Loader2,
  Sparkles,
  BookOpen,
  UploadCloud,
  File,
  Filter,
  CheckCircle2,
  AlertCircle,
  Home,
  ShieldCheck,
  FolderPlus,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newlib-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newlib-body' })

type FolderItem = {
  id: string
  name: string
  parent_id: string | null
  created_by: string | null
  created_at: string
}

type DocItem = {
  id: string
  title: string
  drive_file_id: string
  folder_id: string | null
  created_by: string | null
  created_at: string
  is_vip_only?: boolean
  description?: string | null
}

type Breadcrumb = {
  id: string | null
  name: string
}

export default function NewLibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userRole, setUserRole] = useState<'student' | 'admin' | 'collab' | 'teacher'>('student')
  const [isVip, setIsVip] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Thư viện số' }])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [documents, setDocuments] = useState<DocItem[]>([])

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterVip, setFilterVip] = useState<'all' | 'free' | 'vip'>('all')
  const deferredQuery = useDeferredValue(searchQuery)

  // Document Preview Modal
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)

  // Admin / Collab Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docIsVip, setDocIsVip] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'uploading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  })

  // Rename Modal
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; type: 'folder' | 'doc'; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const canManage = userRole === 'admin' || userRole === 'collab' || userRole === 'teacher'

  const fetchContents = async (folderId: string | null, role: string, vipStatus: boolean) => {
    setLoading(true)
    try {
      const folderQuery = supabase
        .from('library_folders')
        .select('id, name, parent_id, created_by, created_at')
        .order('name', { ascending: true })

      const docQuery = supabase
        .from('library_documents')
        .select('id, title, drive_file_id, folder_id, created_by, created_at, is_vip_only, description')
        .order('created_at', { ascending: false })

      if (folderId) {
        folderQuery.eq('parent_id', folderId)
        docQuery.eq('folder_id', folderId)
      } else {
        folderQuery.is('parent_id', null)
        docQuery.is('folder_id', null)
      }

      const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])

      const visibleFolders = ((folderRes.data || []) as FolderItem[]).filter((f) => {
        if (role === 'admin' || role === 'collab') return true
        return f.created_by == null
      })

      const visibleDocs = ((docRes.data || []) as DocItem[]).filter((d) => {
        if (role === 'admin' || role === 'collab') return true
        return d.created_by == null
      })

      setFolders(visibleFolders)
      setDocuments(visibleDocs)
    } catch (err) {
      console.error('Error fetching library contents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, vip_expires_at')
        .eq('id', user.id)
        .single()

      const role = (profile?.role || 'student') as 'student' | 'admin' | 'collab'
      const vip = !!profile?.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now()
      setUserRole(role)
      setIsVip(vip)

      const { data: sessionData } = await supabase.auth.getSession()
      setAccessToken(sessionData.session?.access_token || null)

      // Kiểm tra xem URL có param folder không
      const params = new URLSearchParams(window.location.search)
      const folderParam = params.get('folder')
      
      let initialFolderId: string | null = null
      const initialBreadcrumbs: Breadcrumb[] = [{ id: null, name: 'Thư viện số' }]

      if (folderParam) {
        try {
          const { data: targetFolder } = await supabase
            .from('library_folders')
            .select('*')
            .eq('id', folderParam)
            .single()

          if (targetFolder) {
            initialFolderId = targetFolder.id
            if (targetFolder.parent_id) {
              const { data: parentFolder } = await supabase
                .from('library_folders')
                .select('*')
                .eq('id', targetFolder.parent_id)
                .single()
              if (parentFolder) {
                initialBreadcrumbs.push({ id: parentFolder.id, name: parentFolder.name })
              }
            }
            initialBreadcrumbs.push({ id: targetFolder.id, name: targetFolder.name })
          }
        } catch (e) {
          console.error('Error loading initial folder from url:', e)
        }
      }

      setCurrentFolderId(initialFolderId)
      setBreadcrumbs(initialBreadcrumbs)
      await fetchContents(initialFolderId, role, vip)
    }

    init()

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const fId = params.get('folder')
      setCurrentFolderId(fId)
      fetchContents(fId, userRole, isVip)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [router, isVip, userRole])

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

  // Chuyển vào thư mục con (Cập nhật URL)
  const handleOpenFolder = (folder: FolderItem) => {
    setCurrentFolderId(folder.id)
    const nextCrumbs = [...breadcrumbs, { id: folder.id, name: folder.name }]
    setBreadcrumbs(nextCrumbs)
    window.history.pushState(null, '', `/new-library?folder=${folder.id}`)
    fetchContents(folder.id, userRole, isVip)
  }

  // Điều hướng breadcrumb (Cập nhật URL)
  const handleNavigateBreadcrumb = (crumb: Breadcrumb, index: number) => {
    setCurrentFolderId(crumb.id)
    const nextCrumbs = breadcrumbs.slice(0, index + 1)
    setBreadcrumbs(nextCrumbs)
    if (crumb.id) {
      window.history.pushState(null, '', `/new-library?folder=${crumb.id}`)
    } else {
      window.history.pushState(null, '', `/new-library`)
    }
    fetchContents(crumb.id, userRole, isVip)
  }

  // Tạo thư mục mới (Admin / Collab)
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    try {
      const { error } = await supabase.from('library_folders').insert({
        name: newFolderName.trim(),
        parent_id: currentFolderId,
        created_by: userId,
      })

      if (error) throw error
      setNewFolderName('')
      setShowNewFolderModal(false)
      fetchContents(currentFolderId, userRole, isVip)
    } catch (err: any) {
      alert(`Lỗi tạo thư mục: ${err.message}`)
    }
  }

  // Tải tài liệu lên Google Drive & lưu vào Supabase
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) return

    setUploadStatus({ type: 'uploading', message: 'Đang khởi tạo tải tệp...' })

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const title = docTitle.trim() || file.name.replace(/\.[^/.]+$/, '')

        setUploadStatus({
          type: 'uploading',
          message: `Đang tải lên (${i + 1}/${selectedFiles.length}): ${file.name}...`,
        })

        // 1. Tải lên Google Drive
        const uploadUrl = await initGoogleDriveUpload(file.name, file.type || 'application/pdf')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, file, title)
        const driveFileId = typeof uploaded === 'string' ? uploaded : (uploaded?.id || '')

        // 2. Lưu thông tin vào database Supabase
        const { error } = await supabase.from('library_documents').insert({
          title,
          drive_file_id: driveFileId,
          folder_id: currentFolderId,
          created_by: userId,
          is_vip_only: docIsVip,
        })

        if (error) throw error
      }

      setUploadStatus({ type: 'success', message: 'Tải tài liệu lên thành công!' })
      setTimeout(() => {
        setShowUploadModal(false)
        setDocTitle('')
        setSelectedFiles([])
        setDocIsVip(false)
        setUploadStatus({ type: 'idle', message: '' })
        fetchContents(currentFolderId, userRole, isVip)
      }, 1000)
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: `Lỗi tải tệp: ${err.message}` })
    }
  }

  // Đổi tên thư mục / tài liệu
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameValue.trim()) return

    try {
      if (renameTarget.type === 'folder') {
        const { error } = await supabase
          .from('library_folders')
          .update({ name: renameValue.trim() })
          .eq('id', renameTarget.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('library_documents')
          .update({ title: renameValue.trim() })
          .eq('id', renameTarget.id)
        if (error) throw error
      }

      setShowRenameModal(false)
      setRenameTarget(null)
      fetchContents(currentFolderId, userRole, isVip)
    } catch (err: any) {
      alert(`Lỗi đổi tên: ${err.message}`)
    }
  }

  // Xóa thư mục / tài liệu
  const handleDeleteItem = async (id: string, type: 'folder' | 'doc') => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ${type === 'folder' ? 'thư mục' : 'tài liệu'} này?`)) return

    try {
      if (type === 'folder') {
        const { error } = await supabase.from('library_folders').delete().eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('library_documents').delete().eq('id', id)
        if (error) throw error
      }
      fetchContents(currentFolderId, userRole, isVip)
    } catch (err: any) {
      alert(`Lỗi xóa: ${err.message}`)
    }
  }

  // Lọc tài liệu theo từ khóa tìm kiếm & VIP
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchQuery = doc.title.toLowerCase().includes(deferredQuery.toLowerCase().trim())
      if (!matchQuery) return false
      if (filterVip === 'vip') return doc.is_vip_only
      if (filterVip === 'free') return !doc.is_vip_only
      return true
    })
  }, [documents, deferredQuery, filterVip])

  const filteredFolders = useMemo(() => {
    return folders.filter((folder) => {
      return folder.name.toLowerCase().includes(deferredQuery.toLowerCase().trim())
    })
  }, [folders, deferredQuery])

  const themeVars = getModernThemeVars('indigo', isDark)

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
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Top Header */}
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
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <BookOpen className="inline h-3 w-3 mr-1" /> Kho Học Liệu Số
                </span>
                {isVip && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase">
                    <Crown className="h-3 w-3" /> VIP
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newlib-heading)' }}>
                Thư Viện Tài Liệu & Chuyên Đề
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Khám phá hàng ngàn đề thi, tài liệu tóm tắt lý thuyết và bài tập có giải chi tiết.
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold shadow-sm transition hover:scale-105"
                >
                  <FolderPlus className="h-4 w-4 text-amber-500" /> Thêm thư mục
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105"
                >
                  <UploadCloud className="h-4 w-4" /> Tải tài liệu
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Breadcrumb Bar */}
        <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-4">
          
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Tìm thư mục hoặc tài liệu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500"
              />
            </div>

            {/* Filter VIP Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto justify-end">
              <button
                type="button"
                onClick={() => setFilterVip('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  filterVip === 'all'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                }`}
              >
                Tất cả ({documents.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterVip('free')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  filterVip === 'free'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                }`}
              >
                Miễn phí
              </button>
              <button
                type="button"
                onClick={() => setFilterVip('vip')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  filterVip === 'vip'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Crown className="inline h-3 w-3 mr-1" /> VIP Only
              </button>
            </div>
          </div>

          {/* Breadcrumb Navigation Trail */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7280] dark:text-slate-400 overflow-x-auto pt-1 border-t border-black/5 dark:border-white/5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={crumb.id || idx} className="flex items-center gap-1.5 whitespace-nowrap">
                  {idx === 0 ? <Home className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  <button
                    type="button"
                    onClick={() => handleNavigateBreadcrumb(crumb, idx)}
                    className={`transition hover:text-indigo-600 dark:hover:text-indigo-400 ${
                      isLast ? 'text-black dark:text-white font-black' : ''
                    }`}
                  >
                    {crumb.name}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content Explorer Section */}
        {loading ? (
          <div className="py-20 grid place-items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <span className="font-bold text-sm">Đang tải danh mục tài liệu...</span>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            
            {/* 1. FOLDERS GRID */}
            {filteredFolders.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Folder className="h-4 w-4 text-amber-500" /> Thư mục ({filteredFolders.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="group relative rounded-2xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md flex items-center justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(folder)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0 group-hover:scale-110 transition">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="truncate">
                          <p className="font-black text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {folder.name}
                          </p>
                          <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-semibold">
                            {new Date(folder.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </button>

                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setRenameTarget({ id: folder.id, type: 'folder', name: folder.name })
                              setRenameValue(folder.name)
                              setShowRenameModal(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-black dark:hover:text-white transition"
                            title="Đổi tên"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(folder.id, 'folder')}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. DOCUMENTS LIST */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400 mb-3 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-500" /> Tài liệu ({filteredDocuments.length})
              </h3>

              {filteredDocuments.length === 0 && filteredFolders.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-12 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <BookOpen className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold">Thư mục hiện đang trống</h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-sm mx-auto">
                    Chưa có tài liệu hoặc thư mục nào trong danh mục này.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => {
                    const previewUrl = `https://drive.google.com/file/d/${doc.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`
                    const downloadUrl = `https://drive.google.com/uc?export=download&id=${doc.drive_file_id}`
                    const isLocked = doc.is_vip_only && !isVip && !canManage

                    return (
                      <div
                        key={doc.id}
                        className="group relative rounded-2xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-4 shadow-sm backdrop-blur-xl transition hover:shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        {/* File Info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-sm sm:text-base truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" style={{ fontFamily: 'var(--font-newlib-heading)' }}>
                                {doc.title}
                              </p>
                              {doc.is_vip_only && (
                                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase">
                                  <Crown className="h-2.5 w-2.5" /> VIP
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#6B7280] dark:text-slate-400 font-semibold">
                              Cập nhật: {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
                          {isLocked ? (
                            <Link
                              href="/new-vip"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:bg-amber-400"
                            >
                              <Crown className="h-3.5 w-3.5" /> Nâng VIP để mở khóa
                            </Link>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                                title="Xem trước tài liệu"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-500" /> Xem thử
                              </button>
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:opacity-90 active:scale-95"
                              >
                                <Download className="h-3.5 w-3.5" /> Tải về
                              </a>
                            </>
                          )}

                          {canManage && (
                            <div className="flex items-center gap-1 border-l border-black/10 dark:border-white/10 pl-2 ml-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameTarget({ id: doc.id, type: 'doc', name: doc.title })
                                  setRenameValue(doc.title)
                                  setShowRenameModal(true)
                                }}
                                className="p-1.5 text-slate-400 hover:text-black dark:hover:text-white transition"
                                title="Đổi tên tài liệu"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(doc.id, 'doc')}
                                className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                                title="Xóa tài liệu"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[85vh] rounded-[30px] border border-white/20 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/80">
              <div className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm truncate max-w-md">{previewDoc.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://drive.google.com/uc?export=download&id=${previewDoc.drive_file_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-3.5 py-1.5 text-xs font-bold transition hover:bg-amber-400"
                >
                  <Download className="h-3.5 w-3.5" /> Tải về máy
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="flex-1 w-full bg-slate-950">
              <iframe
                src={`https://drive.google.com/file/d/${previewDoc.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-none"
                title="Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <FolderPlus className="h-6 w-6" />
              <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newlib-heading)' }}>
                Tạo thư mục mới
              </h3>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Nhập tên thư mục..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-black shadow"
                >
                  Tạo thư mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-500">
              <UploadCloud className="h-6 w-6" />
              <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newlib-heading)' }}>
                Tải lên tài liệu mới
              </h3>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                  Tiêu đề tài liệu (Tùy chọn, để trống sẽ lấy tên tệp):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đề thi thử THPTQG 2026 môn Toán..."
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                  Chọn tệp PDF hoặc ảnh:
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                  required
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-500/10 file:text-indigo-600 hover:file:bg-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vipDocCheckbox"
                  checked={docIsVip}
                  onChange={(e) => setDocIsVip(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="vipDocCheckbox" className="text-xs font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Crown className="h-3.5 w-3.5" /> Chỉ dành cho tài khoản VIP
                </label>
              </div>

              {uploadStatus.type !== 'idle' && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  uploadStatus.type === 'uploading' ? 'bg-indigo-500/10 text-indigo-600' :
                  uploadStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' :
                  'bg-rose-500/10 text-rose-600'
                }`}>
                  {uploadStatus.type === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploadStatus.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {uploadStatus.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  disabled={uploadStatus.type === 'uploading'}
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploadStatus.type === 'uploading' || selectedFiles.length === 0}
                  className="rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-black shadow disabled:opacity-50"
                >
                  {uploadStatus.type === 'uploading' ? 'Đang tải...' : 'Bắt đầu tải lên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-500">
              <Edit className="h-5 w-5" />
              <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newlib-heading)' }}>
                Đổi tên {renameTarget?.type === 'folder' ? 'thư mục' : 'tài liệu'}
              </h3>
            </div>

            <form onSubmit={handleRename} className="space-y-4">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-black shadow"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
