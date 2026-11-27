'use client'

import { Hand, Minus, Pencil, Plus, RotateCcw, StickyNote, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { chatRequest } from '@/lib/senChatBrowser'
import { boardColors, type BoardEntry, type BoardItem, type BoardPoint } from '@/lib/senChatWhiteboard'

export default function ChatWhiteboard({ callId, userId, onClose }: { callId: string; userId: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const entries = useRef(new Map<string, BoardEntry>())
  const cursor = useRef<BoardEntry | null>(null)
  const view = useRef({ x: 0, y: 0, scale: 1 })
  const drag = useRef<{ id: number; local: BoardPoint; points?: BoardPoint[] } | null>(null)
  const [tool, setTool] = useState<'stroke' | 'pan' | 'note'>('stroke')
  const [color, setColor] = useState(boardColors[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ id: string; item: BoardItem } | null>(null)
  const [saving, setSaving] = useState(false)
  const path = `whiteboard?callId=${callId}`

  const draw = useCallback(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const { width, height } = element.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio)
    if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio)
    const { x, y, scale } = view.current
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#cbd5e1'
    const step = 28 * scale
    for (let px = ((x % step) + step) % step; px < width; px += step) {
      for (let py = ((y % step) + step) % step; py < height; py += step) ctx.fillRect(px, py, 1.25, 1.25)
    }
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    const drawStroke = (points: BoardPoint[], ink: string) => {
      ctx.strokeStyle = ink
      ctx.beginPath()
      ctx.moveTo(...points[0])
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.01, points[0][1])
      for (const point of points.slice(1)) ctx.lineTo(...point)
      ctx.stroke()
    }
    const hidden = new Set(Array.from(entries.current.values()).flatMap(({ item }) => item.kind === 'undo' ? [item.target] : []))
    for (const { id, item } of entries.current.values()) {
      if (hidden.has(id)) continue
      if (item.kind === 'stroke') drawStroke(item.points, item.color)
      if (item.kind === 'note') {
        const [left, top] = item.at
        ctx.font = '600 15px system-ui'
        const lines = item.text.match(/.{1,26}(\s|$)|.{1,26}/gu) || [item.text]
        ctx.fillStyle = '#fef3c7'
        ctx.fillRect(left, top, 244, 22 * lines.length + 20)
        ctx.fillStyle = item.color
        lines.forEach((line, index) => ctx.fillText(line.trim(), left + 11, top + 23 + index * 22, 222))
      }
    }
    if (drag.current?.points?.length) drawStroke(drag.current.points, color)
  }, [color])

  useEffect(() => {
    const observer = new ResizeObserver(draw)
    if (canvas.current) observer.observe(canvas.current)
    draw()
    return () => observer.disconnect()
  }, [draw])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function sync() {
      let delay = 1800
      try {
        const last = cursor.current
        const offset = last ? `&at=${encodeURIComponent(last.created_at)}&id=${last.id}` : ''
        const { entries: latest } = await chatRequest<{ entries: BoardEntry[] }>(path + offset)
        if (stopped) return
        latest.forEach((entry) => entries.current.set(entry.id, entry))
        if (latest.length) cursor.current = latest[latest.length - 1]
        if (latest.length === 200) delay = 0
        draw()
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ bảng trắng.')
      }
      if (!stopped) timer = setTimeout(sync, delay)
    }
    void sync()
    return () => { stopped = true; clearTimeout(timer) }
  }, [path, draw])

  const save = async (item: BoardItem, id = crypto.randomUUID()) => {
    setSaving(true)
    setError('')
    try {
      await chatRequest(path, { id, item })
      if (!entries.current.has(id)) entries.current.set(id, { id, author_id: userId, item, created_at: '' })
      setPending(null)
      draw()
    } catch (reason) {
      setPending({ id, item })
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bảng trắng.')
    } finally { setSaving(false) }
  }

  const point = (event: React.PointerEvent): BoardPoint => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [event.clientX - bounds.left, event.clientY - bounds.top]
  }
  const world = ([x, y]: BoardPoint): BoardPoint => [
    (x - view.current.x) / view.current.scale, (y - view.current.y) / view.current.scale,
  ]
  const zoom = (factor: number, at?: BoardPoint) => {
    const bounds = canvas.current?.getBoundingClientRect()
    const center = at || [(bounds?.width || 0) / 2, (bounds?.height || 0) / 2]
    const anchor = world(center)
    const scale = Math.min(6, Math.max(0.3, view.current.scale * factor))
    view.current = { scale, x: center[0] - anchor[0] * scale, y: center[1] - anchor[1] * scale }
    draw()
  }
  const finish = (event: React.PointerEvent, commit: boolean) => {
    const gesture = drag.current
    if (gesture?.id !== event.pointerId) return
    drag.current = null
    if (commit && gesture.points?.length) void save({ kind: 'stroke', color, points: gesture.points })
    draw()
  }
  const undo = () => {
    const hidden = new Set(Array.from(entries.current.values()).flatMap(({ item }) => item.kind === 'undo' ? [item.target] : []))
    const latest = Array.from(entries.current.values()).reverse().find(
      ({ author_id, item, id }) => author_id === userId && item.kind !== 'undo' && !hidden.has(id),
    )
    if (latest && !saving && !pending) void save({ kind: 'undo', target: latest.id })
  }
  const control = 'rounded-md border border-slate-300 p-2 hover:bg-sky-50 aria-pressed:bg-sky-200 disabled:opacity-50'

  return (
    <section aria-label="Bảng trắng cuộc gọi" className="absolute inset-2 z-30 flex flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-xl">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 p-2">
        <h2 className="mr-1 font-semibold">Bảng trắng</h2>
        <button type="button" className={control} aria-label="Vẽ" aria-pressed={tool === 'stroke'} onClick={() => setTool('stroke')}><Pencil size={16} /></button>
        <button type="button" className={control} aria-label="Di chuyển bảng" aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}><Hand size={16} /></button>
        <button type="button" className={control} aria-label="Ghi chú" aria-pressed={tool === 'note'} onClick={() => setTool('note')}><StickyNote size={16} /></button>
        <button type="button" className={control} aria-label="Hoàn tác nội dung của tôi" disabled={saving || !!pending} onClick={undo}><Undo2 size={16} /></button>
        <button type="button" className={control} aria-label="Thu nhỏ bảng" onClick={() => zoom(0.8)}><Minus size={16} /></button>
        <button type="button" className={control} aria-label="Phóng to bảng" onClick={() => zoom(1.25)}><Plus size={16} /></button>
        <button type="button" className={control} aria-label="Về vị trí ban đầu" onClick={() => { view.current = { x: 0, y: 0, scale: 1 }; draw() }}><RotateCcw size={16} /></button>
        {boardColors.map((ink) => <button type="button" key={ink} aria-label={`Màu ${ink}`} aria-pressed={color === ink}
          className="h-6 w-6 rounded-full border border-slate-200 aria-pressed:ring-2 aria-pressed:ring-sky-600" style={{ background: ink }} onClick={() => setColor(ink)} />)}
        <button type="button" className={`${control} ml-auto`} aria-label="Đóng bảng trắng" onClick={onClose}><X size={16} /></button>
      </div>
      {tool === 'note' && <label className="flex flex-col gap-1 px-3 py-2 text-xs text-slate-600">Nhập ghi chú rồi chạm vào vị trí muốn đặt
        <input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
      </label>}
      {error && <p role="status" className="bg-amber-50 px-3 py-1 text-sm text-amber-900">{error} {pending &&
        <button type="button" className="font-semibold underline" disabled={saving} onClick={() => void save(pending.item, pending.id)}>Thử lại</button>}
      </p>}
      <canvas ref={canvas} aria-label="Vùng vẽ và đặt ghi chú" className="min-h-0 w-full flex-1 touch-none"
        style={{ cursor: tool === 'pan' ? 'grab' : 'crosshair' }}
        onPointerDown={(event) => {
          if (drag.current || event.button !== 0) return
          const local = point(event)
          if (tool === 'note') {
            if (note.trim() && !pending && !saving) void save({ kind: 'note', at: world(local), color, text: note.trim() })
            return
          }
          if (tool === 'stroke' && (saving || pending)) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { id: event.pointerId, local, points: tool === 'stroke' ? [world(local)] : undefined }
          draw()
        }}
        onPointerMove={(event) => {
          const gesture = drag.current
          if (gesture?.id !== event.pointerId) return
          const local = point(event)
          if (gesture.points) {
            if (gesture.points.length >= 1000) return
            gesture.points.push(world(local))
          } else {
            view.current.x += local[0] - gesture.local[0]
            view.current.y += local[1] - gesture.local[1]
          }
          gesture.local = local
          draw()
        }}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onWheel={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          zoom(event.deltaY > 0 ? 0.9 : 1.1, [event.clientX - bounds.left, event.clientY - bounds.top])
        }} />
    </section>
  )
}
