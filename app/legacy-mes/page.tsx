'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, FileImage, Loader2, Paperclip, Send, ShieldAlert, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import LegacyUiSunsetModal from '@/app/components/LegacyUiSunsetModal'

type Message = {
  id: string
  user_id: string
  user_name: string
  message: string | null
  created_at: string
  attachment_name: string | null
  attachment_size: number | null
  attachment_mime: string | null
  attachment_url: string | null
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SenMessagesPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(Date.now())

  const listRef = useRef<HTMLDivElement>(null)

  const authHeaders = async (): Promise<Record<string, string> | undefined> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return undefined
    return { Authorization: `Bearer ${token}` }
  }

  const loadMessages = async (silent = false) => {
    if (!silent) setRefreshing(true)
    setErrorText(null)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/sen-messages', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Không thể tải tin nhắn')
      setMessages(data.messages || [])
    } catch (e: any) {
      setErrorText(e?.message || 'Không thể tải tin nhắn')
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
      if (dark) document.documentElement.classList.add('dark')
      if (!cancelled) setIsDark(dark)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_beta_tester')
        .eq('id', user.id)
        .single()

      if (!cancelled) {
        setCurrentUserId(user.id)
        setIsBetaTester(!!profile?.is_beta_tester)
      }

      if (profile?.is_beta_tester) {
        await loadMessages()
      }

      if (!cancelled) setLoading(false)
    }

    init()

    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!isBetaTester) return
    const poll = setInterval(() => loadMessages(true), 5000)
    const ticker = setInterval(() => setTick(Date.now()), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(ticker)
    }
  }, [isBetaTester])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const remainingSeconds = (createdAt: string) => {
    const ageMs = tick - new Date(createdAt).getTime()
    const sec = Math.max(0, 60 - Math.floor(ageMs / 1000))
    return sec
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() && !file) return
    if (file && file.size > MAX_FILE_SIZE) {
      setErrorText('Tệp vượt quá 25MB.')
      return
    }

    setSending(true)
    setErrorText(null)

    try {
      const headers = await authHeaders()
      const formData = new FormData()
      formData.append('message', messageText.trim())
      if (file) formData.append('file', file)

      const res = await fetch('/api/sen-messages', {
        method: 'POST',
        headers,
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Không gửi được tin nhắn')

      setMessageText('')
      setFile(null)
      await loadMessages(true)
    } catch (e: any) {
      setErrorText(e?.message || 'Không gửi được tin nhắn')
    } finally {
      setSending(false)
    }
  }

  const sortedMessages = useMemo(() => messages.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [messages])

  if (loading) {
    return newUiEnabled
      ? <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải Sen Messages..." />
      : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  if (!isBetaTester) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#141414] p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-black mb-2">Sen Messages (Beta)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Tính năng này chỉ mở cho tài khoản đã tham gia chương trình Beta.</p>
          <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold">Quay về Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen font-sans pb-20"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={newUiEnabled ? ({ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties) : undefined}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push('/dashboard')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] p-6 mb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight inline-flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-500" /> Sen Messages
                <span className="text-[10px] px-2 py-1 rounded-md uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Beta</span>
              </h1>
              <p className="text-sm text-slate-500 mt-2">Phòng chat chung toàn hệ thống. Tin nhắn tự động xóa sau 1 phút để tiết kiệm dung lượng server.</p>
            </div>
            <button onClick={() => loadMessages()} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold">
              {refreshing ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] overflow-hidden">
          <div ref={listRef} className="h-[55vh] overflow-y-auto p-4 space-y-3">
            {sortedMessages.map((m) => {
              const own = currentUserId === m.user_id
              const left = remainingSeconds(m.created_at)
              const isImage = !!m.attachment_mime && m.attachment_mime.startsWith('image/')

              return (
                <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 border ${own ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-50 dark:bg-[#1F1F1F] border-slate-200 dark:border-white/10'}`}>
                    <div className={`text-[11px] font-semibold mb-1 ${own ? 'text-indigo-100' : 'text-slate-500'}`}>{m.user_name}</div>

                    {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}

                    {m.attachment_url && (
                      <div className="mt-2">
                        {isImage ? (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-white/20">
                            <img src={m.attachment_url} alt={m.attachment_name || 'attachment'} className="max-h-56 w-full object-cover" />
                          </a>
                        ) : (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${own ? 'bg-indigo-500/60' : 'bg-slate-100 dark:bg-[#2A2A2A]'}`}>
                            <Paperclip className="w-3.5 h-3.5" />
                            {m.attachment_name || 'Tệp đính kèm'}
                            {m.attachment_size ? `(${formatBytes(m.attachment_size)})` : ''}
                          </a>
                        )}
                      </div>
                    )}

                    <div className={`mt-2 text-[10px] inline-flex items-center gap-1 ${own ? 'text-indigo-100' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" /> tự xóa sau {left}s
                    </div>
                  </div>
                </div>
              )
            })}

            {sortedMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <FileImage className="w-10 h-10 mb-2 opacity-60" />
                <p className="text-sm font-semibold">Chưa có tin nhắn nào.</p>
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 dark:border-white/10 space-y-3">
            {errorText && <p className="text-xs text-rose-600">{errorText}</p>}

            {file && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#202020] text-xs">
                <Paperclip className="w-3.5 h-3.5" />
                <span>{file.name} ({formatBytes(file.size)})</span>
                <button type="button" onClick={() => setFile(null)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2A2A2A]"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Nhập tin nhắn..."
                rows={2}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none resize-none"
              />

              <label className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Tệp
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>

              <button type="submit" disabled={sending || (!messageText.trim() && !file)} className="px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gửi
              </button>
            </div>

            <p className="text-[11px] text-slate-500">Hỗ trợ gửi ảnh/tệp tối đa 25MB. Tin nhắn được xóa tự động sau 60 giây.</p>
          </form>
        </div>
      </div>

      {/* THÔNG BÁO DỪNG HOẠT ĐỘNG GIAO DIỆN CŨ VÀO 31/08/2026 */}
      <LegacyUiSunsetModal />
    </div>
  )
}
