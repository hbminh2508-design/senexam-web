export const boardColors = ['#1e293b', '#0369a1', '#be123c', '#047857', '#a16207']

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

function validPoint(point: unknown): boolean {
  return Array.isArray(point) && point.length === 2 &&
    point.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9)
}

export function validBoardItem(item: BoardItem | undefined): item is BoardItem {
  if (!item) return false
  if (item.kind === 'undo') return typeof item.target === 'string'
  if (!boardColors.includes(item.color)) return false
  if (item.kind === 'note') return validPoint(item.at) && typeof item.text === 'string' &&
    item.text.trim().length > 0 && item.text.length <= 240
  return item.kind === 'stroke' && Array.isArray(item.points) && item.points.length > 0 &&
    item.points.length <= 1000 && item.points.every(validPoint)
}
