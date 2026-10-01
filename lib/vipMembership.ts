import { supabase } from '@/lib/supabaseClient'

export type VipPlanCode = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type VipPlan = {
  code: VipPlanCode
  name: string
  priceVnd: number
  durationDays: number
}

// Bảng giá cố định — thay đổi giá/thời hạn thì sửa ở đây, dùng chung cho cả client và server
// để tránh học sinh có thể tự ý gửi amount tuỳ ý lên API tạo đơn.
export const VIP_PLANS: VipPlan[] = [
  { code: 'daily', name: 'Theo ngày', priceVnd: 3_000, durationDays: 1 },
  { code: 'weekly', name: 'Theo tuần', priceVnd: 15_000, durationDays: 7 },
  { code: 'monthly', name: 'Theo tháng', priceVnd: 39_000, durationDays: 30 },
  { code: 'quarterly', name: '3 tháng', priceVnd: 99_000, durationDays: 90 },
  { code: 'yearly', name: 'Theo năm', priceVnd: 390_000, durationDays: 365 },
]

export function getVipPlan(code: string): VipPlan | undefined {
  return VIP_PLANS.find(p => p.code === code)
}

// Gói Premium — cùng các mốc thời hạn với VIP nhưng giá gấp 3, đổi lại logo/chữ SenExam sang
// phong cách Premium và được tặng hạng SenAI cao hơn khi mua từ 3 tháng trở lên (xem vipSenaiGift.ts).
export const PREMIUM_PLANS: VipPlan[] = VIP_PLANS.map(p => ({ ...p, priceVnd: p.priceVnd * 3 }))

export function getPremiumPlan(code: string): VipPlan | undefined {
  return PREMIUM_PLANS.find(p => p.code === code)
}

// Gói Premium+ — giá gấp 1.5 lần Premium, mở khóa tính năng thử nghiệm tương lai vượt trội hơn cả kênh Beta
export const PREMIUM_PLUS_PLANS: VipPlan[] = [
  { code: 'daily', name: 'Theo ngày (Premium+)', priceVnd: 14_000, durationDays: 1 },
  { code: 'weekly', name: 'Theo tuần (Premium+)', priceVnd: 68_000, durationDays: 7 },
  { code: 'monthly', name: 'Theo tháng (Premium+)', priceVnd: 175_000, durationDays: 30 },
  { code: 'quarterly', name: '3 tháng (Premium+)', priceVnd: 445_000, durationDays: 90 },
  { code: 'yearly', name: 'Theo năm (Premium+)', priceVnd: 1_755_000, durationDays: 365 },
]

export function getPremiumPlusPlan(code: string): VipPlan | undefined {
  return PREMIUM_PLUS_PLANS.find(p => p.code === code)
}

// Gói Sen One — Hệ sinh thái All-in-One: VIP Premium+ + Sen Max + Unlimited tải VIP cuối tuần (T6-CN) + 15 lần SenGraph AI
export type SenOnePlanCode = 'monthly' | 'quarterly' | 'yearly'

export const SEN_ONE_PLANS: { code: SenOnePlanCode; name: string; priceVnd: number; durationDays: number }[] = [
  { code: 'monthly', name: 'Sen One — 1 Tháng', priceVnd: 219_000, durationDays: 30 },
  { code: 'quarterly', name: 'Sen One — 3 Tháng', priceVnd: 599_000, durationDays: 90 },
  { code: 'yearly', name: 'Sen One — 1 Năm (+1 Tháng Miễn Phí)', priceVnd: 2_190_000, durationDays: 395 }, // 365 + 30 ngày
]

export function getSenOnePlan(code: string): (typeof SEN_ONE_PLANS)[number] | undefined {
  return SEN_ONE_PLANS.find(p => p.code === code)
}

// Gói Sen One Lite — VIP cơ bản + SenAI Plus + 10 lượt tải tài liệu VIP/tháng
export type SenOneLitePlanCode = 'monthly' | 'quarterly' | 'yearly'

