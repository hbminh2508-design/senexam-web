import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseLatexExamCode, parseAnswerKeyText } from '@/lib/latexExamParser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Cho phép xử lý lên tới 120s

function extractJson(raw: string): any {
  if (!raw) return null
  let cleaned = raw.trim()
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim()
  } else {
    const braceMatch = cleaned.match(/(\[[\s\S]*\]|{[\s\S]*})/)
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

/**
 * Gọi AI Gemini kiểm tra đáp án hoặc giải câu hỏi theo từng nhóm nhỏ (15 câu)
 * Tránh triệt để lỗi giới hạn token 8192 và tối ưu tốc độ phản hồi
 */
async function verifyQuestionsWithGemini(
  genAI: GoogleGenerativeAI,
  questionsToVerify: {
    id: string
    number?: number
    type: string
    text: string
    options: string[]
    currentAnswer?: any
  }[],
  subject: string
): Promise<Map<string, { correctAnswer: any; explanation?: string }>> {
  const results = new Map<string, { correctAnswer: any; explanation?: string }>()
  if (!questionsToVerify || questionsToVerify.length === 0) return results

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
  const batchSize = 15

  for (let i = 0; i < questionsToVerify.length; i += batchSize) {
    const batch = questionsToVerify.slice(i, i + batchSize)

    const promptText = `Bạn là chuyên gia giải đề và thẩm định đáp án đề thi ${subject} chuẩn Bộ GD&ĐT Việt Nam.
Dưới đây là ${batch.length} câu hỏi. Hãy đọc kỹ, giải toán cẩn thận, xác định đáp án chuẩn xác nhất và viết lời giải chi tiết KaTeX ngắn gọn, sư phạm.

QUY TẮC ĐÁP ÁN:
- "single_choice": correctAnswer là một trong các chữ cái "A", "B", "C", "D".
- "true_false": correctAnswer là object JSON dạng {"a": "Đ", "b": "S", "c": "Đ", "d": "S"}.
- "short_answer": correctAnswer là chuỗi số hoặc giá trị ngắn gọn (ví dụ "1000", "2.5", "-4").

DANH SÁCH CÂU HỎI CẦN THẨM ĐỊNH:
${JSON.stringify(batch, null, 2)}

YÊU CẦU: Trả về DUY NHẤT một mảng JSON các đối tượng theo mẫu dưới đây, không thêm bất kỳ văn bản nào khác:
[
  {
    "id": "q-latex-...",
    "correctAnswer": "A",
    "explanation": "Lời giải chi tiết từng bước có công thức KaTeX $...$"
  }
]
`

    let batchSuccess = false
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })

        const res = await model.generateContent(promptText)
        const text = res.response.text()
        const parsed = extractJson(text)

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) {
              results.set(item.id, {
                correctAnswer: item.correctAnswer,
                explanation: item.explanation,
              })
            }
          }
          batchSuccess = true
          break
        }
      } catch (err: any) {
        console.warn(`[ParseLaTeX AI Check] Batch ${i / batchSize + 1} lỗi với ${modelName}:`, err?.message)
      }
    }

    if (!batchSuccess) {
      console.warn(`[ParseLaTeX AI Check] Không thể thẩm định batch ${i / batchSize + 1}`)
    }
  }

  return results
}

