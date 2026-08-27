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
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newteacher-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newteacher-body' })

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'Kiểm tra 1 tiết', 'Học kỳ']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học' },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh' },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học' },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí' },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh' },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)' },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)' },
]

export default function NewTeacherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [teacherName, setTeacherName] = useState('')

  const [activeTab, setActiveTab] = useState<'exams' | 'create' | 'results'>('exams')
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // CREATE EXAM STATE
  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('THPTQG')
  const [duration, setDuration] = useState('50')
  const [allowReview, setAllowReview] = useState(true)
  const [isHiddenExam, setIsHiddenExam] = useState(false)
  const [customAccessCode, setCustomAccessCode] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [selectedBlock, setSelectedBlock] = useState('A00')
  const [questionCount, setQuestionCount] = useState('50')
  const [creatingExam, setCreatingExam] = useState(false)

  // STUDENT RESULTS STATE
  const [submissionsList, setSubmissionsList] = useState<any[]>([])

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
        alert('Cổng Giảng Viên chỉ dành riêng cho tài khoản được cấp quyền Teacher / Admin.')
        router.replace('/new-dashboard')
        return
      }

      // Fetch exams created by this teacher (or all exams if admin)
      let query = supabase.from('exams').select('*').order('created_at', { ascending: false })
      if (role === 'teacher') {
        query = query.eq('created_by', user.id)
      }
      const { data: examsData } = await query.limit(100)
      setExamsList(examsData || [])

      // Fetch submissions for teacher exams
      const { data: subsData } = await supabase
        .from('submissions')
        .select('*, exams(title), profiles(full_name, email)')
        .order('submitted_at', { ascending: false })
        .limit(100)

      setSubmissionsList(subsData || [])
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

  const handleCopyAccessCode = (id: string, codeStr: string) => {
    navigator.clipboard.writeText(codeStr)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // TẠO ĐỀ THI MỚI VÀ UPLOAD PDF LÊN GOOGLE DRIVE
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !pdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload tệp PDF lên Google Drive
      const uploadUrl = await initGoogleDriveUpload(pdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, pdfFile, title)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Sinh mã code ẩn nếu chọn đề ẩn
      const accessCode = isHiddenExam
        ? customAccessCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // 3. Cấu trúc đề thi mặc định
      const qCount = parseInt(questionCount) || 50
      const examStructure = [
        {
          id: 'sec_1',
          name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn',
          type: 'single_choice',
          questionCount: qCount,
          optionsCount: 4,
          correctAnswers: Array.from({ length: qCount }, () => 'A'),
        },
      ]

      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          title: title.trim(),
          exam_type: examType,
          duration: parseInt(duration) || 50,
          drive_file_id: driveFileId,
          exam_structure: examStructure,
          allow_review: allowReview,
          is_hidden: isHiddenExam,
          access_code: accessCode,
          created_by: userId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      setExamsList([newExam, ...examsList])
      setTitle('')
      setPdfFile(null)
      setIsHiddenExam(false)
      setCustomAccessCode('')
      setActiveTab('exams')
      alert(
        `Đã xuất bản đề thi thành công! ${accessCode ? `Mã code mở đề bí mật: ${accessCode}` : 'Đề thi đã được mở công khai.'}`
      )
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // Bật/tắt allow_review của đề thi
  const handleToggleReview = async (examId: string, currentVal: boolean) => {
    const nextVal = !currentVal
    await supabase.from('exams').update({ allow_review: nextVal }).eq('id', examId)
    setExamsList(examsList.map((e) => (e.id === examId ? { ...e, allow_review: nextVal } : e)))
  }

  const filteredExams = useMemo(() => {
    const q = examSearch.toLowerCase().trim()
    if (!q) return examsList
    return examsList.filter((e) => (e.title || '').toLowerCase().includes(q) || (e.access_code || '').toLowerCase().includes(q))
  }, [examsList, examSearch])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
          <span className="font-bold text-sm">Đang xác thực quyền Giảng viên...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
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
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-black text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                  <School className="inline h-3.5 w-3.5 mr-1" /> Cổng Giảng Viên 2.0
                </span>
                <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                  {teacherName}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                Quản Lý & Soạn Đề Thi Lớp Học
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

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <FileText className="h-4 w-4" /> Danh Sách Đề Thi ({examsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'create'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Plus className="h-4 w-4 text-cyan-500" /> Soạn Đề Thi Mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'results'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Award className="h-4 w-4 text-amber-500" /> Bảng Điểm Học Sinh ({submissionsList.length})
          </button>
        </div>

        {/* TAB 1: EXAMS LIST & SECRET ACCESS CODES */}
        {activeTab === 'exams' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi hoặc mã code ẩn..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 pl-10 pr-3 text-xs font-semibold outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
              >
                <Plus className="h-4 w-4" /> Soạn Đề Thi Mới
              </button>
            </div>

            {/* Exams Table */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Tên đề thi</th>
                      <th className="pb-3 font-bold uppercase">Phân loại</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Mã Code Ẩn (Bí Mật)</th>
                      <th className="pb-3 font-bold uppercase">Xem lại lời giải</th>
                      <th className="pb-3 font-bold uppercase text-right">Phòng thi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {filteredExams.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#6B7280] dark:text-slate-400">
                          Chưa có đề thi nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredExams.map((exam) => (
                        <tr key={exam.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="py-3.5 font-bold max-w-xs truncate text-slate-900 dark:text-white">
                            {exam.title}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                              {exam.exam_type}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono">{exam.duration} phút</td>
                          <td className="py-3.5">
                            {exam.access_code ? (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                  {exam.access_code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyAccessCode(exam.id, exam.access_code)}
                                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#6B7280]"
                                  title="Sao chép mã mở đề cho học sinh"
                                >
                                  {copiedCodeId === exam.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#6B7280] font-normal">Công khai (Không khóa)</span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleReview(exam.id, exam.allow_review)}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition ${
                                exam.allow_review
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              }`}
                            >
                              {exam.allow_review ? 'Đang mở' : 'Đã khóa'}
                            </button>
                          </td>
                          <td className="py-3.5 text-right">
                            <Link
                              href={`/new-exams/${exam.id}`}
                              className="inline-flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10"
                            >
                              <Eye className="h-3.5 w-3.5" /> Vào thi
                            </Link>
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

        {/* TAB 2: CREATE EXAM FORM */}
        {activeTab === 'create' && (
          <div className="mt-6 max-w-3xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
                  Soạn Đề Thi Mới & Đính Kèm File PDF
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Tải file đề thi PDF lên máy chủ Google Drive và thiết lập mã code mở đề cho học sinh.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Tên tiêu đề đề thi</label>
                <input
                  type="text"
                  placeholder="Đề kiểm tra giữa kỳ 2 môn Toán lớp 12..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm outline-none focus:border-cyan-500 shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Loại kỳ thi</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Thời gian làm bài (phút)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Số lượng câu hỏi</label>
                  <input
                    type="number"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Tùy chọn Đề Ẩn / Mã Code Bí Mật */}
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-black">Đặt mã khóa bí mật cho đề thi (Đề thi lớp học)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isHiddenExam}
                    onChange={(e) => setIsHiddenExam(e.target.checked)}
                    className="h-4 w-4 accent-cyan-600 cursor-pointer"
                  />
                </div>

                {isHiddenExam && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1">
                      Mã Code mở đề tùy chỉnh (bỏ trống để hệ thống tự sinh mã 6 ký tự):
                    </label>
                    <input
                      type="text"
                      placeholder="VD: TOAN12, KTRA2026..."
                      value={customAccessCode}
                      onChange={(e) => setCustomAccessCode(e.target.value.toUpperCase())}
                      className="h-10 w-full font-mono font-bold uppercase rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Upload PDF */}
              <div>
                <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Tệp PDF đề thi</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-slate-800 dark:file:text-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={creatingExam}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition disabled:opacity-50"
              >
                {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Xuất Bản Đề Thi Cho Học Sinh
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: STUDENT RESULTS */}
        {activeTab === 'results' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newteacher-heading)' }}>
              Kết Quả Nộp Bài Của Học Sinh ({submissionsList.length})
            </h3>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                    <th className="pb-3 font-bold uppercase">Học sinh</th>
                    <th className="pb-3 font-bold uppercase">Đề thi</th>
                    <th className="pb-3 font-bold uppercase">Điểm số</th>
                    <th className="pb-3 font-bold uppercase">Thời gian nộp</th>
                    <th className="pb-3 font-bold uppercase text-right">Xem chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {submissionsList.map((sub) => (
                    <tr key={sub.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-3">
                        <p className="font-bold">{sub.profiles?.full_name || 'Học sinh'}</p>
                        <span className="text-[11px] text-[#6B7280]">{sub.profiles?.email}</span>
                      </td>
                      <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400 max-w-xs truncate">
                        {sub.exams?.title || 'Đề thi'}
                      </td>
                      <td className="py-3 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {sub.score !== null ? `${sub.score} đ` : 'Chưa chấm'}
                      </td>
                      <td className="py-3 text-[11px] text-[#6B7280]">
                        {new Date(sub.submitted_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/new-history/${sub.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 px-2.5 py-1 text-xs font-bold hover:bg-black/10"
                        >
                          <Eye className="h-3 w-3" /> Bài làm
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
