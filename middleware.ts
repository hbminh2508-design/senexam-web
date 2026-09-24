import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ========================================================
// 1. ANTI-DDOS & RATE LIMITING (Edge In-Memory Store)
// ========================================================
interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  // Dọn dẹp định kỳ nếu store phình to để bảo vệ RAM
  if (rateLimitStore.size > 2000) {
    rateLimitStore.forEach((val, k) => {
      if (now > val.resetTime) rateLimitStore.delete(k)
    })
  }

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// Danh sách chữ ký các công cụ dò quét lỗ hổng & tấn công tự động
const MALICIOUS_PATTERNS = [
  'sqlmap',
  'nikto',
  'masscan',
  'wpscan',
  'dirbuster',
  'nmap',
  'acunetix',
  'havij',
  'zgrab',
  'shodan',
  'censys',
  'nuclei',
  'gobuster',
  'ffuf',
]

// Hàm gán các Security Headers chuẩn OWASP cho mọi response
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  return res
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'

  // Bỏ qua các file tĩnh
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 1. Chặn các công cụ rà quét & bot tấn công độc hại
  const isMaliciousBot = MALICIOUS_PATTERNS.some((pattern) => userAgent.includes(pattern))
  if (isMaliciousBot) {
    return new NextResponse('Access Denied: Malicious activity detected.', { status: 403 })
  }

  // 1.5 Chặn quét các tệp nhạy cảm (Scanner & Exploit Probing)
  const pathLower = pathname.toLowerCase()
  if (
    pathLower.endsWith('.env') ||
    pathLower.endsWith('.git') ||
    pathLower.endsWith('.bak') ||
    pathLower.endsWith('.sql') ||
    pathLower.includes('wp-admin') ||
    pathLower.includes('phpmyadmin') ||
    pathLower.includes('cgi-bin') ||
    pathLower.includes('actuator') ||
    pathLower.includes('/etc/passwd')
  ) {
    return new NextResponse('Access Denied: Security probe detected.', { status: 403 })
  }

  // 2. Chặn các query parameter chứa payload tấn công XSS / SQLi / Path Traversal rõ ràng
  const searchLower = url.search.toLowerCase()
  if (
    searchLower.includes('<script') ||
    searchLower.includes('javascript:') ||
    searchLower.includes('union%20select') ||
    searchLower.includes('exec(') ||
    searchLower.includes('base64_decode') ||
    searchLower.includes('../') ||
    searchLower.includes('..%2f') ||
    searchLower.includes('etc/passwd') ||
    searchLower.includes('${') ||
    searchLower.includes('eval(')
  ) {
    return new NextResponse('Bad Request: Invalid parameters detected.', { status: 400 })
  }

  // 3. Anti-DDoS & Rate Limiting
  const isSensitivePath =
    pathname === '/fepn-login' ||
    pathname === '/login' ||
    pathname === '/fepn-admin' ||
    pathname === '/admin' ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/fepn-auth') ||
    pathname.startsWith('/api/gift-codes') ||
    pathname.startsWith('/api/beta') ||
    pathname.startsWith('/api/gemini')

  // Đường dẫn nhạy cảm: tối đa 35 req/phút; Đường dẫn thông thường: tối đa 140 req/10s
  const limitKey = isSensitivePath ? `auth_${clientIp}` : `gen_${clientIp}`
  const maxReqs = isSensitivePath ? 35 : 140
  const windowMs = isSensitivePath ? 60 * 1000 : 10 * 1000

  const isAllowed = checkRateLimit(limitKey, maxReqs, windowMs)
  if (!isAllowed) {
    const errorResponse = new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Hệ thống phát hiện tần suất yêu cầu bất thường từ thiết bị của bạn. Vui lòng chờ giây lát để tiếp tục.',
        status: 429,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
      }
    )
    return applySecurityHeaders(errorResponse)
  }

  // Bỏ qua các API route sau khi đã qua lớp kiểm tra rate limit & bot
  if (pathname.startsWith('/api')) {
    return applySecurityHeaders(NextResponse.next())
  }

  // 4.5 Kiểm tra nếu truy cập qua các subdomain
  const isSebSubdomain =
    hostname.startsWith('seb.thicu.tailieufepn.') ||
    hostname.startsWith('seb.') ||
    hostname.startsWith('thicu.')

  const isSenGraphSubdomain =
    hostname.startsWith('sengraph.senexam.') ||
    hostname.startsWith('sengraph.') ||
    hostname.startsWith('graph.')

  const isFepnSubdomain =
    hostname.startsWith('tsv.fepn.') ||
    hostname.startsWith('fepn.')

  // 4.6 Chuyển hướng các đường dẫn cũ sang giao diện Mới (New UI) trên miền chính
  if (!isSebSubdomain && !isFepnSubdomain && !isSenGraphSubdomain) {
    if (pathname === '/admin') {
      url.pathname = '/new-admin'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/announcements') {
      url.pathname = '/new-announcement'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/exams' || pathname.startsWith('/exams/')) {
      url.pathname = pathname.replace('/exams', '/new-exams')
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/exclusive-store') {
      url.pathname = '/new-exclusive-store'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/focus') {
      url.pathname = '/new-focus'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/library') {
      url.pathname = '/new-library'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/senai-studio') {
      url.pathname = '/new-senai-studio'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/submissions' || pathname.startsWith('/submissions/')) {
      url.pathname = pathname.replace('/submissions', '/new-submissions')
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/vip') {
      url.pathname = '/new-vip'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/tinhdiem') {
      url.pathname = '/new-mark-calculate'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/phongthinghiem') {
      url.pathname = '/new-labs'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/senvideo') {
      url.pathname = '/new-video'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/sen-cap-lai-mat-khau') {
      url.pathname = '/new-reset-password'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/vi-sen') {
      url.pathname = '/new-sencash'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (pathname === '/forum' || pathname.startsWith('/forum/') || pathname === '/mes') {
      url.pathname = '/new-media'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
  }

  // 4.7 Đường dẫn dạng /fepn- (áp dụng trên mọi domain/subdomain)
  if (pathname.startsWith('/fepn-')) {
    // fepn-login, fepn-dashboard, fepn-recap, fepn-admin, fepn-gpa, fepn-gift, fepn-schedule, fepn-reset-password là các trang độc lập có sẵn thư mục
    if (
      pathname === '/fepn-login' ||
      pathname === '/fepn-dashboard' ||
      pathname === '/fepn-recap' ||
      pathname === '/fepn-admin' ||
      pathname === '/fepn-gpa' ||
      pathname === '/fepn-gift' ||
      pathname === '/fepn-schedule' ||
      pathname === '/fepn-reset-password'
    ) {
      return applySecurityHeaders(NextResponse.next())
    }
    // fepn-[mã môn học]: rewrite ngầm sang /tsv-fepn/[slug] để giữ nguyên URL fepn-[mã môn học] trên thanh địa chỉ
    url.pathname = `/tsv-fepn/${pathname.slice(1)}`
    return applySecurityHeaders(NextResponse.rewrite(url))
  }

  if (isSebSubdomain) {
    if (pathname === '/' || pathname === '/dashboard') {
      url.pathname = '/seb-dashboard'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname === '/login') {
      url.pathname = '/seb-login'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname === '/profile') {
      url.pathname = '/seb-profile'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname === '/admin') {
      url.pathname = '/seb-admin'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname.startsWith('/exam/')) {
      url.pathname = `/seb-exam/${pathname.replace('/exam/', '')}`
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname.startsWith('/exams/')) {
      url.pathname = `/seb-exam/${pathname.replace('/exams/', '')}`
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname.startsWith('/seb-')) {
      return applySecurityHeaders(NextResponse.next())
    }
  }

  if (isSenGraphSubdomain) {
    if (pathname === '/' || pathname === '/dashboard') {
      url.pathname = '/sengraph'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
    if (pathname.startsWith('/sengraph')) {
      return applySecurityHeaders(NextResponse.next())
    }
  }

  // (Lưu ý: Sen Chat tạm thời ẩn routing subdomain theo yêu cầu, xem SEN_CHAT_DOCUMENTATION.md)

  // 5. Kiểm tra nếu truy cập qua subdomain tsv.fepn.senexam.me hoặc fepn.senexam.me
  if (isFepnSubdomain) {
    // 5.1 Trang chủ subdomain -> Chuyển vào FEPN Dashboard
    if (pathname === '/' || pathname === '/dashboard') {
      url.pathname = '/fepn-dashboard'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.2 Trang login -> Chuyển vào FEPN Login
    if (pathname === '/login') {
      url.pathname = '/fepn-login'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.3 Trang Recap
    if (pathname === '/recap' || pathname === '/fepn-recap') {
      url.pathname = '/fepn-recap'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.4 Trang GPA Calculator
    if (pathname === '/gpa' || pathname === '/fepn-gpa') {
      url.pathname = '/fepn-gpa'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.5 Trang Gift
    if (pathname === '/gift' || pathname === '/fepn-gift') {
      url.pathname = '/fepn-gift'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.6 Trang Schedule (Thời Khóa Biểu)
    if (pathname === '/schedule' || pathname === '/fepn-schedule') {
      url.pathname = '/fepn-schedule'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.7 Trang Admin Subdomain -> Chuyển vào FEPN Admin
    if (pathname === '/admin' || pathname === '/fepn-admin') {
      url.pathname = '/fepn-admin'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.8 Trang Cấp Lại Mật Khẩu FEPN
    if (
      pathname === '/reset-password' ||
      pathname === '/fepn-reset-password' ||
      pathname === '/sen-cap-lai-mat-khau' ||
      pathname === '/cap-lai-mat-khau'
    ) {
      url.pathname = '/fepn-reset-password'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.9 Các đường dẫn hệ thống đã có (bao gồm các trang SEB / Sen Exam Canvas, không rewrite sang môn học)
    if (
      pathname.startsWith('/tsv-fepn') ||
      pathname.startsWith('/new-sign') ||
      pathname.startsWith('/fepn-reset-password') ||
      pathname.startsWith('/new-reset-password') ||
      pathname.startsWith('/legacy-') ||
      pathname.startsWith('/seb-') ||
      pathname.startsWith('/seb') ||
      pathname.startsWith('/new-') ||
      pathname.startsWith('/sengraph') ||
      pathname.startsWith('/chat')
    ) {
      return applySecurityHeaders(NextResponse.next())
    }

    // 5.10 Nếu là đường dẫn môn học dạng tsv.fepn.senexam.me/[mã môn]
    const slug = pathname.slice(1) // Bỏ dấu /
    const RESERVED_SLUGS = [
      'dashboard',
      'login',
      'recap',
      'gpa',
      'gift',
      'schedule',
      'admin',
      'api',
      'auth',
      'sengraph',
      'chat',
      'zalo-chat',
      'reset-password',
      'fepn-reset-password',
      'seb-dashboard',
      'seb-login',
      'seb-profile',
      'seb-admin',
      'seb-exam',
      'seb-reviews',
    ]
    if (
      RESERVED_SLUGS.includes(slug.toLowerCase()) ||
      slug.toLowerCase().startsWith('seb-') ||
      slug.toLowerCase().startsWith('seb')
    ) {
      if (slug === 'reset-password' || slug === 'fepn-reset-password') {
        url.pathname = '/fepn-reset-password'
        return applySecurityHeaders(NextResponse.rewrite(url))
      }
      return applySecurityHeaders(NextResponse.next())
    }

    if (slug) {
      url.pathname = `/tsv-fepn/${slug}`
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
  }

  // Tự động chuyển hướng /login sang /new-sign trên domain chính
  if (pathname === '/login') {
    url.pathname = '/new-sign'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Bỏ qua các tài nguyên tĩnh: _next/static, _next/image, favicon, v.v.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
    '/',
  ],
}
