import {
  generateIdempotencyKey,
  createOfflineQueue,
} from './senChatOfflineQueue.mjs'

export interface QueuedChatMessage {
  idempotencyKey: string
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
  timestamp: number
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'exhausted'
  retryCount: number
  queuedAt?: number
  lastAttemptAt?: number
  lastError?: string
}

export {
  generateIdempotencyKey,
  createOfflineQueue,
}

// Global default queue instance for mobile chat
export const globalOfflineChatQueue = createOfflineQueue()
