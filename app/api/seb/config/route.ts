import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const examId = searchParams.get('examId') || ''
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'seb.thicu.tailieufepn.senexam.com'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  const targetUrl = `${protocol}://${host}/seb-exam/${examId}`
  const sebsProtocolUrl = `sebs://${host}/seb-exam/${examId}`

  // Tạo file cấu hình Safe Exam Browser định dạng chuẩn XML Plist (.seb)
  const sebConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_Win_3.5.0</string>
    <key>startURL</key>
    <string>${targetUrl}</string>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>allowQuit</key>
    <true/>
    <key>quitURL</key>
    <string>${protocol}://${host}/seb-dashboard</string>
    <key>quitURLConfirm</key>
    <true/>
    <key>browserWindowAllowReload</key>
    <true/>
    <key>showTaskBar</key>
    <true/>
    <key>allowDownUploads</key>
    <false/>
    <key>enableAltTab</key>
    <false/>
    <key>enableSwitchToApplications</key>
    <false/>
    <key>enableRightMouse</key>
    <false/>
    <key>enableTouchExit</key>
    <false/>
    <key>hookKeys</key>
    <true/>
    <key>browserWindowShowURL</key>
    <false/>
    <key>allowFlashFullscreen</key>
    <false/>
</dict>
</plist>`

  // Nếu client gọi với ?download=1 thì trả về file download
  if (searchParams.get('download') === '1') {
    return new NextResponse(sebConfigXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/seb',
        'Content-Disposition': `attachment; filename="senexam-seb-${examId || 'room'}.seb"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  }

  return NextResponse.json({
    success: true,
    examId,
    targetUrl,
    sebsUrl: sebsProtocolUrl,
    downloadUrl: `/api/seb/config?examId=${examId}&download=1`,
  })
}
