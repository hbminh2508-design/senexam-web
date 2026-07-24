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

export type VipOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled'

export type VipOrder = {
  id: string
  user_id: string
  plan_code: VipPlanCode
  order_code: string
  amount_vnd: number
  status: VipOrderStatus
  created_at: string
  expires_at: string
  paid_at: string | null
}

export const ORDER_TTL_MINUTES = 15

// Nhúng vào nội dung chuyển khoản (addInfo) — ngắn, dễ đọc qua sao kê ngân hàng.
// Tiền tố phân biệt loại đơn khi webhook SePay đối soát (SENVIP = mua VIP, SENCASH = nạp ví).
export function generateOrderCode(prefix: 'SENVIP' | 'SENCASH'): string {
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
