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
]

// Hàm gán các Security Headers chuẩn OWASP cho mọi response
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
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

  // 2. Chặn các query parameter chứa payload tấn công XSS / SQLi rõ ràng
  const searchLower = url.search.toLowerCase()
  if (
    searchLower.includes('<script') ||
    searchLower.includes('javascript:') ||
    searchLower.includes('union%20select') ||
    searchLower.includes('exec(') ||
    searchLower.includes('base64_decode')
  ) {
    return new NextResponse('Bad Request: Invalid parameters detected.', { status: 400 })
  }

  // 3. Anti-DDoS & Rate Limiting
  const isSensitivePath =
    pathname === '/fepn-login' ||
    pathname === '/login' ||
    pathname === '/fepn-admin' ||
    pathname === '/admin'

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

  // 4. Đường dẫn dạng /fepn- (áp dụng trên mọi domain/subdomain)
  if (pathname.startsWith('/fepn-')) {
    // fepn-login, fepn-dashboard, fepn-recap, fepn-admin, fepn-gpa là các trang độc lập có sẵn thư mục
    if (
      pathname === '/fepn-login' ||
      pathname === '/fepn-dashboard' ||
      pathname === '/fepn-recap' ||
      pathname === '/fepn-admin' ||
      pathname === '/fepn-gpa'
    ) {
      return applySecurityHeaders(NextResponse.next())
    }
    // fepn-[mã môn học]: rewrite ngầm sang /tsv-fepn/[slug] để giữ nguyên URL fepn-[mã môn học] trên thanh địa chỉ
    url.pathname = `/tsv-fepn/${pathname.slice(1)}`
    return applySecurityHeaders(NextResponse.rewrite(url))
  }

  // 5. Kiểm tra nếu truy cập qua subdomain tsv.fepn.senexam.me hoặc fepn.senexam.me
  const isFepnSubdomain =
    hostname.startsWith('tsv.fepn.') ||
    hostname.startsWith('fepn.')

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

    // 5.5 Trang Admin Subdomain -> Chuyển vào FEPN Admin
    if (pathname === '/admin' || pathname === '/fepn-admin') {
      url.pathname = '/fepn-admin'
      return applySecurityHeaders(NextResponse.rewrite(url))
    }

    // 5.6 Các đường dẫn hệ thống đã có
    if (
      pathname.startsWith('/tsv-fepn') ||
      pathname.startsWith('/new-sign')
    ) {
      return applySecurityHeaders(NextResponse.next())
    }

    // 5.7 Nếu là đường dẫn môn học dạng tsv.fepn.senexam.me/[mã môn]
    const slug = pathname.slice(1) // Bỏ dấu /
    if (slug) {
      url.pathname = `/tsv-fepn/${slug}`
      return applySecurityHeaders(NextResponse.rewrite(url))
    }
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
