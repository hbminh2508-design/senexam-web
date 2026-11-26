/**
 * Sen Chat Multi-Device Transit & Relay Node (v1.0.2)
 *
 * Tính năng Đồng bộ Đa Thiết bị:
 * Biến các thiết bị của cùng tài khoản thành các máy chủ trung gian (Relay Nodes)
 * để chuyển tệp về máy chủ chính, phân chia lại luồng dữ liệu (Stream Dispatching),
 * và tự động đối soát, hợp nhất tin nhắn (Message Reconciliation) chuẩn xác nhất.
 */

import { supabase as defaultSupabase } from '@/lib/supabaseClient'
import {
  getLocalConversations,
  getLocalMessages,
  saveLocalMessages,
  deleteLocalConversation,
  clearAllLocalMessages,
  SENAI_STUDIO_CONVERSATION,
  SENAI_STUDIO_CONVERSATION_ID,
  getChatFontSize,
  setChatFontSize,
  getChatSendKey,
  setChatSendKey,
  getChatNotificationSettings,
  setChatNotificationSettings,
  isEphemeralStorageEnabled,
  setEphemeralStorageEnabled,
} from '@/lib/senChatStorage'

export interface DeviceSettingsSyncPayload {
  fontSize?: 'small' | 'normal' | 'large'
  sendKey?: 'enter' | 'shift_enter'
  notifications?: {
    messageSound?: boolean
    callSound?: boolean
    mentionSen?: boolean
  }
  ephemeralEnabled?: boolean
}

export interface FileTransitPayload {
  streamTicket?: string
  fileId?: string
  attachmentId?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  relayNodeId?: string
  targetDeviceId?: string
  transitNodeUrl?: string
  fileMetadata?: any
}

export interface MessageSyncRequestPayload {
  requestingDeviceId: string
  conversationId?: string
  lastSyncTime?: number
}

export interface MessageSyncResponsePayload {
  targetDeviceId: string
  senderDeviceId: string
  conversationId: string
  messages: any[]
}

// Global reference cho active relay instance
let activeRelayInstance: ReturnType<typeof initDeviceRelay> | null = null

/**
 * 1. ĐĂNG KÝ THIẾT BỊ NODE
 * Mỗi tab/thiết bị sở hữu một ID duy nhất (`dev_<timestamp>_<random>`)
 */
export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  let deviceId = localStorage.getItem('sen_chat_device_id')
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem('sen_chat_device_id', deviceId)
  }
  return deviceId
}

/**
 * Lấy tên thiết bị Node hiển thị (Ví dụ: "Máy tính Chrome", "Điện thoại Di động")
 */
export function getDeviceNodeName(): string {
  if (typeof localStorage === 'undefined') return 'Máy tính Trình duyệt'
  const saved = localStorage.getItem('senChat_deviceName')
  if (saved) return saved

  let detected = 'Máy tính Trình duyệt'
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) {
      detected = /ipad|tablet/.test(ua) ? 'Máy tính bảng Di động' : 'Điện thoại Di động'
    } else if (/chrome|crios/.test(ua)) {
      detected = 'Máy tính Chrome'
    } else if (/firefox/.test(ua)) {
      detected = 'Máy tính Firefox'
    } else if (/safari/.test(ua)) {
      detected = 'Máy tính Safari'
    } else if (/edg/.test(ua)) {
      detected = 'Máy tính Edge'
    }
  }
  localStorage.setItem('senChat_deviceName', detected)
  return detected
}

/**
 * Đặt tên tùy chỉnh cho thiết bị Node
 */
export function setDeviceNodeName(name: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('senChat_deviceName', name.trim())
}

/**
 * ĐỐI SOÁT & HỢP NHẤT TIN NHẮN CHUẨN XÁC (Message Reconciliation)
 * - Khử trùng lặp theo ID tin nhắn
 * - Hợp nhất trường trạng thái (vd: decryptedUrl, reactions)
 * - Sắp xếp theo thứ tự thời gian tăng dần
 */
export interface ReactionEventEntry {
  emoji: string
  userId: string
  action: 'add' | 'remove'
  updatedAt: number
}

/**
 * Hợp nhất Reaction đa thiết bị hỗ trợ cả THÊM và XÓA theo timestamp (versioned LWW per user+emoji).
 * Không bao giờ làm xuất hiện lại reaction đã xóa trên thiết bị khác.
 */
