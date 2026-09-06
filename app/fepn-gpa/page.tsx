'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import {
  GraduationCap,
  Calculator,
  TrendingUp,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  HelpCircle,
  Settings,
  X,
  BookOpen,
  Award,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpDown,
  Download,
  AlertCircle,
  FileSpreadsheet,
  Edit2,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

// ========================================================
// 1. DATA TYPES & INTERFACES
// ========================================================
export interface Semester {
  id: string
  name: string
  order_index: number
}

export interface CourseGrade {
  id: string
  stt: number
  courseName: string
  credits: number
  scoreInput: string // chuỗi nhập vào
  letterGrade: string // A+, A, B+, B, C+, C, D+, D, F
  score4: number // 4.0, 3.7, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0
  isPassed: boolean
}

export interface SemesterData {
  scale: '10' | '4'
  courses: CourseGrade[]
  gpa: number
  totalCredits: number
  passedCredits: number
}

// Bảng điểm mặc định của hệ thống FEPN
const DEFAULT_SEMESTERS: Semester[] = [
  { id: 'sem-1', name: 'Học kỳ 1 (2023 - 2024)', order_index: 1 },
  { id: 'sem-2', name: 'Học kỳ 2 (2023 - 2024)', order_index: 2 },
  { id: 'sem-3', name: 'Học kỳ 1 (2024 - 2025)', order_index: 3 },
  { id: 'sem-4', name: 'Học kỳ 2 (2024 - 2025)', order_index: 4 },
  { id: 'sem-5', name: 'Học kỳ 1 (2025 - 2026)', order_index: 5 },
]

// ========================================================
// 2. VNU CONVERSION ENGINE (TUÂN THỦ 100% HÌNH 2)
// ========================================================
/**
 * Quy đổi từ Điểm Hệ 10 sang Điểm Chữ & Hệ 4:
 * 9.0 - 10.0: A+ (4.0) ĐẠT
 * 8.5 - 8.9:  A  (3.7) ĐẠT
 * 8.0 - 8.4:  B+ (3.5) ĐẠT
 * 7.0 - 7.9:  B  (3.0) ĐẠT
 * 6.5 - 6.9:  C+ (2.5) ĐẠT
 * 5.5 - 6.4:  C  (2.0) ĐẠT
 * 5.0 - 5.4:  D+ (1.5) ĐẠT
 * 4.0 - 4.9:  D  (1.0) ĐẠT
 * < 4.0:      F  (0.0) KHÔNG ĐẠT
 */
export function convertScore10(score: number): { letter: string; score4: number; isPassed: boolean } {
  if (isNaN(score) || score < 0) return { letter: '-', score4: 0, isPassed: false }
  const rounded = Math.round(score * 10) / 10

  if (rounded >= 9.0) return { letter: 'A+', score4: 4.0, isPassed: true }
  if (rounded >= 8.5) return { letter: 'A', score4: 3.7, isPassed: true }
  if (rounded >= 8.0) return { letter: 'B+', score4: 3.5, isPassed: true }
  if (rounded >= 7.0) return { letter: 'B', score4: 3.0, isPassed: true }
  if (rounded >= 6.5) return { letter: 'C+', score4: 2.5, isPassed: true }
  if (rounded >= 5.5) return { letter: 'C', score4: 2.0, isPassed: true }
  if (rounded >= 5.0) return { letter: 'D+', score4: 1.5, isPassed: true }
  if (rounded >= 4.0) return { letter: 'D', score4: 1.0, isPassed: true }
  return { letter: 'F', score4: 0.0, isPassed: false }
}

/**
 * Quy đổi từ Điểm Hệ 4 sang Điểm Chữ & Hệ 4 chuẩn hóa:
 */
export function convertScore4(score: number): { letter: string; score4: number; isPassed: boolean } {
  if (isNaN(score) || score < 0) return { letter: '-', score4: 0, isPassed: false }
  const rounded = Math.round(score * 100) / 100

  if (rounded >= 3.85) return { letter: 'A+', score4: 4.0, isPassed: true }
  if (rounded >= 3.6) return { letter: 'A', score4: 3.7, isPassed: true }
  if (rounded >= 3.25) return { letter: 'B+', score4: 3.5, isPassed: true }
  if (rounded >= 2.75) return { letter: 'B', score4: 3.0, isPassed: true }
  if (rounded >= 2.25) return { letter: 'C+', score4: 2.5, isPassed: true }
  if (rounded >= 1.75) return { letter: 'C', score4: 2.0, isPassed: true }
  if (rounded >= 1.25) return { letter: 'D+', score4: 1.5, isPassed: true }
  if (rounded >= 1.0) return { letter: 'D', score4: 1.0, isPassed: true }
  return { letter: 'F', score4: 0.0, isPassed: false }
}

