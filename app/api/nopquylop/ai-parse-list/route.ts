import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

// Fallback regex parser nếu không có API key hoặc network error
function fallbackRegexParse(rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const students: Array<{ id: string; name: string; mssv?: string }> = []
  let count = 1

  for (const line of lines) {
    // Bỏ qua dòng tiêu đề thông dụng
    if (/^(stt|họ và tên|danh sách|mssv|lớp|quỹ|stt\t|tên)/i.test(line)) continue

    // Thử tách MSSV (chuỗi số 6-12 chữ số)
    const mssvMatch = line.match(/\b(\d{7,10})\b/)
    const mssv = mssvMatch ? mssvMatch[1] : ''

    // Loại bỏ STT ở đầu (ví dụ: "1.", "1/ ", "1\t")
    let cleaned = line.replace(/^\d+[\.\/\-\)]\s*/, '')
    if (mssv) {
      cleaned = cleaned.replace(mssv, '').replace(/[,\t\-\|]/g, ' ')
    }
    // Lọc ký tự thừa
    cleaned = cleaned.replace(/[0-9\t\-\|\(\)]/g, ' ').replace(/\s+/g, ' ').trim()

    if (cleaned.length >= 2) {
      students.push({
        id: String(count++),
        name: cleaned,
        mssv: mssv || undefined,
      })
    }
  }

  return { total: students.length, students }
}

export async function POST(request: Request) {
  try {
    const { rawText } = await request.json()

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'Nội dung danh sách lớp không được để trống' }, { status: 400 })
    }

    // Nếu không có API Key, dùng bộ lọc fallback thông minh
    if (!ai) {
      const parsed = fallbackRegexParse(rawText)
      return NextResponse.json({
        ...parsed,
        source: 'regex_fallback',
        message: 'Đã trích xuất danh sách bằng bộ lọc thông minh (Thiếu GEMINI_API_KEY).',
      })
    }

    const prompt = `Bạn là trợ lý AI chuyên xử lý và chuẩn hóa dữ liệu danh sách học sinh / sinh viên lớp học.
Nhiệm vụ của bạn: Hãy phân tích văn bản thô bên dưới (có thể copy từ Excel, Zalo, bảng điểm danh, tin nhắn nhóm), lọc sạch các thông tin thừa, trích xuất chính xác Họ và Tên cùng Mã số sinh viên (MSSV nếu có), và tính tổng số người.

VĂN BẢN DANH SÁCH THÔ:
"""
${rawText.slice(0, 20000)}
"""

YÊU CẦU ĐẦU RA:
- Trả về DUY NHẤT một chuỗi JSON hợp lệ không có giải thích nào thêm, không dùng markdown code fence.
- Cấu trúc JSON:
{
  "total": <tổng số sinh viên>,
  "students": [
    {
      "id": "1",
      "name": "Nguyễn Văn An",
      "mssv": "20221001"
    }
  ]
}

Lưu ý:
1. "name" phải là Họ và Tên viết hoa chữ cái đầu (VD: "Lê Hoàng Cường"). Loại bỏ số thứ tự, số điện thoại, dấu gạch nối, ngày sinh khỏi tên.
2. "mssv" là mã số sinh viên (thường là dãy số 7-10 chữ số). Nếu dòng đó không có MSSV, hãy để chuỗi rỗng "".
3. Đếm chuẩn xác "total".
`

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
      })

      const text = response.text?.trim() || ''
      // Làm sạch markdown nếu có
      const cleanedJson = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      const data = JSON.parse(cleanedJson)

      if (data && Array.isArray(data.students)) {
        return NextResponse.json({
          total: data.students.length,
          students: data.students.map((s: any, idx: number) => ({
            id: String(idx + 1),
            name: String(s.name || '').trim(),
            mssv: s.mssv ? String(s.mssv).trim() : undefined,
          })),
          source: 'gemini-3.5-flash-lite',
        })
      }
    } catch (aiErr: any) {
      console.warn('Gemini 3.5 Flash Lite parse failed, falling back to regex:', aiErr?.message)
    }

    // Fallback if AI fails or returns invalid format
    const fallback = fallbackRegexParse(rawText)
    return NextResponse.json({
      ...fallback,
      source: 'regex_fallback',
      message: 'Đã trích xuất danh sách bằng bộ lọc dự phòng thông minh.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý trích xuất danh sách lớp' }, { status: 500 })
  }
}
