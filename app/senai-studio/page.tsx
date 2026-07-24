'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  ArrowLeft, Sparkles, Send, Loader2, Plus, Trash2, Paperclip, X, BrainCircuit, Crown, MessageSquare,
} from 'lucide-react'

type Session = { id: string, title: string, updated_at: string }
type Message = { id: string, role: 'user' | 'model', content: string, attachments: { name?: string, mimeType: string }[], deep_think: boolean }
type PendingAttachment = { base64: string, mimeType: string, name: string }

export default function SenAiStudioPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor } = useNewUiPrefs()
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('senai_tier').eq('id', user.id).maybeSingle()
      setIsUltra(profile?.senai_tier === 'ultra')
      if (profile?.senai_tier === 'ultra') await refreshSessions()
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [router])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  const refreshSessions = async () => {
    const { data } = await supabase.from('senai_studio_sessions').select('id, title, updated_at').order('updated_at', { ascending: false })
    setSessions(data || [])
    return data || []
  }

  const openSession = async (sessionId: string) => {
    setActiveSessionId(sessionId)
    const { data } = await supabase.from('senai_studio_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    setMessages((data || []) as Message[])
  }

  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Xoá cuộc trò chuyện này?')) return
    await supabase.from('senai_studio_sessions').delete().eq('id', sessionId)
    if (activeSessionId === sessionId) handleNewSession()
    await refreshSessions()
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

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || sending) return
    const userMessage = input.trim()
    const attachments = pendingFiles
    setInput('')
    setPendingFiles([])
    setSending(true)

    setMessages(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', content: userMessage, attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType })), deep_think: deepThink }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      const res = await fetch('/api/senai-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: activeSessionId, message: userMessage, attachments, deepThink }),
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

  const isModern = newUiEnabled
  const wrapperStyle = isModern ? { ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties : undefined
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
          <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-xl font-black mb-2">SenAI Studio</h1>
          <p className={`text-sm mb-6 ${mutedClass}`} style={mutedStyle}>Ứng dụng trò chuyện AI riêng biệt, lưu lịch sử chat, gửi hình ảnh/tài liệu, không giới hạn câu hỏi và có chế độ Deep Think — dành riêng cho thành viên SenAI Ultra.</p>
          <button onClick={() => router.push('/vi-sen')} className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm inline-flex items-center gap-2">
            <Crown className="w-4 h-4" /> Nâng cấp SenAI Ultra
          </button>
          <button onClick={() => router.push('/dashboard')} className={`block mx-auto mt-4 text-xs font-bold ${mutedClass}`} style={mutedStyle}>Về Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="flex h-screen">
        <aside className="w-64 shrink-0 border-r flex flex-col" style={{ borderColor: isModern ? 'var(--border)' : undefined }}>
          <div className="p-3 flex items-center gap-2 border-b" style={{ borderColor: isModern ? 'var(--border)' : undefined }}>
            <button onClick={() => router.push('/dashboard')} className="p-2 rounded-lg" style={cardStyle}><ArrowLeft className="w-4 h-4" /></button>
            <span className="font-black text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-indigo-500" /> SenAI Studio</span>
          </div>
          <button onClick={handleNewSession} className="m-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Cuộc trò chuyện mới
          </button>
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 group ${activeSessionId === s.id ? 'ring-2 ring-indigo-500' : ''}`}
                style={activeSessionId === s.id ? { background: 'rgba(99,102,241,0.1)' } : cardStyle}
              >
                <span className="truncate flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 shrink-0" />{s.title}</span>
                <Trash2 className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-rose-500" onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }} />
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className={`text-center mt-20 text-sm ${mutedClass}`} style={mutedStyle}>
                Bắt đầu trò chuyện với SenAI Studio — gửi câu hỏi, hình ảnh hoặc tài liệu để mình giúp bạn nhé.
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={msg.role === 'user' ? { background: 'var(--accent, #4f46e5)', color: '#fff' } : cardStyle}
                >
                  {msg.deep_think && msg.role === 'model' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide mb-1.5 text-indigo-400"><BrainCircuit className="w-3 h-3" /> Deep Think</span>
                  )}
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachments.map((a, i) => <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-black/10">{a.name || a.mimeType}</span>)}
                    </div>
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({ ...props }) => <strong className="font-extrabold" {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                      ol: ({ ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2" style={cardStyle}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> SenAI đang suy nghĩ...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t" style={{ borderColor: isModern ? 'var(--border)' : undefined }}>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pendingFiles.map((f, i) => (
                  <span key={i} className="text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={cardStyle}>
                    {f.name} <X className="w-3 h-3 cursor-pointer" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl" style={cardStyle}><Paperclip className="w-4 h-4" /></button>
              <button
                onClick={() => setDeepThink(v => !v)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${deepThink ? 'bg-indigo-600 text-white' : ''}`}
                style={!deepThink ? cardStyle : undefined}
              >
                <BrainCircuit className="w-3.5 h-3.5" /> Deep Think
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Hỏi SenAI Studio..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                style={cardStyle}
              />
              <button onClick={handleSend} disabled={sending} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
