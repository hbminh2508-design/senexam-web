'use client'

import { bindSenChatAccount, getSenChatAccount, senChatAccountKey } from '@/lib/senChatAccount.mjs'

import { senChatLoginReturnUrl, useSenChatConversationLink } from '@/lib/senChatConversationLink'

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  ThumbsUp,
  MoreVertical,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Phone,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  ShieldCheck,
  CheckCheck,
  Check,
  Clock,
  Smartphone,
  Mail,
  LogOut,
  ChevronLeft,
  Info,
  Lock,
  Sparkles,
  UserCheck,
  X,
  Palette,
  Ban,
  Unlock,
  Edit3,
  Maximize2,
  Minimize2,
  ExternalLink,
  Reply,
  CornerDownRight,
  ShieldAlert,
  Timer,
  AlertTriangle,
  Settings,
  UserPlus,
  Pin,
  PinOff,
  CircleDot,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import SenChatLogo from '@/components/SenChatLogo'
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
import ChatMlsGroupModal from '@/components/chat/ChatMlsGroupModal'
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal'
import ChatAttachmentBubble from '@/components/chat/ChatAttachmentBubble'
import { ConversationMuteButton } from '@/components/chat/ChatNotificationControls'
import { changeChatReaction, chatConversationKey, deliverLocalMessage, getChatConversation, sendInboxMessage, startChatCall } from '@/lib/senChatInbox'
import ChatVoiceRecorder from '@/components/chat/ChatVoiceRecorder'
import ChatVoiceMessageBubble from '@/components/chat/ChatVoiceMessageBubble'
import ChatSenAiConfirmModal from '@/components/chat/ChatSenAiConfirmModal'
import ChatMessageContent from '@/components/chat/ChatMessageContent'
import ChatSenAiStudioView from '@/components/chat/ChatSenAiStudioView'
import ChatContextMenu from '@/components/chat/ChatContextMenu'
import {
  hasSenAiMention,
  extractSenAiQuery,
  getSenAiAutocompleteSuggestions,
  formatSenAiGroupNotice,
} from '@/lib/senChatAi'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import { parseMessageLinks } from '@/lib/chatSanitizer'
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
import {
  calculateSafetyNumber,
  verifyIdentityKeyIntegrity,
  generateIdentityKeyPair,
} from '@/lib/senChatSignalProtocol.mjs'
import {
  initDeviceRelay,
  broadcastRequestMessageSync,
  broadcastFileTransitReady,
  broadcastConversationRemoved,
  triggerFullDeviceSync,
  reconcileConversations,
} from '@/lib/senChatDeviceRelay'
import { SEN_CHAT_CURRENT_VERSION } from '@/lib/senChatVersion'

// Bộ sticker / biểu cảm nhanh
const QUICK_EMOJIS = ['😀', '😂', '😍', '👍', '❤️', '🎉', '🔥', '👏', '🙏', '😭', '😎', '💯']

