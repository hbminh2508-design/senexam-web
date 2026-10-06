'use client'

import React, { useEffect, useRef } from 'react'

interface SenExamCanvasProps {
  isDark?: boolean
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseAlpha: number
  colorIndex: number
}

/**
 * SenExamCanvas - Lớp hiển thị Canvas 2D siêu nhẹ thay thế toàn bộ kiến trúc DOM Blobs nặng nề.
 * Tự động dừng requestAnimationFrame khi ẩn tab hoặc ra khỏi màn hình để bảo vệ 100% pin và RAM.
 */
export default function SenExamCanvas({ isDark = false, className = '' }: SenExamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth)
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight)
    let isVisible = true

    // Thiết lập số lượng hạt vừa phải (35-50 hạt) để tải siêu nhẹ trên mọi thiết bị
    const count = Math.min(45, Math.floor((width * height) / 22000))
    const particles: Particle[] = []

    const darkColors = ['rgba(99, 102, 241,', 'rgba(56, 189, 248,', 'rgba(168, 85, 247,', 'rgba(251, 191, 36,']
    const lightColors = ['rgba(79, 70, 229,', 'rgba(2, 132, 199,', 'rgba(124, 58, 237,', 'rgba(217, 119, 6,']

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.15,
        colorIndex: Math.floor(Math.random() * 4),
      })
    }

    // Tương tác chuột nhẹ nhàng
    let mouseX = -1000
    let mouseY = -1000

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseX = e.clientX - rect.left
      mouseY = e.clientY - rect.top
    }

    const handleMouseLeave = () => {
      mouseX = -1000
      mouseY = -1000
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true })

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight
    }

    window.addEventListener('resize', handleResize, { passive: true })

    // Tự động tạm dừng khi ẩn tab để tiết kiệm tối đa RAM và CPU máy chủ / client
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
      if (isVisible) {
        lastTime = performance.now()
        render(lastTime)
      } else {
        cancelAnimationFrame(animationFrameId)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    let lastTime = performance.now()

    const render = (currentTime: number) => {
      if (!isVisible) return

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1)
      lastTime = currentTime

      ctx.clearRect(0, 0, width, height)

      const colors = isDark ? darkColors : lightColors
      const connectionDist = 120
      const mouseDist = 140

      // Vẽ các liên kết giữa các nốt (Network Graph)
      ctx.lineWidth = 0.8
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * (isDark ? 0.16 : 0.1)
            ctx.strokeStyle = `${colors[p1.colorIndex]} ${alpha})`
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }

      // Cập nhật vị trí và vẽ hạt
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60

        // Phản xạ cạnh biên
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

        // Tương tác chuột: đẩy nhẹ hạt khi con trỏ lướt qua
        const mdx = p.x - mouseX
        const mdy = p.y - mouseY
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mdist < mouseDist && mdist > 0) {
          const force = (1 - mdist / mouseDist) * 0.8
          p.x += (mdx / mdist) * force * 2
          p.y += (mdy / mdist) * force * 2
        }

        // Vẽ hạt
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `${colors[p.colorIndex]} ${p.baseAlpha})`
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isDark])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 w-full h-full z-0 transition-opacity duration-700 ${className}`}
      aria-hidden="true"
    />
  )
}
