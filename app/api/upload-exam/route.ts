import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

// 1. Dùng OAuth2 thay cho GoogleAuth cũ
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Phải khớp với Redirect URI đã thiết lập
)

// 2. Nạp Refresh Token (Chìa khóa vạn năng)
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

// 3. Khởi tạo Drive API với quyền của tài khoản 5TB
const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function POST(request: Request) {
  try {
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