export function mergeMessageReactions(curr: any, inc: any): {
  reactions: Record<string, string[]>
  reactionEvents: ReactionEventEntry[]
} {
  const eventMap = new Map<string, ReactionEventEntry>()

  const ingestEvents = (events: any[]) => {
    if (!Array.isArray(events)) return
    for (const ev of events) {
      if (!ev || !ev.emoji || !ev.userId) continue
      const key = `${ev.emoji}::${ev.userId}`
      const prev = eventMap.get(key)
      const ts = Number(ev.updatedAt) || 0
      if (!prev || ts >= prev.updatedAt) {
        eventMap.set(key, {
          emoji: ev.emoji,
          userId: ev.userId,
          action: ev.action === 'remove' ? 'remove' : 'add',
          updatedAt: ts,
        })
      }
    }
  }

  // Fallback chuyển đổi reactions cũ chưa có reactionEvents sang sự kiện 'add'
  const ingestLegacyReactions = (reactionsObj: Record<string, string[]> | undefined, fallbackTs: number) => {
    if (!reactionsObj || typeof reactionsObj !== 'object') return
    for (const [emoji, users] of Object.entries(reactionsObj)) {
      if (!Array.isArray(users)) continue
      for (const uid of users) {
        const key = `${emoji}::${uid}`
        if (!eventMap.has(key)) {
          eventMap.set(key, { emoji, userId: uid, action: 'add', updatedAt: fallbackTs })
        }
      }
    }
  }

  const currTs = Number(curr?.reactionsUpdatedAt || new Date(curr?.createdAt || 0).getTime()) || 0
  const incTs = Number(inc?.reactionsUpdatedAt || new Date(inc?.createdAt || 0).getTime()) || 0

  ingestEvents(curr?.reactionEvents)
  ingestEvents(inc?.reactionEvents)
  ingestLegacyReactions(curr?.reactions, currTs)
  ingestLegacyReactions(inc?.reactions, incTs)

  const reactions: Record<string, string[]> = {}
  const reactionEvents: ReactionEventEntry[] = []
  for (const ev of eventMap.values()) {
    reactionEvents.push(ev)
    if (ev.action === 'add') {
      if (!reactions[ev.emoji]) reactions[ev.emoji] = []
      if (!reactions[ev.emoji].includes(ev.userId)) {
        reactions[ev.emoji].push(ev.userId)
      }
    }
  }

  return { reactions, reactionEvents }
}

export function getDeltaSyncCursor(userId: string): number {
  if (typeof localStorage === 'undefined' || !userId) return 0
  return Number(localStorage.getItem(`senchat_delta_cursor_${userId}`) || 0)
}

export function setDeltaSyncCursor(userId: string, cursorMs: number): void {
  if (typeof localStorage === 'undefined' || !userId) return
  const prev = getDeltaSyncCursor(userId)
  if (cursorMs > prev) {
    localStorage.setItem(`senchat_delta_cursor_${userId}`, String(cursorMs))
  }
}

