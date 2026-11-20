import { NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Quản lý Thành viên Nhóm MLS (RFC 9420)
 * GET: Lấy danh sách thành viên nhóm kèm vai trò (chỉ thành viên nhóm mới được xem)
 * POST: Thêm thành viên bằng email (xoay khóa nhóm qua MLS Commit + Welcome)
 * DELETE: Xóa thành viên hoặc tự rời nhóm (xoay khóa nhóm qua MLS Commit)
 * PATCH: Cập nhật vai trò thành viên (chỉ Owner)
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // 1. Kiểm tra caller có thuộc nhóm này không
    const { data: membership } = await db
      .from('chat_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Bạn không phải là thành viên của cuộc hội thoại này' }, { status: 403 })
    }

    // 2. Lấy thông tin thành viên
    const { data: members, error } = await db
      .from('chat_members')
      .select('id, user_id, role, joined_at, profiles:user_id(id, full_name, email, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (members || []).map((m: any) => ({
      memberId: m.id,
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      name: m.profiles?.full_name || 'Người dùng',
      email: m.profiles?.email || '',
      avatar: m.profiles?.avatar_url || '',
    }))

    return NextResponse.json({
      success: true,
      myRole: membership.role,
      members: formatted,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.conversationId || !body.targetEmail || !body.commitMessage || !body.welcomeMessage) {
      return NextResponse.json({ error: 'Thiếu thông số bắt buộc (conversationId, targetEmail, commitMessage, welcomeMessage)' }, { status: 400 })
    }

    const {
      conversationId,
      targetEmail,
      commitMessage,
      welcomeMessage,
      newEpoch = 1,
      ratchetTree = '',
    } = body

    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc('add_mls_group_member', {
      p_conversation_id: conversationId,
      p_target_email: targetEmail.trim(),
      p_commit_message: commitMessage,
      p_welcome_message: welcomeMessage,
      p_new_epoch: newEpoch,
      p_ratchet_tree: ratchetTree,
      p_caller_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể thêm thành viên' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.conversationId || !body.targetUserId || !body.commitMessage) {
      return NextResponse.json({ error: 'Thiếu thông số bắt buộc (conversationId, targetUserId, commitMessage)' }, { status: 400 })
    }

    const {
      conversationId,
      targetUserId,
      commitMessage,
      newEpoch = 1,
      ratchetTree = '',
    } = body

    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc('remove_mls_group_member', {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
      p_commit_message: commitMessage,
      p_new_epoch: newEpoch,
      p_ratchet_tree: ratchetTree,
      p_caller_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể xóa thành viên' }, { status: 400 })
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
    if (!body || !body.conversationId || !body.targetUserId || !body.newRole) {
      return NextResponse.json({ error: 'Thiếu thông số bắt buộc (conversationId, targetUserId, newRole)' }, { status: 400 })
    }

    const { conversationId, targetUserId, newRole } = body
    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc('update_mls_member_role', {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
      p_caller_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || 'Không thể cập nhật vai trò' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}
