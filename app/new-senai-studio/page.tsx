'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  ArrowLeft,
  Sparkles,
  Send,
  Loader2,
  Plus,
  Trash2,
  Paperclip,
  X,
  BrainCircuit,
  Crown,
  MessageSquare,
  Copy,
  Check,
  Lightbulb,
  Compass,
  BookMarked,
  Atom,
  Sun,
  Moon,
  Bot,
  User,
  Zap,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newsenai-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newsenai-body' })

type Session = { id: string; title: string; updated_at: string }
type Message = { id: string; role: 'user' | 'model'; content: string }

const STARTER_PROMPTS = [
  { icon: Atom, title: 'Vật lý & Hiện tượng', prompt: 'Giải thích định luật khúc xạ ánh sáng và ứng dụng trong thực tế đời sống.' },
  { icon: Compass, title: 'Toán học 12', prompt: 'Hướng dẫn phương pháp tìm cực trị của hàm số bậc ba kèm các ví dụ mẫu.' },
  { icon: BookMarked, title: 'Ngữ văn & Dàn ý', prompt: 'Lập dàn ý phân tích vẻ đẹp thiên nhiên và hình tượng người lính trong bài thơ Tây Tiến.' },
  { icon: Lightbulb, title: 'Tạo đề tự luyện', prompt: 'Tạo 4 câu trắc nghiệm đúng/sai môn Hóa học lớp 12 phần Este - Lipit theo ma trận 2026.' },
]

export default function NewSenAiStudioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [deepThink, setDeepThink] = useState(false)
  const [sending, setSending] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)
      setUserId(user.id)

      // Fetch saved sessions
      const { data } = await supabase
        .from('senai_studio_sessions')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })

      setSessions(data || [])
      setLoading(false)
    }

    init()
  }, [router])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, sending])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const handleOpenSession = async (sessionId: string) => {
    setActiveSessionId(sessionId)
    const { data } = await supabase
      .from('senai_studio_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    setMessages((data || []) as Message[])
  }

  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Xóa phiên trò chuyện này?')) return
    await supabase.from('senai_studio_sessions').delete().eq('id', sessionId)
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      handleNewSession()
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || sending) return

    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      let currentSession = activeSessionId

      // Tạo session mới nếu chưa có
      if (!currentSession && userId) {
        const title = text.slice(0, 35) + (text.length > 35 ? '...' : '')
        const { data: newSess } = await supabase
          .from('senai_studio_sessions')
          .insert({ title, user_id: userId })
          .select('id, title, updated_at')
          .single()

        if (newSess) {
          currentSession = newSess.id
          setActiveSessionId(newSess.id)
          setSessions((prev) => [newSess, ...prev])
        }
      }

      // Lưu user message
      if (currentSession) {
        await supabase.from('senai_studio_messages').insert({
          session_id: currentSession,
          role: 'user',
          content: text,
        })
      }

      // Gọi API SenAI Chat
      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          deepThink: deepThink,
        }),
      })

      const data = await res.json()
      const replyContent = data.reply || data.text || 'Xin lỗi, SenAI không thể xử lý yêu cầu lúc này.'

      const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: replyContent }
      setMessages((prev) => [...prev, modelMsg])

      // Lưu model message
      if (currentSession) {
        await supabase.from('senai_studio_messages').insert({
          session_id: currentSession,
          role: 'model',
          content: replyContent,
        })
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', content: `Lỗi kết nối: ${err.message}` },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang kết nối không gian SenAI Studio 2.0...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} h-screen flex flex-col bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 font-sans overflow-hidden select-none`}
      style={themeVars}
    >
      {/* FLOATING HEADER */}
      <header className="h-16 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 px-4 sm:px-6 flex items-center justify-between backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Về Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black leading-none" style={{ fontFamily: 'var(--font-newsenai-heading)' }}>
                SenAI Studio 2.0
              </h2>
              <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
                Trợ lý học tập & Luyện thi thông minh
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
          <button
            type="button"
            onClick={handleNewSession}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Đoạn chat mới
          </button>
        </div>
      </header>

      {/* BODY: SIDEBAR + CHAT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR: SESSIONS */}
        <aside className="w-72 hidden md:flex flex-col border-r border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 p-4 backdrop-blur-xl">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400 mb-3">
            Lịch sử trò chuyện ({sessions.length})
          </span>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-[#6B7280] dark:text-slate-500 italic py-4 text-center">
                Chưa có cuộc trò chuyện nào
              </p>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    activeSessionId === sess.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#4B5563] dark:text-slate-300'
                  }`}
                  onClick={() => handleOpenSession(sess.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{sess.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(sess.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden">
          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto py-12 text-center space-y-6 animate-in fade-in">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newsenai-heading)' }}>
                    Tôi có thể giúp gì cho việc học của bạn hôm nay?
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 max-w-md mx-auto">
                    SenAI hỗ trợ giải bài tập, tạo đề thi tự luyện, giải thích chuyên sâu và hướng dẫn phương pháp làm bài.
                  </p>
                </div>

                {/* Starter Prompts Grid */}
                <div className="grid gap-3 sm:grid-cols-2 text-left pt-2">
                  {STARTER_PROMPTS.map((item, idx) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.prompt)}
                        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md text-left"
                      >
                        <Icon className="h-5 w-5 text-indigo-500 mb-2" />
                        <h4 className="font-bold text-xs">{item.title}</h4>
                        <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5 line-clamp-2">
                          {item.prompt}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex items-start gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto'}`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shrink-0 mt-1 shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`relative rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 font-bold max-w-md'
                          : 'bg-white/90 dark:bg-slate-800/90 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, idx)}
                          className="mt-2 text-[10px] font-bold text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                        >
                          {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === idx ? 'Đã sao chép' : 'Sao chép câu trả lời'}
                        </button>
                      )}
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 shrink-0 mt-1 shadow-sm font-black text-xs">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {sending && (
              <div className="flex items-center gap-3 max-w-md">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shrink-0 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-black/10 dark:border-white/10 p-3.5 text-xs text-[#6B7280] dark:text-slate-400 font-bold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  SenAI đang suy nghĩ và tính toán...
                </div>
              </div>
            )}
          </div>

          {/* INPUT FORM BAR */}
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="max-w-4xl mx-auto space-y-2"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeepThink(!deepThink)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-bold border transition ${
                    deepThink
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400'
                  }`}
                >
                  <BrainCircuit className="h-3.5 w-3.5" /> Tư duy sâu (Deep Think)
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Nhập câu hỏi, bài tập hoặc yêu cầu SenAI..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                  className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 pl-4 pr-12 text-xs sm:text-sm font-semibold outline-none transition focus:border-indigo-500 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 transition hover:scale-105 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
