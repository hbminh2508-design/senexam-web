'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Download,
  Lock,
  Loader2,
  AlertTriangle,
  RotateCw,
  FileText,
} from 'lucide-react'

interface ProtectedDocViewerProps {
  documentId: string
  driveFileId?: string
  title: string
  canDownload?: boolean
  isLoggedIn: boolean
  onClose: () => void
  onRequireLogin: () => void
}

export default function ProtectedDocViewer({
  documentId,
  driveFileId,
  title,
  canDownload = true,
  isLoggedIn,
  onClose,
  onRequireLogin,
}: ProtectedDocViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isContinuousView, setIsContinuousView] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const renderTasksRef = useRef<{ [key: number]: any }>({})

  // 1. Tải tài liệu qua API Stream an toàn của Azure
  useEffect(() => {
    let isCancelled = false

    const loadPdf = async () => {
      setLoading(true)
      setError(null)

      try {
        const streamUrl = `/api/library/stream?id=${encodeURIComponent(documentId)}`
        const res = await fetch(streamUrl)
        if (!res.ok) {
          throw new Error(`Máy chủ báo lỗi ${res.status}: ${res.statusText}`)
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
          console.error('Lỗi khởi tạo Protected PDF Viewer:', err)
          setError(err?.message || 'Không thể hiển thị tài liệu này.')
          setLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      isCancelled = true
    }
  }, [documentId])

  // 2. Hàm vẽ trang PDF lên thẻ Canvas HTML5
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return
      const canvas = canvasRefs.current[pageNum]
      if (!canvas) return

      // Hủy task render đang chạy nếu có
      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel()
        } catch {}
      }

      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })

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
          console.warn(`Lỗi render trang ${pageNum}:`, err)
        }
      }
    },
    [pdfDoc, scale]
  )

  // 3. Render lại các trang khi pdfDoc hoặc scale thay đổi
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return

    if (isContinuousView) {
      for (let p = 1; p <= numPages; p++) {
        renderPage(p)
      }
    } else {
      renderPage(currentPage)
    }
  }, [pdfDoc, numPages, currentPage, scale, isContinuousView, renderPage])

  // 4. Bảo vệ chống chụp / in / phím tắt tải lậu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chặn Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen?.().catch(() => {})
        } else {
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, onClose])

  // 5. Xử lý toàn màn hình
  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // 6. Xử lý tải về
  const handleDownloadClick = () => {
    if (!canDownload) return
    if (!isLoggedIn) {
      onRequireLogin()
      return
    }
    // Kích hoạt link tải về từ máy chủ Azure
    const downloadUrl = `/api/library/stream?id=${encodeURIComponent(documentId)}&download=1`
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = title
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 backdrop-blur-md select-none text-white overflow-hidden"
    >
      {/* 🌟 THANH ĐIỀU KHIỂN RIÊNG (HOÀN TOÀN KHÔNG CÓ GOOGLE DRIVE) */}
      <header className="h-14 px-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
        {/* Tên tài liệu */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <FileText className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold truncate max-w-xs sm:max-w-md lg:max-w-xl text-slate-100" title={title}>
            {title}
          </h2>
        </div>

        {/* Cụm điều khiển trang & phóng to */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-white/5 text-xs">
          {numPages > 1 && (
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-slate-300">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Phóng to / thu nhỏ */}
          <button
            onClick={() => setScale((s) => Math.max(0.7, Number((s - 0.15).toFixed(2))))}
            className="p-1 rounded hover:bg-white/10 transition"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <span className="w-10 text-center font-mono text-[11px] text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
            className="p-1 rounded hover:bg-white/10 transition"
            title="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>

        {/* Nút tác vụ & Tải về */}
        <div className="flex items-center gap-2">
          {/* Nút Tải xuống thông minh theo phân quyền */}
          {!canDownload ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chỉ xem (Cấm tải)</span>
            </div>
          ) : !isLoggedIn ? (
            <button
              onClick={handleDownloadClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold transition shadow-xs"
              title="Đăng nhập để tải về máy"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đăng nhập để tải</span>
            </button>
          ) : (
            <button
              onClick={handleDownloadClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-900/30"
              title="Tải tệp này về máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải về</span>
            </button>
          )}

          {/* Toàn màn hình */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Đóng */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition"
            title="Đóng xem đề"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* VÙNG HIỂN THỊ TÀI LIỆU CANVAS */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-start gap-6 bg-slate-950">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-medium tracking-wide">Đang tải và dựng trang an toàn...</p>
          </div>
        )}

        {error && (
          driveFileId && !driveFileId.startsWith('azure:') ? (
            <iframe
              src={`https://drive.google.com/file/d/${driveFileId}/preview#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full min-h-[600px] border-none"
              allow="autoplay"
              title={title}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-md py-20">
              <div className="p-3 rounded-full bg-red-500/20 text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-400 mb-1">Không thể đọc tài liệu</h3>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition"
              >
                <RotateCw className="w-3.5 h-3.5" /> Thử lại
              </button>
            </div>
          )
        )}

        {!loading && !error && numPages > 0 && (
          <div className="flex flex-col items-center gap-6 pb-12 w-full">
            {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
              <div
                key={pageNum}
                className="relative bg-white rounded-lg shadow-2xl shadow-black/80 overflow-hidden border border-white/10"
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[pageNum] = el
                  }}
                  className="block pointer-events-none"
                />
                <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-white/80 pointer-events-none">
                  Trang {pageNum} / {numPages}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
