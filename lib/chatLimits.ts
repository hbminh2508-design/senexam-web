/**
 * Sen Chat File Size & Content Policy Limits
 * Single Source of Truth for file size limits and security policies.
 * 
 * Quy định hạn mức tệp (ảnh, video, tệp):
 * - Miễn phí / Lite: 100MB
 * - Sen VIP / Sen One Lite: 250MB
 * - Sen Premium: 500MB
 * - Sen Premium+ / Sen One: 1GB
 */

export const CHAT_FILE_LIMITS = {
  free: 100 * 1024 * 1024,          // 100 MB
  lite: 100 * 1024 * 1024,          // 100 MB
  vip: 250 * 1024 * 1024,           // 250 MB (Sen VIP)
  sen_one_lite: 250 * 1024 * 1024,  // 250 MB (Sen One Lite)
  premium: 500 * 1024 * 1024,       // 500 MB (Sen Premium)
  premium_plus: 1024 * 1024 * 1024, // 1 GB (Sen Premium+)
  sen_one: 1024 * 1024 * 1024,      // 1 GB (Sen One)
} as const

/**
 * Hạn mức dung lượng media (ảnh, video, âm thanh, tệp) tối đa của mỗi nhóm là 15GB
 * (16,106,127,360 bytes).
 */
export const GROUP_STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024 // 16,106,127,360 bytes (15 GB)

/**
 * Thời hạn bảo lưu mặc định cho mỗi tệp tin đính kèm là 30 ngày.
 * Trưởng nhóm / Quản trị viên có thể gia hạn thêm 30 ngày hoặc bảo lưu vĩnh viễn.
 */
export const ATTACHMENT_RETENTION_DAYS = 30

export type ChatPlanTier = keyof typeof CHAT_FILE_LIMITS

/**
 * Kiểm tra hạn mức dung lượng lưu trữ của nhóm (15GB).
 */
export function validateGroupStorageQuota(
  currentGroupUsageBytes: number,
  newFileSizeBytes: number
): {
  allowed: boolean
  currentUsage: number
  newTotal: number
  quota: number
  error?: string
} {
  const newTotal = (currentGroupUsageBytes || 0) + (newFileSizeBytes || 0)
  if (newTotal <= GROUP_STORAGE_QUOTA_BYTES) {
    return {
      allowed: true,
      currentUsage: currentGroupUsageBytes || 0,
      newTotal,
      quota: GROUP_STORAGE_QUOTA_BYTES,
    }
  }

  const remaining = Math.max(0, GROUP_STORAGE_QUOTA_BYTES - (currentGroupUsageBytes || 0))
  return {
    allowed: false,
    currentUsage: currentGroupUsageBytes || 0,
    newTotal,
    quota: GROUP_STORAGE_QUOTA_BYTES,
    error: `Dung lượng nhóm đã đạt giới hạn tối đa 15GB (hiện còn ${formatBytes(remaining)} trống, tệp tải lên ${formatBytes(newFileSizeBytes)}). Trưởng nhóm vui lòng dọn dẹp bớt tệp hoặc ảnh video cũ trước khi gửi thêm.`,
  }
}

/**
 * Lấy hạn mức kích thước tệp tối đa (bytes) cho hạng gói
 */
export function getChatFileLimit(planTier: string | null | undefined): number {
  if (!planTier) return CHAT_FILE_LIMITS.free
  const normalized = planTier.trim().toLowerCase() as ChatPlanTier
  return CHAT_FILE_LIMITS[normalized] ?? CHAT_FILE_LIMITS.free
}

/**
 * Định dạng dung lượng byte sang MB hoặc GB thân thiện
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024)
    return Number.isInteger(gb) ? `${gb}GB` : `${gb.toFixed(1)}GB`
  }
  const mb = bytes / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`
}

export interface FileValidationResult {
  allowed: boolean
  limitBytes: number
  fileSizeBytes: number
  currentTier: string
  suggestedTier?: 'vip' | 'premium' | 'premium_plus'
  upgradeUrl?: string
  error?: string
}

/**
 * Xác thực kích thước tệp phía server/client dựa trên gói của người dùng.
 * Không tin tưởng client — luôn kiểm tra trước khi cấp quyền và kiểm tra lại trên stream/blob cuối cùng.
 */