export const SEN_ONE_LITE_PLANS: { code: SenOneLitePlanCode; name: string; priceVnd: number; durationDays: number }[] = [
  { code: 'monthly', name: 'Sen One Lite — 1 Tháng', priceVnd: 49_000, durationDays: 30 },
  { code: 'quarterly', name: 'Sen One Lite — 3 Tháng', priceVnd: 109_000, durationDays: 90 },
  { code: 'yearly', name: 'Sen One Lite — 1 Năm (+10 Ngày Sử Dụng)', priceVnd: 490_000, durationDays: 375 }, // 365 + 10 ngày
]

export function getSenOneLitePlan(code: string): (typeof SEN_ONE_LITE_PLANS)[number] | undefined {
  return SEN_ONE_LITE_PLANS.find(p => p.code === code)
}

// Gói Lite — rẻ hơn, không có đặc quyền SenAI/tải VIP, quảng cáo vẫn hiển thị (chỉ giãn tần suất
// hiện lại sau khi đóng — xem AdBanner.tsx). Mốc thời hạn khác VIP nên khai báo mã riêng.
export type LitePlanCode = 'trial3d' | 'monthly' | 'quarterly' | 'yearly'

export const LITE_PLANS: { code: LitePlanCode; name: string; priceVnd: number; durationDays: number }[] = [
  { code: 'trial3d', name: '3 ngày', priceVnd: 1_000, durationDays: 3 },
  { code: 'monthly', name: '1 tháng', priceVnd: 7_000, durationDays: 30 },
  { code: 'quarterly', name: '3 tháng', priceVnd: 19_000, durationDays: 90 },
  { code: 'yearly', name: '1 năm', priceVnd: 69_000, durationDays: 365 },
]

export function getLitePlan(code: string): (typeof LITE_PLANS)[number] | undefined {
  return LITE_PLANS.find(p => p.code === code)
}

// Nhóm gói — mở rộng hỗ trợ premium_plus, sen_one, sen_one_lite
export type PlanGroup = 'lite' | 'vip' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'

export function getPlanByGroup(
  group: PlanGroup,
  code: string
): VipPlan | (typeof LITE_PLANS)[number] | (typeof SEN_ONE_PLANS)[number] | (typeof SEN_ONE_LITE_PLANS)[number] | undefined {
  if (group === 'vip') return getVipPlan(code)
  if (group === 'premium') return getPremiumPlan(code)
  if (group === 'premium_plus') return getPremiumPlusPlan(code)
  if (group === 'sen_one') return getSenOnePlan(code)
  if (group === 'sen_one_lite') return getSenOneLitePlan(code)
  return getLitePlan(code)
}

export type VipOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled'

export type VipOrder = {
  id: string
  user_id: string
  plan_group?: PlanGroup
  plan_code: string
  order_code: string
  amount_vnd: number
  status: VipOrderStatus
  created_at: string
  expires_at: string
  paid_at: string | null
}

export const ORDER_TTL_MINUTES = 15

// Nhúng vào nội dung chuyển khoản (addInfo) — ngắn, dễ đọc qua sao kê ngân hàng.
// Tiền tố phân biệt loại đơn khi webhook SePay đối soát (SENVIP = mua VIP, SENCASH = nạp ví,
// SENPREM = mua Premium, SENLITE = mua Lite, SENPLUS = Premium+, SENONE = Sen One, SENONEL = Sen One Lite).
export function generateOrderCode(
  prefix: 'SENVIP' | 'SENCASH' | 'SENPREM' | 'SENLITE' | 'SENPLUS' | 'SENONE' | 'SENONEL'
): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}${rand}`
}

// Cộng dồn thời hạn VIP: nếu còn hạn cũ thì cộng tiếp từ đó, nếu đã hết hạn thì tính từ hiện tại
export function extendVipExpiry(currentIso: string | null | undefined, durationDays: number): string {
  const currentExpiry = currentIso ? new Date(currentIso).getTime() : 0
  const base = Math.max(currentExpiry, Date.now())
  return new Date(base + durationDays * 24 * 60 * 60 * 1000).toISOString()
}

// URL ảnh QR VietQR — endpoint công khai của VietQR.io, không cần API key để tạo ảnh tĩnh
export function buildVietQrUrl(opts: { bankBin: string, accountNo: string, accountName: string, amountVnd: number, addInfo: string }): string {
  const params = new URLSearchParams({
    amount: String(opts.amountVnd),
    addInfo: opts.addInfo,
    accountName: opts.accountName,
  })
  return `https://img.vietqr.io/image/${opts.bankBin}-${opts.accountNo}-compact2.png?${params.toString()}`
}

