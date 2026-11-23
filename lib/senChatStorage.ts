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
  type: 'text' | 'image' | 'file' | 'audio' | 'like' | 'system'
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
  attachmentId?: string
  driveFileId?: string
  storageProvider?: string
  fileKeyBase64?: string
  mimeType?: string
  duration?: number
  waveform?: number[]
  transcription?: string
  transcriptionLanguage?: string
  sttProvider?: 'device' | 'server'
  createdAt: string
  status: 'sending' | 'sent' | 'received' | 'seen'
  isLocalOnly?: boolean
  isSenAi?: boolean
  invokedBy?: string
  expiresAt?: string
  isPinnedPermanent?: boolean
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
  isGroup?: boolean
  epoch?: number
  role?: 'owner' | 'admin' | 'member'
  avatarUrl?: string
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
  EPHEMERAL_ENABLED: 'sen_chat_ephemeral_enabled',
  FONT_SIZE: 'sen_chat_font_size',
  SEND_KEY: 'sen_chat_send_key',
  NOTIFICATIONS: 'sen_chat_notifications_config',
}

export const TEXT_MESSAGE_RETENTION_DAYS = 30
export const TEXT_MESSAGE_RETENTION_MS = TEXT_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000
export const CHAT_RETENTION_POLICY_NOTICE = 'Tin nhắn văn bản được bảo mật lưu trữ 30 ngày. Nhóm trò chuyện và liên lạc được lưu giữ vĩnh viễn.'

export const SENAI_STUDIO_CONVERSATION_ID = 'senai-studio'
export const SENAI_STUDIO_CONVERSATION: SenChatConversation = {
  id: SENAI_STUDIO_CONVERSATION_ID,
  partnerId: SENAI_STUDIO_CONVERSATION_ID,
  partnerName: 'SenAI Studio',
  partnerIdentifier: 'senai@senexam.me',
  isPinned: true,
  unreadCount: 0,
  updatedAt: 9999999999999,
  lastMessage: 'Trợ lý học tập & nghiên cứu SenAI Studio (Hợp nhất)',
  role: 'admin',
  avatarUrl: '/images/senai-avatar.png',
}

/**
 * Đảm bảo mục SenAI Studio luôn luôn được ghim ở đầu tiên (index 0, isPinned: true)
 */
export function ensureSenAiStudioInConversations(list: SenChatConversation[]): SenChatConversation[] {
  const filtered = (list || []).filter((c) => c.id !== SENAI_STUDIO_CONVERSATION_ID)
  return [{ ...SENAI_STUDIO_CONVERSATION, isPinned: true }, ...filtered]
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
  if (convId === SENAI_STUDIO_CONVERSATION_ID) return // SenAI Studio vĩnh viễn không bị xóa
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

    // 1. SenAI Studio: Tin nhắn vĩnh viễn không bao giờ bị dọn dẹp theo chính sách 30 ngày
    if (conversationId === SENAI_STUDIO_CONVERSATION_ID) {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    // 2. Các cuộc hội thoại khác: Tin nhắn văn bản tuân theo vòng đời 30 ngày
    // Tệp đính kèm có vòng đời riêng biệt và có thể được gia hạn bởi trưởng nhóm
    const cutoff = Date.now() - TEXT_MESSAGE_RETENTION_MS
    let hasExpired = false
    const valid = list.filter((m) => {
      if (m.attachmentId || m.storagePath || m.driveFileId) {
        return true // Tệp đính kèm tuân theo retention của storage
      }
      const msgTime = new Date(m.createdAt).getTime()
      if (msgTime < cutoff) {
        hasExpired = true
        return false
      }
      return true
    })

    if (hasExpired) {
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(valid))
    }

    return valid.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
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
    c.lastMessage =
      message.type === 'image'
        ? '[Hình ảnh]'
        : message.type === 'audio'
        ? (message.transcription ? `🎤 ${message.transcription}` : '[Tin nhắn thoại]')
        : message.type === 'like'
        ? '👍'
        : message.content
    c.lastMessageTime = new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    c.updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs))
  }
}

export function saveLocalMessages(conversationId: string, messages: SenChatMessage[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(messages))

  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    const convs = getLocalConversations()
    const c = convs.find((item) => item.id === conversationId)
    if (c && last) {
      c.lastMessage =
        last.type === 'image'
          ? '[Hình ảnh]'
          : last.type === 'audio'
          ? (last.transcription ? `🎤 ${last.transcription}` : '[Tin nhắn thoại]')
          : last.type === 'like'
          ? '👍'
          : last.content
      c.lastMessageTime = new Date(last.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      c.updatedAt = Date.now()
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs))
    }
  }
}

export function deleteLocalMessage(conversationId: string, messageId: string): void {
  if (typeof window === 'undefined') return
  const list = getLocalMessages(conversationId)
  const filtered = list.filter((m) => m.id !== messageId)
  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(filtered))
}

