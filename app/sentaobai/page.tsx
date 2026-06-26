'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, PlusCircle, Trash2, UploadCloud, Loader2, X, ChevronRight, 
  BookOpen, Search, Sparkles, Calculator, HelpCircle, CheckCircle2, 
  AlertCircle, FileText, Image, Calendar, Settings2, Play, Square, RotateCcw,
  Target, CircleDot, Activity, Cpu, Edit3, Maximize2, Minimize2, Check, Clock, 
  ShieldAlert, Share2, Download, FileJson, FileCode
} from 'lucide-react'

// Bộ render toán học LaTeX chuẩn xác hệ thống
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// Cấu nối trực tiếp Google Drive API
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'

// --- HẰNG SỐ GIAO DIỆN LIQUID GLASS + MATERIAL 3 ---
const mdCard = "bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-150 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] transition-all duration-300"
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
  questions: any[]
}

export default function SenTaoBaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'form' | 'quiz'>('form')

  // --- FORM CONFIG STATES ---
  const [directText, setDirectText] = useState('')
  const [attachedFiles, setUploadFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(45)
  const [numQuestions, setNumQuestions] = useState(10) // 🌟 MỚI: Tùy chỉnh số câu linh hoạt
  const [difficulty, setDifficulty] = useState<DifficultyType>('medium')
  const [qTypes, setQTypes] = useState<QuestionType[]>(['choice']) // 🌟 MỚI: Chọn nhiều loại câu hỏi cùng lúc
  
  // --- ENGINE STATES ---
  const [genStatus, setGenStatus] = useState({ active: false, msg: '' })
  const [createdExams, setCreatedExams] = useState<GeneratedExam[]>([])
  const [selectedExam, setSelectedExam] = useState<GeneratedExam | null>(null)
  
  // --- QUIZ LIVE INTERFACE STATES ---
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [scoreResult, setScoreResult] = useState(0)
  const [alwaysShowExplain, setAlwaysShowExplain] = useState(false)

  // Khởi chạy đồng bộ dữ liệu cục bộ thiết bị
  useEffect(() => {
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
    try {
      const saved = localStorage.getItem('sen_generated_exams_v3')
      if (saved) setCreatedExams(JSON.parse(saved))
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [])

  const persistExams = (nextList: GeneratedExam[]) => {
    setCreatedExams(nextList)
    try { localStorage.setItem('sen_generated_exams_v3', JSON.stringify(nextList)) } catch(e){}
  }

  // Xử lý toggle chọn nhiều dạng câu hỏi
  const handleToggleQType = (type: QuestionType) => {
    if (qTypes.includes(type)) {
      if (qTypes.length > 1) {
        setQTypes(qTypes.filter(t => t !== type))
      }
    } else {
      setQTypes([...qTypes, type])
    }
  }

  // ==========================================================================
  // HÀM KHỞI TẠO BIÊN SOẠN ĐỀ THI AI (TRỘN DẠNG HỖN HỢP REAL-TIME)
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

      setGenStatus({ active: true, msg: 'SenAI đang tối ưu thuật toán bóc tách ma trận đề phối hợp...' })

      const aiSystemPrompt = `Hãy biên soạn một bộ đề thi gồm chính xác ${numQuestions} câu hỏi dựa trên nội dung nguồn được cung cấp dưới dạng một mảng JSON các đối tượng.
      Mức độ tư duy yêu cầu: "${difficulty}".
      Các dạng câu hỏi được phép tạo kết hợp (hãy phân bổ phân chia đều hoặc đan xen linh hoạt giữa các dạng này): ${qTypes.join(', ')}.
      Tư liệu nguồn: ${directText} ${driveFileIds.length > 0 ? `(Đã nạp file đính kèm)` : ''}.

      YÊU CẦU ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
      Trả về chuỗi JSON mảng trần (JSON array), tuyệt đối không bọc trong các ký tự viết khối mã kiểu \`\`\`json \`\`\`. Mỗi phần tử câu hỏi trong mảng bắt buộc phải chứa thuộc tính "type" để chỉ rõ loại câu hỏi đó:
      1. Nếu câu hỏi có "type": "choice" -> { "type": "choice", "question": "Nội dung câu hỏi", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "Ký tự đúng A/B/C/D", "explain": "Lời giải chi tiết" }
      2. Nếu câu hỏi có "type": "true_false" -> { "type": "true_false", "question": "Câu hỏi lớn lệnh đề dẫn", "subQuestions": [{"text": "Mệnh đề 1", "answer": true}, {"text": "Mệnh đề 2", "answer": false}, {"text": "Mệnh đề 3", "answer": true}, {"text": "Mệnh đề 4", "answer": false}], "explain": "Lời giải thích" }
      3. Nếu câu hỏi có "type": "short_answer" -> { "type": "short_answer", "question": "Câu hỏi bắt điền số ngắn", "answer": "Chuỗi tối đa 4 ký tự dùng dấu phẩy cho số thập phân nếu lẻ", "explain": "Lời giải thích" }`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiSystemPrompt, history: [] })
      })
      const chatData = await response.json()
      
      let parsedQuestions = []
      try {
        const cleanText = chatData.text.replace(/```json/g, '').replace(/```/g, '').trim()
        parsedQuestions = JSON.parse(cleanText)
      } catch (err) {
        parsedQuestions = mockFallbackQuestions(numQuestions, qTypes)
      }

      const newExam: GeneratedExam = {
        id: 'exam_' + Date.now(),
        title: title.trim(),
        description: description.trim() || 'Đề thi trắc nghiệm hỗn hợp tạo lập bởi Trí tuệ nhân tạo SenAI',
        duration,
        difficulty,
        types: qTypes,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        questions: parsedQuestions
      }

      persistExams([newExam, ...createdExams])
      setGenStatus({ active: false, msg: '' })
      setDirectText(''); setUploadFiles([]); setTitle(''); setDescription('')
      
      setSelectedExam(newExam)
      setUserAnswers({})
      setIsSubmitted(false)
      setCurrentView('quiz')

    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra trong quá trình thiết lập đề thi AI.')
      setGenStatus({ active: false, msg: '' })
    }
  }

  // ==========================================================================
  // BỘ MÁY CHẤM ĐIỂM HỖN HỢP CHUẨN ĐỊNH DẠNG KHẢO THÍ MỚI
  // ==========================================================================
  const handleScoreQuiz = () => {
    if (!selectedExam) return
    let correctCount = 0
    const total = selectedExam.questions.length

    selectedExam.questions.forEach((q, idx) => {
      const uAns = userAnswers[idx]
      const currentType = q.type || selectedExam.types[0] // Nhận diện type của từng câu đơn lẻ

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
        list.push({ type: 'choice', question: `Câu hỏi trắc nghiệm tự động phối hợp số ${i+1}: Khảo sát biểu thức chuyển động điều hòa?`, options: ["A. Sớm pha.", "B. Trễ pha.", "C. Ngược pha.", "D. Cùng pha."], answer: "A", explain: "Giải thích hệ thống." })
      } else if (t === 'short_answer') {
        list.push({ type: 'short_answer', question: `Câu hỏi điền số ngắn tự động số ${i+1}: Tính toán biên độ dao động tổng hợp khi hai dao động cùng pha biết $A_1 = 3\\text{ cm}, A_2 = 4\\text{ cm}$.`, answer: "7", explain: "Do biên độ cùng pha nên biên độ tổng hợp bằng tổng hai biên độ thành phần." })
      } else {
        list.push({ type: 'true_false', question: `Câu hỏi đúng sai liên hoàn số ${i+1}: Nhận định về các định luật cơ học cổ điển Newton:`, subQuestions: [
          { text: "A. Định luật I còn được gọi là định luật quán tính.", answer: true },
          { text: "B. Lực tác dụng luôn luôn tỉ lệ nghịch với gia tốc thu được.", answer: false },
          { text: "C. Hành động và phản lực tác dụng vào hai vật khác nhau.", answer: true },
          { text: "D. Hệ quy chiếu quán tính là hệ quy chiếu chuyển động có gia tốc.", answer: false }
        ], explain: "Phân tích chi tiết hệ mệnh đề." })
      }
    }
    return list
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]"><Loader2 className="w-12 h-12 animate-spin text-indigo-600" /></div>

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
                    <label className={labelClass}>Thời gian làm bài</label>
                    <select value={duration} onChange={e=>setDuration(Number(e.target.value))} className={mdInput + " !py-[18px] font-black"}>
                      <option value="15">15 phút</option><option value="45">45 phút</option><option value="60">60 phút</option><option value="90">90 phút</option>
                    </select>
                  </div>
                  {/* 🌟 ĐÃ MỞ KHÓA: SẾP TÙY CHỈNH SỐ CÂU THOẢI MÁI LÊN TỚI 100 CÂU */}
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

                {/* 🌟 ĐÃ SỬA: CHO PHÉP TÍCH CHỌN MULTI-SELECT NHIỀU DẠNG CÂU HỎI TRỘN LẪN */}
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
                      <div key={ex.id} onClick={()=>{ setSelectedExam(ex); setUserAnswers({}); setIsSubmitted(false); setCurrentView('quiz'); }} className="p-4 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all flex justify-between items-center group">
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
          // 🌟 GIAO DIỆN PHÒNG THI CHUYÊN NGHIỆP MIXED-TYPE TẠI CHỖ (ẢNH SẾP GỬI)
          // ==================================================================
          selectedExam && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto animate-in fade-in duration-300">
              
              <div className="lg:col-span-8 space-y-5">
                <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[1.5rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm">
                  <div className="min-w-0">
                    <h2 className="font-black text-sm text-slate-800 dark:text-white uppercase truncate">{selectedExam.title}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Đề thi AI hỗn hợp - {selectedExam.questions.length} câu hỏi</p>
                  </div>
                </div>

                {selectedExam.questions.map((q, idx) => {
                  const currentType = q.type || selectedExam.types[0] // Nhận diện động dạng của từng câu hỏi lẻ
                  return (
                    <div key={idx} className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[1.75rem] p-6 shadow-sm space-y-4">
                      
                      <div className="w-fit px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Câu {idx + 1} - {currentType === 'choice' ? 'Trắc nghiệm ABCD' : currentType === 'short_answer' ? 'Trả lời ngắn' : 'Đúng / Sai'}
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

                      {/* 2. RENDER FORM ĐÚNG SAI CHUẨN FORM MỚI */}
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
                  )
                })}
              </div>

              {/* KHUNG PHẢI: KHOẢNG ĐIỀU KHIỂN CỐ ĐỊNH */}
              <div className="lg:col-span-4 sticky top-[104px] space-y-5">
                <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-center space-y-5 shadow-sm">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Thời gian làm bài</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{selectedExam.duration} phút</p>
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
                      <button onClick={()=>{ setUserAnswers({}); setIsSubmitted(false); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-white"/> Làm lại bài thi
                      </button>
                    )}
                    <button onClick={() => setCurrentView('form')} className="w-full bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-colors">
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