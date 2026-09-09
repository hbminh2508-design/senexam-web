import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

// Rate limiting in-memory: 20 requests per minute per IP
const ipCallCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now()
  const record = ipCallCounts.get(ip)
  if (!record || now > record.resetAt) {
    ipCallCounts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= limit) return false
  record.count++
  return true
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi 1 phút trước khi thử lại.' },
        { status: 429 }
      )
    }

    if (!ai) {
      return NextResponse.json(
        { error: 'Thiếu GEMINI_API_KEY trong biến môi trường server.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

    if (!prompt) {
      return NextResponse.json({ error: 'Nội dung prompt không được để trống' }, { status: 400 })
    }

    if (prompt.length > 15000) {
      return NextResponse.json({ error: 'Nội dung prompt vượt quá giới hạn cho phép (15,000 ký tự)' }, { status: 400 })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
    })

    return NextResponse.json({ text: response.text ?? '' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
      return NextResponse.json(
        { error: 'Gemini đang bị giới hạn tần suất. Vui lòng thử lại sau ít phút.' },
        { status: 429 }
      )
    }

    console.error('Lỗi kết nối Gemini API:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: message },
      { status: 500 }
    )
  }
}