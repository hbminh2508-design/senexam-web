import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'
import { extendVipExpiry } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

    const { userId, days, note, planTier } = await request.json()
    const daysNum = parseInt(days, 10)
    if (!userId || !Number.isFinite(daysNum) || daysNum <= 0) {
      return NextResponse.json({ error: 'Thiếu userId hoặc số ngày không hợp lệ' }, { status: 400 })
    }
    const tier: 'lite' | 'vip' | 'premium' = planTier === 'lite' || planTier === 'premium' ? planTier : 'vip'

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile, error: fetchErr } = await supabaseAdmin.from('profiles').select('vip_expires_at').eq('id', userId).maybeSingle()
    if (fetchErr) throw fetchErr
    if (!profile) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })

    const newExpiresAt = extendVipExpiry(profile.vip_expires_at, daysNum)
    await supabaseAdmin.from('profiles').update({ vip_expires_at: newExpiresAt, plan_tier: tier }).eq('id', userId)

    await supabaseAdmin.from('admin_grants_log').insert({
      admin_id: admin.id,
      target_user_id: userId,
      kind: 'vip_days',
      amount: daysNum,
      note: note || null,
    })

    return NextResponse.json({ success: true, vipExpiresAt: newExpiresAt })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi cấp VIP' }, { status: 500 })
  }
}
