import type { SenAiTierCode } from '@/lib/senaiTiers'

export type GiftRewardType = 'vip_days' | 'sencash' | 'senai_tier'

export type GiftCode = {
  id: string
  code: string
  reward_type: GiftRewardType
  reward_vip_days: number | null
  reward_sencash_amount: number | null
  reward_senai_tier: SenAiTierCode | null
  reward_senai_duration_days: number | null
  reward_senai_permanent: boolean
  batch_id: string
  note: string | null
  max_uses: number
  used_count: number
  active: boolean
  expires_at: string | null
  created_at: string
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bỏ ký tự dễ nhầm: 0/O, 1/I

export function generateGiftCode(): string {
  const part = (len: number) => Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  return `${part(4)}-${part(4)}-${part(4)}-${part(4)}`
}

export function normalizeGiftCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

// Mô tả ngắn gọn phần thưởng của mã, dùng để hiển thị cho admin lẫn thông báo kết quả đổi mã cho người dùng
export function describeGiftReward(code: Pick<GiftCode, 'reward_type' | 'reward_vip_days' | 'reward_sencash_amount' | 'reward_senai_tier' | 'reward_senai_duration_days' | 'reward_senai_permanent'>, tierLabel?: Record<string, string>): string {
  if (code.reward_type === 'vip_days') return `VIP ${code.reward_vip_days} ngày`
  if (code.reward_type === 'sencash') return `${code.reward_sencash_amount} SenCash`
  if (code.reward_type === 'senai_tier') {
    const label = tierLabel?.[code.reward_senai_tier || ''] || code.reward_senai_tier
    if (code.reward_senai_permanent) return `${label} — Vĩnh viễn`
    return `${label} — ${code.reward_senai_duration_days} ngày`
  }
  return 'Không xác định'
}
