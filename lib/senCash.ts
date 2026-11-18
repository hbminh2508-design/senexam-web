import { supabase } from '@/lib/supabaseClient'
export {
  VND_PER_SENCASH,
  VND_PER_SCM,
  SCM_PER_SENCASH,
  MIN_TOPUP_VND,
  vndToScm,
  scmToVnd,
  senCashToScm,
} from './scmUtils.mjs'
import {
  VND_PER_SENCASH,
  VND_PER_SCM,
  SCM_PER_SENCASH,
  MIN_TOPUP_VND,
  vndToScm,
  scmToVnd,
  senCashToScm,
} from './scmUtils.mjs'

export const TOPUP_PRESETS_VND = [5_000, 10_000, 20_000, 50_000, 100_000, 200_000]
export const MOBILE_TOPUP_PRESETS_VND = [1_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000]
export const SENCASH_COST_PER_VIP_DOWNLOAD = 2

export function vndToSenCash(vnd: number): number {
  return Math.floor(vnd / VND_PER_SENCASH)
}

export function senCashToVnd(sc: number): number {
  return sc * VND_PER_SENCASH
}

export function getUserScmBalance(user: any, profile?: any): number {
  if (profile?.sencash_mobile_balance !== undefined && profile?.sencash_mobile_balance !== null) {
    return Number(profile.sencash_mobile_balance) || 0
  }
  if (profile?.scm_balance !== undefined && profile?.scm_balance !== null) {
    return Number(profile.scm_balance) || 0
  }
  return Number(user?.user_metadata?.sencash_mobile_balance) || Number(user?.user_metadata?.scm_balance) || 0
}

export function isValidTopupAmount(vnd: number): boolean {
  return Number.isInteger(vnd) && vnd >= MIN_TOPUP_VND && vnd % 1_000 === 0
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
  reason: 'topup' | 'vip_redeem' | 'vip_download_spend' | 'senai_tier_purchase' | 'admin_gift' | 'gift_code'
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

export type ScmTransaction = {
  id: string
  user_id: string
  amount: number
  balance_after: number
  transaction_type: 'topup' | 'senai_quota' | 'exclusive_deal' | 'admin_gift' | 'refund'
  description: string
  idempotency_key?: string
  reference_id: string | null
  created_at: string
}

export async function fetchScmBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('scm_balance, sencash_mobile_balance')
    .eq('id', userId)
    .maybeSingle()
  if (error) return 0
  return Number(data?.scm_balance ?? data?.sencash_mobile_balance ?? 0)
}

export async function fetchMyScmTransactions(userId: string): Promise<ScmTransaction[]> {
  const { data, error } = await supabase
    .from('mobile_sencash_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return (data || []) as ScmTransaction[]
}

