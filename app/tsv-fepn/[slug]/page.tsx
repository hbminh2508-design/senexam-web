'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  FolderOpen,
  FileText,
  Video,
  Award,
  BookOpen,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronRight,
  Plus,
  Trash2,
  Lock,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Upload,
  X,
  Layers,
  Cpu,
  Zap,
  Atom,
  Loader2,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Eye,
  GraduationCap,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export type MaterialCategory = 'slides' | 'exercises' | 'videos' | 'exams'

export interface FepnSubject {
  id: string
  code: string
  name: string
  credits: number
  semester: string
  description?: string
  icon?: string
  created_at?: string
}

export interface FepnMaterial {
  id: string
  subject_id: string
  category: MaterialCategory
  title: string
  description?: string
  file_url: string
  file_type?: string
  extra_info?: string
  created_at?: string
  created_by?: string
}

export default function FepnSubjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const rawSlug = (params?.slug as string) || ''

  const isDark = false
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')

  const [isSubdomain, setIsSubdomain] = useState(false)

  // Subject & Materials Data from Database ONLY
  const [subject, setSubject] = useState<FepnSubject | null>(null)
  const [materials, setMaterials] = useState<FepnMaterial[]>([])
  const [loadingSubject, setLoadingSubject] = useState(true)
  const [activeCategory, setActiveCategory] = useState<MaterialCategory>('slides')
  const [selectedMaterial, setSelectedMaterial] = useState<FepnMaterial | null>(null)

  // Resizable Split Pane State (25% - 75%)
  const [leftWidth, setLeftWidth] = useState<number>(42)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Admin Add Material Modal
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false)
  const [newMatTitle, setNewMatTitle] = useState('')
  const [newMatCategory, setNewMatCategory] = useState<MaterialCategory>('slides')
  const [newMatDesc, setNewMatDesc] = useState('')
  const [newMatUrl, setNewMatUrl] = useState('')
  const [newMatExtra, setNewMatExtra] = useState('')
  const [newMatType, setNewMatType] = useState('pdf')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingMaterial, setUploadingMaterial] = useState(false)

  // 1. Theme (Mặc định Light Mode) & Width Init
  useEffect(() => {
    // Luôn áp dụng Light mode cho các trang FEPN
    document.documentElement.classList.remove('dark')

    const savedWidth = localStorage.getItem('fepn_split_width')
    if (savedWidth) {
      const parsed = parseFloat(savedWidth)
      if (!isNaN(parsed) && parsed >= 25 && parsed <= 75) {
        setLeftWidth(parsed)
      }
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      setIsSubdomain(host.startsWith('tsv.fepn.') || host.startsWith('fepn.'))
    }
  }, [])

  // 2. Check Auth & Email @vnu.edu.vn
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const currentUser = authData?.user

        if (!currentUser) {
          setAuthStatus('unauthenticated')
          setAuthLoading(false)
          return
        }

        setUser(currentUser)

        let role = 'student'
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profile?.role) {
          role = profile.role
          setUserRole(profile.role)
        }

        const email = currentUser.email?.toLowerCase() || ''
        const isVnu = email.endsWith('@vnu.edu.vn')
        const isAdmin = role === 'admin'

        if (isVnu || isAdmin) {
          setAuthStatus('authorized')
          await loadSubjectData(currentUser.id)
        } else {
          setAuthStatus('restricted')
        }
      } catch (err) {
        console.error('Lỗi kiểm tra quyền truy cập:', err)
        setAuthStatus('restricted')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [rawSlug])

  // 3. Load Subject & Materials from Database purely
  const loadSubjectData = async (userId: string) => {
    if (!rawSlug) return
    setLoadingSubject(true)
    try {
      // Tìm môn học bằng mã môn (code) hoặc ID hoặc slug dạng fepn-[code]
      const cleanSlug = rawSlug.trim().toLowerCase().replace(/^fepn-/, '')

      // Lấy tất cả môn học để so khớp linh hoạt
      const { data: allSubjects, error: subErr } = await supabase
        .from('fepn_subjects')
        .select('*')

      if (subErr) throw subErr

      const matched = (allSubjects || []).find((s: any) => {
        const sCode = (s.code || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const sId = (s.id || '').toLowerCase()
        return (
          sCode === cleanSlug ||
          sId === cleanSlug ||
          s.code.toLowerCase() === cleanSlug ||
          s.code.toLowerCase() === rawSlug.toLowerCase() ||
          `fepn-${sCode}` === rawSlug.toLowerCase()
        )
      })

      if (matched) {
        setSubject(matched)

        // Tải toàn bộ tài liệu của môn học này theo thứ tự thời gian (tài liệu mới ở dưới)
        const { data: matsData, error: matErr } = await supabase
          .from('fepn_materials')
          .select('*')
          .eq('subject_id', matched.id)
          .order('created_at', { ascending: true })

        if (!matErr && matsData) {
          setMaterials(matsData)
          // Chọn tài liệu đầu tiên thuộc category hiện tại nếu có
          const first = matsData.find((m: any) => m.category === activeCategory)
          setSelectedMaterial(first || (matsData.length > 0 ? matsData[0] : null))
          if (first) {
            setActiveCategory(first.category)
          }
        }
      } else {
        setSubject(null)
      }
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu môn học:', err)
      setSubject(null)
    } finally {
      setLoadingSubject(false)
    }
  }

  // 4. Resizer Mouse Events (Kéo chỉnh độ rộng 2 cột)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !splitContainerRef.current) return
      const containerRect = splitContainerRef.current.getBoundingClientRect()
      const newPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100
      const clamped = Math.min(Math.max(newPercentage, 25), 75)
      setLeftWidth(clamped)
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        localStorage.setItem('fepn_split_width', leftWidth.toString())
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, leftWidth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/fepn-login')
  }

  const toggleFullscreen = () => {
    if (!previewRef.current) return
    if (!document.fullscreenElement) {
      previewRef.current.requestFullscreen().catch((err) => {
        console.error('Không thể bật toàn màn hình:', err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Lọc tài liệu theo danh mục thư mục đang chọn
  const currentCategoryMaterials = useMemo(() => {
    return materials.filter((m) => m.category === activeCategory)
  }, [materials, activeCategory])

  // Chuẩn hóa đường dẫn nhúng xem trước
  const getEmbedUrl = (url: string, type?: string) => {
    if (!url) return ''

    // 1. YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = ''
      if (url.includes('v=')) {
        videoId = url.split('v=')[1]?.split('&')[0] || ''
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
      } else if (url.includes('embed/')) {
        return url
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      }
    }

    // 2. Google Drive
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`
      }
    }

    // 3. Direct PDF hoặc tài liệu khác
    if (url.endsWith('.pdf') || type === 'pdf') {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    }

    return url
  }

  // Handler: Đăng tài liệu mới (Admin only)
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject) return
    if (!newMatTitle.trim()) {
      alert('Vui lòng nhập tên tài liệu!')
      return
    }
    if (!uploadFile && !newMatUrl.trim()) {
      alert('Vui lòng chọn tệp để tải lên hoặc dán link Google Drive / YouTube!')
      return
    }

    setUploadingMaterial(true)
    try {
      let finalUrl = newMatUrl.trim()

      if (uploadFile) {
        const uploadUrl = await initGoogleDriveUpload(uploadFile.name, uploadFile.type || 'application/pdf')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, uploadFile, newMatTitle.trim())
        const fileId = typeof uploaded === 'string' ? uploaded : uploaded.id
        finalUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
      }

      const newMatItem = {
        subject_id: subject.id,
        category: newMatCategory,
        title: newMatTitle.trim(),
        description: newMatDesc.trim(),
        file_url: finalUrl,
        file_type: newMatType,
        extra_info: newMatExtra.trim() || (newMatType === 'video' ? 'Video bài giảng' : 'Tài liệu học tập'),
        created_by: user?.id,
      }

      const { data, error } = await supabase
        .from('fepn_materials')
        .insert(newMatItem)
        .select('*')
        .single()

      if (error) throw error

      const updated = [...materials, data]
      setMaterials(updated)
      setSelectedMaterial(data)
      setActiveCategory(newMatCategory)
      setShowAddMaterialModal(false)
      setNewMatTitle('')
      setNewMatDesc('')
      setNewMatUrl('')
      setNewMatExtra('')
      setUploadFile(null)
      alert(`🎉 Đã tải lên tài liệu mới thành công cho môn ${subject.name}!`)
    } catch (err: any) {
      alert('Lỗi tải tài liệu: ' + err.message)
    } finally {
      setUploadingMaterial(false)
    }
  }

  // Handler: Xóa tài liệu (Admin only)
  const handleDeleteMaterial = async (matId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${title}"?`)) return
    try {
      const { error } = await supabase.from('fepn_materials').delete().eq('id', matId)
      if (error) throw error
      const updated = materials.filter((m) => m.id !== matId)
      setMaterials(updated)
      if (selectedMaterial?.id === matId) {
        setSelectedMaterial(updated.length > 0 ? updated[0] : null)
      }
      alert('Đã xóa tài liệu thành công!')
    } catch (err: any) {
      alert('Lỗi xóa tài liệu: ' + err.message)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)
  const isAdmin = userRole === 'admin'
  const dashboardLink = '/fepn-dashboard'

  // Loading state
  if (authLoading || loadingSubject) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            <span className="font-bold text-sm tracking-wide">Đang tải học liệu môn học...</span>
          </div>
        </div>
      </div>
    )
  }

  // Môn học không tồn tại (404)
  if (!subject) {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center p-4 font-sans text-slate-900 dark:text-slate-100`}
        style={{ ...themeVars, background: isDark ? '#070B14' : '#F4F7FB' }}
      >
        <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black">Không Tìm Thấy Môn Học</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Môn học với mã <strong className="font-mono text-sky-600">{rawSlug}</strong> không tồn tại hoặc đã được chuyển dời.
            </p>
          </div>
          <Link
            href={dashboardLink}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white py-3 px-6 font-bold text-xs uppercase tracking-wider shadow transition"
          >
            <ArrowLeft className="h-4 w-4" /> Quay Lại Dashboard Môn Học
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 flex flex-col`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(2, 132, 199, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(30, 58, 138, 0.2), transparent 40%), #070B14'
          : 'radial-gradient(circle at 10% 10%, rgba(224, 242, 254, 0.6), transparent 30%), radial-gradient(circle at 90% 20%, rgba(224, 231, 255, 0.6), transparent 40%), #F4F7FB',
      }}
    >
      {/* 1. TOP NAVBAR BRANDING & NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Nút Quay lại Dashboard */}
            <Link
              href={dashboardLink}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm transition hover:scale-105"
              title="Quay lại Dashboard FEPN"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Link href={dashboardLink} className="flex items-center gap-2.5 group">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-sky-500/20 bg-white p-0.5 shadow-sm group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-black tracking-tight leading-none text-sky-950 dark:text-sky-100" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                  Tài Liệu FEPN
                </h1>
                <span className="text-[10px] text-slate-400 font-bold">UET - VNU</span>
              </div>
            </Link>

            <div className="h-5 w-px bg-black/10 dark:border-white/10 mx-1 hidden sm:block" />

            {/* Thông tin môn học trên navbar */}
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-mono font-black border border-sky-500/30">
                {subject.code}
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 line-clamp-1">
                {subject.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút co giãn nhanh 2 cột */}
            <div className="hidden md:flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLeftWidth(35)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 35 ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-400 hover:text-black dark:hover:text-white'}`}
                title="Cột trái 35% / Cột phải 65%"
              >
                35 : 65
              </button>
              <button
                type="button"
                onClick={() => setLeftWidth(45)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 45 ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-400 hover:text-black dark:hover:text-white'}`}
                title="Cột trái 45% / Cột phải 55%"
              >
                45 : 55
              </button>
              <button
                type="button"
                onClick={() => setLeftWidth(60)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 60 ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600' : 'text-slate-400 hover:text-black dark:hover:text-white'}`}
                title="Cột trái 60% / Cột phải 40%"
              >
                60 : 40
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddMaterialModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Đăng Tài Liệu</span>
              </button>
            )}

            {isAdmin && (
              <Link
                href="/fepn-admin"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105"
                title="Cổng Quản Trị FEPN & Deep Vault"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}

            <Link
              href="/fepn-recap"
              className="inline-flex items-center rounded-xl border border-sky-500/30 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-1.5 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Kỷ yếu & Hoạt động FEPN"
            >
              <span>Recap</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 shadow-sm transition"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN RESIZABLE SPLIT VIEW */}
      <div
        ref={splitContainerRef}
        className="mx-auto flex-1 w-full max-w-[1600px] flex flex-col lg:flex-row p-4 sm:p-6 gap-0 select-none overflow-hidden"
      >
        {/* ======================================================== */}
        {/* CỘT TRÁI (LEFT COLUMN): 4 FOLDER TABS & MATERIAL LIST */}
        {/* ======================================================== */}
        <div
          className="flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Header Môn học */}
          <div className="p-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-xs font-mono font-black">
                  {subject.code}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {subject.credits} Tín chỉ • {subject.semester}
                </span>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm file
                </button>
              )}
            </div>

            <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white line-clamp-1">
              {subject.name}
            </h3>
            {subject.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                {subject.description}
              </p>
            )}
          </div>

          {/* 4 FOLDER TABS */}
          <div className="grid grid-cols-4 gap-1 p-2 border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03]">
            {/* Tab 1: Slide */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('slides')
                const first = materials.find((m) => m.category === 'slides')
                if (first) setSelectedMaterial(first)
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition text-center ${
                activeCategory === 'slides'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <FolderOpen className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight">Slide Bài Giảng</span>
            </button>

            {/* Tab 2: Bài tập */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('exercises')
                const first = materials.find((m) => m.category === 'exercises')
                if (first) setSelectedMaterial(first)
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition text-center ${
                activeCategory === 'exercises'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight">Tài Liệu Bài Tập</span>
            </button>

            {/* Tab 3: Video */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('videos')
                const first = materials.find((m) => m.category === 'videos')
                if (first) setSelectedMaterial(first)
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition text-center ${
                activeCategory === 'videos'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Video className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight">Video Bài Giảng</span>
            </button>

            {/* Tab 4: Đề thi */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('exams')
                const first = materials.find((m) => m.category === 'exams')
                if (first) setSelectedMaterial(first)
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition text-center ${
                activeCategory === 'exams'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Award className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight">Tài Liệu Bài Thi</span>
            </button>
          </div>

          {/* DANH SÁCH FILE TRONG FOLDER ĐANG CHỌN (100% DATABASE) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {currentCategoryMaterials.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-slate-400">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Chưa có tài liệu nào trong thư mục này
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewMatCategory(activeCategory)
                        setShowAddMaterialModal(true)
                      }}
                      className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Đăng tài liệu đầu tiên ngay
                    </button>
                  )}
                </div>
              </div>
            ) : (
              currentCategoryMaterials.map((mat) => {
                const isSelected = selectedMaterial?.id === mat.id
                return (
                  <div
                    key={mat.id}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`group cursor-pointer rounded-2xl p-3.5 border transition-all duration-200 flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 shadow-md'
                        : 'border-black/5 dark:border-white/5 bg-white/40 dark:bg-slate-800/40 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                          mat.category === 'videos'
                            ? 'bg-rose-500/15 text-rose-600'
                            : mat.category === 'exams'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-sky-500/15 text-sky-600'
                        }`}
                      >
                        {mat.category === 'videos' ? (
                          <Video className="h-4 w-4" />
                        ) : mat.category === 'exams' ? (
                          <Award className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <h4 className={`text-xs font-bold leading-snug line-clamp-2 ${isSelected ? 'text-sky-700 dark:text-sky-300 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                          {mat.title}
                        </h4>
                        {mat.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {mat.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          {mat.extra_info && <span>{mat.extra_info}</span>}
                          {mat.created_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(mat.created_at).toLocaleDateString('vi-VN')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteMaterial(mat.id, mat.title)
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                          title="Xóa tài liệu này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <ChevronRight className={`h-4 w-4 transition ${isSelected ? 'text-sky-500 translate-x-0.5' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* DRAGGABLE RESIZER DIVIDER */}
        {/* ======================================================== */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden lg:flex w-4 items-center justify-center cursor-col-resize group relative z-10 transition hover:bg-sky-500/10"
          title="Kéo chuột sang trái hoặc phải để điều chỉnh kích cỡ 2 cột"
        >
          <div className="h-10 w-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-sky-500 transition" />
          <GripVertical className="absolute h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI (RIGHT COLUMN): LIVE PREVIEW VIEWER TRỰC TIẾP */}
        {/* ======================================================== */}
        <div
          ref={previewRef}
          className={`flex-1 mt-4 lg:mt-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
          }`}
          style={{ width: isFullscreen ? '100vw' : `${100 - leftWidth}%` }}
        >
          {selectedMaterial ? (
            <>
              {/* TOP TOOLBAR OF VIEWER */}
              <div className="flex items-center justify-between gap-3 p-3.5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="rounded-lg bg-sky-500/15 text-sky-600 px-2 py-0.5 text-[10px] font-black uppercase shrink-0">
                    {selectedMaterial.category === 'videos'
                      ? 'Video'
                      : selectedMaterial.category === 'exams'
                      ? 'Đề Thi'
                      : selectedMaterial.category === 'exercises'
                      ? 'Bài Tập'
                      : 'Slide'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-black truncate text-slate-800 dark:text-slate-100">
                    {selectedMaterial.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={selectedMaterial.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <a
                    href={selectedMaterial.file_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="Tải tệp về máy"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* LIVE VIEWER FRAME */}
              <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative min-h-[480px]">
                {selectedMaterial.category === 'videos' ? (
                  <iframe
                    src={getEmbedUrl(selectedMaterial.file_url, 'video')}
                    title={selectedMaterial.title}
                    className="w-full h-full border-none absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <iframe
                    src={getEmbedUrl(selectedMaterial.file_url, selectedMaterial.file_type || 'pdf')}
                    title={selectedMaterial.title}
                    className="w-full h-full border-none absolute inset-0"
                    allow="fullscreen"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="relative h-20 w-20 opacity-40">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black">Trình Xem Tài Liệu FEPN Trực Tiếp</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Hãy bấm chọn một slide bài giảng, tệp bài tập hoặc video từ 4 thư mục bên trái để xem trực tiếp tại đây mà không cần tải về máy.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL: ĐĂNG TÀI LIỆU MỚI (ADMIN ONLY) */}
      {/* ========================================== */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-sky-500" />
                <h3 className="font-black text-base">Đăng Tài Liệu Cho: {subject.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMaterialModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Phân loại thư mục:</label>
                <select
                  value={newMatCategory}
                  onChange={(e) => {
                    const cat = e.target.value as MaterialCategory
                    setNewMatCategory(cat)
                    if (cat === 'videos') setNewMatType('video')
                    else setNewMatType('pdf')
                  }}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold"
                >
                  <option value="slides">📁 Slide / Bài Giảng Lý Thuyết</option>
                  <option value="exercises">📝 Tài Liệu Bài Tập</option>
                  <option value="videos">🎥 Video Bài Giảng Trực Tuyến</option>
                  <option value="exams">📋 Đề Thi & Đáp Án</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Tiêu Đề Tài Liệu:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Slide Chương 1: Động lực học chất điểm"
                  value={newMatTitle}
                  onChange={(e) => setNewMatTitle(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold"
                  required
                />
              </div>

              {/* Tải tệp trực tiếp lên Google Drive */}
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  Tải tệp trực tiếp lên Google Drive (Tùy chọn):
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0])
                    }
                  }}
                  className="w-full mt-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500/10 file:text-sky-600 hover:file:bg-sky-500/20"
                />
              </div>

              {/* Dán URL */}
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  Hoặc dán Link URL (Google Drive, YouTube, Link ngoài):
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... hoặc https://youtube.com/watch?v=..."
                  value={newMatUrl}
                  onChange={(e) => setNewMatUrl(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Ghi chú bổ sung (Số trang / thời lượng):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 45 trang • ĐH Công nghệ hoặc Thời lượng 60 phút"
                  value={newMatExtra}
                  onChange={(e) => setNewMatExtra(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-bold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={uploadingMaterial}
                  className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow"
                >
                  {uploadingMaterial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Đăng Lên Hệ Thống
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