export function reconcileMessages<T extends { id: string; createdAt?: string; status?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>()

  if (Array.isArray(existing)) {
    for (const msg of existing) {
      if (msg && msg.id) map.set(msg.id, msg)
    }
  }

  if (Array.isArray(incoming)) {
    for (const msg of incoming) {
      if (msg && msg.id) {
        if (!map.has(msg.id)) {
          map.set(msg.id, msg)
        } else {
          // Bảo lưu dữ liệu cục bộ đã giải mã nếu tin nhắn hiện tại có
          const curr: any = map.get(msg.id)!
          const inc: any = msg

          // Trạng thái ưu tiên trạng thái cao hơn (seen > received > sent > sending)
          const statusOrder: Record<string, number> = {
            sending: 1,
            sent: 2,
            received: 3,
            seen: 4,
          }
          const currScore = statusOrder[curr.status || ''] || 0
          const incScore = statusOrder[inc.status || ''] || 0
          const resolvedStatus = incScore >= currScore ? (inc.status || curr.status) : curr.status
          const mergedReactions = mergeMessageReactions(curr, inc)

          map.set(msg.id, {
            ...inc,
            ...curr,
            status: resolvedStatus,
            reactions: mergedReactions.reactions,
            reactionEvents: mergedReactions.reactionEvents,
            reactionsUpdatedAt: Math.max(Number(curr.reactionsUpdatedAt || 0), Number(inc.reactionsUpdatedAt || 0)) || undefined,
            decryptedUrl: curr.decryptedUrl || inc.decryptedUrl,
            waveform: curr.waveform || inc.waveform,
            transcription: curr.transcription || inc.transcription,
          })
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || 0).getTime()
    const tB = new Date(b.createdAt || 0).getTime()
    return tA - tB
  })
}

/**
 * ĐỐI SOÁT & HỢP NHẤT DANH SÁCH HỘI THOẠI & NHÓM (Conversation Reconciliation)
 * - Khử trùng lặp theo ID
 * - Giữ nguyên SENAI_STUDIO_CONVERSATION ở vị trí đầu tiên (index 0, isPinned: true)
 * - Bảo toàn isPinned, unreadCount, lastMessage mới nhất và thông tin nhóm (isGroup, mlsGroupId, role...)
 */
export function reconcileConversations<T extends Record<string, any>>(
  localConvs: T[],
  remoteConvs: T[]
): T[] {
  const map = new Map<string, any>()

  const mergeEntry = (existing: any, incoming: any) => {
    if (!existing) return { ...incoming }
    const existingUpdated = Number(existing.updatedAt) || 0
    const incomingUpdated = Number(incoming.updatedAt) || 0
    const useIncomingLastMsg =
      incomingUpdated >= existingUpdated && Boolean(incoming.lastMessage)

    return {
      ...incoming,
      ...existing,
      partnerId: existing.partnerId || incoming.partnerId || existing.id,
      partnerName: existing.partnerName || incoming.partnerName || 'Cuộc trò chuyện',
      partnerIdentifier: existing.partnerIdentifier || incoming.partnerIdentifier || '',
      avatarUrl: existing.avatarUrl || incoming.avatarUrl || existing.partnerAvatar || incoming.partnerAvatar || '',
      partnerAvatar: existing.partnerAvatar || incoming.partnerAvatar || existing.avatarUrl || incoming.avatarUrl || '',
      isGroup: Boolean(existing.isGroup || incoming.isGroup || existing.type === 'group' || incoming.type === 'group'),
      mlsGroupId: existing.mlsGroupId || incoming.mlsGroupId,
      mlsEpoch: Math.max(Number(existing.mlsEpoch ?? existing.epoch ?? 0), Number(incoming.mlsEpoch ?? incoming.epoch ?? 0)) || undefined,
      epoch: Math.max(Number(existing.epoch ?? existing.mlsEpoch ?? 0), Number(incoming.epoch ?? incoming.mlsEpoch ?? 0)) || undefined,
      role: existing.role || incoming.role,
      isPinned: Boolean(existing.isPinned || incoming.isPinned),
      unreadCount: Math.max(Number(existing.unreadCount) || 0, Number(incoming.unreadCount) || 0),
      lastMessage: useIncomingLastMsg
        ? incoming.lastMessage
        : (existing.lastMessage || incoming.lastMessage),
      lastMessageTime: useIncomingLastMsg
        ? (incoming.lastMessageTime || existing.lastMessageTime)
        : (existing.lastMessageTime || incoming.lastMessageTime),
      updatedAt: Math.max(existingUpdated, incomingUpdated) || Date.now(),
    }
  }

  if (Array.isArray(localConvs)) {
    for (const c of localConvs) {
      if (c && c.id && c.id !== SENAI_STUDIO_CONVERSATION_ID) {
        map.set(c.id, mergeEntry(map.get(c.id), c))
      }
    }
  }

  if (Array.isArray(remoteConvs)) {
    for (const c of remoteConvs) {
      if (c && c.id && c.id !== SENAI_STUDIO_CONVERSATION_ID) {
        map.set(c.id, mergeEntry(map.get(c.id), c))
      }
    }
  }

  const sortedOthers = Array.from(map.values()).sort((a, b) => {
    const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
    if (pinDiff !== 0) return pinDiff
    return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
  })

  return [{ ...SENAI_STUDIO_CONVERSATION, isPinned: true } as any, ...sortedOthers]
}

/**
 * Gửi yêu cầu phân chia luồng trung chuyển tệp qua Server chính (/api/chat/sync)
 */
export async function relayStreamToServer(data: {
  streamTicket?: string
  fileMetadata?: any
  targetDeviceId?: string
  senderId?: string
}): Promise<any> {
  const deviceId = getDeviceId()
  const res = await fetch('/api/chat/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'relay_stream',
      deviceId,
      senderId: data.senderId || 'dev_node',
      streamTicket: data.streamTicket,
      fileMetadata: data.fileMetadata,
      targetDeviceId: data.targetDeviceId,
    }),
  })
  return await res.json()
}

