'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Plus,
  Minus,
  Trash2,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Home,
  HelpCircle,
  Keyboard as KeyboardIcon,
  Send,
  Loader2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CornerDownLeft,
  Check,
  X,
  Share2,
  Download,
  Settings2,
  Layers,
  Palette,
  Play,
  Pause,
  Box,
  Compass,
  Sun,
  Moon,
  Image as ImageIcon,
  Paperclip,
  CheckCircle2,
  Copy,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/lib/supabaseClient'
import SenGraphLogo from '@/components/SenGraphLogo'

// Bảng màu mặc định cho các phương trình
const EQUATION_COLORS = [
  '#0284c7', // Sky Blue
  '#ef4444', // Red
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
]

export interface EquationItem {
  id: string
  expr: string
  color: string
  visible: boolean
}

// Bộ mẫu phương trình sẵn có
const PRESETS_2D = [
  { label: 'Parabol bậc 2', expr: 'y = x^2 - 3x + 1' },
  { label: 'Đa thức bậc 3', expr: 'y = x^3 - 3x' },
  { label: 'Sóng lượng giác Sin', expr: 'y = 2*sin(x)' },
  { label: 'Phân thức hữu tỉ', expr: 'y = (2x - 1) / (x + 1)' },
  { label: 'Hàm số mũ Euler', expr: 'y = e^(-x^2)' },
  { label: 'Trái tim toán học', expr: 'y = sqrt(max(0, 4 - x^2)) + sqrt(abs(x))' },
]

const PRESETS_3D = [
  { label: 'Mặt yên ngựa (Saddle)', expr: 'z = (x^2 - y^2) / 3' },
  { label: 'Gợn sóng nước (Ripple)', expr: 'z = 1.5 * sin(sqrt(x^2 + y^2))' },
  { label: 'Paraboloid eliptic', expr: 'z = (x^2 + y^2) / 4' },
  { label: 'Nón tròn xoay (Cone)', expr: 'z = sqrt(x^2 + y^2)' },
  { label: 'Bán cầu (Hemisphere)', expr: 'z = sqrt(max(0, 16 - x^2 - y^2))' },
  { label: 'Bề mặt sóng đôi', expr: 'z = cos(x) * sin(y)' },
]

// ==============================================================
// 1. CHUYỂN ĐỔI BIỂU THỨC SANG LATEX CHUẨN ĐỂ KATEX KẾT XUẤT
// ==============================================================
function formatToLatex(raw: string): string {
  if (!raw || !raw.trim()) return ''
  let s = raw.trim()

  // Chuẩn hóa dấu phân số đơn giản: (A)/(B) -> \frac{A}{B}
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}')
  s = s.replace(/([0-9a-zA-Z^]+)\s*\/\s*([0-9a-zA-Z^]+)/g, '\\frac{$1}{$2}')

  // Chuẩn hóa dấu nhân: 2*x -> 2x, * -> \cdot
  s = s.replace(/(\d+)\s*\*\s*([a-zA-Z])/g, '$1 $2')
  s = s.replace(/\*/g, ' \\cdot ')

  // Chuẩn hóa căn thức: sqrt(A) -> \sqrt{A}, cbrt(A) -> \sqrt[3]{A}
  s = s.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
  s = s.replace(/cbrt\(([^)]+)\)/g, '\\sqrt[3]{$1}')

  // Chuẩn hóa các hàm lượng giác & giải tích
  s = s.replace(/\bsin\b/g, '\\sin ')
  s = s.replace(/\bcos\b/g, '\\cos ')
  s = s.replace(/\btan\b/g, '\\tan ')
  s = s.replace(/\bcot\b/g, '\\cot ')
  s = s.replace(/\bsec\b/g, '\\sec ')
  s = s.replace(/\bcsc\b/g, '\\csc ')
  s = s.replace(/\basin\b/g, '\\arcsin ')
  s = s.replace(/\bacos\b/g, '\\arccos ')
  s = s.replace(/\batan\b/g, '\\arctan ')
  s = s.replace(/\bln\b/g, '\\ln ')
  s = s.replace(/\blog\b/g, '\\log ')
  s = s.replace(/\bexp\b/g, '\\exp ')
  s = s.replace(/\bpi\b/gi, '\\pi ')

  // Chuẩn hóa số mũ: x^2 -> x^{2}, x^(expr) -> x^{expr}
  s = s.replace(/\^([0-9a-zA-Z]+)/g, '^{$1}')
  s = s.replace(/\^\(([^)]+)\)/g, '^{$1}')

  // Chuẩn hóa tích phân: int -> \int
  s = s.replace(/\bint\b/g, '\\int ')

  // Chuẩn hóa so sánh
  s = s.replace(/<=/g, '\\le ')
  s = s.replace(/>=/g, '\\ge ')
  s = s.replace(/!=/g, '\\neq ')

  return s
}

