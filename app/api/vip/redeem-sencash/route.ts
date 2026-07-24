import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getVipPlan, extendVipExpiry } from '@/lib/vipMembership'
import { vndToSenCash } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { planCode } = await request.json()
    const plan = getVipPlan(planCode)
    if (!plan) return NextResponse.json({ error: 'Gói VIP không hợp lệ' }, { status: 400 })

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

    await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt, vip_plan_code: plan.code }).eq('id', user.id)

    return NextResponse.json({ success: true, vipExpiresAt: newExpiresAt })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi đổi SenCash lấy VIP' }, { status: 500 })
  }
}
