'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  Type,
  ZoomIn,
  ZoomOut,
  Palette,
  Volume2,
  Edit3,
  Image as ImageIcon,
  Check,
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
  coverUrl?: string
  onSentenceClick?: (sentenceIndex: number) => void
  onIllustrationClick?: (prompt: string, placeholderIndex: number) => void
  onContentChange?: (newContent: string) => void
  onSaveContent?: (newContent: string) => void
  readOnly?: boolean
}

type ReaderTheme = 'dark' | 'sepia' | 'light'

// Bảng ảnh thông minh chất lượng cao theo ngữ cảnh
export function getSmartIllustrationUrl(prompt: string, seed: number = 1): string {
  const p = (prompt || '').toLowerCase()
  if (p.includes('bìa') || p.includes('cover')) {
    return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('rừng') || p.includes('cây') || p.includes('primeval') || p.includes('forest') || p.includes('jungle')) {
    return 'https://images.unsplash.com/photo-1511497584788-87676104235f?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('sa mạc') || p.includes('desert') || p.includes('sahara') || p.includes('cát')) {
    return 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('hoàng tử') || p.includes('prince') || p.includes('cậu bé') || p.includes('boy')) {
    return 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('trăn') || p.includes('rắn') || p.includes('boa') || p.includes('snake')) {
    return 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('dế') || p.includes('côn trùng') || p.includes('grass') || p.includes('cỏ') || p.includes('cricket')) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('sao') || p.includes('đêm') || p.includes('vũ trụ') || p.includes('star') || p.includes('night') || p.includes('galaxy')) {
    return 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('biển') || p.includes('đại dương') || p.includes('sea') || p.includes('ocean') || p.includes('wave')) {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('máy bay') || p.includes('cánh') || p.includes('plane') || p.includes('pilot')) {
    return 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('núi') || p.includes('mountain') || p.includes('đồi')) {
    return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('thành phố') || p.includes('phố') || p.includes('city') || p.includes('town')) {
    return 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('sách') || p.includes('thư viện') || p.includes('book') || p.includes('library')) {
    return 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop'
  }
  if (p.includes('hoa') || p.includes('vườn') || p.includes('flower') || p.includes('garden')) {
    return 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=1200&auto=format&fit=crop'
  }

  const presets = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
  ]
  return presets[Math.abs(seed) % presets.length]
}

interface LineFragment {
  text: string
  xOffset: number
  width: number
  sentenceIndex: number | null
}

interface LineLayout {
  x: number
  y: number // virtual Y
  width: number
  height: number
  paragraphIndex: number
  isHeading?: boolean
  isSubheading?: boolean
  isIllustration?: boolean
  illustrationPrompt?: string
  illustrationIndex?: number
  imageUrl?: string
  isCover?: boolean
  fragments: LineFragment[]
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
  coverUrl,
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
  const maxScrollYRef = useRef<number>(0)
  const [viewportHeight, setViewportHeight] = useState<number>(600)
  const [viewportWidth, setViewportWidth] = useState<number>(800)

  // Layout cache
  const lineLayoutsRef = useRef<LineLayout[]>([])
  const totalContentHeightRef = useRef<number>(0)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  // Hover state
  const [hoveredSentenceIndex, setHoveredSentenceIndex] = useState<number | null>(null)
  const [hoveredIllustrationIndex, setHoveredIllustrationIndex] = useState<number | null>(null)

