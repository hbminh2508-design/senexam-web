import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getPlanByGroup, extendVipExpiry, type PlanGroup, type VipPlanCode } from '@/lib/vipMembership'
import {
  applyVipPurchasePerks,
  applyPremiumPurchasePerks,
  applyPremiumPlusPurchasePerks,
  applySenOnePurchasePerks,
  applySenOneLitePurchasePerks,
} from '@/lib/vipSenaiGift'
import { updateStudentPayment } from '@/lib/nopQuyLopStore'

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

const ORDER_CODE_RE = /(SENVIP|SENCASH|SCM|SENPREM|SENLITE|SENONEL|SENONE|SENPLUS|NOPQUY)[A-Z0-9]{6}/

async function handleVipOrder(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, orderCode: string, payload: SepayPayload) {
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('vip_orders')
    .select('*')
    .eq('order_code', orderCode)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!order) return { ignored: 'order_not_found' }
  if (order.status !== 'pending') return { ignored: 'order_not_pending' }

  const amount = payload.transferAmount || 0
  if (amount < order.amount_vnd) return { ignored: 'amount_mismatch' }

  // plan_group mới thêm — đơn tạo trước khi có cột này coi như 'vip' để tương thích ngược
  const planGroup: PlanGroup = (order.plan_group as PlanGroup) || 'vip'
  const plan = getPlanByGroup(planGroup, order.plan_code)
  if (!plan) throw new Error('Unknown plan on order')

  const { data: profile } = await supabaseAdmin.from('profiles').select('vip_expires_at').eq('id', order.user_id).maybeSingle()
  const newExpiresAt = extendVipExpiry(profile?.vip_expires_at, plan.durationDays)

  await supabaseAdmin
    .from('vip_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      sepay_id: payload.id ? String(payload.id) : payload.referenceCode || null,
      raw_webhook: payload,
    })
    .eq('id', order.id)

  // Hạng gói mới nhất "thắng" và áp dụng cho toàn bộ thời hạn còn lại (kể cả thời hạn cộng dồn từ
  // gói cũ) — giống hệt cách vip_plan_code đã hoạt động từ trước, chỉ mở rộng thêm chiều plan_tier.
  await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt, vip_plan_code: plan.code, plan_tier: planGroup }).eq('id', order.user_id)

  if (planGroup === 'vip') await applyVipPurchasePerks(supabaseAdmin, order.user_id, plan.code as VipPlanCode, newExpiresAt)
  else if (planGroup === 'premium') await applyPremiumPurchasePerks(supabaseAdmin, order.user_id, plan.code as VipPlanCode, newExpiresAt)
  else if (planGroup === 'premium_plus') await applyPremiumPlusPurchasePerks(supabaseAdmin, order.user_id, plan.code as VipPlanCode, newExpiresAt)
  else if (planGroup === 'sen_one') await applySenOnePurchasePerks(supabaseAdmin, order.user_id, newExpiresAt)
  else if (planGroup === 'sen_one_lite') await applySenOneLitePurchasePerks(supabaseAdmin, order.user_id, newExpiresAt)

  return { success: true }
}

async function handleSenCashTopup(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, orderCode: string, payload: SepayPayload) {
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('sencash_topup_orders')
    .select('*')
    .eq('order_code', orderCode)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!order) return { ignored: 'order_not_found' }
  if (order.status !== 'pending') return { ignored: 'order_not_pending' }

  const amount = payload.transferAmount || 0
  if (amount < order.amount_vnd) return { ignored: 'amount_mismatch' }

  const isMobile = orderCode.startsWith('SCM') || (order.order_code && order.order_code.startsWith('SCM'))

  if (isMobile) {
    // Nạp ví SenCashMobile (SCm) độc quyền di động
    try {
      const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(order.user_id)
      const currentScm = Number(userAuth?.user?.user_metadata?.sencash_mobile_balance) || 0
      const newScm = currentScm + order.sencash_amount
      await supabaseAdmin.auth.admin.updateUserById(order.user_id, {
        user_metadata: {
          ...(userAuth?.user?.user_metadata || {}),
          sencash_mobile_balance: newScm,
        },
      })
      try {
        await supabaseAdmin.from('profiles').update({ sencash_mobile_balance: newScm }).eq('id', order.user_id)
      } catch {}
    } catch (err: any) {
      console.warn('Mobile SCm credit notice:', err.message)
    }
  } else {
    // Nạp ví SenCash PC tiêu chuẩn
    const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
      p_user_id: order.user_id,
      p_delta: order.sencash_amount,
      p_reason: 'topup',
      p_reference: order.id,
    })
    if (rpcError) throw rpcError
  }

  await supabaseAdmin
    .from('sencash_topup_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      sepay_id: payload.id ? String(payload.id) : payload.referenceCode || null,
      raw_webhook: payload,
    })
    .eq('id', order.id)

  return { success: true }
}

async function handleNopQuyOrder(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  orderCode: string,
  payload: SepayPayload
) {
  // 1. Kiểm tra trong bảng chuyên biệt class_fund_payments
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('class_fund_payments')
    .select('*')
    .eq('order_code', orderCode)
    .maybeSingle()

  if (fetchErr) {
    console.warn('Truy vấn class_fund_payments:', fetchErr.message)
  }

  const amount = payload.transferAmount || 0

  if (order) {
    if (order.status !== 'pending') return { ignored: 'order_not_pending' }
    if (amount < order.amount_vnd) return { ignored: 'amount_mismatch' }

    await supabaseAdmin
      .from('class_fund_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        sepay_id: payload.id ? String(payload.id) : payload.referenceCode || null,
        raw_webhook: payload,
      })
      .eq('id', order.id)

    // Cập nhật trạng thái sinh viên trong danh sách quỹ lớp ME2
    await updateStudentPayment(order.fund_id, order.student_id, true, orderCode)
    return { success: true, type: 'class_fund_payment', student_id: order.student_id, fund_id: order.fund_id }
  }

  // 2. Dự phòng: tìm trực tiếp theo paymentCode trong danh sách sinh viên của class_funds
  try {
    const { data: funds } = await supabaseAdmin.from('class_funds').select('*')
    if (Array.isArray(funds)) {
      for (const fund of funds) {
        if (Array.isArray(fund.students)) {
          const student = fund.students.find((s: any) => s.paymentCode === orderCode)
          if (student) {
            await updateStudentPayment(fund.id, student.id, true, orderCode)
            return { success: true, type: 'class_fund_fallback', student_id: student.id, fund_id: fund.id }
          }
        }
      }
    }
  } catch (fallbackErr: any) {
    console.warn('Dự phòng tìm quỹ cho NOPQUY:', fallbackErr?.message)
  }

  return { ignored: 'order_not_found' }
}

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

  try {
    let result: any
    if (orderCode.startsWith('NOPQUY')) {
      result = await handleNopQuyOrder(supabaseAdmin, orderCode, payload)
    } else if (orderCode.startsWith('SENCASH')) {
      result = await handleSenCashTopup(supabaseAdmin, orderCode, payload)
    } else {
      result = await handleVipOrder(supabaseAdmin, orderCode, payload)
    }

    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Webhook error' }, { status: 500 })
  }
}