export function validateChatFileSize(
  fileSizeBytes: number,
  planTier: string | null | undefined
): FileValidationResult {
  const currentTier = (planTier || 'free').toLowerCase()
  const limitBytes = getChatFileLimit(currentTier)

  if (fileSizeBytes <= limitBytes) {
    return {
      allowed: true,
      limitBytes,
      fileSizeBytes,
      currentTier,
    }
  }

  // Xác định gói tối thiểu cần nâng cấp để upload được tệp này
  let suggestedTier: 'vip' | 'premium' | 'premium_plus' = 'vip'
  if (fileSizeBytes > CHAT_FILE_LIMITS.premium) {
    suggestedTier = 'premium_plus'
  } else if (fileSizeBytes > CHAT_FILE_LIMITS.vip) {
    suggestedTier = 'premium'
  }

  const tierNames: Record<string, string> = {
    vip: 'Sen VIP (250MB)',
    premium: 'Sen Premium (500MB)',
    premium_plus: 'Sen Premium+ (1GB)',
  }

  const tierDisplayNames: Record<string, string> = {
    free: 'Miễn phí',
    lite: 'Miễn phí',
    vip: 'Sen VIP',
    sen_one_lite: 'Sen One Lite',
    premium: 'Sen Premium',
    premium_plus: 'Sen Premium+',
    sen_one: 'Sen One',
  }
  const currentTierDisplay = tierDisplayNames[currentTier] || currentTier

  return {
    allowed: false,
    limitBytes,
    fileSizeBytes,
    currentTier,
    suggestedTier,
    upgradeUrl: '/new-pay?tab=vip',
    error: `Tệp của bạn (${formatBytes(fileSizeBytes)}) vượt quá hạn mức ${formatBytes(
      limitBytes
    )} của gói ${currentTierDisplay}. Hãy nâng cấp lên ${tierNames[suggestedTier]} để gửi tệp này.`,
  }
}

/**
 * Danh sách đuôi tệp thực thi / nguy hiểm cần cảnh báo trước khi mở
 */
export const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'msi', 'com', 'scr', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'ps1', 'ps1xml', 'ps2', 'psc1', 'psc2', 'msh', 'msh1', 'msh2',
  'inf', 'reg', 'sh', 'bash', 'zsh', 'bin', 'run', 'app', 'dmg', 'pkg',
  'deb', 'rpm', 'apk', 'jar', 'gadget', 'cpl', 'hta', 'pif'
])

/**
 * Kiểm tra xem tệp có phải là file thực thi tiềm ẩn rủi ro hay không
 */
export function isExecutableFile(fileName: string, mimeType?: string): boolean {
  if (!fileName) return false
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (EXECUTABLE_EXTENSIONS.has(ext)) return true

  if (mimeType) {
    const dangerousMimes = [
      'application/x-msdownload',
      'application/x-executable',
      'application/x-sh',
      'application/x-bat',
      'application/x-msdos-program',
      'application/vnd.microsoft.portable-executable',
      'application/vnd.android.package-archive',
    ]
    if (dangerousMimes.some(m => mimeType.toLowerCase().includes(m))) {
      return true
    }
  }

  return false
}

/**
 * Danh sách tệp SVG/HTML chỉ cho phép tải về (attachment), tuyệt đối không hiển thị inline
 * để triệt tiêu nguy cơ Stored XSS qua thẻ <script> hoặc foreignObject.
 */
export const RESTRICTED_INLINE_EXTENSIONS = new Set([
  'svg', 'html', 'htm', 'xhtml', 'xht', 'shtml', 'xml'
])

export function isRestrictedInlineFile(fileName: string, mimeType?: string): boolean {
  if (!fileName) return false
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (RESTRICTED_INLINE_EXTENSIONS.has(ext)) return true

  if (mimeType) {
    const restrictedMimes = [
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'text/xml',
      'application/xml'
    ]
    if (restrictedMimes.some(m => mimeType.toLowerCase().includes(m))) {
      return true
    }
  }

  return false
}

// ==============================================================================
// SINGLE SOURCE OF TRUTH: QUYỀN LỢI NHÓM & CUỘC GỌI NHÓM SEN CHAT (v1.1.0)
// ==============================================================================

export interface ChatPlanEntitlement {
  tier: ChatPlanTier
  displayName: string
  canCreateGroup: boolean
  maxGroupMembers: number
  maxCallParticipants: number | null
  maxCallDurationSeconds: number | null
  maxFileSizeBytes: number
}

