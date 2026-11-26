'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  MonitorUp,
  MonitorOff,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Pin,
  PinOff,
  Users,
  LayoutGrid,
  UserCheck,
  Wifi,
  WifiOff,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { SEN_CHAT_THEME } from '@/lib/senChatTheme'
import { getCallDurationWarningLevel } from '@/lib/chatLimits'
import {
  getRtcConfiguration,
  getOptimalAudioConstraints,
  getOptimalVideoConstraints,
  computeCallGridLayout,
  selectVisibleVideoSubscriptions,
  getCallTransportInfo,
  disposeMediaStream,
  disposePeerConnection,
  type CallParticipantInfo,
} from '@/lib/senChatWebRtc'

export interface CallSignalPayload {
  callId: string
  conversationId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  receiverId: string
  callMode: 'voice' | 'video'
  isGroup?: boolean
  groupName?: string
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
  isGroup?: boolean
  userRole?: 'owner' | 'admin' | 'member'
  groupMembers?: Array<{ userId: string; name: string; avatar?: string }>
  onClose: () => void
}

export default function ChatCallModal({
  callMode: initialCallMode,
  isIncoming = false,
  initialCallId,
  conversationId,
  partnerId,
  partnerName,
  partnerAvatar,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isGroup = false,
  userRole = 'member',
  groupMembers = [],
  onClose,
}: ChatCallModalProps) {
  const [activeCallMode, setActiveCallMode] = useState<'voice' | 'video'>(initialCallMode)
  const [callStatus, setCallStatus] = useState<'requesting' | 'ringing' | 'connected' | 'reconnecting' | 'ended'>(
    isIncoming ? 'connected' : 'requesting'
  )
  const [callDuration, setCallDuration] = useState(0)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(initialCallMode === 'voice')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [statusMessage, setStatusMessage] = useState<string>(
    isIncoming ? 'Đang thiết lập kết nối bảo mật...' : isGroup ? 'Đang kết nối phòng gọi nhóm...' : 'Đang gọi đối phương...'
  )
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false)

  // Layout & Window controls
  const [isMinimized, setIsMinimized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'gallery' | 'speaker'>('gallery')
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null)
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false)
  const [showDeviceDrawer, setShowDeviceDrawer] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )
  const [networkState, setNetworkState] = useState<'good' | 'reconnecting' | 'offline'>('good')

  // Devices (Audio In/Out, Camera)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioIn, setSelectedAudioIn] = useState<string>('')
  const [selectedAudioOut, setSelectedAudioOut] = useState<string>('')
  const [selectedVideoIn, setSelectedVideoIn] = useState<string>('')

  // Group Call & Server Entitlements State
  const [sfuConfigured, setSfuConfigured] = useState(false)
  const [maxParticipants, setMaxParticipants] = useState<number>(isGroup ? 5 : 2)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [durationWarning, setDurationWarning] = useState<string | null>(null)
  const [joinLeaveNotice, setJoinLeaveNotice] = useState<string | null>(null)
  const [groupParticipants, setGroupParticipants] = useState<CallParticipantInfo[]>(() => [
    {
      userId: currentUserId,
      name: `${currentUserName} (Bạn)`,
      avatar: currentUserAvatar,
      roleInGroup: userRole,
      micEnabled: true,
      cameraEnabled: initialCallMode === 'video',
      isLocal: true,
    },
    ...(isGroup
      ? []
      : [
          {
            userId: partnerId,
            name: partnerName,
            avatar: partnerAvatar,
            micEnabled: true,
            cameraEnabled: initialCallMode === 'video',
            isLocal: false,
          },
        ]),
  ])

  const callIdRef = useRef<string>(
    initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  )
  const modalContainerRef = useRef<HTMLDivElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([])
  const dismissedWarningsRef = useRef<Set<number>>(new Set())

  const transportInfo = useMemo(
    () => getCallTransportInfo(isGroup, sfuConfigured),
    [isGroup, sfuConfigured]
  )

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Theo dõi resize màn hình cho Dynamic Grid
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    const onOnline = () => setNetworkState('good')
    const onOffline = () => {
      setNetworkState('offline')
      setStatusMessage('Mất kết nối mạng — đang chờ kết nối lại...')
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Đếm thời gian gọi + đếm ngược giới hạn gói (nếu có)
  useEffect(() => {
    if (callStatus !== 'connected') return
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1)
      setRemainingSeconds((prev) => {
        if (prev === null) return null
        const next = Math.max(0, prev - 1)
        const level = getCallDurationWarningLevel(next)
        if (level && !dismissedWarningsRef.current.has(level)) {
          dismissedWarningsRef.current.add(level)
          setDurationWarning(`Cuộc gọi nhóm sẽ tự động kết thúc sau ${level} phút theo hạn mức gói chủ nhóm.`)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [callStatus])

  // Liệt kê thiết bị Micro / Loa / Camera
  const refreshMediaDevices = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'))
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'))
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'))
    } catch {}
  }, [])

  // Visualizer + Active Speaker Detection
  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / (dataArray.length || 1)
        setIsSpeakingLocal(avg > 22)

        const canvas = canvasRef.current
        if (canvas) {
          const c = canvas.getContext('2d')
          if (c) {
            c.clearRect(0, 0, canvas.width, canvas.height)
            const barCount = 24
            const barWidth = Math.max(3, Math.floor(canvas.width / barCount) - 3)
            for (let i = 0; i < barCount; i++) {
              const v = dataArray[i % dataArray.length] / 255
              const h = Math.max(4, v * canvas.height * 0.9)
              const x = i * (barWidth + 3) + 6
              const y = (canvas.height - h) / 2
              c.fillStyle = '#0ea5e9'
              c.beginPath()
              if (c.roundRect) c.roundRect(x, y, barWidth, h, 3)
              else c.rect(x, y, barWidth, h)
              c.fill()
            }
          }
        }
        animationFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {}
  }, [])

  // Khởi tạo MediaStream cục bộ với Noise Suppression / Echo Cancellation / AGC
  const setupLocalMedia = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatusMessage('Trình duyệt không hỗ trợ WebRTC MediaDevices')
        return null
      }

      const constraints: MediaStreamConstraints = {
        audio: getOptimalAudioConstraints(selectedAudioIn || undefined),
        video:
          activeCallMode === 'video'
            ? getOptimalVideoConstraints(facingMode, selectedVideoIn || undefined)
            : false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      startAudioLevelMonitor(stream)
      refreshMediaDevices()
      return stream
    } catch (err: any) {
      setErrorBanner(`Không thể truy cập Micro/Camera: ${err?.message || 'Vui lòng cấp quyền thiết bị'}`)
      return null
    }
  }, [activeCallMode, facingMode, selectedAudioIn, selectedVideoIn, startAudioLevelMonitor, refreshMediaDevices])

  const cleanupCall = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    try {
      audioContextRef.current?.close()
    } catch {}
    disposeMediaStream(localStreamRef.current)
    disposeMediaStream(screenStreamRef.current)
    disposePeerConnection(peerConnectionRef.current)
    localStreamRef.current = null
    screenStreamRef.current = null
    peerConnectionRef.current = null
  }, [])

  // Rời hoặc kết thúc cuộc gọi
  const handleLeaveOrEndCall = useCallback(
    async (endForAll: boolean = false) => {
      setCallStatus('ended')
      setStatusMessage(endForAll ? 'Đã kết thúc cuộc gọi cho toàn nhóm' : 'Đã rời cuộc gọi')

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (isGroup && token) {
          await fetch('/api/chat/calls', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: endForAll ? 'end_for_all' : 'leave',
              callId: callIdRef.current,
              conversationId,
            }),
          }).catch(() => {})
        }

        if (!isGroup || endForAll) {
          await supabase.channel('sen-chat-realtime-transit').send({
            type: 'broadcast',
            event: 'call_end',
            payload: {
              callId: callIdRef.current,
              conversationId,
              senderId: currentUserId,
              receiverId: partnerId,
              endForAll,
            },
          })
        } else {
          await supabase.channel(`sen-chat-group-call:${conversationId}`).send({
            type: 'broadcast',
            event: 'group_call_presence',
            payload: {
              callId: callIdRef.current,
              userId: currentUserId,
              name: currentUserName,
              status: 'left',
            },
          })
        }
      } catch {}

      cleanupCall()
      setTimeout(() => {
        onClose()
      }, 350)
    },
    [isGroup, conversationId, currentUserId, currentUserName, partnerId, cleanupCall, onClose]
  )

  // Khởi tạo cuộc gọi (1-1 P2P hoặc Group SFU + Backend Enforcement)
  useEffect(() => {
    let isCancelled = false

    const startGroupCallBackend = async () => {
      if (!isGroup) return true
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) {
          setErrorBanner('Chưa xác thực tài khoản để gọi nhóm')
          return false
        }

        const res = await fetch('/api/chat/calls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'start_or_join',
            conversationId,
            callType: initialCallMode,
            idempotencyKey: callIdRef.current,
            userName: currentUserName,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) {
          setErrorBanner(data.error || 'Không thể khởi tạo cuộc gọi nhóm')
          setCallStatus('ended')
          return false
        }

        if (data.callId) callIdRef.current = data.callId
        setSfuConfigured(Boolean(data.sfuConfigured))
        if (data.maxParticipants) setMaxParticipants(data.maxParticipants)
        if (data.maxDurationSeconds) {
          const startedMs = data.startedAt ? new Date(data.startedAt).getTime() : Date.now()
          const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
          setRemainingSeconds(Math.max(0, data.maxDurationSeconds - elapsed))
        }
        setCallStatus('connected')
        setStatusMessage(
          data.sfuConfigured ? 'Đã kết nối phòng SFU' : 'Phòng gọi nhóm đang hoạt động (Realtime Signaling)'
        )
        return true
      } catch (err: any) {
        setErrorBanner(err?.message || 'Lỗi kết nối máy chủ cuộc gọi')
        return false
      }
    }

    let pc: RTCPeerConnection | null = null
    if (!isGroup && typeof RTCPeerConnection !== 'undefined') {
      try {
        pc = new RTCPeerConnection(getRtcConfiguration())
        peerConnectionRef.current = pc

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            supabase
              .channel('sen-chat-realtime-transit')
              .send({
                type: 'broadcast',
                event: 'call_signal',
                payload: {
                  callId: callIdRef.current,
                  conversationId,
                  senderId: currentUserId,
                  receiverId: partnerId,
                  signal: { type: 'candidate', candidate: event.candidate },
                },
              })
              .catch(() => {})
          }
        }

        pc.ontrack = (event) => {
          let stream = event.streams && event.streams[0]
          if (!stream) {
            if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream()
            remoteStreamRef.current.addTrack(event.track)
            stream = remoteStreamRef.current
          } else {
            remoteStreamRef.current = stream
          }
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
            remoteVideoRef.current.srcObject = stream
          }
          if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
            remoteAudioRef.current.srcObject = stream
          }
          if (event.track.kind === 'video') {
            setHasRemoteVideo(true)
          }
          setCallStatus('connected')
          setNetworkState('good')
          setStatusMessage('Đã kết nối mã hóa E2EE P2P')
        }

        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === 'connected') {
            setCallStatus('connected')
            setNetworkState('good')
            setStatusMessage('Đã kết nối mã hóa E2EE P2P')
          } else if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
            setNetworkState('reconnecting')
            setCallStatus('reconnecting')
            setStatusMessage('Kết nối gián đoạn — đang thực hiện ICE Restart...')
            try {
              pc.restartIce?.()
            } catch {}
          }
        }
      } catch {}
    }

    const transitChannel = supabase.channel('sen-chat-realtime-transit')
    const groupCallChannel = isGroup ? supabase.channel(`sen-chat-group-call:${conversationId}`) : null

    if (groupCallChannel) {
      groupCallChannel
        .on('broadcast', { event: 'group_call_presence' }, ({ payload }: any) => {
          if (!payload || payload.userId === currentUserId) return
          if (payload.status === 'joined') {
            setJoinLeaveNotice(`${payload.name || 'Thành viên'} đã tham gia cuộc gọi`)
            setGroupParticipants((prev) => {
              if (prev.some((p) => p.userId === payload.userId)) return prev
              return [
                ...prev,
                {
                  userId: payload.userId,
                  name: payload.name || 'Thành viên',
                  avatar: payload.avatar,
                  micEnabled: payload.micEnabled ?? true,
                  cameraEnabled: payload.cameraEnabled ?? false,
                  screenSharing: payload.screenSharing ?? false,
                },
              ]
            })
          } else if (payload.status === 'left') {
            setJoinLeaveNotice(`${payload.name || 'Thành viên'} đã rời cuộc gọi`)
            setGroupParticipants((prev) => prev.filter((p) => p.userId !== payload.userId))
          } else if (payload.status === 'media_update') {
            setGroupParticipants((prev) =>
              prev.map((p) =>
                p.userId === payload.userId
                  ? {
                      ...p,
                      micEnabled: payload.micEnabled ?? p.micEnabled,
                      cameraEnabled: payload.cameraEnabled ?? p.cameraEnabled,
                      screenSharing: payload.screenSharing ?? p.screenSharing,
                    }
                  : p
              )
            )
          }
        })
        .subscribe()
    }

    const init = async () => {
      const ok = await startGroupCallBackend()
      if (!ok || isCancelled) return

      const stream = await setupLocalMedia()
      if (isCancelled || !stream) return

      if (pc) {
        stream.getTracks().forEach((track) => {
          try {
            pc?.addTrack(track, stream)
          } catch {}
        })
      }

      if (!isGroup) {
        if (!isIncoming) {
          transitChannel
            .send({
              type: 'broadcast',
              event: 'call_request',
              payload: {
                callId: callIdRef.current,
                conversationId,
                callerId: currentUserId,
                callerName: currentUserName,
                callerAvatar: currentUserAvatar,
                receiverId: partnerId,
                callMode: initialCallMode,
              },
            })
            .catch(() => {})
          setStatusMessage('Đang đổ chuông đối phương...')
        } else {
          transitChannel
            .send({
              type: 'broadcast',
              event: 'call_response',
              payload: {
                callId: callIdRef.current,
                conversationId,
                senderId: currentUserId,
                callerId: partnerId,
                receiverId: partnerId,
                accepted: true,
              },
            })
            .catch(() => {})
          setCallStatus('connected')
        }
      } else if (groupCallChannel) {
        groupCallChannel
          .send({
            type: 'broadcast',
            event: 'group_call_presence',
            payload: {
              callId: callIdRef.current,
              userId: currentUserId,
              name: currentUserName,
              avatar: currentUserAvatar,
              status: 'joined',
              micEnabled: !isMicMuted,
              cameraEnabled: !isCameraOff,
            },
          })
          .catch(() => {})

        if (!isIncoming) {
          // Thông báo cuộc gọi nhóm cho các thành viên hợp lệ
          transitChannel
            .send({
              type: 'broadcast',
              event: 'call_request',
              payload: {
                callId: callIdRef.current,
                conversationId,
                callerId: currentUserId,
                callerName: currentUserName,
                callerAvatar: currentUserAvatar,
                receiverId: conversationId,
                callMode: initialCallMode,
                isGroup: true,
                groupName: partnerName,
              },
            })
            .catch(() => {})
        }
      }
    }

    init()

    // Lắng nghe signaling P2P & kết thúc cuộc gọi
    const signalSub = supabase
      .channel(`sen-chat-call-signaling:${callIdRef.current}`)
      .on('broadcast', { event: 'call_signal' }, async ({ payload }: any) => {
        if (!payload || payload.callId !== callIdRef.current || payload.senderId === currentUserId || !pc) return
        const { signal } = payload
        try {
          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            transitChannel
              .send({
                type: 'broadcast',
                event: 'call_signal',
                payload: {
                  callId: callIdRef.current,
                  conversationId,
                  senderId: currentUserId,
                  receiverId: partnerId,
                  signal: { type: 'answer', sdp: answer },
                },
              })
              .catch(() => {})
            while (iceCandidateQueueRef.current.length > 0) {
              const cand = iceCandidateQueueRef.current.shift()
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand))
            }
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            while (iceCandidateQueueRef.current.length > 0) {
              const cand = iceCandidateQueueRef.current.shift()
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand))
            }
          } else if (signal.type === 'candidate' && signal.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
            } else {
              iceCandidateQueueRef.current.push(signal.candidate)
            }
          }
        } catch {}
      })
      .on('broadcast', { event: 'call_response' }, async ({ payload }: any) => {
        if (!payload || payload.callId !== callIdRef.current) return
        if (!payload.accepted) {
          setStatusMessage('Đối phương đã từ chối cuộc gọi')
          setCallStatus('ended')
          setTimeout(onClose, 1200)
          return
        }
        if (pc && !isIncoming) {
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            transitChannel
              .send({
                type: 'broadcast',
                event: 'call_signal',
                payload: {
                  callId: callIdRef.current,
                  conversationId,
                  senderId: currentUserId,
                  receiverId: partnerId,
                  signal: { type: 'offer', sdp: offer },
                },
              })
              .catch(() => {})
          } catch {}
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }: any) => {
        if (!payload || payload.callId !== callIdRef.current) return
        if (!isGroup || payload.endForAll) {
          setCallStatus('ended')
          setStatusMessage(payload.endForAll ? 'Quản trị viên đã kết thúc cuộc gọi nhóm' : 'Cuộc gọi đã kết thúc')
          cleanupCall()
          setTimeout(onClose, 900)
        }
      })
      .subscribe()

    // Heartbeat định kỳ cho cuộc gọi nhóm (kiểm tra hết hạn từ server)
    const heartbeatTimer = isGroup
      ? setInterval(async () => {
          try {
            const { data: s } = await supabase.auth.getSession()
            const token = s.session?.access_token
            if (!token) return
            const hbRes = await fetch('/api/chat/calls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                action: 'heartbeat',
                callId: callIdRef.current,
                micEnabled: !isMicMuted,
                cameraEnabled: !isCameraOff,
                screenSharing: isScreenSharing,
              }),
            })
            const hbData = await hbRes.json().catch(() => ({}))
            if (hbData.ended) {
              setErrorBanner('Phiên gọi đã đạt giới hạn thời lượng và tự động kết thúc.')
              cleanupCall()
              setTimeout(onClose, 1800)
            } else if (typeof hbData.remainingSeconds === 'number') {
              setRemainingSeconds(hbData.remainingSeconds)
            }
          } catch {}
        }, 20000)
      : null

    return () => {
      isCancelled = true
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (groupCallChannel) supabase.removeChannel(groupCallChannel)
      supabase.removeChannel(signalSub)
      cleanupCall()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tự ẩn thông báo join/leave sau 3.5 giây
  useEffect(() => {
    if (!joinLeaveNotice) return
    const t = setTimeout(() => setJoinLeaveNotice(null), 3500)
    return () => clearTimeout(t)
  }, [joinLeaveNotice])

  // Bật / Tắt Microphone
  const toggleMic = () => {
    const nextMuted = !isMicMuted
    setIsMicMuted(nextMuted)
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted
    })
  }

  // Nâng cấp Cuộc gọi Âm thanh -> Video tại chỗ (không tạo phiên gọi mới, không tự bật cam đối phương)
  const upgradeToVideoInPlace = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorBanner('Thiết bị không hỗ trợ camera WebRTC')
        return
      }
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: getOptimalVideoConstraints(facingMode, selectedVideoIn || undefined),
      })
      const videoTrack = camStream.getVideoTracks()[0]
      if (!videoTrack) return

      if (!localStreamRef.current) localStreamRef.current = new MediaStream()
      localStreamRef.current.addTrack(videoTrack)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }

      const pc = peerConnectionRef.current
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(videoTrack)
        } else {
          pc.addTrack(videoTrack, localStreamRef.current)
          // Thương lượng lại kết nối trên phiên gọi hiện tại
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await supabase.channel('sen-chat-realtime-transit').send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              callId: callIdRef.current,
              conversationId,
              senderId: currentUserId,
              receiverId: partnerId,
              signal: { type: 'offer', sdp: offer },
            },
          })
        }
      }

      setActiveCallMode('video')
      setIsCameraOff(false)
      setStatusMessage('Đã bật camera trong cuộc gọi hiện tại')
    } catch (err: any) {
      setErrorBanner(`Không thể bật video: ${err?.message || 'Vui lòng cấp quyền camera'}`)
    }
  }

  // Bật / Tắt Camera
  const toggleCamera = async () => {
    if (activeCallMode === 'voice') {
      await upgradeToVideoInPlace()
      return
    }
    const nextOff = !isCameraOff
    setIsCameraOff(nextOff)
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !nextOff
    })
  }

  // Đổi Camera trước / sau trên di động
  const switchCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(nextFacing)
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: getOptimalVideoConstraints(nextFacing),
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      const oldTracks = localStreamRef.current?.getVideoTracks() || []
      oldTracks.forEach((t) => {
        localStreamRef.current?.removeTrack(t)
        t.stop()
      })
      localStreamRef.current?.addTrack(newTrack)
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
    } catch {
      setErrorBanner('Thiết bị không hỗ trợ đổi camera trước/sau')
    }
  }

  // Chia sẻ màn hình + Tự động khôi phục camera khi dừng
  const stopScreenShareAndRestoreCamera = useCallback(async () => {
    disposeMediaStream(screenStreamRef.current)
    screenStreamRef.current = null
    setIsScreenSharing(false)

    if (!isCameraOff && navigator.mediaDevices?.getUserMedia) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: getOptimalVideoConstraints(facingMode, selectedVideoIn || undefined),
        })
        const camTrack = camStream.getVideoTracks()[0]
        if (camTrack) {
          localStreamRef.current?.getVideoTracks().forEach((t) => {
            localStreamRef.current?.removeTrack(t)
            t.stop()
          })
          localStreamRef.current?.addTrack(camTrack)
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
          }
          const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(camTrack)
        }
      } catch {}
    }
  }, [isCameraOff, facingMode, selectedVideoIn])

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShareAndRestoreCamera()
      return
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        setErrorBanner('Trình duyệt hoặc thiết bị di động này chưa hỗ trợ chia sẻ màn hình trực tiếp.')
        return
      }
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = displayStream.getVideoTracks()[0]
      if (!screenTrack) return

      screenStreamRef.current = displayStream
      setIsScreenSharing(true)
      if (activeCallMode === 'voice') setActiveCallMode('video')

      screenTrack.onended = () => {
        stopScreenShareAndRestoreCamera()
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream
      }
      const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else if (peerConnectionRef.current) {
        peerConnectionRef.current.addTrack(screenTrack, displayStream)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setErrorBanner('Không thể bắt đầu chia sẻ màn hình.')
      }
    }
  }

  // Fullscreen & Picture-in-Picture
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && modalContainerRef.current?.requestFullscreen) {
        await modalContainerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      setErrorBanner('Trình duyệt không hỗ trợ chế độ toàn màn hình.')
    }
  }

  const togglePictureInPicture = async () => {
    try {
      const videoEl = remoteVideoRef.current || localVideoRef.current
      if (!videoEl || !document.pictureInPictureEnabled) {
        setErrorBanner('Trình duyệt chưa hỗ trợ Picture-in-Picture.')
        return
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoEl.requestPictureInPicture()
      }
    } catch {
      setErrorBanner('Không thể bật Picture-in-Picture (cần luồng video đang phát).')
    }
  }

  // Chọn thiết bị đầu vào / đầu ra
  const handleSelectAudioOutput = async (sinkId: string) => {
    setSelectedAudioOut(sinkId)
    try {
      const el = remoteAudioRef.current as any
      if (el && typeof el.setSinkId === 'function') {
        await el.setSinkId(sinkId)
      }
    } catch {
      setErrorBanner('Trình duyệt không hỗ trợ chuyển thiết bị loa đầu ra.')
    }
  }

  // Dynamic Grid Layout cho cuộc gọi nhóm
  const gridLayout = useMemo(
    () =>
      computeCallGridLayout({
        totalParticipants: groupParticipants.length,
        viewportWidth,
        viewMode,
        currentPage,
      }),
    [groupParticipants.length, viewportWidth, viewMode, currentPage]
  )

  const visibleIds = useMemo(
    () =>
      selectVisibleVideoSubscriptions(groupParticipants, {
        pinnedUserId,
        activeSpeakerId: isSpeakingLocal ? currentUserId : null,
        screenSharingUserId: isScreenSharing ? currentUserId : null,
        page: gridLayout.currentPage,
        pageSize: gridLayout.pageSize,
      }),
    [groupParticipants, pinnedUserId, isSpeakingLocal, currentUserId, isScreenSharing, gridLayout]
  )

  const visibleParticipants = useMemo(
    () => groupParticipants.filter((p) => visibleIds.includes(p.userId)),
    [groupParticipants, visibleIds]
  )

  if (typeof document === 'undefined') return null

  // Thu nhỏ thành thẻ nổi để tiếp tục nhắn tin
  if (isMinimized) {
    return createPortal(
      <div
        className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-3 rounded-2xl border border-blue-500/40 bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl ${SEN_CHAT_THEME.surface.safeAreaBottom}`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} font-bold text-white ${
            isSpeakingLocal ? SEN_CHAT_THEME.brand.speakingRing : ''
          }`}
        >
          {partnerName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold truncate max-w-[140px]">{partnerName}</p>
          <p className="text-[11px] font-mono text-sky-400">
            {callStatus === 'connected' ? formatDuration(callDuration) : statusMessage}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMic}
          className={`p-2 rounded-xl transition ${isMicMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 text-white'}`}
          title={isMicMuted ? 'Bật micro' : 'Tắt micro'}
        >
          {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold ${SEN_CHAT_THEME.brand.primaryButton}`}
        >
          Mở lại
        </button>
        <button
          type="button"
          onClick={() => handleLeaveOrEndCall(false)}
          className={`p-2 rounded-xl ${SEN_CHAT_THEME.semantic.dangerButton}`}
          title="Rời cuộc gọi"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>,
      document.body
    )
  }

  const content = (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-[9999] flex flex-col ${SEN_CHAT_THEME.surface.callSurface} ${SEN_CHAT_THEME.surface.safeAreaTop} ${SEN_CHAT_THEME.surface.safeAreaBottom} animate-in fade-in duration-200`}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Header gọn gàng, căn giữa chuẩn xác, không che khuất */}
      <header className="relative z-20 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/60 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${SEN_CHAT_THEME.semantic.connectedBadge}`}>
            {transportInfo.isE2eeP2p ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            <span className="truncate">{transportInfo.badgeText}</span>
          </span>
          {networkState === 'offline' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
              <WifiOff className="h-3 w-3" /> Mất mạng
            </span>
          ) : networkState === 'reconnecting' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <Wifi className="h-3 w-3 animate-pulse" /> Đang kết nối lại
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-sky-300">
              <Wifi className="h-3.5 w-3.5" /> Ổn định
            </span>
          )}
        </div>

        {/* Tên phòng & Thời gian ở trung tâm */}
        <div className="flex flex-col items-center text-center min-w-0">
          <h3 className="text-sm font-extrabold text-white truncate max-w-[180px] sm:max-w-xs">
            {partnerName}
          </h3>
          <div className="flex items-center gap-2 text-[11px] font-mono text-sky-300">
            <span>{callStatus === 'connected' ? formatDuration(callDuration) : statusMessage}</span>
            {remainingSeconds !== null && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                <Clock className="h-3 w-3" /> Còn {formatDuration(remainingSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Nút tiện ích góc phải */}
        <div className="flex items-center gap-1.5">
          {isGroup && (
            <>
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'gallery' ? 'speaker' : 'gallery'))}
                className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                title="Đổi chế độ xem Gallery / Speaker"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden md:inline">{viewMode === 'gallery' ? 'Lưới' : 'Người nói'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowParticipantsDrawer((v) => !v)}
                className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                title="Danh sách người tham gia"
              >
                <Users className="h-4 w-4" />
                <span>
                  {groupParticipants.length}/{maxParticipants}
                </span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowDeviceDrawer((v) => !v)}
            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            title="Chọn Micro / Loa / Camera"
          >
            <Sliders className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
            title="Thu nhỏ để tiếp tục nhắn tin"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Banners cảnh báo thời lượng / lỗi / thông báo tham gia */}
      <div className="relative z-20 flex flex-col items-center gap-1 px-4 pt-2 empty:hidden">
        {durationWarning && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{durationWarning}</span>
            <button type="button" onClick={() => setDurationWarning(null)} className="ml-1 opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {errorBanner && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-1.5 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorBanner}</span>
            <button type="button" onClick={() => setErrorBanner(null)} className="ml-1 opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {joinLeaveNotice && (
          <div className="rounded-full bg-blue-500/25 border border-sky-400/40 px-3 py-1 text-[11px] font-semibold text-sky-200">
            {joinLeaveNotice}
          </div>
        )}
      </div>

      {/* Main Stage */}
      <main className="relative flex-1 flex items-center justify-center overflow-hidden p-3 sm:p-5">
        {isGroup ? (
          /* GIAO DIỆN CUỘC GỌI NHÓM DYNAMIC GRID */
          <div className="w-full h-full flex flex-col gap-3">
            <div
              className="flex-1 grid gap-2.5 sm:gap-3 auto-rows-fr"
              style={{
                gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`,
              }}
            >
              {visibleParticipants.map((p) => {
                const isPinned = pinnedUserId === p.userId
                const isSpeaking = p.isLocal ? isSpeakingLocal : p.isSpeaking
                return (
                  <div
                    key={p.userId}
                    className={`relative flex flex-col items-center justify-center rounded-2xl bg-slate-900/80 border overflow-hidden p-3 transition ${
                      isSpeaking
                        ? 'border-sky-400 ring-2 ring-sky-400/50'
                        : isPinned
                        ? 'border-blue-500 ring-2 ring-blue-500/40'
                        : 'border-white/10'
                    }`}
                  >
                    {p.isLocal && !isCameraOff ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 z-10">
                        <div
                          className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} text-xl sm:text-2xl font-black text-white shadow-lg`}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            p.name.slice(0, 1).toUpperCase()
                          )}
                        </div>
                      </div>
                    )}

                    {/* Badge Tên & Trạng thái không bao giờ bị che */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2 rounded-xl bg-slate-950/75 px-2.5 py-1.5 backdrop-blur-sm">
                      <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.screenSharing && <MonitorUp className="h-3.5 w-3.5 text-sky-400" />}
                        {p.micEnabled ? (
                          <Mic className="h-3.5 w-3.5 text-sky-400" />
                        ) : (
                          <MicOff className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPinnedUserId(isPinned ? null : p.userId)}
                          className="p-0.5 text-slate-300 hover:text-sky-400 transition"
                          title={isPinned ? 'Bỏ ghim' : 'Ghim video'}
                        >
                          {isPinned ? <PinOff className="h-3.5 w-3.5 text-sky-400" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {gridLayout.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={gridLayout.currentPage === 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Trước
                </button>
                <span className="text-xs text-sky-200 font-mono">
                  Trang {gridLayout.currentPage + 1}/{gridLayout.totalPages}
                </span>
                <button
                  type="button"
                  disabled={gridLayout.currentPage >= gridLayout.totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(gridLayout.totalPages - 1, p + 1))}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  Sau <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : activeCallMode === 'video' ? (
          /* GIAO DIỆN VIDEO 1-1 TỐI ƯU: KHÔNG LỆCH AVATAR, KHÔNG CHE TÊN */
          <div className="relative w-full h-full flex items-center justify-center rounded-3xl overflow-hidden bg-slate-900/70 border border-white/10">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${hasRemoteVideo ? 'block' : 'hidden'}`}
            />

            {!hasRemoteVideo && (
              <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center z-10">
                <div className={`relative flex h-28 w-28 items-center justify-center rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} text-white text-4xl font-black shadow-2xl ring-4 ring-sky-400/30`}>
                  {partnerAvatar ? (
                    <img src={partnerAvatar} alt={partnerName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    partnerName.slice(0, 1).toUpperCase()
                  )}
                  <span className="absolute inset-0 rounded-full border-2 border-sky-400 animate-ping opacity-30" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">{partnerName}</h4>
                  <p className="text-xs text-sky-300 mt-1">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Local Camera PiP: Góc trên phải hoặc góc dưới phải có safe margin, không đè tên ở center */}
            <div className="absolute bottom-3 right-3 z-20 w-24 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-sky-400/40 shadow-2xl bg-slate-950">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraOff && !isScreenSharing ? 'hidden' : 'block'}`}
              />
              {isCameraOff && !isScreenSharing && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2 text-center">
                  <VideoOff className="h-5 w-5 text-slate-500 mb-1" />
                  <span className="text-[10px] font-bold">Camera tắt</span>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white truncate text-center">
                {isScreenSharing ? 'Đang chia sẻ màn hình' : 'Bạn'}
              </div>
            </div>
          </div>
        ) : (
          /* GIAO DIỆN GỌI ÂM THANH 1-1: CĂN GIỮA HOÀN HẢO + OCEAN BLUE SPEAKING RING */
          <div className="flex flex-col items-center justify-center space-y-5 z-10 w-full max-w-sm mx-auto text-center">
            <div
              className={`relative flex h-32 w-32 items-center justify-center rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} text-white text-4xl font-black shadow-2xl transition-all ${
                isSpeakingLocal ? 'ring-8 ring-sky-400/45 scale-105' : 'ring-4 ring-blue-500/25'
              }`}
            >
              {partnerAvatar ? (
                <img src={partnerAvatar} alt={partnerName} className="h-full w-full rounded-full object-cover" />
              ) : (
                partnerName.slice(0, 1).toUpperCase()
              )}
              <span className="absolute -inset-2 rounded-full border border-sky-400/40 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">{partnerName}</h3>
              <p className="text-xs text-sky-300 font-medium mt-1">{statusMessage}</p>
            </div>

            <div className="w-full h-14 flex items-center justify-center bg-white/5 rounded-2xl p-2 border border-white/10">
              <canvas ref={canvasRef} width={280} height={44} className="w-full h-full" />
            </div>
          </div>
        )}

        {/* Drawer Danh sách người tham gia (Cuộc gọi nhóm) */}
        {showParticipantsDrawer && isGroup && (
          <aside className="absolute top-3 right-3 bottom-3 z-30 w-72 rounded-2xl border border-white/15 bg-slate-950/90 p-4 backdrop-blur-xl flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Thành viên ({groupParticipants.length}/{maxParticipants})
              </h4>
              <button type="button" onClick={() => setShowParticipantsDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2">
              {groupParticipants.map((p) => (
                <div key={p.userId} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} flex items-center justify-center text-xs font-bold shrink-0`}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.micEnabled ? <Mic className="h-3.5 w-3.5 text-sky-400" /> : <MicOff className="h-3.5 w-3.5 text-rose-400" />}
                    {p.cameraEnabled ? <Video className="h-3.5 w-3.5 text-sky-400" /> : <VideoOff className="h-3.5 w-3.5 text-slate-500" />}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Drawer Chọn thiết bị Âm thanh & Camera */}
        {showDeviceDrawer && (
          <aside className="absolute top-3 right-3 z-30 w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-white/15 bg-slate-950/95 p-4 backdrop-blur-xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">Thiết bị Âm thanh & Hình ảnh</h4>
              <button type="button" onClick={() => setShowDeviceDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Microphone</label>
                <select
                  value={selectedAudioIn}
                  onChange={(e) => setSelectedAudioIn(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/15 px-2.5 py-2 text-white"
                >
                  <option value="">Mặc định hệ thống</option>
                  {audioInputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Micro ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Loa / Tai nghe</label>
                <select
                  value={selectedAudioOut}
                  onChange={(e) => handleSelectAudioOutput(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/15 px-2.5 py-2 text-white"
                >
                  <option value="">Mặc định hệ thống</option>
                  {audioOutputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Loa ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Camera</label>
                <select
                  value={selectedVideoIn}
                  onChange={(e) => setSelectedVideoIn(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/15 px-2.5 py-2 text-white"
                >
                  <option value="">Mặc định hệ thống</option>
                  {videoInputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Footer Điều khiển đầy đủ tính năng */}
      <footer className="relative z-20 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 px-4 py-4 bg-slate-950/75 border-t border-white/10 backdrop-blur-md">
        <button
          type="button"
          onClick={toggleMic}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95 ${
            isMicMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
          }`}
          title={isMicMuted ? 'Bật micro' : 'Tắt micro'}
        >
          {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Nút Bật/Tắt Camera hoặc Chuyển từ Âm thanh -> Video tại chỗ */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`flex h-12 px-3.5 items-center justify-center gap-1.5 rounded-2xl transition active:scale-95 text-xs font-bold ${
            activeCallMode === 'voice'
              ? 'bg-blue-600/30 text-sky-200 hover:bg-blue-600/50 border border-sky-400/30'
              : isCameraOff
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
          }`}
          title={activeCallMode === 'voice' ? 'Chuyển sang gọi Video' : isCameraOff ? 'Bật camera' : 'Tắt camera'}
        >
          {activeCallMode === 'voice' ? (
            <>
              <Video className="h-5 w-5" />
              <span className="hidden sm:inline">Bật Video</span>
            </>
          ) : isCameraOff ? (
            <VideoOff className="h-5 w-5" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </button>

        {activeCallMode === 'video' && (
          <button
            type="button"
            onClick={switchCameraFacing}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition active:scale-95"
            title="Đổi camera trước/sau"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleScreenShare}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95 ${
            isScreenSharing
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
          }`}
          title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </button>

        {activeCallMode === 'video' && (
          <button
            type="button"
            onClick={togglePictureInPicture}
            className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition active:scale-95"
            title="Picture-in-Picture"
          >
            <PictureInPicture2 className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => handleLeaveOrEndCall(false)}
          className={`flex h-12 px-5 items-center justify-center gap-2 rounded-2xl font-bold text-xs transition active:scale-95 ${SEN_CHAT_THEME.semantic.dangerButton}`}
          title={isGroup ? 'Rời khỏi cuộc gọi' : 'Kết thúc cuộc gọi'}
        >
          <PhoneOff className="h-5 w-5" />
          <span>{isGroup ? 'Rời' : 'Kết thúc'}</span>
        </button>

        {isGroup && (userRole === 'owner' || userRole === 'admin') && (
          <button
            type="button"
            onClick={() => handleLeaveOrEndCall(true)}
            className="flex h-12 px-4 items-center justify-center gap-1.5 rounded-2xl bg-rose-800 hover:bg-rose-900 text-white font-bold text-xs border border-rose-400/30 transition active:scale-95"
            title="Kết thúc cuộc gọi cho tất cả thành viên"
          >
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Kết thúc nhóm</span>
          </button>
        )}
      </footer>
    </div>
  )

  return createPortal(content, document.body)
}

/**
 * Hộp thoại thông báo cuộc gọi đến (Ocean Blue Brand)
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
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-blue-500/30 text-white shadow-2xl p-6 flex flex-col items-center space-y-5 text-center">
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-full ${SEN_CHAT_THEME.brand.avatarGradient} text-white text-2xl font-black ring-4 ring-sky-400/35 shadow-xl`}>
          {payload.callerAvatar ? (
            <img src={payload.callerAvatar} alt={payload.callerName} className="h-full w-full rounded-full object-cover" />
          ) : (
            payload.callerName?.slice(0, 1)?.toUpperCase() || 'S'
          )}
          <span className="absolute inset-0 rounded-full border-2 border-sky-400 animate-ping opacity-40" />
        </div>

        <div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${SEN_CHAT_THEME.brand.badgeSoft}`}>
            <Lock className="h-3 w-3" /> {payload.isGroup ? 'Cuộc gọi nhóm Sen Chat' : 'E2EE WebRTC'}
          </span>
          <h3 className="text-base font-black text-white mt-2">
            {payload.isGroup ? payload.groupName || 'Nhóm Sen Chat' : payload.callerName || 'Người dùng Sen Chat'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {payload.isGroup
              ? `${payload.callerName} đang mời tham gia cuộc gọi ${payload.callMode === 'video' ? 'video' : 'thoại'} nhóm...`
              : `Đang gọi ${payload.callMode === 'video' ? 'video' : 'thoại'} cho bạn...`}
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 w-full pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold text-xs transition active:scale-95"
          >
            <PhoneOff className="h-4 w-4" />
            <span>Từ chối</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs transition active:scale-95 animate-pulse ${SEN_CHAT_THEME.brand.primaryButton}`}
          >
            {payload.callMode === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            <span>Trả lời</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
