import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getSenAiTier, isTierUpgrade } from '@/lib/senaiTiers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { tierCode } = await request.json()
    const tier = getSenAiTier(tierCode)
    if (!tier || tier.code === 'free') return NextResponse.json({ error: 'Gói SenAI không hợp lệ' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin.from('profiles').select('senai_tier').eq('id', user.id).maybeSingle()

    if (!isTierUpgrade(profile?.senai_tier || 'free', tier.code)) {
      return NextResponse.json({ error: 'Bạn đã sở hữu gói này hoặc gói cao hơn' }, { status: 400 })
    }

    const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
      p_user_id: user.id,
      p_delta: -tier.priceSenCash,
      p_reason: 'senai_tier_purchase',
      p_reference: tier.code,
    })

    if (rpcError) {
      if (rpcError.message.includes('không đủ')) {
        return NextResponse.json({ error: 'Số dư SenCash không đủ để mua gói này' }, { status: 400 })
      }
      throw rpcError
    }

    await supabaseAdmin.from('profiles').update({ senai_tier: tier.code }).eq('id', user.id)

    return NextResponse.json({ success: true, tier: tier.code })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi mua gói SenAI' }, { status: 500 })
  }
}
