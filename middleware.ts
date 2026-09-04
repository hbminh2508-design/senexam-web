import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // Kiểm tra nếu truy cập qua subdomain tsv.fepn.senexam.me hoặc fepn.senexam.me
  const isFepnSubdomain =
    hostname.startsWith('tsv.fepn.') ||
    hostname.startsWith('fepn.') ||
    hostname.includes('tsv-fepn')

  if (isFepnSubdomain) {
    // Nếu truy cập trang chủ của subdomain, rewrite vào trang /tsv-fepn
    if (url.pathname === '/') {
      url.pathname = '/tsv-fepn'
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
