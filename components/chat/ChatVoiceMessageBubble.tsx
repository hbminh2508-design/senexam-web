'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Lock,
  Sparkles,
  Edit3,
  Check,
  X,
  Loader2,
  FileText,
  AlertTriangle,
  Globe,
} from 'lucide-react'
import {
  decryptFileToBlob,
  base64ToBytes,
} from '@/lib/senChatChunkCrypto'
import {
  formatAudioDuration,
  getLanguageMeta,
  transcribeAudioOnDevice,
  transcribeAudioServerSide,
  WhisperModelProgress,
} from '@/lib/senChatVoiceSTT'
import { supabase } from '@/lib/supabaseClient'

interface ChatVoiceMessageBubbleProps {
  messageId: string
  attachmentId?: string
  driveFileId?: string
  storageProvider?: string
  storagePath?: string
  fileKeyBase64?: string
  duration?: number
  waveform?: number[]
  transcription?: string
  transcriptionLanguage?: string
  isOutgoing?: boolean
  userPlanTier?: string | null
  onUpdateTranscription?: (messageId: string, newText: string, newLanguage?: string) => void
}

export default function ChatVoiceMessageBubble({
  messageId,
  attachmentId,
  driveFileId,
  storageProvider,
  storagePath,
  fileKeyBase64,
  duration = 0,
  waveform = [],
  transcription = '',
  transcriptionLanguage = 'vi',
  isOutgoing = false,
  userPlanTier = 'free',
  onUpdateTranscription,
}: ChatVoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration || 0)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quản lý phiên âm & sửa tay (manual editing)
  const [currentText, setCurrentText] = useState(transcription)
  const [currentLang, setCurrentLang] = useState(transcriptionLanguage)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(transcription)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [sttProgress, setSttProgress] = useState<string>('')
  const [showServerConsentModal, setShowServerConsentModal] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const decryptedBlobRef = useRef<Blob | null>(null)

  const langMeta = getLanguageMeta(currentLang)

  // Danh sách các thanh sóng âm hiển thị (mặc định 36 thanh)
  const bars = waveform && waveform.length > 0
    ? waveform
    : Array.from({ length: 32 }, (_, i) => 0.15 + 0.7 * Math.abs(Math.sin((i + 1) * 0.45)))

  // Dọn dẹp URL khi unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Cập nhật khi prop transcription thay đổi
  useEffect(() => {
    setCurrentText(transcription)
    setEditText(transcription)
  }, [transcription])

  // Giải mã âm thanh AES-256-GCM từ stream API
  const decryptAudio = async (): Promise<Blob> => {
    if (decryptedBlobRef.current) {
      return decryptedBlobRef.current
    }

    if (!fileKeyBase64) {
      throw new Error('Thiếu khóa mã hóa tệp (File Key)')
    }

    const { data: authData } = await supabase.auth.getSession()
    const token = authData.session?.access_token

    const query = new URLSearchParams()
    if (attachmentId) query.set('attachmentId', attachmentId)
    if (driveFileId) query.set('driveFileId', driveFileId)
    if (token) query.set('token', token)

    const res = await fetch(`/api/chat/attachments/stream?${query.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) {
      throw new Error(`Lỗi tải âm thanh: ${res.statusText}`)
    }

    const encryptedBlob = await res.blob()
    const rawKey = base64ToBytes(fileKeyBase64)
    const clearBlob = await decryptFileToBlob(encryptedBlob, rawKey, 'audio/webm;codecs=opus')

    decryptedBlobRef.current = clearBlob
    const url = URL.createObjectURL(clearBlob)
    setAudioUrl(url)
    return clearBlob
  }

  // Xử lý Play / Pause
  const handleTogglePlay = async () => {
    setError(null)
    try {
      if (!audioUrl) {
        setIsDecrypting(true)
        await decryptAudio()
        setIsDecrypting(false)
      }

      // Sau khi đã có audioUrl, điều khiển audio element
      setTimeout(() => {
        if (!audioRef.current) return
        if (isPlaying) {
          audioRef.current.pause()
          setIsPlaying(false)
        } else {
          audioRef.current.playbackRate = playbackSpeed
          audioRef.current.play().then(() => {
            setIsPlaying(true)
          }).catch((err) => {
            console.error('Lỗi phát âm thanh:', err)
            setError('Không thể phát âm thanh')
          })
        }
      }, 50)
    } catch (err: any) {
      setIsDecrypting(false)
      setError(err?.message || 'Lỗi giải mã âm thanh thoại')
    }
  }

  // Đổi tốc độ phát
  const handleCycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1
    setPlaybackSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  // Nhấp vào sóng âm để nhảy thời gian (seek)
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !totalDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const targetTime = percent * totalDuration
    audioRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  // Lưu chỉnh sửa tay (manual edit)
  const handleSaveEdit = () => {
    setCurrentText(editText.trim())
    setIsEditing(false)
    if (onUpdateTranscription) {
      onUpdateTranscription(messageId, editText.trim(), currentLang)
    }
  }

  // Kích hoạt STT On-Device (Whisper)
  const handleTranscribeOnDevice = async () => {
    setIsTranscribing(true)
    setSttProgress('Đang tải âm thanh...')
    try {
      const blob = await decryptAudio()
      setSttProgress('Đang nhận diện giọng nói...')
      const result = await transcribeAudioOnDevice(blob, {
        onProgress: (p: WhisperModelProgress) => {
          setSttProgress(p.message)
        },
      })
      setCurrentText(result.text)
      setEditText(result.text)
      setCurrentLang(result.language)
      if (onUpdateTranscription) {
        onUpdateTranscription(messageId, result.text, result.language)
      }
    } catch (err: any) {
      console.warn('Lỗi STT on-device, gợi ý dùng server fallback:', err)
      setShowServerConsentModal(true)
    } finally {
      setIsTranscribing(false)
      setSttProgress('')
    }
  }

  // Kích hoạt Server STT sau khi đồng ý rõ ràng
  const handleConfirmServerStt = async () => {
    setShowServerConsentModal(false)
    setIsTranscribing(true)
    setSttProgress('Đang gửi âm thanh tới máy chủ...')
    try {
      const { data: authData } = await supabase.auth.getSession()
      const token = authData.session?.access_token

      const blob = await decryptAudio()
      const result = await transcribeAudioServerSide({
        audioBlob: blob,
        consent: true,
        userPlanTier,
        authToken: token,
      })
      setCurrentText(result.text)
      setEditText(result.text)
      setCurrentLang(result.language)
      if (onUpdateTranscription) {
        onUpdateTranscription(messageId, result.text, result.language)
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi phiên âm từ máy chủ')
    } finally {
      setIsTranscribing(false)
      setSttProgress('')
    }
  }

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className={`flex flex-col gap-2 rounded-2xl p-3 max-w-[320px] sm:max-w-[360px] ${
      isOutgoing
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
        : 'bg-white text-slate-800 shadow-sm border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'
    }`}>
      {/* HTML Audio element ẩn */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime)
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration) {
              setTotalDuration(audioRef.current.duration)
            }
          }}
          onEnded={() => {
            setIsPlaying(false)
            setCurrentTime(0)
          }}
        />
      )}

      {/* Dòng điều khiển chính: Nút Play + Thanh Sóng Âm + Thời lượng */}
      <div className="flex items-center gap-3">
        {/* Nút Play/Pause */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isDecrypting}
          aria-label={isPlaying ? 'Tạm dừng tin nhắn thoại' : 'Phát tin nhắn thoại'}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition shadow-sm ${
            isOutgoing
              ? 'bg-white text-emerald-700 hover:bg-emerald-50 active:scale-95'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
          }`}
        >
          {isDecrypting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Khối Sóng Âm (Waveform Visualizer) tương tác */}
        <div
          onClick={handleSeek}
          className="group relative flex h-10 flex-1 cursor-pointer items-center gap-0.5 px-1 select-none"
          title="Nhấp để chuyển đoạn âm thanh"
        >
          {bars.map((barHeight, idx) => {
            const barPercent = (idx / bars.length) * 100
            const isPlayed = barPercent <= progressPercent
            const heightPx = Math.max(4, Math.round(barHeight * 30))

            return (
              <div
                key={idx}
                style={{ height: `${heightPx}px` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isPlayed
                    ? isOutgoing
                      ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]'
                      : 'bg-emerald-600 dark:bg-emerald-400'
                    : isOutgoing
                    ? 'bg-emerald-400/50 group-hover:bg-emerald-300/70'
                    : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'
                }`}
              />
            )
          })}
        </div>

        {/* Nút chỉnh tốc độ (1x, 1.5x, 2x) */}
        <button
          type="button"
          onClick={handleCycleSpeed}
          title="Tốc độ phát âm thanh"
          className={`rounded-lg px-1.5 py-1 text-[10px] font-bold tracking-tight transition ${
            isOutgoing
              ? 'bg-emerald-700/60 text-emerald-100 hover:bg-emerald-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Thông tin phụ: Thời gian & Nhãn bảo mật */}
      <div className="flex items-center justify-between px-1 text-[11px] opacity-80">
        <span className="font-mono">
          {formatAudioDuration(isPlaying ? currentTime : totalDuration)}
        </span>
        <div className="flex items-center gap-1 text-[10px]">
          <Lock className="h-3 w-3" />
          <span>E2EE Opus</span>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Khu vực phiên âm văn bản (Transcription) */}
      {currentText ? (
        <div className={`mt-1 rounded-xl p-2.5 text-xs transition border ${
          isOutgoing
            ? 'bg-emerald-700/40 border-emerald-500/30 text-emerald-50'
            : 'bg-slate-50 border-slate-200/80 text-slate-700 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-200'
        }`}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                aria-label="Chỉnh sửa nội dung phiên âm"
                placeholder="Chỉnh sửa nội dung phiên âm..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditText(currentText)
                    setIsEditing(false)
                  }}
                  className="rounded px-2 py-1 text-[11px] hover:bg-black/10"
                >
                  <X className="h-3.5 w-3.5 inline mr-1" /> Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow hover:bg-emerald-600"
                >
                  <Check className="h-3.5 w-3.5 inline mr-1" /> Lưu
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] opacity-80">
                <div className="flex items-center gap-1">
                  <span>{langMeta.flag}</span>
                  <span className="font-semibold">{langMeta.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Chỉnh sửa thủ công nội dung phiên âm"
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-black/10 text-[10px]"
                >
                  <Edit3 className="h-3 w-3" /> Sửa tay
                </button>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{currentText}</p>
            </div>
          )}
        </div>
      ) : (
        /* Nút kích hoạt chuyển giọng nói thành văn bản nếu chưa có transcript */
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleTranscribeOnDevice}
            disabled={isTranscribing}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 px-3 text-xs font-semibold transition ${
              isOutgoing
                ? 'bg-emerald-700/50 hover:bg-emerald-700 text-emerald-100'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[11px]">{sttProgress || 'Đang nhận diện...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Chuyển thành văn bản</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal xác nhận đồng ý gửi âm thanh lên Server STT (Yêu cầu P5) */}
      {showServerConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Globe className="h-5 w-5" />
              <h4 className="font-bold text-sm">Chuyển văn bản phía máy chủ</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Thiết bị của bạn không tải được mô hình Whisper on-device.
              Bạn có muốn dùng tùy chọn dự phòng chuyển văn bản phía máy chủ không?
            </p>
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              ⚠️ <strong>Cam kết bảo mật:</strong> Âm thanh sẽ được gửi tới máy chủ để chuyển thành văn bản,
              chỉ xử lý tạm thời trong RAM và <strong>KHÔNG LƯU LẠI</strong> sau khi xử lý.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowServerConsentModal(false)}
                className="rounded-xl px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmServerStt}
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
              >
                Đồng ý gửi âm thanh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
