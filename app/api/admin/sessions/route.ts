import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerErr) throw callerErr
    const callerRole = callerProfile?.role
    const isSuperAdmin = caller.email && ['admin@senexam.me', 'hoangbinhminh2508@gmail.com'].includes(caller.email.toLowerCase())
    if (callerRole !== 'admin' && callerRole !== 'collab' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền xem danh sách phiên' }, { status: 403 })
    }

    // Lấy danh sách phiên từ bảng fepn_user_sessions (hoặc bảng user_sessions)
    let sessions: any[] = []
    try {
      const { data, error } = await supabaseAdmin
        .from('fepn_user_sessions')
        .select('*')
        .order('last_active_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        sessions = data
      }
    } catch (dbErr) {
      console.warn('Lỗi đọc bảng fepn_user_sessions:', dbErr)
    }

    // Nếu có sessions, lấy thêm email / full_name từ profiles
    const userIds = Array.from(new Set(sessions.map((s) => s.user_id).filter(Boolean)))
    let profilesMap: Record<string, { email?: string; full_name?: string; role?: string }> = {}

    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, role')
          .in('id', userIds)

        if (profs) {
          profs.forEach((p) => {
            profilesMap[p.id] = p
          })
        }
      } catch (pErr) {}
    }

    const enrichedSessions = sessions.map((s) => ({
      ...s,
      user_email: profilesMap[s.user_id]?.email || 'N/A',
      user_full_name: profilesMap[s.user_id]?.full_name || 'Người dùng',
      user_role: profilesMap[s.user_id]?.role || 'student',
    }))

    const activeCount = enrichedSessions.filter((s) => s.is_active).length
    const uniqueUserCount = new Set(enrichedSessions.filter((s) => s.is_active).map((s) => s.user_id)).size

    return NextResponse.json({
      success: true,
      totalActive: activeCount,
      uniqueUsers: uniqueUserCount,
      sessions: enrichedSessions,
    })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/sessions GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi tải danh sách phiên' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerErr) throw callerErr
    const callerRole = callerProfile?.role
    const isSuperAdmin = caller.email && ['admin@senexam.me', 'hoangbinhminh2508@gmail.com'].includes(caller.email.toLowerCase())
    if (callerRole !== 'admin' && callerRole !== 'collab' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền quản lý phiên' }, { status: 403 })
    }

    const body = await request.json()
    const { action, sessionId, userId } = body

    if (action === 'revoke') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Thiếu sessionId' }, { status: 400 })
      }

      await supabaseAdmin
        .from('fepn_user_sessions')
        .update({ is_active: false })
        .or(`id.eq.${sessionId},device_id.eq.${sessionId}`)

      return NextResponse.json({ success: true, message: 'Đã hủy phiên làm việc thành công' })
    }

    if (action === 'revoke_all_user') {
      if (!userId) {
        return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })
      }

      await supabaseAdmin
        .from('fepn_user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)

      return NextResponse.json({ success: true, message: 'Đã đăng xuất toàn bộ thiết bị của người dùng' })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/sessions POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi quản lý phiên' },
      { status: 500 }
    )
  }
}
