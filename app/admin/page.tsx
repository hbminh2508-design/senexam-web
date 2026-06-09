'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { 
  UploadCloud, FileText, Users, LogOut, PlusCircle, 
  Trash2, Layers, X, ClipboardList, 
  KeyRound, Filter, Eye, Save, ArrowLeft, PenTool, LayoutDashboard,
  Sparkles, Bell, AlertCircle, Loader2
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
    { id: '1', title: 'Hệ thống sẵn sàng', message: 'Hạ tầng tối ưu hóa Core RAM và bóc tách dữ liệu văn bản đã kích hoạt.', type: 'success', time: 'Vừa xong', read: false }
  ])
  const [showNotificationBox, setShowNotificationBox] = useState(false)

  const [quickAnswersModalId, setQuickAnswersModalId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

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

  // 🌟 ULTRA-LIGHT TEXT PARSER: TỰ ĐỘNG ĐẾM CÂU VÀ CHIA PHÂN VÙNG DẠNG BÀI QUA TEXT (KHÔNG CANVAS, KHÔNG LAG SERVER)
  const handleProcessPdfTextParsing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || !autoFillModalId) return

    addNotification('Cấu trúc đề', 'Hệ thống đang quét luồng text để tự phân loại dạng bài và đếm tổng số câu...', 'info')
    setUploadStatus({ type: 'uploading', message: 'Hệ thống đang đọc và phân tích cấu trúc tài liệu...' })

    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }

      const fileToArrayBuffer = await uploadedFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise
      
      let fullTextContent = ''
      let questionMaps: { qNum: number; detectedType: string }[] = []

      // Trích xuất text thô thuần túy giúp CPU và RAM hoạt động siêu nhẹ
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullTextContent += ' ' + pageText
      }

      const questionRegex = /(?:Câu|Bài|Question|Q)\s*([1-9]\d*)[\.\:\-\)\s]/gi
      const matches = [...fullTextContent.matchAll(questionRegex)]
      
      if (matches.length === 0) {
        throw new Error("Không quét được từ khóa đánh dấu câu hỏi dạng 'Câu 1.', 'Câu 2.' trong file văn bản.")
      }

      const uniqueQuestions = new Map<number, number>()
      matches.forEach(m => {
        const num = parseInt(m[1])
        uniqueQuestions.set(num, m.index || 0)
      })

      const sortedQuestions = [...uniqueQuestions.entries()].sort((a, b) => a[0] - b[0])
      const totalQuestionsFound = sortedQuestions.length

      for (let i = 0; i < sortedQuestions.length; i++) {
        const [qNum, startIdx] = sortedQuestions[i]
        const nextQ = sortedQuestions[i + 1]
        const endIdx = nextQ ? nextQ[1] : fullTextContent.length
        
        const questionSegment = fullTextContent.substring(startIdx, endIdx)
        let determinedType = 'single_choice'
        
        // Phân tích ngữ cảnh từ khóa cục bộ để tự động chia phân vùng
        if (/đúng\s*[\/\,]\s*sai|đạt\s*yêu\s*cầu|lựa\s*chọn\s*đúng\s*sai/i.test(questionSegment) || (/([A-D]\.)/g.test(questionSegment) && questionSegment.includes('đú') && questionSegment.includes('sa'))) {
          determinedType = 'true_false'
        } else if (/trả\s*lời\s*ngắn|điền\s*kết\s*quả|điền\s*số|giá\s*trị\s*bằng/i.test(questionSegment) || (!/[A-D][\.\:\-\)]/i.test(questionSegment) && questionSegment.length < 250)) {
          determinedType = 'short_answer'
        }

        questionMaps.push({ qNum, detectedType: determinedType })
      }

      // Gộp cụm tuyến tính liên tục để build mảng mixedRanges dữ liệu cấu trúc đề thi
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
          const generatedEntries: Record<number, { text: string }> = {}
          for (let i = 0; i < totalQuestionsFound; i++) {
            generatedEntries[i] = { text: `Câu hỏi số ${i + 1} (Hệ thống tự động đồng bộ sơ đồ)` }
          }

          return {
            ...s,
            type: 'mixed',
            questionCount: totalQuestionsFound,
            mixedRanges: dynamicRanges,
            questionEntries: generatedEntries
          }
        }
        return s
      }))

      setAutoFillModalId(null)
      setUploadStatus({ type: 'idle', message: '' })
      addNotification('Cấu trúc hoàn tất', `Tự động phân chia thành công ${dynamicRanges.length} phân vùng và ghi nhận tổng ${totalQuestionsFound} câu hỏi vào sơ đồ bài làm.`, 'success')

    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Lỗi xử lý cấu trúc văn bản.' })
      addNotification('Thất bại', 'Vui lòng kiểm tra lại cấu trúc chuỗi văn bản của file PDF.', 'error')
    }
  }

  // 🌟 IN-LINE STRING EXTRACTOR: THUẬT TOÁN ĐỒNG BỘ ĐÁP ÁN HỖN HỢP CHẠY LIỀN MẠCH TRÊN CÙNG MỘT DÒNG
  const handleProcessQuickAnswers = () => {
    if (!quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    const rawAnswers = quickAnswersText.trim()
    const updatedAnswers = { ...section.correctAnswers }

    try {
      // Sử dụng lookahead nâng cao để cắt tách chính xác chuỗi đáp án khi viết liền dòng (Ví dụ: 1. A 2. Đ S Đ Đ 3. 12,5)
      const globalRegex = /(?:Câu|Bài|Q)?\s*([1-9]\d*)[\.\:\-\)\s]+([\s\S]*?)(?=(?:(?:Câu|Bài|Q)?\s*[1-9]\d*[\.\:\-\)\s]+)|$)/gi
      const matches = [...rawAnswers.matchAll(globalRegex)]

      if (matches.length === 0) {
        alert("Hệ thống không tìm thấy cú pháp phù hợp. Quy chuẩn định dạng biểu mẫu mẫu:\n1. A 2. Đ S Đ Đ 3. Câu trả lời ngắn")
        return
      }

      let validMatchesCount = 0

      matches.forEach(match => {
        const qIdx = parseInt(match[1]) - 1
        const content = match[2].trim()

        if (qIdx >= 0 && qIdx < section.questionCount) {
          const tfClean = content.toUpperCase().replace(/\s+/g, '') // Chuẩn hóa chuỗi Đúng Sai

          // Khớp dạng biểu mẫu 2: Đúng / Sai 4 ý liền khối hoặc cách quãng khoảng trắng
          if (/^[ĐS]{4}$/.test(tfClean)) {
            updatedAnswers[qIdx] = { a: tfClean[0], b: tfClean[1], c: tfClean[2], d: tfClean[3] }
            validMatchesCount++
          } 
          // Khớp dạng biểu mẫu 1: Trắc nghiệm đơn ký tự đơn ABCD
          else if (/^[A-D]$/i.test(content)) {
            updatedAnswers[qIdx] = content.toUpperCase()
            validMatchesCount++
          } 
          // Khớp dạng biểu mẫu 3: Trả lời ngắn / Điền giá trị số thập phân dùng dấu phẩy
          else if (content.length > 0) {
            updatedAnswers[qIdx] = content
            validMatchesCount++
          }
        }
      })

      setExamStructure(prev => prev.map(s => s.id === section.id ? { ...s, correctAnswers: updatedAnswers } : s))
      setQuickAnswersModalId(null)
      setQuickAnswersText('')
      addNotification('Khợp đáp án', `Hệ thống phân rã luồng chuỗi và đồng bộ thành công ${validMatchesCount} câu đáp án.`, 'success')
    } catch (e: any) {
      alert("Lỗi đồng bộ chuỗi đáp án: " + e.message)
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
      setUploadStatus({ type: 'uploading', message: 'Đang khởi tạo kết nối hạ tầng Google Drive...' })
      const uploadUrl = await initGoogleDriveUpload(file.name || title, file.type || 'application/pdf')

      setUploadStatus({ type: 'uploading', message: 'Đang truyền luồng dữ liệu tệp tin lên Drive...' })
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
      addNotification('Xuất bản thành công', `Đề thi "${title}" đã đưa vào kho đề trực tuyến công khai.`, 'success')
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
              if (correctSubCount === 1) earned = qPoint * 0,1
              else if (correctSubCount === 2) earned = qPoint * 0,25
              else if (correctSubCount === 3) earned = qPoint * 0,5
              else if (correctSubCount === 4) earned = qPoint * 1,0
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-sm">Xác thực thẩm quyền kiểm tra nâng cao...</div>

  if (selectedSubForGrading) {
    const pdfUrl = `https://drive.google.com/file/d/${selectedSubForGrading.exams?.drive_file_id}/preview`
    return (
      <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
        <header className="h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedSubForGrading(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
            <div>
              <h1 className="font-extrabold text-sm md:text-base">Hội đồng chấm: {selectedSubForGrading.profiles?.full_name}</h1>
              <p className="text-xs text-slate-400 font-medium">Đề thi: {selectedSubForGrading.exams?.title}</p>
            </div>
          </div>
          <button onClick={handleSaveAssessment} disabled={isSavingGrade} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:bg-slate-400">
            <Save className="w-4 h-4"/> {isSavingGrade ? 'Đang chấm...' : 'Phê duyệt điểm'}
          </button>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[45vh] md:h-full border-b md:border-b-0 md:border-r bg-slate-950 relative">
            {selectedSubForGrading.exams?.drive_file_id ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-950">
                <Sparkles className="w-12 h-12 mb-2 text-indigo-500 animate-pulse"/>
                <p className="font-extrabold text-sm">Đây là mẫu cấu trúc đề thi số hóa độc quyền</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[55vh] md:h-full bg-slate-900 overflow-y-auto p-6 space-y-6 custom-scrollbar shrink-0">
            <div className="text-base font-black text-blue-400 flex items-center gap-2 border-b border-white/5 pb-3"><PenTool className="w-5 h-5"/> Giao diện kiểm định bài làm</div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Nhận xét tổng quát của giáo viên:</label>
              <textarea value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)} placeholder="Nhập lời phê tổng quan..." className="w-full min-h-[80px] p-3 bg-slate-950 border border-white/10 rounded-xl font-medium text-xs outline-none text-white focus:border-blue-500" />
            </div>

            <div className="space-y-6">
              {selectedSubForGrading.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-end mb-4 border-b border-white/5 pb-2">
                    <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">- {section.name}</h3>
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
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
                        <div key={qIdx} className="flex flex-col gap-2 p-3 bg-slate-900 border border-white/5 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-slate-400">Câu hỏi {qIdx + 1}:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-400">Cho điểm:</span>
                              <input 
                                type="text" 
                                value={gradingScores[key] ?? ''} 
                                onChange={(e) => {
                                  const inputVal = e.target.value
                                  if (/^[0-9.,]*$/.test(inputVal)) { setGradingScores({ ...gradingScores, [key]: inputVal }) }
                                }}
                                placeholder="0,0" 
                                className="w-16 p-1 bg-slate-950 border border-white/10 rounded font-black text-center text-xs outline-none text-blue-400 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="text-xs font-medium space-y-1 mt-1 font-sans">
                            <p><span className="text-slate-400">Thí sinh điền/tô:</span> <span className="font-bold text-blue-400">{parseStudentAnswer(studentAns, currentType)}</span></p>
                            {currentType !== 'essay' && (
                              <p><span className="text-slate-400">Đáp án gốc:</span> <span className="font-bold text-emerald-400">
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
    <div className="app-shell min-h-screen flex flex-col md:flex-row bg-transparent text-slate-100 font-sans overflow-x-hidden pb-20 md:pb-0">
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full filter blur-[130px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full filter blur-[130px] pointer-events-none"></div>

      {/* MODAL 1: TỰ ĐỘNG BÓC TÁCH CẤU TRÚC VÀ ĐẾM CÂU TỪ TEXT FILE PDF */}
      {autoFillModalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setAutoFillModalId(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:text-red-400 transition-colors"><X className="w-4 h-4"/></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30"><Layers className="w-5 h-5"/></div>
              <div>
                <h3 className="font-black text-base">Quét Cấu Trúc Đề Tự Động</h3>
                <p className="text-xs text-slate-400 font-medium">Hệ thống phân tích text thô để tự chia vùng dạng bài và thiết lập câu.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center relative hover:bg-slate-800/40 transition-colors">
                <input type="file" accept=".pdf" onChange={handleProcessPdfTextParsing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <UploadCloud className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-300">Nhấp chọn hoặc kéo thả tệp PDF đề vào đây</p>
                <p className="text-xs text-slate-500 mt-1">Yêu cầu: Văn bản chứa từ khóa phân đoạn như "Câu 1.", "Câu 2."</p>
              </div>
              {uploadStatus.type === 'uploading' && (
                <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin"/> {uploadStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: KHỚP ĐÁP ÁN THẦN TỐC (HỖ TRỢ ĐA DẠNG BÀI LIỀN MẠCH) */}
      {quickAnswersModalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setQuickAnswersModalId(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:text-red-400 transition-colors"><X className="w-4 h-4"/></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30"><KeyRound className="w-5 h-5"/></div>
              <div>
                <h3 className="font-black text-base">Hộp Đáp Án Hỗn Hợp</h3>
                <p className="text-xs text-slate-400 font-medium">Nhập chuỗi ký tự thô từng dòng tương thích theo mẫu đề thi.</p>
              </div>
            </div>
            <div className="space-y-4">
              <textarea 
                value={quickAnswersText} 
                onChange={(e) => setQuickAnswersText(e.target.value)} 
                placeholder="Nhập theo dạng mẫu:&#10;1. A 2. Đ S Đ Đ 3. Câu trả lời ngắn" 
                className="w-full h-40 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 shadow-inner font-mono" 
              />
              <button onClick={handleProcessQuickAnswers} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs transition-transform active:scale-95 shadow-md">Đồng bộ chuỗi dữ liệu</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MENU TRẠM ĐIỀU HÀNH SIDEBAR (DESKTOP VIEW) --- */}
      <div className="w-64 bg-slate-900 border-r border-white/10 p-6 flex flex-col hidden md:flex shrink-0 z-30">
        <div className="flex items-center gap-2.5 mb-8 border-b border-white/5 pb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white shadow-md">S</div>
          <span className="font-black text-base tracking-tight">Trạm Quản Trị</span>
        </div>
        <nav className="flex-grow space-y-1">
          <button onClick={() => setActiveTab('upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors ${activeTab === 'upload' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}><PlusCircle className="w-4 h-4"/> Đăng đề thi mới</button>
          <button onClick={() => setActiveTab('manage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors ${activeTab === 'manage' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}><FileText className="w-4 h-4"/> Quản lý kho đề</button>
          <button onClick={() => setActiveTab('submissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors ${activeTab === 'submissions' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}><ClipboardList className="w-4 h-4"/> Quản lý bài nộp</button>
          <button onClick={() => setActiveTab('collab')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-colors ${activeTab === 'collab' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}><Users className="w-4 h-4"/> Cài đặt Collab</button>
          <div className="h-[1px] bg-white/5 my-4"></div>
          <button onClick={() => router.push('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 rounded-xl font-bold text-xs"><LayoutDashboard className="w-4 h-4"/> Quay về Dashboard</button>
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-xs transition-colors mt-auto"><LogOut className="w-4 h-4"/> Đăng xuất tài khoản</button>
      </div>

      {/* --- KHÔNG GIAN NỘI DUNG CHÍNH --- */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto relative">
        <div className="absolute top-8 right-10 z-40 hidden md:block">
          <button onClick={() => { setShowNotificationBox(!showNotificationBox); setNotifications(prev => prev.map(n => ({...n, read: true}))) }} className="p-2.5 bg-slate-900 border border-white/10 rounded-xl relative shadow-md">
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center">{unreadCount}</span>}
          </button>
          {showNotificationBox && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-2.5 z-50 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-white/5 pb-2 text-[10px] font-black text-slate-400 uppercase"><span>Nhật ký tác vụ</span><button onClick={() => setNotifications([])} className="text-red-400">Xóa sạch</button></div>
              {notifications.length === 0 ? <p className="text-[10px] text-center text-slate-500 py-4 font-bold">Không có tác vụ mới.</p> : notifications.map(n => (
                <div key={n.id} className="p-2.5 rounded-xl bg-slate-950/55 border border-white/10 text-xs flex items-start gap-2.5 shadow-inner">
                  <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'success' ? 'text-emerald-400' : n.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}/>
                  <div><p className="font-black text-slate-200">{n.title}</p><p className="text-slate-400 mt-0.5 font-bold leading-normal">{n.message}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-5xl mx-auto">
          
          {/* TAB 1: ĐĂNG ĐỀ THI MỚI */}
          {activeTab === 'upload' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Trình Tạo Đề Thi Số Hóa</h2>
                <p className="text-slate-400 font-bold text-xs mt-1">Cơ chế nạp text thông minh kết hợp hệ thống lưu trữ đồng bộ Drive.</p>
              </div>

              <form onSubmit={handleUploadExam} className="space-y-6">
                <div className="bg-slate-900/40 border border-white/10 p-5 md:p-8 rounded-[2rem] shadow-xl space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Tiêu đề bài kiểm tra (*)</label>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Khảo sát chất lượng Toán 12..." className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none text-white focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Loại hình kỳ thi</label>
                      <select value={examType} onChange={(e) => { setExamType(e.target.value); setSelectedSubjects([]) }} className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none text-white cursor-pointer">{EXAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Thời gian thi (Phút)</label>
                      <input type="number" min="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950/50 rounded-xl border border-white/5">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase">Giới hạn lượt làm bài</label>
                      <input type="number" min="0" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase">Phương thức xếp hạng điểm</label>
                      <select value={gradingMethod} onChange={(e) => setGradingMethod(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer"><option value="highest">Lấy điểm số cao nhất</option><option value="last">Lấy điểm lượt làm cuối</option></select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-black text-slate-400 uppercase">Cài đặt bảo mật hồ sơ</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="p-3 bg-slate-950/30 border border-white/5 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold">Xem lại bài sau nộp</span><input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} className="w-4 h-4 accent-blue-600" /></label>
                      <label className="p-3 bg-slate-950/30 border border-white/5 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold text-red-500">Ẩn đề thi (Private)</span><input type="checkbox" checked={isHiddenExam} onChange={(e) => setIsHiddenExam(e.target.checked)} className="w-4 h-4 accent-red-600" /></label>
                      <label className="p-3 bg-purple-950/20 border border-purple-900/20 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold text-purple-400">Camera AI Giám sát</span><input type="checkbox" checked={requireProctoring} onChange={(e) => setRequireProctoring(e.target.checked)} className="w-4 h-4 accent-purple-600" /></label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Chọn cấu phần bộ môn thi (*)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {currentAvailableSubjects.map(sub => (
                        <button type="button" key={sub} onClick={() => toggleSubject(sub)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedSubjects.includes(sub) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/10 text-slate-300'}`}>{sub}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Tệp đề gốc PDF (*)</label>
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center relative hover:bg-white/5 transition-colors">
                      <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-300">{file ? file.name : 'Kéo thả file PDF đề vào đây'}</p>
                    </div>
                  </div>
                </div>

                {/* KHỐI ĐIỀU PHỐI CẤU TRÚC HÒM BÀI LÀM */}
                <div className="bg-slate-900/40 border border-white/10 p-5 md:p-8 rounded-[2rem] shadow-xl space-y-5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm font-black text-orange-400 flex items-center gap-1.5"><Layers className="w-5 h-5"/>Phân mảnh cấu trúc hòm bài làm</span>
                    <button type="button" onClick={addSection} className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3.5 py-1.5 rounded-xl font-bold hover:bg-orange-500/20 transition-colors">+ Thêm khối đề</button>
                  </div>

                  <div className="space-y-4">
                    {examStructure.map((section) => (
                      <div key={section.id} className="bg-slate-955/40 p-4 md:p-5 rounded-2xl border border-white/5 relative space-y-4">
                        <button type="button" onClick={() => removeSection(section.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"><X className="w-4 h-4"/></button>
                        
                        <input type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)} className="font-black bg-transparent border-b border-white/10 text-white text-base outline-none w-full md:w-1/2 pb-1 focus:border-blue-500" placeholder="Tên phần thi..." />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Bộ môn</label><select value={section.subject} onChange={(e) => updateSection(section.id, 'subject', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white text-xs font-bold outline-none">{selectedSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Dạng bài chủ đạo</label>
                            <select value={section.type} onChange={(e) => updateSection(section.id, 'type', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white text-xs font-bold outline-none">
                              <option value="mixed">Mô hình hỗn hợp số (Tự động định hình)</option>
                              <option value="single_choice">Trắc nghiệm đơn</option>
                              <option value="true_false">Đúng / Sai 4 ý</option>
                              <option value="short_answer">Trả lời ngắn / Điền số</option>
                            </select>
                          </div>
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số lượng câu</label><input type="number" min="0" value={section.questionCount} onChange={(e) => updateSection(section.id, 'questionCount', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white text-xs font-bold outline-none" /></div>
                        </div>

                        {section.type === 'mixed' && (
                          <div className="p-3 bg-slate-950/80 rounded-xl space-y-2.5 border border-white/5">
                            <div className="flex justify-between items-center border-b border-white/5 pb-1.5"><span className="text-[10px] font-black text-slate-400 uppercase">Phân vùng câu hỏi tự động hiển thị</span><button type="button" onClick={() => handleAddMixedRange(section.id)} className="text-[9px] font-black bg-blue-600/10 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20">+ Thêm vùng</button></div>
                            {section.mixedRanges?.map((range, rIdx) => (
                              <div key={rIdx} className="flex flex-wrap items-center gap-2 text-xs font-bold">
                                <span className="text-slate-500">Từ</span>
                                <input type="number" value={range.start} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'start', parseInt(e.target.value)||1)} className="w-12 p-1 bg-slate-900 border border-white/10 rounded-md text-white text-center outline-none"/>
                                <span className="text-slate-500">đến</span>
                                <input type="number" value={range.end} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'end', parseInt(e.target.value)||1)} className="w-12 p-1 bg-slate-900 border border-white/10 rounded-md text-white text-center outline-none"/>
                                <select value={range.type} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'type', e.target.value)} className="flex-1 p-1 bg-slate-900 border border-white/10 rounded-md text-white outline-none text-[11px]">
                                  <option value="single_choice">Trắc nghiệm</option>
                                  <option value="true_false">Đúng / Sai 4 ý</option>
                                  <option value="short_answer">Trả lời ngắn</option>
                                </select>
                                <button type="button" onClick={() => handleRemoveMixedRange(section.id, rIdx)} className="text-red-400 p-1 bg-red-500/10 rounded-md"><X className="w-3.5 h-3.5"/></button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                          <button type="button" onClick={() => setEditingKeysSectionId(editingKeysSectionId === section.id ? null : section.id)} className="text-[11px] font-black bg-white/5 text-slate-300 px-3.5 py-2 rounded-xl flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/> {editingKeysSectionId === section.id ? 'Thu gọn đáp án' : 'Nhập bảng đáp án kiểm tra'}</button>
                          <button type="button" onClick={() => setAutoFillModalId(section.id)} className="text-[11px] font-black bg-blue-600 text-white px-3.5 py-2 rounded-xl flex items-center gap-1"><FileText className="w-3.5 h-3.5"/> 1. Quét cấu trúc từ văn bản PDF</button>
                          {section.questionCount > 0 && <button type="button" onClick={() => setQuickAnswersModalId(section.id)} className="text-[11px] font-black bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl flex items-center gap-1"><Sparkles className="w-3.5 h-3.5"/> 2. Khớp chuỗi đáp án nhanh</button>}
                        </div>

                        {/* BẢNG ĐIỀU PHỐI ĐÁP ÁN SIÊU NHẸ (KHÔNG ẢNH CẮT CŨ - ZERO LAG CORE RAM) */}
                        {editingKeysSectionId === section.id && (
                          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-white/5 max-h-80 overflow-y-auto custom-scrollbar">
                            {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                              let currentType = section.type
                              if (section.type === 'mixed' && section.mixedRanges) {
                                const range = section.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                                currentType = range ? range.type : 'short_answer'
                              }

                              return (
                                <div key={qIdx} className="p-2 bg-slate-900 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                  <div className="font-black text-slate-300">
                                    <span className="px-2 py-0.5 bg-slate-800 rounded mr-2 text-[10px]">Câu {qIdx + 1}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">({currentType})</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {currentType === 'single_choice' && (
                                      <div className="flex gap-1">
                                        {['A','B','C','D'].map(l => <button type="button" key={l} onClick={() => handleSetCorrectAnswer(section.id, qIdx, l)} className={`w-7 h-7 rounded-full border text-[10px] font-black ${section.correctAnswers[qIdx] === l ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-950 border-white/10 text-slate-400'}`}>{l}</button>)}
                                      </div>
                                    )}
                                    {currentType === 'true_false' && (
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 font-bold text-[11px]">
                                        {['a','b','c','d'].map(sub => {
                                          const v = section.correctAnswers[qIdx]?.[sub]
                                          return (
                                            <div key={sub} className="flex items-center gap-1">
                                              <span className="text-slate-500 uppercase">{sub}:</span>
                                              <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'Đ')} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${v === 'Đ' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-500'}`}>Đúng</button>
                                              <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'S')} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${v === 'S' ? 'bg-red-600 text-white' : 'bg-slate-950 text-slate-500'}`}>Sai</button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {currentType === 'short_answer' && (
                                      <input type="text" value={section.correctAnswers[qIdx] || ''} onChange={(e) => handleSetCorrectAnswer(section.id, qIdx, e.target.value)} className="w-36 bg-slate-950 border border-white/10 p-1.5 rounded-lg text-xs font-bold text-white outline-none text-center" placeholder="Đáp án điền..." />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg active:scale-[0.99] transition-transform">{uploadStatus.type === 'uploading' ? 'Hệ thống đang lưu cấu trúc...' : 'Đóng gói & Phát hành đề thi'}</button>
              </form>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ KHO ĐỀ */}
          {activeTab === 'manage' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="text-xl font-black">Kho Lưu Trữ Đề Kiểm Tra</h3>
                <div className="bg-slate-900 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-slate-400" /><select value={manageFilter} onChange={(e) => setManageFilter(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-200">{EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}<option value="Tất cả">Tất cả đề</option></select></div>
              </div>
              <div className="bg-slate-900/40 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900/70 border-b border-white/10"><th className="p-4 text-slate-400 font-bold">MÃ / TIÊU ĐỀ</th><th className="p-4 text-slate-400 font-bold">MÔN HỌC</th><th className="p-4 text-slate-400 font-bold">HỆ ĐỀ</th><th className="p-4 text-slate-400 font-bold text-right">THAO TÁC</th></tr></thead>
                  <tbody>
                    {filteredExams.map(exam => (
                      <tr key={exam.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold max-w-xs truncate">{exam.title} {exam.is_hidden && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded ml-1.5 font-black uppercase">Mã: {exam.access_code}</span>}</td>
                        <td className="p-4"><div className="flex gap-1">{exam.subjects?.map((s: string) => <span key={s} className="px-2 py-0.5 bg-slate-950 border border-white/5 rounded font-bold text-[10px]">{s}</span>)}</div></td>
                        <td className="p-4"><span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black rounded-lg">{exam.exam_type}</span></td>
                        <td className="p-4 text-right"><button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-red-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: QUẢN LÝ BÀI NỘP */}
          {activeTab === 'submissions' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h3 className="text-xl font-black">Hồ Sơ Kết Quả Thí Sinh</h3>
              <div className="bg-slate-900/40 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900/70 border-b border-white/10"><th className="p-4 text-slate-400 font-bold">THÍ SINH</th><th className="p-4 text-slate-400 font-bold">ĐỀ THI</th><th className="p-4 text-slate-400 font-bold">ĐIỂM SỐ</th><th className="p-4 text-slate-400 font-bold text-right">HÀNH ĐỘNG</th></tr></thead>
                  <tbody>
                    {filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold">{sub.profiles?.full_name || 'Thí sinh ẩn danh'}</td>
                        <td className="p-4 font-bold max-w-xs truncate">{sub.exams?.title}</td>
                        <td className="p-4"><span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black rounded-md">{String(sub.score).replace('.', ',')}đ</span></td>
                        <td className="p-4 text-right"><button onClick={() => openGradingView(sub)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg text-white transition-colors flex items-center gap-1 ml-auto"><Eye className="w-3.5 h-3.5"/> Kiểm duyệt</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PHÂN QUYỀN COLLAB */}
          {activeTab === 'collab' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h3 className="text-xl font-black">Ủy Quyền Phân Cấp Hồ Sơ</h3>
              <div className="bg-slate-900/40 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900/70 border-b border-white/10"><th className="p-4 text-slate-400 font-bold">HỌ VÀ TÊN</th><th className="p-4 text-slate-400 font-bold">CẤP QUYỀN TRUY CẬP</th><th className="p-4 text-slate-400 font-bold text-right">THAY ĐỔI</th></tr></thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-black flex items-center gap-1.5">{u.full_name || 'Tài khoản chưa định danh'}</td>
                        <td className="p-4"><span className={`px-2.5 py-0.5 rounded font-black uppercase text-[10px] border ${u.role === 'admin' ? 'bg-red-500/10 border-red-500/20 text-red-400' : u.role === 'collab' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-slate-950 border-white/10 text-slate-300'}`}>{u.role || 'Học sinh'}</span></td>
                        <td className="p-4 text-right">
                          {currentUserRole === 'admin' && u.role !== 'admin' && (
                            <select value={u.role || 'student'} onChange={(e) => handleUpdateRole(u.id, e.target.value)} className="bg-slate-950 border border-white/10 p-1.5 rounded-lg font-bold text-white outline-none text-xs cursor-pointer focus:border-blue-500"><option value="student">Học sinh thường</option><option value="premium_student">Thành viên Premium</option><option value="collab">Cộng tác viên (Collab)</option></select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* BOTTOM NAVIGATION: CHỈ HIỂN THỊ TRÊN THIẾT BỊ DI ĐỘNG (MOBILE ONLY VIEW) */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-white/10 grid grid-cols-4 z-40 md:hidden">
        <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'upload' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><PlusCircle className="w-4 h-4"/><span className="text-[9px] font-bold">Đăng đề</span></button>
        <button onClick={() => setActiveTab('manage')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'manage' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><FileText className="w-4 h-4"/><span className="text-[9px] font-bold">Kho đề</span></button>
        <button onClick={() => setActiveTab('submissions')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'submissions' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><ClipboardList className="w-4 h-4"/><span className="text-[9px] font-bold">Bài làm</span></button>
        <button onClick={() => setActiveTab('collab')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'collab' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><Users className="w-4 h-4"/><span className="text-[9px] font-bold">Ủy quyền</span></button>
      </div>

    </div>
  )
}