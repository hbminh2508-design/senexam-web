'use client'

import { ArrowLeft, ExternalLink, Send } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BrowserPushButton, ConversationMuteButton } from '@/components/chat/ChatNotificationControls'
import { chatConversationKey, deliverLocalMessage } from '@/lib/senChatInbox'
import { getLocalConversations, getLocalMessages, getLocalSenChatUser, isUserBlocked, saveLocalConversation, type SenChatConversation } from '@/lib/senChatStorage'
import { isAppLockConfigured } from '@/lib/senChatMobileSecurity'

export default function SenChatQuickMessages({ userId }: { userId: string | null }) {
  const [key, setKey] = useState<string | null>(null)
  const [, setRevision] = useState(0)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const locked = typeof window !== 'undefined' && isAppLockConfigured()

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('sen-chat-update', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('sen-chat-update', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => () => { window.dispatchEvent(new CustomEvent('sen-chat-view', { detail: null })) }, [])

  if (!userId) return <p className="p-5 text-sm text-slate-600 dark:text-slate-300"><Link href="/chat" className="font-semibold text-sky-700 underline dark:text-sky-300">Mở Sen Chat</Link> để đăng nhập và nhắn tin.</p>
  if (locked) return <p className="p-5 text-sm text-slate-600 dark:text-slate-300">Hãy <Link href="/chat" className="font-semibold underline">mở khóa Sen Chat</Link> để xem tin nhắn.</p>
  const conversations = getLocalConversations().filter((item) => item.id !== 'senai-studio')
  const selected = conversations.find((item) => item.id === key)
  const select = (conversation: SenChatConversation) => {
    setKey(conversation.id)
    setDraft('')
    setError('')
    saveLocalConversation({ ...conversation, unreadCount: 0 })
    window.dispatchEvent(new CustomEvent('sen-chat-update', { detail: conversation.id }))
    window.dispatchEvent(new CustomEvent('sen-chat-view', { detail: conversation.id }))
  }
  const leave = () => {
    setKey(null)
    window.dispatchEvent(new CustomEvent('sen-chat-view', { detail: null }))
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    {selected ? <>
      <div className="flex items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
        <button aria-label="Về danh sách hội thoại" type="button" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={leave}><ArrowLeft size={18} /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.partnerName}</span>
        <ConversationMuteButton key={selected.id} conversation={chatConversationKey(selected)} />
        <Link aria-label="Mở toàn màn hình" href={'/chat?conversation=' + encodeURIComponent(chatConversationKey(selected))} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ExternalLink size={16} /></Link>
      </div>
      <div aria-live="polite" className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto p-3 text-sm">
        {getLocalMessages(selected.id).slice(-16).reverse().map((message) => <div key={message.id}
          className={`my-1 max-w-[85%] break-words rounded-2xl px-3 py-2 ${message.senderId === userId ? 'self-end bg-sky-700 text-white' : 'self-start bg-slate-100 dark:bg-slate-800'}`}>
          {message.type === 'text' || message.type === 'system' ? message.content : 'Tệp đính kèm'}
          {message.senderId === userId && message.status === 'sending' && <span className="block text-xs opacity-80">Đang gửi</span>}
          {message.senderId === userId && message.status === 'waiting_for_device' && <span className="block text-xs opacity-90">Chờ người nhận mở Sen Chat</span>}
          {message.senderId === userId && message.status === 'failed' &&
            <button type="button" className="block text-xs font-semibold underline" title="Gửi thất bại" onClick={() => {
              void deliverLocalMessage(message, selected).catch((reason) => setError(reason.message))
            }}>Thử lại</button>}
        </div>)}
      </div>
      {error && <p role="status" className="px-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <form className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800" onSubmit={async (event) => {
        event.preventDefault()
        if (!draft.trim() || sending || (!selected.isGroup && isUserBlocked(selected.partnerId))) return
        const submittedDraft = draft
        const id = crypto.randomUUID()
        setSending(true)
        setError('')
        try {
          await deliverLocalMessage({
            id, conversationId: selected.id, senderId: userId,
            senderName: getLocalSenChatUser()?.name || 'Bạn bè', receiverId: selected.partnerId,
            content: submittedDraft.trim(), type: 'text', createdAt: new Date().toISOString(), status: 'sending',
          }, selected)
          setDraft((current) => current === submittedDraft ? '' : current)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Không gửi được tin nhắn.')
          if (getLocalMessages(selected.id).some((message) => message.id === id)) {
            setDraft((current) => current === submittedDraft ? '' : current)
          }
        } finally { setSending(false) }
      }}>
        <input aria-label="Nhắn tin" placeholder="Nhắn tin…" maxLength={8000} value={draft} onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        <button type="submit" aria-label="Gửi" disabled={sending || !draft.trim()} className="rounded-xl bg-sky-700 p-2.5 text-white disabled:opacity-40"><Send size={16} /></button>
      </form>
    </> : <>
      <div className="border-b border-slate-200 px-3 py-1 dark:border-slate-800"><BrowserPushButton userId={userId} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {conversations.slice(0, 20).map((conversation) => <button type="button" key={conversation.id} onClick={() => select(conversation)}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">{conversation.partnerName[0]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{conversation.partnerName}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{conversation.lastMessage}</span>
          </span>
          {conversation.unreadCount > 0 && <span className="rounded-full bg-sky-700 px-2 py-0.5 text-xs font-bold text-white">{conversation.unreadCount}</span>}
        </button>)}
        {!conversations.length && <p className="p-3 text-sm text-slate-500">Chưa có hội thoại nào.</p>}
      </div>
      <Link href="/chat" className="border-t border-slate-200 p-3 text-center text-sm font-semibold text-sky-700 dark:border-slate-800 dark:text-sky-300">Mở Sen Chat</Link>
    </>}
  </div>
}
