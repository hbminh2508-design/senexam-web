'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  GraduationCap,
  Plus,
  KeyRound,
  FileText,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  School,
  ChevronRight,
  BookOpen,
  Calendar,
  Sparkles,
  ShieldCheck,
  Eye,
  Play,
  FolderOpen,
  Megaphone,
  ExternalLink,
  Download,
  AlertTriangle,
  Layers,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newstu-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newstu-body' })

type StudentViewTab = 'exams' | 'materials' | 'announcements' | 'results'

export default function NewStudentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState('')
  const [studentName, setStudentName] = useState('')

  // Invite code input
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [joiningClass, setJoiningClass] = useState(false)
  const [joinSuccessMsg, setJoinSuccessMsg] = useState('')
  const [joinErrorMsg, setJoinErrorMsg] = useState('')

  // Student classes and selected class
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<StudentViewTab>('exams')

  // Class specific data
  const [classExamsList, setClassExamsList] = useState<any[]>([])
  const [classMaterialsList, setClassMaterialsList] = useState<any[]>([])
  const [classAnnouncementsList, setClassAnnouncementsList] = useState<any[]>([])
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([])

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

      setUserId(user.id)
      await ensureStudentProfile(user.id)

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setStudentName(profile?.full_name || user.email || 'Học sinh')

      // 1. Fetch Enrolled Classes (Đồng bộ trực tiếp từ Database, không lưu rác lớp đã xóa)
      let validClasses: any[] = []
      let classIds: string[] = []

      try {
        const { data: membersData } = await supabase
          .from('class_members')
          .select('*, classes(*)')
          .eq('student_id', user.id)

        if (membersData && Array.isArray(membersData)) {
          // Chỉ lấy các lớp thực sự còn tồn tại trong DB
          validClasses = membersData
            .map((m: any) => m.classes)
            .filter((c: any) => c && c.id && c.name)

          setEnrolledClasses(validClasses)
          classIds = validClasses.map((c: any) => c.id)
          // Làm sạch LocalStorage đồng bộ tuyệt đối với DB
          localStorage.setItem(`sen_student_classes_${user.id}`, JSON.stringify(validClasses))
        } else {
          setEnrolledClasses([])
          localStorage.removeItem(`sen_student_classes_${user.id}`)
        }
      } catch {
        setEnrolledClasses([])
      }

      // 2. Fetch Exams Assigned to Enrolled Classes
      try {
        if (classIds.length > 0) {
          // Lấy qua bảng class_exams
          const { data: classExamsData } = await supabase
            .from('class_exams')
            .select('*, exams(*), classes(name, grade, subject, class_code)')
            .in('class_id', classIds)
            .order('created_at', { ascending: false })

          // Đồng thời quét thêm các đề có mã định danh 12 số (4 số đầu là mã lớp)
          const { data: allExams } = await supabase
            .from('exams')
            .select('*')
            .order('created_at', { ascending: false })

          const classCodeMap = new Map()
          validClasses.forEach((cls) => {
            if (cls.class_code) classCodeMap.set(String(cls.class_code), cls)
          })

          const directMatchedExams: any[] = []
          if (allExams && allExams.length > 0) {
            allExams.forEach((ex: any) => {
              const code = String(ex.exam_code || '')
              if (code.length === 12 && /^\d{12}$/.test(code)) {
                const classCode4 = code.slice(0, 4)
                const matchedCls = classCodeMap.get(classCode4)
                if (matchedCls) {
                  const alreadyInList = (classExamsData || []).some((ce: any) => ce.exam_id === ex.id)
                  if (!alreadyInList) {
                    directMatchedExams.push({
                      id: 'dir_' + ex.id,
                      class_id: matchedCls.id,
                      exam_id: ex.id,
                      exams: ex,
                      classes: matchedCls,
                      due_date: null,
                      created_at: ex.created_at,
                    })
                  }
                }
              }
            })
          }

          const combined = [...(classExamsData || []), ...directMatchedExams]
          setClassExamsList(combined)
        } else {
          setClassExamsList([])
        }
      } catch {}

      // 3. Fetch Materials for Enrolled Classes
      try {
        if (classIds.length > 0) {
          const { data: matsData } = await supabase
            .from('class_materials')
            .select('*, classes(name)')
            .in('class_id', classIds)
            .order('created_at', { ascending: false })

          if (matsData) setClassMaterialsList(matsData)
        } else {
          setClassMaterialsList([])
        }
      } catch {}

      // 4. Fetch Announcements for Enrolled Classes
      try {
        if (classIds.length > 0) {
          const { data: annsData } = await supabase
            .from('class_announcements')
            .select('*, classes(name)')
            .in('class_id', classIds)
            .order('created_at', { ascending: false })

          if (annsData) setClassAnnouncementsList(annsData)
        } else {
          setClassAnnouncementsList([])
        }
      } catch {}

      // 5. Fetch Student Submissions
      try {
        const { data: subsData } = await supabase
          .from('submissions')
          .select('*, exams(title)')
          .eq('user_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(50)
        setStudentSubmissions(subsData || [])
      } catch {}

      setLoading(false)
    }

    init()
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

  // THAM GIA LỚP HỌC BẰNG MÃ MỜI 20 KÝ TỰ
  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCodeInput.trim()) return

    setJoiningClass(true)
    setJoinErrorMsg('')
    setJoinSuccessMsg('')

    const cleanCode = inviteCodeInput.trim().toUpperCase()

    try {
      const { data: inviteData, error: inviteErr } = await supabase
        .from('class_invite_codes')
        .select('*, classes(*)')
        .eq('code', cleanCode)
        .single()

      if (inviteErr || !inviteData || !inviteData.classes) {
        throw new Error('Mã mời không tồn tại hoặc đã hết hạn. Vui lòng kiểm tra lại mã 20 ký tự do giáo viên cung cấp!')
      }

      const maxUses = inviteData.max_uses || 40
      const usedCount = inviteData.used_count || 0

      if (usedCount >= maxUses) {
        throw new Error(`Mã mời này đã đạt giới hạn tối đa (${usedCount}/${maxUses} học sinh). Vui lòng liên hệ giáo viên bộ môn để được cấp mã mới!`)
      }

      const { data: existMember } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', inviteData.class_id)
        .eq('student_id', userId)
        .single()

      if (existMember) {
        throw new Error('Bạn đã là thành viên của lớp học này rồi!')
      }

      const classFound = inviteData.classes

      // Tăng số lượt sử dụng
      const nextUsedCount = usedCount + 1
      await supabase
        .from('class_invite_codes')
        .update({
          used_count: nextUsedCount,
          is_used: nextUsedCount >= maxUses,
          used_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id)

      // Thêm thành viên vào lớp
      await supabase.from('class_members').insert({
        class_id: inviteData.class_id,
        student_id: userId,
      })

      const updated = [classFound, ...enrolledClasses.filter((c) => c.id !== classFound.id)]
      setEnrolledClasses(updated)
      setSelectedClassId(classFound.id)
      localStorage.setItem(`sen_student_classes_${userId}`, JSON.stringify(updated))

      setJoinSuccessMsg(`🎉 Chúc mừng bạn đã tham gia thành công lớp: ${classFound.name}!`)
      setInviteCodeInput('')
    } catch (err: any) {
      setJoinErrorMsg(err.message || 'Lỗi tham gia lớp học.')
    } finally {
      setJoiningClass(false)
    }
  }

  // Lọc dữ liệu theo lớp học đang chọn
  const filteredExams = useMemo(() => {
    if (selectedClassId === 'all') return classExamsList
    return classExamsList.filter((item) => item.class_id === selectedClassId)
  }, [classExamsList, selectedClassId])

  const filteredMaterials = useMemo(() => {
    if (selectedClassId === 'all') return classMaterialsList
    return classMaterialsList.filter((item) => item.class_id === selectedClassId)
  }, [classMaterialsList, selectedClassId])

  const filteredAnnouncements = useMemo(() => {
    if (selectedClassId === 'all') return classAnnouncementsList
    return classAnnouncementsList.filter((item) => item.class_id === selectedClassId)
  }, [classAnnouncementsList, selectedClassId])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
          <span className="font-bold text-sm">Đang tải không gian lớp học...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300 pb-20`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(99, 102, 241, 0.15), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(224, 242, 254, 0.6), transparent 30%), radial-gradient(circle at 90% 20%, rgba(224, 231, 255, 0.6), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* HEADER */}
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
                <span className="rounded-full bg-gradient-to-r from-sky-500/20 to-indigo-500/20 px-3 py-0.5 text-[11px] font-black text-sky-600 dark:text-sky-400 border border-sky-500/30 uppercase tracking-wider">
                  <GraduationCap className="inline h-3.5 w-3.5 mr-1 text-sky-500" /> Không Gian Học Sinh
                </span>
                <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                  {studentName}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                Lớp Học Của Tôi, Đề Thi & Kho Tài Liệu
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* THAM GIA LỚP HỌC BẰNG MÃ MỜI HERO CARD */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                Tham Gia Lớp Học Mới
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Nhập mã mời 20 ký tự do giáo viên của bạn cung cấp (VD: <code>8AK9-F2L4-M9X1-P7Q3-W6R2</code>)
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinClass} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Nhập mã mời 20 ký tự (VD: 8AK9-F2L4-M9X1-P7Q3-W6R2)..."
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                required
                className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 py-3.5 pl-11 pr-4 font-mono text-sm font-bold tracking-wider outline-none focus:border-sky-500 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={joiningClass || !inviteCodeInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-8 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {joiningClass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Vào Lớp Ngay
            </button>
          </form>

          {joinSuccessMsg && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{joinSuccessMsg}</span>
            </div>
          )}

          {joinErrorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{joinErrorMsg}</span>
            </div>
          )}
        </div>

        {/* THANH BỘ LỌC LỚP HỌC (CLASS FILTER BAR) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setSelectedClassId('all')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition shrink-0 ${
                selectedClassId === 'all'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Tất Cả Lớp ({enrolledClasses.length})
            </button>

            {enrolledClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 ${
                  selectedClassId === cls.id
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-black shadow-sm'
                    : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                🏫 {cls.name}
              </button>
            ))}
          </div>
        </div>

        {/* TABS NỘI DUNG: ĐỀ THI LỚP / KHO TÀI LIỆU / THÔNG BÁO / BẢNG ĐIỂM */}
        <div className="flex flex-wrap gap-2 border-b border-black/10 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : 'text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" /> Đề Thi & Bài Tập ({filteredExams.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'materials'
                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : 'text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <FolderOpen className="h-4 w-4" /> Kho Tài Liệu Học Tập ({filteredMaterials.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'announcements'
                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : 'text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Megaphone className="h-4 w-4" /> Thông Báo Từ Giáo Viên ({filteredAnnouncements.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'results'
                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : 'text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Award className="h-4 w-4" /> Kết Quả Của Tôi ({studentSubmissions.length})
          </button>
        </div>

        {/* ==========================================
            TAB 1: ĐỀ THI & BÀI KIỂM TRA ĐƯỢC GIAO
        ========================================== */}
        {activeTab === 'exams' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                Danh Sách Đề Thi Của Lớp
              </h3>
              <span className="text-xs text-slate-400">
                {selectedClassId === 'all' ? 'Tất cả các lớp' : 'Lớp đã chọn'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredExams.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-xs text-[#6B7280] dark:text-slate-400">
                  Hiện chưa có đề thi mới nào được giao cho lớp này.
                </div>
              ) : (
                filteredExams.map((item) => {
                  const ex = item.exams || item
                  const dueDate = item.due_date
                  const isExpired = dueDate ? new Date(dueDate) < new Date() : false

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-sky-500/10 text-sky-600 px-2 py-0.5 text-[10px] font-black uppercase">
                            {ex.exam_type || 'Kiểm tra'}
                          </span>
                          {item.classes?.name && (
                            <span className="rounded-full bg-indigo-500/10 text-indigo-600 px-2 py-0.5 text-[10px] font-bold">
                              🏫 {item.classes.name}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold line-clamp-2">{ex.title}</h4>

                        <div className="text-xs text-slate-400 space-y-1">
                          <p>⏱️ Thời gian làm bài: {ex.duration} phút</p>
                          {dueDate ? (
                            <p className={isExpired ? 'text-rose-500 font-bold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                              📅 Hạn chót: {new Date(dueDate).toLocaleString('vi-VN')} {isExpired ? '(Đã hết hạn)' : ''}
                            </p>
                          ) : (
                            <p className="text-slate-400">📅 Hạn chót: Không giới hạn</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                        {isExpired ? (
                          <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Đã quá hạn nộp
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600">Đang mở</span>
                        )}

                        <Link
                          href={`/new-exams/${ex.id}`}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 ${
                            isExpired
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white'
                          }`}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" /> {isExpired ? 'Xem Lại Đề' : 'Bắt Đầu Làm'}
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: KHO TÀI LIỆU HỌC TẬP CỦA LỚP
        ========================================== */}
        {activeTab === 'materials' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                Tài Liệu Học Tập & Bài Giảng Do Giáo Viên Cung Cấp
              </h3>
            </div>

            <div className="space-y-3">
              {filteredMaterials.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7280] dark:text-slate-400">
                  Chưa có tài liệu nào được đăng trong lớp này.
                </div>
              ) : (
                filteredMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-indigo-500/15 text-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase">
                          {mat.material_type === 'exam_review'
                            ? 'Đề cương'
                            : mat.material_type === 'lecture'
                            ? 'Bài giảng'
                            : mat.material_type === 'solution'
                            ? 'Lời giải'
                            : 'Slide'}
                        </span>
                        {mat.classes?.name && (
                          <span className="text-[10px] font-bold text-slate-400">🏫 {mat.classes.name}</span>
                        )}
                        <h4 className="text-sm font-bold">{mat.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400">{mat.description}</p>
                      <span className="text-[10px] text-slate-400 block">
                        🕒 Ngày đăng: {new Date(mat.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <a
                      href={mat.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow transition hover:scale-105 shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Xem / Tải Về
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: THÔNG BÁO TỪ GIÁO VIÊN
        ========================================== */}
        {activeTab === 'announcements' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                Bảng Tin & Thông Báo Từ Giáo Viên
              </h3>
            </div>

            <div className="space-y-3">
              {filteredAnnouncements.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7280] dark:text-slate-400">
                  Chưa có thông báo nào từ giáo viên.
                </div>
              ) : (
                filteredAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            ann.priority === 'urgent'
                              ? 'bg-rose-500/15 text-rose-600'
                              : ann.priority === 'important'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-sky-500/15 text-sky-600'
                          }`}
                        >
                          {ann.priority === 'urgent' ? '🚨 Khẩn cấp' : ann.priority === 'important' ? '⭐ Quan trọng' : 'Thông báo'}
                        </span>
                        <h4 className="text-sm font-bold">{ann.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ann.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: KẾT QUẢ & BẢNG ĐIỂM CÁ NHÂN
        ========================================== */}
        {activeTab === 'results' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newstu-heading)' }}>
                  Bảng Điểm Cá Nhân & Bài Đã Hoàn Thành
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/10 dark:border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5">Đề Thi</th>
                    <th className="py-2.5">Điểm Số</th>
                    <th className="py-2.5">Trạng Thái</th>
                    <th className="py-2.5">Thời Gian Nộp</th>
                    <th className="py-2.5 text-right">Xem Lời Giải</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {studentSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Bạn chưa nộp bài thi nào. Hãy bắt đầu làm bài kiểm tra đầu tiên nhé!
                      </td>
                    </tr>
                  ) : (
                    studentSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-black/[0.02]">
                        <td className="py-3 font-bold text-slate-900 dark:text-white">{sub.exams?.title || 'Bài thi'}</td>
                        <td className="py-3">
                          <span className="text-base font-black text-sky-600 dark:text-sky-400">
                            {typeof sub.score === 'number' ? sub.score.toFixed(2) : '--'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-emerald-600 font-bold">✅ Đã hoàn thành</span>
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(sub.submitted_at || sub.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/new-history/${sub.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold hover:scale-105 transition"
                          >
                            <Eye className="h-3 w-3" /> Chi tiết
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
