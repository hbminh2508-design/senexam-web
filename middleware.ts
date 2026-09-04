import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // Kiểm tra nếu truy cập qua subdomain tsv.fepn.senexam.me hoặc fepn.senexam.me
  const isFepnSubdomain =
    hostname.startsWith('tsv.fepn.') ||
    hostname.startsWith('fepn.')

  if (isFepnSubdomain) {
    const pathname = url.pathname

    // 1. Trang chủ subdomain -> Chuyển vào Dashboard FEPN
    if (pathname === '/' || pathname === '/dashboard') {
      url.pathname = '/tsv-fepn/dashboard'
      return NextResponse.rewrite(url)
    }

    // 2. Trang đăng nhập -> Chuyển vào trang đăng nhập hệ thống
    if (pathname === '/login') {
      url.pathname = '/new-sign'
      return NextResponse.rewrite(url)
    }

    // 3. Nếu là các đường dẫn hệ thống nội bộ đã định nghĩa sẵn
    if (
      pathname.startsWith('/tsv-fepn') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/new-sign') ||
      pathname.startsWith('/auth')
    ) {
      return NextResponse.next()
    }

    // 4. Nếu là đường dẫn môn học dạng tsv.fepn.senexam.me/[ten-mon-hoc]
    const slug = pathname.slice(1) // Bỏ dấu gạch chéo đầu
    if (slug && !slug.includes('.')) {
      url.pathname = `/tsv-fepn/${slug}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Bỏ qua các tài nguyên tĩnh: _next/static, _next/image, favicon, api, v.v.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
    '/',
  ],
}
