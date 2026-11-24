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

          map.set(msg.id, {
            ...inc,
            ...curr,
            status: resolvedStatus,
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
  onFileTransitReady,
}: {
  userId: string
  supabaseClient?: any
  onSettingsUpdated?: (settings: DeviceSettingsSyncPayload) => void
  onMessagesReconciled?: (conversationId: string, messages: any[]) => void
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

  // 3. Thiết bị khác yêu cầu đối soát / đồng bộ tin nhắn
  channel.on('broadcast', { event: 'request_message_sync' }, ({ payload }: any) => {
    if (!payload || payload.requestingDeviceId === deviceId) return

    const { conversationId, requestingDeviceId } = payload
    const convIds: string[] = conversationId
      ? [conversationId]
      : getLocalConversations().map((c: any) => c.id).filter(Boolean)

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

  const instance = {
    channel,
    deviceId,
    deviceName,
    broadcastSettings,
    notifyFileTransitReady,
    requestMessageSync,
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

export interface DeviceSyncStatusResult {
  needsSync: boolean
  deviceCount: number
  otherDevices: any[]
  reason: 'only_one_device' | 'no_prior_sync' | 'sync_expired' | 'relay_signal_pending' | 'up_to_date' | string
  lastSyncAt: number | null
}

export interface TriggerDeviceSyncResult {
  success: boolean
  syncedMessagesCount: number
  deviceCount: number
  message: string
}

/**
 * KIỂM TRA TRẠNG THÁI ĐỒNG BỘ ĐA THIẾT BỊ (v1.0.3)
 * - Quét các thiết bị qua API /api/chat/device-management hoặc trực tiếp supabase client
 * - Lọc thiết bị đang hoạt động (is_active: true hoặc last_seen_at gần đây)
 * - Đối chiếu senchat_last_sync_timestamp xem có thiết bị khác và cần đồng bộ không
 */
export async function checkDeviceSyncStatus(
  userId: string,
  currentDeviceId?: string,
  options?: {
    supabaseClient?: any
    devices?: any[]
    hasRelayPendingFlag?: boolean
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

  const now = Date.now()
  const activeThresholdMs = 30 * 24 * 60 * 60 * 1000 // 30 ngày
  const activeDevices = devices.filter((d: any) => {
    if (!d) return false
    if (d.is_active === true) return true
    if (d.last_seen_at) {
      const seen = new Date(d.last_seen_at).getTime()
      return !isNaN(seen) && (now - seen < activeThresholdMs)
    }
    return false
  })

  const otherDevices = activeDevices.filter((d: any) => d.device_id && d.device_id !== currDevId)
  const deviceCount = Math.max(activeDevices.length, otherDevices.length + (currDevId ? 1 : 0))

  if (otherDevices.length === 0) {
    return {
      needsSync: false,
      deviceCount: Math.max(1, deviceCount),
      otherDevices: [],
      reason: 'only_one_device',
      lastSyncAt,
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
  }
}

/**
 * KÍCH HOẠT ĐỒNG BỘ DỮ LIỆU ĐA THIẾT BỊ NGAY LẬP TỨC (v1.0.3)
 * - Broadcast yêu cầu đối soát tới các thiết bị relay node khác
 * - Kéo tin nhắn tồn đọng trên server transit queue và đối soát (reconcileMessages)
 * - Cập nhật senchat_last_sync_timestamp
 * - Phát custom event 'senchat-sync-completed'
 */
export async function triggerFullDeviceSync(
  userId: string,
  currentDeviceId?: string,
  options?: {
    supabaseClient?: any
    devices?: any[]
  }
): Promise<TriggerDeviceSyncResult> {
  const currDevId = currentDeviceId || getDeviceId()

  // 1. Phát yêu cầu broadcast để các thiết bị online gửi tin nhắn đối soát
  broadcastRequestMessageSync()

  // 2. Kéo tin nhắn tồn đọng trên Server transit queue (/api/chat/sync pull)
  let syncedMessagesCount = 0
  if (userId) {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/chat/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pull',
            receiverId: userId,
            deviceId: currDevId,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const pulledMessages: any[] = Array.isArray(data.messages) ? data.messages : []
          syncedMessagesCount = pulledMessages.length

          if (pulledMessages.length > 0) {
            const convMap = new Map<string, any[]>()
            for (const msg of pulledMessages) {
              const cid = msg.conversationId || msg.conversation_id || msg.senderId
              if (cid) {
                if (!convMap.has(cid)) convMap.set(cid, [])
                convMap.get(cid)!.push(msg)
              }
            }

            for (const [cid, msgs] of convMap.entries()) {
              const currentLocal = getLocalMessages(cid)
              const reconciled = reconcileMessages(currentLocal, msgs)
              saveLocalMessages(cid, reconciled)
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('senchat-messages-reconciled', {
                    detail: { conversationId: cid, messages: reconciled },
                  })
                )
              }
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
    const status = await checkDeviceSyncStatus(userId, currDevId, options)
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
    deviceCount,
    message: `Đồng bộ thành công (${deviceCount} thiết bị, ${syncedMessagesCount} tin nhắn đối soát)`,
  }
}
