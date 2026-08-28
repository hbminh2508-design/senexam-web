'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  ArrowLeft,
  School,
  FileText,
  Plus,
  Search,
  Eye,
  Trash2,
  Copy,
  Check,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Clock,
  Sparkles,
  KeyRound,
  Lock,
  Unlock,
  Users,
  Award,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  GraduationCap,
  Layers,
  FileCheck,
  AlertTriangle,
  Radio,
  Sliders,
  Send,
  UserCheck,
  RefreshCw,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newteacher-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newteacher-body' })

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'Kiểm tra 1 tiết', 'Học kỳ', 'Thi thử THPTQG 2026']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học' },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh' },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học' },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí' },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh' },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)' },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)' },
]

type TeacherTab = 'classes' | 'exams' | 'create' | 'proctor' | 'results'

export default function NewTeacherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [teacherName, setTeacherName] = useState('')

  const [activeTab, setActiveTab] = useState<TeacherTab>('classes')
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [copiedAllBatch, setCopiedAllBatch] = useState(false)

  // ==========================================
  // 1. CLASSROOMS & INVITE CODES STATE
  // ==========================================
  const [classesList, setClassesList] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [classNameInput, setClassNameInput] = useState('')
  const [classGradeInput, setClassGradeInput] = useState('12')
  const [classSubjectInput, setClassSubjectInput] = useState('Toán học')
  const [creatingClass, setCreatingClass] = useState(false)
  const [inviteCodesList, setInviteCodesList] = useState<any[]>([])
  const [generatingCodes, setGeneratingCodes] = useState(false)

  // ==========================================
  // 2. PRO MULTI-SECTION EXAM BUILDER STATE
  // ==========================================
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examBlock, setExamBlock] = useState('A00')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Toán học'])
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [gradingMethod, setGradingMethod] = useState('highest')
  const [requireProctoring, setRequireProctoring] = useState(true)
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [assignToClassId, setAssignToClassId] = useState<string>('')
  const [creatingExam, setCreatingExam] = useState(false)

  // Multi-sections state
  const [examSections, setExamSections] = useState<any[]>([
    {
      id: 'sec_1',
      name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
      type: 'single_choice',
      questionCount: 18,
      optionsCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 4.5,
      correctAnswers: {},
    },
    {
      id: 'sec_2',
      name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
      type: 'true_false',
      questionCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 4.0,
      correctAnswers: {},
    },
    {
      id: 'sec_3',
      name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
      type: 'short_answer',
      questionCount: 6,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 1.5,
      correctAnswers: {},
    },
  ])
  const [quickAnswersModalSecId, setQuickAnswersModalSecId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

  // ==========================================
  // 3. STUDENT RESULTS & PROCTORING STATE
  // ==========================================
  const [submissionsList, setSubmissionsList] = useState<any[]>([])
  const [filterClassResult, setFilterClassResult] = useState<string>('all')
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [liveExamineesCount, setLiveExamineesCount] = useState<number>(0)

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

      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      const role = profile?.role || 'student'
      setUserRole(role)
      setTeacherName(profile?.full_name || user.email || 'Giảng viên')

      if (role !== 'teacher' && role !== 'admin' && role !== 'collab') {
        alert('Cổng Giảng Viên chỉ dành cho tài khoản có quyền Teacher hoặc Admin!')
        router.replace('/new-dashboard')
        return
      }

      // 1. Fetch Classes for this teacher
      try {
        const { data: classesData } = await supabase
          .from('classes')
          .select('*')
          .eq(role === 'teacher' ? 'teacher_id' : 'teacher_id', user.id)
          .order('created_at', { ascending: false })

        if (classesData && classesData.length > 0) {
          setClassesList(classesData)
          setSelectedClassId(classesData[0].id)
        } else {
          // Fallback mock class for immediate preview
          const localClasses = JSON.parse(localStorage.getItem(`sen_teacher_classes_${user.id}`) || '[]')
          if (localClasses.length > 0) {
            setClassesList(localClasses)
            setSelectedClassId(localClasses[0].id)
          }
        }
      } catch {
        const localClasses = JSON.parse(localStorage.getItem(`sen_teacher_classes_${user.id}`) || '[]')
        setClassesList(localClasses)
        if (localClasses.length > 0) setSelectedClassId(localClasses[0].id)
      }

      // 2. Fetch Exams created by this teacher
      let examQuery = supabase.from('exams').select('*').order('created_at', { ascending: false })
      if (role === 'teacher') {
        examQuery = examQuery.eq('created_by', user.id)
      }
      const { data: examsData } = await examQuery.limit(100)
      setExamsList(examsData || [])

      // 3. Fetch Submissions
      const { data: subsData } = await supabase
        .from('submissions')
        .select('*, exams(title, created_by), profiles(full_name, email)')
        .order('submitted_at', { ascending: false })
        .limit(100)

      setSubmissionsList(subsData || [])
      setLiveExamineesCount(Math.max(1, (subsData || []).filter((s) => !s.is_completed).length))

      setLoading(false)
    }

    init()
  }, [router])

  // Load invite codes when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId || !userId) return
    const fetchCodes = async () => {
      try {
        const { data } = await supabase
          .from('class_invite_codes')
          .select('*')
          .eq('class_id', selectedClassId)
          .order('created_at', { ascending: false })

        if (data && data.length > 0) {
          setInviteCodesList(data)
        } else {
          const localCodes = JSON.parse(localStorage.getItem(`sen_class_codes_${selectedClassId}`) || '[]')
          setInviteCodesList(localCodes)
        }
      } catch {
        const localCodes = JSON.parse(localStorage.getItem(`sen_class_codes_${selectedClassId}`) || '[]')
        setInviteCodesList(localCodes)
      }
    }
    fetchCodes()
  }, [selectedClassId, userId])

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

  // ==========================================
  // HANDLERS: CLASSROOMS & 20 INVITE CODES
  // ==========================================
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classNameInput.trim()) {
      alert('Vui lòng nhập tên lớp học!')
      return
    }

    // Giới hạn 10 lớp học cho giáo viên
    if (classesList.length >= 10 && userRole !== 'admin') {
      alert('Hạng giáo viên miễn phí tạo được tối đa 10 lớp học. Vui lòng liên hệ Admin để mở rộng thêm!')
      return
    }

    setCreatingClass(true)
    try {
      const newClassObj = {
        name: classNameInput.trim(),
        grade: classGradeInput,
        subject: classSubjectInput,
        teacher_id: userId,
        created_at: new Date().toISOString(),
      }

      let insertedClass: any = null
      try {
        const { data, error } = await supabase.from('classes').insert(newClassObj).select('*').single()
        if (error) throw error
        insertedClass = data
      } catch {
        insertedClass = {
          id: 'cls_' + Date.now(),
          ...newClassObj,
        }
      }

      const updated = [insertedClass, ...classesList]
      setClassesList(updated)
      setSelectedClassId(insertedClass.id)
      localStorage.setItem(`sen_teacher_classes_${userId}`, JSON.stringify(updated))

      setClassNameInput('')
      alert(`🎉 Đã tạo thành công lớp: ${insertedClass.name}!`)
    } catch (err: any) {
      alert(`Lỗi tạo lớp học: ${err.message}`)
    } finally {
      setCreatingClass(false)
    }
  }

  // TẠO MÃ MỜI 20 KÝ TỰ NGẪU NHIÊN VỚI GIỚI HẠN SỐ LƯỢNG HỌC SINH
  const [maxStudentsLimitInput, setMaxStudentsLimitInput] = useState('40')

  const generate20CharCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let raw = ''
    for (let i = 0; i < 20; i++) {
      raw += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    // Định dạng 4-4-4-4-4 (Đủ đúng 20 ký tự chữ & số)
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}`
  }

  const handleGenerate20CharInviteCode = async () => {
    if (!selectedClassId) {
      alert('Vui lòng chọn một lớp học trước!')
      return
    }

    const maxUses = parseInt(maxStudentsLimitInput) || 40
    if (maxUses <= 0) {
      alert('Giới hạn học sinh phải lớn hơn 0!')
      return
    }

    setGeneratingCodes(true)
    try {
      const currentClass = classesList.find((c) => c.id === selectedClassId)
      const new20CharCode = generate20CharCode()

      const newCodeRecord = {
        id: 'inv_' + Date.now(),
        class_id: selectedClassId,
        teacher_id: userId,
        code: new20CharCode,
        max_uses: maxUses,
        used_count: 0,
        is_used: false,
        created_at: new Date().toISOString(),
      }

      try {
        await supabase.from('class_invite_codes').insert(newCodeRecord)
      } catch {
        // Fallback local persistence
      }

      const updatedCodes = [newCodeRecord, ...inviteCodesList]
      setInviteCodesList(updatedCodes)
      localStorage.setItem(`sen_class_codes_${selectedClassId}`, JSON.stringify(updatedCodes))

      alert(`🎉 Đã tạo thành công mã mời 20 ký tự cho lớp ${currentClass?.name || ''} với giới hạn tối đa ${maxUses} học sinh!`)
    } catch (err: any) {
      alert(`Lỗi tạo mã mời: ${err.message}`)
    } finally {
      setGeneratingCodes(false)
    }
  }

  const handleCopySingleCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // ==========================================
  // HANDLERS: PRO EXAM BUILDER
  // ==========================================
  const handleLoadPresetTHPT2026 = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
        type: 'single_choice',
        questionCount: 18,
        optionsCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 4.5,
        correctAnswers: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
        type: 'true_false',
        questionCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 4.0,
        correctAnswers: {},
      },
      {
        id: 'sec_3',
        name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
        type: 'short_answer',
        questionCount: 6,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 1.5,
        correctAnswers: {},
      },
    ])
  }

  const handleLoadPresetHSA = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Định lượng & Tư duy Toán học',
        type: 'single_choice',
        questionCount: 35,
        optionsCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 7.0,
        correctAnswers: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Điền đáp án ngắn',
        type: 'short_answer',
        questionCount: 15,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 3.0,
        correctAnswers: {},
      },
    ])
  }

  const handleAddSection = () => {
    const newSec = {
      id: 'sec_' + Date.now(),
      name: `Phần ${examSections.length + 1}: Trắc nghiệm`,
      type: 'single_choice',
      questionCount: 10,
      optionsCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 2.0,
      correctAnswers: {},
    }
    setExamSections([...examSections, newSec])
  }

  const handleRemoveSection = (id: string) => {
    setExamSections(examSections.filter((s) => s.id !== id))
  }

  const handleUpdateSection = (id: string, patch: any) => {
    setExamSections(examSections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const handleAnswerChange = (sectionId: string, qIndex: number, val: any) => {
    setExamSections(
      examSections.map((s) => {
        if (s.id === sectionId) {
          const updated = { ...(s.correctAnswers || {}), [qIndex]: val }
          return { ...s, correctAnswers: updated }
        }
        return s
      })
    )
  }

  const handleApplyQuickAnswers = (sectionId: string, text: string) => {
    const sec = examSections.find((s) => s.id === sectionId)
    if (!sec) return

    const answers: Record<number, any> = { ...(sec.correctAnswers || {}) }

    if (sec.type === 'single_choice') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([A-D])/gi))
      if (matches.length > 0) {
        matches.forEach((m) => {
          const qNum = parseInt(m[1]) - 1
          if (qNum >= 0 && qNum < sec.questionCount) {
            answers[qNum] = m[2].toUpperCase()
          }
        })
      } else {
        const letters = text.replace(/[^a-dA-D]/g, '').toUpperCase().split('')
        letters.forEach((l, idx) => {
          if (idx < sec.questionCount) answers[idx] = l
        })
      }
    } else if (sec.type === 'true_false') {
      const lines = text.split('\n')
      lines.forEach((line) => {
        const m = line.match(/(\d+)[\s.:)]*([ĐDSđds\-\/]+)/i)
        if (m) {
          const qNum = parseInt(m[1]) - 1
          const raw = m[2].replace(/[^ĐDSđds]/gi, '').toUpperCase()
          const tfObj: any = {}
          ;['a', 'b', 'c', 'd'].forEach((sub, subIdx) => {
            const ch = raw[subIdx]
            tfObj[sub] = ch === 'Đ' || ch === 'D' ? 'D' : 'S'
          })
          if (qNum >= 0 && qNum < sec.questionCount) answers[qNum] = tfObj
        }
      })
    } else if (sec.type === 'short_answer') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([-\d.,]+)/g))
      matches.forEach((m) => {
        const qNum = parseInt(m[1]) - 1
        if (qNum >= 0 && qNum < sec.questionCount) {
          answers[qNum] = m[2].trim()
        }
      })
    }

    handleUpdateSection(sectionId, { correctAnswers: answers })
    setQuickAnswersModalSecId(null)
    setQuickAnswersText('')
    alert(`Đã nạp nhanh đáp án cho ${Object.keys(answers).length} câu hỏi!`)
  }

  // TẠO VÀ XUẤT BẢN ĐỀ THI LỚP HỌC
  const handleCreateProExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và tải file PDF đề thi!')
      return
    }

    if (examSections.length === 0) {
      alert('Vui lòng tạo ít nhất 1 phần thi cho đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload Google Drive
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Sinh mã code ẩn nếu chọn đề ẩn
      const accessCode = examIsHidden
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      const totalQs = examSections.reduce((sum, s) => sum + (parseInt(s.questionCount) || 0), 0)

      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          title: examTitle.trim(),
          exam_type: examTypeVal,
          duration: parseInt(examDuration) || 50,
          drive_file_id: driveFileId,
          exam_structure: examSections,
          allow_review: examAllowReview,
          is_hidden: examIsHidden,
          access_code: accessCode,
          subjects: selectedSubjects,
          max_attempts: parseInt(maxAttempts) || 1,
          grading_method: gradingMethod,
          require_proctoring: requireProctoring,
          created_by: userId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      // Gán đề vào lớp học nếu chọn
      if (assignToClassId && newExam) {
        try {
          await supabase.from('class_exams').insert({
            class_id: assignToClassId,
            exam_id: newExam.id,
            title: newExam.title,
          })
        } catch {}
      }

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setExamIsHidden(false)
      setExamCustomCode('')
      setActiveTab('exams')
      alert(`🎉 Đã xuất bản đề thi thành công (${totalQs} câu hỏi)! ${accessCode ? `Mã code mở đề: ${accessCode}` : 'Đề đã sẵn sàng cho học sinh làm.'}`)
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải Cổng Giảng Viên 2.0...</span>
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
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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
                  <School className="inline h-3.5 w-3.5 mr-1 text-sky-500" /> Cổng Giảng Viên 2.0
                </span>
                <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                  {teacherName}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                Quản Lý Lớp Học, Soạn Đề & Giám Sát Thi Cử
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

        {/* TABS NAVIGATION */}
        <div className="flex flex-wrap gap-2 rounded-2xl bg-black/5 dark:bg-white/5 p-1.5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'classes'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Lớp Học & Mã Mời ({classesList.length}/10)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'create'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Plus className="h-4 w-4" /> Soạn Đề Thi Mới (Chuẩn 2026)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" /> Đề Thi Đã Tạo ({examsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proctor')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'proctor'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Radio className="h-4 w-4 text-rose-500 animate-pulse" /> Giám Sát Vi Phạm & Phòng Thi
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'results'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Award className="h-4 w-4" /> Bảng Điểm Theo Lớp ({submissionsList.length})
          </button>
        </div>

        {/* ==========================================
            TAB 1: LỚP HỌC CỦA TÔI & TẠO MÃ MỜI 20 KÝ TỰ
        ========================================== */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            {/* Tạo lớp học mới */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                      Tạo Lớp Học Mới
                    </h3>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400">
                      Tối đa 10 lớp học cho tài khoản giảng viên miễn phí
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-3 py-1 text-xs font-black">
                  Đã tạo: {classesList.length}/10 Lớp
                </span>
              </div>

              <form onSubmit={handleCreateClass} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Tên lớp học:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Lớp 12A1 Ôn Thi Đại Học 2026..."
                    value={classNameInput}
                    onChange={(e) => setClassNameInput(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Khối lớp:
                  </label>
                  <select
                    value={classGradeInput}
                    onChange={(e) => setClassGradeInput(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="12">Lớp 12 (Luyện Thi THPTQG)</option>
                    <option value="11">Lớp 11</option>
                    <option value="10">Lớp 10</option>
                    <option value="HSA_TSA">Luyện Thi ĐGNL / ĐGTD</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Môn học:
                  </label>
                  <select
                    value={classSubjectInput}
                    onChange={(e) => setClassSubjectInput(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lí">Vật lí</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lí">Địa lí</option>
                    <option value="Tổng hợp ĐGNL">Tổng hợp ĐGNL</option>
                  </select>
                </div>

                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingClass || classesList.length >= 10}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-105 disabled:opacity-50"
                  >
                    {creatingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Tạo Lớp Học Ngay
                  </button>
                </div>
              </form>
            </div>

            {/* Danh sách lớp học & Quản lý mã mời */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cột 1: Danh sách lớp */}
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Danh Sách Lớp Của Bạn
                </h3>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {classesList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#6B7280] dark:text-slate-400">
                      Chưa có lớp học nào. Hãy tạo lớp đầu tiên ở form bên trên!
                    </div>
                  ) : (
                    classesList.map((cls) => (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          selectedClassId === cls.id
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-black shadow-sm'
                            : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5'
                        }`}
                      >
                        <div>
                          <h4 className="text-sm font-bold">{cls.name}</h4>
                          <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
                            Khối {cls.grade} • Môn {cls.subject}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cột 2 & 3: Quản lý Mã Mời 20 Ký Tự Có Giới Hạn Học Sinh */}
              <div className="lg:col-span-2 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
                  <div>
                    <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                      Mã Mời Lớp Học (Mã 20 Ký Tự)
                    </h3>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400">
                      Tạo mã 20 ký tự và đặt giới hạn số lượng học sinh được phép tham gia
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs">
                      <span className="text-slate-400 font-bold">Giới hạn HS:</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={maxStudentsLimitInput}
                        onChange={(e) => setMaxStudentsLimitInput(e.target.value)}
                        className="w-14 font-black text-sky-600 dark:text-sky-400 bg-transparent outline-none text-center"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerate20CharInviteCode}
                      disabled={generatingCodes || !selectedClassId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50"
                    >
                      {generatingCodes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Tạo Mã Mời 20 Ký Tự
                    </button>
                  </div>
                </div>

                {/* Bảng danh sách mã mời */}
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                  {inviteCodesList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#6B7280] dark:text-slate-400">
                      Chưa có mã mời nào cho lớp này. Nhấn nút <strong>"Tạo Mã Mời 20 Ký Tự"</strong> ở trên để phát cho học sinh!
                    </div>
                  ) : (
                    inviteCodesList.map((codeItem) => {
                      const isCopied = copiedCodeId === codeItem.id
                      const maxU = codeItem.max_uses || 40
                      const usedC = codeItem.used_count || 0
                      const isFull = usedC >= maxU
                      const percent = Math.min(100, Math.round((usedC / maxU) * 100))

                      return (
                        <div
                          key={codeItem.id}
                          className={`p-4 rounded-2xl border space-y-2 text-xs transition ${
                            isFull
                              ? 'border-rose-500/30 bg-rose-500/5 text-[#6B7280]'
                              : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm sm:text-base font-black tracking-wider text-sky-700 dark:text-sky-300">
                                {codeItem.code}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                  isFull
                                    ? 'bg-rose-500/15 text-rose-600'
                                    : 'bg-emerald-500/15 text-emerald-600'
                                }`}
                              >
                                {isFull ? 'Đã Đầy Chỗ' : 'Đang Hoạt Động'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopySingleCode(codeItem.id, codeItem.code)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 hover:scale-105 font-bold transition"
                              title="Copy mã"
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>{isCopied ? 'Đã chép!' : 'Copy Mã'}</span>
                            </button>
                          </div>

                          {/* Progress bar số lượng học sinh */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                              <span>Số lượng học sinh đã tham gia:</span>
                              <strong className={isFull ? 'text-rose-500' : 'text-sky-600 dark:text-sky-400'}>
                                {usedC} / {maxU} học sinh ({percent}%)
                              </strong>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isFull
                                    ? 'bg-rose-500'
                                    : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: SOẠN ĐỀ THI PRO ĐẦY ĐỦ (CHUẨN 2026)
        ========================================== */}
        {activeTab === 'create' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Soạn Đề Thi Mới Đầy Đủ (Đồng Bộ Quản Trị)
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Hỗ trợ đầy đủ cấu trúc 3 phần THPTQG 2026, ĐGNL HSA/TSA, nạp nhanh đáp án và tải PDF lên Google Drive.
                </p>
              </div>

              {/* Nút nạp preset nhanh */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadPresetTHPT2026}
                  className="rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-3 py-1.5 text-xs font-bold transition"
                >
                  ⚡ Cấu Trúc Mẫu THPT 2026 (18 Đơn - 4 Đúng/Sai - 6 Điền Số)
                </button>
                <button
                  type="button"
                  onClick={handleLoadPresetHSA}
                  className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 text-xs font-bold transition"
                >
                  ⚡ Mẫu ĐGNL HSA (35 Trắc Nghiệm - 15 Điền Số)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateProExam} className="space-y-6">
              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Tên tiêu đề đề thi:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Đề thi thử Toán THPT Quốc Gia 2026 - Lần 1 (Có lời giải chi tiết)..."
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Loại kỳ thi:
                  </label>
                  <select
                    value={examTypeVal}
                    onChange={(e) => setExamTypeVal(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Thời gian làm bài (Phút):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Gán riêng cho lớp học:
                  </label>
                  <select
                    value={assignToClassId}
                    onChange={(e) => setAssignToClassId(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="">-- Toàn bộ học sinh có thể làm --</option>
                    {classesList.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Khối {cls.grade})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Tệp PDF Đề Thi (Google Drive):
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setExamPdfFile(e.target.files?.[0] || null)}
                    required
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Tùy chọn bảo mật & giám sát */}
              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={requireProctoring}
                    onChange={(e) => setRequireProctoring(e.target.checked)}
                    className="h-4 w-4 rounded text-sky-600"
                  />
                  <span>Bật giám sát gian lận (Tab switch)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={examAllowReview}
                    onChange={(e) => setExamAllowReview(e.target.checked)}
                    className="h-4 w-4 rounded text-sky-600"
                  />
                  <span>Cho phép xem lại lời giải chi tiết</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={examIsHidden}
                    onChange={(e) => setExamIsHidden(e.target.checked)}
                    className="h-4 w-4 rounded text-sky-600"
                  />
                  <span>Đặt mã PIN khóa đề bí mật</span>
                </label>
              </div>

              {/* CÁC PHẦN THI (MULTI-SECTIONS BUILDER) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                    Cấu Trúc Các Phần Thi ({examSections.length} Phần)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm phần thi
                  </button>
                </div>

                {examSections.map((sec, secIdx) => (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white text-xs font-black">
                          {secIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={sec.name}
                          onChange={(e) => handleUpdateSection(sec.id, { name: e.target.value })}
                          className="font-bold text-sm bg-transparent border-b border-transparent focus:border-sky-500 outline-none w-72 sm:w-96"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAnswersModalSecId(sec.id)
                            setQuickAnswersText('')
                          }}
                          className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-bold transition hover:scale-105"
                        >
                          ⚡ Nạp Nhanh Đáp Án
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveSection(sec.id)}
                          className="p-1 text-rose-500 hover:scale-110 transition"
                          title="Xóa phần này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Loại câu hỏi:</label>
                        <select
                          value={sec.type}
                          onChange={(e) => handleUpdateSection(sec.id, { type: e.target.value })}
                          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                        >
                          <option value="single_choice">Trắc nghiệm 1 đáp án (A, B, C, D)</option>
                          <option value="true_false">Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)</option>
                          <option value="short_answer">Trả lời ngắn / Điền số</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Số lượng câu hỏi:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={sec.questionCount}
                          onChange={(e) => handleUpdateSection(sec.id, { questionCount: parseInt(e.target.value) || 1 })}
                          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Tổng điểm phần này:</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.5"
                          max="10"
                          value={sec.sectionTotalPoints}
                          onChange={(e) => handleUpdateSection(sec.id, { sectionTotalPoints: parseFloat(e.target.value) || 1 })}
                          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Vùng xem và chỉnh sửa đáp án */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-400 block mb-2">
                        Bảng đáp án ({Object.keys(sec.correctAnswers || {}).length}/{sec.questionCount} câu đã có đáp án):
                      </span>
                      <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2 rounded-xl bg-black/5 dark:bg-white/5">
                        {Array.from({ length: sec.questionCount }).map((_, qIdx) => {
                          const currentAns = sec.correctAnswers?.[qIdx]
                          return (
                            <div
                              key={qIdx}
                              className="flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                            >
                              <span className="font-bold text-slate-400">{qIdx + 1}:</span>
                              {sec.type === 'single_choice' && (
                                <select
                                  value={currentAns || 'A'}
                                  onChange={(e) => handleAnswerChange(sec.id, qIdx, e.target.value)}
                                  className="font-black text-sky-600 dark:text-sky-400 bg-transparent outline-none"
                                >
                                  {['A', 'B', 'C', 'D'].map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {sec.type === 'true_false' && (
                                <span className="font-mono font-bold text-indigo-500">
                                  {currentAns ? `${currentAns.a || 'Đ'}${currentAns.b || 'S'}${currentAns.c || 'Đ'}${currentAns.d || 'S'}` : 'Đ/S'}
                                </span>
                              )}
                              {sec.type === 'short_answer' && (
                                <input
                                  type="text"
                                  placeholder="Đáp án"
                                  value={currentAns || ''}
                                  onChange={(e) => handleAnswerChange(sec.id, qIdx, e.target.value)}
                                  className="w-16 font-mono font-bold text-emerald-500 bg-transparent outline-none"
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-700 hover:to-purple-700 text-white px-8 py-4 text-xs font-black uppercase tracking-wider shadow-xl transition hover:scale-105 disabled:opacity-50"
                >
                  {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Xuất Bản Đề Thi Cho Học Sinh
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==========================================
            TAB 3: DANH SÁCH ĐỀ THI ĐÃ TẠO
        ========================================== */}
        {activeTab === 'exams' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-black/10 dark:border-white/10">
              <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                Đề Thi Do Bạn Quản Lý ({examsList.length})
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-xs font-semibold outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {examsList
                .filter((ex) => ex.title?.toLowerCase().includes(examSearch.toLowerCase()))
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <span className="rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2.5 py-0.5 text-[10px] font-black uppercase">
                        {ex.exam_type}
                      </span>
                      <h4 className="text-sm font-bold line-clamp-2">{ex.title}</h4>
                      <p className="text-xs text-slate-400">⏱️ {ex.duration} phút làm bài</p>
                    </div>

                    <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                      {ex.access_code ? (
                        <button
                          type="button"
                          onClick={() => handleCopySingleCode(ex.id, ex.access_code)}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Mã: {ex.access_code}
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600">Đề công khai</span>
                      )}

                      <Link
                        href={`/new-exam/${ex.id}`}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border hover:scale-105 transition"
                        title="Làm thử bài thi"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: GIÁM SÁT VI PHẠM & PHÒNG THI THỜI GIAN THỰC
        ========================================== */}
        {activeTab === 'proctor' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <Radio className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                    Giám Sát Phòng Thi Trực Tuyến & Nhật Ký Vi Phạm
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">
                    Theo dõi số lượng thí sinh đang làm bài và cảnh báo rời tab tự động
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">Đang Làm Bài</span>
                  <strong className="text-xl font-black text-rose-600">{liveExamineesCount} Học Sinh</strong>
                </div>
              </div>
            </div>

            {/* Bảng ghi nhận vi phạm */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Nhật Ký Vi Phạm Gần Nhất (Rời Màn Hình / Gian Lận):
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-black/10 dark:border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5">Học Sinh</th>
                      <th className="py-2.5">Đề Thi</th>
                      <th className="py-2.5">Số Lần Rời Tab</th>
                      <th className="py-2.5">Trạng Thái</th>
                      <th className="py-2.5">Thời Gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {submissionsList
                      .filter((s) => (s.tab_switches || 0) > 0 || !s.is_completed)
                      .slice(0, 15)
                      .map((sub) => (
                        <tr key={sub.id} className="hover:bg-black/[0.02]">
                          <td className="py-3">{sub.profiles?.full_name || sub.profiles?.email || 'Thí sinh'}</td>
                          <td className="py-3 font-bold">{sub.exams?.title || 'Đề kiểm tra'}</td>
                          <td className="py-3">
                            <span className="rounded-full bg-rose-500/15 text-rose-600 px-2 py-0.5 font-black">
                              {sub.tab_switches || 0} lần
                            </span>
                          </td>
                          <td className="py-3">
                            {sub.is_completed ? (
                              <span className="text-emerald-600 font-bold">Đã nộp bài ({sub.score?.toFixed(1)}đ)</span>
                            ) : (
                              <span className="text-amber-500 font-bold animate-pulse">⏳ Đang làm bài...</span>
                            )}
                          </td>
                          <td className="py-3 text-slate-400">
                            {new Date(sub.submitted_at || sub.created_at).toLocaleTimeString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: BẢNG ĐIỂM HỌC SINH THEO LỚP
        ========================================== */}
        {activeTab === 'results' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-black/10 dark:border-white/10">
              <div>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Bảng Điểm Học Sinh Thuộc Lớp Của Bạn
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Chỉ hiển thị kết quả của học sinh thuộc các lớp bạn phụ trách
                </p>
              </div>

              {/* Lọc theo lớp học */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Chọn Lớp:</span>
                <select
                  value={filterClassResult}
                  onChange={(e) => setFilterClassResult(e.target.value)}
                  className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-bold outline-none"
                >
                  <option value="all">-- Toàn Bộ Lớp Của Bạn --</option>
                  {classesList.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/10 dark:border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5">Học Sinh</th>
                    <th className="py-2.5">Đề Thi</th>
                    <th className="py-2.5">Điểm Số</th>
                    <th className="py-2.5">Vi Phạm</th>
                    <th className="py-2.5">Thời Gian Nộp</th>
                    <th className="py-2.5 text-right">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {submissionsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có học sinh nào nộp bài thi cho các đề của bạn.
                      </td>
                    </tr>
                  ) : (
                    submissionsList.map((sub) => (
                      <tr key={sub.id} className="hover:bg-black/[0.02]">
                        <td className="py-3 font-bold text-slate-900 dark:text-white">
                          {sub.profiles?.full_name || sub.profiles?.email || 'Học sinh'}
                        </td>
                        <td className="py-3">{sub.exams?.title || 'Đề thi lớp'}</td>
                        <td className="py-3">
                          <span className="text-base font-black text-sky-600 dark:text-sky-400">
                            {typeof sub.score === 'number' ? sub.score.toFixed(2) : '--'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={sub.tab_switches > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500'}>
                            {sub.tab_switches > 0 ? `⚠️ ${sub.tab_switches} lần` : 'Chuẩn chỉ'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(sub.submitted_at || sub.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/new-history/${sub.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold hover:scale-105 transition"
                          >
                            <Eye className="h-3 w-3" /> Xem bài làm
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

      {/* MODAL NẠP NHANH ĐÁP ÁN (QUICK ANSWERS PARSER) */}
      {quickAnswersModalSecId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-4">
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
              Nạp Nhanh Đáp Án Hàng Loạt
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Dán chuỗi đáp án từ file Word hoặc Text: (VD: <code>1A 2B 3C 4D...</code> hoặc <code>1.Đ-S-Đ-S</code>)
            </p>

            <textarea
              rows={6}
              value={quickAnswersText}
              onChange={(e) => setQuickAnswersText(e.target.value)}
              placeholder="1A 2B 3C 4D 5A 6B 7C 8D 9A 10B 11C 12D..."
              className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 p-3 font-mono text-xs font-bold outline-none focus:border-sky-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickAnswersModalSecId(null)}
                className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-bold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleApplyQuickAnswers(quickAnswersModalSecId, quickAnswersText)}
                className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-xs font-black uppercase tracking-wider shadow"
              >
                Áp Dụng Đáp Án
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
