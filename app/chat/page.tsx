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
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import SenChatLogo from '@/components/SenChatLogo'
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
  exportLocalData,
  importLocalData,
  getNicknameFor,
  setNicknameFor,
  isUserBlocked,
  blockUser,
  unblockUser,
  getWallpaperFor,
  setWallpaperFor,
} from '@/lib/senChatStorage'

// Bộ sticker / biểu cảm nhanh
const QUICK_EMOJIS = ['😀', '😂', '😍', '👍', '❤️', '🎉', '🔥', '👏', '🙏', '😭', '😎', '💯']

export default function SenChatPage() {
  const [currentUser, setCurrentUser] = useState<SenChatUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [activeRailTab, setActiveRailTab] = useState<'messages' | 'contacts' | 'wallpapers' | 'sync'>('messages')

  // Cuộc hội thoại và tin nhắn
  const [conversations, setConversations] = useState<SenChatConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SenChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  // State các tính năng nâng cao
  const [currentNickname, setCurrentNickname] = useState<string | null>(null)
  const [isCurrentBlocked, setIsCurrentBlocked] = useState(false)
  const [currentWallpaper, setCurrentWallpaper] = useState<ChatWallpaperId>('default')

  // Modals & Panels
  const [showInfoSidebar, setShowInfoSidebar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [newNicknameInput, setNewNicknameInput] = useState('')
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)

  // Auth Modal State (Đồng bộ tài khoản SenExam)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMethod, setAuthMethod] = useState<'senexam' | 'phone' | 'email'>('senexam')
  const [authInput, setAuthInput] = useState('')
  const [authName, setAuthName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [senexamProfileFound, setSenexamProfileFound] = useState<any>(null)

  // New Chat Search State
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearchingUser, setIsSearchingUser] = useState(false)

  // Sync Device Transfer State
  const [syncCode, setSyncCode] = useState('')
  const [inputSyncCode, setInputSyncCode] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)

  // 📞 Chế độ Gọi Thường & Video Call
  const [activeCallMode, setActiveCallMode] = useState<'none' | 'voice' | 'video'>('none')
  const [callDuration, setCallDuration] = useState(0)
  const [isCallConnected, setIsCallConnected] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const callStreamRef = useRef<MediaStream | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Khởi tạo & Đồng bộ tài khoản SenExam chính thức từ Supabase
  useEffect(() => {
    document.documentElement.classList.remove('dark')

    const initAuthAndSync = async () => {
      try {
        // Kiểm tra phiên đăng nhập SenExam hiện tại
        const { data: auth } = await supabase.auth.getUser()
        if (auth?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone_number, phone, avatar_url, school, class_name, grade, role')
            .eq('id', auth.user.id)
            .maybeSingle()

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

          setSenexamProfileFound(synchedUser)

          // Nếu chưa có local user hoặc muốn cập nhật dữ liệu mới nhất từ SenExam
          const localUser = getLocalSenChatUser()
          if (!localUser || localUser.id === synchedUser.id) {
            saveLocalSenChatUser(synchedUser)
            setCurrentUser(synchedUser)
          } else {
            setCurrentUser(localUser)
          }
        } else {
          // Chưa đăng nhập SenExam, kiểm tra local user cũ
          const localUser = getLocalSenChatUser()
          if (localUser) {
            setCurrentUser(localUser)
          }
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ hồ sơ SenExam:', err)
        const localUser = getLocalSenChatUser()
        if (localUser) setCurrentUser(localUser)
      } finally {
        setIsInitializing(false)
      }
    }

    initAuthAndSync()
  }, [])

  // 2. Tải danh sách hội thoại
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

  // 3. Tải tin nhắn & cập nhật trạng thái hội thoại được chọn (Biệt danh, Chặn, Hình nền)
  useEffect(() => {
    if (selectedConvId) {
      const msgs = getLocalMessages(selectedConvId)
      setMessages(msgs)
      setIsMobileListVisible(false)

      const activeConv = conversations.find((c) => c.id === selectedConvId)
      const partnerId = activeConv?.partnerId || selectedConvId

      // Lấy biệt danh
      const nick = getNicknameFor(partnerId)
      setCurrentNickname(nick)

      // Kiểm tra xem đã chặn chưa
      const blocked = isUserBlocked(partnerId)
      setIsCurrentBlocked(blocked)

      // Lấy hình nền
      const wp = getWallpaperFor(selectedConvId)
      setCurrentWallpaper(wp)

      // Đánh dấu đã đọc
      const convs = getLocalConversations()
      const c = convs.find((item) => item.id === selectedConvId)
      if (c && c.unreadCount > 0) {
        c.unreadCount = 0
        saveLocalConversation(c)
        setConversations([...convs])
      }
    }
  }, [selectedConvId, conversations])

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 4. Polling Hàng Đợi Đồng Bộ Server & XÓA NGAY LẬP TỨC TRÊN SERVER
  useEffect(() => {
    if (!currentUser) return

    const pollSyncQueue = async () => {
      try {
        const identifiers = [
          currentUser.id,
          currentUser.identifier.toLowerCase(),
          currentUser.email?.toLowerCase(),
          currentUser.phone?.toLowerCase(),
        ].filter(Boolean)

        for (const rId of identifiers) {
          if (!rId) continue
          const res = await fetch('/api/chat/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'pull',
              receiverId: rId,
              deviceId: getOrCreateDeviceId(),
            }),
          })
          const data = await res.json()

          if (data.success && data.messages && data.messages.length > 0) {
            data.messages.forEach((m: any) => {
              const sender = m.senderId || 'unknown'

              // Nếu người gửi nằm trong danh sách chặn thì bỏ qua tin nhắn
              if (isUserBlocked(sender)) {
                return
              }

              const convId = sender
              const localMsg: SenChatMessage = {
                id: m.id || 'msg_' + Date.now(),
                conversationId: convId,
                senderId: m.senderId,
                senderName: m.senderName || 'Bạn bè',
                receiverId: currentUser.id,
                content: m.content || '',
                type: m.type || 'text',
                attachmentUrl: m.attachmentUrl,
                attachmentName: m.attachmentName,
                attachmentSize: m.attachmentSize,
                createdAt: m.createdAt || new Date().toISOString(),
                status: 'received',
              }

              saveLocalMessage(convId, localMsg)

              const existingConv = getLocalConversations().find((c) => c.id === convId)
              saveLocalConversation({
                id: convId,
                partnerId: m.senderId,
                partnerName: m.senderName || 'Thành viên SenExam',
                partnerIdentifier: m.senderId,
                lastMessage: localMsg.content,
                lastMessageTime: new Date(localMsg.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                unreadCount: (existingConv?.unreadCount || 0) + 1,
                updatedAt: Date.now(),
              })
            })

            refreshConversations()
            if (selectedConvId) {
              setMessages(getLocalMessages(selectedConvId))
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi polling Sen Chat sync queue:', err)
      }
    }

    pollSyncQueue()
    const interval = setInterval(pollSyncQueue, 3500)
    return () => clearInterval(interval)
  }, [currentUser, selectedConvId])

  // 5. Gửi Tin Nhắn
  const handleSendMessage = async (
    textToSend?: string,
    type: 'text' | 'image' | 'like' | 'system' = 'text',
    mediaUrl?: string
  ) => {
    if (isCurrentBlocked) {
      alert('Bạn đã chặn người dùng này. Hãy bỏ chặn để tiếp tục nhắn tin.')
      return
    }

    const content = (textToSend !== undefined ? textToSend : inputText).trim()
    if (!content && type === 'text') return
    if (!selectedConvId || !currentUser) return

    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    const newMsg: SenChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      conversationId: selectedConvId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: activeConv.partnerId,
      content: content || (type === 'like' ? '👍' : '[Hình ảnh]'),
      type,
      attachmentUrl: mediaUrl,
      createdAt: new Date().toISOString(),
      status: 'sent',
    }

    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])
    setInputText('')
    setShowEmojiPicker(false)
    refreshConversations()

    // Gửi vào hàng đợi đồng bộ trung chuyển server (xóa ngay khi đối tác nhận)
    try {
      await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId: activeConv.partnerIdentifier || activeConv.partnerId,
          deviceId: getOrCreateDeviceId(),
          message: newMsg,
        }),
      })
    } catch (sendErr) {
      console.warn('Lỗi gửi sync transit queue:', sendErr)
    }
  }

  // 6. Xử lý Đăng nhập với SenExam hoặc Form bổ sung
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthError(null)

    if (authMethod === 'senexam') {
      if (senexamProfileFound) {
        saveLocalSenChatUser(senexamProfileFound)
        setCurrentUser(senexamProfileFound)
        setShowAuthModal(false)
      } else {
        window.location.href = '/new-sign?redirect=/chat'
      }
      return
    }

    const inputVal = authInput.trim()
    const nameVal = authName.trim() || `Thành viên (${inputVal.slice(0, 5)})`

    if (!inputVal) {
      setAuthError('Vui lòng nhập số điện thoại hoặc email')
      return
    }

    setAuthLoading(true)
    const newUser: SenChatUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: nameVal,
      identifier: inputVal,
      authType: authMethod,
      phone: authMethod === 'phone' ? inputVal : undefined,
      email: authMethod === 'email' ? inputVal : undefined,
      createdAt: new Date().toISOString(),
    }

    saveLocalSenChatUser(newUser)
    setCurrentUser(newUser)
    setAuthLoading(false)
    setShowAuthModal(false)
  }

  // 7. Xử lý Tính Năng Đặt Tên Thân Thuộc (Biệt danh như Messenger)
  const handleSaveNickname = () => {
    if (!selectedConvId) return
    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    const trimmed = newNicknameInput.trim()
    setNicknameFor(activeConv.partnerId, trimmed)
    setCurrentNickname(trimmed || null)
    setShowNicknameModal(false)

    // Thêm tin nhắn hệ thống ghi nhận đổi biệt danh
    if (trimmed) {
      handleSendMessage(`✨ Đã đặt tên thân thuộc là "${trimmed}"`, 'system')
    } else {
      handleSendMessage(`Đã gỡ tên thân thuộc`, 'system')
    }
  }

  // 8. Xử lý Tính Năng Chặn Người Dùng
  const handleToggleBlock = () => {
    if (!selectedConvId) return
    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    if (isCurrentBlocked) {
      unblockUser(activeConv.partnerId)
      setIsCurrentBlocked(false)
      handleSendMessage('Đã bỏ chặn người dùng này', 'system')
    } else {
      if (confirm(`Bạn có chắc chắn muốn chặn ${displayName}? Bạn sẽ không thể gửi và nhận tin nhắn từ người này.`)) {
        blockUser(activeConv.partnerId)
        setIsCurrentBlocked(true)
        handleSendMessage('🚫 Bạn đã chặn người dùng này', 'system')
      }
    }
  }

  // 9. Xử lý Tính Năng Đổi Nền Nhắn Tin
  const handleSelectWallpaper = (wpId: ChatWallpaperId) => {
    if (!selectedConvId) return
    setWallpaperFor(selectedConvId, wpId)
    setCurrentWallpaper(wpId)
    setShowWallpaperModal(false)
  }

  // 10. Chế độ Gọi Thoại (Voice Call) & Video Call
  const startCall = async (mode: 'voice' | 'video') => {
    if (isCurrentBlocked) {
      alert('Không thể gọi cho người dùng đang bị chặn.')
      return
    }

    setActiveCallMode(mode)
    setCallDuration(0)
    setIsCallConnected(false)
    setIsMicMuted(false)
    setIsCameraOff(false)

    // Khởi động Camera và Mic thực tế
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === 'video',
        })
        callStreamRef.current = stream

        if (localVideoRef.current && mode === 'video') {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.play().catch(() => {})
        }
      }
    } catch (e) {
      console.warn('Không thể truy cập camera/micro thực tế:', e)
    }

    // Mô phỏng kết nối cuộc gọi sau 2.5 giây
    setTimeout(() => {
      setIsCallConnected(true)
      callTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1)
      }, 1000)
    }, 2500)
  }

  const endCall = () => {
    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach((track) => track.stop())
      callStreamRef.current = null
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    setActiveCallMode('none')
    setCallDuration(0)
    setIsCallConnected(false)
  }

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // 11. Tìm Kiếm & Bắt Đầu Chat Mới
  const handleSearchUsers = async (q: string) => {
    setUserSearchQuery(q)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearchingUser(true)
    try {
      const res = await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search_user', query: q.trim() }),
      })
      const data = await res.json()
      setSearchResults(data.users || [])
    } catch (e) {
      console.warn('Lỗi tìm kiếm bạn bè:', e)
    } finally {
      setIsSearchingUser(false)
    }
  }

  const handleStartChatWith = (user: any) => {
    const convId = user.id || user.identifier || 'conv_' + Date.now()
    const newConv: SenChatConversation = {
      id: convId,
      partnerId: user.id || user.identifier,
      partnerName: user.name || 'Thành viên SenExam',
      partnerIdentifier: user.identifier || user.phone || user.email || convId,
      partnerAvatar: user.avatar,
      lastMessage: 'Đã kết nối cuộc trò chuyện',
      lastMessageTime: 'Vừa xong',
      unreadCount: 0,
      updatedAt: Date.now(),
    }

    saveLocalConversation(newConv)
    refreshConversations()
    setSelectedConvId(convId)
    setShowNewChatModal(false)
    setUserSearchQuery('')
    setSearchResults([])
  }

  // 12. Tạo & Nạp Mã Đồng Bộ Chuyển Máy
  const handleGenerateBackupCode = async () => {
    if (!currentUser) return
    setSyncLoading(true)
    setSyncStatusMsg(null)

    try {
      const localDataJson = exportLocalData()
      const res = await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_backup',
          senderId: currentUser.id,
          senderName: currentUser.name,
          deviceId: getOrCreateDeviceId(),
          payload: JSON.parse(localDataJson),
        }),
      })
      const data = await res.json()
      if (data.success && data.syncCode) {
        setSyncCode(data.syncCode)
        setSyncStatusMsg('Đã tạo mã đồng bộ! Nhập mã 6 số này trên máy khác để chuyển toàn bộ dữ liệu.')
      } else {
        setSyncStatusMsg('Không thể tạo mã đồng bộ.')
      }
    } catch (e: any) {
      setSyncStatusMsg('Lỗi tạo gói đồng bộ: ' + (e?.message || e))
    } finally {
      setSyncLoading(false)
    }
  }

  const handlePullBackupCode = async () => {
    if (!currentUser || !inputSyncCode.trim()) return
    setSyncLoading(true)
    setSyncStatusMsg(null)

    try {
      const res = await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull_backup',
          receiverId: currentUser.id,
          syncCode: inputSyncCode.trim(),
        }),
      })
      const data = await res.json()
      if (data.success && data.payload) {
        const success = importLocalData(JSON.stringify(data.payload))
        if (success) {
          refreshConversations()
          if (selectedConvId) {
            setMessages(getLocalMessages(selectedConvId))
          }
          setSyncStatusMsg('🎉 Đồng bộ thành công! Toàn bộ tin nhắn đã được nạp vào máy này. Máy chủ đã giải phóng dữ liệu.')
          setInputSyncCode('')
        } else {
          setSyncStatusMsg('Lỗi định dạng dữ liệu.')
        }
      } else {
        setSyncStatusMsg(data.error || 'Mã đồng bộ không chính xác hoặc đã hết hạn.')
      }
    } catch (e: any) {
      setSyncStatusMsg('Lỗi nạp sao lưu: ' + (e?.message || e))
    } finally {
      setSyncLoading(false)
    }
  }

  // Tải hình ảnh
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      handleSendMessage('', 'image', base64)
    }
    reader.readAsDataURL(file)
  }

  // Lọc cuộc trò chuyện theo tìm kiếm & bộ lọc
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const nick = getNicknameFor(c.partnerId) || ''
      const matchSearch =
        c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.partnerIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nick.toLowerCase().includes(searchQuery.toLowerCase())
      const matchFilter = filterMode === 'all' || (filterMode === 'unread' && c.unreadCount > 0)
      return matchSearch && matchFilter
    })
  }, [conversations, searchQuery, filterMode])

  const activeConversation = conversations.find((c) => c.id === selectedConvId)
  const displayName = currentNickname || activeConversation?.partnerName || 'Cuộc trò chuyện'
  const currentWpConfig = CHAT_WALLPAPERS.find((w) => w.id === currentWallpaper) || CHAT_WALLPAPERS[0]

  // MÀN HÌNH CHỜ KHỞI TẠO
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <SenChatLogo size={56} />
          <div className="flex items-center gap-2 text-sky-600 font-bold text-sm">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
            Đang khởi động Sen Chat Liquid Glass...
          </div>
        </div>
      </div>
    )
  }

  // MÀN HÌNH ĐĂNG NHẬP / ĐỒNG BỘ NẾU CHƯA CÓ SESSION
  if (!currentUser) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#F4F7FB] flex items-center justify-center p-4">
        {/* Ambient Glowing Liquid Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-sky-950/10 p-8 space-y-6 text-center relative z-10">
          <div className="mx-auto flex justify-center">
            <SenChatLogo size={68} showText />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900">Kết Nối Với Sen Chat</h1>
            <p className="text-xs text-slate-500">
              Nhắn tin bảo mật Local-First • Giao diện Liquid Glass TSV FEPN
            </p>
          </div>

          {senexamProfileFound ? (
            <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 text-xs space-y-3 text-left">
              <div className="flex items-center gap-2 font-bold text-sky-950">
                <UserCheck className="w-4 h-4 text-sky-600" />
                <span>Tài khoản SenExam có sẵn:</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow">
                  {senexamProfileFound.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{senexamProfileFound.name}</p>
                  <p className="text-slate-500 text-[11px] font-mono">{senexamProfileFound.email || senexamProfileFound.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLoginSubmit()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20 transition cursor-pointer"
              >
                Tiếp Tục Với Tài Khoản Này
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Link
                href="/new-sign?redirect=/chat"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Đăng Nhập Qua Cổng SenExam</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full py-3 rounded-2xl bg-white/80 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Dùng Số Điện Thoại / Email Khác
              </button>
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dữ liệu lưu cục bộ trên máy bạn • Server xóa ngay sau khi nhận</span>
          </div>
        </div>
      </div>
    )
  }

  // 🌟 GIAO DIỆN CHÍNH: SEN CHAT FLOATING LIQUID GLASS DOCK
  return (
    <div
      className="h-screen w-screen overflow-hidden select-none text-slate-800 font-sans flex p-2 sm:p-3 lg:p-4 gap-2.5 sm:gap-3 relative"
      style={{
        background:
          'radial-gradient(circle at 10% 10%, rgba(2, 132, 199, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(79, 70, 229, 0.16), transparent 40%), #F4F7FB',
      }}
    >
      {/* Background Floating Orbs */}
      <div className="absolute top-10 left-1/3 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* 🌟 CỘT 1: FLOATING DOCK RAIL (Thanh biểu tượng kính mờ nổi) */}
      <nav aria-label="Thanh điều hướng chính Sen Chat"
        className="w-16 sm:w-20 rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-sky-950/5 flex flex-col items-center justify-between py-4 shrink-0 z-30 transition-all"
      >
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo Sen Chat */}
          <Link href="/chat" className="group" title="Sen Chat">
            <SenChatLogo size={42} showText={false} />
          </Link>

          <div className="w-8 h-px bg-slate-200/80"></div>

          {/* Tab Tin nhắn */}
          <button
            type="button"
            onClick={() => setActiveRailTab('messages')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative ${
              activeRailTab === 'messages'
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'text-slate-500 hover:bg-white/80 hover:text-sky-600'
            }`}
            title="Tin nhắn"
          >
            <MessageSquare className="w-5 h-5" />
            {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none animate-pulse">
                {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
              </span>
            )}
          </button>

          {/* Tab Danh bạ / Thêm bạn */}
          <button
            type="button"
            onClick={() => {
              setActiveRailTab('contacts')
              setShowNewChatModal(true)
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeRailTab === 'contacts'
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'text-slate-500 hover:bg-white/80 hover:text-sky-600'
            }`}
            title="Tìm kiếm bạn bè / Tạo trò chuyện"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Tab Thay đổi hình nền chat */}
          <button
            type="button"
            onClick={() => setShowWallpaperModal(true)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-white/80 hover:text-sky-600 transition cursor-pointer"
            title="Đổi hình nền trò chuyện"
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Tab Đồng bộ chuyển máy */}
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-white/80 hover:text-sky-600 transition cursor-pointer"
            title="Đồng bộ dữ liệu sang thiết bị khác"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar người dùng & Đăng xuất */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative cursor-pointer group"
            onClick={() => setShowInfoSidebar(true)}
            title={`Hồ sơ: ${currentUser.name}`}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 border-2 border-white/80 flex items-center justify-center font-black text-sm text-white shadow-md group-hover:scale-105 transition">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('Bạn có chắc muốn đăng xuất khỏi Sen Chat trên máy này?')) {
                clearLocalSenChatUser()
                setCurrentUser(null)
              }
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* 🌟 CỘT 2: FLOATING CONVERSATION LIST (Danh sách hội thoại bo góc nổi) */}
      <section aria-label="Danh sách cuộc trò chuyện"
        className={`w-full md:w-80 lg:w-96 rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-sky-950/5 flex flex-col shrink-0 overflow-hidden ${
          isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Header tìm kiếm & Thêm bạn */}
        <div className="p-3.5 border-b border-slate-100/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-black text-base text-slate-900 tracking-tight">Đoạn Chat</span>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="p-2 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold transition cursor-pointer shadow-sm flex items-center gap-1 text-xs"
              title="Thêm cuộc trò chuyện mới"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tạo Chat</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tin nhắn, bạn bè..."
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-100/80 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`pb-1 cursor-pointer transition relative ${
                filterMode === 'all' ? 'text-sky-600 font-black' : 'hover:text-slate-800'
              }`}
            >
              <span>Tất cả</span>
              {filterMode === 'all' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"></span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`pb-1 cursor-pointer transition relative ${
                filterMode === 'unread' ? 'text-sky-600 font-black' : 'hover:text-slate-800'
              }`}
            >
              <span>Chưa đọc</span>
              {filterMode === 'unread' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold">Chưa có cuộc trò chuyện nào</p>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:scale-105 transition cursor-pointer"
              >
                Nhắn tin với bạn bè
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId
              const nick = getNicknameFor(conv.partnerId)
              const titleName = nick || conv.partnerName
              const isBlocked = isUserBlocked(conv.partnerId)

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all relative ${
                    isSelected
                      ? 'bg-sky-500/10 border border-sky-500/20 shadow-sm'
                      : 'hover:bg-white/60 border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm">
                      {titleName.charAt(0).toUpperCase()}
                    </div>
                    {!isBlocked && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    )}
                    {isBlocked && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-white text-[8px] font-bold">
                        ✕
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {titleName}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {conv.lastMessageTime || ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {isBlocked ? '🚫 Đã chặn người dùng này' : conv.lastMessage || 'Bắt đầu cuộc trò chuyện'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none shrink-0 shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* 🌟 CỘT 3: FLOATING MAIN CHAT WINDOW (Khung chat chính Liquid Glass) */}
      <main aria-label="Nội dung cuộc trò chuyện"
        className={`flex-1 rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-sky-950/5 flex flex-col min-w-0 overflow-hidden relative ${
          !isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Header phòng chat */}
            <header className="h-16 bg-white/60 backdrop-blur-xl border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileListVisible(true)}
                  className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {!isCurrentBlocked && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full"></span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                      {displayName}
                    </h2>
                    {currentNickname && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({activeConversation.partnerName})
                      </span>
                    )}
                    <span title="Thành viên SenExam">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-medium block">
                    {isCurrentBlocked ? (
                      <span className="text-rose-500 font-bold">🚫 Đang bị chặn</span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Đang hoạt động • {activeConversation.partnerIdentifier}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Voice Call, Video Call, Wallpaper, Info */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Nút Gọi thường */}
                <button
                  type="button"
                  onClick={() => startCall('voice')}
                  disabled={isCurrentBlocked}
                  className="p-2 rounded-2xl text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition cursor-pointer disabled:opacity-30"
                  title="Gọi thoại"
                >
                  <Phone className="w-4 h-4" />
                </button>

                {/* Nút Video Call */}
                <button
                  type="button"
                  onClick={() => startCall('video')}
                  disabled={isCurrentBlocked}
                  className="p-2 rounded-2xl text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition cursor-pointer disabled:opacity-30"
                  title="Gọi video"
                >
                  <Video className="w-4 h-4" />
                </button>

                {/* Nút Đổi nền chat */}
                <button
                  type="button"
                  onClick={() => setShowWallpaperModal(true)}
                  className="p-2 rounded-2xl text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition cursor-pointer"
                  title="Đổi hình nền chat"
                >
                  <Palette className="w-4 h-4" />
                </button>

                {/* Nút Thông tin hội thoại */}
                <button
                  type="button"
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  className="p-2 rounded-2xl text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition cursor-pointer"
                  title="Tùy chọn hội thoại"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Thông báo nếu đã chặn người dùng */}
            {isCurrentBlocked && (
              <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 flex items-center justify-between shrink-0">
                <span className="flex items-center gap-1.5 font-bold">
                  <Ban className="w-4 h-4" /> Bạn đã chặn người dùng này. Không thể gửi hoặc nhận tin nhắn mới.
                </span>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition cursor-pointer"
                >
                  Bỏ Chặn
                </button>
              </div>
            )}

            {/* Danh sách Tin Nhắn (Stream with dynamic wallpaper) */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3 transition-colors duration-300"
              style={{ background: currentWpConfig.bgStyle }}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/70 backdrop-blur-md flex items-center justify-center text-sky-600 shadow-sm">
                    <Smile className="w-6 h-6" />
                  </div>
                  <p>Hãy gửi lời chào đến {displayName}!</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Xin chào! 👋')}
                      className="px-3.5 py-1.5 bg-white/80 backdrop-blur-md border border-white/60 rounded-full text-xs text-slate-700 hover:bg-sky-50 transition cursor-pointer shadow-sm"
                    >
                      Xin chào! 👋
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Rất vui được kết nối trên Sen Chat!')}
                      className="px-3.5 py-1.5 bg-white/80 backdrop-blur-md border border-white/60 rounded-full text-xs text-slate-700 hover:bg-sky-50 transition cursor-pointer shadow-sm"
                    >
                      Rất vui được kết nối!
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id

                  // Tin nhắn hệ thống (đổi biệt danh, chặn, v.v.)
                  if (msg.type === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-full bg-slate-200/60 backdrop-blur-md text-slate-600 text-[11px] font-semibold">
                          {msg.content}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}
                    >
                      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%]`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mb-1 shadow-sm">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-md relative break-words backdrop-blur-xl ${
                            isMine
                              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-br-none shadow-sky-500/10'
                              : 'bg-white/90 text-slate-900 border border-white/80 rounded-bl-none shadow-slate-900/5'
                          }`}
                        >
                          {/* Hình ảnh */}
                          {msg.type === 'image' && msg.attachmentUrl && (
                            <div className="mb-1 rounded-xl overflow-hidden max-w-sm bg-black/5">
                              <img
                                src={msg.attachmentUrl}
                                alt="Hình ảnh chia sẻ"
                                className="w-full h-auto object-cover max-h-72"
                              />
                            </div>
                          )}

                          {/* Nút like */}
                          {msg.type === 'like' ? (
                            <span className="text-3xl">👍</span>
                          ) : (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Thời gian & Trạng thái */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isMine ? 'text-white/80' : 'text-slate-400'
                            }`}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMine && (
                              <span title="Đã chuyển thành công">
                                <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Thanh Công Cụ & Nhập Tin Nhắn */}
            <div className="bg-white/70 backdrop-blur-xl border-t border-slate-200/70 p-2 sm:p-3 shrink-0">
              {/* Quick Emojis Bar */}
              {showEmojiPicker && (
                <div className="flex items-center gap-1 pb-2 border-b border-slate-100 mb-2 overflow-x-auto">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSendMessage(emoji)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-lg transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 mb-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-1.5 rounded-xl hover:bg-white/80 transition cursor-pointer ${
                    showEmojiPicker ? 'text-sky-600 bg-sky-50' : ''
                  }`}
                  title="Biểu cảm"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 rounded-xl hover:bg-white/80 hover:text-sky-600 transition cursor-pointer"
                  title="Gửi hình ảnh"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-xl hover:bg-white/80 hover:text-sky-600 transition cursor-pointer"
                  title="Đính kèm tệp"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      handleSendMessage(`[Tệp tin: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]`)
                    }
                  }}
                />
              </div>

              {/* Textarea Input */}
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  disabled={isCurrentBlocked}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={
                    isCurrentBlocked
                      ? 'Bạn đã chặn người dùng này...'
                      : `Nhập tin nhắn gửi đến ${displayName}...`
                  }
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100/70 text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition disabled:opacity-50"
                />

                {inputText.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isCurrentBlocked}
                    className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white flex items-center justify-center transition shadow-md shadow-sky-500/20 cursor-pointer shrink-0 disabled:opacity-40"
                    title="Gửi tin nhắn"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage('', 'like')}
                    disabled={isCurrentBlocked}
                    className="w-10 h-10 rounded-2xl text-sky-600 hover:bg-sky-50 flex items-center justify-center transition cursor-pointer shrink-0 disabled:opacity-40"
                    title="Gửi Thích (👍)"
                  >
                    <ThumbsUp className="w-5 h-5 fill-sky-500" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
            <SenChatLogo size={64} showText={false} />
            <h3 className="text-lg font-black text-slate-800">Chào Mừng Bạn Đến Với Sen Chat</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Chọn một đoạn chat ở danh sách bên trái hoặc tạo cuộc trò chuyện mới để bắt đầu nhắn tin bảo mật chuẩn FEPN.
            </p>
          </div>
        )}
      </main>

      {/* 🌟 CỘT 4: THÔNG TIN HỘI THOẠI & QUẢN TRỊ TÍNH NĂNG (Right Drawer) */}
      {showInfoSidebar && activeConversation && (
        <aside aria-label="Thông tin hội thoại" className="w-80 rounded-3xl bg-white/85 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-sky-950/5 flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tùy Chọn Cuộc Trò Chuyện</h3>
            <button
              type="button"
              onClick={() => setShowInfoSidebar(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 text-center space-y-3 border-b border-slate-100">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{displayName}</h4>
              {currentNickname && (
                <p className="text-[11px] text-slate-500 font-medium">Tên thật: {activeConversation.partnerName}</p>
              )}
              <p className="text-xs text-sky-600 font-mono mt-0.5">{activeConversation.partnerIdentifier}</p>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto text-xs">
            {/* Các tùy chọn Messenger Style */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block px-2">Cá nhân hóa</span>

              {/* Đặt tên thân thuộc / Biệt danh */}
              <button
                type="button"
                onClick={() => {
                  setNewNicknameInput(currentNickname || '')
                  setShowNicknameModal(true)
                }}
                className="w-full py-2.5 px-3 rounded-2xl hover:bg-sky-50 text-slate-800 hover:text-sky-700 font-bold text-left flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 className="w-4 h-4 text-sky-600" />
                  <span>Đặt tên thân thuộc</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">
                  {currentNickname || 'Chưa đặt'}
                </span>
              </button>

              {/* Đổi hình nền trò chuyện */}
              <button
                type="button"
                onClick={() => setShowWallpaperModal(true)}
                className="w-full py-2.5 px-3 rounded-2xl hover:bg-sky-50 text-slate-800 hover:text-sky-700 font-bold text-left flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>Đổi hình nền chat</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal capitalize">
                  {currentWpConfig.name.split(' ')[0]}
                </span>
              </button>
            </div>

            {/* Quyền riêng tư & Bảo mật */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block px-2">Quyền riêng tư</span>

              {/* Chặn người dùng */}
              <button
                type="button"
                onClick={handleToggleBlock}
                className={`w-full py-2.5 px-3 rounded-2xl font-bold text-left flex items-center gap-2.5 transition cursor-pointer ${
                  isCurrentBlocked
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'hover:bg-rose-50 text-rose-600'
                }`}
              >
                {isCurrentBlocked ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Bỏ chặn người dùng này</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Chặn người dùng này</span>
                  </>
                )}
              </button>

              {/* Xóa lịch sử trên máy này */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử tin nhắn của cuộc trò chuyện này trên MÁY NÀY?')) {
                    clearAllLocalMessages(activeConversation.id)
                    setMessages([])
                    refreshConversations()
                  }
                }}
                className="w-full py-2.5 px-3 rounded-2xl hover:bg-slate-100 text-slate-600 font-bold text-left flex items-center gap-2.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa lịch sử trên máy này</span>
              </button>
            </div>

            {/* Sao lưu dữ liệu */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block px-2">Lưu trữ Local-First</span>
              <button
                type="button"
                onClick={() => {
                  const json = exportLocalData()
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `senchat_backup_${Date.now()}.json`
                  a.click()
                }}
                className="w-full py-2.5 px-3 rounded-2xl hover:bg-emerald-50 text-emerald-700 font-bold text-left flex items-center gap-2.5 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Xuất file sao lưu (JSON)</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 🌟 MODAL: GỌI THOẠI & VIDEO CALL (Voice & Video Call Screen) */}
      {activeCallMode !== 'none' && (
        <div className="fixed inset-0 z-[999] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-center space-y-6 text-white relative overflow-hidden">
            {/* Ambient call aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

            {/* Màn hình Video Call */}
            {activeCallMode === 'video' ? (
              <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                {/* Luồng video webcam người dùng */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`}
                />

                {isCameraOff && (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <VideoOff className="w-12 h-12 stroke-[1.5]" />
                    <span className="text-xs">Camera đã tắt</span>
                  </div>
                )}

                {/* Bong bóng Picture-in-Picture mô phỏng đối tác */}
                <div className="absolute top-3 right-3 w-28 h-36 rounded-xl bg-slate-800/80 backdrop-blur-md border border-slate-700 shadow-xl overflow-hidden flex flex-col items-center justify-center text-center p-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-bold text-white mt-1 truncate max-w-[90px]">
                    {displayName}
                  </span>
                  <span className="text-[9px] text-emerald-400">
                    {isCallConnected ? 'HD' : '...'}
                  </span>
                </div>

                {/* Badge trạng thái cuộc gọi */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isCallConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                  <span>{isCallConnected ? formatDuration(callDuration) : 'Đang đổ chuông...'}</span>
                </div>
              </div>
            ) : (
              /* Màn hình Gọi thoại Voice Call */
              <div className="py-8 space-y-6">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping pointer-events-none" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border-4 border-white/20 flex items-center justify-center text-white font-black text-3xl shadow-xl relative z-10">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">{displayName}</h3>
                  <p className="text-xs font-mono text-sky-400">
                    {isCallConnected ? `Thời lượng: ${formatDuration(callDuration)}` : 'Đang đổ chuông cuộc gọi thoại...'}
                  </p>
                </div>
              </div>
            )}

            {/* Thanh điều khiển cuộc gọi */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {/* Nút Bật/Tắt Mic */}
              <button
                type="button"
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-md ${
                  isMicMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={isMicMuted ? 'Bật micro' : 'Tắt micro'}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Nút Bật/Tắt Camera (nếu là video call) */}
              {activeCallMode === 'video' && (
                <button
                  type="button"
                  onClick={() => setIsCameraOff(!isCameraOff)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-md ${
                    isCameraOff ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                  title={isCameraOff ? 'Bật camera' : 'Tắt camera'}
                >
                  {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              )}

              {/* Nút Bật/Tắt Loa */}
              <button
                type="button"
                onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-md ${
                  isSpeakerMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={isSpeakerMuted ? 'Bật loa' : 'Tắt tiếng'}
              >
                {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Nút Kết Thúc Cuộc Gọi (Đỏ) */}
              <button
                type="button"
                onClick={endCall}
                className="w-14 h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-lg shadow-rose-600/30 cursor-pointer"
                title="Kết thúc cuộc gọi"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: ĐẶT TÊN THÂN THUỘC / BIỆT DANH (Messenger Style) */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-600" />
                <span>Đặt Tên Thân Thuộc</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNicknameModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Đặt biệt danh cho <strong>{activeConversation?.partnerName}</strong>. Biệt danh này chỉ hiển thị trên máy của bạn.
            </p>

            <input
              type="text"
              value={newNicknameInput}
              onChange={(e) => setNewNicknameInput(e.target.value)}
              placeholder="VD: Bạn Thân, Anh Minh, Em Hoa..."
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              autoFocus
            />

            <div className="flex gap-2 pt-2">
              {currentNickname && (
                <button
                  type="button"
                  onClick={() => {
                    setNewNicknameInput('')
                    setTimeout(handleSaveNickname, 0)
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                >
                  Gỡ Bỏ
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveNickname}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 hover:scale-[1.02] transition"
              >
                Lưu Biệt Danh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: ĐỔI HÌNH NỀN NHẮN TIN (Chat Wallpapers) */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                <span>Đổi Nền Nhắn Tin (Liquid Glass Wallpapers)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWallpaperModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Chọn giao diện nền Liquid Glass cho cuộc trò chuyện:
            </p>

            <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
              {CHAT_WALLPAPERS.map((wp) => {
                const isSelected = currentWallpaper === wp.id
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => handleSelectWallpaper(wp.id)}
                    className={`p-3 rounded-2xl border text-left transition relative cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-sky-600 ring-2 ring-sky-500/40 shadow-md'
                        : 'border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div
                      className={`w-full h-16 rounded-xl bg-gradient-to-br ${wp.previewClass} mb-2 border border-black/5 shadow-inner`}
                      style={{ background: wp.bgStyle }}
                    />
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {wp.name}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[9px] font-black">
                        Đang chọn
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: THÊM BẠN MỚI */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600" />
                <span>Tìm Bạn Bè / Bắt Đầu Chat</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Tìm kiếm bạn bè qua <strong>Email</strong>, <strong>Số điện thoại</strong> hoặc <strong>Họ tên</strong> trong SenExam:
              </p>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Nhập email, số điện thoại hoặc tên bạn bè..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-100/80 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                  autoFocus
                />
              </div>

              {/* Kết quả tìm kiếm */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-50">
                {isSearchingUser ? (
                  <p className="text-xs text-center text-slate-400 py-4">Đang tìm kiếm...</p>
                ) : searchResults.length > 0 ? (
                  searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleStartChatWith(u)}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-sky-50 cursor-pointer transition pt-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{u.phone || u.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-[11px] font-bold shadow-sm"
                      >
                        Nhắn tin
                      </button>
                    </div>
                  ))
                ) : userSearchQuery.trim().length >= 2 ? (
                  <div className="p-3 bg-slate-50 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      Chưa tìm thấy bạn bè này trong hệ thống. Bạn có thể mở ngay cuộc trò chuyện trực tiếp:
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleStartChatWith({
                          id: userSearchQuery.trim(),
                          name: `Bạn bè (${userSearchQuery.trim()})`,
                          identifier: userSearchQuery.trim(),
                        })
                      }
                      className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 transition"
                    >
                      Nhắn tin tới {userSearchQuery.trim()}
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center py-4">
                    Nhập ít nhất 2 ký tự để tìm kiếm
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: ĐỒNG BỘ CHUYỂN THIẾT BỊ & XÓA SẠCH SERVER */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Đồng Bộ Chuyển Dữ Liệu Sang Thiết Bị Khác
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSyncModal(false)
                  setSyncStatusMsg(null)
                  setSyncCode('')
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-sky-50/80 border border-sky-100 rounded-2xl text-sky-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Bảo Vệ Dung Lượng Máy Chủ 100%:
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Gói đồng bộ được mã hóa trung chuyển tạm thời. Ngay khi thiết bị mới tải về thành công, máy chủ sẽ <strong>XÓA TỨC THÌ</strong> toàn bộ dữ liệu để giữ máy chủ luôn sạch dung lượng.
                </p>
              </div>

              {syncStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-semibold">
                  {syncStatusMsg}
                </div>
              )}

              {/* Máy nguồn */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800">Cách 1: Ở Thiết Bị Cũ (Máy Nguồn)</h4>
                <p className="text-slate-500 text-[11px]">
                  Bấm để tạo Mã Đồng Bộ 6 số để chuyển toàn bộ tin nhắn sang máy mới:
                </p>

                {syncCode ? (
                  <div className="bg-slate-100 p-4 rounded-2xl text-center space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Mã Đồng Bộ Của Bạn:</span>
                    <div className="text-3xl font-black text-sky-600 tracking-widest font-mono">
                      {syncCode}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      (Nhập mã này ở thiết bị mới để nạp dữ liệu)
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateBackupCode}
                    disabled={syncLoading}
                    className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold rounded-xl transition shadow cursor-pointer"
                  >
                    {syncLoading ? 'Đang đóng gói...' : 'Tạo Mã Chuyển Dữ Liệu Sang Máy Mới'}
                  </button>
                )}
              </div>

              {/* Máy mới */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800">Cách 2: Ở Thiết Bị Mới (Máy Nhận)</h4>
                <p className="text-slate-500 text-[11px]">
                  Nhập mã 6 số được tạo từ máy cũ để kéo toàn bộ tin nhắn về máy này:
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputSyncCode}
                    onChange={(e) => setInputSyncCode(e.target.value)}
                    placeholder="VD: 123456"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handlePullBackupCode}
                    disabled={syncLoading || !inputSyncCode.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {syncLoading ? 'Đang nạp...' : 'Nhận Dữ Liệu'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
