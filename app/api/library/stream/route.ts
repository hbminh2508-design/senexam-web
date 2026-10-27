import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { google } from 'googleapis'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const STORAGE_DIR = process.env.LIBRARY_STORAGE_DIR || path.join(process.cwd(), 'storage', 'library')

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const docId = url.searchParams.get('id')
    const isDownload = url.searchParams.get('download') === '1'

    if (!docId) {
      return new NextResponse('Thiếu mã tài liệu (id)', { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: doc, error: docError } = await supabaseAdmin
      .from('library_documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle()

    if (docError || !doc) {
      return new NextResponse('Không tìm thấy tài liệu', { status: 404 })
    }

    let metadata: any = null
    if (doc.description) {
      try {
        metadata = JSON.parse(doc.description)
      } catch {}
    }

    const allowDownload = metadata?.allowDownload !== false

    // Phân quyền tải xuống
    if (isDownload) {
      if (!allowDownload) {
        return new NextResponse('Tài liệu này không cho phép tải về', { status: 403 })
      }

      // Bắt buộc phải có tài khoản đăng nhập mới được tải về
      const user = await getUserFromRequest(request)
      if (!user) {
        return new NextResponse('Vui lòng đăng nhập để tải tài liệu này', { status: 401 })
      }
    }

    // 1. Nếu là file lưu trên Azure (local disk)
    if (doc.drive_file_id?.startsWith('azure:') || metadata?.storage === 'azure') {
      const filename = metadata?.filename || doc.drive_file_id.replace(/^azure:/, '')
      const filePath = path.join(STORAGE_DIR, filename)

      try {
        const fileStat = await fs.stat(filePath)
        const fileBuffer = await fs.readFile(filePath)

        const contentType = metadata?.mimeType || 'application/pdf'
        const safeTitle = encodeURIComponent(doc.title || 'document.pdf')

        const responseHeaders = new Headers()
        responseHeaders.set('Content-Type', contentType)
        responseHeaders.set('Content-Length', fileStat.size.toString())
        responseHeaders.set('Accept-Ranges', 'bytes')

        if (isDownload) {
          responseHeaders.set('Content-Disposition', `attachment; filename="${safeTitle}"; filename*=UTF-8''${safeTitle}`)
        } else {
          responseHeaders.set('Content-Disposition', 'inline')
        }

        responseHeaders.set('Cache-Control', 'public, max-age=3600')
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: responseHeaders,
        })
      } catch (fileErr: any) {
        console.error('Lỗi đọc file từ Azure storage:', fileErr)
        return new NextResponse('Không thể tìm thấy tệp trên máy chủ Azure', { status: 404 })
      }
    }

    // 2. Nếu là file cũ lưu trên Google Drive
    const driveFileId = doc.drive_file_id
    if (!driveFileId) {
      return new NextResponse('Tài liệu không có đường dẫn tệp', { status: 404 })
    }

    const { token } = await oauth2Client.getAccessToken()
    if (!token) {
      return new NextResponse('Lỗi xác thực Google Drive', { status: 500 })
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`
    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!driveRes.ok) {
      return new NextResponse(`Lỗi kết nối tệp từ Google Drive: ${driveRes.status}`, { status: driveRes.status })
    }

    const arrayBuffer = await driveRes.arrayBuffer()
    const contentType = driveRes.headers.get('content-type') || 'application/pdf'
    const safeTitle = encodeURIComponent(doc.title || 'document.pdf')

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Accept-Ranges', 'bytes')

    if (isDownload) {
      responseHeaders.set('Content-Disposition', `attachment; filename="${safeTitle}"; filename*=UTF-8''${safeTitle}`)
    } else {
      responseHeaders.set('Content-Disposition', 'inline')
    }

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: responseHeaders,
    })
  } catch (err: any) {
    console.error('Lỗi stream thư viện:', err)
    return new NextResponse(err?.message || 'Lỗi đọc tệp', { status: 500 })
  }
}
