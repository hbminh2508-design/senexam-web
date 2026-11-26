/**
 * Sen Chat Multi-Device Transit & Relay Node (ESM export for testing & runtime)
 */

import {
  getLocalConversations,
  getLocalMessages,
  saveLocalMessages,
  deleteLocalConversation,
  clearAllLocalMessages,
  SENAI_STUDIO_CONVERSATION,
  SENAI_STUDIO_CONVERSATION_ID,
} from './senChatStorage.mjs'

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

export function mergeMessageReactions(curr, inc) {
  const eventMap = new Map()

  const ingestEvents = (events) => {
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

  const ingestLegacyReactions = (reactionsObj, fallbackTs) => {
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

  const reactions = {}
  const reactionEvents = []
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

export function getDeltaSyncCursor(userId) {
  if (typeof localStorage === 'undefined' || !userId) return 0
  return Number(localStorage.getItem(`senchat_delta_cursor_${userId}`) || 0)
}

export function setDeltaSyncCursor(userId, cursorMs) {
  if (typeof localStorage === 'undefined' || !userId) return
  const prev = getDeltaSyncCursor(userId)
  if (cursorMs > prev) {
    localStorage.setItem(`senchat_delta_cursor_${userId}`, String(cursorMs))
  }
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

export function reconcileConversations(localConvs = [], remoteConvs = []) {
  const map = new Map()

  const mergeEntry = (existing, incoming) => {
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

  return [{ ...SENAI_STUDIO_CONVERSATION, isPinned: true }, ...sortedOthers]
}

export function initDeviceRelay({
  userId,
  supabaseClient,
  onSettingsUpdated,
  onMessagesReconciled,
  onConversationsReconciled,
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

  if (channel.on) {
    channel.on('broadcast', { event: 'request_message_sync' }, ({ payload }) => {
      if (!payload || payload.requestingDeviceId === deviceId) return
      const { conversationId, requestingDeviceId } = payload
      const localConvs = getLocalConversations()

      if (localConvs.length > 0 && channel.send) {
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

      const convIds = conversationId
        ? [conversationId]
        : localConvs.map((c) => c.id).filter(Boolean)

      for (const cid of convIds) {
        const localMsgs = getLocalMessages(cid)
        if (localMsgs && localMsgs.length > 0 && channel.send) {
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

    channel.on('broadcast', { event: 'response_conversations_sync' }, ({ payload }) => {
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
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
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

    channel.on('broadcast', { event: 'conversation_removed' }, ({ payload }) => {
      if (!payload || payload.senderDeviceId === deviceId || !payload.conversationId) return
      const { conversationId } = payload
      deleteLocalConversation(conversationId)
      clearAllLocalMessages(conversationId)
      try {
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
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

  const notifyConversationRemoved = (conversationId) => {
    if (channel.send) {
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

export function broadcastConversationRemoved(conversationId) {
  if (activeRelayInstance && conversationId) {
    activeRelayInstance.notifyConversationRemoved(conversationId)
  }
}

async function resolveAccessToken(options) {
  if (options?.accessToken) return options.accessToken
  const client = options?.supabaseClient
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

  // Kiểm tra danh sách nhóm/hội thoại trên server so với local
  let serverConvs = Array.isArray(options?.serverConversations) ? options.serverConversations : null
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
    const localIds = new Set(getLocalConversations().map((c) => c?.id).filter(Boolean))
    missingConversationsCount = serverConvs.filter((sc) => sc?.id && !localIds.has(sc.id)).length
  }

  const now = Date.now()
  const activeThresholdMs = 30 * 24 * 60 * 60 * 1000 // 30 ngày
  const activeDevices = devices.filter((d) => {
    if (!d) return false
    if (d.is_active === false) return false
    if (d.is_active === true) return true
    if (d.last_seen_at) {
      const seen = new Date(d.last_seen_at).getTime()
      return !isNaN(seen) && (now - seen < activeThresholdMs)
    }
    return false
  })

  const otherDevices = activeDevices.filter((d) => {
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
    missingConversationsCount: 0,
  }
}

/**
 * KÍCH HOẠT ĐỒNG BỘ DỮ LIỆU ĐA THIẾT BỊ NGAY LẬP TỨC (v1.0.4)
 */
export async function triggerFullDeviceSync(userId, currentDeviceId, options) {
  const currDevId = currentDeviceId || getDeviceId()

  // 1. Phát yêu cầu broadcast để các thiết bị online gửi tin nhắn & nhóm đối soát
  broadcastRequestMessageSync()

  // 2. Kéo đồng thời danh sách nhóm/hội thoại từ Server và tin nhắn tồn đọng trên Transit Queue
  let syncedMessagesCount = 0
  let syncedConversationsCount = 0
  let remoteConvsForStatus = undefined
  if (userId && typeof fetch !== 'undefined') {
    const token = await resolveAccessToken(options)
    const groupHeaders = token ? { Authorization: `Bearer ${token}` } : {}

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

    try {
      let remoteConvs = []
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
        const remoteIds = new Set(remoteConvs.map((rc) => rc?.id).filter(Boolean))
        const localConvs = hasAuthoritativeServerGroups
          ? rawLocalConvs.filter((c) => {
              const isGrp = Boolean(c?.isGroup || c?.type === 'group')
              if (isGrp && c?.id && !remoteIds.has(c.id)) {
                clearAllLocalMessages(c.id)
                return false
              }
              return true
            })
          : rawLocalConvs
        const localIds = new Set(localConvs.map((c) => c?.id).filter(Boolean))
        syncedConversationsCount = remoteConvs.filter((rc) => rc?.id && !localIds.has(rc.id)).length
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

    try {
      if (pullSettled.status === 'fulfilled' && pullSettled.value?.ok) {
        const data = await pullSettled.value.json().catch(() => null)
        const pulledMessages = Array.isArray(data?.messages) ? data.messages : []
        syncedMessagesCount = pulledMessages.length

        if (pulledMessages.length > 0) {
          const convMap = new Map()
          for (const msg of pulledMessages) {
            const cid = msg.conversationId || msg.conversation_id || (msg.senderId === userId ? msg.receiverId : msg.senderId)
            if (cid) {
              if (!convMap.has(cid)) convMap.set(cid, [])
              convMap.get(cid).push(msg)
            }
          }

          let convs = getLocalConversations()
          const discoveredConvs = []

          for (const [cid, msgs] of convMap.entries()) {
            const currentLocal = getLocalMessages(cid)
            const reconciled = reconcileMessages(currentLocal, msgs)
            saveLocalMessages(cid, reconciled)

            const exists = convs.some((c) => c && c.id === cid)
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
      window.__senchat_needs_sync = false
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
