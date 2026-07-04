import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Cấu hình OAuth2 (dùng chung refresh token với /api/drive/stream)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    if (!fileId) return new NextResponse('Thiếu fileId', { status: 400 })

    // 1. Lấy thumbnailLink do Google Drive tự sinh (video/ảnh đều có)
    const meta = await drive.files.get({ fileId, fields: 'thumbnailLink' })
    const thumbnailLink = meta.data.thumbnailLink
    if (!thumbnailLink) return new NextResponse('Chưa có thumbnail', { status: 404 })

    // 2. Lấy link ảnh chất lượng lớn hơn thay vì icon nhỏ mặc định (=s220 -> =s600)
    const bigThumbnail = thumbnailLink.replace(/=s\d+/, '=s600')

    const { token } = await oauth2Client.getAccessToken()
    const imgResponse = await fetch(bigThumbnail, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    if (!imgResponse.ok) throw new Error(`Thumbnail fetch lỗi: ${imgResponse.status}`)

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', imgResponse.headers.get('content-type') || 'image/jpeg')
    responseHeaders.set('Cache-Control', 'public, max-age=3600')

    return new NextResponse(imgResponse.body, { status: 200, headers: responseHeaders })
  } catch (error: any) {
    console.error('Lỗi lấy Thumbnail Drive:', error)
    return new NextResponse(error.message || 'Lỗi hệ thống', { status: 500 })
  }
}