/**
 * Đồng bộ danh sách tin nhắn qua Server chính (/api/chat/sync)
 */
export async function syncMessagesToServer(
  conversationId: string,
  messages: any[],
  senderId?: string
): Promise<any> {
  const deviceId = getDeviceId()
  const res = await fetch('/api/chat/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_messages',
      deviceId,
      senderId: data_sender(senderId),
      conversationId,
      messages,
      lastSyncTime: Date.now(),
    }),
  })
  return await res.json()
}

function data_sender(senderId?: string) {
  return senderId || 'dev_node'
}

/**
 * KHỞI TẠO KÊNH REALTIME RELAY NODE
 * Kênh: `sen-chat-device-relay:${userId}`
 */
export function initDeviceRelay({
  userId,
  supabaseClient = defaultSupabase,
  onSettingsUpdated,
  onMessagesReconciled,
  onConversationsReconciled,
  onFileTransitReady,
}: {
  userId: string
  supabaseClient?: any
  onSettingsUpdated?: (settings: DeviceSettingsSyncPayload) => void
  onMessagesReconciled?: (conversationId: string, messages: any[]) => void
  onConversationsReconciled?: (conversations: any[]) => void
  onFileTransitReady?: (info: FileTransitPayload) => void
}) {
  if (!userId) return null

  const deviceId = getDeviceId()
  const deviceName = getDeviceNodeName()
  const channelName = `sen-chat-device-relay:${userId}`

  const channel = supabaseClient.channel(channelName, {
    config: { broadcast: { self: false } },
  })

  // 1. Nhận sự kiện đồng bộ cài đặt từ thiết bị khác
  channel.on('broadcast', { event: 'device_settings_sync' }, ({ payload }: any) => {
    if (!payload || payload.senderDeviceId === deviceId) return

    const { settings } = payload
    if (!settings) return

    if (settings.fontSize) {
      setChatFontSize(settings.fontSize)
    }
    if (settings.sendKey) {
      setChatSendKey(settings.sendKey)
    }
    if (settings.notifications) {
      setChatNotificationSettings(settings.notifications)
    }
    if (typeof settings.ephemeralEnabled === 'boolean') {
      setEphemeralStorageEnabled(settings.ephemeralEnabled)
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('senchat-settings-updated', { detail: settings })
        )
      }
    } catch {}

    if (onSettingsUpdated) {
      onSettingsUpdated(settings)
    }
  })

  // 2. Nhận thông báo tệp trung chuyển sẵn sàng từ thiết bị khác
  channel.on('broadcast', { event: 'file_transit_ready' }, ({ payload }: any) => {
    if (!payload || payload.senderDeviceId === deviceId) return

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('senchat:file-transit-ready', { detail: payload })
        )
      }
    } catch {}

    if (onFileTransitReady) {
      onFileTransitReady(payload)
    }
  })

  // 3. Thiết bị khác yêu cầu đối soát / đồng bộ tin nhắn & danh sách nhóm/hội thoại
  channel.on('broadcast', { event: 'request_message_sync' }, ({ payload }: any) => {
    if (!payload || payload.requestingDeviceId === deviceId) return

    const { conversationId, requestingDeviceId } = payload
    const localConvs = getLocalConversations()

    // Gửi kèm danh sách hội thoại/nhóm hiện có (ngay cả khi nhóm chưa có tin nhắn)
    if (localConvs.length > 0) {
      channel.send({
        type: 'broadcast',
        event: 'response_conversations_sync',
        payload: {
          targetDeviceId: requestingDeviceId,
          senderDeviceId: deviceId,
          conversations: localConvs,
        },
      })
    }

    const convIds: string[] = conversationId
      ? [conversationId]
      : localConvs.map((c: any) => c.id).filter(Boolean)

    for (const cid of convIds) {
      const localMsgs = getLocalMessages(cid)
      if (localMsgs && localMsgs.length > 0) {
        // Phản hồi lại tin nhắn đã lưu để thiết bị kia hợp nhất
        channel.send({
          type: 'broadcast',
          event: 'response_message_sync',
          payload: {
            targetDeviceId: requestingDeviceId,
            senderDeviceId: deviceId,
            conversationId: cid,
            messages: localMsgs,
          },
        })
      }
    }
  })

  // 3.5 Nhận phản hồi danh sách nhóm / hội thoại từ thiết bị trung gian
  channel.on('broadcast', { event: 'response_conversations_sync' }, ({ payload }: any) => {
    if (!payload || payload.targetDeviceId !== deviceId) return
    if (!Array.isArray(payload.conversations)) return

    const currentLocal = getLocalConversations()
    const reconciled = reconcileConversations(currentLocal, payload.conversations)

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sen_chat_conversations', JSON.stringify(reconciled))
      }
    } catch {}

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('senchat-conversations-reconciled', {
            detail: { conversations: reconciled },
          })
        )
      }
    } catch {}

    if (onConversationsReconciled) {
      onConversationsReconciled(reconciled)
    }
  })

  // 4. Nhận phản hồi tin nhắn từ thiết bị trung gian
  channel.on('broadcast', { event: 'response_message_sync' }, ({ payload }: any) => {
    if (!payload || payload.targetDeviceId !== deviceId) return

    const { conversationId, messages } = payload
    if (!conversationId || !Array.isArray(messages)) return

    const currentLocal = getLocalMessages(conversationId)
    const reconciled = reconcileMessages(currentLocal, messages)

    saveLocalMessages(conversationId, reconciled)

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('senchat-messages-reconciled', {
            detail: { conversationId, messages: reconciled },
          })
        )
      }
    } catch {}

    if (onMessagesReconciled) {
      onMessagesReconciled(conversationId, reconciled)
    }
  })

  // 5. Nhận thông báo rời / xóa nhóm từ thiết bị khác để âm thầm gỡ bỏ ngay lập tức
  channel.on('broadcast', { event: 'conversation_removed' }, ({ payload }: any) => {
    if (!payload || payload.senderDeviceId === deviceId || !payload.conversationId) return

    const { conversationId } = payload
    deleteLocalConversation(conversationId)
    clearAllLocalMessages(conversationId)

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('senchat-conversation-removed', {
            detail: { conversationId },
          })
        )
        window.dispatchEvent(
          new CustomEvent('senchat-conversations-reconciled', {
            detail: { conversations: getLocalConversations() },
          })
        )
      }
    } catch {}

    if (onConversationsReconciled) {
      onConversationsReconciled(getLocalConversations())
    }
  })

  channel.subscribe()

  // Hàm phát broadcast đồng bộ cài đặt
  const broadcastSettings = (settings: DeviceSettingsSyncPayload) => {
    channel.send({
      type: 'broadcast',
      event: 'device_settings_sync',
      payload: {
        senderDeviceId: deviceId,
        senderDeviceName: deviceName,
        settings,
        timestamp: Date.now(),
      },
    })
  }

  // Hàm phát broadcast thông báo tệp trung chuyển
  const notifyFileTransitReady = (info: FileTransitPayload) => {
    channel.send({
      type: 'broadcast',
      event: 'file_transit_ready',
      payload: {
        senderDeviceId: deviceId,
        senderDeviceName: deviceName,
        ...info,
        timestamp: Date.now(),
      },
    })
  }

  // Hàm phát yêu cầu đối soát tin nhắn
  const requestMessageSync = (conversationId?: string) => {
    channel.send({
      type: 'broadcast',
      event: 'request_message_sync',
      payload: {
        requestingDeviceId: deviceId,
        conversationId,
        timestamp: Date.now(),
      },
    })
  }

  // Hàm phát thông báo đã rời / xóa nhóm
  const notifyConversationRemoved = (conversationId: string) => {
    channel.send({
      type: 'broadcast',
      event: 'conversation_removed',
      payload: {
        senderDeviceId: deviceId,
        conversationId,
        timestamp: Date.now(),
      },
    })
  }

  const instance = {
    channel,
    deviceId,
    deviceName,
    broadcastSettings,
    notifyFileTransitReady,
    requestMessageSync,
    notifyConversationRemoved,
    cleanup: () => {
      try {
        supabaseClient.removeChannel(channel)
      } catch {}
      if (activeRelayInstance === instance) {
        activeRelayInstance = null
      }
    },
  }

  activeRelayInstance = instance
  return instance
}