export const CHAT_PLAN_ENTITLEMENTS: Record<ChatPlanTier, ChatPlanEntitlement> = {
  free: {
    tier: 'free',
    displayName: 'Miễn phí',
    canCreateGroup: false,
    maxGroupMembers: 0,
    maxCallParticipants: null, // Theo gói chủ nhóm
    maxCallDurationSeconds: null, // Theo gói chủ nhóm
    maxFileSizeBytes: CHAT_FILE_LIMITS.free,
  },
  lite: {
    tier: 'lite',
    displayName: 'Lite',
    canCreateGroup: true,
    maxGroupMembers: 5,
    maxCallParticipants: 5,
    maxCallDurationSeconds: 60 * 60, // 1 giờ
    maxFileSizeBytes: CHAT_FILE_LIMITS.lite,
  },
  vip: {
    tier: 'vip',
    displayName: 'VIP',
    canCreateGroup: true,
    maxGroupMembers: 20,
    maxCallParticipants: 20,
    maxCallDurationSeconds: 5 * 60 * 60, // 5 giờ
    maxFileSizeBytes: CHAT_FILE_LIMITS.vip,
  },
  premium: {
    tier: 'premium',
    displayName: 'Premium',
    canCreateGroup: true,
    maxGroupMembers: 50,
    maxCallParticipants: 50,
    maxCallDurationSeconds: null, // Không giới hạn
    maxFileSizeBytes: CHAT_FILE_LIMITS.premium,
  },
  premium_plus: {
    tier: 'premium_plus',
    displayName: 'Premium+',
    canCreateGroup: true,
    maxGroupMembers: 100,
    maxCallParticipants: 100,
    maxCallDurationSeconds: null, // Không giới hạn
    maxFileSizeBytes: CHAT_FILE_LIMITS.premium_plus,
  },
  sen_one_lite: {
    tier: 'sen_one_lite',
    displayName: 'One Lite',
    canCreateGroup: true,
    maxGroupMembers: 30,
    maxCallParticipants: 30,
    maxCallDurationSeconds: null, // Không giới hạn
    maxFileSizeBytes: CHAT_FILE_LIMITS.sen_one_lite,
  },
  sen_one: {
    tier: 'sen_one',
    displayName: 'One',
    canCreateGroup: true,
    maxGroupMembers: 200,
    maxCallParticipants: 200,
    maxCallDurationSeconds: null, // Không giới hạn
    maxFileSizeBytes: CHAT_FILE_LIMITS.sen_one,
  },
}

export function normalizeChatPlanTier(tier: string | null | undefined): ChatPlanTier {
  if (!tier) return 'free'
  const raw = String(tier).trim().toLowerCase()
  if (raw === 'premium+' || raw === 'premium_plus') return 'premium_plus'
  if (raw === 'one_lite' || raw === 'sen_one_lite') return 'sen_one_lite'
  if (raw === 'one' || raw === 'sen_one') return 'sen_one'
  if (raw === 'lite' || raw === 'vip' || raw === 'premium' || raw === 'free') {
    return raw as ChatPlanTier
  }
  return 'free'
}

export function getPlanEntitlements(tier: string | null | undefined): ChatPlanEntitlement {
  const normalized = normalizeChatPlanTier(tier)
  return CHAT_PLAN_ENTITLEMENTS[normalized]
}

export function canUserCreateGroup(tier: string | null | undefined): {
  allowed: boolean
  entitlement: ChatPlanEntitlement
  error?: string
} {
  const entitlement = getPlanEntitlements(tier)
  if (entitlement.canCreateGroup) {
    return { allowed: true, entitlement }
  }
  return {
    allowed: false,
    entitlement,
    error:
      'Tài khoản Miễn phí không thể tạo nhóm chat mới. Bạn vẫn có thể tham gia và gọi nhóm của bạn bè trả phí, hoặc nâng cấp từ gói Lite (tối đa 5 thành viên) trở lên để tạo nhóm.',
  }
}

