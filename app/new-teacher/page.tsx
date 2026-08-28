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
  MessageSquare,
  FolderOpen,
  Calendar,
  ExternalLink,
  Download,
  Megaphone,
  BellRing,
  HelpCircle,
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
type ClassSubTab = 'invite_codes' | 'announcements' | 'materials'

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

  // ==========================================
  // 1. CLASSROOMS & INVITE CODES STATE
  // ==========================================
  const [classesList, setClassesList] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [classSubTab, setClassSubTab] = useState<ClassSubTab>('invite_codes')
  const [classNameInput, setClassNameInput] = useState('')
  const [classGradeInput, setClassGradeInput] = useState('12')
  const [classSubjectInput, setClassSubjectInput] = useState('Toán học')
  const [creatingClass, setCreatingClass] = useState(false)
  const [inviteCodesList, setInviteCodesList] = useState<any[]>([])
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [maxStudentsLimitInput, setMaxStudentsLimitInput] = useState('40')

  // ==========================================
  // 2. CLASS ANNOUNCEMENTS & MESSAGES
  // ==========================================
  const [classAnnouncements, setClassAnnouncements] = useState<any[]>([])
  const [annTitleInput, setAnnTitleInput] = useState('')
  const [annContentInput, setAnnContentInput] = useState('')
  const [annPriorityInput, setAnnPriorityInput] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [sendingAnn, setSendingAnn] = useState(false)

  // ==========================================
  // 3. CLASS MATERIALS & DOCUMENTS
  // ==========================================
  const [classMaterials, setClassMaterials] = useState<any[]>([])
  const [materialTitleInput, setMaterialTitleInput] = useState('')
  const [materialDescInput, setMaterialDescInput] = useState('')
  const [materialUrlInput, setMaterialUrlInput] = useState('')
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [materialTypeInput, setMaterialTypeInput] = useState<'exam_review' | 'lecture' | 'solution' | 'slide'>('exam_review')
  const [addingMaterial, setAddingMaterial] = useState(false)

  // ==========================================
  // 4. PRO MULTI-SECTION EXAM BUILDER STATE
  // ==========================================
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examDueDate, setExamDueDate] = useState('')
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

  // Re-assign Exam Modal
  const [reassignExamModal, setReassignExamModal] = useState<any | null>(null)
  const [reassignClassId, setReassignClassId] = useState<string>('')
  const [reassignDueDate, setReassignDueDate] = useState<string>('')
  const [savingReassign, setSavingReassign] = useState(false)

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
  // 5. STUDENT RESULTS & PROCTORING STATE
  // ==========================================
  const [submissionsList, setSubmissionsList] = useState<any[]>([])
  const [filterClassResult, setFilterClassResult] = useState<string>('all')

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
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false })

        if (classesData && classesData.length > 0) {
          setClassesList(classesData)
          setSelectedClassId(classesData[0].id)
        } else {
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

      // 2. Fetch Exams created ONLY by this teacher (with assigned classes)
      try {
        const { data: examsData } = await supabase
          .from('exams')
          .select('*, class_exams(class_id, due_date, classes(name))')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })

        setExamsList(examsData || [])
      } catch {
        setExamsList([])
      }

      // 3. Fetch Submissions for exams created by this teacher
      try {
        const { data: subsData } = await supabase
          .from('submissions')
          .select('*, exams(title, created_by), profiles(full_name, email)')
          .order('submitted_at', { ascending: false })
          .limit(200)

        const teacherSubs = (subsData || []).filter((s) => s.exams?.created_by === user.id)
        setSubmissionsList(teacherSubs)
      } catch {
        setSubmissionsList([])
      }

      setLoading(false)
    }

    init()
  }, [router])

  // Load sub-items (invite codes, announcements, materials) when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId || !userId) return

    const fetchClassDetails = async () => {
      // 1. Fetch Invite Codes
      try {
        const { data: codes } = await supabase
          .from('class_invite_codes')
          .select('*')
          .eq('class_id', selectedClassId)
          .order('created_at', { ascending: false })

        if (codes && codes.length > 0) {
          setInviteCodesList(codes)
        } else {
          const localCodes = JSON.parse(localStorage.getItem(`sen_class_codes_${selectedClassId}`) || '[]')
          setInviteCodesList(localCodes)
        }
      } catch {
        const localCodes = JSON.parse(localStorage.getItem(`sen_class_codes_${selectedClassId}`) || '[]')
        setInviteCodesList(localCodes)
      }

      // 2. Fetch Announcements
      try {
        const { data: anns } = await supabase
          .from('class_announcements')
          .select('*')
          .eq('class_id', selectedClassId)
          .order('created_at', { ascending: false })

        if (anns) {
          setClassAnnouncements(anns)
        } else {
          const localAnns = JSON.parse(localStorage.getItem(`sen_class_anns_${selectedClassId}`) || '[]')
          setClassAnnouncements(localAnns)
        }
      } catch {
        const localAnns = JSON.parse(localStorage.getItem(`sen_class_anns_${selectedClassId}`) || '[]')
        setClassAnnouncements(localAnns)
      }

      // 3. Fetch Materials
      try {
        const { data: mats } = await supabase
          .from('class_materials')
          .select('*')
          .eq('class_id', selectedClassId)
          .order('created_at', { ascending: false })

        if (mats) {
          setClassMaterials(mats)
        } else {
          const localMats = JSON.parse(localStorage.getItem(`sen_class_mats_${selectedClassId}`) || '[]')
          setClassMaterials(localMats)
        }
      } catch {
        const localMats = JSON.parse(localStorage.getItem(`sen_class_mats_${selectedClassId}`) || '[]')
        setClassMaterials(localMats)
      }
    }

    fetchClassDetails()
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
  // HANDLERS: CLASSROOMS & DELETE CLASS
  // ==========================================
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classNameInput.trim()) {
      alert('Vui lòng nhập tên lớp học!')
      return
    }

    if (classesList.length >= 10 && userRole !== 'admin') {
      alert('Hạng giáo viên miễn phí tạo được tối đa 10 lớp học. Vui lòng liên hệ Admin để mở rộng thêm!')
      return
    }

    setCreatingClass(true)
    try {
      const generatedClassCode = String(Math.floor(1000 + Math.random() * 9000))
      const newClassObj = {
        name: classNameInput.trim(),
        grade: classGradeInput,
        subject: classSubjectInput,
        class_code: generatedClassCode,
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
      alert(`🎉 Đã tạo thành công lớp: ${insertedClass.name} (Mã định danh lớp: #${generatedClassCode})!`)
    } catch (err: any) {
      alert(`Lỗi tạo lớp học: ${err.message}`)
    } finally {
      setCreatingClass(false)
    }
  }

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"? Toàn bộ dữ liệu lớp, tài liệu và phân phối đề thi sẽ biến mất ngay lập tức cả ở phía học sinh!`)) {
      return
    }

    try {
      // 1. Dọn dẹp toàn bộ dữ liệu phụ thuộc của lớp
      try { await supabase.from('class_members').delete().eq('class_id', classId) } catch {}
      try { await supabase.from('class_materials').delete().eq('class_id', classId) } catch {}
      try { await supabase.from('class_announcements').delete().eq('class_id', classId) } catch {}
      try { await supabase.from('class_invite_codes').delete().eq('class_id', classId) } catch {}
      try { await supabase.from('class_exams').delete().eq('class_id', classId) } catch {}
      
      // 2. Xóa chính bản ghi lớp
      await supabase.from('classes').delete().eq('id', classId)

      const updated = classesList.filter((c) => c.id !== classId)
      setClassesList(updated)
      localStorage.setItem(`sen_teacher_classes_${userId}`, JSON.stringify(updated))
      if (selectedClassId === classId) {
        setSelectedClassId(updated.length > 0 ? updated[0].id : null)
      }
      alert(`Đã xóa thành công lớp ${className}!`)
    } catch (err: any) {
      alert(`Lỗi xóa lớp: ${err.message}`)
    }
  }

  // ==========================================
  // HANDLERS: 20-CHAR INVITE CODES
  // ==========================================
  const generate20CharCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let raw = ''
    for (let i = 0; i < 20; i++) {
      raw += chars.charAt(Math.floor(Math.random() * chars.length))
    }
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
      } catch {}

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
  // HANDLERS: CLASS ANNOUNCEMENTS & MESSAGES
  // ==========================================
  const handleSendClassAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId) {
      alert('Vui lòng chọn lớp học!')
      return
    }
    if (!annContentInput.trim()) {
      alert('Vui lòng nhập nội dung thông báo!')
      return
    }

    setSendingAnn(true)
    try {
      const newAnn = {
        id: 'ann_' + Date.now(),
        class_id: selectedClassId,
        teacher_id: userId,
        title: annTitleInput.trim() || 'Thông Báo Từ Giáo Viên',
        content: annContentInput.trim(),
        priority: annPriorityInput,
        created_at: new Date().toISOString(),
      }

      try {
        await supabase.from('class_announcements').insert(newAnn)
      } catch {}

      const updated = [newAnn, ...classAnnouncements]
      setClassAnnouncements(updated)
      localStorage.setItem(`sen_class_anns_${selectedClassId}`, JSON.stringify(updated))

      setAnnTitleInput('')
      setAnnContentInput('')
      alert('🎉 Đã gửi thông báo đến toàn bộ học sinh trong lớp!')
    } catch (err: any) {
      alert(`Lỗi gửi thông báo: ${err.message}`)
    } finally {
      setSendingAnn(false)
    }
  }

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return
    try {
      await supabase.from('class_announcements').delete().eq('id', annId)
      const updated = classAnnouncements.filter((a) => a.id !== annId)
      setClassAnnouncements(updated)
      localStorage.setItem(`sen_class_anns_${selectedClassId}`, JSON.stringify(updated))
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // ==========================================
  // HANDLERS: CLASS MATERIALS & DOCUMENTS
  // ==========================================
  const handleAddClassMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId) {
      alert('Vui lòng chọn lớp học!')
      return
    }
    if (!materialTitleInput.trim()) {
      alert('Vui lòng nhập tên tài liệu!')
      return
    }
    if (!materialFile && !materialUrlInput.trim()) {
      alert('Vui lòng chọn tệp tài liệu để tải lên hoặc dán link tài liệu!')
      return
    }

    setAddingMaterial(true)
    try {
      let finalUrl = materialUrlInput.trim()

      // Tải trực tiếp tệp lên Google Drive nếu có chọn file
      if (materialFile) {
        const uploadUrl = await initGoogleDriveUpload(materialFile.name, materialFile.type || 'application/pdf')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, materialFile, materialTitleInput.trim())
        const fileId = typeof uploaded === 'string' ? uploaded : uploaded.id
        finalUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
      }

      const newMat = {
        id: 'mat_' + Date.now(),
        class_id: selectedClassId,
        teacher_id: userId,
        title: materialTitleInput.trim(),
        description: materialDescInput.trim() || 'Tài liệu học tập do giáo viên cung cấp',
        file_url: finalUrl,
        material_type: materialTypeInput,
        created_at: new Date().toISOString(),
      }

      try {
        await supabase.from('class_materials').insert(newMat)
      } catch {}

      const updated = [newMat, ...classMaterials]
      setClassMaterials(updated)
      localStorage.setItem(`sen_class_mats_${selectedClassId}`, JSON.stringify(updated))

      setMaterialTitleInput('')
      setMaterialDescInput('')
      setMaterialUrlInput('')
      setMaterialFile(null)
      alert('🎉 Đã tải lên tài liệu mới thành công vào kho của lớp!')
    } catch (err: any) {
      alert(`Lỗi thêm tài liệu: ${err.message}`)
    } finally {
      setAddingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (matId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return
    try {
      await supabase.from('class_materials').delete().eq('id', matId)
      const updated = classMaterials.filter((m) => m.id !== matId)
      setClassMaterials(updated)
      localStorage.setItem(`sen_class_mats_${selectedClassId}`, JSON.stringify(updated))
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    }
  }

  // ĐÓNG / MỞ XEM LẠI ĐÁP ÁN ĐỀ THI
  const handleToggleAllowReview = async (examId: string, currentVal: boolean) => {
    const nextVal = !currentVal
    try {
      const { error } = await supabase.from('exams').update({ allow_review: nextVal }).eq('id', examId)
      if (error) throw error
      setExamsList(examsList.map((ex) => (ex.id === examId ? { ...ex, allow_review: nextVal } : ex)))
    } catch (err: any) {
      alert(`Lỗi cập nhật: ${err.message}`)
    }
  }

  // XÓA ĐỀ THI
  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!confirm(`Bạn có chắc muốn XÓA đề thi "${examTitle}"? Hành động này sẽ xóa toàn bộ bài nộp và phân phối lớp liên quan!`)) return
    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId)
      if (error) throw error
      setExamsList(examsList.filter((ex) => ex.id !== examId))
      alert(`Đã xóa thành công đề thi "${examTitle}"!`)
    } catch (err: any) {
      alert(`Lỗi xóa đề thi: ${err.message}`)
    }
  }

  // ==========================================
  // HANDLERS: PRO EXAM BUILDER & DUE DATE
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

  // TẠO VÀ XUẤT BẢN ĐỀ THI LỚP HỌC (CÓ HẠN CHÓT NỘP BÀI)
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
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      const accessCode = examIsHidden
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // Sinh mã 12 số chạy ngầm nếu đề thi được gán riêng cho lớp
      let generated12DigitExamCode: string | null = null
      if (assignToClassId) {
        const assignedCls = classesList.find((c) => c.id === assignToClassId)
        const class4Digits = (assignedCls?.class_code || String(Math.floor(1000 + Math.random() * 9000))).slice(0, 4)
        const exam8Digits = String(Math.floor(10000000 + Math.random() * 90000000))
        generated12DigitExamCode = `${class4Digits}${exam8Digits}`
      }

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
          exam_code: generated12DigitExamCode,
          subjects: selectedSubjects,
          max_attempts: parseInt(maxAttempts) || 1,
          grading_method: gradingMethod,
          require_proctoring: requireProctoring,
          created_by: userId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      // Gán đề vào lớp học nếu chọn + lưu hạn nộp bài
      if (assignToClassId && newExam) {
        try {
          await supabase.from('class_exams').insert({
            class_id: assignToClassId,
            exam_id: newExam.id,
            title: newExam.title,
            due_date: examDueDate || null,
          })
        } catch {}
      }

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setExamDueDate('')
      setExamIsHidden(false)
      setExamCustomCode('')
      setActiveTab('exams')
      alert(`🎉 Đã xuất bản đề thi thành công (${totalQs} câu hỏi)! ${accessCode ? `Mã PIN mở đề: ${accessCode}` : 'Đề đã sẵn sàng cho học sinh làm.'}`)
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // LƯU PHÂN PHỐI LỚP & HẠN CHÓT NỘP BÀI CHO ĐỀ THI
  const handleSaveExamAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reassignExamModal || !reassignClassId) return

    setSavingReassign(true)
    try {
      // 1. Sinh mã định danh 12 số mới cho đề
      const targetCls = classesList.find((c) => c.id === reassignClassId)
      const class4Digits = (targetCls?.class_code || String(Math.floor(1000 + Math.random() * 9000))).slice(0, 4)
      const exam8Digits = String(Math.floor(10000000 + Math.random() * 90000000))
      const new12DigitExamCode = `${class4Digits}${exam8Digits}`

      // Cập nhật exam_code trên bảng exams
      try {
        await supabase.from('exams').update({ exam_code: new12DigitExamCode }).eq('id', reassignExamModal.id)
      } catch {}

      // 2. Xóa gán cũ nếu có
      await supabase.from('class_exams').delete().eq('exam_id', reassignExamModal.id)

      // 3. Gán mới vào lớp
      await supabase.from('class_exams').insert({
        class_id: reassignClassId,
        exam_id: reassignExamModal.id,
        title: reassignExamModal.title,
        due_date: reassignDueDate || null,
      })

      // 4. Cập nhật lại examsList
      const { data: updatedExams } = await supabase
        .from('exams')
        .select('*, class_exams(class_id, due_date, classes(name))')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      setExamsList(updatedExams || [])
      setReassignExamModal(null)
      alert('🎉 Đã cập nhật lớp được phép làm đề và hạn chót nộp bài thành công!')
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`)
    } finally {
      setSavingReassign(false)
    }
  }

  // Đếm chính xác số học sinh đang thi bài của giáo viên này
  const exactLiveExamineesCount = useMemo(() => {
    return submissionsList.filter((s) => !s.is_completed).length
  }, [submissionsList])

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

  const selectedClass = classesList.find((c) => c.id === selectedClassId)

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
            <GraduationCap className="h-4 w-4" /> Lớp Học & Quản Trị ({classesList.length}/10)
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
            <Plus className="h-4 w-4" /> Soạn Đề Thi Mới
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
            <FileText className="h-4 w-4" /> Đề Thi Của Bạn ({examsList.length})
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
            <Radio className="h-4 w-4 text-rose-500 animate-pulse" /> Giám Sát Vi Phạm ({exactLiveExamineesCount} Đang Thi)
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
            TAB 1: QUẢN LÝ LỚP HỌC (MÃ MỜI, THÔNG BÁO, KHO TÀI LIỆU, XÓA LỚP)
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

            {/* Layout 2 cột: Danh sách lớp bên trái & Không gian chi tiết lớp bên phải */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cột 1: Danh sách lớp */}
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Danh Sách Lớp Của Bạn
                </h3>

                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {classesList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#6B7280] dark:text-slate-400">
                      Chưa có lớp học nào. Hãy tạo lớp đầu tiên ở form bên trên!
                    </div>
                  ) : (
                    classesList.map((cls) => (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between group ${
                          selectedClassId === cls.id
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-black shadow-sm'
                            : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold">{cls.name}</h4>
                          <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                            Khối {cls.grade} • Môn {cls.subject}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClass(cls.id, cls.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                            title="Xóa lớp học này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cột 2 & 3: Chi Tiết Lớp (Mã Mời, Thông Báo, Kho Tài Liệu) */}
              <div className="lg:col-span-2 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
                {selectedClass ? (
                  <>
                    {/* Header lớp đang chọn */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/10 dark:border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                            {selectedClass.name}
                          </h3>
                          <span className="rounded-full bg-sky-500/10 text-sky-600 px-2 py-0.5 text-[10px] font-black uppercase">
                            Khối {selectedClass.grade}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                          Môn: {selectedClass.subject} • Quản lý mã mời, tài liệu học tập & tin nhắn lớp
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteClass(selectedClass.id, selectedClass.name)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 px-3 py-1.5 text-xs font-bold transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xóa Lớp
                      </button>
                    </div>

                    {/* Sub Tabs: Mã Mời / Tin Nhắn & Thông Báo / Kho Tài Liệu */}
                    <div className="flex gap-2 border-b border-black/10 dark:border-white/10 pb-2">
                      <button
                        type="button"
                        onClick={() => setClassSubTab('invite_codes')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                          classSubTab === 'invite_codes'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Mã Mời 20 Ký Tự
                      </button>

                      <button
                        type="button"
                        onClick={() => setClassSubTab('announcements')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                          classSubTab === 'announcements'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <Megaphone className="h-3.5 w-3.5" /> Thông Báo Cho Lớp ({classAnnouncements.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setClassSubTab('materials')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                          classSubTab === 'materials'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Kho Tài Liệu Lớp ({classMaterials.length})
                      </button>
                    </div>

                    {/* SUB-TAB 1: MÃ MỜI 20 KÝ TỰ */}
                    {classSubTab === 'invite_codes' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                          <div>
                            <h4 className="text-sm font-bold">Tạo Mã Mời Mới Cho Lớp:</h4>
                            <p className="text-[11px] text-slate-400">Sinh mã 20 ký tự và giới hạn số học sinh tối đa</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs">
                              <span className="text-slate-400 font-bold">Giới hạn HS:</span>
                              <input
                                type="number"
                                min="1"
                                max="500"
                                value={maxStudentsLimitInput}
                                onChange={(e) => setMaxStudentsLimitInput(e.target.value)}
                                className="w-12 font-black text-sky-600 dark:text-sky-400 bg-transparent outline-none text-center"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleGenerate20CharInviteCode}
                              disabled={generatingCodes}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50"
                            >
                              {generatingCodes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              Tạo Mã 20 Ký Tự
                            </button>
                          </div>
                        </div>

                        {/* Danh sách mã mời */}
                        <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                          {inviteCodesList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-[#6B7280] dark:text-slate-400">
                              Chưa có mã mời nào cho lớp này. Nhấn nút <strong>"Tạo Mã 20 Ký Tự"</strong> ở trên để phát cho học sinh!
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
                                          isFull ? 'bg-rose-500/15 text-rose-600' : 'bg-emerald-500/15 text-emerald-600'
                                        }`}
                                      >
                                        {isFull ? 'Đã Đầy Chỗ' : 'Đang Hoạt Động'}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleCopySingleCode(codeItem.id, codeItem.code)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 hover:scale-105 font-bold transition"
                                    >
                                      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                      <span>{isCopied ? 'Đã chép!' : 'Copy Mã'}</span>
                                    </button>
                                  </div>

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
                                          isFull ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-indigo-500'
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
                    )}

                    {/* SUB-TAB 2: THÔNG BÁO / TIN NHẮN CHO LỚP */}
                    {classSubTab === 'announcements' && (
                      <div className="space-y-5">
                        <form onSubmit={handleSendClassAnnouncement} className="space-y-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">Tiêu đề thông báo:</label>
                              <input
                                type="text"
                                placeholder="VD: Nhắc nhở nộp bài kiểm tra 1 tiết trước thứ 6..."
                                value={annTitleInput}
                                onChange={(e) => setAnnTitleInput(e.target.value)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">Mức độ ưu tiên:</label>
                              <select
                                value={annPriorityInput}
                                onChange={(e: any) => setAnnPriorityInput(e.target.value)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                              >
                                <option value="normal">Bình thường</option>
                                <option value="important">Quan trọng ⭐</option>
                                <option value="urgent">Khẩn cấp 🚨</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Nội dung tin nhắn / thông báo:</label>
                            <textarea
                              rows={3}
                              placeholder="Nhập nội dung cần truyền đạt đến cả lớp..."
                              value={annContentInput}
                              onChange={(e) => setAnnContentInput(e.target.value)}
                              required
                              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={sendingAnn}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50"
                            >
                              {sendingAnn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Đăng Thông Báo
                            </button>
                          </div>
                        </form>

                        {/* Danh sách thông báo đã đăng */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {classAnnouncements.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Chưa có thông báo nào được đăng trong lớp này.
                            </div>
                          ) : (
                            classAnnouncements.map((ann) => (
                              <div
                                key={ann.id}
                                className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
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
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnnouncement(ann.id)}
                                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                  {ann.content}
                                </p>
                                <span className="text-[10px] text-slate-400 block pt-1">
                                  🕒 Đăng lúc {new Date(ann.created_at).toLocaleString('vi-VN')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 3: KHO TÀI LIỆU LỚP HỌC */}
                    {classSubTab === 'materials' && (
                      <div className="space-y-5">
                        <form onSubmit={handleAddClassMaterial} className="space-y-3 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">Tên tài liệu / Bài giảng:</label>
                              <input
                                type="text"
                                placeholder="VD: Đề cương ôn tập HK2 - Chuyên đề Hàm số 2026..."
                                value={materialTitleInput}
                                onChange={(e) => setMaterialTitleInput(e.target.value)}
                                required
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">Phân loại:</label>
                              <select
                                value={materialTypeInput}
                                onChange={(e: any) => setMaterialTypeInput(e.target.value)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                              >
                                <option value="exam_review">📚 Đề cương ôn tập</option>
                                <option value="lecture">📖 Bài giảng lý thuyết</option>
                                <option value="solution">💡 Lời giải chi tiết</option>
                                <option value="slide">🖥️ Slide bài học</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                                Tải Tệp Tài Liệu Trực Tiếp (PDF, Word, Ảnh, Slide...):
                              </label>
                              <input
                                type="file"
                                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                                Hoặc Dán Link Tài Liệu Ngoài (Tùy chọn):
                              </label>
                              <input
                                type="url"
                                placeholder="https://drive.google.com/... hoặc link trực tuyến"
                                value={materialUrlInput}
                                onChange={(e) => setMaterialUrlInput(e.target.value)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Mô tả / Hướng dẫn học tập:</label>
                            <input
                              type="text"
                              placeholder="VD: Đọc kỹ lý thuyết và hoàn thành bài tập áp dụng trang 5-10"
                              value={materialDescInput}
                              onChange={(e) => setMaterialDescInput(e.target.value)}
                              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-semibold outline-none focus:border-sky-500"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={addingMaterial}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50"
                            >
                              {addingMaterial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              Thêm Tài Liệu Vào Lớp
                            </button>
                          </div>
                        </form>

                        {/* Danh sách tài liệu đã thêm */}
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                          {classMaterials.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Chưa có tài liệu nào trong kho của lớp này.
                            </div>
                          ) : (
                            classMaterials.map((mat) => (
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
                                    <h4 className="text-sm font-bold">{mat.title}</h4>
                                  </div>
                                  <p className="text-xs text-slate-400">{mat.description}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <a
                                    href={mat.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 text-xs font-bold hover:scale-105 transition"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-sky-500" /> Xem/Tải
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaterial(mat.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-xs text-slate-400">
                    Vui lòng chọn một lớp học ở danh sách bên trái hoặc tạo lớp học mới!
                  </div>
                )}
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
                  Hỗ trợ đầy đủ cấu trúc 3 phần THPTQG 2026, ĐGNL HSA/TSA, nạp nhanh đáp án, gán lớp và đặt hạn chót nộp bài.
                </p>
              </div>

              {/* Nút nạp preset nhanh */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadPresetTHPT2026}
                  className="rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-3 py-1.5 text-xs font-bold transition"
                >
                  ⚡ Mẫu THPT 2026 (18 Đơn - 4 Đúng/Sai - 6 Điền Số)
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
                    Gán riêng cho lớp học nào:
                  </label>
                  <select
                    value={assignToClassId}
                    onChange={(e) => setAssignToClassId(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn lớp học để gán đề --</option>
                    {classesList.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Khối {cls.grade} - {cls.subject})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Hạn chót nộp bài (Deadline):
                  </label>
                  <input
                    type="datetime-local"
                    value={examDueDate}
                    onChange={(e) => setExamDueDate(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2.5 text-xs font-semibold outline-none focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Tệp PDF Đề Thi (Tải lên Google Drive):
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
                                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-xl">
                                  {['a', 'b', 'c', 'd'].map((sub) => {
                                    const tfObj = currentAns || { a: 'D', b: 'S', c: 'D', d: 'S' }
                                    const val = tfObj[sub] || 'D'
                                    return (
                                      <div key={sub} className="flex items-center gap-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{sub}:</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextVal = val === 'D' ? 'S' : 'D'
                                            handleAnswerChange(sec.id, qIdx, { ...tfObj, [sub]: nextVal })
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-black transition ${
                                            val === 'D'
                                              ? 'bg-emerald-500 text-white shadow-sm'
                                              : 'bg-rose-500 text-white shadow-sm'
                                          }`}
                                          title={`Bấm để đổi Đúng / Sai cho ý (${sub})`}
                                        >
                                          {val === 'D' ? 'Đ' : 'S'}
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
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
                  Xuất Bản Đề Thi Cho Lớp
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==========================================
            TAB 3: DANH SÁCH ĐỀ THI DO GIÁO VIÊN TẠO
        ========================================== */}
        {activeTab === 'exams' && (
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-black/10 dark:border-white/10">
              <div>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Đề Thi Do Bạn Tạo & Phân Phối ({examsList.length})
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Chỉ hiển thị các đề thi do bạn tạo. Quản lý lớp được phép làm và hạn chót nộp bài.
                </p>
              </div>

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
              {examsList.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-xs text-slate-400">
                  Bạn chưa tạo đề thi nào. Hãy chuyển sang tab <strong>"Soạn Đề Thi Mới"</strong> để bắt đầu nhé!
                </div>
              ) : (
                examsList
                  .filter((ex) => ex.title?.toLowerCase().includes(examSearch.toLowerCase()))
                  .map((ex) => {
                    const assignedInfo = ex.class_exams?.[0]
                    const className = assignedInfo?.classes?.name
                    const dueDate = assignedInfo?.due_date

                    return (
                      <div
                        key={ex.id}
                        className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2.5 py-0.5 text-[10px] font-black uppercase">
                              {ex.exam_type}
                            </span>
                            {className ? (
                              <span className="rounded-full bg-indigo-500/15 text-indigo-600 px-2 py-0.5 text-[10px] font-black">
                                🏫 {className}
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[10px] font-black">
                                ⚠️ Chưa gán lớp
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold line-clamp-2">{ex.title}</h4>
                          
                          <div className="text-xs text-slate-400 space-y-1">
                            <p>⏱️ Thời gian: {ex.duration} phút</p>
                            {dueDate ? (
                              <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                📅 Hạn chót: {new Date(dueDate).toLocaleString('vi-VN')}
                              </p>
                            ) : (
                              <p className="text-slate-400">📅 Hạn chót: Không giới hạn</p>
                            )}
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleAllowReview(ex.id, !!ex.allow_review)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition hover:scale-105 ${
                                  ex.allow_review
                                    ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                }`}
                                title="Bấm để Đóng / Mở quyền xem lại đáp án"
                              >
                                {ex.allow_review ? '🔓 Xem đáp án: BẬT' : '🔒 Xem đáp án: KHÓA'}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReassignExamModal(ex)
                              setReassignClassId(assignedInfo?.class_id || '')
                              setReassignDueDate(dueDate ? new Date(dueDate).toISOString().slice(0, 16) : '')
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <Sliders className="h-3.5 w-3.5" /> Gán Lớp / Hạn Chót
                          </button>

                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/new-exams/${ex.id}`}
                              className="p-2 rounded-xl bg-white dark:bg-slate-800 border hover:scale-105 transition"
                              title="Làm thử bài thi"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDeleteExam(ex.id, ex.title)}
                              className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition hover:scale-105"
                              title="Xóa đề thi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: GIÁM SÁT VI PHẠM PHÒNG THI THỜI GIAN THỰC
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
                    Theo dõi số lượng học sinh đang làm bài các đề của bạn theo thời gian thực
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-2 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">Đang Làm Bài</span>
                  <strong className="text-2xl font-black text-rose-600">{exactLiveExamineesCount} Thí Sinh</strong>
                </div>
              </div>
            </div>

            {/* Bảng ghi nhận vi phạm */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Nhật Ký Thí Sinh Đang Làm Bài & Vi Phạm (Rời Tab):
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
                    {submissionsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có thí sinh nào làm bài thi của bạn.
                        </td>
                      </tr>
                    ) : (
                      submissionsList
                        .filter((s) => !s.is_completed || (s.tab_switches || 0) > 0)
                        .slice(0, 20)
                        .map((sub) => (
                          <tr key={sub.id} className="hover:bg-black/[0.02]">
                            <td className="py-3 font-bold">{sub.profiles?.full_name || sub.profiles?.email || 'Thí sinh'}</td>
                            <td className="py-3">{sub.exams?.title || 'Đề kiểm tra'}</td>
                            <td className="py-3">
                              <span className="rounded-full bg-rose-500/15 text-rose-600 px-2 py-0.5 font-black">
                                {sub.tab_switches || 0} lần
                              </span>
                            </td>
                            <td className="py-3">
                              {sub.is_completed ? (
                                <span className="text-emerald-600 font-bold">Đã nộp ({sub.score?.toFixed(1)}đ)</span>
                              ) : (
                                <span className="text-amber-500 font-bold animate-pulse">⏳ Đang làm bài...</span>
                              )}
                            </td>
                            <td className="py-3 text-slate-400">
                              {new Date(sub.submitted_at || sub.created_at).toLocaleTimeString('vi-VN')}
                            </td>
                          </tr>
                        ))
                    )}
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
                  Bảng Điểm Học Sinh Thuộc Các Đề Của Bạn
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Chỉ hiển thị kết quả của học sinh làm bài trên các đề do bạn phụ trách
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Lọc Lớp:</span>
                <select
                  value={filterClassResult}
                  onChange={(e) => setFilterClassResult(e.target.value)}
                  className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2 text-xs font-bold outline-none"
                >
                  <option value="all">-- Tất Cả Đề Của Bạn --</option>
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

      {/* MODAL GÁN LỚP & HẠN CHÓT NỘP BÀI (RE-ASSIGN EXAM MODAL) */}
      {reassignExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-4">
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
              Phân Phối Đề & Hạn Chót Nộp Bài
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Chọn lớp học được phép xem đề: <strong>{reassignExamModal.title}</strong>
            </p>

            <form onSubmit={handleSaveExamAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Gán Cho Lớp Học:</label>
                <select
                  value={reassignClassId}
                  onChange={(e) => setReassignClassId(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                >
                  <option value="">-- Chọn lớp học --</option>
                  {classesList.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (Khối {cls.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Hạn Chót Nộp Bài (Deadline):</label>
                <input
                  type="datetime-local"
                  value={reassignDueDate}
                  onChange={(e) => setReassignDueDate(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-semibold outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignExamModal(null)}
                  className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-bold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingReassign}
                  className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-xs font-black uppercase tracking-wider shadow"
                >
                  {savingReassign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NẠP NHANH ĐÁP ÁN */}
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
