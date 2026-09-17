import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Cho phép thời gian xử lý lên tới 60s

const SYSTEM_PROMPT = `Bạn là chuyên gia khảo thí và số hóa đề thi hàng đầu Việt Nam.
Nhiệm vụ của bạn là phân tích đề thi được tải lên và trích xuất cấu trúc đề thi hoàn chỉnh kèm đáp án chính xác.

HÃY PHÂN TÍCH VÀ TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON VỚI CÁC TRƯỜNG SAU (KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "title": "Tên đề thi trích xuất hoặc đặt theo nội dung (ví dụ: Đề Khảo Sát Chất Lượng Môn Toán 12)",
  "duration": 50, // Thời gian làm bài tính theo phút (số nguyên)
  "exam_type": "THPTQG | HSA | TSA | ĐẠI HỌC", // Phân loại kỳ thi
  "sections": [
    {
      "name": "Tên phần thi (ví dụ: Phần 1: Trắc nghiệm 4 lựa chọn)",
      "totalPoints": 4.0, // Tổng điểm của phần thi này (thường thang 10 toàn đề)
      "scoringMode": "auto_divide", // "auto_divide" (chia đều) hoặc "custom_points"
      "questionCount": 18, // Số lượng câu hỏi trong phần này
      "questionTypeMode": "uniform", // "uniform" (cùng loại) hoặc "custom" (tùy ý từng câu)
      "type": "single_choice", // "single_choice" | "true_false" | "short_answer" | "essay"
      "instructions": "Nội dung hướng dẫn làm bài chi tiết cho phần thi này mà thí sinh cần đọc trước khi thi",
      "instructionImage": "", // Để trống nếu không có ảnh hướng dẫn
      "correctAnswers": {
        // Đối với single_choice: {"0": "A", "1": "B", "2": "C", ...} (chỉ số câu bắt đầu từ 0)
        // Đối với true_false (mỗi câu 4 ý a,b,c,d): {"0": {"a": "Đ", "b": "S", "c": "Đ", "d": "S"}, ...}
        // Đối với short_answer: {"0": "12.5", "1": "-4", ...}
      }
    }
  ]
}

QUY TẮC QUAN TRỌNG:
1. Đọc kỹ toàn bộ câu hỏi trong đề để giải và đưa ra đáp án chính xác nhất có thể.
2. Nếu đề đã có sẵn bảng đáp án ở cuối, hãy ưu tiên trích xuất đáp án từ bảng đó.
3. Chỉ số câu trong correctAnswers bắt đầu từ "0" tương ứng với câu hỏi thứ 1 của phần đó.
4. Đối với trắc nghiệm 4 lựa chọn, đáp án phải là một trong: "A", "B", "C", "D".
5. Đối với câu Đúng/Sai 4 ý, đáp án của mỗi ý phải là "Đ" (Đúng) hoặc "S" (Sai).
6. Tổng điểm (totalPoints) của các phần cộng lại nên bằng 10.0 (hoặc tổng điểm phù hợp với kỳ thi).`

function extractJson(raw: string): any {
  const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/({[\s\S]*})/)
  const jsonString = jsonMatch ? jsonMatch[1] : raw
  return JSON.parse(jsonString)
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY trên hệ thống server.' }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const { fileBase64, mimeType, examText } = body || {}

    if (!fileBase64 && !examText) {
      return NextResponse.json({ error: 'Vui lòng cung cấp file đề thi (PDF/Ảnh) hoặc nội dung đề thi.' }, { status: 400 })
    }

    let responseText = ''

    // 1. Thử với SDK @google/genai và model 'gemini-3.5-flash-lite'
    try {
      const ai = new GoogleGenAI({ apiKey })

      const parts: any[] = []
      if (fileBase64) {
        const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'application/pdf',
          },
        })
      }

      const promptMsg = `${SYSTEM_PROMPT}\n\n${examText ? `Nội dung đề thi do người dùng cung cấp:\n${examText}` : 'Hãy phân tích file tài liệu đề thi được đính kèm ở trên.'}`
      parts.push({ text: promptMsg })

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: parts,
      })

      responseText = res.text ?? ''
    } catch (primaryErr: any) {
      console.warn('Lỗi gọi gemini-3.5-flash-lite qua @google/genai, thử fallback qua GoogleGenerativeAI:', primaryErr?.message)

      // 2. Fallback qua @google/generative-ai
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' })

        const parts: any[] = []
        if (fileBase64) {
          const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'application/pdf',
            },
          })
        }

        const promptMsg = `${SYSTEM_PROMPT}\n\n${examText ? `Nội dung đề thi do người dùng cung cấp:\n${examText}` : 'Hãy phân tích file tài liệu đề thi được đính kèm ở trên.'}`
        parts.push({ text: promptMsg })

        const res = await model.generateContent(parts)
        responseText = res.response.text()
      } catch (fallbackErr: any) {
        console.warn('Lỗi fallback gemini-3.5-flash-lite, thử với gemini-2.5-flash:', fallbackErr?.message)

        // 3. Fallback cuối cùng: gemini-2.5-flash
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        const parts: any[] = []
        if (fileBase64) {
          const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'application/pdf',
            },
          })
        }

        const promptMsg = `${SYSTEM_PROMPT}\n\n${examText ? `Nội dung đề thi do người dùng cung cấp:\n${examText}` : 'Hãy phân tích file tài liệu đề thi được đính kèm ở trên.'}`
        parts.push({ text: promptMsg })

        const res = await model.generateContent(parts)
        responseText = res.response.text()
      }
    }

    if (!responseText) {
      return NextResponse.json({ error: 'AI không trả về kết quả phân tích.' }, { status: 500 })
    }

    const parsedData = extractJson(responseText)

    // Chuẩn hóa id và type cho từng section
    if (Array.isArray(parsedData.sections)) {
      parsedData.sections = parsedData.sections.map((s: any, idx: number) => {
        let normType = 'single_choice'
        const rawT = (s.type || '').toString().toLowerCase().trim()
        if (rawT.includes('true') || rawT.includes('tf') || rawT.includes('đúng') || rawT.includes('sai')) {
          normType = 'true_false'
        } else if (rawT.includes('short') || rawT.includes('ngắn') || rawT.includes('điền') || rawT.includes('fill') || rawT === 'sa') {
          normType = 'short_answer'
        } else if (rawT.includes('essay') || rawT.includes('luận')) {
          normType = 'essay'
        } else {
          normType = 'single_choice'
        }

        return {
          id: `sec-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          name: s.name || `Phần ${idx + 1}`,
          totalPoints: Number(s.totalPoints) || (idx === 0 ? 4.5 : idx === 1 ? 4 : 1.5),
          scoringMode: s.scoringMode || 'auto_divide',
          questionCount: parseInt(s.questionCount) || 10,
          questionTypeMode: s.questionTypeMode || 'uniform',
          type: normType,
          instructions: s.instructions || `Thí sinh đọc kỹ đề bài và hoàn thành câu hỏi của ${s.name || `Phần ${idx + 1}`}.`,
          instructionImage: s.instructionImage || '',
          correctAnswers: s.correctAnswers || {},
          pointsPerQuestion: s.pointsPerQuestion || {},
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      modelUsed: 'gemini-3.5-flash-lite',
    })
  } catch (error: any) {
    console.error('Lỗi API phân tích đề thi AI:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi khi AI phân tích đề thi.',
        details: String(error),
      },
      { status: 500 }
    )
  }
}
