import { NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Quản lý Nhóm Chat MLS (RFC 9420)
 * POST: Tạo nhóm chat mới với danh sách email bạn bè
 * PATCH: Đổi tên / ảnh đại diện của nhóm chat
 */
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.title) {
      return NextResponse.json({ error: 'Thiếu tên nhóm (title)' }, { status: 400 })
    }

    const {
      title,
      avatarUrl = null,
      mlsGroupId = `mls_group_${Date.now()}`,
      initialCommit = '',
      ratchetTree = '',
      memberEmails = [],
    } = body

    const db = getSupabaseAdmin()

    // Gọi RPC nguyên tử create_mls_group
    const { data, error } = await db.rpc('create_mls_group', {
      p_title: title.trim(),
      p_avatar_url: avatarUrl,
      p_mls_group_id: mlsGroupId,
      p_initial_commit: initialCommit,
      p_ratchet_tree: ratchetTree,
      p_member_emails: memberEmails,
      p_creator_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể tạo nhóm' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.conversationId) {
      return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
    }

    const { conversationId, title, avatarUrl } = body
    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc('update_mls_group_info', {
      p_conversation_id: conversationId,
      p_title: title || null,
      p_avatar_url: avatarUrl || null,
      p_caller_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể cập nhật thông tin nhóm' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}
