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
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ChatSafetyWidget from '@/components/chat/ChatSafetyWidget'
import ChatDisappearingMessages from '@/components/chat/ChatDisappearingMessages'
import ChatInfoDrawer from '@/components/chat/ChatInfoDrawer'
import ChatDrmProtection from '@/components/chat/ChatDrmProtection'
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
} from '@/lib/senChatStorage'
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
  const [messages, setMessages] = useState<SenChatMessage[]>([])
  const [currentUser, setCurrentUser] = useState<SenChatUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [offlinePendingCount, setOfflinePendingCount] = useState(0)

  // Khung tìm kiếm & Lọc cuộc trò chuyện
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'direct' | 'group'>('all')

  // Ô nhập tin nhắn
  const [inputText, setInputText] = useState('')
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
        callerId: call.callerId,
        receiverId: currentUser?.id,
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
      let list = getLocalConversations()
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
          setConversations(getLocalConversations())
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
        setConversations(getLocalConversations())
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
    const msgs = getLocalMessages(convId)
    setMessages(msgs)
    setView('conversation')

    // Reset unread count
    const list = getLocalConversations()
    const conv = list.find((c) => c.id === convId)
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0
      saveLocalConversation(conv)
      setConversations(list)
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
      }

      // 1. Lưu cục bộ ngay tức thì
      saveLocalMessage(selectedConvId, newMessage)
      setMessages((prev) => [...prev, newMessage])
      setInputText('')
      setShowEmojiPicker(false)
      setShowAiSuggestions(false)

      // Cập nhật danh sách hội thoại
      setConversations(getLocalConversations())

      // 2. Nếu mất mạng: Đẩy vào Hàng Đợi Ngoại Tuyến với Idempotency Key
      if (!isOnline) {
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
    [inputText, selectedConvId, currentUser, activeConversation, isOnline]
  )

  // Nhập tin nhắn & bắt trigger @Sen
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)

    if (val.includes('@')) {
      const suggestions = getSenAiAutocompleteSuggestions(val)
      setAiSuggestions(suggestions)
      setShowAiSuggestions(suggestions.length > 0)
    } else {
      setShowAiSuggestions(false)
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
    setConversations(getLocalConversations())
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
    setConversations(getLocalConversations())
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
      setConversations(getLocalConversations())
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

  // Lọc cuộc trò chuyện theo tab
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchQuery =
        !searchQuery.trim() ||
        c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchTab =
        activeFilterTab === 'all'
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
              <SenChatLogo size={36} className="shrink-0" />
              <div>
                <h1 className="text-base font-black flex items-center gap-1.5">
                  <span>Sen Chat</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[9px] font-black tracking-wider uppercase">
                    E2EE
                  </span>
                </h1>
                <span className="text-[10px] text-slate-400 font-medium">
                  {flagSecureActive ? '🛡️ FLAG_SECURE Đang bật' : 'Mã hóa đầu cuối'}
                </span>
              </div>
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
              onClick={() => setShowMlsGroupModal(true)}
              className="ml-auto min-h-[44px] px-3 rounded-xl border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Tạo Nhóm</span>
            </button>
          </div>

          {/* Danh Sách Hội Thoại */}
          <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 px-2 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
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
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className="min-h-[64px] p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition"
                >
                  <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {conv.partnerName.slice(0, 1).toUpperCase()}
                    {conv.isGroup && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[9px] text-white flex items-center justify-center">
                        👥
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {conv.partnerName}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {conv.lastMessageTime || ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.lastMessage || 'Chưa có tin nhắn'}
                    </p>
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 2: KHUNG CHAT CHI TIẾT (CONVERSATION DETAIL)
          ======================================================================= */}
      {view === 'conversation' && activeConversation && (
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
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 active:scale-95 transition"
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 active:scale-95 transition"
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

          {/* Danh Sách Tin Nhắn */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 transition-all rounded-2xl`}
                >
                  {!isMe && (
                    <span className="text-[10px] text-slate-400 font-bold pl-1">
                      {msg.senderName}
                    </span>
                  )}

                  <div
                    className={`max-w-[85%] rounded-3xl p-3 text-xs shadow-xs leading-relaxed ${
                      isMe
                        ? 'bg-sky-600 text-white rounded-br-xs'
                        : msg.isSenAi
                        ? 'bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-indigo-500/10 text-slate-900 dark:text-white border border-pink-500/20 rounded-bl-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-black/5 dark:border-white/5 rounded-bl-xs'
                    }`}
                  >
                    {msg.isSenAi && (
                      <div className="mb-1.5 flex items-center gap-1.5 px-2 py-0.5 w-fit rounded-lg bg-gradient-to-r from-purple-500/15 to-indigo-500/15 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                        <img src="/senai-logo.png" alt="SenAI" className="h-3 w-3 object-contain" />
                        <span>SenAI</span>
                      </div>
                    )}
                    {/* Thẻ đính kèm tệp / ảnh */}
                    {msg.type === 'file' || msg.type === 'image' ? (
                      <ChatAttachmentBubble
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 active:scale-95 transition"
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
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
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
                el.classList.add('ring-2', 'ring-emerald-500')
                setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 2000)
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
          onOpenManageGroup={() => setShowCreateGroupModal(true)}
          onLeaveGroup={() => {
            if (confirm('Bạn có chắc chắn muốn rời khỏi nhóm này không?')) {
              setView('list')
              setSelectedConvId(null)
            }
          }}
        />
      )}

      {/* BẢO VỆ CHỐNG CHỤP MÀN HÌNH DRM KIỂU NETFLIX (BLACKOUT CURTAIN) */}
      <ChatDrmProtection isEnabled={true} showBadge={false} />

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
                    ? 'bg-emerald-600 text-white shadow-xs'
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
              setConversations(getLocalConversations())
              handleSelectConversation(convId)
            }
          }}
        />
      )}

      {/* MODAL: TẠO NHÓM MLS */}
      {showMlsGroupModal && (
        <ChatMlsGroupModal
          isOpen={showMlsGroupModal}
          onClose={() => setShowMlsGroupModal(false)}
          currentUserId={currentUser?.id || ''}
          currentUserName={currentUser?.name || ''}
          userPlanTier={null}
          onCreateGroup={(group) => {
            setShowMlsGroupModal(false)
            const newConv: SenChatConversation = {
              id: group.id,
              partnerId: group.id,
              partnerName: group.name,
              partnerIdentifier: `Nhóm MLS (${group.members?.length || 1} thành viên)`,
              lastMessage: 'Đã tạo nhóm trò chuyện MLS E2EE',
              lastMessageTime: 'Vừa xong',
              unreadCount: 0,
              updatedAt: Date.now(),
              isGroup: true,
            }
            saveLocalConversation(newConv)
            setConversations(getLocalConversations())
            handleSelectConversation(group.id)
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
            setConversations(getLocalConversations())
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
          setConversations(getLocalConversations())
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
    </div>
  )
}
