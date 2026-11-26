export const CHAT_FILE_LIMITS = {
  free: 100 * 1024 * 1024,          // 100 MB
  lite: 100 * 1024 * 1024,          // 100 MB
  vip: 250 * 1024 * 1024,           // 250 MB (Sen VIP)
  sen_one_lite: 250 * 1024 * 1024,  // 250 MB (Sen One Lite)
  premium: 500 * 1024 * 1024,       // 500 MB (Sen Premium)
  premium_plus: 1024 * 1024 * 1024, // 1 GB (Sen Premium+)
  sen_one: 1024 * 1024 * 1024,      // 1 GB (Sen One)
}

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

export function getChatFileLimit(planTier) {
  if (!planTier) return CHAT_FILE_LIMITS.free
  const normalized = String(planTier).trim().toLowerCase()
  return CHAT_FILE_LIMITS[normalized] ?? CHAT_FILE_LIMITS.free
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024)
    return Number.isInteger(gb) ? `${gb}GB` : `${gb.toFixed(1)}GB`
  }
  const mb = bytes / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`
}

export function validateGroupStorageQuota(currentGroupUsageBytes, newFileSizeBytes) {
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

export function validateChatFileSize(fileSizeBytes, planTier) {
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

  let suggestedTier = 'vip'
  if (fileSizeBytes > CHAT_FILE_LIMITS.premium) {
    suggestedTier = 'premium_plus'
  } else if (fileSizeBytes > CHAT_FILE_LIMITS.vip) {
    suggestedTier = 'premium'
  }

  const tierNames = {
    vip: 'Sen VIP (250MB)',
    premium: 'Sen Premium (500MB)',
    premium_plus: 'Sen Premium+ (1GB)',
  }

  const tierDisplayNames = {
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

export const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'msi', 'com', 'scr', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'ps1', 'ps1xml', 'ps2', 'psc1', 'psc2', 'msh', 'msh1', 'msh2',
  'inf', 'reg', 'sh', 'bash', 'zsh', 'bin', 'run', 'app', 'dmg', 'pkg',
  'deb', 'rpm', 'apk', 'jar', 'gadget', 'cpl', 'hta', 'pif'
])

export function isExecutableFile(fileName, mimeType) {
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

export const RESTRICTED_INLINE_EXTENSIONS = new Set([
  'svg', 'html', 'htm', 'xhtml', 'xht', 'shtml', 'xml'
])

export function isRestrictedInlineFile(fileName, mimeType) {
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

export const CHAT_PLAN_ENTITLEMENTS = {
  free: {
    tier: 'free',
    displayName: 'Miễn phí',
    canCreateGroup: false,
    maxGroupMembers: 0,
    maxCallParticipants: null,
    maxCallDurationSeconds: null,
    maxFileSizeBytes: CHAT_FILE_LIMITS.free,
  },
  lite: {
    tier: 'lite',
    displayName: 'Lite',
    canCreateGroup: true,
    maxGroupMembers: 5,
    maxCallParticipants: 5,
    maxCallDurationSeconds: 60 * 60,
    maxFileSizeBytes: CHAT_FILE_LIMITS.lite,
  },
  vip: {
    tier: 'vip',
    displayName: 'VIP',
    canCreateGroup: true,
    maxGroupMembers: 20,
    maxCallParticipants: 20,
    maxCallDurationSeconds: 5 * 60 * 60,
    maxFileSizeBytes: CHAT_FILE_LIMITS.vip,
  },
  premium: {
    tier: 'premium',
    displayName: 'Premium',
    canCreateGroup: true,
    maxGroupMembers: 50,
    maxCallParticipants: 50,
    maxCallDurationSeconds: null,
    maxFileSizeBytes: CHAT_FILE_LIMITS.premium,
  },
  premium_plus: {
    tier: 'premium_plus',
    displayName: 'Premium+',
    canCreateGroup: true,
    maxGroupMembers: 100,
    maxCallParticipants: 100,
    maxCallDurationSeconds: null,
    maxFileSizeBytes: CHAT_FILE_LIMITS.premium_plus,
  },
  sen_one_lite: {
    tier: 'sen_one_lite',
    displayName: 'One Lite',
    canCreateGroup: true,
    maxGroupMembers: 30,
    maxCallParticipants: 30,
    maxCallDurationSeconds: null,
    maxFileSizeBytes: CHAT_FILE_LIMITS.sen_one_lite,
  },
  sen_one: {
    tier: 'sen_one',
    displayName: 'One',
    canCreateGroup: true,
    maxGroupMembers: 200,
    maxCallParticipants: 200,
    maxCallDurationSeconds: null,
    maxFileSizeBytes: CHAT_FILE_LIMITS.sen_one,
  },
}

export function normalizeChatPlanTier(tier) {
  if (!tier) return 'free'
  const raw = String(tier).trim().toLowerCase()
  if (raw === 'premium+' || raw === 'premium_plus') return 'premium_plus'
  if (raw === 'one_lite' || raw === 'sen_one_lite') return 'sen_one_lite'
  if (raw === 'one' || raw === 'sen_one') return 'sen_one'
  if (raw === 'lite' || raw === 'vip' || raw === 'premium' || raw === 'free') {
    return raw
  }
  return 'free'
}

export function getPlanEntitlements(tier) {
  return CHAT_PLAN_ENTITLEMENTS[normalizeChatPlanTier(tier)]
}

export function canUserCreateGroup(tier) {
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

export function validateGroupMemberLimit(ownerTier, currentMemberCount, addingCount = 1) {
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

export function validateGroupCallStartOrJoin(ownerTier, currentActiveParticipants, options = {}) {
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

export function getCallDurationWarningLevel(remainingSeconds) {
  if (remainingSeconds === null || remainingSeconds <= 0) return null
  if (remainingSeconds <= 60) return 1
  if (remainingSeconds <= 300) return 5
  if (remainingSeconds <= 900) return 15
  return null
}
