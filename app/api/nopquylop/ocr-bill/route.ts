import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const rawImage = String(body.image || '')
    if (!rawImage) {
      return NextResponse.json({ error: 'Không nhận được ảnh hóa đơn' }, { status: 400 })
    }

    let mimeType = 'image/jpeg'
    let base64Data = rawImage
    const match = rawImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
    if (match) {
      mimeType = match[1]
      base64Data = match[2]
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `Bạn là hệ thống AI trích xuất thông tin hóa đơn / bill chi tiêu cho lớp ME2.
Hãy đọc ảnh hóa đơn/biên lai mua hàng hoặc bill chuyển khoản sau và trích xuất:
1. Tên mục chi hoặc nơi mua / đơn vị cung cấp (ví dụ: "In tài liệu photocopy", "Siêu thị WinMart", "Quán cà phê", "Mua hoa 20/10"...)
2. Tổng số tiền thanh toán thực tế (số nguyên VND, ví dụ 150000)
3. Ngày chi tiêu (định dạng YYYY-MM-DD nếu có, hoặc để trống)

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG markdown, không giải thích):
{
  "title": "Tên khoản chi hoặc tên nơi bán",
  "amount": 150000,
  "spentAt": "YYYY-MM-DD",
  "confidence": 0.95
}`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ])

    const text = result.response.text()
    let parsed: any = null
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    }

    return NextResponse.json({
      success: true,
      data: parsed || { title: '', amount: 0, spentAt: '' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi đọc hóa đơn bằng AI' }, { status: 500 })
  }
}
