import type { PlanTier } from '@/lib/vipMembership'

// Cửa hàng cao cấp (/exclusive-store) — chỉ VIP/Premium mới vào được. Bán gói SenAI Plus/Ultra
// với giá ưu đãi vào 2 dịp: "sale hàng tháng" (mua được mọi ngày, giới hạn số lần/tháng theo hạng)
// và "Black Friday" (giảm sốc, giới hạn số suất, mỗi năm 1 lần).

// Giảm giá sale hàng tháng theo hạng thành viên đang có — mua được bất kỳ ngày nào trong tháng
export const MONTHLY_FLASH_SALE_DISCOUNT_PERCENT: Record<'vip' | 'premium', number> = {
  vip: 10,
  premium: 15,
}

// Số lần được mua giá sale hàng tháng/tháng theo hạng — VIP 1 lần, Premium 2 lần (đếm theo
// exclusive_flash_purchases, mỗi lần mua trừ 1 suất bất kể chọn gói nào trong ELIGIBLE_PLANS).
export const MONTHLY_FLASH_SALE_QUOTA: Record<'vip' | 'premium', number> = {
  vip: 1,
  premium: 2,
}

// Khoá tháng hiện tại dạng 'YYYY-MM' — dùng để đếm số lần đã mua sale hàng tháng trong tháng này
export function getClaimMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Black Friday truyền thống = thứ Sáu ngay sau thứ Năm thứ 4 của tháng 11 (theo quy ước quốc tế)
export function isBlackFridayDate(date: Date = new Date()): boolean {
  if (date.getMonth() !== 10) return false // tháng 11 (0-indexed)
  const nov1Weekday = new Date(date.getFullYear(), 10, 1).getDay()
  const firstThursday = 1 + ((4 - nov1Weekday + 7) % 7) // Thứ Năm = 4
  const fourthThursday = firstThursday + 21
  const blackFridayDate = fourthThursday + 1
  return date.getDate() === blackFridayDate
}

export type BlackFridayDealCode = 'bf_plus_99' | 'bf_ultra_70'

export const BLACK_FRIDAY_DEALS: Record<BlackFridayDealCode, {
  senaiPlanCode: string
  discountPercent: number
  maxClaims: number
  label: string
}> = {
  // Chỉ 5 suất đầu tiên toàn hệ thống mỗi năm — giảm 99% gói SenAI Plus 1 tháng
  bf_plus_99: { senaiPlanCode: 'plus_monthly', discountPercent: 99, maxClaims: 5, label: 'SenAI Plus — 1 tháng, giảm 99% (5 suất)' },
  // Chỉ 10 suất đầu tiên toàn hệ thống mỗi năm — giảm 70% gói SenAI Ultra 3 tháng
  bf_ultra_70: { senaiPlanCode: 'ultra_quarterly', discountPercent: 70, maxClaims: 10, label: 'SenAI Ultra — 3 tháng, giảm 70% (10 suất)' },
}

export function applyDiscount(priceSenCash: number, percent: number): number {
  return Math.max(1, Math.round(priceSenCash * (1 - percent / 100)))
}

// Chỉ VIP/Premium (không phải Lite) mới được vào Cửa hàng cao cấp
export function canAccessExclusiveStore(planTier: PlanTier | null): boolean {
  return planTier === 'vip' || planTier === 'premium'
}