export async function fetchMyOrders(userId: string): Promise<VipOrder[]> {
  const { data, error } = await supabase
    .from('vip_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data || []) as VipOrder[]
}

export async function fetchOrder(orderId: string): Promise<VipOrder | null> {
  const { data, error } = await supabase.from('vip_orders').select('*').eq('id', orderId).maybeSingle()
  if (error) throw error
  return data as VipOrder | null
}

export function isVipActive(profile: { vip_expires_at?: string | null } | null | undefined): boolean {
  if (!profile?.vip_expires_at) return false
  return new Date(profile.vip_expires_at).getTime() > Date.now()
}

export const VIP_DAILY_DOWNLOAD_LIMIT = 5

// VIP tặng thêm hạn mức câu hỏi SenAI/ngày, CỘNG THẲNG vào hạn mức của gói SenAI đang có (không phải
// lấy max) — vd. có SenAI Ultra (200) + VIP thì tổng là 250/ngày, không bị VIP "nuốt" mất phần Ultra.
export const VIP_SENAI_DAILY_BONUS = 50

// Hạng gói hiện có hiệu lực (đọc từ profiles.plan_tier + vip_expires_at). Cột plan_tier mới thêm
// nên hồ sơ VIP tạo trước đó chưa có giá trị — coi như 'vip' để không phá vỡ hành vi cũ.
export type PlanTier = 'lite' | 'vip' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'

export function getEffectivePlanTier(
  profile: { vip_expires_at?: string | null; plan_tier?: string | null } | null | undefined
): PlanTier | null {
  if (!isVipActive(profile)) return null
  const tier = profile?.plan_tier
  if (
    tier === 'lite' ||
    tier === 'premium' ||
    tier === 'premium_plus' ||
    tier === 'sen_one' ||
    tier === 'sen_one_lite'
  ) {
    return tier
  }
  return 'vip'
}

export function getPlanTierName(tier: PlanTier | string | null | undefined): string {
  switch (tier) {
    case 'sen_one':
      return 'Gói Sen One'
    case 'premium_plus':
      return 'Gói VIP Premium+'
    case 'premium':
      return 'Gói Premium'
    case 'sen_one_lite':
      return 'Gói Sen One Lite'
    case 'lite':
      return 'Gói VIP Lite'
    case 'vip':
      return 'Gói Sen VIP'
    default:
      return 'Gói Miễn phí'
  }
}

// Hạn mức câu hỏi SenAI tặng thêm theo gói
export const SENAI_DAILY_BONUS_BY_TIER: Record<PlanTier, number> = {
  lite: 0,
  vip: VIP_SENAI_DAILY_BONUS,
  premium: VIP_SENAI_DAILY_BONUS,
  premium_plus: 100,
  sen_one: 200,
  sen_one_lite: VIP_SENAI_DAILY_BONUS,
}

// Hạn mức tải file VIP theo gói (Sen One: không giới hạn T6-CN, Sen One Lite: 10 lượt/tháng)
export const DOWNLOAD_LIMIT_BY_TIER: Record<PlanTier, number> = {
  lite: 0,
  vip: VIP_DAILY_DOWNLOAD_LIMIT,
  premium: VIP_DAILY_DOWNLOAD_LIMIT,
  premium_plus: 15,
  sen_one: 9999, // Không giới hạn cuối tuần, ngày thường tải tự do
  sen_one_lite: 10,
}

// Tổng hạn mức câu hỏi SenAI/ngày thực tế: hạn mức của gói SenAI đang có CỘNG THẲNG với phần
// VIP/Premium tặng thêm (nếu có) — dùng chung cho mọi nơi cần hiển thị/kiểm tra quota để tránh
// mỗi chỗ tự tính một kiểu (từng có chỗ lấy max khiến Ultra + VIP bị tính sai còn thấp hơn cả Ultra).
export function getTotalSenaiDailyLimit(
  tierDailyLimit: number,
  planTier: PlanTier | null
): number {
  return tierDailyLimit + (planTier ? SENAI_DAILY_BONUS_BY_TIER[planTier] : 0)
}
