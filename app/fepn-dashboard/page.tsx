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
  ArrowRight,
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
  Calculator,
  TrendingUp,
  LayoutGrid,
  Gift,
  Inbox,
} from 'lucide-react'
import { checkFepnAccessAsync } from '@/lib/authHelper'

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

export interface ScoredSemesterInfo {
  semId: string
  name: string
  shortName: string
  gpa: number
  totalCredits: number
  passedCredits: number
}

// Tạo slug chuẩn dạng fepn-[mã môn học]
export function getFepnSubjectSlug(sub: { code: string; id?: string }) {
  if (!sub || !sub.code) return `fepn-${sub?.id || 'mon-hoc'}`
  const clean = sub.code.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `fepn-${clean}`
}

export default function FepnDashboardMainPage() {
  const router = useRouter()
  const isDark = false
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')

  // Subjects & Materials from Database ONLY (NO Demo Data)
  const [subjects, setSubjects] = useState<FepnSubject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSemester, setSelectedSemester] = useState<string>('all')

  // Admin Add Subject Modal
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubCredits, setNewSubCredits] = useState('3')
  const [newSubSemester, setNewSubSemester] = useState('Kỳ 1')
  const [newSubDesc, setNewSubDesc] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)

  // Student GPA Mini Stats & History
  const [studentCpa, setStudentCpa] = useState<number | null>(null)
  const [studentRank, setStudentRank] = useState<string>('')
  const [studentPassedCredits, setStudentPassedCredits] = useState<number>(0)
  const [scoredSemesters, setScoredSemesters] = useState<ScoredSemesterInfo[]>([])

  // FEPN Gift Event Active State
  const [isGiftActive, setIsGiftActive] = useState<boolean>(false)

  // Mobile Bottom Nav & Feature Sheet
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false)

  const scrollToMaterials = () => {
    setSelectedSemester('all')
    const el = document.getElementById('materials-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // 1. Theme & Web Name & Favicon
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.title = 'Tài liệu FEPN - Khoa Vật lý kỹ thuật & Công nghệ Nano'
    if (typeof document !== 'undefined') {
      const iconSelectors = ["link[rel*='icon']", "link[rel='shortcut icon']", "link[rel='apple-touch-icon']"]
      let updated = false
      iconSelectors.forEach((sel) => {
        document.querySelectorAll<HTMLLinkElement>(sel).forEach((el) => {
          el.href = '/fepn-logo.png'
          updated = true
        })
      })
      if (!updated) {
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.href = '/fepn-logo.png'
        document.head.appendChild(newLink)
      }
    }
  }, [])

  // Check Gift Event Active Status
  useEffect(() => {
    const checkGiftStatus = async () => {
      try {
        const localActive = localStorage.getItem('fepn_gift_event_active')
        if (localActive !== null) {
          setIsGiftActive(localActive === 'true')
        }
        const { data, error } = await supabase
          .from('fepn_gift_events')
          .select('is_active')
          .eq('is_active', true)
          .limit(1)
        if (!error && data && data.length > 0) {
          setIsGiftActive(true)
          localStorage.setItem('fepn_gift_event_active', 'true')
        } else if (!error && data && data.length === 0) {
          setIsGiftActive(false)
          localStorage.setItem('fepn_gift_event_active', 'false')
        }
      } catch (err) {
        const localActive = localStorage.getItem('fepn_gift_event_active')
        if (localActive !== null) {
          setIsGiftActive(localActive === 'true')
        }
      }
    }
    checkGiftStatus()
  }, [])

  // Load Student GPA Summary (Đồng bộ thứ tự học kỳ & điểm từng kỳ)
  useEffect(() => {
    if (!user?.id) return

    const loadGpaData = async () => {
      // 1. Lấy danh sách học kỳ theo đúng thứ tự
      let semList: { id: string; name: string; order_index: number }[] = []
      try {
        const cachedSems = localStorage.getItem('fepn_semesters_cache')
        if (cachedSems) {
          const parsed = JSON.parse(cachedSems)
          if (Array.isArray(parsed) && parsed.length > 0) semList = parsed
        }
      } catch (e) {}

      if (semList.length === 0) {
        semList = [
          { id: 'sem-1', name: 'Học kỳ 1 (Năm 1)', order_index: 1 },
          { id: 'sem-2', name: 'Học kỳ 2 (Năm 1)', order_index: 2 },
          { id: 'sem-3', name: 'Học kỳ 3 (Năm 2)', order_index: 3 },
          { id: 'sem-4', name: 'Học kỳ 4 (Năm 2)', order_index: 4 },
          { id: 'sem-5', name: 'Học kỳ 5 (Năm 3)', order_index: 5 },
          { id: 'sem-6', name: 'Học kỳ 6 (Năm 3)', order_index: 6 },
          { id: 'sem-7', name: 'Học kỳ 7 (Năm 4)', order_index: 7 },
          { id: 'sem-8', name: 'Học kỳ 8 (Năm 4)', order_index: 8 },
        ]
      }

      // 2. Lấy dữ liệu điểm từ localStorage
      let gradesMap: Record<string, any> = {}
      try {
        const cachedGrades = localStorage.getItem(`fepn_grades_${user.id}`)
        if (cachedGrades) {
          const parsed = JSON.parse(cachedGrades)
          if (parsed && typeof parsed === 'object') {
            gradesMap = parsed
          }
        }
      } catch (e) {}

      // 3. Đồng bộ bổ sung từ Supabase nếu có mạng
      try {
        const [{ data: dbSems }, { data: dbGrades }] = await Promise.all([
          supabase.from('fepn_semesters').select('*').order('order_index', { ascending: true }),
          supabase.from('fepn_student_grades').select('semester_id, grades_data').eq('user_id', user.id),
        ])
        if (dbSems && dbSems.length > 0) semList = dbSems
        if (dbGrades && dbGrades.length > 0) {
          dbGrades.forEach((row: any) => {
            if (row.grades_data) gradesMap[row.semester_id] = row.grades_data
          })
        }
      } catch (e) {}

      // Sắp xếp thứ tự học kỳ
      semList.sort((a, b) => a.order_index - b.order_index)

      let totalCreds = 0
      let weightedSum = 0
      let passedCreds = 0
      const scored: ScoredSemesterInfo[] = []

      semList.forEach((sem) => {
        const semData = gradesMap[sem.id]
        if (semData && semData.totalCredits > 0) {
          totalCreds += semData.totalCredits
          passedCreds += semData.passedCredits || 0
          weightedSum += (semData.gpa || 0) * semData.totalCredits

          const shortName = sem.name.replace('Học kỳ ', 'Kỳ ').split(' (')[0]
          scored.push({
            semId: sem.id,
            name: sem.name,
            shortName,
            gpa: Number(semData.gpa) || 0,
            totalCredits: semData.totalCredits,
            passedCredits: semData.passedCredits || 0,
          })
        }
      })

      if (totalCreds > 0) {
        const cpa = Math.round((weightedSum / totalCreds) * 100) / 100
        setStudentCpa(cpa)
        setStudentPassedCredits(passedCreds)
        setScoredSemesters(scored)

        if (cpa >= 3.6) setStudentRank('Xuất sắc')
        else if (cpa >= 3.2) setStudentRank('Giỏi')
        else if (cpa >= 2.5) setStudentRank('Khá')
        else if (cpa >= 2.0) setStudentRank('Trung bình')
        else setStudentRank('Cần cố gắng')
      } else {
        setStudentCpa(null)
        setStudentRank('')
        setStudentPassedCredits(0)
        setScoredSemesters([])
      }
    }

    loadGpaData()
  }, [user?.id])

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
        const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role || '').toLowerCase().trim()
        const isAdmin = role === 'admin' || role === 'collab' || metaRole === 'admin' || metaRole === 'collab' || email === 'hoangbinhminh2508@gmail.com'

        const isAllowed = await checkFepnAccessAsync(currentUser, role)

        if (isAllowed) {
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
      const { data: subjectsData, error: subErr } = await supabase
        .from('fepn_subjects')
        .select('*')
        .order('code', { ascending: true })

      if (subErr) throw subErr

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/fepn-login')
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
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            <span className="font-bold text-sm tracking-wide">Đang tải FEPN Dashboard...</span>
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
              href="/fepn-login"
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
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <Lock className="h-3.5 w-3.5" /> Quyền Truy Cập Bị Giới Hạn
            </span>
            <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Yêu Cầu Email VNU hoặc Email Tên Miền FEPN
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tài khoản hiện tại của bạn là <strong className="text-rose-600 font-mono">{user?.email}</strong>. Cổng FEPN dành riêng cho sinh viên, giảng viên ĐHQGHN và các tài khoản email tên miền được cấp bởi Ban Quản Trị.
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
  // VIEW: MAIN FEPN DASHBOARD
  // ==========================================
  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 pb-32 sm:pb-20`}
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
            <Link href="/fepn-dashboard" className="flex items-center gap-3 group">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-sky-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-sky-950 dark:text-sky-100" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Tài liệu FEPN
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
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-2.5 sm:px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
              >
                <span>Thêm Môn Học Mới</span>
              </button>
            )}

            {isAdmin && (
              <Link
                href="/fepn-admin"
                className="hidden md:inline-flex items-center rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105"
                title="Cổng Quản Trị FEPN & Deep Vault"
              >
                <span>Admin</span>
              </Link>
            )}

            <Link
              href="/fepn-recap"
              className="hidden md:inline-flex items-center rounded-xl border border-sky-500/30 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-2 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Kỷ yếu & Hoạt động FEPN"
            >
              <span>Recap</span>
            </Link>

            <Link
              href="/fepn-gpa"
              className="hidden md:inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Tính điểm GPA & CPA"
            >
              <span>GPA</span>
            </Link>

            <Link
              href="/fepn-schedule"
              className="hidden md:inline-flex items-center rounded-xl border border-sky-500/30 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-2 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Thời Khóa Biểu & Lịch Học Hằng Tuần"
            >
              <span>Lịch Học</span>
            </Link>

            {(isGiftActive || isAdmin) && (
              <Link
                href="/fepn-gift"
                className={`hidden md:inline-flex relative items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition shadow-sm hover:scale-105 ${
                  isGiftActive
                    ? 'bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white font-black shadow-pink-500/25'
                    : 'border border-pink-500/30 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold'
                }`}
                title="Sự kiện Đổi Quà & Vòng Quay May Mắn FEPN"
              >
                <span>Đổi Quà</span>
                {isGiftActive && (
                  <span className="inline-flex rounded-full h-2 w-2 bg-yellow-300 shadow-xs"></span>
                )}
              </Link>
            )}

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

      {/* 2. HERO GREETING & STATS BANNER + 1/5 MINI GPA WIDGET */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-8 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 items-stretch">
          {/* KHỐI TRÁI: 4/5 CHIỀU DÀI - BANNER LỜI CHÀO & 4 Ô THỐNG KÊ */}
          <div className="lg:col-span-4 relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-600/10 via-indigo-600/10 to-transparent p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between">
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

          {/* KHỐI PHẢI: 1/5 CHIỀU DÀI - HÌNH VUÔNG NHỎ MINI GPA WIDGET */}
          {(() => {
            const latestSem = scoredSemesters.length > 0 ? scoredSemesters[scoredSemesters.length - 1] : null
            const prevSem = scoredSemesters.length > 1 ? scoredSemesters[scoredSemesters.length - 2] : null
            const gpaDiff = latestSem && prevSem ? Math.round((latestSem.gpa - prevSem.gpa) * 100) / 100 : null

            return (
              <Link
                href="/fepn-gpa"
                className="lg:col-span-1 group relative overflow-hidden rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-emerald-500/10 p-4 sm:p-5 backdrop-blur-2xl hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 transition duration-300 flex flex-col justify-between"
                title="Xem chi tiết đồ thị và tính điểm FEPN GPA"
              >
                <div>
                  {/* Header widget */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <Calculator className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                        GPA Cá Nhân
                      </span>
                    </div>
                    <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase">
                      VNU
                    </span>
                  </div>

                  {/* THÔNG TIN GPA MỚI NHẤT & GPA GẦN NHẤT */}
                  {scoredSemesters.length >= 2 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 p-2 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                      {/* GPA Mới nhất */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-tight">
                            Mới nhất
                          </span>
                          {gpaDiff !== null && (
                            <span
                              className={`text-[8.5px] font-black px-1 py-0.2 rounded font-mono ${
                                gpaDiff > 0
                                  ? 'text-emerald-600 bg-emerald-500/15'
                                  : gpaDiff < 0
                                  ? 'text-rose-600 bg-rose-500/15'
                                  : 'text-slate-500 bg-slate-500/10'
                              }`}
                              title={`Biến động so với kỳ trước: ${gpaDiff > 0 ? '+' : ''}${gpaDiff.toFixed(2)}`}
                            >
                              {gpaDiff > 0 ? `+${gpaDiff.toFixed(2)}` : gpaDiff.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
                            {latestSem?.gpa.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          {latestSem?.shortName}
                        </p>
                      </div>

                      {/* GPA Gần với mới nhất (kỳ liền trước) */}
                      <div className="border-l border-black/10 dark:border-white/10 pl-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                          Gần nhất
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-black font-mono text-slate-700 dark:text-slate-300">
                            {prevSem?.gpa.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 truncate">
                          {prevSem?.shortName}
                        </p>
                      </div>
                    </div>
                  ) : scoredSemesters.length === 1 ? (
                    <div className="mt-3 p-2 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-tight">
                          GPA Mới nhất ({latestSem?.shortName})
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">Kỳ đầu</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
                          {latestSem?.gpa.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-slate-400">/ 4.0</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5 backdrop-blur-sm text-center">
                      <p className="text-[11px] font-bold text-slate-500">Chưa nhập điểm</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Bấm để tính GPA & CPA</p>
                    </div>
                  )}

                  {/* CPA Tích lũy */}
                  <div className="flex items-center justify-between px-1 mt-2 text-[10px] font-bold">
                    <span className="text-slate-400">CPA Tích lũy:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                        {studentCpa !== null ? `${studentCpa.toFixed(2)}/4.0` : '--'}
                      </span>
                      {studentRank && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-black">
                          {studentRank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ĐỒ THỊ MINI SVG HIỆN ĐẦY ĐỦ HỌC KỲ VÀ GPA TỪNG KỲ */}
                <div className="w-full h-16 relative my-2 rounded-2xl bg-white/50 dark:bg-slate-800/50 p-1 border border-black/5 dark:border-white/5 flex items-center justify-center overflow-hidden">
                  {scoredSemesters.length > 0 ? (
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 220 75">
                      <defs>
                        <linearGradient id="miniGpaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Đường gióng mốc 4.0 và 0.0 */}
                      <line x1="16" y1="18" x2="204" y2="18" stroke="#94a3b8" strokeOpacity="0.2" strokeDasharray="2 2" />
                      <line x1="16" y1="56" x2="204" y2="56" stroke="#94a3b8" strokeOpacity="0.2" />

                      {(() => {
                        const pts = scoredSemesters
                        const n = pts.length
                        const PAD_X = n === 1 ? 110 : n === 2 ? 46 : 24
                        const getX = (i: number) => (n === 1 ? 110 : PAD_X + (i / (n - 1)) * (220 - 2 * PAD_X))
                        // y chạy từ 18 (score=4.0) đến 56 (score=0.0), h = 38
                        const getY = (score: number) => 56 - (Math.min(4.0, Math.max(0, score)) / 4.0) * 38

                        const polylinePoints = pts.map((p, i) => `${getX(i)},${getY(p.gpa)}`).join(' ')
                        const areaPath =
                          n > 1
                            ? `M ${getX(0)} ${getY(pts[0].gpa)} ` +
                              pts
                                .slice(1)
                                .map((p, i) => `L ${getX(i + 1)} ${getY(p.gpa)}`)
                                .join(' ') +
                              ` L ${getX(n - 1)} 56 L ${getX(0)} 56 Z`
                            : ''

                        return (
                          <>
                            {areaPath && <path d={areaPath} fill="url(#miniGpaGrad)" />}
                            {n > 1 && (
                              <polyline
                                points={polylinePoints}
                                fill="none"
                                stroke="#0ea5e9"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            {pts.map((p, i) => {
                              const x = getX(i)
                              const y = getY(p.gpa)
                              return (
                                <g key={p.semId}>
                                  {/* Đường gióng dọc */}
                                  <line x1={x} y1="18" x2="56" stroke="#94a3b8" strokeOpacity="0.2" strokeDasharray="1 2" />
                                  {/* Dot GPA */}
                                  <circle cx={x} cy={y} r="3" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                                  {/* Số điểm GPA từng kỳ */}
                                  <text
                                    x={x}
                                    y={y - 4}
                                    textAnchor="middle"
                                    fill="#0284c7"
                                    className="font-mono font-black"
                                    fontSize="8.5"
                                  >
                                    {p.gpa.toFixed(2)}
                                  </text>
                                  {/* Tên học kỳ */}
                                  <text
                                    x={x}
                                    y="68"
                                    textAnchor="middle"
                                    fill="#64748b"
                                    className="font-bold"
                                    fontSize="8"
                                  >
                                    {p.shortName}
                                  </text>
                                </g>
                              )
                            })}
                          </>
                        )
                      })()}
                    </svg>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                      <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                      <span>Theo dõi diễn biến điểm</span>
                    </div>
                  )}
                </div>

                {/* Footer widget */}
                <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {studentPassedCredits > 0 ? `${studentPassedCredits} tín chỉ đạt` : 'Tính điểm ngay'}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-black text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition">
                    <span>Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            )
          })()}
        </div>

        {/* 3. CONTROLS: SEARCH & SEMESTER FILTER */}
        <div id="materials-section" className="scroll-mt-20 flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên môn hoặc mã môn (vd: EPN1001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 pl-9 pr-4 py-2 text-base sm:text-xs outline-none focus:border-sky-500 transition font-medium"
            />
          </div>

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

        {/* 4. SUBJECTS GRID (DẪN ĐẾN fepn-[mã môn học]) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              Danh Sách Môn Học FEPN ({filteredSubjects.length})
            </h3>
            <span className="text-xs text-slate-400">
              Bấm vào môn học để truy cập đường dẫn riêng dạng fepn-[mã môn học]
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
                const targetSlug = getFepnSubjectSlug(sub)
                return (
                  <Link
                    key={sub.id}
                    href={`/${targetSlug}`}
                    className="group relative flex flex-col justify-between rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-md backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10"
                  >
                    <div>
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

                      <h4 className="mt-3 text-base font-black text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition leading-snug line-clamp-2">
                        {sub.name}
                      </h4>

                      {sub.description && (
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {sub.description}
                        </p>
                      )}
                    </div>

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

      {/* MODAL: THÊM MÔN HỌC MỚI (ADMIN ONLY) */}
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
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none uppercase font-mono font-bold text-base sm:text-xs"
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
                  className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold text-base sm:text-xs"
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
                    className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold text-center text-base sm:text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300">Học Kỳ:</label>
                  <select
                    value={newSubSemester}
                    onChange={(e) => setNewSubSemester(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 outline-none font-bold text-base sm:text-xs"
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

      {/* 5. MOBILE BOTTOM NAVIGATION BAR (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-6 py-2 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          {/* Nút bên trái: Lịch học (Hình lịch) */}
          <Link
            href="/fepn-schedule"
            className="flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition flex-1 py-1"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-[11px] font-bold">Lịch học</span>
          </Link>

          {/* Nút ở giữa to nhất: Tất cả tài liệu (Hình folder) */}
          <div className="relative flex-1 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={scrollToMaterials}
              className="-top-5 absolute flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/40 hover:scale-105 active:scale-95 transition border-4 border-slate-50 dark:border-slate-950"
              title="Cuộn tới tất cả tài liệu"
            >
              <FolderOpen className="h-6 w-6" />
            </button>
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 pt-8">Tất cả tài liệu</span>
          </div>

          {/* Nút bên phải: Tất cả tính năng (Hình 4 dấu chấm xếp thành hình vuông) */}
          <button
            type="button"
            onClick={() => setShowMobileMenu(true)}
            className="flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition flex-1 py-1"
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[11px] font-bold">Tất cả tính năng</span>
          </button>
        </div>
      </nav>

      {/* 6. MOBILE FEATURE DRAWER MODAL */}
      {showMobileMenu && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl border-t border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-sky-500/20 bg-white p-0.5 shadow-sm">
                  <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Tất cả tính năng
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Tài liệu FEPN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-slate-500 hover:bg-black/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List tính năng */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Link
                href="/fepn-schedule"
                onClick={() => setShowMobileMenu(false)}
                className="flex flex-col items-start p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-sky-500/10 hover:border-sky-500/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 mb-2 group-hover:scale-105 transition">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">Lịch Học</span>
                <span className="text-[10px] text-slate-400 font-medium">Thời khóa biểu sinh viên</span>
              </Link>

              <Link
                href="/fepn-gpa"
                onClick={() => setShowMobileMenu(false)}
                className="flex flex-col items-start p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-105 transition">
                  <Calculator className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">Tính Điểm GPA</span>
                <span className="text-[10px] text-slate-400 font-medium">GPA & CPA toàn khóa</span>
              </Link>

              <Link
                href="/fepn-recap"
                onClick={() => setShowMobileMenu(false)}
                className="flex flex-col items-start p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-105 transition">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">Kỷ Yếu Recap</span>
                <span className="text-[10px] text-slate-400 font-medium">Hoạt động Khoa FEPN</span>
              </Link>

              {(isGiftActive || isAdmin) && (
                <Link
                  href="/fepn-gift"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex flex-col items-start p-3.5 rounded-2xl border border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/15 transition group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/20 text-pink-600 dark:text-pink-400 mb-2 group-hover:scale-105 transition">
                    <Gift className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-pink-700 dark:text-pink-300">Đổi Quà FEPN</span>
                  <span className="text-[10px] text-slate-400 font-medium">Sự kiện & Vòng quay</span>
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/fepn-admin"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex flex-col items-start p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 transition group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2 group-hover:scale-105 transition">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-amber-700 dark:text-amber-300">Quản Trị Admin</span>
                  <span className="text-[10px] text-slate-400 font-medium">Deep Vault & CSDL</span>
                </Link>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false)
                    setShowAddSubjectModal(true)
                  }}
                  className="flex flex-col items-start p-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/15 transition text-left group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 mb-2 group-hover:scale-105 transition">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-sky-700 dark:text-sky-300">Thêm Môn Học</span>
                  <span className="text-[10px] text-slate-400 font-medium">Tạo môn học mới</span>
                </button>
              )}
            </div>

            {/* Tài khoản & Đăng xuất */}
            <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                  {user?.email}
                </p>
                <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase">
                  {isAdmin ? 'Quản Trị Viên' : 'Sinh Viên VNU'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold text-xs transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
