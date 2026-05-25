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
    const driveResponse = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )

    const nodeStream = driveResponse.data as Readable
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    const contentType =
      (driveResponse.headers['content-type'] as string | undefined) ||
      'application/pdf'

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'no-store, max-age=0')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${fileId}.pdf"`
    )

    const contentLength = driveResponse.headers['content-length']
    if (contentLength) {
      headers.set('Content-Length', String(contentLength))
    }

    return new Response(webStream, {
      status: 200,
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