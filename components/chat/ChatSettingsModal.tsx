'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  User,
  Shield,
  Smartphone,
  HardDrive,
  Trash2,
  LogOut,
  Check,
  AlertTriangle,
  ExternalLink,
  Lock,
  Eye,
  RefreshCw,
  Sparkles,
  Database,
  Moon,
  Sun,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  SenChatUser,
  isEphemeralStorageEnabled,
  setEphemeralStorageEnabled,
  clearAllEphemeralMessages,
  clearAllLocalChatData,
  getStorageUsageSummary,
} from '@/lib/senChatStorage'
import { formatBytes } from '@/lib/chatLimits'

interface ChatSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: SenChatUser | null
  userPlanTier: string | null
  deviceId: string
  onOpenDeviceManager?: () => void
  onLoggedOut?: () => void
  onMessagesCleared?: () => void
  isMobile?: boolean
}

type SettingsTab = 'profile' | 'privacy' | 'devices' | 'storage'

export default function ChatSettingsModal({
  isOpen,
  onClose,
  currentUser,
  userPlanTier,
  deviceId,
  onOpenDeviceManager,
  onLoggedOut,
  onMessagesCleared,
  isMobile = false,
}: ChatSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [ephemeralEnabled, setEphemeralEnabled] = useState(true)
  const [allowEmailSearch, setAllowEmailSearch] = useState(true)
  const [readReceipts, setReadReceipts] = useState(true)
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false)
  const [privacySuccessMsg, setPrivacySuccessMsg] = useState<string | null>(null)
  const [storageStats, setStorageStats] = useState({
    messageCount: 0,
    conversationCount: 0,
    approxBytes: 0,
    ephemeralEnabled: true,
  })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setEphemeralEnabled(isEphemeralStorageEnabled())
    setStorageStats(getStorageUsageSummary())

    // Tải cấu hình quyền riêng tư từ hồ sơ profiles của Supabase
    if (currentUser?.id) {
      supabase
        .from('profiles')
        .select('allow_search_by_email, read_receipts_enabled')
        .eq('id', currentUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            if (data.allow_search_by_email !== undefined && data.allow_search_by_email !== null) {
              setAllowEmailSearch(Boolean(data.allow_search_by_email))
            }
            if (data.read_receipts_enabled !== undefined && data.read_receipts_enabled !== null) {
              setReadReceipts(Boolean(data.read_receipts_enabled))
            }
          }
        })
    }
  }, [isOpen, currentUser?.id])

  if (!isOpen) return null

  // Cập nhật cài đặt dọn dẹp bộ nhớ tạm
  const handleToggleEphemeral = (val: boolean) => {
    setEphemeralEnabled(val)
    setEphemeralStorageEnabled(val)
    setStorageStats(getStorageUsageSummary())
  }

  // Cập nhật cấu hình riêng tư lên Supabase
  const handleSavePrivacy = async (newAllowSearch: boolean, newReadReceipts: boolean) => {
    if (!currentUser?.id) return
    setIsSavingPrivacy(true)
    setPrivacySuccessMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          allow_search_by_email: newAllowSearch,
          read_receipts_enabled: newReadReceipts,
        })
        .eq('id', currentUser.id)

      if (error) throw error
      setPrivacySuccessMsg('Đã lưu tùy chọn quyền riêng tư thành công!')
      setTimeout(() => setPrivacySuccessMsg(null), 3000)
    } catch (e: any) {
      console.warn('Lỗi lưu quyền riêng tư:', e)
    } finally {
      setIsSavingPrivacy(false)
    }
  }

  // Xóa sạch tin nhắn tạm thời ngay lập tức
  const handleClearEphemeralNow = () => {
    clearAllEphemeralMessages()
    setStorageStats(getStorageUsageSummary())
    setShowClearConfirm(false)
    setClearSuccessMsg('Đã dọn sạch toàn bộ tin nhắn tạm thời trên thiết bị này!')
    if (onMessagesCleared) onMessagesCleared()
    setTimeout(() => setClearSuccessMsg(null), 3000)
  }

  // Đăng xuất an toàn: Xóa sạch bộ nhớ tạm và chuyển hướng
  const handleLogout = async () => {
    try {
      clearAllLocalChatData()
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Lỗi đăng xuất:', e)
    } finally {
      onClose()
      if (onLoggedOut) {
        onLoggedOut()
      } else {
        const dest = isMobile ? '/new-idp?returnUrl=/m/chat' : '/new-idp?returnUrl=/chat'
        window.location.href = dest
      }
    }
  }

  const getTierBadge = () => {
    const tier = (userPlanTier || 'free').toLowerCase()
    if (tier.includes('one')) return { label: 'Sen One', color: 'from-amber-500 to-yellow-600' }
    if (tier.includes('premium')) return { label: 'Sen Premium', color: 'from-purple-500 to-indigo-600' }
    if (tier.includes('vip')) return { label: 'Sen VIP', color: 'from-emerald-500 to-teal-600' }
    return { label: 'Học viên Miễn phí', color: 'from-slate-500 to-slate-700' }
  }

  const tierBadge = getTierBadge()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Cài Đặt Sen Chat</h3>
              <p className="text-xs text-slate-400">Quản lý hồ sơ SenExam, quyền riêng tư và lưu trữ cục bộ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-x-auto gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="h-4 w-4" />
            Hồ sơ SenExam
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Lock className="h-4 w-4" />
            Quyền riêng tư
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'devices'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            Thiết bị & Mã hóa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            Bộ nhớ tạm
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <div className="relative">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-emerald-500/30"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-bold text-white shadow-md">
                      {(currentUser?.name || 'S').substring(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-base truncate">{currentUser?.name || 'Học viên SenExam'}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${tierBadge.color}`}>
                      {tierBadge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {currentUser?.email || currentUser?.identifier || 'Chưa liên kết email'}
                  </p>
                  {(currentUser?.school || currentUser?.className) && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {currentUser?.school} {currentUser?.className ? `• Lớp ${currentUser.className}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Liên kết tài khoản SenExam</h5>
                <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Đã đồng bộ từ Supabase Auth</p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                        Cookie SSO miền .senexam.me — Hồ sơ tự động cập nhật
                      </p>
                    </div>
                  </div>
                  <a
                    href="/new-profile"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shrink-0"
                  >
                    Xem hồ sơ <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {privacySuccessMsg && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{privacySuccessMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="pr-4">
                    <p className="text-xs font-bold">Cho phép bạn học tìm kiếm bằng Email</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bạn học khác có thể tìm thấy tài khoản của bạn khi nhập địa chỉ email chính xác
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowEmailSearch}
                      onChange={(e) => {
                        const nextVal = e.target.checked
                        setAllowEmailSearch(nextVal)
                        handleSavePrivacy(nextVal, readReceipts)
                      }}
                      disabled={isSavingPrivacy}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="pr-4">
                    <p className="text-xs font-bold">Hiện trạng thái Đã nhận & Đã xem (Read Receipts)</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hiển thị dấu tích kép khi bạn đã đọc tin nhắn trong cuộc trò chuyện
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={readReceipts}
                      onChange={(e) => {
                        const nextVal = e.target.checked
                        setReadReceipts(nextVal)
                        handleSavePrivacy(allowEmailSearch, nextVal)
                      }}
                      disabled={isSavingPrivacy}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold">Bảo mật mật khẩu Sen IDP</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Mật khẩu Sen IDP bảo vệ quyền đăng nhập tập trung trên mọi dịch vụ SenExam.
                </p>
                <a
                  href="/new-reset-password"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Đổi mật khẩu tài khoản <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: DEVICES & SECURITY */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold">Thiết bị hiện tại</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Đang hoạt động
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {deviceId}
                </p>
                <p className="text-[11px] text-slate-400">
                  Khóa Identity Key và One-Time Prekey được lưu trữ cục bộ trên thiết bị này theo tiêu chuẩn Signal Protocol & MLS.
                </p>
              </div>

              {onOpenDeviceManager && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 p-4 dark:border-emerald-500/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">Quản lý Đa Thiết Bị E2EE</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Xem danh sách các máy đăng nhập và xác minh khóa Identity Key
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenDeviceManager()
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shrink-0"
                  >
                    Xem thiết bị
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EPHEMERAL STORAGE & RETENTION */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              {clearSuccessMsg && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{clearSuccessMsg}</span>
                </div>
              )}

              {/* Ephemeral mode toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-xs font-bold">Tự động xóa tin nhắn tạm khi đóng web / thoát trang</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Lưu trữ tin nhắn cục bộ tạm thời. Khi đóng tab hoặc rời web, toàn bộ tin nhắn trên máy sẽ tự động dọn sạch để bảo vệ riêng tư.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={ephemeralEnabled}
                      onChange={(e) => handleToggleEphemeral(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400">Tin nhắn tạm</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{storageStats.messageCount}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400">Cuộc hội thoại</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{storageStats.conversationCount}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400">Bộ nhớ tạm</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatBytes(storageStats.approxBytes)}</p>
                  </div>
                </div>
              </div>

              {/* File retention policy explanation */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-800 dark:text-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Chính sách lưu trữ tệp & Dung lượng nhóm</span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                  <li>Các tệp tin đính kèm (ảnh, video, tài liệu) được bảo lưu mặc định <strong>30 ngày</strong>.</li>
                  <li>Trưởng nhóm (Group Owner) / Quản trị viên có quyền gia hạn thêm thời hạn lưu hoặc bảo lưu vĩnh viễn cho tệp.</li>
                  <li>Mỗi nhóm được lưu trữ tối đa <strong>15GB</strong> dữ liệu media (ảnh, âm thanh, video, tệp tin).</li>
                </ul>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                {showClearConfirm ? (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900 space-y-2">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      Bạn có chắc muốn dọn sạch toàn bộ tin nhắn tạm thời trên thiết bị này?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleClearEphemeralNow}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold hover:bg-slate-300 transition"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/20 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa toàn bộ tin nhắn & bộ nhớ tạm ngay bây giờ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Logout */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Sen Chat · Phiên bản đồng bộ SenExam
          </div>

          {showLogoutConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-semibold">Đăng xuất & xóa bộ nhớ tạm?</span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
              >
                Đồng ý
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold transition"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất Sen Chat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