export function clearAllLocalMessages(conversationId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
  try {
    const convs = getLocalConversations()
    const c = convs.find((item) => item.id === conversationId)
    if (c) {
      c.lastMessage = undefined
      c.lastMessageTime = undefined
      c.unreadCount = 0
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs))
    }
  } catch (e) {
    console.warn('Lỗi cập nhật hội thoại khi xóa tin nhắn:', e)
  }
}

/**
 * Xóa sạch toàn bộ tin nhắn tạm thời trong tất cả các cuộc hội thoại
 * Bảo toàn danh sách cuộc trò chuyện và thứ tự thời gian chính xác của người dùng.
 * Các tệp đính kèm đã gửi trên máy chủ/lưu trữ được giữ nguyên vẹn.
 */
export function clearAllEphemeralMessages(): void {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))

    // Cập nhật các cuộc hội thoại: Giữ lại toàn bộ người nhắn tin (partnerId, partnerName, avatarUrl, isGroup...)
    // và bảo toàn đúng thứ tự sắp xếp thời gian (updatedAt không bị đảo lộn).
    const convs = getLocalConversations()
    if (convs.length > 0) {
      const sanitizedConvs = convs.map((c) => ({
        ...c,
        lastMessage: undefined,
        lastMessageTime: undefined,
        unreadCount: 0,
      }))
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(sanitizedConvs))
    }
  } catch (e) {
    console.warn('Lỗi dọn dẹp tin nhắn tạm thời:', e)
  }
}

/**
 * Kiểm tra xem chế độ dọn dẹp bộ nhớ tạm khi thoát web có đang bật hay không
 * Mặc định: TẮT (false) để lưu trữ chat bền vững trong Local Storage theo yêu cầu người dùng
 */
export function isEphemeralStorageEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_ENABLED)
  if (saved === null) return false // Mặc định tắt: Lưu trữ bền vững
  return saved === 'true'
}

export function setEphemeralStorageEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.EPHEMERAL_ENABLED, enabled ? 'true' : 'false')
}

/**
 * Dọn sạch dữ liệu phiên Sen Chat trên thiết bị khi Đăng xuất:
 * - Xóa sạch mảng tin nhắn qua clearAllEphemeralMessages()
 * - Giữ lại danh sách người nhắn tin (CONVERSATIONS) theo đúng thứ tự
 * - Giữ nguyên các tệp đã gửi
 * - Xóa thông tin phiên người dùng hiện tại
 */
export function clearAllLocalChatData(): void {
  if (typeof window === 'undefined') return
  try {
    clearAllEphemeralMessages()
    clearLocalSenChatUser()
    // Lưu ý: Danh sách hội thoại CONVERSATIONS vẫn được giữ lại theo đúng thứ tự
    localStorage.removeItem(STORAGE_KEYS.NICKNAMES)
    localStorage.removeItem(STORAGE_KEYS.WALLPAPERS)
    localStorage.removeItem(STORAGE_KEYS.BLOCKED_USERS)
    try {
      sessionStorage.removeItem('sen_chat_active_session')
    } catch {}
  } catch (e) {
    console.warn('Lỗi xóa toàn bộ dữ liệu Sen Chat cục bộ:', e)
  }
}

/**
 * Tính toán dung lượng bộ nhớ tạm và số lượng tin nhắn đang lưu trên máy
 */
export function getStorageUsageSummary(): {
  messageCount: number
  conversationCount: number
  approxBytes: number
  ephemeralEnabled: boolean
} {
  if (typeof window === 'undefined') {
    return { messageCount: 0, conversationCount: 0, approxBytes: 0, ephemeralEnabled: false }
  }

  let totalBytes = 0
  let messageCount = 0
  const convs = getLocalConversations()

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sen_chat_') || key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX))) {
        const val = localStorage.getItem(key) || ''
        totalBytes += (key.length + val.length) * 2 // UTF-16 byte estimate
        if (key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX)) {
          try {
            const msgs = JSON.parse(val)
            if (Array.isArray(msgs)) messageCount += msgs.length
          } catch {}
        }
      }
    }
  } catch {}

  return {
    messageCount,
    conversationCount: convs.length,
    approxBytes: totalBytes,
    ephemeralEnabled: isEphemeralStorageEnabled(),
  }
}

export interface DetailedStorageBreakdown {
  compressedMessages: { count: number; bytes: number }
  images: { count: number; bytes: number }
  videos: { count: number; bytes: number }
  files: { count: number; bytes: number }
  audio: { count: number; bytes: number }
  totalBytes: number
  totalItems: number
}

/**
 * Phân tích chi tiết dung lượng lưu trữ cục bộ theo danh mục
 */
