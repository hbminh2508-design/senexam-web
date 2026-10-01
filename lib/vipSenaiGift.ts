import type { SupabaseClient } from '@supabase/supabase-js'
import type { VipPlanCode } from '@/lib/vipMembership'
import { SENAI_TIER_DAILY_LIMIT, getEffectiveSenaiTier, type SenAiTierCode, type SenAiProfileFields } from '@/lib/senaiTiers'

// Mua VIP theo tháng tặng SenAI Lite, theo năm tặng SenAI Plus Lite — bỏ qua nếu người dùng
// đã có hạng SenAI cao hơn hoặc bằng (không hạ cấp/ghi đè gói tốt hơn họ đang có).
export const VIP_PLAN_SENAI_GIFT: Partial<Record<VipPlanCode, { tier: SenAiTierCode }>> = {
  monthly: { tier: 'lite' },
  yearly: { tier: 'plus_lite' },
}

// Mua VIP từ 3 tháng trở lên (quarterly/yearly) được tặng voucher giảm 30% gói SenAI Plus năm, dùng 1 lần
export const VOUCHER_ELIGIBLE_VIP_PLANS: VipPlanCode[] = ['quarterly', 'yearly']
export const SENAI_PLUS_YEARLY_VOUCHER_KIND = 'senai_plus_yearly_30off'

// Nâng hạng SenAI của user lên `tier` nếu hạng hiện tại thấp hơn (không hạ cấp/ghi đè gói tốt hơn
// họ đang có) — dùng chung cho quà tặng SenAI của cả gói VIP và Premium. Hạn dùng gắn liền với hạn
// của gói VIP/Premium vừa mua (cùng vipExpiresAt) thay vì đếm riêng, để gói tặng luôn hết hạn cùng
// lúc với gói membership sinh ra nó — mua/gia hạn VIP thế nào thì quà SenAI theo y hệt thế đó.
async function grantSenaiTierIfBetter(
  supabaseAdmin: SupabaseClient, userId: string, tier: SenAiTierCode, vipExpiresAt: string
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('senai_tier, senai_tier_expires_at, senai_tier_permanent')
    .eq('id', userId)
    .maybeSingle()

  const effectiveTier = getEffectiveSenaiTier(profile as SenAiProfileFields)
  if (SENAI_TIER_DAILY_LIMIT[effectiveTier] >= SENAI_TIER_DAILY_LIMIT[tier]) return

  await supabaseAdmin
    .from('profiles')
    .update({ senai_tier: tier, senai_tier_permanent: false, senai_tier_expires_at: vipExpiresAt })
    .eq('id', userId)
}

export async function applyVipPurchasePerks(supabaseAdmin: SupabaseClient, userId: string, planCode: VipPlanCode, vipExpiresAt: string) {
  const gift = VIP_PLAN_SENAI_GIFT[planCode]
  if (gift) await grantSenaiTierIfBetter(supabaseAdmin, userId, gift.tier, vipExpiresAt)

  if (VOUCHER_ELIGIBLE_VIP_PLANS.includes(planCode)) {
    await supabaseAdmin.from('sencash_vouchers').insert({
      user_id: userId,
      kind: SENAI_PLUS_YEARLY_VOUCHER_KIND,
      discount_percent: 30,
      source_vip_plan: planCode,
    })
  }
}

// Mua Premium từ 3 tháng (quarterly) tặng thẳng hạng SenAI Plus, mua theo năm tặng hạng SenAI Ultra
// — mạnh hơn quà VIP (chỉ cộng hạn mức câu hỏi) vì đây là quà tặng HẠNG thật, không chỉ số câu hỏi/ngày.
export const PREMIUM_PLAN_SENAI_GIFT: Partial<Record<VipPlanCode, { tier: SenAiTierCode }>> = {
  quarterly: { tier: 'plus' },
  yearly: { tier: 'ultra' },
}

export async function applyPremiumPurchasePerks(supabaseAdmin: SupabaseClient, userId: string, planCode: VipPlanCode, vipExpiresAt: string) {
  const gift = PREMIUM_PLAN_SENAI_GIFT[planCode]
  if (gift) await grantSenaiTierIfBetter(supabaseAdmin, userId, gift.tier, vipExpiresAt)
}

// Mua Premium+: theo tháng tặng SenAI Plus, theo quý tặng SenAI Ultra, theo năm tặng thẳng Sen Max
export const PREMIUM_PLUS_PLAN_SENAI_GIFT: Partial<Record<VipPlanCode, { tier: SenAiTierCode }>> = {
  monthly: { tier: 'plus' },
  quarterly: { tier: 'ultra' },
  yearly: { tier: 'max' },
}

export async function applyPremiumPlusPurchasePerks(supabaseAdmin: SupabaseClient, userId: string, planCode: VipPlanCode, vipExpiresAt: string) {
  await supabaseAdmin.from('profiles').update({ is_vip_premium_plus: true }).eq('id', userId)
  const gift = PREMIUM_PLUS_PLAN_SENAI_GIFT[planCode]
  if (gift) await grantSenaiTierIfBetter(supabaseAdmin, userId, gift.tier, vipExpiresAt)
}

// Gói Sen One: bao gồm Gói Sen Max (500 câu/ngày, 15 SenGraph) + VIP Premium+
export async function applySenOnePurchasePerks(supabaseAdmin: SupabaseClient, userId: string, vipExpiresAt: string) {
  await supabaseAdmin.from('profiles').update({ is_vip_premium_plus: true }).eq('id', userId)
  await grantSenaiTierIfBetter(supabaseAdmin, userId, 'max', vipExpiresAt)
}

// Gói Sen One Lite: bao gồm Gói SenAI Plus + VIP cơ bản
export async function applySenOneLitePurchasePerks(supabaseAdmin: SupabaseClient, userId: string, vipExpiresAt: string) {
  await grantSenaiTierIfBetter(supabaseAdmin, userId, 'plus', vipExpiresAt)
}

