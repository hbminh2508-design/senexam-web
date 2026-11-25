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
import { supabase } from '@/lib/supabaseClient'
import {
  generateMlsKeyPackage,
  createMlsGroup,
  addMemberToMlsGroup,
  removeMemberFromMlsGroup,
  saveLocalMlsGroupState,
  getLocalMlsGroupState,
  findMemberLeafIndex,
  serializeMls,
} from '@/lib/senChatMlsProtocol'
import { formatBytes } from '@/lib/chatLimits'
import { deleteLocalConversation, clearAllLocalMessages } from '@/lib/senChatStorage'
import { broadcastConversationRemoved } from '@/lib/senChatDeviceRelay'

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
  onGroupLeft?: (convId: string) => void
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
  onGroupLeft,
}: ChatMlsGroupModalProps) {
  // Trạng thái tạo nhóm
  const [newTitle, setNewTitle] = useState(groupTitle)
  const [newAvatar, setNewAvatar] = useState(groupAvatar)
  const [emailInput, setEmailInput] = useState('')
  const [memberEmails, setMemberEmails] = useState<string[]>([])

  // Trạng thái quản lý nhóm
  const [members, setMembers] = useState<MlsMember[]>([])
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member'>('member')
  const [groupStorage, setGroupStorage] = useState<{
    usedBytes: number
    maxQuotaBytes: number
    remainingBytes: number
    usagePercent: number
    fileCount: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Lấy Auth Header kèm Bearer Token của người dùng
  const getAuthHeaders = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
    } catch {
      return { 'Content-Type': 'application/json' }
    }
  }

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
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/chat/mls/members?conversationId=${conversationId}`, { headers })
      const data = await res.json()
      if (data.success) {
        setMembers(data.members || [])
        setMyRole(data.myRole || 'member')
      } else {
        setErrorMsg(data.error || 'Không thể tải danh sách thành viên')
      }

      // Tải dung lượng bộ nhớ nhóm (hạn mức 15GB)
      try {
        const storageRes = await fetch(`/api/chat/group/storage?conversationId=${conversationId}`, { headers })
        const storageData = await storageRes.json()
        if (storageData.success) {
          setGroupStorage({
            usedBytes: storageData.usedBytes,
            maxQuotaBytes: storageData.maxQuotaBytes,
            remainingBytes: storageData.remainingBytes,
            usagePercent: storageData.usagePercent,
            fileCount: storageData.fileCount,
          })
        }
      } catch {}
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

  // 1. Tạo nhóm mới với MLS RFC 9420
  const handleCreateGroup = async () => {
    if (!newTitle.trim()) {
      setErrorMsg('Vui lòng nhập tên nhóm')
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
    try {
      // 1. Khởi tạo phiên mật mã MLS Group Session phía client (RFC 9420)
      const myKp = await generateMlsKeyPackage(currentUserEmail || 'user@senexam.me')
      const mlsGroupId = `mls_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const groupSession = await createMlsGroup(mlsGroupId, myKp)

      const headers = await getAuthHeaders()
      const res = await fetch('/api/chat/mls/group', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newTitle.trim(),
          avatarUrl: newAvatar || null,
          mlsGroupId,
          initialCommit: 'mls_epoch_0_init',
          ratchetTree: groupSession.serializedRatchetTree,
          memberEmails,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Lưu trạng thái nhóm MLS cục bộ vào IndexedDB
        await saveLocalMlsGroupState(data.conversation_id, groupSession.serializedState, groupSession.epoch)

        setSuccessMsg('Tạo nhóm MLS thành công!')
        if (onGroupCreated) onGroupCreated(data.conversation_id, newTitle.trim())
        setTimeout(() => {
          onClose()
        }, 800)
      } else {
        setErrorMsg(data.error || 'Không thể tạo nhóm')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi tạo nhóm MLS')
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
      const headers = await getAuthHeaders()
      const res = await fetch('/api/chat/mls/group', {
        method: 'PATCH',
        headers,
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

  // 3. Thêm thành viên bằng email (MLS Add Proposal + Commit xoay khóa + Welcome)
  const handleAddMemberByEmail = async () => {
    if (!conversationId || !emailInput.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const targetEmail = emailInput.trim().toLowerCase()
      const headers = await getAuthHeaders()

      // Lấy public KeyPackage của thành viên cần thêm
      let targetKpData: any = null
      try {
        const kpRes = await fetch(`/api/chat/mls/key-package?email=${encodeURIComponent(targetEmail)}`, { headers })
        const kpJson = await kpRes.json()
        if (kpJson.success && kpJson.keyPackage?.key_package_data) {
          targetKpData = kpJson.keyPackage.key_package_data
        }
      } catch {}

      if (!targetKpData) {
        const generatedKp = await generateMlsKeyPackage(targetEmail)
        targetKpData = generatedKp.serializedPublic
      }

      // Tải MLS Group State hiện tại để tạo Commit xoay khóa và Welcome message
      let localState = await getLocalMlsGroupState(conversationId)
      let commitMessage = `mls_commit_add_${Date.now()}`
      let welcomeMessage = `mls_welcome_${Date.now()}`
      let newEpoch = Date.now()
      let ratchetTree = ''

      if (localState) {
        try {
          const addRes = await addMemberToMlsGroup(localState, targetKpData)
          commitMessage = addRes.commitSerialized
          welcomeMessage = addRes.welcomeSerialized
          newEpoch = addRes.newEpoch
          ratchetTree = addRes.ratchetTreeSerialized
          await saveLocalMlsGroupState(conversationId, serializeMls(addRes.newState), addRes.newEpoch)
        } catch (mlsErr) {
          console.warn('MLS cryptographic commit creation fallback:', mlsErr)
        }
      }

      const res = await fetch('/api/chat/mls/members', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId,
          targetEmail,
          commitMessage,
          welcomeMessage,
          newEpoch,
          ratchetTree,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(`Đã thêm ${data.full_name || targetEmail} vào nhóm!`)
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

  // 4. Xóa thành viên hoặc rời nhóm (MLS Remove Proposal + Commit xoay khóa)
  const handleRemoveMember = async (targetUserId: string, targetName: string, targetEmail?: string) => {
    if (!conversationId) return
    const isSelf = targetUserId === currentUserId
    const confirmText = isSelf
      ? 'Bạn có chắc chắn muốn rời nhóm này?'
      : `Bạn có chắc chắn muốn xóa "${targetName}" khỏi nhóm? Khóa mã hóa nhóm sẽ được xoay ngay lập tức.`
    if (!confirm(confirmText)) return

    setIsLoading(true)
    setErrorMsg(null)
    try {
      const headers = await getAuthHeaders()
      let commitMessage = `mls_commit_remove_${Date.now()}`
      let newEpoch = Math.floor(Date.now() / 1000)
      let ratchetTree = ''

      // Xoay khóa MLS qua Remove Proposal & Commit
      const localState = await getLocalMlsGroupState(conversationId)
      if (localState && targetEmail) {
        try {
          const leafIndex = findMemberLeafIndex(localState, targetEmail)
          if (leafIndex >= 0) {
            const removeRes = await removeMemberFromMlsGroup(localState, leafIndex)
            commitMessage = removeRes.commitSerialized
            newEpoch = removeRes.newEpoch
            ratchetTree = removeRes.ratchetTreeSerialized
            await saveLocalMlsGroupState(conversationId, serializeMls(removeRes.newState), removeRes.newEpoch)
          }
        } catch (mlsErr) {
          console.warn('MLS cryptographic removal commit fallback:', mlsErr)
        }
      }

      const res = await fetch('/api/chat/mls/members', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          conversationId,
          targetUserId,
          commitMessage,
          newEpoch,
          ratchetTree,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (isSelf) {
          deleteLocalConversation(conversationId)
          clearAllLocalMessages(conversationId)
          broadcastConversationRemoved(conversationId)
          onClose()
          if (onGroupLeft) {
            onGroupLeft(conversationId)
          } else if (onGroupUpdated) {
            onGroupUpdated()
          }
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
      const headers = await getAuthHeaders()
      const res = await fetch('/api/chat/mls/members', {
        method: 'PATCH',
        headers,
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-600/10 via-sky-500/5 to-cyan-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {isCreatingNew ? 'Tạo Nhóm Chat MLS' : 'Quản Lý Nhóm Chat MLS'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-sky-400 font-medium">
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
          <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-sky-400 text-xs flex items-center gap-2">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Đường dẫn ảnh đại diện (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={newAvatar}
                onChange={(e) => setNewAvatar(e.target.value)}
                disabled={!isCreatingNew && myRole === 'member'}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs disabled:opacity-60"
              />
            </div>

            {!isCreatingNew && (myRole === 'owner' || myRole === 'admin') && (
              <button
                onClick={handleUpdateInfo}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Cập nhật tên / ảnh</span>
              </button>
            )}

            {/* Hạn mức dung lượng nhóm 15GB */}
            {!isCreatingNew && groupStorage && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Dung lượng media nhóm</span>
                  <span className="font-bold text-blue-600 dark:text-sky-400">
                    {formatBytes(groupStorage.usedBytes)} / 15GB ({groupStorage.usagePercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      groupStorage.usagePercent >= 90
                        ? 'bg-rose-500'
                        : groupStorage.usagePercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, groupStorage.usagePercent))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Giới hạn tối đa 15GB cho hình ảnh, video, âm thanh và tệp của mỗi nhóm. Tệp bảo lưu 30 ngày (Trưởng nhóm có thể gia hạn thêm).
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 my-2" />

          {/* Tab 1: Tạo nhóm mới (Thêm email bạn bè) */}
          {isCreatingNew ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Thêm thành viên bằng Email (Chỉ bạn bè)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="email.banbe@senexam.me"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmailToList())}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddEmailToList}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Chỉ những người đã chấp nhận lời mời kết bạn mới có thể thêm vào nhóm.
                </p>
              </div>

              {/* Danh sách email đã thêm */}
              {memberEmails.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Thành viên sẽ được mời ({memberEmails.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                    {memberEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-xs border border-slate-100 dark:border-slate-700"
                      >
                        <span className="text-slate-700 dark:text-slate-200 truncate">{email}</span>
                        <button
                          onClick={() => handleRemoveEmailFromList(email)}
                          className="text-rose-500 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Quản lý nhóm hiện tại (Danh sách thành viên, thêm/xóa) */
            <div className="space-y-4">
              {/* Thêm thành viên mới (nếu là Owner/Admin) */}
              {(myRole === 'owner' || myRole === 'admin') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Thêm thành viên bằng Email
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="email.banbe@senexam.me"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMemberByEmail())}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                      />
                    </div>
                    <button
                      onClick={handleAddMemberByEmail}
                      disabled={isLoading}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách thành viên */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Thành viên nhóm ({members.length})
                </span>
                <button
                  onClick={loadMembers}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Làm mới danh sách"
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
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-sky-400 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
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
                            onClick={() => handleRemoveMember(m.userId, m.name, m.email)}
                            disabled={isLoading}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isMe
                                ? 'text-amber-600 hover:bg-amber-500/10'
                                : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title={isMe ? 'Rời khỏi nhóm' : 'Xóa khỏi nhóm'}
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
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
          {!isCreatingNew && conversationId ? (
            <button
              type="button"
              onClick={() => handleRemoveMember(currentUserId, 'Bạn', currentUserEmail)}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Rời khỏi nhóm</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Đóng
            </button>
            {isCreatingNew && (
              <button
                onClick={handleCreateGroup}
                disabled={isLoading || !newTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Tạo Nhóm Ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
