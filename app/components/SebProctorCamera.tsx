'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Play,
  RefreshCw,
} from 'lucide-react'

interface SebProctorCameraProps {
  examId: string
  currentUser: any
  examTitle?: string
  userInfo?: {
    fullName?: string
    email?: string
    phone?: string
    className?: string
    school?: string
    province?: string
    subject?: string
  }
  onViolation?: (message: string) => void
  onDisqualified?: (info: { reason: string; snapshot: string }) => void
  onNoCamera?: () => void
}

export default function SebProctorCamera({
  examId,
  currentUser,
  examTitle,
  userInfo = {},
  onViolation,
  onDisqualified,
  onNoCamera,
}: SebProctorCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 🌟 GIẢI PHÁP CHỐNG GIẬT / NHẤP NHÁY CAMERA:
  // Lưu toàn bộ props vào Ref để camera không bao giờ bị khởi động lại khi component cha re-render (đếm ngược thời gian)
  const userInfoRef = useRef(userInfo)
  userInfoRef.current = userInfo

  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  const examIdRef = useRef(examId)
  examIdRef.current = examId

  const examTitleRef = useRef(examTitle)
  examTitleRef.current = examTitle

  const onViolationRef = useRef(onViolation)
  onViolationRef.current = onViolation

  const onDisqualifiedRef = useRef(onDisqualified)
  onDisqualifiedRef.current = onDisqualified

  const onNoCameraRef = useRef(onNoCamera)
  onNoCameraRef.current = onNoCamera

  // Trạng thái camera: 'checking' | 'active' | 'no_camera'
  const [cameraState, setCameraState] = useState<'checking' | 'active' | 'no_camera'>('checking')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<string>('')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [violationCount, setViolationCount] = useState(0)

  // Quản lý nhiều camera trên thiết bị (vd: Cam màu vs Cam hồng ngoại Windows Hello)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string>('')
  const [switchingCamera, setSwitchingCamera] = useState(false)

  // Báo cáo về Admin khi học sinh không có camera
  const reportNoCameraToAdmin = async () => {
    try {
      const uInfo = userInfoRef.current || {}
      const user = currentUserRef.current
      await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report_no_camera',
          examId: examIdRef.current,
          userId: user?.id,
          userInfo: {
            fullName: uInfo.fullName || user?.user_metadata?.full_name || 'Học sinh',
            email: uInfo.email || user?.email || '',
            phone: uInfo.phone || '',
            className: uInfo.className || '',
            school: uInfo.school || '',
            province: uInfo.province || '',
            subject: uInfo.subject || examTitleRef.current || '',
          },
        }),
      })
    } catch (err) {
      console.warn('Không thể gửi báo cáo no_camera:', err)
    }
  }

  // Gửi heartbeat định kỳ xác nhận học sinh đang làm bài
  const sendHeartbeat = async () => {
    try {
      await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          examId: examIdRef.current,
          userId: currentUserRef.current?.id,
        }),
      })
    } catch (e) {}
  }

  // Khởi động Camera với cơ chế Fallback chống lỗi màn hình đen
  const startCamera = async (targetDeviceId?: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập máy ảnh')
      }

      // Dừng stream cũ trước khi đổi camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      let stream: MediaStream | null = null

      // Thử 1: Nếu có deviceId cụ thể do người dùng chọn
      if (targetDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          })
        } catch (e) {
          console.warn('Không thể mở camera với deviceId chỉ định, fallback sang cấu hình tự do:', e)
        }
      }

      // Thử 2: Thử độ phân giải tiêu chuẩn 640x480
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640, min: 320 },
              height: { ideal: 480, min: 240 },
            },
            audio: false,
          })
        } catch (e) {
          console.warn('Không thể mở camera với constraint 640x480, fallback sang video: true:', e)
        }
      }

      // Thử 3: Fallback an toàn tuyệt đối video: true (Hỗ trợ 100% mọi driver camera trên Windows)
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream

      const tracks = stream.getVideoTracks()
      if (tracks.length > 0) {
        const settings = tracks[0].getSettings()
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId)
        }
      }

      // Lưu lại danh sách thiết bị camera để hỗ trợ đổi camera nếu bị đen
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter((d) => d.kind === 'videoinput')
        setVideoDevices(cams)
      } catch (devErr) {
        console.warn('Không thể liệt kê thiết bị:', devErr)
      }

      // Gán stream vào thẻ video và kích hoạt play()
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        video.play().then(() => {
          setIsPlaying(true)
        }).catch((playErr) => {
          console.warn('Lỗi tự động phát video:', playErr)
        })
      }

      setCameraState('active')
      setIsPlaying(true)
    } catch (err: any) {
      console.warn('Lỗi khi mở camera hoặc học sinh không có camera:', err?.message || err)
      setCameraState('no_camera')
      await reportNoCameraToAdmin()
      if (onNoCameraRef.current) onNoCameraRef.current()
    }
  }

  // Chuyển đổi camera tiếp theo (dành cho máy tính có nhiều camera như Cam hồng ngoại và Cam màu)
  const handleSwitchCamera = async () => {
    if (videoDevices.length <= 1) {
      // Khởi động lại camera hiện tại
      setSwitchingCamera(true)
      await startCamera(activeDeviceId || undefined)
      setSwitchingCamera(false)
      return
    }

    setSwitchingCamera(true)
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === activeDeviceId)
    const nextIndex = (currentIndex + 1) % videoDevices.length
    const nextDevice = videoDevices[nextIndex]

    if (nextDevice?.deviceId) {
      setActiveDeviceId(nextDevice.deviceId)
      await startCamera(nextDevice.deviceId)
    }
    setSwitchingCamera(false)
  }

  // Chụp một khung hình từ Video và gửi sang Gemini 3.8 Live Proctor API
  const captureAndAnalyzeFrame = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !streamRef.current) return

    // Đảm bảo video đang thực sự chạy và có kích thước
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      video.muted = true
      video.play().then(() => setIsPlaying(true)).catch(() => {})
      return
    }

    try {
      setIsAnalyzing(true)
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Vẽ hình ảnh từ video sang canvas (kèm lật ngang gương để chuẩn quan sát)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64Image = canvas.toDataURL('image/jpeg', 0.65)

      const uInfo = userInfoRef.current || {}
      const user = currentUserRef.current

      const response = await fetch('/api/seb/proctor-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_frame',
          image: base64Image,
          examId: examIdRef.current,
          userId: user?.id,
          userInfo: {
            fullName: uInfo.fullName || user?.user_metadata?.full_name || 'Học sinh',
            email: uInfo.email || user?.email || '',
            phone: uInfo.phone || '',
            className: uInfo.className || '',
            school: uInfo.school || '',
            province: uInfo.province || '',
            subject: uInfo.subject || examTitleRef.current || '',
          },
        }),
      })

      const result = await response.json()
      setLastCheckTime(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )

      if (result && result.suspicious && result.violation_type !== 'none') {
        const desc = result.description || 'Phát hiện nghi vấn vi phạm quy chế'
        setWarningMessage(desc)
        setViolationCount((c) => c + 1)
        if (onViolationRef.current) {
          onViolationRef.current(`⚠️ Giám thị AI: ${desc}`)
        }

        // 🚨 NẾU PHÁT HIỆN SỬ DỤNG ĐIỆN THOẠI -> ĐÌNH CHỈ THI & ĐUỔI KHỎI PHÒNG THI NGAY LẬP TỨC!
        if (result.phone_detected || result.rear_camera_detected || result.is_disqualified || result.violation_type === 'phone_detected') {
          if (onDisqualifiedRef.current) {
            onDisqualifiedRef.current({
              reason: desc,
              snapshot: base64Image,
            })
          }
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

  // 🌟 KHỞI ĐỘNG CAMERA 1 LẦN DUY NHẤT:
  // Quét mỗi 2 GIÂY một lần (2000ms) để phát hiện kịp thời gian lận theo đúng yêu cầu
  useEffect(() => {
    let isMounted = true

    startCamera()

    // Quét định kỳ 2 giây / 1 lần gửi frame tới Gemini 3.8 Live Proctoring
    const scanInterval = setInterval(() => {
      if (isMounted) {
        captureAndAnalyzeFrame()
      }
    }, 2000)

    // Heartbeat mỗi 45 giây
    const heartbeatInterval = setInterval(() => {
      if (isMounted) {
        sendHeartbeat()
      }
    }, 45000)

    // Quét lần đầu tiên sau 2 giây
    const firstScanTimer = setTimeout(() => {
      if (isMounted) {
        captureAndAnalyzeFrame()
      }
    }, 2000)

    return () => {
      isMounted = false
      clearTimeout(firstScanTimer)
      clearInterval(scanInterval)
      clearInterval(heartbeatInterval)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, []) // 🌟 ĐẢM BẢO DEPENDENCY LUÔN RỖNG []

  // Đảm bảo video được gán stream khi videoRef sẵn sàng
  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [cameraState])

  // =======================================================================
  // KHI HỌC SINH KHÔNG CÓ CAMERA:
  // Khu vực camera BIẾN MẤT HOÀN TOÀN, học sinh vẫn được thi bình thường!
  // =======================================================================
  if (cameraState === 'no_camera') {
    return null
  }

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl border border-slate-700/80 p-2.5 shadow-md mb-3 select-none">
      {/* Hidden Canvas dùng để chụp frame gửi sang Gemini AI */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center gap-3">
        {/* KHUNG VIDEO CAMERA MINI (CHỐNG LỖI MÀN HÌNH ĐEN, CÓ NÚT KÍCH HOẠT THỦ CÔNG & ĐỔI CAMERA) */}
        <div className="relative w-28 sm:w-32 h-20 rounded-xl overflow-hidden bg-black border border-slate-700 shrink-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              v.muted = true
              v.play().then(() => setIsPlaying(true)).catch(() => {})
            }}
            onPlaying={() => setIsPlaying(true)}
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Đèn báo trạng thái hoạt động LIVE */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-400 z-10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE 2s</span>
          </div>

          {/* NÚT KÍCH HOẠT PHÁT HÌNH ẢNH NẾU BỊ TRÌNH DUYỆT CHẶN AUTOPLAY HOẶC MÀN HÌNH ĐEN */}
          {!isPlaying && (
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = true
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
                    startCamera(activeDeviceId)
                  })
                } else {
                  startCamera(activeDeviceId)
                }
              }}
              className="absolute inset-0 z-20 bg-black/75 flex flex-col items-center justify-center text-center p-1 cursor-pointer hover:bg-black/60 transition group"
              title="Bấm để bật hình ảnh camera"
            >
              <Play className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition mb-0.5" />
              <span className="text-[9px] font-black text-emerald-300 uppercase leading-tight">
                Bật hình camera
              </span>
            </button>
          )}

          {/* Hiệu ứng quét AI của Gemini */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-sky-900/30 flex items-center justify-center pointer-events-none z-10">
              <span className="text-[9px] font-black text-sky-200 uppercase tracking-tighter bg-sky-950/80 px-1.5 py-0.5 rounded">
                Gemini 3.8
              </span>
            </div>
          )}
        </div>

        {/* THÔNG TIN GIÁM THỊ AI & CÁC NÚT THAO TÁC */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-[11px] font-black text-sky-400 truncate">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>Gemini 3.8 Live Proctor</span>
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {/* Nút Đổi Camera / Khởi động lại cam nếu bị đen */}
              <button
                type="button"
                disabled={switchingCamera}
                onClick={handleSwitchCamera}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[9px] font-bold border border-slate-700"
                title={videoDevices.length > 1 ? 'Đổi sang camera khác' : 'Khởi động lại camera'}
              >
                <RefreshCw className={`h-2.5 w-2.5 ${switchingCamera ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {videoDevices.length > 1 ? 'Đổi Cam' : 'Bật lại'}
                </span>
              </button>

              {lastCheckTime && (
                <span className="text-[9px] text-slate-400 font-mono">
                  {lastCheckTime}
                </span>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
            Giám sát 2s/lần: Phát hiện camera sau điện thoại, che cam & phao
          </p>

          {/* Cảnh báo vi phạm nếu AI phát hiện */}
          {warningMessage ? (
            <div className="mt-1 flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-lg text-[10px] font-bold animate-pulse">
              <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
              <span className="truncate">{warningMessage}</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-semibold text-emerald-400">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{isPlaying ? 'AI đang giám sát trực tiếp' : 'Đang tải hình ảnh...'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
