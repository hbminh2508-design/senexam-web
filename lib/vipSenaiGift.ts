import type { SupabaseClient } from '@supabase/supabase-js'
import type { VipPlanCode } from '@/lib/vipMembership'
import { extendVipExpiry } from '@/lib/vipMembership'
import { SENAI_TIER_DAILY_LIMIT, getEffectiveSenaiTier, type SenAiTierCode, type SenAiProfileFields } from '@/lib/senaiTiers'

// Mua VIP theo tháng tặng SenAI Lite, theo năm tặng SenAI Plus Lite — bỏ qua nếu người dùng
// đã có hạng SenAI cao hơn hoặc bằng (không hạ cấp/ghi đè gói tốt hơn họ đang có).
export const VIP_PLAN_SENAI_GIFT: Partial<Record<VipPlanCode, { tier: SenAiTierCode, durationDays: number }>> = {
  monthly: { tier: 'lite', durationDays: 30 },
  yearly: { tier: 'plus_lite', durationDays: 365 },
}

// Mua VIP từ 3 tháng trở lên (quarterly/yearly) được tặng voucher giảm 30% gói SenAI Plus năm, dùng 1 lần
export const VOUCHER_ELIGIBLE_VIP_PLANS: VipPlanCode[] = ['quarterly', 'yearly']
export const SENAI_PLUS_YEARLY_VOUCHER_KIND = 'senai_plus_yearly_30off'

export async function applyVipPurchasePerks(supabaseAdmin: SupabaseClient, userId: string, planCode: VipPlanCode) {
  const gift = VIP_PLAN_SENAI_GIFT[planCode]
  if (gift) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent')
      .eq('id', userId)
      .maybeSingle()

    const effectiveTier = getEffectiveSenaiTier(profile as SenAiProfileFields)
    if (SENAI_TIER_DAILY_LIMIT[effectiveTier] < SENAI_TIER_DAILY_LIMIT[gift.tier]) {
      const sameTierStillActive = profile?.senai_tier === gift.tier && !profile?.senai_tier_permanent
        && !!profile?.senai_tier_expires_at && new Date(profile.senai_tier_expires_at).getTime() > Date.now()
      const newExpiresAt = extendVipExpiry(sameTierStillActive ? profile?.senai_tier_expires_at : null, gift.durationDays)
      await supabaseAdmin
        .from('profiles')
        .update({ senai_tier: gift.tier, senai_tier_permanent: false, senai_tier_expires_at: newExpiresAt })
        .eq('id', userId)
    }
  }

  if (VOUCHER_ELIGIBLE_VIP_PLANS.includes(planCode)) {
    await supabaseAdmin.from('sencash_vouchers').insert({
      user_id: userId,
      kind: SENAI_PLUS_YEARLY_VOUCHER_KIND,
      discount_percent: 30,
      source_vip_plan: planCode,
    })
  }
}
