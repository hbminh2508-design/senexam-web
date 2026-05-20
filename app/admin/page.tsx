'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  UploadCloud, FileText, Users, LogOut, PlusCircle, 
  Trash2, ShieldAlert, BookOpen, Layers, X, ClipboardList, 
  CheckCircle2, Hourglass, ExternalLink, KeyRound, Filter, Eye, Save, ArrowLeft, PenTool, LayoutDashboard, Maximize2,
  Wand2, Sparkles, Crown, Camera, Sparkle, Shuffle, Check, FileInput
} from 'lucide-react'

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT']
const SUBJECT_GROUPS: Record<string, string[]> = {
  'THPTQG': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'SPT': ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ'],
  'HSA': ['Tư duy Định lượng', 'Tư duy Định tính', 'Khoa học'],
  'TSA': ['Toán học', 'Đọc hiểu', 'Khoa học giải quyết vấn đề']
}

type MixedRange = { start: number, end: number, type: string, optionsCount: number }

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

  const [autoFillModalId, setAutoFillModalId] = useState<string | null>(null)
  const [autoFillText, setAutoFillText] = useState('')
  
  // 🌟 STATE CHO Ô NHẬP ĐÁP ÁN THẦN TỐC (QUÈT SAU KHI TẠO ĐỀ)
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
    questionEntries?: Record<number, { text: string; options?: string[] }>, // 🌟 Lưu trữ câu hỏi cắt lát
    dragDropOptions?: Record<number, string[]> 
  }[]>([])

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

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

  // 🌟 BỘ LÕI CHẨN ĐOÁN VÀ CẮT GHÉP ĐỀ TỰ ĐỘNG CHUẨN AZOTA NÂNG CẤP (KHÔNG LATEX) 🌟
  const handleProcessAutoFill = () => {
    if (!autoFillModalId) return
    const section = examStructure.find(s => s.id === autoFillModalId)
    if (!section) return

    let rawText = autoFillText.trim()

    try {
      // Biểu thức chính quy bóc tách thực thể câu hỏi tự nhiên theo định dạng văn bản thường
      const regexPattern = /(?:^|\s)(?:Câu|Bài|Question|Q|Câuy|câu)\s*([1-9]\d*)[\.\:\-\)\,\s]\s*([\s\S]*?)(?=(?:\s*(?:Câu|Bài|Question|Q|Câuy|câu)\s*[1-9]\d*[\.\:\-\)\,\s])|$)/gi
      let matches = [...rawText.matchAll(regexPattern)]
      
      if (matches.length === 0) {
        alert("Hệ thống không tìm thấy mốc phân tách dạng 'Câu X.' Hãy kiểm tra lại văn bản đầu vào.")
        return
      }

      const detectedTypes: Record<number, string> = {}
      const newQuestionEntries: Record<number, { text: string; options?: string[] }> = { ...section.questionEntries }
      const newDragDropOptions: Record<number, string[]> = { ...section.dragDropOptions }
      let computedTotalQuestions = matches.length

      matches.forEach(match => {
        const qNum = parseInt(match[1]) - 1
        let fullContent = match[2].trim()

        // 1. NHẬN DIỆN DẠNG BÀI KÉO THẢ: Có ký tự [___] hoặc ___
        if (fullContent.includes('[___]') || fullContent.includes('___')) {
          detectedTypes[qNum] = 'drag_drop'
          newQuestionEntries[qNum] = { text: fullContent }
          newDragDropOptions[qNum] = []
        }
        // 2. NHẬN DIỆN DẠNG BÀI ĐÚNG / SAI: Có các tiền tố dòng a), b), c), d)
        else if (/[a-d]\s*[\)\.\-]/i.test(fullContent) && (fullContent.match(/[a-d]\s*[\)\.\-]/gi) || []).length >= 2) {
          detectedTypes[qNum] = 'true_false'
          newQuestionEntries[qNum] = { text: fullContent }
        }
        // 3. NHẬN DIỆN DẠNG BÀI TRẮC NGHIỆM: Có chứa cấu trúc đáp án A. B. C. D.
        else if (/[A-D]\s*[\.\)\-]/.test(fullContent)) {
          detectedTypes[qNum] = 'single_choice'
          
          // Bóc tách câu hỏi và các phương án lựa chọn rời rạc
          const parts = fullContent.split(/(?=[A-D]\s*[\.\)\-])/g)
          const qText = parts[0]?.trim() || fullContent
          const options = parts.slice(1).map(opt => opt.replace(/^[A-D]\s*[\.\)\-]\s*/, '').trim())
          
          newQuestionEntries[qNum] = {
            text: qText,
            options: options.length > 0 ? options : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D']
          }
        }
        // 4. MẶC ĐỊNH: Chuyển về dạng trả lời ngắn
        else {
          detectedTypes[qNum] = 'short_answer'
          newQuestionEntries[qNum] = { text: fullContent }
        }
      })

      setExamStructure(prev => prev.map(s => {
        if (s.id === section.id) {
          const newRanges = []
          let currentRange: any = null

          for (let i = 0; i < computedTotalQuestions; i++) {
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
            questionCount: computedTotalQuestions, 
            mixedRanges: newRanges,
            questionEntries: newQuestionEntries,
            dragDropOptions: newDragDropOptions
          }
        }
        return s
      }))

      setAutoFillModalId(null)
      setAutoFillText('')
      alert(`🌟 Hệ thống thông minh đã cắt và ghép thành công ${computedTotalQuestions} câu hỏi tự động vào các ô tương tác!`)
    } catch (err: any) {
      alert('Lỗi bóc tách cấu trúc đề: ' + err.message)
    }
  }

  // 🌟 THUẬT TOÁN "HỘP ĐÁP ÁN THẦN TỐC": ĐỒNG BỘ ĐÁP ÁN SAU KHI ĐỀ ĐÃ ĐƯỢC TẠO 🌟
  const handleProcessQuickAnswers = () => {
    if (!quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    const rawAnswers = quickAnswersText.trim()
    const updatedAnswers = { ...section.correctAnswers }

    try {
      // Biểu thức bóc nhóm đáp án (Ví dụ: 1.A, Câu 2: B, 3-C, 4: D, 5: T/F/F/T hoặc Đ/S/Đ/S)
      const answerRegex = /(?:^|[\,\;\s\n])(?:Câu|Bài|Q)?\s*([1-9]\d*)[\.\:\-\)\s]*([A-D]|(?:[ĐS]\s*){4}|[^\,\;\n]+)/gi
      const matches = [...rawAnswers.matchAll(answerRegex)]

      if (matches.length === 0) {
        alert("Không nhận diện được mẫu đáp án. Hãy nhập định dạng rõ ràng như: 1.A, 2.B, 3.Đ S Đ S")
        return
      }

      matches.forEach(match => {
        const qIdx = parseInt(match[1]) - 1
        if (qIdx >= 0 && qIdx < section.questionCount) {
          let ansContent = match[2].trim().toUpperCase()

          // 1. Nếu là chuỗi Đúng Sai liên tiếp (Ví dụ: Đ S Đ S hoặc T F F T)
          if (/^([ĐSTSFC]|\s){4,7}$/.test(ansContent.replace(/[\s]/g, ''))) {
            const cleanArray = ansContent.replace(/[\s]/g, '').split('').map(char => {
              if (char === 'T' || char === 'Đ' || char === 'C') return 'Đ'
              return 'S'
            })
            updatedAnswers[qIdx] = {
              a: cleanArray[0] || 'Đ',
              b: cleanArray[1] || 'S',
              c: cleanArray[2] || 'Đ',
              d: cleanArray[3] || 'S'
            }
          } 
          // 2. Nếu là trắc nghiệm đơn hoặc điền số/từ khóa thường
          else {
            updatedAnswers[qIdx] = ansContent
          }
        }
      })

      setExamStructure(prev => prev.map(s => s.id === section.id ? { ...s, correctAnswers: updatedAnswers } : s))
      setQuickAnswersModalId(null)
      setQuickAnswersText('')
      alert("🌟 Đồng bộ hòm đáp án thần tốc thành công! Hệ thống đã điền tự động tương thích vào từng câu hỏi.")
    } catch (e: any) {
      alert("Lỗi xử lý bảng đáp án: " + e.message)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(URL.createObjectURL(selectedFile))
    }
  }

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || (creationMode === 'pdf_mode' && !file) || selectedSubjects.length === 0 || examStructure.length === 0) {
      setUploadStatus({ type: 'error', message: 'Vui lòng điền tên đề, chọn phân hệ môn học và cắt ghép cấu trúc câu hỏi đầy đủ.' })
      return
    }

    try {
      let driveFileId = null;

      if (creationMode === 'pdf_mode' && file) {
        setUploadStatus({ type: 'uploading', message: 'Đang tải tệp lên Google Drive...' })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', title)

        const response = await fetch('/api/upload-exam', { method: 'POST', body: formData })
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
           const result = await response.json();
           if (!response.ok) throw new Error(result.error || 'Lỗi lưu kho đám mây');
           driveFileId = result.driveFileId;
        } else {
           throw new Error(`Lỗi cổng kết nối Server Vercel (${response.status})`);
        }
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("Phiên đăng nhập hết hạn, vui lòng tải lại trang.")

      const generatedAccessCode = isHiddenExam ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
      const cleanExamStructure = examStructure.map(s => ({...s}))

      const { error: dbError } = await supabase.from('exams').insert({
        title, exam_type: examType, duration, allow_review: allowReview, max_attempts: maxAttempts, grading_method: gradingMethod, subjects: selectedSubjects, exam_structure: cleanExamStructure, drive_file_id: driveFileId, created_by: user.id,
        is_hidden: isHiddenExam,
        access_code: generatedAccessCode,
        require_proctoring: requireProctoring,
        creation_mode: creationMode
      })

      if (dbError) throw new Error(dbError.message)
      
      setUploadStatus({ type: 'success', message: 'Xuất bản đề thi số hóa thông minh tương tác thành công!' })
      setTitle(''); setFile(null); setPdfPreviewUrl(null); setSelectedSubjects([]); setExamStructure([]); setMaxAttempts(1); setGradingMethod('highest'); setIsHiddenExam(false); setRequireProctoring(false);
    } catch (error: any) {
      setUploadStatus({ type: 'error', message: error?.message || 'Có lỗi hệ thống nội bộ xảy ra.' })
    }
  }

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Xác nhận xóa vĩnh viễn đề thi này?')) return
    const { error } = await supabase.from('exams').delete().eq('id', examId)
    if (!error) setExamsList(examsList.filter(e => e.id !== examId))
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (currentUserRole !== 'admin') return alert('Chỉ có Admin tối cao mới được phân quyền!')
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

  const currentAvailableSubjects = SUBJECT_GROUPS[examType] || SUBJECT_GROUPS['THPTQG']
  const filteredExams = examsList.filter(e => manageFilter === 'Tất cả' || e.exam_type === manageFilter)
  const filteredSubmissions = submissionsList.filter(s => submissionFilter === 'Tất cả' || s.exams?.exam_type === submissionFilter)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-bold font-sans">Xác thực quyền quản trị...</div>

  if (selectedSubForGrading) {
    const pdfUrl = `https://drive.google.com/file/d/${selectedSubForGrading.exams?.drive_file_id}/preview`
    return (
      <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        <header className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedSubForGrading(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
            <div>
              <h1 className="font-extrabold text-sm md:text-base">Hội đồng chấm: {selectedSubForGrading.profiles?.full_name}</h1>
              <p className="text-xs text-slate-400 font-medium">Đề thi: {selectedSubForGrading.exams?.title}</p>
            </div>
          </div>
          <button onClick={handleSaveAssessment} disabled={isSavingGrade} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all disabled:bg-slate-400">
            <Save className="w-4 h-4"/> {isSavingGrade ? 'Đang chấm điểm...' : 'Hoàn tất & Phê duyệt điểm'}
          </button>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[45vh] md:h-full border-b md:border-b-0 md:border-r bg-slate-200 dark:bg-slate-800/20 relative">
            {selectedSubForGrading.exams?.drive_file_id ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-100 dark:bg-slate-950">
                <Sparkles className="w-12 h-12 mb-2 text-indigo-500 animate-pulse"/>
                <p className="font-extrabold text-sm">Đây là đề thi số hóa tương tác độc quyền</p>
                <p className="text-xs max-w-xs mt-1">Học sinh tương tác trực tiếp với các ô cắt ghép, không phụ thuộc PDF.</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[55vh] md:h-full bg-white dark:bg-slate-900 overflow-y-auto p-6 space-y-6 custom-scrollbar shrink-0">
            <div className="text-base font-black text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b dark:border-slate-800 pb-3"><PenTool className="w-5 h-5"/> Giao diện kiểm định bài làm</div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Nhận xét tổng quát của giáo viên:</label>
              <textarea value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)} placeholder="Nhập lời phê tổng quan..." className="w-full min-h-[80px] p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium text-xs outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="space-y-6">
              {selectedSubForGrading.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-700">
                  <div className="flex justify-between items-end mb-4 border-b dark:border-slate-800 pb-2">
                    <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">● {section.name}</h3>
                    <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded">
                      {section.scoringMode === 'custom' ? 'Điểm tùy chỉnh' : `Tổng: ${section.sectionTotalPoints}đ`}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const studentAnswer = selectedSubForGrading.answers?.[key]
                      const correctAnswer = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                      
                      let currentType = section.type;
                      if (section.type === 'mixed' && section.mixedRanges) {
                        const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                        currentType = range ? range.type : 'short_answer'
                      }

                      return (
                        <div key={qIdx} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-slate-500">Câu hỏi {qIdx + 1}:</span>
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
                                className="w-16 p-1 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded font-black text-center text-xs outline-none text-blue-600 dark:text-blue-400 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="text-xs font-medium space-y-1 mt-1 font-sans">
                            {section.questionEntries?.[qIdx]?.text && (
                              <p className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg text-slate-600 dark:text-slate-400 mb-1 border font-bold">Đề: {section.questionEntries[qIdx].text}</p>
                            )}
                            <p><span className="text-slate-400">Thí sinh điền/tô:</span> <span className="font-bold text-blue-600 dark:text-blue-400">{studentAnswer(studentAnswer, currentType)}</span></p>
                            {currentType !== 'essay' && (
                              <p><span className="text-slate-400">Đáp án gốc:</span> <span className="font-bold text-emerald-600">
                                {typeof correctAnswer === 'object' && !Array.isArray(correctAnswer) ? studentAnswer(correctAnswer, 'true_false') : JSON.stringify(correctAnswer)}
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
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative font-sans overflow-x-hidden">
      
      {/* 🌟 CỬA SỔ 1: SEN MAGIC PASTE - NHẬN DIỆN VÀ CẮT GHÉP ĐỀ TỰ ĐỘNG CHUẨN AZOTA NÂNG CẤP */}
      {autoFillModalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button onClick={() => setAutoFillModalId(null)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center shadow-inner border border-blue-200 dark:border-blue-800">
                <Wand2 className="w-6 h-6 text-blue-500 drop-shadow-sm"/>
              </div>
              <div>
                <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">Bộ Cắt Ghép Đề Số Hóa Tự Động</h2>
                <p className="text-sm font-medium text-slate-500">Dán toàn bộ nội dung text của đề, hệ thống tự động băm nhỏ câu và phân loại ô trống.</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <textarea 
                value={autoFillText} 
                onChange={(e) => setAutoFillText(e.target.value)} 
                placeholder="Dán toàn bộ nội dung file đề bài thô tại đây (Ví dụ: Câu 1. ... Câu 2. ...)" 
                className="w-full h-48 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 custom-scrollbar shadow-inner"
              />
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
                  <UploadCloud className="w-4 h-4"/> Tải tệp văn bản đề (.txt) lên
                  <input type="file" accept=".txt,.tex" onChange={handleAnswerFileRead} className="hidden" />
                </label>
              </div>
            </div>

            <button onClick={handleProcessAutoFill} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Sparkle className="w-4 h-4"/> Tiến hành băm tách & Tạo ô tương tác
            </button>
          </div>
        </div>
      )}

      {/* 🌟 CỬA SỔ 2: HỘP ĐÁP ÁN THẦN TỐC (PASTE SAU KHI ĐỀ ĐÃ ĐƯỢC TẠO) */}
      {quickAnswersModalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button onClick={() => setQuickAnswersModalId(null)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center shadow-inner border border-amber-200 dark:border-amber-800">
                <Check className="w-6 h-6 text-amber-500 drop-shadow-sm"/>
              </div>
              <div>
                <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">Hộp Đáp Án Thần Tốc</h2>
                <p className="text-sm font-medium text-slate-500">Dán chuỗi đáp án thô vào đây để hệ thống tự động điền vào các ô trống đã tạo.</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 p-3.5 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-200/30">
                <span className="font-bold">Mẫu nhập đa dạng đáp án (Hệ thống tự động lọc dấu phẩy/chấm nhiễu):</span><br/>
                <code>{'1.A, 2.B, 3-C, 4: Đ S Đ S, 5: 14,5'}</code>
              </div>
              <textarea 
                value={quickAnswersText} 
                onChange={(e) => setQuickAnswersText(e.target.value)} 
                placeholder="Dán chuỗi đáp án thô tại đây..." 
                className="w-full h-32 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              />
            </div>

            <button onClick={handleProcessQuickAnswers} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4"/> Khớp đáp án thần tốc
            </button>
          </div>
        </div>
      )}

      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col hidden md:flex shrink-0">
        <h1 className="text-2xl font-black text-blue-600 dark:text-blue-500 mb-8">SenExam Admin</h1>
        <nav className="flex-grow space-y-1">
          <button onClick={() => setActiveTab('upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${activeTab === 'upload' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><PlusCircle className="w-5 h-5" /> Đăng đề thi mới</button>
          <button onClick={() => setActiveTab('manage')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${activeTab === 'manage' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><FileText className="w-5 h-5" /> Quản lý kho đề</button>
          <button onClick={() => setActiveTab('submissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${activeTab === 'submissions' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><ClipboardList className="w-5 h-5" /> Quản lý bài nộp</button>
          <button onClick={() => setActiveTab('collab')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${activeTab === 'collab' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Users className="w-5 h-5" /> Cài đặt Collab</button>
          <button onClick={() => router.push('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 mt-4"><LayoutDashboard className="w-5 h-5" /> Về trang Dashboard</button>
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-colors mt-auto"><LogOut className="w-5 h-5" /> Đăng xuất</button>
      </div>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          {/* TAB 1: UPLOAD ĐỀ THI */}
          {activeTab === 'upload' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold mb-2">Trình Tạo Đề Thi Đa Phương Thức</h2>
                <p className="text-slate-500 font-medium">Linh hoạt giữa upload PDF truyền thống hoặc biên soạn Hệ thống Tương Tác Số Hóa Azota nâng cấp.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-100 dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setCreationMode('pdf_mode')}
                  className={`py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${creationMode === 'pdf_mode' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <FileText className="w-4 h-4"/> Bản gốc PDF (Iframe hiển thị)
                </button>
                <button 
                  type="button" 
                  onClick={() => setCreationMode('interactive_mode')}
                  className={`py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${creationMode === 'interactive_mode' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Sparkle className="w-4 h-4"/> Số hóa tương tác cắt ghép ô trống (Style Azota)
                </button>
              </div>

              <form onSubmit={handleUploadExam} className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-lg"><BookOpen className="w-6 h-6"/> Thông tin chung</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold mb-2">Tiêu đề đề thi (*)</label>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Loại hình kỳ thi</label>
                      <select 
                        value={examType} 
                        onChange={(e) => {
                          setExamType(e.target.value)
                          setSelectedSubjects([]) 
                        }} 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none"
                      >
                        {EXAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Thời gian làm bài (Phút)</label>
                      <input type="number" min="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-xs font-bold mb-2">Số lần làm bài tối đa (0: Không giới hạn)</label>
                      <input type="number" min="0" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2">Phương thức tính điểm xếp hạng</label>
                      <select value={gradingMethod} onChange={(e) => setGradingMethod(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold">
                        <option value="highest">Lấy điểm số cao nhất</option>
                        <option value="last">Lấy điểm lượt làm cuối cùng</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between border dark:border-slate-700">
                    <div>
                      <p className="text-sm font-bold">Cho phép học sinh coi lại bài làm sau khi nộp</p>
                    </div>
                    <input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between border dark:border-slate-700 mt-4">
                    <div>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">Phát hành ở chế độ Đề thi Ẩn (Private Exam)</p>
                      <p className="text-xs text-slate-500">Chỉ học sinh được cung cấp mã truy cập (Access Code) mới được phép vào thi.</p>
                    </div>
                    <input type="checkbox" checked={isHiddenExam} onChange={(e) => setIsHiddenExam(e.target.checked)} className="w-5 h-5 accent-red-600 cursor-pointer" />
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl flex items-center justify-between border border-purple-200 dark:border-purple-800/30 mt-4">
                    <div>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5"><Camera className="w-4 h-4"/> Giám thị ảo (Camera AI)</p>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">Yêu cầu bật Camera khi thi. Hệ thống tự động phát hiện học sinh dùng điện thoại hoặc rời khỏi khung hình.</p>
                    </div>
                    <input type="checkbox" checked={requireProctoring} onChange={(e) => setRequireProctoring(e.target.checked)} className="w-5 h-5 accent-purple-600 cursor-pointer" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">Phân vùng Cấu trúc môn học (*)</label>
                    <div className="flex flex-wrap gap-2">
                      {currentAvailableSubjects.map(sub => (
                        <button type="button" key={sub} onClick={() => toggleSubject(sub)} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedSubjects.includes(sub) ? 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-500 dark:text-emerald-300' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{sub}</button>
                      ))}
                    </div>
                  </div>

                  {creationMode === 'pdf_mode' && (
                    <div>
                      <label className="block text-sm font-bold mb-2">Tệp đề thi gốc PDF (*)</label>
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center relative cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{file ? file.name : 'Nhấn chọn hoặc kéo thả tệp đề thi PDF vào đây'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex flex-col ${pdfPreviewUrl && creationMode === 'pdf_mode' ? 'xl:flex-row' : ''} gap-6 items-start`}>
                  
                  {pdfPreviewUrl && creationMode === 'pdf_mode' && (
                    <div className="w-full xl:w-5/12 shrink-0 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[750px] sticky top-6">
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Eye className="w-4 h-4"/> Bản xem trước PDF
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">LIVE PREVIEW</span>
                        </div>
                      </div>
                      <iframe src={pdfPreviewUrl} className="w-full h-full border-none bg-slate-200 dark:bg-slate-800/20"></iframe>
                    </div>
                  )}

                  <div className={`w-full ${pdfPreviewUrl && creationMode === 'pdf_mode' ? 'xl:w-7/12' : 'w-full'} bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6`}>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="text-orange-600 dark:text-orange-400 font-bold text-lg flex items-center gap-2"><Layers className="w-6 h-6"/>Cấu trúc phiếu trả lời và ô tương tác bóc tách</div>
                      <button type="button" onClick={addSection} className="text-sm bg-orange-100 text-orange-700 dark:bg-orange-900/40 px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-orange-200 transition-colors"><PlusCircle className="w-4 h-4"/> Tạo phân hệ Hỗn Hợp VIP</button>
                    </div>

                    <div className="space-y-6">
                      {examStructure.length === 0 && (
                        <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center">
                          <p className="text-sm font-bold text-slate-400">Chưa có cấu phần đề thi nào. Hãy nhấn nút "Tạo phân hệ Hỗn Hợp VIP" phía trên.</p>
                        </div>
                      )}
                      
                      {examStructure.map((section) => (
                        <div key={section.id} className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 relative">
                          <button type="button" onClick={() => removeSection(section.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                          
                          <div className="space-y-4 pr-6 mb-4">
                            <input type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)} className="font-bold bg-transparent border-b-2 border-slate-300 dark:border-slate-600 text-lg outline-none w-full md:w-1/2 pb-1 focus:border-blue-500" placeholder="Tên phần thi..." />
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div><label className="block text-xs font-bold text-slate-400 mb-1">Môn học</label><select value={section.subject} onChange={(e) => updateSection(section.id, 'subject', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"><option value="">-- Chọn môn --</option>{selectedSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Dạng câu hỏi chủ đạo</label>
                                <select value={section.type} onChange={(e) => updateSection(section.id, 'type', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold">
                                  <option value="mixed">Câu hỗn hợp số hóa đa năng (Kiểu Azota)</option>
                                  <option value="single_choice">Trắc nghiệm (1 đáp án)</option>
                                  <option value="multiple_choice">Trắc nghiệm (Nhiều đáp án)</option>
                                  <option value="true_false">Đúng / Sai (4 Ý bộ GD)</option>
                                  <option value="short_answer">Trả lời ngắn / Điền số</option>
                                  <option value="drag_drop">Kéo thả vào vùng trống [___]</option>
                                </select>
                              </div>
                              <div><label className="block text-xs font-bold text-slate-400 mb-1">Tổng số câu</label><input type="number" min="1" value={section.questionCount} onChange={(e) => updateSection(section.id, 'questionCount', parseInt(e.target.value) || 1)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold" /></div>
                              {(section.type === 'single_choice' || section.type === 'multiple_choice') && <div><label className="block text-xs font-bold text-slate-400 mb-1">Số lựa chọn</label><input type="number" min="2" value={section.optionsCount} onChange={(e) => updateSection(section.id, 'optionsCount', parseInt(e.target.value) || 4)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold" /></div>}
                            </div>
                          </div>

                          {section.type === 'mixed' && (
                            <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-3 mb-4">
                              <div className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-800/50 pb-2">
                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Phân vùng cấu trúc câu hỏi hỗn hợp tự động</p>
                                <button type="button" onClick={() => handleAddMixedRange(section.id)} className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-200 transition-colors">
                                  + Thêm vùng thủ công
                                </button>
                              </div>
                              
                              {section.mixedRanges?.map((range, rIdx) => (
                                <div key={rIdx} className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-bold text-slate-500">Từ câu</span>
                                  <input type="number" min="1" value={range.start} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'start', parseInt(e.target.value)||1)} className="w-16 p-1.5 text-xs font-bold border rounded-lg text-center dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"/>
                                  <span className="text-xs font-bold text-slate-500">đến</span>
                                  <input type="number" min="1" value={range.end} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'end', parseInt(e.target.value)||1)} className="w-16 p-1.5 text-xs font-bold border rounded-lg text-center dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"/>
                                  <select value={range.type} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'type', e.target.value)} className="flex-1 p-1.5 text-xs font-bold border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="single_choice">Trắc nghiệm (1 đáp án)</option>
                                    <option value="multiple_choice">Nhiều đáp án</option>
                                    <option value="true_false">Đúng / Sai (4 Ý)</option>
                                    <option value="short_answer">Trả lời ngắn / Điền số</option>
                                    <option value="drag_drop">Kéo thả [___]</option>
                                  </select>
                                  {(range.type === 'single_choice' || range.type === 'multiple_choice') && (
                                    <input type="number" min="2" value={range.optionsCount || 4} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'optionsCount', parseInt(e.target.value)||4)} placeholder="Số LC" className="w-16 p-1.5 text-xs font-bold border rounded-lg text-center dark:bg-slate-900 dark:border-slate-700"/>
                                  )}
                                  <button type="button" onClick={() => handleRemoveMixedRange(section.id, rIdx)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 dark:bg-red-900/20 rounded-lg"><X className="w-4 h-4"/></button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Chế độ tính điểm</label>
                                <select 
                                  value={section.scoringMode || 'auto_divide'} 
                                  onChange={(e) => updateSection(section.id, 'scoringMode', e.target.value)} 
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold"
                                >
                                  <option value="auto_divide">Chia đều tổng điểm</option>
                                  <option value="custom">Nhập điểm thủ công cho từng câu</option>
                                </select>
                              </div>
                              {section.scoringMode !== 'custom' && (
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tổng điểm phần này</label>
                                  <input 
                                    type="number" step="0.01" min="0" 
                                    value={section.sectionTotalPoints || 0} 
                                    onChange={(e) => updateSection(section.id, 'sectionTotalPoints', parseFloat(e.target.value) || 0)} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold" 
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setEditingKeysSectionId(editingKeysSectionId === section.id ? null : section.id)} className="text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:bg-blue-100 transition-colors"><KeyRound className="w-4 h-4"/> {editingKeysSectionId === section.id ? 'Thu gọn các ô câu hỏi' : 'Xem và Sửa các ô cắt ghép câu hỏi'}</button>
                            
                            <button type="button" onClick={() => setAutoFillModalId(section.id)} className="text-xs font-bold bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10">
                              <FileInput className="w-4 h-4"/> 1. Quét & Cắt ghép đề thô tự động (Azota Style)
                            </button>

                            {section.questionCount > 0 && (
                              <button type="button" onClick={() => setQuickAnswersModalId(section.id)} className="text-xs font-bold bg-amber-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 hover:bg-amber-600 transition-all shadow-md shadow-amber-500/10">
                                <Sparkles className="w-4 h-4"/> 2. Paste chuỗi đáp án thần tốc
                              </button>
                            )}
                          </div>

                          {editingKeysSectionId === section.id && (
                            <div className="mt-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                              {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                                let currentType = section.type;
                                let currentOptionsCount = section.optionsCount || 4;
                                
                                if (section.type === 'mixed' && section.mixedRanges) {
                                  const range = section.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                                  if (range) {
                                    currentType = range.type
                                    currentOptionsCount = range.optionsCount || 4
                                  } else {
                                    currentType = 'short_answer'
                                  }
                                }

                                return (
                                  <div key={qIdx} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-md">Câu {qIdx + 1} ({currentType === 'single_choice' ? 'Trắc nghiệm' : currentType === 'true_false' ? 'Đúng/Sai' : currentType === 'drag_drop' ? 'Kéo thả' : 'Trả lời ngắn'})</span>
                                      {section.scoringMode === 'custom' && (
                                        <input 
                                          type="number" step="0.01" min="0" 
                                          value={section.customPoints?.[qIdx] !== undefined ? section.customPoints[qIdx] : ''} 
                                          onChange={(e) => {
                                            const newCustomPoints = { ...(section.customPoints || {}) };
                                            newCustomPoints[qIdx] = parseFloat(e.target.value) || 0;
                                            updateSection(section.id, 'customPoints', newCustomPoints);
                                          }} 
                                          placeholder="Điểm" 
                                          className="w-16 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 outline-none text-xs font-bold text-center text-blue-600 dark:bg-slate-900" 
                                        />
                                      )}
                                    </div>

                                    {/* THÀNH PHẦN Ô CHỨA NỘI DUNG ĐỀ BÀI CẮT LÁT */}
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Nội dung câu hỏi</label>
                                      <textarea 
                                        value={section.questionEntries?.[qIdx]?.text || ''} 
                                        onChange={(e) => {
                                          const newEntries = { ...(section.questionEntries || {}) }
                                          newEntries[qIdx] = { ...(newEntries[qIdx] || { text: '' }), text: e.target.value }
                                          updateSection(section.id, 'questionEntries', newEntries)
                                        }}
                                        placeholder="Nội dung văn bản câu hỏi..."
                                        className="w-full p-2.5 bg-white dark:bg-slate-900 border text-xs font-bold rounded-xl outline-none focus:border-blue-500"
                                        rows={3}
                                      />
                                    </div>

                                    {/* Ô CHỨA CÁC ĐÁP ÁN ĐÃ GHÉP */}
                                    <div className="flex flex-col gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border">
                                      <span className="text-[10px] font-black text-slate-400 uppercase">Đáp án cấu hình ô trống:</span>
                                      
                                      {currentType === 'single_choice' && (
                                        <div className="flex gap-2">
                                          {Array.from({ length: currentOptionsCount }).map((_, oIdx) => { 
                                            const label = String.fromCharCode(65 + oIdx); 
                                            return (
                                              <button type="button" key={label} onClick={() => handleSetCorrectAnswer(section.id, qIdx, label)} className={`w-8 h-8 rounded-full border text-xs font-black transition-all ${section.correctAnswers[qIdx] === label ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                {label}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}

                                      {currentType === 'true_false' && (
                                        <div className="space-y-1.5">
                                          {['a', 'b', 'c', 'd'].map(subLabel => {
                                            const curVal = section.correctAnswers[qIdx]?.[subLabel];
                                            return (
                                              <div key={subLabel} className="flex items-center gap-3 text-xs font-bold">
                                                <span className="text-slate-400 uppercase w-8">Ý {subLabel}:</span>
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, subLabel, 'Đ')} className={`px-3 py-1 rounded-md border text-[10px] font-black ${curVal === 'Đ' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Đúng</button>
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, subLabel, 'S')} className={`px-3 py-1 rounded-md border text-[10px] font-black ${curVal === 'S' ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Sai</button>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}

                                      {(currentType === 'short_answer' || currentType === 'drag_drop') && (
                                        <input 
                                          type="text" 
                                          value={section.correctAnswers[qIdx] || ''} 
                                          onChange={(e) => handleSetCorrectAnswer(section.id, qIdx, e.target.value)} 
                                          placeholder={currentType === 'drag_drop' ? "Nhập từ khóa chính xác để học sinh kéo thả..." : "Nhập đáp án số hoặc từ khóa ngắn..."} 
                                          className="border rounded-xl px-3 py-2 w-full dark:bg-slate-900 outline-none focus:border-blue-500 text-xs font-bold" 
                                        />
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
                </div>

                {uploadStatus.type !== 'idle' && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 font-bold text-sm ${uploadStatus.type === 'uploading' ? 'bg-blue-100 text-blue-800' : uploadStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {uploadStatus.message}
                  </div>
                )}

                <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black py-4 rounded-xl shadow-lg text-lg transition-transform active:scale-[0.99]">{uploadStatus.type === 'uploading' ? 'Đang đóng gói dữ liệu...' : 'Xuất bản đề thi tương tác số hóa'}</button>
              </form>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ KHO ĐỀ */}
          {activeTab === 'manage' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Quản lý Kho đề thi</h2>
                  <p className="text-slate-500 font-medium mt-1">Danh sách toàn bộ đề thi đang có mặt trên hệ thống SenExam.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border p-2 rounded-xl shadow-sm">
                  <Filter className="w-4 h-4 text-slate-400 ml-1" />
                  <select value={manageFilter} onChange={(e) => setManageFilter(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer">
                    <option value="Tất cả">Tất cả Kỳ thi</option>
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border overflow-hidden shadow-sm overflow-x-auto">
                {isFetchingData ? <div className="p-10 text-center text-slate-500 font-bold">Đang tải dữ liệu...</div> : filteredExams.length === 0 ? <div className="p-10 text-center text-slate-500 font-bold">Chưa có đề thi nào phù hợp.</div> : (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b"><th className="p-4 font-bold text-xs text-slate-400">TÊN ĐỀ THI</th><th className="p-4 font-bold text-xs text-slate-400">MÔN HỌC</th><th className="p-4 font-bold text-xs text-slate-400">KỲ THI / KIỂU ĐỀ</th><th className="p-4 font-bold text-xs text-slate-400 text-right">THAO TÁC</th></tr>
                    </thead>
                    <tbody>
                      {filteredExams.map((exam) => (
                        <tr key={exam.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 font-bold max-w-xs truncate">
                            {exam.title}
                            {exam.is_hidden && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-lg">Mã ẩn: {exam.access_code}</span>}
                          </td>
                          <td className="p-4"><div className="flex flex-wrap gap-1">{exam.subjects?.map((s: string) => <span key={s} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-bold border">{s}</span>)}</div></td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">{exam.exam_type}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${exam.creation_mode === 'interactive_mode' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                {exam.creation_mode === 'interactive_mode' ? 'Cắt ghép số' : 'PDF Gốc'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 flex justify-end gap-2"><button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-red-500"><Trash2 className="w-5 h-5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUẢN LÝ BÀI NỘP */}
          {activeTab === 'submissions' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Danh Sách Bài Thi Đã Nộp</h2>
                  <p className="text-slate-500 font-medium mt-1">Hệ thống tự động đồng bộ kết quả thi của thí sinh trên toàn quốc.</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border p-2 rounded-xl shadow-sm">
                  <Filter className="w-4 h-4 text-slate-400 ml-1" />
                  <select value={submissionFilter} onChange={(e) => setSubmissionFilter(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer">
                    <option value="Tất cả">Tất cả bài làm</option>
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border overflow-hidden shadow-sm overflow-x-auto">
                {isFetchingData ? <div className="p-10 text-center font-bold text-slate-500">Đang tổng hợp dữ liệu bài làm...</div> : filteredSubmissions.length === 0 ? <div className="p-10 text-center font-bold text-slate-500">Chưa có bài nộp nào phù hợp.</div> : (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b"><th className="p-4 font-bold text-xs text-slate-400">THÍ SINH</th><th className="p-4 font-bold text-xs text-slate-400">TIÊU ĐỀ ĐỀ THI</th><th className="p-4 font-bold text-xs text-slate-400">THỜI GIAN NỘP</th><th className="p-4 font-bold text-xs text-slate-400">TRẠNG THÁI / ĐIỂM SỐ</th><th className="p-4 font-bold text-xs text-slate-400 text-right">HÀNH ĐỘNG</th></tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((sub) => {
                        const hasEssay = sub.exams?.exam_structure?.some((s: any) => s.type === 'essay')
                        return (
                          <tr key={sub.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="p-4"><p className="font-bold">{sub.profiles?.full_name || 'Ẩn danh'}</p><p className="text-xs text-slate-400">{sub.profiles?.school}</p></td>
                            <td className="p-4 font-bold max-w-xs truncate">{sub.exams?.title}</td>
                            <td className="p-4 text-sm text-slate-500">{new Date(sub.created_at).toLocaleString('vi-VN')}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-lg text-sm font-black ${sub.is_graded ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>{sub.score !== null ? `${sub.score}` : 'Chờ chấm'}</span>
                                <span className="text-xs text-slate-400 font-bold">{!hasEssay ? 'Trắc nghiệm' : 'Có tự luận'}</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <button onClick={() => openGradingView(sub)} className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all">
                                <Eye className="w-3.5 h-3.5"/> Tiến hành chấm bài
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PHÂN QUYỀN COLLAB */}
          {activeTab === 'collab' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-10"><h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Hệ thống Phân quyền người dùng</h2><p className="text-slate-500 font-medium">Bổ nhiệm Cộng tác viên (Collab) đăng đề thi và phê duyệt dữ liệu hệ thống.</p></div>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border overflow-hidden shadow-sm overflow-x-auto">
                {isFetchingData ? <div className="p-10 text-center font-bold text-slate-500">Đang tải dữ liệu danh sách...</div> : (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b"><th className="p-4 font-bold text-xs text-slate-400">HỌ VÀ TÊN</th><th className="p-4 font-bold text-xs text-slate-400">TRƯỜNG / KHU VỰC</th><th className="p-4 font-bold text-xs text-slate-400">CHỨC VỤ</th><th className="p-4 font-bold text-xs text-slate-400 text-right">ỦY QUYỀN HẠN</th></tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 font-bold flex items-center gap-2">{u.full_name || 'Chưa lập hồ sơ'}
                            {u.role === 'admin' && <span title="Admin Tối Cao"><ShieldAlert className="w-4 h-4 text-red-500" /></span>}
                            {u.role === 'premium_student' && <span title="Học Sinh Premium"><Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" /></span>}
                          </td>
                          <td className="p-4 text-sm text-slate-500">{u.school || '---'}<br/><span className="text-xs opacity-70">{u.province}</span></td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                              u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 
                              u.role === 'collab' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : 
                              u.role === 'premium_student' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {u.role === 'premium_student' ? 'Premium' : (u.role || 'student')}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {currentUserRole === 'admin' && u.role !== 'admin' && (
                              <select value={u.role || 'student'} onChange={(e) => handleUpdateRole(u.id, e.target.value)} className="bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-colors">
                                <option value="student">Học sinh</option>
                                <option value="premium_student">Học sinh Premium</option>
                                <option value="collab">Cộng tác viên (Collab)</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}