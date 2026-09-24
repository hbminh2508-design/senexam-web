import { GoogleGenAI } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const apiKey = process.env.GEMINI_API_KEY

const SENGRAPH_SYSTEM_PROMPT = `Bạn là Sen AI — Trợ lý Toán học & Đồ thị cao cấp của SenGraph thuộc hệ sinh thái SenExam.
Nhiệm vụ chính: Phân tích đồ thị hàm số 2D và mô hình không gian 3D, giải thích tính chất toán học (tập xác định, tập giá trị, cực trị, điểm uốn, tiệm cận, tính đối xứng, giao điểm), và gợi ý công thức phương trình để tạo ra các hình thù toán học đẹp mắt.

TRI THỨC HỆ SINH THÁI SENEXAM MỚI:
- SenGraph (sengraph.senexam.me): Nền tảng vẽ đồ thị toán học trực quan hỗ trợ cả 2D Cartesian (Oxy) và 3D WebGL (Oxyz), có bàn phím toán học ảo chuyên dụng, quản lý nhiều phương trình cùng lúc, phân tích hình học bằng Sen AI.
- Sen Exam Canvas (seb.thicu.tailieufepn.senexam.me): Môi trường khảo thí trực tuyến bảo mật cao qua Safe Exam Browser, có camera giám thị AI cục bộ (phát hiện thiếu sáng, phát hiện vật lạ che mặt, kiểm tra đột xuất mỗi 1 phút mà không làm gián đoạn học sinh).
- New Dashboard (/new-dashboard): Trung tâm điều hành học tập hiện đại của SenExam, tích hợp lịch thi, quản lý bài nộp, lối tắt nhanh đến SenGraph, SenAI Studio, Thư viện và chế độ Focus.
- TSV FEPN (tsv.fepn.senexam.me): Cổng tài liệu chuyên sâu dành cho sinh viên/học sinh, hỗ trợ tải tài liệu trực tiếp không qua Drive, tính điểm GPA học kỳ và tổng kết, recap môn học.
- SenAI Studio (/new-senai-studio): Xưởng sáng tạo đề thi và phân tích bài toán học tập nâng cao.

QUY TẮC PHÂN TÍCH TOÁN HỌC & TRẢ LỜI:
1. Luôn sử dụng ký hiệu LaTeX bọc trong dấu $ (inline) hoặc $$ (block) cho toàn bộ công thức toán học.
2. Trình bày ngắn gọn, mạch lạc, có cấu trúc rõ ràng với các gạch đầu dòng hoặc bảng số liệu.
3. Khi phân tích đồ thị:
   - Nếu ở chế độ 2D: Nêu rõ tập xác định, tính đơn điệu, các điểm cực trị ($f'(x) = 0$), tiệm cận đứng / ngang (nếu có), giao điểm với các trục tọa độ $Ox, Oy$.
   - Nếu ở chế độ 3D: Nêu rõ dạng bề mặt (mặt yên ngựa hyperbolic paraboloid, mặt cầu, paraboloid eliptic, mặt nón...), tính đối xứng qua các mặt phẳng tọa độ $Oxy, Oyz, Ozx$, vết cắt (level curves / contours).
4. Luôn tôn trọng người dùng, khuyến khích tư duy logic toán học.`

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const {
      message = '',
      equations = [],
      mode = '2d',
    } = body

    if (!message && (!equations || equations.length === 0)) {
      return NextResponse.json({ error: 'Thiếu câu hỏi hoặc phương trình để phân tích' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({
        reply: 'Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng liên hệ quản trị viên.',
        error: 'NO_API_KEY',
      })
    }

    // Soạn thảo ngữ cảnh đồ thị gửi cho Gemini
    let graphContext = `[Trạng thái đồ thị hiện tại]:\n- Chế độ hiển thị: ${mode.toUpperCase()} (${mode === '3d' ? 'Không gian 3 chiều Oxyz' : 'Mặt phẳng tọa độ Oxy'})\n`
    if (equations && equations.length > 0) {
      graphContext += '- Các phương trình đang được vẽ:\n'
      equations.forEach((eq: any, idx: number) => {
        const expr = typeof eq === 'string' ? eq : eq.expr || eq.expression || ''
        graphContext += `  ${idx + 1}. $${expr}$\n`
      })
    } else {
      graphContext += '- Chưa có phương trình nào được vẽ.\n'
    }

    const fullPrompt = `${graphContext}\n[Yêu cầu của người dùng]:\n${message || 'Hãy phân tích chi tiết hình dạng, tính chất toán học và các điểm đặc biệt của (các) đồ thị trên.'}`

    let responseText = ''

    // Sử dụng model 'gemini-3.8-flash' theo đúng quy định cho các tác vụ nâng cao
    try {
      const ai = new GoogleGenAI({ apiKey })
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: SENGRAPH_SYSTEM_PROMPT },
              { text: fullPrompt },
            ],
          },
        ],
      })
      responseText = res.text ?? ''
    } catch (sdkErr: any) {
      console.warn('Lỗi gọi SDK GoogleGenAI gemini-3.8-flash, thử fallback:', sdkErr?.message)
      try {
        const legacyAI = new GoogleGenerativeAI(apiKey)
        const model = legacyAI.getGenerativeModel({ model: 'gemini-3.8-flash' })
        const res = await model.generateContent(`${SENGRAPH_SYSTEM_PROMPT}\n\n${fullPrompt}`)
        responseText = res.response.text()
      } catch (fallbackErr: any) {
        throw new Error(`Không thể kết nối Gemini 3.8 Flash: ${fallbackErr.message || sdkErr.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      reply: responseText,
      model: 'gemini-3.8-flash',
    })
  } catch (error: any) {
    console.error('Lỗi API SenGraph AI:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Lỗi xử lý AI',
        reply: `Đã xảy ra lỗi khi trao đổi với Sen AI: ${error?.message || 'Vui lòng thử lại sau.'}`,
      },
      { status: 500 }
    )
  }
}
