import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Thiếu cấu hình GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trên máy chủ')
      return NextResponse.redirect('https://senexam.me/new-idp?error=server_auth_config_missing')
    }

    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || 'senexam.me'
    const origin = `${proto}://${host}`

    let nextPath = '/new-dashboard'
    let source = 'idp'

    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
        if (decodedState?.next) nextPath = decodedState.next
        if (decodedState?.source) source = decodedState.source
      } catch {}
    }

    if (error || !code) {
      const errorMsg = error || 'Không nhận được mã xác thực từ Google'
      return NextResponse.redirect(`${origin}/new-idp?error=${encodeURIComponent(errorMsg)}`)
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    // 1. Đổi authorization code lấy token trực tiếp từ Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('Lỗi đổi token với Google:', errText)
      return NextResponse.redirect(
        `${origin}/new-idp?error=${encodeURIComponent('Xác thực với Google thất bại. Vui lòng thử lại.')}`
      )
    }

    const tokenData = await tokenRes.json()
    const { id_token, access_token } = tokenData

    // 2. Lấy thông tin người dùng từ Google
    let googleUser: any = null
    if (access_token) {
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        if (userRes.ok) {
          googleUser = await userRes.json()
        }
      } catch (uErr) {
        console.warn('Lỗi fetch Google userinfo:', uErr)
      }
    }

    if (!googleUser && id_token) {
      try {
        const payloadBase64 = id_token.split('.')[1]
        googleUser = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'))
      } catch {}
    }

    const email = googleUser?.email
    if (!email) {
      return NextResponse.redirect(
        `${origin}/new-idp?error=${encodeURIComponent('Tài khoản Google không cung cấp địa chỉ email.')}`
      )
    }

    const fullName = googleUser?.name || email.split('@')[0]
    const avatarUrl = googleUser?.picture || null

    const supabaseAdmin = getSupabaseAdmin()

    // 3. Đảm bảo user đã tồn tại trong Supabase Auth
    let userId: string | null = null
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const found = existingUser?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

    if (found) {
      userId = found.id
    } else {
      // Tạo user mới trong Supabase Auth nếu chưa có
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          avatar_url: avatarUrl,
          name: fullName,
          picture: avatarUrl,
        },
      })
      if (!createErr && newUser?.user) {
        userId = newUser.user.id
      }
    }

    // Đảm bảo hồ sơ trong bảng `profiles`
    if (userId) {
      try {
        await supabaseAdmin.from('profiles').upsert(
          {
            id: userId,
            full_name: fullName,
            email,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      } catch (pErr) {
        console.warn('Lỗi upsert profile:', pErr)
      }
    }

    // 4. Sinh liên kết / mã phiên an toàn (MagicLink Token) để kích hoạt phiên Supabase trên client
    let tokenHash = ''
    let emailOtp = ''

    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}&source=${encodeURIComponent(source)}`,
        },
      })

      if (linkData?.properties) {
        tokenHash = linkData.properties.hashed_token || ''
        emailOtp = linkData.properties.email_otp || ''
      }
    } catch (linkErr) {
      console.warn('Lỗi generateLink:', linkErr)
    }

    // 5. Chuyển hướng về trang callback trên client để nạp session
    const callbackTarget = new URL(`${origin}/auth/callback`)
    if (id_token) callbackTarget.searchParams.set('google_id_token', id_token)
    if (tokenHash) callbackTarget.searchParams.set('token_hash', tokenHash)
    if (emailOtp) callbackTarget.searchParams.set('email_otp', emailOtp)
    callbackTarget.searchParams.set('email', email)
    callbackTarget.searchParams.set('next', nextPath)
    callbackTarget.searchParams.set('source', source)

    const response = NextResponse.redirect(callbackTarget.toString())

    // Ghi đè cookie phân luồng
    const isSecure = proto === 'https'
    const hostParts = host.split('.')
    const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : host
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    const cookieDomain = isIp || host === 'localhost' ? '' : `; domain=.${rootDomain}`

    response.headers.append(
      'Set-Cookie',
      `auth_source=${source}${cookieDomain}; Path=/; Max-Age=600${isSecure ? '; Secure' : ''}; SameSite=Lax`
    )
    response.headers.append(
      'Set-Cookie',
      `auth_next=${encodeURIComponent(nextPath)}${cookieDomain}; Path=/; Max-Age=600${isSecure ? '; Secure' : ''}; SameSite=Lax`
    )

    return response
  } catch (err: any) {
    console.error('Lỗi xử lý Google callback:', err)
    return NextResponse.redirect(
      `https://senexam.me/new-idp?error=${encodeURIComponent(err?.message || 'Lỗi xử lý đăng nhập')}`
    )
  }
}
