'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, AlertTriangle, Eye, VideoOff } from 'lucide-react'

interface SebProctorCameraProps {
  examId: string
  currentUser: any
  examTitle?: string
  userInfo?: {
    fullName?: string
    email?: string
    className?: string
    school?: string
    province?: string
    subject?: string
  }
  onViolation?: (message: string) => void
  onNoCamera?: () => void
}

export default function SebProctorCamera({
  examId,
  currentUser,
  examTitle,
  userInfo = {},
  onViolation,
  onNoCamera,
}: SebProctorCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Trạng thái camera: 'checking' | 'active' | 'no_camera'
  const [cameraState, setCameraState] = useState<'checking' | 'active' | 'no_camera'>('checking')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<string>('')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [violationCount, setViolationCount] = useState(0)

  // Báo cáo về Admin khi học sinh không có camera
  const reportNoCameraToAdmin = useCallback(async () => {
    try {
      await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report_no_camera',
          examId,
          userId: currentUser?.id,
          userInfo: {
            fullName: userInfo.fullName || currentUser?.user_metadata?.full_name || 'Học sinh',
            email: userInfo.email || currentUser?.email || '',
            className: userInfo.className || '',
            school: userInfo.school || '',
            province: userInfo.province || '',
            subject: userInfo.subject || examTitle || '',
          },
        }),
      })
    } catch (err) {
      console.warn('Không thể gửi báo cáo no_camera:', err)
    }
  }, [examId, currentUser, userInfo, examTitle])

  // Gửi heartbeat định kỳ xác nhận học sinh đang làm bài
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          examId,
          userId: currentUser?.id,
        }),
      })
    } catch (e) {}
  }, [examId, currentUser])

  // Khởi động Camera và Kiểm tra
  useEffect(() => {
    let isMounted = true
    let scanInterval: NodeJS.Timeout
    let heartbeatInterval: NodeJS.Timeout

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ truy cập máy ảnh')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480 },
            height: { ideal: 360 },
            facingMode: 'user',
          },
          audio: false,
        })

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        setCameraState('active')

        // Quét định kỳ 15 giây / 1 lần gửi frame tới Gemini Live Proctoring
        scanInterval = setInterval(() => {
          captureAndAnalyzeFrame()
        }, 15000)

        // Heartbeat mỗi 45 giây
        heartbeatInterval = setInterval(() => {
          sendHeartbeat()
        }, 45000)

        // Quét lần đầu tiên sau 3 giây
        setTimeout(() => {
          captureAndAnalyzeFrame()
        }, 3000)
      } catch (err: any) {
        console.warn('Học sinh không có camera hoặc từ chối cấp quyền camera:', err?.message || err)
        if (isMounted) {
          setCameraState('no_camera')
          reportNoCameraToAdmin()
          if (onNoCamera) onNoCamera()
        }
      }
    }

    startCamera()

    return () => {
      isMounted = false
      clearInterval(scanInterval)
      clearInterval(heartbeatInterval)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [reportNoCameraToAdmin, sendHeartbeat, onNoCamera])

  // Chụp một khung hình từ Video và gửi sang Gemini 3.8 Live Proctor API
  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') return
    const video = videoRef.current
    if (video.readyState < 2) return

    try {
      setIsAnalyzing(true)
      const canvas = canvasRef.current
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Vẽ hình ảnh từ video sang canvas (kèm lật ngang gương để chuẩn quan sát)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64Image = canvas.toDataURL('image/jpeg', 0.65)

      const response = await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_frame',
          image: base64Image,
          examId,
          userId: currentUser?.id,
          userInfo: {
            fullName: userInfo.fullName || currentUser?.user_metadata?.full_name || 'Học sinh',
            email: userInfo.email || currentUser?.email || '',
            className: userInfo.className || '',
            school: userInfo.school || '',
            province: userInfo.province || '',
            subject: userInfo.subject || examTitle || '',
          },
        }),
      })

      const result = await response.json()
      setLastCheckTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))

      if (result && result.suspicious && result.violation_type !== 'none') {
        const desc = result.description || 'Phát hiện nghi vấn vi phạm quy chế'
        setWarningMessage(desc)
        setViolationCount((c) => c + 1)
        if (onViolation) {
          onViolation(`⚠️ Giám thị AI: ${desc}`)
        }
      } else {
        setWarningMessage(null)
      }
    } catch (e) {
      console.warn('Lỗi khi gửi frame phân tích Gemini proctoring:', e)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // =======================================================================
  // YÊU CẦU ĐẶC BIỆT CỦA NGƯỜI DÙNG:
  // "khi học sinh không có cam thì vẫn được thi (Phần đặt camera cũng biến mất)
  // nhưng admin sẽ báo về là em đó có làm bài thi hay không"
  // =======================================================================
  if (cameraState === 'no_camera') {
    // Trả về null: Khu vực camera BIẾN MẤT HOÀN TOÀN, KHÔNG CẢN TRỞ BÀI THI VÀ ĐÁP ÁN!
    return null
  }

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl border border-slate-700/80 p-2.5 shadow-md mb-3 select-none">
      {/* Hidden Canvas dùng để chụp frame gửi sang Gemini AI */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center gap-3">
        {/* Khung Video Camera Mini (Nhỏ gọn, soi gương, không cản trở bài thi) */}
        <div className="relative w-28 sm:w-32 h-20 rounded-xl overflow-hidden bg-black border border-slate-700 shrink-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Đèn báo trạng thái hoạt động */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>

          {isAnalyzing && (
            <div className="absolute inset-0 bg-sky-900/30 flex items-center justify-center">
              <span className="text-[9px] font-black text-sky-200 uppercase tracking-tighter bg-sky-950/80 px-1.5 py-0.5 rounded">
                Gemini scan
              </span>
            </div>
          )}
        </div>

        {/* Thông tin Giám thị AI Gemini Live */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-[11px] font-black text-sky-400 truncate">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>Gemini 3.8 Live Proctor</span>
            </span>

            {lastCheckTime && (
              <span className="text-[9px] text-slate-400 font-mono shrink-0">
                {lastCheckTime}
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
            Giám sát camera chống che cam, điện thoại & tài liệu
          </p>

          {/* Cảnh báo vi phạm nếu AI phát hiện */}
          {warningMessage ? (
            <div className="mt-1 flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-lg text-[10px] font-bold animate-pulse">
              <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
              <span className="truncate">{warningMessage}</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Trạng thái phòng thi an toàn</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
