'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { ChatCallInvitation, ChatCallModalProps } from '@/components/chat/ChatCallModal'
import { chatRequest, playChatSound, unlockChatAudio } from '@/lib/senChatBrowser'
import { getChatConversation, pullChatInbox, resumeChatOutbox } from '@/lib/senChatInbox'
import { isSessionLocked } from '@/lib/senChatMobileSecurity'
import { getLocalMessages, getLocalSenChatUser, isUserBlocked, saveLocalConversation, saveLocalMessage } from '@/lib/senChatStorage'
import { supabase } from '@/lib/supabaseClient'

const ChatCallModal = dynamic(() => import('@/components/chat/ChatCallModal'), { ssr: false })
const ChatIncomingCallDialog = dynamic(() => import('@/components/chat/ChatCallModal').then((module) => module.ChatIncomingCallDialog), { ssr: false })

function chatDocumentCanCall() {
  const policy = (document as Document & { featurePolicy?: { allowsFeature: (feature: string) => boolean } }).featurePolicy
  if (policy) return policy.allowsFeature('microphone')
  const navigation = performance.getEntriesByType('navigation')[0]
  const initial = new URL(navigation?.name || location.href)
  return initial.hostname === 'chat.senexam.me' || ['/chat', '/m/chat'].includes(initial.pathname)
}

