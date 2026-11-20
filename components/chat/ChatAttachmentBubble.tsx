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
}: ChatAttachmentBubbleProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExeConfirm, setShowExeConfirm] = useState(false)

  const isExe = isExecutableFile(fileName, mimeType)
  const isRestricted = isRestrictedInlineFile(fileName, mimeType)
  const isImage = fileType === 'image' && !isRestricted
  const isVideo = fileType === 'video'

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
        .catch((err) => {
          if (active) setError('Không thể giải mã ảnh')
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

    const query = new URLSearchParams()
    if (attachmentId) query.set('attachmentId', attachmentId)
    if (driveFileId) query.set('driveFileId', driveFileId)

    const res = await fetch(`/api/chat/attachments/stream?${query.toString()}`)
    if (!res.ok) {
      throw new Error(`Lỗi tải tệp: ${res.statusText}`)
    }

    const encryptedBlob = await res.blob()
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
            onClick={handleDownload}
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
            <button
              type="button"
              onClick={(e) => handleDownload(e)}
              className="flex items-center gap-1 text-emerald-500 hover:underline font-bold cursor-pointer"
            >
              <Download className="h-3 w-3" /> Tải về
            </button>
          </div>
        </div>
      ) : (
        /* Box tệp tin thông thường / SVG / HTML / Video chưa load */
        <div
          onClick={isVideo ? (e) => handlePlayVideo(e) : (e) => handleDownload(e)}
          className="flex items-center gap-3 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            {isImage ? (
              <ImageIcon className="h-5 w-5" />
            ) : isVideo ? (
              <Film className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">
              {fileName}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {formatBytes(fileSize)} ·{' '}
              {driveFileId && !driveFileId.startsWith('supabase:') ? 'Google Drive' : 'Supabase'}
              {isVideo && ' · Nhấn để xem video'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            ) : isVideo ? (
              <>
                <button
                  type="button"
                  onClick={handlePlayVideo}
                  title="Phát video"
                  className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-emerald-600" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownload(e)}
                  title="Tải về"
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => handleDownload(e)}
                title="Tải về"
                className="p-1 rounded-lg text-slate-500 hover:text-emerald-500 cursor-pointer"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-rose-500 font-semibold px-1">{error}</p>
      )}
    </div>
  )
}
