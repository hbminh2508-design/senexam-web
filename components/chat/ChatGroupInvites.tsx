'use client'

import { useCallback, useEffect, useState } from 'react'
import { chatRequest } from '@/lib/senChatBrowser'
import { getLocalConversations, saveLocalConversation } from '@/lib/senChatStorage'

type Invite = { token: string | null; approval: boolean; requests: { id: string; name: string }[] }

export function ChatGroupInvites({ conversationId, owner }: { conversationId: string; owner: boolean }) {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const update = useCallback(async (action = 'get', extra = {}) => {
    setBusy(true)
    setNotice('')
    try {
      const result = await chatRequest<Invite>('group-invites', { action, conversationId, ...extra })
      setInvite(['approve', 'reject'].includes(action)
        ? await chatRequest<Invite>('group-invites', { action: 'get', conversationId })
        : result)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải lời mời.') }
    finally { setBusy(false) }
  }, [conversationId])
  useEffect(() => { void update() }, [update])
  const link = invite?.token ? `${window.location.origin}/chat?join=${invite.token}` : ''
  return <section aria-label="Liên kết mời và phòng chờ" className="space-y-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
    <h4 className="font-semibold">Liên kết mời</h4>
    {link && <div className="flex gap-2">
      <input aria-label="Đường dẫn mời" readOnly value={link} onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-2 text-xs" />
      <button type="button" className="rounded-lg bg-sky-700 px-2 py-1 text-xs font-semibold text-white" onClick={() => {
        void navigator.clipboard.writeText(link).then(() => setNotice('Đã sao chép liên kết.')).catch(() => setNotice('Chọn đường dẫn để sao chép.'))
      }}>Sao chép</button>
    </div>}
    {owner && <div className="flex flex-wrap gap-2">
      {invite?.token ? <label className="inline-flex items-center gap-2">
        <input type="checkbox" disabled={busy} checked={invite.approval} onChange={(event) => void update('configure', { approval: event.target.checked })} />
        Duyệt qua phòng chờ
      </label> : <button type="button" disabled={busy || !invite} className="font-semibold text-sky-700 dark:text-sky-300"
        onClick={() => void update('configure', { approval: true })}>Tạo liên kết mời</button>}
      {invite?.token && <button type="button" disabled={busy} className="text-xs underline"
        onClick={() => { if (window.confirm('Đổi liên kết và vô hiệu hóa đường dẫn cũ?')) void update('rotate') }}>Đổi liên kết</button>}
    </div>}
    <div className="space-y-2">
      <div className="flex justify-between gap-2"><h4 className="font-semibold">Phòng chờ</h4>
        <button type="button" disabled={busy} className="text-xs underline" onClick={() => void update()}>Làm mới</button></div>
      {invite?.requests.map((request) => <div key={request.id} className="flex flex-wrap items-center gap-2 py-1">
        <span className="min-w-0 flex-1 truncate">{request.name}</span>
        <button type="button" disabled={busy} className="font-semibold text-sky-700 dark:text-sky-300"
          onClick={() => void update('approve', { target: request.id })}>Duyệt</button>
        <button type="button" disabled={busy} className="text-rose-600 dark:text-rose-300"
          onClick={() => void update('reject', { target: request.id })}>Từ chối</button>
      </div>)}
      {invite && !invite.requests.length && <p className="text-xs text-slate-500">Chưa có yêu cầu.</p>}
    </div>
    {notice && <p role="status" className="text-xs">{notice}</p>}
  </section>
}

export function ChatGroupInviteJoin() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get('join') || ''
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(incoming)) setToken(incoming)
  }, [])
  if (!token) return null
  const close = () => {
    const url = new URL(location.href)
    url.searchParams.delete('join')
    window.history.replaceState(null, '', url)
    setToken('')
  }
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/45 p-4">
    <section role="dialog" aria-modal="true" aria-label="Tham gia nhóm Sen Chat" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white">
      <h2 className="font-semibold">Tham gia nhóm Sen Chat</h2>
      {status && <p role="status" className="text-sm">{status}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={close} className="px-2 py-1 text-sm">Đóng</button>
        <button type="button" disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white" onClick={async () => {
          setBusy(true)
          try {
            const result = await chatRequest<{ state: 'joined' | 'pending'; conversationId?: string; title?: string }>('group-invites', { action: 'join', token })
            if (result.state === 'pending') { setStatus('Yêu cầu đã gửi. Quay lại liên kết để kiểm tra sau khi được duyệt.'); return }
            const id = result.conversationId
            if (!id) return
            if (!getLocalConversations().some((entry) => entry.id === id)) saveLocalConversation({
              id, partnerId: id, partnerName: result.title || 'Nhóm Sen Chat', partnerIdentifier: 'MLS_GROUP',
              isGroup: true, role: 'member', unreadCount: 0, updatedAt: Date.now(),
            })
            const url = new URL(location.href)
            url.searchParams.delete('join')
            url.searchParams.set('conversation', id)
            location.replace(url)
          } catch (error) { setStatus(error instanceof Error ? error.message : 'Không thể tham gia nhóm.') }
          finally { setBusy(false) }
        }}>{status ? 'Kiểm tra lại' : 'Tham gia nhóm'}</button>
      </div>
    </section>
  </div>
}
