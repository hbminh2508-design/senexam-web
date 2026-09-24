'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Maximize2,
  Loader2,
  Brain,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  timestamp: Date
}

export default function SenChatFloatingBubble() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Chào bạn! Mình là **Sen Chat** 🌸. Bạn cần mình giải đáp câu hỏi nào hay hỗ trợ kiến thức ôn thi hôm nay? Dữ liệu trò chuyện sẽ tự động được lưu vào **SenAI Studio** nhé!',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [deepThink, setDeepThink] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Không hiển thị bong bóng chat trên trang thi bảo mật SEB để tránh vi phạm quy chế
  const isSebExam = pathname?.startsWith('/seb-exam')

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  if (isSebExam) return null

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/sen-chat-bubble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId || undefined,
          deepThink,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            content: `⚠️ ${data.error || 'Có lỗi xảy ra khi kết nối tới Sen Chat. Vui lòng thử lại sau.'}`,
            timestamp: new Date(),
          },
        ])
      } else {
        if (data.sessionId) setSessionId(data.sessionId)
        if (data.savedToStudio) setLastSaved(true)

        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            content: data.reply || data.text || 'Đã nhận câu hỏi.',
            timestamp: new Date(),
          },
        ])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: '⚠️ Lỗi đường truyền mạng. Vui lòng kiểm tra lại kết nối internet.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickPrompt = (promptText: string) => {
    setInput(promptText)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 select-none">
      {/* CỬA SỔ CHAT MINI (KHI MỞ) */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2.5rem)] sm:w-[380px] h-[520px] max-h-[82vh] rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 dark:from-pink-500/20 dark:to-indigo-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 text-white shadow-sm font-black text-sm">
                🌸
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  Sen Chat
                  <span className="rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-400 px-1.5 py-0.2 text-[9px] font-bold">
                    Q1 Beta
                  </span>
                </h4>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Tự lưu SenAI Studio
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/new-senai-studio"
                target="_blank"
                title="Mở toàn màn hình tại SenAI Studio"
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Vùng Tin Nhắn */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="shrink-0 h-6 w-6 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xs font-bold mt-0.5">
                      🌸
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm rounded-br-none'
                        : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-bl-none'
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
                        a: ({ node, ...props }) => (
                          <a
                            className="underline font-bold text-pink-600 dark:text-pink-400 hover:opacity-80"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                        code: ({ node, ...props }) => (
                          <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[11px]" {...props} />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex gap-2 justify-start items-center text-slate-500 dark:text-slate-400 py-1">
                <div className="h-6 w-6 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center text-xs font-bold">
                  🌸
                </div>
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-3 py-2 rounded-2xl">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-500" />
                  <span className="text-[11px] font-semibold">Sen Chat đang suy nghĩ...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (Khi chưa có nhiều hội thoại) */}
          {messages.length <= 2 && (
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => handleQuickPrompt('Tóm tắt công thức cực trị hàm bậc 3')}
                className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition"
              >
                📐 Công thức Toán 12
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt('Lập dàn ý phân tích Tây Tiến')}
                className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition"
              >
                ✍️ Dàn ý Ngữ Văn
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt('Mẹo làm bài trắc nghiệm Hóa lý thuyết')}
                className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition"
              >
                ⚗️ Mẹo Lý Thuyết Hóa
              </button>
            </div>
          )}

          {/* Footer Controls & Input */}
          <div className="p-3 border-t border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setDeepThink(!deepThink)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                  deepThink
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                    : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Brain className="h-3 w-3" />
                <span>Deep Think {deepThink ? 'BẬT' : 'TẮT'}</span>
              </button>

              <Link
                href="/new-senai"
                className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-0.5"
              >
                Quota SenAI <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi với Sen Chat..."
                className="flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-xs outline-none focus:border-pink-500 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-8 w-8 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center transition hover:scale-105 active:scale-95 disabled:opacity-40 shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NÚT BONG BÓNG TRÒN NỔI (FLOATING BUTTON) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Mở Sen Chat"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white shadow-[0_10px_25px_rgba(236,72,153,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 hover:shadow-[0_15px_30px_rgba(236,72,153,0.5)]"
      >
        <span className="absolute inset-0 rounded-full bg-pink-400 opacity-20 animate-ping" />
        
        {isOpen ? (
          <X className="h-6 w-6 transition group-hover:rotate-90 duration-200" />
        ) : (
          <div className="relative flex items-center justify-center">
            <span className="text-xl">🌸</span>
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
          </div>
        )}

        {/* Tooltip khi hover */}
        {!isOpen && (
          <span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900/90 text-white px-3 py-1.5 text-xs font-bold opacity-0 transition group-hover:opacity-100 shadow-lg backdrop-blur-sm">
            Sen Chat (Tự lưu Studio) 🌸
          </span>
        )}
      </button>
    </div>
  )
}
