'use client'

import { bindSenChatAccount, getSenChatAccount, senChatAccountKey } from '@/lib/senChatAccount.mjs'

import { senChatLoginReturnUrl, useSenChatConversationLink } from '@/lib/senChatConversationLink'

import React, { Suspense, useDeferredValue, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Users,
  Search,
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
  Plus,
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
import { ChatGroupInviteJoin } from '@/components/chat/ChatGroupInvites'
import ChatDrmProtection, { ChatDeviceComplianceBadge } from '@/components/chat/ChatDrmProtection'
import ChatVersionModal from '@/components/chat/ChatVersionModal'
import ChatDeviceManagerModal from '@/components/chat/ChatDeviceManagerModal'
import ChatSettingsModal from '@/components/chat/ChatSettingsModal'
import ChatReactionChips from '@/components/chat/ChatReactionChips'
import ChatFriendModal from '@/components/chat/ChatFriendModal'
import ChatMobileFriends, { type ChatFriendProfile } from '@/components/chat/ChatMobileFriends'
import ChatMlsGroupModal from '@/components/chat/ChatMlsGroupModal'
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal'
import ChatAttachmentBubble from '@/components/chat/ChatAttachmentBubble'
import { ConversationMuteButton } from '@/components/chat/ChatNotificationControls'
import { changeChatReaction, chatConversationKey, deliverLocalMessage, getChatConversation, sendInboxMessage, startChatCall } from '@/lib/senChatInbox'
import { chatRequest } from '@/lib/senChatBrowser'
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
  restoreLegacySenChatHistory,
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
  togglePinConversation,
  markConversationUnread,
  getConversationDraft,
  saveConversationDraft,
  clearConversationDraft,
} from '@/lib/senChatStorage'
import ChatSenAiStudioView from '@/components/chat/ChatSenAiStudioView'
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

class MobileChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Lỗi hiển thị Sen Chat Mobile' }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-4 shadow-lg">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold mb-1">Sen Chat đang khôi phục kết nối</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">{this.state.errorMsg}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-bold shadow-sm"
          >
            Tải lại Sen Chat
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function MobileChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Điều hướng 3 trạng thái view di động: 'list' <-> 'conversation' <-> 'room-info'
  const [view, setView] = useState<'list' | 'conversation' | 'room-info' | 'friends'>('list')
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

  // Các Modal hỗ trợ
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [chatDark, setChatDark] = useState(false)
  useEffect(() => {
    if (showSettingsModal) setChatDark(document.documentElement.classList.contains('dark'))
  }, [showSettingsModal])
  const toggleChatTheme = () => {
    const dark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    setChatDark(dark)
  }
  const [showDeviceManagerModal, setShowDeviceManagerModal] = useState(false)
  const [userPlanTier, setUserPlanTier] = useState<string | null>(null)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [showMlsGroupModal, setShowMlsGroupModal] = useState(false)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [showSenAiConfirmModal, setShowSenAiConfirmModal] = useState(false)
  const [pendingSenAiQuery, setPendingSenAiQuery] = useState<string>('')
  const [disappearingTtl, setDisappearingTtl] = useState(0)
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

  useEffect(() => {
    if (!currentUser?.id) return
    const refresh = () => {
      setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
      const activeId = selectedConvIdRef.current
      if (activeId) syncMessagesStateIfChanged(activeId, getLocalMessages(activeId))
    }
    window.addEventListener('sen-chat-update', refresh)
    window.addEventListener('storage', refresh)
    refresh()
    return () => {
      window.removeEventListener('sen-chat-update', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [currentUser?.id, syncMessagesStateIfChanged])

  useEffect(() => {
    const conversationId = !isLocked && view === 'conversation' ? selectedConvId : null
    if (conversationId) {
      const conversation = getChatConversation(conversationId)
      if (conversation && conversation.unreadCount > 0) {
        const next = { ...conversation, unreadCount: 0 }
        saveLocalConversation(next)
        window.dispatchEvent(new CustomEvent('sen-chat-update', { detail: conversationId }))
      }
    }
    window.dispatchEvent(new CustomEvent('sen-chat-view', { detail: conversationId }))
    return () => { window.dispatchEvent(new CustomEvent('sen-chat-view', { detail: null })) }
  }, [selectedConvId, isLocked, view])

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
      if (view === 'conversation' || view === 'friends') {
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
      let resolvedAuthUserId: string | null = null
      try {
        let authUser: any = null
        const { data: userData } = await supabase.auth.getUser()
        authUser = userData?.user || null
        if (!authUser) {
          const { data: sessData } = await supabase.auth.getSession()
          authUser = sessData?.session?.user || null
        }

        if (authUser) {
          if (stopped || !bindSenChatAccount(authUser.id)) return
          resolvedAuthUserId = authUser.id
          let profile: any = null
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email, phone_number, phone, avatar_url, school, class_name, grade, role, allow_search_by_email, read_receipts_enabled, plan_tier, vip_expires_at')
              .eq('id', authUser.id)
              .maybeSingle()
            profile = profileData
          } catch {}

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
          if (stopped || getSenChatAccount() !== synchedUser.id) return
          restoreLegacySenChatHistory(synchedUser.id)
          saveLocalSenChatUser(synchedUser)
          setCurrentUser(synchedUser)

          // Đảm bảo cặp khóa E2EE được bảo vệ an toàn trong Keystore (không crash trên iOS Private Mode)
          try {
            const existingKey = await retrieveIdentityPrivateKey('identity_e2ee:' + authUser.id, window)
            if (!existingKey) {
              const pair = generateIdentityKeyPair()
              await storeIdentityPrivateKey('identity_e2ee:' + authUser.id, pair.privateKey, window)
            }
          } catch (ksErr) {
            console.warn('Cảnh báo Keystore trên trình duyệt di động:', ksErr)
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
                if (stopped || getSenChatAccount() !== synchedUser.id) return
                setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
              })
              .catch(() => {})
          }
        } else {
          // Chưa đăng nhập -> Tự động chuyển hướng sang Sen IDP
          router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
          return
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ danh tính người dùng:', err)
        if (!stopped) router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
        return
      }

      if (stopped || getSenChatAccount() !== resolvedAuthUserId) return

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
          receiverId: resolvedAuthUserId || 'local_user',
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
            const conversation = getChatConversation(queued.conversationId)
            if (!conversation) return { success: false, error: 'Không tìm thấy hội thoại' }
            try {
              await deliverLocalMessage(sentMsg, conversation)
              return { success: true }
            } catch { return { success: false, error: 'Chưa gửi được tin nhắn' } }
          })
          setOfflinePendingCount(globalOfflineChatQueue.getPendingCount())
          setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
        } catch {}
      }
      setIsLoading(false)
    }

    initMobileChat()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && !session) return
      if (!bindSenChatAccount(session?.user.id) || event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null)
        if (session) return
        router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
      }
    })

    return () => {
      stopped = true
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

  const handledConversationQuery = useRef<string | null>(null)
  useEffect(() => {
    const target = searchParams.get('conversation')
    const match = target ? getChatConversation(target) : null
    if (target && match && !isLocked && handledConversationQuery.current !== target) {
      handledConversationQuery.current = target
      handleSelectConversation(match.id)
    }
  }, [searchParams, conversations, isLocked, handleSelectConversation])

  // Cuộc hội thoại đang chọn
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || null
  }, [conversations, selectedConvId])

  // Nền phòng chat
  useSenChatConversationLink(
    isLocked ? undefined : currentUser?.id,
    conversations,
    view === 'conversation' || view === 'room-info' ? activeConversation : null,
    handleSelectConversation,
  )

  const activeWallpaperId = useMemo(() => {
    return selectedConvId ? getWallpaperFor(selectedConvId) : 'default'
  }, [selectedConvId])

  const activeWallpaper = useMemo(() => {
    return CHAT_WALLPAPERS.find((w) => w.id === activeWallpaperId) || CHAT_WALLPAPERS[0]
  }, [activeWallpaperId])

  // Gửi tin nhắn (Hỗ trợ cả chế độ ngoại tuyến qua hàng đợi)
  const handleSendMessage = useCallback(
    (textToSend?: string, skipSenAiCheck = false) => {
      const text = (textToSend !== undefined ? textToSend : inputText).trim()
      if (!text || !selectedConvId || !currentUser || !activeConversation || isUserBlocked(activeConversation.partnerId)) return

      // Kiểm tra gọi @Sen trợ lý
      if (!skipSenAiCheck && hasSenAiMention(text)) {
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
        status: 'sending',
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

      if (isOnline) void deliverLocalMessage(newMessage, activeConversation).catch(() => {})

      // Cuộn xuống
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    },
    [inputText, selectedConvId, currentUser, activeConversation, isOnline, replyingToMessage]
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
  const handleAddReaction = (msgId: string, emoji: string, remove = false) => {
    if (!selectedConvId || !currentUser?.id) return
    const conversation = conversations.find(({ id }) => id === selectedConvId)
    if (!conversation) return
    const result = changeChatReaction(conversation, msgId, emoji, currentUser.id, remove)
    if (!result) return
    setMessages(result.messages)
    void result.delivery.catch(() => alert('Chưa đồng bộ được cảm xúc. Hãy thử lại khi kết nối ổn định.'))
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
    if (!selectedConvId || !currentUser || !activeConversation || isUserBlocked(activeConversation.partnerId)) return
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
      status: 'sending',
    }

    saveLocalMessage(selectedConvId, likeMsg)
    if (isOnline) void deliverLocalMessage(likeMsg, activeConversation).catch(() => {})
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
    if (!selectedConvId || !currentUser || !activeConversation || isUserBlocked(activeConversation.partnerId)) return

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
      status: 'sending',
    }

    saveLocalMessage(selectedConvId, newMsg)
    if (isOnline) void deliverLocalMessage(newMsg, activeConversation).catch(() => {})
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
  const handleConfirmSenAi = async ({ query, contextMessages }: { query: string; contextMessages: SenChatMessage[] }) => {
    setShowSenAiConfirmModal(false)
    if (!selectedConvId || !currentUser || !activeConversation) return

    // Gửi tin nhắn của người dùng
    handleSendMessage(`@Sen ${query}`, true)

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
      const data = await chatRequest<{ reply?: string; text?: string }>('senai', {
        query,
        userConfirmed: true,
        isGroup: !!activeConversation.isGroup,
        contextMessages: contextMessages.map(({ senderName, content, isSenAi }) => ({ senderName, content, isSenAi })),
      })
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
      if (activeConversation.isGroup && isOnline) {
        void sendInboxMessage({ ...finalAiMsg, senderId: currentUser.id }, activeConversation).catch(() => {})
      }
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
        window.dispatchEvent(new Event('sen-chat-refresh-calls'))
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
        window.dispatchEvent(new Event('sen-chat-refresh-calls'))
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
  const [friends, setFriends] = useState<ChatFriendProfile[]>([])
  const [incomingFriends, setIncomingFriends] = useState(0)
  useEffect(() => {
    if (!currentUser?.id || showFriendModal || view !== 'list') return
    let active = true
    void chatRequest<{ friends: ChatFriendProfile[]; incoming: ChatFriendProfile[] }>('friend-invitation', undefined, 'GET', currentUser.id).then((data) => {
      if (active) {
        setFriends(data.friends || [])
        setIncomingFriends(data.incoming?.length || 0)
      }
    }).catch(() => {})
    return () => { active = false }
  }, [currentUser?.id, showFriendModal, view])

  const openFriendConversation = (friend: { id: string; name: string; avatar?: string; identifier?: string }) => {
    setShowFriendModal(false)
    const existing = conversations.find((conversation) => !conversation.isGroup && conversation.partnerId === friend.id)
    if (existing) { handleSelectConversation(existing.id); return }
    saveLocalConversation({
      id: friend.id, partnerId: friend.id, partnerName: friend.name, partnerAvatar: friend.avatar,
      partnerIdentifier: friend.identifier || friend.id, unreadCount: 0, updatedAt: Date.now(),
    })
    setConversations(ensureSenAiStudioInConversations(getLocalConversations()))
    handleSelectConversation(friend.id)
  }

  const deferredSearch = useDeferredValue(searchQuery).trim().toLocaleLowerCase('vi')
  const friendsWithoutHistory = useMemo(() => {
    const recent = new Set(conversations.filter((c) => !c.isGroup && (c.lastMessage || c.lastMessageTime)).map((c) => c.partnerId))
    return friends.filter((friend) => !recent.has(friend.id))
  }, [friends, conversations])
  const friendIdsWithoutHistory = new Set(friendsWithoutHistory.map((friend) => friend.id))
  const visibleFriends = activeFilterTab === 'group' ? [] : friendsWithoutHistory.filter(
    (friend) => friend.name.toLocaleLowerCase('vi').includes(deferredSearch),
  )

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (c.id === SENAI_STUDIO_CONVERSATION_ID && !deferredSearch) return true
      if (!c.isGroup && friendIdsWithoutHistory.has(c.partnerId)) return false
      const matchQuery =
        !deferredSearch ||
        c.partnerName.toLowerCase().includes(deferredSearch) ||
        c.lastMessage?.toLowerCase().includes(deferredSearch)
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
  }, [conversations, deferredSearch, activeFilterTab, friendsWithoutHistory])

  // ============================================================================
  // MÀN HÌNH KHÓA BẢO MẬT (PIN & BIOMETRIC APP LOCK OVERLAY)
  // ============================================================================
  if (!currentUser || getSenChatAccount() !== currentUser.id) {
    return <div className="grid min-h-[50dvh] flex-1 place-items-center p-6 text-center">
      <div><p role="status">Đang kết nối Sen Chat…</p><button type="button" className="mt-3 text-sm font-semibold text-sky-700 underline" onClick={() => window.location.reload()}>Tải lại Sen Chat</button></div>
    </div>
  }

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
      <ChatGroupInviteJoin />
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
      {view === 'friends' && (
        <ChatMobileFriends key={currentUser.id} userId={currentUser.id} lookupOpen={showFriendModal}
          onBack={() => setView('list')} onFind={() => setShowFriendModal(true)} onMessage={openFriendConversation} />
      )}

      {view === 'list' && (
        <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
          {/* Header Bar */}
          <header className="p-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-1 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-1.5">
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
                className="flex min-w-0 items-center gap-1.5 text-left active:scale-95 transition"
              >
                <SenChatLogo size={30} className="hidden shrink-0 min-[370px]:block" />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-black">Sen Chat</h1>
                  <span className="hidden min-[420px]:block"><ChatDeviceComplianceBadge /></span>
                </div>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1">
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
                onClick={() => setView('friends')}
                className="relative flex min-h-11 min-w-11 items-center justify-center rounded-2xl bg-sky-700 text-white transition active:scale-95"
                aria-label={incomingFriends ? 'Bạn bè, ' + incomingFriends + ' lời mời đến' : 'Bạn bè'}
              >
                <Users className="h-5 w-5" />
                {incomingFriends > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold">{Math.min(incomingFriends, 99)}</span>}
              </button>
              <button type="button" aria-label="Tạo nhóm" onClick={() => setShowMlsGroupModal(true)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                <Users className="h-4 w-4" /><Plus className="h-3 w-3" />
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
              onClick={() => setActiveFilterTab('group')}
              className="ml-auto min-h-[44px] px-3 rounded-xl border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Quản lý nhóm</span>
            </button>
          </div>

          {/* Danh Sách Hội Thoại */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain transform-gpu divide-y divide-black/5 dark:divide-white/5 px-2 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filteredConversations.length === 0 && visibleFriends.length > 0 ? null : filteredConversations.length === 0 ? (
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
            {visibleFriends.length > 0 && <section aria-label="Bạn bè" className="space-y-1 py-3">
              <h2 className="px-3 text-xs font-bold text-slate-500">Bạn bè</h2>
              {visibleFriends.map((friend) => <div key={friend.id} className="flex items-center gap-3 px-3 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-800">{friend.name[0]}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{friend.name}</span>
                <button type="button" onClick={() => openFriendConversation(friend)} className="rounded-full bg-sky-100 px-3 py-2 text-xs font-bold text-sky-800">Nhắn tin</button>
              </div>)}
            </section>}
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
                    <span>Mã hóa đầu cuối</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <ConversationMuteButton key={activeConversation.id} conversation={chatConversationKey(activeConversation)} />
              <button
                type="button"
                onClick={() => startChatCall(activeConversation, 'voice')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 hover:text-blue-600 active:scale-95 transition"
                aria-label="Gọi thoại mã hóa"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => startChatCall(activeConversation, 'video')}
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
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3"
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
                    {msg.missedCall && <button type="button" className="ml-1 font-semibold text-sky-700 underline dark:text-sky-300" onClick={() => startChatCall(activeConversation, msg.missedCall!)}>Gọi lại</button>}
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
                      <ChatReactionChips reactions={msg.reactions} userId={currentUser.id}
                        onChange={(emoji, remove) => handleAddReaction(msg.id, emoji, remove)} />
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
                        {msg.status === 'waiting_for_device' ? (
                                      <span>Chờ người nhận mở Sen Chat</span>
                                    ) : msg.status === 'failed' ? (
                                      <button type="button" className="font-semibold underline" title="Gửi thất bại" onClick={() => { if (activeConversation) void deliverLocalMessage(msg, activeConversation).catch(() => {}) }}>Thử lại</button>
                                    ) : msg.status === 'sending' ? (
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
                paddingBottom: '0.5rem',
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
          renderGroupManagement={activeConversation.isGroup ? (section) => (
            <ChatMlsGroupModal key={activeConversation.id + section} embedded section={section} isOpen
              onClose={() => setView('list')} conversationId={activeConversation.id}
              groupTitle={activeConversation.partnerName} groupAvatar={activeConversation.avatarUrl}
              currentUserId={currentUser?.id || ''} currentUserEmail={currentUser?.email || ''}
              onGroupUpdated={() => setConversations(ensureSenAiStudioInConversations(getLocalConversations()))}
              onGroupLeft={() => { setView('list'); setSelectedConvId(null); setConversations(ensureSenAiStudioInConversations(getLocalConversations())) }}
            />
          ) : undefined}
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
              const key = senChatAccountKey(`senchat_verified_${activeConversation.partnerId}`)
              if (key) localStorage.setItem(key, String(verified))
            }
          }}
          disappearingTtl={disappearingTtl}
          onChangeDisappearingTtl={(ttl) => setDisappearingTtl(ttl)}
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
          onSelectFriend={openFriendConversation}
        />
      )}

      {/* MODAL: TẠO / QUẢN LÝ NHÓM MLS */}
      {showMlsGroupModal && (
        <ChatMlsGroupModal
          isOpen={showMlsGroupModal}
          onClose={() => {
            setShowMlsGroupModal(false)
          }}
          currentUserId={currentUser?.id || ''}
          currentUserEmail={currentUser?.email || ''}
          userPlanTier={userPlanTier}
          isCreatingNew
          onGroupCreated={(convId, title, avatar) => {
            setShowMlsGroupModal(false)
            const newConv: SenChatConversation = {
              id: convId,
              partnerId: convId,
              partnerName: title,
              avatarUrl: avatar,
              partnerAvatar: avatar,
              role: 'owner',
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
          initialQuery={pendingSenAiQuery}
          recentMessages={messages}
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
        darkTheme={chatDark}
        onToggleTheme={toggleChatTheme}
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
          router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
        }}
      />

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

export default function MobileChatPage() {
  return (
    <MobileChatErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-blue-600 dark:text-sky-400 text-xs font-semibold">
            Đang tải Sen Chat Mobile...
          </div>
        }
      >
        <MobileChatPageInner />
      </Suspense>
    </MobileChatErrorBoundary>
  )
}
