import { supabase } from '@/lib/supabaseClient'

// Tỉ giá cố định: 500đ = 1 SenCash (5,000đ = 10 SenCash tối thiểu), áp dụng đồng nhất
// cho mọi mệnh giá VIP hiện có (3k/15k/39k/99k/390k đều chia hết cho 500).
export const VND_PER_SENCASH = 500
export const MIN_TOPUP_VND = 5_000
export const TOPUP_PRESETS_VND = [5_000, 10_000, 20_000, 50_000, 100_000, 200_000]
export const SENCASH_COST_PER_VIP_DOWNLOAD = 2

export function vndToSenCash(vnd: number): number {
  return Math.floor(vnd / VND_PER_SENCASH)
}

export function senCashToVnd(sc: number): number {
  return sc * VND_PER_SENCASH
}

export function isValidTopupAmount(vnd: number): boolean {
  return Number.isInteger(vnd) && vnd >= MIN_TOPUP_VND && vnd % MIN_TOPUP_VND === 0
}

export type SenCashOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled'

export type SenCashTopupOrder = {
  id: string
  user_id: string
  order_code: string
  amount_vnd: number
  sencash_amount: number
  status: SenCashOrderStatus
  created_at: string
  expires_at: string
  paid_at: string | null
}

export type SenCashTransaction = {
  id: string
  user_id: string
  delta: number
  reason: 'topup' | 'vip_redeem' | 'vip_download_spend'
  reference: string | null
  created_at: string
}

export async function fetchSenCashBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from('profiles').select('sencash_balance').eq('id', userId).single()
  if (error) throw error
  return data?.sencash_balance ?? 0
}

export async function fetchMyTransactions(userId: string): Promise<SenCashTransaction[]> {
  const { data, error } = await supabase
    .from('sencash_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data || []) as SenCashTransaction[]
}
