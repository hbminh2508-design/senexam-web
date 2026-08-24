'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getEffectiveSenaiTier } from '@/lib/senaiTiers'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars, getGlassThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  ArrowLeft, Sparkles, Send, Loader2, Plus, Trash2, Paperclip, X, BrainCircuit, Crown, MessageSquare,
  Menu, Copy, Check, Lightbulb, Compass, HelpCircle, BookMarked, Atom
} from 'lucide-react'

type Session = { id: string, title: string, updated_at: string }
type Message = { id: string, role: 'user' | 'model', content: string, attachments: { name?: string, mimeType: string }[], deep_think: boolean }
type PendingAttachment = { base64: string, mimeType: string, name: string }

const STARTER_PROMPTS = [
  { icon: Atom, title: 'Vật lý & Hiện tượng', prompt: 'Giải thích định luật khúc xạ ánh sáng và ứng dụng trong thực tế.' },
  { icon: Compass, title: 'Toán học 12', prompt: 'Hướng dẫn phương pháp tìm cực trị của hàm số bậc ba kèm ví dụ.' },
  { icon: BookMarked, title: 'Ngữ văn & Dàn ý', prompt: 'Lập dàn ý phân tích vẻ đẹp thiên nhiên và con người trong bài thơ Tây Tiến.' },
  { icon: Lightbulb, title: 'Tạo đề tự luyện', prompt: 'Tạo 4 câu trắc nghiệm đúng/sai môn Hóa học lớp 12 phần Este - Lipit.' },
]

