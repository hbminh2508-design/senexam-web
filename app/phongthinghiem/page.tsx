'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, FlaskConical, Settings2, Activity, Play, RotateCcw,
  Cpu, Zap, Waves, Target, CircleDot, Send, Bot, Loader2, Sparkles,
  Info, ChevronRight
} from 'lucide-react'

// Render Markdown và LaTeX
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// ============================================================================
// CONSTANTS & UI STYLES
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all font-medium text-sm shadow-inner text-slate-900 dark:text-white"
const rangeInput = "w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"

type ExperimentType = 'pendulum' | 'horizontal' | 'projectile' | 'kirchhoff' | 'rc_circuit'
type AiMessage = { role: 'user' | 'model'; text: string; isError?: boolean }

const EXPERIMENTS = [
  { id: 'pendulum', title: 'Con lắc đơn', icon: <CircleDot className="w-5 h-5"/>, category: 'Cơ học' },
  { id: 'horizontal', title: 'Ném ngang', icon: <ArrowLeft className="w-5 h-5 rotate-180"/>, category: 'Cơ học' },
  { id: 'projectile', title: 'Ném xiên', icon: <Target className="w-5 h-5"/>, category: 'Cơ học' },
  { id: 'kirchhoff', title: 'Định luật Kirchhoff', icon: <Activity className="w-5 h-5"/>, category: 'Điện học' },
  { id: 'rc_circuit', title: 'Mạch R-C', icon: <Cpu className="w-5 h-5"/>, category: 'Điện học' },
]

