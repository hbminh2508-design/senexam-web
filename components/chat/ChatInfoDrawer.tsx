'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  Search,
  Image as ImageIcon,
  FileText,
  Mic,
  Link as LinkIcon,
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  Download,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Ban,
  Unlock,
  Edit3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HardDrive,
  LogOut,
  FolderOpen,
} from 'lucide-react'
import { formatBytes, GROUP_STORAGE_QUOTA_BYTES } from '@/lib/chatLimits'
import ChatSafetyWidget from './ChatSafetyWidget'
import ChatDisappearingMessages from './ChatDisappearingMessages'

export interface ChatInfoDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversation: any
  messages: any[]
  currentUserId: string
  currentNickname?: string | null
  onOpenNicknameModal?: () => void
  onSelectMessage?: (messageId: string) => void
  onRecallMessage?: (messageId: string) => void
  safetyNumberData?: any
  keyChangedAlert?: boolean
  isPartnerVerified?: boolean
  onMarkVerified?: (verified: boolean) => void
  disappearingTtl?: number
  onChangeDisappearingTtl?: (ttl: number) => void
  isCurrentBlocked?: boolean
  onToggleBlock?: () => void
  onOpenManageGroup?: () => void
  groupMembers?: Array<{
    memberId: string
    userId: string
    name: string
    email?: string
    role: 'owner' | 'admin' | 'member'
    avatar?: string
  }>
  onRemoveMember?: (memberId: string) => void
  onLeaveGroup?: () => void
}

