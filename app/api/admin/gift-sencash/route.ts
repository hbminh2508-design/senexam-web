import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

    const { userId, amount, note } = await request.json()
    const amountNum = parseInt(amount, 10)
    if (!userId || !Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Thiếu userId hoặc số SenCash không hợp lệ' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
      p_user_id: userId,
      p_delta: amountNum,
      p_reason: 'admin_gift',
      p_reference: note || null,
    })
    if (rpcError) throw rpcError

    await supabaseAdmin.from('admin_grants_log').insert({
      admin_id: admin.id,
      target_user_id: userId,
      kind: 'sencash_gift',
      amount: amountNum,
      note: note || null,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi tặng SenCash' }, { status: 500 })
  }
}
