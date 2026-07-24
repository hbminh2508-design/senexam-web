import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiPlan } from '@/lib/senaiTiers'
import { extendVipExpiry } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { planCode } = await request.json()
    const plan = getSenAiPlan(planCode)
    if (!plan) return NextResponse.json({ error: 'Gói SenAI không hợp lệ' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, senai_trial_used')
      .eq('id', user.id)
      .maybeSingle()

    if (plan.duration === 'trial_3d') {
      if (profile?.senai_trial_used) {
        return NextResponse.json({ error: 'Bạn đã dùng lượt dùng thử SenAI Plus rồi' }, { status: 400 })
      }
    } else if (plan.priceSenCash > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
        p_user_id: user.id,
        p_delta: -plan.priceSenCash,
        p_reason: 'senai_tier_purchase',
        p_reference: plan.code,
      })
      if (rpcError) {
        if (rpcError.message.includes('không đủ')) {
          return NextResponse.json({ error: 'Số dư SenCash không đủ để mua gói này' }, { status: 400 })
        }
        throw rpcError
      }
    }

    const update: Record<string, unknown> = { senai_tier: plan.tier }

    if (plan.duration === 'permanent') {
      update.senai_tier_permanent = true
      update.senai_tier_expires_at = null
    } else {
      update.senai_tier_permanent = false
      // Cùng hạng và còn hạn thì cộng dồn thời gian, khác hạng (hoặc đã hết hạn) thì tính lại từ hiện tại
      const sameTierStillActive = profile?.senai_tier === plan.tier && !profile?.senai_tier_permanent
        && !!profile?.senai_tier_expires_at && new Date(profile.senai_tier_expires_at).getTime() > Date.now()
      update.senai_tier_expires_at = extendVipExpiry(sameTierStillActive ? profile?.senai_tier_expires_at : null, plan.durationDays!)
      if (plan.duration === 'trial_3d') update.senai_trial_used = true
    }

    await supabaseAdmin.from('profiles').update(update).eq('id', user.id)

    return NextResponse.json({ success: true, tier: plan.tier, expiresAt: update.senai_tier_expires_at ?? null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi mua gói SenAI' }, { status: 500 })
  }
}
