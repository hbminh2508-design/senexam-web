import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json({ error: `Google token endpoint error: ${text}` }, { status: response.status })
    }

    const data = await response.json()
    // Trả về accessToken và folderId (folderId không nhạy cảm)
    return NextResponse.json({ accessToken: data.access_token, folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}
