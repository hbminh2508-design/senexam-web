import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

// Helper to strip markdown code blocks and parse JSON
function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    let clean = raw.trim()
    if (clean.startsWith('```json')) clean = clean.slice(7)
    else if (clean.startsWith('```')) clean = clean.slice(3)
    if (clean.endsWith('```')) clean = clean.slice(0, -3)
    return JSON.parse(clean.trim())
  } catch {
    return fallback
  }
}

export async function POST(request: Request) {
  try {
    if (!ai) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng liên hệ ban quản trị.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.action) {
      return NextResponse.json({ error: 'Thiếu thông tin action' }, { status: 400 })
    }

    const { action, text, sourceLang = 'vi', targetLang = 'en' } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Văn bản không được để trống' }, { status: 400 })
    }

    // ----------------------------------------------------------------------------------
    // ACTION 1: SEGMENT CHAPTERS & INSERT ILLUSTRATION PLACEHOLDERS
    // ----------------------------------------------------------------------------------
    if (action === 'segment_chapters') {
      const prompt = `Bạn là một biên tập viên văn học và chuyên gia cấu trúc tác phẩm hàng đầu.
Nhiệm vụ của bạn là nhận diện, phân tích bản thảo sau và chia thành các chương truyện hợp lý.

Quy tắc bắt buộc:
1. Xác định các phân đoạn tự nhiên, tiêu đề chương nếu có (hoặc tự đặt tên chương văn học hay, giàu cảm xúc nếu chưa có tiêu đề).
2. Tự động nhận diện những trường đoạn miêu tả phong cảnh, chân dung hoặc khoảnh khắc kịch tính then chốt cần tranh minh họa. Tại đúng vị trí đó giữa các đoạn văn, chèn một thẻ giữ chỗ hình ảnh duy nhất có cú pháp:
   [ILLUSTRATION: Gợi ý miêu tả hình ảnh chi tiết bằng tiếng Việt]
   (Mỗi chương chỉ nên có 1 đến 2 thẻ [ILLUSTRATION], không chèn quá nhiều làm loãng bài viết).
3. Trả về DUY NHẤT một mảng JSON thuần túy theo schema sau (không kèm giải thích ngoài JSON):
[
  {
    "chapter_number": 1,
    "title": "Tên chương",
    "content": "Nội dung chương văn học với các đoạn văn ngắt dòng tự nhiên và thẻ [ILLUSTRATION: ...] chèn đúng chỗ."
  }
]

Bản thảo thô cần phân tích:
"""
${text.slice(0, 30000)}
"""`

      let responseText = ''
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        responseText = response.text || ''
      } catch (e: any) {
        // Fallback model
        const fallback = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
        })
        responseText = fallback.text || ''
      }

      const parsed = parseJsonSafe<any[]>(responseText, [])
      if (!Array.isArray(parsed) || parsed.length === 0) {
        // Fallback: nếu AI trả về định dạng văn bản thường, tự tạo 1 chương duy nhất
        return NextResponse.json({
          chapters: [
            {
              chapter_number: 1,
              title: 'Chương 1: Bản thảo hoàn chỉnh',
              content: text,
            },
          ],
        })
      }

      return NextResponse.json({ chapters: parsed })
    }

    // ----------------------------------------------------------------------------------
    // ACTION 2: LITERARY TRANSLATION (VI <-> EN)
    // ----------------------------------------------------------------------------------
    if (action === 'translate') {
      const srcName = sourceLang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'
      const tgtName = targetLang === 'en' ? 'Tiếng Anh (English)' : 'Tiếng Việt'

      const prompt = `Bạn là một dịch giả văn học chuyên nghiệp hàng đầu thế giới.
Hãy dịch đoạn văn học sau từ ${srcName} sang ${tgtName}.

Yêu cầu nghiêm ngặt:
1. Giữ nguyên phong vị, giọng điệu văn chương, xúc cảm và nhịp điệu của câu từ.
2. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ minh họa hình ảnh có dạng: [ILLUSTRATION: ...] (dịch phần mô tả bên trong thẻ sang ngôn ngữ đích tương ứng để người đọc hiểu).
3. Giữ nguyên cấu trúc ngắt dòng và đoạn văn.
4. Trả về trực tiếp bản dịch hoàn chỉnh (không thêm bất kỳ lời chào hay giải thích nào khác).

Đoạn văn cần dịch:
"""
${text.slice(0, 25000)}
"""`

      let responseText = ''
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        responseText = response.text || ''
      } catch (e: any) {
        const fallback = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
        })
        responseText = fallback.text || ''
      }

      return NextResponse.json({ translated_text: responseText.trim() })
    }

    // ----------------------------------------------------------------------------------
    // ACTION 3: SUGGEST ILLUSTRATIONS
    // ----------------------------------------------------------------------------------
    if (action === 'suggest_illustrations') {
      const prompt = `Phân tích đoạn văn học sau và đề xuất 2 gợi ý cảnh vẽ minh họa nghệ thuật đẹp nhất cho truyện.
Trả về DUY NHẤT một mảng JSON các chuỗi mô tả tranh chi tiết:
["Mô tả cảnh 1...", "Mô tả cảnh 2..."]

Đoạn văn:
"""
${text.slice(0, 15000)}
"""`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      })
      const suggestions = parseJsonSafe<string[]>(response.text || '', [
        'Khung cảnh thiên nhiên bao la dưới bầu trời chiều',
      ])
      return NextResponse.json({ suggestions })
    }

    return NextResponse.json({ error: 'Action không được hỗ trợ' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in /api/read/ai:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi xử lý AI cho phòng đọc sách' },
      { status: 500 }
    )
  }
}
