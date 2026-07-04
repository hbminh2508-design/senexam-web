import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const PROMPT = `Bạn là chuyên gia số hóa đề thi Việt Nam (THPTQG, HSA, TSA, SPT).

Bạn sẽ nhận được 1 hoặc 2 tệp PDF: tệp thứ nhất luôn là ĐỀ BÀI (chứa nội dung câu hỏi), tệp thứ hai (nếu có) là BẢNG ĐÁP ÁN riêng. Nếu chỉ có 1 tệp, đáp án có thể nằm ở cuối chính tệp đó.

NHIỆM VỤ:
1. Đọc toàn bộ câu hỏi trong đề, giữ nguyên thứ tự.
2. Phân loại mỗi câu vào đúng 1 trong 4 dạng: "single_choice" (trắc nghiệm 1 đáp án A/B/C/D), "multiple_choice" (trắc nghiệm nhiều đáp án), "true_false" (đúng/sai 4 mệnh đề a/b/c/d), "short_answer" (điền đáp án ngắn dạng số/chữ).
3. Gom các câu liền kề CÙNG DẠNG vào chung một "section". Đặt tên section theo dạng, ví dụ "Phần 1: Trắc nghiệm một đáp án", "Phần 2: Đúng - Sai", "Phần 3: Trả lời ngắn".
4. Với mỗi câu, trích xuất nguyên văn đề bài (questionEntries[qIdx].text) và các phương án nếu có (questionEntries[qIdx].options là mảng string, KHÔNG kèm nhãn A/B/C/D ở đầu).
5. Xác định đáp án đúng (correctAnswers) dựa vào bảng đáp án được cung cấp:
   - single_choice: correctAnswers[qIdx] là 1 ký tự "A"|"B"|"C"|"D".
   - multiple_choice: correctAnswers[qIdx] là mảng các ký tự, ví dụ ["A","C"].
   - true_false: correctAnswers[qIdx] là object {"a":"Đ"|"S","b":"Đ"|"S","c":"Đ"|"S","d":"Đ"|"S"}.
   - short_answer: correctAnswers[qIdx] là chuỗi đáp án.
   qIdx bắt đầu từ 0 và là chỉ số của câu TRONG section đó (không phải số thứ tự toàn đề).
6. Nếu không tìm thấy đáp án cho một câu, vẫn giữ câu đó nhưng để correctAnswers[qIdx] = null.

CHỈ TRẢ VỀ DUY NHẤT JSON theo đúng schema sau, không thêm giải thích, không thêm markdown:
{
  "title": "Tên đề thi tự đặt dựa theo nội dung (ví dụ: Đề ôn tập Vật Lí - Chương Dao động)",
  "sections": [
    {
      "type": "single_choice",
      "name": "Phần 1: Trắc nghiệm một đáp án",
      "questionCount": 10,
      "questionEntries": { "0": { "text": "...", "options": ["...", "...", "...", "..."] } },
      "correctAnswers": { "0": "A" }
    }
  ]
}`

function extractJson(raw: string) {
  const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/({[\s\S]*})/)
  const jsonString = jsonMatch ? jsonMatch[1] : raw
  return JSON.parse(jsonString)
}

export async function POST(request: Request) {
  try {
    const { files } = await request.json() as { files: { base64: string; mimeType: string; name: string }[] }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Không nhận được tệp PDF nào' }, { status: 400 })
    }
    if (files.length > 2) {
      return NextResponse.json({ error: 'Chỉ hỗ trợ tối đa 2 tệp' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const parts = [
      ...files.map(f => ({ inlineData: { data: f.base64, mimeType: f.mimeType || 'application/pdf' } })),
      { text: PROMPT },
    ]

    const result = await model.generateContent(parts)
    const responseText = result.response.text()
    const parsed = extractJson(responseText)

    if (!parsed?.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return NextResponse.json({ error: 'AI không nhận diện được câu hỏi nào trong tệp đã tải lên' }, { status: 422 })
    }

    type ParsedSection = {
      type: string
      name?: string
      questionCount?: number
      questionEntries?: Record<string, { text: string; options?: string[] }>
      correctAnswers?: Record<string, unknown>
    }

    const examStructure = (parsed.sections as ParsedSection[]).map((section, idx: number) => ({
      id: `ai-section-${idx}-${Date.now()}`,
      type: section.type,
      name: section.name || `Phần thi số ${idx + 1}`,
      questionCount: section.questionCount || Object.keys(section.questionEntries || {}).length,
      questionEntries: section.questionEntries || {},
      correctAnswers: section.correctAnswers || {},
      scoringMode: 'auto_divide',
      sectionTotalPoints: 10,
      customPoints: {},
    }))

    return NextResponse.json({
      success: true,
      title: parsed.title || 'Đề thi tạo bởi AI',
      examStructure,
    })
  } catch (error) {
    console.error('Lỗi tạo đề tương tác từ AI:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Lỗi xử lý AI: ' + message },
      { status: 500 }
    )
  }
}
