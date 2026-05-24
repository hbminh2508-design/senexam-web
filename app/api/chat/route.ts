import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const apiKey = process.env.GEMINI_API_KEY || ''
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

type ChatRequestBody = {
  message?: unknown
  history?: unknown
}

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

type IncomingChatMessage = {
  role?: unknown
  text?: unknown
}

const systemPrompt = `Bạn là SenAI, trợ lý AI chính thức của SenExam.ME.

Mục tiêu:
- Hướng dẫn người dùng sử dụng website SenExam nhanh, đúng và thân thiện.
- Trả lời ngắn gọn, rõ ràng bằng tiếng Việt tự nhiên.
- Nếu người dùng hỏi về tài liệu, đề thi, hay vị trí tính năng, hãy ưu tiên gợi ý đúng đường dẫn nội bộ.

Ngữ cảnh sản phẩm SenExam:
- Dashboard: /dashboard
- Kho tài liệu: /library
- Kho đề thi: /exams
- Cộng đồng hỏi đáp: /forum
- Phòng tập trung: /focus

Quy tắc trả lời:
- Nếu người dùng hỏi “có tài liệu này không”, “có đề này không”, “môn này ở đâu”, hãy hướng dẫn họ tìm ở /library hoặc /exams trước, và nhắc ô tìm kiếm trên dashboard.
- Nếu biết tính năng phù hợp, hãy nêu đúng đường dẫn nội bộ bằng dạng /library, /exams, /forum, /focus, /dashboard.
- Không được bịa rằng web có nội dung cụ thể nếu bạn không chắc. Hãy nói rõ rằng bạn gợi ý nơi kiểm tra nhanh nhất.
- Nếu câu hỏi vượt ngoài SenExam hoặc học tập, hãy từ chối lịch sự và kéo người dùng quay lại mục học tập.
- Nếu người dùng cần trợ giúp bài kiểm tra, hãy ưu tiên chỉ họ sang /exams; nếu cần tài liệu, ưu tiên /library; nếu cần trao đổi, ưu tiên /forum.

Phong cách:
- Xưng là “mình” hoặc “SenAI”.
- Gọi người dùng là “bạn”, riêng giáo viên thì có thể xưng “thầy/cô”.
- Có thể dùng 1-2 emoji phù hợp, nhưng không lạm dụng.
- Nếu câu trả lời dài, hãy rút gọn thành gạch đầu dòng.

Ví dụ:
- “Bạn vào /library để tìm tài liệu, hoặc dùng ô tìm kiếm trên /dashboard nếu muốn tra nhanh theo tên.”
- “Nếu bạn đang tìm đề thi, hãy vào /exams. Còn muốn hỏi đáp thêm thì /forum là đúng chỗ nhất.”`

const buildMessages = (history: IncomingChatMessage[], message: string) => {
  const formattedHistory: { role: 'user' | 'model'; parts: [{ text: string }] }[] = history
    .map((msg) => {
      const role = msg.role === 'user' ? 'user' : 'model'
      const text = typeof msg.text === 'string' ? msg.text.trim() : ''
      return text ? { role, parts: [{ text }] } : null
    })
    .filter((item): item is { role: 'user' | 'model'; parts: [{ text: string }] } => item !== null)

  return [...formattedHistory, { role: 'user', parts: [{ text: message }] }]
}

const isIncomingChatMessage = (value: unknown): value is IncomingChatMessage => {
  return Boolean(value) && typeof value === 'object'
}

export async function POST(req: Request) {
  try {
    if (!ai) {
      return NextResponse.json({ error: 'Thiếu GEMINI_API_KEY trong biến môi trường server.' }, { status: 500 })
    }

    const body = (await req.json().catch(() => null)) as ChatRequestBody | null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const history = Array.isArray(body?.history) ? body.history.filter(isIncomingChatMessage) : []

    if (!message) {
      return NextResponse.json({ error: 'Nội dung tin nhắn không được để trống.' }, { status: 400 })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildMessages(history, message),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    })

    return NextResponse.json({ text: response.text ?? '' })
  } catch (error) {
    const errorObject = error as { status?: number; code?: number; response?: { status?: number } }
    const status = Number(errorObject?.status ?? errorObject?.code ?? errorObject?.response?.status ?? 0)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isQuotaError = status === 429 || /429|resource exhausted|too many requests/i.test(message)
    const isPermissionError = status === 401 || status === 403 || /permission denied|access denied|denied access/i.test(message)

    if (isQuotaError) {
      return NextResponse.json(
        { error: 'Gemini đang quá lượt sử dụng. SenAI ngoại tuyến sẽ tạm thời thay bạn trả lời.' },
        { status: 429 }
      )
    }

    if (isPermissionError) {
      return NextResponse.json(
        { error: 'Gemini chưa được cấp quyền cho project này. SenAI ngoại tuyến sẽ tạm thời thay bạn trả lời.' },
        { status: 403 }
      )
    }

    console.error('Lỗi Gemini API chi tiết:', error)
    return NextResponse.json({ error: 'Lỗi API: ' + message }, { status: 500 })
  }
}