import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  const pathname = url.pathname

  // Bỏ qua các file tĩnh và API
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 1. Đường dẫn dạng /fepn- (áp dụng trên mọi domain/subdomain)
  if (pathname.startsWith('/fepn-')) {
    // fepn-login, fepn-dashboard, fepn-recap, fepn-admin là các trang độc lập có sẵn thư mục
    if (
      pathname === '/fepn-login' ||
      pathname === '/fepn-dashboard' ||
      pathname === '/fepn-recap' ||
      pathname === '/fepn-admin'
    ) {
      return NextResponse.next()
    }
    // fepn-[mã môn học]: rewrite ngầm sang /tsv-fepn/[slug] để giữ nguyên URL fepn-[mã môn học] trên thanh địa chỉ
    url.pathname = `/tsv-fepn/${pathname.slice(1)}`
    return NextResponse.rewrite(url)
  }

  // 2. Kiểm tra nếu truy cập qua subdomain tsv.fepn.senexam.me hoặc fepn.senexam.me
  const isFepnSubdomain =
    hostname.startsWith('tsv.fepn.') ||
    hostname.startsWith('fepn.')

  if (isFepnSubdomain) {
    // 2.1 Trang chủ subdomain -> Chuyển vào FEPN Dashboard
    if (pathname === '/' || pathname === '/dashboard') {
      url.pathname = '/fepn-dashboard'
      return NextResponse.rewrite(url)
    }

    // 2.2 Trang login -> Chuyển vào FEPN Login
    if (pathname === '/login') {
      url.pathname = '/fepn-login'
      return NextResponse.rewrite(url)
    }

    // 2.3 Trang Recap
    if (pathname === '/recap' || pathname === '/fepn-recap') {
      url.pathname = '/fepn-recap'
      return NextResponse.rewrite(url)
    }

    // 2.4 Trang Admin Subdomain -> Chuyển vào FEPN Admin
    if (pathname === '/admin' || pathname === '/fepn-admin') {
      url.pathname = '/fepn-admin'
      return NextResponse.rewrite(url)
    }

    // 2.3 Các đường dẫn hệ thống đã có
    if (
      pathname.startsWith('/tsv-fepn') ||
      pathname.startsWith('/new-sign')
    ) {
      return NextResponse.next()
    }

    // 2.4 Nếu là đường dẫn môn học dạng tsv.fepn.senexam.me/[mã môn]
    const slug = pathname.slice(1) // Bỏ dấu /
    if (slug) {
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
