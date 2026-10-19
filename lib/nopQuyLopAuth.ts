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
