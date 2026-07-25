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

    const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
      p_user_id: user.id,
      p_delta: -cost,
      p_reason: 'vip_redeem',
      p_reference: plan.code,
    })

    if (rpcError) {
      if (rpcError.message.includes('không đủ')) {
        return NextResponse.json({ error: 'Số dư SenCash không đủ để đổi gói này' }, { status: 400 })
      }
      throw rpcError
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('vip_expires_at').eq('id', user.id).maybeSingle()
    const newExpiresAt = extendVipExpiry(profile?.vip_expires_at, plan.durationDays)

    await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt, vip_plan_code: plan.code, plan_tier: group }).eq('id', user.id)
    if (group === 'vip') await applyVipPurchasePerks(supabaseAdmin, user.id, plan.code as VipPlanCode)
    else if (group === 'premium') await applyPremiumPurchasePerks(supabaseAdmin, user.id, plan.code as VipPlanCode)

    return NextResponse.json({ success: true, vipExpiresAt: newExpiresAt })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi đổi SenCash lấy VIP' }, { status: 500 })
  }
}
