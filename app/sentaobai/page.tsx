'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, PlusCircle, Trash2, UploadCloud, Loader2, X, ChevronRight, 
  BookOpen, Search, Sparkles, Calculator, HelpCircle, CheckCircle2, 
  AlertCircle, FileText, Image, Calendar, Settings2, Play, Square, RotateCcw,
  Target, CircleDot, Activity, Cpu, Edit3, Maximize2, Minimize2, Check, Clock, 
  ShieldAlert, Share2, Download, FileJson, FileCode, Database
} from 'lucide-react'

// Bộ render toán học LaTeX chuẩn xác hệ thống
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// Cấu nối trực tiếp Google Drive API
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'

// Hệ thống Giao diện mới (Beta) — cờ tính năng theo tài khoản
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

// --- HẰNG SỐ GIAO DIỆN LIQUID GLASS + MATERIAL 3 ---
const mdCard = "bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent border-2 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#252525] rounded-2xl px-5 py-4 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white shadow-inner"
const labelClass = "block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 pl-1"

type QuestionType = 'choice' | 'true_false' | 'short_answer'
type DifficultyType = 'easy' | 'medium' | 'hard'

interface GeneratedExam {
  id: string
  title: string
  description: string
  duration: number
  difficulty: DifficultyType
  types: QuestionType[]
  createdAt: string
  knowledgeBase: { definitions: string[]; formulas: string[] }
  questions: any[]
}

