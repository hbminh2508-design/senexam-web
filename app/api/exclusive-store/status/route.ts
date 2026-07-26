import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { isMonthlyFlashSaleDay, isBlackFridayDate, BLACK_FRIDAY_DEALS } from '@/lib/exclusiveStore'

export const dynamic = 'force-dynamic'

// Trạng thái công khai (không có thông tin nhạy cảm) — số suất Black Friday đã có người nhận
// trong năm nay, dùng service role key để đọc đúng số thật bất kể ai gọi (bỏ qua RLS chỉ-xem-của-mình).
export async function GET() {
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

  return NextResponse.json({
    isFlashSaleDay: isMonthlyFlashSaleDay(),
    isBlackFriday: isBlackFridayDate(),
    claimed,
  })
}
