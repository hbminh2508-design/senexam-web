'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, FlaskConical, Settings2, Play, Square, RotateCcw, Target, CircleDot, 
  Send, Bot, Loader2, Sparkles, Activity, Cpu, Edit3, Maximize2, Minimize2, Waves, 
  Rainbow, Magnet, Menu, X, ChevronRight, Info
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
  { id: 'equipotential', title: 'Điện trường & Đẳng thế', category: 'Điện học', icon: <Magnet className="w-5 h-5"/> },
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
  const [showSidebar, setShowSidebar] = useState(false)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)

  // THÔNG SỐ VẬT LÝ
  const [params, setParams] = useState({ 
    l: 1, g: 9.8, m: 0.5, 
    v0: 15, angle: 45, h: 10, 
    lambda: 0.55, a: 1, D: 2, 
    q1: 1, q2: -1, 
    prismAngle: 60, incidenceAngle: 45, n: 1.5 
  })
  
  const [edges, setEdges] = useState<Edge[]>(initEdges('K'))
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // AI States
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{role: 'user'|'model', text: string, err?: boolean}[]>([{ role: 'model', text: 'Chào bạn! Bấm **Bắt đầu** để chạy thí nghiệm. Nếu cần, hãy bấm vào các bộ phận trên hình để mình giải thích nhé! 🚀' }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isAiMax, setIsAiMax] = useState(false) 
  const aiScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let req: number, last = performance.now()
    const loop = (now: number) => {
      setTime(t => t + (now - last) / 1000)
      last = now; req = requestAnimationFrame(loop)
    }
    if (isPlaying) req = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(req)
  }, [isPlaying])

  useEffect(() => {
    setIsPlaying(false); setTime(0); setSelEdgeId(null); setIsEditMode(false); setShowSidebar(false)
    if (activeExp === 'kirchhoff') setEdges(initEdges('K'))
    if (activeExp === 'rc_circuit') setEdges(initEdges('RC'))
    setAiMessages([{ role: 'model', text: `Chuyển sang: **${EXPERIMENTS.find(e=>e.id===activeExp)?.title}**. Bạn hãy thiết lập thông số và bấm các vật thể để tìm hiểu sâu hơn nhé!` }])
  }, [activeExp])

  useEffect(() => { if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight }, [aiMessages, isAiLoading, isAiMax])

  // ==========================================================================
  // GIAO TIẾP SENAI
  // ==========================================================================
  const handleAskSenAI = async (e?: React.FormEvent, directQ?: string) => {
    if(e) e.preventDefault()
    const q = directQ || aiQuery.trim()
    if (!q || isAiLoading) return
    if (!directQ) setAiQuery('')
    setAiMessages(p => [...p, { role: 'user', text: q }]); setIsAiLoading(true)

    let ctx = `Học sinh đang dùng Thí nghiệm: ${EXPERIMENTS.find(x=>x.id===activeExp)?.title}. `
    if (['pendulum','horizontal','projectile'].includes(activeExp)) ctx += `Thông số: l=${params.l}m, g=${params.g}m/s2, m=${params.m}kg, v0=${params.v0}m/s, góc=${params.angle}°, h=${params.h}m. Mô phỏng: t=${time.toFixed(2)}s.`
    else if (['kirchhoff','rc_circuit'].includes(activeExp)) ctx += `Mạch điện: ${edges.map(e => `Cạnh ${e.id}(${e.type}=${e.val})`).join(', ')}.`
    else if (activeExp === 'interference') ctx += `Giao thoa Y-âng: Bước sóng lambda=${params.lambda}um, khoảng cách 2 khe a=${params.a}mm, k/c đến màn D=${params.D}m.`
    else if (activeExp === 'equipotential') ctx += `Điện trường: Điện tích q1=${params.q1}uC, q2=${params.q2}uC.`
    else if (activeExp === 'dispersion') ctx += `Lăng kính: Góc chiết quang A=${params.prismAngle}°, Góc tới i=${params.incidenceAngle}°, Chiết suất n=${params.n}.`
    
    const sysPrompt = `Bạn là SenAI (bản Beta), gia sư Vật lý. BỐI CẢNH THỰC TẾ: ${ctx}. Bọc công thức Toán học bằng $ hoặc $$, dùng dấu "." cho phép nhân, phẩy "," cho số thập phân. Giải thích ngắn gọn, đi thẳng vào bản chất hiện tượng và công thức liên quan, không dùng ngôn từ sến súa hay cảm thán quá đà.`

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history: [], context: sysPrompt }) })
      const data = await res.json()
      if (data.text) setAiMessages(p => [...p, { role: 'model', text: data.text }])
    } catch { setAiMessages(p => [...p, { role: 'model', text: 'Lỗi mạng AI.', err: true }]) }
    setIsAiLoading(false)
  }

  const handleCompClick = (name: string) => {
    if (['kirchhoff', 'rc_circuit'].includes(activeExp) && isEditMode) return 
    handleAskSenAI(undefined, `Phân tích vai trò và công thức cốt lõi của thành phần: ${name} trong thí nghiệm này.`)
  }

  // Helper cho Y-âng
  const waveLengthToColor = (l: number) => {
    if (l < 0.45) return 'violet'; if (l < 0.49) return 'blue'; if (l < 0.55) return 'green';
    if (l < 0.58) return 'yellow'; if (l < 0.62) return 'orange'; return 'red'
  }
  const colorMap: Record<string, string> = { violet: '#8b5cf6', blue: '#3b82f6', green: '#10b981', yellow: '#eab308', orange: '#f97316', red: '#ef4444' }

  // ==========================================================================
  // RENDER SVG ĐỘNG (REAL-TIME PHYSICS)
  // ==========================================================================
  const renderVisuals = () => {
    // 1. TÁN SẮC LĂNG KÍNH (Full Optics Math)
    if (activeExp === 'dispersion') {
      const A = params.prismAngle * Math.PI / 180
      const i1 = params.incidenceAngle * Math.PI / 180
      
      const H = 100
      const leftX = 150 - H * Math.tan(A/2)
      const rightX = 150 + H * Math.tan(A/2)
      
      const hitY = 90
      const hitX = 150 - (hitY - 40) * Math.tan(A/2)

      const colors = [
        { c: '#ef4444', dn: -0.015, name: 'Đỏ' }, { c: '#eab308', dn: -0.005, name: 'Vàng' },
        { c: '#10b981', dn: 0.005, name: 'Lục' }, { c: '#3b82f6', dn: 0.015, name: 'Lam' }, { c: '#8b5cf6', dn: 0.025, name: 'Tím' }
      ]

      let isTIR = false
      const rays = colors.map(color => {
        const n_color = params.n + color.dn
        const sin_r1 = Math.sin(i1) / n_color
        const r1 = Math.asin(sin_r1)
        const r2 = A - r1
        const sin_i2 = n_color * Math.sin(r2)

        // FIX LỖI TYPESCRIPT: Trả về đầy đủ property `dev` với giá trị 0 khi bị TIR
        if (sin_i2 >= 1 || isNaN(sin_i2)) {
          isTIR = true
          return { ...color, tir: true, dev: 0 }
        }

        const i2 = Math.asin(sin_i2)
        const dev = i1 + i2 - A 
        return { ...color, tir: false, dev }
      })

      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <polygon points={`150,40 ${leftX},140 ${rightX},140`} fill="currentColor" className="text-cyan-500/10 stroke-cyan-500 stroke-2 cursor-pointer" onClick={()=>handleCompClick('Lăng kính thủy tinh')} />
          <text x="145" y={60} className="text-[10px] fill-slate-400 font-bold">A={params.prismAngle}°</text>
          <line x1={hitX - 80 * Math.cos(i1 - A/2)} y1={hitY - 80 * Math.sin(i1 - A/2)} x2={hitX} y2={hitY} stroke="white" strokeWidth="3" className="drop-shadow-[0_0_5px_white]" />
          
          {isPlaying && (
            <g className="animate-in fade-in duration-500">
              {rays.map((ray, idx) => {
                if (ray.tir) return <line key={idx} x1={hitX} y1={hitY} x2={hitX + 50} y2={140} stroke={ray.c} strokeWidth="2" className="opacity-80"/>
                const exitAngle = ray.dev * 2
                const endX = hitX + 100 + idx * 5
                const endY = hitY + 50 * exitAngle + idx * 2
                return <path key={idx} d={`M ${hitX} ${hitY} L ${150 + 20} ${hitY + 10} L ${endX} ${endY}`} fill="none" stroke={ray.c} strokeWidth="2" className={`drop-shadow-[0_0_4px_${ray.c}]`}/>
              })}
            </g>
          )}
          {isTIR && isPlaying && <text x="150" y="170" textAnchor="middle" className="text-xs font-black fill-rose-500 animate-pulse">Cảnh báo: Đã xảy ra Phản xạ toàn phần!</text>}
        </svg>
      )
    }

    // 2. ĐẲNG THẾ & ĐƯỜNG SỨC
    if (activeExp === 'equipotential') {
      const attract = params.q1 * params.q2 < 0
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[450px]">
          <g className="opacity-40" stroke="currentColor" fill="none">
            {attract ? (
              <>
                <line x1="100" y1="100" x2="200" y2="100" className="text-slate-500" />
                {[20, 40, 60, 80].map(h => <path key={`t${h}`} d={`M 100 100 Q 150 ${100-h*1.5} 200 100`} className="text-slate-500" />)}
                {[20, 40, 60, 80].map(h => <path key={`b${h}`} d={`M 100 100 Q 150 ${100+h*1.5} 200 100`} className="text-slate-500" />)}
              </>
            ) : (
              <>
                {[15, 30, 60, 90].map(r => <path key={`l1${r}`} d={`M 100 100 Q ${140-r/3} ${100-r} 100 ${100-r*2}`} className="text-slate-500" />)}
                {[15, 30, 60, 90].map(r => <path key={`r1${r}`} d={`M 200 100 Q ${160+r/3} ${100-r} 200 ${100-r*2}`} className="text-slate-500" />)}
                {[15, 30, 60, 90].map(r => <path key={`l2${r}`} d={`M 100 100 Q ${140-r/3} ${100+r} 100 ${100+r*2}`} className="text-slate-500" />)}
                {[15, 30, 60, 90].map(r => <path key={`r2${r}`} d={`M 200 100 Q ${160+r/3} ${100+r} 200 ${100+r*2}`} className="text-slate-500" />)}
              </>
            )}
          </g>
          <circle cx="100" cy="100" r={Math.abs(params.q1)*5 + 15} fill="none" stroke={params.q1>0?'#ef4444':'#3b82f6'} strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleCompClick('Mặt đẳng thế q1')}/>
          <circle cx="200" cy="100" r={Math.abs(params.q2)*5 + 15} fill="none" stroke={params.q2>0?'#ef4444':'#3b82f6'} strokeDasharray="4" className="opacity-60 cursor-pointer" onClick={()=>handleCompClick('Mặt đẳng thế q2')}/>
          <circle cx="100" cy="100" r="10" className={`cursor-pointer ${params.q1>0?'fill-rose-500':'fill-blue-500'}`} onClick={()=>handleCompClick('Điện tích q1')} />
          <text x="100" y="104" textAnchor="middle" className="text-xs font-black fill-white pointer-events-none">{params.q1>0?'+':'-'}</text>
          <circle cx="200" cy="100" r="10" className={`cursor-pointer ${params.q2>0?'fill-rose-500':'fill-blue-500'}`} onClick={()=>handleCompClick('Điện tích q2')} />
          <text x="200" y="104" textAnchor="middle" className="text-xs font-black fill-white pointer-events-none">{params.q2>0?'+':'-'}</text>
          {isPlaying && attract && (
             <circle r="3" className="fill-yellow-400 drop-shadow-[0_0_5px_yellow]">
               <animateMotion dur="2s" repeatCount="indefinite" path="M 100 100 Q 150 60 200 100" />
             </circle>
          )}
        </svg>
      )
    }

    // 3. GIAO THOA Y-ÂNG
    if (activeExp === 'interference') {
      const i_fringe = (params.lambda * params.D) / params.a 
      const wl = params.lambda
      const colorHex = colorMap[waveLengthToColor(wl)]
      
      const fringes = []
      for (let k = -10; k <= 10; k++) {
        const yPos = 100 + k * i_fringe * 15
        if (yPos > 20 && yPos < 180) fringes.push({ k, yPos })
      }

      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[450px]">
          {isPlaying && (
            <g opacity="0.3">
              {[0, 10, 20].map(delay => (
                <g key={delay} stroke={colorHex} fill="none" strokeWidth="1">
                  <circle cx="50" cy={100 - params.a * 10} r={(time * 20 + delay) % 150} />
                  <circle cx="50" cy={100 + params.a * 10} r={(time * 20 + delay) % 150} />
                </g>
              ))}
            </g>
          )}
          <line x1="50" y1="20" x2="50" y2="180" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          <rect x="48" y={100 - params.a * 10 - 2} width="4" height="4" fill="white" className="cursor-pointer shadow-[0_0_10px_white]" onClick={()=>handleCompClick('Khe sáng S1')} />
          <rect x="48" y={100 + params.a * 10 - 2} width="4" height="4" fill="white" className="cursor-pointer shadow-[0_0_10px_white]" onClick={()=>handleCompClick('Khe sáng S2')} />
          
          <rect x="278" y="20" width="4" height="160" fill="currentColor" className="text-slate-800 dark:text-slate-200 cursor-pointer" onClick={()=>handleCompClick('Màn quan sát vân giao thoa')} />
          {fringes.map(f => <rect key={f.k} x="275" y={f.yPos - 2} width="10" height="4" fill={colorHex} className={`drop-shadow-[0_0_8px_${colorHex}]`} />)}
          <text x="250" y="15" className="text-[10px] fill-slate-500 font-bold">Màn E (i = {i_fringe.toFixed(2)}mm)</text>
        </svg>
      )
    }

    // 4. MẠCH ĐIỆN VÀ CƠ HỌC CƠ BẢN
    if (activeExp === 'pendulum') {
      const w = Math.sqrt(params.g / params.l)
      const theta = (Math.PI / 6) * Math.cos(w * time)
      const px = 150 + params.l * 80 * Math.sin(theta); const py = 20 + params.l * 80 * Math.cos(theta)
      return (
        <svg viewBox="0 0 300 200" className="w-full h-full max-w-[400px]">
          <line x1="50" y1="20" x2="250" y2="20" stroke="currentColor" strokeWidth="4" className="text-slate-400" />
          <line x1="150" y1="20" x2={px} y2={py} stroke="currentColor" strokeWidth="2" className="text-indigo-400" />
          <circle cx={px} cy={py} r={10 + params.m * 2} className="fill-indigo-600 cursor-pointer hover:fill-indigo-400" onClick={() => handleCompClick('Quả nặng m')}/>
          <text x="10" y="190" className="text-[10px] fill-slate-500 font-bold">t = {time.toFixed(2)}s | T = {(2*Math.PI/w).toFixed(2)}s</text>
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
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowSidebar(false)}></div>
          <div className="w-[300px] h-full bg-white/90 dark:bg-[#121212]/90 backdrop-blur-xl shadow-2xl relative z-10 p-6 flex flex-col animate-in slide-in-from-left-full duration-300 border-r border-white/50 dark:border-white/10">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="font-black text-lg flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><FlaskConical className="w-5 h-5"/> Menu Thí Nghiệm</h2>
              <button onClick={() => setShowSidebar(false)} className="p-2 bg-slate-100 dark:bg-[#202020] rounded-xl hover:bg-rose-100 hover:text-rose-500 transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {['Cơ học', 'Điện học', 'Quang học'].map(cat => (
                <div key={cat} className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-2">{cat}</p>
                  {EXPERIMENTS.filter(e => e.category === cat).map(exp => (
                    <button key={exp.id} onClick={() => setActiveExp(exp.id as ExpType)} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-sm transition-all ${activeExp === exp.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-white/5'}`}>
                      <span className="flex items-center gap-3">{exp.icon} {exp.title}</span>
                      {activeExp === exp.id && <ChevronRight className="w-4 h-4 opacity-50"/>}
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
          <button onClick={() => setShowSidebar(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl font-black text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shadow-sm border border-indigo-100 dark:border-indigo-500/20">
            <Menu className="w-4 h-4" /> Chọn Thí nghiệm
          </button>
        </div>
        <h1 className="font-black text-lg hidden sm:flex text-slate-800 dark:text-white bg-slate-50 dark:bg-[#202020] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
          {EXPERIMENTS.find(e=>e.id===activeExp)?.title}
        </h1>
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
                <button onClick={() => { setIsPlaying(false); setTime(0); }} className="p-2 bg-slate-100 dark:bg-[#202020] rounded-xl font-black hover:bg-slate-200 transition-colors shadow-sm"><RotateCcw className="w-5 h-5"/></button>
              </div>
              
              {!isEditMode && ['kirchhoff', 'rc_circuit'].includes(activeExp) && (
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 animate-pulse">
                  <Info className="w-3.5 h-3.5"/> Chế độ Học (Bấm vào mạch để hỏi)
                </div>
              )}

              {renderVisuals()}
            </div>

            {/* BẢNG CẤU HÌNH VẬT LÝ */}
            <div className={`${mdCard} p-6 shrink-0`}>
              <h3 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Cấu hình vật lý</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                
                {activeExp === 'pendulum' && [
                  {k:'l', l:'Chiều dài l (m)', min:0.1, max:5, s:0.1}, {k:'g', l:'Gia tốc g (m/s²)', min:1, max:20, s:0.1}, {k:'m', l:'Khối lượng m (kg)', min:0.1, max:10, s:0.1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {['projectile','horizontal'].includes(activeExp) && [
                  {k:'v0', l:'Vận tốc v0 (m/s)', min:1, max:50, s:1}, {k:'h', l:'Độ cao h (m)', min:0, max:50, s:1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-blue-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                {activeExp === 'projectile' && <div><label className="flex justify-between text-xs font-bold mb-2"><span>Góc ném α (°)</span><span className="text-blue-600">{params.angle}°</span></label><input type="range" min="0" max="90" step="1" value={params.angle} onChange={(e)=>setParams({...params, angle: Number(e.target.value)})} className={rangeClass}/></div>}

                {activeExp === 'interference' && [
                  {k:'lambda', l:'Bước sóng λ (μm)', min:0.38, max:0.76, s:0.01}, {k:'a', l:'Khoảng cách 2 khe a (mm)', min:0.5, max:3, s:0.1}, {k:'D', l:'K/c đến màn D (m)', min:1, max:5, s:0.5}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-indigo-600">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}
                
                {activeExp === 'equipotential' && [
                  {k:'q1', l:'Điện tích q1 (μC)', min:-5, max:5, s:1}, {k:'q2', l:'Điện tích q2 (μC)', min:-5, max:5, s:1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-rose-500">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}

                {activeExp === 'dispersion' && [
                  {k:'prismAngle', l:'Góc chiết quang A (°)', min:30, max:90, s:1}, {k:'incidenceAngle', l:'Góc tới i (°)', min:0, max:90, s:1}, {k:'n', l:'Chiết suất n', min:1.2, max:2.0, s:0.1}
                ].map(c => <div key={c.k}><label className="flex justify-between text-xs font-bold mb-2"><span>{c.l}</span><span className="text-cyan-500">{params[c.k as keyof typeof params]}</span></label><input type="range" min={c.min} max={c.max} step={c.s} value={params[c.k as keyof typeof params]} onChange={(e)=>setParams({...params, [c.k]: Number(e.target.value)})} className={rangeClass}/></div>)}

                {['kirchhoff','rc_circuit'].includes(activeExp) && (
                  <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-4 bg-slate-50 dark:bg-[#161616] p-4 rounded-xl border border-slate-200 dark:border-white/5">
                    <button onClick={() => {setIsEditMode(!isEditMode); setSelEdgeId(null)}} className={`px-4 py-3 rounded-xl text-xs font-black shadow-md w-full md:w-auto transition-colors ${isEditMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-white dark:bg-[#252525] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-amber-400'}`}>
                      {isEditMode ? 'Đóng Sửa Mạch (Bật Hỏi AI)' : 'Bật chế độ Sửa Mạch'}
                    </button>
                    {isEditMode && selEdgeId ? (
                      <div className="flex gap-2 flex-1 animate-in fade-in">
                        <select value={edges.find(e=>e.id===selEdgeId)?.type} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, type: e.target.value as ComponentType} : ed))} className={`${inputClass} !py-2 w-1/2`}>
                          <option value="wire">Dây dẫn</option><option value="R">Điện trở (R)</option><option value="E">Nguồn (E)</option><option value="C">Tụ điện (C)</option><option value="open">Ngắt mạch</option>
                        </select>
                        <input type="number" value={edges.find(e=>e.id===selEdgeId)?.val} onChange={(e)=>setEdges(edges.map(ed=>ed.id===selEdgeId ? {...ed, val: Number(e.target.value)} : ed))} className={`${inputClass} !py-2 w-1/2`} placeholder="Giá trị"/>
                      </div>
                    ) : (
                      isEditMode && <div className="text-xs font-bold text-amber-500 flex-1 flex items-center pl-2">👆 Bấm vào đoạn dây trên hình để sửa đổi.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 🌟 CỘT PHẢI (SenAI) - ĐÃ SỬA CẤU TRÚC FULLSCREEN ĐỂ LUÔN BẤM ĐƯỢC CLOSE */}
          <div className={`${isAiMax ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none bg-white dark:bg-[#121212] m-0 p-0' : 'lg:col-span-5 h-[500px] lg:h-auto bg-white dark:bg-[#161616] rounded-[2.5rem] shadow-xl'} border border-indigo-200 dark:border-indigo-500/30 overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
            
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 shrink-0 w-full"></div>
            
            <div className={`p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md flex justify-between items-center shrink-0 w-full ${isAiMax ? 'pt-8 pb-4' : ''}`}>
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30"><Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/></div>
                <div><h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">Gia sư Lab SenAI <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 tracking-widest">Beta</span></h4><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hỏi đáp & Phân tích hiện tượng</p></div>
              </div>
              <button onClick={() => setIsAiMax(!isAiMax)} className="p-3 bg-slate-200/50 dark:bg-[#252525] rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors shadow-sm">
                {isAiMax ? <Minimize2 className="w-6 h-6"/> : <Maximize2 className="w-5 h-5"/>}
              </button>
            </div>

            <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 custom-scrollbar bg-transparent w-full">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center mr-3 mt-1 shrink-0"><Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/></div>}
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[14px] font-medium leading-relaxed shadow-sm overflow-x-auto ${m.role==='user'?'bg-indigo-600 text-white rounded-br-sm':m.err?'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-100 dark:border-rose-900/50 rounded-bl-sm':'bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-white/5 rounded-bl-sm text-slate-800 dark:text-slate-200'}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p:({node,...p}:any)=><p className="mb-2 last:mb-0" {...p}/>, strong:({node,...p}:any)=><strong className={`font-black ${m.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...p}/> }}>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiLoading && <div className="flex gap-3 items-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-600"/><span className="text-xs font-bold text-slate-400">SenAI đang suy nghĩ...</span></div>}
            </div>

            <div className={`p-4 md:p-6 bg-white dark:bg-[#1A1A1A] border-t border-slate-100 dark:border-white/5 shrink-0 w-full ${isAiMax ? 'pb-8' : ''}`}>
              <form onSubmit={handleAskSenAI} className="relative flex items-center max-w-4xl mx-auto w-full">
                <input type="text" value={aiQuery} onChange={(e)=>setAiQuery(e.target.value)} placeholder="Nhờ AI tính toán, giải thích hiện tượng..." className={`${inputClass} pr-16 rounded-full py-4 bg-slate-50 dark:bg-[#252525] focus:bg-white text-base`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiLoading} className="absolute right-2 p-3 bg-indigo-600 text-white rounded-full disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-md active:scale-95"><Send className="w-5 h-5 ml-0.5"/></button>
              </form>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}