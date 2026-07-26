import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit, getEffectiveSenaiTier } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
    .eq('id', user.id)
    .maybeSingle()

  const tierDailyLimit = getEffectiveDailyLimit(profile)
  const planTier = getEffectivePlanTier(profile)
  const limit = getTotalSenaiDailyLimit(tierDailyLimit, planTier)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const { count } = await supabaseAdmin
    .from('senai_question_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('asked_at', startOfToday.toISOString())

  const used = count || 0
  return NextResponse.json({
    used,
    limit,
    remaining: Math.max(0, limit - used),
    tier: getEffectiveSenaiTier(profile),
  })
}
