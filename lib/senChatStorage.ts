/**
 * Sen Chat Local-First Storage Engine
 * Thiết kế cho Sen Chat (chat.senexam.me).
 * Triết lý: Toàn bộ dữ liệu tin nhắn, danh bạ, cài đặt nền, biệt danh và danh sách chặn
 * được lưu trữ an toàn trực tiếp trên thiết bị (Local Storage) của người dùng.
 */

export interface SenChatUser {
  id: string
  name: string
  identifier: string // Email hoặc Số điện thoại
  authType: 'senexam' | 'phone' | 'email'
  avatar?: string
  phone?: string
  email?: string
  school?: string
  className?: string
  grade?: string
  createdAt: string
}

export interface SenChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  receiverId: string
  content: string
  type: 'text' | 'image' | 'file' | 'like' | 'system'
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
  createdAt: string
  status: 'sending' | 'sent' | 'received' | 'seen'
  isLocalOnly?: boolean
}

export interface SenChatConversation {
  id: string // partnerId hoặc unique convId
  partnerId: string
  partnerName: string
  partnerIdentifier: string // SĐT hoặc Email
  partnerAvatar?: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  isPinned?: boolean
  updatedAt: number
}

export type ChatWallpaperId = 'default' | 'aurora' | 'sunset' | 'midnight' | 'emerald' | 'sakura'

export interface ChatWallpaper {
  id: ChatWallpaperId
  name: string
  previewClass: string
  bgStyle: string
}

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: 'default',
    name: 'FEPN Liquid Glass (Mặc định)',
    previewClass: 'from-sky-500/20 via-blue-500/10 to-indigo-500/20',
    bgStyle: 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.15), transparent 40%), radial-gradient(circle at 90% 90%, rgba(99, 102, 241, 0.15), transparent 40%), #F4F7FB',
  },
  {
    id: 'aurora',
    name: 'Aurora Cực Quang',
    previewClass: 'from-emerald-500/30 via-teal-500/20 to-indigo-600/30',
    bgStyle: 'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.2), transparent 45%), radial-gradient(circle at 80% 80%, rgba(14, 165, 233, 0.25), transparent 45%), #0c1a29',
  },
  {
    id: 'sunset',
    name: 'Sunset Hoàng Hôn',
    previewClass: 'from-rose-500/25 via-amber-500/20 to-indigo-600/25',
    bgStyle: 'radial-gradient(circle at 15% 15%, rgba(244, 63, 94, 0.18), transparent 40%), radial-gradient(circle at 85% 85%, rgba(245, 158, 11, 0.18), transparent 40%), #1e1328',
  },
  {
    id: 'midnight',
    name: 'Midnight Cyber',
    previewClass: 'from-slate-900 via-indigo-950 to-slate-900',
    bgStyle: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15), transparent 60%), #070B14',
  },
  {
    id: 'emerald',
    name: 'Emerald Mint',
    previewClass: 'from-teal-500/20 via-emerald-400/15 to-cyan-500/20',
    bgStyle: 'radial-gradient(circle at 20% 20%, rgba(20, 184, 166, 0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.15), transparent 40%), #F0FDF4',
  },
  {
    id: 'sakura',
    name: 'Sakura Blossom',
    previewClass: 'from-pink-400/20 via-rose-300/15 to-pink-500/20',
    bgStyle: 'radial-gradient(circle at 15% 15%, rgba(244, 114, 182, 0.2), transparent 40%), radial-gradient(circle at 85% 85%, rgba(251, 113, 133, 0.2), transparent 40%), #FFF1F2',
  },
]

const STORAGE_KEYS = {
  USER: 'sen_chat_current_user',
  DEVICE_ID: 'sen_chat_device_id',
  CONVERSATIONS: 'sen_chat_conversations',
  MESSAGES_PREFIX: 'sen_chat_msgs_',
  NICKNAMES: 'sen_chat_nicknames',
  BLOCKED_USERS: 'sen_chat_blocked_users',
  WALLPAPERS: 'sen_chat_wallpapers',
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
export function getLocalSenChatUser(): SenChatUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function saveLocalSenChatUser(user: SenChatUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

export function clearLocalSenChatUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEYS.USER)
}

