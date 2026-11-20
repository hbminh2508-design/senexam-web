'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  Sparkles,
  Loader2,
  AlertTriangle,
  Lock,
  Globe,
  Edit3,
  Check,
  X,
  Volume2,
} from 'lucide-react'
import {
  generateFileKey,
  encryptFileToBlob,
  bytesToBase64,
} from '@/lib/senChatChunkCrypto'
import {
  getPreferredAudioMimeType,
  formatAudioDuration,
  extractWaveformFromData,
  detectLanguageFromText,
  getLanguageMeta,
  transcribeAudioOnDevice,
  transcribeAudioServerSide,
  WhisperModelProgress,
} from '@/lib/senChatVoiceSTT'
import { validateChatFileSize } from '@/lib/chatLimits'
import { supabase } from '@/lib/supabaseClient'

interface ChatVoiceRecorderProps {
  conversationId: string
  userPlanTier?: string | null
  onCancel: () => void
  onSendVoiceMessage: (data: {
    audioBlob: Blob
    fileKeyBase64: string
    attachmentId?: string
    driveFileId?: string
    storageProvider?: string
    storagePath?: string
    duration: number
    waveform: number[]
    transcription?: string
    transcriptionLanguage?: string
    fileSize: number
    mimeType: string
  }) => Promise<void>
}

