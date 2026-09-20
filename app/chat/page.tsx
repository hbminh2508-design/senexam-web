'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
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
  ShieldCheck,
  CheckCheck,
  Check,
  Smartphone,
  Mail,
  LogOut,
  ChevronLeft,
  Info,
  ExternalLink,
  Lock,
  Sparkles,
  UserCheck,
  X,
  FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  ZaloUser,
  ZaloMessage,
  ZaloConversation,
  getOrCreateDeviceId,
  getLocalZaloUser,
  saveLocalZaloUser,
  clearLocalZaloUser,
  getLocalConversations,
  saveLocalConversation,
  deleteLocalConversation,
  getLocalMessages,
  saveLocalMessage,
  deleteLocalMessage,
  clearAllLocalMessages,
  exportLocalData,
  importLocalData,
} from '@/lib/zaloLocalStorage'

// Bộ sticker / emoji phổ biến kiểu Zalo
const QUICK_EMOJIS = ['😀', '😂', '😍', '👍', '❤️', '🎉', '🔥', '👏', '🙏', '😭', '😎', '💯']

export default function ZaloChatApp() {
  const [currentUser, setCurrentUser] = useState<ZaloUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [activeTab, setActiveTab] = useState<'messages' | 'contacts' | 'sync'>('messages')

  // Cuộc hội thoại và tin nhắn
  const [conversations, setConversations] = useState<ZaloConversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ZaloMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')

  // UI Panels
  const [showInfoSidebar, setShowInfoSidebar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isMobileListVisible, setIsMobileListVisible] = useState(true)

  // Auth Form State
  const [authMethod, setAuthMethod] = useState<'phone' | 'gmail'>('phone')
  const [authInput, setAuthInput] = useState('')
  const [authName, setAuthName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [supabaseUserFound, setSupabaseUserFound] = useState<any>(null)

  // New Chat Search State
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearchingUser, setIsSearchingUser] = useState(false)

  // Sync Device Transfer State
  const [syncCode, setSyncCode] = useState('')
  const [inputSyncCode, setInputSyncCode] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 1. Khởi tạo người dùng từ Local Storage & Kiểm tra Supabase Session
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    const user = getLocalZaloUser()
    if (user) {
      setCurrentUser(user)
    }

    // Kiểm tra tài khoản SenExam đang đăng nhập để gợi ý đăng nhập nhanh
    const checkSupabase = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (auth?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone_number, phone, avatar_url')
            .eq('id', auth.user.id)
            .maybeSingle()

          setSupabaseUserFound({
            id: auth.user.id,
            email: auth.user.email || '',
            phone: profile?.phone_number || profile?.phone || '',
            name: profile?.full_name || auth.user.user_metadata?.full_name || 'Học viên SenExam',
            avatar: profile?.avatar_url || '',
          })
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra supabase session:', e)
      } finally {
        setIsInitializing(false)
      }
    }

    checkSupabase()
  }, [])

  // 2. Tải danh sách hội thoại từ Local Storage
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

  // 3. Tải tin nhắn của cuộc hội thoại đang chọn
  useEffect(() => {
    if (selectedConvId) {
      const msgs = getLocalMessages(selectedConvId)
      setMessages(msgs)
      setIsMobileListVisible(false)

      // Đánh dấu đã đọc
      const convs = getLocalConversations()
      const c = convs.find((item) => item.id === selectedConvId)
      if (c && c.unreadCount > 0) {
        c.unreadCount = 0
        saveLocalConversation(c)
        setConversations([...convs])
      }
    }
  }, [selectedConvId])

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 4. Polling Hàng Đợi Đồng Bộ Từ Server & XÓA NGAY LẬP TỨC TRÊN SERVER
  // Chu kỳ: Cứ 3 giây kéo tin nhắn mới 1 lần
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
              const convId = m.senderId || 'unknown'
              const localMsg: ZaloMessage = {
                id: m.id || 'msg_' + Date.now(),
                conversationId: convId,
                senderId: m.senderId,
                senderName: m.senderName || 'Đối tác',
                receiverId: currentUser.id,
                content: m.content || '',
                type: m.type || 'text',
                attachmentUrl: m.attachmentUrl,
                attachmentName: m.attachmentName,
                attachmentSize: m.attachmentSize,
                createdAt: m.createdAt || new Date().toISOString(),
                status: 'received',
              }

              // Lưu vào Local Storage của máy này
              saveLocalMessage(convId, localMsg)

              // Cập nhật Conversation
              const existingConv = getLocalConversations().find((c) => c.id === convId)
              saveLocalConversation({
                id: convId,
                partnerId: m.senderId,
                partnerName: m.senderName || 'Bạn bè',
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

            // Tải lại danh sách
            refreshConversations()
            if (selectedConvId) {
              setMessages(getLocalMessages(selectedConvId))
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi polling sync queue:', err)
      }
    }

    pollSyncQueue()
    const interval = setInterval(pollSyncQueue, 3500)
    return () => clearInterval(interval)
  }, [currentUser, selectedConvId])

  // 5. Gửi Tin Nhắn (Lưu Local + Đưa vào Transit Queue Server)
  const handleSendMessage = async (textToSend?: string, type: 'text' | 'image' | 'like' = 'text', mediaUrl?: string) => {
    const content = (textToSend !== undefined ? textToSend : inputText).trim()
    if (!content && type === 'text') return
    if (!selectedConvId || !currentUser) return

    const activeConv = conversations.find((c) => c.id === selectedConvId)
    if (!activeConv) return

    const newMsg: ZaloMessage = {
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

    // A. LƯU NGAY VÀO LOCAL STORAGE CỦA THIẾT BỊ NÀY
    saveLocalMessage(selectedConvId, newMsg)
    setMessages((prev) => [...prev, newMsg])
    setInputText('')
    setShowEmojiPicker(false)
    refreshConversations()

    // B. ĐƯA VÀO HÀNG ĐỢI ĐỒNG BỘ TRUNG CHUYỂN SERVER (SẼ BỊ XÓA NGAY KHI NGƯỜI NHẬN KÉO VỀ)
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

  // 6. Xử lý Đăng Nhập / Xác Minh Tài Khoản (Gmail hoặc Số Điện Thoại)
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthError(null)

    const inputVal = authInput.trim()
    const nameVal = authName.trim() || (authMethod === 'phone' ? `Người dùng ${inputVal.slice(-4)}` : inputVal.split('@')[0])

    if (!inputVal) {
      setAuthError(authMethod === 'phone' ? 'Vui lòng nhập số điện thoại' : 'Vui lòng nhập địa chỉ Gmail')
      return
    }

    if (authMethod === 'phone') {
      const cleanPhone = inputVal.replace(/\s+/g, '')
      if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(cleanPhone)) {
        setAuthError('Số điện thoại không hợp lệ (định dạng 10 số: 0912..., 098...)')
        return
      }
    } else {
      if (!inputVal.includes('@') || !inputVal.includes('.')) {
        setAuthError('Địa chỉ email không đúng định dạng')
        return
      }
    }

    setAuthLoading(true)

    // Tạo hồ sơ người dùng lưu trên Local
    const newUser: ZaloUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: nameVal,
      identifier: inputVal,
      authType: authMethod,
      phone: authMethod === 'phone' ? inputVal : undefined,
      email: authMethod === 'gmail' ? inputVal : undefined,
      createdAt: new Date().toISOString(),
    }

    saveLocalZaloUser(newUser)
    setCurrentUser(newUser)
    setAuthLoading(false)
    setShowAuthModal(false)
  }

  // Đăng nhập nhanh bằng phiên SenExam hiện có
  const handleFastLoginWithSupabase = () => {
    if (!supabaseUserFound) return
    const newUser: ZaloUser = {
      id: supabaseUserFound.id,
      name: supabaseUserFound.name,
      identifier: supabaseUserFound.phone || supabaseUserFound.email,
      authType: supabaseUserFound.phone ? 'phone' : 'gmail',
      phone: supabaseUserFound.phone,
      email: supabaseUserFound.email,
      avatar: supabaseUserFound.avatar,
      createdAt: new Date().toISOString(),
    }
    saveLocalZaloUser(newUser)
    setCurrentUser(newUser)
    setShowAuthModal(false)
  }

  // 7. Tìm Kiếm & Bắt Đầu Chat Mới (Search by Phone or Gmail)
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
    const newConv: ZaloConversation = {
      id: convId,
      partnerId: user.id || user.identifier,
      partnerName: user.name || 'Người dùng Zalo',
      partnerIdentifier: user.identifier || user.phone || user.email || convId,
      partnerAvatar: user.avatar,
      lastMessage: 'Đã bắt đầu cuộc trò chuyện',
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

  // 8. Đồng Bộ Dữ Liệu Từ Máy Khác (Device-to-Device Transfer & Instant Server Purge)
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
        setSyncStatusMsg('Đã tạo mã đồng bộ! Nhập mã 6 số này trên máy khác để chuyển toàn bộ tin nhắn.')
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
          setSyncStatusMsg('🎉 Đồng bộ thành công! Toàn bộ tin nhắn đã được nạp vào máy này. Máy chủ đã xóa sạch gói dữ liệu.')
          setInputSyncCode('')
        } else {
          setSyncStatusMsg('Lỗi định dạng dữ liệu sao lưu.')
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

  // 9. Xử lý tải ảnh gửi tin nhắn
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

  // Lọc cuộc hội thoại theo tìm kiếm
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.partnerIdentifier.toLowerCase().includes(searchQuery.toLowerCase())
      const matchFilter = filterMode === 'all' || (filterMode === 'unread' && c.unreadCount > 0)
      return matchSearch && matchFilter
    })
  }, [conversations, searchQuery, filterMode])

  const activeConversation = conversations.find((c) => c.id === selectedConvId)

  // MÀN HÌNH CHỜ KHỞI TẠO
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0068ff] flex items-center justify-center text-white shadow-lg animate-pulse font-black text-xl">
            Z
          </div>
          <span className="text-sm font-semibold text-slate-600">Đang khởi động Zalo Chat...</span>
        </div>
      </div>
    )
  }

  // NẾU CHƯA ĐĂNG NHẬP / XÁC MINH -> HIỂN THỊ MÀN HÌNH CHÀO MỪNG & XÁC MINH ZALO
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0068ff]/10 via-[#e5efff] to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Header Zalo Blue */}
          <div className="bg-[#0068ff] p-8 text-white text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl"></div>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white text-[#0068ff] flex items-center justify-center font-black text-3xl shadow-md mb-3">
              Z
            </div>
            <h1 className="text-2xl font-black tracking-tight">Zalo Chat SenExam</h1>
            <p className="text-xs text-blue-100 mt-1">
              Nhắn tin bảo mật Local-First • Đồng bộ xóa tức thì trên máy chủ
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Tùy chọn đăng nhập nhanh với Supabase nếu có */}
            {supabaseUserFound && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-blue-900">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#0068ff]" />
                    Phát hiện tài khoản SenExam
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-200/70 text-[#005ae0] text-[10px] font-bold">
                    Có sẵn
                  </span>
                </div>
                <p className="text-slate-600">
                  Chào mừng <strong>{supabaseUserFound.name}</strong> ({supabaseUserFound.phone || supabaseUserFound.email})
                </p>
                <button
                  type="button"
                  onClick={handleFastLoginWithSupabase}
                  className="w-full py-2.5 rounded-xl bg-[#0068ff] hover:bg-[#005ae0] text-white font-bold text-xs transition shadow cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Tiếp tục với tài khoản này</span>
                </button>
              </div>
            )}

            {/* Chuyển tab xác minh Gmail vs Số Điện Thoại */}
            <div className="space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('phone')
                    setAuthError(null)
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === 'phone'
                      ? 'bg-white text-[#0068ff] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Số điện thoại</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('gmail')
                    setAuthError(null)
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === 'gmail'
                      ? 'bg-white text-[#0068ff] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Gmail / Email</span>
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold animate-in fade-in">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {authMethod === 'phone' ? 'Nhập Số Điện Thoại của bạn' : 'Nhập Địa Chỉ Gmail / Email'}
                  </label>
                  <input
                    type={authMethod === 'phone' ? 'tel' : 'email'}
                    value={authInput}
                    onChange={(e) => setAuthInput(e.target.value)}
                    placeholder={authMethod === 'phone' ? 'VD: 0912345678' : 'VD: hotro@gmail.com'}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#0068ff] focus:bg-white transition"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và Tên hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#0068ff] focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#0068ff] hover:bg-[#005ae0] text-white font-bold text-sm transition shadow-lg shadow-[#0068ff]/30 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <span>{authLoading ? 'Đang xác minh...' : 'Đăng Nhập Vào Zalo Chat'}</span>
                </button>
              </form>
            </div>

            {/* Cam kết bảo mật Local-First */}
            <div className="pt-2 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dữ liệu lưu an toàn 100% trên thiết bị của bạn</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // GIAO DIỆN CHÍNH ZALO CHAT (3 CỘT: NAV RAIL - CONVERSATION LIST - CHAT WINDOW)
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f0f2f5] flex select-none text-slate-800 font-sans">
      {/* 🌟 CỘT 1: THANH ĐIỀU HƯỚNG ZALO RAIL (Leftmost bar #0068FF) */}
      <nav aria-label="Thanh điều hướng chính Zalo" className="w-16 bg-[#0068ff] flex flex-col items-center justify-between py-4 shrink-0 text-white shadow-md z-30">
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Avatar User */}
          <div className="relative cursor-pointer group" onClick={() => setShowInfoSidebar(true)}>
            <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center font-black text-sm text-white shadow">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#0068ff] rounded-full"></span>
          </div>

          <div className="w-8 h-px bg-white/20"></div>

          {/* Tab Tin nhắn */}
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer relative ${
              activeTab === 'messages' ? 'bg-white/25 text-white shadow-inner' : 'text-blue-100 hover:bg-white/15'
            }`}
            title="Tin nhắn"
          >
            <MessageSquare className="w-5 h-5" />
            {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none">
                {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
              </span>
            )}
          </button>

          {/* Tab Danh bạ */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('contacts')
              setShowNewChatModal(true)
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer ${
              activeTab === 'contacts' ? 'bg-white/25 text-white shadow-inner' : 'text-blue-100 hover:bg-white/15'
            }`}
            title="Danh bạ / Tìm kiếm bạn bè"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Tab Đồng bộ chuyển máy */}
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-blue-100 hover:bg-white/15 transition cursor-pointer"
            title="Đồng bộ chuyển dữ liệu sang máy khác"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Nút Đăng xuất */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (confirm('Bạn có chắc muốn đăng xuất khỏi Zalo Chat trên máy này?')) {
                clearLocalZaloUser()
                setCurrentUser(null)
              }
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-blue-200 hover:bg-rose-500/80 hover:text-white transition cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* 🌟 CỘT 2: DANH SÁCH CUỘC HỘI THOẠI & TÌM KIẾM (#ffffff) */}
      <section aria-label="Danh sách cuộc trò chuyện"
        className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 ${
          isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Header tìm kiếm Zalo */}
        <div className="p-3 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tin nhắn, bạn bè..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0068ff] focus:bg-white transition"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#0068ff] transition cursor-pointer"
              title="Thêm cuộc trò chuyện mới"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Tabs: Tất cả | Chưa đọc */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 border-b border-transparent">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`pb-1 cursor-pointer transition relative ${
                filterMode === 'all' ? 'text-[#0068ff] font-extrabold' : 'hover:text-slate-800'
              }`}
            >
              <span>Tất cả</span>
              {filterMode === 'all' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0068ff] rounded-full"></span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`pb-1 cursor-pointer transition relative ${
                filterMode === 'unread' ? 'text-[#0068ff] font-extrabold' : 'hover:text-slate-800'
              }`}
            >
              <span>Chưa đọc</span>
              {filterMode === 'unread' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0068ff] rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredConversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold">Chưa có cuộc trò chuyện nào</p>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="mt-3 px-3 py-1.5 rounded-xl bg-[#0068ff] text-white text-xs font-bold hover:bg-[#005ae0] transition cursor-pointer shadow-sm"
              >
                Nhắn tin với bạn mới
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition relative ${
                    isSelected
                      ? 'bg-[#e5efff]/80 hover:bg-[#e5efff]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                      {conv.partnerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>

                  {/* Nội dung preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {conv.partnerName}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {conv.lastMessageTime || ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-slate-500 truncate max-w-[190px]">
                        {conv.lastMessage || 'Bắt đầu cuộc trò chuyện'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none shrink-0">
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

      {/* 🌟 CỘT 3: CỬA SỔ TRÒ CHUYỆN CHÍNH (Chat Window) */}
      <main aria-label="Nội dung cuộc trò chuyện"
        className={`flex-1 bg-[#eef0f2] flex flex-col min-w-0 ${
          !isMobileListVisible ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Header phòng chat Zalo */}
            <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileListVisible(true)}
                  className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                    {activeConversation.partnerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full"></span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                      {activeConversation.partnerName}
                    </h2>
                    <span title="Tài khoản đã xác minh">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0068ff]" />
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium block">
                    Đang hoạt động • {activeConversation.partnerIdentifier}
                  </span>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => alert('Tính năng gọi thoại sẽ sớm được cập nhật')}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#0068ff] transition cursor-pointer"
                  title="Gọi thoại"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => alert('Tính năng gọi video sẽ sớm được cập nhật')}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#0068ff] transition cursor-pointer"
                  title="Gọi video"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#0068ff] transition cursor-pointer"
                  title="Thông tin hội thoại"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Thông báo Bảo mật Local-First Banner */}
            <div className="bg-blue-50/90 border-b border-blue-100 px-4 py-2 text-[11px] text-blue-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#0068ff] shrink-0" />
                <span>
                  <strong>Bảo mật Local-First:</strong> Tin nhắn lưu trên máy của bạn theo cơ chế Zalo. Dữ liệu trung chuyển trên máy chủ được <strong>xóa ngay lập tức</strong> sau khi nhận.
                </span>
              </div>
              <span className="text-[10px] font-mono text-blue-600 shrink-0 hidden sm:inline">
                Server RAM: Clean
              </span>
            </div>

            {/* Danh sách Tin Nhắn (Stream) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#0068ff] shadow-sm">
                    <Smile className="w-6 h-6" />
                  </div>
                  <p>Hãy gửi lời chào đến {activeConversation.partnerName}!</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Xin chào! 👋')}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer"
                    >
                      Xin chào! 👋
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Chào bạn, rất vui được kết nối!')}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer"
                    >
                      Rất vui được kết nối!
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}
                    >
                      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%]`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mb-1 shadow-sm">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-sm relative break-words ${
                            isMine
                              ? 'bg-[#e5efff] text-slate-900 border border-[#cce0ff] rounded-br-none'
                              : 'bg-white text-slate-900 border border-slate-100 rounded-bl-none'
                          }`}
                        >
                          {/* Tin nhắn hình ảnh */}
                          {msg.type === 'image' && msg.attachmentUrl && (
                            <div className="mb-1 rounded-xl overflow-hidden max-w-sm bg-black/5">
                              <img
                                src={msg.attachmentUrl}
                                alt="Hình ảnh chia sẻ"
                                className="w-full h-auto object-cover max-h-72"
                              />
                            </div>
                          )}

                          {/* Tin nhắn nút thích like */}
                          {msg.type === 'like' ? (
                            <span className="text-3xl">👍</span>
                          ) : (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Thời gian và trạng thái */}
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isMine && (
                              <span title="Đã chuyển thành công">
                                <CheckCheck className="w-3.5 h-3.5 text-[#0068ff]" />
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

            {/* Thanh Công Cụ & Nhập Tin Nhắn Zalo */}
            <div className="bg-white border-t border-slate-200 p-2 sm:p-3 shrink-0">
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

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 mb-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ${
                    showEmojiPicker ? 'text-[#0068ff] bg-blue-50' : ''
                  }`}
                  title="Biểu cảm / Nhãn dán"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title="Gửi hình ảnh"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
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

              {/* Text Input Area */}
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={`Nhập @, tin nhắn tới ${activeConversation.partnerName}...`}
                  className="flex-1 px-3 py-2 rounded-2xl bg-slate-100 text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none max-h-32 focus:outline-none focus:ring-1 focus:ring-[#0068ff] focus:bg-white transition"
                />

                {inputText.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    className="w-9 h-9 rounded-2xl bg-[#0068ff] hover:bg-[#005ae0] text-white flex items-center justify-center transition shadow cursor-pointer shrink-0"
                    title="Gửi tin nhắn"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage('', 'like')}
                    className="w-9 h-9 rounded-2xl text-[#0068ff] hover:bg-blue-50 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Gửi Thích (Like kiểu Zalo)"
                  >
                    <ThumbsUp className="w-5 h-5 fill-[#0068ff]" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center text-[#0068ff] mb-3">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-700">Chào mừng bạn đến với Zalo Chat</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Chọn một cuộc hội thoại ở danh sách bên trái hoặc thêm bạn bè để bắt đầu trò chuyện bảo mật.
            </p>
          </div>
        )}
      </main>

      {/* 🌟 CỘT 4: THÔNG TIN HỘI THOẠI & QUẢN LÝ DỮ LIỆU CỤC BỘ (Right sidebar) */}
      {showInfoSidebar && activeConversation && (
        <aside aria-label="Thông tin hội thoại" className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Thông tin hội thoại</h3>
            <button
              type="button"
              onClick={() => setShowInfoSidebar(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 text-center space-y-3 border-b border-slate-100">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              {activeConversation.partnerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{activeConversation.partnerName}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{activeConversation.partnerIdentifier}</p>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto text-xs">
            {/* Thống kê dữ liệu trên thiết bị */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Lưu trữ cục bộ</span>
              <p className="text-slate-700 font-medium">
                Đã lưu <strong>{messages.length}</strong> tin nhắn trên ổ cứng của thiết bị này.
              </p>
            </div>

            {/* Các tùy chọn */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-blue-50 text-[#0068ff] font-bold text-left flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Đồng bộ sang máy khác</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const json = exportLocalData()
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `zalo_backup_${currentUser.id}_${Date.now()}.json`
                  a.click()
                }}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-left flex items-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Xuất file sao lưu (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa sạch tin nhắn của cuộc hội thoại này trên MÁY NÀY?')) {
                    clearAllLocalMessages(activeConversation.id)
                    setMessages([])
                    refreshConversations()
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-left flex items-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa lịch sử trên máy này</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 🌟 MODAL: THÊM BẠN BÈ / BẮT ĐẦU CHAT MỚI (QUA SĐT HOẶC GMAIL) */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0068ff]" />
                <span>Thêm Bạn Mới / Tạo Trò Chuyện</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Tìm kiếm tài khoản bằng <strong>Số điện thoại</strong>, <strong>Gmail</strong> hoặc <strong>Họ tên</strong>:
              </p>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Nhập SĐT (09...), Gmail hoặc tên bạn bè..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-[#0068ff] focus:bg-white transition"
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
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-blue-50 cursor-pointer transition pt-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{u.phone || u.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-[#0068ff] text-white rounded-xl text-[11px] font-bold shadow-sm"
                      >
                        Nhắn tin
                      </button>
                    </div>
                  ))
                ) : userSearchQuery.trim().length >= 2 ? (
                  <div className="p-3 bg-slate-50 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      Chưa tìm thấy bạn bè này trong hệ thống. Bạn có muốn mở ngay khung chat với:
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
                      className="px-4 py-2 bg-[#0068ff] text-white rounded-xl text-xs font-bold shadow hover:bg-[#005ae0]"
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

      {/* 🌟 MODAL: ĐỒNG BỘ CHUYỂN DỮ LIỆU SANG THIẾT BỊ KHÁC & XOÁ SẠCH SERVER */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#0068ff]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Đồng Bộ Dữ Liệu Thiết Bị (Cơ Chế Zalo)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSyncModal(false)
                  setSyncStatusMsg(null)
                  setSyncCode('')
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0068ff]" />
                  Cam Kết Giải Phóng Bộ Nhớ Máy Chủ 100%:
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Gói dữ liệu được đưa lên hàng đợi trung chuyển mã hóa. Ngay khi máy mới tải về hoàn tất, máy chủ sẽ <strong>XÓA NGAY LẬP TỨC</strong> gói này để tránh đầy dung lượng máy chủ!
                </p>
              </div>

              {syncStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-semibold">
                  {syncStatusMsg}
                </div>
              )}

              {/* Lựa chọn 1: Máy nguồn muốn gửi tin nhắn sang máy mới */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800">
                  Cách 1: Tôi Đang Ở Thiết Bị Cũ (Máy Nguồn)
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Bấm để tạo Mã Đồng Bộ 6 số và tải toàn bộ tin nhắn lên hàng đợi tạm:
                </p>

                {syncCode ? (
                  <div className="bg-slate-100 p-4 rounded-2xl text-center space-y-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Mã Đồng Bộ Của Bạn:</span>
                    <div className="text-2xl sm:text-3xl font-black text-[#0068ff] tracking-widest font-mono">
                      {syncCode}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      (Nhập mã này ở thiết bị mới để nạp tin nhắn)
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateBackupCode}
                    disabled={syncLoading}
                    className="w-full py-2.5 bg-[#0068ff] hover:bg-[#005ae0] text-white font-bold rounded-xl transition shadow cursor-pointer"
                  >
                    {syncLoading ? 'Đang đóng gói dữ liệu...' : 'Tạo Mã Đồng Bộ Để Chuyển Máy'}
                  </button>
                )}
              </div>

              {/* Lựa chọn 2: Máy mới muốn nhận tin nhắn từ máy cũ */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800">
                  Cách 2: Tôi Đang Ở Thiết Bị Mới (Máy Nhận)
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Nhập mã 6 số được tạo từ máy cũ để kéo toàn bộ tin nhắn về máy này:
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputSyncCode}
                    onChange={(e) => setInputSyncCode(e.target.value)}
                    placeholder="VD: 123456"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-[#0068ff]"
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