// 3. Quản lý Danh Sách Cuộc Trò Chuyện (Conversations)
export function getLocalConversations(): SenChatConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    const list: SenChatConversation[] = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e) {
    return []
  }
}

export function saveLocalConversation(conv: SenChatConversation): void {
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

// 4. Quản lý Lịch Sử Tin Nhắn (Messages)
export function getLocalMessages(conversationId: string): SenChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
    const list: SenChatMessage[] = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } catch (e) {
    return []
  }
}

export function saveLocalMessage(conversationId: string, message: SenChatMessage): void {
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

export function clearAllLocalMessages(conversationId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
}

// 5. Tính Năng Đặt Tên Thân Thuộc / Biệt Danh (Nicknames kiểu Messenger)
export function getLocalNicknames(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NICKNAMES)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function getNicknameFor(partnerId: string): string | null {
  const nicknames = getLocalNicknames()
  return nicknames[partnerId] || null
}

export function setNicknameFor(partnerId: string, nickname: string): void {
  if (typeof window === 'undefined') return
  const nicknames = getLocalNicknames()
  if (!nickname.trim()) {
    delete nicknames[partnerId]
  } else {
    nicknames[partnerId] = nickname.trim()
  }
  localStorage.setItem(STORAGE_KEYS.NICKNAMES, JSON.stringify(nicknames))
}

// 6. Tính Năng Chặn Người Dùng (Block Users)
export function getBlockedUsers(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOCKED_USERS)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function isUserBlocked(userId: string): boolean {
  const blocked = getBlockedUsers()
  return blocked.includes(userId)
}

export function blockUser(userId: string): void {
  if (typeof window === 'undefined') return
  const blocked = getBlockedUsers()
  if (!blocked.includes(userId)) {
    blocked.push(userId)
    localStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(blocked))
  }
}

export function unblockUser(userId: string): void {
  if (typeof window === 'undefined') return
  const blocked = getBlockedUsers().filter((id) => id !== userId)
  localStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(blocked))
}

// 7. Tính Năng Đổi Nền Nhắn Tin (Wallpapers)
export function getLocalWallpapers(): Record<string, ChatWallpaperId> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WALLPAPERS)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function getWallpaperFor(conversationId: string): ChatWallpaperId {
  const wallpapers = getLocalWallpapers()
  return wallpapers[conversationId] || 'default'
}

export function setWallpaperFor(conversationId: string, wallpaperId: ChatWallpaperId): void {
  if (typeof window === 'undefined') return
  const wallpapers = getLocalWallpapers()
  wallpapers[conversationId] = wallpaperId
  localStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(wallpapers))
}

// 8. Sao Lưu & Đồng Bộ Dữ Liệu
export function exportLocalData(): string {
  if (typeof window === 'undefined') return '{}'
  const user = getLocalSenChatUser()
  const conversations = getLocalConversations()
  const nicknames = getLocalNicknames()
  const blocked = getBlockedUsers()
  const wallpapers = getLocalWallpapers()
  const messages: Record<string, SenChatMessage[]> = {}
  conversations.forEach((c) => {
    messages[c.id] = getLocalMessages(c.id)
  })

  return JSON.stringify({
    version: 2,
    appName: 'SenChat',
    exportedAt: new Date().toISOString(),
    user,
    conversations,
    nicknames,
    blocked,
    wallpapers,
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
    if (data.nicknames && typeof data.nicknames === 'object') {
      localStorage.setItem(STORAGE_KEYS.NICKNAMES, JSON.stringify(data.nicknames))
    }
    if (data.blocked && Array.isArray(data.blocked)) {
      localStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(data.blocked))
    }
    if (data.wallpapers && typeof data.wallpapers === 'object') {
      localStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(data.wallpapers))
    }
    if (data.user && !getLocalSenChatUser()) {
      saveLocalSenChatUser(data.user)
    }
    return true
  } catch (e) {
    console.error('Lỗi nhập dữ liệu sao lưu Sen Chat:', e)
    return false
  }
}