export default function SenChatPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<SenChatUser | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [activeRailTab, setActiveRailTab] = useState<'messages' | 'contacts' | 'wallpapers'>('messages')
  const [friendsList, setFriendsList] = useState<any[]>([])
  const [incomingInvites, setIncomingInvites] = useState<any[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [friendSubTab, setFriendSubTab] = useState<'all' | 'requests'>('all')

  // Cuộc hội thoại và tin nhắn
  const [conversations, setConversations] = useState<SenChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const selectedConvIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedConvIdRef.current = selectedConvId
  }, [selectedConvId])
  const [messages, setMessages] = useState<SenChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'groups'>('all')

  // Gói dịch vụ & Đính kèm tệp / Tin nhắn thoại (P5)
  const [userPlanTier, setUserPlanTier] = useState<string | null>(null)
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)

  // Quoting & Reactions
  const [replyingToMessage, setReplyingToMessage] = useState<SenChatMessage | null>(null)

  // Disappearing messages & Settings
  const [disappearingTtl, setDisappearingTtl] = useState(0) // seconds (0 = off)
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true)

  // State các tính năng nâng cao
  const [currentNickname, setCurrentNickname] = useState<string | null>(null)
  const [isCurrentBlocked, setIsCurrentBlocked] = useState(false)
  const [currentWallpaper, setCurrentWallpaper] = useState<ChatWallpaperId>('default')
  const [safetyNumberData, setSafetyNumberData] = useState<any>(null)
  const [keyChangedAlert, setKeyChangedAlert] = useState(false)
  const [isPartnerVerified, setIsPartnerVerified] = useState(false)

  // Modals & Panels
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [showInfoSidebar, setShowInfoSidebar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showDeviceManagerModal, setShowDeviceManagerModal] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [newNicknameInput, setNewNicknameInput] = useState('')
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)

  // 🤖 SenAI trong Chat (P6)
  const [showSenAiConfirmModal, setShowSenAiConfirmModal] = useState(false)
  const [pendingSenAiQuery, setPendingSenAiQuery] = useState('')
  const [isSenAiCalling, setIsSenAiCalling] = useState(false)
  const [senAiSuggestions, setSenAiSuggestions] = useState<any[]>([])
  const [showSenAiAutocomplete, setShowSenAiAutocomplete] = useState(false)

  // Offline send queue

  // 📞 WebRTC E2EE Calls

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
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
        setSelectedConvId(SENAI_STUDIO_CONVERSATION_ID)
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

  // 🚪 Rời khỏi nhóm MLS chuẩn xác (Desktop)
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
        setSelectedConvId(SENAI_STUDIO_CONVERSATION_ID)
      }
    },
    [currentUser?.id]
  )

  // 1. Khởi tạo & Kiểm tra Dark Mode / Theme / Online Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    // Load theme preference
    const savedTheme = localStorage.getItem('sen_chat_theme')
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('sen_chat_theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('sen_chat_theme', 'light')
      }
      return next
    })
  }

  const fetchFriendsList = async () => {
    try {
      setLoadingFriends(true)
      let session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        const { data: refData } = await supabase.auth.refreshSession()
        session = refData?.session
      }
      const token = session?.access_token
      if (!token) return

      const res = await fetch('/api/chat/friend-invitation', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data?.friends) setFriendsList(data.friends)
      if (data?.incoming) setIncomingInvites(data.incoming)
    } catch (err) {
      console.warn('Lỗi tải danh sách bạn bè:', err)
    } finally {
      setLoadingFriends(false)
    }
  }

  const handleRespondFriend = async (senderId: string, action: 'accept' | 'reject') => {
    try {
      let session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        const { data: refData } = await supabase.auth.refreshSession()
        session = refData?.session
      }
      const token = session?.access_token
      if (!token) return

      const res = await fetch('/api/chat/friend-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, targetUserId: senderId }),
      })
      const data = await res.json()
      if (data?.success) {
        fetchFriendsList()
        refreshConversations()
      }
    } catch (err) {
      console.warn('Lỗi phản hồi lời mời bạn bè:', err)
    }
  }

  // 2. Đồng bộ tài khoản SenExam chính thức từ Supabase & Bắt buộc Đăng nhập
  useEffect(() => {
    // Đăng ký bộ dọn dẹp tin nhắn tạm thời cục bộ khi đóng tab / thoát trang
    const cleanupEphemeral = setupEphemeralCleanupListener()

    let stopped = false
    const initAuthAndSync = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (auth?.user) {
          if (stopped || !bindSenChatAccount(auth.user.id)) return
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone_number, phone, avatar_url, school, class_name, grade, role, allow_search_by_email, read_receipts_enabled, plan_tier, vip_expires_at')
            .eq('id', auth.user.id)
            .maybeSingle()

          if (profile) {
            setUserPlanTier(getEffectivePlanTier(profile))
          }

          const synchedUser: SenChatUser = {
            id: auth.user.id,
            name: profile?.full_name || auth.user.user_metadata?.full_name || 'Học viên SenExam',
            identifier: auth.user.email || profile?.phone_number || profile?.phone || auth.user.id,
            authType: 'senexam',
            avatar: profile?.avatar_url || '',
            email: auth.user.email || '',
            phone: profile?.phone_number || profile?.phone || '',
            school: profile?.school || '',
            className: profile?.class_name || profile?.grade || '',
            createdAt: new Date().toISOString(),
          }

          if (stopped || getSenChatAccount() !== synchedUser.id) return
          restoreLegacySenChatHistory(synchedUser.id)
          saveLocalSenChatUser(synchedUser)
          setCurrentUser(synchedUser)
          if (profile?.read_receipts_enabled !== undefined) {
            setReadReceiptsEnabled(profile.read_receipts_enabled)
          }

          // Tự động đăng ký thiết bị hiện tại lên chat_devices và ghi nhận nhật ký kiểm toán
          let session = (await supabase.auth.getSession()).data.session
          if (!session?.access_token) {
            const { data: refData } = await supabase.auth.refreshSession()
            session = refData?.session
          }
          const token = session?.access_token
          if (token) {
            fetch('/api/chat/device-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'register', deviceId }),
            }).catch((devErr) => console.warn('Lỗi tự động đăng ký thiết bị Sen Chat:', devErr))

            // Tải danh sách bạn bè ban đầu
            fetchFriendsList()

            // Tự động đồng bộ nhóm & tin nhắn đa thiết bị ngay khi mở app
            triggerFullDeviceSync(auth.user.id, deviceId, {
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
          // Chưa đăng nhập -> Tự động chuyển hướng sang Sen IDP với returnUrl=/chat
          router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
          return
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ hồ sơ SenExam:', err)
        router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
        return
      } finally {
        setIsInitializing(false)
      }
    }

    initAuthAndSync()

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

  // 3. Tải danh sách hội thoại (Luôn ghim SenAI Studio ở vị trí đầu tiên)
  const refreshConversations = () => {
    const rawList = getLocalConversations()
    const list = ensureSenAiStudioInConversations(rawList)
    setConversations(list)
    if (!selectedConvId && list.length > 0) {
      setSelectedConvId(list[0].id)
    }
  }

  useEffect(() => {
    if (currentUser) {
      refreshConversations()
    }
  }, [currentUser])

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

  // 4. Chọn hội thoại & Tính toán Safety Number Signal
  useEffect(() => {
    if (selectedConvId && currentUser) {
      selectedConvIdRef.current = selectedConvId
      broadcastRequestMessageSync(selectedConvId)
      const msgs = getLocalMessages(selectedConvId)
      setMessages(msgs)
      setInputText(getConversationDraft(selectedConvId))
      setReplyingToMessage(null)
      setIsMobileListVisible(false)

      const activeConv = conversations.find((c) => c.id === selectedConvId)
      const partnerId = activeConv?.partnerId || selectedConvId

      // Lấy biệt danh
      const nick = getNicknameFor(partnerId)
      setCurrentNickname(nick)

      // Kiểm tra chặn
      const blocked = isUserBlocked(partnerId)
      setIsCurrentBlocked(blocked)

      // Lấy hình nền
      const wp = getWallpaperFor(selectedConvId)
      setCurrentWallpaper(wp)

      // Đánh dấu đã đọc
      if (activeConv && activeConv.unreadCount > 0) {
        activeConv.unreadCount = 0
        saveLocalConversation(activeConv)
        refreshConversations()
      }

      // Giả lập tính mã an toàn Signal giữa 2 người dùng
      calculateSafetyNumber(
        currentUser.id,
        `ik_${currentUser.id}`,
        partnerId,
        `ik_${partnerId}`
      ).then((res) => {
        setSafetyNumberData(res)
      })

      // Đọc trạng thái xác minh từ localStorage
      const verificationKey = senChatAccountKey(`senchat_verified_${partnerId}`)
      const verified = !!verificationKey && localStorage.getItem(verificationKey) === 'true'
      setIsPartnerVerified(verified)
    }
  }, [selectedConvId])

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    const list = messagesEndRef.current?.parentElement
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

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
    const conversationId = selectedConvId
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
  }, [selectedConvId])

  const handledConversationQuery = useRef<string | null>(null)
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('conversation')
    const match = target ? getChatConversation(target) : null
    if (target && match && handledConversationQuery.current !== target) {
      handledConversationQuery.current = target
      setSelectedConvId(match.id)
      setActiveRailTab('messages')
    }
  }, [conversations])

  // 7. Gửi tin nhắn mới
  const handleSendMessage = async (
    textToSend?: string,
    type: 'text' | 'image' | 'like' | 'system' = 'text',
    mediaUrl?: string,
    skipSenAiCheck: boolean = false
  ) => {
    if (isCurrentBlocked) {
      alert('Bạn đã chặn người dùng này. Hãy bỏ chặn để tiếp tục nhắn tin.')
      return
    }

    const content = (textToSend !== undefined ? textToSend : inputText).trim()
    if (!content && type === 'text') return
    if (!selectedConvId || !currentUser) return

    // P6: Nếu người dùng gửi tin nhắn nhắc @Sen và chưa qua bước xác nhận E2EE
    if (type === 'text' && !skipSenAiCheck && hasSenAiMention(content)) {
      setShowSenAiAutocomplete(false)
      const cleanPrompt = extractSenAiQuery(content) || content
      setPendingSenAiQuery(cleanPrompt)
      setShowSenAiConfirmModal(true)
      return
    }

    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    const newMsg: SenChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      conversationId: selectedConvId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeConv.partnerId,
      content: type === 'like' ? '👍' : content,
      type: type,
      attachmentUrl: mediaUrl,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }

    // Nếu có trả lời tin nhắn (Trích dẫn chuẩn)
    if (replyingToMessage) {
      newMsg.replyTo = {
        id: replyingToMessage.id,
        senderName: replyingToMessage.senderName || 'Người dùng',
        content: replyingToMessage.content || (replyingToMessage.attachmentName ? `[Tệp: ${replyingToMessage.attachmentName}]` : '[Tin nhắn]'),
      }
      setReplyingToMessage(null)
    }

    // Lưu cục bộ ngay tức thì (Local-First)
    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])
    if (textToSend === undefined) {
      setInputText('')
      clearConversationDraft(selectedConvId)
    }

    // Cập nhật conversation
    saveLocalConversation({
      ...activeConv,
      lastMessage: newMsg.type === 'image' ? '[Hình ảnh]' : newMsg.type === 'like' ? '👍' : newMsg.content,
      lastMessageTime: new Date(newMsg.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      updatedAt: Date.now(),
    })
    refreshConversations()

    if (isOnline) await deliverLocalMessage(newMsg, activeConv).catch(() => {})
  }

  // 7b. Gửi tin nhắn thoại bảo mật E2EE (P5)
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
    if (isCurrentBlocked) {
      alert('Bạn đã chặn người dùng này. Hãy bỏ chặn để tiếp tục nhắn tin.')
      return
    }
    if (!selectedConvId || !currentUser) return

    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    const newMsg: SenChatMessage = {
      id: 'msg_voice_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      conversationId: selectedConvId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeConv.partnerId,
      content: voiceData.transcription ? `[Tin nhắn thoại]: ${voiceData.transcription}` : '[Tin nhắn thoại]',
      type: 'audio',
      attachmentId: voiceData.attachmentId,
      driveFileId: voiceData.driveFileId,
      storageProvider: voiceData.storageProvider || 'supabase_storage',
      storagePath: voiceData.storagePath,
      fileKeyBase64: voiceData.fileKeyBase64,
      attachmentSize: voiceData.fileSize,
      mimeType: voiceData.mimeType,
      duration: voiceData.duration,
      waveform: voiceData.waveform,
      transcription: voiceData.transcription,
      transcriptionLanguage: voiceData.transcriptionLanguage,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }

    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])

    saveLocalConversation({
      ...activeConv,
      lastMessage: voiceData.transcription ? `🎤 ${voiceData.transcription}` : '[Tin nhắn thoại]',
      lastMessageTime: new Date(newMsg.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      updatedAt: Date.now(),
    })
    refreshConversations()

    if (isOnline) await deliverLocalMessage(newMsg, activeConv).catch(() => {})
  }

  // 7c. Xác nhận gửi câu hỏi tới SenAI (P6: E2EE Disclosure & Context)
  const handleConfirmSenAiCall = async ({
    query,
    contextMessages,
  }: {
    query: string
    contextMessages: SenChatMessage[]
  }) => {
    if (!selectedConvId || !currentUser) return
    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    setIsSenAiCalling(true)
    try {
      // 1. Gửi tin nhắn của người dùng vào hội thoại và xóa ô nhập
      const userMessageText = hasSenAiMention(query) ? query : `@Sen ${query}`
      await handleSendMessage(userMessageText, 'text', undefined, true)
      setInputText('')

      // 2. Trong nhóm: thông báo cho các thành viên khi có người gọi Sen
      if (activeConv.isGroup) {
        const groupNoticeText = formatSenAiGroupNotice(currentUser.name)
        const sysMsg: SenChatMessage = {
          id: 'msg_sys_senai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          conversationId: selectedConvId,
          senderId: 'system',
          senderName: 'Hệ thống',
          receiverId: activeConv.partnerId,
          invokedBy: currentUser.id,
          content: groupNoticeText,
          type: 'system',
          createdAt: new Date().toISOString(),
          status: 'sent',
        }
        saveLocalMessage(selectedConvId, sysMsg)
        setMessages((prev) => [...prev, sysMsg])

        if (isOnline) {
          try {
            await sendInboxMessage({ ...sysMsg, senderId: currentUser.id }, activeConv)
          } catch (e) {
            console.warn('Lỗi broadcast thông báo nhóm:', e)
          }
        }
      }

      // 3. Lấy access token người dùng để kiểm tra quota chính chủ
      let token: string | null = null
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        token = session?.access_token || null
      } catch (authErr) {
        console.warn('Lỗi lấy token:', authErr)
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // 4. Gọi API /api/chat/senai (Chỉ gửi dữ liệu người dùng đã đồng ý ra khỏi vòng E2EE)
      const res = await fetch('/api/chat/senai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: extractSenAiQuery(query) || query,
          contextMessages: contextMessages.map((m) => ({
            senderName: m.senderName,
            content: m.content,
            isSenAi: m.isSenAi,
          })),
          userConfirmed: true,
          isGroup: !!activeConv.isGroup,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        // Nếu có lỗi quota hoặc rate limit
        const errorContent = data.error || 'Đã xảy ra lỗi khi trao đổi với SenAI.'
        const errSysMsg: SenChatMessage = {
          id: 'msg_senai_err_' + Date.now(),
          conversationId: selectedConvId,
          senderId: 'senai',
          senderName: 'SenAI',
          receiverId: activeConv.partnerId,
          invokedBy: currentUser.id,
          content: `⚠️ ${errorContent}`,
          type: 'text',
          isSenAi: true,
          createdAt: new Date().toISOString(),
          status: 'sent',
        }
        saveLocalMessage(selectedConvId, errSysMsg)
        setMessages((prev) => [...prev, errSysMsg])
        return
      }

      // 5. Câu trả lời thành công từ SenAI: Hiển thị với nhãn SenAI và phát E2EE cho các thành viên
      const replyContent = data.reply || data.text || 'Đã nhận câu hỏi.'
      const senAiMsg: SenChatMessage = {
        id: 'msg_senai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversationId: selectedConvId,
        senderId: 'senai',
        senderName: 'SenAI',
        receiverId: activeConv.partnerId,
        invokedBy: currentUser.id,
        content: replyContent,
        type: 'text',
        isSenAi: true,
        createdAt: new Date().toISOString(),
        status: 'sent',
      }

      saveLocalMessage(selectedConvId, senAiMsg)
      setMessages((prev) => [...prev, senAiMsg])

      // Cập nhật cuộc trò chuyện
      saveLocalConversation({
        ...activeConv,
        lastMessage: `🤖 SenAI: ${replyContent.slice(0, 30)}...`,
        lastMessageTime: new Date(senAiMsg.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        updatedAt: Date.now(),
      })
      refreshConversations()

      // Phát realtime qua Supabase Realtime Transit
      if (isOnline) {
        try {
            await sendInboxMessage({ ...senAiMsg, senderId: currentUser.id }, activeConv)
        } catch (e) {
          console.warn('Lỗi broadcast tin nhắn SenAI:', e)
        }
      }

      // Cập nhật quota cho toàn hệ thống
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('senai-quota-updated', { detail: data }))
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi SenAI:', err)
      alert('Có lỗi kết nối tới SenAI: ' + (err?.message || 'Vui lòng thử lại sau.'))
    } finally {
      setIsSenAiCalling(false)
    }
  }

  // Cập nhật transcript cho tin nhắn thoại (cho phép sửa tay hoặc cập nhật sau STT)
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

  // 8. Thu hồi / Xóa tin nhắn (Recall & Local Delete)
  const handleRecallMessage = async (msgId: string, skipConfirm = false) => {
    const targetMsg = messages.find((m) => m.id === msgId)
    const isMine = targetMsg ? targetMsg.senderId === currentUser?.id : true

    if (!skipConfirm) {
      const promptMsg = isMine
        ? 'Bạn có chắc chắn muốn thu hồi tin nhắn này? Tin nhắn sẽ được xóa trên thiết bị người nhận.'
        : 'Bạn có chắc chắn muốn xóa tin nhắn này khỏi thiết bị của bạn?'
      if (!confirm(promptMsg)) return
    }

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
        const next = prev.map((m) => (m.id === msgId ? { ...m, content: '[Tin nhắn đã được thu hồi]', type: 'system' as const } : m))
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

  // 9. Thả biểu cảm cảm xúc (Reactions)
  const handleAddReaction = (msgId: string, emoji: string, remove = false) => {
    if (!selectedConvId || !currentUser?.id) return
    const conversation = conversations.find(({ id }) => id === selectedConvId)
    if (!conversation) return
    const result = changeChatReaction(conversation, msgId, emoji, currentUser.id, remove)
    if (!result) return
    setMessages(result.messages)
    void result.delivery.catch(() => alert('Chưa đồng bộ được cảm xúc. Hãy thử lại khi kết nối ổn định.'))
  }

  // 10. Chặn & Bỏ chặn
  const handleToggleBlock = () => {
    if (!selectedConvId) return
    const activeConv = conversations.find((c) => c.id === selectedConvId)
    const partnerId = activeConv?.partnerId || selectedConvId

    if (isCurrentBlocked) {
      unblockUser(partnerId)
      setIsCurrentBlocked(false)
      alert('Đã bỏ chặn người dùng.')
    } else {
      if (confirm(`Bạn có chắc muốn chặn ${activeConv?.partnerName || 'người dùng này'}?`)) {
        blockUser(partnerId)
        setIsCurrentBlocked(true)
        alert('Đã chặn người dùng.')
      }
    }
  }

  // 11. Lưu Biệt danh
  const handleSaveNickname = () => {
    if (!selectedConvId) return
    const activeConv = conversations.find((c) => c.id === selectedConvId)
    const partnerId = activeConv?.partnerId || selectedConvId

    setNicknameFor(partnerId, newNicknameInput)
    setCurrentNickname(newNicknameInput.trim() || null)
    setShowNicknameModal(false)
  }

  // Lọc hội thoại theo từ khóa (SenAI Studio luôn luôn hiển thị ở vị trí ghim)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      if (c.id === SENAI_STUDIO_CONVERSATION_ID && !q) return true
      const matchName = c.partnerName.toLowerCase().includes(q)
      const matchLast = (c.lastMessage || '').toLowerCase().includes(q)
      const matchFilter = filterMode === 'groups' ? Boolean(c.isGroup) : filterMode === 'all' || (filterMode === 'unread' && c.unreadCount > 0) || c.id === SENAI_STUDIO_CONVERSATION_ID
      return (matchName || matchLast) && matchFilter
    })
  }, [conversations, searchQuery, filterMode])

  // Lọc tin nhắn tìm kiếm trong khung chat
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages
    const q = chatSearchQuery.toLowerCase().trim()
    return messages.filter((m) => m.content.toLowerCase().includes(q))
  }, [messages, chatSearchQuery])

  // Tổng số tin nhắn chưa đọc
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  }, [conversations])

  const activeConv = conversations.find((c) => c.id === selectedConvId)
  useSenChatConversationLink(currentUser?.id, conversations, activeConv, (id) => {
    setSelectedConvId(id)
    setActiveRailTab('messages')
  })
  const wallpaperObj = CHAT_WALLPAPERS.find((w) => w.id === currentWallpaper) || CHAT_WALLPAPERS[0]

  if (!currentUser || getSenChatAccount() !== currentUser.id) {
    return <div className="grid min-h-[50dvh] flex-1 place-items-center p-6 text-center">
      <div><p role="status">Đang kết nối Sen Chat…</p><button type="button" className="mt-3 text-sm font-semibold text-sky-700 underline" onClick={() => window.location.reload()}>Tải lại Sen Chat</button></div>
    </div>
  }

  return (
    <div
      className={`flex h-dvh w-full min-w-0 shrink-0 overflow-hidden pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] font-sans antialiased transition-colors duration-200 ${
        isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      <ChatGroupInviteJoin />
      {/* =========================================================================
          CỘT TẬN CÙNG BÊN TRÁI: THANH DỌC TÁC VỤ (FAR-LEFT VERTICAL DOCK)
         ========================================================================= */}
      <nav
        aria-label="Thanh tác vụ chính Sen Chat"
        className={`h-full w-16 md:w-[68px] shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-slate-100/90 py-3.5 dark:border-slate-800 dark:bg-slate-900/90 z-20 ${
          isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Top: Logo Sen Chat -> Nhấn để mở Modal Phiên bản & Changelog */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setShowVersionModal(true)}
            title={`Sen Chat v${SEN_CHAT_CURRENT_VERSION} — Bấm để xem thông tin phiên bản & nhật ký cập nhật`}
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-md shadow-emerald-500/10 transition-transform hover:scale-105 active:scale-95 dark:bg-slate-800"
          >
            <img
              src="/sen-chat-logo.png"
              alt="Sen Chat"
              className="h-9 w-9 rounded-xl object-cover"
            />
            <span
              className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
              title="Mã hóa đầu-cuối Signal & MLS"
            >
              <Lock className="h-2 w-2 text-white" />
            </span>
          </button>

          {/* Đường kẻ phân cách */}
          <div className="h-px w-8 bg-slate-200 dark:bg-slate-800" />

          {/* Nhóm các nút tác vụ dọc (Icon Dock) */}
          <div className="flex flex-col items-center gap-2">
            {/* Tin nhắn */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('messages')
                setFilterMode('all')
              }}
              title="Tin nhắn hội thoại"
              className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl transition-all ${
                activeRailTab === 'messages'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-105'
                  : 'text-slate-600 hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </button>

            {/* Bạn bè / Thêm bạn (Friends / Add Friend) */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('contacts')
                fetchFriendsList()
              }}
              title="Bạn bè & Thêm bạn qua Email"
              className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl transition-all ${
                activeRailTab === 'contacts'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-105'
                  : 'text-slate-600 hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400'
              }`}
            >
              <UserPlus className="h-5 w-5" />
              {incomingInvites.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                  {incomingInvites.length}
                </span>
              )}
            </button>

            {/* Tạo nhóm MLS RFC 9420 */}
            <button
              type="button"
              onClick={() => { setActiveRailTab('messages'); setFilterMode('groups'); setSearchQuery(''); setIsMobileListVisible(true) }}
              title="Quản lý nhóm"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-teal-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-teal-400"
            >
              <Users className="h-5 w-5" />
            </button>

            {/* Trung tâm bảo mật & Thiết bị */}
            <button
              type="button"
              onClick={() => setShowDeviceManagerModal(true)}
              title="Trung tâm thiết bị & Bảo mật"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
            >
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-sky-400" />
            </button>

          </div>
        </div>

        {/* Bottom Actions: Theme Toggle & User Avatar */}
        <div className="flex flex-col items-center gap-3">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            title="Cài đặt Sen Chat"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white hover:text-amber-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-400"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* User Avatar */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            title={`${currentUser?.name || 'Người dùng'} — Bấm để mở Cài đặt / Đăng xuất`}
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-transform hover:scale-105 active:scale-95"
          >
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="h-10 w-10 rounded-2xl object-cover ring-2 ring-emerald-500/40"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 font-bold text-white shadow-sm ring-2 ring-emerald-500/30">
                {(currentUser?.name || 'S').substring(0, 1).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              title={isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
            />
          </button>
        </div>
      </nav>

      {/* =========================================================================
          CỘT BÊN CẠNH: DANH SÁCH HỘI THOẠI & KẾT BẠN (320px - 360px)
         ========================================================================= */}
      <aside
        className={`h-full w-full flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-xl md:w-[340px] lg:w-[360px] md:shrink-0 dark:border-slate-800 dark:bg-slate-900/95 ${
          !isMobileListVisible ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header của Cột bên cạnh */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
          <div>
            <h2 className="font-extrabold text-base tracking-tight text-slate-800 dark:text-slate-100">
              {activeRailTab === 'contacts' ? 'Bạn bè' : filterMode === 'groups' ? 'Quản lý nhóm' : 'Đoạn chat'}
            </h2>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
              {currentUser?.name || 'Đang kết nối...'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <Lock className="h-2.5 w-2.5" /> E2EE
            </span>
            <button
              type="button"
              onClick={() => setShowFriendModal(true)}
              title="Thêm bạn qua Email chính xác"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-sky-300 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
            </button>
            <button type="button" title="Tạo nhóm" aria-label="Tạo nhóm" onClick={() => setShowCreateGroupModal(true)}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              <Users className="h-4 w-4" /><Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeRailTab === 'contacts' ? 'Tìm bạn bè...' : 'Tìm bạn bè hoặc tin nhắn...'}
              className="min-h-[42px] w-full rounded-2xl border border-slate-200 bg-slate-100/70 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
            />
          </div>

          <div className="mt-2.5 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('messages')
                setFilterMode('all')
              }}
              className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold transition ${
                activeRailTab === 'messages' && filterMode === 'all'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('messages')
                setFilterMode('unread')
              }}
              className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold transition ${
                activeRailTab === 'messages' && filterMode === 'unread'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Chưa đọc {totalUnreadCount > 0 ? `(${totalUnreadCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('contacts')
                fetchFriendsList()
              }}
              className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold transition ${
                activeRailTab === 'contacts'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Bạn bè {incomingInvites.length > 0 ? `(${incomingInvites.length})` : ''}
            </button>
          </div>
        </div>

        {/* Nội dung danh sách: Bạn bè hoặc Cuộc trò chuyện */}
        {activeRailTab === 'contacts' ? (
          <div className="flex-1 overflow-y-auto px-2 space-y-2">
            {/* Lời mời kết bạn đang chờ phản hồi */}
            {incomingInvites.length > 0 && (
              <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-900/50">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    Lời mời kết bạn ({incomingInvites.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {incomingInvites.map((inv) => (
                    <div key={inv.friendshipId || inv.id} className="flex items-center justify-between rounded-xl bg-white p-2 shadow-xs dark:bg-slate-800">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{inv.name}</p>
                        <p className="truncate text-[10px] text-slate-400">{inv.school || 'Học viên SenExam'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRespondFriend(inv.id, 'accept')}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Đồng ý
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondFriend(inv.id, 'reject')}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danh bạ bạn bè đã kết nối */}
            <div className="px-1 pt-1 pb-0.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Danh bạ bạn bè ({friendsList.length})
              </span>
              <button
                type="button"
                onClick={() => setShowFriendModal(true)}
                className="text-[11px] font-bold text-emerald-600 hover:underline dark:text-emerald-400"
              >
                + Thêm bạn
              </button>
            </div>

            {loadingFriends && friendsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                <p className="text-xs">Đang tải danh bạ...</p>
              </div>
            ) : friendsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                <UserPlus className="h-10 w-10 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <p className="mt-3 text-xs font-medium">Chưa có bạn bè nào trong danh bạ</p>
                <button
                  type="button"
                  onClick={() => setShowFriendModal(true)}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  + Tìm & Thêm bạn bằng Email
                </button>
              </div>
            ) : (
              friendsList
                .filter((f) => !searchQuery.trim() || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => {
                      saveLocalConversation({
                        id: friend.id,
                        partnerId: friend.id,
                        partnerName: friend.name,
                        partnerIdentifier: friend.id,
                        unreadCount: 0,
                        updatedAt: Date.now(),
                      })
                      setSelectedConvId(friend.id)
                      setActiveRailTab('messages')
                      refreshConversations()
                    }}
                    className="flex min-h-[54px] w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-slate-100/80 active:scale-[0.98] dark:hover:bg-slate-800/50"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-500 font-bold text-white shadow-sm">
                      {friend.name.substring(0, 1).toUpperCase()}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-xs text-slate-800 dark:text-slate-100">
                        {friend.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {friend.school || 'Học viên SenExam'} {friend.className ? `• ${friend.className}` : ''}
                      </p>
                    </div>
                    <span className="rounded-xl bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Nhắn tin
                    </span>
                  </button>
                ))
            )}
          </div>
        ) : (
          /* Danh sách các cuộc trò chuyện */
          <div
            className="flex-1 overflow-y-auto overscroll-contain transform-gpu px-2 space-y-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <MessageSquare className="h-10 w-10 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <p className="mt-3 text-xs font-medium">Chưa có cuộc trò chuyện nào</p>
                <button
                  type="button"
                  onClick={() => setShowFriendModal(true)}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  + Kết bạn bằng Email
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedConvId === c.id
                const isSenAiStudio = c.id === SENAI_STUDIO_CONVERSATION_ID
                const nickname = isSenAiStudio ? 'SenAI Studio' : getNicknameFor(c.partnerId)
                const displayName = isSenAiStudio ? 'SenAI Studio' : (nickname || c.partnerName)

                return (
                  <div
                    key={c.id}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({
                        isOpen: true,
                        mode: 'conversation',
                        x: e.clientX,
                        y: e.clientY,
                        conversation: c,
                      })
                    }}
                    onTouchStart={(e) =>
                      startLongPress(e, (tx, ty) =>
                        setContextMenu({
                          isOpen: true,
                          mode: 'conversation',
                          x: tx,
                          y: ty,
                          conversation: c,
                        })
                      )
                    }
                    onTouchMove={moveLongPress}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    style={{ WebkitTouchCallout: 'none' }}
                    className={`group/conv relative flex min-h-[58px] w-full items-center gap-3 rounded-2xl p-3 text-left transition select-none ${
                      isSelected
                        ? 'bg-blue-500/12 text-blue-900 dark:bg-blue-500/20 dark:text-sky-100'
                        : isSenAiStudio
                        ? 'bg-sky-50/70 hover:bg-sky-100/70 dark:bg-blue-950/25 dark:hover:bg-blue-950/40 border border-blue-500/20'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false
                          return
                        }
                        setSelectedConvId(c.id)
                      }}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left active:scale-[0.98]"
                    >
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm ${
                        isSenAiStudio
                          ? 'bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-500 shadow-blue-500/30'
                          : 'bg-gradient-to-br from-blue-500 to-sky-500'
                      }`}>
                        {isSenAiStudio ? (
                          <Sparkles className="h-5 w-5 animate-pulse text-white" />
                        ) : (
                          displayName.substring(0, 1).toUpperCase()
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.isPinned && !isSenAiStudio && (
                              <Pin className="h-3 w-3 shrink-0 text-amber-500" />
                            )}
                            <span className="truncate font-semibold text-xs text-slate-800 dark:text-slate-100">
                              {displayName}
                            </span>
                            {isSenAiStudio && (
                              <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-[9px] font-black uppercase tracking-wider text-white">
                                Studio
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{c.lastMessageTime || ''}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {c.lastMessage || (isSenAiStudio ? 'Trợ lý học tập & nghiên cứu' : 'Bắt đầu trò chuyện...')}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {!isSenAiStudio && (
                      <div className="hidden group-hover/conv:flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConversations(togglePinConversation(c.id))
                          }}
                          title={c.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/80 hover:text-amber-600 dark:hover:bg-slate-700"
                        >
                          {c.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConversations(markConversationUnread(c.id, 1))
                          }}
                          title="Đánh dấu chưa đọc"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/80 hover:text-blue-600 dark:hover:bg-slate-700"
                        >
                          <CircleDot className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </aside>

      {/* =========================================================================
          CỘT GIỮA: KHUNG CHAT TIN NHẮN (FLEX-1)
         ========================================================================= */}
      <main
        className={`flex h-full flex-1 flex-col overflow-hidden relative ${
          isMobileListVisible ? 'hidden md:flex' : 'flex'
        }`}
        style={{ background: wallpaperObj.bgStyle }}
      >
        {activeConv ? (
          activeConv.id === SENAI_STUDIO_CONVERSATION_ID ? (
            <div className="flex h-full w-full flex-col">
              <div className="md:hidden flex items-center px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsMobileListVisible(true)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" /> Quay lại danh sách
                </button>
              </div>
              <ChatSenAiStudioView userId={currentUser?.id} />
            </div>
          ) : (
          <>
            {/* Header khung chat */}
            <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMobileListVisible(true)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 font-bold text-white shadow-sm">
                  {(currentNickname || activeConv.partnerName).substring(0, 1).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {currentNickname || activeConv.partnerName}
                    </h3>
                    {isPartnerVerified && (
                      <span title="Mã an toàn Signal đã xác minh">
                        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    {activeConv.isGroup ? (
                      <button
                        type="button"
                        onClick={() => setShowInfoSidebar(true)}
                        className="flex items-center gap-1 text-blue-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        <Users className="h-3 w-3" /> Nhóm MLS RFC 9420 (Quản lý)
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-sky-400">
                        <Lock className="h-3 w-3" /> Signal Double Ratchet
                      </span>
                    )}
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <ChatDeviceComplianceBadge />
                    {disappearingTtl > 0 && (
                      <span className="flex items-center gap-0.5 text-indigo-500 font-medium">
                        • <Timer className="h-3 w-3" /> Tự hủy sau {disappearingTtl}s
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Call & Tool Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowChatSearch(!showChatSearch)}
                  title="Tìm trong tin nhắn"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" />
                </button>

                <ConversationMuteButton key={activeConv.id} conversation={chatConversationKey(activeConv)} />
                <button
                  type="button"
                  onClick={() => startChatCall(activeConv, 'voice')}
                  title="Gọi thoại mã hóa"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-blue-600 dark:hover:bg-slate-800"
                >
                  <Phone className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => startChatCall(activeConv, 'video')}
                  title="Gọi video mã hóa"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-blue-600 dark:hover:bg-slate-800"
                >
                  <Video className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  title="Thông tin hội thoại"
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition ${
                    showInfoSidebar
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Thanh tìm kiếm nội dung trong cuộc trò chuyện */}
            {showChatSearch && (
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/90">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Lọc tin nhắn trong hội thoại này..."
                  className="w-full text-xs outline-none bg-transparent dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    setChatSearchQuery('')
                    setShowChatSearch(false)
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* Cảnh báo offline nếu mất mạng */}
            {!isOnline && (
              <div className="flex items-center justify-center gap-2 bg-amber-500/90 py-1.5 text-center text-xs font-semibold text-white backdrop-blur-md">
                <AlertTriangle className="h-4 w-4" />
                Mất kết nối mạng. Tin nhắn đang được lưu vào hàng đợi bảo mật và sẽ tự động gửi lại khi online.
              </div>
            )}

            {/* Thông báo chính sách bảo mật lưu trữ 30 ngày */}
            <div className="relative z-10 flex items-center justify-between px-4 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-800 dark:text-sky-300 text-[11px] shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400 shrink-0" />
                <span className="truncate">{CHAT_RETENTION_POLICY_NOTICE}</span>
              </div>
            </div>

            {/* Khung cuộn tin nhắn */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain transform-gpu p-4 space-y-3"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {displayedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <ShieldCheck className="h-12 w-12 text-emerald-500/40" />
                  <p className="mt-2 font-semibold text-sm text-slate-700 dark:text-slate-300">
                    Bảo Mật Đầu-Cuối E2EE Được Kích Hoạt
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-400">
                    {activeConv.isGroup
                      ? `Tin nhắn trong nhóm ${activeConv.partnerName} được mã hóa đầu-cuối bằng chuẩn MLS (RFC 9420). Chỉ thành viên trong nhóm mới có khóa giải mã.`
                      : `Tin nhắn giữa bạn và ${currentNickname || activeConv.partnerName} được mã hóa bằng giao thức Signal. Không ai, kể cả SenExam, có thể đọc được nội dung.`}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id
                  const textParts = parseMessageLinks(msg.content)

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
                      className={`group flex flex-col transition-all rounded-2xl ${
                        msg.type === 'system' ? 'items-center my-1' : isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {msg.type === 'system' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-xs max-w-[85%] text-center">
                          <Info className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          <span>{msg.content}</span>
                          {msg.missedCall && activeConv && <button type="button" className="font-semibold text-sky-700 underline dark:text-sky-300" onClick={() => startChatCall(activeConv, msg.missedCall!)}>Gọi lại</button>}
                        </div>
                      ) : (
                        <div className="flex items-end gap-1.5 max-w-[80%]">
                          {!isMe && (
                            <div className="h-7 w-7 shrink-0 rounded-xl overflow-hidden shadow-xs mb-1">
                              {msg.isSenAi || msg.senderId === 'senai' ? (
                                <img src="/senai-logo.png" alt="SenAI" className="h-full w-full object-contain bg-slate-900/90 p-0.5" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-sky-500 text-white font-bold text-[10px]">
                                  {(msg.senderName || 'B').substring(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                          {msg.type === 'audio' ? (
                            <div className="flex flex-col">
                              <ChatVoiceMessageBubble
                                messageId={msg.id}
                                attachmentId={msg.attachmentId}
                                driveFileId={msg.driveFileId}
                                storageProvider={msg.storageProvider}
                                storagePath={msg.storagePath}
                                fileKeyBase64={msg.fileKeyBase64}
                                duration={msg.duration}
                                waveform={msg.waveform}
                                transcription={msg.transcription}
                                transcriptionLanguage={msg.transcriptionLanguage}
                                isOutgoing={isMe}
                                userPlanTier={userPlanTier}
                                onUpdateTranscription={handleUpdateMessageTranscription}
                              />
                              {/* Footer trạng thái tin nhắn thoại */}
                              <div
                                className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400 px-1"
                              >
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
                                      <button type="button" className="font-semibold underline" title="Gửi thất bại" onClick={() => { if (activeConv) void deliverLocalMessage(msg, activeConv).catch(() => {}) }}>Thử lại</button>
                                    ) : msg.status === 'sending' ? (
                                      <Clock className="h-3 w-3" />
                                    ) : msg.status === 'received' || msg.status === 'seen' ? (
                                      <CheckCheck
                                        className={`h-3 w-3 ${
                                          readReceiptsEnabled && msg.status === 'seen' ? 'text-cyan-500' : ''
                                        }`}
                                      />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`relative rounded-3xl p-3.5 shadow-sm transition ${
                                msg.isSenAi || msg.senderId === 'senai'
                                  ? 'border border-purple-200/90 bg-gradient-to-br from-purple-50/90 via-white/95 to-indigo-50/80 text-slate-800 backdrop-blur-md dark:border-purple-800/80 dark:bg-gradient-to-br dark:from-purple-950/40 dark:to-slate-900/90 dark:text-slate-100 shadow-purple-500/10'
                                  : isMe
                                  ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-blue-600/25'
                                  : 'border border-slate-200/80 bg-white/95 text-slate-800 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100'
                              }`}
                            >
                              {/* Nhãn SenAI đặc trưng */}
                              {(msg.isSenAi || msg.senderId === 'senai') && (
                                <div className="mb-2 flex items-center gap-1.5 px-2 py-0.5 w-fit rounded-lg bg-gradient-to-r from-purple-500/15 to-indigo-500/15 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                                  <img src="/senai-logo.png" alt="SenAI" className="h-3.5 w-3.5 object-contain" />
                                  <span>SenAI</span>
                                </div>
                              )}

                              {/* Khung trích dẫn tin nhắn trả lời (Reply Quote) */}
                              {msg.replyTo && (
                                <div
                                  className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-[11px] ${
                                    isMe
                                      ? 'border-white/70 bg-white/15 text-white/95'
                                      : 'border-blue-500 bg-slate-100/90 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300'
                                  }`}
                                >
                                  <div className="font-bold text-[10px] opacity-90">{msg.replyTo.senderName}</div>
                                  <div className="truncate opacity-80">{msg.replyTo.content}</div>
                                </div>
                              )}

                              {/* Đính kèm tệp / ảnh mã hóa E2EE */}
                              {(msg.attachmentId || msg.driveFileId || msg.fileKeyBase64) && (
                                <div className="mb-2">
                                  <ChatAttachmentBubble
                                    isMe={isMe}
                                    attachmentId={msg.attachmentId}
                                    driveFileId={msg.driveFileId}
                                    storageProvider={msg.storageProvider}
                                    fileKeyBase64={msg.fileKeyBase64}
                                    fileName={msg.attachmentName || 'Tệp đính kèm'}
                                    fileSize={msg.attachmentSize}
                                    mimeType={msg.mimeType}
                                    expiresAt={msg.expiresAt}
                                    isPinnedPermanent={msg.isPinnedPermanent}
                                    isGroup={activeConv?.isGroup}
                                    canExtendRetention={activeConv?.isGroup ? (activeConv?.role === 'owner' || activeConv?.role === 'admin' || msg.senderId === currentUser?.id) : true}
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
                                </div>
                              )}

                              {/* Rendering tin nhắn text hoặc công thức KaTeX / TikZ an toàn */}
                              {(!msg.attachmentId || (msg.content && !msg.content.startsWith('[Tệp đính kèm:'))) && (
                                <ChatMessageContent
                                  content={msg.content}
                                  isSenAi={msg.isSenAi || msg.senderId === 'senai'}
                                  isMe={isMe}
                                />
                              )}

                            {/* Footer trạng thái tin nhắn */}
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                isMe ? 'text-sky-100/80' : 'text-slate-400'
                              }`}
                            >
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
                                      <button type="button" className="font-semibold underline" title="Gửi thất bại" onClick={() => { if (activeConv) void deliverLocalMessage(msg, activeConv).catch(() => {}) }}>Thử lại</button>
                                    ) : msg.status === 'sending' ? (
                                    <Clock className="h-3 w-3" />
                                  ) : msg.status === 'received' || msg.status === 'seen' ? (
                                    <CheckCheck
                                      className={`h-3 w-3 ${
                                        readReceiptsEnabled && msg.status === 'seen' ? 'text-cyan-200' : ''
                                      }`}
                                    />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </div>

                            {/* Hiển thị huy hiệu biểu cảm cảm xúc (Emoji Reactions) */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <ChatReactionChips reactions={msg.reactions} userId={currentUser.id}
                        onChange={(emoji, remove) => handleAddReaction(msg.id, emoji, remove)} />
                    )}
                          </div>
                        )}

                        {/* Message Action Bar (Reply, Reaction, Recall) */}
                        <div className={`${activeTouchMessageId === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition flex items-center gap-0.5`}>
                          <button
                            type="button"
                            onClick={() => setReplyingToMessage(msg)}
                            title="Trả lời trích dẫn"
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          {(['👍', '❤️', '😂', '😮', '😢'] as const).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              title={`Thả cảm xúc ${emoji}`}
                              className="p-1 rounded-lg text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition hover:scale-110"
                            >
                              {emoji}
                            </button>
                          ))}

                          {isMe && (
                            <button
                              type="button"
                              onClick={() => handleRecallMessage(msg.id)}
                              title="Thu hồi tin nhắn"
                              className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Trích dẫn khi đang trả lời */}
            {replyingToMessage && (
              <div className="flex items-center justify-between border-t border-slate-200/60 bg-blue-50/80 px-4 py-2 dark:border-slate-800 dark:bg-blue-950/30">
                <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-sky-300">
                  <CornerDownRight className="h-4 w-4" />
                  <span>
                    Đang trả lời <strong>{replyingToMessage.senderName}</strong>: {replyingToMessage.content.slice(0, 45)}...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="relative border-t border-slate-200/60 bg-white/90 p-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 pb-[max(12px,env(safe-area-inset-bottom))]">
              {/* Gợi ý autocomplete @Sen */}
              {showSenAiAutocomplete && senAiSuggestions.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-2 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 shadow-xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1.5 bg-purple-500/10 border-b border-purple-100 dark:border-purple-900 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Gợi ý gọi trợ lý AI
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSenAiAutocomplete(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                  {senAiSuggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => {
                        const newText = inputText.replace(/(?:^|\s)@[a-z0-9_]*$/i, (match) => {
                          const prefix = match.startsWith(' ') ? ' ' : ''
                          return prefix + '@Sen '
                        })
                        setInputText(newText)
                        setShowSenAiAutocomplete(false)
                      }}
                      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-left transition"
                    >
                      <div className="h-8 w-8 rounded-xl bg-slate-900/90 p-0.5 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-purple-500/30 overflow-hidden">
                        <img src="/senai-logo.png" alt="SenAI" className="h-full w-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{sug.trigger}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-semibold">
                            {sug.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {sug.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isRecordingVoice ? (
                <ChatVoiceRecorder
                  conversationId={selectedConvId || ''}
                  userPlanTier={userPlanTier}
                  onCancel={() => setIsRecordingVoice(false)}
                  onSendVoiceMessage={async (voiceData) => {
                    await handleSendVoiceMessage(voiceData)
                    setIsRecordingVoice(false)
                  }}
                />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                  }}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Đính kèm tệp"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setSelectedAttachmentFile(f)
                      }
                      e.target.value = ''
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setIsRecordingVoice(true)}
                    title="Ghi âm tin nhắn thoại"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      const val = e.target.value
                      setInputText(val)
                      if (selectedConvId) {
                        saveConversationDraft(selectedConvId, val)
                      }
                      const suggestions = getSenAiAutocompleteSuggestions(val)
                      setSenAiSuggestions(suggestions)
                      setShowSenAiAutocomplete(suggestions.length > 0)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const sendKey = getChatSendKey()
                        if (sendKey === 'shift_enter' && !e.shiftKey) {
                          e.preventDefault()
                          return
                        }
                        if (sendKey === 'enter' && e.shiftKey) {
                          e.preventDefault()
                          return
                        }
                        e.preventDefault()
                        if (inputText.trim()) {
                          handleSendMessage()
                        }
                      }
                    }}
                    placeholder="Nhập tin nhắn bảo mật E2EE (gõ @Sen để hỏi AI)..."
                    className="min-h-[44px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendMessage(undefined, 'like')}
                    title="Thả Like"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <ThumbsUp className="h-5 w-5" />
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    title="Gửi tin nhắn"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </>
          )
        ) : (
          <div className="flex h-full flex-1 flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="max-w-lg w-full flex flex-col items-center space-y-6">
              <div className="relative">
                <img
                  src="/sen-chat-logo.png"
                  alt="Sen Chat"
                  className="h-20 w-20 rounded-3xl shadow-xl shadow-emerald-500/15 object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900">
                  <Lock className="h-3.5 w-3.5" />
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-xl text-slate-800 dark:text-slate-100 tracking-tight">
                  Sen Chat — Bảo Mật Đầu-Cuối
                </h3>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                  Nhắn tin và gọi điện riêng tư theo tiêu chuẩn Signal Protocol & IETF MLS RFC 9420. Dữ liệu của bạn được mã hóa hoàn toàn trên thiết bị này.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-sky-400 font-bold text-xs mb-1">
                    <Lock className="h-3.5 w-3.5" /> Signal Double Ratchet
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Khóa xoay liên tục sau mỗi tin nhắn. Khóa cũ tự hủy, chống đọc lén lịch sử.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs mb-1">
                    <Users className="h-3.5 w-3.5" /> Nhóm MLS RFC 9420
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bảo mật nhóm phân cấp cây Ratchet Tree mới nhất của hiệp hội Internet IETF.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs mb-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Mã Safety Number
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Xác minh dấu vân tay số người nhận để phát hiện giả mạo danh tính.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs mb-1">
                    <img src="/senai-logo.png" alt="SenAI" className="h-3.5 w-3.5 object-contain" /> Trợ Lý SenAI
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Hỗ trợ giải bài, KaTeX và TikZ với xác nhận rời vùng E2EE minh bạch.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFriendModal(true)}
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95"
                >
                  <UserPlus className="h-4 w-4" /> Thêm bạn qua Email
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Users className="h-4 w-4" /> Tạo nhóm MLS
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          NGĂN KÉO THU GỌN: THÔNG TIN HỘI THOẠI, TỆP, LINK & BẢO MẬT (COLLAPSIBLE DRAWER)
         ========================================================================= */}
      {activeConv && (
        <ChatInfoDrawer
          isOpen={showInfoSidebar}
          onClose={() => setShowInfoSidebar(false)}
          conversation={activeConv}
          renderGroupManagement={activeConv.isGroup ? (section) => (
            <ChatMlsGroupModal key={activeConv.id + section} embedded section={section} isOpen
              onClose={() => setShowInfoSidebar(false)} conversationId={activeConv.id}
              groupTitle={activeConv.partnerName} groupAvatar={activeConv.avatarUrl}
              currentUserId={currentUser?.id || ''} currentUserEmail={currentUser?.email || ''}
              onGroupUpdated={() => setConversations(ensureSenAiStudioInConversations(getLocalConversations()))}
              onGroupLeft={() => { setShowInfoSidebar(false); setSelectedConvId(SENAI_STUDIO_CONVERSATION_ID); setConversations(ensureSenAiStudioInConversations(getLocalConversations())) }}
            />
          ) : undefined}
          messages={messages}
          currentUserId={currentUser?.id || ''}
          currentNickname={currentNickname}
          onOpenNicknameModal={() => {
            setNewNicknameInput(currentNickname || activeConv.partnerName)
            setShowNicknameModal(true)
          }}
          onSelectMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('ring-2', 'ring-blue-500')
              setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000)
            }
          }}
          onRecallMessage={(msgId) => {
            handleRecallMessage(msgId)
          }}
          safetyNumberData={safetyNumberData}
          keyChangedAlert={keyChangedAlert}
          isPartnerVerified={isPartnerVerified}
          onMarkVerified={(verified) => {
            setIsPartnerVerified(verified)
            if (activeConv?.partnerId) {
              const key = senChatAccountKey(`senchat_verified_${activeConv.partnerId}`)
              if (key) localStorage.setItem(key, String(verified))
            }
          }}
          disappearingTtl={disappearingTtl}
          onChangeDisappearingTtl={(ttl) => setDisappearingTtl(ttl)}
          isCurrentBlocked={isCurrentBlocked}
          onToggleBlock={handleToggleBlock}
          onLeaveGroup={() => {
            if (activeConv?.id && confirm('Bạn có chắc chắn muốn rời khỏi nhóm này không?')) {
              handleLeaveGroup(activeConv.id)
            }
          }}
        />
      )}

      {/* BẢO VỆ NỘI DUNG DRM (CHỐNG IN ẤN & USER SELECT) */}
      <ChatDrmProtection isEnabled={true} showBadge={false} />

      {/* Hộp thoại Phiên bản & Nhật ký cập nhật Sen Chat */}
      <ChatVersionModal isOpen={showVersionModal} onClose={() => setShowVersionModal(false)} />

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Đặt biệt danh cho bạn bè
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Biệt danh chỉ hiển thị trên máy của bạn (giống Messenger).
            </p>
            <input
              type="text"
              value={newNicknameInput}
              onChange={(e) => setNewNicknameInput(e.target.value)}
              placeholder="Nhập biệt danh thân quen..."
              className="mt-4 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNicknameModal(false)}
                className="min-h-[40px] px-3 text-xs text-slate-500"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNickname}
                className="min-h-[40px] rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friend Search Modal */}
      <ChatFriendModal
        isOpen={showFriendModal}
        onClose={() => {
          setShowFriendModal(false)
          fetchFriendsList()
        }}
        onStartChatWithUser={(user) => {
          saveLocalConversation({
            id: user.id,
            partnerId: user.id,
            partnerName: user.name,
            partnerIdentifier: user.id,
            unreadCount: 0,
            updatedAt: Date.now(),
          })
          setSelectedConvId(user.id)
          setActiveRailTab('messages')
          refreshConversations()
          fetchFriendsList()
        }}
      />

      {/* Device Management Modal */}
      <ChatDeviceManagerModal
        isOpen={showDeviceManagerModal}
        onClose={() => setShowDeviceManagerModal(false)}
        currentDeviceId={deviceId}
      />

      {/* Tạo nhóm chat MLS mới */}
      <ChatMlsGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        currentUserId={currentUser?.id || ''}
        currentUserEmail={currentUser?.email || ''}
        userPlanTier={userPlanTier}
        isCreatingNew={true}
        onGroupCreated={(convId, title, avatar) => {
          saveLocalConversation({
            id: convId,
            partnerId: convId,
            partnerName: title,
              avatarUrl: avatar,
              partnerAvatar: avatar,
              role: 'owner',
            partnerIdentifier: 'MLS_GROUP',
            unreadCount: 0,
            updatedAt: Date.now(),
            isGroup: true,
          })
          setSelectedConvId(convId)
          refreshConversations()
        }}
      />

      {/* Modal Tải Lên & Mã Hóa Tệp Đính Kèm (P4) */}
      {selectedAttachmentFile && selectedConvId && (
        <ChatAttachmentModal
          file={selectedAttachmentFile}
          conversationId={selectedConvId}
          userPlanTier={userPlanTier}
          onClose={() => setSelectedAttachmentFile(null)}
          onSuccess={(att) => {
            setSelectedAttachmentFile(null)
            const activeConv = conversations.find((c) => c.id === selectedConvId)
            if (!activeConv || !currentUser) return

            const newMsg: SenChatMessage = {
              id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              conversationId: selectedConvId,
              senderId: currentUser.id,
              senderName: currentUser.name,
              receiverId: activeConv.partnerId,
              content: `[Tệp đính kèm: ${att.fileName}]`,
              type: att.fileType === 'image' ? 'image' : 'file',
              attachmentId: att.id,
              driveFileId: att.driveFileId,
              storageProvider: att.storageProvider,
              storagePath: att.storagePath,
              fileKeyBase64: att.fileKeyBase64,
              attachmentName: att.fileName,
              attachmentSize: att.fileSize,
              mimeType: att.mimeType,
              expiresAt: att.expiresAt,
              isPinnedPermanent: false,
              createdAt: new Date().toISOString(),
              status: 'sending',
            }

            saveLocalMessage(selectedConvId, newMsg)
            setMessages((prev) => [...prev, newMsg])
            saveLocalConversation({
              ...activeConv,
              lastMessage: att.fileType === 'image' ? '[Hình ảnh]' : `[Tệp: ${att.fileName}]`,
              lastMessageTime: new Date(newMsg.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              updatedAt: Date.now(),
            })
            refreshConversations()

            if (isOnline) {
              void deliverLocalMessage(newMsg, activeConv).catch(() => {})

              broadcastFileTransitReady({
                attachmentId: att.id,
                fileId: att.driveFileId,
                fileName: att.fileName,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
                fileMetadata: { conversationId: selectedConvId, fileKeyBase64: att.fileKeyBase64 },
              })
            }
          }}
        />
      )}

      {/* Modal Xác nhận E2EE khi gọi @Sen (SenAI) trong chat (P6) */}
      <ChatSenAiConfirmModal
        isOpen={showSenAiConfirmModal}
        onClose={() => {
          setShowSenAiConfirmModal(false)
          setPendingSenAiQuery('')
        }}
        onConfirm={handleConfirmSenAiCall}
        initialQuery={pendingSenAiQuery}
        recentMessages={messages}
        isLoading={isSenAiCalling}
      />

      {/* Modal Cài Đặt Sen Chat */}
      <ChatSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        darkTheme={isDarkMode}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        userPlanTier={userPlanTier}
        deviceId={deviceId}
        onOpenDeviceManager={() => setShowDeviceManagerModal(true)}
        onMessagesCleared={() => {
          setMessages([])
          refreshConversations()
        }}
        onLoggedOut={() => {
          router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))
        }}
      />

      {/* Custom Context Menu (Chuột phải Desktop & Nhấn giữ iPhone/iPad) */}
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
            refreshConversations()
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
