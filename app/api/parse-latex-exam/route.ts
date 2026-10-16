import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Cho phép xử lý đề thi dài lên tới 120s

const SYSTEM_PROMPT = `Bạn là chuyên gia số hóa đề thi KaTeX và giải toán sư phạm hàng đầu Việt Nam.
Nhiệm vụ của bạn là nhận mã nguồn LaTeX (hoặc file .tex được tải lên) của một đề thi, phân tích bóc tách toàn bộ các câu hỏi thành cấu trúc chuẩn KaTeX JSON của SenExam.

QUY TẮC PHÂN LOẠI DẠNG CÂU HỎI (CHUẨN BỘ GIÁO DỤC 2026 & HSA/TSA):
1. "single_choice" (Trắc nghiệm 4 lựa chọn):
   - Thường nằm ở Phần 1 (Câu trắc nghiệm nhiều phương án).
   - Nhận diện qua: \\choice{A}{B}{C}{D}, \\begin{tasks}, A. B. C. D., hoặc 4 phương án lựa chọn.
   - "options": Mảng 4 chuỗi phương án [A, B, C, D] (giữ nguyên công thức KaTeX $...$).
   - "correctAnswer": "A", "B", "C" hoặc "D".
2. "true_false" (Trắc nghiệm Đúng / Sai 4 ý a, b, c, d):
   - Thường nằm ở Phần 2.
   - Nhận diện qua: 4 ý a), b), c), d) hoặc \\choiceTF, thí sinh phải chọn Đúng hoặc Sai cho từng ý.
   - "options": Mảng 4 ý [a, b, c, d].
   - "correctAnswer": Đối tượng JSON dạng {"a": "Đ", "b": "S", "c": "Đ", "d": "S"} (hoặc "Đ" / "S").
3. "short_answer" (Trả lời ngắn / Điền số):
   - Thường nằm ở Phần 3.
   - Nhận diện qua: \\shortans, điền số, tính toán kết quả số học / tọa độ / giá trị.
   - "options": Mảng rỗng [].
   - "correctAnswer": Chuỗi số hoặc kết quả ngắn gọn (ví dụ: "2.5", "-4", "12").
4. "essay" (Tự luận):
   - Câu hỏi tự luận hoặc chứng minh không có đáp án trắc nghiệm.
   - "options": Mảng rỗng [].
   - "correctAnswer": "Xem lời giải chi tiết".

QUY TẮC VỀ CÔNG THỨC TOÁN HỌC KATEX:
- Mọi công thức toán học, ký hiệu, hàm số, phương trình PHẢI được giữ nguyên hoặc chuẩn hóa trong cặp dấu $...$ (nội dòng) hoặc $$...$$ (khối nổi bật).
- Loại bỏ các lệnh macro LaTeX cồng kềnh không được KaTeX hỗ trợ như \\draw, \\tikzpicture, \\begin{center}, \\textit, thay bằng text và công thức toán trong sáng.

QUY TẮC ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT:
1. Nếu trong LaTeX đã có sẵn \\loigiai{...} hoặc \\begin{solution}...\\end{solution} hoặc đáp án được đánh dấu (ví dụ \\True, \\textbf{A}, gạch chân):
   - Trích xuất đáp án đúng và lời giải chi tiết đó, chuyển đổi sang KaTeX.
2. Nếu người dùng cung cấp FILE / BẢNG ĐÁP ÁN RIÊNG:
   - ƯU TIÊN 100% đối chiếu theo bảng đáp án được cung cấp. Khớp từng câu 1, 2, 3... vào đề.
3. NẾU CHƯA CÓ ĐÁP ÁN HOẶC CHƯA CÓ LỜI GIẢI:
   - Bạn hãy tự giải chi tiết từng bước, tìm ra đáp án đúng chuẩn xác nhất và soạn lời giải chi tiết KaTeX tỉ mỉ, sư phạm cho từng câu!

CẤU TRÚC JSON TRẢ VỀ (CHỈ TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON NÀY, KHÔNG THÊM TEXT BÊN NGOÀI):
{
  "title": "Tên đề thi trích xuất từ tiêu đề LaTeX hoặc tạo tên phù hợp (ví dụ: Đề Khảo Sát Môn Toán 12)",
  "subject": "Toán học | Vật lí | Hóa học | Sinh học | Tin học",
  "exam_type": "THPTQG | HSA | TSA | ĐẠI HỌC",
  "duration": 50,
  "questions": [
    {
      "id": "q-1",
      "type": "single_choice | true_false | short_answer | essay",
      "text": "Nội dung câu hỏi có công thức KaTeX $...$",
      "options": ["$A$", "$B$", "$C$", "$D$"],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết từng bước có công thức KaTeX $...$",
      "points": 1
    }
  ]
}
`

