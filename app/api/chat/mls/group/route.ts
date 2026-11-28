import { NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import { canUserCreateGroup, validateGroupMemberLimit } from '@/lib/chatLimits'

export const dynamic = 'force-dynamic'

function validGroupAvatar(avatar: unknown) {
  if (avatar === null || avatar === '') return true
  if (typeof avatar !== 'string') return false
  if (avatar.startsWith('data:')) {
    return avatar.length <= 48000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(avatar)
  }
  return avatar.length <= 2048 && URL.canParse(avatar) && new URL(avatar).protocol === 'https:'
}

/**
 * Quản lý Nhóm Chat MLS (RFC 9420)
 * GET: Lấy danh sách nhóm & cuộc trò chuyện của người dùng hiện tại từ Supabase
 * POST: Tạo nhóm chat mới với danh sách email bạn bè
 * PATCH: Đổi tên / ảnh đại diện của nhóm chat
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const db = getSupabaseAdmin()
    const { data: memberships, error } = await db
      .from('chat_members')
      .select(
        'role, joined_at, chat_conversations:conversation_id(id, type, title, avatar_url, mls_group_id, mls_epoch, updated_at, created_at)'
      )
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const conversations = (memberships || [])
      .map((m: any) => {
        const rawConv = m.chat_conversations || m.conversation
        const conv = Array.isArray(rawConv) ? rawConv[0] : rawConv
        if (!conv || !conv.id) return null
        const isGroup = conv.type === 'group'
        const updatedAtMs = conv.updated_at
          ? new Date(conv.updated_at).getTime()
          : conv.created_at
          ? new Date(conv.created_at).getTime()
          : Date.now()
        return {
          id: conv.id,
          type: conv.type || 'group',
          isGroup,
          partnerId: conv.mls_group_id || conv.id,
          partnerName: conv.title || (isGroup ? 'Nhóm chat' : 'Cuộc trò chuyện'),
          partnerIdentifier: isGroup ? 'Nhóm MLS' : '',
          mlsGroupId: conv.mls_group_id || null,
          mlsEpoch: conv.mls_epoch ?? 0,
          epoch: conv.mls_epoch ?? 0,
          role: m.role || 'member',
          avatarUrl: conv.avatar_url || '',
          partnerAvatar: conv.avatar_url || '',
          unreadCount: 0,
          updatedAt: isNaN(updatedAtMs) ? Date.now() : updatedAtMs,
          createdAt: conv.created_at || null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      conversations,
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
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 100 || !validGroupAvatar(avatarUrl)) {
      return NextResponse.json({ error: 'Tên nhóm hoặc ảnh nhóm không hợp lệ.' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // Kiểm tra quyền tạo nhóm và giới hạn thành viên theo gói dịch vụ (Server-side enforcement)
    const { data: callerProfile } = await db
      .from('profiles')
      .select('vip_expires_at, plan_tier')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveTier = getEffectivePlanTier(callerProfile) || 'free'
    const createCheck = canUserCreateGroup(effectiveTier)
    if (!createCheck.allowed) {
      return NextResponse.json(
        { error: createCheck.error, code: 'PLAN_UPGRADE_REQUIRED', currentTier: effectiveTier },
        { status: 403 }
      )
    }

    const uniqueEmails = Array.isArray(memberEmails)
      ? Array.from(new Set(memberEmails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean)))
      : []

    // Tổng số thành viên bao gồm cả chủ sở hữu nhóm (+1)
    const memberLimitCheck = validateGroupMemberLimit(effectiveTier, 1, uniqueEmails.length)
    if (!memberLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: memberLimitCheck.error,
          code: 'GROUP_MEMBER_LIMIT_EXCEEDED',
          maxMembers: memberLimitCheck.maxMembers,
        },
        { status: 403 }
      )
    }

    // Gọi RPC nguyên tử create_mls_group
    const { data, error } = await db.rpc('create_mls_group', {
      p_title: title.trim(),
      p_avatar_url: avatarUrl,
      p_mls_group_id: mlsGroupId,
      p_initial_commit: initialCommit,
      p_ratchet_tree: ratchetTree,
      p_member_emails: uniqueEmails,
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
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const validId = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  if (!validId(body?.conversationId)) return NextResponse.json({ error: 'Mã nhóm không hợp lệ.' }, { status: 400 })
  const operation = body.operation || 'edit'
  if (!['edit', 'delete', 'transfer'].includes(operation)) return NextResponse.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 })
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const avatar = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
  if (operation === 'edit' && (!title || title.length > 100 || !validGroupAvatar(avatar))) {
    return NextResponse.json({ error: 'Tên nhóm hoặc ảnh nhóm không hợp lệ.' }, { status: 400 })
  }
  if (operation === 'transfer' && !validId(body.successor)) return NextResponse.json({ error: 'Hãy chọn thành viên nhận quyền.' }, { status: 400 })
  const db = getSupabaseAdmin() as import('@supabase/supabase-js').SupabaseClient
  const { data, error } = await db.rpc('sen_chat_change_group', {
    group_id: body.conversationId, actor: user.id, operation, successor: body.successor || null,
    title_value: title || null, avatar_value: avatar || null,
  })
  if (error || !data?.success) return NextResponse.json({ error: data?.error || 'Không thể lưu thay đổi của nhóm.' }, { status: error ? 503 : 403 })
  return NextResponse.json(data)
}
