import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

// 1. Dùng OAuth2 thay cho GoogleAuth cũ
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Phải khớp với Redirect URI đã thiết lập
)

// 2. Nạp Refresh Token (Chìa khóa vạn năng của tài khoản 5TB)
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

// 3. Khởi tạo Drive API với quyền của tài khoản 5TB
const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function POST(request: Request) {
  try {
    // Phân tích header để biết Client đang dùng tính năng nào
    const contentType = request.headers.get('content-type') || ''
    
    // 🌟 LẤY TÊN MIỀN HIỆN TẠI (VD: https://senexam.me) ĐỂ BẢO LÃNH CORS
    const origin = request.headers.get('origin') || '*' 

    // ====================================================================
    // 🚀 LUỒNG 1: BYPASS VERCEL (TẢI FILE KHỔNG LỒ TỪ LIBRARY)
    // ====================================================================
    if (contentType.includes('application/json')) {
      const { fileName, mimeType } = await request.json()

      if (!fileName || !mimeType) {
        return NextResponse.json({ error: 'Thiếu thông tin file JSON' }, { status: 400 })
      }

      // Lấy Access Token tươi từ OAuth2
      const { token: accessToken } = await oauth2Client.getAccessToken()
      if (!accessToken) throw new Error("Không thể lấy Access Token từ OAuth2")

      const metadata = {
        name: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!]
      }

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'Origin': origin // 🌟 CHÌA KHÓA MỞ KHÓA CORS CHO TRÌNH DUYỆT Ở ĐÂY
        },
        body: JSON.stringify(metadata)
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Lỗi khởi tạo Google Drive: ${errText}`)
      }

      const uploadUrl = res.headers.get('Location')
      if (!uploadUrl) throw new Error("Google không trả về URL tải lên")

      return NextResponse.json({ uploadUrl })
    }

    // ====================================================================
    // 📦 LUỒNG 2: DIRECT UPLOAD CŨ (TẢI ĐỀ THI NHẸ TỪ ADMIN DASHBOARD)
    // ====================================================================
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string

    if (!file || !title) {
      return NextResponse.json({ error: 'Thiếu file hoặc tên đề thi' }, { status: 400 })
    }

    // Chuyển dữ liệu file thành luồng (Stream)
    const buffer = Buffer.from(await file.arrayBuffer())
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    // Tiến hành tải file lên thư mục
    const driveResponse = await drive.files.create({
      requestBody: {
        name: `${title}.pdf`,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id', // Chỉ lấy ID trả về
    })

    const driveFileId = driveResponse.data.id

    return NextResponse.json({ success: true, driveFileId })

  } catch (error: any) {
    console.error('Lỗi upload Google Drive:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tải lên Drive: ' + error.message }, { status: 500 })
  }
}