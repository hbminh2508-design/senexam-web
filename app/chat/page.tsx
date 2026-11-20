'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
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
  Sun,
  Moon,
  Reply,
  CornerDownRight,
  ShieldAlert,
  Timer,
  AlertTriangle,
  Settings,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import SenChatLogo from '@/components/SenChatLogo'
import ChatSafetyWidget from '@/components/chat/ChatSafetyWidget'
import ChatDisappearingMessages from '@/components/chat/ChatDisappearingMessages'
import ChatDeviceManagerModal from '@/components/chat/ChatDeviceManagerModal'
import ChatSettingsModal from '@/components/chat/ChatSettingsModal'
import ChatFriendModal from '@/components/chat/ChatFriendModal'
import ChatMlsGroupModal from '@/components/chat/ChatMlsGroupModal'
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal'
import ChatAttachmentBubble from '@/components/chat/ChatAttachmentBubble'
import ChatVoiceRecorder from '@/components/chat/ChatVoiceRecorder'
import ChatVoiceMessageBubble from '@/components/chat/ChatVoiceMessageBubble'
import ChatSenAiConfirmModal from '@/components/chat/ChatSenAiConfirmModal'
import ChatMessageContent from '@/components/chat/ChatMessageContent'
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
  clearLocalSenChatUser,
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
  verifyIdentityKeyIntegrity,
  generateIdentityKeyPair,
} from '@/lib/senChatSignalProtocol.mjs'

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

  // Cuộc hội thoại và tin nhắn
  const [conversations, setConversations] = useState<SenChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SenChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

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
  const [showInfoSidebar, setShowInfoSidebar] = useState(true)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showManageGroupModal, setShowManageGroupModal] = useState(false)
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
  const [offlineQueue, setOfflineQueue] = useState<SenChatMessage[]>([])

  // 📞 Call mock
  const [activeCallMode, setActiveCallMode] = useState<'none' | 'voice' | 'video'>('none')
  const [callDuration, setCallDuration] = useState(0)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const deviceId = useMemo(() => getOrCreateDeviceId(), [])

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

  // 2. Đồng bộ tài khoản SenExam chính thức từ Supabase & Bắt buộc Đăng nhập
  useEffect(() => {
    // Đăng ký bộ dọn dẹp tin nhắn tạm thời cục bộ khi đóng tab / thoát trang
    const cleanupEphemeral = setupEphemeralCleanupListener()

    const initAuthAndSync = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (auth?.user) {
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

          saveLocalSenChatUser(synchedUser)
          setCurrentUser(synchedUser)
          if (profile?.read_receipts_enabled !== undefined) {
            setReadReceiptsEnabled(profile.read_receipts_enabled)
          }

          // Tự động đăng ký thiết bị hiện tại lên chat_devices và ghi nhận nhật ký kiểm toán
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData?.session?.access_token
          if (token) {
            fetch('/api/chat/device-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'register', deviceId }),
            }).catch((devErr) => console.warn('Lỗi tự động đăng ký thiết bị Sen Chat:', devErr))
          }
        } else {
          // Chưa đăng nhập -> Tự động chuyển hướng sang Sen IDP với returnUrl=/chat
          router.replace('/new-idp?returnUrl=/chat')
          return
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ hồ sơ SenExam:', err)
        router.replace('/new-idp?returnUrl=/chat')
        return
      } finally {
        setIsInitializing(false)
      }
    }

    initAuthAndSync()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/new-idp?returnUrl=/chat')
      }
    })

    return () => {
      cleanupEphemeral()
      subscription.unsubscribe()
    }
  }, [router])

  // 3. Tải danh sách hội thoại
  const refreshConversations = () => {
    const list = getLocalConversations()
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

  // 4. Chọn hội thoại & Tính toán Safety Number Signal
  useEffect(() => {
    if (selectedConvId && currentUser) {
      const msgs = getLocalMessages(selectedConvId)
      setMessages(msgs)
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
      const verified = localStorage.getItem(`senchat_verified_${partnerId}`) === 'true'
      setIsPartnerVerified(verified)
    }
  }, [selectedConvId])

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 5. Kết nối Supabase Realtime Channel (Chỉ truyền Ciphertext & Metadata tối thiểu)
  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel('sen-chat-realtime-transit')
      .on('broadcast', { event: 'new_e2ee_message' }, ({ payload }) => {
        if (!payload) return

        // Bỏ qua tin nhắn chính mình vừa gửi (nếu echo lại từ kênh transit)
        if (payload.deviceId === deviceId || payload.senderId === currentUser.id) return

        // Kiểm tra xem tin nhắn có hướng tới tôi hoặc nhóm tôi đang tham gia không
        const activeOrMatchedConv = conversations.find(
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

        const incomingMsg: SenChatMessage = {
          id: payload.id || `msg_${Date.now()}`,
          conversationId: targetConvId,
          senderId: payload.senderId,
          senderName: payload.senderName || (payload.isSenAi ? 'SenAI' : 'Bạn bè'),
          receiverId: currentUser.id,
          content: payload.content || '',
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
        refreshConversations()
        if (selectedConvId === targetConvId) {
          setMessages((prev) => [...prev, incomingMsg])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, selectedConvId])

  // 6. Xử lý hàng đợi gửi tin khi offline
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const queueToProcess = [...offlineQueue]
      setOfflineQueue([])
      queueToProcess.forEach((queuedMsg) => {
        handleSendMessage(queuedMsg.content, queuedMsg.type, queuedMsg.attachmentUrl)
      })
    }
  }, [isOnline, offlineQueue])

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
      status: isOnline ? 'sent' : 'sending',
    }

    // Nếu có trả lời tin nhắn
    if (replyingToMessage) {
      newMsg.content = `[Trả lời: ${replyingToMessage.content.slice(0, 30)}...] ${newMsg.content}`
      setReplyingToMessage(null)
    }

    // Nếu đang offline, lưu vào hàng đợi gửi lại
    if (!isOnline) {
      setOfflineQueue((prev) => [...prev, newMsg])
    }

    // Lưu cục bộ ngay tức thì (Local-First)
    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])
    if (textToSend === undefined) setInputText('')

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

    // Gửi qua Server Realtime Broadcast / Transit Queue nếu có mạng
    if (isOnline) {
      try {
        await supabase.channel('sen-chat-realtime-transit').send({
          type: 'broadcast',
          event: 'new_e2ee_message',
          payload: {
            ...newMsg,
            deviceId,
          },
        })
      } catch (e) {
        console.warn('Realtime broadcast error, fallbacked to local:', e)
      }
    }
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
      status: isOnline ? 'sent' : 'sending',
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

    if (isOnline) {
      try {
        await supabase.channel('sen-chat-realtime-transit').send({
          type: 'broadcast',
          event: 'new_e2ee_message',
          payload: {
            ...newMsg,
            deviceId,
          },
        })
      } catch (e) {
        console.warn('Realtime broadcast error, fallbacked to local:', e)
      }
    }
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
            await supabase.channel('sen-chat-realtime-transit').send({
              type: 'broadcast',
              event: 'new_e2ee_message',
              payload: { ...sysMsg, deviceId },
            })
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
          await supabase.channel('sen-chat-realtime-transit').send({
            type: 'broadcast',
            event: 'new_e2ee_message',
            payload: { ...senAiMsg, deviceId },
          })
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

  // 8. Thu hồi tin nhắn (Recall)
  const handleRecallMessage = async (msgId: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tin nhắn này? Tin nhắn sẽ được xóa trên thiết bị người nhận.')) return

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

    // Cập nhật local
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, content: '[Tin nhắn đã được thu hồi]', type: 'system' } : m))
    )
  }

  // 9. Thả biểu cảm cảm xúc (Reactions)
  const handleAddReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            content: `${m.content} ${emoji}`,
          }
        }
        return m
      })
    )
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

  // Lọc hội thoại theo từ khóa
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      const matchName = c.partnerName.toLowerCase().includes(q)
      const matchLast = (c.lastMessage || '').toLowerCase().includes(q)
      const matchFilter = filterMode === 'all' || (filterMode === 'unread' && c.unreadCount > 0)
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
  const wallpaperObj = CHAT_WALLPAPERS.find((w) => w.id === currentWallpaper) || CHAT_WALLPAPERS[0]

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden font-sans antialiased transition-colors duration-200 ${
        isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* =========================================================================
          CỘT TẬN CÙNG BÊN TRÁI: THANH DỌC TÁC VỤ (FAR-LEFT VERTICAL DOCK)
         ========================================================================= */}
      <nav
        aria-label="Thanh tác vụ chính Sen Chat"
        className={`h-full w-16 md:w-[68px] shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-slate-100/90 py-3.5 dark:border-slate-800 dark:bg-slate-900/90 z-20 ${
          isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Top: Logo Sen Chat */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/chat"
            title="Sen Chat — Bảo mật đầu-cuối E2EE"
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
          </Link>

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
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-105'
                  : 'text-slate-600 hover:bg-white hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </button>

            {/* Thêm bạn bè qua Email */}
            <button
              type="button"
              onClick={() => setShowFriendModal(true)}
              title="Tìm & Thêm bạn qua Email chính xác"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
            >
              <UserPlus className="h-5 w-5" />
            </button>

            {/* Tạo nhóm MLS RFC 9420 */}
            <button
              type="button"
              onClick={() => setShowCreateGroupModal(true)}
              title="Tạo nhóm chat mới (MLS RFC 9420)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-teal-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-teal-400"
            >
              <Users className="h-5 w-5" />
            </button>

            {/* Trung tâm bảo mật & Thiết bị */}
            <button
              type="button"
              onClick={() => setShowDeviceManagerModal(true)}
              title="Trung tâm thiết bị & Bảo mật"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
            >
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </button>

            {/* Cài đặt */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Cài đặt Sen Chat"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bottom Actions: Theme Toggle & User Avatar */}
        <div className="flex flex-col items-center gap-3">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDarkMode ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white hover:text-amber-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-400"
          >
            {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 font-bold text-white shadow-sm ring-2 ring-emerald-500/30">
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
        {/* Top Header của Danh sách hội thoại */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
          <div>
            <h2 className="font-extrabold text-base tracking-tight text-slate-800 dark:text-slate-100">
              Đoạn chat
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
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
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
              placeholder="Tìm bạn bè hoặc tin nhắn..."
              className="min-h-[42px] w-full rounded-2xl border border-slate-200 bg-slate-100/70 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
            />
          </div>

          <div className="mt-2.5 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold transition ${
                filterMode === 'unread'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Chưa đọc {totalUnreadCount > 0 ? `(${totalUnreadCount})` : ''}
            </button>
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
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
              const nickname = getNicknameFor(c.partnerId)
              const displayName = nickname || c.partnerName

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConvId(c.id)}
                  className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100'
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 font-bold text-white shadow-sm">
                    {displayName.substring(0, 1).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-semibold text-xs text-slate-800 dark:text-slate-100">
                        {displayName}
                      </span>
                      <span className="text-[10px] text-slate-400">{c.lastMessageTime || ''}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {c.lastMessage || 'Bắt đầu trò chuyện...'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
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

                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 font-bold text-white shadow-sm">
                  {(currentNickname || activeConv.partnerName).substring(0, 1).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {currentNickname || activeConv.partnerName}
                    </h3>
                    {isPartnerVerified && (
                      <span title="Mã an toàn Signal đã xác minh">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    {activeConv.isGroup ? (
                      <button
                        type="button"
                        onClick={() => setShowManageGroupModal(true)}
                        className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                      >
                        <Users className="h-3 w-3" /> Nhóm MLS RFC 9420 (Quản lý)
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Lock className="h-3 w-3" /> Signal Double Ratchet
                      </span>
                    )}
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
                {activeConv.isGroup && (
                  <button
                    type="button"
                    onClick={() => setShowManageGroupModal(true)}
                    title="Quản lý thành viên nhóm MLS"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-slate-800"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowChatSearch(!showChatSearch)}
                  title="Tìm trong tin nhắn"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCallMode('voice')}
                  title="Gọi thoại mã hóa"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800"
                >
                  <Phone className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCallMode('video')}
                  title="Gọi video mã hóa"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800"
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

            {/* Khung cuộn tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                      className={`group flex flex-col ${
                        msg.type === 'system' ? 'items-center my-1' : isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {msg.type === 'system' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-xs max-w-[85%] text-center">
                          <Info className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          <span>{msg.content}</span>
                        </div>
                      ) : (
                        <div className="flex items-end gap-1.5 max-w-[80%]">
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
                                    {msg.status === 'sending' ? (
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
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-600/20'
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

                              {/* Đính kèm tệp / ảnh mã hóa E2EE */}
                              {(msg.attachmentId || msg.driveFileId || msg.fileKeyBase64) && (
                                <div className="mb-2">
                                  <ChatAttachmentBubble
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
                                isMe ? 'text-emerald-100/80' : 'text-slate-400'
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
                                  {msg.status === 'sending' ? (
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
                          </div>
                        )}

                        {/* Message Action Bar (Reply, Reaction, Recall) */}
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setReplyingToMessage(msg)}
                            title="Trả lời trích dẫn"
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddReaction(msg.id, '❤️')}
                            title="Thả tim"
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                          >
                            ❤️
                          </button>

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
              <div className="flex items-center justify-between border-t border-slate-200/60 bg-emerald-50/80 px-4 py-2 dark:border-slate-800 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
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
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      const val = e.target.value
                      setInputText(val)
                      const suggestions = getSenAiAutocompleteSuggestions(val)
                      setSenAiSuggestions(suggestions)
                      setShowSenAiAutocomplete(suggestions.length > 0)
                    }}
                    placeholder="Nhập tin nhắn bảo mật E2EE (gõ @Sen để hỏi AI)..."
                    className="min-h-[44px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs outline-none transition focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-1 flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
            <div className="max-w-lg w-full flex flex-col items-center space-y-6">
              <div className="relative">
                <img
                  src="/sen-chat-logo.png"
                  alt="Sen Chat"
                  className="h-20 w-20 rounded-3xl shadow-xl shadow-emerald-500/15 object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900">
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
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs mb-1">
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
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-95"
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
          CỘT PHẢI: THÔNG TIN HỘI THOẠI & BẢO MẬT (320px)
         ========================================================================= */}
      {showInfoSidebar && activeConv && (
        <aside className="hidden lg:flex h-full w-[320px] flex-col border-l border-slate-200/80 bg-white/95 p-4 overflow-y-auto backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Chi Tiết Hội Thoại
            </h3>
            <button
              type="button"
              onClick={() => setShowInfoSidebar(false)}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Profile Card */}
          <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 font-bold text-xl text-white shadow-md">
              {(currentNickname || activeConv.partnerName).substring(0, 1).toUpperCase()}
            </div>
            <h4 className="mt-2.5 font-bold text-sm text-slate-800 dark:text-slate-100">
              {currentNickname || activeConv.partnerName}
            </h4>
            <p className="text-xs text-slate-400">ID: {activeConv.partnerId.slice(0, 12)}...</p>

            <button
              type="button"
              onClick={() => {
                setNewNicknameInput(currentNickname || activeConv.partnerName)
                setShowNicknameModal(true)
              }}
              className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Edit3 className="h-3.5 w-3.5" /> Đặt biệt danh
            </button>
          </div>

          {/* Signal E2EE Safety Number Widget */}
          <ChatSafetyWidget
            partnerId={activeConv.partnerId}
            partnerName={currentNickname || activeConv.partnerName}
            safetyNumber={safetyNumberData}
            keyChanged={keyChangedAlert}
            isVerified={isPartnerVerified}
            onMarkVerified={(verified) => {
              setIsPartnerVerified(verified)
              localStorage.setItem(`senchat_verified_${activeConv.partnerId}`, String(verified))
            }}
          />

          {/* Disappearing Messages Setting */}
          <ChatDisappearingMessages
            currentTtl={disappearingTtl}
            onChangeTtl={(ttl) => setDisappearingTtl(ttl)}
          />

          {/* Block / Report Controls */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleToggleBlock}
              className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
                isCurrentBlocked
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400'
              }`}
            >
              {isCurrentBlocked ? <Unlock className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {isCurrentBlocked ? 'Bỏ chặn người này' : 'Chặn người dùng này'}
            </button>
          </div>
        </aside>
      )}

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
                className="min-h-[40px] rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white"
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
        onClose={() => setShowFriendModal(false)}
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
          refreshConversations()
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
        isCreatingNew={true}
        onGroupCreated={(convId, title) => {
          saveLocalConversation({
            id: convId,
            partnerId: convId,
            partnerName: title,
            partnerIdentifier: 'MLS_GROUP',
            unreadCount: 0,
            updatedAt: Date.now(),
            isGroup: true,
          })
          setSelectedConvId(convId)
          refreshConversations()
        }}
      />

      {/* Quản lý thành viên & thông tin nhóm MLS */}
      {activeConv && activeConv.isGroup && (
        <ChatMlsGroupModal
          isOpen={showManageGroupModal}
          onClose={() => setShowManageGroupModal(false)}
          conversationId={activeConv.id}
          groupTitle={activeConv.partnerName}
          groupAvatar={activeConv.avatarUrl || ''}
          currentUserId={currentUser?.id || ''}
          currentUserEmail={currentUser?.email || ''}
          isCreatingNew={false}
          onGroupUpdated={() => {
            refreshConversations()
          }}
        />
      )}

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
              status: isOnline ? 'sent' : 'sending',
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
              supabase.channel('sen-chat-realtime-transit').send({
                type: 'broadcast',
                event: 'new_e2ee_message',
                payload: { ...newMsg, deviceId },
              }).catch(() => {})
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
        currentUser={currentUser}
        userPlanTier={userPlanTier}
        deviceId={deviceId}
        onOpenDeviceManager={() => setShowDeviceManagerModal(true)}
        onMessagesCleared={() => {
          setMessages([])
          refreshConversations()
        }}
        onLoggedOut={() => {
          router.replace('/new-idp?returnUrl=/chat')
        }}
      />
    </div>
  )
}
