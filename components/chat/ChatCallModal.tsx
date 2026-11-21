'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  ShieldCheck,
  Lock,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export interface CallSignalPayload {
  callId: string
  conversationId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  receiverId: string
  callMode: 'voice' | 'video'
}

interface ChatCallModalProps {
  callMode: 'voice' | 'video'
  isIncoming?: boolean
  initialCallId?: string
  conversationId: string
  partnerId: string
  partnerName: string
  partnerAvatar?: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  onClose: () => void
}

export default function ChatCallModal({
  callMode,
  isIncoming = false,
  initialCallId,
  conversationId,
  partnerId,
  partnerName,
  partnerAvatar,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onClose,
}: ChatCallModalProps) {
  const [callStatus, setCallStatus] = useState<'requesting' | 'ringing' | 'connected' | 'ended'>(
    isIncoming ? 'connected' : 'requesting'
  )
  const [callDuration, setCallDuration] = useState(0)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(callMode === 'voice')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [statusMessage, setStatusMessage] = useState<string>(
    isIncoming ? 'Đang thiết lập kết nối WebRTC E2EE...' : 'Đang gọi đối phương...'
  )
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)

  const callIdRef = useRef<string>(
    initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  )
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Định dạng thời gian cuộc gọi mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Đếm thời gian khi cuộc gọi đã kết nối
  useEffect(() => {
    if (callStatus !== 'connected') return
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [callStatus])

  // Khởi tạo MediaStream cục bộ (Mic & Camera)
  const setupLocalMedia = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatusMessage('Trình duyệt không hỗ trợ WebRTC MediaDevices')
        return null
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callMode === 'video'
            ? {
                facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream

      if (localVideoRef.current && callMode === 'video') {
        localVideoRef.current.srcObject = stream
      }

      // Khởi tạo visualizer âm thanh nếu là gọi thoại
      if (callMode === 'voice') {
        try {
          const AudioContextClass =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          if (AudioContextClass) {
            const ctx = new AudioContextClass()
            audioContextRef.current = ctx
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 64
            source.connect(analyser)

            const canvas = canvasRef.current
            if (canvas) {
              const canvasCtx = canvas.getContext('2d')
              const bufferLength = analyser.frequencyBinCount
              const dataArray = new Uint8Array(bufferLength)

              const draw = () => {
                animationFrameRef.current = requestAnimationFrame(draw)
                analyser.getByteFrequencyData(dataArray)
                if (!canvasCtx) return

                canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
                const barWidth = (canvas.width / bufferLength) * 2.2
                let x = 0

                for (let i = 0; i < bufferLength; i++) {
                  const barHeight = (dataArray[i] / 255) * (canvas.height / 1.5)
                  canvasCtx.fillStyle = '#10b981'
                  canvasCtx.beginPath()
                  canvasCtx.roundRect(
                    x,
                    canvas.height / 2 - barHeight / 2,
                    barWidth - 2,
                    Math.max(4, barHeight),
                    4
                  )
                  canvasCtx.fill()
                  x += barWidth
                }
              }
              draw()
            }
          }
        } catch (audioErr) {
          console.warn('[WEBRTC_CALL] Lỗi setup AudioContext Visualizer:', audioErr)
        }
      }

      return stream
    } catch (err: unknown) {
      console.warn('[WEBRTC_CALL] Không thể truy cập micro/camera:', err)
      const errName = err instanceof Error ? err.name : ''
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setStatusMessage('Quyền truy cập micro/camera đã bị từ chối.')
      } else if (errName === 'NotFoundError') {
        setStatusMessage('Không tìm thấy thiết bị micro hoặc camera.')
      } else {
        setStatusMessage('Không thể kích hoạt thiết bị âm thanh/hình ảnh.')
      }
      return null
    }
  }, [callMode, facingMode])

  // Dọn dẹp tài nguyên cuộc gọi
  const cleanupCall = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
  }, [])

  // Kết thúc cuộc gọi
  const handleEndCall = useCallback(() => {
    setCallStatus('ended')
    setStatusMessage('Cuộc gọi đã kết thúc')

    // Bắn tín hiệu call_end qua Supabase Realtime
    supabase.channel('sen-chat-realtime-transit').send({
      type: 'broadcast',
      event: 'call_end',
      payload: {
        callId: callIdRef.current,
        conversationId,
        senderId: currentUserId,
        receiverId: partnerId,
      },
    }).catch(() => {})

    cleanupCall()
    setTimeout(() => {
      onClose()
    }, 800)
  }, [conversationId, currentUserId, partnerId, onClose, cleanupCall])

  // Thiết lập RTCPeerConnection và Signaling
  useEffect(() => {
    let isCancelled = false

    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    }

    let pc: RTCPeerConnection | null = null
    try {
      if (typeof RTCPeerConnection !== 'undefined') {
        pc = new RTCPeerConnection(rtcConfig)
        peerConnectionRef.current = pc

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            supabase.channel('sen-chat-realtime-transit').send({
              type: 'broadcast',
              event: 'call_signal',
              payload: {
                callId: callIdRef.current,
                conversationId,
                senderId: currentUserId,
                receiverId: partnerId,
                signal: {
                  type: 'candidate',
                  candidate: event.candidate,
                },
              },
            }).catch(() => {})
          }
        }

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            remoteStreamRef.current = event.streams[0]
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0]
            }
            if (event.track.kind === 'video') {
              setHasRemoteVideo(true)
            }
            setCallStatus('connected')
            setStatusMessage('Đã kết nối mã hóa E2EE P2P')
          }
        }

        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === 'connected') {
            setCallStatus('connected')
            setStatusMessage('Đã kết nối mã hóa E2EE P2P')
          } else if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
            setStatusMessage('Kết nối gián đoạn')
          }
        }
      }
    } catch (pcErr) {
      console.warn('[WEBRTC_CALL] Lỗi tạo RTCPeerConnection:', pcErr)
    }

    // Khởi tạo stream và thêm track vào RTCPeerConnection
    setupLocalMedia().then((stream) => {
      if (isCancelled || !stream || !pc) return
      stream.getTracks().forEach((track) => {
        try {
          pc?.addTrack(track, stream)
        } catch {}
      })

      // Nếu là người gọi, gửi call_request tới đối phương
      if (!isIncoming) {
        supabase.channel('sen-chat-realtime-transit').send({
          type: 'broadcast',
          event: 'call_request',
          payload: {
            callId: callIdRef.current,
            conversationId,
            callerId: currentUserId,
            callerName: currentUserName,
            callerAvatar: currentUserAvatar,
            receiverId: partnerId,
            callMode,
          },
        }).catch(() => {})
        setStatusMessage('Đang đổ chuông đối phương...')
      } else {
        // Nếu là người nhận, gửi call_response accepted và tạo WebRTC Offer
        supabase.channel('sen-chat-realtime-transit').send({
          type: 'broadcast',
          event: 'call_response',
          payload: {
            callId: callIdRef.current,
            conversationId,
            callerId: partnerId,
            receiverId: currentUserId,
            accepted: true,
          },
        }).catch(() => {})
        setCallStatus('connected')
        setStatusMessage('Đang đồng bộ luồng mã hóa...')
      }
    })

    // Lắng nghe tín hiệu Signaling từ Realtime channel
    const channel = supabase.channel('sen-chat-realtime-transit')

    const responseSub = channel.on('broadcast', { event: 'call_response' }, async ({ payload }) => {
      if (!payload || payload.callId !== callIdRef.current) return
      if (payload.receiverId !== currentUserId) return

      if (payload.accepted) {
        setCallStatus('connected')
        setStatusMessage('Đã nhận cuộc gọi. Đang đồng bộ WebRTC...')
        // Caller tạo offer
        if (pc && pc.signalingState !== 'closed') {
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            channel.send({
              type: 'broadcast',
              event: 'call_signal',
              payload: {
                callId: callIdRef.current,
                conversationId,
                senderId: currentUserId,
                receiverId: partnerId,
                signal: {
                  type: 'offer',
                  sdp: offer,
                },
              },
            }).catch(() => {})
          } catch (offerErr) {
            console.error('[WEBRTC_CALL] Lỗi tạo offer:', offerErr)
          }
        }
      } else {
        setStatusMessage('Đối phương đã từ chối cuộc gọi')
        setCallStatus('ended')
        setTimeout(() => onClose(), 1500)
      }
    })

    const signalSub = channel.on('broadcast', { event: 'call_signal' }, async ({ payload }) => {
      if (!payload || payload.callId !== callIdRef.current) return
      if (payload.receiverId !== currentUserId) return

      const signal = payload.signal
      if (!pc || pc.signalingState === 'closed') return

      try {
        if (signal.type === 'offer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              callId: callIdRef.current,
              conversationId,
              senderId: currentUserId,
              receiverId: partnerId,
              signal: {
                type: 'answer',
                sdp: answer,
              },
            },
          }).catch(() => {})
          setCallStatus('connected')
        } else if (signal.type === 'answer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
          setCallStatus('connected')
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        }
      } catch (sigErr) {
        console.warn('[WEBRTC_CALL] Lỗi xử lý signal WebRTC:', sigErr)
      }
    })

    const endSub = channel.on('broadcast', { event: 'call_end' }, ({ payload }) => {
      if (!payload || payload.callId !== callIdRef.current) return
      setStatusMessage('Đối phương đã kết thúc cuộc gọi')
      setCallStatus('ended')
      cleanupCall()
      setTimeout(() => onClose(), 1200)
    })

    // Timeout nếu đối phương không nghe máy sau 45s
    const callTimeout = setTimeout(() => {
      if (callStatus === 'requesting' || callStatus === 'ringing') {
        setStatusMessage('Đối phương không trả lời')
        setCallStatus('ended')
        setTimeout(() => onClose(), 1500)
      }
    }, 45000)

    return () => {
      isCancelled = true
      clearTimeout(callTimeout)
      cleanupCall()
    }
  }, [
    callMode,
    conversationId,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    partnerId,
    isIncoming,
    setupLocalMedia,
    cleanupCall,
    onClose,
  ])

  // Bật/tắt Micro
  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMicMuted(!audioTrack.enabled)
    } else {
      setIsMicMuted(!isMicMuted)
    }
  }

  // Bật/tắt Camera
  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsCameraOff(!videoTrack.enabled)
    } else {
      setIsCameraOff(!isCameraOff)
    }
  }

  // Đổi Camera trước / sau trên thiết bị di động
  const switchCameraFacing = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)

    if (localStreamRef.current && callMode === 'video') {
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
      if (oldVideoTrack) oldVideoTrack.stop()

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
        })
        const newVideoTrack = newStream.getVideoTracks()[0]
        if (newVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack)
          localStreamRef.current.addTrack(newVideoTrack)

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
          }

          // Thay thế sender track trong RTCPeerConnection
          const sender = peerConnectionRef.current
            ?.getSenders()
            .find((s) => s.track && s.track.kind === 'video')
          if (sender) {
            sender.replaceTrack(newVideoTrack)
          }
        }
      } catch (err) {
        console.warn('[WEBRTC_CALL] Lỗi chuyển đổi camera:', err)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
      <div className="relative flex flex-col w-full max-w-2xl h-[92vh] sm:h-[680px] rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="relative z-20 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
              <Lock className="h-3 w-3" />
              <span>Mã hóa WebRTC E2EE P2P</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
              {formatDuration(callDuration)}
            </div>
          </div>
        </div>

        {/* Khung Hiển Thị Chính */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
          {callMode === 'video' ? (
            <>
              {/* Remote Video Stream */}
              <div className="absolute inset-0 w-full h-full bg-slate-900 flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {!hasRemoteVideo && (
                  <div className="flex flex-col items-center space-y-3 z-10">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-3xl font-black shadow-2xl ring-4 ring-white/10">
                      {partnerAvatar ? (
                        <img
                          src={partnerAvatar}
                          alt={partnerName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        partnerName.slice(0, 1).toUpperCase()
                      )}
                      <span className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-30" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-base font-black text-white">{partnerName}</h4>
                      <p className="text-xs text-slate-400 mt-1">{statusMessage}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Local Video Stream PiP (Góc phải thu nhỏ) */}
              <div className="absolute bottom-4 right-4 z-20 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`}
                />
                {isCameraOff && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2 text-center">
                    <VideoOff className="h-6 w-6 text-slate-500 mb-1" />
                    <span className="text-[10px] font-bold">Camera tắt</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Voice Call View (Giao diện sóng âm & Avatar) */
            <div className="flex flex-col items-center justify-center space-y-6 z-10 w-full max-w-sm">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white text-4xl font-black shadow-2xl ring-8 ring-emerald-500/20">
                {partnerAvatar ? (
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  partnerName.slice(0, 1).toUpperCase()
                )}
                <span className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-pulse" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-black text-white">{partnerName}</h3>
                <p className="text-xs text-emerald-400 font-medium mt-1">{statusMessage}</p>
              </div>

              {/* Waveform Visualizer Canvas */}
              <div className="w-full h-16 flex items-center justify-center bg-white/5 rounded-2xl p-2 border border-white/10">
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={50}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: Bộ Điều Khiển Cuộc Gọi */}
        <div className="relative z-20 flex items-center justify-center gap-3 sm:gap-4 px-6 py-5 bg-gradient-to-t from-black/90 to-transparent">
          {/* Nút bật/tắt Micro */}
          <button
            type="button"
            onClick={toggleMic}
            className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl transition active:scale-95 shadow-lg ${
              isMicMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
            title={isMicMuted ? 'Bật micro' : 'Tắt micro'}
          >
            {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Nút bật/tắt Camera (chỉ cho Video Call) */}
          {callMode === 'video' && (
            <button
              type="button"
              onClick={toggleCamera}
              className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl transition active:scale-95 shadow-lg ${
                isCameraOff
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
              }`}
              title={isCameraOff ? 'Bật camera' : 'Tắt camera'}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          )}

          {/* Nút lật camera trước/sau (cho mobile video call) */}
          {callMode === 'video' && (
            <button
              type="button"
              onClick={switchCameraFacing}
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition active:scale-95 shadow-lg"
              title="Đổi camera trước/sau"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}

          {/* Nút Kết Thúc Cuộc Gọi (Đỏ) */}
          <button
            type="button"
            onClick={handleEndCall}
            className="flex h-12 w-16 sm:h-14 sm:w-20 items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95 shadow-xl shadow-rose-600/30 font-bold"
            title="Kết thúc cuộc gọi"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hộp thoại thông báo cuộc gọi đến (Incoming Call Notification Dialog)
 */
export function ChatIncomingCallDialog({
  payload,
  onAccept,
  onDecline,
}: {
  payload: CallSignalPayload
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl p-6 flex flex-col items-center space-y-5 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-2xl font-black ring-4 ring-emerald-500/30 shadow-xl">
          {payload.callerAvatar ? (
            <img
              src={payload.callerAvatar}
              alt={payload.callerName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            payload.callerName?.slice(0, 1)?.toUpperCase() || 'B'
          )}
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
            <Lock className="h-3 w-3" /> E2EE WebRTC
          </span>
          <h3 className="text-base font-black text-white mt-2">
            {payload.callerName || 'Người dùng Sen Chat'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Đang gọi {payload.callMode === 'video' ? 'video' : 'thoại'} cho bạn...
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 w-full pt-2">
          {/* Nút từ chối */}
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold text-xs transition active:scale-95"
          >
            <PhoneOff className="h-4 w-4" />
            <span>Từ chối</span>
          </button>

          {/* Nút trả lời */}
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition active:scale-95 animate-pulse"
          >
            {payload.callMode === 'video' ? (
              <Video className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            <span>Trả lời</span>
          </button>
        </div>
      </div>
    </div>
  )
}
