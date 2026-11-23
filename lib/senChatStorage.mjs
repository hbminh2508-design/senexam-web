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
  const list = getLocalConversations().filter((c) => c.id !== convId)
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(list))
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`)
}

export function getLocalMessages(conversationId) {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`)
    const list = raw ? JSON.parse(raw) : []
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
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
