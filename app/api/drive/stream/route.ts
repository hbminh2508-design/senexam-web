import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'node:stream'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function GET(request: Request) {
  const url = new URL(request.url)
  const fileId = url.searchParams.get('fileId')
  const download = url.searchParams.get('download') === '1'

  if (!fileId) {
    return NextResponse.json({ error: 'Thiếu fileId' }, { status: 400 })
  }

  try {
    // 1. Đón lõng yêu cầu "Range" (Tua video, đọc nhanh trang PDF) từ trình duyệt
    const rangeHeader = request.headers.get('range')
    const requestHeaders: Record<string, string> = {}
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader
    }

    // 2. Gửi request xuống Google Drive kèm theo Range
    const driveResponse = await drive.files.get(
      { fileId, alt: 'media' },
      { 
        responseType: 'stream',
        headers: requestHeaders 
      }
    )

    const nodeStream = driveResponse.data as Readable
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    // 3. Phân tích loại tệp để nội suy đuôi mở rộng linh hoạt
    const contentType = (driveResponse.headers['content-type'] as string) || 'application/pdf'
    let ext = 'pdf'
    if (contentType.includes('mp4')) ext = 'mp4'
    else if (contentType.includes('matroska')) ext = 'mkv'
    else if (contentType.includes('webm')) ext = 'webm'
    else if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('jpeg')) ext = 'jpg'
    else if (contentType.includes('audio')) ext = 'mp3'

    // 4. Thiết lập Headers chuẩn xác cho luồng trả về
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'no-store, max-age=0')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Accept-Ranges', 'bytes') // Báo cho trình duyệt: Hệ thống hỗ trợ tua/cắt đoạn
    
    headers.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="senexam_file_${fileId}.${ext}"`
    )

    // Chuyển tiếp các tham số cắt đoạn (nếu Drive trả về 206 Partial Content)
    if (driveResponse.headers['content-length']) {
      headers.set('Content-Length', String(driveResponse.headers['content-length']))
    }
    if (driveResponse.headers['content-range']) {
      headers.set('Content-Range', String(driveResponse.headers['content-range']))
    }

    // 5. Trả về luồng stream với trạng thái gốc từ Drive (200 OK hoặc 206 Partial Content)
    return new Response(webStream, {
      status: driveResponse.status,
      statusText: driveResponse.statusText,
      headers,
    })
  } catch (error: any) {
    console.error('Lỗi truyền luồng dữ liệu từ Drive:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể đọc tệp tin' },
      { status: 500 }
    )
  }
}