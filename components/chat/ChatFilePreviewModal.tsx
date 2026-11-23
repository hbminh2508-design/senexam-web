'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileText,
  Music,
  Film,
  FileCode,
  ShieldCheck,
  Calendar,
  HardDrive,
  Copy,
  Check,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { formatBytes, isExecutableFile } from '@/lib/chatLimits'
import { openSafeDownload } from '@/lib/capacitorBridge'

export interface ChatFilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string | null
  fileName: string
  fileSize?: number
  mimeType?: string
  fileHash?: string
  expiresAt?: string
  isPinnedPermanent?: boolean
  onDownload?: () => void
}

export default function ChatFilePreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileSize = 0,
  mimeType = 'application/octet-stream',
  fileHash,
  expiresAt,
  isPinnedPermanent = false,
  onDownload,
}: ChatFilePreviewModalProps) {
  // State điều khiển ảnh
  const [zoomLevel, setZoomLevel] = useState(1)
  const [rotationDeg, setRotationDeg] = useState(0)

  // State điều khiển audio
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioVolume, setAudioVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // State điều khiển video
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // State điều khiển text / code
  const [textContent, setTextContent] = useState<string | null>(null)
  const [isLoadingText, setIsLoadingText] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // State mã băm SHA-256
  const [calculatedHash, setCalculatedHash] = useState<string>(fileHash || '')

  // Reset các thông số khi mở modal mới
  useEffect(() => {
    if (!isOpen) return
    setZoomLevel(1)
    setRotationDeg(0)
    setIsPlayingAudio(false)
    setTextContent(null)

    // Phân loại tệp
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const isTextOrCode =
      mimeType?.startsWith('text/') ||
      ['json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'md', 'txt', 'sql', 'sh', 'env', 'xml', 'yml', 'yaml'].includes(ext)

    if (isTextOrCode && fileUrl) {
      setIsLoadingText(true)
      fetch(fileUrl)
        .then((res) => res.text())
        .then((text) => setTextContent(text))
        .catch(() => setTextContent('Không thể đọc nội dung văn bản này.'))
        .finally(() => setIsLoadingText(false))
    }

    // Tự động tính hash SHA-256 nếu chưa có
    if (!calculatedHash && fileUrl) {
      fetch(fileUrl)
        .then((res) => res.arrayBuffer())
        .then(async (buf) => {
          if (typeof crypto !== 'undefined' && crypto.subtle) {
            const hashBuf = await crypto.subtle.digest('SHA-256', buf)
            const hashArray = Array.from(new Uint8Array(hashBuf))
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
            setCalculatedHash(`sha256-${hashHex}`)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, fileUrl, fileName, mimeType, calculatedHash])

  if (!isOpen) return null

  // Phân loại định dạng tệp
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const isImage = mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)
  const isAudio = mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
  const isVideo = mimeType?.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)
  const isPdf = mimeType === 'application/pdf' || ext === 'pdf'
  const isTextOrCode =
    mimeType?.startsWith('text/') ||
    ['json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'md', 'txt', 'sql', 'sh', 'xml', 'yml', 'yaml'].includes(ext)
  const isExe = isExecutableFile(fileName, mimeType)

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else if (fileUrl) {
      openSafeDownload(fileUrl, fileName)
    }
  }

  const handleCopyText = async () => {
    if (!textContent) return
    try {
      await navigator.clipboard.writeText(textContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {}
  }

  // Quản lý audio play/pause
  const togglePlayAudio = () => {
    if (!audioRef.current) return
    if (isPlayingAudio) {
      audioRef.current.pause()
      setIsPlayingAudio(false)
    } else {
      audioRef.current.play()
      setIsPlayingAudio(true)
    }
  }

  // Fullscreen video
  const handleFullscreenVideo = () => {
    if (!videoRef.current) return
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen()
    }
  }

  // Tính thời gian bảo lưu còn lại
  const getRetentionLabel = () => {
    if (isPinnedPermanent) return 'Bảo lưu vĩnh viễn'
    if (!expiresAt) return 'Bảo lưu 30 ngày (mặc định)'
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Đã hết hạn'
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return `Bảo lưu còn ${days} ngày`
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md">
      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              {isImage && <ZoomIn className="h-5 w-5" />}
              {isAudio && <Music className="h-5 w-5" />}
              {isVideo && <Film className="h-5 w-5" />}
              {isPdf && <FileText className="h-5 w-5" />}
              {isTextOrCode && <FileCode className="h-5 w-5" />}
              {!isImage && !isAudio && !isVideo && !isPdf && !isTextOrCode && <HardDrive className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-100" title={fileName}>
                {fileName}
              </h3>
              <p className="text-[11px] text-slate-400">
                {fileSize > 0 ? `${formatBytes(fileSize)} (${fileSize.toLocaleString('vi-VN')} bytes)` : mimeType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Thanh công cụ cho ảnh */}
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 rounded-2xl bg-slate-800/80 p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  className="rounded-xl p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Phóng to"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  className="rounded-xl p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                  className="rounded-xl p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Xoay ảnh 90°"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Nút copy cho text/code */}
            {isTextOrCode && textContent && (
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 rounded-2xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            )}

            {/* Nút tải về */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Tải về</span>
            </button>

            {/* Nút đóng */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Nội dung xem trước theo loại */}
        <div className="relative flex-1 overflow-auto bg-slate-950/60 p-4 flex items-center justify-center">
          {/* 1. HÌNH ẢNH: LIGHTBOX ZOOM & ROTATE */}
          {isImage && fileUrl && (
            <div className="flex h-full w-full items-center justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotationDeg}deg)`,
                  transition: 'transform 0.2s ease',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                className="rounded-lg shadow-2xl select-none"
              />
            </div>
          )}

          {/* 2. ÂM THANH: TRÌNH PHÁT VỚI SÓNG ÂM VÀ THANH TUA */}
          {isAudio && fileUrl && (
            <div className="flex w-full max-w-lg flex-col items-center justify-center space-y-6 rounded-3xl bg-slate-900/90 p-8 border border-slate-800 shadow-2xl">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
                <Music className="h-12 w-12 animate-pulse" />
              </div>

              <div className="text-center">
                <h4 className="text-base font-bold text-slate-100">{fileName}</h4>
                <p className="text-xs text-slate-400 mt-1">{formatBytes(fileSize)}</p>
              </div>

              {/* Sóng âm visualizer mô phỏng */}
              <div className="flex h-12 w-full items-center justify-center gap-1">
                {[40, 65, 30, 85, 100, 45, 75, 90, 60, 35, 80, 95, 50, 70, 85, 40, 60].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: isPlayingAudio ? `${h}%` : '20%' }}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      isPlayingAudio ? 'bg-emerald-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Thanh tua & Audio player */}
              <div className="w-full space-y-2">
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={audioCurrentTime}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value)
                    setAudioCurrentTime(time)
                    if (audioRef.current) audioRef.current.currentTime = time
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>{Math.floor(audioCurrentTime / 60)}:{Math.floor(audioCurrentTime % 60).toString().padStart(2, '0')}</span>
                  <span>{Math.floor(audioDuration / 60)}:{Math.floor(audioDuration % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={fileUrl}
                onTimeUpdate={() => {
                  if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime)
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) setAudioDuration(audioRef.current.duration)
                }}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlayAudio}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 hover:bg-emerald-500 transition"
                >
                  {isPlayingAudio ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                </button>
              </div>
            </div>
          )}

          {/* 3. VIDEO: TRÌNH PHÁT HTML5 TOÀN MÀN HÌNH */}
          {isVideo && fileUrl && (
            <div className="relative flex h-full w-full max-w-4xl items-center justify-center">
              <video
                ref={videoRef}
                src={fileUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-2xl border border-slate-800 shadow-2xl"
              />
              <button
                type="button"
                onClick={handleFullscreenVideo}
                className="absolute top-4 right-4 rounded-xl bg-slate-900/80 p-2 text-white hover:bg-slate-800 border border-slate-700"
                title="Toàn màn hình"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 4. TÀI LIỆU PDF */}
          {isPdf && fileUrl && (
            <div className="h-full w-full overflow-hidden rounded-2xl border border-slate-800 bg-white">
              <iframe
                src={`${fileUrl}#toolbar=1`}
                title={fileName}
                className="h-full w-full border-0"
              />
            </div>
          )}

          {/* 5. VĂN BẢN & CODE */}
          {isTextOrCode && (
            <div className="h-full w-full overflow-auto rounded-2xl bg-slate-900 p-4 border border-slate-800 font-mono text-xs">
              {isLoadingText ? (
                <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Đang đọc nội dung tệp văn bản...</span>
                </div>
              ) : textContent !== null ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-slate-200 selection:bg-emerald-500/30">
                  {textContent}
                </pre>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  <span>Không thể nạp nội dung văn bản</span>
                </div>
              )}
            </div>
          )}

          {/* 6. TỆP NHỊ PHÂN & KHÁC: FILE INSPECTOR CARD */}
          {!isImage && !isAudio && !isVideo && !isPdf && !isTextOrCode && (
            <div className="flex w-full max-w-lg flex-col rounded-3xl bg-slate-900 p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <HardDrive className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-base font-bold text-slate-100" title={fileName}>
                    {fileName}
                  </h4>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 mt-1">
                    .{ext || 'FILE'}
                  </span>
                </div>
              </div>

              {isExe && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 p-3.5 border border-amber-500/20 text-amber-300 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">Cảnh báo bảo mật: </span>
                    Đây là tệp thực thi hoặc nhị phân. Hãy đảm bảo bạn tin cậy người gửi trước khi chạy tệp.
                  </div>
                </div>
              )}

              {/* Thông số kỹ thuật chi tiết */}
              <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Kích thước chính xác:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {fileSize.toLocaleString('vi-VN')} bytes ({formatBytes(fileSize)})
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Định dạng MIME:</span>
                  <span className="font-mono text-slate-300">{mimeType}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Thời hạn bảo lưu:</span>
                  <span className="font-semibold text-emerald-400">{getRetentionLabel()}</span>
                </div>
                <div className="space-y-1 py-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Mã băm toàn vẹn SHA-256:</span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-300 break-all bg-slate-900 p-2 rounded-xl border border-slate-800">
                    {calculatedHash || 'Đang xác thực mã băm...'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-900/40 hover:bg-emerald-500 transition"
              >
                <Download className="h-4 w-4" />
                <span>Tải về tệp an toàn</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return null
}
