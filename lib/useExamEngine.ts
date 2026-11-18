'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { saveExamDraft, loadExamDraft, removeExamDraft } from './examDraft'

export interface ExamEngineConfig {
  examId: string
  userId: string
  durationMinutes?: number
  totalQuestions?: number
  initialAnswers?: Record<string, any>
  initialBookmarked?: Record<string, boolean>
  autoSaveIntervalMs?: number // Mặc định 5000ms
  onSubmitExam?: (data: {
    answers: Record<string, any>
    tabSwitches: number
    blurCount: number
    timeSpent: number
    startedAt: string
  }) => Promise<any>
}

export interface ExamEngineState {
  answers: Record<string, any>
  bookmarked: Record<string, boolean>
  currentQuestionIndex: number
  isOffline: boolean
  isSubmitting: boolean
  isDraftSaved: boolean
  lastSavedAt: number | null
  tabSwitches: number
  blurCount: number
  startedAt: string
}

export function useExamEngine(config: ExamEngineConfig) {
  const {
    examId,
    userId,
    initialAnswers = {},
    initialBookmarked = {},
    autoSaveIntervalMs = 5000,
    onSubmitExam,
  } = config

  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers)
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>(initialBookmarked)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isDraftSaved, setIsDraftSaved] = useState<boolean>(true)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [tabSwitches, setTabSwitches] = useState<number>(0)
  const [blurCount, setBlurCount] = useState<number>(0)
  
  // Thời điểm bắt đầu làm bài cố định tại client
  const startedAtRef = useRef<string>(new Date().toISOString())
  const answersRef = useRef<Record<string, any>>(answers)
  answersRef.current = answers
  const bookmarkedRef = useRef<Record<string, boolean>>(bookmarked)
  bookmarkedRef.current = bookmarked

  // 1. Khôi phục bản nháp khi khởi tạo
  useEffect(() => {
    if (!examId || !userId) return
    const draft = loadExamDraft(examId, userId)
    if (draft && draft.answers && Object.keys(draft.answers).length > 0) {
      setAnswers((prev) => ({ ...draft.answers, ...prev }))
      if (draft.bookmarked) {
        setBookmarked((prev) => ({ ...draft.bookmarked, ...prev }))
      }
      if (typeof draft.tabSwitches === 'number') {
        setTabSwitches(draft.tabSwitches)
      }
      setLastSavedAt(draft.timestamp)
    }
  }, [examId, userId])

  // 2. Theo dõi kết nối mạng (Offline resilience)
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      // Tự động đồng bộ lại nháp khi có mạng lại
      if (examId && userId) {
        saveExamDraft(examId, userId, answersRef.current, {
          bookmarked: bookmarkedRef.current,
        })
      }
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [examId, userId])

  // 3. Theo dõi chuyển tab và mất tiêu điểm (Proctoring Metrics)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1)
      }
    }
    const handleBlur = () => {
      setBlurCount((prev) => prev + 1)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // 4. Lưu nháp định kỳ an toàn vào localStorage
  useEffect(() => {
    if (!examId || !userId) return
    const interval = setInterval(() => {
      saveExamDraft(examId, userId, answersRef.current, {
        bookmarked: bookmarkedRef.current,
        tabSwitches,
      })
      setIsDraftSaved(true)
      setLastSavedAt(Date.now())
    }, autoSaveIntervalMs)

    return () => clearInterval(interval)
  }, [examId, userId, autoSaveIntervalMs, tabSwitches])

  // Callbacks điều hướng và thao tác đáp án
  const selectAnswer = useCallback((questionKey: string, value: any) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionKey]: value }
      answersRef.current = next
      return next
    })
    setIsDraftSaved(false)
  }, [])

  const toggleBookmark = useCallback((questionKey: string) => {
    setBookmarked((prev) => {
      const next = { ...prev, [questionKey]: !prev[questionKey] }
      bookmarkedRef.current = next
      return next
    })
  }, [])

  const goToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index)
  }, [])

  const nextQuestion = useCallback((maxCount?: number) => {
    setCurrentQuestionIndex((prev) => {
      if (typeof maxCount === 'number' && prev >= maxCount - 1) return prev
      return prev + 1
    })
  }, [])

  const prevQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const submit = useCallback(
    async (timeSpentSeconds?: number) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const payload = {
          answers: answersRef.current,
          tabSwitches,
          blurCount,
          timeSpent: timeSpentSeconds || 0,
          startedAt: startedAtRef.current,
        }

        let res: any = null
        if (onSubmitExam) {
          res = await onSubmitExam(payload)
        } else {
          const apiRes = await fetch('/api/exams/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              examId,
              userId,
              ...payload,
            }),
          })
          res = await apiRes.json()
        }

        // Dọn dẹp nháp khi nộp bài thành công
        if (res?.success) {
          removeExamDraft(examId, userId)
        }
        return res
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, examId, userId, tabSwitches, blurCount, onSubmitExam]
  )

  return {
    // States
    answers,
    bookmarked,
    currentQuestionIndex,
    isOffline,
    isSubmitting,
    isDraftSaved,
    lastSavedAt,
    tabSwitches,
    blurCount,
    startedAt: startedAtRef.current,
    // Actions
    setAnswers,
    setBookmarked,
    selectAnswer,
    toggleBookmark,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    submit,
  }
}
