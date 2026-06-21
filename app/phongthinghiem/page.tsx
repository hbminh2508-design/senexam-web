'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, FlaskConical, Settings2, Play, Square, RotateCcw, Target, CircleDot, 
  Send, Bot, Loader2, Sparkles, Activity, Cpu, Edit3, Maximize2, Minimize2, Waves, 
  Rainbow, Magnet, Menu, X, ChevronRight
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// ============================================================================
// CONSTANTS & UI STYLES
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
const inputClass = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-black text-sm shadow-inner text-slate-900 dark:text-white"
const rangeClass = "w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"

type ExpType = 'pendulum' | 'horizontal' | 'projectile' | 'kirchhoff' | 'rc_circuit' | 'interference' | 'equipotential' | 'dispersion'
type ComponentType = 'wire' | 'R' | 'E' | 'C' | 'open'
type Edge = { id: string, x1: number, y1: number, x2: number, y2: number, type: ComponentType, val: number }

const EXPERIMENTS: {id: ExpType, title: string, category: string, icon: any}[] = [
  { id: 'pendulum', title: 'Con lắc đơn', category: 'Cơ học', icon: <CircleDot className="w-5 h-5"/> },
  { id: 'horizontal', title: 'Ném ngang', category: 'Cơ học', icon: <ArrowLeft className="w-5 h-5 rotate-180"/> },
  { id: 'projectile', title: 'Ném xiên', category: 'Cơ học', icon: <Target className="w-5 h-5"/> },
  { id: 'interference', title: 'Giao thoa Y-âng', category: 'Quang học', icon: <Waves className="w-5 h-5"/> },
  { id: 'dispersion', title: 'Tán sắc ánh sáng', category: 'Quang học', icon: <Rainbow className="w-5 h-5"/> },
  { id: 'equipotential', title: 'Đường sức & Đẳng thế', category: 'Điện học', icon: <Magnet className="w-5 h-5"/> },
  { id: 'kirchhoff', title: 'ĐL Kirchhoff', category: 'Điện học', icon: <Activity className="w-5 h-5"/> },
  { id: 'rc_circuit', title: 'Mạch R-C', category: 'Điện học', icon: <Cpu className="w-5 h-5"/> },
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
  const [showSidebar, setShowSidebar] = useState(false) // 🌟 Ngăn kéo chứa danh sách thí nghiệm
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)

  // 🌟 KHÔI PHỤC TOÀN BỘ PARAMETERS CHO MỌI THÍ NGHIỆM
  const [params, setParams] = useState({ 
    l: 1, g: 9.8, m: 0.5, // Con lắc
    v0: 15, angle: 45, h: 10, // Ném
    lambda: 0.5, a: 1, D: 2, // Giao thoa Y-âng
    q1: 1, q2: -1, // Đẳng thế
    prismAngle: 60, n: 1.5 // Lăng kính
  })
  
  // Trạng thái Lưới Mạch điện
  const [edges, setEdges] = useState<Edge[]>(initEdges('K'))
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // AI States
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{role: 'user'|'model', text: string, err?: boolean}[]>([{ role: 'model', text: 'Chào bạn! Mình là SenAI. Bạn hãy thay đổi các thông số ở bảng điều khiển và bấm **Bắt đầu** nhé. Mình có thể giải thích mọi hiện tượng trong này! 🚀' }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isAiMax, setIsAiMax] = useState(false) // 🌟 Phóng to Fullscreen SenAI
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

  // Đổi thí nghiệm
  useEffect(() => {
    setIsPlaying(false); setTime(0); setSelEdgeId(null); setIsEditMode(false); setShowSidebar(false)
    if (activeExp === 'kirchhoff') setEdges(initEdges('K'))
    if (activeExp === 'rc_circuit') setEdges(initEdges('RC'))
    setAiMessages([{ role: 'model', text: `Bạn đang ở phòng lab: **${EXPERIMENTS.find(e=>e.id===activeExp)?.title}**. Mình có thể hỗ trợ tính toán hay phân tích gì không?` }])
  }, [activeExp])

  useEffect(() => { if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight }, [aiMessages, isAiLoading, isAiMax])

  // ==========================================================================
  // LOGIC SENAI
  // ==========================================================================
  const handleAskSenAI = async (e?: React.FormEvent, directQ?: string) => {
    if(e) e.preventDefault()
    const q = directQ || aiQuery.trim()
    if (!q || isAiLoading) return
    if (!directQ) setAiQuery('')
    setAiMessages(p => [...p, { role: 'user', text: q }]); setIsAiLoading(true)

    // Trích xuất ngữ cảnh chi tiết
    let ctx = `Học sinh đang dùng Thí nghiệm: ${EXPERIMENTS.find(x=>x.id===activeExp)?.title}. `
    if (['pendulum','horizontal','projectile'].includes(activeExp)) ctx += `Thông số: l=${params.l}m, g=${params.g}m/s2, m=${params.m}kg, v0=${params.v0}m/s, góc=${params.angle}°, h=${params.h}m. Mô phỏng đang chạy ở t=${time.toFixed(2)}s.`
    else if (['kirchhoff','rc_circuit'].includes(activeExp)) ctx += `Mạch điện: ${edges.map(e => `Cạnh ${e.id}(${e.type}=${e.val})`).join(', ')}.`
    else if (activeExp === 'interference') ctx += `Giao thoa Y-âng: Bước sóng lambda=${params.lambda}um, khoảng cách 2 khe a=${params.a}mm, D=${params.D}m.`
    else if (activeExp === 'equipotential') ctx += `Điện trường: Điện tích q1=${params.q1}uC, q2=${params.q2}uC.`
    else if (activeExp === 'dispersion') ctx += `Lăng kính: Góc chiết quang A=${params.prismAngle}°, Chiết suất n=${params.n}.`
    
    const sysPrompt = `Bạn là SenAI. BỐI CẢNH: ${ctx}. YÊU CẦU: Giải thích dựa trên thông số trên. Bọc công thức bằng $ hoặc $$. Dùng dấu "." cho nhân, phẩy "," cho thập phân.`

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history: [], context: sysPrompt }) })
      const data = await res.json()
      if (data.text) setAiMessages(p => [...p, { role: 'model', text: data.text }])
    } catch { setAiMessages(p => [...p, { role: 'model', text: 'Lỗi mạng AI.', err: true }]) }
    setIsAiLoading(false)
  }

  const handleCompClick = (name: string) => {
    if (['kirchhoff', 'rc_circuit'].includes(activeExp) && isEditMode) return // Bỏ qua nếu đang sửa mạch
    handleAskSenAI(undefined, `Phân tích vai trò và công thức liên quan của thành phần: ${name}.`)
  }

  // ==========================================================================
  // ĐỒNG BỘ MÀU SẮC BƯỚC SÓNG (Hỗ trợ Y-âng & Tán sắc)
  // ==========================================================================
  const waveLengthToColor = (l: number) => {
    if (l < 0.45) return 'violet'; if (l < 0.49) return 'blue'; if (l < 0.55) return 'green';
    if (l < 0.58) return 'yellow'; if (l < 0.62) return 'orange'; return 'red'
  }
  const colorMap: Record<string, string> = { violet: '#8b5cf6', blue: '#3b82f6', green: '#10b981', yellow: '#eab308', orange: '#f97316', red: '#ef4444' }

  // ==========================================================================
  // RENDER SVG ĐỘNG ĐƯỢC ĐẠI TU
  // ==========================================================================
  const renderVisuals = () => {
    if (activeExp === 'interference') {
      // Khoảng vân i = lambda * D / a. Đã scale để hiển thị vừa màn hình.
      const i_fringe = (params.lambda * params.D) / params.a 
      const colorHex = colorMap[waveLengthToColor(params.lambda)]
      const fringes = []
      // Tạo mảng các vân sáng trên màn (Từ tâm 100 tỏa ra 2 bên)
      for (let k = -10; k <= 10; k++) {
        const yPos = 100 + k * i_fringe * 15 // Scale factor 15
        if (yPos > 20 && yPos < 180) fringes.push({ k, yPos })
      }

      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[450px]">
          {/* Sóng cầu tỏa ra khi Play */}
          {isPlaying && (
            <g opacity="0.3">
              {[0, 10, 20, 30].map(delay => (
                <g key={delay} stroke={colorHex} fill="none" strokeWidth="1">
                  <circle cx="50" cy={100 - params.a * 10} r={(time * 20 + delay) % 150} />
                  <circle cx="50" cy={100 + params.a * 10} r={(time * 20 + delay) % 150} />
                </g>
              ))}
            </g>
          )}
          {/* Nguồn sáng S & Hai khe S1, S2 */}
          <line x1="50" y1="20" x2="50" y2="180" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          <rect x="48" y={100 - params.a * 10 - 2} width="4" height="4" fill="white" className="cursor-pointer shadow-[0_0_10px_white]" onClick={()=>handleCompClick('Khe S1')} />
          <rect x="48" y={100 + params.a * 10 - 2} width="4" height="4" fill="white" className="cursor-pointer shadow-[0_0_10px_white]" onClick={()=>handleCompClick('Khe S2')} />
          
          {/* Màn quan sát & Hệ vân */}
          <rect x="278" y="20" width="4" height="160" fill="currentColor" className="text-slate-800 dark:text-slate-200" />
          {fringes.map(f => (
            <rect key={f.k} x="275" y={f.yPos - 2} width="10" height="4" fill={colorHex} className={`drop-shadow-[0_0_8px_${colorHex}]`} />
          ))}
          <text x="260" y="15" className="text-[10px] fill-slate-500 font-bold">Màn E (i = {i_fringe.toFixed(2)}mm)</text>
        </svg>
      )
    }

    if (activeExp === 'equipotential') {
      // Vẽ đường sức dựa trên dấu của điện tích
      const attract = params.q1 * params.q2 < 0
      const bothPos = params.q1 > 0 && params.q2 > 0

      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[450px]">
          {/* Mạng lưới đường sức */}
          <g className="opacity-40" stroke="currentColor" fill="none">
            {attract ? (
              // Hút nhau: Đường nối giữa 2 điện tích
              <>
                <line x1="100" y1="100" x2="200" y2="100" className="text-slate-500" />
                {[20, 40, 60].map(h => (
                  <path key={h} d={`M 100 100 Q 150 ${100-h} 200 100`} className="text-slate-500" />
                ))}
                {[20, 40, 60].map(h => (
                  <path key={h} d={`M 100 100 Q 150 ${100+h} 200 100`} className="text-slate-500" />
                ))}
              </>
            ) : (
              // Đẩy nhau: Các đường sức uốn cong ra xa
              <>
                {[20, 50, 80].map(r => <path key={r} d={`M 100 100 Q 140 ${100-r} 100 ${100-r*2}`} className="text-slate-500" />)}
                {[20, 50, 80].map(r => <path key={r} d={`M 200 100 Q 160 ${100-r} 200 ${100-r*2}`} className="text-slate-500" />)}
                {[20, 50, 80].map(r => <path key={r} d={`M 100 100 Q 140 ${100+r} 100 ${100+r*2}`} className="text-slate-500" />)}
                {[20, 50, 80].map(r => <path key={r} d={`M 200 100 Q 160 ${100+r} 200 ${100+r*2}`} className="text-slate-500" />)}
              </>
            )}
          </g>

          {/* Mặt đẳng thế */}
          <circle cx="100" cy="100" r="25" fill="none" stroke={params.q1>0?'red':'blue'} strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleCompClick('Mặt đẳng thế bao quanh q1')}/>
          <circle cx="200" cy="100" r="25" fill="none" stroke={params.q2>0?'red':'blue'} strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleCompClick('Mặt đẳng thế bao quanh q2')}/>

          {/* Điện tích */}
          <circle cx="100" cy="100" r="10" className={`cursor-pointer ${params.q1>0?'fill-rose-500':'fill-blue-500'}`} onClick={()=>handleCompClick('Điện tích q1')} />
          <text x="100" y="104" textAnchor="middle" className="text-xs font-black fill-white">{params.q1>0?'+':'-'}</text>
          
          <circle cx="200" cy="100" r="10" className={`cursor-pointer ${params.q2>0?'fill-rose-500':'fill-blue-500'}`} onClick={()=>handleCompClick('Điện tích q2')} />
          <text x="200" y="104" textAnchor="middle" className="text-xs font-black fill-white">{params.q2>0?'+':'-'}</text>

          {/* Electron di chuyển nếu hút nhau */}
          {isPlaying && attract && (
             <circle r="3" className="fill-yellow-400 drop-shadow-[0_0_5px_yellow]">
               <animateMotion dur="2s" repeatCount="indefinite" path="M 100 100 Q 150 60 200 100" />
             </circle>
          )}
        </svg>
      )
    }

    if (activeExp === 'dispersion') {
      const pA = params.prismAngle // Góc chiết quang
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          {/* Tia tới (Trắng) */}
          <line x1="0" y1="120" x2="115" y2="95" stroke="white" strokeWidth="4" className="drop-shadow-[0_0_8px_white]" />
          
          {/* Lăng kính (Phóng to hơn) */}
          <polygon points={`150,${150 - pA} 90,150 210,150`} fill="currentColor" className="text-cyan-500/20 stroke-cyan-500 stroke-2 cursor-pointer" onClick={()=>handleCompClick('Lăng kính thủy tinh')} />
          <text x="145" y={170 - pA} className="text-[10px] fill-slate-400">A={pA}°</text>

          {/* Tia ló (Tán sắc thành 7 màu) - Góc lệch phụ thuộc vào n */}
          {isPlaying && (
            <g className="animate-in fade-in duration-1000" transform={`translate(160, 95) rotate(${params.n * 10 - 15})`}>
              <line x1="0" y1="0" x2="140" y2="-30" stroke="#ef4444" strokeWidth="2" className="drop-shadow-[0_0_5px_red]"/>
              <line x1="0" y1="0" x2="140" y2="-15" stroke="#f97316" strokeWidth="2" className="drop-shadow-[0_0_5px_orange]"/>
              <line x1="0" y1="0" x2="140" y2="0" stroke="#eab308" strokeWidth="2" className="drop-shadow-[0_0_5px_yellow]"/>
              <line x1="0" y1="0" x2="140" y2="15" stroke="#10b981" strokeWidth="2" className="drop-shadow-[0_0_5px_green]"/>
              <line x1="0" y1="0" x2="140" y2="30" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-[0_0_5px_blue]"/>
              <line x1="0" y1="0" x2="140" y2="45" stroke="#8b5cf6" strokeWidth="2" className="drop-shadow-[0_0_5px_purple]"/>
            </g>
          )}
        </svg>
      )
    }

    // CÁC THÍ NGHIỆM CƠ BẢN VÀ MẠCH ĐIỆN (KẾ THỪA BẢN TRƯỚC)
    if (activeExp === 'pendulum') {
      const w = Math.sqrt(params.g / params.l)
      const theta = (Math.PI / 6) * Math.cos(w * time)
      const px = 150 + params.l * 80 * Math.sin(theta); const py = 20 + params.l * 80 * Math.cos(theta)
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <line x1="50" y1="20" x2="250" y2="20" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          <line x1="150" y1="20" x2={px} y2={py} stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
          <circle cx={px} cy={py} r={10 + params.m * 2} className="fill-indigo-600 cursor-pointer hover:fill-indigo-400" onClick={() => handleCompClick('Quả nặng m')}/>
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
          <circle cx={x} cy={y} r="6" className="fill-rose-500 cursor-pointer" onClick={() => handleCompClick('Vật ném')} />
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
              <g key={e.id} onClick={() => { isEditMode ? setSelEdgeId(e.id) : handleCompClick(`${e.type==='R'?'Điện trở':e.type==='C'?'Tụ điện':e.type==='E'?'Nguồn điện':'Dây'} nhánh ${e.id}`) }} className="cursor-pointer group">
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="transparent" strokeWidth="30" />
                <g transform={`translate(${mx}, ${my}) rotate(${rot})`} className={`transition-all duration-300 ${isSel ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-105' : 'group-hover:drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]'}`}>
                  {renderComp(e.type)}
                </g>
                {e.type !== 'wire' && e.type !== 'open' && <text x={mx + (rot===90?15:0)} y={my + (rot===0?-15:0)} textAnchor="middle" className="text-[10px] font-black fill-slate-500">{e.val} {e.type==='R'?'Ω':e.type==='E'?'V':'μF'}</text>}
                {isPlaying && e.type !== 'open' && <circle r="3" className="fill-yellow-400 drop-shadow-md"><animateMotion dur="2s" repeatCount="indefinite" path={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} /></circle>}
              </g>
            )
          })}
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

      {/* 🌟 SIDEBAR: NGĂN KÉO CHỌN THÍ NGHIỆM */}
      {showSidebar && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowSidebar(false)}></div>
          <div className="w-[300px] h-full bg-white dark:bg-[#121212] shadow-2xl relative z-10 p-6 flex flex-col animate-in slide-in-from-left-full duration-300 border-r border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
              <h2 className="font-black text-xl flex items-center gap-2"><FlaskConical className="text-indigo-500 w-6 h-6"/> Kho Thí Nghiệm</h2>
              <button onClick={() => setShowSidebar(false)} className="p-2 bg-slate-100 dark:bg-[#202020] rounded-xl"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {['Cơ học', 'Điện học', 'Quang học'].map(cat => (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 pl-2">{cat}</p>
                  {EXPERIMENTS.filter(e => e.category === cat).map(exp => (
                    <button key={exp.id} onClick={() => setActiveExp(exp.id as ExpType)} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm mb-1 transition-all ${activeExp === exp.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#1A1A1A] text-slate-700 dark:text-slate-300'}`}>
                      <span className="flex items-center gap-3">{exp.icon} {exp.title}</span>
                      {activeExp === exp.id && <ChevronRight className="w-4 h-4"/>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-[80px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center px-4 sm:px-8 sticky top-0 z-40 shadow-sm justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105"><ArrowLeft className="w-5 h-5"/></button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-2"></div>
          <button onClick={() => setShowSidebar(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-sm hover:bg-indigo-100 transition-colors">
            <Menu className="w-4 h-4" /> Danh sách Thí nghiệm
          </button>
        </div>
        <h1 className="font-black text-lg hidden sm:flex text-slate-800 dark:text-white">{EXPERIMENTS.find(e=>e.id===activeExp)?.title}</h1>
      </header>

      {/* WORKSPACE */}
      <div className="max-w-[1500px] mx-auto pt-6 px-4 md:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[75vh]">
          
          {/* CỘT TRÁI (Visual & Controls) */}
          <div className={`lg:col-span-7 flex flex-col gap-6 ${isAiMax ? 'hidden' : ''}`}>
            <div className={`${mdCard} p-4 h-[400px] lg:h-[450px] flex items-center justify-center relative overflow-hidden group`}>
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 shadow-md ${isPlaying ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {isPlaying ? <><Square className="w-4 h-4 fill-white"/> Dừng</> : <><Play className="w-4 h-4 fill-white"/> Bắt đầu</>}
                </button>
                <button onClick={() => { setIsPlaying(false); setTime(0); }} className="p-2 bg-slate-100 dark:bg-[#202020] rounded-xl font-black"><RotateCcw className="w-5 h-5"/></button>
              </div>
              {renderVisuals()}
            </div>

            {/* Bảng Cấu Hình */}
            <div className={`${mdCard} p-6 shrink-0`}>
              <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Cấu hình vật lý</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {activeExp === 'pendulum' && [
                  {k:'l', l:'Chiều dài (m)', min:0.1, max:5, s:0.1}, {k:'g', l:'Gia tốc (m/s²)', min:1, max:20, s:0.1}, {k:'m', l:'Khối lượng (kg)', min:0.1, max:10, s:0.1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {['projectile','horizontal'].includes(activeExp) && [
                  {k:'v0', l:'Vận tốc (m/s)', min:1, max:50, s:1}, {k:'h', l:'Độ cao (m)', min:0, max:50, s:1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-blue-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                {activeExp === 'projectile' && <div><label className="flex justify-between text-xs font-bold mb-2"><span>Góc ném (°)</span><span className="text-blue-600">{params.angle}°</span></label><input type="range" min="0" max="90" step="1" value={params.angle} onChange={(e)=>setParams({...params, angle: Number(e.target.value)})} className={rangeClass}/></div>}

                {activeExp === 'interference' && [
                  {k:'lambda', l:'Bước sóng (μm)', min:0.38, max:0.76, s:0.01}, {k:'a', l:'Khoảng cách 2 khe (mm)', min:0.5, max:3, s:0.1}, {k:'D', l:'K/c đến màn (m)', min:1, max:5, s:0.5}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {activeExp === 'equipotential' && [
                  {k:'q1', l:'Điện tích q1 (μC)', min:-5, max:5, s:1}, {k:'q2', l:'Điện tích q2 (μC)', min:-5, max:5, s:1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-rose-500">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}

                {activeExp === 'dispersion' && [
                  {k:'prismAngle', l:'Góc chiết quang A (°)', min:30, max:90, s:1}, {k:'n', l:'Chiết suất n', min:1.2, max:2.0, s:0.1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-cyan-500">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}

                {['kirchhoff','rc_circuit'].includes(activeExp) && (
                  <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-4 bg-slate-50 dark:bg-[#161616] p-4 rounded-xl border border-slate-200 dark:border-white/5">
                    <button onClick={() => {setIsEditMode(!isEditMode); setSelEdgeId(null)}} className={`px-4 py-3 rounded-xl text-xs font-black shadow-md w-full md:w-auto ${isEditMode ? 'bg-amber-500 text-white' : 'bg-white dark:bg-[#252525] text-slate-700 dark:text-slate-200'}`}>
                      {isEditMode ? 'Tắt chế độ Sửa (Bật Hỏi AI)' : 'Bật Sửa Mạch'}
                    </button>
                    {isEditMode && selEdgeId && (
                      <div className="flex gap-2 flex-1">
                        <select value={edges.find(e=>e.id===selEdgeId)?.type} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, type: e.target.value as ComponentType} : ed))} className={`${inputClass} !py-2 w-1/2`}>
                          <option value="wire">Dây</option><option value="R">Trở</option><option value="E">Nguồn</option><option value="C">Tụ</option><option value="open">Cắt</option>
                        </select>
                        <input type="number" value={edges.find(e=>e.id===selEdgeId)?.val} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, val: Number(e.target.value)} : ed))} className={`${inputClass} !py-2 w-1/2`} placeholder="Giá trị"/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 🌟 CỘT PHẢI (SenAI) - ĐÃ CẢI TIẾN WINDOW */}
          <div className={`${isAiMax ? 'fixed inset-4 z-[200]' : 'lg:col-span-5 h-[500px] lg:h-auto'} bg-white dark:bg-[#161616] rounded-[2.5rem] border border-indigo-200 dark:border-indigo-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 shrink-0"></div>
            
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#1A1A1A]/80 flex justify-between items-center shrink-0">
              <div className="flex gap-3"><div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-indigo-600"/></div><div><h4 className="font-black text-sm">Gia sư Lab SenAI</h4><p className="text-[10px] font-bold text-slate-500 uppercase">Hỏi đáp theo cấu hình thực tế</p></div></div>
              <button onClick={() => setIsAiMax(!isAiMax)} className="p-2 bg-slate-200 dark:bg-[#252525] rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                {isAiMax ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
              </button>
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
                <input type="text" value={aiQuery} onChange={(e)=>setAiQuery(e.target.value)} placeholder="Hỏi lý thuyết, công thức hoặc cách giải bài tập..." className={`${inputClass} pr-12 rounded-full`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiLoading} className="absolute right-1.5 p-2.5 bg-indigo-600 text-white rounded-full disabled:opacity-50 hover:bg-indigo-700 transition-colors"><Send className="w-4 h-4 ml-0.5"/></button>
              </form>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}