export default function VirtualLabPage() {
  const router = useRouter()
  const [activeExp, setActiveExp] = useState<ExperimentType>('pendulum')

  // STATES THÔNG SỐ VẬT LÝ
  // 1. Con lắc đơn
  const [pendulumLength, setPendulumLength] = useState(1) // mét
  const [pendulumGravity, setPendulumGravity] = useState(9.8) // m/s2
  const [pendulumMass, setPendulumMass] = useState(0.5) // kg
  
  // 2. Ném xiên & Ném ngang
  const [v0, setV0] = useState(15) // m/s
  const [angle, setAngle] = useState(45) // độ (Ném xiên)
  const [height, setHeight] = useState(10) // mét (Ném ngang/Ném xiên)

  // 3. Mạch R-C
  const [resistance, setResistance] = useState(100) // Ohm
  const [capacitance, setCapacitance] = useState(10) // MicroFarad
  const [voltage, setVoltage] = useState(12) // V

  // STATES AI ASSISTANT
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([{
    role: 'model',
    text: 'Chào bạn! Mình là SenAI - Trợ lý Phòng thí nghiệm. Bạn có thể thay đổi thông số ở bảng điều khiển, hoặc **bấm trực tiếp vào các bộ phận trên hình vẽ** để mình giải thích chi tiết nhé! 🚀'
  }])
  const [isAiSearching, setIsAiSearching] = useState(false)
  const aiChatScrollRef = useRef<HTMLDivElement>(null)

  // Khởi tạo Theme
  useEffect(() => {
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (aiChatScrollRef.current) aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight
  }, [aiMessages, isAiSearching])

  // Reset chat when changing experiment
  useEffect(() => {
    setAiMessages([{ role: 'model', text: `Đã chuyển sang thí nghiệm **${EXPERIMENTS.find(e => e.id === activeExp)?.title}**. Bạn cần mình hỗ trợ tính toán hay giải thích hiện tượng gì không?` }])
  }, [activeExp])

  // ==========================================================================
  // XỬ LÝ GỌI SENAI
  // ==========================================================================
  const handleAskSenAI = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault()
    const q = customQuery || aiQuery.trim()
    if (!q || isAiSearching) return

    if (!customQuery) setAiQuery('')
    setAiMessages(p => [...p, { role: 'user', text: q }])
    setIsAiSearching(true)

    // Tạo Context về trạng thái hiện tại của Thí nghiệm để AI hiểu bối cảnh
    let contextStr = `Học sinh đang thao tác thí nghiệm: ${EXPERIMENTS.find(x => x.id === activeExp)?.title}.\n`
    if (activeExp === 'pendulum') contextStr += `Thông số hiện tại: Chiều dài dây l = ${pendulumLength} m, Trọng trường g = ${pendulumGravity} m/s2, Khối lượng m = ${pendulumMass} kg.`
    else if (activeExp === 'projectile') contextStr += `Thông số hiện tại: Vận tốc đầu v0 = ${v0} m/s, Góc ném = ${angle} độ, Độ cao ban đầu h = ${height} m.`
    else if (activeExp === 'horizontal') contextStr += `Thông số hiện tại: Vận tốc đầu v0 = ${v0} m/s, Độ cao ban đầu h = ${height} m.`
    else if (activeExp === 'rc_circuit') contextStr += `Thông số: Điện trở R = ${resistance} Ohm, Điện dung C = ${capacitance} uF, Điện áp U = ${voltage} V.`

    const systemPrompt = `Bạn là SenAI, trợ lý Phòng thí nghiệm Vật lý ảo của nền tảng SenExam.
    QUY TẮC HIỂN THỊ TOÁN HỌC & ĐIỂM SỐ BẮT BUỘC:
    - Bọc công thức Toán/Vật lý bằng ký hiệu $ (inline) hoặc $$ (block).
    - Phải sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân (Ví dụ: 9,8 . 10).
    - Giải thích rõ ràng, thân thiện, xưng "Mình" gọi "Bạn".
    
    BỐI CẢNH (CONTEXT):
    ${contextStr}
    Dựa vào thông số trên, hãy tính toán hoặc giải thích chính xác theo yêu cầu của học sinh. Tuyệt đối không bịa ra số liệu sai lệch với Bối cảnh.`

    try {
      const res = await fetch('/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ message: q, history: [], context: systemPrompt }) 
      })
      const data = await res.json()
      if (data.text) {
        setAiMessages(p => [...p, { role: 'model', text: data.text }])
      }
    } catch (err) {
      setAiMessages(p => [...p, { role: 'model', text: 'Xin lỗi, máy chủ AI đang bận. Bạn thử lại sau nhé!', isError: true }])
    }
    setIsAiSearching(false)
  }

  // Hàm khi bấm vào các thành phần (Hotspots) trên hình
  const handleComponentClick = (componentName: string) => {
    handleAskSenAI(undefined, `Giải thích chi tiết về bộ phận: ${componentName} trong thí nghiệm này và vai trò của nó.`)
  }

  // ==========================================================================
  // RENDER CÁC THÍ NGHIỆM TRỰC QUAN (SVG ANIMATIONS)
  // ==========================================================================
  const renderExperimentVisual = () => {
    if (activeExp === 'pendulum') {
      const period = 2 * Math.PI * Math.sqrt(pendulumLength / pendulumGravity)
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-indigo-900/5 dark:bg-black/20 rounded-[2rem] overflow-hidden border border-indigo-500/10">
          <div className="absolute top-4 left-4 text-xs font-black text-indigo-500 opacity-50">T = {period.toFixed(2)}s</div>
          
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[300px]">
            <line x1="20" y1="20" x2="180" y2="20" stroke="currentColor" strokeWidth="4" className="text-slate-400 dark:text-slate-600" />
            <g style={{ transformOrigin: '100px 20px', animation: `swing ${period}s ease-in-out infinite alternate` }}>
              <style>{`@keyframes swing { 0% { transform: rotate(30deg); } 100% { transform: rotate(-30deg); } }`}</style>
              <line x1="100" y1="20" x2="100" y2={20 + pendulumLength * 80} stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
              <circle 
                cx="100" cy={20 + pendulumLength * 80} r={10 + pendulumMass * 5} 
                className="fill-indigo-600 cursor-pointer hover:fill-indigo-400 transition-colors drop-shadow-lg"
                onClick={() => handleComponentClick('Quả nặng (Vật m)')}
              />
            </g>
          </svg>
          <div className="absolute bottom-4 text-xs font-bold text-slate-500 bg-white/50 dark:bg-black/50 px-3 py-1 rounded-lg">Bấm vào quả nặng để hỏi AI</div>
        </div>
      )
    }

    if (activeExp === 'projectile' || activeExp === 'horizontal') {
      const g = 9.8
      const rad = activeExp === 'horizontal' ? 0 : (angle * Math.PI) / 180
      const vx = v0 * Math.cos(rad)
      const vy = v0 * Math.sin(rad)
      // Thời gian bay (y = 0)
      const t_flight = (vy + Math.sqrt(vy * vy + 2 * g * height)) / g
      const max_x = vx * t_flight
      const max_y = height + (vy * vy) / (2 * g)

      // Vẽ đường cong Parabol
      let pathD = `M 10 ${200 - height * 5}`
      for (let t = 0; t <= t_flight; t += t_flight/20) {
        const x = 10 + (vx * t) * 5 // Scale 5x
        const y = 200 - (height + vy * t - 0.5 * g * t * t) * 5
        pathD += ` L ${x} ${y}`
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-end relative bg-blue-900/5 dark:bg-black/20 rounded-[2rem] overflow-hidden border border-blue-500/10 p-6">
          <div className="absolute top-4 left-4 text-xs font-black text-blue-500 opacity-80 bg-white/50 dark:bg-black/50 px-3 py-1 rounded-lg">Lmax = {max_x.toFixed(2)}m | Hmax = {max_y.toFixed(2)}m</div>
          
          <svg viewBox="0 0 300 220" className="w-full h-full max-h-[300px] overflow-visible">
            {/* Trục tọa độ */}
            <line x1="10" y1="200" x2="290" y2="200" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
            <line x1="10" y1="200" x2="10" y2="10" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
            
            {/* Tháp ném */}
            {height > 0 && <rect x="0" y={200 - height * 5} width="10" height={height * 5} className="fill-slate-400 dark:fill-slate-600" />}
            
            {/* Quỹ đạo */}
            <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" className="text-blue-500 animate-[dash_2s_linear_infinite]" />
            <style>{`@keyframes dash { to { stroke-dashoffset: -20; } }`}</style>
            
            {/* Viên đạn (Hotspot) */}
            <circle cx="10" cy={200 - height * 5} r="6" className="fill-rose-500 cursor-pointer hover:fill-rose-400 shadow-xl" onClick={() => handleComponentClick('Vật ném (Viên đạn)')}/>
            
            {/* Vecto vận tốc v0 */}
            <g transform={`translate(10, ${200 - height * 5}) rotate(${-angle})`}>
              <line x1="0" y1="0" x2="40" y2="0" stroke="currentColor" strokeWidth="2" className="text-emerald-500" />
              <polygon points="40,0 35,-3 35,3" className="fill-emerald-500" />
            </g>
          </svg>
        </div>
      )
    }

    if (activeExp === 'kirchhoff') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-emerald-900/5 dark:bg-black/20 rounded-[2rem] overflow-hidden border border-emerald-500/10">
          <svg viewBox="0 0 300 200" className="w-full h-full max-w-[350px]">
            {/* Khung mạch */}
            <rect x="50" y="50" width="200" height="100" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-400 dark:text-slate-600" />
            <line x1="150" y1="50" x2="150" y2="150" stroke="currentColor" strokeWidth="3" className="text-slate-400 dark:text-slate-600" />
            
            {/* Nguồn E1 */}
            <g className="cursor-pointer group" onClick={() => handleComponentClick('Nguồn điện E1')}>
              <rect x="40" y="85" width="20" height="30" className="fill-slate-50 dark:fill-slate-800" />
              <line x1="40" y1="90" x2="60" y2="90" stroke="currentColor" strokeWidth="4" className="text-emerald-500 group-hover:text-emerald-400" />
              <line x1="45" y1="110" x2="55" y2="110" stroke="currentColor" strokeWidth="8" className="text-slate-800 dark:text-slate-300" />
              <text x="20" y="105" className="text-xs font-bold fill-emerald-600 dark:fill-emerald-400">E1</text>
            </g>

            {/* Trở R1 */}
            <g className="cursor-pointer group" onClick={() => handleComponentClick('Điện trở R1')}>
              <rect x="90" y="40" width="40" height="20" className="fill-slate-200 dark:fill-slate-700 stroke-2 stroke-indigo-500 group-hover:fill-indigo-200" />
              <path d="M 90 50 L 95 40 L 105 60 L 115 40 L 125 60 L 130 50" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 dark:text-indigo-400" />
              <text x="100" y="30" className="text-xs font-bold fill-indigo-600 dark:fill-indigo-400">R1</text>
            </g>

            {/* Nút mạng (Hotspot) */}
            <circle cx="150" cy="50" r="6" className="fill-rose-500 cursor-pointer hover:scale-125 transition-transform" onClick={() => handleComponentClick('Nút mạng (Giao điểm Kirchhoff 1)')}/>
            <circle cx="150" cy="150" r="6" className="fill-rose-500 cursor-pointer hover:scale-125 transition-transform" onClick={() => handleComponentClick('Nút mạng (Giao điểm Kirchhoff 2)')}/>
          </svg>
          <div className="absolute bottom-4 text-xs font-bold text-slate-500 bg-white/50 dark:bg-black/50 px-3 py-1 rounded-lg">Bấm vào Ký hiệu (R, E, Nút) để học</div>
        </div>
      )
    }

    if (activeExp === 'rc_circuit') {
      const tau = resistance * capacitance / 1000 // ms
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-orange-900/5 dark:bg-black/20 rounded-[2rem] overflow-hidden border border-orange-500/10 p-4">
          <div className="absolute top-4 left-4 text-xs font-black text-orange-500 opacity-80 bg-white/50 dark:bg-black/50 px-3 py-1 rounded-lg">Hằng số tg \tau = {tau.toFixed(2)} ms</div>
          
          <svg viewBox="0 0 300 150" className="w-full max-w-[300px] mb-6">
            <rect x="50" y="40" width="200" height="80" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-400 dark:text-slate-600" />
            
            {/* Tụ điện C */}
            <g className="cursor-pointer group" onClick={() => handleComponentClick('Tụ điện C')}>
              <rect x="235" y="60" width="30" height="40" className="fill-slate-50 dark:fill-[#1A1A1A]" />
              <line x1="245" y1="60" x2="245" y2="100" stroke="currentColor" strokeWidth="4" className="text-orange-500 group-hover:text-orange-400" />
              <line x1="255" y1="60" x2="255" y2="100" stroke="currentColor" strokeWidth="4" className="text-orange-500 group-hover:text-orange-400" />
              <text x="270" y="85" className="text-xs font-bold fill-orange-600 dark:fill-orange-400">C</text>
            </g>

            {/* Trở R */}
            <g className="cursor-pointer group" onClick={() => handleComponentClick('Điện trở R trong mạch R-C')}>
              <rect x="130" y="30" width="40" height="20" className="fill-slate-200 dark:fill-slate-700 stroke-2 stroke-indigo-500 group-hover:fill-indigo-200" />
              <text x="145" y="20" className="text-xs font-bold fill-indigo-600 dark:fill-indigo-400">R</text>
            </g>
          </svg>

          {/* Đồ thị sạc tụ giả lập */}
          <div className="w-full max-w-[300px] h-[80px] border-l-2 border-b-2 border-slate-300 dark:border-slate-700 relative flex items-end">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <path d="M 0 100 Q 20 10, 100 5" fill="none" stroke="currentColor" strokeWidth="3" className="text-orange-500" />
            </svg>
            <span className="absolute -left-6 top-0 text-[9px] text-slate-500">Uc</span>
            <span className="absolute bottom-[-16px] right-0 text-[9px] text-slate-500">t</span>
          </div>
        </div>
      )
    }

    return null
  }

  // ==========================================================================
  // RENDER BẢNG ĐIỀU KHIỂN THÔNG SỐ (CONTROLS)
  // ==========================================================================
  const renderExperimentControls = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4"><Settings2 className="w-4 h-4"/> Điều chỉnh thông số</h3>
        
        {activeExp === 'pendulum' && (
          <>
            <div>
              <label className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2"><span>Chiều dài dây (l)</span> <span>{pendulumLength} m</span></label>
              <input type="range" min="0.1" max="5" step="0.1" value={pendulumLength} onChange={(e)=>setPendulumLength(Number(e.target.value))} className={rangeInput}/>
            </div>
            <div>
              <label className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2"><span>Gia tốc trọng trường (g)</span> <span>{pendulumGravity} m/s²</span></label>
              <input type="range" min="1" max="20" step="0.1" value={pendulumGravity} onChange={(e)=>setPendulumGravity(Number(e.target.value))} className={rangeInput}/>
            </div>
            <div>
              <label className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2"><span>Khối lượng (m)</span> <span>{pendulumMass} kg</span></label>
              <input type="range" min="0.1" max="10" step="0.1" value={pendulumMass} onChange={(e)=>setPendulumMass(Number(e.target.value))} className={rangeInput}/>
            </div>
          </>
        )}

        {(activeExp === 'projectile' || activeExp === 'horizontal') && (
          <>
            <div>
              <label className="flex justify-between text-xs font-bold text-blue-600 dark:text-blue-400 mb-2"><span>Vận tốc ném (v0)</span> <span>{v0} m/s</span></label>
              <input type="range" min="1" max="50" step="1" value={v0} onChange={(e)=>setV0(Number(e.target.value))} className={rangeInput}/>
            </div>
            {activeExp === 'projectile' && (
              <div>
                <label className="flex justify-between text-xs font-bold text-blue-600 dark:text-blue-400 mb-2"><span>Góc ném (α)</span> <span>{angle}°</span></label>
                <input type="range" min="0" max="90" step="1" value={angle} onChange={(e)=>setAngle(Number(e.target.value))} className={rangeInput}/>
              </div>
            )}
            <div>
              <label className="flex justify-between text-xs font-bold text-blue-600 dark:text-blue-400 mb-2"><span>Độ cao ban đầu (h)</span> <span>{height} m</span></label>
              <input type="range" min="0" max="50" step="1" value={height} onChange={(e)=>setHeight(Number(e.target.value))} className={rangeInput}/>
            </div>
          </>
        )}

        {activeExp === 'rc_circuit' && (
          <>
            <div>
              <label className="flex justify-between text-xs font-bold text-orange-600 dark:text-orange-400 mb-2"><span>Điện trở (R)</span> <span>{resistance} Ω</span></label>
              <input type="range" min="10" max="1000" step="10" value={resistance} onChange={(e)=>setResistance(Number(e.target.value))} className={rangeInput}/>
            </div>
            <div>
              <label className="flex justify-between text-xs font-bold text-orange-600 dark:text-orange-400 mb-2"><span>Điện dung (C)</span> <span>{capacitance} μF</span></label>
              <input type="range" min="1" max="100" step="1" value={capacitance} onChange={(e)=>setCapacitance(Number(e.target.value))} className={rangeInput}/>
            </div>
          </>
        )}

        {activeExp === 'kirchhoff' && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">Mô hình Định luật Kirchhoff hiện đang khóa chế độ tùy chỉnh tĩnh. Bấm vào các nút mạng và thành phần mạch bên cạnh để SenAI giải thích hệ phương trình tương ứng nhé!</p>
          </div>
        )}
      </div>
    )
  }

  // ==========================================================================
  // RENDER APP
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-10 transition-colors duration-500">
      
      {/* 🌟 Nền Ambient */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 🌟 HEADER APP BAR */}
      <header className="h-[88px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-40 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] rounded-full transition-transform active:scale-95 group border border-slate-200/50 dark:border-white/5">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform"/>
          </button>
          <div className="flex flex-col">
            <h1 className="font-black text-xl flex items-center gap-2 tracking-tight text-slate-900 dark:text-white">
              <FlaskConical className="w-6 h-6 text-indigo-500" /> Virtual Lab
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Phòng thí nghiệm Vật lý AI</p>
          </div>
        </div>
      </header>

      {/* 🌟 MAIN WORKSPACE */}
      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        
        {/* THANH ĐIỀU HƯỚNG THÍ NGHIỆM */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-4 custom-scrollbar hide-scroll">
          {EXPERIMENTS.map(exp => (
            <button 
              key={exp.id} onClick={() => setActiveExp(exp.id as ExperimentType)}
              className={`px-5 py-3 rounded-xl text-sm font-black flex items-center gap-2 whitespace-nowrap transition-all border ${activeExp === exp.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50'}`}
            >
              {exp.icon} {exp.title}
            </button>
          ))}
        </div>

        {/* LƯỚI BỐ CỤC */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[70vh]">
          
          {/* CỘT TRÁI: HIỂN THỊ THÍ NGHIỆM VÀ ĐIỀU KHIỂN (7 COLUMNS) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Box Hình Ảnh Thí Nghiệm */}
            <div className={`${mdCard} p-4 h-[400px] lg:h-[500px] flex items-center justify-center relative overflow-hidden group`}>
              <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-lg text-slate-700 dark:text-slate-300 hover:text-indigo-500"><Play className="w-4 h-4"/></button>
                <button className="p-2 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-lg text-slate-700 dark:text-slate-300 hover:text-indigo-500"><RotateCcw className="w-4 h-4"/></button>
              </div>
              {renderExperimentVisual()}
            </div>

            {/* Box Điều Khiển Thông Số */}
            <div className={`${mdCard} p-6 shrink-0`}>
              {renderExperimentControls()}
            </div>
          </div>

          {/* CỘT PHẢI: SENAI ASSISTANT (5 COLUMNS) */}
          <div className="lg:col-span-5 h-[600px] lg:h-auto bg-white dark:bg-[#161616] rounded-[2rem] border border-indigo-200 dark:border-indigo-500/30 shadow-xl overflow-hidden flex flex-col relative animate-in slide-in-from-right-8 duration-500">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 z-20"></div>
            
            <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1A1A1A]/50 shrink-0 z-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shadow-inner"><Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/></div>
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">Gia sư Phòng Lab SenAI</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hỏi đáp & Giải thích chuyên sâu</p>
              </div>
            </div>

            <div ref={aiChatScrollRef} className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6 bg-transparent">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-3 mt-1"><Bot className="w-4 h-4"/></div>}
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[13px] font-medium shadow-sm leading-relaxed overflow-x-auto ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : msg.isError ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-100 dark:border-rose-900/50 rounded-bl-sm' : 'bg-slate-50 dark:bg-[#202020] rounded-bl-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-200'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath, remarkGfm]} 
                      rehypePlugins={[rehypeKatex]} 
                      components={{ 
                        p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />, 
                        strong: ({node, ...props}: any) => <strong className={`font-black ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...props} /> 
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiSearching && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin"/></div>
                  <div className="bg-slate-50 dark:bg-[#202020] px-5 py-3 rounded-[1.5rem] rounded-bl-sm text-[12px] text-slate-500 font-bold italic border border-slate-100 dark:border-white/5">SenAI đang phân tích hiện tượng...</div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#1A1A1A] shrink-0 z-10">
              <form onSubmit={handleAskSenAI} className="relative flex items-center">
                <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Hỏi về hiện tượng vật lý đang diễn ra..." className={`${mdInput} pr-14 rounded-full`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiSearching} className="absolute right-1.5 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full transition-transform active:scale-95 shadow-md"><Send className="w-4 h-4 ml-0.5" /></button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}