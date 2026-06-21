import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

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

    // 1. Lấy Access Token bảo mật
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error('Không lấy được Access Token từ Google')

    // 2. Bắt lệnh "Range" từ VLC / Trình duyệt để xử lý tua/cắt đoạn
    const rangeHeader = request.headers.get('range')
    const fetchHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}`
    }
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader
    }

    // 3. Dùng Native fetch() tạo đường ống trực tiếp
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders })

    if (!driveResponse.ok) {
      throw new Error(`Drive API Error: ${driveResponse.status}`)
    }

    // 4. 🌟 FIX LỖI PDF Ở ĐÂY: KHÔNG COPY TOÀN BỘ HEADER CỦA GOOGLE NỮA
    // Tạo Headers mới tinh, sạch sẽ để trình duyệt không bị nhầm lẫn
    const responseHeaders = new Headers()
    
    // Header cốt lõi cho VLC và Video
    responseHeaders.set('Accept-Ranges', 'bytes') 
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Cache-Control', 'no-store, max-age=0') // Ép không lưu cache lỗi

    // Phục hồi Content-Type chính xác
    const contentType = driveResponse.headers.get('content-type') || 'application/pdf'
    responseHeaders.set('Content-Type', contentType)

    // Lọc và giữ lại độ dài byte (Bắt buộc phải có để đọc được PDF)
    const contentLength = driveResponse.headers.get('content-length')
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    const contentRange = driveResponse.headers.get('content-range')
    if (contentRange) responseHeaders.set('Content-Range', contentRange)

    // Nội suy đuôi file
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

    // 5. Trả thẳng luồng Web Stream cho Client
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