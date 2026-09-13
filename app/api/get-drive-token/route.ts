import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function isInternalAppRequest(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const referer = request.headers.get('referer')
  const origin = request.headers.get('origin')
  const secFetchSite = request.headers.get('sec-fetch-site')

  // Browser fetch inside same-origin or same-site
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return true
  }

  if (host) {
    if (origin && origin.includes(host)) return true
    if (referer && referer.includes(host)) return true
  }

  // Common production domain check
  if (referer) {
    try {
      const refUrl = new URL(referer)
      if (
        refUrl.hostname.endsWith('senexam.me') ||
        refUrl.hostname.endsWith('vercel.app') ||
        refUrl.hostname === 'localhost' ||
        refUrl.hostname === '127.0.0.1'
      ) {
        return true
      }
    } catch {}
  }

  if (origin) {
    try {
      const origUrl = new URL(origin)
      if (
        origUrl.hostname.endsWith('senexam.me') ||
        origUrl.hostname.endsWith('vercel.app') ||
        origUrl.hostname === 'localhost' ||
        origUrl.hostname === '127.0.0.1'
      ) {
        return true
      }
    } catch {}
  }

  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  return false
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    const isInternal = isInternalAppRequest(request)

    if (!user && !isInternal) {
      return NextResponse.json(
        { error: 'Chưa đăng nhập hoặc phiên làm việc hết hạn. Vui lòng đăng nhập để tải lên tài liệu.' },
        { status: 401 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Thiếu cấu hình Google OAuth trong biến môi trường!')
      return NextResponse.json(
        { error: 'Thiếu cấu hình Google Drive OAuth trên máy chủ (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).' },
        { status: 500 }
      )
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('Google token endpoint error:', text)
      return NextResponse.json({ error: `Google token endpoint error: ${text}` }, { status: response.status })
    }

    const data = await response.json()
    if (!data.access_token) {
      return NextResponse.json({ error: 'Google không trả về access_token.' }, { status: 500 })
    }

    // Trả về accessToken và folderId (folderId không nhạy cảm)
    return NextResponse.json({
      accessToken: data.access_token,
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '',
    })
  } catch (error: any) {
    console.error('Lỗi lấy Google Drive token:', error)
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}
