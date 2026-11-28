'use client'

import { chatRequest } from '@/lib/senChatBrowser'
import { getSecureCryptoKey, saveSecureCryptoKey } from '@/lib/senChatSignalProtocol'
import { compressChatMessage, decompressChatMessage } from '@/lib/senChatCompression'
import { supabase } from '@/lib/supabaseClient'
import { getSenChatAccount } from '@/lib/senChatAccount.mjs'
import { generateInboxKeyPair, openInboxPayload, sealInboxPayload } from './senChatInboxCrypto.mjs'
import {
  getLocalConversations, getLocalMessages, isUserBlocked, saveLocalConversation, saveLocalMessage,
  type SenChatConversation, type SenChatMessage,
} from '@/lib/senChatStorage'

type RegisteredDevice = { id: string; publicKey: JsonWebKey; privateKey: CryptoKey }
type PublicDevice = { user_id: string; device_id: string; public_key: JsonWebKey }
type Delivery = {
  sender_id: string; message_id: string; wrapped_key: string; wrap_iv: string
  chat_inbox_messages: {
    group_id: string | null; ciphertext: string; iv: string; ephemeral_key: JsonWebKey; created_at: string
  }
}
const devices = new Map<string, Promise<RegisteredDevice>>()
const outbox = new Map<string, Promise<void>>()
const draining = new Set<string>()
class RecipientDevicePending extends Error {}
export function registerInboxDevice(userId: string) {
  const current = devices.get(userId)
  if (current) return current
  const keyName = 'sen-chat-inbox-v1:' + userId
  const load = async () => {
    let device: RegisteredDevice | null = await getSecureCryptoKey(keyName)
    if (!device) {
      const pair = await generateInboxKeyPair()
      device = { id: crypto.randomUUID(), publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey), privateKey: pair.privateKey }
      await saveSecureCryptoKey(keyName, device)
    }
    await chatRequest('inbox', { action: 'register', device: device.id, key: device.publicKey }, 'POST', userId)
    return device
  }
  const loadWithLock = async () => navigator.locks ? await navigator.locks.request(keyName, load) : await load()
  const pending = loadWithLock().catch((error) => {
    devices.delete(userId)
    throw error
  })
  devices.set(userId, pending)
  return pending
}

function messageContext(sender: string, message: string, group: string | null | undefined) {
  return `sen-inbox-v1:${sender}:${message}:${group || 'direct'}`
}

export async function sendInboxMessage(message: SenChatMessage, conversation: SenChatConversation) {
  const address = conversation.isGroup ? { group: conversation.id } : { recipient: conversation.partnerId }
  const { devices: targets } = await chatRequest<{ devices: PublicDevice[] }>('inbox', { action: 'keys', ...address }, 'POST', message.senderId)
  if (!targets.length) throw new RecipientDevicePending()
  const context = messageContext(message.senderId, message.id, address.group)
  const payload = { ...message, content: await compressChatMessage(message.content) }
  const envelope = await sealInboxPayload(JSON.stringify(payload), context, targets)
  await chatRequest('inbox', { action: 'send', ...address, id: message.id, ...envelope }, 'POST', message.senderId)
}

export function deliverLocalMessage(message: SenChatMessage, conversation: SenChatConversation) {
  if (getSenChatAccount() !== message.senderId) return Promise.reject(new Error('Tài khoản Sen Chat đã thay đổi.'))
  const id = message.senderId + ':' + message.id
  const ongoing = outbox.get(id)
  if (ongoing) return ongoing
  const save = (status: SenChatMessage['status']) => {
    if (getSenChatAccount() !== message.senderId) return
    saveLocalMessage(conversation.id, { ...message, status })
    window.dispatchEvent(new CustomEvent('sen-chat-update', { detail: conversation.id }))
  }
  if (message.status !== 'waiting_for_device') save('sending')
  const delivery = sendInboxMessage(message, conversation).then(
    () => save('sent'),
    (error) => {
      if (error instanceof RecipientDevicePending) {
        if (message.status !== 'waiting_for_device') save('waiting_for_device')
        return
      }
      save(navigator.onLine ? 'failed' : 'sending')
      throw error
    },
  ).finally(() => outbox.delete(id))
  outbox.set(id, delivery)
  return delivery
}

