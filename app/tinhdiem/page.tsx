'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Calculator, GraduationCap, Target, AlertCircle, 
  Info, Sparkles, BookOpen, BarChart3, CheckCircle2,
  Hash, MapPin, Bot, Loader2, Send, ChevronRight, MessageSquare, Briefcase
} from 'lucide-react'

// 🌟 THƯ VIỆN RENDER MARKDOWN & CÔNG THỨC TOÁN HỌC (LATEX)
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm' // Thêm thư viện hỗ trợ render Bảng (Table)
import 'katex/dist/katex.min.css'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getAccentHex, getModernThemeVars } from '@/app/components/modernTheme'

// Các hằng số giao diện chuẩn Material Design 3 + Liquid Glass
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-[#252525] rounded-2xl px-5 py-4 outline-none transition-all font-black text-slate-900 dark:text-white text-base shadow-inner"

// DỮ LIỆU CÁC KHỐI THI TIÊU CHUẨN
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học', subs: ['Toán', 'Vật lí', 'Hóa học'] },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh', subs: ['Toán', 'Vật lí', 'Tiếng Anh'] },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học', subs: ['Toán', 'Hóa học', 'Sinh học'] },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí', subs: ['Ngữ văn', 'Lịch sử', 'Địa lí'] },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh', subs: ['Ngữ văn', 'Toán', 'Tiếng Anh'] },
  { code: 'D07', name: 'Toán, Hóa học, Tiếng Anh', subs: ['Toán', 'Hóa học', 'Tiếng Anh'] },
  { code: 'A02', name: 'Toán, Vật lí, Sinh học', subs: ['Toán', 'Vật lí', 'Sinh học'] },
  { code: 'C01', name: 'Ngữ văn, Toán, Vật lí', subs: ['Ngữ văn', 'Toán', 'Vật lí'] },
  { code: 'Khác', name: 'Tổ hợp môn tự chọn', subs: ['Môn 1', 'Môn 2', 'Môn 3'] }
]

// DỮ LIỆU ĐAM MÊ NGHỀ NGHIỆP CƠ BẢN
const PRESET_PASSIONS = ['Kỹ sư Công nghệ', 'Nhà Nghiên cứu', 'Giáo viên', 'Bác sĩ / Y tế', 'Dược sĩ', 'Quân đội', 'Công an / An ninh', 'Kinh tế / Quản trị']

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

