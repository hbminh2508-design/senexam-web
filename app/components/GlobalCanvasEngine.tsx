'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface ParticleNode {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseAlpha: number
  colorIdx: number
}

/**
 * ==============================================================================
 * SEN CANVAS ENGINE (UNIVERSAL LIGHTWEIGHT 2D GRAPHICS CORE)
 * Thay thế hoàn toàn kiến trúc DOM gradient blobs cồng kềnh trên toàn bộ 91 trang.
 * Tự động đồng bộ màu theo route (Auth, Dashboard, Exams, Home, SEB).
 * Tự động ngắt requestAnimationFrame khi ẩn tab, tiết kiệm 100% RAM & pin thiết bị.
 * ==============================================================================
 */
export default function GlobalCanvasEngine() {
  const pathname = usePathname() || '/'
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Theo dõi chế độ Sáng / Tối từ document.documentElement
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()

    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animId: number
    let isTabVisible = !document.hidden

    let dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    let width = (canvas.width = window.innerWidth * dpr)
    let height = (canvas.height = window.innerHeight * dpr)

    const handleResize = () => {
      if (!canvas) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.width = window.innerWidth * dpr
      height = canvas.height = window.innerHeight * dpr
    }
    window.addEventListener('resize', handleResize, { passive: true })

    // Tách biệt hoàn toàn FEPN (không render canvas SenExam trên phân hệ FEPN)
    const isFepn = Boolean(
      pathname.startsWith('/fepn-') ||
      pathname.startsWith('/tsv-fepn') ||
      (typeof window !== 'undefined' &&
        (window.location.hostname.includes('fepn.') || window.location.hostname.includes('tsv.fepn.')))
    )

    if (isFepn) {
      ctx.clearRect(0, 0, width, height)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    // Xác định bộ màu theo tuyến đường (Route-Aware Palette)
    const isAuth = pathname.includes('idp') || pathname.includes('login') || pathname.includes('sign') || pathname.includes('reset')
    const isExam = pathname.includes('exam') || pathname.includes('setup') || pathname.includes('seb')
    const isHome = pathname === '/' || pathname === '/home'

    // Bảng màu thích ứng
    let colorPaletteDark: string[]
    let colorPaletteLight: string[]

    if (isAuth) {
      colorPaletteDark = ['rgba(99, 102, 241,', 'rgba(168, 85, 247,', 'rgba(251, 191, 36,']
      colorPaletteLight = ['rgba(79, 70, 229,', 'rgba(124, 58, 237,', 'rgba(217, 119, 6,']
    } else if (isExam) {
      colorPaletteDark = ['rgba(16, 185, 129,', 'rgba(56, 189, 248,', 'rgba(99, 102, 241,']
      colorPaletteLight = ['rgba(5, 150, 105,', 'rgba(2, 132, 199,', 'rgba(79, 70, 229,']
    } else {
      colorPaletteDark = ['rgba(56, 189, 248,', 'rgba(99, 102, 241,', 'rgba(244, 63, 94,', 'rgba(251, 191, 36,']
      colorPaletteLight = ['rgba(2, 132, 199,', 'rgba(79, 70, 229,', 'rgba(225, 29, 72,', 'rgba(217, 119, 6,']
    }

    // Khởi tạo các hạt nút mạng (30 - 45 hạt tối ưu)
    const particleCount = Math.min(42, Math.max(20, Math.floor((window.innerWidth * window.innerHeight) / 28000)))
    const particles: ParticleNode[] = []

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        radius: (Math.random() * 1.8 + 1.2) * dpr,
        baseAlpha: Math.random() * 0.28 + 0.12,
        colorIdx: Math.floor(Math.random() * colorPaletteDark.length),
      })
    }

    let lastTime = performance.now()

    const render = (nowTime: number) => {
      if (!isTabVisible) return

      const dt = Math.min((nowTime - lastTime) / 1000, 0.1)
      lastTime = nowTime

      ctx.clearRect(0, 0, width, height)

      const colors = isDark ? colorPaletteDark : colorPaletteLight
      const maxDist = 130 * dpr

      // 1. Vẽ các sợi dây liên kết giữa các nốt
      ctx.lineWidth = 0.7 * dpr
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isDark ? 0.14 : 0.08)
            ctx.strokeStyle = `${colors[p1.colorIdx]} ${alpha})`
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }

      // 2. Cập nhật vị trí hạt và vẽ
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60

        // Phản xạ biên mềm mại
        if (p.x < 0) {
          p.x = 0
          p.vx *= -1
        } else if (p.x > width) {
          p.x = width
          p.vx *= -1
        }
        if (p.y < 0) {
          p.y = 0
          p.vy *= -1
        } else if (p.y > height) {
          p.y = height
          p.vy *= -1
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `${colors[p.colorIdx]} ${p.baseAlpha})`
        ctx.fill()
      }

      animId = requestAnimationFrame(render)
    }

    const handleVisibility = () => {
      isTabVisible = !document.hidden
      if (isTabVisible) {
        lastTime = performance.now()
        render(lastTime)
      } else {
        cancelAnimationFrame(animId)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pathname, isDark])

  const isFepn = Boolean(
    pathname.startsWith('/fepn-') ||
    pathname.startsWith('/tsv-fepn')
  )

  if (isFepn) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 w-full h-full z-0 transition-opacity duration-1000"
      style={{ opacity: isDark ? 0.85 : 0.65 }}
      aria-hidden="true"
    />
  )
}
