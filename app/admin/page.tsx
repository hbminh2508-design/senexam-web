'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { 
  UploadCloud, FileText, Users, LogOut, PlusCircle, 
  Trash2, Layers, X, ClipboardList, 
  KeyRound, Filter, Eye, Save, ArrowLeft, PenTool, LayoutDashboard,
  Sparkles, Bell, AlertCircle, Loader2, FileInput, Sun, Moon, Clipboard,
  Bot, Send, Code, Play, CheckCircle2, Database, Shuffle, Home, Image as ImageIcon
} from 'lucide-react'

// 🌟 THƯ VIỆN RENDER MARKDOWN & CÔNG THỨC TOÁN HỌC
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học', subs: ['Toán', 'Vật lí', 'Hóa học'] },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh', subs: ['Toán', 'Vật lí', 'Tiếng Anh'] },
  { code: 'A02', name: 'Toán, Vật lí, Sinh học', subs: ['Toán', 'Vật lí', 'Sinh học'] },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học', subs: ['Toán', 'Hóa học', 'Sinh học'] },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí', subs: ['Ngữ văn', 'Lịch sử', 'Địa lí'] },
  { code: 'C01', name: 'Ngữ văn, Toán, Vật lí', subs: ['Ngữ văn', 'Toán', 'Vật lí'] },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh', subs: ['Ngữ văn', 'Toán', 'Tiếng Anh'] },
  { code: 'D07', name: 'Toán, Hóa học, Tiếng Anh', subs: ['Toán', 'Hóa học', 'Tiếng Anh'] },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)', subs: ['Tư duy Định lượng', 'Tư duy Định tính', 'Khoa học'] },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)', subs: ['Toán học', 'Đọc hiểu', 'Khoa học giải quyết vấn đề'] },
  { code: 'Khác', name: 'Tổ hợp môn tự chọn', subs: ['Môn 1', 'Môn 2', 'Môn 3'] }
]

type MixedRange = { start: number; end: number; type: string; optionsCount: number }

interface SysNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
}

type ChatFile = { url: string; base64: string; mimeType: string; isPdf: boolean; name: string }
type ChatMessage = {
  role: 'user' | 'model'
  text: string
  files?: ChatFile[]
  codeSnippet?: string 
}

