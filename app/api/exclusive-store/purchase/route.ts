import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiPlan } from '@/lib/senaiTiers'
import { extendVipExpiry } from '@/lib/vipMembership'
import { applyDiscount } from '@/lib/exclusiveStore'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { dealType, planCode, blackFridayDeal } = await request.json()

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vip_expires_at, plan_tier, senai_tier, senai_tier_expires_at, senai_tier_permanent, sencash_balance, role, is_beta_tester')
      .eq('id', user.id)
      .maybeSingle()

    let plan = getSenAiPlan(planCode)
    if (!plan && blackFridayDeal) {
      if (blackFridayDeal === 'bf_plus_99') plan = getSenAiPlan('plus_monthly')
      if (blackFridayDeal === 'bf_ultra_70') plan = getSenAiPlan('ultra_quarterly')
    }

    if (!plan) {
      return NextResponse.json({ error: 'Gói SenAI không tồn tại hoặc không hợp lệ' }, { status: 400 })
    }

    // Tính giá ưu đãi Flash Sale (Giảm 30% cho Flash Sale độc quyền)
    let discountPercent = 30
    if (dealType === 'black_friday') {
      discountPercent = blackFridayDeal === 'bf_plus_99' ? 99 : 70
    }

    let finalPrice = applyDiscount(plan.priceSenCash, discountPercent)
    if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
      finalPrice = Math.max(1, Math.round(plan.priceSenCash * (1 - discountPercent / 100)))
    }

    // Kiểm tra số dư SenCash
    const currentBalance = typeof profile?.sencash_balance === 'number' ? profile.sencash_balance : 0
    if (currentBalance < finalPrice) {
      return NextResponse.json(
        { error: `Số dư SenCash (${currentBalance.toLocaleString('vi-VN')} SC) không đủ để thanh toán ${finalPrice.toLocaleString('vi-VN')} SC. Vui lòng nạp thêm tại Ví Sen.` },
        { status: 400 }
      )
    }

    // 1. Trừ tiền SenCash (Thử gọi RPC, nếu không có RPC thì cập nhật trực tiếp bảng profiles)
    let rpcSuccess = false
    try {
      const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
        p_user_id: user.id,
        p_delta: -finalPrice,
        p_reason: 'senai_tier_purchase',
        p_reference: plan.code,
      })
      if (!rpcError) {
        rpcSuccess = true
      }
    } catch (rpcEx) {
      console.warn('adjust_sencash_balance RPC call failed, falling back to direct balance update:', rpcEx)
    }

    if (!rpcSuccess) {
      const { error: updateBalErr } = await supabaseAdmin
        .from('profiles')
        .update({ sencash_balance: currentBalance - finalPrice })
        .eq('id', user.id)

      if (updateBalErr) {
        return NextResponse.json({ error: `Lỗi trừ số dư SenCash: ${updateBalErr.message}` }, { status: 500 })
      }
    }

    // 2. Nâng cấp hạng SenAI
    const update: Record<string, unknown> = {
      senai_tier: plan.tier,
      senai_tier_permanent: plan.duration === 'permanent',
    }

    if (plan.duration === 'permanent') {
      update.senai_tier_expires_at = null
    } else {
      const sameTierStillActive = profile?.senai_tier === plan.tier
        && !profile?.senai_tier_permanent
        && !!profile?.senai_tier_expires_at
        && new Date(profile.senai_tier_expires_at).getTime() > Date.now()

      const daysToAdd = plan.durationDays || (plan.duration === 'yearly' ? 365 : plan.duration === 'quarterly' ? 90 : 30)
      update.senai_tier_expires_at = extendVipExpiry(sameTierStillActive ? profile?.senai_tier_expires_at : null, daysToAdd)
    }

    const { error: profUpdateErr } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', user.id)

    if (profUpdateErr) {
      console.error('Error updating profile tier:', profUpdateErr)
      return NextResponse.json({ error: `Lỗi kích hoạt gói: ${profUpdateErr.message}` }, { status: 500 })
    }

    // 3. Ghi log lịch sử mua sắm an toàn (không làm gián đoạn giao dịch nếu bảng chưa được tạo)
    try {
      const claimMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      await supabaseAdmin.from('exclusive_flash_purchases').insert({
        user_id: user.id,
        claim_month: claimMonth,
        senai_plan_code: plan.code,
      })
    } catch (logErr) {
      console.warn('Logging purchase tracking skipped:', logErr)
    }

    return NextResponse.json({
      success: true,
      tier: plan.tier,
      expiresAt: update.senai_tier_expires_at || null,
      pricePaid: finalPrice,
      remainingBalance: currentBalance - finalPrice,
    })
  } catch (e: any) {
    console.error('Exclusive store purchase error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi xử lý mua gói ưu đãi' }, { status: 500 })
  }
}
