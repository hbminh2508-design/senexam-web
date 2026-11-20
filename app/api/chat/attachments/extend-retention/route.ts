import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const { attachmentId, days = 30, permanent = false } = body || {}

    if (!attachmentId) {
      return NextResponse.json({ error: 'Thiếu attachmentId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Gọi RPC gia hạn lưu trữ tệp (chỉ Trưởng nhóm / Quản trị viên đối với nhóm, hoặc người tải lên)
    const { data, error } = await supabaseAdmin.rpc('extend_attachment_retention', {
      p_attachment_id: attachmentId,
      p_days: parseInt(String(days), 10) || 30,
      p_permanent: Boolean(permanent),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể gia hạn tệp' }, { status: 403 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[SEN_CHAT_EXTEND_RETENTION] Lỗi xử lý:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi máy chủ' }, { status: 500 })
  }
}
