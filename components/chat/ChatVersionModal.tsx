'use client'

import React, { useEffect } from 'react'
import { X, Sparkles, CheckCircle2, Calendar, ShieldCheck, History } from 'lucide-react'
import { SEN_CHAT_CURRENT_VERSION, SEN_CHAT_CHANGELOG } from '@/lib/senChatVersion'

interface ChatVersionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatVersionModal({ isOpen, onClose }: ChatVersionModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-version-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header gradient banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 p-6 text-white">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-black/10 blur-xl pointer-events-none" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg shadow-black/10">
              <img
                src="/sen-chat-logo.png"
                alt="Sen Chat"
                className="h-full w-full rounded-xl object-contain"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <ShieldCheck className="h-2.5 w-2.5 text-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 id="chat-version-title" className="text-xl font-black tracking-tight text-white">
                  Sen Chat
                </h3>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
                  v{SEN_CHAT_CURRENT_VERSION}
                </span>
                <span className="rounded-full bg-emerald-400/90 text-emerald-950 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                  Mới nhất
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85">
                Nền tảng nhắn tin bảo mật E2EE & MLS hàng đầu của SenExam
              </p>
            </div>
          </div>
        </div>

        {/* Content Body: Changelog list */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <History className="h-3.5 w-3.5" />
              <span>Nhật ký cập nhật (Changelog)</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Tổng cộng {SEN_CHAT_CHANGELOG.length} phiên bản
            </span>
          </div>

          <div className="space-y-3">
            {SEN_CHAT_CHANGELOG.map((log) => (
              <div
                key={log.version}
                className={`rounded-2xl border p-4 transition-all ${
                  log.isLatest
                    ? 'border-emerald-500/40 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-xl px-2.5 py-1 text-xs font-black ${
                        log.isLatest
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      v{log.version}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      {log.title}
                      {log.isBugFixOnly && (
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                    <Calendar className="h-3 w-3" />
                    <span>{log.releaseDate}</span>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {log.changes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                          log.isLatest ? 'text-emerald-500' : 'text-slate-400'
                        }`}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/80">
          <span className="text-[11px] text-slate-400">
            Mã hóa đầu cuối Signal • IETF MLS RFC 9420
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-bold text-white dark:text-slate-900 transition hover:opacity-90 active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
