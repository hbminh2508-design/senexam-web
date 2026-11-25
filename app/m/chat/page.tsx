'use client'

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  Send,
  Paperclip,
  Mic,
  Smile,
  ThumbsUp,
  MoreVertical,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Phone,
  Video,
  ShieldCheck,
  CheckCheck,
  Check,
  Clock,
  ChevronLeft,
  Info,
  Lock,
  Sparkles,
  UserCheck,
  X,
  Palette,
  Ban,
  Unlock,
  ShieldAlert,
  Timer,
  Fingerprint,
  KeyRound,
  Eye,
  EyeOff,
  WifiOff,
  Radio,
  ArrowLeft,
  SlidersHorizontal,
  Settings,
  Reply,
  Pin,
  PinOff,
  CircleDot,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ChatSafetyWidget from '@/components/chat/ChatSafetyWidget'
import ChatDisappearingMessages from '@/components/chat/ChatDisappearingMessages'
import ChatInfoDrawer from '@/components/chat/ChatInfoDrawer'
import ChatDrmProtection, { ChatDeviceComplianceBadge } from '@/components/chat/ChatDrmProtection'
import ChatVersionModal from '@/components/chat/ChatVersionModal'
import ChatDeviceManagerModal from '@/components/chat/ChatDeviceManagerModal'
import ChatSettingsModal from '@/components/chat/ChatSettingsModal'
import ChatFriendModal from '@/components/chat/ChatFriendModal'
import ChatMlsGroupModal from '@/components/chat/ChatMlsGroupModal'
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal'
import ChatAttachmentBubble from '@/components/chat/ChatAttachmentBubble'
import ChatCallModal, { ChatIncomingCallDialog, CallSignalPayload } from '@/components/chat/ChatCallModal'
import ChatVoiceRecorder from '@/components/chat/ChatVoiceRecorder'
import ChatVoiceMessageBubble from '@/components/chat/ChatVoiceMessageBubble'
import ChatSenAiConfirmModal from '@/components/chat/ChatSenAiConfirmModal'
import ChatMessageContent from '@/components/chat/ChatMessageContent'
import ChatContextMenu from '@/components/chat/ChatContextMenu'
import SenChatLogo from '@/components/SenChatLogo'
import {
  hasSenAiMention,
  extractSenAiQuery,
  getSenAiAutocompleteSuggestions,
  formatSenAiGroupNotice,
} from '@/lib/senChatAi'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import { openSafeDownload, isNativeCapacitor } from '@/lib/capacitorBridge'
import {
  SenChatUser,
  SenChatMessage,
  SenChatConversation,
  ChatWallpaperId,
  CHAT_WALLPAPERS,
  getOrCreateDeviceId,
  getLocalSenChatUser,
  saveLocalSenChatUser,
  getLocalConversations,
  saveLocalConversation,
  deleteLocalConversation,
  getLocalMessages,
  saveLocalMessage,
  saveLocalMessages,
  deleteLocalMessage,
  clearAllLocalMessages,
  getNicknameFor,
  setNicknameFor,
  isUserBlocked,
  blockUser,
  unblockUser,
  getWallpaperFor,
  setWallpaperFor,
  setupEphemeralCleanupListener,
  ensureSenAiStudioInConversations,
  SENAI_STUDIO_CONVERSATION_ID,
  CHAT_RETENTION_POLICY_NOTICE,
  getChatSendKey,
  getChatNotificationSettings,
  togglePinConversation,
  markConversationUnread,
  toggleMessageReaction,
  getConversationDraft,
  saveConversationDraft,
  clearConversationDraft,
} from '@/lib/senChatStorage'
import ChatSenAiStudioView from '@/components/chat/ChatSenAiStudioView'
import { compressChatMessage, decompressChatMessage } from '@/lib/senChatCompression'
import {
  initDeviceRelay,
  broadcastRequestMessageSync,
  broadcastFileTransitReady,
  broadcastConversationRemoved,
  triggerFullDeviceSync,
} from '@/lib/senChatDeviceRelay'
import { SEN_CHAT_CURRENT_VERSION } from '@/lib/senChatVersion'
import {
  calculateSafetyNumber,
  generateIdentityKeyPair,
} from '@/lib/senChatSignalProtocol.mjs'
import {
  globalOfflineChatQueue,
  generateIdempotencyKey,
  QueuedChatMessage,
} from '@/lib/senChatOfflineQueue'
import {
  isFlagSecureEnabled,
  setFlagSecure,
  toggleFlagSecure,
  isAppLockConfigured,
  getAppLockConfig,
  setupAppLock,
  verifyAppLockPin,
  verifyBiometricAuth,
  disableAppLock,
  isSessionLocked,
  lockSession,
  unlockSession,
  isKeystoreHardwareBacked,
  storeIdentityPrivateKey,
  retrieveIdentityPrivateKey,
} from '@/lib/senChatMobileSecurity'

// Bảng biểu cảm nhanh tối ưu chạm ngón cái trên điện thoại
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '🙏', '💯']

