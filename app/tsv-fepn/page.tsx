'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Search,
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
  Sun,
  Moon,
  ArrowLeft,
  Sparkles,
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
  FileCode,
  GraduationCap,
  ChevronDown,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

// Danh mục 4 thư mục
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
  file_type?: string // 'pdf' | 'video' | 'pptx' | 'docx' | 'link'
  extra_info?: string // số trang hoặc thời lượng
  created_at?: string
  created_by?: string
}

// Môn học mẫu mặc định cho Khoa FEPN
const DEFAULT_SUBJECTS: FepnSubject[] = [
  {
    id: 'sub_epn1001',
    code: 'EPN1001',
    name: 'Vật Lý Đại Cương I (Cơ - Nhiệt)',
    credits: 3,
    semester: 'Kỳ 1',
    description: 'Kiến thức nền tảng về cơ học Newton, động lực học chất điểm, chất lưu và nhiệt động lực học ứng dụng.',
    icon: 'Zap',
  },
  {
    id: 'sub_epn1002',
    code: 'EPN1002',
    name: 'Vật Lý Đại Cương II (Điện - Quang)',
    credits: 3,
    semester: 'Kỳ 2',
    description: 'Trường điện từ, phương trình Maxwell, sóng điện từ, quang hình và hiện tượng giao thoa tán sắc ánh sáng.',
    icon: 'Sparkles',
  },
  {
    id: 'sub_epn2001',
    code: 'EPN2001',
    name: 'Cơ Học Lượng Tử & Vật Lý Nguyên Tử',
    credits: 4,
    semester: 'Kỳ 3',
    description: 'Phương trình vi phân Schrödinger, thế thế giếng, nguyên tử Hydro, spin electron và hiệu ứng lượng tử cơ bản.',
    icon: 'Atom',
  },
  {
    id: 'sub_epn3005',
    code: 'EPN3005',
    name: 'Công Nghệ Bán Dẫn & Vi Cơ Điện Tử (MEMS)',
    credits: 3,
    semester: 'Kỳ 5',
    description: 'Quy trình quang khắc (photolithography), chế tạo cảm biến vi cơ điện tử, vật liệu bán dẫn Si, GaAs, GaN.',
    icon: 'Cpu',
  },
  {
    id: 'sub_epn3010',
    code: 'EPN3010',
    name: 'Vật Liệu Nano & Công Nghệ Chế Tạo',
    credits: 3,
    semester: 'Kỳ 6',
    description: 'Tổng hợp và đặc trưng hạt nano, ống nano carbon (CNTs), Graphene, chấm lượng tử và ứng dụng y sinh / vi điện tử.',
    icon: 'Layers',
  },
]

// Tài liệu mẫu mặc định
const DEFAULT_MATERIALS: FepnMaterial[] = [
  {
    id: 'mat_01',
    subject_id: 'sub_epn1001',
    category: 'slides',
    title: 'Bài Giảng Chương 1: Động Học & Động Lực Học Chất Điểm',
    description: 'Bộ slide bài giảng chuẩn Bộ môn Vật lý, đầy đủ ví dụ minh họa và đồ thị vector chuyển động.',
    file_url: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&embedded=true',
    file_type: 'pdf',
    extra_info: '48 trang • GS.TS FEPN',
  },
  {
    id: 'mat_02',
    subject_id: 'sub_epn1001',
    category: 'exercises',
    title: 'Tuyển Tập Bài Tập Tự Luận & Trắc Nghiệm Cơ Học Newton',
    description: 'Hệ thống bài tập kèm lời giải chi tiết phục vụ ôn thi giữa kỳ và kiểm tra thường xuyên.',
    file_url: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&embedded=true',
    file_type: 'pdf',
    extra_info: '32 bài tập có đáp án',
  },
  {
    id: 'mat_03',
    subject_id: 'sub_epn1001',
    category: 'videos',
    title: 'Video Bài Giảng: Nguyên Lý Bảo Toàn Năng Lượng & Xung Lượng',
    description: 'Ghi hình bài giảng trực tiếp tại giảng đường ĐH Công nghệ, giải thích chi tiết các hiện tượng va chạm.',
    file_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    file_type: 'video',
    extra_info: 'Thời lượng: 58 phút',
  },
  {
    id: 'mat_04',
    subject_id: 'sub_epn1001',
    category: 'exams',
    title: 'Đề Thi & Đáp Án Môn Vật Lý Đại Cương I (Kỳ 2024 - 2025)',
    description: 'Đề thi chính thức kỳ 1 năm học 2024-2025 kèm thang điểm chấm tự luận chi tiết của khoa.',
    file_url: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf&embedded=true',
    file_type: 'pdf',
    extra_info: 'Đề thi 90 phút • ĐH Công nghệ',
  },
]

