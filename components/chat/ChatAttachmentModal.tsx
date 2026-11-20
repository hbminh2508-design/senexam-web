'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Upload,
  Image as ImageIcon,
  Film,
  FileText,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Loader2,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import {
  validateChatFileSize,
  formatBytes,
  isExecutableFile,
  isRestrictedInlineFile,
} from '@/lib/chatLimits'
import {
  DEFAULT_CHUNK_SIZE,
  generateFileKey,
  encryptFileToBlob,
  encryptFileMetadata,
  stripExifAndProcessImage,
  bytesToBase64,
} from '@/lib/senChatChunkCrypto'

interface ChatAttachmentModalProps {
  file: File | null
  conversationId: string
  userPlanTier: string | null
  onClose: () => void
  onSuccess: (attachmentData: {
    id: string
    fileKeyBase64: string
    driveFileId?: string
    storageProvider: string
    storagePath?: string
    fileName: string
    fileSize: number
    mimeType: string
    fileType: 'image' | 'video' | 'file'
    thumbnail?: string | null
    expiresAt?: string
  }) => void
}

export default function ChatAttachmentModal({
  file,
  conversationId,
  userPlanTier,
  onClose,
  onSuccess,
}: ChatAttachmentModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [compressImage, setCompressImage] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<{
    message: string
    suggestedTier?: string
    upgradeUrl?: string
  } | null>(null)
  const [showExecutableWarning, setShowExecutableWarning] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Phân loại tệp
  const isImage = file?.type.startsWith('image/') || false
  const isVideo = file?.type.startsWith('video/') || false
  const fileType: 'image' | 'video' | 'file' = isImage ? 'image' : isVideo ? 'video' : 'file'

  const isExe = file ? isExecutableFile(file.name, file.type) : false
  const isRestricted = file ? isRestrictedInlineFile(file.name, file.type) : false

  useEffect(() => {
    if (!file) return

    // 1. Kiểm tra kích thước tệp theo gói dịch vụ
    const validation = validateChatFileSize(file.size, userPlanTier)
    if (!validation.allowed) {
      setLimitError({
        message: validation.error || 'Tệp vượt quá hạn mức cho phép của gói hiện tại',
        suggestedTier: validation.suggestedTier,
        upgradeUrl: validation.upgradeUrl,
      })
      return
    }

    // 2. Kiểm tra tệp thực thi
    if (isExe) {
      setShowExecutableWarning(true)
    }

    // 3. Tạo URL preview cho ảnh/video
    if (isImage || isVideo) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [file, userPlanTier, isExe, isImage, isVideo])

  if (!file) return null

  // Hủy tiến trình upload
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsUploading(false)
    setStatusText('Đã hủy bỏ tải lên')
  }

  // Thực hiện mã hóa chunk E2EE và tải lên
  const handleStartUpload = async () => {
    try {
      setIsUploading(true)
      setErrorMsg(null)
      setProgress(5)
      setStatusText('Đang xử lý tệp và loại bỏ metadata EXIF...')

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      let processedBlob: Blob = file

      // Nếu là ảnh: Tự động loại bỏ metadata GPS/EXIF và nén tùy chọn
      if (isImage) {
        processedBlob = await stripExifAndProcessImage(file, {
          compress: compressImage,
          quality: 0.85,
        })
      }

      setProgress(20)
      setStatusText('Đang sinh khóa ngẫu nhiên AES-256-GCM cho tệp...')

      // 1. Sinh khóa ngẫu nhiên 256-bit độc lập cho tệp
      const fileKey = generateFileKey()
      const fileKeyBase64 = bytesToBase64(fileKey)

      setProgress(35)
      setStatusText('Đang mã hóa dữ liệu theo từng chunk AES-256-GCM...')

      // 2. Mã hóa stream theo từng chunk bằng AES-256-GCM không nạp toàn bộ file vào RAM
      const encryptedFileBlob = await encryptFileToBlob(
        processedBlob,
        fileKey,
        {
          chunkSize: DEFAULT_CHUNK_SIZE,
          signal: abortController.signal,
          onProgress: (processed, total, percent) => {
            const mappedProgress = 35 + Math.round((percent * 20) / 100)
            setProgress(mappedProgress)
            setStatusText(
              `Đang mã hóa chunk AES-256-GCM (${formatBytes(processed)} / ${formatBytes(total)})...`
            )
          },
        }
      )

      // 3. Mã hóa metadata (tên tệp, mime type, kích thước)
      const encryptedMetadata = await encryptFileMetadata(
        {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          thumbnail: null,
        },
        fileKey
      )

      setProgress(60)
      setStatusText(
        isImage
          ? 'Đang gửi blob mã hóa lên Google Drive bảo mật...'
          : 'Đang gửi blob mã hóa lên Supabase Storage...'
      )

      // 4. Chuẩn bị FormData gửi lên API
      const formData = new FormData()
      formData.append('file', encryptedFileBlob, 'encrypted_blob.bin')
      formData.append('conversationId', conversationId)
      formData.append('fileType', fileType)
      formData.append('fileSizeBytes', String(file.size))
      formData.append('encryptedFileName', encryptedMetadata.ciphertext)
      formData.append('encryptedMimeType', encryptedMetadata.iv)
      formData.append('encryptedFileHash', `sha256-${Date.now()}`)

      // 5. Gửi lên server với cơ chế thử lại (Retry)
      let response: Response | null = null
      let uploadAttempts = 0
      const maxUploadAttempts = 3

      while (uploadAttempts < maxUploadAttempts) {
        uploadAttempts++
        try {
          response = await fetch('/api/chat/attachments/upload', {
            method: 'POST',
            body: formData,
            signal: abortController.signal,
          })
          if (response.ok) break
          if (response.status === 413 || response.status === 403) {
            // Không retry nếu vi phạm hạn mức hoặc không có quyền
            break
          }
        } catch (fetchErr: any) {
          if (abortController.signal.aborted) throw fetchErr
          if (uploadAttempts >= maxUploadAttempts) throw fetchErr
          setStatusText(`Kết nối gián đoạn, đang thử lại lần ${uploadAttempts + 1}/${maxUploadAttempts}...`)
          await new Promise((r) => setTimeout(r, 1500))
        }
      }

      if (!response) {
        throw new Error('Không thể kết nối đến máy chủ sau 3 lần thử')
      }

      const resData = await response.json()

      if (!response.ok) {
        if (response.status === 413 && resData.suggestedTier) {
          setLimitError({
            message: resData.error || 'Dung lượng tệp vượt quá hạn mức gói của bạn',
            suggestedTier: resData.suggestedTier,
            upgradeUrl: resData.upgradeUrl,
          })
          setIsUploading(false)
          return
        }
        throw new Error(resData.error || `Lỗi tải lên (${response.status})`)
      }

      setProgress(100)
      setStatusText('Tải lên và mã hóa thành công!')

      // Báo thành công ra ngoài để chèn vào tin nhắn E2EE
      onSuccess({
        id: resData.attachment.id,
        fileKeyBase64,
        driveFileId: resData.attachment.driveFileId,
        storageProvider: resData.attachment.storageProvider,
        storagePath: resData.attachment.storagePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        fileType,
        expiresAt: resData.attachment.expiresAt,
      })

      onClose()
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('hủy')) {
        setErrorMsg('Thao tác tải lên đã bị hủy bỏ')
      } else {
        setErrorMsg(err?.message || 'Có lỗi xảy ra trong quá trình tải lên')
      }
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Gửi Tệp Mã Hóa E2EE
              </h3>
              <p className="text-[10px] text-slate-400">
                AES-256-GCM · {isImage ? 'Lưu qua Google Drive' : 'Supabase Storage'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Cảnh báo vượt hạn mức gói */}
          {limitError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
                <div className="text-xs font-semibold leading-relaxed">
                  {limitError.message}
                </div>
              </div>
              <a
                href={limitError.upgradeUrl || '/new-pay?tab=vip'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                <span>Nâng Cấp Gói Để Tăng Dung Lượng</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          )}

          {/* Cảnh báo tệp thực thi tiềm ẩn nguy hiểm */}
          {showExecutableWarning && !limitError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">Cảnh báo tệp thực thi:</span> Tệp này có đuôi phần mềm có thể tự chạy. Hãy chắc chắn người nhận đồng ý trước khi gửi.
              </div>
            </div>
          )}

          {/* Cảnh báo SVG / HTML download only */}
          {isRestricted && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Tệp HTML/SVG sẽ chỉ cho phép tải về để đảm bảo an toàn tuyệt đối.</span>
            </div>
          )}

          {/* Preview khu vực */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
            {isImage && previewUrl ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : isVideo && previewUrl ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <video src={previewUrl} controls className="max-h-full max-w-full" />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate text-slate-800 dark:text-slate-200">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatBytes(file.size)} · {file.type || 'Tệp nhị phân'}
                  </p>
                </div>
              </div>
            )}

            {/* Thông tin metadata tệp */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <span className="truncate max-w-[200px]">{file.name}</span>
              <span className="font-bold">{formatBytes(file.size)}</span>
            </div>
          </div>

          {/* Tùy chọn nén ảnh & gỡ bỏ EXIF */}
          {isImage && !limitError && (
            <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Tối ưu hóa & Bảo vệ quyền riêng tư
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compressImage}
                    onChange={(e) => setCompressImage(e.target.checked)}
                    className="sr-only peer"
                    disabled={isUploading}
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                ✓ Đã tự động xóa dữ liệu định vị EXIF GPS của ảnh.<br />
                {compressImage ? '✓ Nén thông minh giữ chất lượng mắt nhìn (WebP/JPEG 85%).' : '○ Giữ nguyên file ảnh gốc không nén.'}
              </p>
            </div>
          )}

          {/* Tiến trình Upload */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                  {statusText}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {isUploading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
            >
              Hủy Bỏ
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Đóng
              </button>
              {!limitError && (
                <button
                  type="button"
                  onClick={handleStartUpload}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition active:scale-95"
                >
                  <Lock className="h-4 w-4" />
                  <span>Mã Hóa & Gửi Tệp</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