export default function ChatVoiceRecorder({
  conversationId,
  userPlanTier = 'free',
  onCancel,
  onSendVoiceMessage,
}: ChatVoiceRecorderProps) {
  // Trạng thái ghi âm:
  // 'requesting_permission' -> 'explaining_permission' -> 'recording' -> 'paused' -> 'reviewing' -> 'uploading'
  const [recorderState, setRecorderState] = useState<
    'explain_perm' | 'perm_denied' | 'recording' | 'paused' | 'reviewing' | 'uploading'
  >('explain_perm')

  const [duration, setDuration] = useState(0)
  const [liveAmplitudes, setLiveAmplitudes] = useState<number[]>(Array(24).fill(0.1))
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([])
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0)

  // STT states
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [sttProgress, setSttProgress] = useState('')
  const [transcribedText, setTranscribedText] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('vi')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [serverSttConsent, setServerSttConsent] = useState(false)
  const [showServerConsentDialog, setShowServerConsentDialog] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Media references
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordedSamplesRef = useRef<number[]>([])

  // Dọn dẹp tài nguyên khi unmount
  useEffect(() => {
    return () => {
      cleanupAudioStream()
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl)
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [previewAudioUrl])

  const cleanupAudioStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }

  // 1. Yêu cầu quyền Micro đúng lúc kèm giải thích rõ (Yêu cầu 4)
  const handleRequestPermissionAndStart = async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream
      startRecordingWithStream(stream)
    } catch (err: any) {
      console.warn('Từ chối quyền truy cập micro:', err)
      setRecorderState('perm_denied')
    }
  }

  // 2. Bắt đầu phiên ghi âm MediaRecorder (Opus)
  const startRecordingWithStream = (stream: MediaStream) => {
    try {
      const mimeType = getPreferredAudioMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recordedSamplesRef.current = []

      // Thiết lập Web Audio API để hiển thị sóng âm trực quan thời gian thực (Waveform)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setRecordedBlob(fullBlob)
        const waveform = extractWaveformFromData(recordedSamplesRef.current, 36)
        setRecordedWaveform(waveform)

        // Tính thời lượng thực tế chính xác
        const elapsedSec = Math.max(1, Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000))
        setDuration(elapsedSec)

        const previewUrl = URL.createObjectURL(fullBlob)
        setPreviewAudioUrl(previewUrl)
        setRecorderState('reviewing')
        cleanupAudioStream()
      }

      startTimeRef.current = Date.now()
      recorder.start(100) // Lấy chunk mỗi 100ms
      setRecorderState('recording')
      setDuration(0)

      // Bộ đếm thời gian
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)

      // Loop vẽ sóng âm thời gian thực
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateWaveform = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)

        // Tính toán các thanh sóng âm dao động
        const bars: number[] = []
        const step = Math.floor(dataArray.length / 24) || 1
        let maxSampleInStep = 0

        for (let i = 0; i < 24; i++) {
          const val = dataArray[i * step] || 0
          const normalized = Math.max(0.1, val / 255)
          bars.push(normalized)
          if (normalized > maxSampleInStep) maxSampleInStep = normalized
        }

        recordedSamplesRef.current.push(maxSampleInStep)
        setLiveAmplitudes(bars)
        animFrameRef.current = requestAnimationFrame(updateWaveform)
      }
      updateWaveform()
    } catch (err: any) {
      console.error('Lỗi khởi tạo MediaRecorder:', err)
      setErrorMsg(err?.message || 'Không thể ghi âm trên thiết bị này')
      cleanupAudioStream()
    }
  }

  // Tạm dừng / Tiếp tục ghi âm
  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return
    if (recorderState === 'recording') {
      mediaRecorderRef.current.pause()
      setRecorderState('paused')
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    } else if (recorderState === 'paused') {
      mediaRecorderRef.current.resume()
      setRecorderState('recording')
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    }
  }

  // Dừng ghi âm và chuyển sang màn hình nghe lại & chỉnh sửa
  const handleStopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  // Hủy ghi âm
  const handleCancel = () => {
    cleanupAudioStream()
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    onCancel()
  }

  // Chuyển giọng nói thành văn bản On-Device (Whisper)
  const handleTranscribeOnDevice = async () => {
    if (!recordedBlob) return
    setIsTranscribing(true)
    setSttProgress('Đang tải mô hình Whisper...')
    try {
      const result = await transcribeAudioOnDevice(recordedBlob, {
        onProgress: (p: WhisperModelProgress) => {
          setSttProgress(p.message)
        },
      })
      setTranscribedText(result.text)
      setDetectedLanguage(result.language)
    } catch (err: any) {
      console.warn('STT On-Device thất bại, gợi ý dùng STT Server:', err)
      setShowServerConsentDialog(true)
    } finally {
      setIsTranscribing(false)
      setSttProgress('')
    }
  }

  // Chuyển giọng nói thành văn bản qua Server Fallback (có hộp thoại đồng ý)
  const handleConfirmServerStt = async () => {
    if (!recordedBlob) return
    setShowServerConsentDialog(false)
    setServerSttConsent(true)
    setIsTranscribing(true)
    setSttProgress('Đang gửi âm thanh tới máy chủ...')
    try {
      const { data: authData } = await supabase.auth.getSession()
      const token = authData.session?.access_token

      const result = await transcribeAudioServerSide({
        audioBlob: recordedBlob,
        consent: true,
        userPlanTier,
        authToken: token,
      })
      setTranscribedText(result.text)
      setDetectedLanguage(result.language)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi phiên âm từ máy chủ')
    } finally {
      setIsTranscribing(false)
      setSttProgress('')
    }
  }

  // Mã hóa E2EE bằng AES-256-GCM chunked và gửi tin nhắn thoại
  const handleSend = async () => {
    if (!recordedBlob) return
    setErrorMsg(null)
    setRecorderState('uploading')

    try {
      // 1. Kiểm tra hạn mức kích thước theo gói
      const validation = validateChatFileSize(recordedBlob.size, userPlanTier)
      if (!validation.allowed) {
        throw new Error(validation.error)
      }

      // 2. Tạo khóa AES-256 ngẫu nhiên cho tệp âm thanh thoại
      const fileKey = generateFileKey()
      const fileKeyBase64 = bytesToBase64(fileKey)

      // 3. Mã hóa toàn bộ dữ liệu audio blob theo từng chunk AES-256-GCM
      const encryptedBlob = await encryptFileToBlob(recordedBlob, fileKey)

      // 4. Tải tệp mã hóa lên server (lưu qua Supabase Storage hoặc Provider)
      const { data: authData } = await supabase.auth.getSession()
      const token = authData.session?.access_token

      const formData = new FormData()
      formData.append('file', encryptedBlob, 'voice-message.enc')
      formData.append('conversationId', conversationId)
      formData.append('fileType', 'audio')
      formData.append('fileSizeBytes', String(encryptedBlob.size))
      formData.append('encryptedMimeType', 'audio/webm;codecs=opus')

      const uploadRes = await fetch('/api/chat/attachments/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}))
        throw new Error(errJson.error || 'Lỗi tải lên âm thanh mã hóa')
      }

      const uploadData = await uploadRes.json()

      // 5. Gửi tin nhắn thoại hoàn chỉnh
      await onSendVoiceMessage({
        audioBlob: recordedBlob,
        fileKeyBase64,
        attachmentId: uploadData.attachment?.id,
        driveFileId: uploadData.attachment?.driveFileId,
        storageProvider: uploadData.attachment?.storageProvider,
        storagePath: uploadData.attachment?.storagePath,
        duration: duration || 1,
        waveform: recordedWaveform,
        transcription: transcribedText.trim() || undefined,
        transcriptionLanguage: detectedLanguage,
        fileSize: recordedBlob.size,
        mimeType: recordedBlob.type || 'audio/webm;codecs=opus',
      })

      onCancel()
    } catch (err: any) {
      console.error('Lỗi gửi tin nhắn thoại:', err)
      setErrorMsg(err?.message || 'Không thể mã hóa hoặc gửi tin nhắn thoại')
      setRecorderState('reviewing')
    }
  }

  const langMeta = getLanguageMeta(detectedLanguage)

  // =========================================================================
  // MÀN HÌNH 1: HỘP THOẠI GIẢI THÍCH QUYỀN MICROPHONE (Yêu cầu 4)
  // =========================================================================
  if (recorderState === 'explain_perm') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <Mic className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Quyền Truy Cập Microphone
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Sen Chat cần sử dụng microphone để bạn ghi âm và gửi tin nhắn thoại.
              Âm thanh được ghi âm và <strong>mã hóa đầu cuối (E2EE AES-256)</strong> trực tiếp trên thiết bị của bạn trước khi truyền tải.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 dark:text-slate-300"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleRequestPermissionAndStart}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition"
          >
            <Mic className="h-3.5 w-3.5" /> Cho phép & Bắt đầu ghi
          </button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 2: TỪ CHỐI QUYỀN MICROPHONE
  // =========================================================================
  if (recorderState === 'perm_denied') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
        <div className="flex items-start gap-3 text-rose-600 dark:text-rose-400">
          <MicOff className="h-6 w-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Chưa Được Cấp Quyền Microphone</h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Trình duyệt đã chặn truy cập micro. Để ghi âm tin nhắn thoại trên Sen Chat,
              vui lòng nhấn vào biểu tượng <strong>Ổ khóa hoặc Cài đặt trang web</strong> trên thanh địa chỉ trình duyệt, chọn <strong>Cho phép Microphone</strong>, sau đó thử lại.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 dark:text-slate-300"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleRequestPermissionAndStart}
            className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 3: ĐANG GHI ÂM HOẶC TẠM DỪNG (Live Waveform)
  // =========================================================================
  if (recorderState === 'recording' || recorderState === 'paused') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md dark:border-emerald-500/20 dark:bg-slate-900/95">
        {/* Nút Hủy (Thùng rác) */}
        <button
          type="button"
          onClick={handleCancel}
          title="Hủy bỏ ghi âm"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Chấm đỏ nhấp nháy + Thời gian */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              recorderState === 'recording' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[40px]">
            {formatAudioDuration(duration)}
          </span>
        </div>

        {/* Sóng âm trực tiếp (Live Waveform Animation) */}
        <div className="flex flex-1 items-center justify-center gap-1 h-8 px-2 overflow-hidden">
          {liveAmplitudes.map((amp, idx) => {
            const h = Math.max(4, Math.round(amp * 28))
            return (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  recorderState === 'recording'
                    ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            )
          })}
        </div>

        {/* Nút Tạm dừng / Tiếp tục */}
        <button
          type="button"
          onClick={handleTogglePause}
          title={recorderState === 'recording' ? 'Tạm dừng ghi âm' : 'Tiếp tục ghi âm'}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        >
          {recorderState === 'recording' ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          )}
        </button>

        {/* Nút Hoàn tất / Dừng ghi âm để xem lại */}
        <button
          type="button"
          onClick={handleStopRecording}
          title="Xong và xem lại"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 4: XEM LẠI, STT & CHỈNH SỬA TAY TRƯỚC KHI GỬI (Reviewing)
  // =========================================================================
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* HTML Audio element nghe thử */}
      {previewAudioUrl && (
        <audio
          ref={previewAudioRef}
          src={previewAudioUrl}
          onTimeUpdate={() => {
            if (previewAudioRef.current) {
              setPreviewCurrentTime(previewAudioRef.current.currentTime)
            }
          }}
          onEnded={() => {
            setIsPlayingPreview(false)
            setPreviewCurrentTime(0)
          }}
        />
      )}

      {/* Dòng 1: Nghe lại âm thanh với sóng âm tĩnh */}
      <div className="flex items-center gap-3">
        {/* Nút Play / Pause Preview */}
        <button
          type="button"
          onClick={() => {
            if (!previewAudioRef.current) return
            if (isPlayingPreview) {
              previewAudioRef.current.pause()
              setIsPlayingPreview(false)
            } else {
              previewAudioRef.current.play()
              setIsPlayingPreview(true)
            }
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 active:scale-95 transition"
        >
          {isPlayingPreview ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Sóng âm ghi nhận được */}
        <div className="flex flex-1 items-center gap-0.5 h-8">
          {recordedWaveform.map((bar, idx) => {
            const h = Math.max(4, Math.round(bar * 26))
            const progress = duration > 0 ? (previewCurrentTime / duration) * 100 : 0
            const isPlayed = (idx / recordedWaveform.length) * 100 <= progress

            return (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full ${
                  isPlayed ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )
          })}
        </div>

        <span className="font-mono text-xs font-semibold text-slate-500">
          {formatAudioDuration(isPlayingPreview ? previewCurrentTime : duration)}
        </span>
      </div>

      {/* Dòng 2: Phiên âm STT (nếu đã kích hoạt hoặc người dùng muốn chuyển văn bản) */}
      {transcribedText ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>{langMeta.flag}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {langMeta.name} ({langMeta.code})
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Tự động nhận diện
            </span>
          </div>

          {/* Ô nhập cho phép sửa tay (Manual Editing) */}
          <textarea
            value={transcribedText}
            onChange={(e) => {
              setTranscribedText(e.target.value)
              const detected = detectLanguageFromText(e.target.value)
              setDetectedLanguage(detected.code)
            }}
            rows={2}
            placeholder="Bạn có thể sửa tay nội dung phiên âm tại đây..."
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleTranscribeOnDevice}
            disabled={isTranscribing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{sttProgress || 'Đang nhận diện...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Chuyển giọng nói thành văn bản (STT)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dòng 3: Nút điều khiển Gửi / Hủy */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handleCancel}
          disabled={recorderState === 'uploading'}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" /> Hủy ghi âm
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={recorderState === 'uploading'}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
        >
          {recorderState === 'uploading' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Đang mã hóa E2EE...</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>Gửi tin nhắn thoại</span>
            </>
          )}
        </button>
      </div>

      {/* Hộp thoại đồng ý STT Server cho máy yếu (Yêu cầu 3) */}
      {showServerConsentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Globe className="h-5 w-5" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Chuyển Văn Bản Phía Server
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Thiết bị không chạy được mô hình AI on-device. Bạn có muốn chuyển sang tùy chọn dự phòng chuyển văn bản phía máy chủ không?
            </p>
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              ⚠️ <strong>Cam kết bảo mật:</strong> Âm thanh sẽ được gửi tới máy chủ để chuyển thành văn bản,
              xử lý tức thì trong RAM và <strong>KHÔNG LƯU LẠI</strong> sau khi xử lý.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowServerConsentDialog(false)}
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
