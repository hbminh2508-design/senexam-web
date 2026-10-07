'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  Type,
  ZoomIn,
  ZoomOut,
  Palette,
  Volume2,
  Edit3,
  BookOpen,
  Image as ImageIcon,
  Check,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react'

export interface CanvasIllustration {
  id: string
  prompt: string
  imageUrl?: string
  caption?: string
}

export interface CanvasStoryEngineProps {
  title: string
  chapterNumber: number
  chapterTitle: string
  content: string
  sentences: string[]
  currentSentenceIndex: number | null
  isPlayingTts: boolean
  illustrations?: Record<string, CanvasIllustration>
  onSentenceClick?: (sentenceIndex: number) => void
  onIllustrationClick?: (prompt: string, placeholderIndex: number) => void
  onContentChange?: (newContent: string) => void
  onSaveContent?: (newContent: string) => void
  readOnly?: boolean
}

type ReaderTheme = 'dark' | 'sepia' | 'light'

interface LineLayout {
  text: string
  x: number
  y: number // virtual Y
  width: number
  height: number
  paragraphIndex: number
  sentenceIndex: number | null
  isHeading?: boolean
  isSubheading?: boolean
  isIllustration?: boolean
  illustrationPrompt?: string
  illustrationIndex?: number
  imageUrl?: string
}

