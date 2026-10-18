import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

    const body = await request.json()
    const { action, codeId } = body

    if (!codeId) {
      return NextResponse.json({ error: 'Thiếu codeId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    if (action === 'delete') {
      const { error: delErr } = await supabaseAdmin.from('gift_codes').delete().eq('id', codeId)
      if (delErr) throw delErr
      return NextResponse.json({ success: true, message: 'Đã xóa mã quà tặng thành công' })
    }

    if (action === 'toggle_active') {
      const { active } = body
      const { error: upErr } = await supabaseAdmin
        .from('gift_codes')
        .update({ active: !!active })
        .eq('id', codeId)
      if (upErr) throw upErr
      return NextResponse.json({
        success: true,
        message: active ? 'Đã kích hoạt lại mã quà tặng' : 'Đã vô hiệu hóa mã quà tặng',
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/gift-codes/action:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    )
  }
}
