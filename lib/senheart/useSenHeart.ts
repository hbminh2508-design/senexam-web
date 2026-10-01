'use client'

import { useEffect, useRef } from 'react'
import { senHeart } from './index'

/**
 * Hook quản lý luồng trang web thông qua Sen Heart 1.0.
 * Tự động đăng ký luồng khi component mount và tiêu hủy sạch sẽ (kill thread, abort fetch, clear memory)
 * khi người dùng thoát ra khỏi trang.
 */
export function useSenHeartThread(threadName: string, onCleanup?: () => void) {
  const signalRef = useRef<AbortSignal | null>(null)
  const threadIdRef = useRef<string>('')
  const cleanupRef = useRef<(() => void) | undefined>(onCleanup)
  cleanupRef.current = onCleanup

  useEffect(() => {
    const threadId = `page_${threadName.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`
    threadIdRef.current = threadId

    const signal = senHeart.registerThread(threadId, threadName, () => {
      try {
        if (cleanupRef.current) cleanupRef.current()
      } catch (e) {
        console.warn('Error in thread cleanup:', e)
      }
    })
    signalRef.current = signal

    return () => {
      // Khi rời trang, Sen Heart lập tức tiêu hủy luồng và gọi cleanup
      senHeart.killThread(threadId)
    }
  }, [threadName])

  return {
    getSignal: () => signalRef.current,
    threadId: threadIdRef.current,
    optimizeNow: () => senHeart.optimizeNow(),
  }
}
