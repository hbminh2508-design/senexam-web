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
    const { action, targetUserId, reason, details } = body || {}

    if (!action || !targetUserId) {
      return NextResponse.json({ error: 'Thiếu tham số bắt buộc' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Gửi lời mời kết bạn
    if (action === 'send') {
      const { data, error } = await supabaseAdmin.rpc('send_friend_invitation', {
        p_friend_id: targetUserId,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 2. Chấp nhận, Từ chối, Chặn
    if (['accept', 'reject', 'block'].includes(action)) {
      const { data, error } = await supabaseAdmin.rpc('respond_friend_invitation', {
        p_sender_id: targetUserId,
        p_action: action,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 3. Báo cáo vi phạm (Report)
    if (action === 'report') {
      const reportReason = (reason || 'Hành vi quấy rối / vi phạm').toString().trim()
      const { data, error } = await supabaseAdmin.from('chat_reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId,
        reason: reportReason,
        details: details || {},
      }).select('*').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        success: true,
        message: 'Báo cáo của bạn đã được ghi nhận. Ban quản trị sẽ tiến hành xử lý.',
        reportId: data?.id,
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Friend invitation route error:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý yêu cầu' }, { status: 500 })
  }
}
