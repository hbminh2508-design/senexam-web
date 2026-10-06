/**
 * Passive No-Op Thread Manager Shim
 */
import { ThreadRecord, ThreadPriority } from './types'

class PassiveSenHeartThreadManager {
  public readonly MAX_BACKGROUND_TASKS = 5

  public registerThread(
    id: string,
    name: string,
    priority: ThreadPriority = 'normal',
    cleanup?: () => void
  ): AbortSignal {
    return new AbortController().signal
  }

  public killThread(_id: string, _force: boolean = false) {}

  public killAllTemporaryThreads() {}

  public transitionRoute(_prev: string, _next: string) {}

  public addCleanup(_id: string, _cleanup: () => void) {}

  public async runGuarded<T>(
    _name: string,
    task: (signal: AbortSignal) => Promise<T>,
    fallback: T,
    _priority: ThreadPriority = 'normal'
  ): Promise<T> {
    try {
      return await task(new AbortController().signal)
    } catch {
      return fallback
    }
  }

  public pruneZombieThreads() {}

  public getActiveCount(): number {
    return 0
  }

  public getCriticalCount(): number {
    return 0
  }

  public getBackgroundCount(): number {
    return 0
  }

  public getEvictionCount(): number {
    return 0
  }

  public getThreadList(): ThreadRecord[] {
    return []
  }

  public subscribe(_callback: () => void): () => void {
    return () => {}
  }
}

export const threadManager = new PassiveSenHeartThreadManager()
