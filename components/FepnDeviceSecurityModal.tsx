'use client'

import React, { useState, useEffect } from 'react'
import {
  Smartphone,
  Laptop,
  Globe,
  ShieldCheck,
  LogOut,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
} from 'lucide-react'

interface SessionItem {
  id: string
  device_id: string
  device_name: string
  device_type: string
  browser: string
  os: string
  ip_address: string
  is_active: boolean
  last_active_at: string
  created_at: string
  isCurrentDevice?: boolean
}

interface FepnDeviceSecurityModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userEmail?: string
}

export default function FepnDeviceSecurityModal({
  isOpen,
  onClose,
  userId,
  userEmail,
}: FepnDeviceSecurityModalProps) {
  const [loading, setLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)
  const [activeSessions, setActiveSessions] = useState<SessionItem[]>([])
  const [recentHistory, setRecentHistory] = useState<SessionItem[]>([])
  const [totalActiveCount, setTotalActiveCount] = useState(1)
  const [currentDeviceId, setCurrentDeviceId] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Khởi tạo Device ID nếu chưa có
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let dId = localStorage.getItem('fepn_device_id')
      if (!dId) {
        dId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        localStorage.setItem('fepn_device_id', dId)
      }
      setCurrentDeviceId(dId)
    }
  }, [])

  const fetchSessions = async () => {
    if (!userId) return
    setLoading(true)
    setMsg(null)
    try {
      const dId = typeof window !== 'undefined' ? localStorage.getItem('fepn_device_id') || '' : ''
      const res = await fetch('/api/fepn-auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          userId,
          currentDeviceId: dId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setActiveSessions(data.activeSessions || [])
        setRecentHistory(data.recentHistory || [])
        setTotalActiveCount(data.totalActiveCount || 1)
      }
    } catch (err: any) {
      console.warn('Lỗi lấy danh sách phiên đăng nhập:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userId) {
      fetchSessions()
    }
  }, [isOpen, userId])

  const handleRevokeSingle = async (sessionId: string, devName: string) => {
    if (!confirm(`Bạn có chắc muốn đăng xuất thiết bị "${devName}" từ xa?`)) return
    setRevokingId(sessionId)
    try {
      const res = await fetch('/api/fepn-auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          userId,
          sessionId,
        }),
      })
      if (res.ok) {
        setMsg({ type: 'success', text: `Đã đăng xuất thiết bị ${devName} thành công!` })
        fetchSessions()
      } else {
        throw new Error('Lỗi thu hồi thiết bị')
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Không thể đăng xuất thiết bị' })
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeOthers = async () => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản này khỏi TẤT CẢ các thiết bị khác không?')) return
    setRevokingAll(true)
    try {
      const dId = typeof window !== 'undefined' ? localStorage.getItem('fepn_device_id') || '' : ''
      const res = await fetch('/api/fepn-auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke_others',
          userId,
          currentDeviceId: dId,
        }),
      })
      if (res.ok) {
        setMsg({ type: 'success', text: '🎉 Đã đăng xuất khỏi tất cả các thiết bị khác thành công!' })
        fetchSessions()
      } else {
        throw new Error('Không thể đăng xuất các thiết bị khác')
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Lỗi khi đăng xuất các thiết bị khác' })
    } finally {
      setRevokingAll(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 p-5 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  Nhật Ký & Thiết Bị Đăng Nhập FEPN
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-[10px]">
                  {totalActiveCount} máy đang online
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tài khoản: <strong className="font-mono text-sky-700">{userEmail || 'Sinh viên VNU'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Thông báo Alert */}
        {msg && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`w-1/2 py-2 rounded-xl transition ${
              activeTab === 'active'
                ? 'bg-white text-sky-600 shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Đang Hoạt Động ({activeSessions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`w-1/2 py-2 rounded-xl transition ${
              activeTab === 'history'
                ? 'bg-white text-sky-600 shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Lịch Sử 15 Ngày Gần Nhất ({recentHistory.length})
          </button>
        </div>

        {/* NỘI DUNG TAB 1: THIẾT BỊ ĐANG HOẠT ĐỘNG */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                Các thiết bị đang duy trì phiên đăng nhập vào tài khoản của bạn:
              </span>
              {activeSessions.filter((s) => !s.isCurrentDevice).length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeOthers}
                  disabled={revokingAll}
                  className="text-[11px] font-black text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {revokingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Đăng xuất tất cả máy khác</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {activeSessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold">
                  Không tìm thấy thiết bị nào đang hoạt động.
                </div>
              ) : (
                activeSessions.map((session) => (
                  <div
                    key={session.id || session.device_id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      session.isCurrentDevice
                        ? 'bg-sky-50/50 border-sky-200'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          session.isCurrentDevice
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        {session.device_type === 'mobile' ? (
                          <Smartphone className="h-5 w-5" />
                        ) : (
                          <Laptop className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {session.device_name}
                          </span>
                          {session.isCurrentDevice ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-[10px] whitespace-nowrap">
                              Thiết bị này (Đang dùng)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] whitespace-nowrap flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Đang online
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.browser} • {session.os}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            IP: {session.ip_address}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!session.isCurrentDevice && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSingle(session.id || session.device_id, session.device_name)}
                        disabled={revokingId === (session.id || session.device_id)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                        title="Đăng xuất thiết bị này từ xa"
                      >
                        {revokingId === (session.id || session.device_id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <LogOut className="h-3 w-3" />
                        )}
                        <span>Đăng xuất</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB 2: LỊCH SỬ 15 NGÀY GẦN NHẤT */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Danh sách ghi nhận tất cả các máy và lượt đăng nhập trong vòng 15 ngày qua:
            </p>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Thiết Bị</th>
                    <th className="px-4 py-2.5">Trình Duyệt & OS</th>
                    <th className="px-4 py-2.5">Địa Chỉ IP</th>
                    <th className="px-4 py-2.5">Thời Gian</th>
                    <th className="px-4 py-2.5 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Chưa có lịch sử đăng nhập trong 15 ngày qua.
                      </td>
                    </tr>
                  ) : (
                    recentHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            {item.device_type === 'mobile' ? (
                              <Smartphone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            ) : (
                              <Laptop className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            )}
                            <span className="truncate max-w-[120px]">{item.device_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 truncate max-w-[130px]">
                          {item.browser} ({item.os})
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                          {item.ip_address}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              item.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {item.is_active ? 'Online' : 'Đã Thoát'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
