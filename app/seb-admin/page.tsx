'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  Folder,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
  Edit2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Award,
  Users,
  Eye,
  Lock,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  HelpCircle,
  Sliders,
  ArrowLeft,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-body' })

type SebAdminTab = 'exams' | 'create_exam' | 'folders' | 'submissions'

interface SectionItem {
  id: string
  name: string
  type: string
  questionCount: number
  optionsCount: number
  correctAnswers: Record<string, any>
  mixedRanges?: any[]
}

export default function SebAdminPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<SebAdminTab>('exams')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  // Dữ liệu
  const [examsList, setExamsList] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])

  // Form Tạo Đề Thi (Giống new-admin)
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [creatingExam, setCreatingExam] = useState(false)

  // SEB & Folder Settings
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [requireSeb, setRequireSeb] = useState(true)
  const [partInstructions, setPartInstructions] = useState({
    part1: true, // Trắc nghiệm 4 lựa chọn
    part2: true, // Trắc nghiệm Đúng/Sai 4 ý
    part3: true, // Trả lời ngắn / Điền số
  })

  // Cấu trúc Phần thi (Sections)
  const [examSections, setExamSections] = useState<SectionItem[]>([
    {
      id: 'sec-1',
      name: 'Phần 1: Trắc nghiệm 4 lựa chọn (A, B, C, D)',
      type: 'single_choice',
      questionCount: 18,
      optionsCount: 4,
      correctAnswers: {},
    },
    {
      id: 'sec-2',
      name: 'Phần 2: Trắc nghiệm Đúng / Sai (Mỗi câu 4 ý a, b, c, d)',
      type: 'true_false',
      questionCount: 4,
      optionsCount: 4,
      correctAnswers: {},
    },
    {
      id: 'sec-3',
      name: 'Phần 3: Trắc nghiệm trả lời ngắn / Điền số',
      type: 'short_answer',
      questionCount: 6,
      optionsCount: 0,
      correctAnswers: {},
    },
  ])

  // Quản lý Thư mục Mẹ - Con Modal State
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderModalMode, setFolderModalMode] = useState<'create_parent' | 'create_child' | 'edit'>('create_parent')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [folderNameInput, setFolderNameInput] = useState('')
  const [folderParentSelect, setFolderParentSelect] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  // Tải dữ liệu ban đầu
  const fetchAllData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        router.replace('/seb-login')
        return
      }
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle()
      const email = user.email?.toLowerCase() || ''
      if (profile?.role !== 'admin' && profile?.role !== 'collab' && email !== 'hoangbinhminh2508@gmail.com') {
        alert('Chỉ Quản trị viên mới có quyền truy cập vào cổng Seb Admin!')
        router.replace('/seb-dashboard')
        return
      }

      // 1. Tải folders
      const fRes = await fetch('/api/seb/folders')
      const fData = await fRes.json()
      setFolders(fData.folders || [])

      // 2. Tải exams
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
      setExamsList(exData || [])

      // 3. Tải bài nộp gần nhất
      const { data: subData } = await supabase
        .from('submissions')
        .select('id, user_id, score, is_completed, submitted_at, created_at, tab_switches, exams(title), profiles(full_name, email)')
        .order('submitted_at', { ascending: false })
        .limit(30)
      setSubmissions(subData || [])
    } catch (err) {
      console.error('Lỗi tải dữ liệu Seb Admin:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    fetchAllData()
  }, [])

  // Danh sách các Thư Mục Con để gán đề
  const allChildFolders = useMemo(() => {
    const list: any[] = []
    folders.forEach((parent) => {
      if (parent.children) {
        parent.children.forEach((child: any) => {
          list.push({ ...child, parentName: parent.name })
        })
      }
    })
    return list
  }, [folders])

  // Cập nhật câu trả lời đúng cho một câu hỏi
  const handleSetCorrectAnswer = (secIdx: number, qIdx: number, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: value }
      next[secIdx] = targetSec
      return next
    })
  }

  // Cập nhật câu trả lời Đúng/Sai 4 ý
  const handleSetCorrectAnswerTF = (secIdx: number, qIdx: number, subLabel: string, val: string) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      const currentQ = { ...(targetSec.correctAnswers[qIdx] || {}) }
      currentQ[subLabel] = val
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: currentQ }
      next[secIdx] = targetSec
      return next
    })
  }

  // Xuất bản đề thi mới
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload file PDF lên Google Drive qua Resumable Upload
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Sinh mã code ẩn nếu chọn đề ẩn
      const accessCode = examIsHidden
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

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
          max_attempts: parseInt(maxAttempts) || 1,
          folder_id: selectedFolderId || null,
          require_seb: requireSeb,
          part_instructions: partInstructions,
          created_by: currentUserId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setActiveTab('exams')
      alert(`🎉 Đã xuất bản đề thi SEB thành công! ${accessCode ? `Mã code: ${accessCode}` : ''}`)
    } catch (err: any) {
      alert('Lỗi xuất bản đề thi: ' + err.message)
    } finally {
      setCreatingExam(false)
    }
  }

  // Quản lý Thư mục: Lưu thư mục Mẹ / Con
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderNameInput.trim()) return

    setFolderSaving(true)
    try {
      const payload: any = {
        action: editingFolderId ? 'update' : 'create',
        folderId: editingFolderId,
        name: folderNameInput.trim(),
        parentId: folderParentSelect || null,
        userRole: 'admin',
      }

      const res = await fetch('/api/seb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu thư mục')

      setShowFolderModal(false)
      setFolderNameInput('')
      setEditingFolderId(null)
      await fetchAllData()
      alert('Đã cập nhật thư mục thành công!')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFolderSaving(false)
    }
  }

  // Xóa thư mục
  const handleDeleteFolder = async (fId: string, fName: string) => {
    if (!confirm(`Xác nhận xóa thư mục "${fName}" và toàn bộ các thư mục con bên trong?`)) return
    try {
      const res = await fetch('/api/seb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', folderId: fId, userRole: 'admin' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi xóa thư mục')
      await fetchAllData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div
      className={`min-h-screen w-full bg-slate-50 flex flex-col text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-sebadm-body)' }}
    >
      {/* Top Navbar */}
      <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/seb-dashboard"
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <SebLogo size={34} showText={true} />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'exams'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quản Lý Đề Thi ({examsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create_exam')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              activeTab === 'create_exam'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tạo Đề Mới</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('folders')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              activeTab === 'folders'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Thư Mục Mẹ - Con</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'submissions'
                ? 'bg-white text-sky-700 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bài Nộp ({submissions.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
        {/* ======================================================== */}
        {/* TAB 1: DANH SÁCH ĐỀ THI */}
        {/* ======================================================== */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-xl font-black text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  Danh Sách Đề Thi Safe Exam Browser
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đề thi được bảo mật và phân quyền theo Thư Mục Mẹ - Con
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create_exam')}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-sky-500/20"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo Đề Thi Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examsList.map((exam) => (
                <div
                  key={exam.id}
                  className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {exam.exam_type || 'THPTQG'}
                      </span>
                      {exam.require_seb && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Yêu cầu SEB</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2">{exam.title}</h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                      <span>{exam.duration || 50} phút</span>
                      <span>•</span>
                      <span>Số lần thi tối đa: {exam.max_attempts || 1}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/seb-exam/${exam.id}`}
                      target="_blank"
                      className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Thử làm đề</span>
                    </Link>

                    <a
                      href={`/api/seb/config?examId=${exam.id}&download=1`}
                      className="text-xs font-bold text-slate-600 hover:text-sky-700 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 transition"
                      title="Tải cấu hình .seb cho đề thi này"
                    >
                      Tải .seb
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TẠO ĐỀ THI MỚI (TƯƠNG TỰ NEW-ADMIN) */}
        {/* ======================================================== */}
        {activeTab === 'create_exam' && (
          <form onSubmit={handleCreateExam} className="space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-5">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                1. Thông Tin Chung & File Đề Thi PDF
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Tên Đề Thi *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Ví dụ: Đề Khảo Sát Chất Lượng Học Kỳ 1 Môn Vật Lí"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thời Gian Làm Bài (Phút)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    min={5}
                    max={300}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Số Lần Thi Tối Đa (Max Attempts)</label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    min={1}
                    max={10}
                    required
                  />
                </div>

                {/* Chọn Thư Mục Con (Môn Thi) Cho Đề */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Gán Vào Thư Mục Môn Thi (SEB Dashboard)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  >
                    <option value="">-- Chọn thư mục môn thi tương ứng --</option>
                    {allChildFolders.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.parentName} ➔ {child.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File PDF Đề Thi */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    File Đề Thi PDF (Tải trực tiếp lên Google Drive) *
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setExamPdfFile(e.target.files?.[0] || null)}
                    className="w-full px-3.5 py-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs cursor-pointer"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. Cấu Hình Safe Exam Browser & Hướng Dẫn 3 Phần */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-4">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                2. Bảo Mật SEB & Hướng Dẫn Làm Bài Các Phần Thi
              </h2>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
                <input
                  type="checkbox"
                  id="requireSebCheck"
                  checked={requireSeb}
                  onChange={(e) => setRequireSeb(e.target.checked)}
                  className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <label htmlFor="requireSebCheck" className="text-xs font-bold text-sky-900 cursor-pointer">
                  Khóa môi trường thi bằng Safe Exam Browser (Chặn Alt+Tab, chụp màn hình, ứng dụng ngoài)
                </label>
              </div>

              {/* Tùy chọn hiển thị hướng dẫn cho 3 phần thi */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Hiển Thị Hướng Dẫn Tại Phòng Chờ Thí Sinh:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={partInstructions.part1}
                      onChange={(e) =>
                        setPartInstructions((p) => ({ ...p, part1: e.target.checked }))
                      }
                      className="rounded-md text-sky-600"
                    />
                    <span>Phần 1: Trắc Nghiệm 4 Lựa Chọn</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={partInstructions.part2}
                      onChange={(e) =>
                        setPartInstructions((p) => ({ ...p, part2: e.target.checked }))
                      }
                      className="rounded-md text-sky-600"
                    />
                    <span>Phần 2: Đúng / Sai (4 Ý)</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={partInstructions.part3}
                      onChange={(e) =>
                        setPartInstructions((p) => ({ ...p, part3: e.target.checked }))
                      }
                      className="rounded-md text-sky-600"
                    />
                    <span>Phần 3: Điền Số / Trả Lời Ngắn</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Cấu Trúc Đề Thi & Bảng Đáp Án */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-6">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                3. Bảng Đáp Án Các Phần Thi
              </h2>

              {examSections.map((section, sIdx) => (
                <div key={section.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800">{section.name}</h3>
                    <span className="text-xs font-bold text-slate-400">
                      {section.questionCount} câu hỏi
                    </span>
                  </div>

                  {/* Bảng nhập đáp án cho phần này */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const ans = section.correctAnswers[qIdx]

                      return (
                        <div key={qIdx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                          <span className="font-bold text-slate-500 block mb-1">Câu {qIdx + 1}</span>

                          {section.type === 'single_choice' && (
                            <div className="flex gap-1">
                              {['A', 'B', 'C', 'D'].map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleSetCorrectAnswer(sIdx, qIdx, opt)}
                                  className={`h-7 w-7 rounded-lg font-black transition ${
                                    ans === opt
                                      ? 'bg-sky-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {section.type === 'true_false' && (
                            <div className="space-y-1">
                              {['a', 'b', 'c', 'd'].map((sub) => (
                                <div key={sub} className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold uppercase text-slate-400">{sub}:</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'Đ')}
                                      className={`px-1.5 py-0.5 rounded-md font-bold ${
                                        ans?.[sub] === 'Đ' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
                                      }`}
                                    >
                                      Đ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'S')}
                                      className={`px-1.5 py-0.5 rounded-md font-bold ${
                                        ans?.[sub] === 'S' ? 'bg-rose-600 text-white' : 'bg-slate-100'
                                      }`}
                                    >
                                      S
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {section.type === 'short_answer' && (
                            <input
                              type="text"
                              value={ans || ''}
                              onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                              placeholder="Đáp số..."
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono font-bold"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Nút Xuất Bản */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-bold"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={creatingExam}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-sky-500/20"
              >
                {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                <span>Xuất Bản Đề Thi SEB</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ THƯ MỤC MẸ & CON */}
        {/* ======================================================== */}
        {activeTab === 'folders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-xl font-black text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                >
                  Quản Lý Cây Thư Mục Mẹ - Con
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thư mục Mẹ đại diện cho khối thi/kỳ thi, thư mục Con đại diện cho các môn thi cụ thể
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFolderModalMode('create_parent')
                    setFolderNameInput('')
                    setFolderParentSelect('')
                    setEditingFolderId(null)
                    setShowFolderModal(true)
                  }}
                  className="px-3.5 py-2 rounded-2xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>+ Thư Mục Mẹ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFolderModalMode('create_child')
                    setFolderNameInput('')
                    setFolderParentSelect(folders[0]?.id || '')
                    setEditingFolderId(null)
                    setShowFolderModal(true)
                  }}
                  className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-500/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thư Mục Con (Môn Thi)</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {folders.map((parent) => (
                <div key={parent.id} className="p-5 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Folder className="h-5 w-5 text-sky-600" />
                      <h3 className="text-base font-bold text-slate-900">{parent.name}</h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {parent.children?.length || 0} môn thi
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(parent.id, parent.name)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl transition"
                      title="Xóa thư mục mẹ này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Danh sách Thư mục con */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {parent.children?.map((child: any) => (
                      <div
                        key={child.id}
                        className="p-3 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-sky-500" />
                          <span className="text-xs font-bold text-slate-800 truncate">{child.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 font-mono">
                            {child.exam_count || 0} đề
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFolder(child.id, child.name)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: BÀI NỘP VÀ GIÁM SÁT THI TRỰC TIẾP */}
        {/* ======================================================== */}
        {activeTab === 'submissions' && (
          <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-4">
            <h2
              className="text-xl font-black text-slate-900"
              style={{ fontFamily: 'var(--font-sebadm-heading)' }}
            >
              Lịch Sử Bài Nộp & Giám Sát SEB
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Thí Sinh</th>
                    <th className="p-3">Đề Thi</th>
                    <th className="p-3 text-center">Điểm Số</th>
                    <th className="p-3 text-center">Cảnh Báo Chuyển Tab</th>
                    <th className="p-3 text-right">Thời Điểm Nộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-bold text-slate-900">
                        {sub.profiles?.full_name || 'Học sinh'}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {sub.profiles?.email}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{sub.exams?.title || 'N/A'}</td>
                      <td className="p-3 text-center font-black text-sky-700 text-sm">
                        {Number(sub.score || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        {sub.tab_switches > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            ⚠️ {sub.tab_switches} lần
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">
                            ✓ Nghiêm túc
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleTimeString('vi-VN')
                          : 'Đang làm bài'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa Thư Mục */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-sky-100 shadow-2xl space-y-4">
            <h3
              className="text-lg font-black text-slate-900"
              style={{ fontFamily: 'var(--font-sebadm-heading)' }}
            >
              {folderModalMode === 'create_parent'
                ? 'Tạo Thư Mục Mẹ (Khối Thi / Kỳ Thi)'
                : 'Tạo Thư Mục Con (Môn Thi)'}
            </h3>

            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tên Thư Mục *</label>
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder={
                    folderModalMode === 'create_parent'
                      ? 'Ví dụ: Kỳ Thi THPT Quốc Gia'
                      : 'Ví dụ: Vật Lí Kỹ Thuật'
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              {folderModalMode === 'create_child' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thuộc Thư Mục Mẹ *</label>
                  <select
                    value={folderParentSelect}
                    onChange={(e) => setFolderParentSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs"
                    required
                  >
                    {folders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={folderSaving}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  {folderSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Lưu Thư Mục</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
