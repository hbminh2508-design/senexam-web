import { generateSenAi, prepareSenAiRequest, SenAiInputError, SEN_AI_PROVIDER_MODEL } from '@/lib/senAiGenerate'
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

    const reply = await generateSenAi(apiKey, input, body?.history)

    return NextResponse.json({
      text: reply,
      reply: reply,
      model: SEN_AI_PROVIDER_MODEL,
      mode: input.mode,
      used: userUsed,
      limit: user ? userLimit : null,
      remaining: user ? Math.max(0, userLimit - userUsed) : null,
    })
  } catch (error: any) {
    if (error instanceof SenAiInputError) return NextResponse.json({ error: error.message }, { status: 400 })
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
