import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiPlan } from '@/lib/senaiTiers'
import { extendVipExpiry, getEffectivePlanTier } from '@/lib/vipMembership'
import {
  canAccessExclusiveStore, isMonthlyFlashSaleDay, isBlackFridayDate,
  MONTHLY_FLASH_SALE_DISCOUNT_PERCENT, BLACK_FRIDAY_DEALS, applyDiscount,
  type BlackFridayDealCode,
} from '@/lib/exclusiveStore'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { dealType, planCode, blackFridayDeal } = await request.json()

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vip_expires_at, plan_tier, senai_tier, senai_tier_expires_at, senai_tier_permanent')
      .eq('id', user.id)
      .maybeSingle()

    const planTier = getEffectivePlanTier(profile)
    if (!canAccessExclusiveStore(planTier)) {
      return NextResponse.json({ error: 'Cửa hàng cao cấp chỉ dành cho thành viên VIP hoặc Premium' }, { status: 403 })
    }

    let plan: ReturnType<typeof getSenAiPlan>
    let finalPrice: number
    let claimDealCode: BlackFridayDealCode | null = null

    if (dealType === 'monthly_flash') {
      if (!isMonthlyFlashSaleDay()) {
        return NextResponse.json({ error: 'Ưu đãi này chỉ áp dụng vào ngày sale hàng tháng (1/1, 2/2, 3/3, ...)' }, { status: 400 })
      }
      plan = getSenAiPlan(planCode)
      if (!plan || (plan.tier !== 'plus' && plan.tier !== 'ultra') || plan.duration === 'trial_3d') {
        return NextResponse.json({ error: 'Gói không hợp lệ cho ưu đãi này' }, { status: 400 })
      }
      const discountPercent = MONTHLY_FLASH_SALE_DISCOUNT_PERCENT[planTier as 'vip' | 'premium']
      finalPrice = applyDiscount(plan.priceSenCash, discountPercent)
    } else if (dealType === 'black_friday') {
      if (!isBlackFridayDate()) {
        return NextResponse.json({ error: 'Ưu đãi Black Friday chỉ áp dụng đúng ngày Black Friday' }, { status: 400 })
      }
      const deal = BLACK_FRIDAY_DEALS[blackFridayDeal as BlackFridayDealCode]
      if (!deal) return NextResponse.json({ error: 'Ưu đãi Black Friday không hợp lệ' }, { status: 400 })
      plan = getSenAiPlan(deal.senaiPlanCode)
      if (!plan) throw new Error('Unknown plan on Black Friday deal')

      const claimYear = new Date().getFullYear()
      const { data: existingClaim } = await supabaseAdmin
        .from('exclusive_deal_claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('deal_code', blackFridayDeal)
        .eq('claim_year', claimYear)
        .maybeSingle()
      if (existingClaim) return NextResponse.json({ error: 'Bạn đã nhận ưu đãi Black Friday này rồi' }, { status: 400 })

      const { count } = await supabaseAdmin
        .from('exclusive_deal_claims')
        .select('id', { count: 'exact', head: true })
        .eq('deal_code', blackFridayDeal)
        .eq('claim_year', claimYear)
      if ((count || 0) >= deal.maxClaims) {
        return NextResponse.json({ error: `Đã hết suất ưu đãi này (chỉ ${deal.maxClaims} suất/năm)` }, { status: 400 })
      }

      finalPrice = applyDiscount(plan.priceSenCash, deal.discountPercent)
      claimDealCode = blackFridayDeal as BlackFridayDealCode
    } else {
      return NextResponse.json({ error: 'Loại ưu đãi không hợp lệ' }, { status: 400 })
    }

    const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
      p_user_id: user.id,
      p_delta: -finalPrice,
      p_reason: 'senai_tier_purchase',
      p_reference: plan.code,
    })
    if (rpcError) {
      if (rpcError.message.includes('không đủ')) {
        return NextResponse.json({ error: 'Số dư SenCash không đủ để mua gói này' }, { status: 400 })
      }
      throw rpcError
    }

    if (claimDealCode) {
      await supabaseAdmin.from('exclusive_deal_claims').insert({
        user_id: user.id, deal_code: claimDealCode, claim_year: new Date().getFullYear(),
      })
    }

    const update: Record<string, unknown> = { senai_tier: plan.tier, senai_tier_permanent: false }
    const sameTierStillActive = profile?.senai_tier === plan.tier && !profile?.senai_tier_permanent
      && !!profile?.senai_tier_expires_at && new Date(profile.senai_tier_expires_at).getTime() > Date.now()
    update.senai_tier_expires_at = extendVipExpiry(sameTierStillActive ? profile?.senai_tier_expires_at : null, plan.durationDays!)

    await supabaseAdmin.from('profiles').update(update).eq('id', user.id)

    return NextResponse.json({ success: true, tier: plan.tier, expiresAt: update.senai_tier_expires_at, pricePaid: finalPrice })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi mua gói ưu đãi' }, { status: 500 })
  }
}
