'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Crown,
  Shield,
  User,
  LogOut,
  Edit3,
  X,
  Check,
  RefreshCw,
  Mail,
  AlertTriangle,
  Info,
} from 'lucide-react'

interface MlsMember {
  memberId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  name: string
  email: string
  avatar?: string
}

interface ChatMlsGroupModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId?: string | null
  groupTitle?: string
  groupAvatar?: string
  currentUserId: string
  currentUserEmail: string
  isCreatingNew?: boolean
  onGroupCreated?: (convId: string, title: string) => void
  onGroupUpdated?: () => void
}

export default function ChatMlsGroupModal({
  isOpen,
  onClose,
  conversationId,
  groupTitle = '',
  groupAvatar = '',
  currentUserId,
  currentUserEmail,
  isCreatingNew = false,
  onGroupCreated,
  onGroupUpdated,
}: ChatMlsGroupModalProps) {
  // Trạng thái tạo nhóm
  const [newTitle, setNewTitle] = useState(groupTitle)
  const [newAvatar, setNewAvatar] = useState(groupAvatar)
  const [emailInput, setEmailInput] = useState('')
  const [memberEmails, setMemberEmails] = useState<string[]>([])

  // Trạng thái quản lý nhóm
  const [members, setMembers] = useState<MlsMember[]>([])
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member'>('member')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Tải danh sách thành viên khi mở modal quản lý
  useEffect(() => {
    if (isOpen && conversationId && !isCreatingNew) {
      loadMembers()
      setNewTitle(groupTitle)
      setNewAvatar(groupAvatar)
    }
  }, [isOpen, conversationId, isCreatingNew, groupTitle, groupAvatar])

  const loadMembers = async () => {
    if (!conversationId) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/chat/mls/members?conversationId=${conversationId}`)
      const data = await res.json()
      if (data.success) {
        setMembers(data.members || [])
        setMyRole(data.myRole || 'member')
      } else {
        setErrorMsg(data.error || 'Không thể tải danh sách thành viên')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  // Thêm email vào danh sách tạo nhóm
  const handleAddEmailToList = () => {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ')
      return
    }
    if (memberEmails.includes(trimmed)) {
      setErrorMsg('Email đã có trong danh sách')
      return
    }
    setMemberEmails([...memberEmails, trimmed])
    setEmailInput('')
    setErrorMsg(null)
  }

  const handleRemoveEmailFromList = (email: string) => {
    setMemberEmails(memberEmails.filter((e) => e !== email))
  }

  // 1. Tạo nhóm mới
  const handleCreateGroup = async () => {
    if (!newTitle.trim()) {
      setErrorMsg('Vui lòng nhập tên nhóm')
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/chat/mls/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          avatarUrl: newAvatar || null,
          memberEmails,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('Tạo nhóm thành công!')
        if (onGroupCreated) onGroupCreated(data.conversation_id, newTitle.trim())
        setTimeout(() => {
          onClose()
        }, 800)
      } else {
        setErrorMsg(data.error || 'Không thể tạo nhóm')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi tạo nhóm')
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Cập nhật thông tin nhóm
  const handleUpdateInfo = async () => {
    if (!conversationId || !newTitle.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/chat/mls/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          title: newTitle.trim(),
          avatarUrl: newAvatar || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('Đã cập nhật thông tin nhóm!')
        if (onGroupUpdated) onGroupUpdated()
        setTimeout(() => setSuccessMsg(null), 2500)
      } else {
        setErrorMsg(data.error || 'Không thể cập nhật thông tin')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Thêm thành viên bằng email
  const handleAddMemberByEmail = async () => {
    if (!conversationId || !emailInput.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/chat/mls/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetEmail: emailInput.trim(),
          commitMessage: 'mls_commit_add_' + Date.now(),
          welcomeMessage: 'mls_welcome_' + Date.now(),
          newEpoch: Date.now(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(`Đã thêm ${data.full_name || emailInput} vào nhóm!`)
        setEmailInput('')
        loadMembers()
        if (onGroupUpdated) onGroupUpdated()
      } else {
        setErrorMsg(data.error || 'Không thể thêm thành viên')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  // 4. Xóa thành viên
  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!conversationId) return
    const isSelf = targetUserId === currentUserId
    const confirmText = isSelf
      ? 'Bạn có chắc chắn muốn rời nhóm này?'
      : `Bạn có chắc chắn muốn xóa "${targetName}" khỏi nhóm? Khóa mã hóa nhóm sẽ được xoay ngay lập tức.`
    if (!confirm(confirmText)) return

    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/chat/mls/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetUserId,
          commitMessage: 'mls_commit_remove_' + Date.now(),
          newEpoch: Date.now(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (isSelf) {
          onClose()
          if (onGroupUpdated) onGroupUpdated()
        } else {
          setSuccessMsg(`Đã xóa ${targetName} khỏi nhóm. Khóa MLS đã xoay an toàn.`)
          loadMembers()
          if (onGroupUpdated) onGroupUpdated()
        }
      } else {
        setErrorMsg(data.error || 'Không thể xóa thành viên')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  // 5. Đổi vai trò thành viên
  const handleRoleChange = async (targetUserId: string, newRole: 'admin' | 'member' | 'owner') => {
    if (!conversationId) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat/mls/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetUserId,
          newRole,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('Đã cập nhật vai trò thành công!')
        loadMembers()
        if (onGroupUpdated) onGroupUpdated()
      } else {
        setErrorMsg(data.error || 'Không thể cập nhật vai trò')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {isCreatingNew ? 'Tạo Nhóm Chat MLS' : 'Quản Lý Nhóm Chat MLS'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mã hóa nhóm RFC 9420 (ts-mls)</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Nội dung Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tên nhóm & Ảnh nhóm */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tên nhóm học tập
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ví dụ: Đội tuyển Toán 12, Nhóm ôn thi HSA..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={!isCreatingNew && myRole === 'member'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Ảnh đại diện nhóm (URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://... ảnh nhóm (tùy chọn)"
                  value={newAvatar}
                  onChange={(e) => setNewAvatar(e.target.value)}
                  disabled={!isCreatingNew && myRole === 'member'}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-xs disabled:opacity-60"
                />
                {!isCreatingNew && (myRole === 'owner' || myRole === 'admin') && (
                  <button
                    onClick={handleUpdateInfo}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium hover:bg-slate-700 transition-colors"
                  >
                    Lưu
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form thêm thành viên */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isCreatingNew ? 'Thêm bạn bè vào nhóm bằng email' : 'Thêm thành viên mới'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="Nhập email của bạn bè (đã kết bạn)..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      isCreatingNew ? handleAddEmailToList() : handleAddMemberByEmail()
                    }
                  }}
                  disabled={!isCreatingNew && myRole === 'member'}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-xs disabled:opacity-60"
                />
              </div>
              <button
                onClick={isCreatingNew ? handleAddEmailToList : handleAddMemberByEmail}
                disabled={isLoading || (!isCreatingNew && myRole === 'member')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Chỉ có thể thêm người dùng đã chấp nhận kết bạn trong danh bạ.</span>
            </p>
          </div>

          {/* Danh sách email chờ tạo nhóm (khi isCreatingNew) */}
          {isCreatingNew && memberEmails.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-slate-500">Đã chọn ({memberEmails.length}):</span>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                {memberEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmailFromList(email)}
                      className="hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách thành viên hiện tại (khi quản lý nhóm) */}
          {!isCreatingNew && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Thành viên nhóm ({members.length})
                </span>
                <button
                  onClick={loadMembers}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Làm mới"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {members.map((m) => {
                  const isMe = m.userId === currentUserId
                  return (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {m.name} {isMe && '(Bạn)'}
                            </span>
                            {m.role === 'owner' && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                <Crown className="w-2.5 h-2.5" /> Chủ nhóm
                              </span>
                            )}
                            {m.role === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                                <Shield className="w-2.5 h-2.5" /> Quản trị viên
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 truncate block">{m.email}</span>
                        </div>
                      </div>

                      {/* Hành động quản trị */}
                      <div className="flex items-center gap-1 shrink-0">
                        {myRole === 'owner' && !isMe && (
                          <>
                            {m.role === 'member' ? (
                              <button
                                onClick={() => handleRoleChange(m.userId, 'admin')}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                              >
                                Thăng Quản trị
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRoleChange(m.userId, 'member')}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors"
                              >
                                Hạ Thành viên
                              </button>
                            )}
                          </>
                        )}

                        {/* Nút Xóa / Rời nhóm */}
                        {(myRole === 'owner' || (myRole === 'admin' && m.role === 'member') || isMe) && (
                          <button
                            onClick={() => handleRemoveMember(m.userId, m.name)}
                            disabled={isLoading}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isMe
                                ? 'text-amber-600 hover:bg-amber-500/10'
                                : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title={isMe ? 'Rời nhóm' : 'Xóa khỏi nhóm'}
                          >
                            {isMe ? <LogOut className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Khóa nhóm tự động xoay khi có thay đổi nhân sự
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Đóng
            </button>
            {isCreatingNew && (
              <button
                onClick={handleCreateGroup}
                disabled={isLoading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {isLoading ? 'Đang tạo...' : 'Tạo nhóm ngay'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