/**
 * Phát sự kiện cài đặt đồng bộ tới tất cả thiết bị (dùng ở các modal/cài đặt)
 */
export function broadcastDeviceSettings(settings: DeviceSettingsSyncPayload) {
  if (activeRelayInstance) {
    activeRelayInstance.broadcastSettings(settings)
  }
}

/**
 * Thông báo luồng trung chuyển tệp sẵn sàng
 */
export function broadcastFileTransitReady(info: FileTransitPayload) {
  if (activeRelayInstance) {
    activeRelayInstance.notifyFileTransitReady(info)
  }
}

/**
 * Yêu cầu đối soát tin nhắn từ thiết bị trung gian
 */
export function broadcastRequestMessageSync(conversationId?: string) {
  if (activeRelayInstance) {
    activeRelayInstance.requestMessageSync(conversationId)
  }
}

/**
 * Phát broadcast rời/xóa nhóm để các thiết bị khác âm thầm gỡ nhóm ngay lập tức
 */
export function broadcastConversationRemoved(conversationId: string) {
  if (activeRelayInstance && conversationId) {
    activeRelayInstance.notifyConversationRemoved(conversationId)
  }
}

export interface DeviceSyncStatusResult {
  needsSync: boolean
  deviceCount: number
  otherDevices: any[]
  reason: 'only_one_device' | 'no_prior_sync' | 'sync_expired' | 'relay_signal_pending' | 'missing_server_conversations' | 'up_to_date' | string
  lastSyncAt: number | null
  missingConversationsCount?: number
}

