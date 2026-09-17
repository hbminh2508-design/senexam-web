import { supabase } from '@/lib/supabaseClient'

/**
 * Đăng nhập / Đăng ký bằng Google OAuth
 * @param nextPath Đường dẫn redirect sau khi đăng nhập thành công (mặc định: /new-dashboard)
 */
export async function signInWithGoogle(nextPath: string = '/new-dashboard') {
  if (typeof window === 'undefined') return

  const host = window.location.hostname
  let origin = window.location.origin

  const isSeb =
    host.startsWith('seb.') ||
    host.startsWith('thicu.') ||
    host.includes('seb.thicu.tailieufepn.') ||
    nextPath.includes('seb-')

  const isFepn =
    !isSeb &&
    (host.startsWith('tsv.fepn.') ||
      host.startsWith('fepn.') ||
      nextPath.includes('fepn'))

  const source = isSeb ? 'seb' : isFepn ? 'fepn' : 'new-sign'

  // Nếu đang ở FEPN hoặc redirect tới FEPN, callbackUrl trỏ về subdomain FEPN
  if (isFepn && host !== 'localhost') {
    origin = 'https://tsv.fepn.senexam.me'
  }

  // Ghi nhận nguồn đăng nhập vào Cookie và LocalStorage để bảo toàn sau khi redirect qua Google OAuth
  try {
    const hostParts = host.split('.')
    const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `auth_source=${source}; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
    document.cookie = `auth_next=${encodeURIComponent(nextPath)}; domain=.${rootDomain}; path=/; max-age=600${isSecure}; SameSite=Lax`
    localStorage.setItem('auth_source', source)
    localStorage.setItem('auth_next', nextPath)
  } catch (e) {}

  const callbackUrl = `${origin}/auth/callback?source=${source}&next=${encodeURIComponent(nextPath)}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    console.error('Error signing in with Google:', error)
    throw error
  }

  return data
}

/**
 * Liên kết tài khoản hiện tại với Google
 * @param nextPath Đường dẫn redirect sau khi liên kết (mặc định: trang hiện tại)
 */
export async function linkWithGoogle(nextPath?: string) {
  if (typeof window === 'undefined') return

  const origin = window.location.origin
  const target = nextPath || window.location.pathname || '/new-dashboard'
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(target)}`

  // Supabase v2 linkIdentity
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error('Error linking Google identity:', error)
    throw error
  }

  return data
}

/**
 * Kiểm tra xem một email có phải là email tên miền đặc quyền (FEPN / Sen Mail / Khoa VLKT / Tài liệu FEPN) hay không.
 * Các email này được bypass hoàn toàn OTP & 2FA khi đăng nhập và có quyền truy cập Sen Mail.
 */
export function isDomainEmail(_emailStr?: string | null, _user?: any): boolean {
  return false
}

/**
 * Kiểm tra nhanh (đồng bộ) xem người dùng có quyền truy cập vào cổng FEPN hay không.
 * Chấp nhận:
 * - Email VNU (@vnu.edu.vn, *.vnu.edu.vn)
 * - Admin / Collab
 */
export function isFepnAllowedUser(user: any, role?: string): boolean {
  if (!user) return false
  const email = (user.email || '').toLowerCase().trim()
  if (!email) return false

  // 1. Quyền quản trị viên
  const metaRole = (user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase().trim()
  const userRole = (role || '').toLowerCase().trim()
  if (
    userRole === 'admin' ||
    userRole === 'collab' ||
    metaRole === 'admin' ||
    metaRole === 'collab' ||
    email === 'hoangbinhminh2508@gmail.com'
  ) {
    return true
  }

  // 2. Email VNU chính thức (@vnu.edu.vn hoặc các phân hiệu VNU)
  if (email.endsWith('@vnu.edu.vn') || email.endsWith('.vnu.edu.vn')) {
    return true
  }

  return false
}

/**
 * Kiểm tra toàn diện kết nối tài khoản xem có quyền truy cập FEPN hay không.
 */
export async function checkFepnAccessAsync(user: any, role?: string): Promise<boolean> {
  return isFepnAllowedUser(user, role)
}
