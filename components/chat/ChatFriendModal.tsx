'use client'

import React, { useState } from 'react'
import { UserPlus, Search, AlertCircle, CheckCircle2, X, Flag, Shield, Lock, Info } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface ChatFriendModalProps {
  isOpen: boolean
  onClose: () => void
  onStartChatWithUser?: (user: any) => void
}

export default function ChatFriendModal({
  isOpen,
  onClose,
  onStartChatWithUser,
}: ChatFriendModalProps) {
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchResult, setSearchResult] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSelfEmail, setIsSelfEmail] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  // Report state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = emailInput.trim().toLowerCase()
    if (!cleanEmail) return

    setLoading(true)
    setErrorMessage(null)
    setIsSelfEmail(false)
    setSearchResult(null)
    setActionSuccessMsg(null)

    try {
      let { data: authData } = await supabase.auth.getSession()
      let token = authData.session?.access_token
      if (!token) {
        const { data: refData } = await supabase.auth.refreshSession()
        token = refData?.session?.access_token
      }

      const resp = await fetch('/api/chat/friend-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: cleanEmail }),
      })

      if (resp.status === 429) {
        setErrorMessage('Bạn đã vượt quá giới hạn tìm kiếm (5 lần/phút). Vui lòng chờ giây lát.')
        return
      }

      const data = await resp.json()
      if (data?.is_self) {
        setIsSelfEmail(true)
        setErrorMessage(data.message || 'Đây là email tài khoản của chính bạn.')
        return
      }

      if (data?.found && data?.user) {
        setSearchResult(data.user)
      } else {
        setErrorMessage(data?.message || 'Không tìm thấy người dùng phù hợp')
      }
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ')
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvite = async () => {
    if (!searchResult?.id) return
    setLoading(true)
    try {
      let { data: authData } = await supabase.auth.getSession()
      let token = authData.session?.access_token
      if (!token) {
        const { data: refData } = await supabase.auth.refreshSession()
        token = refData?.session?.access_token
      }
      const resp = await fetch('/api/chat/friend-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'send', targetUserId: searchResult.id }),
      })
      const data = await resp.json()
      if (data?.success) {
        setActionSuccessMsg(data.message || 'Đã gửi lời mời kết bạn!')
        setSearchResult((prev: any) => ({ ...prev, friendshipStatus: 'pending' }))
      } else {
        alert(data?.error || 'Không thể gửi lời mời')
      }
    } catch {
      alert('Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchResult?.id || !reportReason.trim()) return

    setReportLoading(true)
    try {
      let { data: authData } = await supabase.auth.getSession()
      let token = authData.session?.access_token
      if (!token) {
        const { data: refData } = await supabase.auth.refreshSession()
        token = refData?.session?.access_token
      }
      const resp = await fetch('/api/chat/friend-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'report',
          targetUserId: searchResult.id,
          reason: reportReason.trim(),
        }),
      })
      const data = await resp.json()
      if (data?.success) {
        alert(data.message)
        setShowReportModal(false)
      } else {
        alert(data?.error || 'Không thể gửi báo cáo')
      }
    } catch {
      alert('Lỗi kết nối')
    } finally {
      setReportLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-sky-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Tìm & Kết Bạn
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bảo vệ chống rà quét danh bạ (SHA-256)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form tìm kiếm */}
        <form onSubmit={handleLookup} className="mt-4">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Nhập chính xác địa chỉ Email người dùng
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="ví dụ: hocvien@senexam.edu.vn"
              required
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Đang tra...' : 'Tìm'}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-xs ${
            isSelfEmail
              ? 'border border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
          }`}>
            {isSelfEmail ? (
              <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            )}
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Result Card */}
        {searchResult && (
          <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-50/40 p-4 dark:border-blue-500/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 font-bold text-white shadow-md">
                {searchResult.name.substring(0, 1).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm dark:text-slate-100">
                  {searchResult.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchResult.school || 'Học viên SenExam'}
                  {searchResult.className ? ` • Lớp ${searchResult.className}` : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              {searchResult.friendshipStatus === 'accepted' ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartChatWithUser?.(searchResult)
                  }}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
                >
                  Nhắn tin ngay
                </button>
              ) : searchResult.friendshipStatus === 'pending' ? (
                <button
                  type="button"
                  disabled
                  className="min-h-[44px] flex-1 rounded-xl bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >
                  Đã gửi lời mời
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendInvite}
                  disabled={loading}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" /> Gửi lời mời kết bạn
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                title="Báo cáo người dùng"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Báo cáo người dùng */}
        {showReportModal && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
            <h5 className="font-bold text-xs text-rose-800 dark:text-rose-200">
              Lý do báo cáo vi phạm
            </h5>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Spam, quấy rối, ngôn từ thù địch..."
              rows={2}
              className="mt-2 w-full rounded-xl border border-rose-200 bg-white p-2 text-xs outline-none focus:border-rose-500 dark:border-rose-900 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReportUser}
                disabled={reportLoading || !reportReason.trim()}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {reportLoading ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Shield className="h-3.5 w-3.5 text-blue-600" />
          <span>Email được băm SHA-256 một chiều, không thể truy ngược.</span>
        </div>
      </div>
    </div>
  )
}
