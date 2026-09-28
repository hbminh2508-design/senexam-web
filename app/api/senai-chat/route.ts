import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    const body = await req.json().catch(() => null)
    const message = body?.message || body?.prompt || ''
    const imageBase64 = body?.image || body?.imageData || ''
    const deepThink = !!body?.deepThink
    const requestedModel = body?.model

    if (!message.trim() && !imageBase64) {
      return NextResponse.json({ error: 'Nội dung câu hỏi hoặc hình ảnh không được để trống' }, { status: 400 })
    }

    let userLimit = 0
    let userUsed = 0

    // Kiểm tra quota nếu có đăng nhập
    if (user) {
      const supabaseAdmin = getSupabaseAdmin()
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
        .eq('id', user.id)
        .maybeSingle()

      const tierDailyLimit = getEffectiveDailyLimit(profile)
      const planTier = getEffectivePlanTier(profile)
      const dailyLimit = getTotalSenaiDailyLimit(tierDailyLimit, planTier)
      userLimit = dailyLimit

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count } = await supabaseAdmin
        .from('senai_question_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      const currentCount = count || 0
      if (currentCount >= dailyLimit) {
        return NextResponse.json(
          {
            error: `Bạn đã dùng hết ${dailyLimit} lượt hỏi SenAI hôm nay. Nâng cấp gói tại Quản lý Quota (/new-senai) để hỏi thêm.`,
          },
          { status: 429 }
        )
      }

      await supabaseAdmin.from('senai_question_log').insert({ user_id: user.id })
      userUsed = currentCount + 1
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Chưa cấu hình GEMINI_API_KEY trên server.',
          text: 'Hệ thống chưa tìm thấy khóa API của AI. Vui lòng liên hệ ban quản trị để kích hoạt.',
          reply: 'Hệ thống chưa tìm thấy khóa API của AI. Vui lòng liên hệ ban quản trị để kích hoạt.',
        },
        { status: 200 }
      )
    }

    const baseSystemPrompt = `Bạn là SenAI — Trợ lý AI giáo dục & luyện thi thông minh của nền tảng SenExam.
Nhiệm vụ của bạn là giải đáp bài tập, giải thích chi tiết đáp án câu hỏi trắc nghiệm/tự luận, cung cấp phương pháp làm bài và lời khuyên ôn thi.
Quy tắc trả lời:
- Luôn sử dụng ký hiệu LaTeX bọc trong dấu $ hoặc $$ cho mọi công thức Toán, Lý, Hóa.
- Sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho số thập phân tiếng Việt nếu cần.
- Trình bày mạch lạc, dễ hiểu, từng bước rõ ràng, giải thích vì sao đáp án đúng là chính xác và vì sao các phương án khác bị loại trừ.
- Nếu là chế độ Deep Think, hãy suy luận logic nhiều bước sâu sắc và toàn diện.`

    const modelName = requestedModel || (deepThink ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite')

    let reply = ''

    // Xử lý ảnh nếu có
    const contentParts: any[] = []
    const promptText = `${baseSystemPrompt}\n\n${deepThink ? '[Chế độ Deep Think - Tư duy chuyên sâu]:\n' : ''}${message || 'Hãy giải thích và giải chi tiết bài tập trong hình ảnh này.'}`
    contentParts.push(promptText)

    if (imageBase64) {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/)
      if (mimeMatch) {
        contentParts.push({
          inlineData: {
            mimeType: mimeMatch[1],
            data: mimeMatch[2],
          },
        })
      }
    }

    // Thử gọi qua GoogleGenerativeAI SDK
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      let model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(contentParts)
      reply = result.response.text()
    } catch (sdkError: any) {
      console.warn('Lỗi gọi model đầu tiên, thử fallback:', sdkError?.message)
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' })
        const fallbackResult = await fallbackModel.generateContent(contentParts)
        reply = fallbackResult.response.text()
      } catch (fallbackError: any) {
        try {
          const ai = new GoogleGenAI({ apiKey })
          const res = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: promptText,
          })
          reply = res.text ?? ''
        } catch (e: any) {
          throw new Error(`Lỗi kết nối Gemini: ${e.message || fallbackError.message || sdkError.message}`)
        }
      }
    }

    return NextResponse.json({
      text: reply,
      reply: reply,
      model: modelName,
      used: userUsed,
      limit: user ? userLimit : null,
      remaining: user ? Math.max(0, userLimit - userUsed) : null,
    })
  } catch (error: any) {
    console.error('Lỗi API SenAI Chat:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi xử lý yêu cầu AI',
        text: `Đã xảy ra lỗi khi trao đổi với SenAI: ${error.message || 'Vui lòng thử lại sau.'}`,
        reply: `Đã xảy ra lỗi khi trao đổi với SenAI: ${error.message || 'Vui lòng thử lại sau.'}`,
      },
      { status: 200 }
    )
  }
}
