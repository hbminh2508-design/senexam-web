import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getPlanByGroup, generateOrderCode, buildVietQrUrl, type PlanGroup } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

const ORDER_TTL_MINUTES = 15

const ORDER_CODE_PREFIX: Record<PlanGroup, 'SENVIP' | 'SENPREM' | 'SENLITE'> = {
  vip: 'SENVIP',
  premium: 'SENPREM',
  lite: 'SENLITE',
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { planCode, planGroup } = await request.json()
    const group: PlanGroup = planGroup === 'premium' || planGroup === 'lite' ? planGroup : 'vip'
    const plan = getPlanByGroup(group, planCode)
    if (!plan) return NextResponse.json({ error: 'Gói không hợp lệ' }, { status: 400 })

    const bankBin = process.env.VIETQR_BANK_BIN
    const accountNo = process.env.VIETQR_ACCOUNT_NO
    const accountName = process.env.VIETQR_ACCOUNT_NAME
    if (!bankBin || !accountNo || !accountName) {
      return NextResponse.json({ error: 'Hệ thống thanh toán chưa được cấu hình' }, { status: 503 })
    }

    const orderCode = generateOrderCode(ORDER_CODE_PREFIX[group])
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000).toISOString()

    const { data: order, error } = await getSupabaseAdmin()
      .from('vip_orders')
      .insert({
        user_id: user.id,
        plan_group: group,
        plan_code: plan.code,
        order_code: orderCode,
        amount_vnd: plan.priceVnd,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single()

    if (error) throw error

    const qrUrl = buildVietQrUrl({
      bankBin,
      accountNo,
      accountName,
      amountVnd: plan.priceVnd,
      addInfo: orderCode,
    })

    return NextResponse.json({ order, qrUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi tạo đơn hàng' }, { status: 500 })
  }
}
