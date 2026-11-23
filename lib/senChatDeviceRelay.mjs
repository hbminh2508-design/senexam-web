/**
 * Sen Chat Multi-Device Transit & Relay Node (ESM export for testing & runtime)
 */

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
