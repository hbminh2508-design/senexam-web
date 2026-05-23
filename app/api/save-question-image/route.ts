import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function POST(request: Request) {
  try {
    const { image, fileName, sectionId, questionIndex } = await request.json()

    if (!image || !fileName || !sectionId) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 })
    }

    const base64Data = image.split(',')[1] || image
    const buffer = Buffer.from(base64Data, 'base64')
    const timestamp = Date.now()
    const fileTitle = `exam-questions/${sectionId}/${questionIndex}-${timestamp}.jpg`

    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileTitle,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: 'image/jpeg',
        body: buffer,
      },
      fields: 'id',
    })

    const fileId = uploadRes.data.id
    if (!fileId) {
      throw new Error('Google không trả về mã file ảnh.')
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    return NextResponse.json({
      success: true,
      fileId,
      url: `https://drive.google.com/uc?export=view&id=${fileId}`,
    })
  } catch (error: any) {
    console.error('Save question image error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi lưu ảnh câu hỏi' },
      { status: 500 }
    )
  }
}