type BankQuestion = {
  id: string;
  type: string; 
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  options?: string[];
  answer?: any;
  created_at: number;
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  
  // 🌟 TABS QUẢN TRỊ
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'senai' | 'bank' | 'manage' | 'submissions' | 'collab'>('overview')

  // 🌟 THỐNG KÊ TỔNG QUAN
  const [overviewStats, setOverviewStats] = useState<{ examCount: number; userCount: number; submissionCount: number; pendingGradeCount: number } | null>(null)
  const [overviewRecent, setOverviewRecent] = useState<any[]>([])
  const [isFetchingOverview, setIsFetchingOverview] = useState(false)

  // 🌟 CHỌN HÀNG LOẠT (BULK ACTIONS) CHO KHO ĐỀ
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([])

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

  // -- States Tạo đề Truyền thống --
  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('THPTQG')
  const [duration, setDuration] = useState<number>(50)
  const [allowReview, setAllowReview] = useState<boolean>(true)
  const [maxAttempts, setMaxAttempts] = useState<number>(1)
  const [gradingMethod, setGradingMethod] = useState<string>('highest')
  const [selectedBlock, setSelectedBlock] = useState(EXAM_BLOCKS[0].code)
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const toggleSubject = (sub: string) => {
    setSelectedSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])
  }

  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error'; message: string}>({ type: 'idle', message: '' })

  const [editingKeysSectionId, setEditingKeysSectionId] = useState<string | null>(null)
  const [isHiddenExam, setIsHiddenExam] = useState(false)
  const [requireProctoring, setRequireProctoring] = useState(false)

  const [autoFillModalId, setAutoFillModalId] = useState<string | null>(null)
  const [parseTextModalId, setParseTextModalId] = useState<string | null>(null)
  const [examTextToParse, setExamTextToParse] = useState('')
  
  const [notifications, setNotifications] = useState<SysNotification[]>([
    { id: '1', title: 'Hệ thống sẵn sàng', message: 'Bộ lọc nhận diện số câu thông minh Zero-Regret đã được nạp.', type: 'success', time: 'Vừa xong', read: false }
  ])
  const [showNotificationBox, setShowNotificationBox] = useState(false)

  const [quickAnswersModalId, setQuickAnswersModalId] = useState<string | null>(null)
  const [answerMethod, setAnswerMethod] = useState<'text' | 'pdf'>('text')
  const [quickAnswersText, setQuickAnswersText] = useState('')
  const [isParsingAnswerPdf, setIsParsingAnswerPdf] = useState(false)

  const [examStructure, setExamStructure] = useState<{
    id: string; type: string; name: string; subject: string; questionCount: number; optionsCount?: number; correctAnswers: Record<number, any>; scoringMode: 'auto_divide' | 'custom'; sectionTotalPoints: number; customPoints: Record<number, number>; mixedRanges?: MixedRange[]; questionEntries?: Record<number, { text: string; options?: string[] }>
  }[]>([])

  // 🌟 STATES CHO TAB LÀM ĐỀ SENAI GENERATOR
  const [aiChatInput, setAiChatInput] = useState('')
  const [aiSelectedFiles, setAiSelectedFiles] = useState<ChatFile[]>([])
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([{ 
    role: 'model', 
    text: 'Chào Sếp! Gửi đề thi (Text/Ảnh/PDF) vào đây, em sẽ bóc tách thành JSON Mã Code. Hoặc Sếp có thể dùng tính năng Random từ Ngân hàng đề nhé!' 
  }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiPreviewMode, setAiPreviewMode] = useState<'preview' | 'code'>('preview')
  const [currentGeneratedCode, setCurrentGeneratedCode] = useState<string | null>(null)
  
  const [randomConfig, setRandomConfig] = useState({ single_choice: 10, true_false: 0, short_answer: 0 })

  const aiFileInputRef = useRef<HTMLInputElement | null>(null)
  const aiChatScrollRef = useRef<HTMLDivElement>(null)

  // 🌟 STATES CHO TAB NGÂN HÀNG ĐỀ THI
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]) 
  const [bankAiInput, setBankAiInput] = useState('')
  const [bankSelectedFiles, setBankSelectedFiles] = useState<ChatFile[]>([])
  const [bankMessages, setBankMessages] = useState<ChatMessage[]>([{
    role: 'model',
    text: 'Khu vực bóc tách câu hỏi lẻ. Sếp tải ảnh hoặc PDF đề thi lên, em sẽ tự động chặt nhỏ thành từng câu, lược bỏ số thứ tự, nhận diện độ khó và lưu vào Kho Ngân Hàng Đề bên phải nhé!'
  }])
  const [isBankAiLoading, setIsBankAiLoading] = useState(false)
  const bankFileInputRef = useRef<HTMLInputElement | null>(null)
  const bankChatScrollRef = useRef<HTMLDivElement>(null)

  const currentBlockData = useMemo(() => EXAM_BLOCKS.find(b => b.code === selectedBlock) || EXAM_BLOCKS[0], [selectedBlock])

  // Theo dõi chế độ màu
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
      id: Date.now().toString(), title, message, type, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), read: false
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
      setSelectedExamIds([])
      if (activeTab === 'manage') {
        const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
        setExamsList(data || [])
      } else if (activeTab === 'collab') {
        const { data } = await supabase.from('profiles').select('*').order('full_name')
        setUsersList(data || [])
      } else if (activeTab === 'submissions') {
        await refreshSubmissionsList()
      } else if (activeTab === 'overview') {
        await fetchOverviewStats()
      }
      setIsFetchingData(false)
    }
    fetchData()
  }, [activeTab, isAdmin])

  const fetchOverviewStats = async () => {
    setIsFetchingOverview(true)
    try {
      const [examsCountRes, usersCountRes, subsCountRes, pendingRes, recentSubsRes] = await Promise.all([
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('is_graded', false),
        supabase.from('submissions').select('*, profiles:user_id (full_name), exams:exam_id (title, exam_type)').order('created_at', { ascending: false }).limit(8),
      ])
      setOverviewStats({
        examCount: examsCountRes.count || 0,
        userCount: usersCountRes.count || 0,
        submissionCount: subsCountRes.count || 0,
        pendingGradeCount: pendingRes.count || 0,
      })
      setOverviewRecent(recentSubsRes.data || [])
    } catch (e) {
      // Bỏ qua lỗi thống kê, không chặn các tab quản trị khác
    }
    setIsFetchingOverview(false)
  }

  const toggleExamSelection = (id: string) => {
    setSelectedExamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAllExams = () => {
    setSelectedExamIds(prev => prev.length === filteredExams.length ? [] : filteredExams.map((e: any) => e.id))
  }

  const handleBulkDeleteExams = async () => {
    if (selectedExamIds.length === 0) return
    if (!confirm(`Xóa vĩnh viễn ${selectedExamIds.length} đề thi đã chọn khỏi kho lưu trữ?`)) return
    const { error } = await supabase.from('exams').delete().in('id', selectedExamIds)
    if (!error) {
      setExamsList(prev => prev.filter(e => !selectedExamIds.includes(e.id)))
      setSelectedExamIds([])
    } else {
      alert('Lỗi xóa hàng loạt: ' + error.message)
    }
  }

  // CÁC HÀM XỬ LÝ FORM TRUYỀN THỐNG
  const addSection = () => { setExamStructure([...examStructure, { id: Date.now().toString(), type: 'mixed', name: `Phần thi số ${examStructure.length + 1}`, subject: selectedSubjects[0] || currentBlockData.subs[0], questionCount: 0, optionsCount: 4, correctAnswers: {}, scoringMode: 'auto_divide', sectionTotalPoints: 10, customPoints: {}, mixedRanges: [], questionEntries: {} }]) }
  const removeSection = (id: string) => { setExamStructure(examStructure.filter(s => s.id !== id)); if (editingKeysSectionId === id) setEditingKeysSectionId(null) }
  const updateSection = (id: string, field: string, value: any) => { setExamStructure(examStructure.map(s => s.id === id ? { ...s, [field]: value } : s)) }
  const handleAddMixedRange = (sectionId: string) => { setExamStructure(examStructure.map(s => { if (s.id === sectionId) { const ranges = s.mixedRanges || []; const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : 0; return { ...s, mixedRanges: [...ranges, { start: lastEnd + 1, end: lastEnd + 5, type: 'single_choice', optionsCount: 4 }] } } return s })) }
  const handleUpdateMixedRange = (sectionId: string, rIdx: number, field: keyof MixedRange, value: any) => { setExamStructure(examStructure.map(s => { if (s.id === sectionId && s.mixedRanges) { const newRanges = [...s.mixedRanges]; newRanges[rIdx] = { ...newRanges[rIdx], [field]: value }; return { ...s, mixedRanges: newRanges } } return s })) }
  const handleRemoveMixedRange = (sectionId: string, rIdx: number) => { setExamStructure(examStructure.map(s => { if (s.id === sectionId && s.mixedRanges) { const newRanges = [...s.mixedRanges]; newRanges.splice(rIdx, 1); return { ...s, mixedRanges: newRanges } } return s })) }
  const handleSetCorrectAnswer = (sectionId: string, qIdx: number, value: any) => { setExamStructure(examStructure.map(s => { if (s.id === sectionId) { const updatedAnswers = { ...s.correctAnswers }; let cType = s.type; if (s.type === 'mixed' && s.mixedRanges) { const range = s.mixedRanges.find(r => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end); if (range) cType = range.type } if (cType === 'multiple_choice') { const currentArr = updatedAnswers[qIdx] || []; updatedAnswers[qIdx] = currentArr.includes(value) ? currentArr.filter((item: any) => item !== value) : [...currentArr, value].sort() } else { updatedAnswers[qIdx] = value } return { ...s, correctAnswers: updatedAnswers } } return s })) }
  const handleSetCorrectAnswerTF = (sectionId: string, qIdx: number, subLabel: string, value: string) => { setExamStructure(examStructure.map(s => { if (s.id === sectionId) { const updatedAnswers = { ...s.correctAnswers }; const currentObj = updatedAnswers[qIdx] || {}; currentObj[subLabel] = value; updatedAnswers[qIdx] = currentObj; return { ...s, correctAnswers: updatedAnswers } } return s })) }

  // 🌟 HÀM TẢI FILE CHUNG CHO AI CHAT
  const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<ChatFile[]>>, ref: React.RefObject<HTMLInputElement | null>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const isPdf = file.type === 'application/pdf'
      if (!isPdf && !file.type.startsWith('image/')) { alert('Chỉ hỗ trợ file PDF hoặc Hình ảnh.'); return }
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1]
        setter(prev => [...prev, { url: URL.createObjectURL(file), base64: base64Data, mimeType: file.type, isPdf, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
    if (ref.current) ref.current.value = ''
  }

  // 🌟 1. LÀM ĐỀ SENAI POWERED: CHAT & TẠO JSON
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!aiChatInput.trim() && aiSelectedFiles.length === 0) || isAiLoading) return

    const userText = aiChatInput.trim()
    const userFiles = [...aiSelectedFiles]
    setAiChatInput(''); setAiSelectedFiles([])
    
    const newHistory: ChatMessage[] = [...aiMessages, { role: 'user', text: userText, files: userFiles }]
    setAiMessages(newHistory)
    setIsAiLoading(true)

    setTimeout(() => { if (aiChatScrollRef.current) aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight }, 50)

    try {
      const systemContext = `Bạn là SenAI, hệ thống tạo đề thi chuyên nghiệp. 
      Người dùng sẽ gửi cho bạn nội dung đề thi (Text/Ảnh/PDF). Nhiệm vụ của bạn là bóc tách và tạo ra CẤU TRÚC JSON hợp lệ.
      
      Yêu cầu:
      - Tự động nhận diện loại câu hỏi (single_choice, true_false, short_answer, essay).
      - Mảng JSON trả về cần nằm trong khối \`\`\`json ... \`\`\`.
      - Cấu trúc JSON mẫu:
      [
        {
          "type": "single_choice",
          "text": "Câu 1: Hàm số nào sau đây liên tục?",
          "options": ["A. y=x", "B. y=1/x", "C. y=tan(x)", "D. Cả A và B"],
          "answer": "A"
        }
      ]`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userText, 
          history: aiMessages.map(m => ({ role: m.role, text: m.text })), 
          images: userFiles.map(f => ({ mimeType: f.mimeType, base64: f.base64 })),
          context: systemContext 
        }),
      })

      const data = await response.json()
      if (response.ok && data.text) {
        const jsonMatch = data.text.match(/```json([\s\S]*?)```/)
        const codeSnippet = jsonMatch ? jsonMatch[1].trim() : null
        
        if (codeSnippet) {
          setCurrentGeneratedCode(codeSnippet)
          setAiPreviewMode('preview') 
        }

        setAiMessages([...newHistory, { role: 'model', text: data.text.replace(/```json[\s\S]*?```/, '[Đã xuất mã JSON cấu trúc đề. Xem ở Panel bên phải]').trim(), codeSnippet }])
      } else { throw new Error('Lỗi AI') }
    } catch (error) {
      setAiMessages([...newHistory, { role: 'model', text: '⚠️ Mất kết nối tới SenAI Engine.' }])
    } finally {
      setIsAiLoading(false)
      setTimeout(() => { if (aiChatScrollRef.current) aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight }, 50)
    }
  }

  // 🌟 1.1 TẠO ĐỀ RANDOM TỪ NGÂN HÀNG (SenAI Powered Tab)
  const handleGenerateRandomFromBank = () => {
    if (bankQuestions.length === 0) {
      alert("Ngân hàng đề hiện đang trống. Hãy qua tab 'Ngân hàng đề thi' để nạp câu hỏi trước!")
      return
    }

    let selectedQuestions: BankQuestion[] = []
    
    // Lọc theo từng thể loại và bốc ngẫu nhiên
    const singles = bankQuestions.filter(q => q.type === 'single_choice').sort(() => 0.5 - Math.random()).slice(0, randomConfig.single_choice)
    const tfs = bankQuestions.filter(q => q.type === 'true_false').sort(() => 0.5 - Math.random()).slice(0, randomConfig.true_false)
    const shorts = bankQuestions.filter(q => q.type === 'short_answer').sort(() => 0.5 - Math.random()).slice(0, randomConfig.short_answer)
    
    selectedQuestions = [...singles, ...tfs, ...shorts]

    if (selectedQuestions.length === 0) {
      alert("Không đủ câu hỏi trong ngân hàng để trộn. Vui lòng kiểm tra lại cấu hình.")
      return
    }

    // Chuyển mảng BankQuestion thành chuẩn JSON Code Snippet
    const jsonOutput = selectedQuestions.map((q, idx) => {
      if (q.type === 'true_false') {
        return {
          type: q.type,
          text: `Câu ${idx + 1}: ${q.text}`,
          subQuestions: q.options ? q.options.map((opt, oIdx) => ({ label: String.fromCharCode(97 + oIdx), text: opt })) : [],
          answers: q.answer || {}
        }
      } else {
        return {
          type: q.type,
          text: `Câu ${idx + 1}: ${q.text}`,
          options: q.options,
          answer: q.answer
        }
      }
    })

    const codeStr = JSON.stringify(jsonOutput, null, 2)
    setCurrentGeneratedCode(codeStr)
    setAiPreviewMode('preview')
    addNotification("Trộn đề thành công", `Đã bốc ngẫu nhiên ${selectedQuestions.length} câu từ ngân hàng.`, "success")
  }

  // 🌟 2. NGÂN HÀNG ĐỀ THI: CHAT BÓC TÁCH CÂU HỎI
  const handleSendBankAiMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!bankAiInput.trim() && bankSelectedFiles.length === 0) || isBankAiLoading) return

    const userText = bankAiInput.trim()
    const userFiles = [...bankSelectedFiles]
    setBankAiInput(''); setBankSelectedFiles([])
    
    const newHistory: ChatMessage[] = [...bankMessages, { role: 'user', text: userText, files: userFiles }]
    setBankMessages(newHistory)
    setIsBankAiLoading(true)

    setTimeout(() => { if (bankChatScrollRef.current) bankChatScrollRef.current.scrollTop = bankChatScrollRef.current.scrollHeight }, 50)

    try {
      const systemContext = `Bạn là AI quản lý Ngân Hàng Đề Thi.
      Nhiệm vụ: Phân tích Text/Ảnh/PDF người dùng gửi, bóc tách ra các câu hỏi riêng biệt.
      YÊU CẦU BẮT BUỘC:
      1. KHÔNG chứa từ "Câu X:", "Bài Y:" ở đầu nội dung câu hỏi. Chỉ lấy phần text cốt lõi.
      2. Tự động đánh giá độ khó (difficulty): easy, medium, hard.
      3. Định dạng JSON trả về trong block \`\`\`json \`\`\`.
      Mẫu JSON:
      [
        {
          "type": "single_choice",
          "difficulty": "medium",
          "text": "Đạo hàm của hàm số y = sin(x) là gì?",
          "options": ["A. cos(x)", "B. -cos(x)", "C. tan(x)", "D. -sin(x)"],
          "answer": "A"
        }
      ]`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userText, 
          history: bankMessages.map(m => ({ role: m.role, text: m.text })), 
          images: userFiles.map(f => ({ mimeType: f.mimeType, base64: f.base64 })),
          context: systemContext 
        }),
      })

      const data = await response.json()
      if (response.ok && data.text) {
        const jsonMatch = data.text.match(/```json([\s\S]*?)```/)
        let extractedCount = 0

        if (jsonMatch) {
          try {
            const parsedQuestions = JSON.parse(jsonMatch[1].trim())
            if (Array.isArray(parsedQuestions)) {
              extractedCount = parsedQuestions.length
              const newBankQs = parsedQuestions.map(q => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                type: q.type || 'short_answer',
                difficulty: q.difficulty || 'medium',
                text: q.text || '',
                options: q.options,
                answer: q.answer,
                created_at: Date.now()
              }))
              setBankQuestions(prev => [...newBankQs, ...prev])
            }
          } catch(e) {}
        }

        setBankMessages([...newHistory, { role: 'model', text: data.text.replace(/```json[\s\S]*?```/, `[Đã bóc tách thành công ${extractedCount} câu hỏi và nạp vào Ngân Hàng Đề Thi.]`).trim() }])
      } else { throw new Error('Lỗi AI') }
    } catch (error) {
      setBankMessages([...newHistory, { role: 'model', text: '⚠️ Mất kết nối tới SenAI Engine.' }])
    } finally {
      setIsBankAiLoading(false)
      setTimeout(() => { if (bankChatScrollRef.current) bankChatScrollRef.current.scrollTop = bankChatScrollRef.current.scrollHeight }, 50)
    }
  }


  // Tiện ích hiển thị JSON an toàn trong Preview (Tab Làm Đề AI)
  const renderAiPreview = () => {
    if (!currentGeneratedCode) return <div className="text-slate-500 flex flex-col items-center justify-center h-full"><Bot className="w-12 h-12 mb-4 opacity-20"/>Chưa có dữ liệu Preview</div>
    try {
      const parsedData = JSON.parse(currentGeneratedCode)
      if (!Array.isArray(parsedData)) throw new Error("JSON phải là một mảng.")

      return (
        <div className="space-y-6">
          {parsedData.map((q: any, idx: number) => (
            <div key={idx} className="bg-slate-50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <h4 className="font-extrabold text-indigo-600 dark:text-indigo-400 mb-3">{q.text}</h4>
              
              {q.type === 'single_choice' && q.options && (
                <div className="space-y-2 ml-4">
                  {q.options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <div className={`w-4 h-4 rounded-full border border-slate-400 ${q.answer === opt.charAt(0) ? 'bg-indigo-500 border-indigo-500' : ''}`}></div>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'true_false' && q.subQuestions && (
                <div className="space-y-3 mt-4 border-t border-slate-200 dark:border-white/10 pt-4">
                  {q.subQuestions.map((sub: any, sIdx: number) => (
                    <div key={sIdx} className="flex items-center justify-between text-sm bg-white dark:bg-[#202020] p-3 rounded-xl border border-slate-200 dark:border-transparent">
                      <span className="text-slate-700 dark:text-slate-300"><span className="font-bold uppercase text-slate-500 mr-2">{sub.label}.</span> {sub.text}</span>
                      <div className="flex gap-1 font-black">
                        <span className={`px-2 py-1 rounded text-xs ${q.answers?.[sub.label] === 'Đ' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>Đ</span>
                        <span className={`px-2 py-1 rounded text-xs ${q.answers?.[sub.label] === 'S' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>S</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    } catch (e) {
      return <div className="text-rose-500 font-bold p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-900/50">Lỗi biên dịch JSON: Mẫu dữ liệu từ AI không chuẩn. Vui lòng yêu cầu AI sinh lại.</div>
    }
  }

  const filteredExams = examsList.filter(e => manageFilter === 'Tất cả' || e.exam_type === manageFilter)
  const filteredSubmissions = submissionsList.filter(s => submissionFilter === 'Tất cả' || s.exams?.exam_type === submissionFilter)
  
  const processRawTextToStructure = (rawText: string, sectionId: string) => {
    const questionRegex = /(?:(?:Câu|Bài|Q)\s+([1-9]\d*)[\.\:\-\)\s]*|([1-9]\d*)[\.\:\-\)]+(?!\d))/gi
    const matches = [...rawText.matchAll(questionRegex)]
    if (matches.length === 0) throw new Error("Không quét được từ khóa đánh dấu câu hỏi chuẩn.")

    const uniqueQuestions = new Map<number, number>()
    matches.forEach(m => {
      const num = parseInt(m[1] || m[2])
      uniqueQuestions.set(num, m.index || 0)
    })

    const sortedQuestions = [...uniqueQuestions.entries()].sort((a, b) => a[0] - b[0])
    const totalQuestionsFound = sortedQuestions.length
    let questionMaps: { qNum: number; detectedType: string }[] = []

    for (let i = 0; i < sortedQuestions.length; i++) {
      const [qNum, startIdx] = sortedQuestions[i]
      const nextQ = sortedQuestions[i + 1]
      const endIdx = nextQ ? nextQ[1] : rawText.length
      const questionSegment = rawText.substring(startIdx, endIdx)
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
      if (s.id === sectionId) {
        const generatedEntries: Record<number, { text: string }> = {}
        for (let i = 0; i < totalQuestionsFound; i++) {
          generatedEntries[i] = { text: `Câu hỏi tự động số ${i + 1}` }
        }
        return { ...s, type: 'mixed', questionCount: totalQuestionsFound, mixedRanges: dynamicRanges, questionEntries: generatedEntries }
      }
      return s
    }))

    return { totalQuestionsFound, totalRanges: dynamicRanges.length }
  }

  const handleProcessPdfTextParsing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || !autoFillModalId) return

    addNotification('Cấu trúc đề', 'Đang quét phân đoạn để định hình vùng...', 'info')
    setUploadStatus({ type: 'uploading', message: 'Hệ thống đang trích xuất luồng văn bản đề thi...' })

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

      const res = processRawTextToStructure(fullTextContent, autoFillModalId)
      setAutoFillModalId(null)
      setUploadStatus({ type: 'idle', message: '' })
      addNotification('Cấu trúc hoàn tất', `Thành công: ${res.totalRanges} phân vùng, ${res.totalQuestionsFound} câu.`, 'success')
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Lỗi bóc tách cấu trúc.' })
    }
  }

  const handleProcessRawTextParsingDirectly = () => {
    if (!parseTextModalId || !examTextToParse.trim()) return
    try {
      const res = processRawTextToStructure(examTextToParse, parseTextModalId)
      setParseTextModalId(null)
      setExamTextToParse('')
      addNotification('Cấu trúc hoàn tất', `Nạp văn bản thành công! ${res.totalRanges} vùng, ${res.totalQuestionsFound} câu.`, 'success')
    } catch (err: any) {
      alert("Lỗi phân rã văn bản dán vào: " + err.message)
    }
  }

  const parseAndApplyAnswersText = (rawText: string, section: any) => {
    const updatedAnswers = { ...section.correctAnswers }
    const globalRegex = /(?:(?:Câu|Bài|Q)\s+([1-9]\d*)[\.\:\-\)\s]*|([1-9]\d*)[\.\:\-\)]+(?!\d))\s*([\s\S]*?)(?=(?:(?:Câu|Bài|Q)\s+[1-9]\d*[\.\:\-\)\s]*|[1-9]\d*[\.\:\-\)]+(?!\d))|$)/gi
    const matches = [...rawText.matchAll(globalRegex)]

    if (matches.length === 0) return { validCount: 0, newCount: section.questionCount, rangesCount: section.mixedRanges?.length || 0 }

    let validMatchesCount = 0
    let maxQIdx = section.questionCount > 0 ? section.questionCount - 1 : -1
    const inferredTypes: Record<number, string> = {}

    matches.forEach(match => {
      const qIdx = parseInt(match[1] || match[2]) - 1
      const content = match[3].trim()

      if (qIdx > maxQIdx) maxQIdx = qIdx

      const tfClean = content.toUpperCase().replace(/\s+/g, '').replace(/[TF]/g, (c) => c === 'T' ? 'Đ' : 'S')
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
      
      inferredTypes[qIdx] = detectedType
    })

    const newQuestionCount = Math.max(section.questionCount, maxQIdx + 1)
    const existingTypes: string[] = Array(newQuestionCount).fill('single_choice')
    
    if (section.mixedRanges && section.mixedRanges.length > 0) {
      section.mixedRanges.forEach((r: any) => {
        for (let i = r.start - 1; i < r.end; i++) {
          if (i < newQuestionCount) existingTypes[i] = r.type
        }
      })
    }

    for (let i = 0; i < newQuestionCount; i++) {
      if (inferredTypes[i]) existingTypes[i] = inferredTypes[i]
    }

    const dynamicRanges: MixedRange[] = []
    let currentRange: MixedRange | null = null

    for (let i = 0; i < newQuestionCount; i++) {
      const type = existingTypes[i]
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
        return { ...s, type: 'mixed', questionCount: newQuestionCount, mixedRanges: dynamicRanges, correctAnswers: updatedAnswers }
      }
      return s
    }))

    return { validCount: validMatchesCount, newCount: newQuestionCount, rangesCount: dynamicRanges.length }
  }

  const handleProcessQuickAnswersText = () => {
    if (!quickAnswersModalId) return
    const section = examStructure.find(s => s.id === quickAnswersModalId)
    if (!section) return

    const res = parseAndApplyAnswersText(quickAnswersText, section)
    
    if (res.validCount === 0) {
      alert("Hệ thống không tìm thấy cú pháp hợp lệ.")
      return
    }

    setQuickAnswersModalId(null)
    setQuickAnswersText('')
    addNotification('Hoàn tất Dán Đáp án', `Hệ thống thiết lập ${res.rangesCount} vùng, tổng ${res.newCount} câu, lưu ${res.validCount} đáp án.`, 'success')
  }

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

      const res = parseAndApplyAnswersText(parsedText, section)
      if (res.validCount === 0) {
        alert("PDF nạp thành công nhưng không tìm thấy cấu trúc chuỗi đáp án.")
      } else {
        setQuickAnswersModalId(null)
        addNotification('Hoàn tất Quét PDF', `Bóc tách từ PDF, tạo ${res.rangesCount} dải phân vùng, định mức ${res.newCount} câu và nạp ${res.validCount} đáp án.`, 'success')
      }
    } catch (err: any) {
      alert("Lỗi phân tích file PDF: " + err.message)
    } finally {
      setIsParsingAnswerPdf(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0])
  }

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !file || selectedSubjects.length === 0 || examStructure.length === 0) {
      setUploadStatus({ type: 'error', message: 'Vui lòng điền đủ thông tin chung, file PDF và cấu trúc.' })
      return
    }

    try {
      setUploadStatus({ type: 'uploading', message: 'Đang khởi tạo kết nối Google Drive...' })
      const uploadUrl = await initGoogleDriveUpload(file.name || title, file.type || 'application/pdf')

      setUploadStatus({ type: 'uploading', message: 'Đang truyền luồng dữ liệu tệp tin...' })
      const uploadData = await uploadFileToGoogleDrive(uploadUrl, file, file.name || title)
      const driveFileId = uploadData.id

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Phiên đã hết hạn.")

      const generatedAccessCode = isHiddenExam ? Math.random().toString(36).substring(2, 8).toUpperCase() : null

      const { error: dbError } = await supabase.from('exams').insert({
        title, exam_type: examType, duration, allow_review: allowReview, max_attempts: maxAttempts, grading_method: gradingMethod, subjects: selectedSubjects, exam_structure: examStructure, drive_file_id: driveFileId, created_by: user.id, is_hidden: isHiddenExam, access_code: generatedAccessCode, require_proctoring: requireProctoring, creation_mode: 'pdf_mode'
      })

      if (dbError) throw new Error(dbError.message)
      setUploadStatus({ type: 'success', message: 'Phát hành cấu trúc đề thi thành công!' })
      addNotification('Xuất bản thành công', `Đề thi "${title}" đã đưa vào kho.`, 'success')
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
            {selectedSubForGrading.exams?.drive_file_id && (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* 🌟 Nền Ambient Liquid Glass */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/5 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 shadow-sm px-6 h-[76px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <LayoutDashboard className="w-5 h-5"/>
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-none">Trạm Quản Trị Hệ Thống</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Quyền hạn: <span className="text-indigo-600 dark:text-indigo-400">{currentUserRole}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* NÚT THOÁT QUẢN TRỊ TRỞ VỀ DASHBOARD */}
          <button onClick={() => router.push('/dashboard')} className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:scale-105 transition-all border border-indigo-200/50 dark:border-indigo-500/30 font-bold text-xs flex items-center gap-2">
            <Home className="w-4 h-4"/> <span className="hidden sm:inline">Về trang chủ</span>
          </button>

          <button onClick={toggleTheme} className="p-3 rounded-full bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-slate-300 hover:scale-105 transition-transform border border-slate-200/50 dark:border-white/5">
            {isDark ? <Sun className="w-4 h-4 text-amber-400"/> : <Moon className="w-4 h-4 text-indigo-600"/>}
          </button>
          
          <div className="relative">
            <button onClick={() => setShowNotificationBox(!showNotificationBox)} className="p-3 rounded-full bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-slate-300 relative border border-slate-200/50 dark:border-white/5 hover:scale-105 transition-transform">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">{unreadCount}</span>}
            </button>
            {showNotificationBox && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/10 rounded-[1.5rem] shadow-2xl p-4 space-y-2.5 z-50 max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Nhật ký tác vụ</span>
                  <button onClick={() => setNotifications([])} className="text-rose-500 hover:text-rose-400">Xóa sạch</button>
                </div>
                {notifications.length === 0 ? <p className="text-[11px] text-center text-slate-500 py-6 font-bold">Không có tác vụ mới.</p> : notifications.map(n => (
                  <div key={n.id} className="p-3 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-white/5 text-xs flex items-start gap-3 shadow-inner">
                    <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'success' ? 'text-emerald-500' : n.type === 'error' ? 'text-rose-500' : 'text-blue-500'}`}/>
                    <div><p className="font-black text-slate-800 dark:text-white">{n.title}</p><p className="text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">{n.message}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SECTIONS CONTROLLER */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 relative z-10">
        <div className="flex border-b border-slate-200 dark:border-white/10 mb-8 gap-1 overflow-x-auto custom-scrollbar hide-scroll">
          <button onClick={() => setActiveTab('overview')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><LayoutDashboard className="w-4 h-4"/>Tổng Quan</button>
          <button onClick={() => setActiveTab('upload')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><PlusCircle className="w-4 h-4"/>Tạo Đề Từ PDF</button>
          
          {/* 🌟 TABS MỚI */}
          <button onClick={() => setActiveTab('senai')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'senai' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500"/>Làm Đề (SenAI Powered)</button>
          <button onClick={() => setActiveTab('bank')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'bank' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Database className="w-4 h-4 text-emerald-500"/>Ngân Hàng Đề Thi</button>

          <button onClick={() => setActiveTab('manage')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Layers className="w-4 h-4"/>Kho Đề</button>
          <button onClick={() => setActiveTab('submissions')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'submissions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><ClipboardList className="w-4 h-4"/>Chấm Điểm</button>
          <button onClick={() => setActiveTab('collab')} className={`px-5 py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'collab' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Users className="w-4 h-4"/>Thành Viên</button>
        </div>

        {/* 🌟 TAB TỔNG QUAN (OVERVIEW DASHBOARD) */}
        {activeTab === 'overview' && (
          <div className="animate-in fade-in duration-300 space-y-6">
            {isFetchingOverview ? (
              <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Đang tổng hợp số liệu...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3"><Layers className="w-4.5 h-4.5"/></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Đề thi</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{overviewStats?.examCount ?? '--'}</p>
                  </div>
                  <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3"><Users className="w-4.5 h-4.5"/></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Người dùng</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{overviewStats?.userCount ?? '--'}</p>
                  </div>
                  <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3"><ClipboardList className="w-4.5 h-4.5"/></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bài đã nộp</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{overviewStats?.submissionCount ?? '--'}</p>
                  </div>
                  <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3"><AlertCircle className="w-4.5 h-4.5"/></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chờ chấm</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{overviewStats?.pendingGradeCount ?? '--'}</p>
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-sm">
                  <h2 className="text-sm font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest mb-5 flex items-center gap-2"><ClipboardList className="w-4 h-4"/>Hoạt động gần đây</h2>
                  <div className="space-y-2">
                    {overviewRecent.length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium py-6 text-center">Chưa có hoạt động nào.</p>
                    ) : overviewRecent.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161616] border border-slate-100 dark:border-white/5">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{sub.exams?.title || 'Đề thi đã xóa'}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{sub.profiles?.full_name || 'Ẩn danh'} · {new Date(sub.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${sub.is_graded ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {sub.is_graded ? 'Đã chấm' : 'Chờ chấm'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 🌟 TAB 1: TẠO ĐỀ PDF TRUYỀN THỐNG GIỮ NGUYÊN BÊN TRÊN */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadExam} className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 animate-in fade-in">
             <div className="xl:col-span-1 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm space-y-5">
              <h2 className="text-xs font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest flex items-center gap-2 mb-4"><FileText className="w-4 h-4"/>Thông tin chung</h2>
              <div>
                <label className="block text-[11px] font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Tiêu đề đề thi</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Đề khảo sát HSA..." className="w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-[#252525] focus:border-indigo-500 font-bold shadow-inner transition-all"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Thời gian (phút)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 50)} className="w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white font-black focus:outline-none focus:border-indigo-500 shadow-inner"/>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Số lượt thi</label>
                  <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)} className="w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent rounded-xl px-4 py-3.5 text-sm text-slate-900 dark:text-white font-black focus:outline-none focus:border-indigo-500 shadow-inner"/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Tệp tin PDF gốc (*)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-5 text-center relative bg-slate-50 dark:bg-[#202020] hover:bg-slate-100 transition-colors group">
                  <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{file ? file.name : 'Nhấp hoặc kéo file PDF vào đây'}</p>
                </div>
              </div>
              
              {/* ĐÃ CẬP NHẬT CHỌN KHỐI THI BẰNG LIST ĐƯỢC CHỈ ĐỊNH */}
              <div>
                <label className="block text-[11px] font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Chọn Khối Thi</label>
                <select value={selectedBlock} onChange={(e) => { setSelectedBlock(e.target.value); setSelectedSubjects(EXAM_BLOCKS.find(b => b.code === e.target.value)?.subs || []) }} className="w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-[#252525] focus:border-indigo-500 shadow-inner transition-all cursor-pointer">
                  {EXAM_BLOCKS.map(b => <option key={b.code} value={b.code}>Khối {b.code} ({b.name})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-2 text-slate-500 uppercase tracking-wider">Môn thi thành phần</label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 border border-slate-200 dark:border-white/5 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] custom-scrollbar">
                  {currentBlockData.subs.map(sub => (
                    <button key={sub} type="button" onClick={() => toggleSubject(sub)} className={`px-4 py-2 text-[11px] font-black rounded-lg transition-all border ${selectedSubjects.includes(sub) ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-95' : 'bg-white dark:bg-[#252525] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-400'}`}>{sub}</button>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={isHiddenExam} onChange={(e) => setIsHiddenExam(e.target.checked)} className="peer appearance-none w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-500 checked:border-indigo-500 transition-all"/>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"/>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">Thi bảo mật (Cấp mã Access Code)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={requireProctoring} onChange={(e) => setRequireProctoring(e.target.checked)} className="peer appearance-none w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-500 checked:border-indigo-500 transition-all"/>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"/>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">Giám sát AI (Chống chuyển Tab)</span>
                </label>
              </div>
            </div>

            {/* Cột 2: Lưới cấu trúc */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2"><Layers className="w-4 h-4"/>Cấu trúc Ma trận đề</h2>
                    <button type="button" onClick={addSection} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl text-xs font-black shadow-sm"><PlusCircle className="w-4 h-4"/> Thêm phần thi</button>
                 </div>
                 
                 {examStructure.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
                    <Layers className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3"/>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">Chưa có phần thi nào được khởi tạo.</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Nhấn nút "Thêm phần thi" phía trên để tạo khối mới.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {examStructure.map((section, sIdx) => (
                      <div key={section.id} className="border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-slate-50 dark:bg-[#121212] overflow-hidden shadow-sm">
                        
                        <div className="p-5 bg-white dark:bg-[#1E1E1E] border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                            <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-black text-indigo-600 dark:text-indigo-400 shadow-inner">{sIdx+1}</span>
                            <input type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)} className="bg-transparent font-black text-base text-slate-900 dark:text-white border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1 px-1 w-full transition-colors"/>
                          </div>
                          <button type="button" onClick={() => removeSection(section.id)} className="text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 p-2 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                        </div>

                        <div className="p-5 space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Môn thi</label>
                              <select value={section.subject} onChange={(e) => updateSection(section.id, 'subject', e.target.value)} className="w-full bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-xs font-bold rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer">
                                <option value="">Chọn môn</option>
                                {selectedSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tổng điểm khối</label>
                              <input type="number" step="any" value={section.sectionTotalPoints} onChange={(e) => updateSection(section.id, 'sectionTotalPoints', parseFloat(e.target.value) || 0)} className="w-full bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-xs font-bold rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tổng số câu hỏi</label>
                              <input type="number" value={section.questionCount} onChange={(e) => updateSection(section.id, 'questionCount', parseInt(e.target.value) || 0)} className="w-full bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-xs font-bold rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Chia điểm tự động</label>
                              <select value={section.scoringMode} onChange={(e) => updateSection(section.id, 'scoringMode', e.target.value)} className="w-full bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-xs font-bold rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer">
                                <option value="auto_divide">Chia đều điểm</option>
                                <option value="custom">Tùy biến từng câu</option>
                              </select>
                            </div>
                          </div>

                          <div className="bg-slate-100/50 dark:bg-[#1A1A1A] rounded-2xl p-4 border border-slate-200/50 dark:border-white/5">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-white/5 pb-2">
                              <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/> Phân định cấu trúc câu</h4>
                              <button type="button" onClick={() => handleAddMixedRange(section.id)} className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-black hover:bg-indigo-200 transition-colors flex items-center gap-1"><PlusCircle className="w-3 h-3"/> Thêm dải câu</button>
                            </div>

                            <div className="space-y-2">
                              {(section.mixedRanges || []).map((range, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-3 bg-white dark:bg-[#252525] border border-slate-200 dark:border-white/5 p-2 rounded-xl flex-wrap text-xs font-semibold shadow-sm">
                                  <span className="text-slate-500">Từ câu:</span>
                                  <input type="number" value={range.start} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'start', parseInt(e.target.value)||1)} className="w-14 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 p-1.5 rounded-lg font-black text-center text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"/>
                                  <span className="text-slate-500">đến câu:</span>
                                  <input type="number" value={range.end} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'end', parseInt(e.target.value)||1)} className="w-14 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 p-1.5 rounded-lg font-black text-center text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"/>
                                  
                                  <select value={range.type} onChange={(e) => handleUpdateMixedRange(section.id, rIdx, 'type', e.target.value)} className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 p-1.5 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer">
                                    <option value="single_choice">Trắc nghiệm đơn (A,B,C,D)</option>
                                    <option value="true_false">Trắc nghiệm Đúng/Sai liên hoàn</option>
                                    <option value="short_answer">Điền đáp án ngắn / Điền số</option>
                                    <option value="essay">Tự luận / Chấm tay</option>
                                  </select>

                                  <button type="button" onClick={() => handleRemoveMixedRange(section.id, rIdx)} className="text-rose-500 ml-auto font-black text-[10px] uppercase px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg hover:bg-rose-100 transition-colors">Xóa</button>
                                </div>
                              ))}
                              {(!section.mixedRanges || section.mixedRanges.length === 0) && (
                                <p className="text-xs font-medium text-slate-400 italic">Mặc định toàn bộ là Trắc nghiệm đơn.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            <button type="button" onClick={() => setEditingKeysSectionId(editingKeysSectionId === section.id ? null : section.id)} className="text-xs text-slate-700 dark:text-slate-300 font-black flex items-center gap-1.5 bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/10 shadow-sm px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                              <KeyRound className="w-4 h-4 text-slate-400"/> {editingKeysSectionId === section.id ? 'Đóng bảng Key' : 'Kiểm tra Đáp án'}
                            </button>
                            <button type="button" onClick={() => setParseTextModalId(section.id)} className="text-xs text-indigo-700 dark:text-indigo-300 font-black flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30 shadow-sm px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors">
                              <FileText className="w-4 h-4 text-indigo-500"/> 1. Quét chia vùng Auto
                            </button>
                            <button type="button" onClick={() => setQuickAnswersModalId(section.id)} className="text-xs text-emerald-700 dark:text-emerald-300 font-black flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/30 shadow-sm px-4 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors">
                              <Clipboard className="w-4 h-4 text-emerald-500"/> 2. Dán chuỗi Đáp án
                            </button>
                          </div>

                          {editingKeysSectionId === section.id && section.questionCount > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-4 bg-white dark:bg-[#1A1A1A] rounded-[1.5rem] border border-slate-200 dark:border-white/10 mt-4 custom-scrollbar shadow-inner">
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
                                  <div key={qIdx} className="p-3 border border-slate-200 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-[#202020] flex flex-col justify-between text-xs font-medium shadow-sm transition-colors hover:border-indigo-300">
                                    <div className="flex justify-between items-center mb-2.5">
                                      <span className="font-black text-slate-800 dark:text-white">Câu {qIdx + 1}:</span>
                                      <span className="text-[9px] text-slate-500 bg-slate-200 dark:bg-black/50 px-2 py-0.5 rounded-md uppercase font-black tracking-widest">{cType.replace('_', ' ')}</span>
                                    </div>
                                    {cType === 'single_choice' && (
                                      <div className="flex gap-1.5">
                                        {['A', 'B', 'C', 'D'].slice(0, optionsCount).map(opt => (
                                          <button key={opt} type="button" onClick={() => handleSetCorrectAnswer(section.id, qIdx, opt)} className={`flex-1 py-1.5 rounded-lg font-black transition-all ${currentAns === opt ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white dark:bg-[#252525] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-indigo-400'}`}>{opt}</button>
                                        ))}
                                      </div>
                                    )}
                                    {cType === 'true_false' && (
                                      <div className="space-y-1.5 bg-white dark:bg-[#252525] p-2 rounded-xl border border-slate-200 dark:border-white/10">
                                        {['a', 'b', 'c', 'd'].map(sub => {
                                          const subAns = currentAns?.[sub]
                                          return (
                                            <div key={sub} className="flex items-center justify-between gap-2 border-b last:border-0 border-slate-100 dark:border-white/5 pb-1.5 last:pb-0">
                                              <span className="uppercase font-black text-slate-500 bg-slate-100 dark:bg-black/40 w-5 h-5 flex items-center justify-center rounded-md">{sub}</span>
                                              <div className="flex gap-1.5">
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'Đ')} className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${subAns === 'Đ' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-black/40 text-slate-500 hover:bg-emerald-100'}`}>ĐÚNG</button>
                                                <button type="button" onClick={() => handleSetCorrectAnswerTF(section.id, qIdx, sub, 'S')} className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${subAns === 'S' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-black/40 text-slate-500 hover:bg-rose-100'}`}>SAI</button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {cType !== 'single_choice' && cType !== 'true_false' && cType !== 'essay' && (
                                      <input type="text" value={typeof currentAns === 'object' ? Object.values(currentAns).join('') : (currentAns || '')} onChange={(e) => handleSetCorrectAnswer(section.id, qIdx, e.target.value)} placeholder="Nhập đáp án..." className="w-full bg-white dark:bg-[#252525] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"/>
                                    )}
                                    {cType === 'essay' && <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-2 rounded-xl text-center"><span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest">Chấm thủ công</span></div>}
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
              
              <div className="bg-white dark:bg-[#1A1A1A] p-6 rounded-[2rem] shadow-sm flex justify-between items-center mt-6">
                 <div className="text-sm font-black">{uploadStatus.message || 'Hệ thống sẵn sàng...'}</div>
                 <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-md"><Save className="w-5 h-5 inline mr-2"/> Phát hành Đề thi</button>
              </div>
            </div>
          </form>
        )}

        {/* 🌟 TAB 2 MỚI: TẠO ĐỀ BẰNG AI (SENAI POWERED) */}
        {activeTab === 'senai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] animate-in fade-in duration-500">
            
            {/* Cột trái: Chat với SenAI */}
            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center gap-3 bg-gradient-to-r from-indigo-500/10 to-transparent">
                <div className="w-10 h-10 rounded-[12px] bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>
                </div>
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">SenAI Đề Thi <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500"/></h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tự động bóc tách & Format Toán học</p>
                </div>
              </div>

              <div ref={aiChatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {aiMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-3 mt-1 shadow-sm border border-indigo-400/20">
                        <Bot className="w-4 h-4"/>
                      </div>
                    )}
                    <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.2rem] text-[14px] font-medium leading-relaxed shadow-sm overflow-x-auto ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className={`font-extrabold ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...props} />,
                          code: ({node, inline, ...props}: any) => inline ? <code className="bg-slate-200 dark:bg-black/30 px-1.5 py-0.5 rounded text-pink-500 dark:text-pink-300 text-[12px] font-mono" {...props} /> : <div className="bg-slate-800 p-3 rounded-lg my-2"><code className="text-white/80 font-mono text-[12px]" {...props} /></div>
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                      
                      {msg.codeSnippet && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> JSON Sinh thành công</span>
                          <button onClick={() => {setCurrentGeneratedCode(msg.codeSnippet!); setAiPreviewMode('preview')}} className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200 transition-colors flex items-center gap-1.5"><Eye className="w-3.5 h-3.5"/> Xem trước Đề</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start items-end">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0 mr-3 shadow-sm border border-indigo-400/20">
                      <Sparkles className="w-4 h-4 animate-pulse text-yellow-500"/>
                    </div>
                    <div className="bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/5 px-5 py-3.5 rounded-[1.2rem] rounded-bl-sm shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500"/>
                      <span className="text-[12px] text-slate-500 font-bold">Đang phân tích cấu trúc...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121212] border-t border-slate-200 dark:border-white/5 shrink-0">
                <form onSubmit={handleSendAiMessage} className="relative flex items-end gap-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-1.5 focus-within:border-indigo-400/50 shadow-sm transition-all">
                  <textarea
                    value={aiChatInput} onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSendAiMessage(e as any) } }}
                    placeholder="Dán nội dung đề thi vào đây để AI bóc tách (Nhấn Shift + Enter để xuống dòng)..."
                    className="flex-1 bg-transparent border-none outline-none resize-none py-3 px-3 max-h-[120px] custom-scrollbar text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                    rows={1}
                  />
                  <button type="submit" disabled={!aiChatInput.trim() || isAiLoading} className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-[#252525] disabled:text-slate-400 text-white rounded-full transition-transform active:scale-95 shadow-md shrink-0 m-1">
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Cột phải: Preview và Quản lý Code */}
            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#121212] shrink-0">
                <div className="flex bg-slate-200/50 dark:bg-[#202020] p-1 rounded-xl">
                  <button onClick={() => setAiPreviewMode('preview')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${aiPreviewMode === 'preview' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}><Eye className="w-4 h-4"/> Chế độ Xem trước</button>
                  <button onClick={() => setAiPreviewMode('code')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${aiPreviewMode === 'code' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}><Code className="w-4 h-4"/> Chỉnh sửa Mã JSON</button>
                </div>
                {currentGeneratedCode && (
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-transform active:scale-95 flex items-center gap-1.5"><Save className="w-4 h-4"/> Lưu & Xuất bản</button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-100/50 dark:bg-[#121212]/50">
                {aiPreviewMode === 'code' ? (
                  <textarea 
                    value={currentGeneratedCode || ''} 
                    onChange={(e) => setCurrentGeneratedCode(e.target.value)}
                    placeholder="Mã JSON sẽ hiển thị ở đây..."
                    className="w-full h-full min-h-[400px] bg-slate-900 text-green-400 font-mono p-5 rounded-2xl outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-inner leading-relaxed custom-scrollbar"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5 p-6 shadow-sm overflow-y-auto custom-scrollbar">
                    {renderAiPreview()}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* QUẢN LÝ KHO ĐỀ */}
        {activeTab === 'manage' && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest flex items-center gap-2"><Layers className="w-4 h-4"/>Kho đề thi trực tuyến hiện hành</h2>
              {selectedExamIds.length > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-[#252525] px-3 py-1.5 rounded-lg">{selectedExamIds.length} đề đã chọn</span>
                  <button onClick={handleBulkDeleteExams} className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"><Trash2 className="w-3.5 h-3.5"/> Xóa hàng loạt</button>
                </div>
              )}
            </div>
            {isFetchingData ? <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Đang quét kho dữ liệu...</div> : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#1E1E1E]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#121212] text-slate-500 dark:text-slate-400 uppercase font-black text-[10px] tracking-widest">
                      <th className="py-4 px-5 w-10">
                        <input type="checkbox" checked={filteredExams.length > 0 && selectedExamIds.length === filteredExams.length} onChange={toggleSelectAllExams} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                      </th>
                      <th className="py-4 px-5">Tiêu đề đề thi</th>
                      <th className="py-4 px-5">Kỳ thi</th>
                      <th className="py-4 px-5">Thời gian</th>
                      <th className="py-4 px-5">Mã Truy Cập (Đề Ẩn)</th>
                      <th className="py-4 px-5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map(e => (
                      <tr key={e.id} className={`border-b last:border-0 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors group ${selectedExamIds.includes(e.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                        <td className="py-4 px-5">
                          <input type="checkbox" checked={selectedExamIds.includes(e.id)} onChange={() => toggleExamSelection(e.id)} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                        </td>
                        <td className="py-4 px-5 font-bold text-slate-900 dark:text-white max-w-[300px] truncate">{e.title}</td>
                        <td className="py-4 px-5 font-black text-indigo-600 dark:text-indigo-400">{e.exam_type}</td>
                        <td className="py-4 px-5 font-bold text-slate-600 dark:text-slate-300">{e.duration} phút</td>
                        <td className="py-4 px-5">
                          {e.is_hidden ? (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg font-mono font-black border border-amber-200 dark:border-amber-700/50 shadow-sm flex items-center gap-2 w-fit">
                              <KeyRound className="w-3.5 h-3.5"/> {e.access_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-bold italic">Công khai</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button onClick={() => handleDeleteExam(e.id)} className="text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-900/20 dark:hover:bg-rose-600 font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 text-xs">Xóa bỏ</button>
                        </td>
                      </tr>
                    ))}
                    {filteredExams.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-slate-400 font-bold text-sm">Chưa có đề thi nào trong kho lưu trữ.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* QUẢN LÝ BÀI NỘP */}
        {activeTab === 'submissions' && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-sm animate-in fade-in duration-300">
            <h2 className="text-sm font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest mb-6 flex items-center gap-2"><ClipboardList className="w-4 h-4"/>Danh sách bài làm chờ duyệt</h2>
            {isFetchingData ? <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Đang đồng bộ cổng bài làm...</div> : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#1E1E1E]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#121212] text-slate-500 dark:text-slate-400 uppercase font-black text-[10px] tracking-widest">
                      <th className="py-4 px-5">Thí sinh</th>
                      <th className="py-4 px-5">Đề thi</th>
                      <th className="py-4 px-5">Thời gian nộp</th>
                      <th className="py-4 px-5">Điểm số</th>
                      <th className="py-4 px-5 text-right">Hội đồng chấm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map(s => (
                      <tr key={s.id} className="border-b last:border-0 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors group">
                        <td className="py-4 px-5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">{s.profiles?.full_name || 'Học sinh ẩn danh'}</td>
                        <td className="py-4 px-5 font-bold text-slate-600 dark:text-slate-300 max-w-[250px] truncate">{s.exams?.title}</td>
                        <td className="py-4 px-5 font-medium text-slate-500 text-xs">{new Date(s.created_at).toLocaleString('vi-VN')}</td>
                        <td className="py-4 px-5 font-black text-emerald-600 dark:text-emerald-400 text-base">{s.is_graded ? String(s.score).replace('.', ',') : <span className="text-amber-500 text-xs italic">Chờ chấm</span>}</td>
                        <td className="py-4 px-5 text-right">
                          <button onClick={() => openGradingView(s)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 text-xs flex items-center justify-end gap-1.5 ml-auto">
                            <PenTool className="w-3.5 h-3.5"/> Chấm bài
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredSubmissions.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400 font-bold text-sm">Không có bài làm nào cần chấm.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* QUẢN LÝ THÀNH VIÊN */}
        {activeTab === 'collab' && currentUserRole === 'admin' && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 lg:p-8 shadow-sm animate-in fade-in duration-300">
            <h2 className="text-sm font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest mb-6 flex items-center gap-2"><Users className="w-4 h-4"/>Phân quyền Hệ thống</h2>
            {isFetchingData ? <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Đang truy xuất danh sách...</div> : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-[1.5rem] bg-white dark:bg-[#1E1E1E]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#121212] text-slate-500 dark:text-slate-400 uppercase font-black text-[10px] tracking-widest">
                      <th className="py-4 px-5">Người dùng</th>
                      <th className="py-4 px-5">Trường học</th>
                      <th className="py-4 px-5">Quyền hạn (Role)</th>
                      <th className="py-4 px-5 text-right">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-b last:border-0 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors group">
                        <td className="py-4 px-5 font-bold text-slate-900 dark:text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">{u.full_name?.charAt(0) || 'U'}</div>
                          {u.full_name || 'Chưa cập nhật'}
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-600 dark:text-slate-400">{u.school || '-'}</td>
                        <td className="py-4 px-5">
                          <select 
                            value={u.role || 'student'} 
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="bg-slate-100 dark:bg-[#202020] border border-transparent hover:border-slate-300 dark:hover:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer transition-colors shadow-inner"
                          >
                            <option value="student">Học sinh (Student)</option>
                            <option value="collab">Giáo viên (Collab)</option>
                            <option value="admin">Quản trị viên (Admin)</option>
                          </select>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">Auto Saved</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* 🌟 MODALS QUÉT PDF VÀ DÁN ĐÁP ÁN (GIỮ NGUYÊN TỪ BẢN TRƯỚC VÀ NÂNG CẤP UI) */}
      {/* ===================================================================== */}
      
      {parseTextModalId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-2xl rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]/50">
              <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center"><Layers className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-base">Nạp Cấu Trúc Đề Tự Động</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Quét bằng AI Zero-Regret</p>
                </div>
              </div>
              <button onClick={() => setParseTextModalId(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-[#252525] rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-[#202020] rounded-[1.2rem]">
                <button type="button" onClick={() => setAnswerMethod('text')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${answerMethod === 'text' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Dán Text nội dung</button>
                <button type="button" onClick={() => setAnswerMethod('pdf')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${answerMethod === 'pdf' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Nạp qua tệp PDF</button>
              </div>

              {answerMethod === 'text' ? (
                <div className="space-y-4 animate-in fade-in">
                  <textarea 
                    value={examTextToParse} 
                    onChange={(e) => setExamTextToParse(e.target.value)} 
                    placeholder="Dán toàn bộ nội dung chữ của đề bài thi vào đây để AI tự động đếm câu hỏi và phân tích dạng bài..." 
                    rows={8} 
                    className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner custom-scrollbar" 
                  />
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setParseTextModalId(null)} className="px-6 py-3 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors">Hủy</button>
                    <button type="button" onClick={handleProcessRawTextParsingDirectly} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm shadow-[0_8px_20px_rgba(79,70,229,0.3)] active:scale-95 transition-transform flex items-center gap-2"><Sparkles className="w-4 h-4"/> Phân tích Text</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in text-center">
                  <div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-[2rem] p-12 text-center relative bg-slate-50 dark:bg-[#121212] hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors group">
                    <input type="file" accept=".pdf" onChange={handleProcessPdfTextParsing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <UploadCloud className="w-12 h-12 text-indigo-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-black text-slate-700 dark:text-white">Nhấp chọn hoặc kéo thả tệp PDF vào đây</p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2 bg-slate-200 dark:bg-black/30 inline-block px-3 py-1 rounded-full">Yêu cầu: Đề thi có chứa ký hiệu phân định (VD: Câu 1., Câu 2.)</p>
                  </div>
                  {uploadStatus.type === 'uploading' && (
                    <div className="flex items-center justify-center gap-2 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 py-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                      <Loader2 className="w-5 h-5 animate-spin"/> {uploadStatus.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {quickAnswersModalId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-xl rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-[#121212]/50">
              <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center"><Clipboard className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-base">Nạp Chuỗi Đáp Án Nhanh</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Tự động điền theo thứ tự</p>
                </div>
              </div>
              <button onClick={() => setQuickAnswersModalId(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-[#252525] rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
            </div>

            <div className="p-8 space-y-5">
              <div className="bg-emerald-50 dark:bg-[#121212] border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed shadow-sm">
                <p className="font-black mb-2 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><Sparkles className="w-4 h-4"/> Thuật toán bóc tách thông minh hỗ trợ các cú pháp:</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm"><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Viết liền</p><code className="font-mono font-bold text-slate-700 dark:text-white">1.A 2.B 3.ĐSĐĐ 4.12,5</code></div>
                  <div className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm"><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Xuống dòng</p><code className="font-mono font-bold text-slate-700 dark:text-white">1. A<br/>2. B<br/>3. Đ S Đ Đ</code></div>
                </div>
              </div>
              
              <textarea 
                value={quickAnswersText} 
                onChange={(e) => setQuickAnswersText(e.target.value)} 
                placeholder="Dán nội dung chuỗi đáp án tại đây..." 
                rows={6} 
                className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner transition-all custom-scrollbar" 
              />
              
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setQuickAnswersModalId(null)} className="px-6 py-3 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors">Hủy bỏ</button>
                <button type="button" onClick={handleProcessQuickAnswersText} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-transform active:scale-95 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Đồng bộ Đáp án</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}