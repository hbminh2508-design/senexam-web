'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, FlaskConical, Settings2, Play, Square, RotateCcw,
  Target, CircleDot, Send, Bot, Loader2, Sparkles, Activity, Cpu, Edit3
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

type ExpType = 'pendulum' | 'horizontal' | 'projectile' | 'kirchhoff' | 'rc_circuit'
type ComponentType = 'wire' | 'R' | 'E' | 'C' | 'open'
type Edge = { id: string, x1: number, y1: number, x2: number, y2: number, type: ComponentType, val: number }

const EXPERIMENTS: {id: ExpType, title: string, icon: any}[] = [
  { id: 'pendulum', title: 'Con lắc đơn', icon: <CircleDot className="w-4 h-4"/> },
  { id: 'horizontal', title: 'Ném ngang', icon: <ArrowLeft className="w-4 h-4 rotate-180"/> },
  { id: 'projectile', title: 'Ném xiên', icon: <Target className="w-4 h-4"/> },
  { id: 'kirchhoff', title: 'ĐL Kirchhoff (Lưới)', icon: <Activity className="w-4 h-4"/> },
  { id: 'rc_circuit', title: 'Mạch R-C (Lưới)', icon: <Cpu className="w-4 h-4"/> },
]

// Mạng lưới mạch điện mặc định (7 cạnh)
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
  
  // Trạng thái Mô phỏng Thời gian thực
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)

  // Tham số Vật lý Cơ học
  const [params, setParams] = useState({ l: 1, g: 9.8, m: 0.5, v0: 15, angle: 45, h: 10 })
  
  // Trạng thái Lưới Mạch điện
  const [edges, setEdges] = useState<Edge[]>(initEdges('K'))
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null)

  // AI States
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{role: 'user'|'model', text: string, err?: boolean}[]>([{ role: 'model', text: 'Chào bạn! Bấm **Bắt đầu** để chạy thí nghiệm. Bấm trực tiếp vào các linh kiện mạch điện để thay đổi tùy ý nhé! 🚀' }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const aiScrollRef = useRef<HTMLDivElement>(null)

  // Động cơ Vật lý (Physics Engine Loop)
  useEffect(() => {
    let req: number, last = performance.now()
    const loop = (now: number) => {
      setTime(t => t + (now - last) / 1000)
      last = now; req = requestAnimationFrame(loop)
    }
    if (isPlaying) req = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(req)
  }, [isPlaying])

  // Reset khi đổi Tab
  useEffect(() => {
    setIsPlaying(false); setTime(0); setSelEdgeId(null);
    if (activeExp === 'kirchhoff') setEdges(initEdges('K'))
    if (activeExp === 'rc_circuit') setEdges(initEdges('RC'))
    setAiMessages([{ role: 'model', text: `Chuyển sang cấu hình: **${EXPERIMENTS.find(e=>e.id===activeExp)?.title}**. Bạn cần hỗ trợ tính toán gì không?` }])
  }, [activeExp])

  useEffect(() => { if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight }, [aiMessages, isAiLoading])

  // ==========================================================================
  // LOGIC SENAI (NHẬN THỨC NGỮ CẢNH)
  // ==========================================================================
  const handleAskSenAI = async (e?: React.FormEvent, directQ?: string) => {
    if(e) e.preventDefault()
    const q = directQ || aiQuery.trim()
    if (!q || isAiLoading) return
    if (!directQ) setAiQuery('')
    setAiMessages(p => [...p, { role: 'user', text: q }]); setIsAiLoading(true)

    // Nhúng toàn bộ thông số thí nghiệm hiện tại vào não AI
    let ctx = `Học sinh đang ở Thí nghiệm: ${EXPERIMENTS.find(x=>x.id===activeExp)?.title}. `
    if (['pendulum','horizontal','projectile'].includes(activeExp)) {
      ctx += `Thông số: Chiều dài l=${params.l}m, Gia tốc g=${params.g}m/s2, Khối lượng m=${params.m}kg, Vận tốc v0=${params.v0}m/s, Góc ném=${params.angle}°, Độ cao h=${params.h}m. Mô phỏng đang ở giây thứ t=${time.toFixed(2)}s.`
    } else {
      ctx += `Cấu trúc Mạch điện hiện tại: ${edges.map(e => `Cạnh ${e.id}(${e.type}=${e.val})`).join(', ')}.`
    }
    const sysPrompt = `Bạn là SenAI, trợ lý Phòng Thí Nghiệm Vật lý. BỐI CẢNH THỰC TẾ: ${ctx}. Bắt buộc bọc công thức bằng $ hoặc $$. Trả lời thân thiện, chính xác, phân tích các hiện tượng dựa đúng trên các thông số này.`

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history: [], context: sysPrompt }) })
      const data = await res.json()
      if (data.text) setAiMessages(p => [...p, { role: 'model', text: data.text }])
    } catch { setAiMessages(p => [...p, { role: 'model', text: 'Lỗi mạng AI.', err: true }]) }
    setIsAiLoading(false)
  }

  // ==========================================================================
  // RENDER HÌNH ẢNH TRỰC QUAN (SVG)
  // ==========================================================================
  const renderVisuals = () => {
    // 1. CON LẮC ĐƠN
    if (activeExp === 'pendulum') {
      const w = Math.sqrt(params.g / params.l)
      const theta = (Math.PI / 6) * Math.cos(w * time) // Góc thả ban đầu 30 độ
      const px = 150 + params.l * 80 * Math.sin(theta)
      const py = 20 + params.l * 80 * Math.cos(theta)
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <line x1="50" y1="20" x2="250" y2="20" stroke="currentColor" strokeWidth="4" className="text-slate-400 dark:text-slate-600" />
          <line x1="150" y1="20" x2={px} y2={py} stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
          <circle cx={px} cy={py} r={10 + params.m * 2} className="fill-indigo-600 cursor-pointer hover:fill-indigo-400 shadow-xl" onClick={() => handleAskSenAI(undefined, 'Phân tích lực tác dụng lên quả nặng tại vị trí hiện tại.')}/>
          <text x="10" y="190" className="text-xs fill-slate-500 font-bold">t = {time.toFixed(2)}s | T = {(2*Math.PI/w).toFixed(2)}s</text>
        </svg>
      )
    }

    // 2. NÉM XIÊN / NGANG
    if (activeExp === 'projectile' || activeExp === 'horizontal') {
      const rad = activeExp === 'horizontal' ? 0 : params.angle * Math.PI / 180
      const t_max = (params.v0 * Math.sin(rad) + Math.sqrt(Math.pow(params.v0 * Math.sin(rad), 2) + 2 * params.g * params.h)) / params.g
      const curT = Math.min(time, t_max) // Dừng khi chạm đất
      const x = 20 + params.v0 * Math.cos(rad) * curT * 5
      const y = 200 - (params.h + params.v0 * Math.sin(rad) * curT - 0.5 * params.g * curT * curT) * 5

      // Vẽ nét đứt quỹ đạo
      let pathD = `M 20 ${200 - params.h * 5}`
      for (let t = 0; t <= t_max; t += t_max/20) pathD += ` L ${20 + params.v0 * Math.cos(rad) * t * 5} ${200 - (params.h + params.v0 * Math.sin(rad) * t - 0.5 * params.g * t * t) * 5}`

      return (
        <svg viewBox="0 0 350 220" className="w-full h-full max-w-[450px] overflow-visible">
          <line x1="10" y1="200" x2="340" y2="200" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
          {params.h > 0 && <rect x="10" y={200 - params.h * 5} width="10" height={params.h * 5} className="fill-slate-400" />}
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" className="text-blue-500/50" />
          <circle cx={x} cy={y} r="6" className="fill-rose-500 shadow-xl" />
          <text x="10" y="215" className="text-xs fill-slate-500 font-bold">t = {curT.toFixed(2)}s / {t_max.toFixed(2)}s</text>
        </svg>
      )
    }

    // 3. MẠCH ĐIỆN TÙY BIẾN (Kirchhoff / RC)
    if (activeExp === 'kirchhoff' || activeExp === 'rc_circuit') {
      const renderComp = (type: ComponentType) => {
        if (type === 'wire') return <line x1="-50" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/>
        if (type === 'R') return <path d="M-50 0 L-25 0 L-20 -10 L-10 10 L0 -10 L10 10 L20 -10 L25 0 L50 0" fill="none" stroke="currentColor" strokeWidth="3" className="text-rose-500"/>
        if (type === 'E') return <g><line x1="-50" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><line x1="-5" y1="-15" x2="-5" y2="15" stroke="currentColor" strokeWidth="3" className="text-slate-500"/><line x1="5" y1="-10" x2="5" y2="10" stroke="currentColor" strokeWidth="5" className="text-emerald-500"/><line x1="5" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><text x="8" y="-12" fontSize="10" className="fill-emerald-500 font-bold">+</text></g>
        if (type === 'C') return <g><line x1="-50" y1="0" x2="-5" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/><line x1="-5" y1="-15" x2="-5" y2="15" stroke="currentColor" strokeWidth="4" className="text-amber-500"/><line x1="5" y1="-15" x2="5" y2="15" stroke="currentColor" strokeWidth="4" className="text-amber-500"/><line x1="5" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="3" className="text-indigo-400"/></g>
        return null // 'open'
      }

      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          {edges.map(e => {
            const mx = (e.x1 + e.x2) / 2; const my = (e.y1 + e.y2) / 2
            const rot = e.x1 === e.x2 ? 90 : 0
            const isSel = selEdgeId === e.id
            return (
              <g key={e.id} onClick={() => setSelEdgeId(e.id)} className="cursor-pointer group">
                {/* Vùng bấm rộng (Hitbox) */}
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="transparent" strokeWidth="30" />
                <g transform={`translate(${mx}, ${my}) rotate(${rot})`} className={`transition-all duration-300 ${isSel ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-105' : 'group-hover:drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]'}`}>
                  {renderComp(e.type)}
                </g>
                {/* Nhãn giá trị */}
                {e.type !== 'wire' && e.type !== 'open' && (
                  <text x={mx + (rot===90?15:0)} y={my + (rot===0?-15:0)} textAnchor="middle" className="text-[10px] font-black fill-slate-500 dark:fill-slate-400">
                    {e.val} {e.type==='R'?'Ω':e.type==='E'?'V':'μF'}
                  </text>
                )}
                {/* Hiệu ứng dòng điện chảy khi Play */}
                {isPlaying && e.type !== 'open' && (
                  <circle r="3" className="fill-yellow-400 drop-shadow-md">
                    <animateMotion dur="2s" repeatCount="indefinite" path={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} />
                  </circle>
                )}
              </g>
            )
          })}
          {/* Nút mạng */}
          {[ [50,50], [150,50], [250,50], [50,150], [150,150], [250,150] ].map((n, i) => (
            <circle key={i} cx={n[0]} cy={n[1]} r="4" className="fill-slate-400 dark:fill-slate-600" />
          ))}
        </svg>
      )
    }
  }

  // ==========================================================================
  // RENDER APP
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-10 transition-colors duration-500">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER */}
      <header className="h-[80px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 transition-transform"><ArrowLeft className="w-5 h-5"/></button>
          <div><h1 className="font-black text-xl flex items-center gap-2"><FlaskConical className="w-6 h-6 text-indigo-500" /> Smart Virtual Lab</h1><p className="text-[10px] font-bold text-slate-500 uppercase">Phòng Thí Nghiệm AI Tương Tác</p></div>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        
        {/* TABS */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-2 custom-scrollbar">
          {EXPERIMENTS.map(exp => (
            <button key={exp.id} onClick={() => setActiveExp(exp.id as ExpType)} className={`px-5 py-3 rounded-xl text-sm font-black flex items-center gap-2 whitespace-nowrap transition-all shadow-sm ${activeExp === exp.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10'}`}>
              {exp.icon} {exp.title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[70vh]">
          
          {/* TRÁI: KHUNG NHÌN VÀ ĐIỀU KHIỂN */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Visualizer */}
            <div className={`${mdCard} p-4 h-[400px] lg:h-[450px] flex items-center justify-center relative overflow-hidden group border-indigo-200/50 dark:border-indigo-500/20`}>
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-md ${isPlaying ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {isPlaying ? <><Square className="w-4 h-4 fill-white"/> Tạm dừng</> : <><Play className="w-4 h-4 fill-white"/> Bắt đầu</>}
                </button>
                <button onClick={() => { setIsPlaying(false); setTime(0); }} className="px-4 py-2 bg-slate-100 dark:bg-[#202020] rounded-xl text-slate-700 dark:text-slate-300 font-black hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-sm">
                  <RotateCcw className="w-4 h-4"/> Đặt lại
                </button>
              </div>
              {renderVisuals()}
            </div>

            {/* Bảng Điều Khiển Cơ Học */}
            {['pendulum','horizontal','projectile'].includes(activeExp) && (
              <div className={`${mdCard} p-6 shrink-0`}>
                <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Cấu hình vật lý</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {activeExp === 'pendulum' && [
                    {k:'l', l:'Chiều dài (m)', min:0.1, max:5, s:0.1}, {k:'g', l:'Gia tốc (m/s²)', min:1, max:20, s:0.1}, {k:'m', l:'Khối lượng (kg)', min:0.1, max:10, s:0.1}
                  ].map(c => (
                    <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>
                  ))}
                  {['projectile','horizontal'].includes(activeExp) && [
                    {k:'v0', l:'Vận tốc (m/s)', min:1, max:50, s:1}, {k:'h', l:'Độ cao (m)', min:0, max:50, s:1}
                  ].map(c => (
                    <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-blue-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>
                  ))}
                  {activeExp === 'projectile' && (
                    <div><label className="flex justify-between text-xs font-bold mb-2"><span>Góc ném (°)</span><span className="text-blue-600">{params.angle}°</span></label><input type="range" min="0" max="90" step="1" value={params.angle} onChange={(e)=>setParams({...params, angle: Number(e.target.value)})} className={rangeClass}/></div>
                  )}
                </div>
              </div>
            )}

            {/* Bảng Điều Khiển Mạch Điện (Smart Grid Control) */}
            {['kirchhoff','rc_circuit'].includes(activeExp) && (
              <div className={`${mdCard} p-6 shrink-0 bg-indigo-50/50 dark:bg-indigo-900/10`}>
                <h3 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2"><Edit3 className="w-4 h-4"/> Chỉnh sửa Linh kiện</h3>
                {!selEdgeId ? (
                  <p className="text-xs font-bold text-slate-500 italic">👆 Bấm vào bất kỳ nhánh nào trên sơ đồ mạch để thay đổi loại linh kiện (Tụ, Trở, Nguồn, Dây) và giá trị của nó.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4 items-end animate-in fade-in">
                    <div className="w-full sm:w-1/2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Loại linh kiện (Nhánh {selEdgeId})</label>
                      <select 
                        value={edges.find(e=>e.id===selEdgeId)?.type} 
                        onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, type: e.target.value as ComponentType} : ed))}
                        className={inputClass}
                      >
                        <option value="wire">Dây dẫn</option>
                        <option value="R">Điện trở (R)</option>
                        <option value="E">Nguồn điện (E)</option>
                        <option value="C">Tụ điện (C)</option>
                        <option value="open">Ngắt mạch (Open)</option>
                      </select>
                    </div>
                    {edges.find(e=>e.id===selEdgeId)?.type !== 'wire' && edges.find(e=>e.id===selEdgeId)?.type !== 'open' && (
                      <div className="w-full sm:w-1/2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Giá trị</label>
                        <input type="number" value={edges.find(e=>e.id===selEdgeId)?.val} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, val: Number(e.target.value)} : ed))} className={inputClass}/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PHẢI: SENAI ASSISTANT */}
          <div className="lg:col-span-5 flex flex-col bg-white dark:bg-[#161616] rounded-[2.5rem] border border-indigo-200 dark:border-indigo-500/30 shadow-xl overflow-hidden animate-in slide-in-from-right-8 h-[600px] lg:h-auto relative">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 z-10 shrink-0"></div>
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#1A1A1A]/80 flex gap-3 shrink-0">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-indigo-600"/></div>
              <div><h4 className="font-black text-sm text-slate-900 dark:text-white">Gia sư Lab SenAI</h4><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hỏi đáp theo cấu hình thực tế</p></div>
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

            <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-slate-100 dark:border-white/5 shrink-0">
              <form onSubmit={handleAskSenAI} className="relative flex items-center">
                <input type="text" value={aiQuery} onChange={(e)=>setAiQuery(e.target.value)} placeholder="Nhờ AI tính dòng điện, chu kỳ..." className={`${inputClass} pr-12 rounded-full`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiLoading} className="absolute right-1.5 p-2.5 bg-indigo-600 text-white rounded-full disabled:opacity-50"><Send className="w-4 h-4 ml-0.5"/></button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}