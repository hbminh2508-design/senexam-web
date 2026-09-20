import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Chuẩn hóa tên file thành dạng: ten-file-da-duoc-dat.<ext>
function formatDownloadFileName(rawTitle: string, fileUrl: string, fileType?: string): string {
  let title = (rawTitle || 'tai-lieu').trim()
  
  // Lấy đuôi file dự kiến
  let ext = (fileType || '').toLowerCase().replace(/^\./, '')
  if (!ext) {
    if (fileUrl.includes('.pdf') || fileUrl.includes('pdf')) ext = 'pdf'
    else if (fileUrl.includes('.docx') || fileUrl.includes('document')) ext = 'docx'
    else if (fileUrl.includes('.pptx') || fileUrl.includes('presentation')) ext = 'pptx'
    else if (fileUrl.includes('.xlsx') || fileUrl.includes('spreadsheet')) ext = 'xlsx'
    else if (fileUrl.includes('.mp3') || fileUrl.includes('audio')) ext = 'mp3'
    else if (fileUrl.includes('.mp4') || fileUrl.includes('video')) ext = 'mp4'
    else if (fileUrl.includes('.png')) ext = 'png'
    else if (fileUrl.includes('.jpg') || fileUrl.includes('.jpeg')) ext = 'jpg'
    else ext = 'pdf'
  }

  // Nếu title đã có đuôi file thì bỏ đuôi cũ
  const extRegex = new RegExp(`\\.${ext}$`, 'i')
  title = title.replace(extRegex, '')

  // Chuyển tiếng Việt có dấu thành không dấu dạng slug: ten-file-da-duoc-dat
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const baseName = normalized || 'tai-lieu-fepn'
  return `${baseName}.${ext}`
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileUrl = url.searchParams.get('url')
    const customTitle = url.searchParams.get('title') || 'tai-lieu'
    const fileType = url.searchParams.get('type') || ''

    if (!fileUrl) {
      return new NextResponse('Thiếu tham số url', { status: 400 })
    }

    const downloadFileName = formatDownloadFileName(customTitle, fileUrl, fileType)

    // 1. Nếu là Google Drive
    const driveMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1]

      // Thử dùng Service / OAuth2 Token nếu server có cấu hình
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'https://developers.google.com/oauthplayground'
          )
          oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
          const { token } = await oauth2Client.getAccessToken()

          if (token) {
            const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
            const driveRes = await fetch(driveApiUrl, {
              headers: { Authorization: `Bearer ${token}` },
            })

            if (driveRes.ok && driveRes.body) {
              const headers = new Headers()
              const cType = driveRes.headers.get('content-type') || 'application/octet-stream'
              headers.set('Content-Type', cType)
              headers.set(
                'Content-Disposition',
                `attachment; filename="${downloadFileName}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
              )
              headers.set('Access-Control-Allow-Origin', '*')

              return new NextResponse(driveRes.body, {
                status: 200,
                headers,
              })
            }
          }
        } catch (authErr) {
          console.warn('Lỗi OAuth Drive API, chuyển sang tải trực tiếp từ Google uc:', authErr)
        }
      }

      // Nếu không có OAuth token hoặc OAuth thất bại: Tải trực tiếp qua Google UC export
      const directGoogleUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      const directRes = await fetch(directGoogleUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (directRes.ok && directRes.body) {
        const headers = new Headers()
        const cType = directRes.headers.get('content-type') || 'application/octet-stream'
        headers.set('Content-Type', cType)
        headers.set(
          'Content-Disposition',
          `attachment; filename="${downloadFileName}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
        )
        return new NextResponse(directRes.body, { status: 200, headers })
      }
    }

    // 2. Đối với tệp thông thường (Supabase Storage, CDN, link trực tiếp...)
    const response = await fetch(fileUrl)
    if (!response.ok) {
      // Nếu không thể fetch trực tiếp trên server, chuyển hướng tải xuống
      return NextResponse.redirect(fileUrl)
    }

    const headers = new Headers()
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    headers.set('Content-Type', contentType)
    headers.set(
      'Content-Disposition',
      `attachment; filename="${downloadFileName}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
    )

    return new NextResponse(response.body, {
      status: 200,
      headers,
    })
  } catch (err: any) {
    console.error('Lỗi download FEPN material:', err)
    return new NextResponse('Lỗi tải tệp: ' + (err?.message || 'Server error'), { status: 500 })
  }
}
