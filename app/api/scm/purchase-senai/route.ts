import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiPlan } from '@/lib/senaiTiers'
import { SCM_PER_SENCASH } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { planCode, idempotencyKey } = await request.json()
    const plan = getSenAiPlan(planCode)
    if (!plan) return NextResponse.json({ error: 'Gói SenAI không hợp lệ' }, { status: 400 })

    const priceScm = (plan.priceSenCash || 0) * SCM_PER_SENCASH
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Kiểm tra idempotency nếu có
    if (idempotencyKey) {
      const { data: existingTx } = await supabaseAdmin
        .from('mobile_sencash_transactions')
        .select('*')
        .eq('reference_id', idempotencyKey)
        .maybeSingle()

      if (existingTx) {
        return NextResponse.json({
          success: true,
          message: 'Giao dịch đã được xử lý thành công trước đó (Idempotent)',
          balance: existingTx.balance_after,
          alreadyProcessed: true,
        })
      }
    }

    // 2. Lấy thông tin profile hiện tại
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, senai_trial_used, scm_balance, sencash_mobile_balance')
      .eq('id', user.id)
      .maybeSingle()

    const currentScm = Number(profile?.scm_balance ?? profile?.sencash_mobile_balance ?? 0)

    if (priceScm > 0 && currentScm < priceScm) {
      return NextResponse.json(
        {
          error: `Số dư Cash Mobile không đủ (hiện có: ${currentScm.toLocaleString('vi-VN')} SCm, cần: ${priceScm.toLocaleString('vi-VN')} SCm)`,
          requiredScm: priceScm,
          currentScm,
        },
        { status: 400 }
      )
    }

    // 3. Thử gọi RPC adjust_scm_balance nếu có, nếu chưa có thì update an toàn với kiểm tra số dư
    let newBalance = currentScm - priceScm
    const txKey = idempotencyKey || `scm_senai_${user.id}_${plan.code}_${Date.now()}`

    const { error: rpcError } = await supabaseAdmin.rpc('adjust_scm_balance', {
      p_user_id: user.id,
      p_delta: -priceScm,
      p_reason: 'senai_quota',
      p_reference: txKey,
    })

    if (rpcError) {
      // Fallback update nếu RPC chưa deploy trên DB
      const { data: updatedProfile, error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          scm_balance: newBalance,
          sencash_mobile_balance: newBalance,
        })
        .eq('id', user.id)
        .gte('scm_balance', priceScm)
        .select('scm_balance')
        .single()

      if (updateErr || !updatedProfile) {
        return NextResponse.json(
          { error: 'Giao dịch thất bại: Số dư SCm đã thay đổi hoặc không đủ' },
          { status: 400 }
        )
      }
      newBalance = Number(updatedProfile.scm_balance)
    }

    // 4. Cập nhật cấp bậc SenAI cho người dùng
    const now = new Date()
    let newExpiry: Date | null = null

    if (plan.duration === 'permanent') {
      await supabaseAdmin.from('profiles').update({
        senai_tier: plan.tier,
        senai_tier_permanent: true,
      }).eq('id', user.id)
    } else {
      const days = plan.duration === '1y' ? 365 : plan.duration === '30d' ? 30 : 3
      const currentExpiry = profile?.senai_tier_expires_at ? new Date(profile.senai_tier_expires_at) : null
      const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now
      newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

      await supabaseAdmin.from('profiles').update({
        senai_tier: plan.tier,
        senai_tier_expires_at: newExpiry.toISOString(),
        ...(plan.duration === 'trial_3d' ? { senai_trial_used: true } : {}),
      }).eq('id', user.id)
    }

    // 5. Ghi vào sổ cái mobile_sencash_transactions nếu RPC chưa ghi
    if (rpcError) {
      await supabaseAdmin.from('mobile_sencash_transactions').insert({
        user_id: user.id,
        amount: -priceScm,
        balance_after: newBalance,
        transaction_type: 'senai_quota',
        description: `Kích hoạt gói SenAI: ${plan.label} (-${priceScm} SCm)`,
        reference_id: txKey,
      })
    }

    return NextResponse.json({
      success: true,
      currency: 'SCm',
      message: `Đã kích hoạt thành công gói ${plan.label}!`,
      newBalance,
      plan: {
        code: plan.code,
        label: plan.label,
        tier: plan.tier,
        expiresAt: newExpiry?.toISOString() || 'Vĩnh viễn',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi khi mua gói SenAI' }, { status: 500 })
  }
}
