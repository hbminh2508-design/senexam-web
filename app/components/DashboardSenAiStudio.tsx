'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { supabase } from '@/lib/supabaseClient'
import {
  Sparkles,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Atom,
  Compass,
  BookMarked,
  Lightbulb,
  ExternalLink,
  Brain,
  BrainCircuit,
  Bot,
  User,
  Zap,
} from 'lucide-react'

type Message = { id: string; role: 'user' | 'model'; content: string }

const STARTER_PROMPTS = [
  { icon: Compass, title: 'Toán học 12', prompt: 'Hướng dẫn phương pháp tìm cực trị của hàm số bậc ba kèm các ví dụ mẫu trắc nghiệm.' },
  { icon: Atom, title: 'Vật lý 12', prompt: 'Giải thích hiện tượng quang điện ngoài và công thức Einstein áp dụng trong bài thi đại học.' },
  { icon: BookMarked, title: 'Ngữ văn', prompt: 'Lập dàn ý phân tích vẻ đẹp thiên nhiên và hình tượng người lính trong bài thơ Tây Tiến.' },
  { icon: Lightbulb, title: 'Tạo đề tự luyện', prompt: 'Tạo 4 câu trắc nghiệm đúng/sai môn Hóa học lớp 12 phần Este - Lipit theo ma trận chuẩn.' },
]

interface DashboardSenAiStudioProps {
  userId: string
  tierLabel: string
  effectiveTier: string
  remainingQuestions: number
  dailyLimit: number
  onQuotaUpdated?: () => void
}

export default function DashboardSenAiStudio({
  userId,
  tierLabel,
  effectiveTier,
  remainingQuestions,
  dailyLimit,
  onQuotaUpdated,
}: DashboardSenAiStudioProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [deepThink, setDeepThink] = useState(false)
  const [sending, setSending] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, sending])

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || sending) return

    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      let token: string | null = null
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        token = session?.access_token || null
      } catch (authErr) {
        console.warn('Lỗi lấy session:', authErr)
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: text,
          deepThink,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Không nhận được câu trả lời từ SenAI')
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply || 'Đã xử lý xong câu hỏi của bạn.',
      }
      setMessages((prev) => [...prev, aiMsg])

      // Cập nhật lại Quota cho toàn hệ thống
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('senai-quota-updated'))
      }
      if (onQuotaUpdated) onQuotaUpdated()
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `⚠️ ${err.message || 'Có lỗi xảy ra khi gọi SenAI. Vui lòng thử lại sau.'}`,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setSending(false)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="relative overflow-hidden rounded-[30px] border-2 border-purple-500/30 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-6 shadow-xl backdrop-blur-2xl space-y-4">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute -right-12 -top-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-md">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                SenAI Studio Workspace <Sparkles className="h-4 w-4 text-amber-500" />
              </h2>
              <span className="rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2.5 py-0.5 text-[10px] font-black text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                {tierLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Không gian giải bài tập & nghiên cứu học thuật trực tuyến tốc độ cao
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-black text-pink-600 dark:text-pink-400">
            <Zap className="h-3.5 w-3.5" /> Còn {remainingQuestions}/{dailyLimit} lượt
          </span>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/10 transition"
              title="Xóa phiên làm việc hiện tại"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Xóa hội thoại
            </button>
          )}

          <Link
            href="/new-senai-studio"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
            title="Phóng to mở Studio toàn màn hình trong tab mới"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Phóng To Studio
          </Link>
        </div>
      </div>

      {/* CHAT DISPLAY BODY */}
      <div
        ref={scrollRef}
        className="relative z-10 min-h-[220px] max-h-[380px] overflow-y-auto space-y-4 pr-1 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] p-4 border border-black/5 dark:border-white/5"
      >
        {messages.length === 0 ? (
          <div className="py-4 space-y-4 text-center">
            <div className="max-w-md mx-auto space-y-1.5">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                ⚡ Sẵn sàng hỗ trợ học tập
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nhập câu hỏi bài tập, công thức toán KaTeX hoặc chọn nhanh một chủ đề ôn thi bên dưới:
              </p>
            </div>

            {/* Quick Starter Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto pt-2 text-left">
              {STARTER_PROMPTS.map((item, idx) => {
                const Icon = item.icon
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="flex items-start gap-2.5 p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 hover:border-purple-500/50 hover:bg-purple-500/5 transition group cursor-pointer shadow-xs"
                  >
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.prompt}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            return (
              <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-sm mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-none shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-black/10 dark:border-white/10 shadow-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                  ) : (
                    <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-2">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </ReactMarkdown>

                      {/* Nút sao chép câu trả lời */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, idx)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-purple-600 transition"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" /> Đã chép
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Sao chép
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            )
          })
        )}

        {sending && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-sm animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-white dark:bg-slate-800 px-4 py-3 border border-black/10 dark:border-white/10 shadow-sm flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span>SenAI đang giải thích bài tập và định dạng công thức...</span>
            </div>
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
        className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Hỏi SenAI bất kỳ bài tập, công thức toán hoặc đề thi nào..."
            className="w-full h-12 rounded-2xl border border-black/15 dark:border-white/15 bg-white/95 dark:bg-slate-800/95 pl-4 pr-12 text-xs sm:text-sm font-medium outline-none focus:border-purple-500 dark:focus:border-purple-400 shadow-sm transition"
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white transition hover:scale-105 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>

        {/* Deep Think Mode Toggle */}
        <button
          type="button"
          onClick={() => setDeepThink(!deepThink)}
          className={`flex items-center justify-center gap-1.5 h-12 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition ${
            deepThink
              ? 'border-purple-500 bg-purple-500/15 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-black/5'
          }`}
          title="Bật chế độ suy luận sâu để giải thích chi tiết từng bước"
        >
          <Brain className={`h-4 w-4 ${deepThink ? 'text-purple-500 fill-purple-500/20' : ''}`} />
          <span>Deep Think</span>
        </button>
      </form>
    </div>
  )
}
