'use client'

import React, { useState, useEffect, useRef, memo } from 'react'
import { formatTime } from '@/lib/timerUtils.mjs'

export { formatTime }

export interface ExamTimerIsolatedProps {
  initialSeconds: number
  onTimeUp?: () => void
  onWarning?: () => void
  warningThresholdSeconds?: number // Mặc định 300s (5 phút)
  criticalThresholdSeconds?: number // Mặc định 60s (1 phút)
  className?: string
  format?: 'mm:ss' | 'hh:mm:ss' | 'hsa_words'
  renderCustom?: (seconds: number, formatted: string, isWarning: boolean, isCritical: boolean) => React.ReactNode
}

/**
 * ==============================================================================
 * EXAM TIMER ISOLATED (ĐỒNG HỒ ĐẾM NGƯỢC CÔ LẬP TRẠNG THÁI)
 * - Tự quản lý state đếm giây cục bộ bên trong component này.
 * - KHÔNG BAO GIỜ kích hoạt render lại cây câu hỏi / toàn bộ phòng thi khi nhảy số.
 * - Đảm bảo hiệu năng tuyệt đối (INP < 50ms, 60fps) cho phòng thi 150 câu KaTeX.
 * - Hỗ trợ chuẩn truy cập ARIA (role="timer", aria-live="polite").
 * ==============================================================================
 */
export const ExamTimerIsolated = memo(function ExamTimerIsolated({
  initialSeconds,
  onTimeUp,
  onWarning,
  warningThresholdSeconds = 300,
  criticalThresholdSeconds = 60,
  className = '',
  format = 'mm:ss',
  renderCustom,
}: ExamTimerIsolatedProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp
  const onWarningRef = useRef(onWarning)
  onWarningRef.current = onWarning

  const warnedRef = useRef(false)
  const timedOutRef = useRef(false)

  // Reset khi initialSeconds thay đổi (ví dụ khi chuyển phần thi HSA)
  useEffect(() => {
    setSecondsLeft(initialSeconds)
    warnedRef.current = false
    timedOutRef.current = false
  }, [initialSeconds])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          if (!timedOutRef.current) {
            timedOutRef.current = true
            onTimeUpRef.current?.()
          }
          return 0
        }

        const next = prev - 1

        // Kích hoạt cảnh báo khi chạm ngưỡng
        if (next <= warningThresholdSeconds && !warnedRef.current) {
          warnedRef.current = true
          onWarningRef.current?.()
        }

        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [warningThresholdSeconds])

  const isWarning = secondsLeft <= warningThresholdSeconds && secondsLeft > criticalThresholdSeconds
  const isCritical = secondsLeft <= criticalThresholdSeconds
  const formatted = formatTime(secondsLeft, format)

  if (renderCustom) {
    return <>{renderCustom(secondsLeft, formatted, isWarning, isCritical)}</>
  }

  return (
    <span
      role="timer"
      aria-label={`Thời gian còn lại: ${formatted}`}
      aria-live="polite"
      className={`font-mono tabular-nums tracking-wider select-none ${
        isCritical
          ? 'text-rose-600 dark:text-rose-400 font-black animate-pulse'
          : isWarning
          ? 'text-amber-600 dark:text-amber-400 font-bold'
          : ''
      } ${className}`}
    >
      {formatted}
    </span>
  )
})

ExamTimerIsolated.displayName = 'ExamTimerIsolated'
