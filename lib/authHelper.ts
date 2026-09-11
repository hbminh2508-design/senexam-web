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
 * Kiểm tra xem một email có phải là email tên miền đặc quyền (FEPN / Sen Mail / Khoa VLKT / Tài liệu FEPN) hay không.
 * Các email này được bypass hoàn toàn OTP & 2FA khi đăng nhập và có quyền truy cập Sen Mail.
 */
export function isDomainEmail(emailStr: string | null | undefined, user?: any): boolean {
  if (user?.user_metadata?.is_domain_email === true || user?.app_metadata?.is_domain_email === true) {
    return true
  }

  const email = (emailStr || user?.email || '').toLowerCase().trim()
  if (!email || !email.includes('@')) return false

  const domain = email.split('@')[1] || ''

  // 1. Nhận diện các tên miền FEPN, SenExam, Tài liệu FEPN và các subdomain
  if (
    domain.endsWith('fepn.edu.vn') ||
    domain.endsWith('senexam.me') ||
    domain.endsWith('tailieufepn.me') || // Vd: @sinhvien.tailieufepn.me
    domain.endsWith('vlkt.vnu.edu.vn') ||
    domain.endsWith('fepn.vn') ||
    domain.includes('tailieufepn') ||
    domain.includes('fepn.') ||
    domain.includes('senmail')
  ) {
    return true
  }

  // 2. Kiểm tra danh sách allowed domains tùy chỉnh hoặc email được cấp lưu trong cache
  if (typeof window !== 'undefined') {
    try {
      const customDomains = localStorage.getItem('fepn_allowed_domains')
      if (customDomains) {
        const list: string[] = JSON.parse(customDomains)
        if (
          list.some(
            (d) =>
              email.endsWith(d.toLowerCase().replace(/^@/, '')) ||
              domain === d.toLowerCase().replace(/^@/, '') ||
              domain.endsWith(`.${d.toLowerCase().replace(/^@/, '')}`)
          )
        ) {
          return true
        }
      }
      const domainEmailsCached = localStorage.getItem('fepn_domain_emails')
      if (domainEmailsCached) {
        const list: Array<{ email?: string; domain?: string }> = JSON.parse(domainEmailsCached)
        if (
          list.some(
            (item) =>
              item.email?.toLowerCase() === email ||
              (item.domain && domain === item.domain.toLowerCase().replace(/^@/, ''))
          )
        ) {
          return true
        }
      }
    } catch (e) {}
  }

  return false
}

/**
 * Kiểm tra nhanh (đồng bộ) xem người dùng có quyền truy cập vào cổng FEPN hay không.
 * Chấp nhận:
 * - Email VNU (@vnu.edu.vn, *.vnu.edu.vn)
 * - Admin / Collab
 * - Email tên miền FEPN, Sen Mail, tailieufepn.me hoặc bất kỳ email nào được cấp bởi Admin
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

  // 3. User metadata do Admin cấp
  if (user.user_metadata?.is_domain_email === true || user.app_metadata?.is_domain_email === true) {
    return true
  }

  // 4. Kiểm tra tên miền FEPN / Sen Mail / tailieufepn.me
  if (isDomainEmail(email, user)) {
    return true
  }

  return false
}

/**
 * Kiểm tra toàn diện (bất đồng bộ) kết nối với CSDL Supabase để đảm bảo:
 * Khi Admin cấp email/domain mới trên một thiết bị bất kỳ, người dùng trên thiết bị khác cũng được chấp thuận ngay lập tức.
 */
export async function checkFepnAccessAsync(user: any, role?: string): Promise<boolean> {
  // 1. Kiểm tra nhanh bằng bộ lọc nội bộ
  if (isFepnAllowedUser(user, role)) return true

  if (!user || !user.email) return false
  const email = user.email.toLowerCase().trim()
  const domain = email.includes('@') ? email.split('@')[1] : ''

  // 2. Kiểm tra trực tiếp bảng fepn_domain_emails trong Supabase
  try {
    const { data, error } = await supabase
      .from('fepn_domain_emails')
      .select('id, email, domain, status')
      .or(`email.ilike.${email},domain.ilike.%${domain}%`)
      .limit(1)

    if (!error && data && data.length > 0) {
      const found = data[0]
      if (found.status !== 'suspended') {
        // Lưu lại cache tên miền cục bộ để các request sau chạy nhanh
        if (typeof window !== 'undefined') {
          try {
            const domainKey = `@${domain}`
            const currentAllowed: string[] = JSON.parse(localStorage.getItem('fepn_allowed_domains') || '[]')
            if (!currentAllowed.includes(domainKey)) {
              localStorage.setItem('fepn_allowed_domains', JSON.stringify([...currentAllowed, domainKey]))
            }
          } catch (e) {}
        }
        return true
      }
    }
  } catch (e) {
    console.warn('Notice checking fepn_domain_emails in Supabase:', e)
  }

  return false
}
