export const boardColors = ['#1e293b', '#0369a1', '#be123c', '#047857', '#a16207']
export const boardPointLimit = 1000

export type BoardPoint = [number, number]
export type BoardItem =
  | { kind: 'stroke'; color: string; points: BoardPoint[] }
  | { kind: 'note'; color: string; at: BoardPoint; text: string }
  | { kind: 'undo'; target: string }

export interface BoardEntry {
  id: string
  author_id: string
  item: BoardItem
  created_at: string
}

export function validBoardPoint(point: unknown): point is BoardPoint {
  return Array.isArray(point) && point.length === 2 &&
    point.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9)
}

export function validBoardItem(item: BoardItem | undefined): item is BoardItem {
  if (!item) return false
  if (item.kind === 'undo') return typeof item.target === 'string'
  if (!boardColors.includes(item.color)) return false
  if (item.kind === 'note') return validBoardPoint(item.at) && typeof item.text === 'string' &&
    item.text.trim().length > 0 && item.text.length <= 240
  return item.kind === 'stroke' && Array.isArray(item.points) && item.points.length > 0 &&
    item.points.length <= boardPointLimit && item.points.every(validBoardPoint)
}

export const boardDataTopic = 'sen-whiteboard-data'
export type BoardView = { center: BoardPoint; size: BoardPoint; scale: number }
export type BoardPacket =
  | { type: 'view'; view: BoardView }
  | { type: 'request-view' }
  | { type: 'points'; id: string; offset: number; color: string; points: BoardPoint[] }
  | { type: 'finish' | 'cancel'; id: string }
  | { type: 'item'; id: string; item: BoardItem }

export function readBoardPacket(data: Uint8Array): BoardPacket | null {
  if (data.length > 12000) return null
  try {
    const packet = JSON.parse(new TextDecoder().decode(data)) as BoardPacket
    if (packet.type === 'view') {
      const { center, size, scale } = packet.view
      return validBoardPoint(center) && validBoardPoint(size) && size.every((value) => value >= 1 && value <= 10000) &&
        Number.isFinite(scale) && scale >= 0.05 && scale <= 6 ? packet : null
    }
    if (packet.type === 'request-view') return packet
    if (typeof packet.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(packet.id)) return null
    if (packet.type === 'cancel' || packet.type === 'finish') return packet
    if (packet.type === 'item') {
      return packet.item.kind !== 'stroke' && validBoardItem(packet.item) ? packet : null
    }
    if (packet.type === 'points' && Number.isInteger(packet.offset) && packet.offset >= 0 &&
      boardColors.includes(packet.color) && Array.isArray(packet.points) && packet.points.length > 0 &&
      packet.offset + packet.points.length <= boardPointLimit && packet.points.every(validBoardPoint)) return packet
  } catch {}
  return null
}
