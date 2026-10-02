/**
 * Sen Heart 1.1 - Core System Types & Interfaces
 * Kiến trúc quản lý tập trung luồng trang web, phân cấp ưu tiên luồng,
 * triệt tiêu crash (Crash Shield) và tối ưu hóa hiệu năng toàn diện.
 */

export type ThreadPriority = 'critical' | 'high' | 'normal' | 'background'

export interface ThreadRecord {
  id: string
  name: string
  active: boolean
  startedAt: number
  priority: ThreadPriority
  controller: AbortController
  cleanups: Array<() => void>
  retryCount?: number
  lastError?: string | null
}

export interface CacheCleanReport {
  timestamp: number
  keysRemoved: number
  estimatedBytesSaved: number
  status: 'completed' | 'skipped'
}

export interface SecurityStatus {
  status: 'secure' | 'warning' | 'alert'
  lastVerifiedAt: number
  protocolVersion: string
  activeGuards: string[]
  details: string
}

export interface SenHeartTelemetry {
  version: string
  buildSignature: string
  activeThreads: number
  criticalThreadsCount: number
  threadList: Array<{
    id: string
    name: string
    durationMs: number
    active: boolean
    priority: ThreadPriority
  }>
  cacheSavingsKb: number
  totalCleanups: number
  securityStatus: SecurityStatus
  memoryHealth: 'optimal' | 'moderate' | 'high'
  lastOptimizationAt: number | null
}
