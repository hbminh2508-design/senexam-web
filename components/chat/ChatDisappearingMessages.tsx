'use client'

import React from 'react'
import { Timer, Check } from 'lucide-react'

export interface DisappearingTimerOption {
  label: string
  seconds: number
}

export const DISAPPEARING_OPTIONS: DisappearingTimerOption[] = [
  { label: 'Tắt', seconds: 0 },
  { label: '30 giây', seconds: 30 },
  { label: '5 phút', seconds: 300 },
  { label: '1 giờ', seconds: 3600 },
  { label: '24 giờ', seconds: 86400 },
  { label: '7 ngày', seconds: 604800 },
]

interface ChatDisappearingMessagesProps {
  currentTtl: number
  onChangeTtl: (seconds: number) => void
}

export default function ChatDisappearingMessages({
  currentTtl,
  onChangeTtl,
}: ChatDisappearingMessagesProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-2 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <Timer className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Tin nhắn tự hủy (TTL)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tự động xóa tin nhắn sau khi xem
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {DISAPPEARING_OPTIONS.map((opt) => {
          const isSelected = currentTtl === opt.seconds
          return (
            <button
              key={opt.seconds}
              type="button"
              onClick={() => onChangeTtl(opt.seconds)}
              className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition active:scale-95 ${
                isSelected
                  ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{opt.label}</span>
              {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
