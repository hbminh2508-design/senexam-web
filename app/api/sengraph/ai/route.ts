import { GoogleGenAI } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const apiKey = process.env.GEMINI_API_KEY

const SENGRAPH_SYSTEM_PROMPT = `Bạn là Sen AI — Trợ lý Toán học & Đồ thị cao cấp của SenGraph thuộc hệ sinh thái SenExam.
Nhiệm vụ chính: 
1. Phân tích đồ thị hàm số 2D (mặt phẳng Oxy) và mô hình không gian 3D (không gian Oxyz).
2. NĂNG LỰC GIẢI TOÁN TỪ ẢNH & FILE: Phân tích ảnh chụp đề bài, đề kiểm tra toán học, đề thi THPT / Đại học, hoặc tài liệu người dùng tải lên.
   - Đọc và nhận diện đề bài chính xác tuyệt đối từ ảnh / văn bản (khảo sát hàm số, cực trị, tiếp tuyến, tính diện tích hình phẳng, thể tích vật thể tròn xoay, mặt cong không gian 3D, v.v.).
   - Giải chi tiết bài toán từng bước (Step-by-step solution) với văn phong sư phạm chuẩn mực, công thức rõ ràng.
   - Hướng dẫn học sinh cách dựng đồ thị hoặc hình vẽ tương ứng trên SenGraph để người học hiểu sâu bản chất toán học.
3. TỰ ĐỘNG XUẤT CÔNG THỨC ĐỒ THỊ CHÍNH XÁC:
   - Tùy theo yêu cầu của đề bài và prompt của người dùng, bạn có thể đưa ra phương trình của một đường cong duy nhất HOẶC cả tổ hợp hình (ví dụ: đường cong chính + tiếp tuyến + tiệm cận + trục đối xứng, hoặc mặt cong 3D).
   - BẮT BUỘC: Khi đưa ra giải pháp đồ thị, hãy đính kèm một khối JSON đặc biệt ở cuối bài viết theo đúng cấu trúc sau để hệ thống SenGraph tự động nạp vào đồ thị cho người dùng:

\`\`\`sen-graph-equations
{
  "mode": "2d", // Chọn "2d" hoặc "3d" tùy bài toán
  "title": "Tên hình vẽ hoặc đồ thị",
  "equations": [
    "y = x^3 - 3*x + 1",
    "y = 3*x - 3"
  ],
  "explanation": "Hướng dẫn ngắn về các đường cong này trên hệ trục"
}
\`\`\`

TRI THỨC HỆ SINH THÁI SENEXAM MỚI:
- SenGraph (sengraph.senexam.me): Nền tảng vẽ đồ thị toán học trực quan hỗ trợ cả 2D Cartesian (Oxy) và 3D WebGL (Oxyz), có bàn phím toán học ảo chuyên dụng, quản lý nhiều phương trình cùng lúc, phân tích hình học bằng Sen AI.
- Sen Exam Canvas (seb.thicu.tailieufepn.senexam.me): Môi trường khảo thí trực tuyến bảo mật cao qua Safe Exam Browser, có camera giám thị AI cục bộ (phát hiện thiếu sáng, phát hiện vật lạ che mặt, kiểm tra đột xuất mỗi 1 phút mà không làm gián đoạn học sinh).
- New Dashboard (/new-dashboard): Trung tâm điều hành học tập hiện đại của SenExam, tích hợp lịch thi, quản lý bài nộp, lối tắt nhanh đến SenGraph, SenAI Studio, Thư viện và chế độ Focus.
- TSV FEPN (tsv.fepn.senexam.me): Cổng tài liệu chuyên sâu dành cho sinh viên/học sinh, hỗ trợ tải tài liệu trực tiếp không qua Drive, tính điểm GPA học kỳ và tổng kết, recap môn học.
- SenAI Studio (/new-senai-studio): Xưởng sáng tạo đề thi và phân tích bài toán học tập nâng cao.

QUY TẮC TOÁN HỌC & TRÌNH BÀY:
1. Luôn sử dụng ký hiệu LaTeX bọc trong dấu $ (inline) hoặc $$ (block) cho toàn bộ công thức toán học.
2. Trình bày khoa học, mạch lạc, dễ theo dõi.
3. Khi phân tích đồ thị:
   - Nếu 2D: Nêu rõ tập xác định, sự biến thiên, cực trị, điểm uốn, tiệm cận, giao điểm trục tọa độ.
   - Nếu 3D: Nêu rõ dạng bề mặt (paraboloid, ellipsoid, saddle, cone, v.v.), tính đối xứng và các vết cắt (level curves).
4. Công thức trong mảng equations phải chuẩn hóa dạng: "y = <biểu thức x>" cho 2D hoặc "z = <biểu thức x, y>" cho 3D. Dùng ký hiệu toán học tiêu chuẩn: ^, sin, cos, tan, sqrt, abs, ln, exp, pi, e.`

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
      imageBase64,
      imageMimeType = 'image/jpeg',
      renderType = 'auto', // 'curve' (chỉ đường cong), 'full' (cả hình), 'auto'
    } = body

    if (!message && (!equations || equations.length === 0) && !imageBase64) {
      return NextResponse.json({ error: 'Thiếu câu hỏi, phương trình hoặc ảnh đề bài để phân tích' }, { status: 400 })
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
      graphContext += '- Chưa có phương trình nào trên hệ trục.\n'
    }

    if (renderType === 'curve') {
      graphContext += '- Người dùng ưu tiên: Chỉ xuất phương trình đường cong chính của hàm số.\n'
    } else if (renderType === 'full') {
      graphContext += '- Người dùng ưu tiên: Xuất đầy đủ toàn bộ hình vẽ (đường cong + tiếp tuyến/tiệm cận/giới hạn miền).\n'
    }

    const userPromptText = message || (imageBase64 
      ? 'Hãy phân tích chi tiết đề bài trong ảnh, giải hoàn chỉnh bài toán và xuất công thức phương trình để vẽ hình/đồ thị minh họa chính xác nhất.'
      : 'Hãy phân tích chi tiết hình dạng, tính chất toán học và các điểm đặc biệt của (các) đồ thị trên.')

    const fullPrompt = `${graphContext}\n[Yêu cầu của người dùng]:\n${userPromptText}`

    let responseText = ''

    // Chuẩn bị dữ liệu hình ảnh (nếu có)
    let inlineDataPart: any = null
    if (imageBase64) {
      let rawBase64 = imageBase64
      let detectedMime = imageMimeType || 'image/jpeg'
      if (rawBase64.includes(';base64,')) {
        const [meta, data] = rawBase64.split(';base64,')
        rawBase64 = data
        const mimeMatch = meta.match(/data:([^;]+)/)
        if (mimeMatch) detectedMime = mimeMatch[1]
      }
      inlineDataPart = {
        inlineData: {
          data: rawBase64,
          mimeType: detectedMime,
        },
      }
    }

    // Sử dụng model 'gemini-3.8-flash' theo đúng quy định cho các tác vụ nâng cao
    try {
      const ai = new GoogleGenAI({ apiKey })
      const parts: any[] = [{ text: SENGRAPH_SYSTEM_PROMPT }]
      if (inlineDataPart) {
        parts.push(inlineDataPart)
      }
      parts.push({ text: fullPrompt })

      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      })
      responseText = res.text ?? ''
    } catch (sdkErr: any) {
      console.warn('Lỗi gọi SDK GoogleGenAI gemini-3.8-flash, thử fallback:', sdkErr?.message)
      try {
        const legacyAI = new GoogleGenerativeAI(apiKey)
        const model = legacyAI.getGenerativeModel({ model: 'gemini-3.8-flash' })
        const legacyParts: any[] = []
        if (inlineDataPart) {
          legacyParts.push(inlineDataPart)
        }
        legacyParts.push(`${SENGRAPH_SYSTEM_PROMPT}\n\n${fullPrompt}`)
        const res = await model.generateContent(legacyParts)
        responseText = res.response.text()
      } catch (fallbackErr: any) {
        throw new Error(`Không thể kết nối Gemini 3.8 Flash: ${fallbackErr.message || sdkErr.message}`)
      }
    }

    // Bóc tách khối phương trình sen-graph-equations nếu có
    let extractedEquations: any = null
    try {
      const match = responseText.match(/```(?:sen-graph-equations|json)\s*([\s\S]*?)\s*```/)
      if (match) {
        const parsed = JSON.parse(match[1])
        if (parsed.equations && Array.isArray(parsed.equations)) {
          extractedEquations = parsed
        }
      }
    } catch {
      // Bỏ qua nếu parse không thành công
    }

    return NextResponse.json({
      success: true,
      reply: responseText,
      extractedEquations,
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