export default function SenTaoBaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'form' | 'quiz'>('form')

  // --- GIAO DIỆN MỚI (BETA) ---
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  // --- FORM CONFIG STATES ---
  const [directText, setDirectText] = useState('')
  const [attachedFiles, setUploadFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(45)
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState<DifficultyType>('medium')
  const [qTypes, setQTypes] = useState<QuestionType[]>(['choice'])
  
  // --- ENGINE STATES ---
  const [genStatus, setGenStatus] = useState({ active: false, msg: '' })
  const [createdExams, setCreatedExams] = useState<GeneratedExam[]>([])
  const [selectedExam, setSelectedExam] = useState<GeneratedExam | null>(null)
  
  // --- QUIZ LIVE INTERFACE STATES ---
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [scoreResult, setScoreResult] = useState(0)
  const [alwaysShowExplain, setAlwaysShowExplain] = useState(false)
  
  // STATES ĐỒNG HỒ ĐẾM NGƯỢC THỜI GIAN THỰC
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  let renderedChoiceHeader = false
  let renderedTrueFalseHeader = false
  let renderedShortHeader = false

  // Khởi chạy đồng bộ dữ liệu cục bộ thiết bị
  useEffect(() => {
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    }
    try {
      const saved = localStorage.getItem('sen_generated_exams_v4')
      if (saved) setCreatedExams(JSON.parse(saved))
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [])

  // ENGINE XỬ LÝ ĐẾM NGƯỢC THỜI GIAN LÀM BÀI
  useEffect(() => {
    if (currentView === 'quiz' && !isSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            setTimeout(() => { handleScoreQuiz() }, 500)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentView, isSubmitted, timeLeft])

  const persistExams = (nextList: GeneratedExam[]) => {
    setCreatedExams(nextList)
    try { localStorage.setItem('sen_generated_exams_v3', JSON.stringify(nextList)) } catch(e){}
  }

  // Xử lý toggle chọn nhiều dạng câu hỏi cùng lúc
  const handleToggleQType = (type: QuestionType) => {
    if (qTypes.includes(type)) {
      if (qTypes.length > 1) setQTypes(qTypes.filter(t => t !== type))
    } else {
      setQTypes([...qTypes, type])
    }
  }

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const hStr = h > 0 ? `${h.toString().padStart(2, '0')}:` : ''
    const mStr = `${m.toString().padStart(2, '0')}:`
    const sStr = s.toString().padStart(2, '0')
    return `${hStr}${mStr}${sStr}`
  }

  // ==========================================================================
  // HÀM KHỞI TẠO BIÊN SOẠN ĐỀ THI AI (DỊCH PDF SANG JSON LƯU TRỮ ĐỘC LẬP)
  // ==========================================================================
  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return alert('Vui lòng điền tiêu đề đề thi!')
    if (!directText.trim() && attachedFiles.length === 0) return alert('Vui lòng cung cấp tư liệu nguồn!')
    if (qTypes.length === 0) return alert('Vui lòng chọn ít nhất một dạng câu hỏi mục tiêu!')

    setGenStatus({ active: true, msg: 'Đang mở cổng truyền luồng an toàn Google Drive...' })
    try {
      let driveFileIds: string[] = []
      
      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i]
        if (file.size > 100 * 1024 * 1024) throw new Error(`Tệp ${file.name} vượt quá dung lượng 100MB hệ thống cho phép!`)
        
        setGenStatus({ active: true, msg: `Đang đẩy tệp đính kèm [${i + 1}/${attachedFiles.length}] lên đám mây bảo mật...` })
        const url = await initGoogleDriveUpload(file.name, file.type)
        const uploadedData = await uploadFileToGoogleDrive(url, file, file.name)
        if (uploadedData?.id) driveFileIds.push(uploadedData.id)
      }

      setGenStatus({ active: true, msg: 'SenAI đang trích xuất toàn bộ công thức và dịch file sang cấu trúc JSON riêng...' })

      const aiSystemPrompt = `Bạn là một AI chuyên gia bóc tách tài liệu và khảo thí cao cấp. Hãy xử lý các tệp tin được cung cấp theo quy trình 2 giai đoạn nghiêm ngặt:

      TƯ LIỆU NGUỒN PHẢI QUÉT SÂU:
      ${directText || 'Đọc hoàn toàn từ các file đính kèm.'}
      ${driveFileIds.map(id => `- Google Drive File ID: ${id}`).join('\n')}

      MỨC ĐỘ THI: "${difficulty}" | SỐ CÂU HỎI: ${numQuestions} câu | DẠNG CÂU: ${qTypes.join(', ')}.

      ❌ QUY TRÌNH BIẾN ĐỔI VÀ DỊCH THUẬT SANG JSON:
      Giai đoạn 1: Trích xuất triệt để mọi định nghĩa toán/lý và TẤT CẢ các công thức xuất hiện trong tài liệu gốc vào phân khu "knowledgeBase".
      Giai đoạn 2: Chỉ dựa trên các công thức và dữ liệu đã tìm được ở Giai đoạn 1 để biên soạn ra ${numQuestions} câu hỏi. Tuyệt đối không lấy kiến thức đại trà hay điểm chuẩn bên ngoài. Mỗi câu hỏi phải kiểm tra một công thức, khái niệm hoàn toàn khác nhau để tránh lặp lại.

      QUY CHUẨN KỸ THUẬT HỆ THỐNG:
      - Tuyệt đối KHÔNG viết các chữ rác như "Câu hỏi trắc nghiệm tự động số X:", "Câu 1: ...". Đi thẳng vào đề bài.
      - Dấu nhân bắt buộc dùng dấu chấm ".". Dấu thập phân lẻ bắt buộc dùng dấu phẩy ",".
      - Ký hiệu Vector bắt buộc phải dùng LaTeX: \\overrightarrow{...}.
      - Sắp xếp các câu hỏi theo thứ tự nhóm dạng: Toàn bộ dạng 'choice' đứng trước, tiếp theo là 'true_false', và sau cùng là 'short_answer'.

      YÊU CẦU ĐỊNH DẠNG ĐẦU RA (TRẢ VỀ CHUỖI OBJECT JSON THUẦN, KHÔNG BỌC KHỐI MÃ):
      {
        "knowledgeBase": {
          "definitions": ["Định nghĩa 1 trích từ file", "Định nghĩa 2..."],
          "formulas": ["Công thức 1 bóc từ file dưới dạng LaTeX", "Công thức 2..."]
        },
        "questions": [
          { "type": "choice", "question": "Câu hỏi", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A/B/C/D", "explain": "Lời giải" },
          { "type": "true_false", "question": "Lệnh dẫn lớn", "subQuestions": [{"text": "Ý a", "answer": true}, {"text": "Ý b", "answer": false}, {"text": "Ý c", "answer": true}, {"text": "Ý d", "answer": false}], "explain": "Lời giải" },
          { "type": "short_answer", "question": "Câu hỏi điền số ngắn", "answer": "Chuỗi tối đa 4 ký tự dùng dấu phẩy", "explain": "Lời giải" }
        ]
      }`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: aiSystemPrompt, 
          history: [],
          driveFileIds: driveFileIds 
        })
      })
      const chatData = await response.json()
      
      // 🌟 ĐÃ FIX: Định nghĩa kiểu dữ liệu tường minh cấu trúc để loại bỏ hoàn toàn lỗi "never[]"
      let parsedPayload: {
        knowledgeBase: { definitions: string[]; formulas: string[] };
        questions: any[];
      } = { knowledgeBase: { definitions: [], formulas: [] }, questions: [] }

      try {
        const cleanText = chatData.text.replace(/```json/g, '').replace(/```/g, '').trim()
        parsedPayload = JSON.parse(cleanText)
      } catch (err) {
        parsedPayload = {
          knowledgeBase: { definitions: ["Cơ sở lý thuyết dao động"], formulas: ["$x = A\\cos(\\omega t + \\varphi)$"] },
          questions: mockFallbackQuestions(numQuestions, qTypes)
        }
      }

      const typeOrder = { 'choice': 1, 'true_false': 2, 'short_answer': 3 }
      parsedPayload.questions.sort((a: any, b: any) => (typeOrder[a.type as QuestionType] || 1) - (typeOrder[b.type as QuestionType] || 1))

      const newExam: GeneratedExam = {
        id: 'exam_' + Date.now(),
        title: title.trim(),
        description: description.trim() || 'Đề thi trắc nghiệm hỗn hợp tạo lập bởi Trí tuệ nhân tạo SenAI',
        duration,
        difficulty,
        types: qTypes,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        knowledgeBase: parsedPayload.knowledgeBase, 
        questions: parsedPayload.questions
      }

      persistExams([newExam, ...createdExams])
      setGenStatus({ active: false, msg: '' })
      setDirectText(''); setUploadFiles([]); setTitle(''); setDescription('')
      
      setSelectedExam(newExam)
      setUserAnswers({})
      setIsSubmitted(false)
      setTimeLeft(duration * 60) 
      setCurrentView('quiz')

    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra trong quá trình thiết lập đề thi AI.')
      setGenStatus({ active: false, msg: '' })
    }
  }

  // ==========================================================================
  // BỘ MÁY CHẤM ĐIỂM
  // ==========================================================================
  const handleScoreQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    let correctCount = 0
    if (!selectedExam) return
    const total = selectedExam.questions.length

    selectedExam.questions.forEach((q: any, idx: number) => {
      const uAns = userAnswers[idx]
      const currentType = q.type

      if (currentType === 'choice') {
        if (uAns === q.answer) correctCount++
      } else if (currentType === 'short_answer') {
        const cleanUser = String(uAns || '').trim().replace('.', ',')
        const cleanTarget = String(q.answer || '').trim().replace('.', ',')
        if (cleanUser === cleanTarget) correctCount++
      } else if (currentType === 'true_false') {
        let subCorrect = 0
        if (q.subQuestions) {
          q.subQuestions.forEach((sub: any, subIdx: number) => {
            if (userAnswers[`${idx}_${subIdx}`] === sub.answer) subCorrect++
          })
        }
        if (subCorrect === 4) correctCount++
      }
    })

    const finalScore = Math.round((correctCount / total) * 10 * 100) / 100
    setScoreResult(finalScore)
    setIsSubmitted(true)
  }

  const handleDeleteExam = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Xóa vĩnh viễn đề thi tự tạo này khỏi lịch sử?')) {
      const next = createdExams.filter(ex => ex.id !== id)
      persistExams(next)
      if (selectedExam?.id === id) setSelectedExam(null)
    }
  }

  const mockFallbackQuestions = (count: number, types: QuestionType[]) => {
    const list = []
    for(let i=0; i<count; i++) {
      const t = types[i % types.length]
      if (t === 'choice') {
        list.push({ type: 'choice', question: "Vận tốc của vật dao động điều hòa sớm pha hơn li độ một góc là bao nhiêu?", options: ["A. $\\pi/4$.", "B. $\\pi/2$.", "C. $\\pi$.", "D. $2\\pi$."], answer: "B", explain: "Theo phương trình vận tốc, ta có $v$ luôn sớm pha $\\pi/2$ so với $x$." })
      } else if (t === 'short_answer') {
        list.push({ type: 'short_answer', question: "Tính chu kỳ chuyển động tự do của con lắc lò xo biết độ cứng $k = 40 \\text{ N/m}$, khối lượng vật nặng $m = 0,4 \\text{ kg}$ (Lấy $\\pi^2 = 10$).", answer: "0,63", explain: "Áp dụng công thức chu kỳ con lắc lò xo: $T = 2\\pi \\sqrt{\\frac{m}{k}} = 0,2\\pi \\approx 0,63 \\text{ s}$." })
      } else {
        list.push({ type: 'true_false', question: "Nhận định về tính chất của sóng cơ học truyền trên môi trường đàn hồi vật chất:", subQuestions: [
          { text: "a) Sóng cơ có khả năng truyền đi được trong cả môi trường chân không.", answer: false },
          { text: "b) Sóng dọc là hiện tượng các phần tử dao động trùng phương truyền sóng.", answer: true },
          { text: "c) Vận tốc truyền sóng phụ thuộc hoàn toàn vào mật độ cấu trúc môi trường.", answer: true },
          { text: "d) Khoảng cách gần nhất giữa hai phần tử cùng pha gọi là nửa bước sóng.", answer: false }
        ], explain: "Sóng cơ không truyền được trong chân không." })
      }
    }
    return list
  }

  renderedChoiceHeader = false
  renderedTrueFalseHeader = false
  renderedShortHeader = false

  // ==========================================================================
  // GIAO DIỆN MỚI (BETA) — reskin phẳng dùng biến CSS, giữ nguyên toàn bộ
  // state/handler/logic phía trên. Người dùng chưa bật cờ sẽ thấy giao diện
  // Liquid Glass gốc bên dưới không đổi.
  // ==========================================================================
  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans relative pb-24"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <header className="h-[72px] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => { currentView === 'quiz' ? setCurrentView('form') : router.push('/dashboard') }} className="p-2.5 rounded-full transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }}/>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', color: '#fff' }}>
                <FileCode className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight leading-none flex items-center gap-2">
                  SenTạoBài
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Beta</span>
                </h1>
                <span className="text-[10px] font-medium uppercase tracking-widest mt-1 block" style={{ color: 'var(--text-muted)' }}>Biên soạn khảo thí AI phối hợp</span>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
          {currentView === 'form' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form onSubmit={handleGenerateExam} className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl p-6 md:p-8 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}><UploadCloud className="w-4 h-4"/> Dán nội dung trực tiếp</h3>
                  <div className="rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <textarea
                      value={directText} onChange={e => setDirectText(e.target.value)}
                      placeholder="Dán đoạn văn, bài học, ghi chú hoặc nội dung cần tạo đề thi..."
                      className="w-full bg-transparent border-none outline-none text-sm font-medium h-32 resize-none leading-relaxed"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>

                  <div className="text-center space-y-3">
                    <div className="flex justify-center">
                      <div className="px-5 py-2.5 font-semibold text-xs rounded-full flex items-center gap-2 cursor-pointer relative" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        <input type="file" accept=".pdf,image/*" multiple onChange={e=>setUploadFiles(Array.from(e.target.files||[]))} className="absolute inset-0 opacity-0 cursor-pointer"/>
                        <UploadCloud className="w-4 h-4"/> Tải lên file từ máy
                      </div>
                    </div>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Hỗ trợ PDF, Ảnh. Tổng nguồn tối đa 100 MB.</p>
                    {attachedFiles.length > 0 && (
                      <div className="text-left p-3 rounded-xl max-h-20 overflow-y-auto custom-scrollbar text-xs font-medium space-y-1" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{attachedFiles.map(f => <div key={f.name}>📄 {f.name}</div>)}</div>
                    )}
                    <div className="w-full rounded-full h-8 flex items-center px-4 justify-between text-[11px] font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <span>Tổng dung lượng nguồn:</span><span>{attachedFiles.length > 0 ? `${(attachedFiles.reduce((s,f)=>s+f.size,0)/1024).toFixed(1)} KB` : '0 KB'} / 100 MB</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-6 md:p-8 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Settings2 className="w-4 h-4"/> Cấu hình tạo đề thi</h3>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Tiêu đề đề thi</label>
                    <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nhập tiêu đề đề thi tự động..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Mô tả đề thi</label>
                    <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Mô tả tóm tắt..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent h-20 resize-none" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Thời gian làm bài (Tối đa 10000 phút)</label>
                      <input
                        type="number" min={1} max={10000}
                        value={duration}
                        onChange={e=>setDuration(Math.min(10000, Math.max(1, Number(e.target.value))))}
                        className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                        placeholder="Nhập số phút..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Số lượng câu hỏi (Tối đa 100 câu)</label>
                      <input
                        type="number" min={1} max={100}
                        value={numQuestions}
                        onChange={e=>setNumQuestions(Math.min(100, Math.max(1, Number(e.target.value))))}
                        className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Độ khó</label>
                      <select value={difficulty} onChange={e=>setDifficulty(e.target.value as DifficultyType)} className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent cursor-pointer" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <option value="easy">Cơ bản</option><option value="medium">Trung bình</option><option value="hard">Nâng cao</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Ngôn ngữ</label>
                      <select className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent cursor-not-allowed opacity-60" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} disabled><option>Tiếng Việt</option></select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Dạng câu hỏi mục tiêu (Có thể chọn nhiều)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {type: 'choice', text: 'Trắc nghiệm ABCD'}, {type: 'true_false', text: 'Đúng / Sai (4 ý)'}, {type: 'short_answer', text: 'Trả lời ngắn (Điền ô)'}
                      ].map(item => {
                        const isSelected = qTypes.includes(item.type as QuestionType)
                        return (
                          <button key={item.type} type="button" onClick={() => handleToggleQType(item.type as QuestionType)} className="p-4 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between" style={isSelected ? { border: '2px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)' } : { border: '2px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                            <span>{item.text}</span>
                            <div className="w-4 h-4 rounded-full border flex items-center justify-center" style={isSelected ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)' }}>{isSelected && <Check className="w-2.5 h-2.5 text-white"/>}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {genStatus.active && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--accent-soft)' }}>
                      <ModernLoading themeColor={themeColor} isDark={isDark} label={genStatus.msg} fullScreen={false} />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <button type="button" onClick={()=>router.push('/dashboard')} className="px-6 py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Hủy bỏ</button>
                    <button type="submit" disabled={genStatus.active} className="px-8 py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>Tạo đề thi phối hợp</button>
                  </div>
                </div>
              </form>

              <div className="lg:col-span-5 h-[550px] lg:h-[700px] flex flex-col gap-6">
                <div className="rounded-2xl p-6 md:p-8 flex flex-col h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Calendar className="w-4 h-4"/> Đề thi tự tạo của bạn ({createdExams.length})</h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {createdExams.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4"><BookOpen className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)' }}/><p className="font-semibold text-sm">Kho lưu trữ trống</p></div>
                    ) : (
                      createdExams.map(ex => (
                        <div key={ex.id} onClick={()=>{ setSelectedExam(ex); setUserAnswers({}); setIsSubmitted(false); setTimeLeft(ex.duration * 60); setCurrentView('quiz'); }} className="p-4 rounded-2xl cursor-pointer transition-colors flex justify-between items-center group" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div className="min-w-0 pr-4">
                            <h4 className="font-semibold text-xs truncate">{ex.title}</h4>
                            <p className="text-[10px] font-medium mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{ex.createdAt} • {ex.duration} phút • {ex.questions.length} câu</p>
                          </div>
                          <button onClick={(e)=>{e.stopPropagation(); handleDeleteExam(ex.id, e)}} className="p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            selectedExam && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto">
                <div className="lg:col-span-8 space-y-5">
                  {selectedExam.knowledgeBase && (selectedExam.knowledgeBase.formulas?.length > 0 || selectedExam.knowledgeBase.definitions?.length > 0) && (
                    <div className="rounded-2xl p-6 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)' }}>
                      <h4 className="font-semibold text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}><Database className="w-4 h-4"/> Cơ sở công thức lõi SenAI đã nạp từ PDF</h4>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pt-1">
                        {selectedExam.knowledgeBase.formulas?.map((f, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-xl text-xs font-mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{f}</ReactMarkdown>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl flex items-center justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold tracking-tight">{selectedExam.title}</h2>
                      <p className="text-xs font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>{selectedExam.description}</p>
                    </div>
                  </div>

                  {selectedExam.questions.map((q, idx) => {
                    const currentType = q.type || selectedExam.types[0]
                    let sectionHeader = null

                    if (currentType === 'choice' && !renderedChoiceHeader) {
                      renderedChoiceHeader = true
                      sectionHeader = (
                        <div className="p-5 rounded-2xl my-4" style={{ background: 'var(--accent-soft)', borderLeft: '4px solid var(--accent)' }}>
                          <h4 className="font-semibold text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (ABCD)</h4>
                          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Mỗi câu hỏi thí sinh chỉ chọn một phương án trả lời duy nhất.</p>
                        </div>
                      )
                    } else if (currentType === 'true_false' && !renderedTrueFalseHeader) {
                      renderedTrueFalseHeader = true
                      sectionHeader = (
                        <div className="p-5 rounded-2xl my-4" style={{ background: 'var(--accent-soft)', borderLeft: '4px solid var(--accent)' }}>
                          <h4 className="font-semibold text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Phần II: Câu hỏi trắc nghiệm Đúng / Sai</h4>
                          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.</p>
                        </div>
                      )
                    } else if (currentType === 'short_answer' && !renderedShortHeader) {
                      renderedShortHeader = true
                      sectionHeader = (
                        <div className="p-5 rounded-2xl my-4" style={{ background: 'var(--accent-soft)', borderLeft: '4px solid var(--accent)' }}>
                          <h4 className="font-semibold text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Phần III: Câu hỏi trắc nghiệm trả lời ngắn</h4>
                          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Thí sinh điền đáp án bằng số cụ thể vào các ô trống tương ứng (Làm tròn tối đa 2 số thập phân).</p>
                        </div>
                      )
                    }

                    return (
                      <div key={idx} className="space-y-4">
                        {sectionHeader}

                        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                          <div className="w-fit px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                            Câu {idx + 1}
                          </div>

                          <div className="text-sm font-medium leading-relaxed overflow-x-auto custom-scrollbar">
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <p className="m-0" {...props} />, strong: ({node, ...props}: any) => <strong className="font-semibold" style={{ color: 'var(--accent)' }} {...props} /> }}>
                              {q.question}
                            </ReactMarkdown>
                          </div>

                          {currentType === 'choice' && q.options && (
                            <div className="space-y-2.5 pt-2">
                              {q.options.map((opt: string) => {
                                const letter = opt.trim().charAt(0).toUpperCase()
                                const isSel = userAnswers[idx] === letter
                                return (
                                  <button
                                    key={opt} type="button" disabled={isSubmitted}
                                    onClick={() => setUserAnswers({ ...userAnswers, [idx]: letter })}
                                    className="w-full p-4 rounded-xl text-xs font-medium text-left transition-colors flex items-center gap-4"
                                    style={isSel ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)' } : { background: 'var(--bg)', border: '1px solid var(--border)' }}
                                  >
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-semibold shrink-0" style={isSel ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)' }}>{letter}</div>
                                    <span className="flex-1 overflow-x-auto custom-scrollbar"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{opt.substring(2)}</ReactMarkdown></span>
                                    {(isSubmitted || alwaysShowExplain) && q.answer === letter && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }}/>}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {currentType === 'true_false' && q.subQuestions && (
                            <div className="space-y-2.5 pt-2">
                              {q.subQuestions.map((sub: any, subIdx: number) => {
                                const currentAns = userAnswers[`${idx}_${subIdx}`]
                                return (
                                  <div key={subIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl text-xs font-medium" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                    <span className="overflow-x-auto custom-scrollbar"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{sub.text}</ReactMarkdown></span>
                                    <div className="flex gap-2 shrink-0">
                                      <button type="button" disabled={isSubmitted} onClick={() => setUserAnswers({ ...userAnswers, [`${idx}_${subIdx}`]: true })} className="px-4 py-1.5 rounded-lg text-[11px] font-semibold" style={currentAns === true ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)' }}>Đúng</button>
                                      <button type="button" disabled={isSubmitted} onClick={() => setUserAnswers({ ...userAnswers, [`${idx}_${subIdx}`]: false })} className="px-4 py-1.5 rounded-lg text-[11px] font-semibold" style={currentAns === false ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)' }}>Sai</button>
                                      {(isSubmitted || alwaysShowExplain) && <span className="px-2 py-1 rounded-md text-[10px] font-semibold uppercase" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{sub.answer ? 'Đúng' : 'Sai'}</span>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {currentType === 'short_answer' && (
                            <div className="pt-2 space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                  {[0, 1, 2, 3].map(boxIdx => {
                                    const char = String(userAnswers[idx] || '')[boxIdx] || ''
                                    return (
                                      <div key={boxIdx} className="w-9 h-11 rounded-lg flex items-center justify-center font-semibold text-sm" style={{ background: 'var(--bg)', border: '2px solid var(--border)', color: 'var(--accent)' }}>{char}</div>
                                    )
                                  })}
                                </div>
                                <input
                                  type="text" maxLength={4} disabled={isSubmitted}
                                  value={userAnswers[idx] || ''} onChange={(e) => setUserAnswers({ ...userAnswers, [idx]: e.target.value })}
                                  placeholder="Gõ số..." className="rounded-xl px-3 py-2 text-xs font-medium outline-none w-28 bg-transparent"
                                  style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                                />
                              </div>
                              {(isSubmitted || alwaysShowExplain) && <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Đáp án chuẩn: <span className="px-2 py-1 rounded-md font-mono" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{q.answer}</span></div>}
                            </div>
                          )}

                          {(isSubmitted || alwaysShowExplain) && q.explain && (
                            <div className="p-4 rounded-2xl text-xs font-medium mt-2 leading-relaxed" style={{ background: 'var(--accent-soft)', color: 'var(--text)' }}>
                              <span className="block uppercase font-semibold text-[10px] tracking-widest mb-1" style={{ color: 'var(--accent)' }}>Lời giải chi tiết từ SenAI:</span>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explain}</ReactMarkdown>
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="lg:col-span-4 sticky top-[96px] space-y-5">
                  <div className="rounded-2xl p-6 text-center space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest flex items-center justify-center gap-1.5" style={{ color: 'var(--text-muted)' }}><Clock className="w-3.5 h-3.5"/> Thời gian còn lại</p>
                      <p className="text-4xl font-semibold font-mono transition-colors" style={{ color: timeLeft < 60 && !isSubmitted ? '#e11d48' : 'var(--text)' }}>
                        {isSubmitted ? 'Đã nộp bài' : formatTimeLeft(timeLeft)}
                      </p>
                      <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Tổng thời gian cài đặt: {selectedExam.duration} phút</p>
                    </div>

                    <div className="text-left text-xs font-medium leading-relaxed p-4 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm <strong>Nộp bài</strong> để xem điểm và giải thích chi tiết.
                    </div>

                    {isSubmitted && (
                      <div className="p-4 rounded-2xl" style={{ background: 'var(--accent-soft)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Kết quả thi</p>
                        <p className="text-3xl font-semibold" style={{ color: 'var(--accent)' }}>{String(scoreResult).replace('.', ',')} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ 10 Điểm</span></p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {!isSubmitted ? (
                        <button onClick={handleScoreQuiz} className="w-full font-semibold py-4 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98]" style={{ background: 'var(--accent)', color: '#fff' }}>
                          Nộp bài thi
                        </button>
                      ) : (
                        <button onClick={()=>{ setUserAnswers({}); setIsSubmitted(false); setTimeLeft(selectedExam.duration * 60); }} className="w-full font-semibold py-4 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98]" style={{ background: 'var(--accent)', color: '#fff' }}>
                          Làm lại bài thi
                        </button>
                      )}
                      <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setCurrentView('form'); }} className="w-full py-3.5 rounded-2xl font-semibold text-xs uppercase tracking-wider transition-colors" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        Thoát phòng thi
                      </button>
                    </div>

                    <div className="pt-3 flex items-center justify-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <input
                        type="checkbox" id="show_exp_modern" checked={alwaysShowExplain}
                        onChange={(e)=>setAlwaysShowExplain(e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <label htmlFor="show_exp_modern" className="text-xs font-medium cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>Hiện đáp án & Giải thích luôn</label>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Sparkles className="w-5 h-5"/></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI Tokens</p>
                      <p className="font-semibold text-xs mt-0.5">3,44M còn lại</p>
                    </div>
                  </div>
                </div>

              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-24 transition-colors duration-500">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-indigo-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER BAR */}
      <header className="h-[80px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-40 shadow-sm justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => { currentView === 'quiz' ? setCurrentView('form') : router.push('/dashboard') }} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
          <div>
            <h1 className="font-black text-xl flex items-center gap-2 text-slate-900 dark:text-white"><FileCode className="text-indigo-500 w-5 h-5"/> SenTạoBài</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Biên soạn khảo thí AI phối hợp</p>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        
        {currentView === 'form' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* TRÁI: FORM ĐIỀN THÔNG SỐ TRỘN ĐỀ */}
            <form onSubmit={handleGenerateExam} className="lg:col-span-7 space-y-6">
              
              {/* Box 1: Dán nội dung trực tiếp */}
              <div className={`${mdCard} p-6 md:p-8 space-y-5`}>
                <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2 tracking-widest"><UploadCloud className="w-4 h-4"/> Dán nội dung trực tiếp</h3>
                <div className="bg-amber-50/50 dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5 rounded-2xl p-4 relative">
                  <textarea 
                    value={directText} onChange={e => setDirectText(e.target.value)}
                    placeholder="Dán đoạn văn, bài học, ghi chú hoặc nội dung cần tạo đề thi..." 
                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 h-32 resize-none leading-relaxed"
                  />
                </div>

                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="px-5 py-2.5 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 font-black text-xs rounded-full border border-orange-200/30 flex items-center gap-2 cursor-pointer relative hover:scale-105 transition-transform shadow-sm">
                      <input type="file" accept=".pdf,image/*" multiple onChange={e=>setUploadFiles(Array.from(e.target.files||[]))} className="absolute inset-0 opacity-0 cursor-pointer"/>
                      <UploadCloud className="w-4 h-4"/> Tải lên file từ máy
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">Hỗ trợ PDF, Ảnh. Tổng nguồn tối đa 100 MB.</p>
                  {attachedFiles.length > 0 && (
                    <div className="text-left bg-slate-50 dark:bg-[#151515] p-3 rounded-xl max-h-20 overflow-y-auto custom-scrollbar text-xs font-bold text-slate-400 space-y-1">{attachedFiles.map(f => <div key={f.name}>📄 {f.name}</div>)}</div>
                  )}
                  <div className="w-full bg-slate-100 dark:bg-[#202020] rounded-full h-8 flex items-center px-4 border border-slate-200 dark:border-white/5 shadow-inner justify-between text-[11px] font-black text-slate-500">
                    <span>Tổng dung lượng nguồn:</span><span>{attachedFiles.length > 0 ? `${(attachedFiles.reduce((s,f)=>s+f.size,0)/1024).toFixed(1)} KB` : '0 KB'} / 100 MB</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Thông số cấu hình trộn đề */}
              <div className={`${mdCard} p-6 md:p-8 space-y-5`}>
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><Settings2 className="w-4 h-4"/> Cấu hình tạo đề thi</h3>
                
                <div>
                  <label className={labelClass}>Tiêu đề đề thi</label>
                  <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nhập tiêu đề đề thi tự động..." className={mdInput} required />
                </div>
                <div>
                  <label className={labelClass}>Mô tả đề thi</label>
                  <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Mô tả tóm tắt..." className={`${mdInput} h-20 resize-none`} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Thời gian làm bài (Tối đa 10000 phút)</label>
                    <input 
                      type="number" min={1} max={10000}
                      value={duration} 
                      onChange={e=>setDuration(Math.min(10000, Math.max(1, Number(e.target.value))))} 
                      className={mdInput}
                      placeholder="Nhập số phút..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Số lượng câu hỏi (Tối đa 100 câu)</label>
                    <input 
                      type="number" min={1} max={100} 
                      value={numQuestions} 
                      onChange={e=>setNumQuestions(Math.min(100, Math.max(1, Number(e.target.value))))} 
                      className={mdInput}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Độ khó</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value as DifficultyType)} className={mdInput + " !py-[18px] font-black"}>
                    <option value="easy">Cơ bản</option><option value="medium">Trung bình</option><option value="hard">Nâng cao</option>
                  </select></div>
                  <div><label className={labelClass}>Ngôn ngữ</label><select className={mdInput + " !py-[18px] font-black"} disabled><option>Tiếng Việt</option></select></div>
                </div>

                <div>
                  <label className={labelClass}>Dạng câu hỏi mục tiêu (Có thể chọn nhiều)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {type: 'choice', text: 'Trắc nghiệm ABCD'}, {type: 'true_false', text: 'Đúng / Sai (4 ý)'}, {type: 'short_answer', text: 'Trả lời ngắn (Điền ô)'}
                    ].map(item => {
                      const isSelected = qTypes.includes(item.type as QuestionType)
                      return (
                        <button key={item.type} type="button" onClick={() => handleToggleQType(item.type as QuestionType)} className={`p-4 rounded-xl border-2 text-xs font-black transition-all flex items-center justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-200 dark:border-white/5 bg-white/50'}`}>
                          <span>{item.text}</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{isSelected && <Check className="w-2.5 h-2.5 text-white"/>}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {genStatus.active && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-2xl flex items-center gap-3 animate-pulse text-xs font-black text-indigo-600"><Loader2 className="w-4 h-4 animate-spin"/>{genStatus.msg}</div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button type="button" onClick={()=>router.push('/dashboard')} className="px-6 py-3.5 bg-slate-100 dark:bg-[#202020] rounded-xl font-black text-xs uppercase tracking-wider">Hủy bỏ</button>
                  <button type="submit" disabled={genStatus.active} className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 shadow-md">Tạo đề thi phối hợp</button>
                </div>
              </div>
            </form>

            {/* KHO LƯU TRỮ LỊCH SỬ ĐỀ */}
            <div className="lg:col-span-5 h-[550px] lg:h-[700px] flex flex-col gap-6">
              <div className={`${mdCard} p-6 md:p-8 flex flex-col h-full`}>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2"><Calendar className="w-4 h-4"/> Đề thi tự tạo của bạn ({createdExams.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  {createdExams.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4"><BookOpen className="w-12 h-12 mb-3 text-slate-300"/><p className="font-black text-sm">Kho lưu trữ trống</p></div>
                  ) : (
                    createdExams.map(ex => (
                      <div key={ex.id} onClick={()=>{ setSelectedExam(ex); setUserAnswers({}); setIsSubmitted(false); setTimeLeft(ex.duration * 60); setCurrentView('quiz'); }} className="p-4 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all flex justify-between items-center group">
                        <div className="min-w-0 pr-4">
                          <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 truncate">{ex.title}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{ex.createdAt} • {ex.duration} phút • {ex.questions.length} câu</p>
                        </div>
                        <button onClick={(e)=>{e.stopPropagation(); handleDeleteExam(ex.id, e)}} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ==================================================================
          // 🌟 GIAO DIỆN PHÒNG THI CHIA PHẦN ĐỘC LẬP CHUẨN KHẢO THÍ MỚI
          // ==================================================================
          selectedExam && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto">
              
              <div className="lg:col-span-8 space-y-5">
                
                {/* HIỂN THỊ HỘP NĂNG LỰC KNOWLEDGE BASE ĐÃ ĐƯỢC AI DỊCH VÀ LƯU TRỮ TẠI CHỖ */}
                {selectedExam.knowledgeBase && (selectedExam.knowledgeBase.formulas?.length > 0 || selectedExam.knowledgeBase.definitions?.length > 0) && (
                  <div className={`${mdCard} p-6 border-l-4 border-amber-500 rounded-r-2xl space-y-3`}>
                    <h4 className="font-black text-xs uppercase tracking-widest text-amber-600 flex items-center gap-2"><Database className="w-4 h-4"/> Cơ sở công thức lõi SenAI đã nạp từ PDF</h4>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pt-1">
                      {selectedExam.knowledgeBase.formulas?.map((f, i) => (
                        <span key={i} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-mono border border-amber-200/30">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{f}</ReactMarkdown>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[1.5rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{selectedExam.title}</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1.5">{selectedExam.description}</p>
                  </div>
                </div>

                {/* VÒNG LẶP RENDER CÂU HỎI TỰ ĐỘNG CHÈN BANNER PHẦN THI CHUYÊN BIỆT */}
                {selectedExam.questions.map((q, idx) => {
                  const currentType = q.type || selectedExam.types[0]
                  let sectionHeader = null

                  if (currentType === 'choice' && !renderedChoiceHeader) {
                    renderedChoiceHeader = true
                    sectionHeader = (
                      <div className="p-5 bg-gradient-to-r from-indigo-500/10 to-transparent border-l-4 border-indigo-500 rounded-r-2xl my-4 animate-in fade-in">
                        <h4 className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (ABCD)</h4>
                        <p className="text-[11px] font-bold text-slate-400 mt-1">Mỗi câu hỏi thí sinh chỉ chọn một phương án trả lời duy nhất.</p>
                      </div>
                    )
                  } else if (currentType === 'true_false' && !renderedTrueFalseHeader) {
                    renderedTrueFalseHeader = true
                    sectionHeader = (
                      <div className="p-5 bg-gradient-to-r from-rose-500/10 to-transparent border-l-4 border-rose-500 rounded-r-2xl my-4 animate-in fade-in">
                        <h4 className="font-black text-xs uppercase tracking-widest text-rose-600 dark:text-rose-400">Phần II: Câu hỏi trắc nghiệm Đúng / Sai</h4>
                        <p className="text-[11px] font-bold text-slate-400 mt-1">Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.</p>
                      </div>
                    )
                  } else if (currentType === 'short_answer' && !renderedShortHeader) {
                    renderedShortHeader = true
                    sectionHeader = (
                      <div className="p-5 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-emerald-500 rounded-r-2xl my-4 animate-in fade-in">
                        <h4 className="font-black text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Phần III: Câu hỏi trắc nghiệm trả lời ngắn</h4>
                        <p className="text-[11px] font-bold text-slate-400 mt-1">Thí sinh điền đáp án bằng số cụ thể vào các ô trống tương ứng (Làm tròn tối đa 2 số thập phân).</p>
                      </div>
                    )
                  }

                  return (
                    <div key={idx} className="space-y-4">
                      {sectionHeader}
                      
                      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[1.75rem] p-6 shadow-sm space-y-4 animate-in fade-in">
                        
                        <div className="w-fit px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Câu {idx + 1}
                        </div>

                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto custom-scrollbar">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <p className="m-0" {...props} />, strong: ({node, ...props}: any) => <strong className="font-black text-indigo-500" {...props} /> }}>
                            {q.question}
                          </ReactMarkdown>
                        </div>

                        {/* 1. RENDER FORM TRẮC NGHIỆM ABCD */}
                        {currentType === 'choice' && q.options && (
                          <div className="space-y-2.5 pt-2">
                            {q.options.map((opt: string) => {
                              const letter = opt.trim().charAt(0).toUpperCase()
                              const isSel = userAnswers[idx] === letter
                              return (
                                <button 
                                  key={opt} type="button" disabled={isSubmitted}
                                  onClick={() => setUserAnswers({ ...userAnswers, [idx]: letter })}
                                  className={`w-full p-4 rounded-xl text-xs font-bold text-left border transition-all flex items-center gap-4 ${isSel ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-950/30' : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/5 hover:bg-slate-50'}`}
                                >
                                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-black shrink-0 ${isSel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-[#252525] border-slate-300'}`}>{letter}</div>
                                  <span className="flex-1 overflow-x-auto custom-scrollbar"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{opt.substring(2)}</ReactMarkdown></span>
                                  {(isSubmitted || alwaysShowExplain) && q.answer === letter && <Check className="w-4 h-4 text-emerald-500 shrink-0"/>}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* 2. RENDER FORM ĐÚNG SAI CHUẨN KHẢO THÍ MỚI */}
                        {currentType === 'true_false' && q.subQuestions && (
                          <div className="space-y-2.5 pt-2">
                            {q.subQuestions.map((sub: any, subIdx: number) => {
                              const currentAns = userAnswers[`${idx}_${subIdx}`]
                              return (
                                <div key={subIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-[#1A1A1A] rounded-xl border border-slate-100 dark:border-white/5 text-xs font-bold">
                                  <span className="text-slate-700 dark:text-slate-300 overflow-x-auto custom-scrollbar"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{sub.text}</ReactMarkdown></span>
                                  <div className="flex gap-2 shrink-0">
                                    <button type="button" disabled={isSubmitted} onClick={() => setUserAnswers({ ...userAnswers, [`${idx}_${subIdx}`]: true })} className={`px-4 py-1.5 rounded-lg border text-[11px] font-black ${currentAns === true ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#252525] border-slate-200'}`}>Đúng</button>
                                    <button type="button" disabled={isSubmitted} onClick={() => setUserAnswers({ ...userAnswers, [`${idx}_${subIdx}`]: false })} className={`px-4 py-1.5 rounded-lg border text-[11px] font-black ${currentAns === false ? 'bg-rose-600 text-white' : 'bg-white dark:bg-[#252525] border-slate-200'}`}>Sai</button>
                                    {(isSubmitted || alwaysShowExplain) && <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${sub.answer ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{sub.answer ? 'Đúng' : 'Sai'}</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 3. RENDER FORM 4 Ô ĐIỀN RỜI TRẢ LỜI NGẮN */}
                        {currentType === 'short_answer' && (
                          <div className="pt-2 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[0, 1, 2, 3].map(boxIdx => {
                                  const char = String(userAnswers[idx] || '')[boxIdx] || ''
                                  return (
                                    <div key={boxIdx} className="w-9 h-11 rounded-lg bg-slate-50 dark:bg-[#1A1A1A] border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-sm text-indigo-600 shadow-inner">{char}</div>
                                  )
                                })}
                              </div>
                              <input 
                                type="text" maxLength={4} disabled={isSubmitted}
                                value={userAnswers[idx] || ''} onChange={(e) => setUserAnswers({ ...userAnswers, [idx]: e.target.value })}
                                placeholder="Gõ số..." className="bg-slate-100 dark:bg-[#202020] border rounded-xl px-3 py-2 text-xs font-bold outline-none w-28 focus:border-indigo-500"
                              />
                            </div>
                            {(isSubmitted || alwaysShowExplain) && <div className="text-xs font-black text-slate-400">Đáp án chuẩn: <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-mono">{q.answer}</span></div>}
                          </div>
                        )}

                        {/* Giải thích lời giải chi tiết */}
                        {(isSubmitted || alwaysShowExplain) && q.explain && (
                          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-2 leading-relaxed">
                            <span className="block uppercase font-black text-[10px] tracking-widest text-indigo-500 mb-1">Lời giải chi tiết từ SenAI:</span>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explain}</ReactMarkdown>
                          </div>
                        )}

                      </div>
                    </div>
                  )
                })}
              </div>

              {/* KHUNG PHẢI: KHOẢNG ĐIỀU KHIỂN CỐ ĐỊNH CHẠY TIMER */}
              <div className="lg:col-span-4 sticky top-[104px] space-y-5">
                <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-center space-y-5 shadow-sm">
                  
                  {/* Hiển thị đồng hồ đếm ngược thời gian thực */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Thời gian còn lại</p>
                    <p className={`text-4xl font-black font-mono transition-colors ${timeLeft < 60 && !isSubmitted ? 'text-rose-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>
                      {isSubmitted ? 'Đã nộp bài' : formatTimeLeft(timeLeft)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">Tổng thời gian cài đặt: {selectedExam.duration} phút</p>
                  </div>

                  <div className="text-left text-xs font-medium text-slate-500 leading-relaxed bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm <strong>Nộp bài</strong> để xem điểm và giải thích chi tiết.
                  </div>

                  {isSubmitted && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-2xl animate-in zoom-in-95">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kết quả thi</p>
                      <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{String(scoreResult).replace('.', ',')} <span className="text-xs text-slate-400">/ 10 Điểm</span></p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {!isSubmitted ? (
                      <button onClick={handleScoreQuiz} className="w-full bg-[#1e3e37] hover:bg-[#152a25] text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]">
                        Nộp bài thi
                      </button>
                    ) : (
                      <button onClick={()=>{ setUserAnswers({}); setIsSubmitted(false); setTimeLeft(selectedExam.duration * 60); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]">
                        Làm lại bài thi
                      </button>
                    )}
                    <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setCurrentView('form'); }} className="w-full bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-colors">
                      Thoát phòng thi
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-center gap-2">
                    <input 
                      type="checkbox" id="show_exp" checked={alwaysShowExplain} 
                      onChange={(e)=>setAlwaysShowExplain(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="show_exp" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">Hiện đáp án & Giải thích luôn</label>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500 shadow-inner"><Sparkles className="w-5 h-5"/></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Tokens</p>
                    <p className="font-black text-xs text-slate-800 dark:text-slate-200 mt-0.5">3,44M còn lại</p>
                  </div>
                </div>
              </div>

            </div>
          )
        )}
      </div>
    </div>
  )
}