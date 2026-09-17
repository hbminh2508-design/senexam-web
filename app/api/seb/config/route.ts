import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const examId = searchParams.get('examId') || ''
  const accessCode =
    searchParams.get('code') ||
    searchParams.get('auto_code') ||
    searchParams.get('token') ||
    ''

  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'seb.thicu.tailieufepn.senexam.com'

  const protoHeader = request.headers.get('x-forwarded-proto')
  const protocol = protoHeader || (request.url.startsWith('https') ? 'https' : (host.includes('localhost') ? 'http' : 'http'))

  const autoParam = accessCode ? `?auto_code=${encodeURIComponent(accessCode)}` : ''
  const targetUrl = `${protocol}://${host}/seb-exam/${examId}${autoParam}`
  // Giao thức deep-link: sebs:// cho HTTPS, seb:// cho HTTP
  const sebsProtocolUrl = protocol === 'https' ? `sebs://${host}/seb-exam/${examId}${autoParam}` : `seb://${host}/seb-exam/${examId}${autoParam}`

  // Tạo file cấu hình Safe Exam Browser định dạng chuẩn XML Plist (.seb)
  const sebConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_Win_3.7.0</string>
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
    <false/>
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
    <key>allowSpellCheck</key>
    <false/>
    <key>insideSebUA</key>
    <true/>
</dict>
</plist>`

  // Nếu client gọi với ?download=1 thì trả về file download .seb
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
    downloadUrl: `/api/seb/config?examId=${examId}${autoParam ? `&code=${encodeURIComponent(accessCode)}` : ''}&download=1`,
  })
}
