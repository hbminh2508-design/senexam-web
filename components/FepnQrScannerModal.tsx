'use client'

import React, { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'

interface FepnQrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userEmail: string
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
}: FepnQrScannerModalProps) {
  const [mode, setMode] = useState<'scan' | 'code' | 'confirm'>('code')
  const [codeInputValue, setCodeInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [targetToken, setTargetToken] = useState('')
  const [targetDevice, setTargetDevice] = useState<TargetDeviceInfo | null>(null)
  const [expiresSeconds, setExpiresSeconds] = useState(180)

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Khởi động Camera khi chuyển sang tab 'scan'
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

  const startCamera = async () => {
    setErrorMsg('')
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ mở camera trực tiếp. Vui lòng nhập mã 6 số!')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      setCameraStream(stream)
      setCameraActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err: any) {
      setCameraActive(false)
      setErrorMsg(err.message || 'Không thể truy cập camera. Vui lòng chuyển sang nhập mã 6 số.')
      setMode('code')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
    setCameraActive(false)
  }

  // Lấy thông tin thiết bị yêu cầu đăng nhập từ mã code / QR token
  const handleCheckTargetInfo = async (inputStr: string) => {
    const cleanStr = inputStr.trim().replace(/-/g, '')
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
      setExpiresSeconds(data.expiresInSeconds || 180)
      setMode('confirm')
      stopCamera()
    } catch (err: any) {
      setErrorMsg(err.message || 'Không tìm thấy thiết bị yêu cầu đăng nhập')
    } finally {
      setLoading(false)
    }
  }

  // Phê duyệt đăng nhập cho máy kia
  const handleApprove = async () => {
    if (!targetToken || !userId || !userEmail) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/fepn-auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          token: targetToken,
          userId,
          userEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Phê duyệt thất bại')
      }

      setSuccessMsg('🎉 Đã xác nhận đăng nhập thành công! Thiết bị kia đã được đăng nhập vào tài khoản của bạn.')
      setTimeout(() => {
        onClose()
        setSuccessMsg('')
        setMode('code')
        setCodeInputValue('')
        setTargetDevice(null)
      }, 2500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi phê duyệt đăng nhập')
    } finally {
      setLoading(false)
    }
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
              <h3 className="text-base font-black text-slate-900">
                Xác Thực Đăng Nhập Bằng QR
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Đăng nhập tức thì cho máy tính / thiết bị khác
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
        {mode !== 'confirm' && (
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
                    maxLength={7}
                    placeholder="VD: 849204"
                    value={codeInputValue}
                    onChange={(e) => setCodeInputValue(e.target.value.toUpperCase())}
                    className="w-full text-center tracking-[0.3em] font-mono text-xl font-black py-3 px-4 rounded-2xl border border-slate-200 bg-slate-50/70 focus:border-sky-500 focus:bg-white transition uppercase"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  Mã này xuất hiện ngay dưới mã QR trên màn hình đăng nhập của máy bạn muốn đăng nhập.
                </p>

                <button
                  type="submit"
                  disabled={loading || codeInputValue.trim().length < 6}
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
                  <div className="absolute bottom-3 left-0 right-0 text-center text-white/80 text-[11px] font-bold bg-black/40 py-1">
                    Hướng camera về phía mã QR trên màn hình máy kia
                  </div>
                </div>

                <div className="text-center">
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
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Yêu Cầu Đăng Nhập Thiết Bị Mới</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Chỉ bấm <strong>"Xác Nhận"</strong> nếu bạn đang đứng trước máy tính này. Không xác nhận cho bất kỳ ai khác!
              </p>
            </div>

            {/* Thẻ thông tin máy yêu cầu */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  {targetDevice.deviceType === 'mobile' ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <Laptop className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {targetDevice.browser} ({targetDevice.os})
                  </h4>
                  <span className="text-[11px] text-slate-500">Thiết bị đang yêu cầu truy cập</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="h-3 w-3" /> Địa chỉ IP:
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
                    <Globe className="h-3 w-3" /> Tài khoản cấp phép:
                  </span>
                  <span className="font-mono font-bold text-sky-700">{userEmail}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('code')
                  setTargetDevice(null)
                }}
                disabled={loading}
                className="w-1/3 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Xác Nhận Đăng Nhập</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
