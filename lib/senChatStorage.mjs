/**
 * Sen Chat Local-First Storage Engine (ESM)
 */

export const CHAT_WALLPAPERS = [
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
]

export const STORAGE_KEYS = {
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
export const SENAI_STUDIO_CONVERSATION = {
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

export function ensureSenAiStudioInConversations(list) {
  const filtered = (list || []).filter((c) => c.id !== SENAI_STUDIO_CONVERSATION_ID)
  return [{ ...SENAI_STUDIO_CONVERSATION, isPinned: true }, ...filtered]
}

export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server_device'
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36)
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId)
  }
  return deviceId
}

export function getLocalSenChatUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function saveLocalSenChatUser(user) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

export function clearLocalSenChatUser() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEYS.USER)
}

export function getLocalConversations() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    const list = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (e) {
    return []
  }
}

export function saveLocalConversation(conv) {
  if (typeof window === 'undefined') return
  const list = getLocalConversations()
  const existingIdx = list.findIndex((c) => c.id === conv.id)
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...conv, updatedAt: conv.updatedAt || Date.now() }
  } else {
    list.unshift({ ...conv, updatedAt: conv.updatedAt || Date.now() })
  }
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(list))
}

export function deleteLocalConversation(convId) {
  if (typeof window === 'undefined') return
  if (convId === SENAI_STUDIO_CONVERSATION_ID) return // SenAI Studio vĩnh viễn không bị xóa
  const list = getLocalConversations().filter((c) => c.id !== convId)
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(list))
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`)
}

export function getLocalMessages(conversationId) {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
    const list = raw ? JSON.parse(raw) : []

    if (conversationId === SENAI_STUDIO_CONVERSATION_ID) {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    const cutoff = Date.now() - TEXT_MESSAGE_RETENTION_MS
    let hasExpired = false
    const valid = list.filter((m) => {
      if (m.attachmentId || m.storagePath || m.driveFileId) {
        return true
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

export function saveLocalMessage(conversationId, message) {
  if (typeof window === 'undefined') return
  const list = getLocalMessages(conversationId)
  const existingIdx = list.findIndex((m) => m.id === message.id)
  if (existingIdx >= 0) {
    list[existingIdx] = message
  } else {
    list.push(message)
  }

  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(list))

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

export function saveLocalMessages(conversationId, messages) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, JSON.stringify(messages))

  if (Array.isArray(messages) && messages.length > 0) {
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

export function clearAllLocalMessages(conversationId) {
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

export function clearAllEphemeralMessages() {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))

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

export function isEphemeralStorageEnabled() {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_ENABLED)
  if (saved === null) return false
  return saved === 'true'
}

export function setEphemeralStorageEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.EPHEMERAL_ENABLED, enabled ? 'true' : 'false')
}

export function clearAllLocalChatData() {
  if (typeof window === 'undefined') return
  try {
    clearAllEphemeralMessages()
    clearLocalSenChatUser()
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

export function getStorageUsageSummary() {
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
        totalBytes += (key.length + val.length) * 2
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

export function setupEphemeralCleanupListener() {
  if (typeof window === 'undefined') return () => {}

  if (!isEphemeralStorageEnabled()) {
    return () => {}
  }

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

export function getDetailedStorageBreakdown() {
  const breakdown = {
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

export function getChatFontSize() {
  if (typeof localStorage === 'undefined') return 'normal'
  const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE)
  if (saved === 'small' || saved === 'large') return saved
  return 'normal'
}

export function setChatFontSize(size) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.FONT_SIZE, size)
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('senchat:font-size-changed', { detail: { size } }))
    }
  } catch {}
}

export function getChatSendKey() {
  if (typeof localStorage === 'undefined') return 'enter'
  const saved = localStorage.getItem(STORAGE_KEYS.SEND_KEY)
  if (saved === 'shift_enter') return 'shift_enter'
  return 'enter'
}

export function setChatSendKey(key) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.SEND_KEY, key)
}

export function getChatNotificationSettings() {
  if (typeof localStorage === 'undefined') {
    return { messageSound: true, callSound: true, mentionSen: true }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { messageSound: true, callSound: true, mentionSen: true }
}

export function setChatNotificationSettings(settings) {
  if (typeof localStorage === 'undefined') return
  const current = getChatNotificationSettings()
  const next = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(next))
}

export function getLocalNicknames() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NICKNAMES)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function getBlockedUsers() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOCKED_USERS)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function getLocalWallpapers() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WALLPAPERS)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function exportLocalData() {
  if (typeof localStorage === 'undefined') return '{}'
  const user = getLocalSenChatUser()
  const conversations = getLocalConversations()
  const nicknames = getLocalNicknames()
  const blocked = getBlockedUsers()
  const wallpapers = getLocalWallpapers()
  const messages = {}
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
