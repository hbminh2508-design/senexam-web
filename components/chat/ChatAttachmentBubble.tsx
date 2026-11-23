'use client'

import React, { useState, useEffect } from 'react'
import {
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Lock,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Check,
  Play,
  Clock,
  Sparkles,
  CalendarPlus,
} from 'lucide-react'
import {
  formatBytes,
  isExecutableFile,
  isRestrictedInlineFile,
} from '@/lib/chatLimits'
import {
  decryptFileToBlob,
  base64ToBytes,
} from '@/lib/senChatChunkCrypto'
import { openSafeDownload } from '@/lib/capacitorBridge'
import ChatFilePreviewModal from '@/components/chat/ChatFilePreviewModal'
import { supabase } from '@/lib/supabaseClient'

interface ChatAttachmentBubbleProps {
  attachmentId?: string
  driveFileId?: string
  storageProvider?: string
  storagePath?: string
  fileKeyBase64?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  fileType?: 'image' | 'video' | 'file'
  expiresAt?: string
  isPinnedPermanent?: boolean
  isGroup?: boolean
  canExtendRetention?: boolean
  onRetentionExtended?: (attachmentId: string, newExpiresAt: string | null, isPermanent: boolean) => void
  isMe?: boolean
}

export default function ChatAttachmentBubble({
  attachmentId,
  driveFileId,
  storageProvider,
  storagePath,
  fileKeyBase64,
  fileName = 'file_dinh_kem.bin',
  fileSize = 0,
  mimeType = 'application/octet-stream',
  fileType = 'file',
  expiresAt,
  isPinnedPermanent = false,
  isGroup = false,
  canExtendRetention = false,
  onRetentionExtended,
  isMe = false,
}: ChatAttachmentBubbleProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExeConfirm, setShowExeConfirm] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | undefined>(expiresAt)
  const [currentIsPermanent, setCurrentIsPermanent] = useState<boolean>(isPinnedPermanent)
  const [extendFeedback, setExtendFeedback] = useState<string | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const handleOpenPreview = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      if (!decryptedUrl) {
        setIsLoading(true)
        const url = await fetchAndDecryptBlob()
        setDecryptedUrl(url)
      }
      setShowPreviewModal(true)
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi chuẩn bị xem trước tệp')
    } finally {
      setIsLoading(false)
    }
  }

  const isExe = isExecutableFile(fileName, mimeType)
  const isRestricted = isRestrictedInlineFile(fileName, mimeType)
  const isImage = fileType === 'image' && !isRestricted
  const isVideo = fileType === 'video'

  // Tính toán thời gian lưu trữ còn lại
  const getRetentionInfo = () => {
    if (currentIsPermanent) {
      return { text: 'Lưu trữ vĩnh viễn', isExpired: false, isPermanent: true }
    }
    if (!currentExpiresAt) {
      return { text: 'Bảo lưu 30 ngày', isExpired: false, isPermanent: false }
    }
    const diffMs = new Date(currentExpiresAt).getTime() - Date.now()
    if (diffMs <= 0) {
      return { text: 'Đã hết hạn lưu trữ', isExpired: true, isPermanent: false }
    }
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return { text: `Bảo lưu: còn ${days} ngày`, isExpired: false, isPermanent: false, days }
  }

  const retention = getRetentionInfo()

  const handleExtendRetention = async (days: number, permanent = false) => {
    if (!attachmentId) return
    setIsExtending(true)
    setExtendFeedback(null)
    try {
      const res = await fetch('/api/chat/attachments/extend-retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId, days, permanent }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCurrentExpiresAt(data.expires_at)
        setCurrentIsPermanent(Boolean(data.is_pinned_permanent))
        setExtendFeedback(data.message || 'Đã gia hạn thành công!')
        if (onRetentionExtended) {
          onRetentionExtended(attachmentId, data.expires_at, Boolean(data.is_pinned_permanent))
        }
        setTimeout(() => {
          setShowExtendModal(false)
          setExtendFeedback(null)
        }, 1500)
      } else {
        setExtendFeedback(data.error || 'Không thể gia hạn')
      }
    } catch {
      setExtendFeedback('Lỗi kết nối máy chủ')
    } finally {
      setIsExtending(false)
    }
  }

  // Đối với ảnh: Tự động tải và giải mã để hiển thị inline an toàn (nếu có fileKey và không phải SVG/HTML)
  useEffect(() => {
    let active = true

    if (isImage && fileKeyBase64 && (attachmentId || driveFileId)) {
      setIsLoading(true)
      fetchAndDecryptBlob()
        .then((url) => {
          if (active && url) {
            setDecryptedUrl(url)
          }
        })
        .catch((err: any) => {
          if (active) setError(err?.message || 'Không thể giải mã ảnh')
        })
        .finally(() => {
          if (active) setIsLoading(false)
        })
    }

    return () => {
      active = false
      if (decryptedUrl) {
        URL.revokeObjectURL(decryptedUrl)
      }
    }
  }, [attachmentId, driveFileId, isImage, fileKeyBase64])

  // Tải stream nhị phân mã hóa từ API và giải mã bằng fileKey phía client
  const fetchAndDecryptBlob = async (): Promise<string> => {
    if (!fileKeyBase64) {
      throw new Error('Thiếu khóa giải mã tệp (File Key)')
    }

    let token = ''
    try {
      const sessionData = (await supabase.auth.getSession()).data.session
      token = sessionData?.access_token || ''
    } catch {}

    const query = new URLSearchParams()
    if (attachmentId) query.set('attachmentId', attachmentId)
    if (driveFileId) query.set('driveFileId', driveFileId)
    if (token) query.set('token', token)

    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`/api/chat/attachments/stream?${query.toString()}`, {
      headers,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new Error(errorText || `Lỗi tải tệp: HTTP ${res.status}`)
    }

    const encryptedBlob = await res.blob()

    // Kiểm tra blob nhận được: nếu là text/json thông báo lỗi thì hiển thị lỗi từ server thay vì cố giải mã AES
    if (
      encryptedBlob.type.includes('application/json') ||
      encryptedBlob.type.includes('text/') ||
      encryptedBlob.type === 'text/plain'
    ) {
      const text = await encryptedBlob.text()
      let serverErrorMsg = text
      try {
        const json = JSON.parse(text)
        serverErrorMsg = json.error || json.message || text
      } catch {}
      if (
        serverErrorMsg &&
        (serverErrorMsg.includes('Lỗi') ||
          serverErrorMsg.includes('error') ||
          serverErrorMsg.includes('Chưa đăng nhập') ||
          serverErrorMsg.includes('không tồn tại'))
      ) {
        throw new Error(serverErrorMsg)
      }
    }

    const rawKey = base64ToBytes(fileKeyBase64)
    // Giải mã AES-256-GCM theo stream chunk (tự động hỗ trợ cả chunk framing và single chunk)
    const blob = await decryptFileToBlob(
      encryptedBlob,
      rawKey,
      isRestricted ? 'application/octet-stream' : mimeType
    )
    return URL.createObjectURL(blob)
  }

  // Phát video inline sau khi giải mã
  const handlePlayVideo = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      setIsLoading(true)
      setError(null)
      const url = await fetchAndDecryptBlob()
      setDecryptedUrl(url)
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi giải mã video')
    } finally {
      setIsLoading(false)
    }
  }

  // Tải tệp về máy
  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (isExe && !showExeConfirm) {
      setShowExeConfirm(true)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setShowExeConfirm(false)

      let blobUrl = decryptedUrl
      if (!blobUrl) {
        blobUrl = await fetchAndDecryptBlob()
      }

      openSafeDownload(blobUrl, fileName)
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tải hoặc giải mã tệp')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2 max-w-sm rounded-2xl overflow-hidden">
      {/* Modal xác nhận cảnh báo tệp thực thi */}
      {showExeConfirm && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Cảnh báo bảo mật:</span> Tệp{' '}
              <code className="px-1 py-0.5 rounded bg-black/10 font-bold">{fileName}</code>{' '}
              là định dạng thực thi có thể chứa mã nguy hiểm. Bạn có chắc chắn muốn tải về?
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowExeConfirm(false)}
              className="px-3 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1 rounded-lg text-xs font-black bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
            >
              Vẫn tải xuống
            </button>
          </div>
        </div>
      )}

      {/* Hiển thị ảnh Inline nếu đã giải mã thành công */}
      {isImage && decryptedUrl ? (
        <div className="group relative rounded-2xl overflow-hidden bg-black/5 border border-black/10 dark:border-white/10">
          <img
            src={decryptedUrl}
            alt={fileName}
            className="w-full max-h-72 object-cover cursor-pointer hover:scale-[1.01] transition"
            onClick={handleOpenPreview}
          />
          <button
            type="button"
            onClick={handleDownload}
            title="Tải ảnh gốc"
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition shadow-md"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      ) : isVideo && decryptedUrl ? (
        <div className="space-y-1.5">
          <div className="rounded-2xl overflow-hidden bg-black border border-slate-800">
            <video src={decryptedUrl} controls autoPlay className="w-full max-h-72" />
          </div>
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
            <span className="truncate max-w-[200px]">{fileName}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenPreview}
                className="flex items-center gap-1 text-emerald-500 hover:underline font-bold cursor-pointer"
              >
                Xem toàn màn hình
              </button>
              <button
                type="button"
                onClick={(e) => handleDownload(e)}
                className="flex items-center gap-1 text-slate-400 hover:text-emerald-500 font-bold cursor-pointer"
              >
                <Download className="h-3 w-3" /> Tải về
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Box tệp tin thông thường / SVG / HTML / Video chưa load */
        <div
          onClick={handleOpenPreview}
          className={`flex items-center gap-3 p-3 rounded-2xl transition cursor-pointer ${
            isMe
              ? 'bg-white/15 hover:bg-white/20 border border-white/20 text-white'
              : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10'
          }`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${
              isMe
                ? 'bg-white/20 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isImage ? (
              <ImageIcon className="h-5 w-5" />
            ) : isVideo ? (
              <Film className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <p
              className={`text-xs truncate ${
                isMe ? 'text-white font-bold' : 'text-slate-800 dark:text-slate-100 font-bold'
              }`}
            >
              {fileName}
            </p>
            <p
              className={`text-[10px] mt-0.5 ${
                isMe ? 'text-emerald-100/90' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {formatBytes(fileSize)} ·{' '}
              {driveFileId && !driveFileId.startsWith('supabase:') ? 'Google Drive' : 'Supabase'}
              {' · Nhấn để xem trước'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isLoading ? (
              <Loader2 className={`h-4 w-4 animate-spin ${isMe ? 'text-white' : 'text-emerald-500'}`} />
            ) : isVideo ? (
              <>
                <button
                  type="button"
                  onClick={handlePlayVideo}
                  title="Phát video"
                  className={`p-1 rounded-lg cursor-pointer ${
                    isMe
                      ? 'text-white hover:bg-white/20'
                      : 'text-emerald-600 hover:bg-emerald-500/10'
                  }`}
                >
                  <Play className={`h-4 w-4 ${isMe ? 'fill-white' : 'fill-emerald-600'}`} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownload(e)}
                  title="Tải về"
                  className={`p-1 rounded-lg cursor-pointer ${
                    isMe
                      ? 'text-white/80 hover:text-white hover:bg-white/20'
                      : 'text-slate-400 hover:text-emerald-600'
                  }`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => handleDownload(e)}
                title="Tải về"
                className={`p-1 rounded-lg cursor-pointer ${
                  isMe
                    ? 'text-white/80 hover:text-white hover:bg-white/20'
                    : 'text-slate-500 hover:text-emerald-500'
                }`}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal xem trước đa định dạng */}
      <ChatFilePreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        fileUrl={decryptedUrl}
        fileName={fileName}
        fileSize={fileSize}
        mimeType={mimeType}
        expiresAt={currentExpiresAt}
        isPinnedPermanent={currentIsPermanent}
        onDownload={() => handleDownload()}
      />

      {error && (
        <div className="px-1">
          {isMe ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/25 text-rose-200 border border-rose-300/30 text-[10px] font-medium backdrop-blur-xs">
              <AlertTriangle className="h-3 w-3 text-rose-300 shrink-0" />
              <span>{error}</span>
            </span>
          ) : (
            <p className="text-[10px] text-rose-500 font-semibold">{error}</p>
          )}
        </div>
      )}

      {/* Thông tin bảo lưu tệp 30 ngày & Nút gia hạn bởi Trưởng nhóm / Admin */}
      <div
        className={`flex items-center justify-between gap-2 px-1 text-[10px] mt-1 ${
          isMe ? 'text-emerald-100/90' : 'text-slate-400'
        }`}
      >
        <div className="flex items-center gap-1">
          <Clock className={`h-3 w-3 shrink-0 ${isMe ? 'text-emerald-200/80' : 'text-slate-400'}`} />
          <span
            className={
              retention.isPermanent
                ? isMe
                  ? 'text-white font-bold'
                  : 'text-emerald-500 font-semibold'
                : retention.isExpired
                ? isMe
                  ? 'text-rose-200 font-semibold'
                  : 'text-rose-500 font-semibold'
                : isMe
                ? 'text-emerald-100/90'
                : 'text-slate-400'
            }
          >
            {retention.text}
          </span>
        </div>
        {canExtendRetention && !retention.isPermanent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowExtendModal(true)
            }}
            className={`flex items-center gap-0.5 font-semibold hover:underline cursor-pointer ${
              isMe
                ? 'text-white hover:text-emerald-100'
                : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
            }`}
          >
            <CalendarPlus className="h-3 w-3" />
            Gia hạn
          </button>
        )}
      </div>

      {/* Modal gia hạn lưu trữ cho tệp tin */}
      {showExtendModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <CalendarPlus className="h-4 w-4 text-emerald-600" />
                <span>Gia hạn lưu trữ tệp</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {fileName}
            </p>

            {extendFeedback && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {extendFeedback}
              </p>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isExtending}
                onClick={() => handleExtendRetention(30, false)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                <Clock className="h-3.5 w-3.5" />
                Thêm 30 ngày bảo lưu
              </button>
              <button
                type="button"
                disabled={isExtending}
                onClick={() => handleExtendRetention(0, true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 disabled:opacity-50 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Bảo lưu vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
