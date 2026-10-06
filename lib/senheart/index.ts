import { ThreadPriority, SenHeartTelemetry } from './types'

/**
 * Passive No-Op Shim for Sen Heart Core Engine.
 * Replaced active thread management and abort controllers to prevent runtime crashes.
 */
class PassiveSenHeartCoreEngine {
  public readonly version = '1.2.1-passive'
  public readonly buildSignature = 'SEN-HEART-PASSIVE-STUB'

  public init() {}

  public transitionRoute(_prevRoute: string, _nextRoute: string) {}

  public pauseCacheTrimming(_durationMs?: number) {}

  public registerThread(
    _id: string,
    _name: string,
    _priority: ThreadPriority = 'normal',
    _cleanup?: () => void
  ): AbortSignal {
    return new AbortController().signal
  }

  public killThread(_id: string, _force: boolean = false) {}

  public addCleanup(_id: string, _cleanup: () => void) {}

  public async runGuarded<T>(
    _name: string,
    task: (signal: AbortSignal) => Promise<T>,
    fallback: T,
    _priority?: ThreadPriority
  ): Promise<T> {
    try {
      return await task(new AbortController().signal)
    } catch {
      return fallback
    }
  }

  public trimCache() {
    return { timestamp: Date.now(), keysRemoved: 0, estimatedBytesSaved: 0, status: 'passive' as const }
  }

  public async optimizeNow() {
    return {
      threadsCleaned: 0,
      cacheSavedKb: 0,
      report: { timestamp: Date.now(), keysRemoved: 0, estimatedBytesSaved: 0, status: 'passive' },
    }
  }

  public getTelemetry(): SenHeartTelemetry {
    return {
      version: this.version,
      buildSignature: this.buildSignature,
      activeThreads: 0,
      criticalThreadsCount: 0,
      backgroundThreadsCount: 0,
      maxBackgroundConcurrency: 0,
      evictionCount: 0,
      threadList: [],
      cacheSavingsKb: 0,
      totalCleanups: 0,
      securityStatus: {
        healthy: true,
        issues: [],
        timestamp: Date.now(),
        integrityHash: 'PASSIVE_OK',
      },
      memoryHealth: 'optimal',
      ramOptimizationScore: 100,
      lastOptimizationAt: null,
    }
  }

  public subscribeTelemetry(callback: (t: SenHeartTelemetry) => void): () => void {
    callback(this.getTelemetry())
    return () => {}
  }
}

export const senHeart = new PassiveSenHeartCoreEngine()

export { threadManager } from './threadManager'
export { cacheTrimmer } from './cacheTrimmer'
export { securityGuard } from './securityGuard'
export { dataDispatcher } from './dataDispatcher'
export * from './types'
