import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { fetchScmBalance, fetchMyScmTransactions } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('scm_balance, sencash_mobile_balance')
      .eq('id', user.id)
      .maybeSingle()

    const balance = Number(profile?.scm_balance ?? profile?.sencash_mobile_balance ?? 0)

    const { data: txs } = await supabaseAdmin
      .from('mobile_sencash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      success: true,
      currency: 'SCm',
      wallet: 'mobile',
      balance,
      transactions: txs || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi tải số dư SCm' }, { status: 500 })
  }
}
