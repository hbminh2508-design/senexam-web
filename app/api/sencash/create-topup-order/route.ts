import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { generateOrderCode, buildVietQrUrl, ORDER_TTL_MINUTES } from '@/lib/vipMembership'
import { isValidTopupAmount, vndToSenCash } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { amountVnd } = await request.json()
    if (!isValidTopupAmount(amountVnd)) {
      return NextResponse.json({ error: 'Số tiền nạp phải là bội số của 5.000đ, tối thiểu 5.000đ' }, { status: 400 })
    }

    const bankBin = process.env.VIETQR_BANK_BIN
    const accountNo = process.env.VIETQR_ACCOUNT_NO
    const accountName = process.env.VIETQR_ACCOUNT_NAME
    if (!bankBin || !accountNo || !accountName) {
      return NextResponse.json({ error: 'Hệ thống thanh toán chưa được cấu hình' }, { status: 503 })
    }

    const orderCode = generateOrderCode('SENCASH')
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000).toISOString()
    const sencashAmount = vndToSenCash(amountVnd)

    const { data: order, error } = await getSupabaseAdmin()
      .from('sencash_topup_orders')
      .insert({
        user_id: user.id,
        order_code: orderCode,
        amount_vnd: amountVnd,
        sencash_amount: sencashAmount,
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
      amountVnd,
      addInfo: orderCode,
    })

    return NextResponse.json({ order, qrUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi tạo đơn nạp SenCash' }, { status: 500 })
  }
}
