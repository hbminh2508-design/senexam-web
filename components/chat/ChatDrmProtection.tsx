'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ShieldAlert, ShieldCheck, AlertTriangle, X } from 'lucide-react'
import { checkDeviceCompliance, DeviceComplianceStatus } from '@/lib/senChatDeviceCompliance'

export interface DeviceComplianceDetailModalProps {
  compliance: DeviceComplianceStatus
  onClose: () => void
}

export function DeviceComplianceDetailModal({ compliance, onClose }: DeviceComplianceDetailModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!mounted || typeof document === 'undefined') return null

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-500" />
            <h4 className="font-bold text-xs uppercase tracking-wider">
              Độ Chuẩn Thiết Bị E2EE
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span>Secure Context (HTTPS / Localhost)</span>
            <span className={compliance.secureContext ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
              {compliance.secureContext ? 'Đạt' : 'Không đạt'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span>Web Crypto API (AES-256-GCM / Subtle)</span>
            <span className={compliance.webCrypto ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
              {compliance.webCrypto ? 'Đạt' : 'Thiếu API'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span>IndexedDB (Signal Ratchet State)</span>
            <span className={compliance.indexedDb ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
              {compliance.indexedDb ? 'Đạt' : 'Không có'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span>Developer Tools Detection</span>
            <span className={!compliance.devToolsOpen ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
              {!compliance.devToolsOpen ? 'Đóng an toàn' : 'Đang mở ⚠️'}
            </span>
          </div>
        </div>

        {compliance.warnings.length > 0 && (
          <div className="mt-3 space-y-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            {compliance.warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return null
}

/**
 * Huy hiệu E2EE Chuẩn Thiết Bị tinh tế, có thể đặt ở Header khung chat hoặc Drawer
 * Tuyệt đối không dùng position fixed đè lên Avatar người dùng.
 */
export function ChatDeviceComplianceBadge({
  className = '',
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [compliance, setCompliance] = useState<DeviceComplianceStatus | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const report = checkDeviceCompliance(window)
    setCompliance(report)

    const interval = setInterval(() => {
      setCompliance(checkDeviceCompliance(window))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!compliance) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        title="Kiểm tra độ chuẩn an toàn của thiết bị (Device Compliance)"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition border ${
          compliance.isCompliant
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
        } ${className}`}
      >
        {compliance.isCompliant ? (
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        )}
        <span>{compliance.isCompliant ? 'E2EE Chuẩn Thiết Bị' : 'Cảnh Báo An Toàn'}</span>
      </button>

      {showModal && (
        <DeviceComplianceDetailModal compliance={compliance} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

interface ChatDrmProtectionProps {
  isEnabled?: boolean
  showBadge?: boolean
}

export default function ChatDrmProtection({
  isEnabled = true,
  showBadge = false,
}: ChatDrmProtectionProps) {
  return (
    <>
      {/* 1. CSS CHỐNG IN ẤN VÀ BẢO VỆ NỘI DUNG NHẠY CẢM (@media print) */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            html, body, #__next, div, main, aside, header {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              background: black !important;
            }
          }
          .senchat-drm-protected {
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
        `,
      }} />

      {/* 2. HUY HIỆU E2EE (NẾU BẬT showBadge, HIỂN THỊ DẠNG INLINE TINH TẾ THAY VÌ FIXED GÓC MÀN HÌNH) */}
      {showBadge && (
        <div className="senchat-device-badge-wrapper inline-flex">
          <ChatDeviceComplianceBadge />
        </div>
      )}
    </>
  )
}
