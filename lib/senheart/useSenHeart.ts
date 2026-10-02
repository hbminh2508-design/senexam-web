'use client'

import { useEffect, useRef } from 'react'
import { senHeart } from './index'
import { ThreadPriority } from './types'

/**
 * Hook quản lý luồng trang web thông qua Sen Heart 1.2.1.
 * Tự động đăng ký luồng với độ ưu tiên (Thread Priority) khi component mount
 * và tiêu hủy sạch sẽ (kill thread, clear memory) khi người dùng thoát ra khỏi trang.
 */
export function useSenHeartThread(
  threadName: string,
  priority: ThreadPriority = 'normal',
  onCleanup?: () => void
) {
  const signalRef = useRef<AbortSignal | null>(null)
  const threadIdRef = useRef<string>('')
  const cleanupRef = useRef<(() => void) | undefined>(onCleanup)
  cleanupRef.current = onCleanup

  useEffect(() => {
    const threadId = `page_${threadName.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`
    threadIdRef.current = threadId

    const signal = senHeart.registerThread(threadId, threadName, priority, () => {
      try {
        if (cleanupRef.current) cleanupRef.current()
      } catch (e) {
        console.warn('Error in thread cleanup:', e)
      }
    })
    signalRef.current = signal

    return () => {
      // Khi rời trang, Sen Heart tiêu hủy luồng nếu không phải critical
      senHeart.killThread(threadId, false)
    }
  }, [threadName, priority])

  return {
    getSignal: () => signalRef.current,
    threadId: threadIdRef.current,
    optimizeNow: () => senHeart.optimizeNow(),
    runGuarded: <T>(name: string, fn: (signal: AbortSignal) => Promise<T>, fallback: T) =>
      senHeart.runGuarded(name, fn, fallback, priority),
  }
}