export function getDetailedStorageBreakdown(): DetailedStorageBreakdown {
  const breakdown: DetailedStorageBreakdown = {
    compressedMessages: { count: 0, bytes: 0 },
    images: { count: 0, bytes: 0 },
    videos: { count: 0, bytes: 0 },
    files: { count: 0, bytes: 0 },
    audio: { count: 0, bytes: 0 },
    totalBytes: 0,
    totalItems: 0,
  }

  if (typeof localStorage === 'undefined') return breakdown

  try {
    const convs = getLocalConversations()
    for (const conv of convs) {
      const msgs = getLocalMessages(conv.id)
      for (const m of msgs) {
        breakdown.totalItems++
        const contentBytes = (m.content ? m.content.length * 2 : 0) + 128
        breakdown.totalBytes += contentBytes

        if (m.type === 'image' || m.mimeType?.startsWith('image/')) {
          breakdown.images.count++
          const size = m.attachmentSize || 250 * 1024
          breakdown.images.bytes += size
          breakdown.totalBytes += size
        } else if (m.type === 'video' || m.mimeType?.startsWith('video/')) {
          breakdown.videos.count++
          const size = m.attachmentSize || 2 * 1024 * 1024
          breakdown.videos.bytes += size
          breakdown.totalBytes += size
        } else if (m.type === 'audio' || m.mimeType?.startsWith('audio/') || m.duration) {
          breakdown.audio.count++
          const size = m.attachmentSize || 64 * 1024
          breakdown.audio.bytes += size
          breakdown.totalBytes += size
        } else if (m.attachmentId || m.storagePath || m.driveFileId) {
          breakdown.files.count++
          const size = m.attachmentSize || 100 * 1024
          breakdown.files.bytes += size
          breakdown.totalBytes += size
        } else {
          breakdown.compressedMessages.count++
          breakdown.compressedMessages.bytes += contentBytes
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi tính dung lượng chi tiết:', err)
  }

  return breakdown
}

// 4b. Cài đặt Cỡ chữ, Phím gửi & Thông báo
export type ChatFontSize = 'small' | 'normal' | 'large'

export function getChatFontSize(): ChatFontSize {
  if (typeof localStorage === 'undefined') return 'normal'
  const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE)
  if (saved === 'small' || saved === 'large') return saved
  return 'normal'
}

export function setChatFontSize(size: ChatFontSize): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.FONT_SIZE, size)
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('senchat:font-size-changed', { detail: { size } }))
    }
  } catch {}
}

export type ChatSendKey = 'enter' | 'shift_enter'

export function getChatSendKey(): ChatSendKey {
  if (typeof localStorage === 'undefined') return 'enter'
  const saved = localStorage.getItem(STORAGE_KEYS.SEND_KEY)
  if (saved === 'shift_enter') return 'shift_enter'
  return 'enter'
}

export function setChatSendKey(key: ChatSendKey): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.SEND_KEY, key)
}

export interface ChatNotificationSettings {
  messageSound: boolean
  callSound: boolean
  mentionSen: boolean
}

export function getChatNotificationSettings(): ChatNotificationSettings {
  if (typeof localStorage === 'undefined') {
    return { messageSound: true, callSound: true, mentionSen: true }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { messageSound: true, callSound: true, mentionSen: true }
}

export function setChatNotificationSettings(settings: Partial<ChatNotificationSettings>): void {
  if (typeof localStorage === 'undefined') return
  const current = getChatNotificationSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated))
}

/**
 * Đăng ký bộ lắng nghe sự kiện đóng trang (beforeunload, pagehide)
 * Đổi chế độ mặc định: Chat được lưu trữ bền vững trong localStorage, KHÔNG tự động xóa
 * tin nhắn khi thoát trang, đóng tab hay reload web (setupEphemeralCleanupListener trở thành no-op).
 * Chỉ khi nào người dùng chủ động cấu hình bật xóa tạm thời (isEphemeralStorageEnabled() === true)
 * thì mới gắn listener.
 */
export function setupEphemeralCleanupListener(): () => void {
  if (typeof window === 'undefined') return () => {}

  // Mặc định bền vững: Không xóa tin nhắn khi thoát/reload web
  if (!isEphemeralStorageEnabled()) {
    return () => {}
  }

  // Nếu người dùng chủ động bật tùy chọn dọn dẹp tạm thời:
  try {
    const SESSION_TOKEN_KEY = 'sen_chat_active_session'
    const hasActiveSession = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (!hasActiveSession) {
      clearAllEphemeralMessages()
      sessionStorage.setItem(SESSION_TOKEN_KEY, String(Date.now()))
    }
  } catch (e) {}

  const handleExit = () => {
    if (isEphemeralStorageEnabled()) {
      clearAllEphemeralMessages()
    }
    try {
      sessionStorage.removeItem('sen_chat_active_session')
    } catch {}
  }

  window.addEventListener('pagehide', handleExit)
  window.addEventListener('beforeunload', handleExit)

  return () => {
    window.removeEventListener('pagehide', handleExit)
    window.removeEventListener('beforeunload', handleExit)
  }
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
  if (typeof localStorage === 'undefined') return '{}'
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
  }, null, 2)
}

export const exportAllChatDataJson = exportLocalData

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
