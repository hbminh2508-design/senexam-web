import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getExclusiveDeal } from '@/lib/exclusiveStore'
import { SCM_PER_SENCASH } from '@/lib/senCash'
import { extendVipExpiry } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { dealId, idempotencyKey } = await request.json()
    const deal = getExclusiveDeal(dealId)
    if (!deal) return NextResponse.json({ error: 'Ưu đãi không tồn tại' }, { status: 400 })

    const priceScm = (deal.discountedPrice || 0) * SCM_PER_SENCASH
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
          message: 'Giao dịch đã được xử lý trước đó',
          balance: existingTx.balance_after,
          alreadyProcessed: true,
        })
      }
    }

    // 2. Kiểm tra số dư SCm
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('scm_balance, sencash_mobile_balance, vip_expires_at, is_vip')
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

    // 3. Trừ số dư SCm an toàn
    let newBalance = currentScm - priceScm
    const txKey = idempotencyKey || `scm_deal_${user.id}_${deal.id}_${Date.now()}`

    const { error: rpcError } = await supabaseAdmin.rpc('adjust_scm_balance', {
      p_user_id: user.id,
      p_delta: -priceScm,
      p_reason: 'exclusive_deal',
      p_reference: txKey,
    })

    if (rpcError) {
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

    // 4. Áp dụng đặc quyền ưu đãi nếu có VIP
    if (deal.type === 'vip_combo') {
      const newVipExp = extendVipExpiry(profile?.vip_expires_at, 30)
      await supabaseAdmin.from('profiles').update({
        is_vip: true,
        vip_expires_at: newVipExp,
      }).eq('id', user.id)
    }

    // 5. Ghi sổ cái mobile_sencash_transactions nếu RPC chưa ghi
    if (rpcError) {
      await supabaseAdmin.from('mobile_sencash_transactions').insert({
        user_id: user.id,
        amount: -priceScm,
        balance_after: newBalance,
        transaction_type: 'exclusive_deal',
        description: `Mở khóa ưu đãi: ${deal.title} (-${priceScm} SCm)`,
        reference_id: txKey,
      })
    }

    return NextResponse.json({
      success: true,
      currency: 'SCm',
      message: `Đã mở khóa ưu đãi: ${deal.title}!`,
      newBalance,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi khi mua ưu đãi' }, { status: 500 })
  }
}
