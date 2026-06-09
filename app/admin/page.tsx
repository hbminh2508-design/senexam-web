'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { 
  UploadCloud, FileText, Users, LogOut, PlusCircle, 
  Trash2, Layers, X, ClipboardList, 
  KeyRound, Filter, Eye, Save, ArrowLeft, PenTool, LayoutDashboard,
  Sparkles, Bell, AlertCircle, Loader2, FileInput, Sun, Moon, Clipboard
} from 'lucide-react'

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT']
const SUBJECT_GROUPS: Record<string, string[]> = {
  'THPTQG': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'SPT': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'HSA': ['Tư duy Định lượng', 'Tư duy Định tính', 'Khoa học'],
  'TSA': ['Toán học', 'Đọc hiểu', 'Khoa học giải quyết vấn đề']
}

type MixedRange = { start: number; end: number; type: string; optionsCount: number }

interface SysNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  
  const [activeTab, setActiveTab] = useState<'upload' | 'manage' | 'submissions' | 'collab'>('upload')

  const [selectedSubForGrading, setSelectedSubForGrading] = useState<any | null>(null)
  const [gradingScores, setGradingScores] = useState<Record<string, string>>({})
  const [gradingFeedback, setGradingFeedback] = useState('')
  const [isSavingGrade, setIsSavingGrade] = useState(false)

  const [manageFilter, setManageFilter] = useState('Tất cả')
  const [submissionFilter, setSubmissionFilter] = useState('Tất cả')

  const [examsList, setExamsList] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [submissionsList, setSubmissionsList] = useState<any[]>([])
  const [isFetchingData, setIsFetchingData] = useState(false)

  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('THPTQG')
  const [duration, setDuration] = useState<number>(50)
  const [allowReview, setAllowReview] = useState<boolean>(true)
  const [maxAttempts, setMaxAttempts] = useState<number>(1)
  const [gradingMethod, setGradingMethod] = useState<string>('highest')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)

  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error'; message: string}>({ type: 'idle', message: '' })

  const [editingKeysSectionId, setEditingKeysSectionId] = useState<string | null>(null)
  const [isHiddenExam, setIsHiddenExam] = useState(false)
  const [requireProctoring, setRequireProctoring] = useState(false)

  const [autoFillModalId, setAutoFillModalId] = useState<string | null>(null)
  
  const [notifications, setNotifications] = useState<SysNotification[]>([
    { id: '1', title: 'Hệ thống sẵn sàng', message: 'Hạ tầng phân tích nhận diện tổng số câu tự động đã kích hoạt.', type: 'success', time: 'Vừa xong', read: false }
  ])
  const [showNotificationBox, setShowNotificationBox] = useState(false)

  const [quickAnswersModalId, setQuickAnswersModalId] = useState<string | null>(null)
  const [answerMethod, setAnswerMethod] = useState<'text' | 'pdf'>('text')
  const [quickAnswersText, setQuickAnswersText] = useState('')
  const [isParsingAnswerPdf, setIsParsingAnswerPdf] = useState(false)

  const [examStructure, setExamStructure] = useState<{
    id: string
    type: string
    name: string
    subject: string
    questionCount: number
    optionsCount?: number
    correctAnswers: Record<number, any>
    scoringMode: 'auto_divide' | 'custom'
    sectionTotalPoints: number
    customPoints: Record<number, number>
    mixedRanges?: MixedRange[]
    questionEntries?: Record<number, { text: string; options?: string[] }>
  }[]>([])

  useEffect(() => {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setIsDark(theme === 'dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const nextTheme = !isDark ? 'dark' : 'light'
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    localStorage.setItem('theme', nextTheme)
  }

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      if (profile?.role === 'admin' || profile?.role === 'collab') {
        setIsAdmin(true)
        setCurrentUserRole(profile.role)
      } else {
        router.push('/dashboard')
      }
      setLoading(false)
    }
    checkAdmin()
  }, [router])

  const addNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const newNoti: SysNotification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      read: false
    }
    setNotifications(prev => [newNoti, ...prev])
  }

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const refreshSubmissionsList = async () => {
    const { data } = await supabase
      .from('submissions')
      .select(`*, profiles:user_id (full_name, school, province), exams:exam_id (title, exam_type, exam_structure, drive_file_id)`)
      .order('created_at', { ascending: false })
    setSubmissionsList(data || [])
  }

  useEffect(() => {
    if (!isAdmin) return

    const fetchData = async () => {
      setIsFetchingData(true)
      if (activeTab === 'manage') {
        const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
        setExamsList(data || [])
      } else if (activeTab === 'collab') {
        const { data } = await supabase.from('profiles').select('*').order('full_name')
        setUsersList(data || [])
      } else if (activeTab === 'submissions') {
        await refreshSubmissionsList()
      }
      setIsFetchingData(false)
    }
    fetchData()
  }, [activeTab, isAdmin])

  const toggleSubject = (sub: string) => {
    setSelectedSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])
  }

  const addSection = () => {
    setExamStructure([...examStructure, { 
      id: Date.now().toString(), 
      type: 'mixed', 
      name: `Phần thi số ${examStructure.length + 1}`, 
      subject: selectedSubjects[0] || '',
      questionCount: 0, 
      optionsCount: 4,
      correctAnswers: {},
      scoringMode: 'auto_divide',
      sectionTotalPoints: 10,
      customPoints: {},
      mixedRanges: [],
      questionEntries: {}
    }])
  }

  const removeSection = (id: string) => {
    setExamStructure(examStructure.filter(s => s.id !== id))
    if (editingKeysSectionId === id) setEditingKeysSectionId(null)
  }

  const updateSection = (id: string, field: string, value: any) => {
    setExamStructure(examStructure.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleAddMixedRange = (sectionId: string) => {
    setExamStructure(examStructure.map(s => {
      if (s.id === sectionId) {
        const ranges = s.mixedRanges || []
        const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : 0
        return { ...s, mixedRanges: [...ranges, { start: lastEnd + 1, end: lastEnd + 5, type: 'single_choice', optionsCount: 4 }] }
      }
      return s
    }))
  }

  const handleUpdateMixedRange = (sectionId: string, rIdx: number, field: keyof MixedRange, value: any) => {
    setExamStructure(examStructure.map(s => {
      if (s.id === sectionId && s.mixedRanges) {
        const newRanges = [...s.mixedRanges]
        newRanges[rIdx] = { ...newRanges[rIdx], [field]: value }
        return { ...s, mixedRanges: newRanges }
      }
      return s
    }))
  }

  const handleRemoveMixedRange = (sectionId: string, rIdx: number) => {
    setExamStructure(examStructure.map(s => {
      if (s.id === sectionId && s.mixedRanges) {
        const newRanges = [...s.mixedRanges]
        newRanges.splice(rIdx, 1)
        return { ...s, mixedRanges: newRanges }
      }
      return s
    }))
  }

  const handleSetCorrectAnswer = (sectionId: string, qIdx: number, value: any) => {
    setExamStructure(examStructure.map(s => {
      if (s.id === sectionId) {
        const updatedAnswers = { ...s.correctAnswers }
        let cType = s.type
        if (s.type === 'mixed' && s.mixedRanges) {
          const range = s.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
          if (range) cType = range.type
        }

        if (cType === 'multiple_choice') {
          const currentArr = updatedAnswers[qIdx] || []
          updatedAnswers[qIdx] = currentArr.includes(value) ? currentArr.filter((item: any) => item !== value) : [...currentArr, value].sort()
        } else {
          updatedAnswers[qIdx] = value
        }
        return { ...s, correctAnswers: updatedAnswers }
      }
      return s
    }))
  }

  const handleSetCorrectAnswerTF = (sectionId: string, qIdx: number, subLabel: string, value: string) => {
    setExamStructure(examStructure.map(s => {
      if (s.id === sectionId) {
        const updatedAnswers = { ...s.correctAnswers }
        const currentObj = updatedAnswers[qIdx] || {}
        currentObj[subLabel] = value
        updatedAnswers[qIdx] = currentObj
        return { ...s, correctAnswers: updatedAnswers }
      }
      return s
    }))
  }

  const handleProcessPdfTextParsing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || !autoFillModalId) return

    addNotification('Đang quét PDF', 'Hệ thống đang trích xuất text từ PDF...', 'info')
    setUploadStatus({ type: 'uploading', message: 'Đang trích xuất luồng văn bản đề thi...' })

    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }

      const fileToArrayBuffer = await uploadedFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise
      
      let fullTextContent = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        fullTextContent += ' ' + textContent.items.map((item: any) => item.str).join(' ')
      }

      const questionRegex = /(?:Câu|Bài|Question|Q)\s*([1-9]\d*)[\.\:\-\)\s]/gi
      const matches = [...fullTextContent.matchAll(questionRegex)]
      
      if (matches.length === 0) {
        throw new Error("Không quét được từ khóa đánh dấu câu hỏi dạng 'Câu 1.', 'Câu 2.'")
      }

      const uniqueQuestions = new Map<number, number>()
      matches.forEach(m => {
        const num = parseInt(m[1])
        uniqueQuestions.set(num, m.index || 0)
      })

      const sortedQuestions = [...uniqueQuestions.entries()].sort((a, b) => a[0] - b[0])
      const totalQuestionsFound = sortedQuestions.length
      let questionMaps: { qNum: number; detectedType: string }[] = []

      for (let i = 0; i < sortedQuestions.length; i++) {
        const [qNum, startIdx] = sortedQuestions[i]
        const nextQ = sortedQuestions[i + 1]
        const endIdx = nextQ ? nextQ[1] : fullTextContent.length
        
        const questionSegment = fullTextContent.substring(startIdx, endIdx)
        let determinedType = 'single_choice'
        
        if (/đúng\s*[\/\,]\s*sai|đạt\s*yêu\s*cầu|lựa\s*chọn\s*đúng\s*sai/i.test(questionSegment) || (/([A-D]\.)/g.test(questionSegment) && questionSegment.includes('đú') && questionSegment.includes('sa'))) {
          determinedType = 'true_false'
        } else if (/trả\s*lời\s*ngắn|điền\s*kết\s*quả|điền\s*số|giá\s*trị\s*bằng/i.test(questionSegment) || (!/[A-D][\.\:\-\)]/i.test(questionSegment) && questionSegment.length < 250)) {
          determinedType = 'short_answer'
        }

        questionMaps.push({ qNum, detectedType: determinedType })
      }

      const dynamicRanges: MixedRange[] = []
      let currentRange: MixedRange | null = null

      questionMaps.forEach((q, idx) => {
        const virtualQNum = idx + 1
        if (!currentRange) {
          currentRange = { start: virtualQNum, end: virtualQNum, type: q.detectedType, optionsCount: 4 }
        } else if (currentRange.type === q.detectedType) {
          currentRange.end = virtualQNum
        } else {
          dynamicRanges.push(currentRange)
          currentRange = { start: virtualQNum, end: virtualQNum, type: q.detectedType, optionsCount: 4 }
        }
      })
      if (currentRange) dynamicRanges.push(currentRange)

      setExamStructure(prev => prev.map(s => {
        if (s.id === autoFillModalId) {
          return {
            ...s,
            type: 'mixed',
            questionCount: totalQuestionsFound,
            mixedRanges: dynamicRanges
          }
        }
        return s
      }))

      setAutoFillModalId(null)
      setUploadStatus({ type: 'idle', message: '' })
      addNotification('Quét PDF hoàn tất', `Hệ thống thiết lập ${dynamicRanges.length} phân vùng và đếm được ${totalQuestionsFound} câu.`, 'success')
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Lỗi bóc tách cấu trúc.' })
      addNotification('Thất bại', 'Vui lòng kiểm tra lại cấu trúc file PDF.', 'error')
    }
  }

  // 🌟 THUẬT TOÁN ĐẠI TU: KHỚP ĐÁP ÁN VÀ ĐỒNG THỜI TỰ ĐỘNG ĐẾM CÂU HỎI + CHIA VÙNG
  const parseAndApplyAnswers = (rawText: string, section: any) => {
    const updatedAnswers = { ...section.correctAnswers }
    
    // Thuật toán Lookahead vạn năng cắt đáp án 1 dòng hoặc xuống dòng tự do
    const globalRegex = /(?:Câu|Bài|Q)?\s*([1-9]\d*)[\.\:\-\)\s]+([\s\S]*?)(?=(?:(?:Câu|Bài|Q)?\s*[1-9]\d*[\.\:\-\)\s]+)|$)/gi
    const matches = [...rawText.matchAll(globalRegex)]

    if (matches.length === 0) return { validCount: 0, newCount: section.questionCount, rangesCount: 0 }

    let validMatchesCount = 0
    let maxQIdx = section.questionCount > 0 ? section.questionCount - 1 : -1;
    const inferredTypes: Record<number, string> = {}

    matches.forEach(match => {
      const qIdx = parseInt(match[1]) - 1
      const content = match[2].trim()

      if (qIdx > maxQIdx) maxQIdx = qIdx; // Xác định tổng số câu thực tế qua số lớn nhất

      const tfClean = content.toUpperCase().replace(/\s+/g, '')
      let detectedType = 'short_answer'

      if (/^[ĐS]{4}$/.test(tfClean)) {
        updatedAnswers[qIdx] = { a: tfClean[0], b: tfClean[1], c: tfClean[2], d: tfClean[3] }
        detectedType = 'true_false'
        validMatchesCount++
      } else if (/^[A-D]$/i.test(content)) {
        updatedAnswers[qIdx] = content.toUpperCase()
        detectedType = 'single_choice'
        validMatchesCount++
      } else if (content.length > 0) {
        updatedAnswers[qIdx] = content
        detectedType = 'short_answer'
        validMatchesCount++
      }
      
      inferredTypes[qIdx] = detectedType;
    })

    const newQuestionCount = Math.max(section.questionCount, maxQIdx + 1);

    // Dựa vào các dạng câu vừa khớp, tự động xây dựng lại toàn bộ dải phân vùng MixedRanges
    const dynamicRanges: MixedRange[] = []
    let currentRange: MixedRange | null = null

    for (let i = 0; i < newQuestionCount; i++) {
      // Nếu câu đó không có đáp án, kế thừa định dạng của phân vùng liền kề trước đó
      const type = inferredTypes[i] || (currentRange ? currentRange.type : 'single_choice')
      const virtualQNum = i + 1
      
      if (!currentRange) {
        currentRange = { start: virtualQNum, end: virtualQNum, type: type, optionsCount: 4 }
      } else if (currentRange.type === type) {
        currentRange.end = virtualQNum
      } else {
        dynamicRanges.push(currentRange)
        currentRange = { start: virtualQNum, end: virtualQNum, type: type, optionsCount: 4 }
      }
    }
    if (currentRange) dynamicRanges.push(currentRange)

    setExamStructure(prev => prev.map(s => {
      if (s.id === section.id) {
        return {
          ...s,
          type: 'mixed', // Ép về hỗn hợp để áp dụng dải vùng tự động
          questionCount: newQuestionCount,
          mixedRanges: dynamicRanges,
          correctAnswers: updatedAnswers
        }
      }
      return s
    }))

    return { validCount: validMatchesCount, newCount: newQuestionCount, rangesCount: dynamicRanges.length }
  }

  // XỬ LÝ KHỚP BẰNG TEXT (NÚT SỐ 2)
  const handleProcessQuickAnswersText = () => {
    if (!quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    const res = parseAndApplyAnswers(quickAnswersText, section)
    if (res.validCount === 0) {
      alert("Không tìm thấy cú pháp hợp lệ. Mẫu chuẩn:\n1. A 2. B 3. Đ S Đ Đ 4. 12,5 (Viết liền hoặc xuống dòng đều được)")
      return
    }

    setQuickAnswersModalId(null)
    setQuickAnswersText('')
    addNotification('Hoàn tất Dán Đáp án', `Hệ thống tự động thiết lập ${res.rangesCount} phân vùng, xác nhận tổng ${res.newCount} câu và nạp thành công ${res.validCount} đáp án.`, 'success')
  }

  // XỬ LÝ KHỚP BẰNG FILE PDF ĐÁP ÁN (NÚT SỐ 1 TRONG MODAL)
  const handleProcessAnswerPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || !quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    setIsParsingAnswerPdf(true)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }

      const fileToArrayBuffer = await uploadedFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise
      
      let parsedText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        parsedText += ' ' + textContent.items.map((item: any) => item.str).join(' ')
      }

      const res = parseAndApplyAnswers(parsedText, section)
      if (res.validCount === 0) {
        alert("File PDF nạp thành công nhưng không tìm thấy cấu trúc chuỗi đáp án.")
      } else {
        setQuickAnswersModalId(null)
        addNotification('Hoàn tất Quét PDF', `AI bóc tách text từ PDF, thiết lập ${res.rangesCount} phân vùng, tổng ${res.newCount} câu và nạp ${res.validCount} đáp án.`, 'success')
      }
    } catch (err: any) {
      alert("Lỗi phân tích file PDF: " + err.message)
    } finally {
      setIsParsingAnswerPdf(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !file || selectedSubjects.length === 0 || examStructure.length === 0) {
      setUploadStatus({ type: 'error', message: 'Vui lòng điền đủ thông tin chung, đính kèm file PDF gốc và lập sơ đồ cấu trúc.' })
      return
    }

    try {
      setUploadStatus({ type: 'uploading', message: 'Đang khởi tạo kết nối Google Drive...' })
      const uploadUrl = await initGoogleDriveUpload(file.name || title, file.type || 'application/pdf')

      setUploadStatus({ type: 'uploading', message: 'Đang truyền luồng dữ liệu tệp tin...' })
      const uploadData = await uploadFileToGoogleDrive(uploadUrl, file, file.name || title)
      const driveFileId = uploadData.id

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("Phiên đăng nhập quản trị đã hết hạn.")

      const generatedAccessCode = isHiddenExam ? Math.random().toString(36).substring(2, 8).toUpperCase() : null

      const { error: dbError } = await supabase.from('exams').insert({
        title, exam_type: examType, duration, allow_review: allowReview, max_attempts: maxAttempts, grading_method: gradingMethod, subjects: selectedSubjects, exam_structure: examStructure, drive_file_id: driveFileId, created_by: user.id, is_hidden: isHiddenExam, access_code: generatedAccessCode, require_proctoring: requireProctoring, creation_mode: 'pdf_mode'
      })

      if (dbError) throw new Error(dbError.message)
      setUploadStatus({ type: 'success', message: 'Đóng gói và phát hành cấu trúc đề thi thành công!' })
      addNotification('Xuất bản thành công', `Đề thi "${title}" đã đưa vào kho đề công khai.`, 'success')
      setTitle(''); setFile(null); setSelectedSubjects([]); setExamStructure([]);
    } catch (error: any) {
      setUploadStatus({ type: 'error', message: error?.message || 'Lỗi lưu trữ DB.' })
    }
  }

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Xóa đề thi này khỏi kho lưu trữ?')) return
    const { error } = await supabase.from('exams').delete().eq('id', examId)
    if (!error) setExamsList(examsList.filter(e => e.id !== examId))
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (currentUserRole !== 'admin') return alert('Không đủ thẩm quyền!')
    const { error = null } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) setUsersList(usersList.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  const openGradingView = (submission: any) => {
    setSelectedSubForGrading(submission)
    const initialScores: Record<string, string> = {}

    submission.exams?.exam_structure?.forEach((section: any) => {
      let perQuestionPoints = section.scoringMode === 'auto_divide' ? ((section.sectionTotalPoints || 0) / (section.questionCount || 1)) : 0

      Array.from({ length: section.questionCount }).forEach((_, qIdx) => {
        const key = `${section.id}-${qIdx}`
        
        if (submission.detailed_scores?.[key] !== undefined) {
          initialScores[key] = String(submission.detailed_scores[key]).replace('.', ',')
        } else {
          let currentType = section.type
          if (section.type === 'mixed' && section.mixedRanges) {
            const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
            currentType = range ? range.type : 'short_answer'
          }

          if (currentType === 'essay') { 
            initialScores[key] = '0' 
          } else {
            let qPoint = section.scoringMode === 'custom' ? (section.customPoints?.[qIdx] || 0) : perQuestionPoints
            let earned = 0
            const studentAns = submission.answers?.[key] 
            const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)] 
            
            if (currentType === 'true_false') {
              let correctSubCount = 0
              if (studentAns && typeof studentAns === 'object' && correctAns && typeof correctAns === 'object') {
                ['a','b','c','d'].forEach(sub => { if (studentAns[sub] === correctAns[sub]) correctSubCount++; })
              }
              if (correctSubCount === 1) earned = qPoint * 0.1
              else if (correctSubCount === 2) earned = qPoint * 0.25
              else if (correctSubCount === 3) earned = qPoint * 0.5
              else if (correctSubCount === 4) earned = qPoint * 1.0
            } else if (currentType === 'multiple_choice') {
              if (Array.isArray(studentAns) && Array.isArray(correctAns) && studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))) earned = qPoint
            } else { 
              if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(correctAns).trim()) earned = qPoint 
            }

            initialScores[key] = String(parseFloat(earned.toFixed(2))).replace('.', ',')
          }
        }
      })
    })
    setGradingScores(initialScores)
    setGradingFeedback(submission.feedback || '')
  }

  const handleSaveAssessment = async () => {
    if (!selectedSubForGrading) return
    setIsSavingGrade(true)
    const parsedScores: Record<string, number> = {}
    let totalPoints = 0
    Object.keys(gradingScores).forEach(key => {
      const normalizedStr = String(gradingScores[key]).replace(',', '.')
      const scoreNum = parseFloat(normalizedStr) || 0
      parsedScores[key] = scoreNum
      totalPoints += scoreNum
    })

    const { error } = await supabase.from('submissions').update({ detailed_scores: parsedScores, feedback: gradingFeedback, score: parseFloat(totalPoints.toFixed(2)), is_graded: true }).eq('id', selectedSubForGrading.id)

    if (error) alert('Lỗi khi lưu điểm số: ' + error.message)
    else {
      alert('Phê duyệt điểm số bài làm thành công! Tổng điểm đạt: ' + String(parseFloat(totalPoints.toFixed(2))).replace('.', ','))
      setSelectedSubForGrading(null)
      await refreshSubmissionsList()
    }
    setIsSavingGrade(false)
  }

  const parseStudentAnswer = (ans: any, type?: string) => {
    if (!ans) return 'Bỏ trống'
    if (type === 'true_false' && typeof ans === 'object' && !Array.isArray(ans)) {
      return ['a','b','c','d'].map(k => `${k.toUpperCase()}: ${ans[k] || '-'}`).join(' | ')
    }
    return String(ans)
  }

  const currentAvailableSubjects = SUBJECT_GROUPS[examType] || SUBJECT_GROUPS['THPTQG']
  const filteredExams = examsList.filter(e => manageFilter === 'Tất cả' || e.exam_type === manageFilter)
  const filteredSubmissions = submissionsList.filter(s => submissionFilter === 'Tất cả' || s.exams?.exam_type === submissionFilter)

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 text-sm">Xác thực thẩm quyền hệ thống...</div>

  if (selectedSubForGrading) {
    const pdfUrl = `https://drive.google.com/file/d/${selectedSubForGrading.exams?.drive_file_id}/preview`
    return (
      <div className="h-screen w-full flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedSubForGrading(null)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
            <div>
              <h1 className="font-extrabold text-sm md:text-base">Hội đồng chấm: {selectedSubForGrading.profiles?.full_name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đề thi: {selectedSubForGrading.exams?.title}</p>
            </div>
          </div>
          <button onClick={handleSaveAssessment} disabled={isSavingGrade} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:bg-slate-400">
            <Save className="w-4 h-4"/> {isSavingGrade ? 'Đang chấm...' : 'Phê duyệt điểm'}
          </button>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[45vh] md:h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-950 relative">
            {selectedSubForGrading.exams?.drive_file_id ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-950">
                <Sparkles className="w-12 h-12 mb-2 text-indigo-500 animate-pulse"/>
                <p className="font-extrabold text-sm">Đây là mẫu cấu trúc đề thi số hóa độc quyền</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[55vh] md:h-full bg-white dark:bg-slate-900 overflow-y-auto p-6 space-y-6 custom-scrollbar shrink-0">
            <div className="text-base font-black text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-3"><PenTool className="w-5 h-5"/> Giao diện kiểm định bài làm</div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Nhận xét tổng quát của giáo viên:</label>
              <textarea value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)} placeholder="Nhập lời phê tổng quan..." className="w-full min-h-[80px] p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-xs outline-none text-slate-900 dark:text-white focus:border-blue-500" />
            </div>

            <div className="space-y-6">
              {selectedSubForGrading.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-end mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <h3 className="font-extrabold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">- {section.name}</h3>
                    <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                      {section.scoringMode === 'custom' ? 'Điểm tùy chỉnh' : `Tổng: ${section.sectionTotalPoints}đ`}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const studentAns = selectedSubForGrading.answers?.[key]
                      const correctAnswer = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                      
                      let currentType = section.type
                      if (section.type === 'mixed' && section.mixedRanges) {
                        const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                        currentType = range ? range.type : 'short_answer'
                      }

                      return (
                        <div key={qIdx} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-slate-500 dark:text-slate-400">Câu hỏi {qIdx + 1}:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cho điểm:</span>
                              <input 
                                type="text" 
                                value={gradingScores[key] ?? ''} 
                                onChange={(e) => {
                                  const inputVal = e.target.value
                                  if (/^[0-9.,]*$/.test(inputVal)) { setGradingScores({ ...gradingScores, [key]: inputVal }) }
                                }}
                                placeholder="0,0" 
                                className="w-16 p-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-black text-center text-xs outline-none text-blue-600 dark:text-blue-400 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="text-xs font-medium space-y-1 mt-1 font-sans">
                            <p><span className="text-slate-500 dark:text-slate-400">Thí sinh điền/tô:</span> <span className="font-bold text-blue-600 dark:text-blue-400">{parseStudentAnswer(studentAns, currentType)}</span></p>
                            {currentType !== 'essay' && (
                              <p><span className="text-slate-500 dark:text-slate-400">Đáp án gốc:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {typeof correctAnswer === 'object' && !Array.isArray(correctAnswer) ? parseStudentAnswer(correctAnswer, 'true_false') : JSON.stringify(correctAnswer)}
                              </span></p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <LayoutDashboard className="w-5 h-5"/>
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight text-slate-900 dark:text-white">Trạm Quản Trị Hệ Thống</h1>
            <p className="text-xs text-slate-500 font-medium">Quyền hạn: <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase">{currentUserRole}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:scale-105 transition-transform">
            {isDark ? <Sun className="w-4 h-4 text-amber-400"/> : <Moon className="w-4 h-4 text-indigo-600"/>}
          </button>
          
          <div className="relative">
            <button onClick={() => setShowNotificationBox(!showNotificationBox)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">{unreadCount}</span>}
            </button>
            {showNotificationBox && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 space-y-2.5 z-50 max-h-96 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 text-[10px] font-black text-slate-400 uppercase"><span>Nhật ký tác vụ</span><button onClick={() => setNotifications([])} className="text-red-500">Xóa sạch</button></div>
                {notifications.length === 0 ? <p className="text-[10px] text-center text-slate-400 py-4 font-bold">Không có tác vụ mới.</p> : notifications.map(n => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/55 border border-slate-200 dark:border-slate-800 text-xs flex items-start gap-2.5 shadow-inner">
                    <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'success' ? 'text-emerald-500' : n.type === 'error' ? 'text-red-500' : 'text-blue-500'}`}/>
                    <div><p className="font-black text-slate-800 dark:text-slate-200">{n.title}</p><p className="text-slate-500 dark:text-slate-400 mt-0.5 font-bold leading-normal">{n.message}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SECTIONS CONTROLLER */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab('upload')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><PlusCircle className="w-4 h-4"/>Tạo Đề Thi Mới</button>
          <button onClick={() => setActiveTab('manage')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Layers className="w-4 h-4"/>Kho Đề Lưu Trữ</button>
          <button onClick={() => setActiveTab('submissions')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'submissions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><ClipboardList className="w-4 h-4"/>Chấm Điểm Bài Làm</button>
          <button onClick={() => setActiveTab('collab')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'collab' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Users className="w-4 h-4"/>Thiết Lập Thành Viên</button>
        </div>

        {activeTab === 'upload' && (
          <form onSubmit={handleUploadExam} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* THÔNG TIN CHUNG */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-500"/>Thông tin chung</h2>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Tiêu đề đề thi</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Đề khảo sát HSA giai đoạn 1" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Thời gian (phút)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Số lượt thi</label>
                  <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Tệp tin PDF đề thi gốc (*)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center relative bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-colors">
                  <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{file ? file.name : 'Nhấp hoặc kéo thả file PDF vào đây'}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Phân loại Kỳ thi</label>
                <select value={examType} onChange={(e) => { setExamType(e.target.value); setSelectedSubjects([]) }} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">Môn thi thành phần</label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                  {currentAvailableSubjects.map(sub => (
                    <button key={sub} type="button" onClick={() => toggleSubject(sub)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${selectedSubjects.includes(sub) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>{sub}</button>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isHiddenExam} onChange={(e) => setIsHiddenExam(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"/>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Thi bảo mật (Cần mật mã Access Code)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={requireProctoring} onChange={(e) => setRequireProctoring(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"/>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Giám sát AI (Chống chuyển đổi Tab bài làm)</span>
                </label>
              </div>
            </div>

            {/* SƠ ĐỒ KHỐI ĐỀ THI HỖN HỢP */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500"/>Cấu trúc phân vùng Ma trận đề</h2>
                    <p className="text-xs text-slate-500 mt-1">Phân định cấu trúc, điểm số và nạp nhanh chuỗi đáp án cho từng phần thi.</p>
                  </div>
                  <button type="button" onClick={addSection} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-indigo-100 dark:border-indigo-900">
                    <PlusCircle className="w-4 h-4"/> Thêm phần thi
                  </button>
                </div>

                {examStructure.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs font-bold">Chưa có phần thi nào được khởi tạo. Nhấn nút phía trên để tạo khối mới.</div>
                ) : (
                  <div className="space-y-6">
                    {examStructure.map((section, sIdx) => (
                      <div key={section.id} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                            <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-300">{sIdx+1}</span>
                            <input type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)} className="bg-transparent font-extrabold text-sm text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5 px-1 w-full"/>
                          </div>

                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => removeSection(section.id)} className="text-slate-400 hover:text-rose-500 p-1.5"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Môn thi</label>
                              <select value={section.subject} onChange={(e) => updateSection(section.id, 'subject', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Chọn môn</option>
                                {selectedSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tổng điểm khối</label>
                              <input type="number" step="any" value={section.sectionTotalPoints} onChange={(e) => updateSection(section.id, 'sectionTotalPoints', parseFloat(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tổng số câu hỏi</label>
                              <input type="number" value={section.questionCount} onChange={(e) => updateSection(section.id, 'questionCount', parseInt(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Chia điểm tự động</label>
                              <select value={section.scoringMode} onChange={(e) => updateSection(section.id, 'scoringMode', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg p-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="auto_divide">Chia đều điểm</option>
                                <option value="custom">Tùy biến từng câu</option>
                              </select>
                            </div>
                          </div>

                          <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Phân định dải cấu trúc dạng câu hỏi</h4>
                              <button type="button" onClick={() => handleAddMixedRange(section.id)} className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">+ Thêm phân vùng dải câu</button>
                            </div>

                            <div className="space-y-2">
                              {(section.mixedRanges || []).map((range, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl flex-wrap text-xs font-semibold">
                                  <span>Từ câu:</span>
                                  <input type="number" value={range.start} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'start', parseInt(e.target.value)||1)} className="w-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                  <span>đến câu:</span>
                                  <input type="number" value={range.end} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'end', parseInt(e.target.value)||1)} className="w-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                  
                                  <select value={range.type} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'type', e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded font-bold text-slate-900 dark:text-white focus:outline-none">
                                    <option value="single_choice">Trắc nghiệm đơn (A,B,C,D)</option>
                                    <option value="true_false">Trắc nghiệm Đúng/Sai liên hoàn</option>
                                    <option value="short_answer">Điền đáp án ngắn / Điền số</option>
                                    <option value="essay">Tự luận / Chấm tay</option>
                                  </select>

                                  <button type="button" onClick={() => handleRemoveMixedRange(section.id, rIdx)} className="text-rose-500 ml-auto font-bold text-xs px-2 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50">Xóa</button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 🌟 NÚT TÍCH HỢP QUÉT VÀ DÁN ĐÁP ÁN NHANH */}
                          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                            <button type="button" onClick={() => setEditingKeysSectionId(editingKeysSectionId === section.id ? null : section.id)} className="text-[11px] text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5 bg-slate-200 dark:bg-slate-800 px-3.5 py-2 rounded-xl hover:opacity-80 transition-opacity">
                              <KeyRound className="w-3.5 h-3.5"/> {editingKeysSectionId === section.id ? 'Thu gọn bảng đáp án' : 'Mở bảng nhập chi tiết'}
                            </button>
                            
                            <button type="button" onClick={() => setAutoFillModalId(section.id)} className="text-[11px] text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 px-3.5 py-2 rounded-xl hover:opacity-80 transition-opacity">
                              <FileText className="w-3.5 h-3.5"/> 1. Quét chia vùng tự động
                            </button>

                            {/* Nút số 2: Dán văn bản đáp án thần tốc */}
                            <button type="button" onClick={() => setQuickAnswersModalId(section.id)} className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 px-3.5 py-2 rounded-xl hover:opacity-80 transition-opacity">
                              <Clipboard className="w-3.5 h-3.5"/> 2. Dán văn bản đáp án nhanh
                            </button>
                          </div>

                          {/* BẢNG ĐIỀU CHỈNH ĐÁP ÁN SƠ ĐỒ CHI TIẾT */}
                          {editingKeysSectionId === section.id && section.questionCount > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 custom-scrollbar">
                              {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                                let cType = 'short_answer'
                                let optionsCount = 4
                                if (section.mixedRanges) {
                                  const matchedRange = section.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                                  if (matchedRange) {
                                    cType = matchedRange.type
                                    optionsCount = matchedRange.optionsCount || 4
                                  }
                                }

                                const currentAns = section.correctAnswers[qIdx]

                                return (
                                  <div key={qIdx} className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 flex flex-col justify-between text-xs font-medium">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-extrabold text-slate-700 dark:text-slate-300">Câu {qIdx + 1}:</span>
                                      <span className="text-[10px] text-slate-400 uppercase font-black">[{cType}]</span>
                                    </div>

                                    {cType === 'single_choice' && (
                                      <div className="flex gap-1.5">
                                        {['A', 'B', 'C', 'D'].slice(0, optionsCount).map(opt => (
                                          <button key={opt} type="button" onClick={() => handleSetCorrectAnswer(section.id, qIdx, opt)} className={`flex-1 py-1 rounded font-bold transition-all ${currentAns === opt ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>{opt}</button>
                                        ))}
                                      </div>
                                    )}

                                    {cType === 'true_false' && (
                                      <div className="space-y-1 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                                        {['a', 'b', 'c', 'd'].map(sub => {
                                          const subAns = currentAns?.[sub]
                                          return (
                                            <div key={sub} className="flex items-center justify-between gap-2">
                                              <span className="uppercase font-bold text-slate-500">{sub}.</span>
                                              <div className="flex gap-1">
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'Đ')} className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${subAns === 'Đ' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Đ</button>
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'S')} className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${subAns === 'S' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>S</button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}

                                    {cType !== 'single_choice' && cType !== 'true_false' && cType !== 'essay' && (
                                      <input type="text" value={currentAns || ''} onChange={(e) => handleSetCorrectAnswer(section.id, qIdx, e.target.value)} placeholder="Nhập đáp án..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"/>
                                    )}

                                    {cType === 'essay' && (
                                      <span className="text-[10px] text-amber-500 font-bold italic">Chấm thủ công ở bảng Hội đồng</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NÚT ĐÓNG GÓI XUẤT BẢN ĐỀ */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {uploadStatus.type === 'uploading' ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                  ) : uploadStatus.type === 'success' ? (
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  ) : uploadStatus.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                  )}
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{uploadStatus.message || 'Sẵn sàng đóng gói và truyền luồng sơ đồ dữ liệu.'}</p>
                </div>
                
                <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-sm shadow-md shadow-indigo-500/10 transition-transform active:scale-95 disabled:bg-slate-400">
                  <Save className="w-4 h-4" /> Đóng gói và Phát hành Đề thi
                </button>
              </div>
            </div>
          </form>
        )}

        {/* QUẢN LÝ KHO ĐỀ */}
        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-4">Kho đề thi trực tuyến hiện hành</h2>
            {isFetchingData ? <div className="text-xs font-bold text-slate-500">Đang quét kho dữ liệu...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-bold">
                      <th className="py-3 px-2">Tiêu đề đề thi</th>
                      <th className="py-3 px-2">Kỳ thi</th>
                      <th className="py-3 px-2">Thời gian</th>
                      <th className="py-3 px-2">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map(e => (
                      <tr key={e.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{e.title}</td>
                        <td className="py-3 px-2 font-black text-indigo-600 dark:text-indigo-400">{e.exam_type}</td>
                        <td className="py-3 px-2 font-medium">{e.duration} phút</td>
                        <td className="py-3 px-2"><button onClick={() => handleDeleteExam(e.id)} className="text-rose-500 hover:underline font-bold">Xóa bỏ</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* QUẢN LÝ BÀI NỘP */}
        {activeTab === 'submissions' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-4">Danh sách bài làm của học sinh</h2>
            {isFetchingData ? <div className="text-xs font-bold text-slate-500">Đang đồng bộ cổng bài làm...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-bold">
                      <th className="py-3 px-2">Thí sinh</th>
                      <th className="py-3 px-2">Đề thi</th>
                      <th className="py-3 px-2">Điểm số</th>
                      <th className="py-3 px-2">Hội đồng chấm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map(s => (
                      <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/50">
                        <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{s.profiles?.full_name || 'Học sinh tự do'}</td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-300">{s.exams?.title}</td>
                        <td className="py-3 px-2 font-black text-emerald-600 dark:text-emerald-400">{s.is_graded ? String(s.score).replace('.', ',') : 'Chờ chấm'}</td>
                        <td className="py-3 px-2"><button onClick={() => openGradingView(s)} className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm">Chấm bài</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🌟 MODAL TÍCH HỢP ĐÁP ÁN: SỬA LỖI HIỂN THỊ TEXT TRONG DARK MODE */}
      {quickAnswersModalId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-sm md:text-base">Đồng bộ chuỗi đáp án phân vùng</h3>
              </div>
              <button onClick={() => setQuickAnswersModalId(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl gap-1">
                <button type="button" onClick={() => setAnswerMethod('text')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${answerMethod === 'text' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                  🌟 Cách 1: Dán văn bản đáp án trực tiếp
                </button>
                <button type="button" onClick={() => setAnswerMethod('pdf')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${answerMethod === 'pdf' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                  Cách 2: Quét qua file PDF đáp án
                </button>
              </div>

              {answerMethod === 'text' ? (
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                    <p className="font-extrabold mb-1">💡 Quy tắc phân rã văn bản linh hoạt:</p>
                    <p>AI tự nhận diện cấu trúc tự động và điền số câu dù bạn viết liền trên 1 dòng hoặc xuống dòng phân tách.</p>
                    <p className="mt-1 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/50">Ví dụ dòng liền: 1. A 2. B 3. Đ S Đ S 4. 15,2</p>
                    <p className="mt-1 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/50">Ví dụ cột:<br/>Câu 1. A<br/>Câu 2. B<br/>Câu 3. Đ S Đ Đ</p>
                  </div>
                  
                  <textarea value={quickAnswersText} onChange={(e) => setQuickAnswersText(e.target.value)} placeholder="Dán toàn bộ nội dung chuỗi ký tự đáp án tại đây..." rows={6} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed" />
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setQuickAnswersModalId(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors">Hủy bỏ</button>
                    <button type="button" onClick={handleProcessQuickAnswersText} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-500/10 transition-transform active:scale-95">Trích xuất và Đồng bộ</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4 text-center">
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors relative">
                    <FileInput className="w-8 h-8 text-slate-400 mb-2"/>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Chọn file PDF đáp án để bóc tách luồng văn bản</span>
                    <input type="file" accept="application/pdf" onChange={handleProcessAnswerPdf} disabled={isParsingAnswerPdf} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"/>
                  </div>
                  {isParsingAnswerPdf && (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Loader2 className="w-4 h-4 animate-spin"/> AI đang rã dòng văn bản tệp PDF...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}