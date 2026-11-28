'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'

export default function ChatPdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let stopped = false
    let loading: PDFDocumentLoadingTask | undefined
    void import('pdfjs-dist').then(async ({ GlobalWorkerOptions, getDocument }) => {
      if (stopped) return
      GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      loading = getDocument({ url, isEvalSupported: false })
      const document = await loading.promise
      if (!stopped) setPdf(document)
    }).catch(() => { if (!stopped) setError('Không thể mở bản xem trước PDF. Bạn vẫn có thể tải tệp về.') })
    return () => { stopped = true; void loading?.destroy().catch(() => {}) }
  }, [url])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    let task: RenderTask | undefined
    setRendering(true)
    setError('')
    void pdf.getPage(page).then(async (sheet) => {
      const element = canvas.current
      if (cancelled || !element) return
      const original = sheet.getViewport({ scale: 1 })
      const width = Math.max(200, Math.min(1000, (scroll.current?.clientWidth || 640) - 16))
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const viewport = sheet.getViewport({ scale: width * ratio / original.width })
      element.width = Math.ceil(viewport.width)
      element.height = Math.ceil(viewport.height)
      element.style.width = width + 'px'
      task = sheet.render({ canvas: element, viewport })
      await task.promise
      if (!cancelled) {
        setRendering(false)
        if (scroll.current) scroll.current.scrollTop = 0
      }
    }).catch(() => { if (!cancelled) setError('Không thể hiển thị trang PDF này.') })
    return () => { cancelled = true; task?.cancel() }
  }, [page, pdf])

  return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-slate-100 text-slate-900">
    {pdf && <nav aria-label="Trang PDF" className="flex items-center justify-center gap-3 border-b bg-white p-2 text-sm">
      <button type="button" className="min-h-9 rounded-lg border px-3 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span aria-live="polite">{page} / {pdf.numPages}</span>
      <button type="button" className="min-h-9 rounded-lg border px-3 disabled:opacity-40" disabled={page === pdf.numPages} onClick={() => setPage(page + 1)}>Trang sau</button>
    </nav>}
    <div ref={scroll} className="min-h-0 flex-1 overflow-auto p-2">
      {error ? <p role="alert" className="p-3">{error}</p> : rendering && <p role="status" className="p-3">Đang tải trang PDF…</p>}
      <canvas ref={canvas} aria-label={`Trang ${page}`} className={rendering || error ? 'invisible' : 'mx-auto block max-w-none bg-white'} />
    </div>
  </div>
}
