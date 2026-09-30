/**
 * Sen Heart 1.0 - Core System Types & Interfaces
 * Kiến trúc quản lý tập trung luồng trang web, bộ nhớ cache và an ninh dữ liệu.
 */

export interface ThreadRecord {
  id: string
  name: string
  active: boolean
  startedAt: number
  controller: AbortController
  cleanups: Array<() => void>
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
  threadList: Array<{
    id: string
    name: string
    durationMs: number
    active: boolean
  }>
  cacheSavingsKb: number
  totalCleanups: number
  securityStatus: SecurityStatus
  memoryHealth: 'optimal' | 'moderate' | 'high'
  lastOptimizationAt: number | null
}
