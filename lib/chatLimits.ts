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

export type ChatPlanTier = keyof typeof CHAT_FILE_LIMITS

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