export default function FepnPortalPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')

  // Môn học & Tài liệu
  const [subjects, setSubjects] = useState<FepnSubject[]>(DEFAULT_SUBJECTS)
  const [materials, setMaterials] = useState<FepnMaterial[]>(DEFAULT_MATERIALS)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(DEFAULT_SUBJECTS[0].id)
  const [activeCategory, setActiveCategory] = useState<MaterialCategory>('slides')
  const [selectedMaterial, setSelectedMaterial] = useState<FepnMaterial | null>(DEFAULT_MATERIALS[0])
  const [searchQuery, setSearchQuery] = useState('')

  // Resizable Split Pane State
  // leftWidth tính theo phần trăm (mặc định 42%)
  const [leftWidth, setLeftWidth] = useState<number>(42)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Admin Modals
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubCredits, setNewSubCredits] = useState('3')
  const [newSubSemester, setNewSubSemester] = useState('Kỳ 1')
  const [newSubDesc, setNewSubDesc] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false)
  const [newMatTitle, setNewMatTitle] = useState('')
  const [newMatCategory, setNewMatCategory] = useState<MaterialCategory>('slides')
  const [newMatDesc, setNewMatDesc] = useState('')
  const [newMatUrl, setNewMatUrl] = useState('')
  const [newMatExtra, setNewMatExtra] = useState('')
  const [newMatType, setNewMatType] = useState('pdf')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingMaterial, setUploadingMaterial] = useState(false)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // 1. Theme and Local Storage Init
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = savedTheme === 'dark' || (!savedTheme && prefersDark)
    setIsDark(dark)

    const savedWidth = localStorage.getItem('fepn_split_width')
    if (savedWidth) {
      const parsed = parseFloat(savedWidth)
      if (!isNaN(parsed) && parsed >= 25 && parsed <= 75) {
        setLeftWidth(parsed)
      }
    }
  }, [])

  // 2. Kiểm tra Authentication & Email @vnu.edu.vn
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

        // Lấy profile để kiểm tra role
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
        const isVnuEmail = email.endsWith('@vnu.edu.vn')
        const isAdmin = role === 'admin'

        // Cho phép truy cập nếu có email @vnu.edu.vn hoặc là Admin
        if (isVnuEmail || isAdmin) {
          setAuthStatus('authorized')
          await fetchDatabaseData()
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
  }, [])

  // 3. Truy vấn dữ liệu môn học & tài liệu từ Supabase (fallback mock data nếu bảng chưa có)
  const fetchDatabaseData = async () => {
    try {
      // 3.1 Fetch Subjects
      const { data: subjectsData, error: subErr } = await supabase
        .from('fepn_subjects')
        .select('*')
        .order('code', { ascending: true })

      if (!subErr && subjectsData && subjectsData.length > 0) {
        setSubjects(subjectsData)
        setSelectedSubjectId(subjectsData[0].id)
      }

      // 3.2 Fetch Materials
      const { data: matsData, error: matErr } = await supabase
        .from('fepn_materials')
        .select('*')
        .order('created_at', { ascending: false })

      if (!matErr && matsData && matsData.length > 0) {
        setMaterials(matsData)
        setSelectedMaterial(matsData[0])
      }
    } catch (e) {
      console.warn('Sử dụng dữ liệu khởi tạo mặc định cho FEPN:', e)
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
      // Giới hạn trong khoảng 25% - 75%
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/new-sign')
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

  // Lọc danh sách môn học theo ô tìm kiếm
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects
    const q = searchQuery.toLowerCase()
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q))
    )
  }, [subjects, searchQuery])

  // Môn học đang chọn
  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0]
  }, [subjects, selectedSubjectId])

  // Lọc tài liệu theo Môn học và Thư mục Tab (slides, exercises, videos, exams)
  const currentCategoryMaterials = useMemo(() => {
    return materials.filter(
      (m) => m.subject_id === activeSubject?.id && m.category === activeCategory
    )
  }, [materials, activeSubject, activeCategory])

  // Chuẩn hóa đường dẫn nhúng (Embed URL) cho PDF và Video YouTube / Drive
  const getEmbedUrl = (url: string, type?: string) => {
    if (!url) return ''

    // 1. YouTube Video
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

    // 2. Google Drive Link
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`
      }
    }

    // 3. Direct PDF hoặc URL tài liệu khác
    if (url.endsWith('.pdf') || type === 'pdf') {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    }

    return url
  }

  // Handler: Thêm môn học mới (Dành cho Admin)
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubCode.trim() || !newSubName.trim()) {
      alert('Vui lòng điền mã môn và tên môn học!')
      return
    }

    setAddingSubject(true)
    try {
      const newSub: FepnSubject = {
        id: 'sub_' + Date.now(),
        code: newSubCode.trim().toUpperCase(),
        name: newSubName.trim(),
        credits: parseInt(newSubCredits) || 3,
        semester: newSubSemester,
        description: newSubDesc.trim() || 'Môn học thuộc Khoa Vật lý kỹ thuật & Công nghệ Nano',
        icon: 'Atom',
      }

      // Ghi vào Supabase
      try {
        const { data, error } = await supabase
          .from('fepn_subjects')
          .insert({
            code: newSub.code,
            name: newSub.name,
            credits: newSub.credits,
            semester: newSub.semester,
            description: newSub.description,
            created_by: user?.id,
          })
          .select('*')
          .single()

        if (!error && data) {
          newSub.id = data.id
        }
      } catch (err) {
        console.warn('Lỗi ghi môn học vào DB, lưu cục bộ:', err)
      }

      const updated = [newSub, ...subjects]
      setSubjects(updated)
      setSelectedSubjectId(newSub.id)
      setShowAddSubjectModal(false)
      setNewSubCode('')
      setNewSubName('')
      setNewSubDesc('')
      alert(`🎉 Đã thêm thành công môn học: ${newSub.name} (${newSub.code})!`)
    } catch (err: any) {
      alert('Lỗi thêm môn học: ' + err.message)
    } finally {
      setAddingSubject(false)
    }
  }

  // Handler: Đăng tài liệu mới (Dành cho Admin)
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
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

      // Tải trực tiếp lên Google Drive nếu có file
      if (uploadFile) {
        const uploadUrl = await initGoogleDriveUpload(uploadFile.name, uploadFile.type || 'application/pdf')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, uploadFile, newMatTitle.trim())
        const fileId = typeof uploaded === 'string' ? uploaded : uploaded.id
        finalUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
      }

      const newMatItem: FepnMaterial = {
        id: 'mat_' + Date.now(),
        subject_id: activeSubject.id,
        category: newMatCategory,
        title: newMatTitle.trim(),
        description: newMatDesc.trim() || 'Tài liệu học tập chính thức do giảng viên FEPN cung cấp',
        file_url: finalUrl,
        file_type: newMatType,
        extra_info: newMatExtra.trim() || (newMatType === 'video' ? 'Video bài giảng' : 'Tài liệu học tập'),
        created_at: new Date().toISOString(),
        created_by: user?.id,
      }

      try {
        const { data, error } = await supabase
          .from('fepn_materials')
          .insert({
            subject_id: activeSubject.id,
            category: newMatCategory,
            title: newMatItem.title,
            description: newMatItem.description,
            file_url: newMatItem.file_url,
            file_type: newMatItem.file_type,
            extra_info: newMatItem.extra_info,
            created_by: user?.id,
          })
          .select('*')
          .single()

        if (!error && data) {
          newMatItem.id = data.id
        }
      } catch (err) {
        console.warn('Lỗi ghi tài liệu vào DB, lưu cục bộ:', err)
      }

      const updated = [newMatItem, ...materials]
      setMaterials(updated)
      setSelectedMaterial(newMatItem)
      setActiveCategory(newMatCategory)
      setShowAddMaterialModal(false)
      setNewMatTitle('')
      setNewMatDesc('')
      setNewMatUrl('')
      setNewMatExtra('')
      setUploadFile(null)
      alert(`🎉 Đã tải lên tài liệu mới thành công cho môn ${activeSubject.name}!`)
    } catch (err: any) {
      alert('Lỗi tải tài liệu: ' + err.message)
    } finally {
      setUploadingMaterial(false)
    }
  }

  // Handler: Xóa tài liệu (Admin)
  const handleDeleteMaterial = async (matId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${title}"?`)) return
    try {
      await supabase.from('fepn_materials').delete().eq('id', matId)
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

  // ==========================================
  // VIEW: LOADING SPINNER
  // ==========================================
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            <span className="font-bold text-sm tracking-wide">Đang xác thực Cổng Tài Liệu FEPN...</span>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW: CHƯA ĐĂNG NHẬP (UNAUTHENTICATED)
  // ==========================================
  if (authStatus === 'unauthenticated') {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center p-4 font-sans text-slate-900 dark:text-slate-100`}
        style={{
          ...themeVars,
          background: isDark
            ? 'radial-gradient(circle at 20% 20%, rgba(2, 132, 199, 0.2), transparent 40%), radial-gradient(circle at 80% 80%, rgba(30, 58, 138, 0.3), transparent 50%), #070B14'
            : 'radial-gradient(circle at 20% 20%, rgba(224, 242, 254, 0.8), transparent 40%), radial-gradient(circle at 80% 80%, rgba(224, 231, 255, 0.8), transparent 50%), #F4F7FB',
        }}
      >
        <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-900/80 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
          <div className="mx-auto relative h-24 w-24">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain drop-shadow-md" priority />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
              VNU - UET • Faculty of Engineering Physics & Nanotechnology
            </span>
            <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Cổng Tài Liệu FEPN
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Hệ thống lưu trữ học liệu, slide bài giảng, video và đề thi chính thức của Khoa Vật lý kỹ thuật & Công nghệ Nano.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-semibold text-amber-700 dark:text-amber-300 text-left flex gap-3 items-start">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>Yêu cầu xác thực tài khoản VNU:</strong>
              <p className="mt-1 opacity-90">
                Chỉ tài khoản sinh viên và giảng viên có đuôi email <strong>@vnu.edu.vn</strong> (hoặc quản trị viên) mới có quyền truy cập cổng học liệu này.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/new-sign"
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white py-3.5 px-6 font-black uppercase text-sm tracking-wider shadow-lg shadow-sky-500/20 transition hover:scale-[1.02]"
            >
              <LogOut className="h-4 w-4 rotate-180" />
              Đăng Nhập Bằng Email VNU (@vnu.edu.vn)
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-black dark:hover:text-white transition py-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Về Trang Chủ SenExam
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ==========================================
  // VIEW: TÀI KHOẢN BỊ TỪ CHỐI (RESTRICTED ACCESS)
  // ==========================================
  if (authStatus === 'restricted') {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center p-4 font-sans text-slate-900 dark:text-slate-100`}
        style={{
          ...themeVars,
          background: isDark ? '#070B14' : '#F4F7FB',
        }}
      >
        <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
          <div className="mx-auto relative h-20 w-20">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <Lock className="h-3.5 w-3.5" /> Quyền Truy Cập Bị Giới Hạn
            </span>
            <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Yêu Cầu Email @vnu.edu.vn
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tài khoản hiện tại của bạn là <strong className="text-rose-600">{user?.email}</strong>. Trang web con này dành riêng cho sinh viên & cán bộ Khoa FEPN - Đại học Quốc gia Hà Nội.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
              <HelpCircle className="h-4 w-4 text-sky-500" /> Hướng dẫn truy cập:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
              <li>Đăng xuất khỏi tài khoản cá nhân hiện tại.</li>
              <li>Đăng nhập lại bằng tài khoản email trường cấp có đuôi <strong>@vnu.edu.vn</strong> (hoặc liên hệ Admin để được cấp quyền).</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white py-3 px-6 font-bold text-xs uppercase tracking-wider shadow transition hover:scale-[1.02]"
            >
              <LogOut className="h-4 w-4" /> Đăng Xuất & Đổi Tài Khoản
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-black dark:hover:text-white transition py-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Về Trang Chủ SenExam
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ==========================================
  // VIEW CHÍNH: CỔNG TÀI LIỆU FEPN (AUTHORIZED)
  // ==========================================
  const isAdmin = userRole === 'admin'

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
      {/* 1. TOP NAVBAR BRANDING */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
          {/* LOGO & BRAND */}
          <div className="flex items-center gap-3">
            <Link href="/tsv-fepn" className="flex items-center gap-3 group">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-sky-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-sky-950 dark:text-sky-100" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Tài Liệu FEPN
                  </h1>
                  <span className="rounded-md bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">
                    UET - VNU
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Khoa Vật lý kỹ thuật & Công nghệ Nano
                </p>
              </div>
            </Link>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick split width presets */}
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

            {/* Admin Buttons */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Môn Học Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đăng Tài Liệu</span>
                </button>
              </div>
            )}

            {/* Dark Mode */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm transition hover:scale-105"
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-black/10 dark:border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none">{user?.email?.split('@')[0]}</p>
                <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase">
                  {isAdmin ? 'Quản Trị Viên' : 'Sinh Viên VNU'}
                </span>
              </div>

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
        </div>
      </header>

      {/* 2. SUBJECTS BAR (CHỌN MÔN HỌC) */}
      <section className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3">
          {/* Danh sách cuộn ngang các môn học */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full sm:max-w-[70%]">
            <span className="text-xs font-bold text-slate-400 shrink-0 uppercase tracking-wider flex items-center gap-1 mr-1">
              <BookOpen className="h-3.5 w-3.5 text-sky-500" /> Môn học:
            </span>

            {filteredSubjects.map((sub) => {
              const isActive = sub.id === activeSubject?.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(sub.id)
                    // Reset selected material to first item in category if exists
                    const firstInCat = materials.find(
                      (m) => m.subject_id === sub.id && m.category === activeCategory
                    )
                    setSelectedMaterial(firstInCat || null)
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 font-black'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 border border-black/5 dark:border-white/10'
                  }`}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-black/20 text-white' : 'bg-sky-500/10 text-sky-600'}`}>
                    {sub.code}
                  </span>
                  <span>{sub.name}</span>
                </button>
              )
            })}
          </div>

          {/* Ô tìm kiếm môn học */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm môn học FEPN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-sky-500 transition"
            />
          </div>
        </div>
      </section>

      {/* 3. MAIN WORKSPACE: RESIZABLE 2-COLUMN SPLIT VIEW */}
      <div
        ref={splitContainerRef}
        className="mx-auto flex-1 w-full max-w-[1600px] flex flex-col lg:flex-row p-4 sm:p-6 gap-0 select-none overflow-hidden"
      >
        {/* ======================================================== */}
        {/* CỘT TRÁI (LEFT COLUMN): 4 FOLDERS & MATERIAL LIST */}
        {/* ======================================================== */}
        <div
          className="flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Header Môn học hiện tại */}
          <div className="p-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 px-2 py-0.5 text-xs font-mono font-black">
                  {activeSubject?.code}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {activeSubject?.credits} Tín chỉ • {activeSubject?.semester}
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

            <h2 className="mt-1 text-base font-black text-slate-900 dark:text-white line-clamp-1">
              {activeSubject?.name}
            </h2>
            {activeSubject?.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                {activeSubject.description}
              </p>
            )}
          </div>

          {/* 4 FOLDER TABS */}
          <div className="grid grid-cols-4 gap-1 p-2 border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03]">
            {/* Tab 1: Slide bài giảng */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('slides')
                const first = materials.find((m) => m.subject_id === activeSubject?.id && m.category === 'slides')
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

            {/* Tab 2: Tài liệu bài tập */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('exercises')
                const first = materials.find((m) => m.subject_id === activeSubject?.id && m.category === 'exercises')
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

            {/* Tab 3: Video bài giảng */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('videos')
                const first = materials.find((m) => m.subject_id === activeSubject?.id && m.category === 'videos')
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

            {/* Tab 4: Tài liệu bài thi */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('exams')
                const first = materials.find((m) => m.subject_id === activeSubject?.id && m.category === 'exams')
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

          {/* DANH SÁCH FILE TRONG FOLDER ĐANG CHỌN */}
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

                    {/* Actions */}
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
        {/* DRAGGABLE RESIZER DIVIDER (THANH PHÂN CÁCH ĐIỀU CHỈNH RỘNG) */}
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
                  {/* Mở tab mới */}
                  <a
                    href={selectedMaterial.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  {/* Tải xuống */}
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

                  {/* Phóng to toàn màn hình */}
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
                  // Trình phát Video
                  <iframe
                    src={getEmbedUrl(selectedMaterial.file_url, 'video')}
                    title={selectedMaterial.title}
                    className="w-full h-full border-none absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  // Trình xem PDF / Slide / Văn bản
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
            // Placeholder khi chưa chọn tài liệu
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
      {/* MODAL: THÊM MÔN HỌC MỚI (ADMIN ONLY) */}
      {/* ========================================== */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Atom className="h-5 w-5 text-sky-500" />
                <h3 className="font-black text-base">Thêm Môn Học Mới (FEPN)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Mã Môn Học:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: EPN3020"
                  value={newSubCode}
                  onChange={(e) => setNewSubCode(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none uppercase font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Tên Môn Học:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Vật Lý Thống Kê & Nhiệt Động Lực Học"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300">Số Tín Chỉ:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newSubCredits}
                    onChange={(e) => setNewSubCredits(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold text-center"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300">Kỳ Học:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Kỳ 3"
                    value={newSubSemester}
                    onChange={(e) => setNewSubSemester(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Mô Tả Tóm Tắt:</label>
                <textarea
                  rows={2}
                  placeholder="Nội dung chính của môn học..."
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-bold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={addingSubject}
                  className="w-1/2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow"
                >
                  {addingSubject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Tạo Môn Học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: ĐĂNG TÀI LIỆU MỚI (ADMIN ONLY) */}
      {/* ========================================== */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-sky-500" />
                <h3 className="font-black text-base">Đăng Tài Liệu Cho: {activeSubject?.name}</h3>
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
                  placeholder="Ví dụ: Slide Chương 3: Phương trình vi phân Schrödinger"
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

              {/* Hoặc Dán URL Drive / YouTube */}
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
                  placeholder="Ví dụ: 36 trang • GS. Nguyễn Văn A hoặc Thời lượng 45 phút"
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
