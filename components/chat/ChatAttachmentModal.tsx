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
import { supabase } from '@/lib/supabaseClient'

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
        message: validation.error || `Tệp của bạn (${formatBytes(file.size)}) vượt quá hạn mức ${formatBytes(validation.limitBytes)} của gói ${validation.currentTier === 'free' ? 'Miễn phí' : validation.currentTier}. Hãy nâng cấp lên Sen VIP để gửi tệp này.`,
        suggestedTier: validation.suggestedTier,
        upgradeUrl: validation.upgradeUrl,
      })
      return
    } else {
      setLimitError(null)
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
      // Pre-check trước khi bắt đầu stream mã hóa
      const preValidation = validateChatFileSize(file.size, userPlanTier)
      if (!preValidation.allowed) {
        setLimitError({
          message: preValidation.error || `Tệp của bạn (${formatBytes(file.size)}) vượt quá hạn mức ${formatBytes(preValidation.limitBytes)} của gói ${preValidation.currentTier === 'free' ? 'Miễn phí' : preValidation.currentTier}. Hãy nâng cấp lên Sen VIP để gửi tệp này.`,
          suggestedTier: preValidation.suggestedTier,
          upgradeUrl: preValidation.upgradeUrl,
        })
        return
      }

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

      // 4.1 Lấy phiên đăng nhập Supabase và làm mới nếu sắp hết hạn
      let token: string | null = null
      try {
        let { data: authData } = await supabase.auth.getSession()
        if (
          !authData?.session ||
          (authData.session.expires_at &&
            authData.session.expires_at * 1000 - Date.now() < 60000)
        ) {
          try {
            const { data: refData } = await supabase.auth.refreshSession()
            if (refData?.session) authData = refData
          } catch {}
        }
        token = authData?.session?.access_token || null
      } catch {}

      // Fallback cho Safari / ITP: Tìm token trong localStorage nếu getSession() trả về rỗng
      if (!token && typeof window !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              const val = localStorage.getItem(k)
              if (val) {
                const parsed = JSON.parse(val)
                const candidate = Array.isArray(parsed) ? parsed[0] : (parsed?.access_token || parsed?.token)
                if (typeof candidate === 'string' && candidate.length > 20) {
                  token = candidate
                  break
                }
              }
            }
          }
        } catch {}
      }

      if (!token) {
        throw new Error('Chưa đăng nhập. Vui lòng đăng nhập lại để tiếp tục.')
      }

      let finalAttachment: any = null

      // Phân luồng:
      // - Nếu là tệp lớn (> 4MB) hoặc không phải ảnh (video, ipa, zip, binary): Upload trực tiếp lên Supabase Storage
      // - Nếu là ảnh <= 4MB: Tiếp tục gửi qua FormData để xử lý lưu trữ Google Drive API bảo mật
      const isDirectStorageUpload = !isImage || file.size > 4 * 1024 * 1024

      if (isDirectStorageUpload) {
        setProgress(60)
        setStatusText('Đang khởi tạo tải lên trực tiếp kho lưu trữ...')

        // B1. Gọi API prepare_upload để xác thực hạn mức & lấy storagePath / signed URL
        const prepRes = await fetch(`/api/chat/attachments/upload?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'prepare_upload',
            conversationId,
            fileSizeBytes: file.size,
            fileName: file.name,
            fileType,
          }),
          signal: abortController.signal,
        })

        const prepRawText = await prepRes.text()
        let prepData: any = null
        try {
          prepData = JSON.parse(prepRawText)
        } catch {
          if (prepRes.status === 413) {
            throw new Error('Dung lượng tệp vượt quá hạn mức tải lên của máy chủ hoặc gói cước hiện tại.')
          }
          throw new Error(`Lỗi khởi tạo tải lên (${prepRes.status})`)
        }

        if (!prepRes.ok) {
          if (prepRes.status === 413 && prepData?.suggestedTier) {
            setLimitError({
              message: prepData.error || 'Dung lượng tệp vượt quá hạn mức gói của bạn',
              suggestedTier: prepData.suggestedTier,
              upgradeUrl: prepData.upgradeUrl,
            })
            setIsUploading(false)
            return
          }
          throw new Error(prepData?.error || `Lỗi chuẩn bị tải lên (${prepRes.status})`)
        }

        const storagePath = prepData.storagePath
        const signedUploadUrl = prepData.signedUploadUrl
        const signedToken = prepData.token

        // B2. Tải blob mã hóa trực tiếp lên Supabase Storage bucket sen-chat-attachments
        setProgress(72)
        setStatusText(`Đang truyền blob mã hóa lên Supabase Storage (${formatBytes(file.size)})...`)

        const targetBucket = prepData.storageBucket || 'sen-chat-attachments'

        let directUploadSuccess = false
        if (signedUploadUrl) {
          try {
            const putRes = await fetch(signedUploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/octet-stream',
              },
              body: encryptedFileBlob,
              signal: abortController.signal,
            })
            if (putRes.ok) {
              directUploadSuccess = true
            }
          } catch (putErr: any) {
            console.warn('[SEN_CHAT_UPLOAD] Lỗi tải qua signed upload URL, thử fallback:', putErr)
          }
        }

        if (!directUploadSuccess && signedToken) {
          try {
            const { error: signedErr } = await supabase.storage
              .from(targetBucket)
              .uploadToSignedUrl(storagePath, signedToken, encryptedFileBlob)
            if (!signedErr) {
              directUploadSuccess = true
            }
          } catch {}
        }

        if (!directUploadSuccess) {
          // Upload trực tiếp lên Supabase Storage bucket sen-chat-attachments
          let uploadErr: any = null
          const res = await supabase.storage
            .from('sen-chat-attachments')
            .upload(storagePath, encryptedFileBlob, {
              contentType: 'application/octet-stream',
              upsert: true,
            })
          if (res.error) {
            uploadErr = res.error
            // Fallback sang bucket chat_attachments nếu cần
            const fallbackRes = await supabase.storage
              .from('chat_attachments')
              .upload(storagePath, encryptedFileBlob, {
                contentType: 'application/octet-stream',
                upsert: true,
              })
            if (!fallbackRes.error) {
              uploadErr = null
              directUploadSuccess = true
            }
          } else {
            directUploadSuccess = true
          }

          if (uploadErr) {
            throw new Error(`Lỗi tải trực tiếp lên kho lưu trữ: ${uploadErr.message}`)
          }
        }

        // B3. Xác nhận hoàn tất và lưu siêu dữ liệu vào bảng chat_attachments
        setProgress(90)
        setStatusText('Đang xác nhận siêu dữ liệu tệp đính kèm...')

        const compRes = await fetch(`/api/chat/attachments/upload?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'complete_direct_upload',
            conversationId,
            storagePath,
            fileSizeBytes: file.size,
            fileType,
            encryptedFileName: encryptedMetadata.ciphertext,
            encryptedMimeType: encryptedMetadata.iv,
            encryptedThumbnail: null,
            encryptedFileHash: `sha256-${Date.now()}`,
            messageId: null,
          }),
          signal: abortController.signal,
        })

        const compRawText = await compRes.text()
        let compData: any = null
        try {
          compData = JSON.parse(compRawText)
        } catch {
          if (compRes.status === 413) {
            throw new Error('Dung lượng tệp vượt quá hạn mức tải lên của máy chủ hoặc gói cước hiện tại.')
          }
          throw new Error(`Lỗi xác nhận tệp (${compRes.status})`)
        }

        if (!compRes.ok) {
          throw new Error(compData?.error || 'Lỗi lưu thông tin tệp đính kèm')
        }

        finalAttachment = compData.attachment
      } else {
        // 4. Chuẩn bị FormData gửi lên API (ảnh <= 4MB qua Google Drive)
        const formData = new FormData()
        formData.append('file', encryptedFileBlob, 'encrypted_blob.bin')
        formData.append('conversationId', conversationId)
        formData.append('fileType', fileType)
        formData.append('fileSizeBytes', String(file.size))
        formData.append('encryptedFileName', encryptedMetadata.ciphertext)
        formData.append('encryptedMimeType', encryptedMetadata.iv)
        formData.append('encryptedFileHash', `sha256-${Date.now()}`)
        formData.append('authToken', token)

        // 5. Gửi lên server với cơ chế thử lại (Retry) và đầy đủ Authorization header + token param
        let response: Response | null = null
        let uploadAttempts = 0
        const maxUploadAttempts = 3
        const uploadUrl = `/api/chat/attachments/upload?token=${encodeURIComponent(token)}`

        while (uploadAttempts < maxUploadAttempts) {
          uploadAttempts++
          try {
            response = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
              signal: abortController.signal,
            })
            if (response.ok) break
            if (response.status === 413 || response.status === 403 || response.status === 401) {
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

        const rawResText = await response.text()
        let resData: any = null
        try {
          resData = JSON.parse(rawResText)
        } catch {
          if (response.status === 413) {
            throw new Error('Dung lượng tệp vượt quá hạn mức tải lên của máy chủ hoặc gói cước hiện tại.')
          }
          if (response.status === 502 || response.status === 504) {
            throw new Error('Máy chủ lưu trữ phản hồi chậm hoặc tạm thời gián đoạn. Vui lòng thử lại.')
          }
          throw new Error(`Máy chủ phản hồi mã ${response.status}. Vui lòng thử lại.`)
        }

        if (!response.ok) {
          if (response.status === 413 && resData?.suggestedTier) {
            setLimitError({
              message: resData.error || 'Dung lượng tệp vượt quá hạn mức gói của bạn',
              suggestedTier: resData.suggestedTier,
              upgradeUrl: resData.upgradeUrl,
            })
            setIsUploading(false)
            return
          }
          throw new Error(resData?.error || `Lỗi tải lên (${response.status})`)
        }

        finalAttachment = resData.attachment
      }

      setProgress(100)
      setStatusText('Tải lên và mã hóa thành công!')

      // Báo thành công ra ngoài để chèn vào tin nhắn E2EE
      onSuccess({
        id: finalAttachment.id,
        fileKeyBase64,
        driveFileId: finalAttachment.driveFileId,
        storageProvider: finalAttachment.storageProvider,
        storagePath: finalAttachment.storagePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        fileType,
        expiresAt: finalAttachment.expiresAt,
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
                <span>
                  {limitError.suggestedTier === 'vip'
                    ? 'Nâng Cấp Lên Sen VIP (250MB)'
                    : limitError.suggestedTier === 'premium'
                    ? 'Nâng Cấp Lên Sen Premium (500MB)'
                    : limitError.suggestedTier === 'premium_plus'
                    ? 'Nâng Cấp Lên Sen Premium+ (1GB)'
                    : 'Nâng Cấp Gói Để Tăng Dung Lượng'}
                </span>
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
