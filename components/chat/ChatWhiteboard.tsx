'use client'

import { Download, Hand, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCcw, StickyNote, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client'
import { chatRequest } from '@/lib/senChatBrowser'
import { boardColors, boardDataTopic, boardPointLimit, boardStrokeEndsAtRelease, readBoardPacket, traceBoardStroke, type BoardEntry, type BoardItem, type BoardPacket, type BoardPoint, type BoardView } from '@/lib/senChatWhiteboard'
import { saveBoardPdf } from '@/lib/senChatBoardPdf'

type BoardMode = 'shared' | 'private'
type Stroke = { id: string; points: BoardPoint[]; color: string; sent: number }

export default function ChatWhiteboard({ callId, userId, room, mode, visible, onMode, onClose }: {
  callId: string
  userId: string
  room: Room | null
  mode: BoardMode
  visible: boolean
  onMode: (mode: BoardMode) => void
  onClose: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const committedCanvas = useRef<HTMLCanvasElement>(null)
  const bounds = useRef<DOMRect | null>(null)
  const revision = useRef(0)
  const pendingPaint = useRef<BoardEntry[]>([])
  const committedFrame = useRef<{ element: HTMLCanvasElement; key: string } | null>(null)
  const activeFrame = useRef<{ element: HTMLCanvasElement; key: string; lengths: Map<BoardPoint[], number> } | null>(null)
  const entries = useRef(new Map<string, BoardEntry>())
  const previews = useRef(new Map<string, { points: BoardPoint[]; color: string; author: string }>())
  const strokePaths = useRef(new WeakMap<BoardPoint[], Path2D>())
  const cursor = useRef<BoardEntry | null>(null)
  const view = useRef({ x: 0, y: 0, scale: 1 })
  const remoteView = useRef<BoardView | null>(null)
  const sharedView = useRef<BoardView | null>(null)
  const follows = useRef(true)
  const frame = useRef(0)
  const lastPublish = useRef(0)
  const viewDirty = useRef(false)
  const drag = useRef<{ id: number; pointerType: string; local: BoardPoint; stroke?: Stroke } | null>(null)
  const pointers = useRef(new Map<number, BoardPoint>())
  const panningWithTwoFingers = useRef(false)
  const writes = useRef(new Map<string, BoardItem>())
  const sending = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const [tool, setTool] = useState<'stroke' | 'pan' | 'note'>('stroke')
  const [color, setColor] = useState(boardColors[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ id: string; item: BoardItem } | null>(null)
  const [saving, setSaving] = useState(false)
  const [follow, setFollow] = useState(true)
  const path = `whiteboard?callId=${callId}`
  const shared = mode === 'shared'

  const keepEntry = useCallback((entry: BoardEntry) => {
    const previous = entries.current.get(entry.id)
    entries.current.set(entry.id, entry)
    if (!previous && entry.item.kind !== 'undo') pendingPaint.current.push(entry)
    else revision.current += 1
  }, [])

  const publish = useCallback((packet: BoardPacket, destinationIdentities?: string[]) => {
    if (!shared || !room) return
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)), {
      reliable: true, topic: boardDataTopic, destinationIdentities,
    }).catch(() => {})
  }, [shared, room])

  const paint = useCallback((element: HTMLCanvasElement, width: number, height: number, ratio: number,
    { x, y, scale }: typeof view.current, layer: 'committed' | 'active',
    additions?: BoardEntry[], priorLengths?: Map<BoardPoint[], number>) => {
    const ctx = element?.getContext('2d')
    if (!ctx) return
    if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio)
    if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (layer === 'committed' && !additions) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, width, height)
    } else if (layer === 'active' && !priorLengths) {
      ctx.clearRect(0, 0, width, height)
    }
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    const drawStroke = (points: BoardPoint[], ink: string, complete = false) => {
      const drawn = priorLengths?.get(points) ?? 0
      if (points.length <= drawn) return
      ctx.strokeStyle = ink
      let path = complete ? strokePaths.current.get(points) : undefined
      if (!path) {
        path = new Path2D()
        traceBoardStroke(path, points, drawn)
        if (complete) strokePaths.current.set(points, path)
      }
      ctx.stroke(path)
    }
    if (layer === 'active') {
      for (const preview of previews.current.values()) drawStroke(preview.points, preview.color)
      const stroke = drag.current?.stroke
      if (stroke) drawStroke(stroke.points, stroke.color)
      return
    }
    const hidden = new Set(additions ? [] : Array.from(entries.current.values()).flatMap(({ item }) => item.kind === 'undo' ? [item.target] : []))
    for (const { id, item } of additions ?? entries.current.values()) {
      if (hidden.has(id)) continue
      if (item.kind === 'stroke') drawStroke(item.points, item.color, true)
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
  }, [])

  const draw = useCallback(() => {
    const active = canvas.current
    const committed = committedCanvas.current
    const size = bounds.current
    if (!active || !committed || !size?.width || !size.height) return
    const { width, height } = size
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const { x, y, scale } = view.current
    const viewportKey = [width, height, ratio, x, y, scale].join(':')
    const key = viewportKey + ':' + revision.current
    if (committedFrame.current?.element !== committed || committedFrame.current.key !== key) {
      paint(committed, width, height, ratio, view.current, 'committed')
      committedFrame.current = { element: committed, key }
    } else if (pendingPaint.current.length) {
      paint(committed, width, height, ratio, view.current, 'committed', pendingPaint.current)
    }
    pendingPaint.current = []
    const lengths = new Map<BoardPoint[], number>()
    for (const { points } of previews.current.values()) lengths.set(points, points.length)
    const stroke = drag.current?.stroke
    if (stroke) lengths.set(stroke.points, stroke.points.length)
    const previous = activeFrame.current
    const intact = previous?.element === active && previous.key === viewportKey &&
      Array.from(previous.lengths.keys()).every((points) => lengths.has(points))
    if (!intact || lengths.size !== previous.lengths.size ||
      Array.from(lengths).some(([points, length]) => previous.lengths.get(points) !== length)) {
      paint(active, width, height, ratio, view.current, 'active', undefined, intact ? previous.lengths : undefined)
      activeFrame.current = { element: active, key: viewportKey, lengths }
    }
  }, [paint])

  const flushStroke = useCallback((stroke: Stroke) => {
    while (shared && room && stroke.sent < stroke.points.length) {
      const points = stroke.points.slice(stroke.sent, stroke.sent + 120)
      publish({ type: 'points', id: stroke.id, offset: stroke.sent, color: stroke.color, points })
      stroke.sent += points.length
    }
  }, [publish, room, shared])

  const placeView = useCallback(({ center, size, scale }: BoardView) => {
    const local = bounds.current
    if (!local?.width || !local.height) return
    const fittedScale = Math.max(0.05, scale * Math.min(1, local.width / size[0], local.height / size[1]))
    view.current = { x: local.width / 2 - center[0] * fittedScale, y: local.height / 2 - center[1] * fittedScale, scale: fittedScale }
  }, [])

  const scheduleDraw = useCallback(() => {
    if (!visible || frame.current) return
    frame.current = requestAnimationFrame((time) => {
      frame.current = 0
      draw()
      const stroke = drag.current?.stroke
      if (!viewDirty.current && (!stroke || stroke.sent === stroke.points.length)) return
      if (!shared || !room) { viewDirty.current = false; return }
      if (time - lastPublish.current < 40) { scheduleDraw(); return }
      lastPublish.current = time
      if (viewDirty.current && sharedView.current) {
        viewDirty.current = false
        publish({ type: 'view', view: sharedView.current })
      }
      if (stroke) flushStroke(stroke)
    })
  }, [draw, flushStroke, publish, room, shared, visible])

  useEffect(() => {
    if (!shared || !room) return
    const receive = (data: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (!participant || topic !== boardDataTopic) return
      const packet = readBoardPacket(data)
      if (!packet) return
      if (packet.type === 'request-view') {
        if (visible && sharedView.current) publish({ type: 'view', view: sharedView.current }, [participant.identity])
        return
      }
      if (packet.type === 'view') {
        remoteView.current = packet.view
        sharedView.current = null
        viewDirty.current = false
        if (follows.current && !drag.current && !pointers.current.size) placeView(packet.view)
      } else if (!entries.current.has(packet.id)) {
        const author = participant.identity
        const preview = previews.current.get(packet.id)
        if (preview && preview.author !== author) return
        if (packet.type === 'cancel' || packet.type === 'finish') {
          previews.current.delete(packet.id)
          if (packet.type === 'finish' && preview?.points.length) {
            keepEntry({ id: packet.id, author_id: author, item: { kind: 'stroke', points: preview.points, color: preview.color }, created_at: '' })
          }
        } else if (packet.type === 'item') {
          if (packet.item.kind === 'undo' && entries.current.get(packet.item.target)?.author_id !== author) return
          keepEntry({ id: packet.id, author_id: author, item: packet.item, created_at: '' })
        } else if (packet.type === 'points' && packet.offset === (preview?.points.length ?? 0)) {
          if (preview) preview.points.push(...packet.points)
          else previews.current.set(packet.id, { points: packet.points, color: packet.color, author })
        }
      }
      scheduleDraw()
    }
    const sendView = (participant: RemoteParticipant) => {
      if (visible && sharedView.current) publish({ type: 'view', view: sharedView.current }, [participant.identity])
    }
    const clearPreviews = (participant: RemoteParticipant) => {
      for (const [id, preview] of previews.current) if (preview.author === participant.identity) previews.current.delete(id)
      scheduleDraw()
    }
    room.on(RoomEvent.DataReceived, receive).on(RoomEvent.ParticipantConnected, sendView).on(RoomEvent.ParticipantDisconnected, clearPreviews)
    if (visible) publish({ type: 'request-view' })
    return () => {
      room.off(RoomEvent.DataReceived, receive).off(RoomEvent.ParticipantConnected, sendView).off(RoomEvent.ParticipantDisconnected, clearPreviews)
    }
  }, [keepEntry, placeView, publish, room, scheduleDraw, shared, visible])

  useEffect(() => {
    if (!visible) return
    const refresh = () => {
      bounds.current = canvas.current?.getBoundingClientRect() ?? null
      if (shared && follows.current && remoteView.current) placeView(remoteView.current)
      scheduleDraw()
    }
    const observer = new ResizeObserver(refresh)
    if (canvas.current) observer.observe(canvas.current)
    refresh()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
      const stroke = drag.current?.stroke
      if (stroke?.sent) publish({ type: 'cancel', id: stroke.id })
      drag.current = null
      pointers.current.clear()
      panningWithTwoFingers.current = false
    }
  }, [placeView, publish, scheduleDraw, shared, visible])

  useEffect(() => {
    if (!shared || !visible) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function sync() {
      let delay = 1800
      try {
        const last = cursor.current
        const offset = last ? `&at=${encodeURIComponent(last.created_at)}&id=${last.id}` : ''
        const { entries: latest } = await chatRequest<{ entries: BoardEntry[] }>(path + offset)
        if (stopped) return
        latest.forEach((entry) => {
          const local = entries.current.get(entry.id)
          if (local && JSON.stringify(local.item) === JSON.stringify(entry.item)) local.created_at = entry.created_at
          else keepEntry(entry)
          previews.current.delete(entry.id)
        })
        if (latest.length) {
          cursor.current = latest[latest.length - 1]
          scheduleDraw()
        }
        if (latest.length === 200) delay = 0
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ bảng trắng.')
      }
      if (!stopped) timer = setTimeout(sync, delay)
    }
    void sync()
    return () => { stopped = true; clearTimeout(timer) }
  }, [keepEntry, path, scheduleDraw, shared, visible])

  const save = async (item: BoardItem, id = crypto.randomUUID()) => {
    const fresh = !entries.current.has(id)
    if (fresh) {
      keepEntry({ id, author_id: userId, item, created_at: '' })
    }
    scheduleDraw()
    if (!shared) return
    if (fresh && item.kind !== 'stroke') publish({ type: 'item', id, item })
    writes.current.set(id, item)
    if (sending.current) return
    sending.current = true
    setSaving(true)
    setError('')
    try {
      for (const [queuedId, queuedItem] of writes.current) {
        setPending({ id: queuedId, item: queuedItem })
        await chatRequest(path, { id: queuedId, item: queuedItem })
        writes.current.delete(queuedId)
      }
      setPending(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bảng trắng.')
    } finally { sending.current = false; setSaving(false) }
  }

  const exportPdf = () => {
    const hidden = new Set(Array.from(entries.current.values()).flatMap(({ item }) => item.kind === 'undo' ? [item.target] : []))
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    const include = ([x, y]: BoardPoint) => {
      left = Math.min(left, x); top = Math.min(top, y)
      right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
    for (const { id, item } of entries.current.values()) {
      if (hidden.has(id)) continue
      if (item.kind === 'stroke') item.points.forEach(include)
      if (item.kind === 'note') { include(item.at); include([item.at[0] + 244, item.at[1] + 260]) }
    }
    if (!Number.isFinite(left)) { setError('Hãy thêm nội dung trước khi lưu PDF.'); return }
    left -= 24; top -= 24; right += 24; bottom += 24
    const scale = Math.min(2, 2048 / Math.max(right - left, bottom - top))
    const output = document.createElement('canvas')
    output.width = Math.ceil((right - left) * scale)
    output.height = Math.ceil((bottom - top) * scale)
    paint(output, output.width, output.height, 1, { x: -left * scale, y: -top * scale, scale }, 'committed')
    saveBoardPdf(output)
  }

  const point = (event: { clientX: number; clientY: number }, bounds: DOMRect): BoardPoint => {
    return [event.clientX - bounds.left, event.clientY - bounds.top]
  }
  const world = ([x, y]: BoardPoint): BoardPoint => [
    (x - view.current.x) / view.current.scale, (y - view.current.y) / view.current.scale,
  ]
  const shareView = () => {
    const size = bounds.current
    if (shared && size?.width && size.height) {
      sharedView.current = {
        center: world([size.width / 2, size.height / 2]),
        size: [size.width, size.height],
        scale: view.current.scale,
      }
      remoteView.current = null
      viewDirty.current = true
    }
    scheduleDraw()
  }
  const zoom = (factor: number, at?: BoardPoint) => {
    const size = bounds.current
    const center = at || [(size?.width || 0) / 2, (size?.height || 0) / 2]
    const anchor = world(center)
    const scale = Math.min(6, Math.max(0.05, view.current.scale * factor))
    view.current = { scale, x: center[0] - anchor[0] * scale, y: center[1] - anchor[1] * scale }
    shareView()
  }
  const commitStroke = (stroke: Stroke) => {
    if (viewDirty.current && sharedView.current) {
      viewDirty.current = false
      publish({ type: 'view', view: sharedView.current })
    }
    flushStroke(stroke)
    publish({ type: 'finish', id: stroke.id })
    void save({ kind: 'stroke', color: stroke.color, points: stroke.points }, stroke.id)
  }
  const appendPoint = (gesture: NonNullable<typeof drag.current>, local: BoardPoint) => {
    const stroke = gesture.stroke
    if (!stroke) return
    const next = world(local)
    const last = stroke.points[stroke.points.length - 1]
    if (next[0] === last[0] && next[1] === last[1]) return
    if (stroke.points.length === boardPointLimit) {
      commitStroke(stroke)
      gesture.stroke = { id: crypto.randomUUID(), points: [last, next], color: stroke.color, sent: 0 }
    } else {
      stroke.points.push(next)
    }
  }
  const finish = (event: React.PointerEvent, commit: boolean) => {
    pointers.current.delete(event.pointerId)
    if (panningWithTwoFingers.current) {
      if (!pointers.current.size) panningWithTwoFingers.current = false
      return
    }
    const gesture = drag.current
    if (gesture?.id !== event.pointerId) return
    drag.current = null
    if (gesture.stroke) {
      if (commit || (gesture.pointerType === 'pen' && gesture.stroke.points.length > 1)) {
        if (commit && bounds.current && boardStrokeEndsAtRelease(gesture.pointerType)) {
          appendPoint(gesture, point(event, bounds.current))
        }
        commitStroke(gesture.stroke)
      } else if (gesture.stroke.sent) publish({ type: 'cancel', id: gesture.stroke.id })
    }
    if (commit && tool === 'note' && note.trim()) void save({ kind: 'note', at: world(gesture.local), color, text: note.trim() })
    scheduleDraw()
  }
  const undo = () => {
    const hidden = new Set(Array.from(entries.current.values()).flatMap(({ item }) => item.kind === 'undo' ? [item.target] : []))
    const latest = Array.from(entries.current.values()).reverse().find(
      ({ author_id, item, id }) => author_id === userId && item.kind !== 'undo' && !hidden.has(id),
    )
    if (latest && !saving && !pending) void save({ kind: 'undo', target: latest.id })
  }
  const control = 'rounded-md border border-slate-300 p-2 hover:bg-sky-50 aria-pressed:bg-sky-200 disabled:opacity-50'
  if (!visible) return null

  return (
    <section aria-label="Bảng trắng cuộc gọi" className={`${expanded ? 'fixed inset-0 z-[10010] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]' : 'absolute inset-2 z-30 rounded-xl'} flex flex-col overflow-hidden bg-white text-slate-900 shadow-xl`}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 p-2">
        <h2 className="mr-1 font-semibold">Bảng trắng</h2>
        <div className="flex gap-1 text-xs" aria-label="Chế độ bảng trắng">
          <button type="button" className={control} aria-pressed={shared} onClick={() => onMode('shared')}>Bảng chung</button>
          <button type="button" className={control} aria-pressed={!shared} onClick={() => onMode('private')}>Bảng riêng</button>
        </div>
        {shared && <button type="button" className={`${control} text-xs`} aria-pressed={follow} onClick={() => {
          follows.current = !follow
          setFollow(!follow)
          if (!follow && remoteView.current) { placeView(remoteView.current); scheduleDraw() }
        }}>Theo dõi vùng nhìn</button>}
        <button type="button" className={control} onClick={exportPdf} aria-label="Lưu bảng trắng thành PDF"><Download size={16} /></button>
        <button type="button" className={control} onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Thoát toàn màn hình' : 'Bảng trắng toàn màn hình'}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button type="button" className={control} aria-label="Vẽ" aria-pressed={tool === 'stroke'} onClick={() => setTool('stroke')}><Pencil size={16} /></button>
        <button type="button" className={control} aria-label="Di chuyển bảng" aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}><Hand size={16} /></button>
        <button type="button" className={control} aria-label="Ghi chú" aria-pressed={tool === 'note'} onClick={() => setTool('note')}><StickyNote size={16} /></button>
        <button type="button" className={control} aria-label="Hoàn tác nội dung của tôi" disabled={saving || !!pending} onClick={undo}><Undo2 size={16} /></button>
        <button type="button" className={control} aria-label="Thu nhỏ bảng" onClick={() => zoom(0.8)}><Minus size={16} /></button>
        <button type="button" className={control} aria-label="Phóng to bảng" onClick={() => zoom(1.25)}><Plus size={16} /></button>
        <button type="button" className={control} aria-label="Về vị trí ban đầu" onClick={() => { view.current = { x: 0, y: 0, scale: 1 }; shareView() }}><RotateCcw size={16} /></button>
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
      <div className="relative min-h-0 flex-1">
      <canvas ref={committedCanvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={canvas} aria-label="Vùng vẽ và đặt ghi chú" className="absolute inset-0 h-full w-full touch-none select-none"
        style={{ cursor: tool === 'pan' ? 'grab' : 'crosshair' }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current?.pointerType === 'pen') return
          bounds.current = event.currentTarget.getBoundingClientRect()
          const local = point(event, bounds.current)
          if (event.pointerType === 'pen') {
            const interrupted = drag.current?.stroke
            if (interrupted?.sent) publish({ type: 'cancel', id: interrupted.id })
            pointers.current.clear()
            panningWithTwoFingers.current = false
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, local)
          if (pointers.current.size > 1) {
            const stroke = drag.current?.stroke
            if (stroke?.sent) publish({ type: 'cancel', id: stroke.id })
            drag.current = null
            panningWithTwoFingers.current = true
            scheduleDraw()
            return
          }
          drag.current = {
            id: event.pointerId, pointerType: event.pointerType, local,
            stroke: tool === 'stroke' ? { id: crypto.randomUUID(), color, points: [world(local)], sent: 0 } : undefined,
          }
          if (tool === 'stroke' || tool === 'note') shareView()
          else scheduleDraw()
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId)
          const size = bounds.current
          if (!previous || !size) return
          const local = point(event, size)
          pointers.current.set(event.pointerId, local)
          if (panningWithTwoFingers.current && pointers.current.size > 1) {
            view.current.x += (local[0] - previous[0]) / pointers.current.size
            view.current.y += (local[1] - previous[1]) / pointers.current.size
            shareView()
            return
          }
          const gesture = drag.current
          if (gesture?.id !== event.pointerId) return
          if (gesture.stroke) {
            const samples = event.nativeEvent.getCoalescedEvents?.()
            if (samples?.length) {
              for (const sample of samples) appendPoint(gesture, point(sample, size))
              if (event.timeStamp > samples[samples.length - 1].timeStamp) appendPoint(gesture, local)
            } else {
              appendPoint(gesture, local)
            }
            scheduleDraw()
          } else if (tool === 'pan') {
            view.current.x += local[0] - gesture.local[0]
            view.current.y += local[1] - gesture.local[1]
            shareView()
          }
          gesture.local = local
        }}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onLostPointerCapture={(event) => finish(event, false)}
        onWheel={(event) => {
          bounds.current = event.currentTarget.getBoundingClientRect()
          zoom(event.deltaY > 0 ? 0.9 : 1.1, point(event, bounds.current))
        }} />
      </div>
    </section>
  )
}
