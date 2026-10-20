// Chuẩn hóa tên tiếng Việt để so khớp không phân biệt hoa thường và dấu
export function normalizeVietnamese(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

// Lấy mật khẩu admin chuẩn theo ngày (Múi giờ Việt Nam GMT+7)
export function getExpectedAdminDailyPassword(): string {
  const now = new Date()
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)
  const day = String(vnDate.getDate()).padStart(2, '0')
  const month = String(vnDate.getMonth() + 1).padStart(2, '0')
  const year = vnDate.getFullYear()
  return `admin-${day}/${month}/${year}`
}

// Kiểm tra mật khẩu admin theo ngày động: admin-ngày hiện tại (VD: admin-19/10/2026)
export function isValidAdminDailyPassword(inputPassword: string): boolean {
  if (!inputPassword || typeof inputPassword !== 'string') return false
  const clean = inputPassword.trim()

  const now = new Date()
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)

  const day = String(vnDate.getDate()).padStart(2, '0')
  const month = String(vnDate.getMonth() + 1).padStart(2, '0')
  const year = vnDate.getFullYear()

  const expected1 = `admin-${day}/${month}/${year}` // admin-19/10/2026
  const expected2 = `admin-${vnDate.getDate()}/${vnDate.getMonth() + 1}/${year}`
  const expectedDash = `admin-${day}-${month}-${year}`

  // UTC fallback phòng trường hợp lệch timezone server
  const utcDay = String(now.getUTCDate()).padStart(2, '0')
  const utcMonth = String(now.getUTCMonth() + 1).padStart(2, '0')
  const utcYear = now.getUTCFullYear()
  const expectedUtc = `admin-${utcDay}/${utcMonth}/${utcYear}`

  return (
    clean === expected1 ||
    clean === expected2 ||
    clean === expectedDash ||
    clean === expectedUtc
  )
}

/**
 * Kiểm tra quyền của Admin hoặc Thủ Quỹ.
 * Cho phép xác thực nếu khớp mật khẩu ngày của Admin HOẶC mã bảo mật passcode của Thủ Quỹ đợt quỹ này.
 */
export function isAuthorizedAdminOrTreasurer(
  fund: { adminPasscode?: string } | null | undefined,
  auth: { adminUsername?: string; adminPassword?: string; adminPasscode?: string }
): boolean {
  if (!auth) return false
  const pass = (auth.adminPassword || auth.adminPasscode || '').trim()

  // 1. Khớp mật khẩu Admin theo ngày (admin-DD/MM/YYYY)
  if (isValidAdminDailyPassword(pass)) {
    return true
  }

  // 2. Khớp Passcode Thủ Quỹ của đợt quỹ
  const fundPass = fund?.adminPasscode?.trim()
  if (fundPass && pass === fundPass) {
    return true
  }

  // 3. Nếu đợt quỹ không đặt passcode, chấp nhận mật khẩu quản trị hoặc session hợp lệ
  if (!fundPass && pass) {
    return isValidAdminDailyPassword(pass)
  }

  return false
}
