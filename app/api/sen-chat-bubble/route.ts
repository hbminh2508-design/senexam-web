import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    const { message, sessionId, deepThink } = (await req.json()) as {
      message: string
      sessionId?: string
      deepThink?: boolean
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Nội dung câu hỏi không được để trống' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng liên hệ ban quản trị.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    let activeSessionId = sessionId

    // Kiểm tra quota nếu đã đăng nhập
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
        .eq('id', user.id)
        .maybeSingle()

      const tierDailyLimit = getEffectiveDailyLimit(profile)
      const planTier = getEffectivePlanTier(profile)
      const dailyLimit = getTotalSenaiDailyLimit(tierDailyLimit, planTier)

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count } = await supabaseAdmin
        .from('senai_question_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      if ((count || 0) >= dailyLimit) {
        return NextResponse.json(
          {
            error: `Bạn đã dùng hết ${dailyLimit} lượt hỏi SenAI hôm nay. Nâng cấp gói tại Quản lý Quota (/new-senai) để hỏi thêm.`,
          },
          { status: 429 }
        )
      }

      // Tạo hoặc lấy session trong SenAI Studio (Tự lưu về SenAI Studio)
      if (!activeSessionId) {
        const titleSnippet = message.trim().replace(/\n+/g, ' ').slice(0, 45)
        const { data: newSession, error: sErr } = await supabaseAdmin
          .from('senai_studio_sessions')
          .insert({
            user_id: user.id,
            title: `[Sen Chat] ${titleSnippet}${message.trim().length > 45 ? '...' : ''}`,
          })
          .select('id')
          .single()

        if (!sErr && newSession) {
          activeSessionId = newSession.id
        }
      }

      // Lưu tin nhắn user vào senai_studio_messages nếu có session
      if (activeSessionId) {
        await supabaseAdmin.from('senai_studio_messages').insert({
          session_id: activeSessionId,
          user_id: user.id,
          role: 'user',
          content: message.trim(),
          deep_think: !!deepThink,
        })
      }

      // Ghi nhận lượt hỏi
      await supabaseAdmin.from('senai_question_log').insert({ user_id: user.id })
    }

    // Khởi tạo Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = deepThink ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite'
    const model = genAI.getGenerativeModel({ model: modelName })

    const systemPrompt = `Bạn là Sen Chat — Trợ lý AI học tập thông minh thuộc hệ sinh thái SenExam (senexam.me).
Nhiệm vụ:
- Giải đáp thắc mắc bài tập, tóm tắt lý thuyết, giải thích câu trắc nghiệm nhanh gọn, súc tích.
- Định dạng toán học chuẩn: Luôn đặt công thức toán, lý, hóa trong cặp dấu $...$ (nội dòng) hoặc $$...$$ (khối).
- Dùng dấu chấm "." cho phép nhân và dấu phẩy "," cho số thập phân.
- Khi cần vẽ đồ thị hoặc mô hình hình học không gian, bạn có thể gợi ý người dùng truy cập SenGraph (sengraph.senexam.me).
- Luôn giữ thái độ thân thiện, khích lệ tinh thần học tập của sĩ tử.`

    const promptText = `${systemPrompt}\n\n${deepThink ? '[Chế độ Deep Think - Phân tích chuyên sâu]:\n' : ''}Câu hỏi từ học sinh: ${message.trim()}`

    const result = await model.generateContent(promptText)
    const replyText = result.response.text()

    // Lưu câu trả lời của AI vào senai_studio_messages & update session
    if (user && activeSessionId) {
      await supabaseAdmin.from('senai_studio_messages').insert({
        session_id: activeSessionId,
        user_id: user.id,
        role: 'model',
        content: replyText,
        deep_think: !!deepThink,
      })

      await supabaseAdmin
        .from('senai_studio_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeSessionId)
    }

    return NextResponse.json({
      text: replyText,
      reply: replyText,
      sessionId: activeSessionId || null,
      savedToStudio: !!(user && activeSessionId),
    })
  } catch (error: any) {
    console.error('Sen Chat Bubble API error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi xử lý trò chuyện với Sen Chat' },
      { status: 500 }
    )
  }
}