export default function ScoreCalculatorPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const accentColor = newUiEnabled ? getAccentHex(themeColor, isDark) : (isDark ? '#818CF8' : '#4F46E5')

  // Navigation Tabs
  const [activeExam, setActiveExam] = useState<'THPTQG' | 'HSA' | 'TSA'>('THPTQG')
  
  // Tính điểm Mode
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [selectedBlock, setSelectedBlock] = useState(EXAM_BLOCKS[0].code)

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

  // 🌟 STATES CHO PHẦN TƯ VẤN ĐAM MÊ & NGHỀ NGHIỆP
  const [selectedPassions, setSelectedPassions] = useState<string[]>([])
  const [customPassion, setCustomPassion] = useState('')

  // 🌟 State cho SenAI Tư vấn Liên tục
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showAiBox, setShowAiBox] = useState(false)
  
  const aiChatScrollRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const currentBlockData = EXAM_BLOCKS.find(b => b.code === selectedBlock) || EXAM_BLOCKS[0]

  // Khởi tạo Theme
  useEffect(() => {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setIsDark(theme === 'dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  // Tự động cuộn chat box AI
  useEffect(() => {
    if (aiChatScrollRef.current) {
      aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight
    }
  }, [aiMessages, isAiLoading])

  // Thuật toán Tính toán điểm số realtime
  useEffect(() => {
    // Ẩn bảng tư vấn nếu điểm thay đổi để tránh lệch dữ liệu
    if (showAiBox && !isAiLoading) {
      setShowAiBox(false)
      setAiMessages([])
    }

    const s1 = parseFloat(scores.sub1.replace(',', '.'))
    const s2 = parseFloat(scores.sub2.replace(',', '.'))
    const s3 = parseFloat(scores.sub3.replace(',', '.'))
    const baseP = parseFloat(priorityScore.replace(',', '.')) || 0

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
  }, [scores, calcMode, mainSubject, priorityScore, selectedBlock])

  const handleScoreChange = (field: string, value: string) => {
    if (value === '' || /^[0-9.,]*$/.test(value)) {
      setScores(prev => ({ ...prev, [field]: value }))
    }
  }

  const togglePassion = (passion: string) => {
    setSelectedPassions(prev => prev.includes(passion) ? prev.filter(p => p !== passion) : [...prev, passion])
  }

  // 🌟 HÀM KÍCH HOẠT TƯ VẤN ĐẦU TIÊN KẾT HỢP ĐAM MÊ
  const handleAskSenAI = async () => {
    if (!result) return
    setIsAiLoading(true)
    setShowAiBox(true)

    setTimeout(() => {
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight
    }, 100)

    const modeText = calcMode === 'standard' 
      ? 'Đại học chung (Tổng 3 môn + Điểm ưu tiên)' 
      : 'Đại học Bách Khoa Hà Nội (Môn chính nhân hệ số 2, quy đổi về thang 30)'

    const allPassions = [...selectedPassions]
    if (customPassion.trim()) allPassions.push(customPassion.trim())
    const passionText = allPassions.length > 0 ? allPassions.join(', ') : 'Chưa định hướng rõ ràng'

    const systemContext = `Bạn là SenAI (bản Beta) - Gia sư Tuyển sinh Đại học năm 2026.
    Nhiệm vụ của bạn là tư vấn trường, ngành phù hợp dựa trên ĐIỂM SỐ, KHỐI THI và ĐAM MÊ NGHỀ NGHIỆP của học sinh.
    Lưu ý quan trọng: Dữ liệu của 248 trường đại học và hơn 2400 ngành được cập nhật đến năm 2025. Hãy tham chiếu mức điểm chuẩn năm 2025 để dự báo.
    Trình bày bằng danh sách Markdown, rõ ràng, đi thẳng vào trọng tâm, xưng "Mình" gọi "Bạn". Không dùng ngôn từ sến súa hay cảm thán quá đà. Nếu điểm số nằm ở mức rủi ro với nguyện vọng nào, hãy nói thẳng thay vì né tránh, và luôn gợi ý thêm phương án an toàn.`

    const prompt = `Mình vừa tính điểm xét tuyển trên hệ thống:
- Tổng điểm xét tuyển: **${result.totalScore}** (Thang 30)
- Khối thi: ${selectedBlock} (${currentBlockData.name})
- Điểm chi tiết: ${currentBlockData.subs[0]}: ${scores.sub1}, ${currentBlockData.subs[1]}: ${scores.sub2}, ${currentBlockData.subs[2]}: ${scores.sub3}
- Phương thức: ${modeText}
- Đam mê / Ngành nghề mong muốn của mình: **${passionText}**

Hãy tư vấn giúp mình:
${calcMode === 'standard' 
  ? '1. Dựa trên đam mê và số điểm này, gợi ý 3-5 trường Đại học xịn nhất và ngành học (kèm điểm chuẩn 2025) mà mình có khả năng đỗ.\n2. Lời khuyên phân bổ nguyện vọng an toàn.' 
  : '1. Dựa trên đam mê và số điểm này, gợi ý 3-5 ngành HOT tại ĐH Bách Khoa Hà Nội (HUST) (kèm điểm chuẩn 2025) mà mình có khả năng đỗ.\n2. Đánh giá mức độ cạnh tranh của các ngành đó.'}`

    const initialDisplayMessage: ChatMessage = { role: 'user', text: `Tư vấn giúp mình các trường và ngành phù hợp với số điểm **${result.totalScore}** (Khối **${selectedBlock}**) và định hướng làm **${passionText}** nhé!` }
    setAiMessages([initialDisplayMessage])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [], context: systemContext }),
      })
      const data = await res.json()
      
      if (res.ok && data.text) {
        setAiMessages([initialDisplayMessage, { role: 'model', text: data.text }])
      } else {
        throw new Error('Lỗi API')
      }
    } catch (error) {
      setAiMessages([initialDisplayMessage, { role: 'model', text: 'Xin lỗi bạn, kết nối đến máy chủ đang gián đoạn. Bạn thử gõ tin nhắn lại nhé! 😥' }])
    } finally {
      setIsAiLoading(false)
    }
  }

  // 🌟 HÀM XỬ LÝ CHAT TIẾP NỐI (FOLLOW-UP)
  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiInput.trim() || isAiLoading) return
    const userMsg = aiInput.trim()
    setAiInput('')
    
    const newHistory: ChatMessage[] = [...aiMessages, { role: 'user', text: userMsg }]
    setAiMessages(newHistory)
    setIsAiLoading(true)

    const systemContext = `Bạn là SenAI (bản Beta) - Gia sư Tuyển sinh Đại học năm 2026. Tham chiếu mức điểm chuẩn năm 2025 (dữ liệu của 248 trường và hơn 2400 ngành) để đưa ra dự báo. Trình bày bằng danh sách Markdown, rõ ràng, đi thẳng vào trọng tâm, xưng "Mình" gọi "Bạn". Không dùng ngôn từ sến súa hay cảm thán quá đà. Học sinh đang có ${result?.totalScore} điểm, khối ${selectedBlock}.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: newHistory, context: systemContext }),
      })
      const data = await res.json()
      
      if (res.ok && data.text) {
        setAiMessages([...newHistory, { role: 'model', text: data.text }])
      } else {
        throw new Error('Lỗi API')
      }
    } catch (error) {
      setAiMessages([...newHistory, { role: 'model', text: 'Xin lỗi bạn, kết nối đến máy chủ đang gián đoạn. Bạn thử gửi lại nhé! 😥' }])
    } finally {
      setIsAiLoading(false)
    }
  }

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans relative pb-10"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        {/* Header App Bar */}
        <header className="h-[72px] px-6 lg:px-10 flex items-center justify-between sticky top-0 z-40" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-2.5 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }}/>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', color: '#fff' }}>
                <Calculator className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight leading-none">Công Cụ Tính Điểm</h1>
                <span className="text-[10px] font-medium uppercase tracking-widest mt-1 block" style={{ color: 'var(--text-muted)' }}>Quy chuẩn xét tuyển Đại học</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1200px] mx-auto p-4 md:p-8 relative z-10">

          {/* Navigation Tabs (Pill Buttons) */}
          <div className="flex overflow-x-auto gap-3 pb-4 mb-6 custom-scrollbar hide-scroll">
            <button onClick={() => setActiveExam('THPTQG')} className="px-5 py-3 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors" style={activeExam === 'THPTQG' ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <GraduationCap className="w-4 h-4"/> Thi THPT Quốc Gia
            </button>
            <button onClick={() => setActiveExam('HSA')} className="px-5 py-3 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors" style={activeExam === 'HSA' ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <Target className="w-4 h-4"/> ĐGNL (HSA)
            </button>
            <button onClick={() => setActiveExam('TSA')} className="px-5 py-3 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors" style={activeExam === 'TSA' ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <BookOpen className="w-4 h-4"/> ĐGTD (TSA)
            </button>
          </div>

          {activeExam !== 'THPTQG' ? (
            <div className="rounded-2xl p-16 flex flex-col items-center justify-center text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'var(--accent-soft)' }}>
                <Sparkles className="w-8 h-8" style={{ color: 'var(--accent)' }}/>
              </div>
              <h2 className="text-xl font-semibold mb-3">Tính năng đang phát triển</h2>
              <p className="max-w-lg font-medium leading-relaxed text-sm" style={{ color: 'var(--text-muted)' }}>Bảng quy đổi điểm cho các kỳ thi Đánh giá Năng lực (HSA) và Đánh giá Tư duy (TSA) đang được AI cập nhật công thức nội suy mới nhất từ các trường đại học. Vui lòng quay lại sau!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

              {/* PANEL TRÁI: NHẬP LIỆU */}
              <div className="lg:col-span-7 space-y-6">

                {/* KHỐI 1: TÙY CHỌN PHƯƠNG THỨC */}
                <div className="rounded-2xl p-6 md:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                    <Calculator className="w-4 h-4"/> Phương thức xét tuyển
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => setCalcMode('standard')}
                      className="p-5 rounded-2xl cursor-pointer transition-colors"
                      style={calcMode === 'standard' ? { border: '2px solid var(--accent)', background: 'var(--accent-soft)' } : { border: '2px solid var(--border)', background: 'var(--bg)' }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-base" style={{ color: calcMode === 'standard' ? 'var(--accent)' : 'var(--text)' }}>Đại học chung</span>
                        {calcMode === 'standard' && <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent)' }}/>}
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Tổng 3 môn + Ưu tiên</p>
                    </div>

                    <div
                      onClick={() => setCalcMode('hust')}
                      className="p-5 rounded-2xl cursor-pointer transition-colors"
                      style={calcMode === 'hust' ? { border: '2px solid #DC2626', background: 'rgba(220,38,38,0.08)' } : { border: '2px solid var(--border)', background: 'var(--bg)' }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-base" style={{ color: calcMode === 'hust' ? '#DC2626' : 'var(--text)' }}>ĐH Bách Khoa</span>
                        {calcMode === 'hust' && <CheckCircle2 className="w-5 h-5" style={{ color: '#DC2626' }}/>}
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Môn chính nhân hệ số 2</p>
                    </div>
                  </div>
                </div>

                {/* KHỐI 2: CHỌN KHỐI THI VÀ ĐIỂM THÀNH PHẦN */}
                <div className="rounded-2xl p-6 md:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <Hash className="w-4 h-4"/> Điểm thi Tổ hợp
                    </h3>
                    {calcMode === 'hust' && <span className="text-[10px] font-semibold uppercase px-3 py-1 rounded-full" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>Chọn 1 môn nhân đôi</span>}
                  </div>

                  {/* Dropdown Khối Thi */}
                  <div className="mb-6">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--accent)' }}>Chọn Khối Thi Xét Tuyển</label>
                    <select
                      value={selectedBlock}
                      onChange={(e) => setSelectedBlock(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent cursor-pointer"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      {EXAM_BLOCKS.map(b => (
                        <option key={b.code} value={b.code}>
                          Khối {b.code} ({b.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-4">
                    {[0, 1, 2].map((idx) => {
                      const num = idx + 1
                      const key = `sub${num}` as keyof typeof scores
                      const isMain = calcMode === 'hust' && mainSubject === key
                      const subjectName = currentBlockData.subs[idx]

                      return (
                        <div key={key} className="flex items-center gap-3 md:gap-4 p-2 rounded-2xl transition-colors" style={isMain ? { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' } : { border: '1px solid transparent' }}>
                          <div className="flex-1">
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Điểm môn {subjectName}</label>
                            <input
                              type="text"
                              placeholder="VD: 8,5"
                              value={scores[key]}
                              onChange={(e) => handleScoreChange(key, e.target.value)}
                              className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent"
                              style={{ border: '1px solid var(--border)' }}
                            />
                          </div>

                          {/* Button Chọn Môn Chính (Bách Khoa Mode) */}
                          <div className={`shrink-0 flex items-end transition-all duration-300 ${calcMode === 'hust' ? 'w-auto opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                            <button
                              onClick={() => setMainSubject(key)}
                              className="h-[46px] mt-6 px-4 rounded-xl text-xs font-semibold transition-colors"
                              style={isMain ? { background: '#DC2626', color: '#fff' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
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
                <div className="rounded-2xl p-6 md:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
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
                      className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent"
                      style={{ border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div className="p-5 rounded-2xl relative overflow-hidden" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#D97706' }}><Info className="w-4 h-4"/> Bảng tra cứu điểm cộng:</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium" style={{ color: '#D97706' }}>
                      <div className="p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(217,119,6,0.15)' }}><strong>KV1:</strong> +0.75 điểm</div>
                      <div className="p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(217,119,6,0.15)' }}><strong>KV2:</strong> +0.25 điểm</div>
                      <div className="p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(217,119,6,0.15)' }}><strong>KV2-NT:</strong> +0.5 điểm</div>
                      <div className="p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(217,119,6,0.15)' }}><strong>KV3:</strong> 0 điểm</div>
                      <div className="sm:col-span-2 p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(217,119,6,0.15)' }}><strong>Đối tượng đặc biệt:</strong> +1.0 đến +2.0 điểm</div>
                    </div>

                    <p className="pt-3 mt-3 text-[11px] font-medium italic opacity-80" style={{ borderTop: '1px solid rgba(217,119,6,0.2)' }}>
                      * Lưu ý: Hệ thống sẽ tự động áp dụng công thức giảm trừ điểm ưu tiên của Bộ GD&ĐT nếu tổng điểm 3 môn của bạn ≥ 22.5.
                    </p>
                  </div>
                </div>

              </div>

              {/* PANEL PHẢI: KẾT QUẢ ĐẦU RA & TƯ VẤN AI LIÊN TỤC */}
              <div className="lg:col-span-5 relative">
                <div
                  ref={rightPanelRef}
                  className="sticky top-[100px] space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10"
                >

                  {/* THẺ HIỂN THỊ KẾT QUẢ CỐT LÕI */}
                  <div className="rounded-2xl p-0 overflow-hidden shrink-0" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                    {/* Nửa trên: Banner Kết quả */}
                    <div className="p-8 md:p-10 text-white relative flex flex-col items-center justify-center min-h-[220px]" style={{ background: 'var(--accent)' }}>
                      <div className="relative z-10 flex flex-col items-center text-center w-full">
                        <BarChart3 className="w-10 h-10 mb-4 opacity-90"/>
                        <h3 className="text-xs font-semibold text-white/80 uppercase tracking-widest mb-2">Điểm Xét Tuyển Cuối Cùng</h3>

                        <div className="text-[4.5rem] md:text-[5.5rem] font-bold tracking-tighter leading-none mb-4">
                          {result ? String(result.totalScore.toFixed(2)).replace('.', ',') : '--'}
                        </div>

                        <p className="text-[11px] font-semibold uppercase text-white/90 bg-black/20 px-4 py-2 rounded-full">
                          {calcMode === 'standard' ? 'THANG ĐIỂM 30 (HỆ CƠ BẢN)' : 'THANG ĐIỂM 30 (HỆ BÁCH KHOA)'}
                        </p>
                      </div>
                    </div>

                    {/* Nửa dưới: Break-down chi tiết */}
                    <div className="p-6 md:p-8 space-y-4">

                      <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Điểm khối gốc (Chưa cộng):</span>
                        <span className="text-lg font-semibold">
                          {result ? String(result.rawScore.toFixed(2)).replace('.', ',') : '0,00'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-4 rounded-xl relative overflow-hidden" style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)' }}>
                        <div className="relative z-10 flex flex-col">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Điểm ưu tiên thực nhận:</span>
                          {result && result.rawScore >= 22.5 && parseFloat(priorityScore) > 0 && (
                            <span className="text-[10px] mt-1 font-medium italic flex items-center gap-1" style={{ color: '#D97706' }}><AlertCircle className="w-3 h-3"/> Đã giảm trừ do điểm gốc ≥ 22.5</span>
                          )}
                        </div>
                        <span className="relative z-10 text-lg font-semibold" style={{ color: '#059669' }}>
                          +{result ? String(result.finalPriority.toFixed(2)).replace('.', ',') : '0,00'}
                        </span>
                      </div>

                      {!result && (
                        <div className="text-center pt-4 pb-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Vui lòng điền đủ điểm 3 môn để xem kết quả</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WIDGET ĐAM MÊ VÀ TƯ VẤN SENAI */}
                  {result && (
                    <div className="flex flex-col gap-6">

                      {/* BẢNG ĐÁNH GIÁ ĐAM MÊ NGAY KHI VỪA CÓ ĐIỂM */}
                      {!showAiBox && (
                        <div className="rounded-2xl p-6" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--accent)' }}><Briefcase className="w-4 h-4"/> Định hướng đam mê của bạn</h3>
                          <p className="text-xs font-medium mb-5" style={{ color: 'var(--text-muted)' }}>Chọn các lĩnh vực bạn yêu thích để SenAI đưa ra lời khuyên "đo ni đóng giày" nhất với số điểm của bạn nhé.</p>

                          <div className="flex flex-wrap gap-2 mb-4">
                            {PRESET_PASSIONS.map(passion => (
                              <button
                                key={passion}
                                onClick={() => togglePassion(passion)}
                                className="px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                                style={selectedPassions.includes(passion) ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                              >
                                {passion}
                              </button>
                            ))}
                          </div>

                          <div className="mb-5">
                            <input
                              type="text"
                              placeholder="Hoặc tự gõ ngành nghề bạn mơ ước vào đây..."
                              value={customPassion}
                              onChange={(e) => setCustomPassion(e.target.value)}
                              className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent"
                              style={{ border: '1px solid var(--border)' }}
                            />
                          </div>

                          <button
                            onClick={handleAskSenAI}
                            className="w-full flex items-center justify-center gap-2.5 rounded-xl p-4 font-semibold transition-opacity hover:opacity-90"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                          >
                            <Sparkles className="w-5 h-5"/>
                            Tư vấn Ngành học theo Đam mê
                            <ChevronRight className="w-4 h-4 opacity-70"/>
                          </button>
                        </div>
                      )}

                      {/* KHUNG CHAT TƯ VẤN SENAI */}
                      {showAiBox && (
                        <div className="rounded-2xl relative overflow-hidden flex flex-col h-[650px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                          {/* Chat Header */}
                          <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                                <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }}/>
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm flex items-center gap-1.5">Gia sư Tuyển sinh SenAI <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Beta</span></h4>
                                <p className="text-[9px] font-medium uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Big Data: 248 Trường & 2400 Ngành</p>
                              </div>
                            </div>
                          </div>

                          {/* Chat History Area */}
                          <div
                            ref={aiChatScrollRef}
                            className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6"
                          >
                            {aiMessages.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && (
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 mt-1" style={{ background: 'var(--accent-soft)' }}>
                                    <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }}/>
                                  </div>
                                )}

                                <div
                                  className="max-w-[85%] px-5 py-3.5 rounded-2xl text-[14px] font-medium leading-relaxed overflow-x-auto"
                                  style={msg.role === 'user' ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bg)', border: '1px solid var(--border)' }}
                                >
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                      strong: ({node, ...props}) => <strong className="font-semibold" style={{ color: msg.role === 'user' ? '#fff' : 'var(--accent)' }} {...props} />,
                                      ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                      ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                      h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-2 mt-3" {...props} />,

                                      table: ({node, ...props}) => (
                                        <div className="overflow-x-auto my-4 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                                          <table className="w-full text-left border-collapse text-sm min-w-full" {...props} />
                                        </div>
                                      ),
                                      thead: ({node, ...props}) => <thead style={{ background: 'var(--accent-soft)' }} {...props} />,
                                      tbody: ({node, ...props}) => <tbody {...props} />,
                                      tr: ({node, ...props}) => <tr {...props} />,
                                      th: ({node, ...props}) => <th className="px-4 py-3 font-semibold" style={{ borderRight: '1px solid var(--border)' }} {...props} />,
                                      td: ({node, ...props}) => <td className="px-4 py-3 align-top" style={{ borderRight: '1px solid var(--border)' }} {...props} />,
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ))}

                            {isAiLoading && (
                              <div className="flex justify-start items-end">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3" style={{ background: 'var(--accent-soft)' }}>
                                  <Sparkles className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent)' }}/>
                                </div>
                                <div className="px-5 py-3.5 rounded-2xl flex items-center gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)' }}></span>
                                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0.2s' }}></span>
                                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0.4s' }}></span>
                                  </span>
                                  <span className="text-[12px] font-medium italic ml-1" style={{ color: 'var(--text-muted)' }}>Đang truy xuất phổ điểm 2025...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Chat Input */}
                          <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                            <form onSubmit={handleSendFollowUp} className="relative flex items-center">
                              <input
                                type="text"
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder="Hỏi thêm về các trường/ngành khác..."
                                className="w-full rounded-full pl-5 pr-14 py-3 outline-none text-sm font-medium bg-transparent"
                                style={{ border: '1px solid var(--border)' }}
                              />
                              <button
                                type="submit"
                                disabled={!aiInput.trim() || isAiLoading}
                                className="absolute right-1.5 p-2 rounded-full transition-opacity disabled:opacity-50 flex items-center justify-center"
                                style={{ background: 'var(--accent)', color: '#fff' }}
                              >
                                <Send className="w-4 h-4 ml-0.5" />
                              </button>
                            </form>
                          </div>

                        </div>
                      )}
                    </div>
                  )}

                  {/* Nút tác vụ phụ */}
                  <div className="flex justify-center pt-2">
                     <button
                      onClick={() => {
                        setScores({sub1:'', sub2:'', sub3:''});
                        setPriorityScore('');
                        setResult(null);
                        setShowAiBox(false);
                        setAiMessages([]);
                        setAiInput('');
                        setSelectedPassions([]);
                        setCustomPassion('');
                      }}
                      className="text-sm font-medium transition-colors px-6 py-2.5 rounded-full"
                      style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
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

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative overflow-x-hidden pb-10"
      style={{ '--accent': accentColor } as React.CSSProperties}
    >

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
          <button onClick={() => setActiveExam('THPTQG')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'THPTQG' ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
            <GraduationCap className="w-5 h-5"/> Thi THPT Quốc Gia
          </button>
          <button onClick={() => setActiveExam('HSA')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'HSA' ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
            <Target className="w-5 h-5"/> ĐGNL (HSA)
          </button>
          <button onClick={() => setActiveExam('TSA')} className={`px-6 py-3.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm border ${activeExam === 'TSA' ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#252525]'}`}>
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

              {/* KHỐI 2: CHỌN KHỐI THI VÀ ĐIỂM THÀNH PHẦN */}
              <div className={`${mdCard} p-6 md:p-8`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-2">
                    <Hash className="w-4 h-4"/> Điểm thi Tổ hợp
                  </h3>
                  {calcMode === 'hust' && <span className="text-[10px] font-black uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full">Chọn 1 môn nhân đôi</span>}
                </div>

                {/* Dropdown Khối Thi */}
                <div className="mb-6">
                  <label className="block text-xs font-black uppercase tracking-wider mb-2 text-indigo-600 dark:text-indigo-400 ml-1">Chọn Khối Thi Xét Tuyển</label>
                  <select 
                    value={selectedBlock} 
                    onChange={(e) => setSelectedBlock(e.target.value)}
                    className={`${mdInput} cursor-pointer hover:bg-slate-200/50 dark:hover:bg-[#303030]`}
                  >
                    {EXAM_BLOCKS.map(b => (
                      <option key={b.code} value={b.code} className="font-bold bg-white dark:bg-[#202020]">
                        Khối {b.code} ({b.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  {[0, 1, 2].map((idx) => {
                    const num = idx + 1
                    const key = `sub${num}` as keyof typeof scores
                    const isMain = calcMode === 'hust' && mainSubject === key
                    const subjectName = currentBlockData.subs[idx]
                    
                    return (
                      <div key={key} className={`flex items-center gap-3 md:gap-4 p-2 rounded-[1.5rem] transition-colors ${isMain ? 'bg-red-50/50 dark:bg-red-900/5 -mx-2 px-4 border border-red-100 dark:border-red-900/30' : 'border border-transparent'}`}>
                        <div className="flex-1">
                          <label className="block text-xs font-bold mb-2 text-slate-600 dark:text-slate-400">Điểm môn {subjectName}</label>
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
            {/* PANEL PHẢI: KẾT QUẢ ĐẦU RA & TƯ VẤN AI LIÊN TỤC (Chiếm 5 cột) */}
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

                {/* 🌟 WIDGET ĐAM MÊ VÀ TƯ VẤN SENAI (Chỉ hiện khi đã có điểm) */}
                {result && (
                  <div className="animate-in slide-in-from-top-4 fade-in duration-500 flex flex-col gap-6">
                    
                    {/* BẢNG ĐÁNH GIÁ ĐAM MÊ NGAY KHI VỪA CÓ ĐIỂM */}
                    {!showAiBox && (
                      <div className={`${mdCard} p-6 shadow-md border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/10`}>
                        <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4"/> Định hướng đam mê của bạn</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-5">Chọn các lĩnh vực bạn yêu thích để SenAI đưa ra lời khuyên "đo ni đóng giày" nhất với số điểm của bạn nhé.</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {PRESET_PASSIONS.map(passion => (
                            <button 
                              key={passion} 
                              onClick={() => togglePassion(passion)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedPassions.includes(passion) ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md' : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[var(--accent)]'}`}
                            >
                              {passion}
                            </button>
                          ))}
                        </div>

                        <div className="mb-5">
                          <input 
                            type="text" 
                            placeholder="Hoặc tự gõ ngành nghề bạn mơ ước vào đây..."
                            value={customPassion}
                            onChange={(e) => setCustomPassion(e.target.value)}
                            className="w-full bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none text-sm font-medium text-slate-900 dark:text-white focus:border-indigo-500 shadow-inner"
                          />
                        </div>

                        <button 
                          onClick={handleAskSenAI}
                          className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl p-4 font-black shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 group"
                        >
                          <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse"/> 
                          Tư vấn Ngành học theo Đam mê
                          <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all"/>
                        </button>
                      </div>
                    )}

                    {/* KHUNG CHAT TƯ VẤN SENAI */}
                    {showAiBox && (
                      <div className="bg-white dark:bg-[#1A1A1A] border border-indigo-200 dark:border-indigo-500/30 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col h-[650px] animate-in zoom-in-95 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
                        
                        {/* Chat Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 shrink-0 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-md z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-[#202020] rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                              <Bot className="w-5 h-5"/>
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5">Gia sư Tuyển sinh SenAI <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 tracking-widest">Beta</span></h4>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Big Data: 248 Trường & 2400 Ngành</p>
                            </div>
                          </div>
                        </div>

                        {/* Chat History Area */}
                        <div 
                          ref={aiChatScrollRef}
                          className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6"
                        >
                          {aiMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-3 shadow-sm mt-1">
                                  <Bot className="w-4 h-4"/>
                                </div>
                              )}

                              <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[14px] font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[var(--accent)] text-white rounded-br-sm' : 'bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm overflow-x-auto'}`}>
                                {/* SỬ DỤNG REACT-MARKDOWN ĐỂ RENDER CHUẨN CÔNG THỨC VÀ MARKDOWN BẢNG */}
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{
                                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                    strong: ({node, ...props}) => <strong className={`font-extrabold ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                    h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-3" {...props} />,
                                    
                                    // Bổ sung các cấu hình render Bảng (Table) tương thích giao diện
                                    table: ({node, ...props}) => (
                                      <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                                        <table className="w-full text-left border-collapse text-sm min-w-full" {...props} />
                                      </div>
                                    ),
                                    thead: ({node, ...props}) => <thead className="bg-slate-100 dark:bg-[#2A2A2A] text-slate-700 dark:text-slate-300" {...props} />,
                                    tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-200 dark:divide-white/10" {...props} />,
                                    tr: ({node, ...props}) => <tr className="hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors" {...props} />,
                                    th: ({node, ...props}) => <th className="px-4 py-3 font-bold border-r last:border-r-0 border-slate-200 dark:border-white/10" {...props} />,
                                    td: ({node, ...props}) => <td className="px-4 py-3 align-top border-r last:border-r-0 border-slate-200 dark:border-white/10" {...props} />,
                                  }}
                                >
                                  {msg.text}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}

                          {isAiLoading && (
                            <div className="flex justify-start items-end">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0 mr-3 shadow-sm">
                                <Sparkles className="w-4 h-4 animate-pulse text-yellow-500"/>
                              </div>
                              <div className="bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-white/5 px-5 py-3.5 rounded-[1.5rem] rounded-bl-sm shadow-sm flex items-center gap-2">
                                <span className="flex gap-1">
                                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                </span>
                                <span className="text-[12px] text-slate-500 font-bold italic ml-1">Đang truy xuất phổ điểm 2025...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Chat Input */}
                        <div className="p-4 border-t border-slate-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#1A1A1A]">
                          <form onSubmit={handleSendFollowUp} className="relative flex items-center">
                            <input
                              type="text"
                              value={aiInput}
                              onChange={(e) => setAiInput(e.target.value)}
                              placeholder="Hỏi thêm về các trường/ngành khác..."
                              className="w-full bg-slate-100 dark:bg-[#252525] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-full pl-5 pr-14 py-3 outline-none transition-all font-medium text-slate-900 dark:text-white text-sm shadow-inner"
                            />
                            <button
                              type="submit"
                              disabled={!aiInput.trim() || isAiLoading}
                              className="absolute right-1.5 p-2 bg-[var(--accent)] hover:opacity-90 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50"
                            >
                              <Send className="w-4 h-4 ml-0.5" />
                            </button>
                          </form>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* Nút tác vụ phụ */}
                <div className="flex justify-center pt-2">
                   <button 
                    onClick={() => { 
                      setScores({sub1:'', sub2:'', sub3:''}); 
                      setPriorityScore(''); 
                      setResult(null); 
                      setShowAiBox(false); 
                      setAiMessages([]); 
                      setAiInput('');
                      setSelectedPassions([]);
                      setCustomPassion('');
                    }} 
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