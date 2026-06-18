'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Calculator, GraduationCap, Target, AlertCircle, 
  Info, Sparkles, BookOpen, BarChart3, CheckCircle2,
  Percent, Hash, MapPin, Bot, Loader2, Send, ChevronRight
} from 'lucide-react'

// Các hằng số giao diện chuẩn Material Design 3 + Liquid Glass
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-150 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-[#252525] rounded-2xl px-5 py-4 outline-none transition-all font-black text-slate-900 dark:text-white text-base shadow-inner"

export default function ScoreCalculatorPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)

  // Navigation Tabs
  const [activeExam, setActiveExam] = useState<'THPTQG' | 'HSA' | 'TSA'>('THPTQG')
  
  // Tính điểm Mode
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')

  // Dữ liệu nhập
  const [scores, setScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [mainSubject, setMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [priorityScore, setPriorityScore] = useState('')

  // Kết quả
  const [result, setResult] = useState<{
    rawScore: number;
    finalPriority: number;
    totalScore: number;
  } | null>(null)

  // 🌟 State cho SenAI Tư vấn
  const [aiResponse, setAiResponse] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showAiBox, setShowAiBox] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // Khởi tạo Theme
  useEffect(() => {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setIsDark(theme === 'dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  // Thuật toán Tính toán điểm số realtime
  useEffect(() => {
    // Tự động clear AI response khi điểm bị thay đổi để tránh lệch dữ liệu
    if (showAiBox) {
      setShowAiBox(false)
      setAiResponse('')
    }

    const s1 = parseFloat(scores.sub1.replace(',', '.'))
    const s2 = parseFloat(scores.sub2.replace(',', '.'))
    const s3 = parseFloat(scores.sub3.replace(',', '.'))
    const baseP = parseFloat(priorityScore.replace(',', '.')) || 0

    // Validate giới hạn điểm cơ bản
    if (isNaN(s1) || isNaN(s2) || isNaN(s3) || s1 > 10 || s2 > 10 || s3 > 10 || s1 < 0 || s2 < 0 || s3 < 0) {
      setResult(null)
      return
    }

    let rawScore = 0

    if (calcMode === 'standard') {
      rawScore = s1 + s2 + s3
    } else if (calcMode === 'hust') {
      const mainS = mainSubject === 'sub1' ? s1 : mainSubject === 'sub2' ? s2 : s3
      const otherSum = (s1 + s2 + s3) - mainS
      // Công thức Bách Khoa quy về thang 30: ((Môn Chính x2 + 2 Môn Còn Lại) x 3) / 4
      rawScore = ((mainS * 2 + otherSum) * 3) / 4
    }

    // Công thức tính điểm ưu tiên chuẩn Bộ GD&ĐT (Chỉ giảm dần khi điểm gốc >= 22.5)
    let actualPriority = baseP
    if (rawScore >= 22.5) {
      actualPriority = ((30 - rawScore) / 7.5) * baseP
    }

    // Làm tròn 2 chữ số thập phân
    rawScore = Math.round(rawScore * 100) / 100
    actualPriority = Math.round(actualPriority * 100) / 100
    const totalScore = Math.round((rawScore + actualPriority) * 100) / 100

    setResult({ rawScore, finalPriority: Math.max(0, actualPriority), totalScore })
  }, [scores, calcMode, mainSubject, priorityScore])

  const handleScoreChange = (field: string, value: string) => {
    if (value === '' || /^[0-9.,]*$/.test(value)) {
      setScores(prev => ({ ...prev, [field]: value }))
    }
  }

  // 🌟 HÀM KÍCH HOẠT SEN AI TƯ VẤN TRƯỜNG/NGÀNH
  const handleAskSenAI = async () => {
    if (!result) return
    setIsAiLoading(true)
    setShowAiBox(true)
    setAiResponse('')

    // Auto scroll xuống box AI
    setTimeout(() => {
      if (rightPanelRef.current) {
        rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight
      }
    }, 100)

    const modeText = calcMode === 'standard' 
      ? 'Đại học chung (Tổng 3 môn + Điểm ưu tiên)' 
      : 'Đại học Bách Khoa Hà Nội (Môn chính nhân hệ số 2, quy đổi về thang 30)'

    const prompt = `Học sinh vừa sử dụng công cụ tính điểm xét tuyển trên hệ thống SenExam.
- Tổng điểm đạt được: ${result.totalScore} (Thang điểm 30)
- Phương thức xét tuyển: ${modeText}

Nhiệm vụ của bạn (Gia sư tư vấn tuyển sinh SenAI):
Dựa vào phổ điểm và điểm chuẩn năm 2025 (sử dụng làm mốc dự đoán cho năm 2026), hãy phân tích cơ hội đỗ và đề xuất:
${calcMode === 'standard' 
  ? '1. Gợi ý 3 đến 5 trường Đại học xịn nhất, top đầu và ngành học tương ứng mà học sinh có khả năng trúng tuyển với số điểm này.\n2. Lời khuyên phân bổ nguyện vọng an toàn.' 
  : '1. Gợi ý 3 đến 5 ngành học HOT và xịn nhất tại Đại học Bách Khoa Hà Nội (HUST) mà học sinh có khả năng trúng tuyển với số điểm này.\n2. Đánh giá mức độ cạnh tranh của các ngành đó.'}

Yêu cầu định dạng:
- Xưng "Mình" gọi "Bạn".
- Đưa ra điểm chuẩn 2025 của các ngành đó để đối chiếu.
- Sử dụng gạch đầu dòng gọn gàng, có icon minh họa. Không in đậm toàn bộ văn bản. Ngắn gọn nhưng súc tích.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      })
      const data = await res.json()
      
      if (res.ok && data.text) {
        setAiResponse(data.text)
      } else {
        throw new Error('Lỗi API')
      }
    } catch (error) {
      setAiResponse('Xin lỗi bạn, kết nối đến máy chủ SenAI đang bị gián đoạn. Bạn thử bấm tư vấn lại nhé! 😥')
    } finally {
      setIsAiLoading(false)
      setTimeout(() => {
        if (rightPanelRef.current) {
          rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight
        }
      }, 200)
    }
  }

  // Hàm render Markdown cơ bản
  const formatAIResponse = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-1.5"></div>
      const parts = line.split('**')
      return (
        <p key={i} className="mb-2 text-[14px]">
          {parts.map((part, j) => 
            j % 2 === 1 
            ? <strong key={j} className="text-indigo-600 dark:text-indigo-400 font-extrabold">{part}</strong> 
            : part
          )}
        </p>
      )
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative overflow-x-hidden pb-10">
      
      {/* Nền đồ họa Background Ambient */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/20 to-purple-500/10 dark:from-indigo-900/30 dark:to-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-gradient-to-tl from-blue-500/15 to-cyan-500/10 dark:from-blue-900/20 dark:to-cyan-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header App Bar */}
      <header className="h-[76px] px-6 lg:px-10 flex items-center justify-between bg-white/70 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2.5 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] rounded-full transition-all group active:scale-95 shadow-inner">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform"/>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Calculator className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-slate-900 dark:text-white">Công Cụ Tính Điểm</h1>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Quy chuẩn xét tuyển Đại học</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-4 md:p-8 relative z-10">
        
        {/* Navigation Tabs (Pill Buttons) */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-6 custom-scrollbar hide-scroll">
          <button onClick={() => setActiveExam('THPTQG')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'THPTQG' ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
            <GraduationCap className="w-5 h-5"/> Thi THPT Quốc Gia
          </button>
          <button onClick={() => setActiveExam('HSA')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'HSA' ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
            <Target className="w-5 h-5"/> ĐGNL (HSA)
          </button>
          <button onClick={() => setActiveExam('TSA')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'TSA' ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
            <BookOpen className="w-5 h-5"/> ĐGTD (TSA)
          </button>
        </div>

        {activeExam !== 'THPTQG' ? (
          <div className={`${mdCard} p-16 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300`}>
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-indigo-100 dark:border-indigo-500/20">
              <Sparkles className="w-10 h-10 text-indigo-500 animate-pulse"/>
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-3 text-slate-900 dark:text-white tracking-tight">Tính năng đang phát triển</h2>
            <p className="text-slate-500 max-w-lg font-medium leading-relaxed">Bảng quy đổi điểm cho các kỳ thi Đánh giá Năng lực (HSA) và Đánh giá Tư duy (TSA) đang được AI cập nhật công thức nội suy mới nhất từ các trường đại học. Vui lòng quay lại sau!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* ============================================================== */}
            {/* PANEL TRÁI: NHẬP LIỆU (Chiếm 7 cột) */}
            {/* ============================================================== */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* KHỐI 1: TÙY CHỌN PHƯƠNG THỨC */}
              <div className={`${mdCard} p-6 md:p-8`}>
                <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-6 flex items-center gap-2">
                  <Calculator className="w-4 h-4"/> Phương thức xét tuyển
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    onClick={() => setCalcMode('standard')} 
                    className={`p-5 rounded-3xl cursor-pointer border-2 transition-all duration-300 group ${calcMode === 'standard' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 shadow-md' : 'border-slate-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50 dark:bg-[#1E1E1E]'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-black text-lg ${calcMode === 'standard' ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>Đại học chung</span>
                      {calcMode === 'standard' && <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Tổng 3 môn + Ưu tiên</p>
                  </div>
                  
                  <div 
                    onClick={() => setCalcMode('hust')} 
                    className={`p-5 rounded-3xl cursor-pointer border-2 transition-all duration-300 group ${calcMode === 'hust' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10 shadow-md' : 'border-slate-200 dark:border-white/5 hover:border-red-300 dark:hover:border-red-700 bg-slate-50 dark:bg-[#1E1E1E]'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-black text-lg ${calcMode === 'hust' ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>ĐH Bách Khoa</span>
                      {calcMode === 'hust' && <CheckCircle2 className="w-6 h-6 text-red-600 dark:text-red-400"/>}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Môn chính nhân hệ số 2</p>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: ĐIỂM THI THÀNH PHẦN */}
              <div className={`${mdCard} p-6 md:p-8`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-2">
                    <Hash className="w-4 h-4"/> Điểm thi Tổ hợp
                  </h3>
                  {calcMode === 'hust' && <span className="text-[10px] font-black uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full">Chọn 1 môn nhân đôi</span>}
                </div>

                <div className="space-y-4">
                  {[1, 2, 3].map((num) => {
                    const key = `sub${num}` as keyof typeof scores
                    const isMain = calcMode === 'hust' && mainSubject === key
                    
                    return (
                      <div key={key} className={`flex items-center gap-3 md:gap-4 p-2 rounded-[1.5rem] transition-colors ${isMain ? 'bg-red-50/50 dark:bg-red-900/5 -mx-2 px-4 border border-red-100 dark:border-red-900/30' : 'border border-transparent'}`}>
                        <div className="flex-1">
                          <label className="block text-xs font-bold mb-2 text-slate-600 dark:text-slate-400">Điểm Môn {num}</label>
                          <input 
                            type="text" 
                            placeholder="VD: 8,5"
                            value={scores[key]}
                            onChange={(e) => handleScoreChange(key, e.target.value)}
                            className={mdInput}
                          />
                        </div>

                        {/* Button Chọn Môn Chính (Bách Khoa Mode) */}
                        <div className={`shrink-0 flex items-end transition-all duration-300 ${calcMode === 'hust' ? 'w-auto opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                          <button 
                            onClick={() => setMainSubject(key)}
                            className={`h-[52px] mt-6 px-4 md:px-6 rounded-2xl text-xs font-black transition-all border-2 ${isMain ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-slate-100 dark:bg-[#202020] text-slate-500 border-transparent hover:bg-slate-200 dark:hover:bg-[#2A2A2A]'}`}
                          >
                            {isMain ? '★ MÔN CHÍNH (x2)' : 'Đặt môn chính'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* KHỐI 3: ĐIỂM ƯU TIÊN */}
              <div className={`${mdCard} p-6 md:p-8`}>
                <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest mb-6 flex items-center gap-2">
                  <MapPin className="w-4 h-4"/> Điểm Ưu tiên (Khu vực / Đối tượng)
                </h3>
                
                <div className="mb-6">
                  <input 
                    type="text" 
                    placeholder="Tổng điểm ưu tiên của bạn (VD: 0,75)"
                    value={priorityScore}
                    onChange={(e) => {
                      if (e.target.value === '' || /^[0-9.,]*$/.test(e.target.value)) setPriorityScore(e.target.value)
                    }}
                    className={mdInput}
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <p className="text-sm font-black text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2"><Info className="w-5 h-5"/> Bảng tra cứu điểm cộng:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-800 dark:text-amber-500 font-medium">
                    <div className="bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30"><strong className="text-amber-900 dark:text-amber-300">KV1:</strong> +0.75 điểm</div>
                    <div className="bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30"><strong className="text-amber-900 dark:text-amber-300">KV2:</strong> +0.25 điểm</div>
                    <div className="bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30"><strong className="text-amber-900 dark:text-amber-300">KV2-NT:</strong> +0.5 điểm</div>
                    <div className="bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30"><strong className="text-amber-900 dark:text-amber-300">KV3:</strong> 0 điểm</div>
                    <div className="sm:col-span-2 bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30"><strong className="text-amber-900 dark:text-amber-300">Đối tượng đặc biệt:</strong> +1.0 đến +2.0 điểm</div>
                  </div>
                  
                  <p className="pt-3 mt-3 border-t border-amber-200/50 dark:border-amber-900/50 text-[11px] font-bold italic opacity-80">
                    * Lưu ý: Hệ thống sẽ tự động áp dụng công thức giảm trừ điểm ưu tiên của Bộ GD&ĐT nếu tổng điểm 3 môn của bạn ≥ 22.5.
                  </p>
                </div>
              </div>

            </div>

            {/* ============================================================== */}
            {/* PANEL PHẢI: KẾT QUẢ ĐẦU RA & TƯ VẤN AI (Chiếm 5 cột) */}
            {/* ============================================================== */}
            <div className="lg:col-span-5 relative">
              <div 
                ref={rightPanelRef}
                className="sticky top-[100px] space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10"
              >
                
                {/* THẺ HIỂN THỊ KẾT QUẢ CỐT LÕI */}
                <div className={`${mdCard} p-0 overflow-hidden shadow-xl shrink-0`}>
                  
                  {/* Nửa trên: Banner Kết quả (Đổi màu theo Mode) */}
                  <div className={`p-8 md:p-10 text-white transition-colors duration-500 relative flex flex-col items-center justify-center min-h-[260px] ${calcMode === 'hust' ? 'bg-gradient-to-br from-red-600 via-rose-600 to-orange-600 dark:from-red-800 dark:to-orange-900' : 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-800 dark:to-cyan-900'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl mix-blend-overlay"></div>
                    
                    <div className="relative z-10 flex flex-col items-center text-center w-full">
                      <BarChart3 className="w-12 h-12 mb-4 opacity-90 drop-shadow-md"/>
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest mb-2">Điểm Xét Tuyển Cuối Cùng</h3>
                      
                      <div className="text-[5rem] md:text-[6rem] font-black drop-shadow-lg tracking-tighter leading-none mb-4">
                        {result ? String(result.totalScore.toFixed(2)).replace('.', ',') : '--'}
                      </div>
                      
                      <p className="text-[11px] font-black uppercase text-white/90 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-inner">
                        {calcMode === 'standard' ? 'THANG ĐIỂM 30 (HỆ CƠ BẢN)' : 'THANG ĐIỂM 30 (HỆ BÁCH KHOA)'}
                      </p>
                    </div>
                  </div>

                  {/* Nửa dưới: Break-down chi tiết */}
                  <div className="p-6 md:p-8 space-y-4 bg-white dark:bg-[#1A1A1A]">
                    
                    <div className="flex justify-between items-center p-4.5 rounded-[1.5rem] bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-white/5 transition-colors">
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Điểm khối gốc (Chưa cộng):</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white">
                        {result ? String(result.rawScore.toFixed(2)).replace('.', ',') : '0,00'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-4.5 rounded-[1.5rem] bg-emerald-50/50 dark:bg-[#202020] border border-emerald-100 dark:border-white/5 relative overflow-hidden transition-colors">
                      <div className="relative z-10 flex flex-col">
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Điểm ưu tiên thực nhận:</span>
                        {result && result.rawScore >= 22.5 && parseFloat(priorityScore) > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-bold italic flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Đã giảm trừ do điểm gốc ≥ 22.5</span>
                        )}
                      </div>
                      <span className="relative z-10 text-xl font-black text-emerald-600 dark:text-emerald-400">
                        +{result ? String(result.finalPriority.toFixed(2)).replace('.', ',') : '0,00'}
                      </span>
                      {result && result.rawScore >= 22.5 && parseFloat(priorityScore) > 0 && <div className="absolute right-0 top-0 w-24 h-full bg-amber-100/50 dark:bg-amber-900/10 blur-xl"></div>}
                    </div>

                    {!result && (
                      <div className="text-center pt-4 pb-2 animate-pulse">
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Vui lòng điền đủ điểm 3 môn để xem kết quả</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 🌟 WIDGET SENAI TƯ VẤN (Chỉ hiện khi đã có điểm) */}
                {result && (
                  <div className="animate-in slide-in-from-top-4 fade-in duration-500">
                    {!showAiBox ? (
                      <button 
                        onClick={handleAskSenAI}
                        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-[1.5rem] p-5 font-black shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 group"
                      >
                        <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse"/> 
                        Tư vấn Trường/Ngành cùng SenAI
                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all"/>
                      </button>
                    ) : (
                      <div className="bg-white dark:bg-[#1A1A1A] border border-indigo-200 dark:border-indigo-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
                        
                        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-white/5 pb-4">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-[#202020] rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                            <Bot className="w-5 h-5"/>
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white">Gia sư Tuyển sinh SenAI</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Tham chiếu điểm chuẩn 2025</p>
                          </div>
                        </div>

                        {isAiLoading ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3"/>
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Đang rà soát ma trận điểm chuẩn 2025...</p>
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                            {formatAIResponse(aiResponse)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Nút tác vụ phụ */}
                <div className="flex justify-center pt-2">
                   <button 
                    onClick={() => { setScores({sub1:'', sub2:'', sub3:''}); setPriorityScore(''); setResult(null); setShowAiBox(false); setAiResponse('') }} 
                    className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 shadow-sm px-6 py-2.5 rounded-full active:scale-95"
                  >
                     Làm mới bộ tính
                   </button>
                </div>

              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}