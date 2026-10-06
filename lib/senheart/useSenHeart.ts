'use client'

import { ThreadPriority } from './types'

/**
 * Passive No-Op useSenHeartThread Hook Shim
 */
export function useSenHeartThread(
  _threadName: string,
  _priority: ThreadPriority = 'normal',
  _onCleanup?: () => void
) {
  return {
    getSignal: () => new AbortController().signal,
    threadId: 'passive_thread',
    optimizeNow: async () => ({
      threadsCleaned: 0,
      cacheSavedKb: 0,
      report: { timestamp: Date.now(), keysRemoved: 0, estimatedBytesSaved: 0, status: 'passive' },
    }),
    runGuarded: async <T>(_name: string, fn: (signal: AbortSignal) => Promise<T>, fallback: T) => {
      try {
        return await fn(new AbortController().signal)
      } catch {
        return fallback
      }
    },
  }
}
