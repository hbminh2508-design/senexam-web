'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, FlaskConical, Settings2, Play, Square, RotateCcw, Target, CircleDot, 
  Send, Bot, Loader2, Sparkles, Activity, Cpu, Edit3, Maximize2, Minimize2, Waves, Rainbow, Magnet
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// ============================================================================
// CONSTANTS, TYPES & PRESETS
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
const inputClass = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-black text-sm shadow-inner"
const rangeClass = "w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"

type ExpType = 'pendulum' | 'horizontal' | 'projectile' | 'kirchhoff' | 'rc_circuit' | 'interference' | 'equipotential' | 'dispersion'
type ComponentType = 'wire' | 'R' | 'E' | 'C' | 'open'
type Edge = { id: string, x1: number, y1: number, x2: number, y2: number, type: ComponentType, val: number }

const EXPERIMENTS: {id: ExpType, title: string, icon: any}[] = [
  { id: 'pendulum', title: 'Con lắc đơn', icon: <CircleDot className="w-4 h-4"/> },
  { id: 'horizontal', title: 'Ném ngang', icon: <ArrowLeft className="w-4 h-4 rotate-180"/> },
  { id: 'projectile', title: 'Ném xiên', icon: <Target className="w-4 h-4"/> },
  { id: 'kirchhoff', title: 'ĐL Kirchhoff', icon: <Activity className="w-4 h-4"/> },
  { id: 'rc_circuit', title: 'Mạch R-C', icon: <Cpu className="w-4 h-4"/> },
  { id: 'interference', title: 'Giao thoa Y-âng', icon: <Waves className="w-4 h-4"/> },
  { id: 'equipotential', title: 'Đẳng thế & Đường sức', icon: <Magnet className="w-4 h-4"/> },
  { id: 'dispersion', title: 'Tán sắc & Cầu vồng', icon: <Rainbow className="w-4 h-4"/> },
]

const initEdges = (preset: 'K' | 'RC'): Edge[] => [
  { id: 'left', x1: 50, y1: 50, x2: 50, y2: 150, type: 'E', val: 12 },
  { id: 'mid', x1: 150, y1: 50, x2: 150, y2: 150, type: preset === 'K' ? 'R' : 'C', val: preset === 'K' ? 10 : 100 },
  { id: 'right', x1: 250, y1: 50, x2: 250, y2: 150, type: preset === 'K' ? 'E' : 'open', val: preset === 'K' ? 9 : 0 },
  { id: 'top1', x1: 50, y1: 50, x2: 150, y2: 50, type: 'R', val: 5 },
  { id: 'top2', x1: 150, y1: 50, x2: 250, y2: 50, type: preset === 'K' ? 'R' : 'open', val: preset === 'K' ? 5 : 0 },
  { id: 'bot1', x1: 50, y1: 150, x2: 150, y2: 150, type: 'wire', val: 0 },
  { id: 'bot2', x1: 150, y1: 150, x2: 250, y2: 150, type: preset === 'K' ? 'wire' : 'open', val: 0 },
]

