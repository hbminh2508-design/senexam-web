'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
  RotateCw,
  FileText,
} from 'lucide-react'

interface ProtectedExamPdfViewerProps {
  driveFileId?: string | null
  pdfUrl?: string | null
  title?: string
  className?: string
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
}

export default function ProtectedExamPdfViewer({
  driveFileId,
  pdfUrl,
  title = 'Đề thi (Bảo mật)',
  className = '',
  onToggleFullscreen,
  isFullscreen = false,
}: ProtectedExamPdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.15)
  const [fitWidth, setFitWidth] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const renderTasksRef = useRef<{ [key: number]: any }>({})

  // Xác định stream URL để lấy raw bytes từ server
  const streamUrl = React.useMemo(() => {
    if (driveFileId) {
      if (driveFileId.startsWith('azure:')) {
        const id = driveFileId.replace(/^azure:/, '')
        return `/api/library/stream?id=${encodeURIComponent(id)}`
      }
      return `/api/drive/stream?fileId=${encodeURIComponent(driveFileId)}`
    }
    if (pdfUrl) {
      // Nếu là link drive preview cũ, tách fileId ra
      const match = pdfUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `/api/drive/stream?fileId=${encodeURIComponent(match[1])}`
      }
      return pdfUrl
    }
    return ''
  }, [driveFileId, pdfUrl])

  useEffect(() => {
    if (!streamUrl) {
      setLoading(false)
      setError('Không có đường dẫn đề thi hợp lệ')
      return
    }

    let isCancelled = false

    const loadDoc = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(streamUrl)
        if (!res.ok) {
          throw new Error(`Máy chủ không tải được đề (HTTP ${res.status})`)
        }

        const arrayBuffer = await res.arrayBuffer()
        if (isCancelled) return

        const pdfjsLib = await import('pdfjs-dist')
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        }

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/cmaps/',
          cMapPacked: true,
        })

        const pdf = await loadingTask.promise
        if (isCancelled) return

        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoading(false)
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Lỗi tải đề Canvas:', err)
          setError(err?.message || 'Không thể hiển thị đề thi.')
          setLoading(false)
        }
      }
    }

    loadDoc()

    return () => {
      isCancelled = true
    }
  }, [streamUrl])

  // Vẽ từng trang lên canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return
      const canvas = canvasRefs.current[pageNum]
      if (!canvas) return

      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel()
        } catch {}
      }

      try {
        const page = await pdfDoc.getPage(pageNum)
        let effectiveScale = scale

        // Nếu bật fit width: tự tính toán theo chiều rộng container
        if (fitWidth && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 48
          if (containerWidth > 300) {
            const baseViewport = page.getViewport({ scale: 1 })
            effectiveScale = Number((containerWidth / baseViewport.width).toFixed(2))
          }
        }

        const viewport = page.getViewport({ scale: effectiveScale })
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        const pixelRatio = window.devicePixelRatio || 1
        canvas.width = viewport.width * pixelRatio
        canvas.height = viewport.height * pixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        const renderTask = page.render(renderContext)
        renderTasksRef.current[pageNum] = renderTask
        await renderTask.promise
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Render page ${pageNum} error:`, err)
        }
      }
    },
    [pdfDoc, scale, fitWidth]
  )

  useEffect(() => {
    if (!pdfDoc || numPages === 0) return
    for (let p = 1; p <= numPages; p++) {
      renderPage(p)
    }
  }, [pdfDoc, numPages, scale, fitWidth, renderPage])

  // Chặn chuột phải & phím tắt sao chép đề
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'c')) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex-1 w-full h-full flex flex-col bg-slate-900 text-white select-none overflow-hidden relative ${className}`}
    >
      {/* THANH ĐIỀU KHIỂN ĐỀ THI (KHÔNG CÓ GOOGLE DRIVE, KHÔNG NÚT MỞ NGOÀI) */}
      <div className="h-9 bg-slate-950 px-3 border-b border-white/10 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="font-bold truncate max-w-[200px] sm:max-w-xs">{title}</span>
          {numPages > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 font-mono text-slate-300">
              {numPages} trang
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => {
              setFitWidth(false)
              setScale((s) => Math.max(0.7, Number((s - 0.15).toFixed(2))))
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
            title="Thu nhỏ"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFitWidth(false)
              setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
            title="Phóng to"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFitWidth((w) => !w)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${fitWidth ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
            title="Vừa chiều rộng"
          >
            Fit
          </button>

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 transition"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          )}
        </div>
      </div>

      {/* VÙNG CUỘN HIỂN THỊ CÁC TRANG CANVAS */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center gap-6 bg-slate-950">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-slate-400 py-16">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">Đang tải đề thi an toàn...</span>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6 py-16 text-slate-400">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-xs text-red-400 max-w-sm">{error}</p>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <div className="flex flex-col items-center gap-6 pb-12 w-full">
            {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="relative bg-white rounded-md shadow-xl overflow-hidden border border-slate-700"
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[pageNum] = el
                  }}
                  className="block pointer-events-none"
                />
                <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-white/80 pointer-events-none">
                  Trang {pageNum} / {numPages}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
