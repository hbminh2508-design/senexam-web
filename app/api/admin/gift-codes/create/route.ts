import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'
import { generateGiftCode } from '@/lib/giftCodes'

export const dynamic = 'force-dynamic'

const MAX_BATCH_SIZE = 200

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

    const body = await request.json()
    const {
      rewardType, count, note, maxUses, expiresAt,
      vipDays, sencashAmount, senaiTier, senaiDurationDays, senaiPermanent,
      customCode, code,
    } = body

    const codeCount = parseInt(count, 10) || 1
    if (!Number.isFinite(codeCount) || codeCount < 1 || codeCount > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Số lượng mã phải từ 1 đến ${MAX_BATCH_SIZE}` }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      reward_type: rewardType,
      note: note || null,
      max_uses: Math.max(1, parseInt(maxUses, 10) || 1),
      expires_at: expiresAt || null,
      created_by: admin.id,
      active: true,
      used_count: 0,
    }

    if (rewardType === 'vip_days') {
      const days = parseInt(vipDays, 10)
      if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: 'Số ngày VIP không hợp lệ' }, { status: 400 })
      row.reward_vip_days = days
    } else if (rewardType === 'sencash') {
      const amount = parseInt(sencashAmount, 10)
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Số SenCash không hợp lệ' }, { status: 400 })
      row.reward_sencash_amount = amount
    } else if (rewardType === 'senai_tier') {
      if (!['lite', 'plus_lite', 'plus', 'ultra'].includes(senaiTier)) {
        return NextResponse.json({ error: 'Hạng SenAI không hợp lệ' }, { status: 400 })
      }
      row.reward_senai_tier = senaiTier
      row.reward_senai_permanent = !!senaiPermanent
      if (!senaiPermanent) {
        const days = parseInt(senaiDurationDays, 10)
        if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: 'Số ngày gói SenAI không hợp lệ' }, { status: 400 })
        row.reward_senai_duration_days = days
      }
    } else {
      return NextResponse.json({ error: 'Loại phần thưởng không hợp lệ' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const batchId = crypto.randomUUID()
    const custom = (customCode || code || '').trim()

    const rows = Array.from({ length: codeCount }, (_, idx) => ({
      ...row,
      batch_id: batchId,
      code: codeCount === 1 && custom ? custom : generateGiftCode(),
    }))

    const { data: inserted, error } = await supabaseAdmin.from('gift_codes').insert(rows).select('*')
    if (error) throw error

    return NextResponse.json({ success: true, codes: inserted || [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lỗi tạo mã quà tặng' }, { status: 500 })
  }
}
