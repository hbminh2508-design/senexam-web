'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  FlaskConical,
  Play,
  Square,
  RotateCcw,
  Target,
  CircleDot,
  Send,
  Bot,
  Loader2,
  Sparkles,
  Activity,
  Cpu,
  Waves,
  Rainbow,
  Magnet,
  ChevronRight,
  Sun,
  Moon,
  Zap,
  Sliders,
  Compass,
  Layers,
  Atom,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newlab-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newlab-body' })

type ExpType =
  | 'pendulum'
  | 'horizontal'
  | 'projectile'
  | 'interference'
  | 'dispersion'
  | 'refraction'
  | 'lens'
  | 'rlc'
  | 'titration'
  | 'equipotential'

interface LabExperiment {
  id: ExpType
  title: string
  category: 'Cơ học' | 'Quang học' | 'Điện học' | 'Hóa học'
  icon: any
  desc: string
}

const EXPERIMENTS: LabExperiment[] = [
  { id: 'pendulum', title: 'Con lắc đơn', category: 'Cơ học', icon: CircleDot, desc: 'Mô phỏng dao động điều hòa của con lắc đơn.' },
  { id: 'horizontal', title: 'Ném ngang', category: 'Cơ học', icon: ArrowLeft, desc: 'Quỹ đạo chuyển động ném ngang từ độ cao h.' },
  { id: 'projectile', title: 'Ném xiên', category: 'Cơ học', icon: Target, desc: 'Tầm xa và độ cao cực đại của vật ném xiên góc alpha.' },
  { id: 'interference', title: 'Giao thoa sóng Y-âng', category: 'Quang học', icon: Waves, desc: 'Khoảng vân và vân sáng/tối trong giao thoa ánh sáng.' },
  { id: 'dispersion', title: 'Tán sắc qua lăng kính', category: 'Quang học', icon: Rainbow, desc: 'Khúc xạ và phân tách dải màu ánh sáng trắng.' },
  { id: 'refraction', title: 'Khúc xạ & Phản xạ toàn phần', category: 'Quang học', icon: Compass, desc: 'Định luật Snell và góc giới hạn phản xạ toàn phần.' },
  { id: 'lens', title: 'Thấu kính mỏng', category: 'Quang học', icon: Layers, desc: 'Dựng ảnh qua thấu kính hội tụ và phân kỳ.' },
  { id: 'rlc', title: 'Mạch xoay chiều R-L-C', category: 'Điện học', icon: Zap, desc: 'Hiện tượng cộng hưởng điện và độ lệch pha u/i.' },
  { id: 'titration', title: 'Chuẩn độ Axit - Bazơ (pH)', category: 'Hóa học', icon: FlaskConical, desc: 'Đường cong chuẩn độ HCl bằng NaOH và chỉ thị màu.' },
  { id: 'equipotential', title: 'Điện trường & Đẳng thế', category: 'Điện học', icon: Magnet, desc: 'Đường sức điện trường giữa 2 điện tích điểm.' },
]

