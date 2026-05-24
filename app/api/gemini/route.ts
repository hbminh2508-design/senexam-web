import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

export async function POST(request: Request) {
  try {
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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