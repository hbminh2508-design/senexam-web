import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const mode = formData.get('mode') as string | null // 'question' hoặc 'answer'

    if (!imageFile) {
      return NextResponse.json({ error: 'Không nhận được ảnh' }, { status: 400 })
    }

    // Chuyển File thành Base64
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    if (mode === 'question') {
      // OCR CHO CÂU HỎI
      const prompt = `Bạn là chuyên gia nhận diện câu hỏi từ ảnh scan/PDF của các kỳ thi Việt Nam (THPTQG, HSA, TSA, SPT).

NHIỆM VỤ:
1. Nhận diện loại câu hỏi:
   - "single_choice": Trắc nghiệm một lựa chọn (chỉ tô 1 đáp án)
   - "multiple_choice": Trắc nghiệm nhiều lựa chọn (tô từ 1-4 đáp án)
   - "true_false": Đúng-Sai 4 mệnh đề (mỗi mệnh đề có Đ/S)
   - "short_answer": Điền đáp án ngắn (số, từ)
   - "drag_drop": Kéo thả, ghép cặp
   - "essay": Tự luận

2. TRÍCH XUẤT:
   - Nội dung câu hỏi (OCR text)
   - Tên các lựa chọn nếu có (A, B, C, D hoặc mệnh đề)
   - Số lượng lựa chọn
   - Nhận diện nếu có hình vẽ/ảnh (mô tả ngắn)

PHẢN HỒI DẠNG JSON:
{
  "question_text": "Nội dung câu hỏi (OCR)",
  "question_type": "single_choice|multiple_choice|true_false|short_answer|drag_drop|essay",
  "options": ["A) Lựa chọn 1", "B) Lựa chọn 2", ...] hoặc null nếu không có,
  "options_count": 4,
  "has_image": true/false,
  "image_description": "Mô tả ảnh (nếu có)",
  "confidence": 0.95
}

⚠️ CHỈ TRẢ VỀ JSON THÔI, không có giải thích thêm.`

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ])

      const responseText = result.response.text()
      
      // Xử lý trường hợp response có markdown code block
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/({[\s\S]*})/)
      const jsonString = jsonMatch ? jsonMatch[1] : responseText
      
      const parsedResult = JSON.parse(jsonString)

      return NextResponse.json({
        success: true,
        data: parsedResult,
      })
    } else if (mode === 'answer') {
      // OCR CHO ĐÁP ÁN
      const prompt = `Bạn là chuyên gia nhận diện bảng đáp án từ ảnh scan/PDF của các kỳ thi Việt Nam.

NHIỆM VỤ:
1. Nhận diện từng câu và đáp án của nó
2. Format đáp án dựa theo loại:
   - Trắc nghiệm: A, B, C, hoặc D
   - Đúng-Sai: Đ (đúng) hoặc S (sai)
   - Điền đáp án: giá trị số hoặc text

PHẢN HỒI DẠNG JSON:
{
  "answers": {
    "1": "A",
    "2": "B",
    "3": "ĐSĐS" hoặc "Đ, S, Đ, S",
    "4": "12,5",
    ...
  },
  "total_questions": 50,
  "answer_format": "single_choice|multiple_choice|true_false|mixed|short_answer",
  "confidence": 0.92
}

⚠️ CHỈ TRẢ VỀ JSON THÔI, không có giải thích thêm.`

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ])

      const responseText = result.response.text()
      
      // Xử lý trường hợp response có markdown code block
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/({[\s\S]*})/)
      const jsonString = jsonMatch ? jsonMatch[1] : responseText
      
      const parsedResult = JSON.parse(jsonString)

      return NextResponse.json({
        success: true,
        data: parsedResult,
      })
    } else {
      return NextResponse.json({ error: 'Mode không hợp lệ (question hoặc answer)' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Lỗi OCR:', error)
    return NextResponse.json(
      { error: 'Lỗi xử lý OCR: ' + error.message },
      { status: 500 }
    )
  }
}
