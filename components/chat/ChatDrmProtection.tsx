'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ShieldAlert, ShieldCheck, AlertTriangle, EyeOff, Lock, X } from 'lucide-react'
import { checkDeviceCompliance, isScreenCaptureKey, DeviceComplianceStatus } from '@/lib/senChatDeviceCompliance'

interface ChatDrmProtectionProps {
  isEnabled?: boolean
  showBadge?: boolean
}

export default function ChatDrmProtection({
  isEnabled = true,
  showBadge = false,
}: ChatDrmProtectionProps) {
  const [isBlackedOut, setIsBlackedOut] = useState(false)
  const [blackoutReason, setBlackoutReason] = useState<'screenshot' | 'blur' | 'devtools'>('screenshot')
  const [compliance, setCompliance] = useState<DeviceComplianceStatus | null>(null)
  const [showComplianceModal, setShowComplianceModal] = useState(false)
  const blackoutTimeoutRef = useRef<any>(null)

  // 1. Kiểm tra tiêu chuẩn thiết bị khi mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const report = checkDeviceCompliance(window)
    setCompliance(report)

    const checkInterval = setInterval(() => {
      const updated = checkDeviceCompliance(window)
      setCompliance(updated)
      if (updated.devToolsOpen && isEnabled) {
        setBlackoutReason('devtools')
        setIsBlackedOut(true)
      }
    }, 3000)

    return () => clearInterval(checkInterval)
  }, [isEnabled])

  // 2. Lắng nghe phím chụp màn hình & chuyển đổi cửa sổ
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return

    const triggerBlackout = (reason: 'screenshot' | 'blur', durationMs = 3000) => {
      setBlackoutReason(reason)
      setIsBlackedOut(true)

      // Xóa nội dung clipboard nếu người dùng vừa bấm PrintScreen để ngăn dán ảnh vừa chụp
      if (reason === 'screenshot' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(() => {})
      }

      if (blackoutTimeoutRef.current) {
        clearTimeout(blackoutTimeoutRef.current)
      }
      if (durationMs > 0) {
        blackoutTimeoutRef.current = setTimeout(() => {
          // Chỉ tắt nếu cửa sổ đang có focus và document visible
          if (document.hasFocus() && !document.hidden) {
            setIsBlackedOut(false)
          }
        }, durationMs)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScreenCaptureKey(e)) {
        e.preventDefault?.()
        e.stopPropagation?.()
        triggerBlackout('screenshot', 4000)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.key === 'Snapshot') {
        triggerBlackout('screenshot', 4000)
      }
    }

    const handleBlur = () => {
      // Khi cửa sổ mất tiêu điểm (ví dụ phần mềm chụp màn hình ngoài hoặc OBS đang hoạt động)
      triggerBlackout('blur', 0) // Giữ đen cho tới khi người dùng quay lại
    }

    const handleFocus = () => {
      // Khi người dùng quay trở lại cửa sổ
      if (blackoutTimeoutRef.current) clearTimeout(blackoutTimeoutRef.current)
      blackoutTimeoutRef.current = setTimeout(() => {
        setIsBlackedOut(false)
      }, 500)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerBlackout('blur', 0)
      } else {
        if (blackoutTimeoutRef.current) clearTimeout(blackoutTimeoutRef.current)
        blackoutTimeoutRef.current = setTimeout(() => {
          setIsBlackedOut(false)
        }, 500)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (blackoutTimeoutRef.current) clearTimeout(blackoutTimeoutRef.current)
    }
  }, [isEnabled])

  return (
    <>
      {/* 1. CSS CHỐNG IN ẤN VÀ SAO CHÉP KHI Ở CHẾ ĐỘ BẢO MẬT (DRM PRINT DEFENSE) */}
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

      {/* 2. MÀN CHE ĐEN TOÀN MÀN HÌNH KIỂU NETFLIX (BLACKOUT CURTAIN) */}
      {isBlackedOut && (
        <div
          role="alert"
          aria-live="assertive"
          onClick={() => setIsBlackedOut(false)}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black p-6 text-white select-none cursor-pointer transition-opacity duration-150 animate-in fade-in"
        >
          <div className="flex max-w-md flex-col items-center space-y-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 border border-emerald-500/30 text-emerald-400 shadow-2xl ring-4 ring-rose-500/20">
              <EyeOff className="h-8 w-8 text-rose-500 animate-pulse" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[11px] uppercase tracking-wider mb-2 border border-rose-500/30">
                <Lock className="h-3 w-3 inline" /> Blackout Curtain Active
              </span>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                Bảo Vệ Bản Quyền & Nội Dung Riêng Tư E2EE
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {blackoutReason === 'screenshot' &&
                'Màn hình đã được tạm thời che đen do phát hiện thao tác chụp ảnh hoặc ghi hình màn hình.'}
              {blackoutReason === 'blur' &&
                'Màn hình được che đen tự động khi cửa sổ chat mất tiêu điểm nhằm chống phần mềm quay lén chạy ngầm.'}
              {blackoutReason === 'devtools' &&
                'Phát hiện Developer Tools đang mở. Nội dung E2EE được che đen để bảo vệ khóa mật mã.'}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsBlackedOut(false)
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 border border-white/20 shadow-lg"
              >
                Nhấp chuột hoặc quay lại cửa sổ để tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. HUY HIỆU ĐỘ CHUẨN THIẾT BỊ (DEVICE COMPLIANCE BADGE - TÙY CHỌN) */}
      {showBadge && compliance && (
        <button
          type="button"
          onClick={() => setShowComplianceModal(true)}
          title="Kiểm tra độ chuẩn an toàn của thiết bị (Device Compliance)"
          className={`fixed bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-md backdrop-blur-md transition border ${
            compliance.isCompliant
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          {compliance.isCompliant ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span>{compliance.isCompliant ? 'E2EE Chuẩn Thiết Bị' : 'Cảnh Báo An Toàn'}</span>
        </button>
      )}

      {/* 4. HỘP THOẠI CHI TIẾT BÁO CÁO ĐỘ CHUẨN THIẾT BỊ */}
      {showComplianceModal && compliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-500" />
                <h4 className="font-bold text-xs uppercase tracking-wider">
                  Độ Chuẩn Thiết Bị E2EE
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowComplianceModal(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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
                onClick={() => setShowComplianceModal(false)}
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
