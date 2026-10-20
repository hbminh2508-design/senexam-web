// Quản lý phiên xác thực Admin trong 30 phút cho trang Nộp Quỹ Lớp ME2

const ADMIN_SESSION_KEY = 'nopquylop_admin_session_v1'
export const ADMIN_SESSION_DURATION_MS = 30 * 60 * 1000 // 30 phút

export interface AdminSessionData {
  verified: boolean
  expiresAt: number
  adminUsername: string
  adminPassword?: string
}

/**
 * Lưu phiên xác thực Admin duy trì trong 30 phút
 */
export function saveAdminSession(adminPassword?: string): void {
  if (typeof window === 'undefined') return
  const data: AdminSessionData = {
    verified: true,
    expiresAt: Date.now() + ADMIN_SESSION_DURATION_MS,
    adminUsername: 'admin',
    adminPassword: adminPassword || '',
  }
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('nopquylop_admin_session_change', { detail: data }))
  } catch (err) {
    console.warn('Lỗi lưu admin session:', err)
  }
}

/**
 * Kiểm tra và lấy phiên Admin hiện tại
 */
export function getAdminSession(): {
  verified: boolean
  expiresAt: number
  remainingSec: number
  adminPassword?: string
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AdminSessionData
    const now = Date.now()
    if (!data.verified || !data.expiresAt || data.expiresAt <= now) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return null
    }
    const remainingSec = Math.max(0, Math.floor((data.expiresAt - now) / 1000))
    return {
      verified: true,
      expiresAt: data.expiresAt,
      remainingSec,
      adminPassword: data.adminPassword,
    }
  } catch {
    return null
  }
}

/**
 * Kiểm tra nhanh xem phiên admin có đang còn hiệu lực không
 */
export function isCurrentAdminSessionValid(): boolean {
  return getAdminSession() !== null
}

/**
 * Xóa phiên admin (khóa lại hoặc đăng xuất admin)
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    window.dispatchEvent(new CustomEvent('nopquylop_admin_session_change', { detail: null }))
  } catch {}
}

/**
 * Format số giây hoặc timestamp thành MM:SS
 */
export function formatAdminRemainingTime(val: number): string {
  let sec = val
  if (val > 1000000000) {
    sec = Math.max(0, Math.floor((val - Date.now()) / 1000))
  }
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
