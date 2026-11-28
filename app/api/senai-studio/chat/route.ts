import { generateSenAi, prepareSenAiRequest, SenAiInputError } from '@/lib/senAiGenerate'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit, getEffectiveSenaiTier } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const input = prepareSenAiRequest(body)
    const { message } = input
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : undefined
    const attachments = Array.isArray(body?.attachments) ? body.attachments : []
    const deepThink = input.mode === 'orchid'

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    const tier = getEffectiveSenaiTier(profile)
    if (tier !== 'ultra' && tier !== 'max') {
      return NextResponse.json({ error: 'SenAI Studio chỉ dành cho thành viên SenAI Ultra hoặc Sen Max' }, { status: 403 })
    }

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

    // Lấy hoặc tạo cuộc trò chuyện — không cho client tự insert để tránh giả mạo session của người khác
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const { data: newSession, error: sessionErr } = await supabaseAdmin
        .from('senai_studio_sessions')
        .insert({ user_id: user.id, title: message.trim().slice(0, 60) || 'Tệp đính kèm' })
        .select('id')
        .single()
      if (sessionErr) throw sessionErr
      activeSessionId = newSession.id
    } else {
      const { data: existing } = await supabaseAdmin.from('senai_studio_sessions').select('id, user_id').eq('id', activeSessionId).maybeSingle()
      if (!existing || existing.user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy cuộc trò chuyện' }, { status: 404 })
    }

    const { data: history } = await supabaseAdmin
      .from('senai_studio_messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: false })
      .limit(30)

    await supabaseAdmin.from('senai_studio_messages').insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: 'user',
      content: message || '',
      attachments: attachments?.map(a => ({ name: a.name, mimeType: a.mimeType })) || [],
      deep_think: !!deepThink,
    })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống' }, { status: 500 })

    const responseText = await generateSenAi(apiKey, input, [...(history || [])].reverse())

    await supabaseAdmin.from('senai_studio_messages').insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: 'model',
      content: responseText,
      deep_think: !!deepThink,
    })
    await supabaseAdmin.from('senai_studio_sessions').update({ updated_at: new Date().toISOString() }).eq('id', activeSessionId)

    return NextResponse.json({
      text: responseText,
      sessionId: activeSessionId,
      used: currentCount + 1,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - currentCount - 1),
    })
  } catch (e) {
    if (e instanceof SenAiInputError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('SenAI Studio error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Đã có lỗi xảy ra' }, { status: 500 })
  }
}