function extractJson(raw: string): any {
  if (!raw) return null
  let cleaned = raw.trim()
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim()
  } else {
    const braceMatch = cleaned.match(/({[\s\S]*})/)
    if (braceMatch) {
      cleaned = braceMatch[1].trim()
    }
  }
  try {
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Lỗi JSON parse từ Gemini:', err)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' },
        { status: 500 }
      )
    }

    let latexCode = ''
    let answerText = ''
    let hasSeparateAnswer = false
    let answerFileBase64: string | undefined
    let answerMimeType = 'application/pdf'
    let subject = 'Toán học'

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      latexCode = (formData.get('latexCode') as string) || ''
      answerText = (formData.get('answerText') as string) || ''
      hasSeparateAnswer = formData.get('hasSeparateAnswer') === '1'
      subject = (formData.get('subject') as string) || 'Toán học'

      const latexFile = formData.get('latexFile') as File | null
      if (latexFile) {
        latexCode = await latexFile.text()
      }

      const answerFile = formData.get('answerFile') as File | null
      if (answerFile) {
        answerMimeType = answerFile.type || 'application/pdf'
        if (answerFile.type?.includes('text') || answerFile.name?.endsWith('.tex') || answerFile.name?.endsWith('.txt')) {
          answerText = await answerFile.text()
        } else {
          const ab = await answerFile.arrayBuffer()
          answerFileBase64 = Buffer.from(ab).toString('base64')
        }
      }
    } else {
      const body = await request.json().catch(() => null)
      if (body) {
        latexCode = body.latexCode || ''
        answerText = body.answerText || ''
        hasSeparateAnswer = Boolean(body.hasSeparateAnswer)
        answerFileBase64 = body.answerFileBase64
        answerMimeType = body.answerMimeType || 'application/pdf'
        subject = body.subject || 'Toán học'
      }
    }

    if (!latexCode.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mã nguồn LaTeX hoặc tải lên file .tex cần biên soạn!' },
        { status: 400 }
      )
    }

    // Xây dựng parts cho Gemini
    const parts: any[] = []

    // Đính kèm file đáp án nếu là ảnh hoặc PDF
    if (answerFileBase64) {
      const cleanBase64 = answerFileBase64.includes('base64,')
        ? answerFileBase64.split('base64,')[1]
        : answerFileBase64
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: answerMimeType || 'application/pdf',
        },
      })
    }

    let answerInstruction = ''
    if (hasSeparateAnswer || answerText || answerFileBase64) {
      answerInstruction = `
=== ĐÃ CÓ BẢNG / TÀI LIỆU ĐÁP ÁN RIÊNG ĐÍNH KÈM ===
Người dùng ĐÃ CUNG CẤP bảng/tài liệu đáp án riêng:
${answerText ? `[BẢNG ĐÁP ÁN]:\n${answerText}\n` : '(Xem tài liệu đáp án đính kèm)'}

YÊU CẦU:
1. Đối chiếu chính xác 100% từng câu hỏi với bảng đáp án được cung cấp.
2. Nạp đáp án đúng tương ứng (single_choice: A/B/C/D, true_false: a,b,c,d Đ/S, short_answer: giá trị số).
3. Nếu đề chưa có lời giải chi tiết, bạn hãy giải bổ sung lời giải chi tiết KaTeX cho từng câu để học sinh xem lại sau khi làm bài.
`
    } else {
      answerInstruction = `
=== CHƯA CÓ FILE ĐÁP ÁN (AI TỰ GIẢI) ===
Người dùng chưa có bảng đáp án. Hãy:
1. Đọc kỹ từng câu hỏi trong mã LaTeX.
2. Nếu câu hỏi đã có sẵn đáp án/lời giải trong LaTeX (ví dụ \\True, \\loigiai), hãy trích xuất.
3. Nếu chưa có, AI hãy tự giải toán thật cẩn thận, xác định đáp án đúng và viết lời giải chi tiết KaTeX từng bước!
`
    }

    const promptText = `${SYSTEM_PROMPT}

MÔN HỌC MỤC TIÊU: ${subject}

${answerInstruction}

MÃ NGUỒN LATEX ĐỀ THI ĐƯỢC CUNG CẤP DƯỚI ĐÂY:
\`\`\`latex
${latexCode.trim()}
\`\`\`
`
    parts.push({ text: promptText })

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
    const genAI = new GoogleGenerativeAI(apiKey)
    let responseText = ''
    let modelUsed = ''
    let lastError: any = null

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.15,
          },
        })

        const res = await model.generateContent(parts)
        const text = res.response.text()
        if (text && text.trim()) {
          responseText = text.trim()
          modelUsed = modelName
          break
        }
      } catch (err: any) {
        console.warn(`[ParseLaTeX] Model ${modelName} thất bại, thử model tiếp theo:`, err?.message || err)
        lastError = err
      }
    }

    if (!responseText) {
      return NextResponse.json(
        {
          error: 'AI không thể biên soạn đề thi từ mã LaTeX này. Vui lòng kiểm tra lại cú pháp LaTeX hoặc thử lại sau ít phút.',
          details: lastError?.message || 'Không có phản hồi từ Gemini.',
        },
        { status: 503 }
      )
    }

    const parsedData = extractJson(responseText)
    if (!parsedData || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
      return NextResponse.json(
        {
          error: 'AI không thể nhận diện được danh sách câu hỏi từ mã LaTeX. Vui lòng xem hướng dẫn định dạng file LaTeX!',
        },
        { status: 422 }
      )
    }

    // Chuẩn hóa questions đảm bảo hợp lệ
    const normalizedQuestions = parsedData.questions.map((q: any, idx: number) => {
      let qType: 'single_choice' | 'true_false' | 'short_answer' | 'essay' = 'single_choice'
      const rawT = (q.type || '').toString().toLowerCase().trim()
      if (rawT.includes('true') || rawT.includes('tf') || rawT.includes('đúng') || rawT.includes('sai')) {
        qType = 'true_false'
      } else if (rawT.includes('short') || rawT.includes('ngắn') || rawT.includes('điền') || rawT === 'sa') {
        qType = 'short_answer'
      } else if (rawT.includes('essay') || rawT.includes('luận')) {
        qType = 'essay'
      } else {
        qType = 'single_choice'
      }

      let options: string[] = []
      if (Array.isArray(q.options)) {
        options = q.options.map((o: any) => String(o || ''))
      } else if (qType === 'single_choice') {
        options = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D']
      }

      return {
        id: `q-${Date.now()}-${idx + 1}`,
        type: qType,
        text: q.text || `Câu hỏi ${idx + 1}`,
        options,
        correctAnswer: q.correctAnswer ?? (qType === 'single_choice' ? 'A' : qType === 'true_false' ? { a: 'Đ', b: 'S', c: 'Đ', d: 'S' } : '0'),
        explanation: q.explanation || 'Chưa có lời giải chi tiết.',
        points: Number(q.points) || 1,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        title: parsedData.title || 'Đề Thi KaTeX Mới',
        subject: parsedData.subject || subject,
        exam_type: parsedData.exam_type || 'THPTQG',
        duration: Number(parsedData.duration) || 50,
        questions: normalizedQuestions,
      },
      modelUsed,
      questionCount: normalizedQuestions.length,
    })
  } catch (error: any) {
    console.error('Lỗi parse-latex-exam:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi xử lý biên soạn đề LaTeX.',
      },
      { status: 500 }
    )
  }
}
