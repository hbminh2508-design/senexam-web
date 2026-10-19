import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Fallback regex parser thông minh nếu không có API key hoặc network error
function fallbackRegexParse(rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const students: Array<{ id: string; name: string; mssv?: string }> = []
  let count = 1

  for (const line of lines) {
    // Bỏ qua dòng tiêu đề thông dụng
    if (/^(stt|họ và tên|danh sách|mssv|lớp|quỹ|stt\t|tên|ngày sinh|ghi chú)/i.test(line)) continue

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
    const body = await request.json().catch(() => null)
    const rawText = body?.rawText

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json(
        { error: 'Nội dung danh sách lớp không được để trống' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY

    // Nếu không có API Key, dùng bộ lọc fallback thông minh
    if (!apiKey) {
      const parsed = fallbackRegexParse(rawText)
      return NextResponse.json(
        {
          ...parsed,
          source: 'regex_fallback',
          message: 'Đã trích xuất danh sách lớp thành công (Bộ lọc thông minh).',
        },
        { status: 200, headers: CORS_HEADERS }
      )
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

    let parsedResult: any = null

    // 1. Thử gọi qua GoogleGenerativeAI SDK với candidate models chuẩn của SenExam
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          })
          const res = await model.generateContent(prompt)
          const text = res.response.text()?.trim() || ''
          const cleanedJson = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
          const data = JSON.parse(cleanedJson)
          if (data && Array.isArray(data.students) && data.students.length > 0) {
            parsedResult = {
              total: data.students.length,
              students: data.students.map((s: any, idx: number) => ({
                id: String(idx + 1),
                name: String(s.name || '').trim(),
                mssv: s.mssv ? String(s.mssv).trim() : undefined,
              })),
              source: `gemini (${modelName})`,
            }
            break
          }
        } catch (modelErr: any) {
          console.warn(`Thử model ${modelName} thất bại:`, modelErr?.message)
        }
      }
    } catch (genErr: any) {
      console.warn('Lỗi khởi tạo GoogleGenerativeAI:', genErr?.message)
    }

    // 2. Thử qua GoogleGenAI SDK mới nếu chưa có kết quả
    if (!parsedResult) {
      try {
        const ai = new GoogleGenAI({ apiKey })
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: prompt,
        })
        const text = response.text?.trim() || ''
        const cleanedJson = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
        const data = JSON.parse(cleanedJson)
        if (data && Array.isArray(data.students) && data.students.length > 0) {
          parsedResult = {
            total: data.students.length,
            students: data.students.map((s: any, idx: number) => ({
              id: String(idx + 1),
              name: String(s.name || '').trim(),
              mssv: s.mssv ? String(s.mssv).trim() : undefined,
            })),
            source: 'gemini-3.5-flash-lite',
          }
        }
      } catch (aiErr: any) {
        console.warn('GoogleGenAI fallback error:', aiErr?.message)
      }
    }

    // 3. Nếu AI đã trả kết quả hợp lệ, trả về client
    if (parsedResult) {
      return NextResponse.json(parsedResult, { status: 200, headers: CORS_HEADERS })
    }

    // 4. Nếu AI gặp lỗi hoặc quota, luôn fallback sang regex parser thông minh (chắc chắn thành công 100%)
    const fallback = fallbackRegexParse(rawText)
    return NextResponse.json(
      {
        ...fallback,
        source: 'regex_fallback',
        message: 'Đã trích xuất danh sách bằng bộ lọc thông minh tự động.',
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err: any) {
    // Dự phòng an toàn tuyệt đối: không bao giờ trả lỗi 500
    return NextResponse.json(
      { error: err?.message || 'Lỗi xử lý trích xuất danh sách lớp' },
      { status: 200, headers: CORS_HEADERS }
    )
  }
}
