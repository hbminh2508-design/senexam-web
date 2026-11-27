'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { chatRequest, configureChatPush } from '@/lib/senChatBrowser'

export function BrowserPushButton({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setEnabled(localStorage.getItem('sen-chat-push:' + userId) === '1' && window.Notification?.permission === 'granted')
  }, [userId])
  return <div>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      setNotice('')
      try {
        await configureChatPush(userId, !enabled)
        setEnabled(!enabled)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Không thể thay đổi quyền thông báo.')
      } finally { setBusy(false) }
    }} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-300 dark:hover:bg-slate-800">
      {enabled ? <BellOff size={16} /> : <Bell size={16} />}
      {enabled ? 'Tắt thông báo trình duyệt' : 'Bật thông báo trình duyệt'}
    </button>
    {notice && <p role="status" className="my-1 text-xs text-amber-700 dark:text-amber-300">{notice}</p>}
  </div>
}

export function ConversationMuteButton({ conversation }: { conversation: string }) {
  const [muted, setMuted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    void chatRequest<{ mutes: string[] }>('notifications?mutes').then(({ mutes }) => {
      if (!cancelled) setMuted(mutes.includes(conversation))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [conversation])
  const label = muted ? 'Bật tiếng hội thoại' : 'Tắt tiếng hội thoại'
  return <button type="button" disabled={busy} aria-label={error ? 'Không thể lưu. ' + label : label} title={error ? 'Không thể lưu. ' + label : label}
    aria-pressed={muted} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
    onClick={async () => {
      setBusy(true)
      setError(false)
      try {
        await chatRequest('notifications', { action: 'mute', conversation, muted: !muted })
        setMuted(!muted)
      } catch { setError(true) }
      finally { setBusy(false) }
    }}>
    {muted ? <BellOff size={17} /> : <Bell size={17} />}
  </button>
}
