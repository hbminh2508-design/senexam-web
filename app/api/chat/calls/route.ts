import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import { validateGroupCallStartOrJoin, getPlanEntitlements } from '@/lib/chatLimits'

export const dynamic = 'force-dynamic'

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * Tạo LiveKit SFU JWT token chuẩn (HS256) khi biến môi trường LIVEKIT_API_KEY & LIVEKIT_API_SECRET được cấu hình.
 * Tuyệt đối không đưa secret xuống client.
 */
function createSfuAccessToken(params: {
  roomName: string
  userId: string
  userName: string
  canPublish: boolean
  ttlSeconds?: number
}): { token: string | null; sfuUrl: string | null; sfuConfigured: boolean } {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const sfuUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || null

  if (!apiKey || !apiSecret || !sfuUrl) {
    return { token: null, sfuUrl, sfuConfigured: false }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const expSec = nowSec + Math.min(params.ttlSeconds || 3600, 24 * 3600)

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: apiKey,
      sub: params.userId,
      name: params.userName,
      nbf: nowSec - 5,
      exp: expSec,
      jti: `${params.userId}_${nowSec}`,
      video: {
        room: params.roomName,
        roomJoin: true,
        canPublish: params.canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    })
  )

  const signature = base64UrlEncode(
    crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest()
  )

  return {
    token: `${header}.${payload}.${signature}`,
    sfuUrl,
    sfuConfigured: true,
  }
}