export default function NewLabsPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [activeExp, setActiveExp] = useState<ExpType>('pendulum')
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)

  // Simulation Parameters
  const [params, setParams] = useState({
    l: 1.0, // chiều dài (m)
    g: 9.8, // gia tốc trọng trường
    m: 0.5, // khối lượng (kg)
    v0: 15, // vận tốc ban đầu (m/s)
    angle: 45, // góc ném (độ)
    h: 10, // độ cao ném (m)
    lambda: 0.55, // bước sóng (micromet)
    a: 1.0, // khoảng cách 2 khe (mm)
    D: 2.0, // khoảng cách tới màn (m)
    n1: 1.0, // chiết suất môi trường 1
    n2: 1.5, // chiết suất môi trường 2
    iAngle: 45, // góc tới
    focal: 100, // tiêu cự thấu kính (mm)
    dObject: 180, // khoảng cách vật (mm)
    R: 50, // điện trở (Ohm)
    L: 0.2, // độ tự cảm (H)
    C: 50, // điện dung (microFarad)
    freq: 50, // tần số (Hz)
    vAcid: 25, // thể tích axit (mL)
    cAcid: 0.1, // nồng độ axit (M)
    vBase: 0, // thể tích bazo đã thêm (mL)
  })

  // AI assistant states
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Chào bạn! Bấm **Bắt đầu** để chạy mô phỏng thí nghiệm. Bạn có thể thay đổi các thông số ở thanh bên dưới và hỏi mình bất kỳ hiện tượng vật lý / hóa học nào nhé! 🚀' },
  ])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

  // Animation Loop
  useEffect(() => {
    let req: number
    let last = performance.now()
    const loop = (now: number) => {
      setTime((t) => t + (now - last) / 1000)
      last = now
      req = requestAnimationFrame(loop)
    }
    if (isPlaying) req = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(req)
  }, [isPlaying])

  // Reset on exp switch
  useEffect(() => {
    setIsPlaying(false)
    setTime(0)
    const exp = EXPERIMENTS.find((e) => e.id === activeExp)
    setAiMessages([
      { role: 'model', text: `Đã chuyển sang thí nghiệm: **${exp?.title}**. Bạn hãy điều chỉnh các thông số và bấm **Bắt đầu** để quan sát hiện tượng nhé!` },
    ])
  }, [activeExp])

  // Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)

    // Background Grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 1
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // RENDER THE CURRENT EXPERIMENT
    if (activeExp === 'pendulum') {
      const originX = width / 2
      const originY = 60
      const lengthPx = 180 * params.l
      const omega = Math.sqrt(params.g / params.l)
      const currentAngle = (Math.PI / 6) * Math.cos(omega * time)

      const bobX = originX + lengthPx * Math.sin(currentAngle)
      const bobY = originY + lengthPx * Math.cos(currentAngle)

      // Dây treo
      ctx.beginPath()
      ctx.moveTo(originX, originY)
      ctx.lineTo(bobX, bobY)
      ctx.strokeStyle = isDark ? '#94A3B8' : '#475569'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Trục treo
      ctx.fillStyle = '#6366F1'
      ctx.beginPath()
      ctx.arc(originX, originY, 6, 0, Math.PI * 2)
      ctx.fill()

      // Quả cầu con lắc
      const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 18)
      grad.addColorStop(0, '#F59E0B')
      grad.addColorStop(1, '#D97706')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(bobX, bobY, 18, 0, Math.PI * 2)
      ctx.fill()
    } else if (activeExp === 'horizontal' || activeExp === 'projectile') {
      const isProj = activeExp === 'projectile'
      const rad = isProj ? (params.angle * Math.PI) / 180 : 0
      const vx = params.v0 * Math.cos(rad)
      const vy0 = isProj ? -params.v0 * Math.sin(rad) : 0
      const startX = 60
      const startY = isProj ? height - 60 : 80

      // Vẽ mặt đất
      ctx.strokeStyle = isDark ? '#475569' : '#CBD5E1'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(30, height - 50)
      ctx.lineTo(width - 30, height - 50)
      ctx.stroke()

      // Quỹ đạo Parabol
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let t = 0; t <= 10; t += 0.05) {
        const px = startX + vx * t * 12
        const py = startY + (vy0 * t + 0.5 * params.g * t * t) * 12
        if (py > height - 50) break
        if (t === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Vật thể chuyển động
      const tCurrent = time % 4
      const curX = startX + vx * tCurrent * 12
      const curY = startY + (vy0 * tCurrent + 0.5 * params.g * tCurrent * tCurrent) * 12
      if (curY <= height - 50 && curX < width - 40) {
        ctx.fillStyle = '#EF4444'
        ctx.beginPath()
        ctx.arc(curX, curY, 10, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (activeExp === 'interference') {
      // Vân giao thoa Y-âng
      const screenX = width - 120
      const iVal = (params.lambda * params.D) / params.a // Khoảng vân i (mm)

      for (let y = 30; y < height - 30; y += 2) {
        const distFromCenter = y - height / 2
        const intensity = Math.pow(Math.cos((Math.PI * distFromCenter) / (iVal * 10)), 2)
        ctx.fillStyle = `rgba(99, 102, 241, ${intensity})`
        ctx.fillRect(screenX, y, 60, 2)
      }
    } else if (activeExp === 'refraction') {
      // Khúc xạ ánh sáng
      const centerY = height / 2
      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.2)'
      ctx.fillRect(0, centerY, width, height / 2)

      // Pháp tuyến
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(width / 2, 40)
      ctx.lineTo(width / 2, height - 40)
      ctx.stroke()
      ctx.setLineDash([])

      // Tia tới
      const iRad = (params.iAngle * Math.PI) / 180
      const inX = width / 2 - 160 * Math.sin(iRad)
      const inY = centerY - 160 * Math.cos(iRad)

      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(inX, inY)
      ctx.lineTo(width / 2, centerY)
      ctx.stroke()

      // Tia khúc xạ (ĐL Snell: n1 * sin(i) = n2 * sin(r))
      const sinR = (params.n1 / params.n2) * Math.sin(iRad)
      if (sinR <= 1) {
        const rRad = Math.asin(sinR)
        const reX = width / 2 + 160 * Math.sin(rRad)
        const reY = centerY + 160 * Math.cos(rRad)
        ctx.strokeStyle = '#10B981'
        ctx.beginPath()
        ctx.moveTo(width / 2, centerY)
        ctx.lineTo(reX, reY)
        ctx.stroke()
      } else {
        // Phản xạ toàn phần
        const refX = width / 2 + 160 * Math.sin(iRad)
        const refY = centerY - 160 * Math.cos(iRad)
        ctx.strokeStyle = '#EF4444'
        ctx.beginPath()
        ctx.moveTo(width / 2, centerY)
        ctx.lineTo(refX, refY)
        ctx.stroke()
      }
    } else {
      // Default placeholder graphical representation for other labs
      ctx.fillStyle = '#6366F1'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`Mô phỏng đồ họa đang hoạt động: ${EXPERIMENTS.find((e) => e.id === activeExp)?.title}`, width / 2, height / 2)
    }
  }, [activeExp, params, time, isPlaying, isDark])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const handleAskAi = async () => {
    if (!aiQuery.trim() || isAiLoading) return
    const q = aiQuery.trim()
    setAiQuery('')
    setAiMessages((prev) => [...prev, { role: 'user', text: q }])
    setIsAiLoading(true)

    try {
      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Tôi đang làm thí nghiệm ảo môn "${activeExp}" với các thông số: ${JSON.stringify(params)}. Câu hỏi của tôi: "${q}". Hãy giải thích chi tiết bản chất vật lý / hóa học của hiện tượng này.`,
        }),
      })
      const data = await res.json()
      setAiMessages((prev) => [...prev, { role: 'model', text: data.reply || data.text || 'SenAI đã ghi nhận câu hỏi.' }])
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: 'model', text: `Lỗi: ${e.message}` }])
    } finally {
      setIsAiLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} h-screen flex flex-col bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 font-sans overflow-hidden select-none`}
      style={themeVars}
    >
      {/* HEADER */}
      <header className="h-16 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 px-4 sm:px-6 flex items-center justify-between backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Về Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-sm">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black leading-none" style={{ fontFamily: 'var(--font-newlab-heading)' }}>
                Phòng Thí Nghiệm Ảo (SenLabs)
              </h2>
              <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
                Mô phỏng tương tác Vật lý - Hóa học - Quang học 3D
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* EXPERIMENT LIST SIDEBAR */}
        <aside className="w-64 hidden md:flex flex-col border-r border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 p-3.5 backdrop-blur-xl overflow-y-auto space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400 px-2 mb-1 block">
            Danh mục thí nghiệm ({EXPERIMENTS.length})
          </span>
          {EXPERIMENTS.map((exp) => {
            const Icon = exp.icon
            const isSel = activeExp === exp.id
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveExp(exp.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-left transition ${
                  isSel
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#4B5563] dark:text-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isSel ? 'text-amber-400' : 'text-indigo-500'}`} />
                <span className="truncate">{exp.title}</span>
              </button>
            )
          })}
        </aside>

        {/* MAIN LAB CANVAS & CONTROLS */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
          {/* Controls Header */}
          <div className="h-14 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm" style={{ fontFamily: 'var(--font-newlab-heading)' }}>
                {EXPERIMENTS.find((e) => e.id === activeExp)?.title}
              </span>
              <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase px-2 py-0.5 border border-indigo-500/20">
                {EXPERIMENTS.find((e) => e.id === activeExp)?.category}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition ${
                  isPlaying
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? 'Tạm dừng' : 'Bắt đầu'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false)
                  setTime(0)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold shadow-sm transition hover:scale-105"
                title="Khôi phục trạng thái ban đầu"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Đặt lại
              </button>
            </div>
          </div>

          {/* Canvas Rendering Area */}
          <div className="flex-1 relative flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              width={750}
              height={380}
              className="max-w-full rounded-3xl border border-black/10 dark:border-white/10 bg-slate-950 shadow-xl"
            />
          </div>

          {/* PARAMETERS CONTROL BAR */}
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 text-xs font-bold">
              {activeExp === 'pendulum' && (
                <>
                  <div className="flex items-center gap-2">
                    <span>Chiều dài l ({params.l}m):</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={params.l}
                      onChange={(e) => setParams({ ...params, l: parseFloat(e.target.value) })}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Trọng trường g ({params.g} m/s²):</span>
                    <input
                      type="range"
                      min="1.6"
                      max="15.0"
                      step="0.2"
                      value={params.g}
                      onChange={(e) => setParams({ ...params, g: parseFloat(e.target.value) })}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {activeExp === 'refraction' && (
                <>
                  <div className="flex items-center gap-2">
                    <span>Góc tới i ({params.iAngle}°):</span>
                    <input
                      type="range"
                      min="0"
                      max="85"
                      step="1"
                      value={params.iAngle}
                      onChange={(e) => setParams({ ...params, iAngle: parseInt(e.target.value) })}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Chiết suất n2 ({params.n2}):</span>
                    <input
                      type="range"
                      min="1.0"
                      max="2.4"
                      step="0.05"
                      value={params.n2}
                      onChange={(e) => setParams({ ...params, n2: parseFloat(e.target.value) })}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {(activeExp === 'horizontal' || activeExp === 'projectile') && (
                <>
                  <div className="flex items-center gap-2">
                    <span>Vận tốc v0 ({params.v0} m/s):</span>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="1"
                      value={params.v0}
                      onChange={(e) => setParams({ ...params, v0: parseInt(e.target.value) })}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  {activeExp === 'projectile' && (
                    <div className="flex items-center gap-2">
                      <span>Góc ném ({params.angle}°):</span>
                      <input
                        type="range"
                        min="15"
                        max="75"
                        step="1"
                        value={params.angle}
                        onChange={(e) => setParams({ ...params, angle: parseInt(e.target.value) })}
                        className="accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