export interface TriggerDeviceSyncResult {
  success: boolean
  syncedMessagesCount: number
  syncedConversationsCount: number
  deviceCount: number
  message: string
}

async function resolveAccessToken(options?: { supabaseClient?: any; accessToken?: string }): Promise<string | null> {
  if (options?.accessToken) return options.accessToken
  const client = options?.supabaseClient || defaultSupabase
  try {
    if (client?.auth?.getSession) {
      const { data } = await client.auth.getSession()
      if (data?.session?.access_token) return data.session.access_token
    }
  } catch {}
  return null
}

/**
 * KIỂM TRA TRẠNG THÁI ĐỒNG BỘ ĐA THIẾT BỊ (v1.0.4)
 * - Quét các thiết bị qua API /api/chat/device-management hoặc trực tiếp supabase client
 * - Kiểm tra xem trên server có nhóm/hội thoại nào mà localStorage chưa có không
 * - Đối chiếu senchat_last_sync_timestamp xem có thiết bị khác và cần đồng bộ không
 */
export async function checkDeviceSyncStatus(
  userId: string,
  currentDeviceId?: string,
  options?: {
    supabaseClient?: any
    devices?: any[]
    hasRelayPendingFlag?: boolean
    serverConversations?: any[]
    accessToken?: string
  }
): Promise<DeviceSyncStatusResult> {
  const currDevId = currentDeviceId || getDeviceId()
  let lastSyncAt: number | null = null
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('senchat_last_sync_timestamp')
      if (raw) lastSyncAt = parseInt(raw, 10) || null
    }
  } catch {}

  let devices: any[] = options?.devices || []
  if (!options?.devices) {
    let fetchOk = false
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(`/api/chat/device-management?currentDeviceId=${encodeURIComponent(currDevId)}`, {
          method: 'GET',
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.devices)) {
            devices = data.devices
            fetchOk = true
          }
        }
      }
    } catch {}

    if (!fetchOk) {
      const client = options?.supabaseClient || defaultSupabase
      if (client && typeof client.from === 'function') {
        try {
          const { data, error } = await client
            .from('chat_devices')
            .select('id, device_id, device_name, platform, is_active, last_seen_at, created_at')
            .eq('user_id', userId)
          if (!error && Array.isArray(data)) {
            devices = data
          }
        } catch {}
      }
    }
  }

  // Kiểm tra danh sách nhóm/hội thoại trên server so với local
  let serverConvs: any[] | null = Array.isArray(options?.serverConversations) ? options!.serverConversations! : null
  if (!serverConvs && typeof fetch !== 'undefined') {
    const token = await resolveAccessToken(options)
    if (token) {
      try {
        const convRes = await fetch('/api/chat/mls/group', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (convRes.ok) {
          const convData = await convRes.json()
          if (Array.isArray(convData.conversations)) {
            serverConvs = convData.conversations
          }
        }
      } catch {}
    }
  }

  let missingConversationsCount = 0
  if (Array.isArray(serverConvs) && serverConvs.length > 0) {
    const localIds = new Set(getLocalConversations().map((c: any) => c?.id).filter(Boolean))
    missingConversationsCount = serverConvs.filter((sc: any) => sc?.id && !localIds.has(sc.id)).length
  }

  const now = Date.now()
  const activeThresholdMs = 30 * 24 * 60 * 60 * 1000 // 30 ngày
  const activeDevices = devices.filter((d: any) => {
    if (!d) return false
    if (d.is_active === false) return false
    if (d.is_active === true) return true
    if (d.last_seen_at) {
      const seen = new Date(d.last_seen_at).getTime()
      return !isNaN(seen) && (now - seen < activeThresholdMs)
    }
    return false
  })

  const otherDevices = activeDevices.filter((d: any) => {
    const did = d.device_id || d.deviceId
    return did && did !== currDevId
  })
  const deviceCount = Math.max(activeDevices.length, otherDevices.length + (currDevId ? 1 : 0))

  if (missingConversationsCount > 0) {
    return {
      needsSync: true,
      deviceCount: Math.max(1, deviceCount),
      otherDevices,
      reason: 'missing_server_conversations',
      lastSyncAt,
      missingConversationsCount,
    }
  }

  if (otherDevices.length === 0) {
    return {
      needsSync: false,
      deviceCount: Math.max(1, deviceCount),
      otherDevices: [],
      reason: 'only_one_device',
      lastSyncAt,
      missingConversationsCount: 0,
    }
  }

  const syncIntervalMs = 3 * 60 * 1000 // 3 phút
  const isExpired = !lastSyncAt || (now - lastSyncAt > syncIntervalMs)
  const hasFlag = !!options?.hasRelayPendingFlag || (typeof window !== 'undefined' && !!(window as any).__senchat_needs_sync)
  const needsSync = isExpired || hasFlag

  let reason = 'up_to_date'
  if (hasFlag) {
    reason = 'relay_signal_pending'
  } else if (!lastSyncAt) {
    reason = 'no_prior_sync'
  } else if (isExpired) {
    reason = 'sync_expired'
  }

  return {
    needsSync,
    deviceCount,
    otherDevices,
    reason,
    lastSyncAt,
    missingConversationsCount: 0,
  }
}

