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
  const isAnalyzingRef = useRef(false)
  const [lastCheckTime, setLastCheckTime] = useState<string>('')
  const [isTooDark, setIsTooDark] = useState(false)
  const lastGeminiAuditTs = useRef<number>(Date.now())
  const [apiStatusMessage, setApiStatusMessage] = useState<string | null>(null)
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

  const tickCountRef = useRef(0)
  const prevFrameAvgRef = useRef<number | null>(null)
  const prevRoiAvgRef = useRef<number | null>(null)

  // Chụp một khung hình từ Video và xử lý:
  // - 100% đánh giá cục bộ qua Canvas trước mà không cần Gemini
  // - Khi quá tối (avgLuminance < 25): thông báo học sinh cần nơi sáng hơn
  // - Nhận diện vật lạ trên vùng mặt thí sinh (điện thoại, che mặt, thiết bị lạ, giấy tờ...)
  // - Khi phát hiện vật thể lạ trên mặt hoặc đột xuất mỗi 1 phút: gửi frame sang Gemini xử lý
  // - Trên màn hình các em học sinh sẽ KHÔNG THẤY CẢNH BÁO GÌ (Silent Mode), hệ thống âm thầm ghi log bằng chứng cho Admin
  const captureAndAnalyzeFrame = async () => {
    // Nếu đang xử lý frame trước thì bỏ qua để tránh nghẽn mạng
    if (isAnalyzingRef.current) return

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
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      // Vẽ hình ảnh từ video sang canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      tickCountRef.current += 1

      // 🔍 1. NHẬN DIỆN 100% CỤC BỘ QUA CANVAS (Không tốn quota Gemini):
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data
      let totalLuminance = 0
      const sampleStep = 8 // lấy mẫu dày hơn để đo độ sáng chính xác
      let sampleCount = 0

      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        totalLuminance += lum
        sampleCount++
      }

      const avgLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 0

      // A. KIỂM TRA ÁNH SÁNG: "khi nào phát hiện quá tối thì thông báo tới học sinh cần nơi sáng hơn"
      if (avgLuminance < 25) {
        setIsTooDark(true)
      } else {
        setIsTooDark(false)
      }

      // B. KIỂM TRA VẬT THỂ LẠ TRÊN MẶT THÍ SINH (Vùng trung tâm khuôn mặt x: [110..290], y: [50..230])
      let roiLuminanceSum = 0
      let roiLumSqSum = 0
      let roiCount = 0
      let skinCount = 0
      let darkForeignCount = 0
      let brightForeignCount = 0
      let vibrantForeignCount = 0

      for (let y = 50; y < 230; y += 4) {
        for (let x = 110; x < 290; x += 4) {
          const idx = (y * 400 + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          roiLuminanceSum += lum
          roiLumSqSum += lum * lum
          roiCount++

          // 1. Nhận diện pixel màu da người (Human Skin Model)
          const sumRGB = r + g + b
          const nr = sumRGB > 0 ? r / sumRGB : 0
          const ng = sumRGB > 0 ? g / sumRGB : 0
          const isSkinPixel =
            r > 65 &&
            g > 35 &&
            b > 20 &&
            r > g &&
            r - g >= 8 &&
            r > b &&
            nr >= 0.34 &&
            nr <= 0.56 &&
            ng >= 0.26 &&
            ng <= 0.40

          if (isSkinPixel) {
            skinCount++
          }

          // 2. Nhận diện dị vật tối màu bất thường (cụm camera điện thoại, thân máy điện thoại đen, vật che tối)
          if (r < 42 && g < 42 && b < 42) {
            darkForeignCount++
          }

          // 3. Nhận diện dị vật phản quang / màn hình điện thoại phát sáng / phao thi giấy trắng
          if (r > 210 && g > 210 && b > 210 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
            brightForeignCount++
          }

          // 4. Nhận diện vật thể màu sắc lạ áp sát mặt (ốp điện thoại màu, vải che, sticker)
          if ((b > r + 30 || (g > r + 25 && g > b + 25)) && sumRGB > 120) {
            vibrantForeignCount++
          }
        }
      }

      const roiAvg = roiCount > 0 ? roiLuminanceSum / roiCount : 0
      const roiVariance = roiCount > 0 ? (roiLumSqSum / roiCount) - (roiAvg * roiAvg) : 0
      const skinRatio = roiCount > 0 ? skinCount / roiCount : 0
      const darkRatio = roiCount > 0 ? darkForeignCount / roiCount : 0
      const brightRatio = roiCount > 0 ? brightForeignCount / roiCount : 0
      const vibrantRatio = roiCount > 0 ? vibrantForeignCount / roiCount : 0

      // Chênh lệch ánh sáng đột ngột trên vùng mặt giữa 2 frame (vật thể hoặc tay vừa giơ lên mặt)
      let hasAbruptMotion = false
      if (prevRoiAvgRef.current !== null) {
        const delta = Math.abs(roiAvg - prevRoiAvgRef.current)
        if (delta > 32) {
          hasAbruptMotion = true
        }
      }
      prevRoiAvgRef.current = roiAvg

      // Phát hiện vật thể lạ trên vùng mặt:
      // - Cụm vật thể màu tối chiếm diện tích trên mặt (thân/cụm camera điện thoại > 9%)
      // - Màn hình điện thoại sáng / giấy tài liệu phao thi trắng (> 8%)
      // - Dị vật màu sắc nổi bật áp sát mặt (> 8%)
      // - Khuôn mặt bị che phủ khi phòng sáng (tỷ lệ da tụt dưới 15% khi avgLuminance >= 28)
      // - Che hoàn toàn bằng vật phẳng (roiVariance < 36) hoặc che kín camera (avgLuminance < 12)
      // - Chuyển động đột ngột đưa vật lạ lên mặt
      const hasDarkForeignObject = darkRatio > 0.09
      const hasBrightForeignObject = brightRatio > 0.08
      const hasVibrantForeignObject = vibrantRatio > 0.08
      const hasSkinDisrupted = avgLuminance >= 28 && skinRatio < 0.15
      const isFlatOccluded = avgLuminance >= 25 && roiVariance < 36
      const isCameraBlocked = avgLuminance < 12

      const isForeignObjectOnFace =
        hasDarkForeignObject ||
        hasBrightForeignObject ||
        hasVibrantForeignObject ||
        hasSkinDisrupted ||
        isFlatOccluded ||
        isCameraBlocked ||
        hasAbruptMotion

      // C. ĐIỀU KIỆN GỬI GEMINI:
      // - Khi phát hiện vật lạ trên mặt thí sinh (điện thoại, che mặt, dị vật, phao thi...)
      // - HOẶC định kỳ cứ 1 phút một lần để kiểm tra đột xuất
      const now = Date.now()
      const isSurpriseAudit = (now - lastGeminiAuditTs.current) >= 60000 // Đúng 1 phút / 60s một lần
      const shouldSendToGemini = isForeignObjectOnFace || isSurpriseAudit

      if (!shouldSendToGemini) {
        // Hệ thống cục bộ kiểm soát 100%, không gửi request lên Gemini
        return
      }

      lastGeminiAuditTs.current = now
      isAnalyzingRef.current = true
      setIsAnalyzing(true)
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

      // Cảnh báo nếu server chưa có GEMINI_API_KEY hoặc lỗi kết nối AI
      if (result?.has_api_error) {
        setApiStatusMessage(result.description || 'Chưa cấu hình GEMINI_API_KEY')
      } else {
        setApiStatusMessage(null)
      }

      // 🤫 CHẾ ĐỘ GIÁM SÁT THẦM LẶNG (SILENT PROCTORING):
      // "Trên màn hình các em sẽ không thấy cảnh báo gì"
      // Backend /api/seb/proctor-live đã tự động lưu ảnh vi phạm & chi tiết vào Supabase cho Quản trị viên
      if (result?.phone_detected || result?.rear_camera_detected || (result?.suspicious && result?.violation_type !== 'none')) {
        setViolationCount((c) => c + 1)
      }
    } catch (e) {
      console.warn('Lỗi khi gửi frame phân tích Gemini proctoring:', e)
    } finally {
      isAnalyzingRef.current = false
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
            <span>LIVE AI</span>
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

          {/* Hiệu ứng quét AI của Gemini 3.5 Flash-Lite */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-sky-900/30 flex items-center justify-center pointer-events-none z-10">
              <span className="text-[9px] font-black text-sky-200 uppercase tracking-tighter bg-sky-950/80 px-1.5 py-0.5 rounded">
                Gemini 3.5 Lite
              </span>
            </div>
          )}
        </div>

        {/* THÔNG TIN GIÁM THỊ AI & CÁC NÚT THAO TÁC */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-[11px] font-black text-sky-400 truncate">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>Sen Exam Canvas Proctor</span>
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

          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
            Hệ thống giám sát khảo thí trực tiếp
          </p>

          {/* Thông báo ánh sáng hoặc trạng thái giám sát (Silent Mode: Không hiển thị cảnh báo vi phạm tới học sinh) */}
          {isTooDark ? (
            <div className="mt-1 flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold animate-pulse">
              <span>💡 Cần nơi sáng hơn</span>
            </div>
          ) : apiStatusMessage ? (
            <div className="mt-1 flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg text-[9px] font-bold">
              <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />
              <span className="truncate">{apiStatusMessage}</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-semibold text-emerald-400">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{isPlaying ? 'Hệ thống đang giám sát bài thi' : 'Đang kết nối camera...'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
