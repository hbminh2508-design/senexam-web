/**
 * Zalo Local-First Storage Engine
 * Triết lý: Toàn bộ dữ liệu tin nhắn, danh bạ được lưu trữ trực tiếp trên thiết bị (Local Storage).
 * Hoạt động độc lập, bảo mật tuyệt đối giống như Zalo Desktop / Web.
 */

export interface ZaloUser {
  id: string
  name: string
  identifier: string // Gmail hoặc Số điện thoại
  authType: 'phone' | 'gmail'
  avatar?: string
  phone?: string
  email?: string
  createdAt: string
}

export interface ZaloMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  receiverId: string
  content: string
  type: 'text' | 'image' | 'file' | 'like'
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
  createdAt: string
  status: 'sending' | 'sent' | 'received' | 'seen'
  isLocalOnly?: boolean
}

export interface ZaloConversation {
  id: string // partnerId hoặc unique convId
  partnerId: string
  partnerName: string
  partnerIdentifier: string // SĐT hoặc Gmail
  partnerAvatar?: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  isPinned?: boolean
  updatedAt: number
}

const STORAGE_KEYS = {
  USER: 'zalo_chat_current_user',
  DEVICE_ID: 'zalo_chat_device_id',
  CONVERSATIONS: 'zalo_chat_conversations',
  MESSAGES_PREFIX: 'zalo_chat_msgs_',
  SETTINGS: 'zalo_chat_settings',
}

// 1. Quản lý Thiết Bị (Device ID)
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device'
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36)
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId)
  }
  return deviceId
}

// 2. Quản lý Người Dùng Hiện Tại (User Session)
export function getLocalZaloUser(): ZaloUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function saveLocalZaloUser(user: ZaloUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

export function clearLocalZaloUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEYS.USER)
}

// 3. Quản lý Danh Sách Cuộc Trò Chuyện (Conversations)
export function getLocalConversations(): ZaloConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    const list: ZaloConversation[] = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e) {
    return []
  }
}

export function saveLocalConversation(conv: ZaloConversation): void {
  if (typeof window === 'undefined') return
  const list = getLocalConversations()
  const existingIdx = list.findIndex((c) => c.id === conv.id)
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...conv, updatedAt: Date.now() }
  } else {
    list.unshift({ ...conv, updatedAt: Date.now() })
  }
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(list))
}

export function deleteLocalConversation(convId: string): void {
  if (typeof window === 'undefined') return
  const list = getLocalConversations().filter((c) => c.id !== convId)
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(list))
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`)
}

// 4. Quản lý Lịch Sử Tin Nhắn (Messages - Lưu trực tiếp trên thiết bị)
export function getLocalMessages(conversationId: string): ZaloMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
    const list: ZaloMessage[] = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } catch (e) {
    return []
  }
}

export function saveLocalMessage(conversationId: string, message: ZaloMessage): void {
  if (typeof window === 'undefined') return
  const list = getLocalMessages(conversationId)
  const existingIdx = list.findIndex((m) => m.id === message.id)
  if (existingIdx >= 0) {
    list[existingIdx] = message
  } else {
    list.push(message)
  }

  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(list))

  // Cập nhật lastMessage cho Conversation
  const convs = getLocalConversations()
  const c = convs.find((item) => item.id === conversationId)
  if (c) {
    c.lastMessage = message.type === 'image' ? '[Hình ảnh]' : message.type === 'like' ? '👍' : message.content
    c.lastMessageTime = new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    c.updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs))
  }
}

export function deleteLocalMessage(conversationId: string, messageId: string): void {
  if (typeof window === 'undefined') return
  const list = getLocalMessages(conversationId).filter((m) => m.id !== messageId)
  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(list))
}

export function clearAllLocalMessages(conversationId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
}

// 5. Sao Lưu & Đồng Bộ Dữ Liệu Cục Bộ (Backup & Restore)
export function exportLocalData(): string {
  if (typeof window === 'undefined') return '{}'
  const user = getLocalZaloUser()
  const conversations = getLocalConversations()
  const messages: Record<string, ZaloMessage[]> = {}
  conversations.forEach((c) => {
    messages[c.id] = getLocalMessages(c.id)
  })

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    user,
    conversations,
    messages,
  })
}

export function importLocalData(jsonString: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const data = JSON.parse(jsonString)
    if (data.conversations && Array.isArray(data.conversations)) {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(data.conversations))
    }
    if (data.messages && typeof data.messages === 'object') {
      Object.keys(data.messages).forEach((convId) => {
        localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, JSON.stringify(data.messages[convId]))
      })
    }
    if (data.user && !getLocalZaloUser()) {
      saveLocalZaloUser(data.user)
    }
    return true
  } catch (e) {
    console.error('Lỗi nhập dữ liệu sao lưu:', e)
    return false
  }
}
