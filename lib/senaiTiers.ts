export type SenAiTierCode = 'free' | 'plus' | 'ultra'

export type SenAiTier = {
  code: SenAiTierCode
  label: string
  dailyLimit: number
  priceSenCash: number
}

// Hạng SenAI — mua bằng SenCash, nâng vĩnh viễn (không phải theo ngày/tháng như VIP).
// "free" là hạn mức mặc định cho mọi tài khoản, không mua được (giá 0, không hiển thị nút mua).
export const SENAI_TIERS: SenAiTier[] = [
  { code: 'free', label: 'Cơ bản', dailyLimit: 10, priceSenCash: 0 },
  { code: 'plus', label: 'SenAI Plus', dailyLimit: 50, priceSenCash: 100 },
  { code: 'ultra', label: 'SenAI Ultra', dailyLimit: 100, priceSenCash: 159 },
]

const TIER_RANK: Record<SenAiTierCode, number> = { free: 0, plus: 1, ultra: 2 }

export function getSenAiTier(code: string): SenAiTier | undefined {
  return SENAI_TIERS.find(t => t.code === code)
}

export function isTierUpgrade(currentCode: string, targetCode: SenAiTierCode): boolean {
  const current = TIER_RANK[currentCode as SenAiTierCode] ?? 0
  return TIER_RANK[targetCode] > current
}
