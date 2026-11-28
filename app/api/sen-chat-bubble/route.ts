import { generateSenAi, prepareSenAiRequest, SenAiInputError } from '@/lib/senAiGenerate'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    const body = await req.json().catch(() => null)
    const input = prepareSenAiRequest(body)
    const { message } = input
    const sessionId = typeof body?.sessionId === 'string' && user ? body.sessionId : undefined
    const deepThink = input.mode === 'orchid'
    let history: unknown = body?.history

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng liên hệ ban quản trị.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    let activeSessionId = sessionId

    let userLimit = 0
    let userUsed = 0

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

      if (sessionId) {
        const { data: owner } = await supabaseAdmin.from('senai_studio_sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
        if (!owner) return NextResponse.json({ error: 'Không tìm thấy phiên SenAI.' }, { status: 404 })
        const { data: previous } = await supabaseAdmin.from('senai_studio_messages')
          .select('role, content').eq('session_id', sessionId).eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(12)
        history = previous?.reverse()
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
      userUsed = currentCount + 1
    }

    const replyText = await generateSenAi(apiKey, input, history)

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
      used: userUsed,
      limit: userLimit,
      remaining: user ? Math.max(0, userLimit - userUsed) : null,
    })
  } catch (error: any) {
    if (error instanceof SenAiInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('Sen Chat Bubble API error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi xử lý trò chuyện với Sen Chat' },
      { status: 500 }
    )
  }
}