export async function POST(request: Request) {
  try {
    let action = 'parse' // 'parse' | 'ai_verify_answers'
    let latexCode = ''
    let answerText = ''
    let hasSeparateAnswer = false
    let answerFileBase64: string | undefined
    let answerMimeType = 'application/pdf'
    let subject = 'Toán học'
    let verifyWithAi = false
    let questionsForVerify: any[] = []

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      action = (formData.get('action') as string) || 'parse'
      latexCode = (formData.get('latexCode') as string) || ''
      answerText = (formData.get('answerText') as string) || ''
      hasSeparateAnswer = formData.get('hasSeparateAnswer') === '1'
      subject = (formData.get('subject') as string) || 'Toán học'
      verifyWithAi = formData.get('verifyWithAi') === '1'

      const latexFile = formData.get('latexFile') as File | null
      if (latexFile) {
        latexCode = await latexFile.text()
      }

      const answerFile = formData.get('answerFile') as File | null
      if (answerFile) {
        answerMimeType = answerFile.type || 'application/pdf'
        if (
          answerFile.type?.includes('text') ||
          answerFile.name?.endsWith('.tex') ||
          answerFile.name?.endsWith('.txt')
        ) {
          answerText = await answerFile.text()
        } else {
          const ab = await answerFile.arrayBuffer()
          answerFileBase64 = Buffer.from(ab).toString('base64')
        }
      }
    } else {
      const body = await request.json().catch(() => null)
      if (body) {
        action = body.action || 'parse'
        latexCode = body.latexCode || ''
        answerText = body.answerText || ''
        hasSeparateAnswer = Boolean(body.hasSeparateAnswer)
        answerFileBase64 = body.answerFileBase64
        answerMimeType = body.answerMimeType || 'application/pdf'
        subject = body.subject || 'Toán học'
        verifyWithAi = Boolean(body.verifyWithAi)
        questionsForVerify = Array.isArray(body.questions) ? body.questions : []
      }
    }

    const apiKey = process.env.GEMINI_API_KEY
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

    // ========================================================
    // ACTION: 'ai_verify_answers' (Chuyên kiểm tra đáp án cho câu hỏi có sẵn)
    // ========================================================
    if (action === 'ai_verify_answers') {
      if (!genAI) {
        return NextResponse.json(
          { error: 'Chưa cấu hình GEMINI_API_KEY để sử dụng tính năng AI thẩm định đáp án.' },
          { status: 500 }
        )
      }

      if (!questionsForVerify || questionsForVerify.length === 0) {
        return NextResponse.json(
          { error: 'Danh sách câu hỏi cần thẩm định trống.' },
          { status: 400 }
        )
      }

      const minimalList = questionsForVerify.map((q, idx) => ({
        id: q.id || `q-${idx + 1}`,
        number: idx + 1,
        type: q.type,
        text: q.text,
        options: q.options || [],
        currentAnswer: q.correctAnswer,
      }))

      const aiAnswersMap = await verifyQuestionsWithGemini(genAI, minimalList, subject)

      const updatedQuestions = questionsForVerify.map((q) => {
        const aiInfo = aiAnswersMap.get(q.id)
        if (aiInfo) {
          return {
            ...q,
            correctAnswer: aiInfo.correctAnswer ?? q.correctAnswer,
            explanation: aiInfo.explanation || q.explanation,
            aiVerified: true,
          }
        }
        return q
      })

      return NextResponse.json({
        success: true,
        verifiedCount: aiAnswersMap.size,
        totalCount: questionsForVerify.length,
        questions: updatedQuestions,
      })
    }

    // ========================================================
    // ACTION: 'parse' (Biên soạn đề từ mã nguồn LaTeX)
    // ========================================================
    if (!latexCode.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mã nguồn LaTeX hoặc tải lên file .tex cần biên soạn!' },
        { status: 400 }
      )
    }

    // 1. CHẠY BỘ BIÊN SOẠN THUẦN TOÁN HỌC (DETERMINISTIC LATEX ENGINE)
    // Tốc độ ~20ms, xử lý file 100KB - 2MB+ mà không lo token limit hay timeout
    const parsedData = parseLatexExamCode(latexCode, answerText)

    // Nếu bóc tách thành công các câu hỏi từ LaTeX
    if (parsedData.questions.length > 0) {
      let finalQuestions = parsedData.questions

      // 2. GIAO CHO AI KIỂM TRA ĐÁP ÁN NẾU:
      // - Người dùng bật cờ `verifyWithAi`
      // - HOẶC người dùng chọn chế độ "Chưa có file đáp án (AI tự giải)" và còn câu hỏi chưa có đáp án trong LaTeX
      const needsAiSolving =
        (verifyWithAi || (!hasSeparateAnswer && parsedData.missingAnswersCount > 0)) && Boolean(genAI)

      let aiVerifiedCount = 0

      if (needsAiSolving && genAI) {
        // Chỉ gửi những câu hỏi chưa có đáp án (hoặc toàn bộ nếu verifyWithAi)
        const questionsToSolve = verifyWithAi
          ? finalQuestions
          : finalQuestions.filter((q) => !q.hasAnswerInLatex)

        if (questionsToSolve.length > 0) {
          const minimalList = questionsToSolve.map((q, idx) => ({
            id: q.id,
            number: q.number || idx + 1,
            type: q.type,
            text: q.text,
            options: q.options,
            currentAnswer: q.correctAnswer,
          }))

          const aiResults = await verifyQuestionsWithGemini(genAI, minimalList, subject)
          aiVerifiedCount = aiResults.size

          finalQuestions = finalQuestions.map((q) => {
            const aiRes = aiResults.get(q.id)
            if (aiRes) {
              return {
                ...q,
                correctAnswer: aiRes.correctAnswer ?? q.correctAnswer,
                explanation: aiRes.explanation || q.explanation,
                hasAnswerInLatex: true,
              }
            }
            return q
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          title: parsedData.title,
          subject: parsedData.subject || subject,
          exam_type: parsedData.exam_type || 'THPTQG',
          duration: parsedData.duration || 50,
          questions: finalQuestions,
        },
        engine: 'SenExam Deterministic LaTeX Parser v2.0',
        parseTimeMs: parsedData.parseTimeMs,
        questionCount: finalQuestions.length,
        matchedAnswersCount: parsedData.matchedAnswersCount + aiVerifiedCount,
        missingAnswersCount: Math.max(0, parsedData.missingAnswersCount - aiVerifiedCount),
        aiVerifiedCount,
      })
    }

    // 3. NẾU BỘ BIÊN SOẠN THUẦN KHÔNG TÌM THẤY CÂU HỎI (MÃ NGUỒN QUÁ ĐẶC DỊ):
    // Dùng Gemini phân tích với cấu trúc câu hỏi
    if (!genAI) {
      return NextResponse.json(
        {
          error:
            'Hệ thống không tìm thấy khối câu hỏi chuẩn trong mã LaTeX (cần định dạng \\begin{ex} hoặc "Câu 1:"). Vui lòng xem hướng dẫn cú pháp hoặc cấu hình GEMINI_API_KEY để phân tích thông minh.',
        },
        { status: 422 }
      )
    }

    const fallbackModel = genAI.getGenerativeModel({
      model: 'gemini-3.8-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      },
    })

    const promptText = `Bạn là chuyên gia số hóa đề thi KaTeX Việt Nam.
Bóc tách danh sách câu hỏi từ mã LaTeX sau thành cấu trúc JSON:
{
  "title": "Tiêu đề đề thi",
  "subject": "${subject}",
  "exam_type": "THPTQG",
  "duration": 50,
  "questions": [
    {
      "id": "q-1",
      "type": "single_choice",
      "text": "Câu hỏi KaTeX $...$",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "Lời giải KaTeX",
      "points": 1
    }
  ]
}

MÃ LATEX:
\`\`\`latex
${latexCode.slice(0, 40000)}
\`\`\`
`

    const res = await fallbackModel.generateContent(promptText)
    const fallbackParsed = extractJson(res.response.text())

    if (
      !fallbackParsed ||
      !Array.isArray(fallbackParsed.questions) ||
      fallbackParsed.questions.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Không thể nhận diện được câu hỏi từ mã LaTeX. Vui lòng xem hướng dẫn định dạng file LaTeX!',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: fallbackParsed,
      engine: 'Gemini Fallback Parser',
      questionCount: fallbackParsed.questions.length,
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
