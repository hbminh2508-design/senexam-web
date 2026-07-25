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

// Nhóm gói — 'vip' giữ nguyên mã cũ (daily/weekly/monthly/quarterly/yearly) để tương thích ngược,
// 'premium' dùng chung mã đó (giá x3), 'lite' có mã thời hạn riêng.
export type PlanGroup = 'lite' | 'vip' | 'premium'

export function getPlanByGroup(group: PlanGroup, code: string): VipPlan | (typeof LITE_PLANS)[number] | undefined {
  if (group === 'vip') return getVipPlan(code)
  if (group === 'premium') return getPremiumPlan(code)
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
// SENPREM = mua Premium, SENLITE = mua Lite).
export function generateOrderCode(prefix: 'SENVIP' | 'SENCASH' | 'SENPREM' | 'SENLITE'): string {
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

// VIP tặng thêm hạn mức câu hỏi SenAI/ngày (tương đương gói Plus), cộng dồn theo kiểu lấy max với gói SenAI đã mua
export const VIP_SENAI_DAILY_BONUS = 50

// Hạng gói hiện có hiệu lực (đọc từ profiles.plan_tier + vip_expires_at). Cột plan_tier mới thêm
// nên hồ sơ VIP tạo trước đó chưa có giá trị — coi như 'vip' để không phá vỡ hành vi cũ.
export type PlanTier = 'lite' | 'vip' | 'premium'

export function getEffectivePlanTier(
  profile: { vip_expires_at?: string | null; plan_tier?: string | null } | null | undefined
): PlanTier | null {
  if (!isVipActive(profile)) return null
  const tier = profile?.plan_tier
  return tier === 'lite' || tier === 'premium' ? tier : 'vip'
}

// Lite không có đặc quyền SenAI/tải VIP; Premium ở mức sàn ngang VIP cho các gói ngắn (dưới 3 tháng)
// — gói từ 3 tháng trở lên còn được NÂNG HẲN lên hạng SenAI Plus/Ultra thật, xem vipSenaiGift.ts.
export const SENAI_DAILY_BONUS_BY_TIER: Record<PlanTier, number> = {
  lite: 0,
  vip: VIP_SENAI_DAILY_BONUS,
  premium: VIP_SENAI_DAILY_BONUS,
}

export const DOWNLOAD_LIMIT_BY_TIER: Record<PlanTier, number> = {
  lite: 0,
  vip: VIP_DAILY_DOWNLOAD_LIMIT,
  premium: VIP_DAILY_DOWNLOAD_LIMIT,
}
