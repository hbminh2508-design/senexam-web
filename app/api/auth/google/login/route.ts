import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Chưa cấu hình GOOGLE_CLIENT_ID trên máy chủ' }, { status: 500 })
    }

    const url = new URL(request.url)
    const next = url.searchParams.get('next') || '/new-dashboard'
    const source = url.searchParams.get('source') || 'idp'

    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || 'senexam.me'
    const origin = `${proto}://${host}`

    const redirectUri = `${origin}/api/auth/google/callback`

    const statePayload = JSON.stringify({
      next,
      source,
      nonce: crypto.randomBytes(16).toString('hex'),
      origin,
    })
    const state = Buffer.from(statePayload).toString('base64url')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
    })

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    const response = NextResponse.redirect(googleAuthUrl)

    // Lưu state vào cookie để đối chiếu CSRF
    const isSecure = proto === 'https'
    response.cookies.set('oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 600, // 10 phút
    })

    return response
  } catch (err: any) {
    console.error('Lỗi khởi tạo Google OAuth:', err)
    return NextResponse.json({ error: 'Không thể khởi tạo đăng nhập Google' }, { status: 500 })
  }
}
