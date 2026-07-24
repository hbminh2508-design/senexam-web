export type SenAiTierCode = 'free' | 'lite' | 'plus_lite' | 'plus' | 'ultra'
export type SenAiPlanDuration = 'trial_3d' | 'monthly' | 'yearly' | 'permanent'

export type SenAiPlan = {
  code: string
  tier: SenAiTierCode
  duration: SenAiPlanDuration
  durationDays: number | null // null = vĩnh viễn, không hết hạn
  label: string
  priceSenCash: number
}

// Hạn mức câu hỏi/ngày theo hạng — dùng để tính quota trong /api/chat và gate SenAI Studio (chỉ ultra)
export const SENAI_TIER_DAILY_LIMIT: Record<SenAiTierCode, number> = {
  free: 10,
  lite: 20,
  plus_lite: 35,
  plus: 50,
  ultra: 100,
}

export const SENAI_TIER_LABEL: Record<SenAiTierCode, string> = {
  free: 'SenAI',
  lite: 'SenAI Lite',
  plus_lite: 'SenAI Plus Lite',
  plus: 'SenAI Plus',
  ultra: 'SenAI Ultra',
}

// Danh mục gói SenAI — mua bằng SenCash. Gói năm luôn bằng 10 lần giá gói tháng cùng hạng.
// Chỉ SenAI Plus có bản Vĩnh viễn; chỉ SenAI Plus có gói dùng thử 3 ngày (miễn phí, 1 lần/tài khoản).
export const SENAI_PLANS: SenAiPlan[] = [
  { code: 'plus_trial', tier: 'plus', duration: 'trial_3d', durationDays: 3, label: 'SenAI Plus — Dùng thử 3 ngày', priceSenCash: 0 },
  { code: 'lite_monthly', tier: 'lite', duration: 'monthly', durationDays: 30, label: 'SenAI Lite — 1 tháng', priceSenCash: 29 },
  { code: 'plus_lite_monthly', tier: 'plus_lite', duration: 'monthly', durationDays: 30, label: 'SenAI Plus Lite — 1 tháng', priceSenCash: 69 },
  { code: 'plus_monthly', tier: 'plus', duration: 'monthly', durationDays: 30, label: 'SenAI Plus — 1 tháng', priceSenCash: 100 },
  { code: 'plus_yearly', tier: 'plus', duration: 'yearly', durationDays: 365, label: 'SenAI Plus — 1 năm', priceSenCash: 1_000 },
  { code: 'plus_permanent', tier: 'plus', duration: 'permanent', durationDays: null, label: 'SenAI Plus — Vĩnh viễn', priceSenCash: 2_999 },
  { code: 'ultra_monthly', tier: 'ultra', duration: 'monthly', durationDays: 30, label: 'SenAI Ultra — 1 tháng', priceSenCash: 159 },
  { code: 'ultra_yearly', tier: 'ultra', duration: 'yearly', durationDays: 365, label: 'SenAI Ultra — 1 năm', priceSenCash: 1_590 },
]

export function getSenAiPlan(code: string): SenAiPlan | undefined {
  return SENAI_PLANS.find(p => p.code === code)
}

export type SenAiProfileFields = {
  senai_tier?: string | null
  senai_tier_expires_at?: string | null
  senai_tier_permanent?: boolean | null
}

// Hạng SenAI thật sự đang có hiệu lực: vĩnh viễn thì luôn còn, có hạn thì phải chưa hết hạn — nếu
// hết hạn và không phải vĩnh viễn thì coi như đã rớt về hạng free (giống cơ chế hết hạn VIP).
export function getEffectiveSenaiTier(profile: SenAiProfileFields | null | undefined): SenAiTierCode {
  const tier = (profile?.senai_tier as SenAiTierCode) || 'free'
  if (tier === 'free') return 'free'
  if (profile?.senai_tier_permanent) return tier
  if (profile?.senai_tier_expires_at && new Date(profile.senai_tier_expires_at).getTime() > Date.now()) return tier
  return 'free'
}

export function getEffectiveDailyLimit(profile: SenAiProfileFields | null | undefined): number {
  return SENAI_TIER_DAILY_LIMIT[getEffectiveSenaiTier(profile)]
}
