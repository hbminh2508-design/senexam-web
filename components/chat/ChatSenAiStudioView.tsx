'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Brain,
  BrainCircuit,
  MessageSquare,
  Compass,
  Atom,
  BookMarked,
  Lightbulb,
  Copy,
  ChevronDown,
  Bot,
  User,
  History,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ChatMessageContent from '@/components/chat/ChatMessageContent'
import { getChatSendKey } from '@/lib/senChatStorage'

interface Session {
  id: string
  title: string
  updated_at: string
}

interface StudioMessage {
  id: string
  role: 'user' | 'model'
  content: string
  created_at?: string
}

const STARTER_PROMPTS = [
  {
    icon: Compass,
    title: 'Toán học 12',
    prompt: 'Hướng dẫn phương pháp tìm cực trị của hàm số bậc ba kèm các ví dụ mẫu.',
  },
  {
    icon: Atom,
    title: 'Vật lý & Hiện tượng',
    prompt: 'Giải thích định luật khúc xạ ánh sáng và ứng dụng trong thực tế đời sống.',
  },
  {
    icon: BookMarked,
    title: 'Ngữ văn & Dàn ý',
    prompt: 'Lập dàn ý phân tích vẻ đẹp thiên nhiên và hình tượng người lính trong bài thơ Tây Tiến.',
  },
  {
    icon: Lightbulb,
    title: 'Tạo đề tự luyện',
    prompt: 'Tạo 4 câu trắc nghiệm đúng/sai môn Hóa học lớp 12 phần Este - Lipit theo ma trận 2026.',
  },
]

