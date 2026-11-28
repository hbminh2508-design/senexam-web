'use client'

import { ShieldCheck, AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { ChatDeviceComplianceBadge } from '@/components/chat/ChatDrmProtection'

interface ChatSafetyWidgetProps {
  partnerId: string
  partnerName: string
  safetyNumber?: {
    numericSafetyNumber: string
    chunks: string[]
    fingerprintHex: string
    qrCodePayload: string
  } | null
  keyChanged?: boolean
  isVerified?: boolean
  onMarkVerified?: (verified: boolean) => void
}

export default function ChatSafetyWidget({
  partnerId,
  partnerName,
  safetyNumber,
  keyChanged = false,
  isVerified = false,
  onMarkVerified,
}: ChatSafetyWidgetProps) {

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 backdrop-blur-md dark:border-emerald-500/30 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Mã an toàn Signal E2EE
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mã hóa đầu-cuối không lưu trữ máy chủ
            </p>
          </div>
        </div>

        {isVerified ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Đã xác minh
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Đã mã hóa
          </span>
        )}
      </div>

      {keyChanged && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <div>
            <span className="font-semibold">Cảnh báo khóa đã đổi: </span>
            Khóa mã hóa của {partnerName} đã thay đổi so với lần trước. Hãy đối chiếu lại mã an toàn 60 số trước khi chia sẻ dữ liệu nhạy cảm.
          </div>
        </div>
      )}

      {safetyNumber?.chunks && safetyNumber.chunks.length > 0 && (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white/70 p-2.5 font-mono text-[11px] tracking-wider text-slate-700 shadow-inner dark:bg-slate-900/60 dark:text-slate-300">
            {safetyNumber.chunks.map((chunk, idx) => (
              <span key={idx} className="text-center font-medium">
                {chunk}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {onMarkVerified && (
              <button
                type="button"
                onClick={() => onMarkVerified(!isVerified)}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                  isVerified
                    ? 'border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                {isVerified ? 'Hủy đánh dấu' : 'Đánh dấu tin cậy'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Độ Chuẩn Thiết Bị E2EE */}
      <div className="mt-3 pt-3 border-t border-emerald-500/10 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Độ chuẩn thiết bị:</span>
        <ChatDeviceComplianceBadge />
      </div>

    </div>
  )
}
