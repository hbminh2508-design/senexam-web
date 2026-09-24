'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Plus,
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
  Keyboard,
  Send,
  Loader2,
  ShieldCheck,
  ArrowRight,
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
} from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'
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
// 1. BỘ PHÂN TÍCH TOÁN HỌC AN TOÀN (SAFE MATH COMPILER)
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

  // Chuẩn hóa ký hiệu lũy thừa ^ thành **
  clean = clean.replace(/\^/g, '**')

  // Chuẩn hóa các phép nhân ẩn: 2x -> 2*x, 3sin -> 3*sin, x( -> x*(, )( -> )*(
  clean = clean.replace(/(\d)([a-zA-Z(])/g, '$1*$2')
  clean = clean.replace(/(\))([a-zA-Z0-9(])/g, '$1*$2')
  if (is3D) {
    clean = clean.replace(/([xy])([xy])/gi, '$1*$2')
  }

  // Danh sách hàm toán học hỗ trợ
  const mathScope = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
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
    pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    E: Math.E,
  }

  try {
    // Tạo hàm tính toán với biến x (và y nếu là 3D)
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
  } catch (err) {
    return null
  }
}

export default function SenGraphPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mode, setMode] = useState<'2d' | '3d'>('2d')

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
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [keyboardTab, setKeyboardTab] = useState<'num' | 'func' | 'sym'>('num')

  // 3D Visual Preferences
  const [wireframe3D, setWireframe3D] = useState(false)
  const [autoRotate3D, setAutoRotate3D] = useState(false)

  // 🤖 Sen AI Drawer State
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Xin chào! Tôi là **Sen AI** — Trợ lý Toán học của **SenGraph**. Tôi có thể giúp bạn giải thích đồ thị, tìm cực trị, tiệm cận, hoặc gợi ý phương trình vẽ hình 2D/3D đẹp mắt!',
    },
  ])
  const [aiInputText, setAiInputText] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const aiChatEndRef = useRef<HTMLDivElement>(null)

  // DOM Refs
  const canvas2dRef = useRef<HTMLCanvasElement>(null)
  const container3dRef = useRef<HTMLDivElement>(null)
  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    meshGroup: THREE.Group
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

  // 1. Kiểm tra trạng thái đăng nhập SenExam
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
  // 2. CANVAS ENGINE 2D
  // ==============================================================
  const draw2D = useCallback(() => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { originX, originY, scale } = view2DRef.current
    const w = canvas.width
    const h = canvas.height

    // Xóa khung vẽ
    ctx.clearRect(0, 0, w, h)

    // A. Vẽ nền và Lưới tọa độ
    ctx.fillStyle = '#fafcff'
    ctx.fillRect(0, 0, w, h)

    // Xác định bước nhảy lưới (tự thích ứng khi phóng to/thu nhỏ)
    let unitStep = 1
    if (scale < 20) unitStep = 5
    else if (scale < 35) unitStep = 2
    else if (scale > 90) unitStep = 0.5
    else if (scale > 180) unitStep = 0.2

    const gridPixelStep = scale * unitStep

    // Lưới phụ
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    const subStep = gridPixelStep / 5
    const startXSub = (originX % subStep)
    for (let x = startXSub; x < w; x += subStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const startYSub = (originY % subStep)
    for (let y = startYSub; y < h; y += subStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Lưới chính
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    const startX = (originX % gridPixelStep)
    for (let x = startX; x < w; x += gridPixelStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const startY = (originY % gridPixelStep)
    for (let y = startY; y < h; y += gridPixelStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // B. Trục tọa độ Ox và Oy
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2

    // Trục Oy (x = 0)
    ctx.beginPath()
    ctx.moveTo(originX, 0)
    ctx.lineTo(originX, h)
    ctx.stroke()

    // Trục Ox (y = 0)
    ctx.beginPath()
    ctx.moveTo(0, originY)
    ctx.lineTo(w, originY)
    ctx.stroke()

    // C. Đánh số tọa độ
    ctx.fillStyle = '#64748b'
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
    ctx.fillText('0', originX - 6, originY + 6)

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

        // Tránh giật khi qua tiệm cận đứng cực lớn
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
  }, [equations2D])

  // Resize canvas 2D
  useEffect(() => {
    if (mode !== '2d') return
    const canvas = canvas2dRef.current
    if (!canvas) return

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      if (view2DRef.current.originX === 0) {
        view2DRef.current.originX = rect.width / 2
        view2DRef.current.originY = rect.height / 2
      }
      draw2D()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

    const { originX, originY, scale } = view2DRef.current
    const newScale = Math.min(Math.max(scale * zoomFactor, 8), 600)

    // Zoom hướng vào con trỏ chuột
    view2DRef.current.originX = mouseX - ((mouseX - originX) / scale) * newScale
    view2DRef.current.originY = mouseY - ((mouseY - originY) / scale) * newScale
    view2DRef.current.scale = newScale

    draw2D()
  }

  const resetView2D = () => {
    const canvas = canvas2dRef.current
    if (!canvas) return
    view2DRef.current.originX = canvas.width / 2
    view2DRef.current.originY = canvas.height / 2
    view2DRef.current.scale = 45
    draw2D()
  }

  // ==============================================================
  // 3. THREE.JS ENGINE 3D
  // ==============================================================
  useEffect(() => {
    if (mode !== '3d') return
    const container = container3dRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0c1322')

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(10, 20, 15)
    scene.add(dirLight1)
    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4)
    dirLight2.position.set(-10, -10, -15)
    scene.add(dirLight2)

    // 3D Coordinate Grid & Axes
    const grid = new THREE.GridHelper(16, 16, 0x38bdf8, 0x1e293b)
    grid.position.y = 0
    scene.add(grid)

    const axesHelper = new THREE.AxesHelper(8)
    scene.add(axesHelper)

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
      if (autoRotate3D) {
        orbit.yaw += 0.005
        updateCamera()
      }
      renderer.render(scene, camera)
    }
    animate()

    threeSceneRef.current = { renderer, scene, camera, meshGroup, reqId, orbit }

    // Resize handler
    const handleResize3D = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize3D)

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('resize', handleResize3D)
      renderer.dispose()
      if (container) container.innerHTML = ''
    }
  }, [mode, autoRotate3D])

  // Cập nhật các bề mặt 3D trong Scene
  useEffect(() => {
    if (mode !== '3d' || !threeSceneRef.current) return
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
      const range = 6 // x, y trong khoảng [-6, 6]
      const geom = new THREE.PlaneGeometry(range * 2, range * 2, segs, segs)

      // Xoay mặt phẳng để z là trục cao
      geom.rotateX(-Math.PI / 2)

      const pos = geom.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const baseColor = new THREE.Color(eq.color)

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = -pos.getZ(i) // chuyển đổi trục tọa độ
        const yVal = compiledFn(x, z)

        const clampedY = isNaN(yVal) || !isFinite(yVal) ? 0 : Math.max(-6, Math.min(6, yVal))
        pos.setY(i, clampedY)

        // Tính màu sắc theo độ cao (height gradient)
        const normH = (clampedY + 4) / 8 // 0 .. 1
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
  }, [mode, equations3D, wireframe3D])

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

  // ==============================================================
  // 4. QUẢN LÝ PHƯƠNG TRÌNH & BÀN PHÍM TOÁN HỌC ẢO
  // ==============================================================
  const handleAddEquation = () => {
    const nextColor = EQUATION_COLORS[activeEquations.length % EQUATION_COLORS.length]
    const newId = `eq-${Date.now()}`
    const defaultExpr = mode === '2d' ? 'y = ' : 'z = '
    setActiveEquations([...activeEquations, { id: newId, expr: defaultExpr, color: nextColor, visible: true }])
    setActiveInputId(newId)
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
      handleAddEquation()
    }
  }

  // Chèn ký tự từ bàn phím toán học ảo vào ô nhập đang chọn
  const handleVirtualKey = (key: string) => {
    const eq = activeEquations.find((item) => item.id === activeInputId)
    if (!eq) return

    let next = eq.expr
    if (key === 'BACKSPACE') {
      next = next.slice(0, -1)
    } else if (key === 'CLEAR') {
      next = mode === '2d' ? 'y = ' : 'z = '
    } else {
      next += key
    }
    handleUpdateExpr(eq.id, next)
  }

  // ==============================================================
  // 5. TRỢ LÝ TOÁN HỌC SEN AI (GEMINI 3.8 FLASH)
  // ==============================================================
  const handleSendAi = async (customPrompt?: string) => {
    const text = (customPrompt || aiInputText).trim()
    if (!text && activeEquations.length === 0) return

    const userMsg = text || 'Hãy phân tích chi tiết hình dạng và tính chất của đồ thị đang vẽ.'
    setAiMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setAiInputText('')
    setIsAiLoading(true)

    try {
      const res = await fetch('/api/sengraph/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          equations: activeEquations.filter((e) => e.visible).map((e) => e.expr),
          mode,
        }),
      })

      const data = await res.json()
      if (data.reply) {
        setAiMessages((prev) => [...prev, { role: 'assistant', text: data.reply }])
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

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 flex flex-col font-sans select-none text-slate-800">
      {/* 🌟 1. THANH TIÊU ĐỀ SENGRAPH HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <Link href="/sengraph" className="flex items-center gap-2.5 group">
            <SenGraphLogo size={36} showText={true} />
          </Link>

          <div className="hidden sm:block h-5 w-px bg-slate-200" />

          {/* CHUYỂN ĐỔI CHẾ ĐỘ 2D VS 3D */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMode('2d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                mode === '2d'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
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
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-800 hidden md:inline max-w-[120px] truncate">
                {currentUser.name}
              </span>
            </div>
          ) : (
            <Link
              href="/login?redirect=/sengraph"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>Đăng Nhập</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🌟 2. KHU VỰC THAO TÁC CHÍNH (SIDEBAR TRÁI + KHÔNG GIAN ĐỒ HỌA PHẢI) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CỘT TRÁI: QUẢN LÝ PHƯƠNG TRÌNH */}
        <div className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-20">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {mode === '2d' ? 'Hàm số 2D (y = f(x))' : 'Bề mặt 3D (z = f(x, y))'}
            </span>

            {/* Bộ Presets Mẫu */}
            <div className="relative group">
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-bold flex items-center gap-1 transition"
              >
                <span>Mẫu đồ thị</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 hidden group-hover:block z-50 animate-in fade-in">
                {(mode === '2d' ? PRESETS_2D : PRESETS_3D).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p.expr)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-sky-50 text-xs text-slate-700 font-medium block truncate transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Danh sách các phương trình */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {activeEquations.map((eq, index) => {
              const isSelected = eq.id === activeInputId
              return (
                <div
                  key={eq.id}
                  onClick={() => setActiveInputId(eq.id)}
                  className={`p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-sky-50/50 border-sky-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Nút màu sắc & Ẩn/Hiện */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleVisibility(eq.id)
                      }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer shadow-sm"
                      style={{ backgroundColor: eq.visible ? eq.color : '#cbd5e1' }}
                      title={eq.visible ? 'Bấm để ẩn đồ thị' : 'Bấm để hiện đồ thị'}
                    >
                      {eq.visible ? (
                        <span className="text-[10px] text-white font-bold">{index + 1}</span>
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>

                    {/* Ô nhập phương trình */}
                    <input
                      type="text"
                      value={eq.expr}
                      onChange={(e) => handleUpdateExpr(eq.id, e.target.value)}
                      placeholder={mode === '2d' ? 'VD: y = x^2 - 4' : 'VD: z = sin(x)*cos(y)'}
                      className="flex-1 font-mono text-xs text-slate-900 bg-transparent focus:outline-none"
                    />

                    {/* Nút xóa */}
                    {activeEquations.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveEquation(eq.id)
                        }}
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Nút Thêm Phương Trình Mới */}
            <button
              type="button"
              onClick={handleAddEquation}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-sky-200 hover:border-sky-400 text-sky-600 hover:bg-sky-50/50 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm phương trình ({mode.toUpperCase()})</span>
            </button>
          </div>

          {/* Tùy chọn 3D riêng biệt */}
          {mode === '3d' && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wireframe3D}
                  onChange={(e) => setWireframe3D(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Khung dây (Wireframe)</span>
              </label>

              <button
                type="button"
                onClick={() => setAutoRotate3D(!autoRotate3D)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                  autoRotate3D ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {autoRotate3D ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>Tự xoay 360°</span>
              </button>
            </div>
          )}

          {/* Nút Bật/Tắt Bàn Phím Ảo */}
          <div className="p-2 border-t border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowKeyboard(!showKeyboard)}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                showKeyboard
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>{showKeyboard ? 'Thu gọn bàn phím ảo' : 'Mở bàn phím toán học ảo'}</span>
            </button>
          </div>
        </div>

        {/* KHÔNG GIAN ĐỒ HỌA PHẢI (2D HOẶC 3D) */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-900">
          {mode === '2d' ? (
            /* 2D CANVAS CONTAINER */
            <div className="flex-1 relative cursor-crosshair">
              <canvas
                ref={canvas2dRef}
                onMouseDown={handleMouseDown2D}
                onMouseMove={handleMouseMove2D}
                onMouseUp={handleMouseUp2D}
                onWheel={handleWheel2D}
                className="w-full h-full block"
              />

              {/* Tọa độ con trỏ 2D */}
              {mouseCoord2D && (
                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-xl shadow border border-slate-200 text-xs font-mono font-bold text-slate-700 pointer-events-none">
                  X: {mouseCoord2D.x}, Y: {mouseCoord2D.y}
                </div>
              )}

              {/* Điều khiển Zoom 2D */}
              <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    view2DRef.current.scale = Math.min(view2DRef.current.scale * 1.25, 600)
                    draw2D()
                  }}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-700"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    view2DRef.current.scale = Math.max(view2DRef.current.scale * 0.8, 8)
                    draw2D()
                  }}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-700"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={resetView2D}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-700"
                  title="Về gốc tọa độ (0, 0)"
                >
                  <Home className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* 3D WEBGL CONTAINER */
            <div
              ref={container3dRef}
              onMouseDown={handleMouseDown3D}
              onMouseMove={handleMouseMove3D}
              onMouseUp={handleMouseUp3D}
              onWheel={handleWheel3D}
              className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing"
            >
              {/* Chỉ dẫn trục 3D */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] font-bold text-slate-300 pointer-events-none space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Trục X
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2" /> Trục Y
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ml-2" /> Trục Z
                </div>
                <div className="text-[10px] text-slate-400">Kéo chuột trái để xoay 360°, cuộn để phóng to/thu nhỏ</div>
              </div>
            </div>
          )}

          {/* 🌟 3. BÀN PHÍM TOÁN HỌC ẢO (VIRTUAL MATH KEYBOARD) */}
          {showKeyboard && (
            <div className="bg-white border-t border-slate-200 shadow-2xl p-2.5 sm:p-3 shrink-0 z-30 animate-in slide-in-from-bottom duration-200">
              {/* Header bàn phím & Chuyển Tab */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setKeyboardTab('num')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      keyboardTab === 'num' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Số & Biến
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyboardTab('func')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      keyboardTab === 'func' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Lượng Giác & Hàm
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyboardTab('sym')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      keyboardTab === 'sym' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Ký Hiệu
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowKeyboard(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lưới các phím bấm */}
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-w-2xl mx-auto">
                {keyboardTab === 'num' && (
                  <>
                    {['x', 'y', 'z', '(', ')', '^', '+', '7', '8', '9', '-', '*', '4', '5', '6', '/', '1', '2', '3', '=', '0', '.', 'sqrt(', 'BACKSPACE'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleVirtualKey(k)}
                        className={`h-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer ${
                          k === 'BACKSPACE'
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            : ['x', 'y', 'z'].includes(k)
                            ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 font-serif'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        {k === 'BACKSPACE' ? '⌫' : k === 'sqrt(' ? '√' : k}
                      </button>
                    ))}
                  </>
                )}

                {keyboardTab === 'func' && (
                  <>
                    {[
                      'sin(', 'cos(', 'tan(', 'cot(',
                      'asin(', 'acos(', 'atan(', 'abs(',
                      'ln(', 'log(', 'exp(', 'max(',
                      'min(', 'pi', 'e', 'BACKSPACE',
                    ].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleVirtualKey(k)}
                        className="h-9 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-800 hover:text-sky-700 font-bold text-xs flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        {k === 'BACKSPACE' ? '⌫' : k === 'pi' ? 'π' : k}
                      </button>
                    ))}
                  </>
                )}

                {keyboardTab === 'sym' && (
                  <>
                    {['<', '>', '<=', '>=', '!=', 'pi', 'e', 'CLEAR', '(', ')', '[', ']', '{', '}', 'BACKSPACE'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleVirtualKey(k)}
                        className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        {k === 'BACKSPACE' ? '⌫' : k === 'CLEAR' ? 'AC' : k}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 🌟 4. SEN AI TOÁN HỌC DRAWER (RIGHT PANEL) */}
        {showAiDrawer && (
          <aside aria-label="Trợ lý toán học Sen AI" className="w-80 sm:w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-2xl z-40 animate-in slide-in-from-right duration-200">
            {/* Header Sen AI */}
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Sen AI Toán Học</h3>
                  <span className="text-[10px] text-sky-600 font-semibold">Gemini 3.8 Flash</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Prompts gợi ý */}
            <div className="p-2 border-b border-slate-100 bg-slate-50 flex gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => handleSendAi('Phân tích chi tiết hình dạng và tính chất của đồ thị đang vẽ')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-400 text-[11px] font-semibold text-slate-700 shrink-0 transition"
              >
                Phân tích hình dạng
              </button>
              <button
                type="button"
                onClick={() => handleSendAi('Tìm cực trị, điểm uốn và tiệm cận của hàm số')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-400 text-[11px] font-semibold text-slate-700 shrink-0 transition"
              >
                Tìm cực trị & tiệm cận
              </button>
              <button
                type="button"
                onClick={() => handleSendAi('Gợi ý phương trình vẽ hình toán học thú vị')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-400 text-[11px] font-semibold text-slate-700 shrink-0 transition"
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
                  <div
                    className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[90%] shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex items-center gap-2 text-xs text-sky-600 font-bold p-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sen AI đang suy luận toán học...</span>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            {/* Ô nhập câu hỏi cho AI */}
            <div className="p-2.5 border-t border-slate-200 flex gap-1.5 bg-white">
              <input
                type="text"
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendAi()
                }}
                placeholder="Hỏi Sen AI về đồ thị hoặc bài toán..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => handleSendAi()}
                disabled={isAiLoading}
                className="p-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white transition disabled:opacity-50"
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
