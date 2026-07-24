import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { normalizeGiftCode, describeGiftReward } from '@/lib/giftCodes'
import { extendVipExpiry } from '@/lib/vipMembership'
import { SENAI_TIER_LABEL } from '@/lib/senaiTiers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { code } = await request.json()
    if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Thiếu mã' }, { status: 400 })
    const normalized = normalizeGiftCode(code)

    const supabaseAdmin = getSupabaseAdmin()
    const { data: giftCode, error: fetchErr } = await supabaseAdmin
      .from('gift_codes')
      .select('*')
      .eq('code', normalized)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!giftCode) return NextResponse.json({ error: 'Mã không tồn tại' }, { status: 404 })
    if (!giftCode.active) return NextResponse.json({ error: 'Mã đã bị vô hiệu hoá' }, { status: 400 })
    if (giftCode.expires_at && new Date(giftCode.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Mã đã hết hạn' }, { status: 400 })
    }
    if (giftCode.used_count >= giftCode.max_uses) {
      return NextResponse.json({ error: 'Mã đã được sử dụng hết lượt' }, { status: 400 })
    }

    // Ràng buộc unique (code_id, user_id) đảm bảo 1 người không đổi cùng 1 mã 2 lần, kể cả khi đua request
    const { error: redemptionErr } = await supabaseAdmin
      .from('gift_code_redemptions')
      .insert({ code_id: giftCode.id, user_id: user.id })

    if (redemptionErr) {
      if (redemptionErr.code === '23505') {
        return NextResponse.json({ error: 'Bạn đã đổi mã này rồi' }, { status: 400 })
      }
      throw redemptionErr
    }

    if (giftCode.reward_type === 'vip_days') {
      const { data: profile } = await supabaseAdmin.from('profiles').select('vip_expires_at').eq('id', user.id).maybeSingle()
      const newExpiresAt = extendVipExpiry(profile?.vip_expires_at, giftCode.reward_vip_days)
      await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt }).eq('id', user.id)
    } else if (giftCode.reward_type === 'sencash') {
      const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
        p_user_id: user.id,
        p_delta: giftCode.reward_sencash_amount,
        p_reason: 'gift_code',
        p_reference: giftCode.code,
      })
      if (rpcError) throw rpcError
    } else if (giftCode.reward_type === 'senai_tier') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('senai_tier, senai_tier_expires_at, senai_tier_permanent')
        .eq('id', user.id)
        .maybeSingle()

      const update: Record<string, unknown> = { senai_tier: giftCode.reward_senai_tier }
      if (giftCode.reward_senai_permanent) {
        update.senai_tier_permanent = true
        update.senai_tier_expires_at = null
      } else {
        update.senai_tier_permanent = false
        const sameTierStillActive = profile?.senai_tier === giftCode.reward_senai_tier && !profile?.senai_tier_permanent
          && !!profile?.senai_tier_expires_at && new Date(profile.senai_tier_expires_at).getTime() > Date.now()
        update.senai_tier_expires_at = extendVipExpiry(sameTierStillActive ? profile?.senai_tier_expires_at : null, giftCode.reward_senai_duration_days)
      }
      await supabaseAdmin.from('profiles').update(update).eq('id', user.id)
    }

    await supabaseAdmin.from('gift_codes').update({ used_count: giftCode.used_count + 1 }).eq('id', giftCode.id)

    return NextResponse.json({ success: true, reward: describeGiftReward(giftCode, SENAI_TIER_LABEL) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi đổi mã' }, { status: 500 })
  }
}
