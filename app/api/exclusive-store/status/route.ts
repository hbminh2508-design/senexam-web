import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { isBlackFridayDate, BLACK_FRIDAY_DEALS } from '@/lib/exclusiveStore'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const claimYear = new Date().getFullYear()
    const dealCodes = Object.keys(BLACK_FRIDAY_DEALS)
    const claimed: Record<string, number> = {}

    for (const code of dealCodes) {
      try {
        const { count } = await supabaseAdmin
          .from('exclusive_deal_claims')
          .select('id', { count: 'exact', head: true })
          .eq('deal_code', code)
          .eq('claim_year', claimYear)
        claimed[code] = count || 0
      } catch {
        claimed[code] = 0
      }
    }

    let usedCount = 0
    try {
      const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      const { count } = await supabaseAdmin
        .from('exclusive_flash_purchases')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('claim_month', monthKey)
      usedCount = count || 0
    } catch {
      usedCount = 0
    }

    const quota = 50
    const monthlyFlash = {
      used: usedCount,
      quota,
      remaining: Math.max(0, quota - usedCount),
      discountPercent: 30, // 30% Flash Sale
    }

    return NextResponse.json({
      isBlackFriday: isBlackFridayDate(),
      claimed,
      monthlyFlash,
    })
  } catch (err: any) {
    return NextResponse.json({
      isBlackFriday: false,
      claimed: {},
      monthlyFlash: { used: 0, quota: 50, remaining: 50, discountPercent: 30 },
    })
  }
}
