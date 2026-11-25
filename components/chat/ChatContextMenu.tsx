'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Reply,
  Copy,
  Trash2,
  Pin,
  PinOff,
  CircleDot,
  CheckCheck,
  LogOut,
  Eraser,
} from 'lucide-react'

export type ChatContextMenuMode = 'message' | 'conversation'

export interface ChatContextMenuProps {
  isOpen: boolean
  mode: ChatContextMenuMode
  x: number
  y: number
  onClose: () => void

  // Message mode props
  message?: {
    id: string
    content?: string
    isMe?: boolean
    isSystem?: boolean
  } | null
  onReply?: () => void
  onCopy?: () => void
  onReact?: (emoji: string) => void
  onRecall?: () => void

  // Conversation mode props
  conversation?: {
    id: string
    partnerName?: string
    isGroup?: boolean
    isPinned?: boolean
    unreadCount?: number
    isSenAiStudio?: boolean
  } | null
  onTogglePin?: () => void
  onToggleUnread?: () => void
  onLeaveGroup?: () => void
  onClearHistory?: () => void
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'] as const

export default function ChatContextMenu({
  isOpen,
  mode,
  x,
  y,
  onClose,
  message,
  onReply,
  onCopy,
  onReact,
  onRecall,
  conversation,
  onTogglePin,
  onToggleUnread,
  onLeaveGroup,
  onClearHistory,
}: ChatContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Tự động căn chỉnh tọa độ để menu không bao giờ tràn ra ngoài viewport
  useLayoutEffect(() => {
    if (!isOpen) return
    const el = menuRef.current
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768
    const padding = 12

    if (!el) {
      setPos({
        left: Math.max(padding, Math.min(x, vw - 240 - padding)),
        top: Math.max(padding, Math.min(y, vh - 260 - padding)),
      })
      return
    }

    const rect = el.getBoundingClientRect()
    let nextLeft = x
    let nextTop = y

    if (nextLeft + rect.width > vw - padding) {
      nextLeft = Math.max(padding, vw - rect.width - padding)
    }
    if (nextLeft < padding) {
      nextLeft = padding
    }

    if (nextTop + rect.height > vh - padding) {
      nextTop = Math.max(padding, vh - rect.height - padding)
    }
    if (nextTop < padding) {
      nextTop = padding
    }

    setPos({ left: nextLeft, top: nextTop })
  }, [isOpen, x, y, mode, message?.id, conversation?.id])

  // Đóng khi click ngoài, cuộn trang hoặc nhấn Escape
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleScroll = () => {
      onClose()
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('touchstart', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('touchstart', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted || typeof document === 'undefined') return null

  const content = (
    <div
      ref={menuRef}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        WebkitTouchCallout: 'none',
      }}
      className="fixed z-[9999] min-w-[230px] max-w-[280px] select-none rounded-2xl border border-blue-500/20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-1.5 shadow-2xl shadow-blue-900/15 dark:shadow-black/50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      {mode === 'message' && message && (
        <div className="space-y-1">
          {/* Dải thả nhanh Emoji */}
          {onReact && (
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 mb-1 rounded-xl bg-blue-500/5 dark:bg-sky-500/10 border border-blue-500/10">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReact(emoji)
                    onClose()
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-blue-500/15 hover:scale-115 active:scale-95"
                  title={`Thả ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {onReply && (
            <button
              type="button"
              onClick={() => {
                onReply()
                onClose()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-400 active:scale-[0.98]"
            >
              <Reply className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
              <span>Trả lời tin nhắn</span>
            </button>
          )}

          {onCopy && message.content && (
            <button
              type="button"
              onClick={() => {
                onCopy()
                onClose()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-400 active:scale-[0.98]"
            >
              <Copy className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
              <span>Sao chép nội dung</span>
            </button>
          )}

          {onRecall && !message.isSystem && (
            <>
              <div className="my-1 border-t border-slate-200/70 dark:border-slate-800" />
              <button
                type="button"
                onClick={() => {
                  onRecall()
                  onClose()
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/10 active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>{message.isMe ? 'Thu hồi / Xóa tin nhắn' : 'Xóa tin nhắn'}</span>
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'conversation' && conversation && (
        <div className="space-y-1">
          {!conversation.isSenAiStudio && onTogglePin && (
            <button
              type="button"
              onClick={() => {
                onTogglePin()
                onClose()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-400 active:scale-[0.98]"
            >
              {conversation.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Bỏ ghim cuộc trò chuyện</span>
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
                  <span>Ghim cuộc trò chuyện</span>
                </>
              )}
            </button>
          )}

          {!conversation.isSenAiStudio && onToggleUnread && (
            <button
              type="button"
              onClick={() => {
                onToggleUnread()
                onClose()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-400 active:scale-[0.98]"
            >
              {(conversation.unreadCount || 0) > 0 ? (
                <>
                  <CheckCheck className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
                  <span>Đánh dấu đã đọc</span>
                </>
              ) : (
                <>
                  <CircleDot className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
                  <span>Đánh dấu chưa đọc</span>
                </>
              )}
            </button>
          )}

          {onClearHistory && (
            <button
              type="button"
              onClick={() => {
                onClearHistory()
                onClose()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-sky-400 active:scale-[0.98]"
            >
              <Eraser className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Xóa lịch sử chat</span>
            </button>
          )}

          {conversation.isGroup && onLeaveGroup && (
            <>
              <div className="my-1 border-t border-slate-200/70 dark:border-slate-800" />
              <button
                type="button"
                onClick={() => {
                  onLeaveGroup()
                  onClose()
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/10 active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Rời khỏi nhóm</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
