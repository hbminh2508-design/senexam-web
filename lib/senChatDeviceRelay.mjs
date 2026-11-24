/**
 * Sen Chat Multi-Device Transit & Relay Node (ESM export for testing & runtime)
 */

import { getLocalMessages, saveLocalMessages } from './senChatStorage.mjs'

let activeRelayInstance = null

export function getDeviceId() {
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

export function getDeviceNodeName() {
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

export function setDeviceNodeName(name) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('senChat_deviceName', String(name).trim())
}

export function reconcileMessages(existing = [], incoming = []) {
  const map = new Map()

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
          const curr = map.get(msg.id)
          const inc = msg

          const statusOrder = {
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

export function initDeviceRelay({
  userId,
  supabaseClient,
  onSettingsUpdated,
  onMessagesReconciled,
  onFileTransitReady,
}) {
  if (!userId) return null

  const deviceId = getDeviceId()
  const deviceName = getDeviceNodeName()
  const channelName = `sen-chat-device-relay:${userId}`

  // Mock / real channel adapter
  const channel = supabaseClient?.channel ? supabaseClient.channel(channelName) : {
    send: () => {},
    on: () => channel,
    subscribe: () => channel,
  }

  const broadcastSettings = (settings) => {
    if (channel.send) {
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
  }

  const notifyFileTransitReady = (info) => {
    if (channel.send) {
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
  }

  const requestMessageSync = (conversationId) => {
    if (channel.send) {
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
        if (supabaseClient?.removeChannel) {
          supabaseClient.removeChannel(channel)
        }
      } catch {}
      if (activeRelayInstance === instance) {
        activeRelayInstance = null
      }
    },
  }

  activeRelayInstance = instance
  return instance
}

export function broadcastDeviceSettings(settings) {
  if (activeRelayInstance) {
    activeRelayInstance.broadcastSettings(settings)
  }
}

export function broadcastFileTransitReady(info) {
  if (activeRelayInstance) {
    activeRelayInstance.notifyFileTransitReady(info)
  }
}

export function broadcastRequestMessageSync(conversationId) {
  if (activeRelayInstance) {
    activeRelayInstance.requestMessageSync(conversationId)
  }
}

/**
 * KIỂM TRA TRẠNG THÁI ĐỒNG BỘ ĐA THIẾT BỊ (v1.0.3)
 */
export async function checkDeviceSyncStatus(userId, currentDeviceId, options) {
  const currDevId = currentDeviceId || getDeviceId()
  let lastSyncAt = null
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('senchat_last_sync_timestamp')
      if (raw) lastSyncAt = parseInt(raw, 10) || null
    }
  } catch {}

  let devices = options?.devices || []
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

    if (!fetchOk && options?.supabaseClient) {
      try {
        const { data, error } = await options.supabaseClient
          .from('chat_devices')
          .select('id, device_id, device_name, platform, is_active, last_seen_at, created_at')
          .eq('user_id', userId)
        if (!error && Array.isArray(data)) {
          devices = data
        }
      } catch {}
    }
  }

  const now = Date.now()
  const activeThresholdMs = 30 * 24 * 60 * 60 * 1000 // 30 ngày
  const activeDevices = devices.filter((d) => {
    if (!d) return false
    if (d.is_active === true) return true
    if (d.last_seen_at) {
      const seen = new Date(d.last_seen_at).getTime()
      return !isNaN(seen) && (now - seen < activeThresholdMs)
    }
    return false
  })

  const otherDevices = activeDevices.filter((d) => d.device_id && d.device_id !== currDevId)
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
  const hasFlag = !!options?.hasRelayPendingFlag || (typeof window !== 'undefined' && !!window.__senchat_needs_sync)
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
 */
export async function triggerFullDeviceSync(userId, currentDeviceId, options) {
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
          const pulledMessages = Array.isArray(data.messages) ? data.messages : []
          syncedMessagesCount = pulledMessages.length

          if (pulledMessages.length > 0) {
            const convMap = new Map()
            for (const msg of pulledMessages) {
              const cid = msg.conversationId || msg.conversation_id || msg.senderId
              if (cid) {
                if (!convMap.has(cid)) convMap.set(cid, [])
                convMap.get(cid).push(msg)
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
      window.__senchat_needs_sync = false
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
