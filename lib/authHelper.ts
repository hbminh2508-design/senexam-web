import { supabase } from '@/lib/supabaseClient'

/**
 * Đăng nhập / Đăng ký bằng Google OAuth
 * @param nextPath Đường dẫn redirect sau khi đăng nhập thành công (mặc định: /dashboard)
 */
export async function signInWithGoogle(nextPath: string = '/dashboard') {
  if (typeof window === 'undefined') return

  const host = window.location.hostname
  let origin = window.location.origin

  // Nếu đang ở FEPN hoặc redirect tới FEPN, callbackUrl trỏ về subdomain FEPN
  if (host.startsWith('tsv.fepn.') || host.startsWith('fepn.') || nextPath.includes('fepn')) {
    if (host !== 'localhost') {
      origin = 'https://tsv.fepn.senexam.me'
    }
  }

  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

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
  const target = nextPath || window.location.pathname || '/dashboard'
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
 * Kiểm tra xem một email có phải là email tên miền đặc quyền (FEPN / Sen Mail / Khoa VLKT) hay không.
 * Các email này được bypass hoàn toàn OTP & 2FA khi đăng nhập và có quyền truy cập Sen Mail.
 */
export function isDomainEmail(emailStr: string | null | undefined): boolean {
  if (!emailStr) return false
  const lower = emailStr.toLowerCase().trim()
  if (
    lower.endsWith('@fepn.edu.vn') ||
    lower.endsWith('@senexam.me') ||
    lower.endsWith('@vlkt.vnu.edu.vn') ||
    lower.endsWith('@fepn.vn') ||
    lower.includes('@fepn.')
  ) {
    return true
  }

  // Kiểm tra danh sách allowed domains tùy chỉnh hoặc email được cấp lưu trong cache
  if (typeof window !== 'undefined') {
    try {
      const customDomains = localStorage.getItem('fepn_allowed_domains')
      if (customDomains) {
        const list: string[] = JSON.parse(customDomains)
        if (list.some((d) => lower.endsWith(d.toLowerCase()))) {
          return true
        }
      }
      const domainEmailsCached = localStorage.getItem('fepn_domain_emails')
      if (domainEmailsCached) {
        const list: Array<{ email: string }> = JSON.parse(domainEmailsCached)
        if (list.some((item) => item.email?.toLowerCase() === lower)) {
          return true
        }
      }
    } catch (e) {}
  }

  return false
}
