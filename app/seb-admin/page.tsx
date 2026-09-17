'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { isExamInFolder } from '@/lib/sebFolderUtils'
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
  Sparkles,
  Image as ImageIcon,
  Check,
  X,
  FileUp,
  Settings2,
  BookOpen,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-sebadm-body' })

type SebAdminTab = 'exams' | 'create_exam' | 'folders' | 'submissions'

export interface SectionItem {
  id: string
  name: string
  totalPoints: number
  scoringMode: 'auto_divide' | 'custom_points'
  pointsPerQuestion?: Record<number, number>
  questionCount: number
  questionTypeMode: 'uniform' | 'custom'
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  questionTypes?: Record<number, string>
  instructions: string
  instructionImage?: string
  correctAnswers: Record<string, any>
  optionsCount?: number
  mixedRanges?: any[]
}

function normalizeQuestionType(
  rawType: any,
  section?: any,
  qIdx?: number
): 'single_choice' | 'true_false' | 'short_answer' | 'essay' {
  let type = (rawType || '').toString().toLowerCase().trim()

  if ((type === 'mixed' || !type) && section?.mixedRanges && Array.isArray(section.mixedRanges) && qIdx !== undefined) {
    const range = section.mixedRanges.find(
      (r: any) => qIdx + 1 >= (r.start || 1) && qIdx + 1 <= (r.end || 999)
    )
    if (range?.type) {
      type = range.type.toString().toLowerCase().trim()
    }
  }

  if (
    type.includes('true') ||
    type.includes('tf') ||
    type.includes('dung_sai') ||
    type.includes('đúng') ||
    type.includes('sai')
  ) {
    return 'true_false'
  }

  if (
    type.includes('short') ||
    type.includes('ngắn') ||
    type.includes('điền') ||
    type.includes('fill') ||
    type.includes('dien_so') ||
    type === 'sa'
  ) {
    return 'short_answer'
  }

  if (
    type.includes('essay') ||
    type.includes('luận') ||
    type.includes('tu_luan')
  ) {
    return 'essay'
  }

  return 'single_choice'
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

  // AI Assistant State (Gemini 3.5 Flash Lite)
  const [analyzingWithAi, setAnalyzingWithAi] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('')

  // Cấu trúc Phần thi linh hoạt (Sections)
  const [examSections, setExamSections] = useState<SectionItem[]>([
    {
      id: 'sec-1',
      name: 'Phần 1: Câu trắc nghiệm nhiều phương án lựa chọn',
      totalPoints: 4.5,
      scoringMode: 'auto_divide',
      questionCount: 18,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-2',
      name: 'Phần 2: Câu trắc nghiệm Đúng / Sai (4 ý a, b, c, d)',
      totalPoints: 4.0,
      scoringMode: 'auto_divide',
      questionCount: 4,
      questionTypeMode: 'uniform',
      type: 'true_false',
      instructions: 'Trong mỗi câu có 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý. Điểm số tính lũy tiến theo số ý đúng.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-3',
      name: 'Phần 3: Câu trắc nghiệm trả lời ngắn / Điền số',
      totalPoints: 1.5,
      scoringMode: 'auto_divide',
      questionCount: 6,
      questionTypeMode: 'uniform',
      type: 'short_answer',
      instructions: 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống (dạng số thập phân hoặc số nguyên, ví dụ: 2.5 hoặc -4).',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
  ])

  // Quản lý Thư mục Mẹ - Con Modal State
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderModalMode, setFolderModalMode] = useState<'create_parent' | 'create_child' | 'edit'>('create_parent')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [folderNameInput, setFolderNameInput] = useState('')
  const [folderParentSelect, setFolderParentSelect] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  // Quản lý đề thi trong Thư Mục Con (Admin Modal)
  const [selectedAdminChildFolder, setSelectedAdminChildFolder] = useState<any | null>(null)
  const [showAdminFolderExamModal, setShowAdminFolderExamModal] = useState<boolean>(false)
  const [adminFolderExamSearch, setAdminFolderExamSearch] = useState<string>('')
  const [updatingAdminFolderExams, setUpdatingAdminFolderExams] = useState<boolean>(false)

  const handleToggleExamInChildFolder = async (examId: string, currentInFolder: boolean) => {
    if (!selectedAdminChildFolder) return
    setUpdatingAdminFolderExams(true)
    try {
      const res = await fetch('/api/seb/folder-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedAdminChildFolder.id,
          ...(currentInFolder ? { unassignExamId: examId } : { assignExamId: examId }),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setExamsList((prev) =>
          prev.map((e) =>
            e.id === examId ? { ...e, folder_id: currentInFolder ? 'none' : selectedAdminChildFolder.id } : e
          )
        )
      }
    } catch (e) {
      console.error('Lỗi cập nhật đề vào thư mục:', e)
    } finally {
      setUpdatingAdminFolderExams(false)
    }
  }

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
        .select('id, user_id, score, is_graded, created_at, exams(title), profiles(full_name, email)')
        .order('created_at', { ascending: false })
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

  // Thống kê tổng điểm và tổng số câu của toàn đề
  const totalExamPoints = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (Number(sec.totalPoints) || 0), 0)
  }, [examSections])

  const totalQuestionCount = useMemo(() => {
    return examSections.reduce((acc, sec) => acc + (parseInt(String(sec.questionCount)) || 0), 0)
  }, [examSections])

  // Thêm một phần thi mới
  const handleAddSection = () => {
    const newIdx = examSections.length + 1
    const newSec: SectionItem = {
      id: `sec-${Date.now()}`,
      name: `Phần ${newIdx}: Phần thi mới`,
      totalPoints: 2.0,
      scoringMode: 'auto_divide',
      questionCount: 5,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh đọc kỹ đề bài và chọn đáp án chính xác.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    }
    setExamSections((prev) => [...prev, newSec])
  }

  // Xóa một phần thi
  const handleRemoveSection = (secIdx: number) => {
    if (examSections.length <= 1) {
      alert('Đề thi phải có ít nhất 1 phần thi!')
      return
    }
    if (!confirm(`Bạn có chắc muốn xóa "${examSections[secIdx].name}"?`)) return
    setExamSections((prev) => prev.filter((_, idx) => idx !== secIdx))
  }

  // Cập nhật thông tin chung của phần thi
  const handleUpdateSectionField = (secIdx: number, field: keyof SectionItem, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      next[secIdx] = { ...next[secIdx], [field]: value }
      return next
    })
  }

  // Cập nhật điểm tùy chỉnh cho từng câu
  const handleSetQuestionPoint = (secIdx: number, qIdx: number, points: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.pointsPerQuestion = { ...sec.pointsPerQuestion, [qIdx]: points }
      next[secIdx] = sec
      return next
    })
  }

  // Cập nhật thể loại câu hỏi khi ở chế độ tùy ý từng câu
  const handleSetQuestionType = (secIdx: number, qIdx: number, type: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.questionTypes = { ...sec.questionTypes, [qIdx]: type }
      next[secIdx] = sec
      return next
    })
  }

  // Xử lý upload ảnh hướng dẫn làm bài cho phần thi
  const handleUploadInstructionImage = (secIdx: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      handleUpdateSectionField(secIdx, 'instructionImage', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Trích xuất toàn bộ văn bản từ file PDF trên client bằng pdfjs-dist
  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      }

      const fileToArrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise

      let fullTextContent = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ')
        fullTextContent += `\n[--- TRANG ${i} ---]\n` + pageText
      }

      return fullTextContent.trim()
    } catch (err: any) {
      console.warn('Không thể trích xuất văn bản từ PDF qua pdfjs:', err)
      return ''
    }
  }

  // Kích hoạt Gemini phân tích file PDF & tự động tạo đề
  const handleAiAnalyze = async (fileToAnalyze?: File) => {
    const targetFile = fileToAnalyze || examPdfFile
    if (!targetFile) {
      alert('Vui lòng chọn hoặc kéo thả file PDF đề thi để Gemini phân tích!')
      return
    }

    setAnalyzingWithAi(true)
    setAiStatusMessage('Đang quét và bóc tách nội dung văn bản từ file PDF...')

    try {
      // 1. Thử trích xuất văn bản trên client bằng PDF.js (chỉ mất ~200ms, không tốn băng thông)
      const extractedText = await extractTextFromPdf(targetFile)

      let res: Response

      if (extractedText && extractedText.length > 50) {
        setAiStatusMessage('Đã trích xuất xong đề thi! AI đang phân tích các phần thi và giải ma trận đáp án...')
        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examText: extractedText,
          }),
        })
      } else {
        // Nếu là PDF scan không có text layer, gửi trực tiếp qua FormData thay vì bọc Base64
        setAiStatusMessage('Đang gửi file PDF tới AI để nhận diện nội dung và giải đề...')
        const formData = new FormData()
        formData.append('file', targetFile)
        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          body: formData,
        })
      }

      // Xử lý an toàn phản hồi từ server, tuyệt đối không để crash JSON.parse
      const resText = await res.text()
      let json: any = null
      try {
        json = JSON.parse(resText)
      } catch {
        if (res.status === 413) {
          throw new Error('Dung lượng file đề thi vượt quá giới hạn máy chủ (413 Payload Too Large). Vui lòng thử nén file hoặc dùng file PDF có lớp văn bản.')
        }
        if (res.status === 504 || res.status === 502) {
          throw new Error('Quá thời gian phản hồi từ máy chủ (Gateway Timeout). Vui lòng thử lại.')
        }
        throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${res.status}): ${resText.slice(0, 100)}...`)
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Không thể phân tích đề thi bằng AI.')
      }

      const data = json.data
      if (data.title) {
        setExamTitle(data.title)
      }
      if (data.duration) {
        setExamDuration(String(data.duration))
      }
      if (data.exam_type) {
        setExamTypeVal(data.exam_type)
      }

      if (Array.isArray(data.sections) && data.sections.length > 0) {
        const mappedSections: SectionItem[] = data.sections.map((s: any, idx: number) => ({
          id: s.id || `sec-${Date.now()}-${idx}`,
          name: s.name || `Phần ${idx + 1}`,
          totalPoints: Number(s.totalPoints) || 0,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          questionCount: parseInt(s.questionCount) || 1,
          questionTypeMode: s.questionTypeMode || 'uniform',
          type: normalizeQuestionType(s.type, s, idx),
          questionTypes: s.questionTypes || {},
          instructions: s.instructions || '',
          instructionImage: s.instructionImage || '',
          correctAnswers: s.correctAnswers || {},
        }))

        setExamSections(mappedSections)
        alert(`🎉 Phân tích file PDF thành công bằng Gemini!\nĐã nhận diện ${mappedSections.length} phần thi và tự động giải sẵn bảng đáp án. Bạn có thể kiểm tra lại thông tin và bảng đáp án bên dưới.`)
      }
    } catch (err: any) {
      console.error('Lỗi phân tích AI:', err)
      alert('Lỗi phân tích file PDF bằng Gemini: ' + (err.message || 'Vui lòng kiểm tra lại file PDF.'))
    } finally {
      setAnalyzingWithAi(false)
      setAiStatusMessage('')
    }
  }

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
          part_instructions: examSections.map((s) => ({
            id: s.id,
            name: s.name,
            instructions: s.instructions,
            instructionImage: s.instructionImage,
          })),
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
            {/* 1. TẢI FILE PDF & PHÂN TÍCH TỰ ĐỘNG BẰNG GEMINI 3.5 FLASH LITE */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 via-sky-50 to-blue-50 border border-indigo-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      className="text-lg font-black text-indigo-950 flex items-center gap-2"
                      style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                    >
                      <span>1. Tải Lên File PDF Đề Thi (Phân Tích Bằng Gemini 3.5 Flash Lite)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider">
                        AI Tự Động
                      </span>
                    </h2>
                    <p className="text-xs text-indigo-700/80">
                      Tải file PDF đề thi của bạn lên. Gemini 3.5 Flash Lite sẽ tự động đọc, trích xuất cấu trúc đề thi, số phần, số câu và giải trước bảng đáp án chính xác.
                    </p>
                  </div>
                </div>
              </div>

              {/* Khu vực Tải / Kéo thả File PDF */}
              {!examPdfFile ? (
                <label className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white/70 hover:bg-white rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition text-center group shadow-xs">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setExamPdfFile(f)
                        handleAiAnalyze(f)
                      }
                    }}
                  />
                  <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition flex items-center justify-center">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-indigo-950 block">
                      Bấm vào đây để chọn File PDF Đề Thi (hoặc kéo thả file vào đây)
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Khi tải file PDF lên, hệ thống sẽ tự động gửi tới Gemini 3.5 Flash Lite để phân tích và giải đề ngay lập tức
                    </span>
                  </div>
                </label>
              ) : (
                <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 truncate block">
                            {examPdfFile.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            ✓ File PDF Đã Chọn
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition">
                        <span>Đổi file PDF khác</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) {
                              setExamPdfFile(f)
                              handleAiAnalyze(f)
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={analyzingWithAi}
                        onClick={() => handleAiAnalyze(examPdfFile)}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                      >
                        {analyzingWithAi ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Đang Phân Tích & Giải...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Phân Tích Lại Bằng AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {analyzingWithAi && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center gap-2.5 text-xs text-indigo-900 font-bold animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                      <span>{aiStatusMessage || 'Gemini 3.5 Flash Lite đang đọc file PDF, phân tích các phần thi và giải ma trận đáp án... Vui lòng đợi trong giây lát.'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. THÔNG TIN CHUNG ĐỀ THI */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-5">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                2. Thông Tin Chung Đề Thi (AI Tự Động Điền)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Tên Đề Thi *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Tự động điền sau khi tải file PDF, hoặc nhập thủ công..."
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
              </div>
            </div>

            {/* 3. Bảo Mật Safe Exam Browser (SEB) */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-4">
              <h2
                className="text-xl font-black text-slate-900"
                style={{ fontFamily: 'var(--font-sebadm-heading)' }}
              >
                3. Bảo Mật Safe Exam Browser (SEB)
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
                  Khóa môi trường thi bằng Safe Exam Browser (Chặn Alt+Tab, chụp màn hình, mở ứng dụng ngoài, bắt buộc chạy đúng môi trường SEB)
                </label>
              </div>
            </div>

            {/* 4. Cấu Trúc Đề Thi & Bảng Đáp Án Linh Hoạt */}
            <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2
                    className="text-xl font-black text-slate-900"
                    style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                  >
                    4. Cấu Trúc Các Phần Thi & Hướng Dẫn Tự Viết
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tùy biến số phần thi, số câu hỏi, cách tính điểm, hướng dẫn riêng và ảnh minh họa cho từng phần.
                  </p>
                </div>

                {/* Thống kê và Nút Thêm Phần */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200">
                    <span>{examSections.length} Phần thi</span>
                    <span>•</span>
                    <span>{totalQuestionCount} Câu hỏi</span>
                    <span>•</span>
                    <span className={totalExamPoints === 10 ? 'text-emerald-700' : 'text-amber-700'}>
                      Tổng: {totalExamPoints.toFixed(1)} / 10.0 đ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-500/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Phần Thi</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các phần thi */}
              <div className="space-y-6">
                {examSections.map((section, sIdx) => {
                  const qCount = parseInt(String(section.questionCount)) || 0
                  const pointsPerQ = section.totalPoints / (qCount || 1)

                  return (
                    <div
                      key={section.id}
                      className="p-5 rounded-3xl border border-slate-200 bg-slate-50/50 space-y-5"
                    >
                      {/* Tiêu đề phần thi & nút xóa */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="h-7 w-7 rounded-xl bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'name', e.target.value)}
                            placeholder={`Tên phần thi (Ví dụ: Phần ${sIdx + 1}: Trắc nghiệm...)`}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSection(sIdx)}
                          className="h-8 w-8 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition shrink-0"
                          title="Xóa phần thi này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Các tham số cấu hình: Số câu, Tổng điểm, Chế độ chia điểm, Thể loại câu hỏi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 text-xs">
                        {/* 1. Số lượng câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Số Câu Hỏi</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={section.questionCount}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                        </div>

                        {/* 2. Tổng điểm phần này */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Tổng Điểm Phần Này</label>
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={10}
                            value={section.totalPoints}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'totalPoints', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                        </div>

                        {/* 3. Chế độ chia điểm */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Cách Tính Điểm</label>
                          <select
                            value={section.scoringMode}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'scoringMode', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          >
                            <option value="auto_divide">
                              Chia đều ({pointsPerQ.toFixed(2)}đ/câu)
                            </option>
                            <option value="custom_points">Tùy chỉnh điểm từng câu</option>
                          </select>
                        </div>

                        {/* 4. Thể loại câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600">Thể Loại Câu Hỏi</label>
                          <select
                            value={section.questionTypeMode === 'custom' ? 'custom' : section.type}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'custom') {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'custom')
                              } else {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'uniform')
                                handleUpdateSectionField(sIdx, 'type', val)
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          >
                            <option value="single_choice">Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                            <option value="true_false">Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)</option>
                            <option value="short_answer">Trả lời ngắn / Điền số</option>
                            <option value="essay">Tự luận</option>
                            <option value="custom">-- Tùy chọn từng câu --</option>
                          </select>
                        </div>
                      </div>

                      {/* Hướng Dẫn Tự Viết & Ảnh Minh Họa Cho Phần Này */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
                        {/* Hướng dẫn tự viết */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                            <span>Hướng Dẫn Làm Bài Cho Phần Này (Admin tự viết):</span>
                          </label>
                          <textarea
                            value={section.instructions}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'instructions', e.target.value)}
                            placeholder="Nhập hướng dẫn làm bài chi tiết cho phần này (thí sinh sẽ đọc tại phòng chờ)..."
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed"
                          />
                        </div>

                        {/* Hình ảnh hướng dẫn (nếu có) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                              <span>Hình Ảnh Hướng Dẫn (Nếu có):</span>
                            </span>
                            {section.instructionImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateSectionField(sIdx, 'instructionImage', '')}
                                className="text-[11px] text-rose-600 font-bold hover:underline"
                              >
                                Xóa ảnh
                              </button>
                            )}
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={section.instructionImage || ''}
                              onChange={(e) => handleUpdateSectionField(sIdx, 'instructionImage', e.target.value)}
                              placeholder="Dán URL ảnh hoặc tải ảnh từ máy tính ➔"
                              className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                            <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition flex items-center gap-1 shrink-0">
                              <FileUp className="h-3.5 w-3.5" />
                              <span>Tải ảnh</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleUploadInstructionImage(sIdx, f)
                                }}
                              />
                            </label>
                          </div>

                          {section.instructionImage && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-28 bg-slate-100 flex items-center justify-center">
                              <img
                                src={section.instructionImage}
                                alt="Ảnh hướng dẫn"
                                className="max-h-28 w-auto object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bảng nhập đáp án & điểm cho các câu hỏi của phần này */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Bảng Nhập Đáp Án ({section.questionCount} câu hỏi):</span>
                          {section.scoringMode === 'custom_points' && (
                            <span className="text-[11px] text-amber-700 font-normal">
                              ⚠️ Đang bật chế độ tùy chỉnh điểm từng câu
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          {Array.from({ length: qCount }).map((_, qIdx) => {
                            const ans = section.correctAnswers[qIdx]
                            const rawQType =
                              section.questionTypeMode === 'custom' && section.questionTypes?.[qIdx]
                                ? section.questionTypes[qIdx]
                                : section.type
                            const qType = normalizeQuestionType(rawQType, section, qIdx)

                            const currentPoint =
                              section.scoringMode === 'custom_points'
                                ? section.pointsPerQuestion?.[qIdx] ?? pointsPerQ
                                : pointsPerQ

                            return (
                              <div
                                key={qIdx}
                                className="p-3 rounded-2xl bg-white border border-slate-200 text-xs shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-600">Câu {qIdx + 1}</span>

                                  {/* Điểm tùy chỉnh nếu bật custom_points */}
                                  {section.scoringMode === 'custom_points' ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={currentPoint}
                                        onChange={(e) =>
                                          handleSetQuestionPoint(sIdx, qIdx, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-12 px-1 py-0.5 rounded border border-slate-200 text-center font-bold text-[11px]"
                                      />
                                      <span className="text-[10px] text-slate-400">đ</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {pointsPerQ.toFixed(2)}đ
                                    </span>
                                  )}
                                </div>

                                {/* Lựa chọn thể loại câu nếu ở chế độ custom */}
                                {section.questionTypeMode === 'custom' && (
                                  <select
                                    value={qType}
                                    onChange={(e) => handleSetQuestionType(sIdx, qIdx, e.target.value)}
                                    className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold bg-slate-50"
                                  >
                                    <option value="single_choice">4 Lựa chọn</option>
                                    <option value="true_false">Đúng / Sai</option>
                                    <option value="short_answer">Điền số</option>
                                    <option value="essay">Tự luận</option>
                                  </select>
                                )}

                                {/* Nhập đáp án cho dạng trắc nghiệm 4 lựa chọn */}
                                {qType === 'single_choice' && (
                                  <div className="flex gap-1 pt-1">
                                    {['A', 'B', 'C', 'D'].map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleSetCorrectAnswer(sIdx, qIdx, opt)}
                                        className={`flex-1 h-7 rounded-lg font-black transition ${
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

                                {/* Nhập đáp án cho dạng Đúng / Sai 4 ý */}
                                {qType === 'true_false' && (
                                  <div className="space-y-1 pt-1">
                                    {['a', 'b', 'c', 'd'].map((sub) => (
                                      <div key={sub} className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold uppercase text-slate-400">{sub}:</span>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'Đ')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                              ans?.[sub] === 'Đ'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            Đ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'S')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                              ans?.[sub] === 'S'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            S
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Nhập đáp án cho dạng trả lời ngắn / điền số */}
                                {qType === 'short_answer' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Đáp số..."
                                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                  </div>
                                )}

                                {/* Dạng tự luận */}
                                {qType === 'essay' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Barem / từ khóa..."
                                      className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                    {parent.children?.map((child: any) => {
                      const realExamCount = examsList.filter((ex) => !ex.is_hidden && isExamInFolder(ex, child)).length

                      return (
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
                              {realExamCount} đề
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAdminChildFolder(child)
                                setShowAdminFolderExamModal(true)
                              }}
                              className="text-slate-400 hover:text-sky-600 p-1 rounded-lg transition"
                              title="Quản lý / Gán đề thi cho môn này"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFolder(child.id, child.name)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                              title="Xóa thư mục con này"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Quản Lý Đề Thi Trong Thư Mục Con (Admin) */}
            {showAdminFolderExamModal && selectedAdminChildFolder && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="w-full max-w-2xl rounded-3xl bg-white border border-sky-100 shadow-2xl p-6 flex flex-col max-h-[85vh] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">
                        Phân Bổ Đề Thi Thư Mục Con
                      </span>
                      <h3
                        className="text-lg font-black text-slate-900"
                        style={{ fontFamily: 'var(--font-sebadm-heading)' }}
                      >
                        Môn: {selectedAdminChildFolder.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tick chọn để gán đề thủ công hoặc gỡ bỏ khỏi môn thi này. Hệ thống vẫn tự động nhận diện nếu đề chưa được gán.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdminFolderExamModal(false)}
                      className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Tìm kiếm đề thi */}
                  <div className="relative">
                    <input
                      type="text"
                      value={adminFolderExamSearch}
                      onChange={(e) => setAdminFolderExamSearch(e.target.value)}
                      placeholder="Tìm kiếm đề thi cần gán..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Danh sách đề thi */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
                    {examsList
                      .filter((ex) => {
                        if (ex.is_hidden) return false
                        if (!adminFolderExamSearch.trim()) return true
                        return ex.title?.toLowerCase().includes(adminFolderExamSearch.toLowerCase())
                      })
                      .map((ex) => {
                        const isDirect = ex.folder_id === selectedAdminChildFolder.id
                        const isAuto = !isDirect && isExamInFolder(ex, selectedAdminChildFolder)
                        const isInFolder = isDirect || isAuto

                        return (
                          <div
                            key={ex.id}
                            className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-sky-200 transition flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono">
                                  {ex.exam_type || 'ĐỀ THI'}
                                </span>
                                {isDirect ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ Đã gán thủ công
                                  </span>
                                ) : isAuto ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                                    ⚡ Tự động nhận diện
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                    Chưa có trong môn
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-800 truncate">{ex.title}</h4>
                            </div>

                            <button
                              type="button"
                              disabled={updatingAdminFolderExams}
                              onClick={() => handleToggleExamInChildFolder(ex.id, isInFolder)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                                isInFolder
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-sky-600 text-white hover:bg-sky-700 shadow-2xs'
                              }`}
                            >
                              {isInFolder ? 'Gỡ Khỏi Môn' : '+ Gán Vào Môn'}
                            </button>
                          </div>
                        )
                      })}
                  </div>

                  {/* Footer Modal */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Tổng số đề trong môn: {examsList.filter((ex) => !ex.is_hidden && isExamInFolder(ex, selectedAdminChildFolder)).length} đề
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdminFolderExamModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              </div>
            )}
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