export async function resumeChatOutbox(userId: string) {
  if (!navigator.onLine || draining.has(userId)) return
  draining.add(userId)
  try {
    for (const conversation of getLocalConversations()) {
      if (!conversation.isGroup && isUserBlocked(conversation.partnerId)) continue
      const messages = getLocalMessages(conversation.id).filter((message) =>
        message.senderId === userId && ['sending', 'waiting_for_device'].includes(message.status) && !message.isLocalOnly,
      )
      for (const message of messages) {
        if ((await supabase.auth.getSession()).data.session?.user.id !== userId) return
        await deliverLocalMessage(message, conversation).catch(() => {})
        if (getLocalMessages(conversation.id).find((item) => item.id === message.id)?.status === 'waiting_for_device') break
      }
    }
  } finally {
    draining.delete(userId)
  }
}

export function chatConversationKey(conversation: SenChatConversation) {
  return conversation.isGroup ? conversation.id : conversation.partnerId
}

export function getChatConversation(key: string) {
  return getLocalConversations().find((conversation) => chatConversationKey(conversation) === key || conversation.id === key)
}

export function startChatCall(conversation: SenChatConversation, mode: 'voice' | 'video') {
  window.dispatchEvent(new CustomEvent('sen-chat-start-call', { detail: { conversation, mode } }))
}

export async function pullChatInbox(userId: string, activeConversation: string | null) {
  const device = await registerInboxDevice(userId)
  const { deliveries } = await chatRequest<{ deliveries: Delivery[] }>('inbox?device=' + device.id, undefined, 'GET', userId)
  if ((await supabase.auth.getSession()).data.session?.user.id !== userId) return []
  const stored: { id: string; conversation: string }[] = []
  const receipts: { sender: string; id: string }[] = []
  for (const delivery of deliveries) {
    const { sender_id: sender, message_id: id, chat_inbox_messages: encrypted } = delivery
    const receipt = { sender, id }
    if (isUserBlocked(sender)) { receipts.push(receipt); continue }
    const key = encrypted.group_id || sender
    const existing = getChatConversation(key)
    const conversationId = existing?.id || key
    if (getSenChatAccount() !== userId) return []
    if (getLocalMessages(conversationId).some((message) => message.id === id)) { receipts.push(receipt); continue }
    let incoming: SenChatMessage
    try {
      const context = messageContext(sender, id, encrypted.group_id)
      const plaintext = await openInboxPayload(encrypted, delivery, device.privateKey, context, userId, device.id)
      incoming = JSON.parse(plaintext) as SenChatMessage
      if (incoming.id !== id || incoming.senderId !== sender || typeof incoming.content !== 'string' ||
        !['text', 'image', 'file', 'audio', 'video', 'like', 'system'].includes(incoming.type)) throw new Error('Tin nhắn không hợp lệ')
      incoming.content = await decompressChatMessage(incoming.content)
    } catch {
      receipts.push(receipt) // Malformed ciphertext must not block newer deliveries.
      continue
    }
    if (getLocalMessages(conversationId).some((message) => message.id === id)) { receipts.push(receipt); continue }
    if (getSenChatAccount() !== userId) return []
    const conversation: SenChatConversation = existing || {
      id: conversationId, partnerId: key, partnerName: encrypted.group_id ? 'Nhóm Sen Chat' : incoming.senderName || 'Bạn bè',
      partnerIdentifier: key, unreadCount: 0, updatedAt: Date.now(), isGroup: Boolean(encrypted.group_id),
    }
    const open = activeConversation === conversationId || activeConversation === key
    saveLocalConversation({ ...conversation, unreadCount: open ? 0 : conversation.unreadCount + 1 })
    saveLocalMessage(conversationId, {
      ...incoming, conversationId, senderId: sender, receiverId: userId, createdAt: encrypted.created_at, status: 'received',
    })
    window.dispatchEvent(new CustomEvent('sen-chat-update', { detail: conversationId }))
    stored.push({ id, conversation: key })
    receipts.push(receipt)
  }
  if (receipts.length) await chatRequest('inbox', { action: 'ack', device: device.id, receipts }, 'POST', userId).catch(() => {})
  return stored
}
