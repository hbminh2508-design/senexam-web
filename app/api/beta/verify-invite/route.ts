import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Danh sách các mã mời Beta hợp lệ
const VALID_BETA_KEYS = new Set([
  'SENBETA2027',
  'SENEXAM-BETA-VIP',
  'SENBETA-PRO',
  'SENEXAM2027',
  'SENAI-BETA-ACCESS',
])

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để kích hoạt mã Beta' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const inviteKey = typeof body.key === 'string' ? body.key.trim().toUpperCase() : ''

    if (!inviteKey) {
      return NextResponse.json({ error: 'Vui lòng nhập mã mời Beta' }, { status: 400 })
    }

    // Kiểm tra mã mời
    if (!VALID_BETA_KEYS.has(inviteKey)) {
      return NextResponse.json({
        error: 'Mã mời thử nghiệm Beta không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ Admin.',
      }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Cập nhật profile người dùng thành is_beta_tester = true
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        is_beta_tester: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      throw updateErr
    }

    return NextResponse.json({
      success: true,
      message: 'Kích hoạt quyền truy cập Kênh Thử Nghiệm Beta thành công!',
    })
  } catch (err: any) {
    console.error('Error in /api/beta/verify-invite:', err)
    return NextResponse.json({ error: err.message || 'Lỗi xử lý mã mời Beta' }, { status: 500 })
  }
}