export default function ChatInfoDrawer({
  isOpen,
  onClose,
  conversation,
  messages,
  currentUserId,
  currentNickname,
  onOpenNicknameModal,
  onSelectMessage,
  onRecallMessage,
  safetyNumberData,
  keyChangedAlert = false,
  isPartnerVerified = false,
  onMarkVerified,
  disappearingTtl = 0,
  onChangeDisappearingTtl,
  isCurrentBlocked = false,
  onToggleBlock,
  onOpenManageGroup,
  groupMembers = [],
  onRemoveMember,
  onLeaveGroup,
}: ChatInfoDrawerProps) {
  const [localSearch, setLocalSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'files' | 'links' | 'members'>('info')
  const [fileCategory, setFileCategory] = useState<'media' | 'docs' | 'audio'>('media')
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // 1. Phân loại tệp đã chia sẻ trong cuộc trò chuyện
  const sharedMedia = useMemo(() => {
    return messages.filter(
      (m) =>
        m.type === 'image' ||
        (m.mimeType && (m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/')))
    )
  }, [messages])

  const sharedDocs = useMemo(() => {
    return messages.filter(
      (m) =>
        m.type === 'file' &&
        (!m.mimeType || (!m.mimeType.startsWith('image/') && !m.mimeType.startsWith('video/') && !m.mimeType.startsWith('audio/')))
    )
  }, [messages])

  const sharedAudio = useMemo(() => {
    return messages.filter(
      (m) => m.type === 'audio' || (m.mimeType && m.mimeType.startsWith('audio/'))
    )
  }, [messages])

  // 2. Lọc các liên kết URL đã chia sẻ trong tin nhắn
  const sharedLinks = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi
    const list: Array<{ url: string; domain: string; date: string; messageId: string }> = []
    messages.forEach((m) => {
      if (m.content && typeof m.content === 'string') {
        const matches = m.content.match(urlRegex)
        if (matches) {
          matches.forEach((u) => {
            try {
              const parsed = new URL(u)
              list.push({
                url: u,
                domain: parsed.hostname,
                date: m.createdAt,
                messageId: m.id,
              })
            } catch {}
          })
        }
      }
    })
    return list
  }, [messages])

  // 3. Tìm kiếm tin nhắn cục bộ trong hội thoại
  const searchResults = useMemo(() => {
    const q = localSearch.trim().toLowerCase()
    if (!q) return []
    return messages.filter((m) => {
      const textMatch = m.content && String(m.content).toLowerCase().includes(q)
      const fileMatch = m.attachmentName && String(m.attachmentName).toLowerCase().includes(q)
      const transcriptMatch = m.transcription && String(m.transcription).toLowerCase().includes(q)
      return textMatch || fileMatch || transcriptMatch
    })
  }, [messages, localSearch])

  // Sao chép link
  const handleCopyLink = (url: string) => {
    navigator.clipboard?.writeText(url)
    setCopiedLink(url)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  // Tải tệp xuống
  const handleDownloadFile = (msg: any) => {
    if (msg.attachmentUrl) {
      window.open(msg.attachmentUrl, '_blank')
    } else if (msg.attachmentId || msg.driveFileId) {
      const url = `/api/chat/attachments/stream?${msg.attachmentId ? `attachmentId=${msg.attachmentId}` : `driveFileId=${msg.driveFileId}`}`
      window.open(url, '_blank')
    }
  }

  const isGroup = Boolean(conversation?.isGroup || conversation?.type === 'group')
  const displayName = currentNickname || conversation?.partnerName || conversation?.title || 'Hội thoại'

  if (!isOpen) return null

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] md:w-[380px] flex flex-col border-l border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 shadow-2xl transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* 1. HEADER NÚT ĐÓNG */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>Chi Tiết Cuộc Trò Chuyện</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng ngăn thông tin"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. PROFILE HOẶC THÔNG TIN NHÓM */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex flex-col items-center text-center">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-700 font-extrabold text-2xl text-white shadow-lg">
            {displayName.substring(0, 1).toUpperCase()}
          </div>
          {isGroup && (
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900">
              <Users className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <h4 className="mt-2.5 font-bold text-sm text-slate-900 dark:text-slate-100 max-w-[280px] truncate">
          {displayName}
        </h4>
        <p className="text-[11px] text-slate-400 truncate max-w-[260px]">
          {conversation?.partnerIdentifier || (isGroup ? 'Nhóm mã hóa MLS RFC 9420' : 'E2EE Signal Ratchet')}
        </p>

        {!isGroup && onOpenNicknameModal && (
          <button
            type="button"
            onClick={onOpenNicknameModal}
            className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition"
          >
            <Edit3 className="h-3.5 w-3.5" /> Đặt biệt danh
          </button>
        )}
      </div>

      {/* 3. THANH TAB ĐIỀU HƯỚNG TÍNH NĂNG */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'info'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Cài đặt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'files'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Tệp ({sharedMedia.length + sharedDocs.length + sharedAudio.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'links'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Link ({sharedLinks.length})
        </button>
        {isGroup && (
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === 'members'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Thành viên
          </button>
        )}
      </div>

      {/* 4. NỘI DUNG CUỘN CÁC PHÂN MỤC */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TÌM KIẾM TIN NHẮN CỤC BỘ TRONG HỘI THOẠI */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm tin nhắn trong hội thoại..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* KẾT QUẢ TÌM KIẾM TIN NHẮN */}
        {localSearch.trim() && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Kết quả tìm kiếm</span>
              <span>{searchResults.length} tin</span>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">Không tìm thấy tin nhắn phù hợp</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {searchResults.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => {
                      if (onSelectMessage) onSelectMessage(msg.id)
                    }}
                    className="w-full text-left p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-500/40 transition active:scale-98 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {msg.senderName || 'Người gửi'}
                      </span>
                      <span>{new Date(msg.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                      {msg.content || msg.attachmentName || msg.transcription || '[Đính kèm]'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: CÀI ĐẶT & BẢO MẬT */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Widget Mã an toàn Safety Number (Signal / MLS) */}
            <ChatSafetyWidget
              partnerId={conversation.partnerId || conversation.id}
              partnerName={displayName}
              safetyNumber={safetyNumberData}
              keyChanged={keyChangedAlert}
              isVerified={isPartnerVerified}
              onMarkVerified={onMarkVerified}
            />

            {/* Tin nhắn tự hủy */}
            {onChangeDisappearingTtl && (
              <ChatDisappearingMessages
                currentTtl={disappearingTtl}
                onChangeTtl={onChangeDisappearingTtl}
              />
            )}

            {/* Chặn / Báo cáo vi phạm */}
            {!isGroup && onToggleBlock && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onToggleBlock}
                  className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl text-xs font-semibold transition shadow-xs ${
                    isCurrentBlocked
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400'
                  }`}
                >
                  {isCurrentBlocked ? <Unlock className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  {isCurrentBlocked ? 'Bỏ chặn người này' : 'Chặn người dùng này'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUẢN LÝ TỆP ĐÃ CHIA SẺ */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            {/* Phân mục tệp: Media / Documents / Audio */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setFileCategory('media')}
                className={`py-1.5 rounded-lg transition ${
                  fileCategory === 'media' ? 'bg-white shadow text-emerald-600 dark:bg-slate-900' : ''
                }`}
              >
                Ảnh ({sharedMedia.length})
              </button>
              <button
                type="button"
                onClick={() => setFileCategory('docs')}
                className={`py-1.5 rounded-lg transition ${
                  fileCategory === 'docs' ? 'bg-white shadow text-emerald-600 dark:bg-slate-900' : ''
                }`}
              >
                Tài liệu ({sharedDocs.length})
              </button>
              <button
                type="button"
                onClick={() => setFileCategory('audio')}
                className={`py-1.5 rounded-lg transition ${
                  fileCategory === 'audio' ? 'bg-white shadow text-emerald-600 dark:bg-slate-900' : ''
                }`}
              >
                Ghi âm ({sharedAudio.length})
              </button>
            </div>

            {/* Danh sách tệp tương ứng */}
            <div className="space-y-2">
              {fileCategory === 'media' && (
                sharedMedia.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">Chưa có ảnh hoặc video nào</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {sharedMedia.map((msg) => (
                      <div
                        key={msg.id}
                        className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2 flex flex-col justify-between overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold truncate text-slate-800 dark:text-slate-100">
                          <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="truncate">{msg.attachmentName || 'Hình ảnh'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{msg.attachmentSize ? formatBytes(msg.attachmentSize) : 'Ảnh E2EE'}</span>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(msg)}
                            title="Tải ảnh về"
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {fileCategory === 'docs' && (
                sharedDocs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">Chưa có tài liệu nào</p>
                ) : (
                  sharedDocs.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-emerald-500/30 transition shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {msg.attachmentName || 'Tài liệu'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {msg.attachmentSize ? formatBytes(msg.attachmentSize) : ''} •{' '}
                            {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(msg)}
                          title="Tải tài liệu"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {onRecallMessage && (
                          <button
                            type="button"
                            onClick={() => onRecallMessage(msg.id)}
                            title="Xóa / Thu hồi"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {fileCategory === 'audio' && (
                sharedAudio.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">Chưa có tin nhắn ghi âm nào</p>
                ) : (
                  sharedAudio.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                          <Mic className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {msg.transcription || 'Tin nhắn thoại E2EE'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {msg.duration ? `${msg.duration}s` : ''} •{' '}
                            {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(msg)}
                        title="Tải âm thanh"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUẢN LÝ LIÊN KẾT (SHARED LINKS) */}
        {activeTab === 'links' && (
          <div className="space-y-2">
            {sharedLinks.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">Chưa có liên kết URL nào trong cuộc trò chuyện</p>
            ) : (
              sharedLinks.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-sky-600 hover:underline truncate block"
                      >
                        {item.domain}
                      </a>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {item.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item.url)}
                      title="Sao chép liên kết"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {copiedLink === item.url ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở liên kết"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: QUẢN LÝ THÀNH VIÊN NHÓM MLS */}
        {activeTab === 'members' && isGroup && (
          <div className="space-y-3">
            {/* Hạn mức dung lượng nhóm 15GB */}
            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" /> Dung Lượng Media Nhóm
                </span>
                <span>Hạn mức 15GB</span>
              </div>
              <p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-400">
                Tất cả hình ảnh, tài liệu chia sẻ trong nhóm được bảo lưu 30 ngày mặc định theo RFC 9420.
              </p>
            </div>

            {/* Nút thêm thành viên */}
            {onOpenManageGroup && (
              <button
                type="button"
                onClick={onOpenManageGroup}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-98 transition"
              >
                <UserPlus className="h-4 w-4" /> Thêm Thành Viên / Quản Lý Nhóm
              </button>
            )}

            {/* Danh sách thành viên */}
            <div className="space-y-1.5">
              {groupMembers.length === 0 ? (
                <p className="text-center py-4 text-xs text-slate-400">
                  Nhấn vào nút Quản Lý Nhóm để xem đầy đủ danh sách
                </p>
              ) : (
                groupMembers.map((member) => (
                  <div
                    key={member.memberId || member.userId}
                    className="flex items-center justify-between p-2 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 text-white font-bold text-xs">
                        {member.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {member.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {member.email || member.userId.slice(0, 10)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {member.role === 'owner' ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Crown className="h-3 w-3" /> Trưởng nhóm
                        </span>
                      ) : member.role === 'admin' ? (
                        <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <Shield className="h-3 w-3" /> Quản trị
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <User className="h-3 w-3" /> Thành viên
                        </span>
                      )}

                      {onRemoveMember && member.userId !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member.memberId)}
                          title="Xóa khỏi nhóm"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rời nhóm */}
            {onLeaveGroup && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onLeaveGroup}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-bold transition shadow-xs"
                >
                  <LogOut className="h-4 w-4" /> Rời Khỏi Nhóm
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
