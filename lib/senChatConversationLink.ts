'use client'

import { useEffect, useRef } from 'react'
import type { SenChatConversation } from '@/lib/senChatStorage'

const linkPath = /^\/(?:(?:m\/)?chat\/)?e2ee\/([0-9a-f]{64})\/?$/
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function isSenChatPage(path: string | null) {
  return !!path && (path === '/chat' || path === '/m/chat' || linkPath.test(path))
}

async function conversationCode(userId: string, conversation: SenChatConversation) {
  const id = conversation.isGroup ? conversation.id : conversation.partnerId
  if (!uuid.test(id) || !uuid.test(userId) || (!conversation.isGroup && userId === id)) return null
  const identity = conversation.isGroup ? 'group:' + id.toLowerCase() : 'direct:' + [userId.toLowerCase(), id.toLowerCase()].sort().join(':')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sen-chat-link:v1:' + identity))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function useSenChatConversationLink(
  userId: string | undefined,
  conversations: SenChatConversation[],
  selected: SenChatConversation | null | undefined,
  select: (id: string) => void,
) {
  const resolving = useRef<string | null | undefined>(undefined)
  const selectRef = useRef(select)
  selectRef.current = select

  useEffect(() => {
    if (!userId) return
    if (resolving.current === undefined) resolving.current = location.pathname.match(linkPath)?.[1] ?? null
    const requested = resolving.current
    let cancelled = false
    const update = async () => {
      if (requested) {
        const codes = await Promise.all(conversations.map(async (item) => [item.id, await conversationCode(userId, item)] as const))
        if (cancelled) return
        const match = codes.find(([, code]) => code === requested)
        if (match) {
          resolving.current = null
          selectRef.current(match[0])
        }
        return
      }
      const code = selected ? await conversationCode(userId, selected) : null
      if (cancelled) return
      const url = new URL(location.href)
      if (url.searchParams.has('call') || url.searchParams.has('join')) return
      const legacyTarget = url.searchParams.get('conversation')
      if (legacyTarget && legacyTarget !== selected?.id && legacyTarget !== selected?.partnerId) return
      if (!code && !linkPath.test(url.pathname)) return
      const onChatHost = url.hostname === 'chat.senexam.me'
      url.pathname = code ? (onChatHost ? '/e2ee/' : '/chat/e2ee/') + code : '/chat'
      url.searchParams.delete('conversation')
      if (url.href !== location.href) history.replaceState(null, '', url)
    }
    void update().catch(() => {})
    return () => { cancelled = true }
  }, [userId, conversations, selected])
}

export function senChatLoginReturnUrl() {
  return (linkPath.test(location.pathname) ? location.pathname : '/chat') + location.search
}
