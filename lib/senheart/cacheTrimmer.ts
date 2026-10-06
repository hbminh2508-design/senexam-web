/**
 * Passive No-Op Cache Trimmer Shim
 * Does not touch localStorage or cookies
 */
import { CacheCleanReport } from './types'

class PassiveSenHeartCacheTrimmer {
  public pauseTrimming(_durationMs: number = 15000) {}

  public trimCache(): CacheCleanReport {
    return {
      timestamp: Date.now(),
      keysRemoved: 0,
      estimatedBytesSaved: 0,
      status: 'passive' as const,
    }
  }

  public getTotalSavingsKb(): number {
    return 0
  }

  public getTotalCleanups(): number {
    return 0
  }
}

export const cacheTrimmer = new PassiveSenHeartCacheTrimmer()