export default function ChatSenAiStudioView({
  userId,
  isMobile = false,
}: {
  userId?: string | null
  isMobile?: boolean
}) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<StudioMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [deepThink, setDeepThink] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitleText, setEditTitleText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. Tải danh sách phiên trò chuyện từ Supabase & LocalStorage
  useEffect(() => {
    let active = true

    const loadSessions = async () => {
      // Đọc từ localStorage cache trước
      try {
        const localCached = localStorage.getItem('senai_studio_sessions_cache')
        if (localCached && active) {
          setSessions(JSON.parse(localCached))
        }
      } catch {}

      // Tải từ Supabase nếu có mạng
      try {
        const { data, error } = await supabase
          .from('senai_studio_sessions')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })

        if (!error && data && active) {
          setSessions(data)
          localStorage.setItem('senai_studio_sessions_cache', JSON.stringify(data))
          if (data.length > 0 && !activeSessionId) {
            handleSelectSession(data[0].id)
          }
        }
      } catch (err) {
        console.warn('Lỗi tải phiên SenAI Studio:', err)
      }
    }

    loadSessions()

    return () => {
      active = false
    }
  }, [userId])

  // Đóng dropdown khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSessionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cuộn xuống tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // Chọn một phiên
  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setShowSessionDropdown(false)

    // Đọc cache local trước
    try {
      const cached = localStorage.getItem(`senai_studio_msgs_${sessionId}`)
      if (cached) {
        setMessages(JSON.parse(cached))
      }
    } catch {}

    // Tải từ Supabase
    try {
      const { data, error } = await supabase
        .from('senai_studio_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data as StudioMessage[])
        localStorage.setItem(`senai_studio_msgs_${sessionId}`, JSON.stringify(data))
      }
    } catch (err) {
      console.warn('Lỗi tải tin nhắn phiên:', err)
    }
  }

  // Tạo phiên mới
  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setShowSessionDropdown(false)
  }

  // Đổi tên phiên
  const handleSaveRename = async (sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed, updated_at: new Date().toISOString() } : s))
    )
    setEditingSessionId(null)

    try {
      await supabase.from('senai_studio_sessions').update({ title: trimmed }).eq('id', sessionId)
      const cached = localStorage.getItem('senai_studio_sessions_cache')
      if (cached) {
        const list = JSON.parse(cached)
        const item = list.find((s: any) => s.id === sessionId)
        if (item) item.title = trimmed
        localStorage.setItem('senai_studio_sessions_cache', JSON.stringify(list))
      }
    } catch (e) {
      console.warn('Lỗi đổi tên phiên:', e)
    }
  }

  // Xóa phiên
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Bạn có chắc chắn muốn xóa phiên trò chuyện này?')) return

    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    try {
      localStorage.removeItem(`senai_studio_msgs_${sessionId}`)
      await supabase.from('senai_studio_sessions').delete().eq('id', sessionId)
    } catch {}

    if (activeSessionId === sessionId) {
      handleNewSession()
    }
  }

  // Gửi tin nhắn
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || isSending) return

    setInputText('')
    const tempUserMsg: StudioMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempUserMsg])
    setIsSending(true)

    try {
      let currentSessionId = activeSessionId

      // 1. Nếu chưa có phiên, tự động tạo mới
      if (!currentSessionId) {
        const title = text.slice(0, 32) + (text.length > 32 ? '...' : '')
        let newSessionObj: Session = {
          id: 'sess_' + Date.now(),
          title,
          updated_at: new Date().toISOString(),
        }

        if (userId) {
          try {
            const { data: created } = await supabase
              .from('senai_studio_sessions')
              .insert({ title, user_id: userId })
              .select('id, title, updated_at')
              .single()
            if (created) newSessionObj = created
          } catch {}
        }

        currentSessionId = newSessionObj.id
        setActiveSessionId(newSessionObj.id)
        setSessions((prev) => [newSessionObj, ...prev])
        localStorage.setItem('senai_studio_sessions_cache', JSON.stringify([newSessionObj, ...sessions]))
      }

      // 2. Lưu tin nhắn người dùng vào Supabase & LocalStorage
      if (userId && currentSessionId) {
        try {
          await supabase.from('senai_studio_messages').insert({
            session_id: currentSessionId,
            user_id: userId,
            role: 'user',
            content: text,
          })
        } catch {}
      }

      // 3. Lấy auth token
      let token: string | null = null
      try {
        const { data: authSession } = await supabase.auth.getSession()
        token = authSession?.session?.access_token || null
      } catch {}

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // 4. Gọi API SenAI Chat
      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          deepThink,
        }),
      })

      const data = await res.json()
      const replyContent = data.reply || data.text || 'Xin lỗi, SenAI không thể phản hồi câu hỏi lúc này.'

      const modelMsg: StudioMessage = {
        id: 'model_' + Date.now(),
        role: 'model',
        content: replyContent,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => {
        const updated = [...prev, modelMsg]
        if (currentSessionId) {
          localStorage.setItem(`senai_studio_msgs_${currentSessionId}`, JSON.stringify(updated))
        }
        return updated
      })

      // Lưu tin nhắn model vào Supabase
      if (userId && currentSessionId) {
        try {
          await supabase.from('senai_studio_messages').insert({
            session_id: currentSessionId,
            user_id: userId,
            role: 'model',
            content: replyContent,
          })
        } catch {}
      }

      // Đồng bộ hạn mức quota toàn trang web
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('senai-quota-updated', { detail: data }))
      }
    } catch (err: any) {
      console.warn('Lỗi gọi SenAI:', err)
      const errReply: StudioMessage = {
        id: 'err_' + Date.now(),
        role: 'model',
        content: `⚠️ Lỗi kết nối SenAI: ${err?.message || 'Vui lòng kiểm tra lại đường truyền mạng.'}`,
      }
      setMessages((prev) => [...prev, errReply])
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(msgId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const sendKey = getChatSendKey()

  return (
    <div className="flex h-full w-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* 1. Header & Thanh chọn các phiên trò chuyện */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 z-20">
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
            <Sparkles className="h-5 w-5" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSessionDropdown((prev) => !prev)}
              className="flex items-center gap-1.5 text-left font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              <span className="truncate max-w-[180px] sm:max-w-[280px]">
                {activeSession ? activeSession.title : 'Phiên trò chuyện mới'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SenAI Studio · Lưu trữ vĩnh viễn</span>
            </div>
          </div>

          {/* Dropdown danh sách các phiên */}
          {showSessionDropdown && (
            <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-50">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Lịch sử phiên chat ({sessions.length})
                </span>
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <Plus className="h-3 w-3" /> Tạo mới
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto py-1 space-y-1">
                {sessions.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-400">Chưa có phiên lưu trữ nào</p>
                ) : (
                  sessions.map((sess) => {
                    const isActive = sess.id === activeSessionId
                    const isEditing = sess.id === editingSessionId

                    return (
                      <div
                        key={sess.id}
                        onClick={() => !isEditing && handleSelectSession(sess.id)}
                        className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition cursor-pointer ${
                          isActive
                            ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isEditing ? (
                          <div
                            className="flex items-center gap-1 flex-1 mr-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editTitleText}
                              onChange={(e) => setEditTitleText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(sess.id, editTitleText)
                                if (e.key === 'Escape') setEditingSessionId(null)
                              }}
                              autoFocus
                              className="w-full rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-emerald-500 text-slate-900 dark:text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(sess.id, editTitleText)}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSessionId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate flex-1 pr-2">{sess.title}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button
                                type="button"
                                title="Đổi tên"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingSessionId(sess.id)
                                  setEditTitleText(sess.title)
                                }}
                                className="p-1 rounded text-slate-400 hover:text-emerald-600"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Xóa phiên"
                                onClick={(e) => handleDeleteSession(sess.id, e)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nút Tạo Phiên Mới & Công tắc DeepThink */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDeepThink((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-xs font-bold transition border ${
              deepThink
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Bật/Tắt chế độ DeepThink suy nghĩ sâu"
          >
            {deepThink ? <BrainCircuit className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">DeepThink:</span>
            <span>{deepThink ? 'Bật' : 'Tắt'}</span>
          </button>

          <button
            type="button"
            onClick={handleNewSession}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Phiên mới</span>
          </button>
        </div>
      </div>

      {/* 2. Khung hiển thị tin nhắn hoặc Starter Prompts */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center max-w-2xl mx-auto py-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-lg">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                SenAI Studio trong Sen Chat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Trợ lý thông minh hỗ trợ giải bài tập, phân tích cấu trúc đề thi 2026, vẽ sơ đồ và nghiên cứu học tập chuyên sâu.
              </p>
            </div>

            {/* Thẻ gợi ý Starter Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-2">
              {STARTER_PROMPTS.map((p, idx) => {
                const Icon = p.icon
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(p.prompt)}
                    className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition hover:border-emerald-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500 text-left"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Icon className="h-4 w-4" />
                      <span>{p.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {p.prompt}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-xs ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  <ChatMessageContent content={msg.content} isSenAi={!isUser} isMe={isUser} />

                  {!isUser && (
                    <div className="mt-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-emerald-500 transition px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span>Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            )
          })
        )}

        {isSending && (
          <div className="flex gap-3 justify-start items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white">
              <Bot className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-2xl bg-white p-3 border border-slate-200/80 text-xs text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              <span>{deepThink ? 'SenAI đang suy nghĩ sâu và phân tích bài toán...' : 'SenAI đang soạn câu trả lời...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Khung nhập liệu tin nhắn */}
      <div className="border-t border-slate-200/80 bg-white/90 p-3 sm:p-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (sendKey === 'enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  } else if (sendKey === 'shift_enter' && e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }
              }}
              placeholder={
                deepThink
                  ? 'Hỏi SenAI với tư duy phân tích sâu (Toán, Lý, Hóa, Văn)...'
                  : 'Nhập câu hỏi học tập, bài thi hoặc công thức Toán học...'
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-40 transition"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  )
}
