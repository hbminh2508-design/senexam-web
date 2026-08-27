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
  | 'lorentz_3d'
  | 'bohr_3d'
  | 'molecule_3d'
  | 'wave_3d'

interface LabExperiment {
  id: ExpType
  title: string
  category: 'Cơ học' | 'Quang học' | 'Điện học' | 'Hóa học' | '3D WebGL'
  icon: any
  desc: string
  is3D?: boolean
}

const EXPERIMENTS: LabExperiment[] = [
  { id: 'lorentz_3d', title: 'Từ trường Lorentz 3D', category: '3D WebGL', icon: Magnet, desc: 'Quỹ đạo xoắn ốc 3D của hạt điện tích chuyển động trong từ trường không gian.', is3D: true },
  { id: 'bohr_3d', title: 'Mẫu Nguyên Tử Bohr 3D', category: '3D WebGL', icon: Atom, desc: 'Đám mây electron quay quanh hạt nhân đa mức năng lượng và phát xạ Photon.', is3D: true },
  { id: 'molecule_3d', title: 'Mô Hình Phân Tử 3D', category: '3D WebGL', icon: FlaskConical, desc: 'Cấu trúc không gian 3D tương tác của H2O, Methane CH4, Benzene C6H6.', is3D: true },
  { id: 'wave_3d', title: 'Giao Thoa Sóng 3D', category: '3D WebGL', icon: Waves, desc: 'Bản đồ lưới mặt sóng 3D nhấp nhô thời gian thực từ 2 nguồn kết hợp.', is3D: true },
  { id: 'pendulum', title: 'Con lắc đơn 2D', category: 'Cơ học', icon: CircleDot, desc: 'Dao động điều hòa và bảo toàn cơ năng của con lắc đơn.' },
  { id: 'horizontal', title: 'Ném ngang', category: 'Cơ học', icon: ArrowLeft, desc: 'Quỹ đạo Parabol và vector vận tốc của chuyển động ném ngang.' },
  { id: 'projectile', title: 'Ném xiên', category: 'Cơ học', icon: Target, desc: 'Tầm xa và tầm cao cực đại của vật ném xiên góc alpha.' },
  { id: 'interference', title: 'Giao thoa sóng Y-âng', category: 'Quang học', icon: Waves, desc: 'Khoảng vân và hệ vân sáng/tối trong giao thoa ánh sáng đơn sắc.' },
  { id: 'dispersion', title: 'Tán sắc qua lăng kính', category: 'Quang học', icon: Rainbow, desc: 'Sự khúc xạ và phân tách chùm sáng trắng thành 7 sắc cầu vồng.' },
  { id: 'refraction', title: 'Khúc xạ & Phản xạ toàn phần', category: 'Quang học', icon: Compass, desc: 'Định luật Snell và góc giới hạn phản xạ toàn phần.' },
  { id: 'lens', title: 'Thấu kính mỏng', category: 'Quang học', icon: Layers, desc: 'Dựng 3 tia sáng đặc biệt tạo ảnh qua thấu kính hội tụ/phân kỳ.' },
  { id: 'rlc', title: 'Mạch xoay chiều R-L-C', category: 'Điện học', icon: Zap, desc: 'Giản đồ Fresnel, độ lệch pha u/i và cộng hưởng điện.' },
  { id: 'titration', title: 'Chuẩn độ Axit - Bazơ (pH)', category: 'Hóa học', icon: FlaskConical, desc: 'Đường cong chuẩn độ HCl bằng NaOH và đổi màu phenolphtalein.' },
  { id: 'equipotential', title: 'Điện trường & Đẳng thế', category: 'Điện học', icon: Magnet, desc: 'Đường sức điện trường và mặt đẳng thế giữa 2 điện tích điểm.' },
]

