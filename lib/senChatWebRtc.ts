export interface CallGridLayout {
  mode: 'gallery' | 'speaker'
  columns: number
  pageSize: number
  totalPages: number
  currentPage: number
  maxRenderedVideos: number
}

export interface CallParticipantInfo {
  userId: string
  name: string
  avatar?: string
  roleInGroup?: string
  micEnabled: boolean
  cameraEnabled: boolean
  screenSharing?: boolean
  isSpeaking?: boolean
  isLocal?: boolean
  stream?: MediaStream | null
}

export {
  getRtcConfiguration,
  getOptimalAudioConstraints,
  getOptimalVideoConstraints,
  computeCallGridLayout,
  selectVisibleVideoSubscriptions,
  getCallTransportInfo,
  disposeMediaStream,
  disposePeerConnection,
} from './senChatWebRtc.mjs'