/**
 * KÍCH HOẠT ĐỒNG BỘ DỮ LIỆU ĐA THIẾT BỊ NGAY LẬP TỨC (v1.0.4)
 * - Broadcast yêu cầu đối soát tới các thiết bị relay node khác (cả tin nhắn và danh sách nhóm)
 * - Kéo danh sách nhóm & hội thoại từ Supabase (/api/chat/mls/group) và hợp nhất qua reconcileConversations
 * - Kéo tin nhắn tồn đọng trên server transit queue và đối soát (reconcileMessages)
 * - Cập nhật senchat_last_sync_timestamp
 * - Phát custom event 'senchat-conversations-reconciled' và 'senchat-sync-completed'
 */
export async function triggerFullDeviceSync(
  userId: string,
  currentDeviceId?: string,
  options?: {
    supabaseClient?: any
    devices?: any[]
    accessToken?: string
  }
): Promise<TriggerDeviceSyncResult> {
  const currDevId = currentDeviceId || getDeviceId()

  // 1. Phát yêu cầu broadcast để các thiết bị online gửi tin nhắn & nhóm đối soát
  broadcastRequestMessageSync()

  // 2. Kéo đồng thời danh sách nhóm/hội thoại từ Server và tin nhắn tồn đọng trên Transit Queue
  let syncedMessagesCount = 0
  let syncedConversationsCount = 0
  let remoteConvsForStatus: any[] | undefined = undefined

  if (userId && typeof fetch !== 'undefined') {
    const token = await resolveAccessToken(options)
    const groupHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const [groupSettled, pullSettled] = await Promise.allSettled([
      fetch('/api/chat/mls/group', {
        method: 'GET',
        headers: groupHeaders,
      }),
      fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull',
          receiverId: userId,
          deviceId: currDevId,
        }),
      }),
    ])

    // 2a. Hợp nhất danh sách nhóm & hội thoại từ Server
    try {
      let remoteConvs: any[] = []
      let hasAuthoritativeServerGroups = false
      if (groupSettled.status === 'fulfilled' && groupSettled.value?.ok) {
        const groupData = await groupSettled.value.json().catch(() => null)
        if (Array.isArray(groupData?.conversations)) {
          remoteConvs = groupData.conversations
          remoteConvsForStatus = remoteConvs
          hasAuthoritativeServerGroups = Boolean(token)
        }
      }

      if (remoteConvs.length > 0 || hasAuthoritativeServerGroups) {
        const rawLocalConvs = getLocalConversations()
        const remoteIds = new Set(remoteConvs.map((rc: any) => rc?.id).filter(Boolean))
        const localConvs = hasAuthoritativeServerGroups
          ? rawLocalConvs.filter((c: any) => {
              const isGrp = Boolean(c?.isGroup || c?.type === 'group')
              if (isGrp && c?.id && !remoteIds.has(c.id)) {
                clearAllLocalMessages(c.id)
                return false
              }
              return true
            })
          : rawLocalConvs
        const localIds = new Set(localConvs.map((c: any) => c?.id).filter(Boolean))
        syncedConversationsCount = remoteConvs.filter((rc: any) => rc?.id && !localIds.has(rc.id)).length
        const reconciledConvs = reconcileConversations(localConvs, remoteConvs)
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('sen_chat_conversations', JSON.stringify(reconciledConvs))
          } catch {}
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(
              new CustomEvent('senchat-conversations-reconciled', {
                detail: { conversations: reconciledConvs },
              })
            )
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Lỗi hợp nhất danh sách nhóm khi đồng bộ:', e)
    }

    // 2b. Hợp nhất tin nhắn tồn đọng trên Transit Queue
    try {
      if (pullSettled.status === 'fulfilled' && pullSettled.value?.ok) {
        const data = await pullSettled.value.json().catch(() => null)
        const pulledMessages: any[] = Array.isArray(data?.messages) ? data.messages : []
        syncedMessagesCount = pulledMessages.length

        if (pulledMessages.length > 0) {
          const convMap = new Map<string, any[]>()
          for (const msg of pulledMessages) {
            const cid = msg.conversationId || msg.conversation_id || (msg.senderId === userId ? msg.receiverId : msg.senderId)
            if (cid) {
              if (!convMap.has(cid)) convMap.set(cid, [])
              convMap.get(cid)!.push(msg)
            }
          }

          let convs = getLocalConversations()
          const discoveredConvs: any[] = []

          for (const [cid, msgs] of convMap.entries()) {
            const currentLocal = getLocalMessages(cid)
            const reconciled = reconcileMessages(currentLocal, msgs)
            saveLocalMessages(cid, reconciled)

            const exists = convs.some((c: any) => c.id === cid)
            if (!exists && reconciled.length > 0) {
              const last = reconciled[reconciled.length - 1]
              const partnerId = last.senderId === userId ? (last.receiverId || cid) : last.senderId
              const partnerName = (last.senderId === userId ? last.receiverName : last.senderName) || 'Người trò chuyện'
              discoveredConvs.push({
                id: cid,
                partnerId: partnerId || cid,
                partnerName: partnerName || 'Người trò chuyện',
                lastMessage: last.type === 'image' ? '[Hình ảnh]' : last.type === 'like' ? '👍' : (last.content || ''),
                lastMessageTime: new Date(last.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                unreadCount: 0,
                updatedAt: Date.now(),
              })
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('senchat-messages-reconciled', {
                  detail: { conversationId: cid, messages: reconciled },
                })
              )
            }
          }

          if (discoveredConvs.length > 0) {
            const reconciledAll = reconcileConversations(convs, discoveredConvs)
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem('sen_chat_conversations', JSON.stringify(reconciledAll))
              } catch {}
            }
            if (typeof window !== 'undefined') {
              try {
                window.dispatchEvent(
                  new CustomEvent('senchat-conversations-reconciled', {
                    detail: { conversations: reconciledAll },
                  })
                )
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi kéo tin nhắn khi kích hoạt đồng bộ đầy đủ:', e)
    }
  }

  // 3. Cập nhật timestamp đồng bộ thành công
  const now = Date.now()
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('senchat_last_sync_timestamp', now.toString())
    }
    if (typeof window !== 'undefined') {
      ;(window as any).__senchat_needs_sync = false
    }
  } catch {}

  // 4. Lấy số lượng thiết bị
  let deviceCount = 1
  try {
    const status = await checkDeviceSyncStatus(userId, currDevId, {
      ...options,
      serverConversations: remoteConvsForStatus,
    })
    deviceCount = status.deviceCount
  } catch {}

  // 5. Phát window custom event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('senchat-sync-completed', {
          detail: {
            timestamp: now,
            syncedMessagesCount,
            syncedConversationsCount,
            deviceCount,
            deviceId: currDevId,
          },
        })
      )
    } catch {}
  }

  return {
    success: true,
    syncedMessagesCount,
    syncedConversationsCount,
    deviceCount,
    message: `Đồng bộ thành công (${deviceCount} thiết bị, ${syncedConversationsCount} nhóm/hội thoại, ${syncedMessagesCount} tin nhắn đối soát)`,
  }
}
