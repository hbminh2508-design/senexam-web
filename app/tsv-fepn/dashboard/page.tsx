'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  BookOpen,
  FolderOpen,
  FileText,
  Video,
  Award,
  Search,
  Plus,
  Trash2,
  Lock,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Sparkles,
  X,
  Layers,
  Cpu,
  Zap,
  Atom,
  Loader2,
  GraduationCap,
  Calendar,
  ChevronRight,
  Filter,
  HelpCircle,
  Clock,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export interface FepnSubject {
  id: string
  code: string
  name: string
  credits: number
  semester: string
  description?: string
  icon?: string
  created_at?: string
  slides_count?: number
  exercises_count?: number
  videos_count?: number
  exams_count?: number
  total_materials?: number
}

// Tạo slug chuẩn từ mã môn (vd: EPN1001 -> epn1001)
export function getSubjectSlug(sub: { code: string; id?: string }) {
  if (!sub || !sub.code) return sub?.id || 'mon-hoc'
  return sub.code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export default function FepnDashboardPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')

  // Subjects & Materials from Database ONLY (NO Demo Data)
  const [subjects, setSubjects] = useState<FepnSubject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSemester, setSelectedSemester] = useState<string>('all')

  // Is on subdomain (tsv.fepn.senexam.me)
  const [isSubdomain, setIsSubdomain] = useState(false)

  // Admin Add Subject Modal
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubCredits, setNewSubCredits] = useState('3')
  const [newSubSemester, setNewSubSemester] = useState('Kỳ 1')
  const [newSubDesc, setNewSubDesc] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)

  // 1. Theme and Hostname Detection
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(savedTheme === 'dark' || (!savedTheme && prefersDark))

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
          await loadSubjects()
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

  // 3. Load Subjects & Material Counts purely from Database (Zero Mock Data)
  const loadSubjects = async () => {
    setLoadingSubjects(true)
    try {
      // 3.1 Fetch Subjects
      const { data: subjectsData, error: subErr } = await supabase
        .from('fepn_subjects')
        .select('*')
        .order('code', { ascending: true })

      if (subErr) throw subErr

      // 3.2 Fetch all Materials to calculate counts per subject
      const { data: matsData } = await supabase
        .from('fepn_materials')
        .select('id, subject_id, category')

      const materialsList = matsData || []

      const enriched: FepnSubject[] = (subjectsData || []).map((sub: any) => {
        const subMats = materialsList.filter((m: any) => m.subject_id === sub.id)
        return {
          ...sub,
          slides_count: subMats.filter((m: any) => m.category === 'slides').length,
          exercises_count: subMats.filter((m: any) => m.category === 'exercises').length,
          videos_count: subMats.filter((m: any) => m.category === 'videos').length,
          exams_count: subMats.filter((m: any) => m.category === 'exams').length,
          total_materials: subMats.length,
        }
      })

      setSubjects(enriched)
    } catch (err: any) {
      console.error('Lỗi tải môn học từ DB:', err)
      setSubjects([])
    } finally {
      setLoadingSubjects(false)
    }
  }

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
    if (isSubdomain) {
      router.push('/login')
    } else {
      router.push('/new-sign')
    }
  }

  // 4. Filter Subjects by Search & Semester
  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      const matchSearch =
        !searchQuery.trim() ||
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sub.description && sub.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchSemester =
        selectedSemester === 'all' || sub.semester === selectedSemester

      return matchSearch && matchSemester
    })
  }, [subjects, searchQuery, selectedSemester])

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalSlides = 0
    let totalExercises = 0
    let totalVideos = 0
    let totalExams = 0
    subjects.forEach((s) => {
      totalSlides += s.slides_count || 0
      totalExercises += s.exercises_count || 0
      totalVideos += s.videos_count || 0
      totalExams += s.exams_count || 0
    })
    return {
      totalSubjects: subjects.length,
      totalSlides,
      totalExercises,
      totalVideos,
      totalExams,
      totalMaterials: totalSlides + totalExercises + totalVideos + totalExams,
    }
  }, [subjects])

  // Handler: Add Subject (Admin only)
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubCode.trim() || !newSubName.trim()) {
      alert('Vui lòng điền mã môn và tên môn học!')
      return
    }

    setAddingSubject(true)
    try {
      const newCode = newSubCode.trim().toUpperCase()
      const newSubjectObj = {
        code: newCode,
        name: newSubName.trim(),
        credits: parseInt(newSubCredits) || 3,
        semester: newSubSemester,
        description: newSubDesc.trim(),
        created_by: user?.id,
      }

      const { data, error } = await supabase
        .from('fepn_subjects')
        .insert(newSubjectObj)
        .select('*')
        .single()

      if (error) throw error

      const created: FepnSubject = {
        ...data,
        slides_count: 0,
        exercises_count: 0,
        videos_count: 0,
        exams_count: 0,
        total_materials: 0,
      }

      setSubjects([created, ...subjects])
      setShowAddSubjectModal(false)
      setNewSubCode('')
      setNewSubName('')
      setNewSubDesc('')
      alert(`🎉 Đã thêm thành công môn học: ${created.name} (${created.code})!`)
    } catch (err: any) {
      alert('Lỗi tạo môn học: ' + err.message)
    } finally {
      setAddingSubject(false)
    }
  }

  // Handler: Delete Subject (Admin only)
  const handleDeleteSubject = async (e: React.MouseEvent, subId: string, subName: string) => {
    e.stopPropagation()
    if (!confirm(`Bạn có chắc chắn muốn xóa môn học "${subName}"? Toàn bộ tài liệu trong môn này cũng sẽ bị xóa vĩnh viễn!`)) {
      return
    }
    try {
      const { error } = await supabase.from('fepn_subjects').delete().eq('id', subId)
      if (error) throw error
      setSubjects(subjects.filter((s) => s.id !== subId))
      alert(`Đã xóa thành công môn học: ${subName}`)
    } catch (err: any) {
      alert('Lỗi xóa môn học: ' + err.message)
    }
  }

  // Helper link to subject details
  const getSubjectLink = (sub: FepnSubject) => {
    const slug = getSubjectSlug(sub)
    if (isSubdomain) {
      return `/${slug}`
    }
    return `/tsv-fepn/${slug}`
  }

  const themeVars = getModernThemeVars('indigo', isDark)
  const isAdmin = userRole === 'admin'

  // ==========================================
  // VIEW: LOADING
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
            <span className="font-bold text-sm tracking-wide">Đang tải Dashboard FEPN...</span>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW: UNAUTHENTICATED
  // ==========================================
  if (authStatus === 'unauthenticated') {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center p-4 font-sans text-slate-900 dark:text-slate-100`}
        style={{
          ...themeVars,
          background: isDark
            ? 'radial-gradient(circle at 20% 20%, rgba(2, 132, 199, 0.2), transparent 40%), #070B14'
            : 'radial-gradient(circle at 20% 20%, rgba(224, 242, 254, 0.8), transparent 40%), #F4F7FB',
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
              Dashboard Tài Liệu FEPN
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cổng tra cứu học liệu, môn học, slide bài giảng, video và đề thi chính thức của Khoa Vật lý kỹ thuật & Công nghệ Nano.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs font-semibold text-sky-800 dark:text-sky-200 text-left flex gap-3 items-start">
            <ShieldCheck className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <strong>Xác thực tài khoản VNU:</strong>
              <p className="mt-1 opacity-90">
                Đăng nhập bằng tài khoản email <strong>@vnu.edu.vn</strong> để truy cập toàn bộ môn học và tài liệu của khoa.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={isSubdomain ? '/login' : '/new-sign'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white py-3.5 px-6 font-black uppercase text-sm tracking-wider shadow-lg shadow-sky-500/20 transition hover:scale-[1.02]"
            >
              <LogOut className="h-4 w-4 rotate-180" />
              Đăng Nhập Với Email @vnu.edu.vn
            </Link>

            <Link
              href="https://senexam.me"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-black dark:hover:text-white transition py-2"
            >
              Về Cổng Chính SenExam
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ==========================================
  // VIEW: RESTRICTED ACCESS (Non-VNU Email)
  // ==========================================
  if (authStatus === 'restricted') {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center p-4 font-sans text-slate-900 dark:text-slate-100`}
        style={{ ...themeVars, background: isDark ? '#070B14' : '#F4F7FB' }}
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
              Tài khoản hiện tại của bạn là <strong className="text-rose-600">{user?.email}</strong>. Cổng FEPN dành riêng cho sinh viên & giảng viên Đại học Quốc gia Hà Nội.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white py-3 px-6 font-bold text-xs uppercase tracking-wider shadow transition hover:scale-[1.02]"
            >
              <LogOut className="h-4 w-4" /> Đăng Xuất & Đổi Tài Khoản
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ==========================================
  // VIEW: MAIN DASHBOARD FEPN (AUTHORIZED)
  // ==========================================
  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 pb-20`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(2, 132, 199, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(30, 58, 138, 0.2), transparent 40%), #070B14'
          : 'radial-gradient(circle at 10% 10%, rgba(224, 242, 254, 0.6), transparent 30%), radial-gradient(circle at 90% 20%, rgba(224, 231, 255, 0.6), transparent 40%), #F4F7FB',
      }}
    >
      {/* 1. TOP NAVBAR BRANDING */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={isSubdomain ? '/dashboard' : '/tsv-fepn/dashboard'} className="flex items-center gap-3 group">
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

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm Môn Học Mới</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm transition hover:scale-105"
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

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

      {/* 2. HERO GREETING & STATS BANNER (Dạng Dashboard SenExam) */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-8 sm:px-6 lg:px-8 space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-600/10 via-indigo-600/10 to-transparent p-6 sm:p-8 backdrop-blur-2xl">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 border border-sky-500/30 px-3 py-1 text-xs font-black text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              <GraduationCap className="h-3.5 w-3.5" /> Không Gian Học Liệu Khoa FEPN
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Chào mừng, {user?.email?.split('@')[0]}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Tra cứu nhanh chóng toàn bộ slide bài giảng, bài tập, video thực hành và đề thi các năm của Khoa Vật lý kỹ thuật & Công nghệ Nano.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Môn Học Mở</span>
                <BookOpen className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                {stats.totalSubjects}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Slide Bài Giảng</span>
                <FolderOpen className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {stats.totalSlides}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Video Bài Giảng</span>
                <Video className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {stats.totalVideos}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Đề Thi & Đáp Án</span>
                <Award className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {stats.totalExams}
              </p>
            </div>
          </div>
        </div>

        {/* 3. CONTROLS: SEARCH & SEMESTER FILTER */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
          {/* Ô Tìm kiếm */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên môn hoặc mã môn (vd: EPN1001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 pl-9 pr-4 py-2 text-xs outline-none focus:border-sky-500 transition font-medium"
            />
          </div>

          {/* Bộ lọc học kỳ */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="h-3.5 w-3.5" /> Kỳ:
            </span>
            {['all', 'Kỳ 1', 'Kỳ 2', 'Kỳ 3', 'Kỳ 4', 'Kỳ 5', 'Kỳ 6', 'Kỳ 7', 'Kỳ 8'].map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSemester(sem)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                  selectedSemester === sem
                    ? 'bg-sky-600 text-white font-black shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {sem === 'all' ? 'Tất Cả' : sem}
              </button>
            ))}
          </div>
        </div>

        {/* 4. SUBJECTS GRID (DANH SÁCH MÔN HỌC - 100% DATABASE) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Danh Sách Môn Học ({filteredSubjects.length})
            </h3>
            <span className="text-xs text-slate-400">
              Nhấn vào môn học để xem 4 thư mục tài liệu và trình xem trực tiếp
            </span>
          </div>

          {loadingSubjects ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
              <p className="text-xs font-bold text-slate-400">Đang tải danh sách môn học FEPN...</p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/15 bg-white/40 dark:bg-slate-900/40 p-12 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-black">Chưa có môn học nào</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAdmin
                    ? 'Hiện tại chưa có môn học nào trong cơ sở dữ liệu. Nhấn nút "Thêm Môn Học Mới" ở trên để bắt đầu đăng tải môn đầu tiên!'
                    : 'Hiện tại khoa chưa cập nhật danh sách môn học. Vui lòng quay lại sau!'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  <Plus className="h-4 w-4" /> Thêm Môn Học Đầu Tiên
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSubjects.map((sub) => {
                const targetHref = getSubjectLink(sub)
                return (
                  <Link
                    key={sub.id}
                    href={targetHref}
                    className="group relative flex flex-col justify-between rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10"
                  >
                    <div>
                      {/* Badge Mã môn & Kỳ học */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2.5 py-1 text-xs font-mono font-black border border-sky-500/30">
                          {sub.code}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="rounded-lg bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {sub.credits} Tín chỉ
                          </span>
                          <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[11px] font-bold">
                            {sub.semester}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSubject(e, sub.id, sub.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition ml-1"
                              title="Xóa môn học này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tên môn học */}
                      <h4 className="mt-3 text-base font-black text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition leading-snug line-clamp-2">
                        {sub.name}
                      </h4>

                      {/* Mô tả */}
                      {sub.description && (
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {sub.description}
                        </p>
                      )}
                    </div>

                    {/* Footer: Material breakdown & Action */}
                    <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold">
                        <span className="flex items-center gap-1" title="Slide bài giảng">
                          <FolderOpen className="h-3.5 w-3.5 text-sky-500" /> {sub.slides_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Tài liệu bài tập">
                          <FileText className="h-3.5 w-3.5 text-indigo-500" /> {sub.exercises_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Video bài giảng">
                          <Video className="h-3.5 w-3.5 text-rose-500" /> {sub.videos_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Đề thi & đáp án">
                          <Award className="h-3.5 w-3.5 text-amber-500" /> {sub.exams_count || 0}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-black text-sky-600 dark:text-sky-400 group-hover:translate-x-1 transition">
                        Vào Học <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                )
              })}
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
                  placeholder="Ví dụ: EPN1001"
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
                  placeholder="Ví dụ: Vật Lý Đại Cương I (Cơ - Nhiệt)"
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
                  <label className="font-bold text-slate-600 dark:text-slate-300">Học Kỳ:</label>
                  <select
                    value={newSubSemester}
                    onChange={(e) => setNewSubSemester(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold"
                  >
                    <option value="Kỳ 1">Kỳ 1</option>
                    <option value="Kỳ 2">Kỳ 2</option>
                    <option value="Kỳ 3">Kỳ 3</option>
                    <option value="Kỳ 4">Kỳ 4</option>
                    <option value="Kỳ 5">Kỳ 5</option>
                    <option value="Kỳ 6">Kỳ 6</option>
                    <option value="Kỳ 7">Kỳ 7</option>
                    <option value="Kỳ 8">Kỳ 8</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">Mô Tả Tóm Tắt:</label>
                <textarea
                  rows={2}
                  placeholder="Mục tiêu và nội dung cơ bản của môn học..."
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
    </main>
  )
}
