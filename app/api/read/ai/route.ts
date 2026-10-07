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

// Tách chương theo tiêu đề tự nhiên trong bản thảo (Chương, Hồi, Phần, Chapter...)
function splitByChapterHeadings(text: string): { title: string; content: string }[] | null {
  const chapterRegex = /(?:^|\n)(Chương\s+[0-9IVXLCDMivxlcdm]+[^\n]*|Hồi\s+[0-9IVXLCDMivxlcdm]+[^\n]*|Phần\s+[0-9IVXLCDMivxlcdm]+[^\n]*|Chapter\s+[0-9IVXLCDMivxlcdm]+[^\n]*)/gi
  const matches = [...text.matchAll(chapterRegex)]
  if (matches.length >= 2) {
    const chapters: { title: string; content: string }[] = []
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const title = match[1].trim()
      const startIndex = match.index! + match[0].length
      const endIndex = i + 1 < matches.length ? matches[i + 1].index! : text.length
      const content = text.slice(startIndex, endIndex).trim()
      if (content.length > 0) {
        chapters.push({ title, content })
      }
    }
    if (chapters.length >= 2) return chapters
  }
  return null
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

    const { action, text, sourceLang = 'vi', targetLang = 'en', deepThink = false } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Văn bản không được để trống' }, { status: 400 })
    }

    // Lựa chọn model theo yêu cầu:
    // Mặc định: 'gemini-3.5-flash-lite'
    // Khi kích hoạt Deep Think: 'gemini-3.8-flash'
    const primaryModel = deepThink ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite'
    const fallbackModel = deepThink ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash'

    // ----------------------------------------------------------------------------------
    // ACTION 1: SEGMENT CHAPTERS & INSERT ILLUSTRATION PLACEHOLDERS
    // ----------------------------------------------------------------------------------
    if (action === 'segment_chapters') {
      // 1. Kiểm tra nếu bản thảo đã có cấu trúc chương tự nhiên -> Tách giữ nguyên 100% nội dung
      const naturalChapters = splitByChapterHeadings(text)
      if (naturalChapters && naturalChapters.length >= 2) {
        const enriched = naturalChapters.map((ch, idx) => {
          let content = ch.content
          // Tự động chèn thẻ minh họa nếu chưa có
          if (!content.includes('[ILLUSTRATION:')) {
            const paragraphs = content.split(/\n\s*\n/)
            if (paragraphs.length >= 2) {
              const insertIdx = Math.min(2, Math.floor(paragraphs.length / 2))
              paragraphs.splice(
                insertIdx,
                0,
                `\n[ILLUSTRATION: Tranh minh họa phong cảnh và nhân vật trong ${ch.title}]\n`
              )
              content = paragraphs.join('\n\n')
            }
          }
          return {
            chapter_number: idx + 1,
            title: ch.title,
            content,
          }
        })
        return NextResponse.json({ chapters: enriched, modelUsed: 'Rule-Based Preserving Parser' })
      }

      // 2. Nếu không có tiêu đề sẵn, dùng AI phân tích cấu trúc nhưng YÊU CẦU GIỮ NGUYÊN VẸN NỘI DUNG
      const prompt = `Bạn là một biên tập viên văn học và chuyên gia cấu trúc tác phẩm hàng đầu.
Nhiệm vụ của bạn là nhận diện, phân tích bản thảo sau và chia thành các chương truyện hợp lý.

QUY TẮC BẮT BUỘC (QUAN TRỌNG NHẤT):
1. TUYỆT ĐỐI GIỮ LẠI NGUYÊN VẸN 100% NỘI DUNG VĂN BẢN GỐC, KHÔNG ĐƯỢC TÓM TẮT, KHÔNG RÚT GỌN BẤT KỲ CÂU TỪ NÀO.
2. Xác định các phân đoạn tự nhiên, đặt tên chương văn học hay và truyền cảm xúc.
3. Tự động nhận diện những trường đoạn miêu tả phong cảnh, chân dung hoặc khoảnh khắc kịch tính then chốt cần tranh minh họa. Tại đúng vị trí đó giữa các đoạn văn, chèn một thẻ giữ chỗ hình ảnh duy nhất có cú pháp:
   [ILLUSTRATION: Gợi ý miêu tả hình ảnh chi tiết]
   (Mỗi chương chèn 1 thẻ [ILLUSTRATION] phù hợp nhất).
4. Trả về DUY NHẤT một mảng JSON thuần túy theo schema sau (không kèm giải thích ngoài JSON):
[
  {
    "chapter_number": 1,
    "title": "Tên chương",
    "content": "Toàn bộ nội dung nguyên văn của chương đó kèm thẻ [ILLUSTRATION: ...]"
  }
]

Bản thảo thô cần phân tích:
"""
${text.slice(0, 40000)}
"""`

      let responseText = ''
      let usedModel = primaryModel
      try {
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
          },
        })
        responseText = response.text || ''
      } catch (primaryErr: any) {
        console.warn(`[AI Read] Model ${primaryModel} gặp lỗi, chuyển sang ${fallbackModel}:`, primaryErr?.message)
        usedModel = fallbackModel
        const fallback = await ai.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
          },
        })
        responseText = fallback.text || ''
      }

      const parsed = parseJsonSafe<any[]>(responseText, [])
      if (!Array.isArray(parsed) || parsed.length === 0) {
        // Fallback: Giữ 100% văn bản nguyên vẹn không làm mất của người dùng
        return NextResponse.json({
          chapters: [
            {
              chapter_number: 1,
              title: 'Chương 1: Toàn văn tác phẩm',
              content: text,
            },
          ],
          modelUsed: usedModel,
        })
      }

      return NextResponse.json({ chapters: parsed, modelUsed: usedModel })
    }

    // ----------------------------------------------------------------------------------
    // ACTION 2: LITERARY TRANSLATION (VI <-> EN)
    // ----------------------------------------------------------------------------------
    if (action === 'translate') {
      const srcName = sourceLang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'
      const tgtName = targetLang === 'en' ? 'Tiếng Anh (English)' : 'Tiếng Việt'

      const prompt = `Bạn là một dịch giả văn học chuyên nghiệp hàng đầu thế giới.
Hãy dịch TOÀN BỘ đoạn văn học sau từ ${srcName} sang ${tgtName}.

Yêu cầu nghiêm ngặt:
1. Dịch trọn vẹn, ĐẦY ĐỦ 100% nội dung, TUYỆT ĐỐI KHÔNG CẮT BỚT, KHÔNG TÓM TẮT.
2. Giữ nguyên phong vị, giọng điệu văn chương, xúc cảm và nhịp điệu của câu từ.
3. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ minh họa hình ảnh có dạng: [ILLUSTRATION: ...] (dịch phần mô tả bên trong thẻ sang ngôn ngữ đích tương ứng để người đọc hiểu).
4. Giữ nguyên cấu trúc ngắt dòng và đoạn văn.
5. Trả về trực tiếp bản dịch hoàn chỉnh (không thêm bất kỳ lời chào hay giải thích nào khác).

Đoạn văn cần dịch:
"""
${text.slice(0, 35000)}
"""`

      let responseText = ''
      let usedModel = primaryModel
      try {
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
          },
        })
        responseText = response.text || ''
      } catch (primaryErr: any) {
        console.warn(`[AI Read] Model ${primaryModel} gặp lỗi khi dịch, chuyển sang ${fallbackModel}:`, primaryErr?.message)
        usedModel = fallbackModel
        const fallback = await ai.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
          },
        })
        responseText = fallback.text || ''
      }

      return NextResponse.json({ translated_text: responseText.trim(), modelUsed: usedModel })
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    console.error('[AI Read API Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi xử lý nội bộ server AI' },
      { status: 500 }
    )
  }
}
