import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const message = body?.message || body?.prompt || ''
    const deepThink = !!body?.deepThink

    if (!message.trim()) {
      return NextResponse.json({ error: 'Nội dung câu hỏi không được để trống' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Chưa cấu hình GEMINI_API_KEY trên server.',
          text: 'Hệ thống chưa tìm thấy khóa API của AI. Vui lòng liên hệ ban quản trị để kích hoạt.',
          reply: 'Hệ thống chưa tìm thấy khóa API của AI. Vui lòng liên hệ ban quản trị để kích hoạt.',
        },
        { status: 200 }
      )
    }

    const baseSystemPrompt = `Bạn là SenAI 3.7 — Trợ lý AI giáo dục & luyện thi thông minh của nền tảng SenExam.
Nhiệm vụ của bạn là giải đáp bài tập, giải thích chi tiết đáp án câu hỏi trắc nghiệm/tự luận, cung cấp phương pháp làm bài và lời khuyên ôn thi.
Quy tắc trả lời:
- Luôn sử dụng ký hiệu LaTeX bọc trong dấu $ hoặc $$ cho mọi công thức Toán, Lý, Hóa.
- Sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho số thập phân tiếng Việt nếu cần.
- Trình bày mạch lạc, dễ hiểu, từng bước rõ ràng, giải thích vì sao đáp án đúng là chính xác và vì sao các phương án khác bị loại trừ.
- Nếu là chế độ Deep Think, hãy suy luận logic nhiều bước sâu sắc và toàn diện.`

    const modelName = deepThink ? 'gemini-3.7-flash' : 'gemini-3.5-flash-lite'

    let reply = ''

    // Thử gọi qua GoogleGenerativeAI SDK
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      let model = genAI.getGenerativeModel({ model: modelName })
      
      const fullPrompt = `${baseSystemPrompt}\n\n${deepThink ? '[Chế độ Deep Think 3.7 - Tư duy chuyên sâu]:\n' : ''}${message}`
      const result = await model.generateContent(fullPrompt)
      reply = result.response.text()
    } catch (sdkError: any) {
      console.warn('Lỗi gọi model đầu tiên, thử fallback:', sdkError?.message)
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' })
        const fallbackResult = await fallbackModel.generateContent(`${baseSystemPrompt}\n\n${message}`)
        reply = fallbackResult.response.text()
      } catch (fallbackError: any) {
        // Thử qua GoogleGenAI SDK
        try {
          const ai = new GoogleGenAI({ apiKey })
          const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${baseSystemPrompt}\n\n${message}`,
          })
          reply = res.text ?? ''
        } catch (e: any) {
          throw new Error(`Lỗi kết nối Gemini: ${e.message || fallbackError.message || sdkError.message}`)
        }
      }
    }

    return NextResponse.json({
      text: reply,
      reply: reply,
      model: modelName,
    })
  } catch (error: any) {
    console.error('Lỗi API SenAI Chat:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi xử lý yêu cầu AI',
        text: `Đã xảy ra lỗi khi trao đổi với SenAI: ${error.message || 'Vui lòng thử lại sau.'}`,
        reply: `Đã xảy ra lỗi khi trao đổi với SenAI: ${error.message || 'Vui lòng thử lại sau.'}`,
      },
      { status: 200 }
    )
  }
}
