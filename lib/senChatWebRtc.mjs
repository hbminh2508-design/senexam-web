/**
 * Sen Chat WebRTC & SFU Architecture Utilities (v1.1.0)
 * - 1-1: P2P WebRTC với ICE Restart, STUN/TURN fallback, Audio DSP (EC/NS/AGC)
 * - Nhóm (20–200 người): Kiến trúc SFU (LiveKit-compatible), Selective Video Subscription,
 *   Dynamic Grid Layout (tối đa 16 tile hiển thị đồng thời), Active Speaker Priority.
 */

/** @returns {RTCConfiguration} */
export function getRtcConfiguration() {
  /** @type {RTCIceServer[]} */
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]

  const turnUrlsRaw =
    typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_TURN_URLS : ''
  const turnUser =
    typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_TURN_USERNAME : ''
  const turnPass =
    typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_TURN_CREDENTIAL : ''

  if (turnUrlsRaw) {
    const urls = turnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
    if (urls.length > 0) {
      iceServers.push({
        urls,
        ...(turnUser ? { username: turnUser } : {}),
        ...(turnPass ? { credential: turnPass } : {}),
      })
    }
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  }
}

export function getOptimalAudioConstraints(deviceId) {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  }
}

export function getOptimalVideoConstraints(facingMode = 'user', deviceId) {
  return {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 24, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode }),
  }
}

/**
 * Tính toán lưới hiển thị động (Dynamic Grid Layout) cho cuộc gọi nhóm:
 * - 2 người: split / PiP
 * - 3–4 người: 2x2
 * - 5–9 người: tối đa 3x3 (Mobile co về 2 cột)
 * - 10–16 người: tối đa 4x4 trên desktop, co linh hoạt trên mobile
 * - >16 người: phân trang tối đa 16 video/trang, ưu tiên người đang nói
 */
export function computeCallGridLayout({
  totalParticipants,
  viewportWidth = 1280,
  viewMode = 'gallery',
  currentPage = 0,
}) {
  const count = Math.max(1, totalParticipants || 1)
  const isMobile = viewportWidth < 640
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024

  if (viewMode === 'speaker') {
    return {
      mode: 'speaker',
      columns: 1,
      pageSize: Math.min(count, isMobile ? 4 : 6),
      totalPages: 1,
      currentPage: 0,
      maxRenderedVideos: isMobile ? 4 : 6,
    }
  }

  const pageSize = 16
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1)
  const visibleOnPage =
    safePage === totalPages - 1 ? count - safePage * pageSize : pageSize

  let columns = 1
  if (visibleOnPage <= 1) {
    columns = 1
  } else if (visibleOnPage === 2) {
    columns = isMobile ? 1 : 2
  } else if (visibleOnPage <= 4) {
    columns = 2
  } else if (visibleOnPage <= 9) {
    columns = isMobile ? 2 : 3
  } else {
    columns = isMobile ? 2 : isTablet ? 3 : 4
  }

  return {
    mode: 'gallery',
    columns,
    pageSize,
    totalPages,
    currentPage: safePage,
    maxRenderedVideos: Math.min(visibleOnPage, 16),
  }
}

/**
 * Selective Video Subscription:
 * Chỉ chọn tối đa `maxSubscribed` người tham gia cần nhận luồng video (ưu tiên người share màn hình,
 * người được ghim, người đang nói, rồi mới đến trang hiện tại) để không giải mã hàng trăm luồng video.
 * @param {{ userId: string }[]} participants
 * @param {{ activeSpeakerId?: string | null, pinnedUserId?: string | null, screenSharingUserId?: string | null, page?: number, pageSize?: number }} [options]
 */
export function selectVisibleVideoSubscriptions(
  participants,
  {
    activeSpeakerId = null,
    pinnedUserId = null,
    screenSharingUserId = null,
    page = 0,
    pageSize = 16,
  } = {}
) {
  if (!Array.isArray(participants) || participants.length === 0) return []

  const priorityIds = []
  const pushUnique = (id) => {
    if (id && !priorityIds.includes(id)) priorityIds.push(id)
  }

  pushUnique(screenSharingUserId)
  pushUnique(pinnedUserId)
  pushUnique(activeSpeakerId)

  const ordered = [
    ...participants.filter((p) => priorityIds.includes(p.userId)),
    ...participants.filter((p) => !priorityIds.includes(p.userId)),
  ]

  const start = Math.max(0, page) * pageSize
  return ordered.slice(start, start + pageSize).map((p) => p.userId)
}

export function getCallTransportInfo(isGroup, sfuConfigured = false) {
  if (!isGroup) {
    return {
      mode: 'p2p',
      isE2eeP2p: true,
      badgeText: 'E2EE P2P (WebRTC)',
      description: 'Kết nối ngang hàng P2P mã hóa DTLS-SRTP',
    }
  }
  return {
    mode: 'sfu',
    isE2eeP2p: false,
    badgeText: sfuConfigured ? 'SFU Group Media (DTLS-SRTP)' : 'SFU Group Signaling',
    description: sfuConfigured
      ? 'Truyền thông qua máy chủ SFU tối ưu băng thông & Selective Subscription'
      : 'Điều phối nhóm qua Supabase Realtime; cần cấu hình LIVEKIT_URL để truyền media SFU quy mô lớn',
  }
}

export function disposeMediaStream(stream) {
  if (!stream) return
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {}
    })
  } catch {}
}

export function disposePeerConnection(pc) {
  if (!pc) return
  try {
    pc.onicecandidate = null
    pc.ontrack = null
    pc.onconnectionstatechange = null
    pc.oniceconnectionstatechange = null
    pc.close()
  } catch {}
}