export default function CanvasStoryEngine({
  title,
  chapterNumber,
  chapterTitle,
  content,
  sentences,
  currentSentenceIndex,
  isPlayingTts,
  illustrations = {},
  onSentenceClick,
  onIllustrationClick,
  onContentChange,
  onSaveContent,
  readOnly = false,
}: CanvasStoryEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Settings
  const [theme, setTheme] = useState<ReaderTheme>('dark')
  const [fontSize, setFontSize] = useState<number>(18)
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif')
  const [isEditMode, setIsEditMode] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Virtual Scrolling
  const [scrollY, setScrollY] = useState<number>(0)
  const [maxScrollY, setMaxScrollY] = useState<number>(0)
  const [viewportHeight, setViewportHeight] = useState<number>(600)
  const [viewportWidth, setViewportWidth] = useState<number>(800)

  // Layout cache
  const lineLayoutsRef = useRef<LineLayout[]>([])
  const totalContentHeightRef = useRef<number>(0)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  // Hover state
  const [hoveredSentenceIndex, setHoveredSentenceIndex] = useState<number | null>(null)
  const [hoveredIllustrationIndex, setHoveredIllustrationIndex] = useState<number | null>(null)

  // Dragging scrollbar state
  const isDraggingScrollbarRef = useRef<boolean>(false)
  const dragStartYRef = useRef<number>(0)
  const dragStartScrollYRef = useRef<number>(0)

  // Theme palettes
  const themeColors = useMemo(() => {
    if (theme === 'sepia') {
      return {
        bg: '#fbf0d9',
        text: '#2b2216',
        heading: '#1c150c',
        meta: '#796a56',
        cardBg: '#f3e4c7',
        cardBorder: '#dcc69f',
        highlightBg: 'rgba(217, 119, 6, 0.22)',
        highlightBorder: 'rgba(217, 119, 6, 0.45)',
        hoverBg: 'rgba(217, 119, 6, 0.08)',
        scrollbar: '#c9b48c',
      }
    }
    if (theme === 'light') {
      return {
        bg: '#ffffff',
        text: '#1e293b',
        heading: '#0f172a',
        meta: '#64748b',
        cardBg: '#f8fafc',
        cardBorder: '#e2e8f0',
        highlightBg: 'rgba(59, 130, 246, 0.16)',
        highlightBorder: 'rgba(59, 130, 246, 0.45)',
        hoverBg: 'rgba(59, 130, 246, 0.06)',
        scrollbar: '#cbd5e1',
      }
    }
    // dark
    return {
      bg: '#090d16',
      text: '#e2e8f0',
      heading: '#ffffff',
      meta: '#94a3b8',
      cardBg: '#131b2e',
      cardBorder: '#1e293b',
      highlightBg: 'rgba(16, 185, 129, 0.22)',
      highlightBorder: 'rgba(16, 185, 129, 0.55)',
      hoverBg: 'rgba(255, 255, 255, 0.05)',
      scrollbar: '#334155',
    }
  }, [theme])

  // Helper: map a piece of text to its corresponding sentence index
  const matchSentenceIndex = useCallback(
    (lineText: string): number | null => {
      if (!lineText || lineText.trim().length === 0) return null
      const trimmed = lineText.trim()
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].includes(trimmed) || trimmed.includes(sentences[i])) {
          return i
        }
      }
      return null
    },
    [sentences]
  )

  // 1. Calculate Layout (Word wrapping on Canvas context)
  const calculateLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = viewportWidth
    const padding = Math.max(24, Math.min(64, Math.floor(width * 0.08)))
    const contentWidth = Math.max(300, width - padding * 2)

    const fontFace =
      fontFamily === 'serif'
        ? '"Merriweather", "Georgia", "Times New Roman", serif'
        : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

    const bodyFont = `${fontSize}px ${fontFace}`
    const headingFont = `bold ${Math.round(fontSize * 1.55)}px ${fontFace}`
    const subheadingFont = `bold ${Math.round(fontSize * 1.15)}px ${fontFace}`
    const metaFont = `italic ${Math.round(fontSize * 0.85)}px ${fontFace}`

    const lineHeight = Math.round(fontSize * 1.8)
    const paragraphSpacing = Math.round(lineHeight * 0.75)

    const layouts: LineLayout[] = []
    let currentY = 48

    // Chapter Header
    ctx.font = metaFont
    layouts.push({
      text: title.toUpperCase(),
      x: padding,
      y: currentY,
      width: contentWidth,
      height: Math.round(fontSize * 1.2),
      paragraphIndex: -2,
      sentenceIndex: null,
      isHeading: false,
    })
    currentY += Math.round(fontSize * 1.6)

    ctx.font = headingFont
    layouts.push({
      text: `Chương ${chapterNumber}: ${chapterTitle}`,
      x: padding,
      y: currentY,
      width: contentWidth,
      height: Math.round(fontSize * 2.2),
      paragraphIndex: -1,
      sentenceIndex: null,
      isHeading: true,
    })
    currentY += Math.round(fontSize * 2.6)

    // Parse Content into Paragraphs
    const paragraphs = content.split(/\n+/)
    let illustrationCounter = 0

    paragraphs.forEach((para, pIdx) => {
      const trimmedPara = para.trim()
      if (!trimmedPara) return

      // Kiểm tra thẻ giữ chỗ minh họa [ILLUSTRATION: ...]
      const illustrationMatch = trimmedPara.match(/^\[ILLUSTRATION:\s*(.*?)\]$/i)
      if (illustrationMatch) {
        illustrationCounter++
        const prompt = illustrationMatch[1]?.trim() || 'Hình minh họa'
        const existingData = illustrations[prompt] || illustrations[String(illustrationCounter)]
        
        let cardHeight = 140
        if (existingData?.imageUrl) {
          const cachedImg = imageCacheRef.current.get(existingData.imageUrl)
          if (cachedImg && cachedImg.naturalWidth && cachedImg.naturalHeight) {
            const aspect = cachedImg.naturalWidth / cachedImg.naturalHeight
            const renderH = Math.min(Math.round(contentWidth / aspect), 600)
            cardHeight = renderH + 36
          } else {
            cardHeight = 320
          }
        }

        layouts.push({
          text: `[Minh họa #${illustrationCounter}]: ${prompt}`,
          x: padding,
          y: currentY,
          width: contentWidth,
          height: cardHeight,
          paragraphIndex: pIdx,
          sentenceIndex: null,
          isIllustration: true,
          illustrationPrompt: prompt,
          illustrationIndex: illustrationCounter,
          imageUrl: existingData?.imageUrl,
        })

        // Preload image if present
        if (existingData?.imageUrl && !imageCacheRef.current.has(existingData.imageUrl)) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.src = existingData.imageUrl
          img.onload = () => {
            imageCacheRef.current.set(existingData.imageUrl!, img)
            calculateLayout()
            requestAnimationFrame(draw)
          }
        }

        currentY += cardHeight + paragraphSpacing * 1.5
        return
      }

      // Đoạn văn thường: Chia dòng tự động (Word Wrapping)
      ctx.font = bodyFont
      const words = trimmedPara.split(' ')
      let currentLine = ''

      for (let w = 0; w < words.length; w++) {
        const testLine = currentLine.length === 0 ? words[w] : `${currentLine} ${words[w]}`
        const metrics = ctx.measureText(testLine)

        if (metrics.width > contentWidth && currentLine.length > 0) {
          // Ngắt dòng
          layouts.push({
            text: currentLine,
            x: padding,
            y: currentY,
            width: ctx.measureText(currentLine).width,
            height: lineHeight,
            paragraphIndex: pIdx,
            sentenceIndex: matchSentenceIndex(currentLine),
          })
          currentY += lineHeight
          currentLine = words[w]
        } else {
          currentLine = testLine
        }
      }

      if (currentLine.length > 0) {
        layouts.push({
          text: currentLine,
          x: padding,
          y: currentY,
          width: ctx.measureText(currentLine).width,
          height: lineHeight,
          paragraphIndex: pIdx,
          sentenceIndex: matchSentenceIndex(currentLine),
        })
        currentY += lineHeight
      }

      currentY += paragraphSpacing
    })

    currentY += 80 // Bottom padding
    lineLayoutsRef.current = layouts
    totalContentHeightRef.current = currentY
    setMaxScrollY(Math.max(0, currentY - viewportHeight))
  }, [
    content,
    chapterNumber,
    chapterTitle,
    title,
    fontSize,
    fontFamily,
    viewportWidth,
    viewportHeight,
    illustrations,
    matchSentenceIndex,
  ])

  // 2. Draw Frame on Canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const width = viewportWidth
    const height = viewportHeight

    // Clear background
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = themeColors.bg
    ctx.fillRect(0, 0, width, height)

    const fontFace =
      fontFamily === 'serif'
        ? '"Merriweather", "Georgia", "Times New Roman", serif'
        : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

    const bodyFont = `${fontSize}px ${fontFace}`
    const headingFont = `bold ${Math.round(fontSize * 1.55)}px ${fontFace}`
    const metaFont = `italic ${Math.round(fontSize * 0.85)}px ${fontFace}`

    const padding = Math.max(24, Math.min(64, Math.floor(width * 0.08)))
    const contentWidth = Math.max(300, width - padding * 2)

    // Viewport Culling: Chỉ vẽ những dòng trong khoảng [scrollY - 50, scrollY + height + 50]
    const visibleTop = scrollY - 60
    const visibleBottom = scrollY + height + 60

    lineLayoutsRef.current.forEach((line) => {
      if (line.y + line.height < visibleTop || line.y > visibleBottom) {
        return // Bỏ qua vì nằm ngoài màn hình
      }

      const drawY = line.y - scrollY

      // VẼ MINH HỌA (ILLUSTRATION PLACEHOLDER HOẶC ẢNH ĐÃ TẢI)
      if (line.isIllustration) {
        const isHovered = hoveredIllustrationIndex === line.illustrationIndex

        if (line.imageUrl && imageCacheRef.current.has(line.imageUrl)) {
          // Vẽ hình ảnh minh họa thật - GIỮ NGUYÊN TỶ LỆ GỐC CỦA ẢNH, KHÔNG BỊ MÉO
          const img = imageCacheRef.current.get(line.imageUrl)!
          const imgW = img.naturalWidth || img.width || 1
          const imgH = img.naturalHeight || img.height || 1
          const imgAspect = imgW / imgH

          const maxAreaW = line.width
          const maxAreaH = line.height - 34
          const boxAspect = maxAreaW / maxAreaH

          let drawW = maxAreaW
          let drawH = maxAreaH
          let drawX = line.x
          let drawYOffset = drawY

          if (imgAspect > boxAspect) {
            // Ảnh ngang hơn khung -> Canh theo chiều ngang
            drawW = maxAreaW
            drawH = maxAreaW / imgAspect
            drawYOffset = drawY + (maxAreaH - drawH) / 2
          } else {
            // Ảnh dọc hơn khung -> Canh theo chiều dọc
            drawH = maxAreaH
            drawW = maxAreaH * imgAspect
            drawX = line.x + (maxAreaW - drawW) / 2
          }

          ctx.save()
          ctx.beginPath()
          ctx.roundRect(drawX, drawYOffset, drawW, drawH, 12)
          ctx.clip()
          ctx.drawImage(img, drawX, drawYOffset, drawW, drawH)
          ctx.restore()

          // Khung viền tinh tế bám sát tỷ lệ thực của ảnh
          ctx.strokeStyle = isHovered ? '#10b981' : themeColors.cardBorder
          ctx.lineWidth = isHovered ? 2 : 1
          ctx.strokeRect(drawX, drawYOffset, drawW, drawH)

          // Chú thích tranh bên dưới
          ctx.font = metaFont
          ctx.fillStyle = themeColors.meta
          ctx.textAlign = 'center'
          ctx.fillText(`Hình minh họa: ${line.illustrationPrompt}`, line.x + line.width / 2, drawY + line.height - 10)
        } else {
          // Vẽ thẻ placeholder chờ người dùng chèn ảnh
          ctx.save()
          ctx.fillStyle = isHovered ? themeColors.hoverBg : themeColors.cardBg
          ctx.beginPath()
          ctx.roundRect(line.x, drawY, line.width, line.height, 14)
          ctx.fill()

          ctx.setLineDash([6, 6])
          ctx.strokeStyle = isHovered ? '#10b981' : themeColors.cardBorder
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.setLineDash([])

          // Biểu tượng tranh & Tiêu đề
          ctx.font = `bold ${Math.round(fontSize * 0.95)}px ${fontFace}`
          ctx.fillStyle = isHovered ? '#10b981' : themeColors.heading
          ctx.textAlign = 'center'
          ctx.fillText(
            `🎨 KHUNG MINH HỌA #${line.illustrationIndex}: ${line.illustrationPrompt}`,
            line.x + line.width / 2,
            drawY + 44
          )

          // Gợi ý bấm để thêm ảnh
          ctx.font = metaFont
          ctx.fillStyle = themeColors.meta
          ctx.fillText(
            'Bấm trực tiếp vào khung này để chèn ảnh minh họa cho truyện',
            line.x + line.width / 2,
            drawY + 74
          )

          // Nút bấm minh họa trực quan
          const btnW = 160
          const btnH = 28
          const btnX = line.x + (line.width - btnW) / 2
          const btnY = drawY + 88
          ctx.fillStyle = isHovered ? '#10b981' : themeColors.cardBorder
          ctx.beginPath()
          ctx.roundRect(btnX, btnY, btnW, btnH, 8)
          ctx.fill()

          ctx.font = `bold 12px ${fontFace}`
          ctx.fillStyle = isHovered ? '#ffffff' : themeColors.text
          ctx.fillText('+ Chèn hình ảnh', line.x + line.width / 2, btnY + 18)

          ctx.restore()
        }
        return
      }

      // ĐỒNG BỘ HIGHLIGHT CHO GIỌNG ĐỌC TTS (KARAOKE HIGHLIGHT)
      const isSpeakingSentence =
        currentSentenceIndex !== null && line.sentenceIndex === currentSentenceIndex
      const isHoveredSentence =
        hoveredSentenceIndex !== null && line.sentenceIndex === hoveredSentenceIndex

      if (isSpeakingSentence || isHoveredSentence) {
        ctx.save()
        ctx.fillStyle = isSpeakingSentence ? themeColors.highlightBg : themeColors.hoverBg
        const hPadX = 6
        const hPadY = 2
        ctx.beginPath()
        ctx.roundRect(
          line.x - hPadX,
          drawY - hPadY,
          line.width + hPadX * 2,
          line.height + hPadY * 2,
          6
        )
        ctx.fill()

        if (isSpeakingSentence) {
          ctx.strokeStyle = themeColors.highlightBorder
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
        ctx.restore()
      }

      // VẼ CHỮ
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      if (line.isHeading) {
        ctx.font = headingFont
        ctx.fillStyle = themeColors.heading
      } else if (line.paragraphIndex === -2) {
        ctx.font = metaFont
        ctx.fillStyle = themeColors.meta
      } else {
        ctx.font = bodyFont
        ctx.fillStyle = isSpeakingSentence ? themeColors.heading : themeColors.text
      }

      ctx.fillText(line.text, line.x, drawY)
    })

    // VẼ THANH CUỘN (SCROLLBAR ẢO) TRÊN CANVAS
    if (totalContentHeightRef.current > height) {
      const scrollbarWidth = 6
      const scrollTrackHeight = height
      const thumbHeight = Math.max(30, (height / totalContentHeightRef.current) * height)
      const thumbY = (scrollY / (totalContentHeightRef.current - height)) * (height - thumbHeight)

      ctx.fillStyle = themeColors.scrollbar
      ctx.beginPath()
      ctx.roundRect(width - scrollbarWidth - 4, thumbY, scrollbarWidth, thumbHeight, 3)
      ctx.fill()
    }

    ctx.restore()
  }, [
    scrollY,
    viewportWidth,
    viewportHeight,
    themeColors,
    fontSize,
    fontFamily,
    currentSentenceIndex,
    hoveredSentenceIndex,
    hoveredIllustrationIndex,
  ])

  // Resize Canvas to fit container with high DPR
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)

      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      setViewportWidth(w)
      setViewportHeight(h)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Recalculate layout whenever content or font size changes
  useEffect(() => {
    calculateLayout()
  }, [calculateLayout])

  // Trigger draw on state change
  useEffect(() => {
    requestAnimationFrame(draw)
  }, [draw])

  // Auto-scroll when TTS sentence changes
  useEffect(() => {
    if (currentSentenceIndex === null) return
    const activeLine = lineLayoutsRef.current.find((l) => l.sentenceIndex === currentSentenceIndex)
    if (!activeLine) return

    // Canh giữa câu đang nói trên màn hình
    const targetScrollY = Math.max(0, activeLine.y - viewportHeight * 0.38)
    setScrollY((prev) => {
      // Smooth interpolation
      return Math.round(prev + (targetScrollY - prev) * 0.7)
    })
  }, [currentSentenceIndex, viewportHeight])

  // Mouse wheel scrolling
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setScrollY((prev) => {
      const next = prev + e.deltaY
      return Math.max(0, Math.min(next, maxScrollY))
    })
  }

  // Mouse Move: Hit-testing for Hover sentence or illustration
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const virtualY = mouseY + scrollY

    // Kiểm tra có đang rê trên scrollbar không
    if (mouseX >= viewportWidth - 20) {
      canvas.style.cursor = 'ns-resize'
      return
    }

    // Tìm dòng tương ứng
    let foundSentence: number | null = null
    let foundIllustration: number | null = null

    for (const line of lineLayoutsRef.current) {
      if (
        virtualY >= line.y &&
        virtualY <= line.y + line.height &&
        mouseX >= line.x &&
        mouseX <= line.x + line.width
      ) {
        if (line.isIllustration && line.illustrationIndex) {
          foundIllustration = line.illustrationIndex
        } else if (line.sentenceIndex !== null) {
          foundSentence = line.sentenceIndex
        }
        break
      }
    }

    setHoveredSentenceIndex(foundSentence)
    setHoveredIllustrationIndex(foundIllustration)

    if (foundIllustration !== null || foundSentence !== null) {
      canvas.style.cursor = 'pointer'
    } else {
      canvas.style.cursor = 'default'
    }
  }

  // Click on Canvas: Hit-test to trigger TTS at clicked sentence or open image modal
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const virtualY = mouseY + scrollY

    for (const line of lineLayoutsRef.current) {
      if (
        virtualY >= line.y &&
        virtualY <= line.y + line.height &&
        mouseX >= line.x &&
        mouseX <= line.x + line.width
      ) {
        if (line.isIllustration && line.illustrationPrompt && line.illustrationIndex) {
          if (onIllustrationClick) {
            onIllustrationClick(line.illustrationPrompt, line.illustrationIndex)
          }
          return
        }

        if (line.sentenceIndex !== null && onSentenceClick) {
          onSentenceClick(line.sentenceIndex)
          return
        }
      }
    }
  }

  // Touch support for Mobile swipe
  const touchStartYRef = useRef<number>(0)
  const touchStartScrollYRef = useRef<number>(0)

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY
      touchStartScrollYRef.current = scrollY
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const deltaY = touchStartYRef.current - e.touches[0].clientY
      const next = touchStartScrollYRef.current + deltaY
      setScrollY(Math.max(0, Math.min(next, maxScrollY)))
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col select-none overflow-hidden transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl border border-black/10 dark:border-white/10'
      }`}
      style={{ backgroundColor: themeColors.bg }}
    >
      {/* Top Floating Mini Toolbar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-black/40 dark:bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-xl">
        {/* Toggle Theme */}
        <button
          onClick={() => setTheme((prev) => (prev === 'dark' ? 'sepia' : prev === 'sepia' ? 'light' : 'dark'))}
          className="p-1.5 hover:bg-white/15 rounded-full transition-all text-xs flex items-center gap-1"
          title="Đổi giao diện đọc (Tối / Nâu cổ điển / Sáng)"
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="capitalize text-[11px] font-bold hidden sm:inline">{theme}</span>
        </button>

        {/* Font Family */}
        <button
          onClick={() => setFontFamily((prev) => (prev === 'serif' ? 'sans' : 'serif'))}
          className="p-1.5 hover:bg-white/15 rounded-full transition-all text-xs"
          title="Đổi font chữ (Serif / Sans)"
        >
          <Type className="h-3.5 w-3.5" />
        </button>

        {/* Font Size Out */}
        <button
          onClick={() => setFontSize((prev) => Math.max(14, prev - 2))}
          className="p-1.5 hover:bg-white/15 rounded-full transition-all text-xs"
          title="Thu nhỏ chữ"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        {/* Font Size In */}
        <button
          onClick={() => setFontSize((prev) => Math.min(28, prev + 2))}
          className="p-1.5 hover:bg-white/15 rounded-full transition-all text-xs"
          title="Phóng to chữ"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        {/* Quick Edit Mode Toggle */}
        {!readOnly && (
          <button
            onClick={() => setIsEditMode((prev) => !prev)}
            className={`p-1.5 rounded-full transition-all text-xs flex items-center gap-1 ${
              isEditMode ? 'bg-emerald-500 text-white' : 'hover:bg-white/15'
            }`}
            title="Bật/Tắt chế độ soạn thảo nhanh"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold hidden sm:inline">
              {isEditMode ? 'Đang soạn' : 'Soạn thảo'}
            </span>
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="p-1.5 hover:bg-white/15 rounded-full transition-all text-xs"
          title="Toàn màn hình"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main Canvas View */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="w-full h-full block"
        />

        {/* Mini indicator: TTS Active Notice */}
        {isPlayingTts && currentSentenceIndex !== null && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600/90 text-white text-xs font-semibold shadow-lg backdrop-blur-sm animate-pulse">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Đang đọc câu #{currentSentenceIndex + 1} (Bấm vào chữ bất kỳ để nhảy câu)</span>
          </div>
        )}

        {/* Floating Quick Edit Drawer if Edit Mode Active */}
        {isEditMode && !readOnly && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-96 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-black/10 dark:border-white/10 p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-emerald-500" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Soạn thảo chương này</h4>
              </div>
              <button
                onClick={() => setIsEditMode(false)}
                className="text-xs px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-500"
              >
                Đóng
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">
              Bạn có thể sửa văn bản dưới đây. Thêm <code className="bg-emerald-500/10 text-emerald-600 px-1 rounded">[ILLUSTRATION: Mô tả cảnh]</code> để chèn thêm vị trí vẽ tranh minh họa.
            </p>

            <textarea
              defaultValue={content}
              onChange={(e) => {
                if (onContentChange) onContentChange(e.target.value)
              }}
              className="flex-1 w-full p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Nhập nội dung chương..."
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (onSaveContent) onSaveContent(content)
                  setIsEditMode(false)
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                <Check className="h-3.5 w-3.5" /> Lưu bản thảo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