export function validateGroupMemberLimit(
  ownerTier: string | null | undefined,
  currentMemberCount: number,
  addingCount: number = 1
): {
  allowed: boolean
  maxMembers: number
  currentCount: number
  projectedCount: number
  ownerTier: ChatPlanTier
  error?: string
} {
  const ent = getPlanEntitlements(ownerTier)
  const projectedCount = Math.max(0, currentMemberCount) + Math.max(0, addingCount)

  if (!ent.canCreateGroup || ent.maxGroupMembers <= 0) {
    return {
      allowed: false,
      maxMembers: ent.maxGroupMembers,
      currentCount: currentMemberCount,
      projectedCount,
      ownerTier: ent.tier,
      error:
        'Chủ sở hữu nhóm hiện đang ở gói Miễn phí nên không thể thêm thành viên mới. Nhóm và tin nhắn cũ vẫn được giữ nguyên; vui lòng nâng cấp gói hoặc chuyển quyền sở hữu hợp lệ.',
    }
  }

  if (projectedCount > ent.maxGroupMembers) {
    return {
      allowed: false,
      maxMembers: ent.maxGroupMembers,
      currentCount: currentMemberCount,
      projectedCount,
      ownerTier: ent.tier,
      error: `Nhóm của gói ${ent.displayName} chỉ hỗ trợ tối đa ${ent.maxGroupMembers} thành viên (bao gồm cả chủ nhóm). Hiện tại có ${currentMemberCount} thành viên.`,
    }
  }

  return {
    allowed: true,
    maxMembers: ent.maxGroupMembers,
    currentCount: currentMemberCount,
    projectedCount,
    ownerTier: ent.tier,
  }
}

export function validateGroupCallStartOrJoin(
  ownerTier: string | null | undefined,
  currentActiveParticipants: number,
  options: { isJoiningExisting?: boolean; startedAtMs?: number | null; nowMs?: number } = {}
): {
  allowed: boolean
  maxParticipants: number
  maxDurationSeconds: number | null
  remainingSeconds: number | null
  ownerTier: ChatPlanTier
  error?: string
} {
  const ent = getPlanEntitlements(ownerTier)
  const nowMs = options.nowMs ?? Date.now()

  if (!ent.canCreateGroup || !ent.maxCallParticipants) {
    return {
      allowed: false,
      maxParticipants: 0,
      maxDurationSeconds: null,
      remainingSeconds: 0,
      ownerTier: ent.tier,
      error:
        'Chủ nhóm hiện đang sử dụng gói Miễn phí nên bị hạn chế khởi tạo phiên gọi nhóm mới. Vui lòng nâng cấp gói hoặc chuyển quyền chủ nhóm.',
    }
  }

  if (ent.maxCallDurationSeconds !== null && options.startedAtMs) {
    const elapsedSec = Math.max(0, Math.floor((nowMs - options.startedAtMs) / 1000))
    const remainingSec = ent.maxCallDurationSeconds - elapsedSec
    if (remainingSec <= 0) {
      return {
        allowed: false,
        maxParticipants: ent.maxCallParticipants,
        maxDurationSeconds: ent.maxCallDurationSeconds,
        remainingSeconds: 0,
        ownerTier: ent.tier,
        error: `Phiên gọi nhóm của gói ${ent.displayName} đã hết thời lượng tối đa (${Math.round(
          ent.maxCallDurationSeconds / 3600
        )} giờ).`,
      }
    }
  }

  if (currentActiveParticipants >= ent.maxCallParticipants) {
    return {
      allowed: false,
      maxParticipants: ent.maxCallParticipants,
      maxDurationSeconds: ent.maxCallDurationSeconds,
      remainingSeconds:
        ent.maxCallDurationSeconds !== null && options.startedAtMs
          ? Math.max(0, ent.maxCallDurationSeconds - Math.floor((nowMs - options.startedAtMs) / 1000))
          : ent.maxCallDurationSeconds,
      ownerTier: ent.tier,
      error: `Cuộc gọi nhóm đã đạt giới hạn tối đa ${ent.maxCallParticipants} người tham gia đồng thời của gói ${ent.displayName}.`,
    }
  }

  const remainingSeconds =
    ent.maxCallDurationSeconds !== null
      ? options.startedAtMs
        ? Math.max(0, ent.maxCallDurationSeconds - Math.floor((nowMs - options.startedAtMs) / 1000))
        : ent.maxCallDurationSeconds
      : null

  return {
    allowed: true,
    maxParticipants: ent.maxCallParticipants,
    maxDurationSeconds: ent.maxCallDurationSeconds,
    remainingSeconds,
    ownerTier: ent.tier,
  }
}

export function getCallDurationWarningLevel(remainingSeconds: number | null): 15 | 5 | 1 | null {
  if (remainingSeconds === null || remainingSeconds <= 0) return null
  if (remainingSeconds <= 60) return 1
  if (remainingSeconds <= 300) return 5
  if (remainingSeconds <= 900) return 15
  return null
}
