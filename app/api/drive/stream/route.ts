import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
// Không cần ép runtime nodejs nữa vì native fetch chạy ngon trên mọi môi trường

// Cấu hình OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const download = url.searchParams.get('download') === '1'

    if (!fileId) return new NextResponse('Thiếu fileId', { status: 400 })

    // 1. Lấy Access Token bảo mật (Tự động làm mới nếu hết hạn)
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error('Không lấy được Access Token từ Google')

    // 2. Bắt lệnh "Range" từ VLC hoặc Trình duyệt để xử lý tua/cắt đoạn
    const rangeHeader = request.headers.get('range')
    const fetchHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}` // Gắn token bảo mật vào header
    }
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader
    }

    // 3. Dùng Native fetch() tạo đường ống xuyên thấu (Bỏ qua node:stream)
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders })

    if (!driveResponse.ok) {
      throw new Error(`Drive API Error: ${driveResponse.status}`)
    }

    // 4. Sao chép và bổ sung Headers cho Client
    const responseHeaders = new Headers(driveResponse.headers)
    responseHeaders.set('Accept-Ranges', 'bytes') // Cực kỳ quan trọng để VLC biết có thể tua
    responseHeaders.set('Access-Control-Allow-Origin', '*')

    // Nội suy đuôi file thông minh từ Content-Type
    const contentType = driveResponse.headers.get('content-type') || 'application/octet-stream'
    let ext = 'pdf'
    if (contentType.includes('mp4')) ext = 'mp4'
    else if (contentType.includes('matroska')) ext = 'mkv'
    else if (contentType.includes('webm')) ext = 'webm'
    else if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('jpeg')) ext = 'jpg'
    else if (contentType.includes('audio')) ext = 'mp3'

    responseHeaders.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="senexam_file_${fileId}.${ext}"`
    )

    // 5. Trả thẳng luồng Web Stream (body) nguyên bản từ Google Drive cho VLC
    return new NextResponse(driveResponse.body, {
      status: driveResponse.status,
      statusText: driveResponse.statusText,
      headers: responseHeaders
    })

  } catch (error: any) {
    console.error('Lỗi Stream xuyên thấu:', error)
    return new NextResponse(error.message || 'Lỗi hệ thống', { status: 500 })
  }
}