export default function SenAiStudioPage() {
  const router = useRouter()
  const { uiMode, isGlass, newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isUltra, setIsUltra] = useState(false)

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  const [deepThink, setDeepThink] = useState(false)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('senai_tier, senai_tier_expires_at, senai_tier_permanent').eq('id', user.id).maybeSingle()
      const ultra = getEffectiveSenaiTier(profile) === 'ultra'
      setIsUltra(ultra)
      if (ultra) await refreshSessions()
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [router])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, sending])

  const refreshSessions = async () => {
    const { data } = await supabase.from('senai_studio_sessions').select('id, title, updated_at').order('updated_at', { ascending: false })
    setSessions(data || [])
    return data || []
  }

  const openSession = async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setSidebarOpen(false)
    const { data } = await supabase.from('senai_studio_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    setMessages((data || []) as Message[])
  }

  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Xoá cuộc trò chuyện này?')) return
    await supabase.from('senai_studio_sessions').delete().eq('id', sessionId)
    if (activeSessionId === sessionId) handleNewSession()
    await refreshSessions()
  }

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setPendingFiles(prev => [...prev, { base64, mimeType: file.type || 'application/octet-stream', name: file.name }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (customPrompt?: string) => {
    const messageToSend = customPrompt || input.trim()
    if ((!messageToSend && pendingFiles.length === 0) || sending) return
    const attachments = pendingFiles
    if (!customPrompt) setInput('')
    setPendingFiles([])
    setSending(true)

    setMessages(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', content: messageToSend, attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType })), deep_think: deepThink }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      const res = await fetch('/api/senai-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: activeSessionId, message: messageToSend, attachments, deepThink }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessages(prev => [...prev, { id: `local-err-${Date.now()}`, role: 'model', content: `⚠️ ${json.error || 'Có lỗi xảy ra'}`, attachments: [], deep_think: false }])
        return
      }

      setMessages(prev => [...prev, { id: `local-resp-${Date.now()}`, role: 'model', content: json.text, attachments: [], deep_think: deepThink }])
      if (!activeSessionId) setActiveSessionId(json.sessionId)
      await refreshSessions()
    } catch (e) {
      setMessages(prev => [...prev, { id: `local-err-${Date.now()}`, role: 'model', content: `⚠️ ${e instanceof Error ? e.message : 'Có lỗi xảy ra'}`, attachments: [], deep_think: false }])
    } finally {
      setSending(false)
    }
  }

  const activeThemeVars = isGlass
    ? getGlassThemeVars(themeColor, isDark)
    : getModernThemeVars(themeColor, isDark)

  const isModern = newUiEnabled
  const wrapperStyle = isModern ? { ...activeThemeVars, background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties : undefined
  const wrapperClass = isModern ? 'min-h-screen font-sans' : 'min-h-screen bg-slate-50 dark:bg-[#0d0d0d] text-slate-900 dark:text-slate-100'
  const cardStyle = isModern ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined
  const mutedClass = isModern ? '' : 'text-slate-500'
  const mutedStyle = isModern ? { color: 'var(--text-muted)' } : undefined

  if (loading) {
    if (isModern) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang mở SenAI Studio..." />
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>
  }

  if (!isUltra) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 p-[2px] shadow-xl">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[22px] flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-indigo-500 animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl font-black mb-2">SenAI Studio</h1>
          <p className={`text-sm mb-6 ${mutedClass}`} style={mutedStyle}>
            Ứng dụng trò chuyện AI chuyên sâu bám sát chương trình học: lưu lịch sử chat, gửi hình ảnh/tài liệu bài tập, không giới hạn câu hỏi và chế độ Deep Think — dành riêng cho thành viên SenAI Ultra.
          </p>
          <button onClick={() => router.push('/vi-sen')} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-extrabold text-sm inline-flex items-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95 transition-all">
            <Crown className="w-4.5 h-4.5" /> Nâng cấp SenAI Ultra
          </button>
          <button onClick={() => router.push('/dashboard')} className={`block mx-auto mt-4 text-xs font-bold ${mutedClass}`} style={mutedStyle}>
            Quay về Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="flex h-screen overflow-hidden relative">
        
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-72 shrink-0 border-r flex flex-col transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isGlass ? 'glass-refract-card rounded-r-3xl lg:rounded-none' : isModern ? 'bg-[var(--surface)]' : 'bg-white dark:bg-[#121212]'}`}
          style={{ borderColor: isModern ? 'var(--border)' : undefined }}
        >
          <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: isModern ? 'var(--border)' : undefined }}>
            <div className="flex items-center gap-2.5">
              <button onClick={() => router.push('/dashboard')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Về Dashboard">
                <ArrowLeft className="w-4.5 h-4.5" />
              </button>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
                <span className="font-black text-sm tracking-tight">SenAI Studio</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">BETA</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3">
            <button
              onClick={handleNewSession}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Cuộc trò chuyện mới
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1.5 custom-scrollbar">
            <p className="text-[10px] font-black uppercase px-2 py-1 tracking-wider text-slate-400">Lịch sử trò chuyện</p>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-4 text-center">Chưa có phiên chat nào.</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 group transition-all ${
                    activeSessionId === s.id
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate flex items-center gap-2 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{s.title || 'Đoạn hội thoại mới'}</span>
                  </span>
                  <Trash2
                    className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    title="Xoá cuộc trò chuyện"
                  />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full relative">
          
          {/* Top Chat Bar */}
          <div className="h-14 px-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: isModern ? 'var(--border)' : undefined, background: isModern ? 'var(--surface)' : undefined }}>
            <div className="flex items-center gap-2.5">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {deepThink ? 'SenAI Deep Think (Phân tích chi tiết)' : 'SenAI Studio Ultra'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1 text-slate-500"
              >
                Về Dashboard
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto mt-8 sm:mt-16 text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-500 via-sky-400 to-emerald-400 p-[2px] mx-auto shadow-lg">
                  <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[22px] flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-500" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Xin chào, mình là SenAI Studio</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Trợ lý gia sư AI chuyên giải thích bài tập, phân tích công thức toán lý hóa và định hướng kỳ thi cho bạn.
                  </p>
                </div>

                {/* Starter Prompts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-4">
                  {STARTER_PROMPTS.map((sp, idx) => {
                    const Icon = sp.icon
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSend(sp.prompt)}
                        className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 group ${
                          isGlass ? 'glass-refract-card' : 'bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                        style={{ borderColor: isModern ? 'var(--border)' : undefined }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{sp.title}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">{sp.prompt}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 sm:px-5 py-3.5 rounded-3xl text-sm leading-relaxed relative group ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white rounded-br-md shadow-md'
                        : isGlass
                        ? 'glass-refract-card rounded-bl-md border border-white/60 dark:border-white/10 shadow-md'
                        : isModern
                        ? 'bg-[var(--surface)] border rounded-bl-md shadow-sm'
                        : 'bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5 rounded-bl-md'
                    }`}
                    style={msg.role !== 'user' && isModern ? { borderColor: 'var(--border)' } : undefined}
                  >
                    {msg.deep_think && msg.role === 'model' && (
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2 border border-indigo-500/20">
                        <BrainCircuit className="w-3.5 h-3.5" /> Chế độ Deep Think
                      </div>
                    )}

                    {msg.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {msg.attachments.map((a, i) => (
                          <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10">
                            📎 {a.name || a.mimeType}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          strong: ({ ...props }) => <strong className="font-extrabold text-indigo-700 dark:text-indigo-300" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                          code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs font-mono font-bold" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.role === 'model' && (
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                        title="Sao chép nội dung"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" /> Đã chép
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Sao chép
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {sending && (
              <div className="flex justify-start">
                <div
                  className={`px-5 py-3.5 rounded-3xl text-sm flex items-center gap-3 ${
                    isGlass ? 'glass-refract-card' : 'bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5'
                  }`}
                >
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="font-bold text-slate-600 dark:text-slate-300 text-xs">
                    {deepThink ? 'SenAI đang suy nghĩ sâu và phân tích bài tập...' : 'SenAI đang phản hồi...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-3 sm:p-4 border-t shrink-0" style={{ borderColor: isModern ? 'var(--border)' : undefined, background: isModern ? 'var(--surface)' : undefined }}>
            <div className="max-w-4xl mx-auto space-y-2">
              
              {/* Attachment Preview Chips */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingFiles.map((f, i) => (
                    <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      📎 {f.name}
                      <X className="w-3.5 h-3.5 cursor-pointer hover:text-rose-500" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} />
                    </span>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-colors text-slate-600 dark:text-slate-300 shrink-0"
                  title="Đính kèm hình ảnh hoặc PDF bài tập"
                >
                  <Paperclip className="w-4.5 h-4.5" />
                </button>

                <button
                  onClick={() => setDeepThink(v => !v)}
                  className={`px-3.5 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-all ${
                    deepThink
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300'
                  }`}
                  title="Chế độ phân tích suy luận từng bước"
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span className="hidden sm:inline">Deep Think</span>
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Nhập câu hỏi hoặc yêu cầu cho SenAI Studio..."
                  className="flex-1 px-4 py-3 rounded-2xl text-sm bg-black/[0.04] dark:bg-white/[0.06] border border-transparent focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                />

                <button
                  onClick={() => handleSend()}
                  disabled={sending || (!input.trim() && pendingFiles.length === 0)}
                  className="p-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white disabled:opacity-40 transition-all shadow-md active:scale-95 shrink-0"
                  title="Gửi câu hỏi"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

