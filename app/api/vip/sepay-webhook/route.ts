import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getVipPlan } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

// Định dạng payload theo SePay: https://docs.sepay.vn/tich-hop-webhooks.html
// SePay xác thực bằng header "Authorization: Apikey <SEPAY_WEBHOOK_SECRET>" cấu hình trong dashboard SePay.
type SepayPayload = {
  transferType?: string // 'in' | 'out'
  transferAmount?: number
  content?: string
  description?: string
  referenceCode?: string
  id?: number | string
}

const ORDER_CODE_RE = /SENVIP[A-Z0-9]{6}/

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  const expected = `Apikey ${process.env.SEPAY_WEBHOOK_SECRET}`
  if (!process.env.SEPAY_WEBHOOK_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json()) as SepayPayload

  if (payload.transferType && payload.transferType !== 'in') {
    return NextResponse.json({ success: true, ignored: 'not_incoming' })
  }

  const haystack = `${payload.content || ''} ${payload.description || ''}`.toUpperCase()
  const match = haystack.match(ORDER_CODE_RE)
  if (!match) {
    return NextResponse.json({ success: true, ignored: 'no_order_code_found' })
  }

  const orderCode = match[0]
  const supabaseAdmin = getSupabaseAdmin()

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('vip_orders')
    .select('*')
    .eq('order_code', orderCode)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ success: true, ignored: 'order_not_found' })
  if (order.status !== 'pending') return NextResponse.json({ success: true, ignored: 'order_not_pending' })

  const amount = payload.transferAmount || 0
  if (amount < order.amount_vnd) {
    return NextResponse.json({ success: true, ignored: 'amount_mismatch' })
  }

  const plan = getVipPlan(order.plan_code)
  if (!plan) return NextResponse.json({ error: 'Unknown plan on order' }, { status: 500 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('vip_expires_at')
    .eq('id', order.user_id)
    .maybeSingle()

  const currentExpiry = profile?.vip_expires_at ? new Date(profile.vip_expires_at).getTime() : 0
  const base = Math.max(currentExpiry, Date.now())
  const newExpiresAt = new Date(base + plan.durationDays * 24 * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('vip_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      sepay_id: payload.id ? String(payload.id) : payload.referenceCode || null,
      raw_webhook: payload,
    })
    .eq('id', order.id)

  await supabaseAdmin
    .from('profiles')
    .update({ vip_expires_at: newExpiresAt, vip_plan_code: plan.code })
    .eq('id', order.user_id)

  return NextResponse.json({ success: true })
}
