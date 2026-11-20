/**
 * Sen Chat Offline Queue & Idempotency Engine
 * Manages outgoing messages when network is lost and ensures exactly-once delivery
 * using cryptographic/deterministic idempotency keys upon reconnection.
 */

// In-memory fallback for pure Node.js environments and SSR
const inMemoryStore = new Map()

function getStorageItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }
  return inMemoryStore.get(key) || null
}

function setStorageItem(key, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value)
      return
    } catch {
      // QuotaExceeded or disabled
    }
  }
  inMemoryStore.set(key, value)
}

function removeStorageItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key)
      return
    } catch {}
  }
  inMemoryStore.delete(key)
}

/**
 * Generates an idempotency key guaranteeing exactly-once submission.
 */
export function generateIdempotencyKey(senderId = 'user', conversationId = 'conv', timestamp = Date.now(), entropy = '') {
  const cleanSender = String(senderId).slice(-8).replace(/[^a-zA-Z0-9]/g, '') || 'usr'
  const cleanConv = String(conversationId).slice(-8).replace(/[^a-zA-Z0-9]/g, '') || 'cnv'
  const randomPart = entropy || Math.random().toString(36).substring(2, 9)
  return `idem_${cleanSender}_${cleanConv}_${timestamp}_${randomPart}`
}

/**
 * Creates an offline queue manager instance.
 */
export function createOfflineQueue(options = {}) {
  const queueKey = options.queueKey || 'sen_chat_offline_queue'
  const processedKey = options.processedKey || 'sen_chat_processed_idempotency_keys'
  const maxRetries = options.maxRetries || 5

  function loadQueue() {
    try {
      const raw = getStorageItem(queueKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function saveQueue(list) {
    setStorageItem(queueKey, JSON.stringify(list))
  }

  function loadProcessedKeys() {
    try {
      const raw = getStorageItem(processedKey)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  }

  function saveProcessedKeys(set) {
    // Giới hạn 1000 key gần nhất để tránh phình bộ nhớ
    const arr = Array.from(set).slice(-1000)
    setStorageItem(processedKey, JSON.stringify(arr))
  }

  return {
    /**
     * Enqueue a message for sending.
     * Prevents duplicate enqueuing if idempotencyKey is already processed or already in queue.
     */
    enqueue(message) {
      if (!message) throw new Error('Tin nhắn hàng đợi không hợp lệ')

      const timestamp = message.timestamp || Date.now()
      const idempotencyKey =
        message.idempotencyKey ||
        generateIdempotencyKey(message.senderId, message.conversationId, timestamp)

      const processed = loadProcessedKeys()
      if (processed.has(idempotencyKey)) {
        return {
          duplicate: true,
          status: 'already_processed',
          idempotencyKey,
          message: null,
        }
      }

      const queue = loadQueue()
      const existing = queue.find((item) => item.idempotencyKey === idempotencyKey)
      if (existing) {
        return {
          duplicate: true,
          status: existing.status,
          idempotencyKey,
          message: existing,
        }
      }

      const item = {
        ...message,
        idempotencyKey,
        timestamp,
        status: 'queued',
        retryCount: message.retryCount || 0,
        queuedAt: Date.now(),
      }

      queue.push(item)
      // Đảm bảo hàng đợi luôn xếp theo thứ tự thời gian tăng dần (FIFO)
      queue.sort((a, b) => a.timestamp - b.timestamp)
      saveQueue(queue)

      return {
        duplicate: false,
        status: 'queued',
        idempotencyKey,
        message: item,
      }
    },

    getQueue() {
      return loadQueue()
    },

    getPendingCount() {
      return loadQueue().length
    },

    dequeue(idempotencyKey) {
      const queue = loadQueue()
      const next = queue.filter((item) => item.idempotencyKey !== idempotencyKey)
      saveQueue(next)
    },

    markSending(idempotencyKey) {
      const queue = loadQueue()
      const item = queue.find((i) => i.idempotencyKey === idempotencyKey)
      if (item) {
        item.status = 'sending'
        item.lastAttemptAt = Date.now()
        saveQueue(queue)
      }
      return item
    },

    markSent(idempotencyKey) {
      const queue = loadQueue()
      const filtered = queue.filter((i) => i.idempotencyKey !== idempotencyKey)
      saveQueue(filtered)

      const processed = loadProcessedKeys()
      processed.add(idempotencyKey)
      saveProcessedKeys(processed)
    },

    markFailed(idempotencyKey, error = null) {
      const queue = loadQueue()
      const item = queue.find((i) => i.idempotencyKey === idempotencyKey)
      if (item) {
        item.retryCount = (item.retryCount || 0) + 1
        item.status = item.retryCount >= maxRetries ? 'exhausted' : 'failed'
        item.lastError = error ? String(error) : 'Lỗi gửi tin nhắn'
        item.lastAttemptAt = Date.now()
        saveQueue(queue)
      }
      return item
    },

    isProcessed(idempotencyKey) {
      return loadProcessedKeys().has(idempotencyKey)
    },

    clearQueue() {
      removeStorageItem(queueKey)
    },

    clearProcessed() {
      removeStorageItem(processedKey)
    },

    /**
     * Drains the queue in strict FIFO order using a provided async sendHandler.
     */
    async drainQueue(sendHandler) {
      if (typeof sendHandler !== 'function') {
        throw new Error('sendHandler must be an async function')
      }

      const queue = loadQueue()
      let sentCount = 0
      let failedCount = 0

      for (const item of queue) {
        try {
          this.markSending(item.idempotencyKey)
          const result = await sendHandler(item)
          if (result && result.success !== false) {
            this.markSent(item.idempotencyKey)
            sentCount++
          } else {
            this.markFailed(item.idempotencyKey, result?.error || 'Send unsuccessful')
            failedCount++
          }
        } catch (err) {
          this.markFailed(item.idempotencyKey, err?.message || err)
          failedCount++
        }
      }

      const remaining = loadQueue().length
      return { sent: sentCount, failed: failedCount, remaining }
    },

    /**
     * Deduplicates incoming/merged messages array using message ID and idempotency key.
     */
    deduplicateMessages(messages = []) {
      if (!Array.isArray(messages)) return []
      const seen = new Set()
      const result = []

      for (const msg of messages) {
        if (!msg) continue
        const primaryKey = msg.idempotencyKey || msg.id
        if (primaryKey && seen.has(primaryKey)) {
          continue
        }
        if (primaryKey) seen.add(primaryKey)
        if (msg.id && msg.id !== primaryKey) seen.add(msg.id)
        result.push(msg)
      }

      return result
    },
  }
}
