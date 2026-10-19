import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiPlan } from '@/lib/senaiTiers'
import { extendVipExpiry, type PlanTier } from '@/lib/vipMembership'
import {
  applyDiscount,
  getExclusiveDeal,
  type ExclusiveStoreDeal,
} from '@/lib/exclusiveStore'
import {
  applyVipPurchasePerks,
  applyPremiumPurchasePerks,
  applyPremiumPlusPurchasePerks,
  applySenOnePurchasePerks,
} from '@/lib/vipSenaiGift'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const body = await request.json()
    const { dealId, dealType, planCode, blackFridayDeal } = body

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vip_expires_at, plan_tier, senai_tier, senai_tier_expires_at, senai_tier_permanent, sencash_balance, role, is_beta_tester')
      .eq('id', user.id)
      .maybeSingle()

    let deal: ExclusiveStoreDeal | undefined
    let finalPrice = 0
    let plan = planCode ? getSenAiPlan(planCode) : undefined

    // 1. Tìm ưu đãi từ Catalog mới
    if (dealId) {
      deal = getExclusiveDeal(dealId)
    }

    if (deal) {
      finalPrice = deal.discountedPrice
      if (deal.planCode && !plan) {
        plan = getSenAiPlan(deal.planCode)
      }
    } else {
      // Fallback: Hỗ trợ deal legacy hoặc black friday cũ
      if (!plan && blackFridayDeal) {
        if (blackFridayDeal === 'bf_plus_99') plan = getSenAiPlan('plus_monthly')
        if (blackFridayDeal === 'bf_ultra_70') plan = getSenAiPlan('ultra_quarterly')
      }

      if (!plan) {
        return NextResponse.json({ error: 'Mặt hàng hoặc gói ưu đãi không hợp lệ' }, { status: 400 })
      }

      let discountPercent = 30
      if (dealType === 'black_friday') {
        discountPercent = blackFridayDeal === 'bf_plus_99' ? 99 : 70
      }
      finalPrice = applyDiscount(plan.priceSenCash, discountPercent)
    }

    if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
      finalPrice = 1
    }

    // 2. Kiểm tra số dư SenCash
    const currentBalance = typeof profile?.sencash_balance === 'number' ? profile.sencash_balance : 0
    if (currentBalance < finalPrice) {
      return NextResponse.json(
        { error: `Số dư SenCash (${currentBalance.toLocaleString('vi-VN')} SC) không đủ để thanh toán ${finalPrice.toLocaleString('vi-VN')} SC. Vui lòng nạp thêm tại Ví Sen.` },
        { status: 400 }
      )
    }

    // 3. Trừ tiền SenCash an toàn
    let rpcSuccess = false
    try {
      const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
        p_user_id: user.id,
        p_delta: -finalPrice,
        p_reason: 'exclusive_store_purchase',
        p_reference: deal?.id || plan?.code || 'exclusive_deal',
      })
      if (!rpcError) rpcSuccess = true
    } catch (rpcEx) {
      console.warn('RPC deduction failed, using fallback update:', rpcEx)
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

    let remainingBalance = currentBalance - finalPrice

    // Ghi transaction lịch sử
    try {
      await supabaseAdmin.from('sencash_transactions').insert({
        user_id: user.id,
        amount: -finalPrice,
        transaction_type: 'exclusive_purchase',
        description: `Mua ưu đãi độc quyền: ${deal?.title || plan?.label || 'Exclusive Item'}`,
      })
    } catch {
      // Bỏ qua nếu bảng hoặc enum không khớp
    }

    // 4. Xử lý các loại mặt hàng (Action Execution)
    const profileUpdates: Record<string, unknown> = {}
    let mysteryReward: { title: string; desc: string; type: string; value: string | number } | null = null

    if (deal) {
      switch (deal.actionType) {
        case 'vip_grant': {
          const days = deal.vipDays || 30
          const targetGroup = deal.vipGroup || 'vip'
          const newVipExpires = extendVipExpiry(profile?.vip_expires_at, days)
          profileUpdates.vip_expires_at = newVipExpires
          profileUpdates.plan_tier = targetGroup
          await applyVipPurchasePerks(supabaseAdmin, user.id, 'monthly', newVipExpires)
          break
        }

        case 'combo': {
          // Kích hoạt VIP + SenAI Plan
          const days = deal.vipDays || 30
          const targetGroup = deal.vipGroup || 'vip'
          const newVipExpires = extendVipExpiry(profile?.vip_expires_at, days)
          profileUpdates.vip_expires_at = newVipExpires
          profileUpdates.plan_tier = targetGroup

          if (plan) {
            profileUpdates.senai_tier = plan.tier
            profileUpdates.senai_tier_permanent = plan.duration === 'permanent'
            profileUpdates.senai_tier_expires_at = plan.duration === 'permanent'
              ? null
              : extendVipExpiry(profile?.senai_tier_expires_at, plan.durationDays || days)
          }

          if (targetGroup === 'premium') {
            await applyPremiumPurchasePerks(supabaseAdmin, user.id, 'quarterly', newVipExpires)
          } else {
            await applyVipPurchasePerks(supabaseAdmin, user.id, 'monthly', newVipExpires)
          }
          break
        }

        case 'sen_one': {
          const days = deal.vipDays || 180
          const newVipExpires = extendVipExpiry(profile?.vip_expires_at, days)
          profileUpdates.vip_expires_at = newVipExpires
          profileUpdates.plan_tier = 'sen_one'
          profileUpdates.senai_tier = 'max'
          profileUpdates.senai_tier_permanent = false
          profileUpdates.senai_tier_expires_at = newVipExpires
          await applySenOnePurchasePerks(supabaseAdmin, user.id, newVipExpires)
          break
        }

        case 'senai_plan': {
          if (plan) {
            profileUpdates.senai_tier = plan.tier
            if (plan.duration === 'permanent') {
              profileUpdates.senai_tier_permanent = true
              profileUpdates.senai_tier_expires_at = null
            } else {
              profileUpdates.senai_tier_permanent = false
              const daysToAdd = deal.id === 'flash_ultra_week' ? 7 : (plan.durationDays || 30)
              profileUpdates.senai_tier_expires_at = extendVipExpiry(profile?.senai_tier_expires_at, daysToAdd)
            }
          }
          break
        }

        case 'power_pass': {
          // Lưu thẻ đặc quyền vào user metadata & profile
          const passDays = 30
          const expiresAt = new Date(Date.now() + passDays * 24 * 60 * 60 * 1000).toISOString()
          try {
            const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(user.id)
            const meta = authUserData?.user?.user_metadata || {}
            const passes = meta.active_passes || {}
            passes[deal.id] = { expiresAt, activatedAt: new Date().toISOString() }
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: { ...meta, active_passes: passes },
            })
          } catch (passErr) {
            console.warn('Saving pass metadata skipped:', passErr)
          }
          break
        }

        case 'badge': {
          // Kích hoạt huy hiệu mạ vàng / danh hiệu cá nhân hóa
          const badgeKey = deal.badgeKey || deal.id
          try {
            const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(user.id)
            const meta = authUserData?.user?.user_metadata || {}
            const existingBadges: string[] = Array.isArray(meta.unlocked_badges) ? meta.unlocked_badges : []
            if (!existingBadges.includes(badgeKey)) {
              existingBadges.push(badgeKey)
            }
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: { ...meta, unlocked_badges: existingBadges, active_badge: badgeKey },
            })
          } catch (badgeErr) {
            console.warn('Saving badge metadata skipped:', badgeErr)
          }
          break
        }

        case 'mystery_box': {
          const tier = deal.mysteryTier || 'silver'
          const random = Math.random()

          if (tier === 'silver') {
            if (random < 0.60) {
              // Trúng SenCash (35 - 120 SC)
              const bonusSC = Math.floor(Math.random() * 86) + 35
              remainingBalance += bonusSC
              profileUpdates.sencash_balance = remainingBalance
              mysteryReward = {
                type: 'sencash',
                title: `🎉 Trúng Lớn: +${bonusSC} SenCash!`,
                desc: `Chúc mừng bạn đã hoàn vốn và nhận ngay ${bonusSC} SC trực tiếp vào ví!`,
                value: bonusSC,
              }
            } else if (random < 0.85) {
              // Trúng 7 ngày VIP
              const newVip = extendVipExpiry(profile?.vip_expires_at, 7)
              profileUpdates.vip_expires_at = newVip
              profileUpdates.plan_tier = profile?.plan_tier || 'vip'
              mysteryReward = {
                type: 'vip',
                title: '👑 Trúng 7 Ngày Hội Viên VIP!',
                desc: 'Đặc quyền lướt web không quảng cáo và ưu tiên phòng thi đã được cộng dồn!',
                value: 7,
              }
            } else {
              // Trúng 10 ngày SenAI Plus
              profileUpdates.senai_tier = 'plus'
              profileUpdates.senai_tier_expires_at = extendVipExpiry(profile?.senai_tier_expires_at, 10)
              mysteryReward = {
                type: 'senai',
                title: '⚡ Trúng 10 Ngày SenAI Plus (50 Câu/Ngày)!',
                desc: 'Hạn mức giải bài tập và hướng dẫn phương pháp đã được mở khóa!',
                value: 10,
              }
            }
          } else {
            // Gold Mega Chest (69 SC)
            if (random < 0.50) {
              // Trúng SenCash (100 - 350 SC)
              const bonusSC = Math.floor(Math.random() * 251) + 100
              remainingBalance += bonusSC
              profileUpdates.sencash_balance = remainingBalance
              mysteryReward = {
                type: 'sencash',
                title: `🌟 JACKPOT: +${bonusSC} SenCash Hoàng Kim!`,
                desc: `Tuyệt đỉnh may mắn! Bạn đã trúng giải Jackpot khủng ${bonusSC} SC vào ví!`,
                value: bonusSC,
              }
            } else if (random < 0.80) {
              // Trúng 15 ngày VIP Premium+
              const newVip = extendVipExpiry(profile?.vip_expires_at, 15)
              profileUpdates.vip_expires_at = newVip
              profileUpdates.plan_tier = 'premium_plus'
              mysteryReward = {
                type: 'vip',
                title: '💎 Trúng 15 Ngày VIP Premium+ Mạ Vàng!',
                desc: 'Đặc quyền siêu cấp và tính năng tương lai đỉnh cao đã được kích hoạt!',
                value: 15,
              }
            } else {
              // Trúng 15 ngày Sen Max
              profileUpdates.senai_tier = 'max'
              profileUpdates.senai_tier_expires_at = extendVipExpiry(profile?.senai_tier_expires_at, 15)
              mysteryReward = {
                type: 'senai',
                title: '👑 Trúng 15 Ngày Sen Max (500 Câu/Ngày)!',
                desc: 'Sở hữu hạng AI mạnh nhất SenExam với 500 câu/ngày và 15 lượt SenGraph AI!',
                value: 15,
              }
            }
          }
          break
        }
      }
    } else if (plan) {
      // Legacy SenAI Plan handling
      profileUpdates.senai_tier = plan.tier
      if (plan.duration === 'permanent') {
        profileUpdates.senai_tier_permanent = true
        profileUpdates.senai_tier_expires_at = null
      } else {
        profileUpdates.senai_tier_permanent = false
        const daysToAdd = plan.durationDays || (plan.duration === 'yearly' ? 365 : plan.duration === 'quarterly' ? 90 : 30)
        profileUpdates.senai_tier_expires_at = extendVipExpiry(profile?.senai_tier_expires_at, daysToAdd)
      }
    }

    // 5. Cập nhật profile nếu có thay đổi
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)

      if (profUpdateErr) {
        console.error('Error updating profile:', profUpdateErr)
        return NextResponse.json({ error: `Lỗi kích hoạt quyền lợi: ${profUpdateErr.message}` }, { status: 500 })
      }
    }

    // 6. Ghi log tracking mua sắm flash/exclusive
    try {
      const claimMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      await supabaseAdmin.from('exclusive_flash_purchases').insert({
        user_id: user.id,
        claim_month: claimMonth,
        senai_plan_code: deal?.id || plan?.code || 'exclusive_item',
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      message: deal ? `Đã mua thành công "${deal.title}"!` : 'Đã mua thành công ưu đãi độc quyền!',
      dealTitle: deal?.title || plan?.label,
      pricePaid: finalPrice,
      remainingBalance,
      reward: mysteryReward,
      vipExpiresAt: profileUpdates.vip_expires_at || null,
      senaiTier: profileUpdates.senai_tier || profile?.senai_tier || null,
    })
  } catch (e: any) {
    console.error('Exclusive store purchase error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi xử lý mua gói ưu đãi' }, { status: 500 })
  }
}