export default function MobileChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Điều hướng 3 trạng thái view di động: 'list' <-> 'conversation' <-> 'room-info'
  const [view, setView] = useState<'list' | 'conversation' | 'room-info'>('list')
  const [conversations, setConversations] = useState<SenChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const selectedConvIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedConvIdRef.current = selectedConvId
  }, [selectedConvId])
  const [messages, setMessages] = useState<SenChatMessage[]>([])
  const [currentUser, setCurrentUser] = useState<SenChatUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [offlinePendingCount, setOfflinePendingCount] = useState(0)

  // Khung tìm kiếm & Lọc cuộc trò chuyện
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'direct' | 'group'>('all')

  // Ô nhập tin nhắn & Trả lời / Biểu cảm
  const [inputText, setInputText] = useState('')
  const [replyingToMessage, setReplyingToMessage] = useState<SenChatMessage | null>(null)
  // Modals
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAiSuggestions, setShowAiSuggestions] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])

  // Chiều cao bàn phím ảo (Visual Viewport)
  const [viewportBottomOffset, setViewportBottomOffset] = useState(0)

  // Trạng thái khóa ứng dụng (PIN & Sinh trắc học)
  const [isLocked, setIsLocked] = useState(false)
  const [appLockConfig, setAppLockConfig] = useState<{ enabled: boolean; pinLength: number } | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [showSetupPinModal, setShowSetupPinModal] = useState(false)
  const [newPin, setNewPin] = useState('')

  // Trạng thái FLAG_SECURE
  const [flagSecureActive, setFlagSecureActive] = useState(true)

  // 📞 Cuộc gọi WebRTC E2EE Mobile
  const [activeCallMode, setActiveCallMode] = useState<'none' | 'voice' | 'video'>('none')
  const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(null)
  const [activeCallIsIncoming, setActiveCallIsIncoming] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)

  // Xử lý chấp nhận / từ chối cuộc gọi đến WebRTC
  const handleAcceptIncomingCall = useCallback((call: CallSignalPayload) => {
    setIncomingCall(null)
    setActiveCallId(call.callId)
    setActiveCallIsIncoming(true)
    setActiveCallMode(call.callMode)
    if (call.conversationId) {
      setSelectedConvId(call.conversationId)
      setView('conversation')
    }
  }, [])

  const handleDeclineIncomingCall = useCallback((call: CallSignalPayload) => {
    supabase.channel('sen-chat-realtime-transit').send({
      type: 'broadcast',
      event: 'call_response',
      payload: {
        callId: call.callId,
        conversationId: call.conversationId,
        senderId: currentUser?.id,
        callerId: call.callerId,
        receiverId: call.callerId,
        accepted: false,
      },
    }).catch(() => {})
    setIncomingCall(null)
  }, [currentUser])

  // Các Modal hỗ trợ
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDeviceManagerModal, setShowDeviceManagerModal] = useState(false)
  const [userPlanTier, setUserPlanTier] = useState<string | null>(null)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [showMlsGroupModal, setShowMlsGroupModal] = useState(false)
  const [isManagingGroup, setIsManagingGroup] = useState(false)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [showSenAiConfirmModal, setShowSenAiConfirmModal] = useState(false)
  const [pendingSenAiQuery, setPendingSenAiQuery] = useState<string>('')
  const [showDisappearingSettings, setShowDisappearingSettings] = useState(false)
  const [showSafetyModal, setShowSafetyModal] = useState(false)
  const [safetyNumber, setSafetyNumber] = useState('')
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)

  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const deviceId = useMemo(() => getOrCreateDeviceId(), [])

  // 🔄 Đồng bộ ngầm liên tục giữa các thiết bị (Silent Continuous Background Sync - không hiện thông báo)
  const isSilentSyncingRef = useRef(false)
  const lastConvHashRef = useRef<string>('')
  const lastMsgHashRef = useRef<string>('')

  const syncConversationsStateIfChanged = useCallback((nextList: SenChatConversation[]) => {
    const hash = nextList.map((c) => `${c.id}:${c.updatedAt}:${c.unreadCount}:${c.isPinned ? 1 : 0}:${c.lastMessage || ''}`).join('|')
    if (hash !== lastConvHashRef.current) {
      lastConvHashRef.current = hash
      setConversations(nextList)
    }
  }, [])

  const syncMessagesStateIfChanged = useCallback((convId: string, nextMsgs: SenChatMessage[]) => {
    const hash = `${convId}:${nextMsgs.length}:${nextMsgs.map((m) => `${m.id}:${m.status}:${m.content?.length || 0}:${JSON.stringify(m.reactions || {})}`).join(',')}`
    if (hash !== lastMsgHashRef.current) {
      lastMsgHashRef.current = hash
      setMessages(nextMsgs)
    }
  }, [])

  const runSilentBackgroundSync = useCallback(async () => {
    if (!currentUser?.id || isSilentSyncingRef.current) return
    isSilentSyncingRef.current = true
    try {
      await triggerFullDeviceSync(currentUser.id, deviceId)
      syncConversationsStateIfChanged(ensureSenAiStudioInConversations(getLocalConversations()))
      const activeId = selectedConvIdRef.current
      if (activeId) {
        syncMessagesStateIfChanged(activeId, getLocalMessages(activeId))
      }
    } catch {
      // Âm thầm bỏ qua khi mạng chập chờn
    } finally {
      isSilentSyncingRef.current = false
    }
  }, [currentUser?.id, deviceId, syncConversationsStateIfChanged, syncMessagesStateIfChanged])

  useEffect(() => {
    if (!currentUser?.id) return
    runSilentBackgroundSync()
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runSilentBackgroundSync()
      }
    }, 10000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSilentBackgroundSync()
      }
    }
    const onOnlineSync = () => {
      runSilentBackgroundSync()
    }
    const onSyncCompleted = () => {
      syncConversationsStateIfChanged(ensureSenAiStudioInConversations(getLocalConversations()))
      if (selectedConvIdRef.current) {
        syncMessagesStateIfChanged(selectedConvIdRef.current, getLocalMessages(selectedConvIdRef.current))
      }
    }
    const onReconciled = (e: any) => {
      syncConversationsStateIfChanged(ensureSenAiStudioInConversations(getLocalConversations()))
      const activeId = selectedConvIdRef.current
      if (activeId && (!e?.detail?.conversationId || e?.detail?.conversationId === activeId)) {
        syncMessagesStateIfChanged(activeId, getLocalMessages(activeId))
      }
    }
    const onConversationsReconciled = () => {
      syncConversationsStateIfChanged(ensureSenAiStudioInConversations(getLocalConversations()))
    }
    const onConversationRemoved = (e: any) => {
      const removedId = e?.detail?.conversationId
      syncConversationsStateIfChanged(ensureSenAiStudioInConversations(getLocalConversations()))
      if (removedId && selectedConvIdRef.current === removedId) {
        setView('list')
        setSelectedConvId(null)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnlineSync)
    window.addEventListener('senchat-sync-completed', onSyncCompleted)
    window.addEventListener('senchat-messages-reconciled', onReconciled)
    window.addEventListener('senchat-conversations-reconciled', onConversationsReconciled)
    window.addEventListener('senchat-conversation-removed', onConversationRemoved)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnlineSync)
      window.removeEventListener('senchat-sync-completed', onSyncCompleted)
      window.removeEventListener('senchat-messages-reconciled', onReconciled)
      window.removeEventListener('senchat-conversations-reconciled', onConversationsReconciled)
      window.removeEventListener('senchat-conversation-removed', onConversationRemoved)
    }
  }, [currentUser?.id, runSilentBackgroundSync, syncConversationsStateIfChanged, syncMessagesStateIfChanged])

  // 📋 Custom Context Menu & Touch Long-Press (iPhone/iPad + Desktop)
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    mode: 'message' | 'conversation'
    x: number
    y: number
    message?: SenChatMessage | null
    conversation?: SenChatConversation | null
  }>({ isOpen: false, mode: 'message', x: 0, y: 0, message: null, conversation: null })
  const [activeTouchMessageId, setActiveTouchMessageId] = useState<string | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggeredRef = useRef(false)

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    touchStartPosRef.current = null
  }, [])

  const startLongPress = useCallback(
    (e: React.TouchEvent, onTrigger: (tx: number, ty: number) => void) => {
      cancelLongPress()
      longPressTriggeredRef.current = false
      const touch = e.touches?.[0]
      if (!touch) return
      const tx = touch.clientX
      const ty = touch.clientY
      touchStartPosRef.current = { x: tx, y: ty }
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        longPressTriggeredRef.current = true
        onTrigger(tx, ty)
      }, 380)
    },
    [cancelLongPress]
  )

  const moveLongPress = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPosRef.current || !longPressTimerRef.current) return
      const touch = e.touches?.[0]
      if (!touch) return
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)
      if (dx > 10 || dy > 10) {
        cancelLongPress()
      }
    },
    [cancelLongPress]
  )

  // 🚪 Rời khỏi nhóm MLS chuẩn xác (Mobile)
  const handleLeaveGroup = useCallback(
    async (convId: string) => {
      if (!convId || !currentUser?.id) return
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        await fetch('/api/chat/mls/members', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            conversationId: convId,
            targetUserId: currentUser.id,
            commitMessage: `mls_commit_leave_${Date.now()}`,
          }),
        })
      } catch {}

      deleteLocalConversation(convId)
      clearAllLocalMessages(convId)
      broadcastConversationRemoved(convId)
      setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
      if (selectedConvIdRef.current === convId) {
        setView('list')
        setSelectedConvId(null)
      }
    },
    [currentUser?.id]
  )

  // Đồng bộ trạng thái mở hội thoại cho CapacitorManager (để nút Back phần cứng biết)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__senChatHasOpenConversation = view !== 'list'
      ;(window as any).__senChatHasOpenModal =
        showSettingsModal ||
        showDeviceManagerModal ||
        showSecurityModal ||
        showFriendModal ||
        showMlsGroupModal ||
        showAttachmentModal ||
        Boolean(selectedAttachmentFile) ||
        showSenAiConfirmModal ||
        showDisappearingSettings ||
        showSafetyModal ||
        showSetupPinModal
    }
  }, [
    view,
    showSettingsModal,
    showDeviceManagerModal,
    showSecurityModal,
    showFriendModal,
    showMlsGroupModal,
    showAttachmentModal,
    showSenAiConfirmModal,
    showDisappearingSettings,
    showSafetyModal,
    showSetupPinModal,
  ])

  // Lắng nghe tín hiệu cuộc gọi đến WebRTC E2EE qua Realtime Channel
  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('sen-chat-realtime-transit')
      .on('broadcast', { event: 'new_e2ee_message' }, async ({ payload }) => {
        if (!payload || !currentUser) return
        if (payload.deviceId === deviceId || payload.senderId === currentUser.id) return

        const listConvs = getLocalConversations()
        const activeOrMatchedConv = listConvs.find(
          (c) => c.id === payload.conversationId || c.id === payload.receiverId || c.partnerId === payload.receiverId
        )
        const isTargetedToMe =
          payload.receiverId === currentUser.id ||
          Boolean(activeOrMatchedConv)
        if (!isTargetedToMe) return

        if (isUserBlocked(payload.senderId)) return

        const isGroupTarget = activeOrMatchedConv?.isGroup
        const targetConvId = isGroupTarget
          ? (payload.conversationId || activeOrMatchedConv?.id || payload.receiverId)
          : (payload.isSenAi || payload.senderId === 'senai' || payload.senderId === 'system')
            ? (payload.invokedBy || payload.senderId)
            : payload.senderId

        const decompressedContent = await decompressChatMessage(payload.content || '')

        const incomingMsg: SenChatMessage = {
          id: payload.id || `msg_${Date.now()}`,
          conversationId: targetConvId,
          senderId: payload.senderId,
          senderName: payload.senderName || (payload.isSenAi ? 'SenAI' : 'Bạn bè'),
          receiverId: currentUser.id,
          content: decompressedContent,
          type: payload.type || 'text',
          isSenAi: !!payload.isSenAi,
          invokedBy: payload.invokedBy,
          attachmentUrl: payload.attachmentUrl,
          attachmentName: payload.attachmentName,
          attachmentSize: payload.attachmentSize,
          attachmentId: payload.attachmentId,
          driveFileId: payload.driveFileId,
          storageProvider: payload.storageProvider,
          storagePath: payload.storagePath,
          fileKeyBase64: payload.fileKeyBase64,
          mimeType: payload.mimeType,
          duration: payload.duration,
          waveform: payload.waveform,
          transcription: payload.transcription,
          transcriptionLanguage: payload.transcriptionLanguage,
          createdAt: payload.createdAt || new Date().toISOString(),
          status: 'received',
        }

        saveLocalMessage(targetConvId, incomingMsg)
        setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
        setMessages((prev) => {
          if (selectedConvId === targetConvId) {
            return [...prev, incomingMsg]
          }
          return prev
        })

        try {
          const notifs = getChatNotificationSettings()
          if (notifs.messageSound && typeof window !== 'undefined') {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const osc = audioCtx.createOscillator()
            const gain = audioCtx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12)
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)
            osc.connect(gain)
            gain.connect(audioCtx.destination)
            osc.start()
            osc.stop(audioCtx.currentTime + 0.25)
          }
        } catch {}
      })
      .on('broadcast', { event: 'call_request' }, ({ payload }) => {
        if (!payload || !currentUser) return
        if (payload.receiverId === currentUser.id) {
          setIncomingCall(payload)
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }) => {
        if (!payload) return
        setIncomingCall((prev) => (prev?.callId === payload.callId ? null : prev))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  // Lắng nghe sự kiện Back Button từ CapacitorManager
  useEffect(() => {
    const handleBackPressed = () => {
      // 0. Đóng bảng emoji hoặc gợi ý trợ lý trước nếu đang mở
      if (showEmojiPicker) {
        setShowEmojiPicker(false)
        return
      }
      if (showAiSuggestions) {
        setShowAiSuggestions(false)
        return
      }

      // 1. Đóng modal nếu có modal đang mở
      if (showSettingsModal) {
        setShowSettingsModal(false)
        return
      }
      if (showDeviceManagerModal) {
        setShowDeviceManagerModal(false)
        return
      }
      if (showSetupPinModal) {
        setShowSetupPinModal(false)
        return
      }
      if (showSecurityModal) {
        setShowSecurityModal(false)
        return
      }
      if (showFriendModal) {
        setShowFriendModal(false)
        return
      }
      if (showMlsGroupModal) {
        setShowMlsGroupModal(false)
        return
      }
      if (selectedAttachmentFile) {
        setSelectedAttachmentFile(null)
        return
      }
      if (showAttachmentModal) {
        setShowAttachmentModal(false)
        return
      }
      if (showSenAiConfirmModal) {
        setShowSenAiConfirmModal(false)
        return
      }
      if (showDisappearingSettings) {
        setShowDisappearingSettings(false)
        return
      }
      if (showSafetyModal) {
        setShowSafetyModal(false)
        return
      }

      // 2. Chuyển từ thông tin phòng về khung chat
      if (view === 'room-info') {
        setView('conversation')
        return
      }

      // 3. Chuyển từ khung chat về danh sách hội thoại
      if (view === 'conversation') {
        setSelectedConvId(null)
        setView('list')
        return
      }
    }

    window.addEventListener('senchat:back-pressed', handleBackPressed)
    return () => {
      window.removeEventListener('senchat:back-pressed', handleBackPressed)
    }
  }, [
    view,
    showEmojiPicker,
    showAiSuggestions,
    showSecurityModal,
    showFriendModal,
    showMlsGroupModal,
    showAttachmentModal,
    showSenAiConfirmModal,
    showDisappearingSettings,
    showSafetyModal,
    showSetupPinModal,
  ])

  // Theo dõi bàn phím ảo bằng window.visualViewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const handleResize = () => {
      const vv = window.visualViewport
      if (!vv) return
      const keyboardHeight = window.innerHeight - vv.height
      setViewportBottomOffset(Math.max(0, keyboardHeight))
      if (keyboardHeight > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    window.visualViewport.addEventListener('resize', handleResize)
    window.visualViewport.addEventListener('scroll', handleResize)
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('scroll', handleResize)
    }
  }, [])

  // Khởi tạo người dùng, khóa FLAG_SECURE, PIN lock & Danh bạ
  useEffect(() => {
    // Đăng ký bộ dọn dẹp tin nhắn tạm thời cục bộ khi đóng tab / thoát trang
    const cleanupEphemeral = setupEphemeralCleanupListener()

    async function initMobileChat() {
      setIsLoading(true)

      // 1. Kiểm tra FLAG_SECURE
      const isFlagOn = isFlagSecureEnabled()
      setFlagSecureActive(isFlagOn)
      setFlagSecure(isFlagOn, window)

      // 2. Kiểm tra App Lock
      if (isAppLockConfigured()) {
        const conf = getAppLockConfig()
        setAppLockConfig({ enabled: conf.enabled, pinLength: conf.pinLength || 6 })
        if (isSessionLocked()) {
          setIsLocked(true)
        }
      }

      // 3. Tải phiên người dùng & Kiểm tra Supabase Auth bắt buộc
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone_number, phone, avatar_url, school, class_name, grade, role, allow_search_by_email, read_receipts_enabled, plan_tier, vip_expires_at')
            .eq('id', authUser.id)
            .maybeSingle()

          if (profile) {
            setUserPlanTier(getEffectivePlanTier(profile))
          }

          const synchedUser: SenChatUser = {
            id: authUser.id,
            name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Học viên SenExam',
            identifier: authUser.email || profile?.phone_number || profile?.phone || authUser.id,
            authType: 'senexam',
            avatar: profile?.avatar_url || authUser.user_metadata?.avatar_url || '',
            email: authUser.email || '',
            phone: profile?.phone_number || profile?.phone || '',
            school: profile?.school || '',
            className: profile?.class_name || profile?.grade || '',
            createdAt: authUser.created_at || new Date().toISOString(),
          }
          saveLocalSenChatUser(synchedUser)
          setCurrentUser(synchedUser)

          // Đảm bảo cặp khóa E2EE được bảo vệ an toàn trong Keystore
          const existingKey = await retrieveIdentityPrivateKey('identity_e2ee', window)
          if (!existingKey) {
            const pair = generateIdentityKeyPair()
            await storeIdentityPrivateKey('identity_e2ee', pair.privateKey, window)
          }

          // Tự động đăng ký thiết bị hiện tại lên chat_devices
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData?.session?.access_token
          if (token) {
            const mDeviceId = getOrCreateDeviceId()
            fetch('/api/chat/device-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'register', deviceId: mDeviceId, platform: 'android' }),
            }).catch(() => {})

            // Tự động đồng bộ nhóm & tin nhắn đa thiết bị ngay khi mở app
            triggerFullDeviceSync(authUser.id, mDeviceId, {
              supabaseClient: supabase,
              accessToken: token,
            })
              .then(() => {
                setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
              })
              .catch(() => {})
          }
        } else {
          // Chưa đăng nhập -> Tự động chuyển hướng sang Sen IDP
          router.replace('/new-idp?returnUrl=/m/chat')
          return
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ danh tính người dùng:', err)
        router.replace('/new-idp?returnUrl=/m/chat')
        return
      }

      // 4. Tải danh sách cuộc trò chuyện
      let list = ensureSenAiStudioInConversations(getLocalConversations())
      if (list.length === 0) {
        // Khởi tạo cuộc trò chuyện chào mừng chuẩn E2EE
        const welcomeConv: SenChatConversation = {
          id: 'senai-welcome',
          partnerId: 'senai-assistant',
          partnerName: 'SenAI Trợ Lý Học Tập',
          partnerIdentifier: 'senai@senexam.me',
          lastMessage: 'Chào bạn! Mình là SenAI 2.0. Hãy nhắn tin hoặc gõ @Sen để nhận hỗ trợ giải bài!',
          lastMessageTime: 'Vừa xong',
          unreadCount: 1,
          updatedAt: Date.now(),
          isGroup: false,
        }
        saveLocalConversation(welcomeConv)
        list = [welcomeConv]

        const welcomeMsg: SenChatMessage = {
          id: 'msg_welcome_' + Date.now(),
          conversationId: 'senai-welcome',
          senderId: 'senai-assistant',
          senderName: 'SenAI',
          receiverId: authUser.id,
          content: 'Chào mừng bạn đến với **Sen Chat Mobile**! Tất cả tin nhắn đều được mã hóa đầu cuối (E2EE Signal Protocol) và lưu an toàn trên máy.',
          type: 'text',
          createdAt: new Date().toISOString(),
          status: 'seen',
          isSenAi: true,
        }
        saveLocalMessage('senai-welcome', welcomeMsg)
      }

      setConversations(list)

      // 5. Kiểm tra hàng đợi ngoại tuyến & tự động xả nếu đang online
      const pendingCount = globalOfflineChatQueue.getPendingCount()
      setOfflinePendingCount(pendingCount)
      if (pendingCount > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await globalOfflineChatQueue.drainQueue(async (queued) => {
            const sentMsg: SenChatMessage = {
              id: queued.idempotencyKey,
              conversationId: queued.conversationId,
              senderId: queued.senderId,
              senderName: queued.senderName,
              receiverId: queued.receiverId,
              content: queued.content,
              type: queued.type,
              attachmentUrl: queued.attachmentUrl,
              attachmentName: queued.attachmentName,
              attachmentSize: queued.attachmentSize,
              createdAt: new Date(queued.timestamp).toISOString(),
              status: 'sent',
            }
            saveLocalMessage(queued.conversationId, sentMsg)
            return { success: true }
          })
          setOfflinePendingCount(globalOfflineChatQueue.getPendingCount())
          setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
        } catch {}
      }
      setIsLoading(false)
    }

    initMobileChat()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/new-idp?returnUrl=/m/chat')
      }
    })

    return () => {
      cleanupEphemeral()
      subscription.unsubscribe()
    }
  }, [router])

  // Khởi động Realtime Relay Node đồng bộ đa thiết bị (v1.0.2)
  useEffect(() => {
    if (!currentUser?.id) return
    const relay = initDeviceRelay({
      userId: currentUser.id,
      supabaseClient: supabase,
      onMessagesReconciled: (convId, reconciledMsgs) => {
        if (selectedConvIdRef.current === convId) {
          setMessages(reconciledMsgs)
        }
      },
      onConversationsReconciled: () => {
        setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
      },
    })

    // Đồng bộ ban đầu khi kết nối relay
    broadcastRequestMessageSync(selectedConvIdRef.current || undefined)

    return () => {
      relay?.cleanup()
    }
  }, [currentUser?.id])

  // Theo dõi trạng thái mạng & Xả hàng đợi ngoại tuyến (Drain Queue) khi có mạng
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      const pending = globalOfflineChatQueue.getPendingCount()
      if (pending > 0) {
        await globalOfflineChatQueue.drainQueue(async (queued) => {
          // Lưu tin nhắn thành công
          const sentMsg: SenChatMessage = {
            id: queued.idempotencyKey,
            conversationId: queued.conversationId,
            senderId: queued.senderId,
            senderName: queued.senderName,
            receiverId: queued.receiverId,
            content: queued.content,
            type: queued.type,
            attachmentUrl: queued.attachmentUrl,
            attachmentName: queued.attachmentName,
            attachmentSize: queued.attachmentSize,
            createdAt: new Date(queued.timestamp).toISOString(),
            status: 'sent',
          }
          saveLocalMessage(queued.conversationId, sentMsg)
          return { success: true }
        })
        setOfflinePendingCount(globalOfflineChatQueue.getPendingCount())
        if (selectedConvId) {
          setMessages(getLocalMessages(selectedConvId))
        }
        setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [selectedConvId])

  // Chọn cuộc hội thoại
  const handleSelectConversation = useCallback((convId: string) => {
    setSelectedConvId(convId)
    broadcastRequestMessageSync(convId)
    const msgs = getLocalMessages(convId)
    setMessages(msgs)
    setInputText(getConversationDraft(convId))
    setReplyingToMessage(null)
    setView('conversation')

    // Reset unread count
    const list = getLocalConversations()
    const conv = list.find((c) => c.id === convId)
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0
      saveLocalConversation(conv)
      setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
    }

    // Cuộn xuống tin nhắn mới nhất
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  // Cuộc hội thoại đang chọn
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || null
  }, [conversations, selectedConvId])

  // Nền phòng chat
  const activeWallpaperId = useMemo(() => {
    return selectedConvId ? getWallpaperFor(selectedConvId) : 'default'
  }, [selectedConvId])

  const activeWallpaper = useMemo(() => {
    return CHAT_WALLPAPERS.find((w) => w.id === activeWallpaperId) || CHAT_WALLPAPERS[0]
  }, [activeWallpaperId])

  // Gửi tin nhắn (Hỗ trợ cả chế độ ngoại tuyến qua hàng đợi)
  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend !== undefined ? textToSend : inputText).trim()
      if (!text || !selectedConvId || !currentUser) return

      // Kiểm tra gọi @Sen trợ lý
      if (hasSenAiMention(text)) {
        const query = extractSenAiQuery(text)
        setPendingSenAiQuery(query)
        setShowSenAiConfirmModal(true)
        return
      }

      const timestamp = Date.now()
      const idempotencyKey = generateIdempotencyKey(currentUser.id, selectedConvId, timestamp, text.slice(0, 5))

      const newMessage: SenChatMessage = {
        id: idempotencyKey,
        conversationId: selectedConvId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        receiverId: activeConversation?.partnerId || '',
        content: text,
        type: 'text',
        createdAt: new Date(timestamp).toISOString(),
        status: isOnline ? 'sent' : 'sending',
        ...(replyingToMessage
          ? {
              replyTo: {
                id: replyingToMessage.id,
                senderName: replyingToMessage.senderName || 'Người dùng',
                content:
                  replyingToMessage.content ||
                  (replyingToMessage.attachmentName ? `[Tệp: ${replyingToMessage.attachmentName}]` : '[Tin nhắn]'),
              },
            }
          : {}),
      }

      // 1. Lưu cục bộ ngay tức thì
      saveLocalMessage(selectedConvId, newMessage)
      setMessages((prev) => [...prev, newMessage])
      setInputText('')
      clearConversationDraft(selectedConvId)
      setReplyingToMessage(null)
      setShowEmojiPicker(false)
      setShowAiSuggestions(false)

      // Cập nhật danh sách hội thoại
      setConversations(ensureSenAiStudioInConversations(getLocalConversations()))

      // 2. Gửi qua Realtime transit với nén văn bản nếu có mạng
      if (isOnline) {
        compressChatMessage(text)
          .then((compressedText) => {
            supabase.channel('sen-chat-realtime-transit').send({
              type: 'broadcast',
              event: 'new_e2ee_message',
              payload: {
                ...newMessage,
                content: compressedText,
                deviceId,
              },
            }).catch(() => {})
          })
          .catch(() => {
            supabase.channel('sen-chat-realtime-transit').send({
              type: 'broadcast',
              event: 'new_e2ee_message',
              payload: {
                ...newMessage,
                deviceId,
              },
            }).catch(() => {})
          })
      } else {
        // Nếu mất mạng: Đẩy vào Hàng Đợi Ngoại Tuyến với Idempotency Key
        globalOfflineChatQueue.enqueue({
          idempotencyKey,
          conversationId: selectedConvId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId: activeConversation?.partnerId || '',
          content: text,
          type: 'text',
          timestamp,
          status: 'queued',
          retryCount: 0,
        })
        setOfflinePendingCount(globalOfflineChatQueue.getPendingCount())
      }

      // Cuộn xuống
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    },
    [inputText, selectedConvId, currentUser, activeConversation, isOnline, deviceId]
  )

  // Nhập tin nhắn & bắt trigger @Sen + lưu nháp tự động
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)
    if (selectedConvId) {
      saveConversationDraft(selectedConvId, val)
    }

    if (val.includes('@')) {
      const suggestions = getSenAiAutocompleteSuggestions(val)
      setAiSuggestions(suggestions)
      setShowAiSuggestions(suggestions.length > 0)
    } else {
      setShowAiSuggestions(false)
    }
  }

  // Thả biểu cảm nhanh trên tin nhắn Mobile
  const handleAddReaction = (msgId: string, emoji: string) => {
    if (!selectedConvId || !currentUser?.id) return
    const updated = toggleMessageReaction(selectedConvId, msgId, emoji, currentUser.id)
    setMessages(updated)
  }

  // Thu hồi / Xóa tin nhắn trên Mobile
  const handleRecallMessage = async (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId)
    const isMine = targetMsg ? targetMsg.senderId === currentUser?.id : true
    const promptMsg = isMine
      ? 'Bạn có chắc chắn muốn thu hồi tin nhắn này?'
      : 'Bạn có chắc chắn muốn xóa tin nhắn này khỏi thiết bị?'
    if (!confirm(promptMsg)) return

    if (isMine) {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        await fetch('/api/chat/messages/recall', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messageId: msgId }),
        })
      } catch {}

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === msgId ? { ...m, content: '[Tin nhắn đã được thu hồi]', type: 'system' as const } : m
        )
        if (selectedConvId) saveLocalMessages(selectedConvId, next)
        return next
      })
    } else {
      if (selectedConvId) {
        deleteLocalMessage(selectedConvId, msgId)
      }
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    }
  }

  // Chọn gợi ý @Sen
  const handleSelectAiSuggestion = () => {
    setInputText((prev) => {
      const atIdx = prev.lastIndexOf('@')
      if (atIdx >= 0) {
        return prev.substring(0, atIdx) + '@Sen '
      }
      return '@Sen '
    })
    setShowAiSuggestions(false)
    chatInputRef.current?.focus()
  }

  // Gửi nút Thích (Like)
  const handleSendLike = () => {
    if (!selectedConvId || !currentUser) return
    const timestamp = Date.now()
    const idempotencyKey = generateIdempotencyKey(currentUser.id, selectedConvId, timestamp, 'like')

    const likeMsg: SenChatMessage = {
      id: idempotencyKey,
      conversationId: selectedConvId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeConversation?.partnerId || '',
      content: '👍',
      type: 'like',
      createdAt: new Date(timestamp).toISOString(),
      status: 'sent',
    }

    saveLocalMessage(selectedConvId, likeMsg)
    setMessages((prev) => [...prev, likeMsg])
    setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  // Gửi tin nhắn thoại bảo mật E2EE kèm STT trên mobile
  const handleSendVoiceMessage = async (voiceData: {
    audioBlob: Blob
    fileKeyBase64: string
    attachmentId?: string
    driveFileId?: string
    storageProvider?: string
    storagePath?: string
    duration: number
    waveform: number[]
    transcription?: string
    transcriptionLanguage?: string
    fileSize: number
    mimeType: string
  }) => {
    if (!selectedConvId || !currentUser || !activeConversation) return

    const timestamp = Date.now()
    const idempotencyKey = generateIdempotencyKey(currentUser.id, selectedConvId, timestamp, 'audio')

    const newMsg: SenChatMessage = {
      id: idempotencyKey,
      conversationId: selectedConvId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeConversation.partnerId || '',
      content: voiceData.transcription ? `[Tin nhắn thoại]: ${voiceData.transcription}` : '[Tin nhắn thoại]',
      type: 'audio',
      attachmentId: voiceData.attachmentId,
      driveFileId: voiceData.driveFileId,
      storageProvider: (voiceData.storageProvider as any) || 'supabase_storage',
      storagePath: voiceData.storagePath,
      fileKeyBase64: voiceData.fileKeyBase64,
      attachmentSize: voiceData.fileSize,
      mimeType: voiceData.mimeType,
      duration: voiceData.duration,
      waveform: voiceData.waveform,
      transcription: voiceData.transcription,
      transcriptionLanguage: voiceData.transcriptionLanguage,
      createdAt: new Date(timestamp).toISOString(),
      status: 'sent',
    }

    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])
    setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
    setIsRecordingVoice(false)

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  // Cập nhật phiên âm tin nhắn thoại sau khi chỉnh sửa trên mobile
  const handleUpdateMessageTranscription = (msgId: string, newText: string, newLang?: string) => {
    if (!selectedConvId) return
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          const updated: SenChatMessage = {
            ...m,
            transcription: newText,
            transcriptionLanguage: newLang || m.transcriptionLanguage || 'vi',
            content: newText ? `[Tin nhắn thoại]: ${newText}` : m.content,
          }
          saveLocalMessage(selectedConvId, updated)
          return updated
        }
        return m
      })
    )
  }

  // Xác nhận chuyển dữ liệu cho SenAI với cam kết bảo mật E2EE
  const handleConfirmSenAi = async (confirmedQuery: string, includeContext: boolean) => {
    setShowSenAiConfirmModal(false)
    if (!selectedConvId || !currentUser) return

    // Gửi tin nhắn của người dùng
    handleSendMessage(inputText)

    // Thêm tin nhắn đang phân tích của SenAI
    const aiPendingId = 'senai_reply_' + Date.now()
    const pendingMsg: SenChatMessage = {
      id: aiPendingId,
      conversationId: selectedConvId,
      senderId: 'senai-assistant',
      senderName: 'SenAI',
      receiverId: currentUser.id,
      content: 'SenAI đang suy nghĩ và tính toán công thức...',
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sending',
      isSenAi: true,
    }
    setMessages((prev) => [...prev, pendingMsg])

    try {
      const res = await fetch('/api/chat/senai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: confirmedQuery,
          includeContext,
          contextMessages: includeContext ? messages.slice(-5) : [],
        }),
      })

      const data = await res.json()
      const replyText = data?.reply || data?.text || 'SenAI đã xử lý xong yêu cầu của bạn.'

      const finalAiMsg: SenChatMessage = {
        id: aiPendingId,
        conversationId: selectedConvId,
        senderId: 'senai-assistant',
        senderName: 'SenAI',
        receiverId: currentUser.id,
        content: replyText,
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
        isSenAi: true,
      }

      saveLocalMessage(selectedConvId, finalAiMsg)
      setMessages((prev) => prev.map((m) => (m.id === aiPendingId ? finalAiMsg : m)))
      setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
    } catch {
      const errorMsg: SenChatMessage = {
        id: aiPendingId,
        conversationId: selectedConvId,
        senderId: 'senai-assistant',
        senderName: 'SenAI',
        receiverId: currentUser.id,
        content: '⚠️ Không thể kết nối đến máy chủ SenAI. Vui lòng kiểm tra lại kết nối mạng.',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
        isSenAi: true,
      }
      saveLocalMessage(selectedConvId, errorMsg)
      setMessages((prev) => prev.map((m) => (m.id === aiPendingId ? errorMsg : m)))
    }
  }

  // Mở khóa bằng PIN (kiểm tra chuẩn theo độ dài cấu hình)
  const handleUnlockPin = (digit?: string) => {
    const targetLength = appLockConfig?.pinLength || 6
    let nextPin = pinInput
    if (digit !== undefined) {
      if (digit === 'del') {
        nextPin = nextPin.slice(0, -1)
      } else if (nextPin.length < targetLength) {
        nextPin = nextPin + digit
      }
      setPinInput(nextPin)
      setPinError(null)
    }

    if (nextPin.length === targetLength) {
      const res = verifyAppLockPin(nextPin)
      if (res.success) {
        unlockSession()
        setIsLocked(false)
        setPinInput('')
        setPinError(null)
      } else {
        setPinError(res.error || 'Mã PIN không đúng')
        setTimeout(() => {
          setPinInput('')
        }, 400)
        if (res.lockedOut) {
          alert('Ứng dụng bị khóa tạm thời do nhập sai nhiều lần.')
        }
      }
    }
  }

  // Mở khóa bằng Sinh trắc học
  const handleUnlockBiometric = async () => {
    try {
      const res = await verifyBiometricAuth(window)
      if (res.success) {
        unlockSession()
        setIsLocked(false)
        setPinInput('')
        setPinError(null)
      }
    } catch {}
  }

  // Bật / Tắt FLAG_SECURE
  const handleToggleFlagSecure = () => {
    const next = toggleFlagSecure(window)
    setFlagSecureActive(next.enabled)
  }

  // Thiết lập PIN mới
  const handleSaveNewPin = () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      alert('Vui lòng nhập mã PIN hợp lệ từ 4 đến 6 chữ số')
      return
    }
    setupAppLock({ pin: newPin, useBiometric: true })
    setAppLockConfig({ enabled: true, pinLength: newPin.length })
    setShowSetupPinModal(false)
    setNewPin('')
    alert('Đã thiết lập mã PIN và sinh trắc học thành công!')
  }

  // Lọc cuộc trò chuyện theo tab (SenAI Studio luôn luôn hiển thị ở đầu)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (c.id === SENAI_STUDIO_CONVERSATION_ID && !searchQuery.trim()) return true
      const matchQuery =
        !searchQuery.trim() ||
        c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchTab =
        activeFilterTab === 'all'
          ? true
          : c.id === SENAI_STUDIO_CONVERSATION_ID
          ? true
          : activeFilterTab === 'group'
          ? Boolean(c.isGroup)
          : !Boolean(c.isGroup)
      return matchQuery && matchTab
    })
  }, [conversations, searchQuery, activeFilterTab])

  // ============================================================================
  // MÀN HÌNH KHÓA BẢO MẬT (PIN & BIOMETRIC APP LOCK OVERLAY)
  // ============================================================================
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none animate-in fade-in">
        <div className="w-full flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Sen Chat E2EE Security
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold">
            Khóa Bảo Vệ
          </span>
        </div>

        <div className="flex flex-col items-center space-y-4 text-center my-auto">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Nhập Mã PIN Để Mở Khóa</h2>
            <p className="text-xs text-slate-400 mt-1">
              Bảo vệ tin nhắn riêng tư và khóa lưu trữ Android Keystore
            </p>
          </div>

          {/* Dãy chấm PIN linh hoạt theo độ dài cấu hình */}
          <div className="flex items-center gap-3 py-3">
            {Array.from({ length: appLockConfig?.pinLength || 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  pinInput.length > i
                    ? 'bg-sky-400 scale-110 shadow-sm shadow-sky-400/50'
                    : 'bg-white/15 border border-white/20'
                }`}
              />
            ))}
          </div>

          {pinError && (
            <p className="text-xs font-bold text-rose-400 animate-shake">
              {pinError}
            </p>
          )}
        </div>

        {/* Bàn phím số cảm ứng ≥ 44px */}
        <div className="w-full max-w-xs grid grid-cols-3 gap-3 pb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleUnlockPin(String(num))}
              className="min-h-[56px] rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-xl font-black text-white flex items-center justify-center transition active:scale-95 border border-white/5"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleUnlockBiometric}
            className="min-h-[56px] rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 flex items-center justify-center transition active:scale-95"
            aria-label="Xác thực sinh trắc học"
          >
            <Fingerprint className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => handleUnlockPin('0')}
            className="min-h-[56px] rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-xl font-black text-white flex items-center justify-center transition active:scale-95 border border-white/5"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleUnlockPin('del')}
            className="min-h-[56px] rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-sm font-bold text-slate-300 flex items-center justify-center transition active:scale-95 border border-white/5"
          >
            Xóa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col w-full h-full overflow-hidden select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* ⚠️ BANNER THÔNG BÁO MẤT MẠNG & HÀNG ĐỢI GỬI LẠI IDEMPOTENT */}
      {!isOnline && (
        <div className="w-full bg-amber-500/90 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold z-30 shadow-xs backdrop-blur-md">
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 animate-pulse" />
            <span>Đang ngoại tuyến</span>
          </div>
          <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">
            {offlinePendingCount > 0 ? `Đang chờ gửi: ${offlinePendingCount}` : 'Chờ kết nối'}
          </span>
        </div>
      )}

      {/* =======================================================================
          VIEW 1: DANH SÁCH CUỘC HỘI THOẠI (CONVERSATIONS LIST)
          ======================================================================= */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
          {/* Header Bar */}
          <header className="p-3.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Link
                href="/m"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Về trang chủ"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setShowVersionModal(true)}
                title={`Sen Chat v${SEN_CHAT_CURRENT_VERSION} — Bấm để xem thông tin phiên bản & nhật ký cập nhật`}
                className="flex items-center gap-2 text-left active:scale-95 transition"
              >
                <SenChatLogo size={36} className="shrink-0" />
                <div>
                  <h1 className="text-base font-black flex items-center gap-1.5">
                    <span>Sen Chat</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[9px] font-black tracking-wider uppercase">
                      E2EE
                    </span>
                    <ChatDeviceComplianceBadge />
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {flagSecureActive ? '🛡️ FLAG_SECURE Đang bật' : 'Mã hóa đầu cuối'}
                  </span>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Cài đặt Sen Chat"
              >
                <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Cài đặt bảo mật"
              >
                <ShieldCheck className="h-5 w-5 text-sky-500" />
              </button>
              <button
                type="button"
                onClick={() => setShowFriendModal(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-95 transition"
                aria-label="Thêm bạn mới"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Ô Tìm Kiếm Nhanh */}
          <div className="p-3 shrink-0">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm bạn bè hoặc nhóm học tập..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-2xl border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-10 pr-3 text-xs outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          {/* Bộ lọc Tab: Tất cả / Cá nhân / Nhóm MLS */}
          <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'direct', label: 'Cá nhân' },
              { key: 'group', label: 'Nhóm MLS' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilterTab(tab.key as any)}
                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                  activeFilterTab === tab.key
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setIsManagingGroup(false)
                setShowMlsGroupModal(true)
              }}
              className="ml-auto min-h-[44px] px-3 rounded-xl border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Tạo Nhóm</span>
            </button>
          </div>

          {/* Danh Sách Hội Thoại */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain transform-gpu divide-y divide-black/5 dark:divide-white/5 px-2 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3 my-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-black/5 dark:bg-white/5 text-slate-400 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chưa có cuộc trò chuyện nào
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Bấm dấu (+) để kết bạn hoặc tạo nhóm học tập MLS
                  </p>
                </div>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSenAiStudio = conv.id === SENAI_STUDIO_CONVERSATION_ID
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false
                        return
                      }
                      handleSelectConversation(conv.id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({
                        isOpen: true,
                        mode: 'conversation',
                        x: e.clientX,
                        y: e.clientY,
                        conversation: conv,
                      })
                    }}
                    onTouchStart={(e) =>
                      startLongPress(e, (tx, ty) =>
                        setContextMenu({
                          isOpen: true,
                          mode: 'conversation',
                          x: tx,
                          y: ty,
                          conversation: conv,
                        })
                      )
                    }
                    onTouchMove={moveLongPress}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    style={{ WebkitTouchCallout: 'none' }}
                    className={`min-h-[64px] p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition select-none ${
                      isSenAiStudio
                        ? 'bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10'
                    }`}
                  >
                    <div className={`relative w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
                      isSenAiStudio
                        ? 'bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-500 text-white shadow-blue-500/30'
                        : 'bg-gradient-to-tr from-sky-400 to-indigo-600 text-white'
                    }`}>
                      {isSenAiStudio ? (
                        <Sparkles className="h-5 w-5 animate-pulse text-white" />
                      ) : (
                        conv.partnerName.slice(0, 1).toUpperCase()
                      )}
                      {conv.isGroup && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[9px] text-white flex items-center justify-center">
                          👥
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.isPinned && !isSenAiStudio && (
                            <Pin className="h-3 w-3 shrink-0 text-amber-500" />
                          )}
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {isSenAiStudio ? 'SenAI Studio' : conv.partnerName}
                          </h4>
                          {isSenAiStudio && (
                            <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-[9px] font-black uppercase tracking-wider text-white">
                              Studio
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {conv.lastMessageTime || ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {conv.lastMessage || (isSenAiStudio ? 'Trợ lý học tập & nghiên cứu' : 'Chưa có tin nhắn')}
                      </p>
                    </div>

                    {!isSenAiStudio && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConversations(togglePinConversation(conv.id))
                          }}
                          title={conv.isPinned ? 'Bỏ ghim' : 'Ghim hội thoại'}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          {conv.isPinned ? <PinOff className="h-3.5 w-3.5 text-amber-500" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConversations(markConversationUnread(conv.id, 1))
                          }}
                          title="Đánh dấu chưa đọc"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          <CircleDot className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 2: KHUNG CHAT CHI TIẾT (CONVERSATION DETAIL)
          ======================================================================= */}
      {view === 'conversation' && activeConversation && (
        activeConversation.id === SENAI_STUDIO_CONVERSATION_ID ? (
          <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-white dark:bg-slate-950">
            <div className="p-2.5 border-b border-black/10 dark:border-white/10 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedConvId(null)
                  setView('list')
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Quay lại danh sách hội thoại"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs truncate">SenAI Studio</h3>
                  <p className="text-[10px] text-slate-400">Trợ lý học tập & nghiên cứu</p>
                </div>
              </div>
            </div>
            <ChatSenAiStudioView userId={currentUser?.id} isMobile={true} />
          </div>
        ) : (
        <div
          className="flex-1 flex flex-col w-full h-full overflow-hidden transition-all duration-150"
          style={{
            background: activeWallpaper.bgStyle,
            paddingBottom: `${viewportBottomOffset}px`,
          }}
        >
          {/* Header Bar Khung Chat */}
          <header className="p-2.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedConvId(null)
                  setView('list')
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Quay lại danh sách hội thoại"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <div
                onClick={() => setView('room-info')}
                className="flex items-center gap-2 min-w-0 cursor-pointer active:opacity-80"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {activeConversation.partnerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black truncate max-w-[160px]">
                    {activeConversation.partnerName}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-sky-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span>{activeConversation.isGroup ? 'Nhóm MLS E2EE' : 'Signal E2EE'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveCallId(null)
                  setActiveCallIsIncoming(false)
                  setActiveCallMode('voice')
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 hover:text-blue-600 active:scale-95 transition"
                aria-label="Gọi thoại mã hóa"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCallId(null)
                  setActiveCallIsIncoming(false)
                  setActiveCallMode('video')
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 hover:text-blue-600 active:scale-95 transition"
                aria-label="Gọi video mã hóa"
              >
                <Video className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setView('room-info')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 active:scale-95 transition"
                aria-label="Thông tin phòng"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Thông báo chính sách bảo mật lưu trữ 30 ngày */}
          <div className="relative z-10 flex items-center justify-between px-3 py-1 bg-blue-500/10 border-b border-blue-500/20 text-blue-800 dark:text-sky-300 text-[10px] shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{CHAT_RETENTION_POLICY_NOTICE}</span>
            </div>
          </div>

          {/* Danh Sách Tin Nhắn */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain transform-gpu p-3 space-y-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Huy hiệu bảo mật mã hóa */}
            <div className="flex justify-center my-2">
              <div className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-xs">
                <Lock className="h-3 w-3 text-sky-500" />
                <span>Tin nhắn được bảo vệ bằng mã hóa E2EE</span>
              </div>
            </div>

            {messages.map((msg) => {
              const isMe = msg.senderId === currentUser?.id

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  onContextMenu={(e) => {
                    if (msg.type === 'system') return
                    e.preventDefault()
                    setContextMenu({
                      isOpen: true,
                      mode: 'message',
                      x: e.clientX,
                      y: e.clientY,
                      message: msg,
                    })
                  }}
                  onTouchStart={(e) => {
                    if (msg.type === 'system') return
                    startLongPress(e, (tx, ty) =>
                      setContextMenu({
                        isOpen: true,
                        mode: 'message',
                        x: tx,
                        y: ty,
                        message: msg,
                      })
                    )
                  }}
                  onTouchMove={moveLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onClick={() => {
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false
                      return
                    }
                    if (msg.type !== 'system') {
                      setActiveTouchMessageId((prev) => (prev === msg.id ? null : msg.id))
                    }
                  }}
                  style={{ WebkitTouchCallout: 'none' }}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 transition-all rounded-2xl select-none`}
                >
                  {!isMe && (
                    <span className="text-[10px] text-slate-400 font-bold pl-1">
                      {msg.senderName}
                    </span>
                  )}

                  <div
                    className={`max-w-[85%] rounded-3xl p-3 text-xs shadow-xs leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white rounded-br-xs shadow-blue-600/20'
                        : msg.isSenAi
                        ? 'bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-indigo-500/10 text-slate-900 dark:text-white border border-pink-500/20 rounded-bl-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-black/5 dark:border-white/5 rounded-bl-xs'
                    }`}
                  >
                    {msg.replyTo && (
                      <div
                        className={`mb-1.5 rounded-xl border-l-2 px-2 py-1 text-[10px] ${
                          isMe
                            ? 'border-white/70 bg-white/15 text-white/95'
                            : 'border-sky-500 bg-slate-100 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200'
                        }`}
                      >
                        <div className="font-bold">{msg.replyTo.senderName}</div>
                        <div className="truncate opacity-80">{msg.replyTo.content}</div>
                      </div>
                    )}
                    {msg.isSenAi && (
                      <div className="mb-1.5 flex items-center gap-1.5 px-2 py-0.5 w-fit rounded-lg bg-gradient-to-r from-purple-500/15 to-indigo-500/15 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                        <img src="/senai-logo.png" alt="SenAI" className="h-3 w-3 object-contain" />
                        <span>SenAI</span>
                      </div>
                    )}
                    {/* Thẻ đính kèm tệp / ảnh */}
                    {msg.type === 'file' || msg.type === 'image' ? (
                      <ChatAttachmentBubble
                        isMe={isMe}
                        attachmentId={msg.attachmentId}
                        driveFileId={msg.driveFileId}
                        storageProvider={msg.storageProvider}
                        fileKeyBase64={msg.fileKeyBase64}
                        fileName={msg.attachmentName || 'dinh_kem'}
                        fileSize={msg.attachmentSize || 0}
                        mimeType={msg.mimeType}
                        expiresAt={msg.expiresAt}
                        isPinnedPermanent={msg.isPinnedPermanent}
                        isGroup={activeConversation?.isGroup}
                        canExtendRetention={activeConversation?.isGroup ? (activeConversation?.role === 'owner' || activeConversation?.role === 'admin' || msg.senderId === currentUser?.id) : true}
                        onRetentionExtended={(attId, newExp, isPerm) => {
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.attachmentId === attId
                                ? { ...m, expiresAt: newExp || undefined, isPinnedPermanent: isPerm }
                                : m
                            )
                          )
                        }}
                        fileType={
                          msg.type === 'image'
                            ? 'image'
                            : (msg.mimeType?.startsWith('video/') || msg.attachmentName?.match(/\.(mp4|webm|mov|mkv|avi)$/i))
                            ? 'video'
                            : 'file'
                        }
                      />
                    ) : msg.type === 'audio' ? (
                      /* Tin nhắn giọng nói */
                      <ChatVoiceMessageBubble
                        messageId={msg.id}
                        attachmentId={msg.attachmentId}
                        driveFileId={msg.driveFileId}
                        storageProvider={msg.storageProvider}
                        storagePath={msg.storagePath}
                        fileKeyBase64={msg.fileKeyBase64}
                        duration={msg.duration || 0}
                        waveform={msg.waveform || []}
                        transcription={msg.transcription}
                        transcriptionLanguage={msg.transcriptionLanguage}
                        isOutgoing={isMe}
                        userPlanTier={userPlanTier}
                        onUpdateTranscription={handleUpdateMessageTranscription}
                      />
                    ) : msg.type === 'like' ? (
                      /* Nút thích lớn */
                      <span className="text-2xl">👍</span>
                    ) : (
                      /* Nội dung text hỗ trợ KaTeX & TikZ */
                      <ChatMessageContent
                        content={msg.content}
                        isSenAi={msg.isSenAi}
                        isMe={isMe}
                      />
                    )}
                    {/* Hiển thị huy hiệu biểu cảm nhanh */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                          if (!Array.isArray(users) || users.length === 0) return null
                          const reactedByMe = currentUser?.id ? users.includes(currentUser.id) : false
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddReaction(msg.id, emoji)
                              }}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                reactedByMe
                                  ? 'bg-sky-500/20 border border-sky-400 text-sky-900 dark:text-sky-200'
                                  : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{users.length}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Thanh thao tác nhanh: Trả lời, Biểu cảm & Thu hồi/Xóa (chạm vào tin nhắn trên iPhone/iPad để bật) */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`flex items-center gap-1 px-1 transition-all duration-150 ${
                      activeTouchMessageId === msg.id
                        ? 'opacity-100 scale-100 rounded-full bg-white/95 dark:bg-slate-800/95 border border-blue-500/20 shadow-md py-0.5 px-2'
                        : 'opacity-75'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setReplyingToMessage(msg)
                        setActiveTouchMessageId(null)
                      }}
                      title="Trả lời"
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-500/10"
                    >
                      <Reply className="h-3 w-3" />
                    </button>
                    {(['👍', '❤️', '😂', '😮', '😢'] as const).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddReaction(msg.id, emoji)
                          setActiveTouchMessageId(null)
                        }}
                        className="p-0.5 text-[11px] hover:scale-110 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                    {isMe && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRecallMessage(msg.id)
                          setActiveTouchMessageId(null)
                        }}
                        title="Thu hồi tin nhắn"
                        className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Thời gian & Trạng thái gửi */}
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 px-1">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && (
                      <span>
                        {msg.status === 'sending' ? (
                          <Clock className="h-2.5 w-2.5 animate-spin text-amber-500" />
                        ) : msg.status === 'sent' ? (
                          <Check className="h-2.5 w-2.5 text-slate-400" />
                        ) : (
                          <CheckCheck className="h-2.5 w-2.5 text-sky-500" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Gợi Ý Autocomplete @Sen */}
          {showAiSuggestions && (
            <div className="p-2 border-t border-black/5 dark:border-white/5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <button
                type="button"
                onClick={handleSelectAiSuggestion}
                className="min-h-[44px] px-3 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 text-xs font-black flex items-center gap-1.5 active:scale-95 transition"
              >
                <Sparkles className="h-4 w-4" />
                <span>Gọi SenAI 2.0 (@Sen)</span>
              </button>
              <span className="text-[10px] text-slate-400">
                Giải bài tập, KaTeX và gợi ý thi
              </span>
            </div>
          )}

          {/* Bảng Biểu Cảm Nhanh */}
          {showEmojiPicker && (
            <div className="p-2 border-t border-black/5 dark:border-white/5 bg-white/95 dark:bg-slate-900/95 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendMessage(inputText + emoji)}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-90 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Khung hiển thị tin nhắn đang trả lời */}
          {replyingToMessage && (
            <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-[11px]">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sky-600 dark:text-sky-400">
                  Đang trả lời {replyingToMessage.senderName}:{' '}
                </span>
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {replyingToMessage.content || '[Đính kèm]'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToMessage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Trình Ghi Âm Tin Nhắn Thoại Mobile */}
          {isRecordingVoice ? (
            <div className="p-2 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
              <ChatVoiceRecorder
                conversationId={selectedConvId || ''}
                userPlanTier={userPlanTier || 'free'}
                onCancel={() => setIsRecordingVoice(false)}
                onSendVoiceMessage={handleSendVoiceMessage}
              />
            </div>
          ) : (
            /* Khung Nhập Liệu Đáy (Bottom Chat Input Bar) */
            <div
              className="p-2 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-end gap-1.5 shrink-0"
              style={{
                paddingBottom: viewportBottomOffset > 0 ? '0.5rem' : 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))',
              }}
            >
              {/* Input file ẩn cho Mobile */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setSelectedAttachmentFile(f)
                  e.target.value = ''
                }}
              />

              {/* Nút gửi đính kèm */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition"
                aria-label="Đính kèm tệp"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Nút ghi âm tin nhắn thoại */}
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 active:scale-95 transition"
                aria-label="Ghi âm tin nhắn thoại"
              >
                <Mic className="h-5 w-5" />
              </button>

              {/* Nút biểu cảm nhanh */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition"
                aria-label="Biểu cảm"
              >
                <Smile className="h-5 w-5" />
              </button>

              {/* Ô nhập nội dung tin nhắn */}
              <div className="flex-1 min-h-[44px] rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 flex items-center">
                <textarea
                  ref={chatInputRef}
                  rows={1}
                  placeholder="Nhắn tin E2EE... (gõ @Sen hỏi bài)"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const sendKey = getChatSendKey()
                      if (sendKey === 'enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      } else if (sendKey === 'shift_enter' && e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }
                  }}
                  className="w-full max-h-24 bg-transparent text-xs outline-none resize-none"
                />
              </div>

              {/* Nút gửi hoặc Thích */}
              {inputText.trim() ? (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs active:scale-95 transition"
                  aria-label="Gửi tin nhắn"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendLike}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-amber-500 active:scale-95 transition text-lg"
                  aria-label="Gửi thích"
                >
                  👍
                </button>
              )}
            </div>
          )}
        </div>
        )
      )}

      {/* =======================================================================
          VIEW 3: NGĂN THÔNG TIN PHÒNG, TỆP, LINK & BẢO MẬT (COLLAPSIBLE DRAWER)
          ======================================================================= */}
      {view === 'room-info' && activeConversation && (
        <ChatInfoDrawer
          isOpen={true}
          onClose={() => setView('conversation')}
          conversation={activeConversation}
          messages={messages}
          currentUserId={currentUser?.id || ''}
          currentNickname={activeConversation.partnerName}
          onSelectMessage={(msgId) => {
            setView('conversation')
            setTimeout(() => {
              const el = document.getElementById(`msg-${msgId}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('ring-2', 'ring-blue-500')
                setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000)
              }
            }, 100)
          }}
          onRecallMessage={(msgId) => {
            deleteLocalMessage(activeConversation.id, msgId)
            setMessages(getLocalMessages(activeConversation.id))
          }}
          safetyNumberData={safetyNumber}
          onMarkVerified={(verified) => {
            if (activeConversation?.partnerId) {
              localStorage.setItem(`senchat_verified_${activeConversation.partnerId}`, String(verified))
            }
          }}
          disappearingTtl={disappearingTtl}
          onChangeDisappearingTtl={(ttl) => setDisappearingTtl(ttl)}
          onOpenManageGroup={() => {
            setIsManagingGroup(true)
            setShowMlsGroupModal(true)
          }}
          onLeaveGroup={() => {
            if (activeConversation?.id && confirm('Bạn có chắc chắn muốn rời khỏi nhóm này không?')) {
              handleLeaveGroup(activeConversation.id)
            }
          }}
        />
      )}

      {/* BẢO VỆ CHỐNG CHỤP MÀN HÌNH DRM (CHỐNG IN ẤN) */}
      <ChatDrmProtection isEnabled={true} showBadge={false} />

      {/* Hộp thoại Phiên bản & Nhật ký cập nhật Sen Chat */}
      <ChatVersionModal isOpen={showVersionModal} onClose={() => setShowVersionModal(false)} />

      {/* =======================================================================
          MODAL: THIẾT LẬP BẢO MẬT ANDROID CAPACITOR & FLAG_SECURE & APP LOCK
          ======================================================================= */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in">
          <div className="w-full max-h-[85vh] rounded-t-3xl bg-white dark:bg-slate-900 border-t border-black/10 dark:border-white/10 p-5 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-500" />
                <h3 className="text-sm font-black">Bảo Mật Android Capacitor</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 1. Android FLAG_SECURE */}
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black block">Android FLAG_SECURE</span>
                <span className="text-[10px] text-slate-400">
                  Chặn chụp màn hình & làm mờ preview khi mở đa nhiệm (Task Switcher)
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleFlagSecure}
                className={`min-h-[44px] min-w-[56px] px-3 rounded-xl text-xs font-black transition active:scale-95 ${
                  flagSecureActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/10 dark:bg-white/10 text-slate-400'
                }`}
              >
                {flagSecureActive ? 'BẬT' : 'TẮT'}
              </button>
            </div>

            {/* 2. Khóa ứng dụng bằng PIN & Sinh trắc học */}
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black block">Khóa PIN & Sinh Trắc Học</span>
                  <span className="text-[10px] text-slate-400">
                    {isAppLockConfigured() ? 'Đã cài đặt bảo vệ' : 'Chưa bật khóa ứng dụng'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSecurityModal(false)
                    setShowSetupPinModal(true)
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-black active:scale-95 transition"
                >
                  {isAppLockConfigured() ? 'Đổi PIN' : 'Cài Đặt'}
                </button>
              </div>
            </div>

            {/* 3. Trạng thái Android Keystore */}
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
              <span className="text-xs font-black block">Lưu Khóa Riêng E2EE</span>
              <p className="text-[10px] text-slate-400">
                Khóa danh tính Signal Protocol & prekeys được bảo vệ an toàn bằng{' '}
                <strong className="text-sky-500">Android Keystore</strong> qua plugin Capacitor native
                hoặc mã hóa cấp phần cứng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: CÀI ĐẶT MÃ PIN MỚI
          ======================================================================= */}
      {showSetupPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 p-5 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black">Thiết Lập Mã PIN Khóa App</h3>
              <p className="text-xs text-slate-400 mt-1">
                Nhập từ 4 đến 6 chữ số để bảo vệ ứng dụng
              </p>
            </div>

            <input
              type="password"
              maxLength={6}
              placeholder="Nhập 4-6 chữ số..."
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full h-11 text-center font-mono text-base tracking-widest rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 outline-none focus:border-sky-500"
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSetupPinModal(false)
                  setNewPin('')
                }}
                className="min-h-[44px] rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold active:scale-95 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNewPin}
                className="min-h-[44px] rounded-xl bg-sky-600 text-white text-xs font-black shadow-xs active:scale-95 transition"
              >
                Lưu PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KẾT BẠN MỚI */}
      {showFriendModal && (
        <ChatFriendModal
          isOpen={showFriendModal}
          onClose={() => setShowFriendModal(false)}
          currentUserId={currentUser?.id || ''}
          onSelectFriend={(friend) => {
            setShowFriendModal(false)
            const convId = 'direct_' + friend.id
            const existing = conversations.find((c) => c.partnerId === friend.id)
            if (existing) {
              handleSelectConversation(existing.id)
            } else {
              const newConv: SenChatConversation = {
                id: convId,
                partnerId: friend.id,
                partnerName: friend.name,
                partnerIdentifier: friend.identifier,
                lastMessage: 'Đã kết nối mã hóa E2EE',
                lastMessageTime: 'Vừa xong',
                unreadCount: 0,
                updatedAt: Date.now(),
                isGroup: false,
              }
              saveLocalConversation(newConv)
              setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
              handleSelectConversation(convId)
            }
          }}
        />
      )}

      {/* MODAL: TẠO / QUẢN LÝ NHÓM MLS */}
      {showMlsGroupModal && (
        <ChatMlsGroupModal
          isOpen={showMlsGroupModal}
          onClose={() => {
            setShowMlsGroupModal(false)
            setIsManagingGroup(false)
          }}
          conversationId={isManagingGroup ? activeConversation?.id : undefined}
          groupTitle={isManagingGroup ? activeConversation?.partnerName : ''}
          groupAvatar={isManagingGroup ? activeConversation?.avatarUrl || '' : ''}
          currentUserId={currentUser?.id || ''}
          currentUserEmail={currentUser?.email || ''}
          isCreatingNew={!isManagingGroup}
          onGroupCreated={(convId, title) => {
            setShowMlsGroupModal(false)
            setIsManagingGroup(false)
            const newConv: SenChatConversation = {
              id: convId,
              partnerId: convId,
              partnerName: title,
              partnerIdentifier: 'MLS_GROUP',
              lastMessage: 'Đã tạo nhóm trò chuyện MLS E2EE',
              lastMessageTime: 'Vừa xong',
              unreadCount: 0,
              updatedAt: Date.now(),
              isGroup: true,
            }
            saveLocalConversation(newConv)
            setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
            handleSelectConversation(convId)
          }}
          onGroupUpdated={() => {
            setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
          }}
          onGroupLeft={(leftConvId) => {
            setShowMlsGroupModal(false)
            setIsManagingGroup(false)
            setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
            if (selectedConvIdRef.current === leftConvId) {
              setView('list')
              setSelectedConvId(null)
            }
          }}
        />
      )}

      {/* MODAL: ĐÍNH KÈM TỆP QUA OPENSFEDOWNLOAD */}
      {selectedAttachmentFile && (
        <ChatAttachmentModal
          file={selectedAttachmentFile}
          conversationId={selectedConvId || ''}
          userPlanTier={userPlanTier}
          onClose={() => setSelectedAttachmentFile(null)}
          onSuccess={(attData) => {
            setSelectedAttachmentFile(null)
            if (!selectedConvId || !currentUser) return

            const timestamp = Date.now()
            const idempotencyKey = generateIdempotencyKey(currentUser.id, selectedConvId, timestamp, 'att')

            const msg: SenChatMessage = {
              id: idempotencyKey,
              conversationId: selectedConvId,
              senderId: currentUser.id,
              senderName: currentUser.name,
              receiverId: activeConversation?.partnerId || '',
              content: attData.fileName || '[Tệp đính kèm]',
              type: attData.fileType === 'image' ? 'image' : 'file',
              attachmentId: attData.id,
              driveFileId: attData.driveFileId,
              storageProvider: attData.storageProvider,
              storagePath: attData.storagePath,
              fileKeyBase64: attData.fileKeyBase64,
              attachmentName: attData.fileName,
              attachmentSize: attData.fileSize,
              mimeType: attData.mimeType,
              expiresAt: attData.expiresAt,
              isPinnedPermanent: false,
              createdAt: new Date(timestamp).toISOString(),
              status: 'sent',
            }

            saveLocalMessage(selectedConvId, msg)
            setMessages((prev) => [...prev, msg])
            setConversations(ensureSenAiStudioInConversations(getLocalConversations()))

            broadcastFileTransitReady({
              attachmentId: attData.id,
              fileId: attData.driveFileId,
              fileName: attData.fileName,
              fileSize: attData.fileSize,
              mimeType: attData.mimeType,
              fileMetadata: { conversationId: selectedConvId, fileKeyBase64: attData.fileKeyBase64 },
            })
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 50)
          }}
        />
      )}

      {/* MODAL: XÁC NHẬN BẢO MẬT KHI HỎI SENAI (@Sen) */}
      {showSenAiConfirmModal && (
        <ChatSenAiConfirmModal
          isOpen={showSenAiConfirmModal}
          query={pendingSenAiQuery}
          onClose={() => setShowSenAiConfirmModal(false)}
          onConfirm={handleConfirmSenAi}
        />
      )}

      {/* MODAL: MÃ AN TOÀN (SAFETY NUMBER) */}
      {showSafetyModal && (
        <ChatSafetyWidget
          isOpen={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          partnerId={activeConversation?.partnerId || ''}
          partnerName={activeConversation?.partnerName || ''}
          safetyNumber={safetyNumber}
        />
      )}

      {/* MODAL: TIN NHẮN TỰ HỦY */}
      {showDisappearingSettings && activeConversation && (
        <ChatDisappearingMessages
          isOpen={showDisappearingSettings}
          onClose={() => setShowDisappearingSettings(false)}
          conversationId={activeConversation.id}
          partnerName={activeConversation.partnerName}
          onDisappearingChange={() => {}}
        />
      )}

      {/* MODAL: CÀI ĐẶT SEN CHAT */}
      <ChatSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        userPlanTier={userPlanTier}
        deviceId={getOrCreateDeviceId()}
        isMobile={true}
        onOpenDeviceManager={() => setShowDeviceManagerModal(true)}
        onMessagesCleared={() => {
          setMessages([])
          setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
        }}
        onLoggedOut={() => {
          router.replace('/new-idp?returnUrl=/m/chat')
        }}
      />

      {/* HỘP THOẠI CHUÔNG CUỘC GỌI ĐẾN WEBRTC E2EE */}
      {incomingCall && (
        <ChatIncomingCallDialog
          payload={incomingCall}
          onAccept={() => handleAcceptIncomingCall(incomingCall)}
          onDecline={() => handleDeclineIncomingCall(incomingCall)}
        />
      )}

      {/* GIAO DIỆN CUỘC GỌI THOẠI & VIDEO WEBRTC E2EE */}
      {activeCallMode !== 'none' && currentUser && (activeConversation || incomingCall) && (
        <ChatCallModal
          callMode={activeCallMode}
          isIncoming={activeCallIsIncoming}
          initialCallId={activeCallId || undefined}
          conversationId={activeConversation?.id || incomingCall?.conversationId || selectedConvId || ''}
          partnerId={activeConversation?.partnerId || incomingCall?.callerId || selectedConvId || ''}
          partnerName={activeConversation?.partnerName || incomingCall?.callerName || 'Bạn bè'}
          partnerAvatar={activeConversation?.partnerAvatar || incomingCall?.callerAvatar}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserAvatar={currentUser.avatar}
          onClose={() => {
            setActiveCallMode('none')
            setActiveCallIsIncoming(false)
            setActiveCallId(null)
          }}
        />
      )}

      {/* MODAL: QUẢN LÝ THIẾT BỊ */}
      <ChatDeviceManagerModal
        isOpen={showDeviceManagerModal}
        onClose={() => setShowDeviceManagerModal(false)}
        currentDeviceId={getOrCreateDeviceId()}
      />

      {/* Custom Context Menu (Nhấn giữ iPhone/iPad & Chuột phải) */}
      <ChatContextMenu
        isOpen={contextMenu.isOpen}
        mode={contextMenu.mode}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        message={
          contextMenu.message
            ? {
                id: contextMenu.message.id,
                content: contextMenu.message.content,
                isMe: contextMenu.message.senderId === currentUser?.id,
                isSystem: contextMenu.message.type === 'system',
              }
            : null
        }
        onReply={() => {
          if (contextMenu.message) setReplyingToMessage(contextMenu.message)
        }}
        onCopy={() => {
          if (contextMenu.message?.content && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(contextMenu.message.content).catch(() => {})
          }
        }}
        onReact={(emoji) => {
          if (contextMenu.message) handleAddReaction(contextMenu.message.id, emoji)
        }}
        onRecall={() => {
          if (contextMenu.message) handleRecallMessage(contextMenu.message.id)
        }}
        conversation={
          contextMenu.conversation
            ? {
                id: contextMenu.conversation.id,
                partnerName: contextMenu.conversation.partnerName,
                isGroup: contextMenu.conversation.isGroup,
                isPinned: contextMenu.conversation.isPinned,
                unreadCount: contextMenu.conversation.unreadCount,
                isSenAiStudio: contextMenu.conversation.id === SENAI_STUDIO_CONVERSATION_ID,
              }
            : null
        }
        onTogglePin={() => {
          if (contextMenu.conversation) {
            setConversations(togglePinConversation(contextMenu.conversation.id))
          }
        }}
        onToggleUnread={() => {
          if (contextMenu.conversation) {
            const c = contextMenu.conversation
            if ((c.unreadCount || 0) > 0) {
              saveLocalConversation({ ...c, unreadCount: 0 })
              setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
            } else {
              setConversations(markConversationUnread(c.id, 1))
            }
          }
        }}
        onClearHistory={() => {
          if (contextMenu.conversation && confirm('Xóa toàn bộ lịch sử tin nhắn trên thiết bị này?')) {
            clearAllLocalMessages(contextMenu.conversation.id)
            if (selectedConvId === contextMenu.conversation.id) {
              setMessages([])
            }
            setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
          }
        }}
        onLeaveGroup={() => {
          if (contextMenu.conversation?.id && confirm('Bạn có chắc chắn muốn rời khỏi nhóm này?')) {
            handleLeaveGroup(contextMenu.conversation.id)
          }
        }}
      />
    </div>
  )
}
