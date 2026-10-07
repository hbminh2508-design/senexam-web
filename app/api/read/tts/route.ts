import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const text = (searchParams.get('text') || '').trim()
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'vi'

    if (!text) {
      return new NextResponse('Missing text parameter', { status: 400 })
    }

    // Giới hạn độ dài mỗi câu an toàn cho Google TTS (dưới 200 ký tự)
    const queryText = text.slice(0, 200)
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(
      queryText
    )}`

    const res = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })

    if (!res.ok) {
      return new NextResponse(`Google TTS upstream error: ${res.statusText}`, { status: res.status })
    }

    const audioBuffer = await res.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (error: any) {
    return new NextResponse(`Internal error: ${error?.message || 'unknown'}`, { status: 500 })
  }
}
