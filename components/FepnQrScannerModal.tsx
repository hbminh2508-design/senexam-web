'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Laptop,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Upload,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface FepnQrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  userEmail?: string
  currentUser?: any
  onApproved?: () => void
}

interface TargetDeviceInfo {
  browser: string
  os: string
  ip: string
  deviceType: string
  requestedAt: string
}

export default function FepnQrScannerModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  currentUser,
  onApproved,
}: FepnQrScannerModalProps) {
  const [mode, setMode] = useState<'code' | 'scan' | 'confirm' | 'code_display'>('code')
  const [codeInputValue, setCodeInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [targetToken, setTargetToken] = useState('')
  const [targetDevice, setTargetDevice] = useState<TargetDeviceInfo | null>(null)
  const [verifyDigit, setVerifyDigit] = useState('')
  const [isConfirmedRisk, setIsConfirmedRisk] = useState(false)
  const [generatedCompletionCode, setGeneratedCompletionCode] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  // Lưu thông tin người dùng đang thao tác
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string } | null>(null)

  // Camera video & canvas ref
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const scanLoopRef = useRef<number | null>(null)

  // Đồng bộ user hiện tại
  useEffect(() => {
    if (userId && userEmail) {
      setSessionUser({ id: userId, email: userEmail })
    } else if (currentUser?.id && currentUser?.email) {
      setSessionUser({ id: currentUser.id, email: currentUser.email })
    } else if (isOpen) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setSessionUser({ id: data.user.id, email: data.user.email || '' })
        }
      })
    }
  }, [userId, userEmail, currentUser, isOpen])

  const effectiveUserId = sessionUser?.id || userId || currentUser?.id || ''
  const effectiveUserEmail = sessionUser?.email || userEmail || currentUser?.email || ''

  // Dừng camera & vòng lặp quét
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setCameraActive(false)
  }, [cameraStream])

  // Xử lý quét từng khung hình từ camera
  const processFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = requestAnimationFrame(processFrame)
      return
    }

    const video = videoRef.current
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Quét bằng jsQR thuần JS (chạy 100% trên mọi trình duyệt)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          if (navigator.vibrate) {
            try {
              navigator.vibrate(80)
            } catch {}
          }
          stopCamera()
          handleCheckTargetInfo(code.data)
          return
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(processFrame)
  }, [stopCamera])

  // Khởi động camera
  const startCamera = async () => {
    setErrorMsg('')
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ mở camera trực tiếp. Vui lòng nhập mã 6 số!')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setCameraStream(stream)
      setCameraActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        scanLoopRef.current = requestAnimationFrame(processFrame)
      }
    } catch (err: any) {
      stopCamera()
      setErrorMsg(err.message || 'Không thể truy cập camera. Vui lòng chuyển sang nhập mã 6 số.')
      setMode('code')
    }
  }

  // Quản lý trạng thái camera theo mode và modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      return
    }

    if (mode === 'scan') {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, mode])

  // Quét mã QR từ file ảnh được tải lên (Ảnh chụp màn hình hoặc tải từ thư viện)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          setLoading(false)
          setErrorMsg('Không thể xử lý hình ảnh này.')
          return
        }
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        })
        setLoading(false)
        if (code && code.data) {
          handleCheckTargetInfo(code.data)
        } else {
          setErrorMsg('Không tìm thấy mã QR trong ảnh vừa tải lên. Vui lòng thử lại hoặc nhập mã 6 số.')
        }
      }
      img.onerror = () => {
        setLoading(false)
        setErrorMsg('Không thể đọc file ảnh.')
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Lấy thông tin thiết bị yêu cầu đăng nhập từ mã code / QR token
  const handleCheckTargetInfo = async (inputStr: string) => {
    const cleanStr = inputStr.replace(/[\s-]/g, '').trim()
    if (!cleanStr) return

    setLoading(true)
    setErrorMsg('')
    try {
      let queryKey = cleanStr
      // Nếu là chuỗi JSON từ QR
      if (cleanStr.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanStr)
          queryKey = parsed.token || parsed.code || cleanStr
        } catch {}
      }

      const res = await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_info',
          tokenOrCode: queryKey,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Mã xác thực không hợp lệ hoặc đã hết hạn')
      }

      setTargetToken(data.token)
      setTargetDevice(data.deviceInfo)
      setVerifyDigit(data.verifyDigit || '')
      setIsConfirmedRisk(false)
      setMode('confirm')
      stopCamera()
    } catch (err: any) {
      setErrorMsg(err.message || 'Không tìm thấy thiết bị yêu cầu đăng nhập')
    } finally {
      setLoading(false)
    }
  }

  // Từ chối đăng nhập (nghi vấn bị kẻ xấu lừa quét mã)
  const handleReject = async () => {
    if (!targetToken) return
    setLoading(true)
    setErrorMsg('')
    try {
      await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          token: targetToken,
        }),
      })
      setSuccessMsg('🛡️ Đã từ chối và hủy bỏ yêu cầu đăng nhập này an toàn.')
      setTimeout(() => {
        setMode('code')
        setTargetDevice(null)
        setTargetToken('')
        setSuccessMsg('')
      }, 1800)
    } catch (err: any) {
      setErrorMsg('Không thể gửi lệnh từ chối.')
    } finally {
      setLoading(false)
    }
  }

  // Phê duyệt đăng nhập -> Nhận mã 6 số Challenge-Response để hiển thị cho Máy A
  const handleApprove = async () => {
    if (!targetToken || !effectiveUserId || !effectiveUserEmail) {
      setErrorMsg('Không tìm thấy thông tin phiên người dùng đăng nhập. Vui lòng thử lại.')
      return
    }

    if (!isConfirmedRisk) {
      setErrorMsg('Vui lòng tích xác nhận cam kết đây là thiết bị của chính bạn.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          token: targetToken,
          userId: effectiveUserId,
          userEmail: effectiveUserEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Phê duyệt thất bại')
      }

      // Lấy mã xác thực 6 số trả về từ máy chủ
      const completionCode = data.completionCode
      setGeneratedCompletionCode(completionCode)
      setMode('code_display')
      onApproved?.()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi phê duyệt đăng nhập')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (generatedCompletionCode) {
      navigator.clipboard.writeText(generatedCompletionCode)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleFinish = () => {
    stopCamera()
    setMode('code')
    setCodeInputValue('')
    setTargetDevice(null)
    setTargetToken('')
    setGeneratedCompletionCode('')
    setIsConfirmedRisk(false)
    setErrorMsg('')
    setSuccessMsg('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Xác Thực Đăng Nhập FEPN</h3>
              <p className="text-[11px] text-slate-500 font-medium">Cấp quyền đăng nhập cho máy tính / điện thoại khác</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* BƯỚC 1: QUÉT CAMERA HOẶC NHẬP MÃ 6 SỐ */}
        {mode !== 'confirm' && mode !== 'code_display' && (
          <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('code')}
                className={`w-1/2 py-2 rounded-xl transition ${
                  mode === 'code' ? 'bg-white text-sky-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Nhập Mã 6 Số
              </button>
              <button
                type="button"
                onClick={() => setMode('scan')}
                className={`w-1/2 py-2 rounded-xl transition ${
                  mode === 'scan' ? 'bg-white text-sky-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Quét Camera
              </button>
            </div>

            {mode === 'code' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleCheckTargetInfo(codeInputValue)
                }}
                className="space-y-3"
              >
                <label className="block text-xs font-bold text-slate-700">
                  Nhập mã 6 chữ số hiển thị dưới mã QR của máy kia:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="VD: 849 204"
                    value={codeInputValue}
                    onChange={(e) => setCodeInputValue(e.target.value.toUpperCase())}
                    className="w-full text-center tracking-[0.25em] font-mono text-xl font-black py-3 px-4 rounded-2xl border border-slate-200 bg-slate-50/70 focus:border-sky-500 focus:bg-white transition uppercase"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  Mã này hiển thị ngay dưới mã QR trên màn hình đăng nhập của máy bạn muốn đăng nhập.
                </p>

                <button
                  type="submit"
                  disabled={loading || codeInputValue.replace(/[\s-]/g, '').length < 6}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  <span>Kiểm Tra & Phê Duyệt</span>
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="relative aspect-square w-full rounded-2xl bg-black overflow-hidden flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <div className="absolute inset-8 border-2 border-dashed border-sky-400/80 rounded-2xl pointer-events-none animate-pulse"></div>
                  <div className="absolute bottom-3 left-0 right-0 text-center text-white/90 text-[11px] font-bold bg-black/50 py-1.5 px-2">
                    Hướng camera vào mã QR trên màn hình đăng nhập
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 text-center">
                  {/* Nút upload ảnh QR fallback */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    <Upload className="h-3.5 w-3.5 text-sky-600" />
                    <span>Chọn ảnh mã QR / Ảnh chụp màn hình</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('code')}
                    className="text-xs font-bold text-sky-600 hover:underline"
                  >
                    Không quét được? Bấm để nhập mã 6 số trực tiếp
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BƯỚC 2: XÁC NHẬN THÔNG TIN THIẾT BỊ MÁY A */}
        {mode === 'confirm' && targetDevice && (
          <div className="space-y-4">
            {/* CẢNH BÁO BẢO MẬT & CHỐNG LỪA ĐẢO TỐI QUAN TRỌNG */}
            <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-xs text-rose-900 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-black text-rose-700 uppercase tracking-wider text-[11px]">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Cảnh Báo Bảo Mật Chống Lừa Đảo</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-rose-800 space-y-0.5 leading-relaxed font-semibold">
                <li>
                  Tuyệt đối <strong>KHÔNG</strong> quét mã hoặc nhập số do người lạ gửi qua tin nhắn.
                </li>
                <li>
                  <strong>CHỈ XÁC NHẬN</strong> nếu chính bạn đang trực tiếp đăng nhập trên thiết bị này!
                </li>
              </ul>
            </div>

            {/* Thẻ thông tin máy yêu cầu */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  {targetDevice.deviceType === 'mobile' ? (
                    <Smartphone className="h-5 w-5 text-sky-600" />
                  ) : (
                    <Laptop className="h-5 w-5 text-sky-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {targetDevice.browser} ({targetDevice.os})
                  </h4>
                  <span className="text-[11px] text-slate-500">Thiết bị đang yêu cầu truy cập tài khoản</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="h-3 w-3" /> Địa chỉ IP yêu cầu:
                  </span>
                  <span className="font-mono font-bold text-slate-800">{targetDevice.ip}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" /> Thời gian gửi:
                  </span>
                  <span className="font-bold text-slate-800">Vừa xong</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Globe className="h-3 w-3" /> Tài khoản cấp quyền:
                  </span>
                  <span className="font-mono font-bold text-sky-700">{effectiveUserEmail}</span>
                </div>
              </div>
            </div>

            {/* Mã kiểm chứng an toàn 2 số */}
            {verifyDigit && (
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider block">
                    Mã kiểm chứng an toàn
                  </span>
                  <span className="text-[11px] text-indigo-700">
                    Đối chiếu với 2 số trên màn hình máy kia:
                  </span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-mono text-xl font-black tracking-widest shadow-xs">
                  {verifyDigit}
                </div>
              </div>
            )}

            {/* Checkbox cam kết bắt buộc */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 bg-white cursor-pointer select-none text-xs text-slate-700 hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={isConfirmedRisk}
                onChange={(e) => setIsConfirmedRisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition cursor-pointer shrink-0"
              />
              <span className="font-bold leading-relaxed text-[11px] text-slate-800">
                Tôi cam kết đây là thiết bị của chính tôi và tôi đang trực tiếp sử dụng thiết bị này.
              </span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="w-1/2 py-3 rounded-2xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
              >
                Từ Chối (Không phải tôi)
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading || !isConfirmedRisk}
                className="w-1/2 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Xác Nhận Đăng Nhập</span>
              </button>
            </div>
          </div>
        )}

        {/* BƯỚC 3: HIỂN THỊ MÃ BẢO MẬT 6 SỐ ĐỂ MÁY A NHẬP TAY (CHALLENGE-RESPONSE) */}
        {mode === 'code_display' && generatedCompletionCode && (
          <div className="space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="inline-flex p-2 rounded-full bg-emerald-100 text-emerald-600 mb-1">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-emerald-900">ĐÃ PHÊ DUYỆT THIẾT BỊ!</h4>
              <p className="text-xs text-emerald-700">
                Vui lòng nhập mã số xác thực gồm 6 số dưới đây vào màn hình của thiết bị bạn muốn đăng nhập:
              </p>
            </div>

            {/* MÃ 6 SỐ HIỂN THỊ KHỔNG LỒ & RÕ NÉT */}
            <div className="p-4 rounded-3xl bg-slate-900 text-white shadow-xl relative overflow-hidden group">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                MÃ XÁC NHẬN BẢO MẬT 2 CHIỀU
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-4xl font-black tracking-[0.25em] text-amber-400 select-all">
                  {generatedCompletionCode.slice(0, 3)} {generatedCompletionCode.slice(3)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Sao chép mã"
                >
                  {isCopied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
                <span>Màn hình thiết bị kia đang chờ bạn nhập mã này</span>
              </div>
            </div>

            {/* Nút hoàn tất */}
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider shadow-md transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Đã Nhập Xong Trên Máy Kia (Đóng)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
