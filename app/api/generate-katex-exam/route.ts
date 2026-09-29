import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const SYSTEM_PROMPT = `Bạn là chuyên gia sư phạm và số hóa ngân hàng đề thi học đường Việt Nam (Chuẩn cấu trúc 2026 của Bộ Giáo dục & ĐHQGHN HSA/TSA).
Nhiệm vụ của bạn là soạn các câu hỏi học tập chuẩn toán học & khoa học tự nhiên với công thức LaTeX / KaTeX đẹp mắt, chuyên nghiệp.

QUY TẮC BẮT BUỘC VỀ TOÁN HỌC & LATEX (KATEX):
1. Mọi ký hiệu, biến số, biểu thức, hàm số toán học, công thức vật lí, hóa học PHẢI được bọc trong cặp dấu $ ... $ (công thức nội dòng) hoặc $$ ... $$ (công thức khối nổi bật).
   Ví dụ: $y = f(x) = ax^3 + bx^2 + cx + d$, $\\int_0^1 (2x + 1)dx$, $\\sqrt{\\frac{x+1}{x-2}}$, $\\vec{u} = (1; -2; 3)$, $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.
2. Phương án trắc nghiệm: Các lựa chọn options phải chứa công thức LaTeX đầy đủ nếu là biểu thức toán học.
3. Lời giải chi tiết (explanation): PHẢI trình bày từng bước giải thích cặn kẽ bằng KaTeX, nêu rõ định lý, công thức áp dụng và kết quả cuối cùng.

CẤU TRÚC JSON TRẢ VỀ (CHỈ TRẢ VỀ DUY NHẤT ĐỐI TƯỢNG JSON NÀY, KHÔNG THÊM BẤT KỲ VĂN BẢN NGOÀI):
{
  "title": "Tên đề thi phù hợp với chủ đề được yêu cầu",
  "subject": "Tên môn học (Toán học, Vật lí, Hóa học, Sinh học...)",
  "duration": 45,
  "questions": [
    {
      "id": "q-1",
      "type": "single_choice",
      "text": "Nội dung câu hỏi 1 có chứa công thức $...$",
      "options": [
        "A. Nội dung đáp án A",
        "B. Nội dung đáp án B",
        "C. Nội dung đáp án C",
        "D. Nội dung đáp án D"
      ],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết từng bước có công thức KaTeX $...$"
    }
  ]
}
`

function extractJson(raw: string) {
  const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/({[\s\S]*})/)
  const jsonString = jsonMatch ? jsonMatch[1] : raw
  return JSON.parse(jsonString)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const {
      prompt = '',
      subject = 'Toán học',
      grade = 'Lớp 12',
      questionCount = 5,
      difficulty = 'Vận dụng',
      questionType = 'single_choice',
    } = body || {}

    if (!prompt.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp chủ đề hoặc nội dung cần soạn đề KaTeX.' },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Thiếu cấu hình GEMINI_API_KEY trên máy chủ.' },
        { status: 500 }
      )
    }

    const userPrompt = `Hãy tạo một đề thi gồm ${questionCount} câu hỏi môn ${subject} (${grade}), mức độ "${difficulty}", dạng câu hỏi "${questionType}".
Chủ đề / Yêu cầu cụ thể:
${prompt.trim()}

Hãy viết công thức toán học KaTeX thật chuẩn xác và tỉ mỉ, đầy đủ 4 phương án A, B, C, D cho trắc nghiệm hoặc đúng/sai/điền số tương ứng, kèm đáp án đúng và lời giải chi tiết cho từng câu!`

    let responseText = ''
    let usedModel = ''

    // 1. Thử gọi model chính: 'gemini-3.8-flash'
    try {
      usedModel = 'gemini-3.8-flash'
      const primaryModel = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })
      const result = await primaryModel.generateContent([
        { text: SYSTEM_PROMPT },
        { text: userPrompt },
      ])
      responseText = result.response.text()
    } catch (primaryErr: any) {
      console.warn(`[Gemini] gemini-3.8-flash gặp lỗi, chuyển ngay qua gemini-3.5-flash-lite:`, primaryErr?.message || primaryErr)
      
      // 2. Chuyển ngay qua model dự phòng: 'gemini-3.5-flash-lite'
      try {
        usedModel = 'gemini-3.5-flash-lite'
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' })
        const fallbackResult = await fallbackModel.generateContent([
          { text: SYSTEM_PROMPT },
          { text: userPrompt },
        ])
        responseText = fallbackResult.response.text()
      } catch (fallbackErr: any) {
        console.error(`[Gemini] Cả 2 model đều gặp lỗi hoặc quá tải:`, fallbackErr?.message || fallbackErr)
        // 3. Nếu cả 2 đều lỗi thì thông báo cho người dùng hệ thống quá tải
        return NextResponse.json(
          {
            error: 'Hệ thống AI hiện đang quá tải. Vui lòng thử lại sau ít phút hoặc giảm bớt số lượng câu hỏi!',
            details: fallbackErr?.message || 'Gemini models unavailable',
          },
          { status: 503 }
        )
      }
    }

    const parsedData = extractJson(responseText)

    if (!parsedData || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
      return NextResponse.json(
        { error: 'AI không thể định dạng danh sách câu hỏi KaTeX hợp lệ. Vui lòng thử lại.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      usedModel,
      data: parsedData,
    })
  } catch (error: any) {
    console.error('Lỗi API generate-katex-exam:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi xử lý soạn đề KaTeX từ máy chủ.',
      },
      { status: 500 }
    )
  }
}