// Xếp loại học lực VNU
export function getAcademicRank(cpa: number): { title: string; color: string; badgeBg: string } {
  if (cpa >= 3.6) return { title: 'Xuất sắc', color: 'text-amber-500', badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300' }
  if (cpa >= 3.2) return { title: 'Giỏi', color: 'text-sky-500', badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300' }
  if (cpa >= 2.5) return { title: 'Khá', color: 'text-emerald-500', badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' }
  if (cpa >= 2.0) return { title: 'Trung bình', color: 'text-yellow-500', badgeBg: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-600 dark:text-yellow-300' }
  if (cpa > 0) return { title: 'Yếu / Cần cố gắng', color: 'text-rose-500', badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300' }
  return { title: 'Chưa có điểm', color: 'text-slate-400', badgeBg: 'bg-slate-500/10 border-slate-500/20 text-slate-400' }
}

// Huy hiệu màu cho điểm chữ
export function getGradeBadge(letter: string) {
  switch (letter) {
    case 'A+':
    case 'A':
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black'
    case 'B+':
    case 'B':
      return 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400 font-bold'
    case 'C+':
    case 'C':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold'
    case 'D+':
    case 'D':
      return 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400 font-semibold'
    case 'F':
      return 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 font-black'
    default:
      return 'bg-slate-500/10 border-slate-500/20 text-slate-400'
  }
}

export default function FepnGpaPage() {
  const router = useRouter()

  // Trạng thái người dùng
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState<boolean>(true)

  // Danh sách các học kỳ
  const [semesters, setSemesters] = useState<Semester[]>(DEFAULT_SEMESTERS)
  const [activeSemId, setActiveSemId] = useState<string>('sem-1')

  // Bảng điểm từng kỳ của sinh viên: [semesterId] -> SemesterData
  const [allGrades, setAllGrades] = useState<{ [semId: string]: SemesterData }>({})

  // Các môn học FEPN để gợi ý điền nhanh
  const [fepnSubjects, setFepnSubjects] = useState<any[]>([])
  const [showFepnSubjectModal, setShowFepnSubjectModal] = useState<boolean>(false)

  // Quản trị kỳ học (Modal cho Admin)
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false)
  const [newSemesterName, setNewSemesterName] = useState<string>('')
  const [editingSemId, setEditingSemId] = useState<string | null>(null)
  const [editingSemName, setEditingSemName] = useState<string>('')

  // Modal xem bảng quy đổi điểm chuẩn VNU
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false)

  // Thông báo trạng thái lưu
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Auto-save timer ref
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)

  // ========================================================
  // 3. AUTH & INITIAL DATA LOADING
  // ========================================================
  useEffect(() => {
    const initPage = async () => {
      setAuthLoading(true)
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
          router.replace('/fepn-login')
          return
        }

        setUser(currentUser)

        // Kiểm tra quyền Admin
        let role = 'student'
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profile?.role) role = profile.role
        const email = currentUser.email?.toLowerCase() || ''
        const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role || '').toLowerCase().trim()
        const adminCheck = role === 'admin' || role === 'collab' || metaRole === 'admin' || metaRole === 'collab' || email === 'hoangbinhminh2508@gmail.com'
        setIsAdmin(adminCheck)

        // 1. Tải danh sách học kỳ
        await loadSemesters()

        // 2. Tải bảng điểm của sinh viên
        await loadStudentGrades(currentUser.id)

        // 3. Tải danh sách môn học FEPN để gợi ý
        const { data: subs } = await supabase
          .from('fepn_subjects')
          .select('id, code, name, credits')
          .order('name', { ascending: true })
        if (subs) setFepnSubjects(subs)

      } catch (err) {
        console.error('Lỗi khởi tạo FEPN GPA:', err)
      } finally {
        setAuthLoading(false)
      }
    }

    initPage()
  }, [])

  // Tải danh sách học kỳ (từ Supabase hoặc fallback localStorage)
  const loadSemesters = async () => {
    try {
      // Thử đọc từ Supabase bảng fepn_semesters
      const { data: semData, error: semErr } = await supabase
        .from('fepn_semesters')
        .select('*')
        .order('order_index', { ascending: true })

      if (!semErr && semData && semData.length > 0) {
        setSemesters(semData)
        setActiveSemId(semData[0].id)
        localStorage.setItem('fepn_semesters_cache', JSON.stringify(semData))
        return
      }
    } catch (e) {
      // Silent catch
    }

    // Fallback: localStorage hoặc Default
    try {
      const cached = localStorage.getItem('fepn_semesters_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSemesters(parsed)
          setActiveSemId(parsed[0].id)
          return
        }
      }
    } catch (e) {}

    setSemesters(DEFAULT_SEMESTERS)
    setActiveSemId(DEFAULT_SEMESTERS[0].id)
  }

  // Tải bảng điểm sinh viên
  const loadStudentGrades = async (userId: string) => {
    // 1. Đọc nhanh từ localStorage để giao diện mượt tức thì
    const localKey = `fepn_grades_${userId}`
    try {
      const cached = localStorage.getItem(localKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') {
          setAllGrades(parsed)
        }
      }
    } catch (e) {}

    // 2. Đồng bộ từ Supabase nếu có
    try {
      const { data: dbGrades } = await supabase
        .from('fepn_student_grades')
        .select('semester_id, grades_data')
        .eq('user_id', userId)

      if (dbGrades && dbGrades.length > 0) {
        setAllGrades((prev) => {
          const updated = { ...prev }
          dbGrades.forEach((row) => {
            if (row.grades_data) {
              updated[row.semester_id] = row.grades_data
            }
          })
          localStorage.setItem(localKey, JSON.stringify(updated))
          return updated
        })
      }
    } catch (e) {
      // Supabase table chưa tồn tại hoặc lỗi mạng -> tiếp tục dùng localStorage an toàn
    }
  }

  // ========================================================
  // 4. GRADE CALCULATIONS & DATA HANDLING
  // ========================================================
  // Dữ liệu của học kỳ đang chọn
  const currentSemesterData = useMemo<SemesterData>(() => {
    if (allGrades[activeSemId]) return allGrades[activeSemId]
    return {
      scale: '10',
      courses: [
        {
          id: 'course-1',
          stt: 1,
          courseName: '',
          credits: 3,
          scoreInput: '',
          letterGrade: '-',
          score4: 0,
          isPassed: false,
        },
      ],
      gpa: 0,
      totalCredits: 0,
      passedCredits: 0,
    }
  }, [allGrades, activeSemId])

  // Cập nhật điểm cho một kỳ
  const updateCurrentSemesterCourses = (courses: CourseGrade[], scale: '10' | '4') => {
    let sumWeighted = 0
    let totalCreds = 0
    let passedCreds = 0

    const updatedCourses = courses.map((course, idx) => {
      const stt = idx + 1
      const credits = Math.max(0, Number(course.credits) || 0)
      const numScore = parseFloat(course.scoreInput)

      let conv = { letter: '-', score4: 0, isPassed: false }
      if (!isNaN(numScore) && course.scoreInput.trim() !== '') {
        conv = scale === '10' ? convertScore10(numScore) : convertScore4(numScore)
      }

      if (credits > 0 && conv.letter !== '-') {
        totalCreds += credits
        sumWeighted += credits * conv.score4
        if (conv.isPassed) passedCreds += credits
      }

      return {
        ...course,
        stt,
        credits,
        letterGrade: conv.letter,
        score4: conv.score4,
        isPassed: conv.isPassed,
      }
    })

    const gpa = totalCreds > 0 ? Math.round((sumWeighted / totalCreds) * 100) / 100 : 0

    const newSemData: SemesterData = {
      scale,
      courses: updatedCourses,
      gpa,
      totalCredits: totalCreds,
      passedCredits: passedCreds,
    }

    setAllGrades((prev) => {
      const next = { ...prev, [activeSemId]: newSemData }
      if (user?.id) {
        localStorage.setItem(`fepn_grades_${user.id}`, JSON.stringify(next))
      }
      return next
    })

    // Kích hoạt auto-save
    triggerAutoSave(activeSemId, newSemData)
  }

  // Auto-save logic
  const triggerAutoSave = (semId: string, semData: SemesterData) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')

    autoSaveTimer.current = setTimeout(async () => {
      if (!user?.id) return
      try {
        await supabase.from('fepn_student_grades').upsert(
          {
            user_id: user.id,
            semester_id: semId,
            grades_data: semData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,semester_id' }
        )
      } catch (e) {
        // Fallback silently
      } finally {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    }, 1200)
  }

  // Thêm dòng môn học mới (STT tự động tăng)
  const handleAddCourse = () => {
    const nextStt = currentSemesterData.courses.length + 1
    const newCourse: CourseGrade = {
      id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      stt: nextStt,
      courseName: '',
      credits: 3,
      scoreInput: '',
      letterGrade: '-',
      score4: 0,
      isPassed: false,
    }
    updateCurrentSemesterCourses([...currentSemesterData.courses, newCourse], currentSemesterData.scale)
  }

  // Xóa môn học
  const handleDeleteCourse = (courseId: string) => {
    const remaining = currentSemesterData.courses.filter((c) => c.id !== courseId)
    if (remaining.length === 0) {
      remaining.push({
        id: `course-${Date.now()}`,
        stt: 1,
        courseName: '',
        credits: 3,
        scoreInput: '',
        letterGrade: '-',
        score4: 0,
        isPassed: false,
      })
    }
    updateCurrentSemesterCourses(remaining, currentSemesterData.scale)
  }

  // Chỉnh sửa từng trường của môn học
  const handleFieldChange = (courseId: string, field: keyof CourseGrade, value: any) => {
    const updated = currentSemesterData.courses.map((c) => {
      if (c.id === courseId) {
        return { ...c, [field]: value }
      }
      return c
    })
    updateCurrentSemesterCourses(updated, currentSemesterData.scale)
  }

  // Chuyển đổi hệ điểm (Hệ 10 <=> Hệ 4)
  const handleScaleToggle = (newScale: '10' | '4') => {
    if (newScale === currentSemesterData.scale) return
    updateCurrentSemesterCourses(currentSemesterData.courses, newScale)
  }

  // Nhập nhanh từ danh sách môn học FEPN
  const handleSelectFepnSubject = (subject: any) => {
    // Kiểm tra xem môn này đã có trong kỳ chưa
    const exists = currentSemesterData.courses.some(
      (c) => c.courseName.toLowerCase() === subject.name.toLowerCase()
    )
    if (exists) {
      alert(`Môn "${subject.name}" đã có trong bảng điểm của kỳ này!`)
      return
    }

    // Nếu dòng đầu tiên đang trống thì điền vào đó
    const emptyFirstIndex = currentSemesterData.courses.findIndex(
      (c) => !c.courseName && !c.scoreInput
    )

    let updatedCourses = [...currentSemesterData.courses]
    if (emptyFirstIndex !== -1) {
      updatedCourses[emptyFirstIndex] = {
        ...updatedCourses[emptyFirstIndex],
        courseName: `${subject.code} - ${subject.name}`,
        credits: subject.credits || 3,
      }
    } else {
      updatedCourses.push({
        id: `course-${Date.now()}`,
        stt: updatedCourses.length + 1,
        courseName: `${subject.code} - ${subject.name}`,
        credits: subject.credits || 3,
        scoreInput: '',
        letterGrade: '-',
        score4: 0,
        isPassed: false,
      })
    }

    updateCurrentSemesterCourses(updatedCourses, currentSemesterData.scale)
    setShowFepnSubjectModal(false)
  }

  // ========================================================
  // 5. CUMULATIVE STATS & TIMELINE CHART DATA
  // ========================================================
  const statsOverview = useMemo(() => {
    let totalAllCredits = 0
    let totalPassedCredits = 0
    let weightedAllSum = 0

    const semesterPoints: { semId: string; name: string; gpa: number; cpaSoFar: number; credits: number }[] = []

    semesters.forEach((sem) => {
      const data = allGrades[sem.id]
      if (data && data.totalCredits > 0) {
        totalAllCredits += data.totalCredits
        totalPassedCredits += data.passedCredits
        weightedAllSum += data.gpa * data.totalCredits

        const cpaSoFar = Math.round((weightedAllSum / totalAllCredits) * 100) / 100

        semesterPoints.push({
          semId: sem.id,
          name: sem.name,
          gpa: data.gpa,
          cpaSoFar,
          credits: data.passedCredits,
        })
      }
    })

    const cumulativeCpa = totalAllCredits > 0 ? Math.round((weightedAllSum / totalAllCredits) * 100) / 100 : 0
    const academicRank = getAcademicRank(cumulativeCpa)

    return {
      cumulativeCpa,
      totalAllCredits,
      totalPassedCredits,
      academicRank,
      semesterPoints,
    }
  }, [semesters, allGrades])

  // ========================================================
  // 6. ADMIN SEMESTER ACTIONS (MỞ KỲ, ĐẶT TÊN, SỬA, XÓA)
  // ========================================================
  const handleAddSemester = async () => {
    if (!newSemesterName.trim()) return

    const newSem: Semester = {
      id: `sem-${Date.now()}`,
      name: newSemesterName.trim(),
      order_index: semesters.length + 1,
    }

    const updated = [...semesters, newSem]
    setSemesters(updated)
    setNewSemesterName('')
    setActiveSemId(newSem.id)

    localStorage.setItem('fepn_semesters_cache', JSON.stringify(updated))

    try {
      await supabase.from('fepn_semesters').insert([
        {
          id: newSem.id,
          name: newSem.name,
          order_index: newSem.order_index,
        },
      ])
    } catch (e) {}
  }

  const handleUpdateSemesterName = async (semId: string) => {
    if (!editingSemName.trim()) return

    const updated = semesters.map((s) => (s.id === semId ? { ...s, name: editingSemName.trim() } : s))
    setSemesters(updated)
    setEditingSemId(null)
    setEditingSemName('')

    localStorage.setItem('fepn_semesters_cache', JSON.stringify(updated))

    try {
      await supabase.from('fepn_semesters').update({ name: editingSemName.trim() }).eq('id', semId)
    } catch (e) {}
  }

  const handleDeleteSemester = async (semId: string, semName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa kỳ "${semName}" không? Các môn học trong kỳ này sẽ bị gỡ bỏ.`)) return

    const updated = semesters.filter((s) => s.id !== semId)
    if (updated.length === 0) {
      alert('Phải giữ lại ít nhất 1 học kỳ!')
      return
    }

    setSemesters(updated)
    if (activeSemId === semId) setActiveSemId(updated[0].id)

    localStorage.setItem('fepn_semesters_cache', JSON.stringify(updated))

    try {
      await supabase.from('fepn_semesters').delete().eq('id', semId)
    } catch (e) {}
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/fepn-login')
  }

  // ========================================================
  // RENDER
  // ========================================================
  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 ${bodyFont.className}`}>
      {/* 1. HEADER ĐỒNG BỘ FEPN */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Nút quay lại giống ở các môn học */}
            <Link
              href="/fepn-dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition shadow-sm"
              title="Quay lại Dashboard FEPN"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Link
              href="/fepn-dashboard"
              className="flex items-center gap-2.5 transition hover:opacity-90 group"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-sky-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    FEPN GPA
                  </span>
                  <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-black text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    VNU - UET
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Tính điểm học kỳ & Điểm tích lũy toàn khóa
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/fepn-dashboard"
              className="inline-flex items-center rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-3 py-2 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Về FEPN Dashboard"
            >
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link
              href="/fepn-recap"
              className="inline-flex items-center rounded-xl border border-sky-500/30 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-2 text-xs font-bold transition shadow-sm hover:scale-105"
              title="Kỷ yếu & Hoạt động FEPN"
            >
              <span>Recap</span>
            </Link>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="inline-flex items-center rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-3 py-2 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105"
                title="Quản lý mở kỳ học dành cho Admin"
              >
                <span className="hidden md:inline">Mở Kỳ Học (Admin)</span>
              </button>
            )}

            {isAdmin && (
              <Link
                href="/fepn-admin"
                className="inline-flex items-center rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105"
                title="Cổng Quản Trị FEPN & Deep Vault"
              >
                <span className="hidden md:inline">Admin</span>
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

      {/* 2. MAIN CONTAINER */}
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* ======================================================== */}
        {/* PHẦN 1: THỐNG KÊ TỔNG QUAN & ĐỒ THỊ BIẾN ĐỘNG ĐIỂM      */}
        {/* ======================================================== */}
        <section className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-600/10 via-indigo-600/10 to-transparent p-6 sm:p-8 backdrop-blur-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 border border-sky-500/30 px-3 py-1 text-xs font-black text-sky-700 dark:text-sky-300 uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5" /> Biểu Đồ Biến Động Điểm Toàn Khóa
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                Bảng Điểm & Diễn Biến Học Tập FEPN
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Theo dõi GPA từng học kỳ và CPA tích lũy chuẩn quy chế đào tạo Đại học Quốc gia Hà Nội.
              </p>
            </div>

            {/* Thẻ Điểm CPA Tích Lũy Nổi Bật */}
            <div className="flex items-center gap-4 bg-white/70 dark:bg-slate-900/70 border border-black/5 dark:border-white/10 rounded-2xl p-4 shadow-sm backdrop-blur-xl shrink-0">
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CPA Tích Lũy Toàn Khóa</p>
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-sky-600 dark:text-sky-400">
                    {statsOverview.cumulativeCpa.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-slate-400">/ 4.0</span>
                </div>
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black ${statsOverview.academicRank.badgeBg}`}>
                  <Award className="h-3 w-3" />
                  <span>Xếp loại: {statsOverview.academicRank.title}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 THẺ CHỈ SỐ NHANH */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">GPA Kỳ Hiện Tại</span>
              <p className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                {currentSemesterData.gpa.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{semesters.find(s => s.id === activeSemId)?.name}</p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Tín Chỉ Kỳ Hiện Tại</span>
              <p className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {currentSemesterData.passedCredits} <span className="text-xs font-normal text-slate-400">/ {currentSemesterData.totalCredits} TC</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Đã đạt chuẩn</p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Tổng Tín Chỉ Tích Lũy</span>
              <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {statsOverview.totalPassedCredits} <span className="text-xs font-normal text-slate-400">/ {statsOverview.totalAllCredits} TC</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Toàn khóa học</p>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-xl">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Số Kỳ Đã Tính Điểm</span>
              <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {statsOverview.semesterPoints.length} <span className="text-xs font-normal text-slate-400">/ {semesters.length} Kỳ</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Dữ liệu ghi nhận</p>
            </div>
          </div>

          {/* ĐỒ THỊ BIỂU DIỄN BIẾN ĐỘNG GPA (SVG INTERACTIVE) */}
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Diễn biến GPA từng kỳ & CPA tích lũy
                </span>
                <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
                  (Rê chuột vào điểm mốc để xem chi tiết)
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
                  <span className="text-slate-600 dark:text-slate-300">GPA Kỳ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600 dark:text-slate-300">CPA Tích Lũy</span>
                </div>
              </div>
            </div>

            {statsOverview.semesterPoints.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[600px] h-56 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="gpaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Các đường mốc tham chiếu VNU (4.0, 3.6, 3.2, 2.5, 2.0) */}
                    {/* Mốc 4.0 */}
                    <line x1="40" y1="10" x2="780" y2="10" stroke="#94a3b8" strokeOpacity="0.2" strokeDasharray="4" />
                    <text x="5" y="14" fill="#94a3b8" fontSize="10" fontWeight="bold">4.0</text>

                    {/* Mốc 3.6 - Xuất sắc */}
                    <line x1="40" y1="30" x2="780" y2="30" stroke="#f59e0b" strokeOpacity="0.3" strokeDasharray="3" />
                    <text x="785" y="33" fill="#f59e0b" fontSize="9" fontWeight="bold">3.6 Xuất sắc</text>

                    {/* Mốc 3.2 - Giỏi */}
                    <line x1="40" y1="50" x2="780" y2="50" stroke="#0ea5e9" strokeOpacity="0.3" strokeDasharray="3" />
                    <text x="785" y="53" fill="#0ea5e9" fontSize="9" fontWeight="bold">3.2 Giỏi</text>

                    {/* Mốc 2.5 - Khá */}
                    <line x1="40" y1="85" x2="780" y2="85" stroke="#10b981" strokeOpacity="0.3" strokeDasharray="3" />
                    <text x="785" y="88" fill="#10b981" fontSize="9" fontWeight="bold">2.5 Khá</text>

                    {/* Mốc 2.0 - Trung bình */}
                    <line x1="40" y1="110" x2="780" y2="110" stroke="#eab308" strokeOpacity="0.25" strokeDasharray="3" />
                    <text x="785" y="113" fill="#eab308" fontSize="9" fontWeight="bold">2.0 TB</text>

                    {/* Mốc 0 */}
                    <line x1="40" y1="170" x2="780" y2="170" stroke="#94a3b8" strokeOpacity="0.3" />
                    <text x="15" y="174" fill="#94a3b8" fontSize="10" fontWeight="bold">0.0</text>

                    {/* Tọa độ tính toán SVG:
                        X chạy từ 70 đến 750
                        Y: y = 170 - (score / 4.0) * 160
                    */}
                    {(() => {
                      const pts = statsOverview.semesterPoints
                      const n = pts.length
                      const getX = (i: number) => n === 1 ? 400 : 70 + (i / (n - 1)) * 680
                      const getY = (score: number) => 170 - Math.min(4.0, Math.max(0, score)) * 40

                      // Đường GPA
                      const gpaPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.gpa)}`).join(' ')
                      const gpaAreaPath = `${gpaPath} L ${getX(n - 1)} 170 L ${getX(0)} 170 Z`

                      // Đường CPA
                      const cpaPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.cpaSoFar)}`).join(' ')

                      return (
                        <>
                          {/* Diện tích tô mờ GPA */}
                          <path d={gpaAreaPath} fill="url(#gpaGradient)" />

                          {/* Đường GPA nét liền */}
                          <path d={gpaPath} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Đường CPA nét đứt amber */}
                          <path d={cpaPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round" />

                          {/* Các điểm nút GPA */}
                          {pts.map((p, i) => {
                            const cx = getX(i)
                            const cy = getY(p.gpa)
                            return (
                              <g key={`gpa-dot-${i}`} className="group cursor-pointer">
                                <circle cx={cx} cy={cy} r="6" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2.5" className="transition group-hover:scale-150" />
                                <text x={cx} y={cy - 10} textAnchor="middle" fill="#0284c7" fontSize="11" fontWeight="bold">
                                  {p.gpa.toFixed(2)}
                                </text>
                                <text x={cx} y="190" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">
                                  {p.name.replace('Học kỳ ', 'Kỳ ')}
                                </text>
                              </g>
                            )
                          })}

                          {/* Các điểm nút CPA */}
                          {pts.map((p, i) => {
                            const cx = getX(i)
                            const cy = getY(p.cpaSoFar)
                            return (
                              <g key={`cpa-dot-${i}`} className="group cursor-pointer">
                                <circle cx={cx} cy={cy} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" className="transition group-hover:scale-150" />
                              </g>
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <TrendingUp className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-slate-500">Chưa có dữ liệu điểm học kỳ</p>
                <p className="text-xs text-slate-400 mt-1">Hãy nhập môn học và số điểm bên dưới để bắt đầu vẽ biểu đồ học tập của bạn.</p>
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* PHẦN 2: BỘ CHỌN KỲ HỌC & BẢNG ĐIỂN MÔN DÀNH CHO SINH VIÊN */}
        {/* ======================================================== */}
        <section className="space-y-4">
          
          {/* THANH CHỌN HỌC KỲ (TABS CUỘN NGANG) */}
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Calendar className="h-3.5 w-3.5" /> Học Kỳ:
              </span>
              {semesters.map((sem) => {
                const isActive = activeSemId === sem.id
                const semData = allGrades[sem.id]
                const hasScore = semData && semData.totalCredits > 0

                return (
                  <button
                    key={sem.id}
                    type="button"
                    onClick={() => setActiveSemId(sem.id)}
                    className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shrink-0 transition shadow-sm ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20'
                        : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>{sem.name}</span>
                    {hasScore && (
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-black font-mono ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {semData.gpa.toFixed(2)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Nút mở nhanh bảng quy đổi chuẩn VNU */}
            <button
              type="button"
              onClick={() => setShowScaleModal(true)}
              className="inline-flex items-center px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold shrink-0 hover:bg-sky-100 transition shadow-sm"
            >
              <span>Tra Cứu Thang Điểm VNU</span>
            </button>
          </div>

          {/* BẢNG ĐIỀN ĐIỂM DÀNH CHO SINH VIÊN */}
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 sm:p-6 backdrop-blur-2xl shadow-sm space-y-6">
            
            {/* THANH ĐIỀU KHIỂN ĐẦU BẢNG: CHỌN HỆ 10 / HỆ 4 & NÚT THAO TÁC */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Hệ Thống Nhập Điểm:</span>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => handleScaleToggle('10')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      currentSemesterData.scale === '10'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                        : 'text-slate-500 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Điểm Hệ 10 (Chuẩn)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScaleToggle('4')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      currentSemesterData.scale === '4'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    Điểm Hệ 4
                  </button>
                </div>
              </div>

              {/* Tình trạng lưu & Các nút tác vụ nhanh */}
              <div className="flex items-center gap-2">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-bold animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Đang tự động lưu...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu an toàn
                  </span>
                )}

                {fepnSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFepnSubjectModal(true)}
                    className="inline-flex items-center rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-3 py-2 text-xs font-bold transition shadow-sm"
                    title="Điền nhanh các môn học của Khoa FEPN"
                  >
                    <span>Thêm Môn FEPN</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddCourse}
                  className="inline-flex items-center rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
                >
                  <span>Thêm Môn Học</span>
                </button>
              </div>
            </div>

            {/* BẢNG ĐIỀN ĐIỂM CHI TIẾT */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3 w-14 text-center">STT</th>
                    <th className="py-3 px-4 min-w-[240px]">Tên Học Phần</th>
                    <th className="py-3 px-3 w-28 text-center">Số Tín Chỉ</th>
                    <th className="py-3 px-3 w-36 text-center">
                      Điểm ({currentSemesterData.scale === '10' ? 'Hệ 10' : 'Hệ 4'})
                    </th>
                    <th className="py-3 px-3 w-28 text-center">Điểm Chữ</th>
                    <th className="py-3 px-3 w-32 text-center">Quy Đổi Hệ 4</th>
                    <th className="py-3 px-3 w-16 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 text-xs font-medium">
                  {currentSemesterData.courses.map((course, idx) => (
                    <tr key={course.id} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      {/* Cột 1: STT Tự động tăng */}
                      <td className="py-3 px-3 text-center font-bold text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Cột 2: Tên Học Phần */}
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          placeholder="Nhập tên môn học (vd: Đại số tuyến tính, Vật lí đại cương)..."
                          value={course.courseName}
                          onChange={(e) => handleFieldChange(course.id, 'courseName', e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 px-3 py-2 text-xs outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition font-medium"
                        />
                      </td>

                      {/* Cột 3: Số Tín Chỉ */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={course.credits || ''}
                          onChange={(e) => handleFieldChange(course.id, 'credits', parseInt(e.target.value) || 0)}
                          className="w-20 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 px-2 py-2 text-xs text-center outline-none focus:border-sky-500 font-bold font-mono transition"
                        />
                      </td>

                      {/* Cột 4: Điểm (Hệ 10 hoặc Hệ 4) */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={currentSemesterData.scale === '10' ? '10' : '4'}
                          placeholder={currentSemesterData.scale === '10' ? 'vd: 8.5' : 'vd: 3.7'}
                          value={course.scoreInput}
                          onChange={(e) => handleFieldChange(course.id, 'scoreInput', e.target.value)}
                          className="w-28 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 px-2 py-2 text-xs text-center font-black font-mono outline-none focus:border-sky-500 text-sky-600 dark:text-sky-400 transition"
                        />
                      </td>

                      {/* Cột 5: Điểm Chữ (Tự động theo Hình 2) */}
                      <td className="py-3 px-3 text-center">
                        {course.letterGrade !== '-' ? (
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs border ${getGradeBadge(course.letterGrade)}`}>
                            {course.letterGrade}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Cột 6: Quy đổi Hệ 4 */}
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {course.letterGrade !== '-' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={course.isPassed ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-rose-500 font-black'}>
                              {course.score4.toFixed(1)}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              course.isPassed
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {course.isPassed ? 'Đạt' : 'F'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Cột 7: Thao tác xóa */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                          title="Xóa dòng môn học này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TỔNG KẾT DƯỚI CHÂN BẢNG ĐIỂM */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={handleAddCourse}
                className="inline-flex items-center text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                <span>+ Thêm Môn Học Mới</span>
              </button>

              <div className="flex flex-wrap items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-400 font-bold mr-1.5">Tín chỉ đăng ký:</span>
                  <span className="font-black font-mono text-slate-800 dark:text-slate-200">
                    {currentSemesterData.totalCredits} TC
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold mr-1.5">Tín chỉ đạt:</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {currentSemesterData.passedCredits} TC
                  </span>
                </div>
                <div className="bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-xl">
                  <span className="text-sky-700 dark:text-sky-300 font-bold mr-1.5">GPA Học Kỳ:</span>
                  <span className="font-black font-mono text-base text-sky-600 dark:text-sky-400">
                    {currentSemesterData.gpa.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* ======================================================== */}
      {/* MODAL 1: BẢNG QUY ĐỔI ĐIỂM CHUẨN VNU (HÌNH 2)            */}
      {/* ======================================================== */}
      {showScaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-sky-500/30 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                  <Award className="h-4 w-4" />
                </div>
                <h3 className="text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                  Thang Điểm Hệ 4 & Thang Điểm Hệ Chữ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScaleModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-black dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Quy chuẩn thang điểm đánh giá học tập theo quy chế đào tạo Đại học Quốc gia Hà Nội (VNU):
            </p>

            <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-sky-500/10 text-sky-700 dark:text-sky-300 font-black border-b border-black/10 dark:border-white/10">
                    <th className="py-2.5 px-3">Loại</th>
                    <th className="py-2.5 px-3">Điểm Hệ 10</th>
                    <th className="py-2.5 px-3">Điểm Hệ Chữ</th>
                    <th className="py-2.5 px-3">Điểm Hệ 4</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td rowSpan={8} className="py-2 px-3 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-r border-black/10 dark:border-white/10">
                      ĐẠT
                    </td>
                    <td className="py-2 px-3 font-mono">9,0 – 10,0</td>
                    <td className="py-2 px-3 font-black text-emerald-600">A+</td>
                    <td className="py-2 px-3 font-mono font-bold">4,0</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">8,5 – 8,9</td>
                    <td className="py-2 px-3 font-black text-emerald-600">A</td>
                    <td className="py-2 px-3 font-mono font-bold">3,7</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">8,0 – 8,4</td>
                    <td className="py-2 px-3 font-black text-sky-600">B+</td>
                    <td className="py-2 px-3 font-mono font-bold">3,5</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">7,0 – 7,9</td>
                    <td className="py-2 px-3 font-black text-sky-600">B</td>
                    <td className="py-2 px-3 font-mono font-bold">3,0</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">6,5 – 6,9</td>
                    <td className="py-2 px-3 font-black text-amber-600">C+</td>
                    <td className="py-2 px-3 font-mono font-bold">2,5</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">5,5 – 6,4</td>
                    <td className="py-2 px-3 font-black text-amber-600">C</td>
                    <td className="py-2 px-3 font-mono font-bold">2,0</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">5,0 – 5,4</td>
                    <td className="py-2 px-3 font-black text-orange-600">D+</td>
                    <td className="py-2 px-3 font-mono font-bold">1,5</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono">4,0 – 4,9</td>
                    <td className="py-2 px-3 font-black text-orange-600">D</td>
                    <td className="py-2 px-3 font-mono font-bold">1,0</td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] bg-rose-500/5">
                    <td className="py-2 px-3 font-black text-rose-600 border-r border-black/10 dark:border-white/10">
                      KHÔNG ĐẠT
                    </td>
                    <td className="py-2 px-3 font-mono text-rose-600">&lt; 4</td>
                    <td className="py-2 px-3 font-black text-rose-600">F</td>
                    <td className="py-2 px-3 font-mono font-bold text-rose-600">0</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl bg-sky-500/10 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-bold text-sky-700 dark:text-sky-300">Xếp loại tốt nghiệp toàn khóa (CPA):</p>
              <p>• Xuất sắc: 3.60 – 4.00 &nbsp;|&nbsp; • Giỏi: 3.20 – 3.59</p>
              <p>• Khá: 2.50 – 3.19 &nbsp;|&nbsp; • Trung bình: 2.00 – 2.49</p>
            </div>

            <button
              type="button"
              onClick={() => setShowScaleModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: GỢI Ý ĐIỀN NHANH MÔN HỌC FEPN                   */}
      {/* ======================================================== */}
      {showFepnSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-sky-500/30 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-sky-500" />
                <h3 className="text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                  Danh Sách Môn Học FEPN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFepnSubjectModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-black dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Chọn môn học để tự động điền Tên học phần và Số tín chỉ vào bảng điểm:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {fepnSubjects.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => handleSelectFepnSubject(sub)}
                  className="flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-500/30 cursor-pointer transition group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-xs font-bold">
                        {sub.code}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {sub.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {sub.credits || 3} Tín chỉ
                    </span>
                    <Plus className="h-4 w-4 text-sky-500 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowFepnSubjectModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: QUẢN LÝ MỞ KỲ HỌC DÀNH CHO ADMIN                */}
      {/* ======================================================== */}
      {showAdminModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-indigo-500/30 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                  Quản Lý Mở Kỳ Học (Quyền Admin)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-black dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* FORM THÊM KỲ MỚI */}
            <div className="space-y-2 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
              <label className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                + Mở Thêm Học Kỳ Mới
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="vd: Học kỳ 2 (2025 - 2026), Kỳ hè 2025..."
                  value={newSemesterName}
                  onChange={(e) => setNewSemesterName(e.target.value)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddSemester}
                  disabled={!newSemesterName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black transition shrink-0"
                >
                  Mở Kỳ
                </button>
              </div>
            </div>

            {/* DANH SÁCH CÁC KỲ HIỆN TẠI */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Danh sách học kỳ sinh viên được chọn ({semesters.length}):
              </p>
              {semesters.map((sem, idx) => (
                <div
                  key={sem.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50"
                >
                  {editingSemId === sem.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingSemName}
                        onChange={(e) => setEditingSemName(e.target.value)}
                        className="flex-1 rounded-lg border border-indigo-500 px-2.5 py-1 text-xs outline-none bg-white dark:bg-slate-900"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateSemesterName(sem.id)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSemId(null)
                          setEditingSemName('')
                        }}
                        className="px-2 py-1 text-xs text-slate-400"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-[11px] font-bold font-mono text-slate-400">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {sem.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {editingSemId !== sem.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSemId(sem.id)
                          setEditingSemName(sem.name)
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition"
                        title="Đổi tên kỳ này"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteSemester(sem.id, sem.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition"
                      title="Xóa kỳ này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAdminModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold transition"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