export default function SenChatRuntime() {
  const path = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [incoming, setIncoming] = useState<ChatCallInvitation | null>(null)
  const [active, setActive] = useState<ChatCallModalProps | null>(null)
  const [notice, setNotice] = useState('')
  const activeConversation = useRef<string | null>(null)
  const handled = useRef(new Set<string>())
  const suppressed = useRef(false)
  const canShow = !path?.startsWith('/new-exams/') && !path?.startsWith('/legacy-exams/') &&
    !path?.startsWith('/m/exams/') && !path?.startsWith('/university-exams/') &&
    !path?.startsWith('/exams/university-exams/') && !path?.startsWith('/seb-') &&
    !path?.startsWith('/new-focus') && !path?.startsWith('/legacy-focus') &&
    !path?.startsWith('/fepn-') && !path?.startsWith('/baucu') && !path?.startsWith('/nopquylop') &&
    !path?.startsWith('/breathe-u')
  const isChat = path === '/chat' || path === '/m/chat'

  useEffect(() => {
    suppressed.current = !canShow
    if (!canShow) setActive(null)
    if (!isChat) activeConversation.current = null
  }, [canShow, isChat])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    const unlock = () => unlockChatAudio()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    const view = (event: Event) => { activeConversation.current = (event as CustomEvent<string | null>).detail }
    window.addEventListener('sen-chat-view', view)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('sen-chat-view', view)
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    setIncoming(null)
    setActive(null)
    handled.current.clear()
    void navigator.serviceWorker?.getRegistration('/').then((registration) => {
      registration?.active?.postMessage({ type: 'sen-chat-user', user: userId || '' })
    }).catch(() => {})
    if (!userId) return
    let stopped = false
    let callsPending: Promise<void> | null = null
    let inboxPending: Promise<void> | null = null
    let callsAgain = false
    let inboxAgain = false
    let realtimeReady = false
    const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('sen-chat-alerts:' + userId)
    type MessageNotice = { id: string; conversation: string }
    const notifyMessages = async (messages: MessageNotice[]) => {
      if (!messages.length || stopped || suppressed.current || document.visibilityState !== 'visible' || !document.hasFocus()) return
      const { mutes } = await chatRequest<{ mutes: string[] }>('notifications?mutes').catch(() => ({ mutes: [] }))
      const current = activeConversation.current
      if (messages.some((message) => !mutes.includes(message.conversation) &&
        message.conversation !== current && getChatConversation(message.conversation)?.id !== current)) playChatSound('message')
    }
    if (tabs) tabs.onmessage = ({ data }: MessageEvent<MessageNotice[]>) => { void notifyMessages(data) }

    const syncCalls = () => {
      if (callsPending) { callsAgain = true; return }
      callsPending = (async () => {
        const { calls } = await chatRequest<{ calls: ChatCallInvitation[] }>('call-alerts')
        if (stopped) return
        const available = calls.filter((call) => call.state === 'ringing' && Date.parse(call.expiresAt) > Date.now() &&
          !handled.current.has(call.callId) && !isUserBlocked(call.callerId))
        const requested = new URLSearchParams(window.location.search).get('call')
        setIncoming(available.find((call) => call.callId === requested) || available[0] || null)
        for (const call of calls) {
          if (call.acceptedAt || isUserBlocked(call.callerId) ||
            !(call.state === 'ended' || (call.state === 'ringing' && Date.parse(call.expiresAt) <= Date.now()))) continue
          const key = call.conversationId
          const conversation = getChatConversation(key) || {
            id: key, partnerId: key, partnerName: call.groupName || call.callerName, partnerIdentifier: key,
            isGroup: call.isGroup, unreadCount: 0, updatedAt: Date.now(),
          }
          const id = 'missed_' + call.callId
          if (getLocalMessages(conversation.id).some((message) => message.id === id)) continue
          saveLocalConversation(conversation)
          saveLocalMessage(conversation.id, {
            id, conversationId: conversation.id, senderId: call.callerId, senderName: call.callerName, receiverId: userId,
            type: 'system', content: call.callMode === 'video' ? 'Cuộc gọi video nhỡ' : 'Cuộc gọi thoại nhỡ',
            missedCall: call.callMode, status: 'received', createdAt: call.createdAt,
          })
          window.dispatchEvent(new CustomEvent('sen-chat-update', { detail: conversation.id }))
        }
      })().catch(() => {}).finally(() => {
        callsPending = null
        if (!stopped && callsAgain) { callsAgain = false; syncCalls() }
      })
    }

    const syncInbox = () => {
      if (inboxPending) { inboxAgain = true; return }
      const read = () => pullChatInbox(userId, document.visibilityState === 'visible' ? activeConversation.current : null)
      inboxPending = (async () => {
        const messages = navigator.locks ? await navigator.locks.request('sen-chat-inbox:' + userId, read) : await read()
        if (stopped || !messages.length) return
        tabs?.postMessage(messages)
        await notifyMessages(messages)
      })().catch(() => {}).finally(() => {
        inboxPending = null
        if (!stopped && inboxAgain) { inboxAgain = false; syncInbox() }
      })
    }

    const channel = supabase.channel('sen-alerts:' + userId, { config: { private: true } })
      .on('broadcast', { event: 'call-change' }, syncCalls)
      .on('broadcast', { event: 'inbox-change' }, syncInbox)
      .subscribe((status) => {
        realtimeReady = status === 'SUBSCRIBED'
        if (realtimeReady) { syncCalls(); syncInbox() }
      })
    const sync = () => { syncCalls(); syncInbox() }
    const fallback = setInterval(() => { if (!realtimeReady) sync() }, 4500)
    const online = () => { sync(); void resumeChatOutbox(userId) }
    const reconcile = setInterval(online, 30000)
    window.addEventListener('focus', online)
    window.addEventListener('online', online)
    window.addEventListener('sen-chat-refresh-calls', syncCalls)
    online()
    return () => {
      stopped = true
      clearInterval(fallback)
      clearInterval(reconcile)
      tabs?.close()
      window.removeEventListener('focus', online)
      window.removeEventListener('online', online)
      window.removeEventListener('sen-chat-refresh-calls', syncCalls)
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const onClose = useCallback(() => setActive(null), [])

  useEffect(() => {
    type Start = { conversation: NonNullable<ReturnType<typeof getChatConversation>>; mode: 'voice' | 'video' }
    const start = ({ conversation, mode }: Start) => {
      if (active || !user || !canShow || isSessionLocked()) return
      if (!conversation.isGroup && isUserBlocked(conversation.partnerId)) return
      if (!chatDocumentCanCall()) {
        sessionStorage.setItem('sen-chat-start-intent', JSON.stringify({ id: conversation.id, mode }))
        window.location.assign('/chat?conversation=' + encodeURIComponent(conversation.id))
        return
      }
      unlockChatAudio()
      setActive({
        callMode: mode, conversationId: conversation.id, partnerId: conversation.partnerId,
        partnerName: conversation.partnerName, partnerAvatar: conversation.partnerAvatar,
        isGroup: conversation.isGroup, userRole: conversation.role,
        currentUserId: user.id, currentUserName: getLocalSenChatUser()?.name || user.user_metadata.full_name || 'Thành viên',
        currentUserAvatar: getLocalSenChatUser()?.avatar, onClose,
      })
    }
    const handleStart = (event: Event) => start((event as CustomEvent<Start>).detail)
    const pending = sessionStorage.getItem('sen-chat-start-intent')
    if (user && isChat && pending && !isSessionLocked()) {
      sessionStorage.removeItem('sen-chat-start-intent')
      const { id, mode } = JSON.parse(pending)
      const match = getChatConversation(id)
      if (match && (mode === 'voice' || mode === 'video')) {
        if (chatDocumentCanCall()) start({ conversation: match, mode })
        else setNotice('Trình duyệt đang chặn micrô trên trang này.')
      }
    }
    window.addEventListener('sen-chat-start-call', handleStart)
    return () => window.removeEventListener('sen-chat-start-call', handleStart)
  }, [active, canShow, isChat, onClose, user])

  useEffect(() => {
    if (!incoming) return
    const timer = setTimeout(() => {
      setIncoming((call) => call?.callId === incoming.callId ? null : call)
      window.dispatchEvent(new Event('sen-chat-refresh-calls'))
    }, Math.max(0, Date.parse(incoming.expiresAt) - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [incoming])

  const ring = user && !active && canShow && incoming && (!isChat || !isSessionLocked()) ? incoming : null
  useEffect(() => {
    if (!ring?.callId) return
    let stopped = false
    let timer: ReturnType<typeof setInterval> | undefined
    const sound = () => { if (document.hasFocus() && document.visibilityState === 'visible') playChatSound('call') }
    void chatRequest<{ mutes: string[] }>('notifications?mutes').catch(() => ({ mutes: [] })).then(({ mutes }) => {
      if (stopped || mutes.includes(ring.conversationId)) return
      sound()
      timer = setInterval(sound, 2400)
    })
    return () => { stopped = true; clearInterval(timer) }
  }, [ring?.callId, ring?.conversationId])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const answer = useCallback(async (call: ChatCallInvitation, accept: boolean) => {
    if (!user || handled.current.has(call.callId)) return
    if (isSessionLocked()) {
      window.location.assign('/chat?call=' + call.callId)
      return
    }
    if (accept && !chatDocumentCanCall()) {
      if (isChat && sessionStorage.getItem('sen-chat-reloaded-call') === call.callId) {
        setNotice('Trình duyệt đang chặn micrô trên trang này.')
        return
      }
      sessionStorage.setItem('sen-chat-reloaded-call', call.callId)
      sessionStorage.setItem('sen-chat-answer-intent', call.callId)
      window.location.assign('/chat?call=' + call.callId)
      return
    }
    handled.current.add(call.callId)
    setIncoming(null)
    unlockChatAudio()
    try {
      if (!accept || call.isGroup) {
        await chatRequest('call-alerts', { action: accept ? 'accept' : 'decline', callId: call.callId })
      }
      if (!accept) return
      const conversation = getChatConversation(call.conversationId)
      setActive({
        callMode: call.callMode, isIncoming: true, initialCallId: call.callId,
        conversationId: conversation?.id || call.conversationId, partnerId: call.isGroup ? call.conversationId : call.callerId,
        partnerName: call.groupName || call.callerName, partnerAvatar: call.callerAvatar,
        isGroup: call.isGroup, userRole: conversation?.role,
        currentUserId: user.id, currentUserName: getLocalSenChatUser()?.name || user.user_metadata.full_name || 'Thành viên',
        currentUserAvatar: getLocalSenChatUser()?.avatar, onClose,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể trả lời cuộc gọi.')
    }
  }, [isChat, onClose, user])

  useEffect(() => {
    if (!ring || !isChat || sessionStorage.getItem('sen-chat-answer-intent') !== ring.callId) return
    sessionStorage.removeItem('sen-chat-answer-intent')
    void answer(ring, true)
  }, [answer, isChat, ring])

  return <>
    {ring && <ChatIncomingCallDialog payload={ring} onAccept={() => void answer(ring, true)} onDecline={() => void answer(ring, false)} />}
    {user && active && <ChatCallModal {...active} />}
    {notice && <p role="status" className="fixed right-4 top-20 z-[9999] rounded-xl bg-slate-900 p-3 text-white shadow-xl">{notice}</p>}
  </>
}
