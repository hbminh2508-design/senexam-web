'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  ShieldAlert,
  Send,
  X,
  Lock,
  Check,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'
import { SenChatMessage } from '@/lib/senChatStorage'

interface ChatSenAiConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { query: string; contextMessages: SenChatMessage[] }) => Promise<void>
  initialQuery: string
  recentMessages: SenChatMessage[]
  isLoading?: boolean
}

export default function ChatSenAiConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  initialQuery,
  recentMessages,
  isLoading = false,
}: ChatSenAiConfirmModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [contextCount, setContextCount] = useState<number>(2) // Default 2 tin nhắn gần nhất
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Cập nhật khi mở lại modal với câu hỏi mới
  React.useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setErrorMsg(null)
    }
  }, [isOpen, initialQuery])

  if (!isOpen) return null

  // Lấy các tin nhắn ngữ cảnh được chọn
  const validHistory = recentMessages
    .filter((m) => m.type === 'text' && m.content)
    .slice(-5) // Tối đa 5 tin nhắn gần nhất
  const selectedContext = validHistory.slice(-contextCount)

  const handleSend = async () => {
    const trimmed = query.trim()
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập nội dung câu hỏi muốn gửi cho SenAI.')
      return
    }

    try {
      setErrorMsg(null)
      await onConfirm({
        query: trimmed,
        contextMessages: selectedContext,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi gửi câu hỏi tới SenAI.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 dark:from-purple-950/40 dark:to-indigo-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Xác nhận gửi tới SenAI
              </h3>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                Vòng bảo mật E2EE & Giải bài tập thông minh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* E2EE Warning Box */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-800 dark:text-amber-300 flex items-start gap-3 leading-relaxed">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Thông báo bảo mật đầu-cuối (E2EE)</span>
              <span>
                Toàn bộ hội thoại này đang được mã hóa đầu-cuối. Khi bạn xác nhận, <strong>chỉ câu hỏi và các tin nhắn bạn chủ động chọn dưới đây</strong> mới được giải mã và gửi đến máy chủ SenAI để xử lý câu trả lời.
              </span>
            </div>
          </div>

          {/* Question input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">
              Nội dung câu hỏi gửi tới SenAI:
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="Nhập hoặc chỉnh sửa câu hỏi của bạn..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Context Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Gửi kèm ngữ cảnh tin nhắn trước đó:
              </label>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setContextCount(cnt)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      contextCount === cnt
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {cnt === 0 ? 'Không' : `${cnt} tin`}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected messages preview */}
            {contextCount > 0 && selectedContext.length > 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 space-y-1.5 max-h-32 overflow-y-auto">
                {selectedContext.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {msg.senderName}:
                    </span>
                    <span className="truncate">{msg.content}</span>
                  </div>
                ))}
              </div>
            ) : contextCount > 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                (Chưa có tin nhắn ngữ cảnh trước đó trong phiên này)
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                (Chỉ gửi duy nhất câu hỏi trên, không gửi kèm ngữ cảnh)
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-2.5 text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span>Chỉ gửi nội dung bạn đồng ý</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-medium text-xs transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium text-xs shadow-md shadow-purple-600/20 transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Đang gửi...' : 'Đồng ý gửi tới SenAI'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
