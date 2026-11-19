'use client'

import React, { useEffect, useState } from 'react'
import { Laptop, Smartphone, Globe, ShieldAlert, LogOut, RefreshCw, X, ShieldCheck } from 'lucide-react'

interface ChatDevice {
  id: string
  device_id: string
  device_name: string
  platform: string
  is_active: boolean
  last_seen_at: string
  created_at: string
}

interface ChatAuditLog {
  id: string
  event_type: string
  details: any
  ip_address: string
  created_at: string
}

interface ChatDeviceManagerModalProps {
  isOpen: boolean
  onClose: () => void
  currentDeviceId: string
}

export default function ChatDeviceManagerModal({
  isOpen,
  onClose,
  currentDeviceId,
}: ChatDeviceManagerModalProps) {
  const [devices, setDevices] = useState<ChatDevice[]>([])
  const [auditLogs, setAuditLogs] = useState<ChatAuditLog[]>([])
  const [activeTab, setActiveTab] = useState<'devices' | 'audit'>('devices')
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [devResp, logResp] = await Promise.all([
        fetch('/api/chat/device-management'),
        fetch('/api/chat/audit-log'),
      ])
      const devData = await devResp.json()
      const logData = await logResp.json()

      if (devData?.devices) setDevices(devData.devices)
      if (logData?.logs) setAuditLogs(logData.logs)
    } catch (e) {
      console.warn('Lỗi tải dữ liệu thiết bị/audit:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất và thu hồi khóa của thiết bị này từ xa?')) return

    try {
      const resp = await fetch('/api/chat/device-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const result = await resp.json()
      if (result?.success) {
        setActionMsg('Đã đăng xuất thiết bị thành công')
        loadData()
      } else {
        alert(result?.error || 'Không thể đăng xuất thiết bị')
      }
    } catch {
      alert('Lỗi kết nối máy chủ')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Trung Tâm Bảo Mật & Thiết Bị
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý phiên đăng nhập và nhật ký an ninh Sen Chat
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

        {/* Tab switch */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`min-h-[40px] flex-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'devices'
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Thiết Bị Đang Đăng Nhập ({devices.filter((d) => d.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`min-h-[40px] flex-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'audit'
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Nhật Ký An Ninh ({auditLogs.length})
          </button>
        </div>

        {actionMsg && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {actionMsg}
          </div>
        )}

        {/* Body content */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {activeTab === 'devices' && (
            <div className="space-y-3">
              {devices.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">Chưa có thiết bị nào</p>
              ) : (
                devices.map((device) => {
                  const isCurrent = device.device_id === currentDeviceId
                  const isAndroid = device.platform === 'android'
                  const isDesktop = device.platform === 'desktop'

                  return (
                    <div
                      key={device.id}
                      className={`flex items-center justify-between rounded-2xl border p-3.5 transition ${
                        isCurrent
                          ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                          {isAndroid ? (
                            <Smartphone className="h-5 w-5 text-emerald-600" />
                          ) : isDesktop ? (
                            <Laptop className="h-5 w-5 text-indigo-600" />
                          ) : (
                            <Globe className="h-5 w-5 text-sky-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-xs dark:text-slate-100">
                              {device.device_name || 'Sen Chat Device'}
                            </span>
                            {isCurrent && (
                              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Thiết bị này
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Hoạt động: {new Date(device.last_seen_at).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>

                      {!isCurrent && device.is_active && (
                        <button
                          type="button"
                          onClick={() => handleRevokeDevice(device.device_id)}
                          className="flex min-h-[44px] items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-400"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Đăng xuất từ xa
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">Chưa có bản ghi an ninh nào</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {log.event_type === 'device_registered' && 'Đăng ký thiết bị mới'}
                        {log.event_type === 'identity_key_changed' && 'Thay đổi khóa Identity'}
                        {log.event_type === 'device_revoked' && 'Thu hồi / Đăng xuất thiết bị'}
                        {log.event_type === 'replay_blocked' && 'Chặn phát lại tin nhắn (Replay)'}
                        {!['device_registered', 'identity_key_changed', 'device_revoked', 'replay_blocked'].includes(log.event_type) && log.event_type}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {log.details ? JSON.stringify(log.details) : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl bg-slate-100 px-5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
