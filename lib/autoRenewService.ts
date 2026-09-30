import { supabase } from '@/lib/supabaseClient'

export const VIP_RENEW_COST = 30
export const SENAI_RENEW_COST = 20

export interface AutoRenewResult {
  renewedVip?: boolean
  cancelledVip?: boolean
  renewedSenAi?: boolean
  cancelledSenAi?: boolean
  messages: string[]
}

/**
 * Kiểm tra và tự động gia hạn gói VIP và Sen AI bằng SC.
 * Nếu số dư SC không đủ khi đến hạn, hệ thống sẽ tự động hủy gói.
 */
export async function processAutoRenew(userId: string): Promise<AutoRenewResult> {
  const result: AutoRenewResult = { messages: [] }
  if (!userId) return result

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, sencash_balance, vip_expires_at, auto_renew_vip, senai_expires_at, auto_renew_senai')
      .eq('id', userId)
      .maybeSingle()

    if (error || !profile) return result

    const now = new Date()
    let currentBalance = Number(profile.sencash_balance) || 0
    const updates: Record<string, any> = {}

    // 1. Kiểm tra tự động gia hạn gói VIP
    const isVipExpired = !profile.vip_expires_at || new Date(profile.vip_expires_at) <= now
    if (profile.auto_renew_vip && isVipExpired) {
      if (currentBalance >= VIP_RENEW_COST) {
        currentBalance -= VIP_RENEW_COST
        const newVipExpire = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        updates.sencash_balance = currentBalance
        updates.vip_expires_at = newVipExpire
        result.renewedVip = true
        result.messages.push(`Gia hạn tự động VIP thành công (-${VIP_RENEW_COST} SC). Hạn mới: 30 ngày tiếp theo.`)

        // Ghi lịch sử giao dịch SC
        try {
          await supabase.from('sencash_transactions').insert({
            user_id: userId,
            amount: -VIP_RENEW_COST,
            transaction_type: 'auto_renew_vip',
            description: 'Tự động gia hạn gói VIP 30 ngày',
          })
        } catch {}
      } else {
        // Không đủ tiền: TỰ ĐỘNG HỦY GÓI ĐANG SỬ DỤNG
        updates.vip_expires_at = null
        updates.auto_renew_vip = false
        result.cancelledVip = true
        result.messages.push(`Số dư SC (${currentBalance} SC) không đủ để tự động gia hạn gói VIP (cần ${VIP_RENEW_COST} SC). Gói VIP đã tự động hủy.`)
      }
    }

    // 2. Kiểm tra tự động gia hạn gói Sen AI
    const isSenAiExpired = !profile.senai_expires_at || new Date(profile.senai_expires_at) <= now
    if (profile.auto_renew_senai && isSenAiExpired) {
      if (currentBalance >= SENAI_RENEW_COST) {
        currentBalance -= SENAI_RENEW_COST
        const newSenAiExpire = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        updates.sencash_balance = currentBalance
        updates.senai_expires_at = newSenAiExpire
        result.renewedSenAi = true
        result.messages.push(`Gia hạn tự động Trợ lý Sen AI thành công (-${SENAI_RENEW_COST} SC). Hạn mới: 30 ngày tiếp theo.`)

        try {
          await supabase.from('sencash_transactions').insert({
            user_id: userId,
            amount: -SENAI_RENEW_COST,
            transaction_type: 'auto_renew_senai',
            description: 'Tự động gia hạn gói Sen AI 30 ngày',
          })
        } catch {}
      } else {
        // Không đủ tiền: TỰ ĐỘNG HỦY GÓI SEN AI ĐANG SỬ DỤNG
        updates.senai_expires_at = null
        updates.auto_renew_senai = false
        result.cancelledSenAi = true
        result.messages.push(`Số dư SC (${currentBalance} SC) không đủ để tự động gia hạn Sen AI (cần ${SENAI_RENEW_COST} SC). Gói Sen AI đã tự động hủy.`)
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', userId)
    }
  } catch (e) {
    console.error('Lỗi kiểm tra tự động gia hạn:', e)
  }

  return result
}
