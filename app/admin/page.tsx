'use client'

import { useEffect, useState, useRef, useMemo, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  UploadCloud, FileText, Users, LogOut, PlusCircle, 
  Trash2, ShieldAlert, BookOpen, Layers, X, ClipboardList, 
  CheckCircle2, Hourglass, ExternalLink, KeyRound, Filter, Eye, Save, ArrowLeft, PenTool, LayoutDashboard, Maximize2,
  Wand2, Sparkles, Crown, Camera, Sparkle, Shuffle, Check, FileInput, Bell, AlertCircle, Menu
} from 'lucide-react'

// Cấu hình worker cho thư viện PDF.js xử lý cắt ảnh ngầm trên trình duyệt
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT']
const SUBJECT_GROUPS: Record<string, string[]> = {
  'THPTQG': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'SPT': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'HSA': ['Tư duy Định lượng', 'Tư duy Định tính', 'Khoa học'],
  'TSA': ['Toán học', 'Đọc hiểu', 'Khoa học giải quyết vấn đề']
}

type MixedRange = { start: number, end: number, type: string, optionsCount: number }

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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error', message: string}>({ type: 'idle', message: '' })

  const [editingKeysSectionId, setEditingKeysSectionId] = useState<string | null>(null)
  const [isHiddenExam, setIsHiddenExam] = useState(false)
  
  const [requireProctoring, setRequireProctoring] = useState(false)
  const [creationMode, setCreationMode] = useState<'pdf_mode' | 'interactive_mode'>('pdf_mode')

  // HỆ THỐNG THÔNG BÁO LIỀN MẠCH
  const [notifications, setNotifications] = useState<SysNotification[]>([
    { id: '1', title: 'Hệ thống sẵn sàng', message: 'Hạ tầng AI OCR cắt ảnh PDF phối hợp bảng đáp án tự động đã kích hoạt.', type: 'success', time: 'Vừa xong', read: false }
  ])
  const [showNotificationBox, setShowNotificationBox] = useState(false)

  // Modals bóc tách đáp án thần tốc
  const [autoFillModalId, setAutoFillModalId] = useState<string | null>(null)
  const [autoFillText, setAutoFillText] = useState('')
  const [quickAnswersModalId, setQuickAnswersModalId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

  const [examStructure, setExamStructure] = useState<{
    id: string, 
    type: string, 
    name: string, 
    subject: string,
    questionCount: number, 
    optionsCount?: number,
    correctAnswers: Record<number, any>,
    scoringMode: 'auto_divide' | 'custom', 
    sectionTotalPoints: number,            
    customPoints: Record<number, number>,
    mixedRanges?: MixedRange[],
    questionEntries?: Record<number, { text: string; imageCrop?: string; options?: string[] }>, 
    dragDropOptions?: Record<number, string[]> 
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

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [router])

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl)
    }
  }, [pdfPreviewUrl])

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
    if (!isAdmin) return;

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
      type: 'single_choice', 
      name: `Phần thi số ${examStructure.length + 1}`, 
      subject: selectedSubjects[0] || '',
      questionCount: 5, 
      optionsCount: 4,
      correctAnswers: {},
      scoringMode: 'auto_divide',
      sectionTotalPoints: 10,
      customPoints: {},
      mixedRanges: [],
      questionEntries: {},
      dragDropOptions: {}
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

  // 🌟 BỘ LÕI OCR NHẬN DIỆN VÀ TỰ ĐỘNG CẮT ĐỀ THI THÀNH ẢNH TỪ FILE PDF GỐC 🌟
  const handleProcessPdfCropping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || !autoFillModalId) return

    const section = examStructure.find(s => s.id === autoFillModalId)
    if (!section) return

    addNotification('Bóc tách PDF', 'Hệ thống đang quét tọa độ câu hỏi và băm ảnh ngầm...', 'info')
    setUploadStatus({ type: 'uploading', message: 'Hệ thống đang quét tọa độ câu hỏi ngầm trên Canvas...' })

    try {
      const fileToArrayBuffer = await uploadedFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise
      
      const newQuestionEntries: Record<number, { text: string; imageCrop?: string; options?: string[] }> = { ...section.questionEntries }
      const detectedTypes: Record<number, string> = {}
      let totalQuestionsFound = 0

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({ canvas: canvas, canvasContext: ctx!, viewport }).promise

        const items: any[] = textContent.items
        const questionLines: { qIndex: number; yTop: number }[] = []

        items.forEach((item: any) => {
          const text = item.str.trim()
          const match = text.match(/^(?:Câu|Bài|Question|Q)\s*([1-9]\d*)[\.\:\-\)\s]/i)
          if (match) {
            const qNum = parseInt(match[1]) - 1
            const [, , , , , yPos] = item.transform
            const canvasY = viewport.height - (yPos * 2.0)
            questionLines.push({ qIndex: qNum, yTop: canvasY })
          }
        })

        questionLines.sort((a, b) => a.yTop - b.yTop)

        for (let i = 0; i < questionLines.length; i++) {
          const currentQ = questionLines[i]
          const nextQ = questionLines[i + 1]

          const yStart = Math.max(0, currentQ.yTop - 25)
          const yEnd = nextQ ? nextQ.yTop - 15 : viewport.height

          const cropHeight = yEnd - yStart
          if (cropHeight <= 10) continue

          const cropCanvas = document.createElement('canvas')
          cropCanvas.width = viewport.width
          cropCanvas.height = cropHeight
          const cropCtx = cropCanvas.getContext('2d')

          cropCtx?.drawImage(canvas, 0, yStart, viewport.width, cropHeight, 0, 0, viewport.width, cropHeight)
          const base64Image = cropCanvas.toDataURL('image/jpeg', 0.9)
          
          detectedTypes[currentQ.qIndex] = 'single_choice'
          newQuestionEntries[currentQ.qIndex] = {
            text: `Câu hỏi phân mảnh dạng ảnh số ${currentQ.qIndex + 1}`,
            imageCrop: base64Image
          }
          totalQuestionsFound++
        }
      }

      if (totalQuestionsFound === 0) throw new Error("Không quét được mốc từ khóa câu hỏi.")

      setExamStructure(prev => prev.map(s => {
        if (s.id === autoFillModalId) {
          const newRanges = []
          let currentRange: any = null

          for (let i = 0; i < totalQuestionsFound; i++) {
            const qType = detectedTypes[i] || 'single_choice'
            if (!currentRange) {
              currentRange = { start: i + 1, end: i + 1, type: qType, optionsCount: 4 }
            } else if (currentRange.type === qType) {
              currentRange.end = i + 1
            } else {
              newRanges.push(currentRange)
              currentRange = { start: i + 1, end: i + 1, type: qType, optionsCount: 4 }
            }
          }
          if (currentRange) newRanges.push(currentRange)

          return {
            ...s,
            type: 'mixed',
            questionCount: totalQuestionsFound,
            mixedRanges: newRanges,
            questionEntries: newQuestionEntries
          }
        }
        return s
      }))

      setAutoFillModalId(null)
      setUploadStatus({ type: 'idle', message: '' })
      addNotification('Trích xuất hoàn tất', `Đã tự động bóc nhỏ và tạo lập ${totalQuestionsFound} ô câu hỏi dạng ảnh thành công.`, 'success')

    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Lỗi bóc tách tệp PDF.' })
      addNotification('Trích xuất thất bại', 'Vui lòng kiểm tra lại cấu trúc file PDF đầu vào.', 'error')
    }
  }

  // KHỚP CHUỖI ĐÁP ÁN THẦN TỐC THEO CHUỖI TEXT
  const handleProcessQuickAnswers = () => {
    if (!quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    const rawAnswers = quickAnswersText.trim()
    const updatedAnswers = { ...section.correctAnswers }

    try {
      const answerRegex = /(?:^|[\,\;\s\n])(?:Câu|Bài|Q)?\s*([1-9]\d*)[\.\:\-\)\s]*([A-D]|(?:[ĐS]\s*){4}|[^\,\;\n]+)/gi
      const matches = [...rawAnswers.matchAll(answerRegex)]

      if (matches.length === 0) {
        alert("Không nhận diện được định dạng. Cú pháp mẫu chuẩn: 1.A, 2.B, 3.ĐSĐS")
        return
      }

      matches.forEach(match => {
        const qIdx = parseInt(match[1]) - 1
        if (qIdx >= 0 && qIdx < section.questionCount) {
          let ansContent = match[2].trim().toUpperCase()

          if (/^([ĐSTSFC]|\s){4,7}$/.test(ansContent.replace(/[\s]/g, ''))) {
            const cleanArray = ansContent.replace(/[\s]/g, '').split('').map(char => (char === 'T' || char === 'Đ' || char === 'C') ? 'Đ' : 'S')
            updatedAnswers[qIdx] = { a: cleanArray[0]||'Đ', b: cleanArray[1]||'S', c: cleanArray[2]||'Đ', d: cleanArray[3]||'S' }
          } else {
            updatedAnswers[qIdx] = ansContent
          }
        }
      })

      setExamStructure(prev => prev.map(s => s.id === section.id ? { ...s, correctAnswers: updatedAnswers } : s))
      setQuickAnswersModalId(null)
      setQuickAnswersText('')
      addNotification('Đồng bộ đáp án', 'Hệ thống đã khớp tệp đáp án hàng loạt thành công.', 'success')
    } catch (e: any) {
      alert("Lỗi: " + e.message)
    }
  }

  const handleAnswerFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      if (evt.target?.result) setAutoFillText(evt.target.result as string)
    }
    reader.readAsText(file)
  }

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || (creationMode === 'pdf_mode' && !file) || selectedSubjects.length === 0 || examStructure.length === 0) {
      setUploadStatus({ type: 'error', message: 'Vui lòng điền đủ thông tin chung và tạo cấu trúc câu hỏi.' })
      return
    }

    try {
      let driveFileId = null;
      if (creationMode === 'pdf_mode' && file) {
        setUploadStatus({ type: 'uploading', message: 'Đang đẩy tệp lên đám mây...' })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', title)

        const response = await fetch('/api/upload-exam', { method: 'POST', body: formData })
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const result = await response.json();
           if (!response.ok) throw new Error(result.error || 'Lỗi lưu kho');
           driveFileId = result.driveFileId;
        } else {
           throw new Error(`Lỗi kết nối Server (${response.status})`);
        }
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("Phiên đăng nhập hết hạn.")

      const generatedAccessCode = isHiddenExam ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
      const cleanExamStructure = examStructure.map(s => ({...s}))

      const { error: dbError } = await supabase.from('exams').insert({
        title, exam_type: examType, duration, allow_review: allowReview, max_attempts: maxAttempts, grading_method: gradingMethod, subjects: selectedSubjects, exam_structure: cleanExamStructure, drive_file_id: driveFileId, created_by: user.id, is_hidden: isHiddenExam, access_code: generatedAccessCode, require_proctoring: requireProctoring, creation_mode: creationMode
      })

      if (dbError) throw new Error(dbError.message)
      setUploadStatus({ type: 'success', message: 'Xuất bản đề thi tương tác thành công!' })
      addNotification('Xuất bản đề thi', `Đề thi "${title}" đã được đưa lên hệ thống công khai.`, 'success')
      setTitle(''); setFile(null); setPdfPreviewUrl(null); setSelectedSubjects([]); setExamStructure([]);
    } catch (error: any) {
      setUploadStatus({ type: 'error', message: error?.message || 'Lỗi hệ thống.' })
    }
  }

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Xóa đề thi này?')) return
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
      let perQuestionPoints = section.scoringMode === 'auto_divide' ? ((section.sectionTotalPoints || 0) / (section.questionCount || 1)) : 0;

      Array.from({ length: section.questionCount }).forEach((_, qIdx) => {
        const key = `${section.id}-${qIdx}`
        
        if (submission.detailed_scores?.[key] !== undefined) {
          initialScores[key] = String(submission.detailed_scores[key]).replace('.', ',')
        } else {
          let currentType = section.type;
          if (section.type === 'mixed' && section.mixedRanges) {
            const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
            currentType = range ? range.type : 'short_answer'
          }

          if (currentType === 'essay') { 
            initialScores[key] = '0' 
          } else {
            let qPoint = section.scoringMode === 'custom' ? (section.customPoints?.[qIdx] || 0) : perQuestionPoints;
            let earned = 0;
            const studentAns = submission.answers?.[key]; 
            const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]; 
            
            if (currentType === 'true_false') {
              let correctSubCount = 0;
              if (studentAns && typeof studentAns === 'object' && correctAns && typeof correctAns === 'object') {
                ['a','b','c','d'].forEach(sub => { if (studentAns[sub] === correctAns[sub]) correctSubCount++; })
              }
              if (correctSubCount === 1) earned = qPoint * 0.1;
              else if (correctSubCount === 2) earned = qPoint * 0.25;
              else if (correctSubCount === 3) earned = qPoint * 0.5;
              else if (correctSubCount === 4) earned = qPoint * 1.0;
            } else if (currentType === 'multiple_choice') {
              if (Array.isArray(studentAns) && Array.isArray(correctAns) && studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))) earned = qPoint;
            } else { 
              if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(correctAns).trim()) earned = qPoint; 
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
      parsedScores[key] = scoreNum; totalPoints += scoreNum
    })

    const { error } = await supabase.from('submissions').update({ detailed_scores: parsedScores, feedback: gradingFeedback, score: parseFloat(totalPoints.toFixed(2)), is_graded: true }).eq('id', selectedSubForGrading.id)

    if (error) alert('Lỗi khi phê duyệt lưu điểm số: ' + error.message)
    else {
      alert('Phê duyệt điểm số thành công! Tổng điểm: ' + parseFloat(totalPoints.toFixed(2)))
      setSelectedSubForGrading(null); await refreshSubmissionsList()
    }
    setIsSavingGrade(false)
  }

  const parseStudentAnswer = (ans: any, type?: string) => {
    if (!ans) return 'Bỏ trống'
    if (type === 'true_false' && typeof ans === 'object' && !Array.isArray(ans)) {
      return ['a','b','c','d'].map(k => `${k}: ${ans[k]||'-'}`).join(' | ')
    }
    return String(ans)
  }

  const currentAvailableSubjects = SUBJECT_GROUPS[examType] || SUBJECT_GROUPS['THPTQG']
  const filteredExams = examsList.filter(e => manageFilter === 'Tất cả' || e.exam_type === manageFilter)
  const filteredSubmissions = submissionsList.filter(s => submissionFilter === 'Tất cả' || s.exams?.exam_type === submissionFilter)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-bold font-sans">Xác thực quyền quản trị...</div>

  // MÀN HÌNH CHẤM BÀI TỰ LUẬN / PHÊ DUYỆT ĐIỂM SỐ
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
            <Save className="w-4 h-4"/> {isSavingGrade ? 'Đang lưu...' : 'Phê duyệt điểm'}
          </button>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[45vh] md:h-full border-b md:border-b-0 md:border-r bg-slate-950 relative">
            {selectedSubForGrading.exams?.drive_file_id ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-950">
                <Sparkles className="w-12 h-12 mb-2 text-indigo-500 animate-pulse"/>
                <p className="font-extrabold text-sm">Đây là đề thi số hóa tương tác độc quyền</p>
                <p className="text-xs max-w-xs mt-1">Học sinh tương tác trực tiếp với các ô cắt ghép, không phụ thuộc PDF.</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[55vh] md:h-full bg-slate-900 overflow-y-auto p-6 space-y-6 custom-scrollbar shrink-0">
            <div className="text-base font-black text-blue-400 flex items-center gap-2 border-b border-white/5 pb-3"><PenTool className="w-5 h-5"/> Giao diện kiểm định bài làm</div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Nhận xét tổng quát của giáo viên:</label>
              <textarea value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)} placeholder="Nhập lời phê tổng quan..." className="w-full min-h-[80px] p-3 bg-slate-950 border border-white/10 rounded-xl font-medium text-xs outline-none focus:border-blue-500" />
            </div>

            <div className="space-y-6">
              {selectedSubForGrading.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-end mb-4 border-b border-white/5 pb-2">
                    <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">● {section.name}</h3>
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {section.scoringMode === 'custom' ? 'Điểm tùy chỉnh' : `Tổng: ${section.sectionTotalPoints}đ`}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const studentAns = selectedSubForGrading.answers?.[key]
                      const correctAnswer = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                      
                      let currentType = section.type;
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
                                  const inputVal = e.target.value;
                                  if (/^[0-9.,]*$/.test(inputVal)) { setGradingScores({ ...gradingScores, [key]: inputVal }) }
                                }}
                                placeholder="0,0" 
                                className="w-16 p-1 bg-slate-950 border border-white/10 rounded font-black text-center text-xs outline-none text-blue-400 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="text-xs font-medium space-y-1 mt-1 font-sans">
                            {section.questionEntries?.[qIdx]?.text && (
                              <p className="bg-slate-950 p-2 rounded-lg text-slate-400 mb-1 border border-white/5 font-bold">Đề: {section.questionEntries[qIdx].text}</p>
                            )}
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement, HTMLInputElement>): void {
    throw new Error('Function not implemented.')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 font-sans overflow-x-hidden pb-20 md:pb-0">
      
      {/* SIDEBAR ĐẠI TU: CHẠY TRÊN DESKTOP */}
      <div className="w-64 bg-slate-900/60 backdrop-blur-2xl border-r border-white/10 p-6 flex flex-col hidden md:flex shrink-0 z-30">
        <div className="flex items-center gap-2.5 mb-8 border-b border-white/5 pb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white shadow-md shadow-blue-600/20">S</div>
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

      {/* TOP BAR MOBILE (KIỂU DÁNG KÍNH MỜ APPS) */}
      <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between sticky top-0 z-40 md:hidden shrink-0">
        <div><span className="font-black text-sm tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SenExam Hub</span></div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => { setShowNotificationBox(!showNotificationBox); setNotifications(prev => prev.map(n => ({...n, read: true}))) }} className="p-2.5 bg-slate-900 border border-white/10 rounded-xl shadow-inner relative">
              <Bell className="w-4 h-4 text-slate-300" />
              {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
            {showNotificationBox && (
              <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-3 space-y-2 z-50 animate-in slide-in-from-top-2 max-h-80 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-white/5 pb-1.5 text-[10px] font-black text-slate-400 uppercase"><span>Nhật ký tác vụ</span><button onClick={() => setNotifications([])} className="text-red-400">Xóa</button></div>
                {notifications.length === 0 ? <p className="text-[10px] text-center text-slate-500 py-4 font-bold">Không có tác vụ mới.</p> : notifications.map(n => (
                  <div key={n.id} className="p-2 rounded-lg bg-slate-950 border border-white/5 text-[11px] flex items-start gap-2">
                    <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.type === 'success' ? 'text-emerald-400' : 'text-blue-400'}`}/>
                    <div><p className="font-extrabold text-slate-200">{n.title}</p><p className="text-slate-400 mt-0.5 font-medium leading-tight">{n.message}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* KHÔNG GIAN NỘI DUNG CHÍNH */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto relative">
        {/* CHUÔNG THÔNG BÁO CHO BẢN DESKTOP */}
        <div className="absolute top-8 right-10 z-40 hidden md:block">
          <button onClick={() => { setShowNotificationBox(!showNotificationBox); setNotifications(prev => prev.map(n => ({...n, read: true}))) }} className="p-2.5 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-xl relative shadow-md">
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center">{unreadCount}</span>}
          </button>
          {showNotificationBox && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-2.5 z-50 animate-in slide-in-from-top-2 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-white/5 pb-2 text-[10px] font-black text-slate-400 uppercase"><span>Nhật ký hoạt động</span><button onClick={() => setNotifications([])} className="text-red-400">Xóa sạch</button></div>
              {notifications.map(n => (
                <div key={n.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/5 text-xs flex items-start gap-2.5 shadow-inner">
                  <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'success' ? 'text-emerald-400' : 'text-blue-400'}`}/>
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
                <p className="text-slate-400 font-bold text-xs mt-1">Hỗ trợ nhận diện và cắt đề bài thành ảnh, tối ưu hiển thị đa thiết bị.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-900 border border-white/10 rounded-2xl mb-6">
                <button type="button" onClick={() => setCreationMode('pdf_mode')} className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${creationMode === 'pdf_mode' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5'}`}><FileText className="w-3.5 h-3.5"/> PDF Truyền thống</button>
                <button type="button" onClick={() => setCreationMode('interactive_mode')} className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${creationMode === 'interactive_mode' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5'}`}><Sparkle className="w-3.5 h-3.5"/> Cắt ghép tương tác số</button>
              </div>

              <form onSubmit={handleUploadExam} className="space-y-6">
                <div className="bg-slate-900/60 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] border border-white/10 shadow-xl space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Tiêu đề bài kiểm tra (*)</label>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Khảo sát chất lượng Toán 12..." className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Loại hình kỳ thi</label>
                      <select value={examType} onChange={(e) => { setExamType(e.target.value); setSelectedSubjects([]) }} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none cursor-pointer">{EXAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Thời gian thi (Phút)</label>
                      <input type="number" min="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950/40 rounded-xl border border-white/5">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase">Giới hạn lượt làm bài</label>
                      <input type="number" min="0" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 mb-1 uppercase">Phương thức xếp hạng điểm</label>
                      <select value={gradingMethod} onChange={(e) => setGradingMethod(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer"><option value="highest">Lấy điểm số cao nhất</option><option value="last">Lấy điểm lượt làm cuối</option></select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-black text-slate-400 uppercase">Cài đặt nâng cấp bảo mật</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold">Xem lại bài sau nộp</span><input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} className="w-4 h-4 accent-blue-600" /></label>
                      <label className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold text-red-400">Ẩn đề thi (Private)</span><input type="checkbox" checked={isHiddenExam} onChange={(e) => setIsHiddenExam(e.target.checked)} className="w-4 h-4 accent-red-600" /></label>
                      <label className="p-3 bg-purple-950/20 border border-purple-900/20 rounded-xl flex items-center justify-between cursor-pointer"><span className="text-xs font-bold text-purple-400">Camera AI Giám sát</span><input type="checkbox" checked={requireProctoring} onChange={(e) => setRequireProctoring(e.target.checked)} className="w-4 h-4 accent-purple-600" /></label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Chọn cấu phần bộ môn thi (*)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {currentAvailableSubjects.map(sub => (
                        <button type="button" key={sub} onClick={() => toggleSubject(sub)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedSubjects.includes(sub) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950/60 border-white/10 text-slate-400'}`}>{sub}</button>
                      ))}
                    </div>
                  </div>

                  {creationMode === 'pdf_mode' && (
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Tệp đề gốc PDF (*)</label>
                      <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center relative hover:bg-white/5 transition-colors">
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                        <p className="text-xs font-bold text-slate-300">{file ? file.name : 'Kéo thả file PDF đề vào đây'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] border border-white/10 shadow-xl space-y-5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm font-black text-orange-400 flex items-center gap-1.5"><Layers className="w-5 h-5"/>Phân mảnh cấu trúc hòm bài làm</span>
                    <button type="button" onClick={addSection} className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3.5 py-1.5 rounded-xl font-bold hover:bg-orange-500/20 transition-colors">+ Thêm khối đề hỗn hợp</button>
                  </div>

                  <div className="space-y-4">
                    {examStructure.map((section) => (
                      <div key={section.id} className="bg-slate-950/60 p-4 md:p-5 rounded-2xl border border-white/5 relative space-y-4">
                        <button type="button" onClick={() => removeSection(section.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-400 transition-colors"><X className="w-4 h-4"/></button>
                        
                        <input type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)} className="font-black bg-transparent border-b border-white/10 text-base outline-none w-full md:w-1/2 pb-1 focus:border-blue-500" placeholder="Tên phần thi..." />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Bộ môn</label><select value={section.subject} onChange={(e) => updateSection(section.id, 'subject', e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs font-bold outline-none">{selectedSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Dạng bài chủ đạo</label>
                            <select value={section.type} onChange={(e) => updateSection(section.id, 'type', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold">
                              <option value="mixed">Câu hỗn hợp số hóa đa năng (Kiểu Azota)</option>
                              <option value="single_choice">Trắc nghiệm (1 đáp án)</option>
                              <option value="multiple_choice">Trắc nghiệm (Nhiều đáp án)</option>
                              <option value="true_false">Đúng / Sai (4 Ý bộ GD)</option>
                              <option value="short_answer">Trả lời ngắn / Điền số</option>
                              <option value="drag_drop">Kéo thả vào vùng trống [___]</option>
                            </select>
                          </div>
                          <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Số lượng câu</label><input type="number" min="1" value={section.questionCount} onChange={(e) => updateSection(section.id, 'questionCount', parseInt(e.target.value) || 1)} className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs font-bold outline-none" /></div>
                        </div>

                        {section.type === 'mixed' && (
                          <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-3 mb-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <p className="text-xs font-bold text-indigo-400">Phân vùng cấu trúc câu hỏi hỗn hợp tự động</p>
                              <button type="button" onClick={() => handleAddMixedRange(section.id)} className="text-[10px] font-bold bg-indigo-100/10 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-200 transition-colors">
                                + Thêm vùng thủ công
                              </button>
                            </div>
                            {section.mixedRanges?.map((range, rIdx) => (
                              <div key={rIdx} className="flex flex-wrap items-center gap-3 text-xs font-bold">
                                <span className="text-slate-500">Từ câu</span>
                                <input type="number" min="1" value={range.start} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'start', parseInt(e.target.value)||1)} className="w-14 p-1 bg-slate-950 border border-white/10 rounded-md text-center outline-none"/>
                                <span className="text-slate-500">đến</span>
                                <input type="number" min="1" value={range.end} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'end', parseInt(e.target.value)||1)} className="w-14 p-1 bg-slate-950 border border-white/10 rounded-md text-center outline-none"/>
                                <select value={range.type} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'type', e.target.value)} className="flex-1 p-1 bg-slate-950 border border-white/10 rounded-md outline-none text-[11px]">
                                  <option value="single_choice">Trắc nghiệm</option>
                                  <option value="true_false">Đúng / Sai 4 ý</option>
                                  <option value="short_answer">Trả lời ngắn</option>
                                  <option value="drag_drop">Kéo thả</option>
                                </select>
                                <button type="button" onClick={() => handleRemoveMixedRange(section.id, rIdx)} className="text-red-400 p-1 bg-red-500/10 rounded-md"><X className="w-3.5 h-3.5"/></button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                          <button type="button" onClick={() => setEditingKeysSectionId(editingKeysSectionId === section.id ? null : section.id)} className="text-[11px] font-black bg-white/5 text-slate-300 px-3.5 py-2 rounded-xl flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/> {editingKeysSectionId === section.id ? 'Thu gọn các câu hỏi' : 'Xem và cấu hình đáp án chi tiết'}</button>
                          <button type="button" onClick={() => setAutoFillModalId(section.id)} className="text-[11px] font-black bg-blue-600 text-white px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-blue-600/10"><Wand2 className="w-3.5 h-3.5"/> 1. Quét & Tự động cắt đề từ PDF</button>
                          {section.questionCount > 0 && <button type="button" onClick={() => setQuickAnswersModalId(section.id)} className="text-[11px] font-black bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-amber-500/10"><Sparkles className="w-3.5 h-3.5"/> 2. Khớp chuỗi đáp án nhanh</button>}
                        </div>

                        {editingKeysSectionId === section.id && (
                          <div className="space-y-3.5 bg-slate-950 p-3 rounded-xl border border-white/5 max-h-96 overflow-y-auto custom-scrollbar">
                            {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                              let currentType = section.type;
                              if (section.type === 'mixed' && section.mixedRanges) {
                                const range = section.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                                currentType = range ? range.type : 'short_answer'
                              }

                              function handleAnswerSelect(id: string, qIdx: number, l: string): void {
                                throw new Error('Function not implemented.')
                              }

                              return (
                                <div key={qIdx} className="p-3 bg-slate-900 border border-white/5 rounded-xl grid grid-cols-1 lg:grid-cols-2 gap-3">
                                  <div className="space-y-2 border-b lg:border-b-0 lg:border-r pb-2 lg:pb-0 lg:pr-3">
                                    <span className="text-[10px] font-black px-2 py-0.5 bg-slate-800 rounded text-slate-400">Câu {qIdx + 1}</span>
                                    {section.questionEntries?.[qIdx]?.imageCrop ? (
                                      <div className="bg-white p-1.5 rounded-lg border shadow-inner mt-1.5"><img src={section.questionEntries[qIdx].imageCrop} alt="" className="w-full h-auto object-contain max-h-36" /></div>
                                    ) : <p className="text-[10px] italic text-slate-500 mt-1">Chưa nạp ảnh đề từ PDF.</p>}
                                  </div>
                                  <div className="flex flex-col justify-center gap-1.5">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Đáp án điền:</span>
                                    {currentType === 'single_choice' && (
                                      <div className="flex gap-1.5">
                                        {['A','B','C','D'].map(l => <button type="button" key={l} onClick={() => handleAnswerSelect(section.id, qIdx, l)} className={`w-7 h-7 rounded-full border text-[10px] font-black ${section.correctAnswers[qIdx] === l ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-950 text-slate-400 border-white/10'}`}>{l}</button>)}
                                      </div>
                                    )}
                                    {currentType === 'true_false' && (
                                      <div className="space-y-1 text-[11px] font-bold">
                                        {['a','b','c','d'].map(sub => {
                                          const v = section.correctAnswers[qIdx]?.[sub];
                                          return (
                                            <div key={sub} className="flex items-center gap-2">
                                              <span className="text-slate-500 uppercase w-4">{sub}:</span>
                                              <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'Đ')} className={`px-2 py-0.5 rounded text-[9px] font-black ${v === 'Đ' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400'}`}>Đúng</button>
                                              <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'S')} className={`px-2 py-0.5 rounded text-[9px] font-black ${v === 'S' ? 'bg-red-600 text-white' : 'bg-slate-950 text-slate-400'}`}>Sai</button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {(currentType === 'short_answer' || currentType === 'drag_drop') && <input type="text" value={section.correctAnswers[qIdx] || ''} onChange={(e) => handleSetCorrectAnswer(section.id, qIdx, e.target.value)} className="w-full bg-slate-950 border border-white/10 p-1.5 rounded-lg text-xs font-bold outline-none" placeholder="Giá trị..." />}
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

                <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg active:scale-[0.99] transition-transform">{uploadStatus.type === 'uploading' ? 'Hệ thống đang cấu trúc...' : 'Đóng gói & Phát hành đề thi'}</button>
              </form>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ KHO ĐỀ */}
          {activeTab === 'manage' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="text-xl font-black">Kho Lưu Trữ Đề Kiểm Tra</h3>
                <div className="bg-slate-900 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-slate-400" /><select value={manageFilter} onChange={(e) => setManageFilter(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer">{EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}<option value="Tất cả">Tất cả đề</option></select></div>
              </div>
              <div className="bg-slate-900/40 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900 border-b border-white/10"><th className="p-4 text-slate-400 font-bold">TIÊU ĐỀ</th><th className="p-4 text-slate-400 font-bold">MÔN HỌC</th><th className="p-4 text-slate-400 font-bold">HỆ ĐỀ</th><th className="p-4 text-slate-400 font-bold text-right">THAO TÁC</th></tr></thead>
                  <tbody>
                    {filteredExams.map(exam => (
                      <tr key={exam.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold max-w-xs truncate">{exam.title} {exam.is_hidden && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded ml-1.5 font-black">Mã: {exam.access_code}</span>}</td>
                        <td className="p-4"><div className="flex gap-1">{exam.subjects?.map((s:string) => <span key={s} className="px-2 py-0.5 bg-slate-950 border border-white/5 text-slate-300 rounded font-bold text-[10px]">{s}</span>)}</div></td>
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
              <div className="bg-white/5 rounded-2xl border overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900 border-b"><th className="p-4 text-slate-400 font-bold">THÍ SINH</th><th className="p-4 text-slate-400 font-bold">ĐỀ THI</th><th className="p-4 text-slate-400 font-bold">ĐIỂM SỐ</th><th className="p-4 text-slate-400 font-bold text-right">HÀNH ĐỘNG</th></tr></thead>
                  <tbody>
                    {filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold">{sub.profiles?.full_name || 'Thí sinh ẩn danh'}</td>
                        <td className="p-4 font-bold max-w-xs truncate">{sub.exams?.title}</td>
                        <td className="p-4"><span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black rounded-md">{sub.score}đ</span></td>
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
              <div className="bg-white/5 rounded-2xl border overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead><tr className="bg-slate-900 border-b"><th className="p-4 text-slate-400 font-bold">HỌ VÀ TÊN</th><th className="p-4 text-slate-400 font-bold">CẤP QUYỀN TRUY CẬP</th><th className="p-4 text-slate-400 font-bold text-right">THAY ĐỔI</th></tr></thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-black flex items-center gap-1.5">{u.full_name || 'Tài khoản chưa định danh'} {u.role === 'premium_student' && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400"/>}</td>
                        <td className="p-4"><span className={`px-2.5 py-0.5 rounded font-black uppercase text-[10px] border ${u.role === 'admin' ? 'bg-red-500/10 border-red-500/20 text-red-400' : u.role === 'collab' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-slate-950 border-white/10 text-slate-400'}`}>{u.role || 'Học sinh'}</span></td>
                        <td className="p-4 text-right">
                          {currentUserRole === 'admin' && u.role !== 'admin' && (
                            <select value={u.role || 'student'} onChange={(e) => handleUpdateRole(u.id, e.target.value)} className="bg-slate-950 border border-white/10 p-1.5 rounded-lg font-bold outline-none text-xs cursor-pointer focus:border-blue-500"><option value="student">Học sinh thường</option><option value="premium_student">Thành viên Premium</option><option value="collab">Cộng tác viên (Collab)</option></select>
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

      {/* BOTTOM NAVIGATION: CHỈ HIỂN THỊ TRÊN THIẾT BỊ DI ĐỘNG (MOBILE ONLY) */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 grid grid-cols-4 z-40 md:hidden animate-in slide-in-from-bottom-5">
        <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'upload' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><PlusCircle className="w-4 h-4"/><span className="text-[9px] font-bold">Đăng đề</span></button>
        <button onClick={() => setActiveTab('manage')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'manage' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><FileText className="w-4 h-4"/><span className="text-[9px] font-bold">Kho đề</span></button>
        <button onClick={() => setActiveTab('submissions')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'submissions' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><ClipboardList className="w-4 h-4"/><span className="text-[9px] font-bold">Bài làm</span></button>
        <button onClick={() => setActiveTab('collab')} className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'collab' ? 'text-blue-400 font-black' : 'text-slate-500'}`}><Users className="w-4 h-4"/><span className="text-[9px] font-bold">Ủy quyền</span></button>
      </div>

    </div>
  )
}