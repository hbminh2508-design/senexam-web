import { NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Đồng bộ Commits và Welcome Packages cho Nhóm MLS
 * GET: Lấy danh sách commits của một nhóm hội thoại hoặc gói Welcome của user
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const sinceEpoch = parseInt(searchParams.get('sinceEpoch') || '-1', 10)
    const checkWelcome = searchParams.get('welcome') === 'true'

    const db = getSupabaseAdmin()

    // 1. Kiểm tra nếu tìm gói Welcome cho người dùng mới
    if (checkWelcome) {
      const { data: welcomeItems, error } = await db
        .from('chat_mls_commits')
        .select('id, conversation_id, epoch, welcome_message, ratchet_tree, created_at, committed_by')
        .eq('welcome_for_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, welcomes: welcomeItems || [] })
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
    }

    // 2. Kiểm tra quyền thành viên
    const { data: membership } = await db
      .from('chat_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Bạn không phải là thành viên của cuộc hội thoại này' }, { status: 403 })
    }

    // 3. Lấy commits mới hơn sinceEpoch
    const { data: commits, error } = await db
      .from('chat_mls_commits')
      .select('id, conversation_id, epoch, commit_message, ratchet_tree, action_type, committed_by, target_user_id, created_at')
      .eq('conversation_id', conversationId)
      .gt('epoch', sinceEpoch)
      .order('epoch', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, commits: commits || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}
