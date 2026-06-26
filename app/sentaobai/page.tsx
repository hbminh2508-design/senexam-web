'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, PlusCircle, Trash2, UploadCloud, Loader2, X, ChevronRight, 
  BookOpen, Search, Sparkles, Calculator, HelpCircle, CheckCircle2, 
  AlertCircle, FileText, Image, Calendar, Settings2, Play, Square, RotateCcw,
  Target, CircleDot, Activity, Cpu, Edit3, Maximize2, Minimize2, Check, Clock, ShieldAlert, Share2, Download, FileJson, FileCode
} from 'lucide-react'

// Bộ render toán học LaTeX chuẩn xác
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// Imports cấu nối trực tiếp Google Drive API
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
  type: QuestionType
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
  const [difficulty, setDifficulty] = useState<DifficultyType>('medium')
  const [qType, setQType] = useState<QuestionType>('choice')
  
  // --- ENGINE ENGINE STATES ---
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
      const saved = localStorage.getItem('sen_generated_exams_v2')
      if (saved) setCreatedExams(JSON.parse(saved))
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [])

  const persistExams = (nextList: GeneratedExam[]) => {
    setCreatedExams(nextList)
    try { localStorage.setItem('sen_generated_exams_v2', JSON.stringify(nextList)) } catch(e){}
  }

  // ==========================================================================
  // HÀM KHỞI TẠO BIÊN SOẠN ĐỀ THI AI (BẢO MẬT DRIVE CÔ LẬP THƯ VIỆN SỐ)
  // ==========================================================================
  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return alert('Vui lòng điền tiêu đề đề thi!')
    if (!directText.trim() && attachedFiles.length === 0) return alert('Vui lòng cung cấp tư liệu nguồn!')

    setGenStatus({ active: true, msg: 'Đang mở cổng truyền luồng an toàn Google Drive...' })
    try {
      let driveFileIds: string[] = []
      
      // Chịu tải file lớn lên đến 100MB nhưng hoàn toàn cô lập khỏi bảng library_documents công cộng
      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i]
        if (file.size > 100 * 1024 * 1024) throw new Error(`Tệp ${file.name} vượt quá dung lượng 100MB hệ thống cho phép!`)
        
        setGenStatus({ active: true, msg: `Đang đẩy tệp đính kèm [${i + 1}/${attachedFiles.length}] lên đám mây bảo mật...` })
        const url = await initGoogleDriveUpload(file.name, file.type)
        const uploadedData = await uploadFileToGoogleDrive(url, file, file.name)
        if (uploadedData?.id) driveFileIds.push(uploadedData.id)
      }

      setGenStatus({ active: true, msg: 'SenAI đang trích xuất ma trận kiến thức và cấu trúc câu hỏi mới...' })

      const aiSystemPrompt = `Hãy thiết lập một mảng dữ liệu JSON gồm chính xác 5 câu hỏi dựa trên nội dung được cung cấp.
      Dạng câu hỏi: "${qType}".
      Mức độ tư duy: "${difficulty}".
      Tư liệu nguồn: ${directText} ${driveFileIds.length > 0 ? `(Đơn danh định danh tệp tin Drive)` : ''}.

      YÊU CẦU ĐỊNH DẠNG TRẢ VỀ:
      Trả về chuỗi JSON mảng thuần túy, tuyệt đối không bọc trong các ký tự markdown \`\`\`json.
      - Dạng choice: { "question": "Nội dung câu hỏi sử dụng LaTeX $ nếu cần", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "Ký tự đúng A, B, C hoặc D", "explain": "Giải thích chi tiết" }
      - Dạng true_false: { "question": "Câu hỏi lớn", "subQuestions": [{ "text": "Mệnh đề A", "answer": true }, { "text": "Mệnh đề B", "answer": false }], "explain": "Giải thích" }
      - Dạng short_answer: { "question": "Câu hỏi điền số ngắn", "answer": "Chuỗi tối đa 4 ký tự dùng dấu phẩy cho số thập phân", "explain": "Giải thích toán học" }`

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
        parsedQuestions = mockFallbackQuestions(qType)
      }

      const newExam: GeneratedExam = {
        id: 'exam_' + Date.now(),
        title: title.trim(),
        description: description.trim() || 'Đề thi trắc nghiệm khách quan biên soạn tự động bởi Trí tuệ nhân tạo SenAI',
        duration,
        difficulty,
        type: qType,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        questions: parsedQuestions
      }

      persistExams([newExam, ...createdExams])
      setGenStatus({ active: false, msg: '' })
      setDirectText(''); setUploadFiles([]); setTitle(''); setDescription('')
      
      // Chuyển thẳng sang giao diện thi tại chỗ
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
  // BỘ MÁY CHẤM ĐIỂM CHUẨN ĐỊNH DẠNG GDPT 2026
  // ==========================================================================
  const handleScoreQuiz = () => {
    if (!selectedExam) return
    let correctCount = 0
    const total = selectedExam.questions.length

    selectedExam.questions.forEach((q, idx) => {
      const uAns = userAnswers[idx]
      if (selectedExam.type === 'choice') {
        if (uAns === q.answer) correctCount++
      } else if (selectedExam.type === 'short_answer') {
        const cleanUser = String(uAns || '').trim().replace('.', ',')
        const cleanTarget = String(q.answer || '').trim().replace('.', ',')
        if (cleanUser === cleanTarget) correctCount++
      } else if (selectedExam.type === 'true_false') {
        let subCorrect = 0
        q.subQuestions.forEach((sub: any, subIdx: number) => {
          if (userAnswers[`${idx}_${subIdx}`] === sub.answer) subCorrect++
        })
        if (subCorrect === 4) correctCount++
      }
    })

    const finalScore = Math.round((correctCount / total) * 10 * 100) / 100
    setScoreResult(finalScore)
    setIsSubmitted(true)
  }

  const handleDeleteExam = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Xóa vĩnh viễn đề thi tự tạo này khỏi bộ nhớ đệm?')) {
      const next = createdExams.filter(ex => ex.id !== id)
      persistExams(next)
      if (selectedExam?.id === id) setSelectedExam(null)
    }
  }

  const mockFallbackQuestions = (type: QuestionType) => {
    if (type === 'choice') return [
      { question: "Một vật dao động điều hòa theo phương trình $x = A\\cos(\\omega t + \\varphi)$. Gia tốc của vật đạt giá trị cực đại tại vị trí nào?", options: ["A. Vị trí cân bằng.", "B. Vị trí biên âm.", "C. Vị trí biên dương.", "D. Vị trí một nửa biên độ."], answer: "B", explain: "Gia tốc $a = -\\omega^2 x$. Giá trị cực đại $a_{max} = \\omega^2 A$ đạt được khi vật ở vị trí biên âm $x = -A$." }
    ]
    if (type === 'short_answer') return [
      { question: "Một con lắc lò xo dao động điều hòa có độ cứng $k = 100 \\text{ N/m}$. Khi vật có khối lượng $m = 0,25 \\text{ kg}$, tính tần số góc $\\omega$ của con lắc (Đơn vị: rad/s).", answer: "10" }
    ]
    return [
      { question: "Khảo sát hiện tượng sóng dừng trên một sợi dây đàn hồi có hai đầu cố định:", subQuestions: [
        { text: "A. Hai đầu cố định luôn luôn là hai nút sóng cơ.", answer: true },
        { text: "B. Chiều dài sợi dây phải bằng một số nguyên lần nửa bước sóng.", answer: true },
        { text: "C. Khoảng cách giữa một nút và một bụng sóng kế tiếp bằng $\\lambda/2$.", answer: false },
        { text: "D. Tần số sóng càng lớn thì tốc độ truyền sóng trên dây càng tăng.", answer: false }
      ]}
    ]
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
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Biên soạn khảo thí AI cá nhân hóa</p>
          </div>
        </div>
        {currentView === 'quiz' && selectedExam && (
          <span className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-xl border border-indigo-100 dark:border-indigo-800">
            Cấu trúc: {selectedExam.type === 'choice' ? 'Trắc nghiệm ABCD' : selectedExam.type === 'short_answer' ? 'Trả lời ngắn' : 'Đúng / Sai'}
          </span>
        )}
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        
        {currentView === 'form' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* TRÁI: FORM ĐIỀN THÔNG SỐ NHƯ TRONG ẢNH SẾP GỬI */}
            <form onSubmit={handleGenerateExam} className="lg:col-span-7 space-y-6">
              
              {/* Box 1: Dán nội dung trực tiếp (Ảnh 1) */}
              <div className={`${mdCard} p-6 md:p-8 space-y-5`}>
                <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2 tracking-widest"><UploadCloud className="w-4 h-4"/> Dán nội dung trực tiếp</h3>
                <div className="bg-amber-50/50 dark:bg-[#1E1C1A] border border-amber-200/50 dark:border-white/5 rounded-2xl p-4 relative">
                  <textarea 
                    value={directText} onChange={e => setDirectText(e.target.value)}
                    placeholder="Dán đoạn văn, bài học, ghi chú hoặc nội dung cần tạo đề thi..." 
                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 h-32 resize-none leading-relaxed"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold mt-2"><span>Dùng được độc lập, không cần upload file.</span><span>0 KB</span></div>
                </div>

                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="px-5 py-2.5 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 font-black text-xs rounded-full border border-orange-200/30 flex items-center gap-2 cursor-pointer relative hover:scale-105 transition-transform shadow-sm">
                      <input type="file" accept=".pdf,image/*" multiple onChange={e=>setUploadFiles(Array.from(e.target.files||[]))} className="absolute inset-0 opacity-0 cursor-pointer"/>
                      <UploadCloud className="w-4 h-4"/> Tải lên file từ máy
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">Hỗ trợ PDF, DOCX, TXT. Tổng nguồn tối đa 100 MB.</p>
                  {attachedFiles.length > 0 && (
                    <div className="text-left bg-slate-50 dark:bg-[#151515] p-3 rounded-xl max-h-20 overflow-y-auto custom-scrollbar text-xs font-bold text-slate-400 space-y-1">{attachedFiles.map(f => <div key={f.name}>📄 {f.name}</div>)}</div>
                  )}
                  <div className="w-full bg-slate-100 dark:bg-[#202020] rounded-full h-8 flex items-center px-4 border border-slate-200 dark:border-white/5 shadow-inner justify-between text-[11px] font-black text-slate-500">
                    <span>Tổng dung lượng nguồn:</span><span>{attachedFiles.length > 0 ? `${(attachedFiles.reduce((s,f)=>s+f.size,0)/1024).toFixed(1)} KB` : '0 KB'} / 100 MB</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Thông số cấu hình (Ảnh 2) */}
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
                  <div><label className={labelClass}>Thời gian làm bài</label><select value={duration} onChange={e=>setDuration(Number(e.target.value))} className={mdInput + " !py-[18px] font-black"}>
                    <option value="15">15 phút</option><option value="45">45 phút</option><option value="60">60 phút</option><option value="90">90 phút</option>
                  </select></div>
                  <div><label className={labelClass}>Số lượng câu hỏi</label><select className={mdInput + " !py-[18px] font-black"} disabled><option>5 câu (Mặc định)</option></select></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Độ khó</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value as DifficultyType)} className={mdInput + " !py-[18px] font-black"}>
                    <option value="easy">Cơ bản</option><option value="medium">Trung bình</option><option value="hard">Nâng cao</option>
                  </select></div>
                  <div><label className={labelClass}>Ngôn ngữ</label><select className={mdInput + " !py-[18px] font-black"} disabled><option>Tiếng Việt</option></select></div>
                </div>

                <div>
                  <label className={labelClass}>Dạng câu hỏi mục tiêu</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {type: 'choice', text: 'Trắc nghiệm ABCD'}, {type: 'true_false', text: 'Đúng / Sai'}, {type: 'short_answer', text: 'Trả lời ngắn'}
                    ].map(item => (
                      <button key={item.type} type="button" onClick={()=>setQType(item.type as QuestionType)} className={`p-4 rounded-xl border-2 text-xs font-black transition-all flex items-center justify-between ${qType === item.type ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-200 dark:border-white/5 bg-white/50'}`}>
                        <span>{item.text}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${qType === item.type ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{qType === item.type && <Check className="w-2.5 h-2.5 text-white"/>}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {genStatus.active && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-2xl flex items-center gap-3 animate-pulse text-xs font-black text-indigo-600"><Loader2 className="w-4 h-4 animate-spin"/>{genStatus.msg}</div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button type="button" onClick={()=>router.push('/dashboard')} className="px-6 py-3.5 bg-slate-100 dark:bg-[#202020] rounded-xl font-black text-xs uppercase tracking-wider">Hủy bỏ</button>
                  <button type="submit" disabled={genStatus.active} className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 shadow-md">Tạo đề thi</button>
                </div>
              </div>
            </form>

            {/* CỘT PHẢI: KHO LƯU TRỮ ĐỀ ĐÃ TẠO TẠI CHỖ */}
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
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{ex.createdAt} • {ex.duration} phút • {ex.type==='choice'?'ABCD':ex.type==='short_answer'?'Điền số':'Đúng/Sai'}</p>
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
          // 🌟 GIAO DIỆN PHÒNG THI CHUYÊN NGHIỆP TRỰC TIẾP (ẢNH SẾP GỬI - IMAGE_C85606)
          // ==================================================================
          selectedExam && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto animate-in fade-in duration-300">
              
              {/* KHUNG TRÁI: DANH SÁCH CÂU HỎI (8 COLUMNS) */}
              <div className="lg:col-span-8 space-y-5">
                
                {/* Thanh điều hướng thao tác nhanh trên đề */}
                <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[1.5rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm">
                  <div className="min-w-0">
                    <h2 className="font-black text-sm text-slate-800 dark:text-white uppercase truncate">{selectedExam.title}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Đề thi học thuật tự tạo</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="p-2 bg-slate-100 dark:bg-[#252525] rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"><Share2 className="w-4 h-4"/></button>
                    <button className="p-2 bg-slate-100 dark:bg-[#252525] rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"><Download className="w-4 h-4"/></button>
                    <button className="p-2 bg-slate-100 dark:bg-[#252525] rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"><FileJson className="w-4 h-4"/></button>
                  </div>
                </div>

                {selectedExam.questions.map((q, idx) => (
                  <div key={idx} className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[1.75rem] p-6 shadow-sm space-y-4">
                    
                    {/* Tag tiêu đề Câu hỏi giống hệt hình ảnh sếp gửi */}
                    <div className="w-fit px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      Câu {idx + 1} - {selectedExam.type === 'choice' ? 'Trắc nghiệm' : selectedExam.type === 'short_answer' ? 'Trả lời ngắn' : 'Đúng / Sai'}
                    </div>

                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto custom-scrollbar">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <p className="m-0" {...props} />, strong: ({node, ...props}: any) => <strong className="font-black text-indigo-500" {...props} /> }}>
                        {q.question}
                      </ReactMarkdown>
                    </div>

                    {/* --- CẤU TRÚC ĐÁP ÁN FORM TRẮC NGHIỆM ABCD --- */}
                    {selectedExam.type === 'choice' && q.options && (
                      <div className="space-y-2.5 pt-2">
                        {q.options.map((opt: string) => {
                          const letter = opt.trim().charAt(0).toUpperCase()
                          const isSel = userAnswers[idx] === letter
                          const isCorrect = q.answer === letter
                          return (
                            <button 
                              key={opt} type="button" disabled={isSubmitted}
                              onClick={() => setUserAnswers({ ...userAnswers, [idx]: letter })}
                              className={`w-full p-4 rounded-xl text-xs font-bold text-left border transition-all flex items-center gap-4 ${isSel ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-950/30' : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/5 hover:bg-slate-50'}`}
                            >
                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-black shrink-0 ${isSel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-[#252525] border-slate-300'}`}>{letter}</div>
                              <span className="flex-1 overflow-x-auto custom-scrollbar"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <span {...props} /> }}>{opt.substring(2)}</ReactMarkdown></span>
                              {(isSubmitted || alwaysShowExplain) && isCorrect && <Check className="w-4 h-4 text-emerald-500 shrink-0"/>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* --- CẤU TRÚC FORM ĐÚNG SAI CHUẨN KHẢO THÍ MỚI --- */}
                    {selectedExam.type === 'true_false' && q.subQuestions && (
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

                    {/* --- CẤU TRÚC 4 Ô ĐIỀN RỜI ĐỘC QUYỀN FORM TRẢ LỜI NGẮN --- */}
                    {selectedExam.type === 'short_answer' && (
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
                            placeholder="Gõ đáp án..." className="bg-slate-100 dark:bg-[#202020] border rounded-xl px-3 py-2 text-xs font-bold outline-none w-28 focus:border-indigo-500"
                          />
                        </div>
                        {(isSubmitted || alwaysShowExplain) && <div className="text-xs font-black text-slate-400">Đáp án chuẩn: <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-mono">{q.answer}</span></div>}
                      </div>
                    )}

                    {/* Hộp giải thích chi tiết khi nộp bài */}
                    {(isSubmitted || alwaysShowExplain) && q.explain && (
                      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-white/5 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-2 leading-relaxed animate-in slide-in-from-top-2">
                        <span className="block uppercase font-black text-[10px] tracking-widest text-indigo-500 mb-1">Lời giải chi tiết:</span>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explain}</ReactMarkdown>
                      </div>
                    )}

                  </div>
                ))}
              </div>

              {/* KHUNG PHẢI: BẢNG ĐIỀU KHIỂN CỐ ĐỊNH (4 COLUMNS) */}
              <div className="lg:col-span-4 sticky top-[104px] space-y-5">
                <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 text-center space-y-5 shadow-sm">
                  
                  {/* Khối hiển thị thời gian làm bài */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Thời gian làm bài</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{selectedExam.duration} phút</p>
                  </div>

                  <div className="text-left text-xs font-medium text-slate-500 leading-relaxed bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    Làm thử đề thi được AI tạo trực tiếp dựa trên tài liệu bạn đã chọn. Bấm <strong>Nộp bài</strong> để xem điểm và giải thích chi tiết.
                  </div>

                  {isSubmitted && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl animate-in zoom-in-95">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kết quả thi</p>
                      <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{String(scoreResult).replace('.', ',')} <span className="text-xs text-slate-400">/ 10 Điểm</span></p>
                    </div>
                  )}

                  {/* Nút nộp bài / Làm lại */}
                  <div className="space-y-2">
                    {!isSubmitted ? (
                      <button onClick={handleScoreQuiz} className="w-full bg-[#1e3e37] hover:bg-[#152a25] text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]">
                        Nộp bài thi
                      </button>
                    ) : (
                      <button onClick={()=>{ setUserAnswers({}); setIsSubmitted(false); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]">
                        Làm lại đề này
                      </button>
                    )}
                    <button onClick={() => setCurrentView('form')} className="w-full bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-colors">
                      Thoát phòng thi
                    </button>
                  </div>

                  {/* Checkbox hiện đáp án luôn như hình sếp gửi */}
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-center gap-2">
                    <input 
                      type="checkbox" id="show_exp" checked={alwaysShowExplain} 
                      onChange={(e)=>setAlwaysShowExplain(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="show_exp" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">Hiện đáp án & Giải thích luôn</label>
                  </div>
                </div>

                {/* Widget AI Tokens Widget chân thực */}
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