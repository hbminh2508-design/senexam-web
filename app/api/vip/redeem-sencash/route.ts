import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getPlanByGroup, extendVipExpiry, type PlanGroup, type VipPlanCode } from '@/lib/vipMembership'
import { vndToSenCash } from '@/lib/senCash'
import { applyVipPurchasePerks, applyPremiumPurchasePerks } from '@/lib/vipSenaiGift'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { planCode, planGroup } = await request.json()
    const group: PlanGroup = planGroup === 'premium' || planGroup === 'lite' ? planGroup : 'vip'
    const plan = getPlanByGroup(group, planCode)
    if (!plan) return NextResponse.json({ error: 'Gói không hợp lệ' }, { status: 400 })

    const cost = vndToSenCash(plan.priceVnd)
    const supabaseAdmin = getSupabaseAdmin()

    let balanceDeducted = false
    try {
      const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
        p_user_id: user.id,
        p_delta: -cost,
        p_reason: 'vip_redeem',
        p_reference: plan.code,
      })

      if (rpcError) throw rpcError
      balanceDeducted = true
    } catch (rpcErr: any) {
      if (rpcErr?.message?.includes('không đủ')) {
        return NextResponse.json({ error: 'Số dư SenCash không đủ để đổi gói này' }, { status: 400 })
      }

      // Fallback: Kiểm tra và trừ SenCash trực tiếp
      const { data: prof } = await supabaseAdmin.from('profiles').select('sencash_balance').eq('id', user.id).maybeSingle()
      const currentBalance = prof?.sencash_balance || 0
      if (currentBalance < cost) {
        return NextResponse.json({ error: `Số dư SenCash không đủ (${currentBalance} SC < ${cost} SC)` }, { status: 400 })
      }

      const newBalance = currentBalance - cost
      await supabaseAdmin.from('profiles').update({ sencash_balance: newBalance }).eq('id', user.id)
      await supabaseAdmin.from('sencash_transactions').insert({
        user_id: user.id,
        amount: -cost,
        transaction_type: 'vip_purchase',
        description: `Đổi ${cost} SC lấy gói VIP: ${plan.name}`,
      })
      balanceDeducted = true
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('vip_expires_at').eq('id', user.id).maybeSingle()
    const newExpiresAt = extendVipExpiry(profile?.vip_expires_at, plan.durationDays)

    await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt, vip_plan_code: plan.code, plan_tier: group }).eq('id', user.id)
    if (group === 'vip') await applyVipPurchasePerks(supabaseAdmin, user.id, plan.code as VipPlanCode, newExpiresAt)
    else if (group === 'premium') await applyPremiumPurchasePerks(supabaseAdmin, user.id, plan.code as VipPlanCode, newExpiresAt)

    return NextResponse.json({ success: true, vipExpiresAt: newExpiresAt })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi đổi SenCash lấy VIP' }, { status: 500 })
  }
}