export default function VirtualLabPage() {
  const router = useRouter()
  const [activeExp, setActiveExp] = useState<ExpType>('pendulum')
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)

  // Tham số Vật lý Toàn cục
  const [params, setParams] = useState({ 
    l: 1, g: 9.8, m: 0.5, v0: 15, angle: 45, h: 10, // Cơ học
    lambda: 0.5, a: 1, D: 2, // Giao thoa (um, mm, m)
    q1: 1, q2: -1, // Đẳng thế (uC)
    prismAngle: 60, n: 1.5 // Tán sắc
  })
  
  // Trạng thái Lưới Mạch điện
  const [edges, setEdges] = useState<Edge[]>(initEdges('K'))
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false) // Toggle mode Edit/Ask AI

  // AI States
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{role: 'user'|'model', text: string, err?: boolean}[]>([{ role: 'model', text: 'Chào bạn! Bấm **Bắt đầu** để chạy thí nghiệm. Bấm trực tiếp vào các hiện tượng/linh kiện để mình giải thích nhé! 🚀' }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isAiMax, setIsAiMax] = useState(false) // Phóng to SenAI
  const aiScrollRef = useRef<HTMLDivElement>(null)

  // Physics Loop
  useEffect(() => {
    let req: number, last = performance.now()
    const loop = (now: number) => {
      setTime(t => t + (now - last) / 1000)
      last = now; req = requestAnimationFrame(loop)
    }
    if (isPlaying) req = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(req)
  }, [isPlaying])

  // Reset on Tab Change
  useEffect(() => {
    setIsPlaying(false); setTime(0); setSelEdgeId(null); setIsEditMode(false)
    if (activeExp === 'kirchhoff') setEdges(initEdges('K'))
    if (activeExp === 'rc_circuit') setEdges(initEdges('RC'))
    setAiMessages([{ role: 'model', text: `Chuyển sang: **${EXPERIMENTS.find(e=>e.id===activeExp)?.title}**. Bạn có câu hỏi nào về lý thuyết hay công thức không?` }])
  }, [activeExp])

  useEffect(() => { if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight }, [aiMessages, isAiLoading, isAiMax])

  // ==========================================================================
  // LOGIC SENAI (NHẬN THỨC NGỮ CẢNH)
  // ==========================================================================
  const handleAskSenAI = async (e?: React.FormEvent, directQ?: string) => {
    if(e) e.preventDefault()
    const q = directQ || aiQuery.trim()
    if (!q || isAiLoading) return
    if (!directQ) setAiQuery('')
    setAiMessages(p => [...p, { role: 'user', text: q }]); setIsAiLoading(true)

    let ctx = `Học sinh đang ở Thí nghiệm: ${EXPERIMENTS.find(x=>x.id===activeExp)?.title}. `
    if (['pendulum','horizontal','projectile'].includes(activeExp)) ctx += `Thông số: l=${params.l}m, g=${params.g}m/s2, m=${params.m}kg, v0=${params.v0}m/s, góc=${params.angle}°, h=${params.h}m. Mô phỏng t=${time.toFixed(2)}s.`
    else if (['kirchhoff','rc_circuit'].includes(activeExp)) ctx += `Cấu trúc Mạch: ${edges.map(e => `Cạnh ${e.id}(${e.type}=${e.val})`).join(', ')}.`
    else if (activeExp === 'interference') ctx += `Giao thoa Y-âng: Bước sóng lambda=${params.lambda}um, a=${params.a}mm, D=${params.D}m.`
    else if (activeExp === 'equipotential') ctx += `Điện trường: q1=${params.q1}uC, q2=${params.q2}uC.`
    else if (activeExp === 'dispersion') ctx += `Tán sắc: Góc chiết quang=${params.prismAngle}°, Chiết suất=${params.n}.`
    
    const sysPrompt = `Bạn là SenAI, gia sư Vật lý. BỐI CẢNH THỰC TẾ: ${ctx}. Bắt buộc bọc công thức Toán học bằng $ hoặc $$, dùng dấu "." cho phép nhân, phẩy "," cho số thập phân. Trả lời thân thiện.`

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history: [], context: sysPrompt }) })
      const data = await res.json()
      if (data.text) setAiMessages(p => [...p, { role: 'model', text: data.text }])
    } catch { setAiMessages(p => [...p, { role: 'model', text: 'Lỗi mạng AI.', err: true }]) }
    setIsAiLoading(false)
  }

  // Component Click Handler
  const handleComponentClick = (id: string, type: string, name: string) => {
    if (['kirchhoff', 'rc_circuit'].includes(activeExp) && isEditMode) {
      setSelEdgeId(id); return
    }
    handleAskSenAI(undefined, `Hãy giải thích chi tiết về thành phần "${name}" trong thí nghiệm này (Vai trò, công thức liên quan).`)
  }

  // ==========================================================================
  // RENDER HÌNH ẢNH TRỰC QUAN (SVG ĐỘNG)
  // ==========================================================================
  const renderVisuals = () => {
    if (activeExp === 'pendulum') {
      const w = Math.sqrt(params.g / params.l)
      const theta = (Math.PI / 6) * Math.cos(w * time)
      const px = 150 + params.l * 80 * Math.sin(theta); const py = 20 + params.l * 80 * Math.cos(theta)
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <line x1="50" y1="20" x2="250" y2="20" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          <line x1="150" y1="20" x2={px} y2={py} stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
          <circle cx={px} cy={py} r={10 + params.m * 2} className="fill-indigo-600 cursor-pointer hover:fill-indigo-400" onClick={() => handleComponentClick('m', 'mass', 'Quả nặng (Vật m)')}/>
          <text x="10" y="190" className="text-xs fill-slate-500 font-bold">t = {time.toFixed(2)}s | T = {(2*Math.PI/w).toFixed(2)}s</text>
        </svg>
      )
    }

    if (activeExp === 'projectile' || activeExp === 'horizontal') {
      const rad = activeExp === 'horizontal' ? 0 : params.angle * Math.PI / 180
      const t_max = (params.v0 * Math.sin(rad) + Math.sqrt(Math.pow(params.v0 * Math.sin(rad), 2) + 2 * params.g * params.h)) / params.g
      const curT = Math.min(time, t_max)
      const x = 20 + params.v0 * Math.cos(rad) * curT * 5; const y = 200 - (params.h + params.v0 * Math.sin(rad) * curT - 0.5 * params.g * curT * curT) * 5
      let pathD = `M 20 ${200 - params.h * 5}`
      for (let t = 0; t <= t_max; t += t_max/20) pathD += ` L ${20 + params.v0 * Math.cos(rad) * t * 5} ${200 - (params.h + params.v0 * Math.sin(rad) * t - 0.5 * params.g * t * t) * 5}`
      return (
        <svg viewBox="0 0 350 220" className="w-full h-full max-w-[450px]">
          <line x1="10" y1="200" x2="340" y2="200" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
          {params.h > 0 && <rect x="10" y={200 - params.h * 5} width="10" height={params.h * 5} className="fill-slate-400" />}
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" className="text-blue-500/50" />
          <circle cx={x} cy={y} r="6" className="fill-rose-500 cursor-pointer" onClick={() => handleComponentClick('v', 'obj', 'Vật ném (Viên đạn)')} />
        </svg>
      )
    }

    if (activeExp === 'kirchhoff' || activeExp === 'rc_circuit') {
      const renderComp = (type: ComponentType) => {
        if (type === 'wire') return <line x1="-50" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/>
        if (type === 'R') return <path d="M-50 0 L-25 0 L-20 -10 L-10 10 L0 -10 L10 10 L20 -10 L25 0 L50 0" fill="none" stroke="currentColor" strokeWidth="3" className="text-rose-500"/>
        if (type === 'E') return <g><line x1="-50" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><line x1="-5" y1="-15" x2="-5" y2="15" stroke="currentColor" strokeWidth="3" className="text-slate-500"/><line x1="5" y1="-10" x2="5" y2="10" stroke="currentColor" strokeWidth="5" className="text-emerald-500"/><line x1="5" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><text x="8" y="-12" fontSize="10" className="fill-emerald-500 font-bold">+</text></g>
        if (type === 'C') return <g><line x1="-50" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><line x1="-5" y1="-15" x2="-5" y2="15" stroke="currentColor" strokeWidth="4" className="text-amber-500"/><line x1="5" y1="-15" x2="5" y2="15" stroke="currentColor" strokeWidth="4" className="text-amber-500"/><line x1="5" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/></g>
        return null
      }
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          {edges.map(e => {
            const mx = (e.x1 + e.x2) / 2; const my = (e.y1 + e.y2) / 2; const rot = e.x1 === e.x2 ? 90 : 0
            const isSel = isEditMode && selEdgeId === e.id
            return (
              <g key={e.id} onClick={() => handleComponentClick(e.id, e.type, e.type==='R'?'Điện trở':e.type==='C'?'Tụ điện':e.type==='E'?'Nguồn điện':'Dây dẫn')} className="cursor-pointer group">
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="transparent" strokeWidth="30" />
                <g transform={`translate(${mx}, ${my}) rotate(${rot})`} className={`transition-all duration-300 ${isSel ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-105' : 'group-hover:drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]'}`}>
                  {renderComp(e.type)}
                </g>
                {e.type !== 'wire' && e.type !== 'open' && <text x={mx + (rot===90?15:0)} y={my + (rot===0?-15:0)} textAnchor="middle" className="text-[10px] font-black fill-slate-500">{e.val} {e.type==='R'?'Ω':e.type==='E'?'V':'μF'}</text>}
                {isPlaying && e.type !== 'open' && <circle r="3" className="fill-yellow-400 drop-shadow-md"><animateMotion dur="2s" repeatCount="indefinite" path={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} /></circle>}
              </g>
            )
          })}
          {[ [50,50], [150,50], [250,50], [50,150], [150,150], [250,150] ].map((n, i) => <circle key={i} cx={n[0]} cy={n[1]} r="4" className="fill-slate-400" />)}
        </svg>
      )
    }

    if (activeExp === 'interference') {
      // i = lambda * D / a (mm) -> Phóng to scale
      const i = (params.lambda * params.D) / params.a 
      let waveD = ""
      for(let x=0; x<=300; x+=2) waveD += `${x===0?'M':'L'} ${x} ${100 - 40 * Math.pow(Math.cos(Math.PI * (x-150) / (i*20)), 2)}`
      
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <line x1="50" y1="20" x2="50" y2="180" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          {/* Hai khe */}
          <rect x="48" y={100 - params.a*10 - 2} width="4" height="4" className="fill-white" />
          <rect x="48" y={100 + params.a*10 - 2} width="4" height="4" className="fill-white" />
          {/* Màn quan sát */}
          <line x1="280" y1="20" x2="280" y2="180" stroke="currentColor" strokeWidth="6" className="text-slate-800 dark:text-slate-200 cursor-pointer" onClick={()=>handleComponentClick('m','man','Màn quan sát (Vân giao thoa)')} />
          {/* Sóng ánh sáng */}
          {isPlaying && (
            <g className="opacity-50">
              <circle cx="50" cy={100 - params.a*10} r={20 + (time*50)%100} fill="none" stroke="cyan" strokeWidth="1" />
              <circle cx="50" cy={100 + params.a*10} r={20 + (time*50)%100} fill="none" stroke="cyan" strokeWidth="1" />
            </g>
          )}
          {/* Đồ thị vân sáng */}
          <path d={waveD} fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 opacity-80" transform="translate(280, 0) rotate(90 0 100) scale(0.6) translate(-150, -50)" />
        </svg>
      )
    }

    if (activeExp === 'equipotential') {
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px] overflow-hidden">
          {/* Đường sức (Minh họa đơn giản bằng các cung tròn) */}
          <g className="opacity-40">
            {[0.5, 1, 1.5, 2].map(r => (
              <path key={r} d={`M 100 100 A ${r*50} ${r*30} 0 0 1 200 100`} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-500" />
            ))}
            {[0.5, 1, 1.5, 2].map(r => (
              <path key={r} d={`M 100 100 A ${r*50} ${r*30} 0 0 0 200 100`} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-500" />
            ))}
          </g>
          {/* Mặt đẳng thế (Vòng tròn) */}
          <circle cx="100" cy="100" r="20" fill="none" stroke="red" strokeWidth="1" strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleComponentClick('dt1','dt','Mặt đẳng thế q1')} />
          <circle cx="200" cy="100" r="20" fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleComponentClick('dt2','dt','Mặt đẳng thế q2')} />
          
          <circle cx="100" cy="100" r="8" className="fill-red-500 cursor-pointer" onClick={()=>handleComponentClick('q1','q','Điện tích q1')} />
          <text x="100" y="104" textAnchor="middle" className="text-[10px] fill-white font-bold pointer-events-none">{params.q1 > 0 ? '+' : '-'}</text>
          
          <circle cx="200" cy="100" r="8" className="fill-blue-500 cursor-pointer" onClick={()=>handleComponentClick('q2','q','Điện tích q2')} />
          <text x="200" y="104" textAnchor="middle" className="text-[10px] fill-white font-bold pointer-events-none">{params.q2 > 0 ? '+' : '-'}</text>
        </svg>
      )
    }

    if (activeExp === 'dispersion') {
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          {/* Tia tới */}
          <line x1="0" y1="120" x2="110" y2="100" stroke="white" strokeWidth="3" className="drop-shadow-[0_0_5px_white]" />
          {/* Lăng kính */}
          <polygon points="150,30 90,150 210,150" fill="currentColor" className="text-cyan-500/20 stroke-cyan-500 stroke-2 cursor-pointer" onClick={()=>handleComponentClick('lk','prism','Lăng kính tán sắc')} />
          {/* Tia ló (Tán sắc) */}
          {isPlaying && (
            <g className="animate-in fade-in duration-1000">
              <line x1="160" y1="90" x2="300" y2="60" stroke="red" strokeWidth="2" className="drop-shadow-[0_0_5px_red]"/>
              <line x1="165" y1="100" x2="300" y2="80" stroke="yellow" strokeWidth="2" className="drop-shadow-[0_0_5px_yellow]"/>
              <line x1="170" y1="110" x2="300" y2="100" stroke="green" strokeWidth="2" className="drop-shadow-[0_0_5px_green]"/>
              <line x1="175" y1="120" x2="300" y2="120" stroke="blue" strokeWidth="2" className="drop-shadow-[0_0_5px_blue]"/>
              <line x1="180" y1="130" x2="300" y2="140" stroke="purple" strokeWidth="2" className="drop-shadow-[0_0_5px_purple]"/>
            </g>
          )}
        </svg>
      )
    }
    return null
  }

  // ==========================================================================
  // RENDER APP
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-10 transition-colors duration-500">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <header className="h-[80px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-40 shadow-sm">
        <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 mr-4"><ArrowLeft className="w-5 h-5"/></button>
        <div><h1 className="font-black text-xl flex items-center gap-2"><FlaskConical className="text-indigo-500"/> Virtual Lab</h1></div>
      </header>

      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        
        {/* TABS */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-2 custom-scrollbar">
          {EXPERIMENTS.map(exp => (
            <button key={exp.id} onClick={() => setActiveExp(exp.id as ExpType)} className={`px-5 py-3 rounded-xl text-sm font-black flex items-center gap-2 whitespace-nowrap transition-all shadow-sm ${activeExp === exp.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10 hover:border-indigo-400'}`}>
              {exp.icon} {exp.title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* CỘT TRÁI (Visual & Controls) */}
          <div className={`${isAiMax ? 'hidden' : 'lg:col-span-7 flex flex-col gap-6'}`}>
            <div className={`${mdCard} p-4 h-[400px] lg:h-[450px] flex items-center justify-center relative overflow-hidden group`}>
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-md ${isPlaying ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {isPlaying ? <><Square className="w-4 h-4"/> Tạm dừng</> : <><Play className="w-4 h-4"/> Bắt đầu</>}
                </button>
                <button onClick={() => { setIsPlaying(false); setTime(0); }} className="px-4 py-2 bg-slate-100 dark:bg-[#202020] rounded-xl font-black shadow-sm"><RotateCcw className="w-4 h-4"/></button>
              </div>
              {renderVisuals()}
            </div>

            {/* Controls */}
            <div className={`${mdCard} p-6 shrink-0`}>
              <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Cấu hình vật lý</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {activeExp === 'interference' && [
                  {k:'lambda', l:'Bước sóng (μm)', min:0.38, max:0.76, s:0.01}, {k:'a', l:'K/c 2 khe (mm)', min:0.5, max:3, s:0.1}, {k:'D', l:'K/c đến màn (m)', min:1, max:5, s:0.5}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {activeExp === 'equipotential' && [
                  {k:'q1', l:'Điện tích q1 (μC)', min:-5, max:5, s:1}, {k:'q2', l:'Điện tích q2 (μC)', min:-5, max:5, s:1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {['kirchhoff','rc_circuit'].includes(activeExp) && (
                  <div className="col-span-1 md:col-span-2 flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl">
                    <button onClick={() => {setIsEditMode(!isEditMode); setSelEdgeId(null)}} className={`px-4 py-2 rounded-xl text-xs font-black shadow-md transition-colors ${isEditMode ? 'bg-amber-500 text-white' : 'bg-white dark:bg-[#202020] text-slate-700 dark:text-slate-200'}`}>
                      {isEditMode ? 'Đang Sửa Mạch (Tắt để Hỏi AI)' : 'Bật Chế độ Sửa Mạch'}
                    </button>
                    {isEditMode && selEdgeId && (
                      <div className="flex gap-2 items-center flex-1">
                        <select value={edges.find(e=>e.id===selEdgeId)?.type} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, type: e.target.value as ComponentType} : ed))} className="px-3 py-2 rounded-lg text-xs font-bold bg-white outline-none">
                          <option value="wire">Dây</option><option value="R">Điện trở</option><option value="E">Nguồn</option><option value="C">Tụ</option><option value="open">Cắt</option>
                        </select>
                        <input type="number" value={edges.find(e=>e.id===selEdgeId)?.val} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, val: Number(e.target.value)} : ed))} className="w-20 px-3 py-2 rounded-lg text-xs font-bold outline-none"/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (SenAI) */}
          <div className={`${isAiMax ? 'fixed inset-4 z-50' : 'lg:col-span-5 h-[450px] lg:h-auto'} bg-white dark:bg-[#161616] rounded-[2.5rem] border border-indigo-200 dark:border-indigo-500/30 shadow-2xl overflow-hidden flex flex-col transition-all duration-300`}>
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 shrink-0"></div>
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#1A1A1A]/80 flex justify-between items-center shrink-0">
              <div className="flex gap-3"><div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-indigo-600"/></div><div><h4 className="font-black text-sm">Gia sư Lab SenAI</h4><p className="text-[10px] font-bold text-slate-500 uppercase">Hỏi đáp theo cấu hình thực tế</p></div></div>
              <button onClick={() => setIsAiMax(!isAiMax)} className="p-2 bg-slate-200 dark:bg-[#202020] rounded-lg hover:scale-105">{isAiMax ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}</button>
            </div>

            <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 mt-1 shrink-0"><Bot className="w-4 h-4 text-indigo-600"/></div>}
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[13px] font-medium leading-relaxed shadow-sm ${m.role==='user'?'bg-indigo-600 text-white rounded-br-sm':m.err?'bg-rose-50 text-rose-600 rounded-bl-sm':'bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-white/5 rounded-bl-sm'}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p:({node,...p}:any)=><p className="mb-2 last:mb-0" {...p}/>, strong:({node,...p}:any)=><strong className="font-black text-indigo-500" {...p}/> }}>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiLoading && <div className="flex gap-3 items-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-600"/><span className="text-xs font-bold text-slate-400">SenAI đang tính toán...</span></div>}
            </div>

            <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t shrink-0">
              <form onSubmit={handleAskSenAI} className="relative flex items-center">
                <input type="text" value={aiQuery} onChange={(e)=>setAiQuery(e.target.value)} placeholder="Nhờ AI tính toán, giải thích..." className={`${inputClass} pr-12 rounded-full`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiLoading} className="absolute right-1.5 p-2.5 bg-indigo-600 text-white rounded-full"><Send className="w-4 h-4 ml-0.5"/></button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}