/**
 * GET /api/chat/calls?conversationId=...
 * Lấy trạng thái phiên gọi hiện tại của hội thoại/nhóm (server-authoritative timing & participants).
 */
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    // Kiểm tra quyền thành viên
    const { data: member } = await db
      .from('chat_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Bạn không phải thành viên của cuộc hội thoại này' }, { status: 403 })
    }

    const { data: session } = await db
      .from('chat_call_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .in('status', ['ringing', 'active', 'reconnecting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ success: true, activeCall: null })
    }

    // Kiểm tra hết hạn thời lượng phía server
    const nowMs = Date.now()
    if (session.expires_at && new Date(session.expires_at).getTime() <= nowMs) {
      await db
        .from('chat_call_sessions')
        .update({
          status: 'ended',
          ended_at: new Date(nowMs).toISOString(),
          end_reason: 'DURATION_LIMIT_EXCEEDED',
          updated_at: new Date(nowMs).toISOString(),
        })
        .eq('id', session.id)

      return NextResponse.json({
        success: true,
        activeCall: null,
        justExpired: true,
        endReason: 'DURATION_LIMIT_EXCEEDED',
      })
    }

    const { data: participants } = await db
      .from('chat_call_participants')
      .select('user_id, role_in_group, status, mic_enabled, camera_enabled, screen_sharing, joined_at, last_heartbeat_at')
      .eq('call_id', session.id)
      .eq('status', 'joined')

    const remainingSeconds = session.expires_at
      ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - nowMs) / 1000))
      : null

    return NextResponse.json({
      success: true,
      activeCall: {
        id: session.id,
        conversationId: session.conversation_id,
        callType: session.call_type,
        transportMode: session.transport_mode,
        status: session.status,
        initiatorId: session.initiator_id,
        groupOwnerId: session.group_owner_id,
        ownerPlanTier: session.owner_plan_tier,
        maxParticipants: session.max_participants,
        maxDurationSeconds: session.max_duration_seconds,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        remainingSeconds,
        sfuRoomName: session.sfu_room_name,
        participants: participants || [],
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi tải thông tin cuộc gọi' }, { status: 500 })
  }
}

/**
 * POST /api/chat/calls
 * Actions: start_or_join | heartbeat | upgrade_to_video | leave | end_for_all
 */
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.action) {
      return NextResponse.json({ error: 'Thiếu action' }, { status: 400 })
    }

    const {
      action,
      conversationId,
      callId,
      callType = 'voice',
      idempotencyKey,
      micEnabled,
      cameraEnabled,
      screenSharing,
      userName = 'Thành viên Sen Chat',
    } = body

    const db = getSupabaseAdmin()

    if (action === 'start_or_join') {
      if (!conversationId) {
        return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
      }

      // Kiểm tra membership & thông tin hội thoại
      const { data: conv } = await db
        .from('chat_conversations')
        .select('id, type, created_by')
        .eq('id', conversationId)
        .maybeSingle()

      if (!conv) {
        return NextResponse.json({ error: 'Không tìm thấy cuộc hội thoại' }, { status: 404 })
      }

      const { data: member } = await db
        .from('chat_members')
        .select('role')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) {
        return NextResponse.json(
          { error: 'Bạn không phải là thành viên của nhóm này', code: 'NOT_A_MEMBER' },
          { status: 403 }
        )
      }

      // Gọi RPC nguyên tử create_or_join_group_call (nếu DB đã chạy migration 016)
      const { data: rpcData, error: rpcErr } = await db.rpc('create_or_join_group_call', {
        p_conversation_id: conversationId,
        p_call_type: callType,
        p_caller_id: user.id,
        p_idempotency_key: idempotencyKey || null,
      })

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return NextResponse.json(
            { error: rpcData.error || 'Không thể tham gia cuộc gọi', code: rpcData.code || 'CALL_DENIED' },
            { status: 403 }
          )
        }

        const sfu =
          conv.type === 'group'
            ? createSfuAccessToken({
                roomName: rpcData.sfuRoomName,
                userId: user.id,
                userName,
                canPublish: true,
                ttlSeconds: rpcData.maxDurationSeconds || 3600 * 6,
              })
            : { token: null, sfuUrl: null, sfuConfigured: false }

        return NextResponse.json({
          success: true,
          ...rpcData,
          transportMode: conv.type === 'group' ? 'sfu' : 'p2p',
          sfuToken: sfu.token,
          sfuUrl: sfu.sfuUrl,
          sfuConfigured: sfu.sfuConfigured,
        })
      }

      // Fallback logic khi migration chưa chạy trên môi trường dev: vẫn kiểm tra gói chủ nhóm nghiêm ngặt
      const { data: members } = await db
        .from('chat_members')
        .select('user_id, role')
        .eq('conversation_id', conversationId)

      const owner = (members || []).find((m: any) => m.role === 'owner')
      const ownerId = owner?.user_id || conv.created_by || user.id
      const { data: ownerProfile } = await db
        .from('profiles')
        .select('vip_expires_at, plan_tier')
        .eq('id', ownerId)
        .maybeSingle()

      const ownerTier = conv.type === 'group' ? getEffectivePlanTier(ownerProfile) || 'free' : 'vip'
      const ent = getPlanEntitlements(ownerTier)

      if (conv.type === 'group') {
        const check = validateGroupCallStartOrJoin(ownerTier, 0)
        if (!check.allowed) {
          return NextResponse.json({ error: check.error, code: 'GROUP_OWNER_FREE_TIER' }, { status: 403 })
        }
      }

      const roomName = `senchat-${conversationId.replace(/-/g, '')}`
      const sfu =
        conv.type === 'group'
          ? createSfuAccessToken({
              roomName,
              userId: user.id,
              userName,
              canPublish: true,
              ttlSeconds: ent.maxCallDurationSeconds || 3600 * 6,
            })
          : { token: null, sfuUrl: null, sfuConfigured: false }

      return NextResponse.json({
        success: true,
        callId: callId || `call_${Date.now()}`,
        sfuRoomName: roomName,
        transportMode: conv.type === 'group' ? 'sfu' : 'p2p',
        maxParticipants: conv.type === 'group' ? ent.maxCallParticipants : 2,
        maxDurationSeconds: conv.type === 'group' ? ent.maxCallDurationSeconds : null,
        ownerPlanTier: ownerTier,
        sfuToken: sfu.token,
        sfuUrl: sfu.sfuUrl,
        sfuConfigured: sfu.sfuConfigured,
      })
    }

    if (action === 'heartbeat') {
      if (!callId) return NextResponse.json({ error: 'Thiếu callId' }, { status: 400 })
      const nowIso = new Date().toISOString()

      const { data: session } = await db
        .from('chat_call_sessions')
        .select('id, status, expires_at')
        .eq('id', callId)
        .maybeSingle()

      if (!session || session.status === 'ended') {
        return NextResponse.json({ success: false, ended: true, endReason: 'CALL_ENDED' })
      }

      if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
        await db
          .from('chat_call_sessions')
          .update({ status: 'ended', ended_at: nowIso, end_reason: 'DURATION_LIMIT_EXCEEDED', updated_at: nowIso })
          .eq('id', callId)

        return NextResponse.json({ success: false, ended: true, endReason: 'DURATION_LIMIT_EXCEEDED' })
      }

      const patch: Record<string, any> = { last_heartbeat_at: nowIso, updated_at: nowIso }
      if (typeof micEnabled === 'boolean') patch.mic_enabled = micEnabled
      if (typeof cameraEnabled === 'boolean') patch.camera_enabled = cameraEnabled
      if (typeof screenSharing === 'boolean') patch.screen_sharing = screenSharing

      await db
        .from('chat_call_participants')
        .update(patch)
        .eq('call_id', callId)
        .eq('user_id', user.id)

      const remainingSeconds = session.expires_at
        ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))
        : null

      return NextResponse.json({ success: true, remainingSeconds })
    }

    if (action === 'leave' || action === 'end_for_all') {
      if (!callId) return NextResponse.json({ error: 'Thiếu callId' }, { status: 400 })
      const { data, error } = await db.rpc('leave_or_end_group_call', {
        p_call_id: callId,
        p_caller_id: user.id,
        p_end_for_all: action === 'end_for_all',
        p_reason: action === 'end_for_all' ? 'ENDED_BY_ADMIN' : 'USER_LEFT',
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data?.success) {
        return NextResponse.json({ error: data?.error || 'Không thể rời/kết thúc cuộc gọi' }, { status: 403 })
      }
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi máy chủ cuộc gọi' }, { status: 500 })
  }
}