// Component hiển thị công thức toán học chuẩn KaTeX
function MathFormulaView({ expr, className = '' }: { expr: string; className?: string }) {
  const html = useMemo(() => {
    try {
      const latex = formatToLatex(expr)
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      })
    } catch {
      return expr
    }
  }, [expr])

  return (
    <span
      className={`inline-block font-serif text-sm tracking-wide select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Hàm tiền xử lý văn bản toán học để ReactMarkdown và KaTeX kết xuất ký hiệu chuẩn xác
function preprocessMathForMarkdown(text: string): string {
  if (!text) return ''
  // 1. Ẩn khối mã máy sen-graph-equations hoặc json cấu hình (vì đã có thẻ hành động đồ thị riêng ở dưới)
  let clean = text.replace(/```(?:sen-graph-equations|json)\s*\{[\s\S]*?\}\s*```/gi, '').trim()
  if (!clean) clean = text

  // 2. Chuyển đổi khối công thức \[ ... \] thành $$ ... $$
  clean = clean.replace(/\\\[([\s\S]*?)\\\]/g, (_m, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`)

  // 3. Chuyển đổi công thức nội dòng \( ... \) thành $ ... $
  clean = clean.replace(/\\\(([\s\S]*?)\\\)/g, (_m, eq) => `$${eq.trim()}$`)

  // 4. Chuẩn hóa nếu có khối $$ ... $$ dính liền với chữ không có dòng trống
  clean = clean.replace(/(?:^|\n)\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/g, (_m, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`)

  return clean
}

// ==============================================================
// 2. TẠO SPRITE NHÃN TRỤC 3D VÀ CHỮ SỐ
// ==============================================================
function createAxisSprite(text: string, color: string, isDark: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.beginPath()
    ctx.arc(64, 64, 52, 0, Math.PI * 2)
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = color
    ctx.stroke()

    ctx.font = 'bold 54px sans-serif'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.5, 1.5, 1)
  return sprite
}

function createTickSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = 'bold 44px monospace'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 48, 48)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(0.9, 0.9, 1)
  return sprite
}

// ==============================================================
// 3. BỘ PHÂN TÍCH TOÁN HỌC AN TOÀN (SAFE MATH COMPILER)
// ==============================================================
function compileExpression(rawExpr: string, is3D = false): ((x: number, y?: number) => number) | null {
  if (!rawExpr || !rawExpr.trim()) return null

  let clean = rawExpr.trim()

  // Bỏ tiền tố y = hoặc z = hoặc f(x) =
  if (is3D) {
    clean = clean.replace(/^(?:z|f\s*\(\s*x\s*,\s*y\s*\))\s*=\s*/i, '')
  } else {
    clean = clean.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
  }

  // Khử các lệnh LaTeX nếu người dùng dán vào
  clean = clean.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))')
  clean = clean.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
  clean = clean.replace(/\\cdot/g, '*')
  clean = clean.replace(/\\([a-zA-Z]+)/g, '$1')
  clean = clean.replace(/\{/g, '(').replace(/\}/g, ')')

  // Chuẩn hóa ký hiệu lũy thừa ^ thành **
  clean = clean.replace(/\^/g, '**')

  // Chuẩn hóa các phép nhân ẩn: 2x -> 2*x, 3sin -> 3*sin, x( -> x*(, )( -> )*(
  clean = clean.replace(/(\d)([a-zA-Z(])/g, '$1*$2')
  clean = clean.replace(/(\))([a-zA-Z0-9(])/g, '$1*$2')
  if (is3D) {
    clean = clean.replace(/([xy])([xy])/gi, '$1*$2')
  }

  // Danh sách hàm toán học hỗ trợ toàn diện
  const mathScope = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    cot: (x: number) => 1 / Math.tan(x),
    sec: (x: number) => 1 / Math.cos(x),
    csc: (x: number) => 1 / Math.sin(x),
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    log: Math.log10,
    ln: Math.log,
    exp: Math.exp,
    max: Math.max,
    min: Math.min,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    sign: Math.sign,
    mod: (a: number, b: number) => ((a % b) + b) % b,
    gcd: (a: number, b: number) => {
      a = Math.abs(Math.round(a))
      b = Math.abs(Math.round(b))
      while (b) {
        const t = b
        b = a % b
        a = t
      }
      return a
    },
    lcm: (a: number, b: number) => {
      a = Math.abs(Math.round(a))
      b = Math.abs(Math.round(b))
      if (!a || !b) return 0
      let x = a,
        y = b
      while (y) {
        const t = y
        y = x % y
        x = t
      }
      return Math.abs(a * b) / x
    },
    nroot: (x: number, n: number) => Math.pow(x, 1 / n),
    nPr: (n: number, r: number) => {
      if (r > n || n < 0 || r < 0) return 0
      let res = 1
      for (let i = n; i > n - r; i--) res *= i
      return res
    },
    nCr: (n: number, r: number) => {
      if (r > n || n < 0 || r < 0) return 0
      let res = 1
      for (let i = 1; i <= r; i++) {
        res = (res * (n - i + 1)) / i
      }
      return res
    },
    pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    E: Math.E,
  }

  try {
    const args = is3D ? ['x', 'y', 'MathScope'] : ['x', 'MathScope']
    const body = `
      with (MathScope) {
        return (${clean});
      }
    `
    // eslint-disable-next-line no-new-func
    const fn = new Function(...args, body)

    return (x: number, y: number = 0) => {
      try {
        const val = is3D ? fn(x, y, mathScope) : fn(x, mathScope)
        if (typeof val !== 'number' || isNaN(val)) return NaN
        return val
      } catch {
        return NaN
      }
    }
  } catch {
    return null
  }
}

export default function SenGraphPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Quản lý danh sách phương trình
  const [equations2D, setEquations2D] = useState<EquationItem[]>([
    { id: 'eq-1', expr: 'y = x^2 - 3', color: '#0284c7', visible: true },
    { id: 'eq-2', expr: 'y = 2*sin(x)', color: '#ef4444', visible: true },
  ])

  const [equations3D, setEquations3D] = useState<EquationItem[]>([
    { id: 'eq-3d-1', expr: 'z = (x^2 - y^2) / 3', color: '#0284c7', visible: true },
    { id: 'eq-3d-2', expr: 'z = 1.5 * sin(sqrt(x^2 + y^2))', color: '#10b981', visible: false },
  ])

  const activeEquations = mode === '2d' ? equations2D : equations3D
  const setActiveEquations = mode === '2d' ? setEquations2D : setEquations3D

  // Con trỏ và ô nhập đang chọn
  const [activeInputId, setActiveInputId] = useState<string>('eq-1')

  // Bàn phím ảo toán học
  const [showKeyboard, setShowKeyboard] = useState(true)
  const [keyboardMode, setKeyboardMode] = useState<'math' | 'abc'>('math')
  const [showFunctionsMenu, setShowFunctionsMenu] = useState(false)
  const [functionsTab, setFunctionsTab] = useState<'theory' | 'trig' | 'calc' | 'stat'>('theory')
  const [isShiftActive, setIsShiftActive] = useState(false)

  // 3D Visual Preferences
  const [wireframe3D, setWireframe3D] = useState(false)
  const [autoRotate3D, setAutoRotate3D] = useState(false)

  // 🤖 Sen AI Drawer State (Gemini 3.5 Flash Lite)
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const [aiMessages, setAiMessages] = useState<
    Array<{
      role: 'user' | 'assistant'
      text: string
      imagePreview?: string
      extractedEquations?: {
        mode?: '2d' | '3d'
        title?: string
        equations?: string[]
        explanation?: string
      } | null
    }>
  >([
    {
      role: 'assistant',
      text: 'Xin chào! Tôi là **Sen AI** — Trợ lý Toán học & Đồ thị cao cấp của **SenGraph** (chạy trên nền **Gemini 3.5 Flash Lite**).\n\nBạn có thể **dán ảnh trực tiếp (Ctrl + V)** hoặc **tải lên ảnh chụp đề bài, đề kiểm tra** — tôi sẽ giải chi tiết từng bước, hướng dẫn vẽ và tự động tạo phương trình chính xác để nạp ngay vào đồ thị 2D/3D!',
    },
  ])
  const [aiInputText, setAiInputText] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiAttachedImage, setAiAttachedImage] = useState<string | null>(null)
  const [aiAttachedImageMime, setAiAttachedImageMime] = useState<string>('image/jpeg')
  const [aiRenderOption, setAiRenderOption] = useState<'auto' | 'curve' | 'full'>('auto')
  const aiChatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // DOM Refs
  const canvas2dRef = useRef<HTMLCanvasElement>(null)
  const container3dRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<'2d' | '3d'>('2d')
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const autoRotateRef = useRef(false)
  useEffect(() => {
    autoRotateRef.current = autoRotate3D
  }, [autoRotate3D])

  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    meshGroup: THREE.Group
    grid: THREE.GridHelper
    axesGroup: THREE.Group
    reqId: number
    orbit: { isDragging: boolean; prevX: number; prevY: number; yaw: number; pitch: number; distance: number }
  } | null>(null)

  // 2D View State (Pan & Zoom)
  const view2DRef = useRef({
    originX: 0,
    originY: 0,
    scale: 45, // pixels per unit
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  })
  const [mouseCoord2D, setMouseCoord2D] = useState<{ x: number; y: number } | null>(null)

  // 1. Theme initialization & Sync
  useEffect(() => {
    const savedTheme = localStorage.getItem('sengraph_theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('sengraph_theme', next)
  }

  // 2. Kiểm tra trạng thái đăng nhập SenExam
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('full_name, avatar_url, email, role')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setCurrentUser({
              ...data.user,
              name: profile?.full_name || data.user.user_metadata?.full_name || 'Học viên SenExam',
              avatar: profile?.avatar_url || '',
            })
          })
      }
    })
  }, [])

  // ==============================================================
  // 📸 3. TÍNH NĂNG DÁN ẢNH TỪ CLIPBOARD (CTRL + V) VÀO SEN AI
  // ==============================================================
  const handlePasteImage = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = (e as React.ClipboardEvent).clipboardData || (e as ClipboardEvent).clipboardData
    const items = clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          setAiAttachedImageMime(file.type || 'image/jpeg')
          const reader = new FileReader()
          reader.onload = () => {
            setAiAttachedImage(reader.result as string)
            setShowAiDrawer(true)
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
  }, [])

  useEffect(() => {
    const onGlobalPaste = (e: ClipboardEvent) => {
      handlePasteImage(e)
    }
    window.addEventListener('paste', onGlobalPaste)
    return () => window.removeEventListener('paste', onGlobalPaste)
  }, [handlePasteImage])

  // ==============================================================
  // 4. CANVAS ENGINE 2D (ĐỊNH HƯỚNG RÕ TRỤC OX VÀ OY)
  // ==============================================================
  const draw2D = useCallback(() => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { originX, originY, scale } = view2DRef.current
    const w = canvas.width
    const h = canvas.height

    if (w <= 0 || h <= 0 || !scale || scale <= 0) return

    const isDark = theme === 'dark'

    // Xóa khung vẽ
    ctx.clearRect(0, 0, w, h)

    // A. Vẽ nền Canvas
    ctx.fillStyle = isDark ? '#090d16' : '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // Bước nhảy lưới tự co giãn
    let unitStep = 1
    if (scale < 20) unitStep = 5
    else if (scale < 35) unitStep = 2
    else if (scale > 90) unitStep = 0.5
    else if (scale > 180) unitStep = 0.2

    const gridPixelStep = scale * unitStep

    // Lưới phụ
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'
    ctx.lineWidth = 1
    const subStep = gridPixelStep / 5
    const startXSub = originX % subStep
    for (let x = startXSub; x < w; x += subStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const startYSub = originY % subStep
    for (let y = startYSub; y < h; y += subStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Lưới chính
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0'
    ctx.lineWidth = 1
    const startX = originX % gridPixelStep
    for (let x = startX; x < w; x += gridPixelStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const startY = originY % gridPixelStep
    for (let y = startY; y < h; y += gridPixelStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // B. Trục tọa độ Ox và Oy với Mũi Tên và Nhãn Rõ Ràng
    ctx.strokeStyle = isDark ? '#94a3b8' : '#475569'
    ctx.lineWidth = 2

    // Trục Oy (x = 0)
    ctx.beginPath()
    ctx.moveTo(originX, 0)
    ctx.lineTo(originX, h)
    ctx.stroke()

    // Mũi tên và chữ y trên trục Oy
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7'
    ctx.beginPath()
    ctx.moveTo(originX, 2)
    ctx.lineTo(originX - 6, 16)
    ctx.lineTo(originX + 6, 16)
    ctx.fill()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('y', originX + 10, 8)

    // Trục Ox (y = 0)
    ctx.beginPath()
    ctx.moveTo(0, originY)
    ctx.lineTo(w, originY)
    ctx.stroke()

    // Mũi tên và chữ x trên trục Ox
    ctx.fillStyle = isDark ? '#f87171' : '#dc2626'
    ctx.beginPath()
    ctx.moveTo(w - 2, originY)
    ctx.lineTo(w - 16, originY - 6)
    ctx.lineTo(w - 16, originY + 6)
    ctx.fill()
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('x', w - 10, originY - 8)

    // C. Đánh số tọa độ
    ctx.fillStyle = isDark ? '#cbd5e1' : '#64748b'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Số trên trục Ox
    const minUnitX = Math.floor(-originX / scale / unitStep) * unitStep
    const maxUnitX = Math.ceil((w - originX) / scale / unitStep) * unitStep
    for (let u = minUnitX; u <= maxUnitX; u += unitStep) {
      if (Math.abs(u) < 0.001) continue
      const px = originX + u * scale
      ctx.fillText(Number(u.toFixed(2)).toString(), px, Math.min(Math.max(originY + 6, 6), h - 20))
    }

    // Số trên trục Oy
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const minUnitY = Math.floor((originY - h) / scale / unitStep) * unitStep
    const maxUnitY = Math.ceil(originY / scale / unitStep) * unitStep
    for (let u = minUnitY; u <= maxUnitY; u += unitStep) {
      if (Math.abs(u) < 0.001) continue
      const py = originY - u * scale
      ctx.fillText(Number(u.toFixed(2)).toString(), Math.min(Math.max(originX - 6, 28), w - 6), py)
    }

    // Gốc tọa độ O (0, 0)
    ctx.fillStyle = isDark ? '#94a3b8' : '#475569'
    ctx.fillText('O', originX - 8, originY + 6)

    // D. Vẽ các hàm số 2D
    equations2D.forEach((eq) => {
      if (!eq.visible || !eq.expr.trim()) return

      const compiledFn = compileExpression(eq.expr, false)
      if (!compiledFn) return

      ctx.strokeStyle = eq.color
      ctx.lineWidth = 2.5
      ctx.beginPath()

      let isDrawing = false
      const stepPixels = 1

      for (let px = 0; px <= w; px += stepPixels) {
        const cartX = (px - originX) / scale
        const cartY = compiledFn(cartX)

        if (isNaN(cartY) || !isFinite(cartY)) {
          isDrawing = false
          continue
        }

        const py = originY - cartY * scale

        if (py < -h * 2 || py > h * 3) {
          isDrawing = false
          continue
        }

        if (!isDrawing) {
          ctx.moveTo(px, py)
          isDrawing = true
        } else {
          ctx.lineTo(px, py)
        }
      }

      ctx.stroke()
    })
  }, [equations2D, theme])

  // Resize canvas 2D
  useEffect(() => {
    const canvas = canvas2dRef.current
    if (!canvas) return

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width
        canvas.height = rect.height
        if (view2DRef.current.originX === 0) {
          view2DRef.current.originX = rect.width / 2
          view2DRef.current.originY = rect.height / 2
        }
        draw2D()
      }
    }

    handleResize()
    const timer = setTimeout(handleResize, 50)
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [mode, draw2D])

  // Tương tác chuột 2D (Pan & Zoom)
  const handleMouseDown2D = (e: React.MouseEvent) => {
    view2DRef.current.isDragging = true
    view2DRef.current.dragStartX = e.clientX
    view2DRef.current.dragStartY = e.clientY
  }

  const handleMouseMove2D = (e: React.MouseEvent) => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Tính tọa độ Đề-các
    const { originX, originY, scale } = view2DRef.current
    const cartX = (mouseX - originX) / scale
    const cartY = (originY - mouseY) / scale
    setMouseCoord2D({ x: Math.round(cartX * 100) / 100, y: Math.round(cartY * 100) / 100 })

    if (view2DRef.current.isDragging) {
      const dx = e.clientX - view2DRef.current.dragStartX
      const dy = e.clientY - view2DRef.current.dragStartY
      view2DRef.current.originX += dx
      view2DRef.current.originY += dy
      view2DRef.current.dragStartX = e.clientX
      view2DRef.current.dragStartY = e.clientY
      draw2D()
    }
  }

  const handleMouseUp2D = () => {
    view2DRef.current.isDragging = false
  }

  const handleWheel2D = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
    const canvas = canvas2dRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const oldScale = view2DRef.current.scale
    const newScale = Math.max(5, Math.min(1000, oldScale * zoomFactor))

    view2DRef.current.originX = mouseX - (mouseX - view2DRef.current.originX) * (newScale / oldScale)
    view2DRef.current.originY = mouseY - (mouseY - view2DRef.current.originY) * (newScale / oldScale)
    view2DRef.current.scale = newScale

    draw2D()
  }

  const handleZoom2D = (direction: 'in' | 'out') => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    const zoomFactor = direction === 'in' ? 1.25 : 0.8
    const oldScale = view2DRef.current.scale
    const newScale = Math.max(5, Math.min(1000, oldScale * zoomFactor))
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    view2DRef.current.originX = cx - (cx - view2DRef.current.originX) * (newScale / oldScale)
    view2DRef.current.originY = cy - (cy - view2DRef.current.originY) * (newScale / oldScale)
    view2DRef.current.scale = newScale
    draw2D()
  }

  const handleResetView2D = () => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    view2DRef.current.originX = canvas.width / 2
    view2DRef.current.originY = canvas.height / 2
    view2DRef.current.scale = 45
    draw2D()
  }

  // ==============================================================
  // 5. THREE.JS ENGINE 3D (ĐỊNH HƯỚNG CHUẨN X, Y, Z TOÁN HỌC)
  // ==============================================================
  useEffect(() => {
    const container = container3dRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600
    const isDark = theme === 'dark'

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(isDark ? '#090d16' : '#f8fafc')

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(12, 10, 14)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.7 : 0.9)
    scene.add(ambientLight)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(10, 20, 15)
    scene.add(dirLight1)
    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4)
    dirLight2.position.set(-10, -10, -15)
    scene.add(dirLight2)

    // 3D Lưới mặt đáy Oxy (z = 0)
    const gridColor1 = isDark ? 0x38bdf8 : 0x0284c7
    const gridColor2 = isDark ? 0x1e293b : 0xcbd5e1
    const grid = new THREE.GridHelper(16, 16, gridColor1, gridColor2)
    grid.position.y = 0
    scene.add(grid)

    // 🌟 THIẾT LẬP HỆ TRỤC TOÁN HỌC OXYZ ĐÚNG CHUẨN VÀ RÕ RÀNG
    const axesGroup = new THREE.Group()
    scene.add(axesGroup)

    // 1. Trục Ox (Trục Hoành x: Màu Đỏ #ef4444)
    const arrowXPos = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 8.8, 0xef4444, 1.0, 0.5)
    const arrowXNeg = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 0), 8.8, 0xef4444, 0, 0)
    axesGroup.add(arrowXPos)
    axesGroup.add(arrowXNeg)
    const labelX = createAxisSprite('x', '#ef4444', isDark)
    labelX.position.set(9.8, 0, 0)
    axesGroup.add(labelX)

    // 2. Trục Oy (Trục Tung y Trên Mặt Đáy: Màu Xanh Lá #10b981 - Đi theo -Z Three.js)
    const arrowYPos = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 8.8, 0x10b981, 1.0, 0.5)
    const arrowYNeg = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 8.8, 0x10b981, 0, 0)
    axesGroup.add(arrowYPos)
    axesGroup.add(arrowYNeg)
    const labelY = createAxisSprite('y', '#10b981', isDark)
    labelY.position.set(0, 0, -9.8)
    axesGroup.add(labelY)

    // 3. Trục Oz (Trục Cao z Thẳng Đứng: Màu Xanh Dương #0284c7 - Đi theo +Y Three.js)
    const arrowZPos = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 8.0, 0x0284c7, 1.0, 0.5)
    const arrowZNeg = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 6.5, 0x0284c7, 0, 0)
    axesGroup.add(arrowZPos)
    axesGroup.add(arrowZNeg)
    const labelZ = createAxisSprite('z', '#0284c7', isDark)
    labelZ.position.set(0, 9.0, 0)
    axesGroup.add(labelZ)

    // Gốc tọa độ O
    const labelO = createAxisSprite('O', isDark ? '#94a3b8' : '#475569', isDark)
    labelO.scale.set(1.0, 1.0, 1)
    labelO.position.set(-0.5, -0.5, 0.5)
    axesGroup.add(labelO)

    // Vạch chia số trên các trục x, y, z
    const tickColor = isDark ? '#cbd5e1' : '#475569'
    ;[-6, -4, -2, 2, 4, 6].forEach((val) => {
      const tickX = createTickSprite(String(val), tickColor)
      tickX.position.set(val, -0.3, 0)
      axesGroup.add(tickX)

      const tickY = createTickSprite(String(val), tickColor)
      tickY.position.set(0, -0.3, -val)
      axesGroup.add(tickY)
    })
    ;[-4, -2, 2, 4, 6].forEach((val) => {
      const tickZ = createTickSprite(String(val), tickColor)
      tickZ.position.set(0.3, val, 0)
      axesGroup.add(tickZ)
    })

    // Group chứa các bề mặt 3D
    const meshGroup = new THREE.Group()
    scene.add(meshGroup)

    // Orbit state
    const orbit = {
      isDragging: false,
      prevX: 0,
      prevY: 0,
      yaw: 0.8,
      pitch: 0.5,
      distance: 18,
    }

    const updateCamera = () => {
      orbit.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, orbit.pitch))
      camera.position.x = orbit.distance * Math.cos(orbit.pitch) * Math.sin(orbit.yaw)
      camera.position.y = orbit.distance * Math.sin(orbit.pitch)
      camera.position.z = orbit.distance * Math.cos(orbit.pitch) * Math.cos(orbit.yaw)
      camera.lookAt(0, 0, 0)
    }
    updateCamera()

    // Animation Loop
    let reqId = 0
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      if (autoRotateRef.current && modeRef.current === '3d') {
        orbit.yaw += 0.005
        updateCamera()
      }
      if (modeRef.current === '3d') {
        renderer.render(scene, camera)
      }
    }
    animate()

    threeSceneRef.current = { renderer, scene, camera, meshGroup, grid, axesGroup, reqId, orbit }

    // Resize handler
    const handleResize3D = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    }
    window.addEventListener('resize', handleResize3D)

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('resize', handleResize3D)
      renderer.dispose()
      threeSceneRef.current = null
    }
  }, [theme])

  // Cập nhật các bề mặt 3D trong Scene
  useEffect(() => {
    if (!threeSceneRef.current) return
    const { meshGroup } = threeSceneRef.current

    // Dọn dẹp mesh cũ
    while (meshGroup.children.length > 0) {
      const obj: any = meshGroup.children[0]
      obj.geometry?.dispose()
      obj.material?.dispose()
      meshGroup.remove(obj)
    }

    // Dựng lại từng bề mặt z = f(x, y)
    equations3D.forEach((eq) => {
      if (!eq.visible || !eq.expr.trim()) return

      const compiledFn = compileExpression(eq.expr, true)
      if (!compiledFn) return

      const segs = 65
      const range = 6
      const geom = new THREE.PlaneGeometry(range * 2, range * 2, segs, segs)
      geom.rotateX(-Math.PI / 2)

      const pos = geom.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const baseColor = new THREE.Color(eq.color)

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) // Math x
        const z = -pos.getZ(i) // Math y
        const yVal = compiledFn(x, z) // Math z (độ cao z)

        const clampedY = isNaN(yVal) || !isFinite(yVal) ? 0 : Math.max(-6, Math.min(6, yVal))
        pos.setY(i, clampedY)

        const normH = (clampedY + 4) / 8
        const c = baseColor.clone().offsetHSL(0, 0, (normH - 0.5) * 0.4)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }

      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geom.computeVertexNormals()

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.15,
        side: THREE.DoubleSide,
        wireframe: wireframe3D,
      })

      const mesh = new THREE.Mesh(geom, mat)
      meshGroup.add(mesh)
    })

    if (threeSceneRef.current) {
      const { renderer, scene, camera } = threeSceneRef.current
      renderer.render(scene, camera)
    }
  }, [equations3D, wireframe3D])

  // Tương tác chuột 3D Orbit Controls
  const handleMouseDown3D = (e: React.MouseEvent) => {
    if (!threeSceneRef.current) return
    threeSceneRef.current.orbit.isDragging = true
    threeSceneRef.current.orbit.prevX = e.clientX
    threeSceneRef.current.orbit.prevY = e.clientY
  }

  const handleMouseMove3D = (e: React.MouseEvent) => {
    if (!threeSceneRef.current || !threeSceneRef.current.orbit.isDragging) return
    const { orbit, camera } = threeSceneRef.current
    const dx = e.clientX - orbit.prevX
    const dy = e.clientY - orbit.prevY
    orbit.prevX = e.clientX
    orbit.prevY = e.clientY

    orbit.yaw -= dx * 0.008
    orbit.pitch += dy * 0.008
    orbit.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, orbit.pitch))

    camera.position.x = orbit.distance * Math.cos(orbit.pitch) * Math.sin(orbit.yaw)
    camera.position.y = orbit.distance * Math.sin(orbit.pitch)
    camera.position.z = orbit.distance * Math.cos(orbit.pitch) * Math.cos(orbit.yaw)
    camera.lookAt(0, 0, 0)
  }

  const handleMouseUp3D = () => {
    if (threeSceneRef.current) threeSceneRef.current.orbit.isDragging = false
  }

  const handleWheel3D = (e: React.WheelEvent) => {
    if (!threeSceneRef.current) return
    const { orbit, camera } = threeSceneRef.current
    orbit.distance += e.deltaY * 0.015
    orbit.distance = Math.max(4, Math.min(50, orbit.distance))

    camera.position.x = orbit.distance * Math.cos(orbit.pitch) * Math.sin(orbit.yaw)
    camera.position.y = orbit.distance * Math.sin(orbit.pitch)
    camera.position.z = orbit.distance * Math.cos(orbit.pitch) * Math.cos(orbit.yaw)
    camera.lookAt(0, 0, 0)
  }

  const handleZoom3D = (direction: 'in' | 'out') => {
    if (!threeSceneRef.current) return
    const { orbit, camera } = threeSceneRef.current
    orbit.distance += direction === 'in' ? -2.5 : 2.5
    orbit.distance = Math.max(4, Math.min(50, orbit.distance))
    camera.position.x = orbit.distance * Math.cos(orbit.pitch) * Math.sin(orbit.yaw)
    camera.position.y = orbit.distance * Math.sin(orbit.pitch)
    camera.position.z = orbit.distance * Math.cos(orbit.pitch) * Math.cos(orbit.yaw)
    camera.lookAt(0, 0, 0)
  }

  const handleResetView3D = () => {
    if (!threeSceneRef.current) return
    const { orbit, camera } = threeSceneRef.current
    orbit.yaw = 0.8
    orbit.pitch = 0.5
    orbit.distance = 18
    camera.position.x = orbit.distance * Math.cos(orbit.pitch) * Math.sin(orbit.yaw)
    camera.position.y = orbit.distance * Math.sin(orbit.pitch)
    camera.position.z = orbit.distance * Math.cos(orbit.pitch) * Math.cos(orbit.yaw)
    camera.lookAt(0, 0, 0)
  }

  // ==============================================================
  // 6. QUẢN LÝ PHƯƠNG TRÌNH & BÀN PHÍM TOÁN HỌC ẢO
  // ==============================================================
  const handleAddEquation = (initialExpr?: string) => {
    const nextColor = EQUATION_COLORS[activeEquations.length % EQUATION_COLORS.length]
    const newId = `eq-${Date.now()}`
    const defaultExpr = initialExpr || (mode === '2d' ? 'y = ' : 'z = ')
    setActiveEquations([...activeEquations, { id: newId, expr: defaultExpr, color: nextColor, visible: true }])
    setActiveInputId(newId)
    setShowKeyboard(true)
  }

  const handleRemoveEquation = (id: string) => {
    if (activeEquations.length <= 1) return
    setActiveEquations(activeEquations.filter((eq) => eq.id !== id))
  }

  const handleToggleVisibility = (id: string) => {
    setActiveEquations(
      activeEquations.map((eq) => (eq.id === id ? { ...eq, visible: !eq.visible } : eq))
    )
  }

  const handleUpdateExpr = (id: string, expr: string) => {
    setActiveEquations(
      activeEquations.map((eq) => (eq.id === id ? { ...eq, expr } : eq))
    )
  }

  const handleApplyPreset = (presetExpr: string) => {
    if (activeEquations.length > 0) {
      handleUpdateExpr(activeInputId || activeEquations[0].id, presetExpr)
    } else {
      handleAddEquation(presetExpr)
    }
  }

  // Chèn ký tự vào vị trí con trỏ trong ô nhập
  const handleVirtualKey = (key: string) => {
    const eq = activeEquations.find((item) => item.id === activeInputId)
    if (!eq) return

    const inputEl = document.getElementById(`eq-input-${eq.id}`) as HTMLInputElement | null

    if (key === 'ARROW_LEFT') {
      if (inputEl) {
        const pos = Math.max(0, (inputEl.selectionStart || 0) - 1)
        inputEl.setSelectionRange(pos, pos)
        inputEl.focus()
      }
      return
    }

    if (key === 'ARROW_RIGHT') {
      if (inputEl) {
        const pos = Math.min(eq.expr.length, (inputEl.selectionEnd || 0) + 1)
        inputEl.setSelectionRange(pos, pos)
        inputEl.focus()
      }
      return
    }

    if (key === 'ENTER') {
      handleAddEquation()
      return
    }

    const start = inputEl ? inputEl.selectionStart || eq.expr.length : eq.expr.length
    const end = inputEl ? inputEl.selectionEnd || eq.expr.length : eq.expr.length

    let next = eq.expr
    let nextPos = start

    if (key === 'BACKSPACE') {
      if (start === end && start > 0) {
        next = next.slice(0, start - 1) + next.slice(start)
        nextPos = start - 1
      } else if (start !== end) {
        next = next.slice(0, start) + next.slice(end)
        nextPos = start
      }
    } else if (key === 'CLEAR') {
      next = mode === '2d' ? 'y = ' : 'z = '
      nextPos = next.length
    } else {
      let insertValue = key
      if (isShiftActive && key.length === 1 && key >= 'a' && key <= 'z') {
        insertValue = key.toUpperCase()
      }
      next = next.slice(0, start) + insertValue + next.slice(end)
      nextPos = start + insertValue.length
    }

    handleUpdateExpr(eq.id, next)

    setTimeout(() => {
      if (inputEl) {
        inputEl.setSelectionRange(nextPos, nextPos)
        inputEl.focus()
      }
    }, 10)
  }

  // ==============================================================
  // 7. TRỢ LÝ TOÁN HỌC SEN AI (GEMINI 3.5 FLASH LITE)
  // ==============================================================
  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAiAttachedImageMime(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      setAiAttachedImage(reader.result as string)
      setShowAiDrawer(true)
    }
    reader.readAsDataURL(file)
  }

  const handleSendAi = async (customPrompt?: string) => {
    const text = (customPrompt || aiInputText).trim()
    if (!text && activeEquations.length === 0 && !aiAttachedImage) return

    const userMsg =
      text ||
      (aiAttachedImage
        ? 'Phân tích chi tiết đề bài trong ảnh, giải hoàn chỉnh và xuất công thức vẽ hình trên SenGraph.'
        : 'Hãy phân tích chi tiết hình dạng và tính chất của đồ thị đang vẽ.')

    setAiMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: userMsg,
        imagePreview: aiAttachedImage || undefined,
      },
    ])

    const imageToSend = aiAttachedImage
    const mimeToSend = aiAttachedImageMime

    // Clear input state
    setAiInputText('')
    setAiAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsAiLoading(true)

    try {
      const res = await fetch('/api/sengraph/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          equations: activeEquations.filter((e) => e.visible).map((e) => e.expr),
          mode,
          imageBase64: imageToSend,
          imageMimeType: mimeToSend,
          renderType: aiRenderOption,
        }),
      })

      const data = await res.json()
      if (data.reply) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.reply,
            extractedEquations: data.extractedEquations || null,
          },
        ])
      } else {
        setAiMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.error || 'Chưa nhận được phản hồi từ Sen AI.' },
        ])
      }
    } catch (e: any) {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Lỗi kết nối tới Sen AI: ' + (e?.message || e) },
      ])
    } finally {
      setIsAiLoading(false)
    }
  }

  // Áp dụng các phương trình do AI đề xuất vào đồ thị SenGraph
  const handleApplyExtractedEquations = (
    extracted: {
      mode?: '2d' | '3d'
      title?: string
      equations?: string[]
    },
    replaceAll = true
  ) => {
    if (!extracted.equations || extracted.equations.length === 0) return

    const targetMode = extracted.mode === '3d' ? '3d' : '2d'
    if (mode !== targetMode) {
      setMode(targetMode)
    }

    const newItems: EquationItem[] = extracted.equations.map((expr, idx) => ({
      id: `eq-ai-${Date.now()}-${idx}`,
      expr,
      color: EQUATION_COLORS[idx % EQUATION_COLORS.length],
      visible: true,
    }))

    if (targetMode === '2d') {
      setEquations2D((prev) => (replaceAll ? newItems : [...prev, ...newItems]))
    } else {
      setEquations3D((prev) => (replaceAll ? newItems : [...prev, ...newItems]))
    }

    if (newItems.length > 0) {
      setActiveInputId(newItems[0].id)
    }
  }

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  const isDark = theme === 'dark'

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col font-sans select-none transition-colors duration-200 ${
        isDark ? 'bg-[#090d16] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* 🌟 1. THANH TIÊU ĐỀ SENGRAPH HEADER */}
      <header
        className={`h-14 px-4 flex items-center justify-between shrink-0 shadow-sm z-30 transition-colors duration-200 border-b ${
          isDark
            ? 'bg-[#0f172a]/90 backdrop-blur-xl border-slate-800 text-white'
            : 'bg-white/90 backdrop-blur-xl border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <Link href="/sengraph" className="flex items-center gap-2.5 group">
            <SenGraphLogo size={34} showText={true} />
          </Link>

          <div className={`hidden sm:block h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* CHUYỂN ĐỔI CHẾ ĐỘ 2D VS 3D */}
          <div
            className={`flex p-0.5 rounded-xl border transition-colors ${
              isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setMode('2d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                mode === '2d'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>2D Oxy</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('3d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                mode === '3d'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Oxyz</span>
            </button>
          </div>
        </div>

        {/* Thanh công cụ phải */}
        <div className="flex items-center gap-2">
          {/* Nút chuyển đổi Dark/Light Mode */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Nút Sen AI */}
          <button
            type="button"
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sen AI Toán Học</span>
          </button>

          {/* Đăng nhập SenExam */}
          {currentUser ? (
            <div className={`flex items-center gap-2 pl-2 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`text-xs font-bold hidden md:inline max-w-[120px] truncate ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {currentUser.name}
              </span>
            </div>
          ) : (
            <Link
              href="/login?redirect=/sengraph"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
              <span>Đăng Nhập</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🌟 2. KHU VỰC THAO TÁC CHÍNH (SIDEBAR TRÁI + KHÔNG GIAN ĐỒ HỌA PHẢI) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CỘT TRÁI: QUẢN LÝ PHƯƠNG TRÌNH */}
        <div
          className={`w-80 sm:w-[410px] flex flex-col shrink-0 shadow-sm z-20 border-r transition-colors duration-200 ${
            isDark ? 'bg-[#0f172a]/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
        >
          <div
            className={`p-3 border-b flex items-center justify-between ${
              isDark ? 'border-slate-800/80 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <span
              className={`text-xs font-black uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {mode === '2d' ? 'Hàm số 2D (y = f(x))' : 'Bề mặt 3D (z = f(x, y))'}
            </span>

            {/* Bộ Presets Mẫu */}
            <div className="relative group">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                  isDark
                    ? 'bg-sky-950/60 text-sky-400 hover:bg-sky-900/60 border border-sky-800/50'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100'
                }`}
              >
                <span>Mẫu đồ thị</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <div
                className={`absolute top-full right-0 mt-1 w-56 rounded-2xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-in fade-in border ${
                  isDark ? 'bg-[#0f172a] border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {(mode === '2d' ? PRESETS_2D : PRESETS_3D).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p.expr)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium block truncate transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-sky-50 text-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Danh sách các phương trình với Hiển Thị Ký Hiệu Toán Học KaTeX Chuẩn */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {activeEquations.map((eq, index) => {
              const isSelected = eq.id === activeInputId
              return (
                <div
                  key={eq.id}
                  onClick={() => {
                    setActiveInputId(eq.id)
                    setShowKeyboard(true)
                  }}
                  className={`p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? isDark
                        ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-950/50'
                        : 'bg-sky-50/70 border-sky-400 shadow-sm'
                      : isDark
                      ? 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Nút màu sắc & Ẩn/Hiện */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleVisibility(eq.id)
                      }}
                      title={eq.visible ? 'Ẩn phương trình' : 'Hiện phương trình'}
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer shadow-sm"
                      style={{
                        backgroundColor: eq.visible ? eq.color : isDark ? '#334155' : '#cbd5e1',
                        color: '#ffffff',
                      }}
                    >
                      {eq.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Số thứ tự */}
                    <span className="text-xs font-bold text-slate-400 w-3">{index + 1}</span>

                    {/* Hiển thị Ký Hiệu Toán Học Chuẩn Sách Giáo Khoa (KaTeX) */}
                    <div
                      className={`flex-1 overflow-x-auto py-1 px-2.5 rounded-xl border text-xs sm:text-sm font-serif transition ${
                        isDark ? 'bg-slate-900/90 border-slate-800 text-sky-300' : 'bg-slate-50 border-slate-200 text-sky-800'
                      }`}
                    >
                      <MathFormulaView expr={eq.expr} />
                    </div>

                    {/* Nút xóa */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveEquation(eq.id)
                      }}
                      disabled={activeEquations.length <= 1}
                      title="Xóa phương trình"
                      className={`p-1.5 rounded-lg transition disabled:opacity-30 cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Ô nhập liệu chỉnh sửa */}
                  <input
                    id={`eq-input-${eq.id}`}
                    type="text"
                    value={eq.expr}
                    onChange={(e) => handleUpdateExpr(eq.id, e.target.value)}
                    onFocus={() => {
                      setActiveInputId(eq.id)
                      setShowKeyboard(true)
                    }}
                    placeholder={mode === '2d' ? 'y = f(x)' : 'z = f(x, y)'}
                    className={`w-full font-mono text-xs px-2.5 py-1.5 rounded-xl border focus:outline-none transition ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-700/80 text-slate-200 focus:border-sky-400 placeholder-slate-500'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-sky-500 placeholder-slate-400'
                    }`}
                  />
                </div>
              )
            })}

            {/* Nút thêm phương trình */}
            <button
              type="button"
              onClick={() => handleAddEquation()}
              className={`w-full py-2.5 rounded-2xl border-2 border-dashed font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isDark
                  ? 'border-slate-700 hover:border-sky-500 hover:bg-slate-800/60 text-slate-300 hover:text-sky-400'
                  : 'border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-slate-600 hover:text-sky-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Phương Trình</span>
            </button>
          </div>

          {/* Footer thông số */}
          <div
            className={`p-3 border-t flex items-center justify-between text-[11px] ${
              isDark ? 'border-slate-800 bg-slate-900/70 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'
            }`}
          >
            <span>{activeEquations.length} phương trình</span>
            {mode === '2d' && mouseCoord2D && (
              <span className="font-mono font-bold text-sky-500">
                ({mouseCoord2D.x}, {mouseCoord2D.y})
              </span>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: KHÔNG GIAN ĐỒ HỌA (DUY TRÌ CẢ 2D VÀ 3D TRONG DOM ĐỂ KHÔNG BAO GIỜ BỊ CRASH) */}
        <div className="flex-1 h-full relative overflow-hidden flex flex-col">
          {/* A. VIEW 2D */}
          <div
            className={`flex-1 relative w-full h-full cursor-grab active:cursor-grabbing ${
              mode === '2d' ? 'block' : 'hidden'
            }`}
          >
            <canvas
              ref={canvas2dRef}
              onMouseDown={handleMouseDown2D}
              onMouseMove={handleMouseMove2D}
              onMouseUp={handleMouseUp2D}
              onMouseLeave={handleMouseUp2D}
              onWheel={handleWheel2D}
              className="w-full h-full block"
            />
          </div>

          {/* B. VIEW 3D */}
          <div
            className={`flex-1 relative w-full h-full cursor-grab active:cursor-grabbing ${
              mode === '3d' ? 'block' : 'hidden'
            }`}
            onMouseDown={handleMouseDown3D}
            onMouseMove={handleMouseMove3D}
            onMouseUp={handleMouseUp3D}
            onMouseLeave={handleMouseUp3D}
            onWheel={handleWheel3D}
          >
            <div ref={container3dRef} className="w-full h-full block" />

            {/* CHỈ BÁO HƯỚNG TỌA ĐỘ 3D (ORIENTATION COMPASS) */}
            <div
              className={`absolute bottom-5 right-5 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xl text-[11px] flex items-center gap-3 font-bold select-none ${
                isDark ? 'bg-slate-900/80 border-slate-700/80 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Trục x</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Trục y (Đáy)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span>Trục z (Đứng)</span>
              </div>
            </div>
          </div>

          {/* NÚT ĐIỀU KHIỂN PHÓNG TO / THU NHỎ / GỐC TỌA ĐỘ NỔI BẬT Ở GÓC PHẢI */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            {/* Cụm Phóng to & Thu nhỏ */}
            <div
              className={`flex flex-col rounded-2xl shadow-2xl border overflow-hidden backdrop-blur-xl ${
                isDark ? 'bg-slate-900/90 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => (mode === '2d' ? handleZoom2D('in') : handleZoom3D('in'))}
                title="Phóng to (+)"
                className={`p-3 transition cursor-pointer border-b flex items-center justify-center font-bold text-base ${
                  isDark ? 'hover:bg-slate-800 border-slate-700' : 'hover:bg-slate-100 border-slate-200'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => (mode === '2d' ? handleZoom2D('out') : handleZoom3D('out'))}
                title="Thu nhỏ (-)"
                className={`p-3 transition cursor-pointer border-b flex items-center justify-center font-bold text-base ${
                  isDark ? 'hover:bg-slate-800 border-slate-700' : 'hover:bg-slate-100 border-slate-200'
                }`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => (mode === '2d' ? handleResetView2D() : handleResetView3D())}
                title="Về gốc tọa độ (0, 0)"
                className={`p-3 transition cursor-pointer flex items-center justify-center ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* Điều khiển bổ sung trong 3D */}
            {mode === '3d' && (
              <div
                className={`flex flex-col gap-1.5 rounded-2xl shadow-2xl p-1.5 border backdrop-blur-xl ${
                  isDark ? 'bg-slate-900/90 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAutoRotate3D(!autoRotate3D)}
                  title="Bật/Tắt tự xoay không gian 3D"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    autoRotate3D
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {autoRotate3D ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{autoRotate3D ? 'Dừng Xoay' : 'Tự Xoay'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWireframe3D(!wireframe3D)}
                  title="Chuyển chế độ khung dây / mặt đặc"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    wireframe3D
                      ? 'bg-sky-500 text-white border-sky-400 shadow-md'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{wireframe3D ? 'Khung Dây' : 'Mặt Đặc'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 🌟 3. BÀN PHÍM ẢO TOÁN HỌC CAO CẤP VỚI KÝ HIỆU TOÁN HỌC CHUẨN */}
          <div className="absolute bottom-3 left-3 z-30">
            {!showKeyboard && (
              <button
                type="button"
                onClick={() => setShowKeyboard(true)}
                className={`px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-900/95 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-sky-500'
                    : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-sky-400'
                }`}
              >
                <KeyboardIcon className="w-4 h-4 text-sky-500" />
                <span>Mở Bàn Phím Toán Học</span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {showKeyboard && (
            <div
              className={`absolute bottom-0 left-0 right-0 p-2 sm:p-3 border-t shadow-2xl backdrop-blur-2xl z-30 transition-all duration-200 ${
                isDark ? 'bg-[#0f172a]/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200 text-slate-800'
              }`}
            >
              {/* Header thu gọn */}
              <div className="max-w-4xl mx-auto flex items-center justify-between pb-1.5 mb-1 border-b border-slate-200/40">
                <div className="flex items-center gap-2">
                  <KeyboardIcon className="w-4 h-4 text-sky-500" />
                  <span className="text-[11px] font-bold tracking-wide uppercase opacity-70">
                    Bàn Phím Toán Học {keyboardMode === 'abc' ? '(Chữ Cái QWERTY)' : '(Ký Hiệu Toán Học Chuẩn & Số)'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyboard(false)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span>Thu gọn</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Bố cục chính 3 khối */}
              <div className="max-w-4xl mx-auto relative flex flex-col md:flex-row gap-2 justify-center items-center">
                {/* POPOVER CHỨC NĂNG PHÂN LOẠI */}
                {showFunctionsMenu && (
                  <div
                    className={`absolute bottom-full right-4 sm:right-16 mb-2 w-80 sm:w-96 rounded-2xl shadow-2xl border p-3 z-50 animate-in fade-in slide-in-from-bottom-2 ${
                      isDark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 mb-2">
                      <span className="text-xs font-bold text-sky-500 uppercase tracking-wider">
                        Danh Mục Chức Năng Toán Học
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFunctionsMenu(false)}
                        className="p-1 rounded-lg hover:bg-slate-200/40 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tabs chức năng */}
                    <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-slate-200/30 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setFunctionsTab('theory')}
                        className={`px-2 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                          functionsTab === 'theory' ? 'bg-sky-600 text-white' : 'hover:bg-slate-200/50'
                        }`}
                      >
                        Lý Thuyết Số
                      </button>
                      <button
                        type="button"
                        onClick={() => setFunctionsTab('trig')}
                        className={`px-2 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                          functionsTab === 'trig' ? 'bg-sky-600 text-white' : 'hover:bg-slate-200/50'
                        }`}
                      >
                        Lượng Giác
                      </button>
                      <button
                        type="button"
                        onClick={() => setFunctionsTab('calc')}
                        className={`px-2 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                          functionsTab === 'calc' ? 'bg-sky-600 text-white' : 'hover:bg-slate-200/50'
                        }`}
                      >
                        Giải Tích (Tích Phân, Mũ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFunctionsTab('stat')}
                        className={`px-2 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                          functionsTab === 'stat' ? 'bg-sky-600 text-white' : 'hover:bg-slate-200/50'
                        }`}
                      >
                        Thống Kê
                      </button>
                    </div>

                    {/* Lưới các hàm theo tab */}
                    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                      {functionsTab === 'theory' && (
                        <>
                          {['lcm(', 'gcd(', 'mod(', 'ceil(', 'floor(', 'round(', 'sign(', 'nroot(', 'nPr', 'nCr'].map(
                            (fn) => (
                              <button
                                key={fn}
                                type="button"
                                onClick={() => {
                                  handleVirtualKey(fn)
                                  setShowFunctionsMenu(false)
                                }}
                                className={`h-8 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                                  isDark
                                    ? 'bg-slate-800 border-slate-700 hover:bg-sky-900/50 text-slate-200'
                                    : 'bg-slate-50 border-slate-200 hover:bg-sky-50 text-slate-800'
                                }`}
                              >
                                {fn}
                              </button>
                            )
                          )}
                        </>
                      )}

                      {functionsTab === 'trig' && (
                        <>
                          {[
                            'sin(', 'cos(', 'tan(', 'cot(',
                            'sec(', 'csc(', 'asin(', 'acos(', 'atan(',
                          ].map((fn) => (
                            <button
                              key={fn}
                              type="button"
                              onClick={() => {
                                handleVirtualKey(fn)
                                setShowFunctionsMenu(false)
                              }}
                              className={`h-8 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 hover:bg-sky-900/50 text-slate-200'
                                  : 'bg-slate-50 border-slate-200 hover:bg-sky-50 text-slate-800'
                              }`}
                            >
                              {fn}
                            </button>
                          ))}
                        </>
                      )}

                      {functionsTab === 'calc' && (
                        <>
                          {[
                            'int(', 'ln(', 'log(', 'exp(', 'abs(',
                            'sqrt(', 'cbrt(', 'max(', 'min(',
                          ].map((fn) => (
                            <button
                              key={fn}
                              type="button"
                              onClick={() => {
                                handleVirtualKey(fn)
                                setShowFunctionsMenu(false)
                              }}
                              className={`h-8 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 hover:bg-sky-900/50 text-slate-200'
                                  : 'bg-slate-50 border-slate-200 hover:bg-sky-50 text-slate-800'
                              }`}
                            >
                              {fn === 'int(' ? '∫ (Tích phân)' : fn}
                            </button>
                          ))}
                        </>
                      )}

                      {functionsTab === 'stat' && (
                        <>
                          {['mean(', 'median(', 'stdev(', 'var('].map((fn) => (
                            <button
                              key={fn}
                              type="button"
                              onClick={() => {
                                handleVirtualKey(fn)
                                setShowFunctionsMenu(false)
                              }}
                              className={`h-8 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 hover:bg-sky-900/50 text-slate-200'
                                  : 'bg-slate-50 border-slate-200 hover:bg-sky-50 text-slate-800'
                              }`}
                            >
                              {fn}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* NẾU ĐANG Ở CHẾ ĐỘ QWERTY CHỮ CÁI (ABC) */}
                {keyboardMode === 'abc' ? (
                  <div className="w-full max-w-2xl flex flex-col gap-1.5">
                    {/* Hàng 1 */}
                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleVirtualKey(letter)}
                          className={`flex-1 h-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-slate-100'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {isShiftActive ? letter.toUpperCase() : letter}
                        </button>
                      ))}
                    </div>

                    {/* Hàng 2 */}
                    <div className="flex justify-center gap-1 sm:gap-1.5 px-3">
                      {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleVirtualKey(letter)}
                          className={`flex-1 h-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-slate-100'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {isShiftActive ? letter.toUpperCase() : letter}
                        </button>
                      ))}
                    </div>

                    {/* Hàng 3 */}
                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsShiftActive(!isShiftActive)}
                        className={`w-12 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                          isShiftActive
                            ? 'bg-sky-600 border-sky-500 text-white'
                            : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-slate-200 border-slate-300 text-slate-700'
                        }`}
                      >
                        ⇧
                      </button>
                      {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleVirtualKey(letter)}
                          className={`flex-1 h-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-slate-100'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {isShiftActive ? letter.toUpperCase() : letter}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleVirtualKey('BACKSPACE')}
                        className={`w-12 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                          isDark
                            ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
                            : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        ⌫
                      </button>
                    </div>

                    {/* Hàng 4 */}
                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => setKeyboardMode('math')}
                        className="px-3.5 h-9 rounded-xl font-bold text-xs bg-sky-600 text-white hover:bg-sky-700 transition cursor-pointer shadow-sm"
                      >
                        123 Toán
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVirtualKey(' ')}
                        className={`flex-1 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition border cursor-pointer ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                            : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        Dấu Cách (Space)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVirtualKey(',')}
                        className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center border cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        ,
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVirtualKey('.')}
                        className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center border cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        .
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVirtualKey('ENTER')}
                        className="px-3 h-9 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                      >
                        ↵
                      </button>
                    </div>
                  </div>
                ) : (
                  /* BỐ CỤC TOÁN HỌC 3 KHỐI CHUẨN VỚI KÝ HIỆU TOÁN HỌC CHUẨN */
                  <div className="flex flex-wrap sm:flex-nowrap gap-2 justify-center items-stretch">
                    {/* KHỐI 1 (TRÁI): BIẾN SỐ, SỐ MŨ, TÍCH PHÂN, CĂN BẬC */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {/* Row 1: x, y, z, a^b */}
                      {['x', 'y', 'z', '^'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm font-serif transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/50 text-sky-400'
                              : 'bg-sky-50 border-sky-200 hover:bg-sky-100 text-sky-800'
                          }`}
                        >
                          {k === '^' ? 'aᵇ' : k}
                        </button>
                      ))}

                      {/* Row 2: ( ), <, > */}
                      {['(', ')', '<', '>'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {k}
                        </button>
                      ))}

                      {/* Row 3: |a|, ,, ≤, ≥ */}
                      {['abs(', ',', '<=', '>='].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {k === 'abs(' ? '|a|' : k === '<=' ? '≤' : k === '>=' ? '≥' : k}
                        </button>
                      ))}

                      {/* Row 4: ABC, √, π, e */}
                      <button
                        type="button"
                        onClick={() => setKeyboardMode('abc')}
                        className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-[10px] sm:text-xs transition active:scale-95 border cursor-pointer ${
                          isDark
                            ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300 hover:bg-indigo-900/60'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        ABC
                      </button>
                      {['sqrt(', 'pi', 'e'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {k === 'sqrt(' ? '√' : k === 'pi' ? 'π' : k}
                        </button>
                      ))}
                    </div>

                    {/* KHỐI 2 (GIỮA): NUMPAD 4x4 */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {['7', '8', '9', '/'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            k === '/'
                              ? isDark
                                ? 'bg-amber-950/40 border-amber-800/60 text-amber-400'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                              : isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-white'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          {k === '/' ? '÷' : k}
                        </button>
                      ))}

                      {['4', '5', '6', '*'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            k === '*'
                              ? isDark
                                ? 'bg-amber-950/40 border-amber-800/60 text-amber-400'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                              : isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-white'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          {k === '*' ? '×' : k}
                        </button>
                      ))}

                      {['1', '2', '3', '-'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            k === '-'
                              ? isDark
                                ? 'bg-amber-950/40 border-amber-800/60 text-amber-400'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                              : isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-white'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          {k}
                        </button>
                      ))}

                      {['0', '.', '=', '+'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleVirtualKey(k)}
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 border cursor-pointer ${
                            ['=', '+'].includes(k)
                              ? isDark
                                ? 'bg-amber-950/40 border-amber-800/60 text-amber-400'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                              : isDark
                              ? 'bg-slate-800/90 border-slate-700 hover:bg-slate-700 text-white'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>

                    {/* KHỐI 3 (PHẢI): CHỨC NĂNG, ĐIỀU HƯỚNG & ENTER */}
                    <div className="flex flex-col gap-1.5 w-24 sm:w-28">
                      {/* Nút Chức Năng Popover */}
                      <button
                        type="button"
                        onClick={() => setShowFunctionsMenu(!showFunctionsMenu)}
                        className={`h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 border cursor-pointer ${
                          showFunctionsMenu
                            ? 'bg-sky-600 border-sky-500 text-white shadow-md'
                            : isDark
                            ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-200 border-slate-300 hover:bg-slate-300 text-slate-800'
                        }`}
                      >
                        <span>chức năng</span>
                      </button>

                      {/* Mũi tên điều hướng con trỏ */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleVirtualKey('ARROW_LEFT')}
                          title="Di chuyển con trỏ sang trái"
                          className={`flex-1 h-9 rounded-xl font-bold text-sm flex items-center justify-center transition border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVirtualKey('ARROW_RIGHT')}
                          title="Di chuyển con trỏ sang phải"
                          className={`flex-1 h-9 rounded-xl font-bold text-sm flex items-center justify-center transition border cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          →
                        </button>
                      </div>

                      {/* Phím xóa & Phím Enter */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleVirtualKey('BACKSPACE')}
                          title="Xóa ký tự (Backspace)"
                          className={`w-10 sm:w-11 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition border cursor-pointer ${
                            isDark
                              ? 'bg-rose-950/60 border-rose-800/80 text-rose-300 hover:bg-rose-900/60'
                              : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          ⌫
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVirtualKey('ENTER')}
                          title="Thêm phương trình mới (Enter)"
                          className="flex-1 h-9 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center transition cursor-pointer shadow-sm"
                        >
                          ↵
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 🌟 4. SEN AI TOÁN HỌC DRAWER (GEMINI 3.5 FLASH LITE - DÁN ẢNH CTRL+V & GIẢI ĐỀ) */}
        {showAiDrawer && (
          <aside
            onPaste={handlePasteImage}
            aria-label="Trợ lý toán học Sen AI"
            className={`w-80 sm:w-[420px] flex flex-col shrink-0 shadow-2xl z-40 animate-in slide-in-from-right duration-200 border-l ${
              isDark ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header Sen AI */}
            <div
              className={`p-3.5 border-b flex items-center justify-between ${
                isDark
                  ? 'bg-slate-900/80 border-slate-800'
                  : 'bg-gradient-to-r from-sky-50 to-indigo-50 border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold">Sen AI Toán Học</h3>
                  <span className="text-[10px] text-sky-500 font-semibold">Gemini 3.5 Flash Lite • Dán ảnh & Giải đề</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chế độ vẽ ưu tiên (Option pills) */}
            <div
              className={`px-3 py-1.5 border-b flex items-center gap-1.5 text-[11px] ${
                isDark ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'
              }`}
            >
              <span className="font-bold shrink-0">Chế độ vẽ:</span>
              <button
                type="button"
                onClick={() => setAiRenderOption('auto')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  aiRenderOption === 'auto'
                    ? 'bg-sky-600 text-white'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Tự động
              </button>
              <button
                type="button"
                onClick={() => setAiRenderOption('curve')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  aiRenderOption === 'curve'
                    ? 'bg-sky-600 text-white'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Chỉ đường cong
              </button>
              <button
                type="button"
                onClick={() => setAiRenderOption('full')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  aiRenderOption === 'full'
                    ? 'bg-sky-600 text-white'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Vẽ cả hình
              </button>
            </div>

            {/* Quick Prompts gợi ý */}
            <div
              className={`p-2 border-b flex gap-1.5 overflow-x-auto ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSendAi('Phân tích chi tiết hình dạng và tính chất của đồ thị đang vẽ')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 hover:border-sky-500 text-slate-200'
                    : 'bg-white border-slate-200 hover:border-sky-400 text-slate-700'
                }`}
              >
                Phân tích đồ thị
              </button>
              <button
                type="button"
                onClick={() => handleSendAi('Tìm cực trị, điểm uốn và tiệm cận của hàm số')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 hover:border-sky-500 text-slate-200'
                    : 'bg-white border-slate-200 hover:border-sky-400 text-slate-700'
                }`}
              >
                Cực trị & tiệm cận
              </button>
              <button
                type="button"
                onClick={() => handleSendAi('Gợi ý phương trình vẽ hình toán học thú vị')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 hover:border-sky-500 text-slate-200'
                    : 'bg-white border-slate-200 hover:border-sky-400 text-slate-700'
                }`}
              >
                Gợi ý hình vẽ
              </button>
            </div>

            {/* Khung chat tin nhắn */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* Ảnh gửi kèm (nếu có) */}
                  {msg.imagePreview && (
                    <div className="mb-1.5 max-w-[200px] rounded-xl overflow-hidden border border-sky-400/40 shadow-md">
                      <img src={msg.imagePreview} alt="Đề bài tải lên" className="w-full h-auto object-cover" />
                    </div>
                  )}

                  {/* Bong bóng tin nhắn (Hỗ trợ Markdown & Ký hiệu Toán học KaTeX chuẩn) */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs leading-relaxed max-w-[95%] shadow-sm overflow-x-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1 [&_.katex-display]:my-1.5 [&_.katex]:text-inherit ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-none'
                        : isDark
                        ? 'bg-slate-800/95 text-slate-100 border border-slate-700/80 rounded-bl-none'
                        : 'bg-slate-50 text-slate-800 border border-slate-200/90 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                      components={{
                        p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                        h1: ({ node, ...props }: any) => <h1 className="text-sm font-bold my-2 text-sky-500" {...props} />,
                        h2: ({ node, ...props }: any) => <h2 className="text-xs font-bold my-1.5 text-sky-500" {...props} />,
                        h3: ({ node, ...props }: any) => (
                          <h3
                            className={`text-xs font-bold my-1.5 ${
                              msg.role === 'user' ? 'text-white' : isDark ? 'text-sky-400' : 'text-sky-600'
                            }`}
                            {...props}
                          />
                        ),
                        h4: ({ node, ...props }: any) => (
                          <h4
                            className={`text-xs font-semibold my-1 ${
                              msg.role === 'user' ? 'text-white' : isDark ? 'text-sky-300' : 'text-sky-700'
                            }`}
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }: any) => <ul className="list-disc pl-4 my-1.5 space-y-0.5" {...props} />,
                        ol: ({ node, ...props }: any) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5" {...props} />,
                        li: ({ node, ...props }: any) => <li className="my-0.5" {...props} />,
                        strong: ({ node, ...props }: any) => (
                          <strong
                            className={`font-bold ${
                              msg.role === 'user' ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'
                            }`}
                            {...props}
                          />
                        ),
                        hr: ({ node, ...props }: any) => (
                          <hr
                            className={`my-2 border-t ${
                              msg.role === 'user'
                                ? 'border-white/20'
                                : isDark
                                ? 'border-slate-700/60'
                                : 'border-slate-200'
                            }`}
                            {...props}
                          />
                        ),
                        code: ({ node, inline, ...props }: any) =>
                          inline ? (
                            <code
                              className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                                msg.role === 'user'
                                  ? 'bg-black/20 text-white'
                                  : isDark
                                  ? 'bg-slate-900 text-sky-300'
                                  : 'bg-slate-200 text-sky-800'
                              }`}
                              {...props}
                            />
                          ) : (
                            <div
                              className={`p-2 rounded-lg my-1.5 font-mono text-[11px] overflow-x-auto ${
                                msg.role === 'user'
                                  ? 'bg-black/30 text-white border border-white/20'
                                  : isDark
                                  ? 'bg-slate-950 text-slate-200 border border-slate-800'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}
                            >
                              <code {...props} />
                            </div>
                          ),
                        table: ({ node, ...props }: any) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full text-[11px] border-collapse" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }: any) => (
                          <th
                            className={`border px-2 py-1 font-bold text-left ${
                              isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'
                            }`}
                            {...props}
                          />
                        ),
                        td: ({ node, ...props }: any) => (
                          <td
                            className={`border px-2 py-1 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                            {...props}
                          />
                        ),
                        blockquote: ({ node, ...props }: any) => (
                          <blockquote
                            className={`border-l-2 pl-2.5 my-1.5 italic ${
                              msg.role === 'user'
                                ? 'border-white/50 text-white/90'
                                : isDark
                                ? 'border-sky-500 text-slate-300'
                                : 'border-sky-600 text-slate-600'
                            }`}
                            {...props}
                          />
                        ),
                      }}
                    >
                      {preprocessMathForMarkdown(msg.text)}
                    </ReactMarkdown>
                  </div>

                  {/* THẺ HÀNH ĐỘNG: ĐỀ XUẤT ĐỒ THỊ TỰ ĐỘNG TỪ BÀI GIẢI */}
                  {msg.extractedEquations && msg.extractedEquations.equations && (
                    <div
                      className={`mt-2 p-3 rounded-2xl border w-full max-w-[95%] shadow-lg ${
                        isDark
                          ? 'bg-sky-950/40 border-sky-800 text-slate-100'
                          : 'bg-sky-50/80 border-sky-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-sky-500 font-bold text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span>Đề xuất Đồ Thị từ Bài Giải</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase font-black">
                          {msg.extractedEquations.mode || '2D'}
                        </span>
                      </div>

                      {msg.extractedEquations.title && (
                        <p className="text-xs font-semibold mb-1 opacity-90">{msg.extractedEquations.title}</p>
                      )}

                      {/* Danh sách các phương trình tìm được */}
                      <div className="space-y-1 my-2">
                        {msg.extractedEquations.equations.map((eqStr, i) => (
                          <div
                            key={i}
                            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                              isDark ? 'bg-slate-900/80 text-sky-300' : 'bg-white text-sky-700 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-x-auto">
                              <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                              <MathFormulaView expr={eqStr} className="text-xs font-medium" />
                            </div>
                            <span className="text-[10px] opacity-60 font-mono shrink-0">{eqStr}</span>
                          </div>
                        ))}
                      </div>

                      {/* Nút Áp Dụng Ngay */}
                      <div className="flex gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleApplyExtractedEquations(msg.extractedEquations!, true)}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Áp dụng vào đồ thị ngay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyExtractedEquations(msg.extractedEquations!, false)}
                          title="Thêm vào danh sách hiện tại không ghi đè"
                          className={`py-1.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer border ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isAiLoading && (
                <div className="flex items-center gap-2 text-xs text-sky-500 font-bold p-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sen AI (3.5 Flash Lite) đang phân tích toán học...</span>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            {/* PREVIEW ẢNH ĐÍNH KÈM TRƯỚC KHI GỬI */}
            {aiAttachedImage && (
              <div
                className={`p-2 border-t flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={aiAttachedImage}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded-lg border border-sky-400"
                  />
                  <div className="text-[11px]">
                    <span className="font-bold text-sky-500">Đã dán/đính kèm ảnh đề bài</span>
                    <p className="text-[10px] text-slate-400">Sẵn sàng gửi cho Sen AI phân tích</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAiAttachedImage(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Ô nhập câu hỏi và nút gửi ảnh cho AI */}
            <div
              className={`p-2.5 border-t flex items-center gap-1.5 ${
                isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Input file ẩn */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt"
                onChange={handleSelectImage}
                className="hidden"
              />

              {/* Nút chọn ảnh / file */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Tải lên ảnh chụp đề bài hoặc bấm Ctrl+V để dán ảnh trực tiếp"
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-sky-400'
                    : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-sky-600'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={aiInputText}
                onPaste={handlePasteImage}
                onChange={(e) => setAiInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendAi()
                }}
                placeholder="Hỏi Sen AI hoặc dán ảnh (Ctrl+V)..."
                className={`flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none transition ${
                  isDark
                    ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-sky-500'
                    : 'bg-slate-100 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500'
                }`}
              />
              <button
                type="button"
                onClick={() => handleSendAi()}
                disabled={isAiLoading || (!aiInputText.trim() && !aiAttachedImage)}
                className="p-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white transition disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
