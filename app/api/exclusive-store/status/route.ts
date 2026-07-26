import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import {
  isBlackFridayDate, BLACK_FRIDAY_DEALS,
  MONTHLY_FLASH_SALE_DISCOUNT_PERCENT, MONTHLY_FLASH_SALE_QUOTA, getClaimMonthKey,
  canAccessExclusiveStore,
} from '@/lib/exclusiveStore'

export const dynamic = 'force-dynamic'

// Số suất Black Friday là công khai (đọc bằng service role để bỏ qua RLS chỉ-xem-của-mình), nhưng
// số lượt sale hàng tháng đã dùng là riêng theo từng người nên route này cần xác thực user.
export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const claimYear = new Date().getFullYear()
  const dealCodes = Object.keys(BLACK_FRIDAY_DEALS)
  const claimed: Record<string, number> = {}

  for (const code of dealCodes) {
    const { count } = await supabaseAdmin
      .from('exclusive_deal_claims')
      .select('id', { count: 'exact', head: true })
      .eq('deal_code', code)
      .eq('claim_year', claimYear)
    claimed[code] = count || 0
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('vip_expires_at, plan_tier')
    .eq('id', user.id)
    .maybeSingle()
  const planTier = getEffectivePlanTier(profile)

  let monthlyFlash = null
  if (canAccessExclusiveStore(planTier)) {
    const monthKey = getClaimMonthKey()
    const { count } = await supabaseAdmin
      .from('exclusive_flash_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('claim_month', monthKey)
    const quota = MONTHLY_FLASH_SALE_QUOTA[planTier as 'vip' | 'premium']
    monthlyFlash = {
      used: count || 0,
      quota,
      remaining: Math.max(0, quota - (count || 0)),
      discountPercent: MONTHLY_FLASH_SALE_DISCOUNT_PERCENT[planTier as 'vip' | 'premium'],
    }
  }

  return NextResponse.json({
    isBlackFriday: isBlackFridayDate(),
    claimed,
    monthlyFlash,
  })
}
