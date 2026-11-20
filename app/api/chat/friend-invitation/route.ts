import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Lấy toàn bộ quan hệ bạn bè của user này
    const { data: rows, error } = await supabaseAdmin
      .from('chat_friendships')
      .select('id, user_id, friend_id, status, created_at, updated_at')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Thu thập các partner user IDs
    const partnerIds = Array.from(
      new Set((rows || []).map((r) => (r.user_id === user.id ? r.friend_id : r.user_id)))
    )

    const profileMap: Record<string, any> = {}
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url, school, class_name')
        .in('id', partnerIds)

      if (profiles) {
        profiles.forEach((p) => {
          profileMap[p.id] = p
        })
      }
    }

    const friends: any[] = []
    const incoming: any[] = []
    const outgoing: any[] = []

    for (const r of rows || []) {
      const partnerId = r.user_id === user.id ? r.friend_id : r.user_id
      const p = profileMap[partnerId] || {}
      const item = {
        friendshipId: r.id,
        id: partnerId,
        name: p.full_name || 'Học viên SenExam',
        avatar: p.avatar_url || '',
        school: p.school || '',
        className: p.class_name || '',
        status: r.status,
        updatedAt: r.updated_at,
      }

      if (r.status === 'accepted') {
        friends.push(item)
      } else if (r.status === 'pending') {
        if (r.friend_id === user.id) {
          // Người khác gửi lời mời cho tôi
          incoming.push(item)
        } else {
          // Tôi gửi lời mời cho người khác
          outgoing.push(item)
        }
      }
    }

    return NextResponse.json({ friends, incoming, outgoing })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi tải danh sách bạn bè' }, { status: 500 })
  }
}

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

    // 1. Gửi lời mời kết bạn (truyền p_caller_id cho service_role)
    if (action === 'send') {
      const { data, error } = await supabaseAdmin.rpc('send_friend_invitation', {
        p_friend_id: targetUserId,
        p_caller_id: user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 2. Chấp nhận, Từ chối, Chặn (truyền p_caller_id cho service_role)
    if (['accept', 'reject', 'block'].includes(action)) {
      const { data, error } = await supabaseAdmin.rpc('respond_friend_invitation', {
        p_sender_id: targetUserId,
        p_action: action,
        p_caller_id: user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 3. Báo cáo vi phạm (Report)
    if (action === 'report') {
      const reportReason = (reason || 'Hành vi quấy rối / vi phạm').toString().trim()
      const { data, error } = await supabaseAdmin
        .from('chat_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: targetUserId,
          reason: reportReason,
          details: details || {},
        })
        .select('*')
        .single()

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
