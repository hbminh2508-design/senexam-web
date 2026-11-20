export const CHAT_FILE_LIMITS = {
  free: 100 * 1024 * 1024,          // 100 MB
  lite: 100 * 1024 * 1024,          // 100 MB
  vip: 250 * 1024 * 1024,           // 250 MB (Sen VIP)
  sen_one_lite: 250 * 1024 * 1024,  // 250 MB (Sen One Lite)
  premium: 500 * 1024 * 1024,       // 500 MB (Sen Premium)
  premium_plus: 1024 * 1024 * 1024, // 1 GB (Sen Premium+)
  sen_one: 1024 * 1024 * 1024,      // 1 GB (Sen One)
}

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

  return {
    allowed: false,
    limitBytes,
    fileSizeBytes,
    currentTier,
    suggestedTier,
    upgradeUrl: '/new-pay?tab=vip',
    error: `Tệp dung lượng ${formatBytes(fileSizeBytes)} vượt quá hạn mức ${formatBytes(
      limitBytes
    )} của gói hiện tại. Vui lòng nâng cấp lên ${tierNames[suggestedTier]} để gửi tệp này.`,
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