export default function NewLabsPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [activeExp, setActiveExp] = useState<ExpType>('pendulum')
  const [isPlaying, setIsPlaying] = useState(true)
  const [time, setTime] = useState(0)

  // Simulation Parameters
  const [params, setParams] = useState({
    l: 1.0, // chiều dài (m)
    g: 9.8, // gia tốc trọng trường
    v0: 16, // vận tốc ban đầu (m/s)
    angle: 45, // góc ném (độ)
    h: 12, // độ cao ném (m)
    lambda: 0.55, // bước sóng (micromet)
    a: 1.0, // khoảng cách 2 khe (mm)
    D: 2.0, // khoảng cách tới màn (m)
    n1: 1.0, // chiết suất môi trường 1
    n2: 1.5, // chiết suất môi trường 2
    iAngle: 45, // góc tới
    focal: 100, // tiêu cự thấu kính (mm)
    dObject: 180, // khoảng cách vật (mm)
    R: 40, // điện trở (Ohm)
    L: 0.2, // độ tự cảm (H)
    C: 50, // điện dung (microFarad)
    freq: 50, // tần số (Hz)
    vAcid: 25, // thể tích axit (mL)
    cAcid: 0.1, // nồng độ axit (M)
    vBase: 0, // thể tích bazo đã nhỏ vào (mL)
  })

  // AI assistant states
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Chào bạn! Bấm **Bắt đầu** để chạy mô phỏng. Bạn có thể kéo các thanh trượt bên dưới để thay đổi thông số và quan sát hiện tượng real-time nhé! 🚀' },
  ])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

  // Animation Loop (60fps)
  useEffect(() => {
    let req: number
    let last = performance.now()
    const loop = (now: number) => {
      const delta = (now - last) / 1000
      setTime((t) => t + delta)
      last = now
      req = requestAnimationFrame(loop)
    }
    if (isPlaying) req = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(req)
  }, [isPlaying])

  // Reset when experiment switches
  useEffect(() => {
    setTime(0)
    const exp = EXPERIMENTS.find((e) => e.id === activeExp)
    setAiMessages([
      { role: 'model', text: `Đã chuyển sang thí nghiệm: **${exp?.title}** (${exp?.category}). Bạn hãy điều chỉnh các thông số và đặt câu hỏi cho SenAI nhé!` },
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

    // 1. CON LẮC ĐƠN
    if (activeExp === 'pendulum') {
      const originX = width / 2
      const originY = 50
      const lengthPx = 170 * params.l
      const omega = Math.sqrt(params.g / params.l)
      const currentAngle = (Math.PI / 6) * Math.cos(omega * time)

      const bobX = originX + lengthPx * Math.sin(currentAngle)
      const bobY = originY + lengthPx * Math.cos(currentAngle)

      // Giá treo
      ctx.fillStyle = isDark ? '#475569' : '#94A3B8'
      ctx.fillRect(originX - 40, originY - 8, 80, 8)

      // Trục treo
      ctx.fillStyle = '#6366F1'
      ctx.beginPath()
      ctx.arc(originX, originY, 5, 0, Math.PI * 2)
      ctx.fill()

      // Dây treo
      ctx.strokeStyle = isDark ? '#CBD5E1' : '#475569'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(originX, originY)
      ctx.lineTo(bobX, bobY)
      ctx.stroke()

      // Quả cầu con lắc kim loại
      const grad = ctx.createRadialGradient(bobX - 5, bobY - 5, 2, bobX, bobY, 18)
      grad.addColorStop(0, '#FBBF24')
      grad.addColorStop(1, '#D97706')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(bobX, bobY, 18, 0, Math.PI * 2)
      ctx.fill()

      // Bảng thông số góc & chu kỳ
      const T = (2 * Math.PI * Math.sqrt(params.l / params.g)).toFixed(2)
      const deg = ((currentAngle * 180) / Math.PI).toFixed(1)
      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`Chu kỳ T: ${T} s`, 30, 40)
      ctx.fillText(`Góc lệch α: ${deg}°`, 30, 60)
      ctx.fillText(`Tần số góc ω: ${omega.toFixed(2)} rad/s`, 30, 80)
    }

    // 2. NÉM NGANG
    else if (activeExp === 'horizontal') {
      const startX = 60
      const startY = 80
      const vx = params.v0
      const groundY = height - 50

      // Bệ phóng cao
      ctx.fillStyle = isDark ? '#334155' : '#CBD5E1'
      ctx.fillRect(startX - 30, startY, 30, groundY - startY)

      // Mặt đất
      ctx.strokeStyle = isDark ? '#64748B' : '#94A3B8'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(20, groundY)
      ctx.lineTo(width - 20, groundY)
      ctx.stroke()

      // Đường Parabol quỹ đạo
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let t = 0; t <= 10; t += 0.05) {
        const px = startX + vx * t * 14
        const py = startY + 0.5 * params.g * t * t * 14
        if (py > groundY) break
        if (t === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Vật thể bay
      const tFlight = Math.sqrt((2 * (groundY - startY)) / (params.g * 14))
      const tCur = time % (tFlight + 1.5)
      if (tCur <= tFlight) {
        const curX = startX + vx * tCur * 14
        const curY = startY + 0.5 * params.g * tCur * tCur * 14

        // Vector vận tốc
        const vy = params.g * tCur
        ctx.strokeStyle = '#10B981'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(curX, curY)
        ctx.lineTo(curX + vx * 2, curY + vy * 2)
        ctx.stroke()

        ctx.fillStyle = '#EF4444'
        ctx.beginPath()
        ctx.arc(curX, curY, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 3. NÉM XIÊN
    else if (activeExp === 'projectile') {
      const startX = 60
      const startY = height - 60
      const rad = (params.angle * Math.PI) / 180
      const vx = params.v0 * Math.cos(rad)
      const vy0 = -params.v0 * Math.sin(rad)
      const groundY = height - 50

      // Mặt đất
      ctx.strokeStyle = isDark ? '#64748B' : '#94A3B8'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(20, groundY)
      ctx.lineTo(width - 20, groundY)
      ctx.stroke()

      // Quỹ đạo Parabol
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let t = 0; t <= 10; t += 0.05) {
        const px = startX + vx * t * 14
        const py = startY + (vy0 * t + 0.5 * params.g * t * t) * 14
        if (py > groundY) break
        if (t === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Vật thể bay
      const totalFlight = (2 * params.v0 * Math.sin(rad)) / params.g
      const tCur = time % (totalFlight + 1.5)
      if (tCur <= totalFlight) {
        const curX = startX + vx * tCur * 14
        const curY = startY + (vy0 * tCur + 0.5 * params.g * tCur * tCur) * 14
        ctx.fillStyle = '#F59E0B'
        ctx.beginPath()
        ctx.arc(curX, curY, 9, 0, Math.PI * 2)
        ctx.fill()
      }

      // Thông số tầm xa & tầm cao cực đại
      const L = ((params.v0 * params.v0 * Math.sin(2 * rad)) / params.g).toFixed(1)
      const H = ((Math.pow(params.v0 * Math.sin(rad), 2)) / (2 * params.g)).toFixed(1)
      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(`Tầm xa L: ${L} m`, 30, 40)
      ctx.fillText(`Tầm cao cực đại H: ${H} m`, 30, 60)
    }

    // 4. GIAO THOA SÓNG Y-ÂNG
    else if (activeExp === 'interference') {
      const screenX = width - 130
      const iVal = (params.lambda * params.D) / params.a // khoảng vân i (mm)

      // Vẽ chùm tia từ 2 khe S1, S2
      const slitY1 = height / 2 - 25
      const slitY2 = height / 2 + 25

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)'
      ctx.lineWidth = 1.5
      for (let y = 40; y < height - 40; y += 15) {
        ctx.beginPath()
        ctx.moveTo(100, slitY1)
        ctx.lineTo(screenX, y)
        ctx.moveTo(100, slitY2)
        ctx.lineTo(screenX, y)
        ctx.stroke()
      }

      // Màn quan sát và dải vân sáng tối
      for (let y = 30; y < height - 30; y += 2) {
        const dist = y - height / 2
        const phase = (Math.PI * dist) / (iVal * 12)
        const intensity = Math.pow(Math.cos(phase), 2)
        ctx.fillStyle = `rgba(99, 102, 241, ${intensity})`
        ctx.fillRect(screenX, y, 50, 2)
      }

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(`Khoảng vân i: ${iVal.toFixed(2)} mm`, 30, 40)
      ctx.fillText(`Bước sóng λ: ${params.lambda} µm`, 30, 60)
      ctx.fillText(`Khoảng cách khe a: ${params.a} mm, D: ${params.D} m`, 30, 80)
    }

    // 5. TÁN SẮC QUA LĂNG KÍNH
    else if (activeExp === 'dispersion') {
      const cx = width / 2 - 30
      const cy = height / 2

      // Lăng kính tam giác thủy tinh
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)'
      ctx.strokeStyle = '#60A5FA'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(cx, cy - 90)
      ctx.lineTo(cx + 80, cy + 70)
      ctx.lineTo(cx - 80, cy + 70)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Tia sáng trắng tới
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(60, cy + 20)
      ctx.lineTo(cx - 40, cy)
      ctx.stroke()

      // 7 màu tán sắc (Đỏ -> Tím)
      const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#6366F1', '#A855F7']
      colors.forEach((col, idx) => {
        const delta = (idx - 3) * 6
        ctx.strokeStyle = col
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(cx - 40, cy)
        ctx.lineTo(cx + 40, cy - 10 + delta * 0.5)
        ctx.lineTo(width - 60, cy - 30 + delta * 3)
        ctx.stroke()
      })
    }

    // 6. KHÚC XẠ & PHẢN XẠ TOÀN PHẦN
    else if (activeExp === 'refraction') {
      const centerY = height / 2

      // Môi trường 2
      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.2)'
      ctx.fillRect(0, centerY, width, height / 2)

      // Pháp tuyến
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(width / 2, 30)
      ctx.lineTo(width / 2, height - 30)
      ctx.stroke()
      ctx.setLineDash([])

      const iRad = (params.iAngle * Math.PI) / 180
      const inX = width / 2 - 160 * Math.sin(iRad)
      const inY = centerY - 160 * Math.cos(iRad)

      // Tia tới
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(inX, inY)
      ctx.lineTo(width / 2, centerY)
      ctx.stroke()

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
    }

    // 7. THẤU KÍNH MỎNG
    else if (activeExp === 'lens') {
      const cx = width / 2
      const cy = height / 2
      const f = params.focal * 0.7
      const d = params.dObject * 0.7

      // Trục chính
      ctx.strokeStyle = isDark ? '#64748B' : '#94A3B8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(40, cy)
      ctx.lineTo(width - 40, cy)
      ctx.stroke()

      // Thấu kính hội tụ
      ctx.strokeStyle = '#6366F1'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy - 120)
      ctx.lineTo(cx, cy + 120)
      ctx.stroke()

      // Tiêu điểm F và F'
      ctx.fillStyle = '#EF4444'
      ctx.beginPath()
      ctx.arc(cx - f, cy, 4, 0, Math.PI * 2)
      ctx.arc(cx + f, cy, 4, 0, Math.PI * 2)
      ctx.fill()

      // Ngọn nến vật sáng AB
      const hObj = 45
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx - d, cy)
      ctx.lineTo(cx - d, cy - hObj)
      ctx.stroke()

      // 3 tia sáng đặc biệt
      // Tia 1: song song trục chính -> qua F'
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx - d, cy - hObj)
      ctx.lineTo(cx, cy - hObj)
      ctx.lineTo(cx + f * 2, cy + hObj)
      ctx.stroke()

      // Tia 2: qua quang tâm O
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'
      ctx.beginPath()
      ctx.moveTo(cx - d, cy - hObj)
      ctx.lineTo(cx + f * 2, cy + hObj)
      ctx.stroke()
    }

    // 8. MẠCH XOAY CHIỀU R-L-C
    else if (activeExp === 'rlc') {
      const omega = 2 * Math.PI * params.freq
      const ZL = omega * params.L
      const ZC = 1 / (omega * (params.C * 1e-6))
      const Z = Math.sqrt(params.R * params.R + Math.pow(ZL - ZC, 2))
      const phi = Math.atan((ZL - ZC) / params.R)

      // Vẽ đồ thị sóng u(t) và i(t)
      ctx.lineWidth = 2.5
      // Điện áp u(t) - Đỏ
      ctx.strokeStyle = '#EF4444'
      ctx.beginPath()
      for (let x = 60; x < width - 60; x += 2) {
        const tVal = (x - 60) * 0.0003 + time * 0.5
        const y = height / 2 - Math.sin(omega * tVal) * 55
        if (x === 60) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Dòng điện i(t) - Xanh lá
      ctx.strokeStyle = '#10B981'
      ctx.beginPath()
      for (let x = 60; x < width - 60; x += 2) {
        const tVal = (x - 60) * 0.0003 + time * 0.5
        const y = height / 2 - Math.sin(omega * tVal - phi) * 40
        if (x === 60) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(`Tổng trở Z: ${Z.toFixed(1)} Ω (ZL: ${ZL.toFixed(1)}Ω, ZC: ${ZC.toFixed(1)}Ω)`, 30, 40)
      ctx.fillText(`Độ lệch pha φ: ${((phi * 180) / Math.PI).toFixed(1)}°`, 30, 60)
      if (Math.abs(ZL - ZC) < 10) {
        ctx.fillStyle = '#F59E0B'
        ctx.fillText(`⚡ ĐANG CỘNG HƯỞNG ĐIỆN (ZL ≈ ZC)!`, 30, 85)
      }
    }

    // 9. CHUẨN ĐỘ AXIT - BAZƠ (pH)
    else if (activeExp === 'titration') {
      const vNaOH = (time * 2) % 50
      const isPink = vNaOH >= 25

      // Bình tam giác Erlenmeyer
      const bx = width / 2
      const by = height / 2 + 50
      ctx.fillStyle = isPink ? 'rgba(244, 114, 182, 0.7)' : 'rgba(226, 232, 240, 0.4)'
      ctx.strokeStyle = '#94A3B8'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(bx - 30, by - 60)
      ctx.lineTo(bx - 70, by + 60)
      ctx.lineTo(bx + 70, by + 60)
      ctx.lineTo(bx + 30, by - 60)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Đường chuẩn độ pH
      const pH = vNaOH < 25 ? (1 + (vNaOH / 25) * 3).toFixed(1) : (7 + ((vNaOH - 25) / 25) * 6).toFixed(1)
      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(`Thể tích NaOH đã nhỏ: ${vNaOH.toFixed(1)} mL`, 40, 50)
      ctx.fillText(`pH dung dịch: ${pH}`, 40, 75)
      ctx.fillText(`Chỉ thị Phenolphtalein: ${isPink ? 'HỒNG ĐẬM (Môi trường kiềm)' : 'KHÔNG MÀU (Axit)'}`, 40, 100)
    }

    // 10. ĐIỆN TRƯỜNG & ĐẲNG THẾ
    else if (activeExp === 'equipotential') {
      const q1x = width / 2 - 100
      const q2x = width / 2 + 100
      const qy = height / 2

      // Mặt đẳng thế (Vòng tròn)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)'
      ctx.lineWidth = 1.5
      ;[30, 50, 75, 110].forEach((r) => {
        ctx.beginPath()
        ctx.arc(q1x, qy, r, 0, Math.PI * 2)
        ctx.arc(q2x, qy, r, 0, Math.PI * 2)
        ctx.stroke()
      })

      // Đường sức điện trường
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(q1x, qy)
      ctx.lineTo(q2x, qy)
      ctx.stroke()

      // Điện tích + và -
      ctx.fillStyle = '#EF4444'
      ctx.beginPath()
      ctx.arc(q1x, qy, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('+', q1x, qy + 5)

      ctx.fillStyle = '#3B82F6'
      ctx.beginPath()
      ctx.arc(q2x, qy, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText('-', q2x, qy + 5)
    }

    // 11. TỪ TRƯỜNG LORENTZ 3D (WEBGL SPATIAL)
    else if (activeExp === 'lorentz_3d') {
      const cx = width / 2
      const cy = height / 2

      // Hàm chiếu 3D
      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(rotY)
        const sinY = Math.sin(rotY)
        const x1 = x * cosY - z * sinY
        const z1 = x * sinY + z * cosY

        const cosX = Math.cos(rotX)
        const sinX = Math.sin(rotX)
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX

        const dist = 500
        const scale = dist / (dist + z2)
        return { x: cx + x1 * scale, y: cy + y2 * scale, scale, depth: z2 }
      }

      // Trục tọa độ 3D Oxyz
      const o = project(0, 0, 0)
      const axX = project(140, 0, 0)
      const axY = project(0, -140, 0)
      const axZ = project(0, 0, 140)

      ctx.lineWidth = 2
      // Trục X - Đỏ
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'
      ctx.beginPath()
      ctx.moveTo(o.x, o.y)
      ctx.lineTo(axX.x, axX.y)
      ctx.stroke()

      // Trục Y - Xanh lá
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)'
      ctx.beginPath()
      ctx.moveTo(o.x, o.y)
      ctx.lineTo(axY.x, axY.y)
      ctx.stroke()

      // Trục Z - Xanh dương (Hướng từ trường B)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
      ctx.beginPath()
      ctx.moveTo(o.x, o.y)
      ctx.lineTo(axZ.x, axZ.y)
      ctx.stroke()

      // Vector từ trường B 3D
      for (let bx = -100; bx <= 100; bx += 100) {
        for (let by = -80; by <= 80; by += 80) {
          const p1 = project(bx, by, -100)
          const p2 = project(bx, by, 100)
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()
        }
      }

      // Quỹ đạo xoắn ốc 3D của hạt tích điện trong từ trường
      const R = 65
      const vz = 25
      const omega = 4.0
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#F59E0B'
      ctx.beginPath()

      const currentZ = ((time * vz) % 220) - 110
      const currentX = R * Math.cos(omega * time)
      const currentY = R * Math.sin(omega * time)

      for (let t = Math.max(0, time - 4); t <= time; t += 0.04) {
        const pz = ((t * vz) % 220) - 110
        const px = R * Math.cos(omega * t)
        const py = R * Math.sin(omega * t)
        const pt = project(px, py, pz)
        if (t === Math.max(0, time - 4)) ctx.moveTo(pt.x, pt.y)
        else ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()

      // Hạt điện tích 3D
      const pCurrent = project(currentX, currentY, currentZ)
      const grad = ctx.createRadialGradient(pCurrent.x - 2, pCurrent.y - 2, 2, pCurrent.x, pCurrent.y, 14 * pCurrent.scale)
      grad.addColorStop(0, '#FFFFFF')
      grad.addColorStop(0.3, '#FBBF24')
      grad.addColorStop(1, '#D97706')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(pCurrent.x, pCurrent.y, Math.max(4, 12 * pCurrent.scale), 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`⚡ Lực Lorentz: F = |q|*v*B*sin(α) (Bán kính R = ${R}px)`, 30, 40)
      ctx.fillText(`🌐 Kéo chuột trên khung để xoay góc nhìn 3D không gian`, 30, 65)
    }

    // 12. MẪU NGUYÊN TỬ BOHR 3D (3D ATOM MODEL)
    else if (activeExp === 'bohr_3d') {
      const cx = width / 2
      const cy = height / 2

      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(rotY)
        const sinY = Math.sin(rotY)
        const x1 = x * cosY - z * sinY
        const z1 = x * sinY + z * cosY

        const cosX = Math.cos(rotX)
        const sinX = Math.sin(rotX)
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX

        const dist = 500
        const scale = dist / (dist + z2)
        return { x: cx + x1 * scale, y: cy + y2 * scale, scale, depth: z2 }
      }

      // Hạt nhân nguyên tử 3D ở tâm
      const nuc = project(0, 0, 0)
      const gradNuc = ctx.createRadialGradient(nuc.x - 4, nuc.y - 4, 3, nuc.x, nuc.y, 22 * nuc.scale)
      gradNuc.addColorStop(0, '#FDA4AF')
      gradNuc.addColorStop(0.5, '#E11D48')
      gradNuc.addColorStop(1, '#881337')
      ctx.fillStyle = gradNuc
      ctx.beginPath()
      ctx.arc(nuc.x, nuc.y, 18 * nuc.scale, 0, Math.PI * 2)
      ctx.fill()

      // 3 Quỹ đạo Electron nghiêng trong không gian 3D
      const orbits = [
        { r: 70, speed: 3.5, tiltX: 0.2, tiltZ: 0.4, color: '#38BDF8' },
        { r: 120, speed: -2.2, tiltX: 0.8, tiltZ: -0.5, color: '#A855F7' },
        { r: 165, speed: 1.6, tiltX: -0.6, tiltZ: 0.7, color: '#34D399' },
      ]

      orbits.forEach((orb, idx) => {
        ctx.strokeStyle = orb.color + '40'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const rawX = orb.r * Math.cos(a)
          const rawY = orb.r * Math.sin(a) * Math.sin(orb.tiltX)
          const rawZ = orb.r * Math.sin(a) * Math.cos(orb.tiltZ)
          const pt = project(rawX, rawY, rawZ)
          if (a === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        }
        ctx.stroke()

        // Electron quay trên quỹ đạo
        const currentAngle = time * orb.speed + idx * 2
        const eX = orb.r * Math.cos(currentAngle)
        const eY = orb.r * Math.sin(currentAngle) * Math.sin(orb.tiltX)
        const eZ = orb.r * Math.sin(currentAngle) * Math.cos(orb.tiltZ)
        const ePt = project(eX, eY, eZ)

        const gradE = ctx.createRadialGradient(ePt.x - 2, ePt.y - 2, 1, ePt.x, ePt.y, 8 * ePt.scale)
        gradE.addColorStop(0, '#FFFFFF')
        gradE.addColorStop(1, orb.color)
        ctx.fillStyle = gradE
        ctx.beginPath()
        ctx.arc(ePt.x, ePt.y, Math.max(3, 7 * ePt.scale), 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`⚛️ Mẫu Bohr: En = -13.6 / n² (eV) • 3 Mức năng lượng K, L, M`, 30, 40)
      ctx.fillText(`🌐 Xoay góc nhìn 3D để quan sát đám mây Electron đa trục`, 30, 65)
    }

    // 13. MÔ HÌNH PHÂN TỬ HÓA HỌC 3D (3D MOLECULAR CPK)
    else if (activeExp === 'molecule_3d') {
      const cx = width / 2
      const cy = height / 2

      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(rotY)
        const sinY = Math.sin(rotY)
        const x1 = x * cosY - z * sinY
        const z1 = x * sinY + z * cosY

        const cosX = Math.cos(rotX)
        const sinX = Math.sin(rotX)
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX

        const dist = 500
        const scale = dist / (dist + z2)
        return { x: cx + x1 * scale, y: cy + y2 * scale, scale, depth: z2 }
      }

      // Phân tử Methane (CH4) hoặc Nước (H2O)
      type Atom3D = { x: number; y: number; z: number; color: string; radius: number; label: string }
      type Bond3D = { from: number; to: number }

      // Cấu trúc CH4 (Tứ diện đều 109.5 độ)
      const ch4Atoms: Atom3D[] = [
        { x: 0, y: 0, z: 0, color: '#334155', radius: 24, label: 'C' }, // Carbon
        { x: 60, y: 60, z: 60, color: '#F1F5F9', radius: 14, label: 'H' },
        { x: -60, y: -60, z: 60, color: '#F1F5F9', radius: 14, label: 'H' },
        { x: -60, y: 60, z: -60, color: '#F1F5F9', radius: 14, label: 'H' },
        { x: 60, y: -60, z: -60, color: '#F1F5F9', radius: 14, label: 'H' },
      ]
      const ch4Bonds: Bond3D[] = [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 0, to: 3 },
        { from: 0, to: 4 },
      ]

      // Vẽ liên kết cộng hóa trị 3D (Bonds)
      ch4Bonds.forEach((b) => {
        const p1 = project(ch4Atoms[b.from].x, ch4Atoms[b.from].y, ch4Atoms[b.from].z)
        const p2 = project(ch4Atoms[b.to].x, ch4Atoms[b.to].y, ch4Atoms[b.to].z)
        ctx.strokeStyle = '#94A3B8'
        ctx.lineWidth = 6 * ((p1.scale + p2.scale) / 2)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      })

      // Sắp xếp nguyên tử theo chiều sâu Z để vẽ từ xa đến gần
      const projectedAtoms = ch4Atoms.map((at) => ({ ...at, ...project(at.x, at.y, at.z) }))
      projectedAtoms.sort((a, b) => b.depth - a.depth)

      projectedAtoms.forEach((at) => {
        const r = at.radius * at.scale
        const grad = ctx.createRadialGradient(at.x - r * 0.3, at.y - r * 0.3, r * 0.1, at.x, at.y, r)
        grad.addColorStop(0, '#FFFFFF')
        grad.addColorStop(0.4, at.color)
        grad.addColorStop(1, '#000000')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(at.x, at.y, r, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = at.label === 'C' ? '#FFFFFF' : '#1E293B'
        ctx.font = `bold ${Math.max(10, Math.floor(12 * at.scale))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(at.label, at.x, at.y + 4)
      })

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`🧪 Mô hình phân tử Methane (CH4) - Cấu trúc không gian tứ diện 109.5°`, 30, 40)
      ctx.fillText(`🌐 Kéo chuột xoay 360° để quan sát liên kết cộng hóa trị phân tử`, 30, 65)
    }

    // 14. GIAO THOA SÓNG 3D (HEIGHT-FIELD WAVE SURFACE)
    else if (activeExp === 'wave_3d') {
      const cx = width / 2
      const cy = height / 2 + 30

      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(rotY)
        const sinY = Math.sin(rotY)
        const x1 = x * cosY - z * sinY
        const z1 = x * sinY + z * cosY

        const cosX = Math.cos(rotX)
        const sinX = Math.sin(rotX)
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX

        const dist = 550
        const scale = dist / (dist + z2)
        return { x: cx + x1 * scale, y: cy + y2 * scale, scale }
      }

      // Lưới mặt sóng 3D 16x16
      const s1x = -60
      const s2x = 60
      const k = 0.08
      const omega = 3.5

      ctx.lineWidth = 1.2
      for (let gridZ = -140; gridZ <= 140; gridZ += 20) {
        ctx.beginPath()
        for (let gridX = -160; gridX <= 160; gridX += 15) {
          const d1 = Math.sqrt((gridX - s1x) ** 2 + gridZ ** 2)
          const d2 = Math.sqrt((gridX - s2x) ** 2 + gridZ ** 2)
          const waveY = (Math.cos(k * d1 - omega * time) + Math.cos(k * d2 - omega * time)) * 14
          const pt = project(gridX, -waveY, gridZ)

          if (gridX === -160) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        }
        ctx.strokeStyle = `hsl(${((gridZ + 140) / 280) * 180 + 160}, 85%, 60%)`
        ctx.stroke()
      }

      ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`🌊 Giao thoa 2 nguồn sóng kết hợp 3D (Cực đại u = 2A, Cực tiểu u = 0)`, 30, 40)
      ctx.fillText(`🌐 Kéo chuột để thay đổi góc nhìn chiều sâu của mặt sóng`, 30, 65)
    }
  }, [activeExp, params, time, isDark, rotX, rotY])

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
          deepThink: true,
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
                Mô phỏng tương tác Vật lý - Hóa học 60FPS
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
              onMouseDown={(e) => {
                isDraggingRef.current = true
                lastMousePosRef.current = { x: e.clientX, y: e.clientY }
              }}
              onMouseMove={(e) => {
                if (!isDraggingRef.current) return
                const dx = e.clientX - lastMousePosRef.current.x
                const dy = e.clientY - lastMousePosRef.current.y
                setRotY((r) => r + dx * 0.01)
                setRotX((r) => Math.max(-1.4, Math.min(1.4, r + dy * 0.01)))
                lastMousePosRef.current = { x: e.clientX, y: e.clientY }
              }}
              onMouseUp={() => { isDraggingRef.current = false }}
              onMouseLeave={() => { isDraggingRef.current = false }}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  isDraggingRef.current = true
                  lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
                }
              }}
              onTouchMove={(e) => {
                if (!isDraggingRef.current || !e.touches[0]) return
                const dx = e.touches[0].clientX - lastMousePosRef.current.x
                const dy = e.touches[0].clientY - lastMousePosRef.current.y
                setRotY((r) => r + dx * 0.015)
                setRotX((r) => Math.max(-1.4, Math.min(1.4, r + dy * 0.015)))
                lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
              }}
              onTouchEnd={() => { isDraggingRef.current = false }}
              className="max-w-full rounded-3xl border border-black/10 dark:border-white/10 bg-slate-950 shadow-xl cursor-grab active:cursor-grabbing select-none"
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