  // Scrollbar dragging state
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
        highlightBg: 'rgba(217, 119, 6, 0.25)',
        highlightBorder: '#d97706',
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
        highlightBg: 'rgba(16, 185, 129, 0.18)',
        highlightBorder: '#10b981',
        hoverBg: 'rgba(16, 185, 129, 0.06)',
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
      highlightBg: 'rgba(16, 185, 129, 0.28)',
      highlightBorder: '#34d399',
      hoverBg: 'rgba(255, 255, 255, 0.06)',
      scrollbar: '#334155',
    }
  }, [theme])

  // 1. Calculate Layout (Word wrapping & Fragment Sentence Mapping)
  const calculateLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = viewportWidth
    const padding = Math.max(20, Math.min(64, Math.floor(width * 0.07)))
    const contentWidth = Math.max(280, width - padding * 2 - 12) // chừa chỗ cho scrollbar

    const fontFace =
      fontFamily === 'serif'
        ? '"Merriweather", "Georgia", "Times New Roman", serif'
        : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

    const bodyFont = `${fontSize}px ${fontFace}`
    const headingFont = `bold ${Math.round(fontSize * 1.55)}px ${fontFace}`
    const metaFont = `italic ${Math.round(fontSize * 0.85)}px ${fontFace}`

    const lineHeight = Math.round(fontSize * 1.75)
    const paragraphSpacing = Math.round(lineHeight * 0.7)

    const layouts: LineLayout[] = []
    let currentY = 40

    // Chapter Header (Tiêu đề tác phẩm)
    ctx.font = metaFont
    layouts.push({
      x: padding,
      y: currentY,
      width: contentWidth,
      height: Math.round(fontSize * 1.2),
      paragraphIndex: -2,
      fragments: [
        {
          text: title.toUpperCase(),
          xOffset: 0,
          width: ctx.measureText(title.toUpperCase()).width,
          sentenceIndex: null,
        },
      ],
    })
    currentY += Math.round(fontSize * 1.5)

    // Tiêu đề chương
    ctx.font = headingFont
    const chapterHeadingText = `Chương ${chapterNumber}: ${chapterTitle}`
    layouts.push({
      x: padding,
      y: currentY,
      width: contentWidth,
      height: Math.round(fontSize * 2.2),
      paragraphIndex: -1,
      isHeading: true,
      fragments: [
        {
          text: chapterHeadingText,
          xOffset: 0,
          width: ctx.measureText(chapterHeadingText).width,
          sentenceIndex: null,
        },
      ],
    })
    currentY += Math.round(fontSize * 2.5)

    // Yêu cầu: TỰ ĐỘNG CHÈN ẢNH BÌA Ở ĐẦU CHƯƠNG 1 (hoặc khi có coverUrl)
    if (coverUrl && chapterNumber === 1) {
      let coverCardHeight = 360
      const cachedCover = imageCacheRef.current.get(coverUrl)
      if (cachedCover && cachedCover.naturalWidth && cachedCover.naturalHeight) {
        const aspect = cachedCover.naturalWidth / cachedCover.naturalHeight
        coverCardHeight = Math.min(Math.round(contentWidth / aspect), 520) + 36
      }

      layouts.push({
        x: padding,
        y: currentY,
        width: contentWidth,
        height: coverCardHeight,
        paragraphIndex: -10,
        isIllustration: true,
        illustrationPrompt: 'Ảnh bìa tác phẩm',
        illustrationIndex: 0,
        imageUrl: coverUrl,
        isCover: true,
        fragments: [],
      })

      // Preload ảnh bìa
      if (!imageCacheRef.current.has(coverUrl)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = coverUrl
        img.onload = () => {
          imageCacheRef.current.set(coverUrl, img)
          calculateLayout()
          requestAnimationFrame(draw)
        }
      }

      currentY += coverCardHeight + paragraphSpacing * 1.4
    }

    // Parse Content into Paragraphs
    const paragraphs = content.split(/\r?\n+/)
    let illustrationCounter = 0
    let globalSentencePointer = 0

    paragraphs.forEach((para, pIdx) => {
      const trimmedPara = para.trim()
      if (!trimmedPara) return

      // Thẻ minh họa [ILLUSTRATION: ...]
      const illustrationMatch = trimmedPara.match(/^\[ILLUSTRATION:\s*(.*?)\]$/i)
      if (illustrationMatch) {
        illustrationCounter++
        const prompt = illustrationMatch[1]?.trim() || 'Hình minh họa'
        const existingData = illustrations[prompt] || illustrations[String(illustrationCounter)]

        // YÊU CẦU: TỰ ĐỘNG CHÈN ẢNH THÔNG MINH, KHÔNG CẦN CHÈN THỦ CÔNG NỮA
        const autoImageUrl = existingData?.imageUrl || getSmartIllustrationUrl(prompt, illustrationCounter)

        let cardHeight = 280
        const cachedImg = imageCacheRef.current.get(autoImageUrl)
        if (cachedImg && cachedImg.naturalWidth && cachedImg.naturalHeight) {
          const aspect = cachedImg.naturalWidth / cachedImg.naturalHeight
          cardHeight = Math.min(Math.round(contentWidth / aspect), 520) + 36
        }

        layouts.push({
          x: padding,
          y: currentY,
          width: contentWidth,
          height: cardHeight,
          paragraphIndex: pIdx,
          isIllustration: true,
          illustrationPrompt: prompt,
          illustrationIndex: illustrationCounter,
          imageUrl: autoImageUrl,
          fragments: [],
        })

        // Preload hình ảnh
        if (autoImageUrl && !imageCacheRef.current.has(autoImageUrl)) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.src = autoImageUrl
          img.onload = () => {
            imageCacheRef.current.set(autoImageUrl, img)
            calculateLayout()
            requestAnimationFrame(draw)
          }
        }

        currentY += cardHeight + paragraphSpacing * 1.4
        return
      }

      // Xử lý đoạn văn thường: Tách theo câu và wrap từ
      ctx.font = bodyFont
      const cleanPara = trimmedPara.replace(/\[ILLUSTRATION:[^\]]*\]/gi, '').trim()
      if (!cleanPara) return

      // Tìm các câu thuộc đoạn văn này từ danh sách sentences
      // Nếu không khớp, tách câu theo dấu chấm/chấm hỏi/chấm than
      const rawSentencesInPara = cleanPara.split(/(?<=[.?!…])\s+/).filter((s) => s.trim().length > 0)

      let currentLineFragments: LineFragment[] = []
      let currentLineWidth = 0

      const flushLine = () => {
        if (currentLineFragments.length === 0) return
        layouts.push({
          x: padding,
          y: currentY,
          width: currentLineWidth,
          height: lineHeight,
          paragraphIndex: pIdx,
          fragments: currentLineFragments,
        })
        currentY += lineHeight
        currentLineFragments = []
        currentLineWidth = 0
      }

      for (const sentStr of rawSentencesInPara) {
        const sentTrim = sentStr.trim()
        if (!sentTrim) continue

        // Tìm sentenceIndex chuẩn xác từ mảng sentences
        let matchedIndex: number | null = null
        for (let sIdx = globalSentencePointer; sIdx < sentences.length; sIdx++) {
          const target = sentences[sIdx].trim()
          if (target === sentTrim || sentTrim.includes(target) || target.includes(sentTrim)) {
            matchedIndex = sIdx
            globalSentencePointer = sIdx + 1
            break
          }
        }
        // Fallback tìm toàn bộ nếu con trỏ trượt
        if (matchedIndex === null) {
          for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
            const target = sentences[sIdx].trim()
            if (target === sentTrim || sentTrim.includes(target) || target.includes(sentTrim)) {
              matchedIndex = sIdx
              break
            }
          }
        }

        const words = sentTrim.split(/\s+/)
        let sentFragmentWords: string[] = []

        for (let w = 0; w < words.length; w++) {
          const word = words[w]
          const testFragText = sentFragmentWords.length === 0 ? word : `${sentFragmentWords.join(' ')} ${word}`
          const testWordWidth = ctx.measureText(
            currentLineWidth === 0 ? testFragText : ` ${testFragText}`
          ).width

          if (currentLineWidth + testWordWidth > contentWidth && currentLineWidth > 0) {
            // Đầy dòng -> đẩy fragment hiện tại vào dòng và flush dòng
            if (sentFragmentWords.length > 0) {
              const fragText = (currentLineWidth === 0 ? '' : ' ') + sentFragmentWords.join(' ')
              const fragW = ctx.measureText(fragText).width
              currentLineFragments.push({
                text: fragText,
                xOffset: currentLineWidth,
                width: fragW,
                sentenceIndex: matchedIndex,
              })
              currentLineWidth += fragW
            }
            flushLine()
            sentFragmentWords = [word]
          } else {
            sentFragmentWords.push(word)
          }
        }

        // Còn từ sót lại của câu này
        if (sentFragmentWords.length > 0) {
          const fragText = (currentLineWidth === 0 ? '' : ' ') + sentFragmentWords.join(' ')
          const fragW = ctx.measureText(fragText).width
          currentLineFragments.push({
            text: fragText,
            xOffset: currentLineWidth,
            width: fragW,
            sentenceIndex: matchedIndex,
          })
          currentLineWidth += fragW
        }
      }

      // Flush nốt phần còn lại của đoạn văn
      flushLine()
      currentY += paragraphSpacing
    })

    currentY += 100 // Đệm đáy thoải mái đọc
    lineLayoutsRef.current = layouts
    totalContentHeightRef.current = currentY
    const maxScroll = Math.max(0, currentY - viewportHeight)
    maxScrollYRef.current = maxScroll
    setMaxScrollY(maxScroll)
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
    coverUrl,
    sentences,
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

    // Viewport Culling
    const visibleTop = scrollY - 80
    const visibleBottom = scrollY + height + 80

    lineLayoutsRef.current.forEach((line) => {
      if (line.y + line.height < visibleTop || line.y > visibleBottom) {
        return
      }

      const drawY = line.y - scrollY

      // VẼ ẢNH MINH HỌA / ẢNH BÌA
      if (line.isIllustration) {
        const isHovered = hoveredIllustrationIndex === line.illustrationIndex
        ctx.save()

        // Khung nền card ảnh
        ctx.fillStyle = themeColors.cardBg
        ctx.strokeStyle = isHovered ? themeColors.highlightBorder : themeColors.cardBorder
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.beginPath()
        ctx.roundRect(line.x, drawY, line.width, line.height, 14)
        ctx.fill()
        ctx.stroke()

        if (line.imageUrl) {
          const cachedImg = imageCacheRef.current.get(line.imageUrl)
          if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.roundRect(line.x + 8, drawY + 8, line.width - 16, line.height - 38, 10)
            ctx.clip()

            const boxW = line.width - 16
            const boxH = line.height - 38
            const imgAspect = cachedImg.naturalWidth / cachedImg.naturalHeight
            const boxAspect = boxW / boxH

            let drawW = boxW
            let drawH = boxH
            let drawX = line.x + 8
            let drawYOffset = drawY + 8

            if (imgAspect > boxAspect) {
              drawH = boxW / imgAspect
              drawYOffset = drawY + 8 + (boxH - drawH) / 2
            } else {
              drawW = boxH * imgAspect
              drawX = line.x + 8 + (boxW - drawW) / 2
            }

            ctx.drawImage(cachedImg, drawX, drawYOffset, drawW, drawH)
            ctx.restore()

            // Nhãn chú thích bên dưới ảnh
            ctx.font = `500 ${Math.max(11, fontSize - 5)}px ${fontFace}`
            ctx.fillStyle = themeColors.meta
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const caption = line.isCover
              ? `✨ Ảnh Bìa Tác Phẩm • ${title}`
              : `🖼 Minh họa #${line.illustrationIndex}: ${line.illustrationPrompt}`
            ctx.fillText(caption, line.x + line.width / 2, drawY + line.height - 15)
          } else {
            // Đang tải ảnh
            ctx.font = `italic 12px ${fontFace}`
            ctx.fillStyle = themeColors.meta
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('⏳ Đang nạp tranh minh họa...', line.x + line.width / 2, drawY + line.height / 2)
          }
        }
        ctx.restore()
        return
      }

      // VẼ DÒNG VĂN BẢN VỚI TỪNG FRAGMENT ĐƯỢC HIGHLIGHT CHUẨN XÁC
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
        ctx.fillStyle = themeColors.text
      }

      line.fragments.forEach((frag) => {
        const fragX = line.x + frag.xOffset
        const isSpeaking =
          currentSentenceIndex !== null && frag.sentenceIndex === currentSentenceIndex
        const isHovered =
          hoveredSentenceIndex !== null && frag.sentenceIndex === hoveredSentenceIndex

        // Highlight nền câu đang đọc (Karaoke Highlight mượt mà)
        if (isSpeaking || isHovered) {
          ctx.save()
          ctx.fillStyle = isSpeaking ? themeColors.highlightBg : themeColors.hoverBg
          ctx.beginPath()
          ctx.roundRect(fragX - 3, drawY - 2, frag.width + 6, line.height + 4, 5)
          ctx.fill()

          if (isSpeaking) {
            ctx.strokeStyle = themeColors.highlightBorder
            ctx.lineWidth = 1.2
            ctx.stroke()
          }
          ctx.restore()
        }

        ctx.fillStyle = isSpeaking ? themeColors.heading : themeColors.text
        ctx.fillText(frag.text, fragX, drawY)
      })
    })

    // VẼ THANH CUỘN (SCROLLBAR)
    if (totalContentHeightRef.current > height) {
      const scrollbarWidth = 6
      const thumbHeight = Math.max(36, (height / totalContentHeightRef.current) * height)
      const maxThumbTravel = height - thumbHeight
      const thumbY = (scrollY / (totalContentHeightRef.current - height)) * maxThumbTravel

      ctx.save()
      ctx.fillStyle = themeColors.scrollbar
      ctx.beginPath()
      ctx.roundRect(width - scrollbarWidth - 4, thumbY, scrollbarWidth, thumbHeight, 3)
      ctx.fill()
      ctx.restore()
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
    title,
  ])

  // Resize Canvas to fit container with high DPR
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(320, Math.floor(rect.width))
      const h = Math.max(300, Math.floor(rect.height))

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

  // Recalculate layout whenever content, font or size changes
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
    const activeLine = lineLayoutsRef.current.find((l) =>
      l.fragments.some((f) => f.sentenceIndex === currentSentenceIndex)
    )
    if (!activeLine) return

    const targetScrollY = Math.max(0, activeLine.y - viewportHeight * 0.38)
    setScrollY((prev) => {
      return Math.round(prev + (targetScrollY - prev) * 0.5)
    })
  }, [currentSentenceIndex, viewportHeight])

  // Native non-passive Wheel listener (khắc phục lỗi cuộn mượt mà trên Chrome/Edge)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setScrollY((prev) => {
        const next = prev + e.deltaY
        return Math.max(0, Math.min(next, maxScrollYRef.current))
      })
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Xử lý kéo thanh cuộn (Draggable Scrollbar)
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingScrollbarRef.current) return
      const deltaY = e.clientY - dragStartYRef.current
      const scrollRatio = deltaY / viewportHeight
      const addedScroll = scrollRatio * totalContentHeightRef.current
      const targetScroll = dragStartScrollYRef.current + addedScroll
      setScrollY(Math.max(0, Math.min(targetScroll, maxScrollYRef.current)))
    }

    const handleWindowMouseUp = () => {
      isDraggingScrollbarRef.current = false
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [viewportHeight])

  // Mouse Move: Hit-testing for Hover sentence or illustration
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const virtualY = mouseY + scrollY

    // Rê trên vùng thanh cuộn
    if (mouseX >= viewportWidth - 20) {
      canvas.style.cursor = 'ns-resize'
      return
    }

    let foundSentence: number | null = null
    let foundIllustration: number | null = null

    for (const line of lineLayoutsRef.current) {
      if (virtualY >= line.y && virtualY <= line.y + line.height) {
        if (line.isIllustration && line.illustrationIndex) {
          if (mouseX >= line.x && mouseX <= line.x + line.width) {
            foundIllustration = line.illustrationIndex
            break
          }
        } else {
          for (const frag of line.fragments) {
            const fX = line.x + frag.xOffset
            if (mouseX >= fX && mouseX <= fX + frag.width) {
              if (frag.sentenceIndex !== null) {
                foundSentence = frag.sentenceIndex
                break
              }
            }
          }
          if (foundSentence !== null) break
        }
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

  // Click on Canvas
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const virtualY = mouseY + scrollY

    // Nhấp vào scrollbar để nhảy nhanh
    if (mouseX >= viewportWidth - 20) {
      const clickRatio = mouseY / viewportHeight
      setScrollY(Math.max(0, Math.min(clickRatio * totalContentHeightRef.current, maxScrollYRef.current)))
      return
    }

    for (const line of lineLayoutsRef.current) {
      if (virtualY >= line.y && virtualY <= line.y + line.height) {
        if (line.isIllustration && line.illustrationPrompt && line.illustrationIndex) {
          if (mouseX >= line.x && mouseX <= line.x + line.width) {
            if (onIllustrationClick) {
              onIllustrationClick(line.illustrationPrompt, line.illustrationIndex)
            }
            return
          }
        } else {
          for (const frag of line.fragments) {
            const fX = line.x + frag.xOffset
            if (mouseX >= fX && mouseX <= fX + frag.width) {
              if (frag.sentenceIndex !== null && onSentenceClick) {
                onSentenceClick(frag.sentenceIndex)
                return
              }
            }
          }
        }
      }
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left

    if (mouseX >= viewportWidth - 20) {
      isDraggingScrollbarRef.current = true
      dragStartYRef.current = e.clientY
      dragStartScrollYRef.current = scrollY
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
      setScrollY(Math.max(0, Math.min(next, maxScrollYRef.current)))
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setScrollY((p) => Math.min(p + 60, maxScrollYRef.current))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setScrollY((p) => Math.max(0, p - 60))
    } else if (e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault()
      setScrollY((p) => Math.min(p + viewportHeight * 0.7, maxScrollYRef.current))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      setScrollY((p) => Math.max(0, p - viewportHeight * 0.7))
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative w-full h-full flex flex-col select-none overflow-hidden outline-none transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl border border-black/10 dark:border-white/10'
      }`}
      style={{ backgroundColor: themeColors.bg }}
    >
      {/* Top Floating Mini Toolbar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-black/50 dark:bg-black/70 backdrop-blur-md border border-white/15 text-white shadow-xl">
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
      <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="w-full h-full block"
        />

        {/* Mini indicator: TTS Active Notice */}
        {isPlayingTts && currentSentenceIndex !== null && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600/90 text-white text-xs font-semibold shadow-lg backdrop-blur-sm animate-pulse">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Đang đọc câu #{currentSentenceIndex + 1} (Bấm vào chữ bất kỳ để chuyển giọng đọc)</span>
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
              Bạn có thể sửa văn bản dưới đây. Thêm <code className="bg-emerald-500/10 text-emerald-600 px-1 rounded">[ILLUSTRATION: Mô tả cảnh]</code> để tự động nhận diện chèn tranh minh họa.
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
