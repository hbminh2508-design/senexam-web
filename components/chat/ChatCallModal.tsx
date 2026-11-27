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
  Presentation,
  X,
} from 'lucide-react'
import type { RemoteTrack, Room } from 'livekit-client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { chatRequest } from '@/lib/senChatBrowser'
import { SEN_CHAT_THEME } from '@/lib/senChatTheme'
import ChatWhiteboard from './ChatWhiteboard'
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

export interface ChatCallInvitation extends CallSignalPayload {
  state: 'ringing' | 'accepted' | 'declined' | 'ended'
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

export interface ChatCallModalProps {
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

type PeerSignal =
  | { type: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }

function GroupVideo({ track }: { track: RemoteTrack }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [track])
  return <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
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
    'requesting'
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
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [whiteboardNotice, setWhiteboardNotice] = useState(false)
  const whiteboardOpen = useRef(false)
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
  const [groupVideos, setGroupVideos] = useState<Record<string, RemoteTrack>>({})
  const [audioBlocked, setAudioBlocked] = useState(false)
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

  const callIdRef = useRef(initialCallId || '')
  const groupRoomRef = useRef<Room | null>(null)
  const groupCallId = useRef<string | null>(null)
  const groupAudio = useRef(new Set<HTMLMediaElement>())
  const signalChannel = useRef<RealtimeChannel | null>(null)
  const ending = useRef(false)
  const mediaFlags = useRef({ micEnabled: true, cameraEnabled: initialCallMode === 'video', screenSharing: false })
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
  const attachLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element
    if (element) element.srcObject = screenStreamRef.current || localStreamRef.current
  }, [])
  const attachRemoteVideo = useCallback((element: HTMLVideoElement | null) => {
    remoteVideoRef.current = element
    if (element) element.srcObject = remoteStreamRef.current
  }, [])

  useEffect(() => {
    mediaFlags.current = { micEnabled: !isMicMuted, cameraEnabled: !isCameraOff, screenSharing: isScreenSharing }
    if (isGroup) setGroupParticipants((people) => [{ ...people[0], ...mediaFlags.current }, ...people.slice(1)])
  }, [isGroup, isMicMuted, isCameraOff, isScreenSharing])

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

      const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(async (error: unknown) => {
        if (!constraints.video) throw error
        const fallback = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio, video: false })
        setErrorBanner('Không thể mở camera. Cuộc gọi đang dùng micrô.')
        return fallback
      })
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
    const room = groupRoomRef.current
    groupRoomRef.current = null
    if (room) void room.disconnect()
    for (const element of groupAudio.current) element.remove()
    groupAudio.current.clear()
    remoteAudioRef.current?.remove()
    remoteAudioRef.current = null
    localStreamRef.current = null
    screenStreamRef.current = null
    peerConnectionRef.current = null
  }, [])

  const sendPeerSignal = useCallback(async (signal: PeerSignal) => {
    const status = await signalChannel.current?.send({
      type: 'broadcast', event: 'call_signal',
      payload: { senderId: currentUserId, receiverId: partnerId, signal },
    })
    if (status !== 'ok') throw new Error('Không thể gửi tín hiệu cuộc gọi.')
  }, [currentUserId, partnerId])

  const handleLeaveOrEndCall = useCallback(async (endForAll = false) => {
    if (ending.current) return
    ending.current = true
    try {
      if (isGroup && groupCallId.current) {
        await chatRequest('calls', { action: endForAll ? 'end_for_all' : 'leave', callId: groupCallId.current })
      } else if (!isGroup && callIdRef.current) {
        await chatRequest('call-alerts', { action: 'end', callId: callIdRef.current })
      }
    } catch (error) {
      if (endForAll) {
        setErrorBanner(error instanceof Error ? error.message : 'Không thể kết thúc cho toàn nhóm.')
        ending.current = false
        return
      }
    }
    cleanupCall()
    onClose()
  }, [isGroup, cleanupCall, onClose])

  useEffect(() => {
    let cancelled = false
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let poll: ReturnType<typeof setTimeout> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let readyChannel: RealtimeChannel | undefined
    let groupRoom: Room | undefined
    let groupStarted = false
    let peerConnected = false
    let peerAccepted = isIncoming
    let makingOffer = false
    let ignoreOffer = false
    const id = callIdRef.current || crypto.randomUUID()
    callIdRef.current = id

    const remoteEnded = (message: string) => {
      if (cancelled || ending.current) return
      ending.current = true
      setCallStatus('ended')
      setStatusMessage(message)
      cleanupCall()
      closeTimer = setTimeout(onClose, 900)
    }

    const validateGroup = async () => {
      try {
        const state = await chatRequest<{ ended?: boolean; remainingSeconds?: number }>('calls', {
          action: 'heartbeat', callId: groupCallId.current, ...mediaFlags.current,
        })
        if (state.ended) remoteEnded('Cuộc gọi nhóm đã kết thúc.')
        else if (typeof state.remainingSeconds === 'number') setRemainingSeconds(state.remainingSeconds)
      } catch (reason) {
        if (!cancelled) setErrorBanner(reason instanceof Error ? reason.message : 'Không thể cập nhật trạng thái gọi nhóm.')
      }
    }

    const initGroup = async () => {
      const data = await chatRequest<{
        callId: string; sfuToken: string; sfuUrl: string; joinedExisting: boolean
        maxParticipants: number; expiresAt?: string
      }>('calls', {
        action: 'start_or_join', conversationId, callType: initialCallMode, idempotencyKey: id,
        callId: isIncoming ? id : undefined, userName: currentUserName,
      })
      groupCallId.current = data.callId
      callIdRef.current = data.callId
      if (cancelled || ending.current) {
        if (!groupStarted) await chatRequest('calls', { action: 'leave', callId: data.callId }).catch(() => {})
        return
      }
      const { Room, RoomEvent, Track } = await import('livekit-client')
      if (cancelled || ending.current) return
      const room = new Room({ adaptiveStream: true, dynacast: true })
      groupRoom = room
      groupRoomRef.current = room
      const refreshParticipants = () => {
        if (cancelled || ending.current) return
        const people = Array.from(room.remoteParticipants.values()).map((person) => {
          const camera = person.getTrackPublication(Track.Source.Camera)
          const screen = person.getTrackPublication(Track.Source.ScreenShare)
          return {
            userId: person.identity, name: person.name || 'Thành viên', isSpeaking: person.isSpeaking,
            micEnabled: Boolean(person.getTrackPublication(Track.Source.Microphone) && !person.getTrackPublication(Track.Source.Microphone)?.isMuted),
            cameraEnabled: Boolean(camera && !camera.isMuted),
            screenSharing: Boolean(screen && !screen.isMuted),
          }
        })
        setGroupParticipants((previous) => [previous[0], ...people])
        setGroupVideos(Object.fromEntries(Array.from(room.remoteParticipants.values()).flatMap((person) => {
          const screen = person.getTrackPublication(Track.Source.ScreenShare)
          const camera = person.getTrackPublication(Track.Source.Camera)
          const track = (screen?.isMuted ? undefined : screen?.track) || (camera?.isMuted ? undefined : camera?.track)
          return track ? [[person.identity, track]] : []
        })))
      }
      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const element = track.attach()
            element.hidden = true
            groupAudio.current.add(element)
            document.body.append(element)
          }
          refreshParticipants()
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((element) => {
            groupAudio.current.delete(element)
            if (element instanceof HTMLAudioElement) element.remove()
          })
          refreshParticipants()
        })
        .on(RoomEvent.TrackPublished, refreshParticipants)
        .on(RoomEvent.TrackUnpublished, refreshParticipants)
        .on(RoomEvent.TrackMuted, refreshParticipants)
        .on(RoomEvent.TrackUnmuted, refreshParticipants)
        .on(RoomEvent.ParticipantConnected, (person) => {
          refreshParticipants()
          if (whiteboardOpen.current) {
            void room.localParticipant.publishData(new Uint8Array([1]), {
              reliable: true, topic: 'sen-whiteboard-open', destinationIdentities: [person.identity],
            }).catch(() => {})
          }
        })
        .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
        .on(RoomEvent.ActiveSpeakersChanged, refreshParticipants)
        .on(RoomEvent.DataReceived, (_data, participant, _kind, topic) => {
          if (participant && topic === 'sen-whiteboard-open' && !whiteboardOpen.current) setWhiteboardNotice(true)
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
        .on(RoomEvent.Reconnecting, () => {
          setCallStatus('reconnecting')
          setNetworkState('reconnecting')
          setStatusMessage('Đang kết nối lại phòng gọi nhóm')
        })
        .on(RoomEvent.Reconnected, () => {
          setCallStatus('connected')
          setNetworkState('good')
          refreshParticipants()
          void validateGroup()
        })
        .on(RoomEvent.Disconnected, () => {
          if (groupStarted && !cancelled && !ending.current) {
            void chatRequest('calls', { action: 'leave', callId: data.callId }).catch(() => {})
            remoteEnded('Đã mất kết nối với phòng gọi nhóm.')
          }
        })
      await room.connect(data.sfuUrl, data.sfuToken, { autoSubscribe: false })
      if (cancelled || ending.current) { await room.disconnect(); return }
      groupStarted = true
      setSfuConfigured(true)
      setMaxParticipants(data.maxParticipants)
      if (data.expiresAt) setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(data.expiresAt) - Date.now()) / 1000)))
      setCallStatus('connected')
      setStatusMessage('Đã kết nối cuộc gọi nhóm')
      refreshParticipants()
      heartbeat = setInterval(() => void validateGroup(), 8000)
      for (const person of room.remoteParticipants.values()) {
        for (const publication of person.audioTrackPublications.values()) publication.setSubscribed(true)
      }
      room.on(RoomEvent.TrackPublished, (publication) => {
        if (publication.kind === Track.Kind.Audio) publication.setSubscribed(true)
      })
      if (!data.joinedExisting && !isIncoming) {
        void chatRequest('call-alerts', { action: 'invite', callId: data.callId, conversationId, isGroup: true })
          .catch((reason) => { if (!cancelled) setErrorBanner(reason.message) })
      }
      const stream = await setupLocalMedia()
      if (cancelled || ending.current) { disposeMediaStream(stream); return }
      setIsMicMuted(!stream?.getAudioTracks().length)
      setIsCameraOff(!stream?.getVideoTracks().length)
      for (const track of stream?.getTracks() || []) {
        await room.localParticipant.publishTrack(track, {
          source: track.kind === 'audio' ? Track.Source.Microphone : Track.Source.Camera,
        })
      }
    }

    const initPeer = async () => {
      if (typeof RTCPeerConnection === 'undefined') throw new Error('Trình duyệt chưa hỗ trợ cuộc gọi WebRTC.')
      const config = getRtcConfiguration()
      const { iceServers } = await chatRequest<{ iceServers: RTCIceServer[] }>('call-alerts?ice')
        .catch(() => ({ iceServers: [] }))
      if (cancelled || ending.current) return
      const pc = new RTCPeerConnection({ ...config, iceServers: [...(config.iceServers || []), ...iceServers] })
      peerConnectionRef.current = pc
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.hidden = true
      document.body.append(audio)
      remoteAudioRef.current = audio
      const offer = async () => {
        if (!peerAccepted || makingOffer || pc.signalingState !== 'stable') return
        try {
          makingOffer = true
          await pc.setLocalDescription()
          if (pc.localDescription?.type === 'offer') await sendPeerSignal({ type: 'offer', sdp: pc.localDescription.toJSON() })
        } finally { makingOffer = false }
      }
      const failSignal = () => { if (!cancelled) setErrorBanner('Tín hiệu cuộc gọi gián đoạn. Hãy gọi lại nếu kết nối không phục hồi.') }
      pc.onnegotiationneeded = () => { if (peerConnected) void offer().catch(failSignal) }
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) void sendPeerSignal({ type: 'candidate', candidate: candidate.toJSON() }).catch(failSignal)
      }
      pc.ontrack = ({ track, streams }) => {
        const stream = streams[0] || remoteStreamRef.current || new MediaStream()
        if (!stream.getTrackById(track.id)) stream.addTrack(track)
        remoteStreamRef.current = stream
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream
          void remoteAudioRef.current.play().catch(() => setAudioBlocked(true))
        }
        if (track.kind === 'video') setHasRemoteVideo(true)
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          peerConnected = true
          clearTimeout(timeout)
          setCallStatus('connected')
          setNetworkState('good')
          setStatusMessage('Đã kết nối cuộc gọi')
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setNetworkState('reconnecting')
          setCallStatus('reconnecting')
          setStatusMessage('Đang kết nối lại cuộc gọi')
          if (!isIncoming) pc.restartIce()
        }
      }

      if (!isIncoming) {
        await chatRequest('call-alerts', { action: 'invite', callId: id, recipientId: partnerId, callMode: initialCallMode })
        if (cancelled || ending.current) {
          await chatRequest('call-alerts', { action: 'end', callId: id }).catch(() => {})
          return
        }
        setCallStatus('ringing')
        setStatusMessage('Đang chờ đối phương trả lời')
      }

      const auth = (await supabase.auth.getSession()).data.session
      if (!auth) throw new Error('Hãy đăng nhập để thực hiện cuộc gọi.')
      await supabase.realtime.setAuth(auth.access_token)
      if (cancelled || ending.current) return
      let signalQueue = Promise.resolve()
      readyChannel = supabase.channel('sen-call:' + id, { config: { private: true, broadcast: { ack: true } } })
        .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
          if (payload.senderId !== partnerId || payload.receiverId !== currentUserId) return
          const signal = payload.signal as PeerSignal
          signalQueue = signalQueue.then(async () => {
            if (cancelled || ending.current) return
            if (signal.type === 'candidate') {
              if (ignoreOffer) return
              if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate)
              else iceCandidateQueueRef.current.push(signal.candidate)
              return
            }
            if (signal.type !== 'offer' && signal.type !== 'answer') return
            const collision = signal.type === 'offer' && (makingOffer || pc.signalingState !== 'stable')
            ignoreOffer = collision && !isIncoming
            if (ignoreOffer) return
            await pc.setRemoteDescription(signal.sdp)
            for (const candidate of iceCandidateQueueRef.current.splice(0)) await pc.addIceCandidate(candidate).catch(() => {})
            if (signal.type === 'offer') {
              await pc.setLocalDescription()
              if (pc.localDescription?.type === 'answer') await sendPeerSignal({ type: 'answer', sdp: pc.localDescription.toJSON() })
            }
          }).catch(failSignal)
        })
      signalChannel.current = readyChannel
      const subscribed = new Promise<void>((resolve, reject) => {
        readyChannel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
          else if (status !== 'CLOSED') reject(new Error('Không thể kết nối kênh tín hiệu cuộc gọi.'))
        })
      })
      const [stream] = await Promise.all([setupLocalMedia(), subscribed])
      if (cancelled || ending.current) { disposeMediaStream(stream); return }
      if (!stream?.getAudioTracks().length) throw new Error('Hãy cho phép truy cập micrô để thực hiện cuộc gọi.')
      setIsCameraOff(!stream.getVideoTracks().length)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      if (!isIncoming && !stream.getVideoTracks().length) pc.addTransceiver('video', { direction: 'sendrecv' })

      const waitForConnection = () => {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          if (!peerConnected && !cancelled) {
            setCallStatus('ended')
            setErrorBanner('Chưa thể thiết lập âm thanh hoặc video. Hãy kiểm tra mạng rồi gọi lại.')
            void chatRequest('call-alerts', { action: 'end', callId: id }).catch(() => {})
            cleanupCall()
          }
        }, 30000)
      }
      if (isIncoming) {
        await chatRequest('call-alerts', { action: 'accept', callId: id })
        setStatusMessage('Đang thiết lập âm thanh và video')
        waitForConnection()
      }

      const syncState = async () => {
        if (cancelled || ending.current) return
        try {
          const { calls } = await chatRequest<{ calls: ChatCallInvitation[] }>('call-alerts?callId=' + id)
          if (cancelled || ending.current) return
          const call = calls[0]
          if (call?.state === 'declined' || call?.state === 'ended') {
            remoteEnded(call.state === 'declined' ? 'Đối phương đã từ chối cuộc gọi.' : 'Cuộc gọi đã kết thúc.')
            return
          }
          if (call?.state === 'ringing' && Date.parse(call.expiresAt) <= Date.now()) {
            setCallStatus('ended')
            setStatusMessage('Không có người trả lời')
            setErrorBanner('Không có người trả lời.')
            cleanupCall()
            return
          }
          if (call?.state === 'accepted' && !peerAccepted) {
            peerAccepted = true
            setStatusMessage('Đang thiết lập âm thanh và video')
            waitForConnection()
            await offer()
          }
        } catch { failSignal() }
        if (!cancelled && !ending.current) poll = setTimeout(syncState, peerConnected ? 2500 : 900)
      }
      void syncState()
    }

    void Promise.resolve().then(() => {
      if (!cancelled) return isGroup ? initGroup() : initPeer()
    }).catch((reason) => {
      if (cancelled || ending.current) return
      if (isGroup && groupCallId.current && !groupStarted) {
        void chatRequest('calls', { action: 'leave', callId: groupCallId.current }).catch(() => {})
        cleanupCall()
      } else if (!isGroup) {
        void chatRequest('call-alerts', { action: 'end', callId: id }).catch(() => {})
        cleanupCall()
      }
      if (!groupStarted) setCallStatus('ended')
      setErrorBanner(reason instanceof Error ? reason.message : 'Không thể kết nối cuộc gọi.')
    })

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      clearTimeout(poll)
      clearTimeout(timeout)
      clearTimeout(closeTimer)
      if (!ending.current) {
        if (groupStarted && groupCallId.current) void chatRequest('calls', { action: 'leave', callId: groupCallId.current }).catch(() => {})
        else if (readyChannel) void chatRequest('call-alerts', { action: 'end', callId: id }).catch(() => {})
      }
      if (readyChannel) void supabase.removeChannel(readyChannel)
      if (signalChannel.current === readyChannel) signalChannel.current = null
      if (groupRoom) void groupRoom.disconnect()
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
    if (groupRoomRef.current) {
      void groupRoomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted)
        .catch(() => { setIsMicMuted(!nextMuted); setErrorBanner('Không thể thay đổi micrô.') })
    }
  }

  const toggleWhiteboard = (open: boolean) => {
    whiteboardOpen.current = open
    setShowWhiteboard(open)
    setWhiteboardNotice(false)
    if (open) void groupRoomRef.current?.localParticipant.publishData(new Uint8Array([1]), {
      reliable: true, topic: 'sen-whiteboard-open',
    }).catch(() => {})
  }

  const setDirectVideoTrack = useCallback(async (track: MediaStreamTrack | null, stream?: MediaStream) => {
    const pc = peerConnectionRef.current
    if (!pc) return
    const video = pc.getTransceivers().find((entry) => entry.receiver.track.kind === 'video')
    if (video) {
      if (track && video.direction === 'recvonly') video.direction = 'sendrecv'
      if (track && stream) video.sender.setStreams?.(stream)
      await video.sender.replaceTrack(track)
    } else if (track && stream) {
      pc.addTrack(track, stream)
    }
  }, [])

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

      const room = groupRoomRef.current
      if (room) {
        const { Track } = await import('livekit-client')
        await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera })
      }
      await setDirectVideoTrack(videoTrack, localStreamRef.current)

      setActiveCallMode('video')
      setIsCameraOff(false)
      setStatusMessage('Đã bật camera trong cuộc gọi hiện tại')
    } catch (err: any) {
      setErrorBanner(`Không thể bật video: ${err?.message || 'Vui lòng cấp quyền camera'}`)
    }
  }

  // Bật / Tắt Camera
  const toggleCamera = async () => {
    if (!localStreamRef.current?.getVideoTracks().length) {
      await upgradeToVideoInPlace()
      return
    }
    const nextOff = !isCameraOff
    setIsCameraOff(nextOff)
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !nextOff
    })
    if (groupRoomRef.current) {
      await groupRoomRef.current.localParticipant.setCameraEnabled(!nextOff)
        .catch(() => { setIsCameraOff(!nextOff); setErrorBanner('Không thể thay đổi camera.') })
    }
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
      const room = groupRoomRef.current
      if (room) {
        const { Track } = await import('livekit-client')
        const published = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
        if (published) await published.replaceTrack(newTrack)
        else await room.localParticipant.publishTrack(newTrack, { source: Track.Source.Camera })
      }
      oldTracks.forEach((t) => {
        localStreamRef.current?.removeTrack(t)
        t.stop()
      })
      localStreamRef.current?.addTrack(newTrack)
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      if (localStreamRef.current) await setDirectVideoTrack(newTrack, localStreamRef.current)
    } catch {
      setErrorBanner('Thiết bị không hỗ trợ đổi camera trước/sau')
    }
  }

  // Chia sẻ màn hình + Tự động khôi phục camera khi dừng
  const stopScreenShareAndRestoreCamera = useCallback(async () => {
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0]
    if (screenTrack && groupRoomRef.current) await groupRoomRef.current.localParticipant.unpublishTrack(screenTrack)
    disposeMediaStream(screenStreamRef.current)
    screenStreamRef.current = null
    setIsScreenSharing(false)

    const localStream = localStreamRef.current
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
    await setDirectVideoTrack(localStream?.getVideoTracks()[0] || null, localStream || undefined)
  }, [setDirectVideoTrack])

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShareAndRestoreCamera().catch(() => setErrorBanner('Không thể dừng chia sẻ màn hình.'))
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
        void stopScreenShareAndRestoreCamera().catch(() => setErrorBanner('Không thể dừng chia sẻ màn hình.'))
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream
      }
      if (groupRoomRef.current) {
        const { Track } = await import('livekit-client')
        await groupRoomRef.current.localParticipant.publishTrack(screenTrack, { source: Track.Source.ScreenShare })
      }
      await setDirectVideoTrack(screenTrack, displayStream)
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
      if (groupRoomRef.current) {
        await groupRoomRef.current.switchActiveDevice('audiooutput', sinkId || 'default')
        return
      }
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
        activeSpeakerId: groupParticipants.find((participant) => participant.isSpeaking)?.userId || (isSpeakingLocal ? currentUserId : null),
        screenSharingUserId: groupParticipants.find((participant) => participant.screenSharing)?.userId || (isScreenSharing ? currentUserId : null),
        page: gridLayout.currentPage,
        pageSize: gridLayout.pageSize,
      }),
    [groupParticipants, pinnedUserId, isSpeakingLocal, currentUserId, isScreenSharing, gridLayout]
  )

  const visibleParticipants = useMemo(
    () => groupParticipants.filter((p) => visibleIds.includes(p.userId)),
    [groupParticipants, visibleIds]
  )

  useEffect(() => {
    const room = groupRoomRef.current
    if (!room) return
    for (const person of room.remoteParticipants.values()) {
      for (const publication of person.videoTrackPublications.values()) {
        const visible = !isMinimized && visibleIds.includes(person.identity)
        if (publication.isDesired !== visible) publication.setSubscribed(visible)
      }
    }
  }, [visibleIds, isMinimized])

  if (typeof document === 'undefined') return null

  // Thu nhỏ thành thẻ nổi để tiếp tục nhắn tin
  if (isMinimized) {
    return createPortal(
      <div
        className={`fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom,0px))] right-4 z-[9999] flex items-center gap-3 rounded-2xl border border-blue-500/40 bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl md:bottom-20 ${SEN_CHAT_THEME.surface.safeAreaBottom}`}
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
              <button type="button" aria-label={whiteboardNotice ? 'Bảng trắng đang được chia sẻ' : 'Bảng trắng'} aria-pressed={showWhiteboard} disabled={callStatus !== 'connected'}
                onClick={() => toggleWhiteboard(!showWhiteboard)}
                className={`relative flex items-center gap-1 rounded-xl bg-white/10 p-2 text-xs font-semibold text-white hover:bg-white/20 aria-pressed:bg-sky-600 disabled:opacity-40 ${whiteboardNotice ? 'ring-2 ring-amber-300' : ''}`}>
                <Presentation className="h-4 w-4" />
                <span className="hidden sm:inline">Bảng trắng</span>
              </button>
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
        {showWhiteboard && isGroup && groupCallId.current && (
          <ChatWhiteboard callId={groupCallId.current} userId={currentUserId} onClose={() => toggleWhiteboard(false)} />
        )}
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
                    {p.isLocal && (!isCameraOff || isScreenSharing) ? (
                      <video
                        ref={attachLocalVideo}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : groupVideos[p.userId] ? <GroupVideo track={groupVideos[p.userId]} /> : (
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
        ) : activeCallMode === 'video' || hasRemoteVideo ? (
          /* GIAO DIỆN VIDEO 1-1 TỐI ƯU: KHÔNG LỆCH AVATAR, KHÔNG CHE TÊN */
          <div className="relative w-full h-full flex items-center justify-center rounded-3xl overflow-hidden bg-slate-900/70 border border-white/10">
            <video
              ref={attachRemoteVideo}
              autoPlay
              playsInline
              muted
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
                ref={attachLocalVideo}
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
        {audioBlocked && <button type="button" className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold" onClick={() => {
          const play = groupRoomRef.current?.startAudio() || remoteAudioRef.current?.play()
          void play?.then(() => setAudioBlocked(false)).catch(() => {})
        }}>Bật âm thanh cuộc gọi</button>}
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
      <div role="alertdialog" aria-modal="true" aria-label="Cuộc gọi đến" className="w-full max-w-sm rounded-3xl bg-slate-900 border border-blue-500/30 text-white shadow-2xl p-6 flex flex-col items-center space-y-5 text-center">
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
