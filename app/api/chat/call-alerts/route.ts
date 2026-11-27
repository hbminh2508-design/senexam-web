import { after } from 'next/server'
import { createHmac } from 'node:crypto'
import { chatAudience, chatDb, chatUuid, sendChatPush } from '@/lib/senChatAlertsServer'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

const callFields = 'call_id,caller_id,recipient_id,conversation_id,mode,state,expires_at,created_at,accepted_at'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Cần đăng nhập' }, { status: 401 })
  const params = new URL(request.url).searchParams
  if (params.has('ice')) {
    const urls = process.env.SEN_CHAT_TURN_URLS?.split(',').map((url) => url.trim()).filter((url) => /^turns?:/.test(url))
    const secret = process.env.SEN_CHAT_TURN_SHARED_SECRET
    if (!urls?.length || !secret) return Response.json({ iceServers: [] })
    const username = Math.floor(Date.now() / 1000 + 3600) + ':' + user.id
    const credential = createHmac('sha1', secret).update(username).digest('base64')
    return Response.json({ iceServers: [{ urls, username, credential }] }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const db = chatDb()
  const callId = params.get('callId')
  if (callId && !chatUuid.test(callId)) return Response.json({ error: 'Mã cuộc gọi không hợp lệ' }, { status: 400 })
  const query = db.from('chat_call_invitations').select(callFields)
    .or(`recipient_id.eq.${user.id},caller_id.eq.${user.id}`)
  const { data, error } = await (callId
    ? query.eq('call_id', callId).limit(200)
    : query.eq('recipient_id', user.id).gte('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(50))
  if (error) return Response.json({ error: 'Không thể tải cuộc gọi' }, { status: 503 })
  const [{ data: callers }, { data: groups }] = await Promise.all([
    data.length ? db.from('profiles').select('id, full_name, avatar_url').in('id', [...new Set(data.map((row) => row.caller_id))]) : { data: [] },
    data.some((row) => row.conversation_id)
      ? db.from('chat_conversations').select('id, title').in('id', [...new Set(data.flatMap((row) => row.conversation_id ? [row.conversation_id] : []))])
      : { data: [] },
  ])
  return Response.json({ calls: data.map((row) => {
    const caller = callers?.find((profile) => profile.id === row.caller_id)
    return {
      callId: row.call_id, callerId: row.caller_id, receiverId: row.recipient_id,
      callMode: row.mode, state: row.state, expiresAt: row.expires_at, createdAt: row.created_at, acceptedAt: row.accepted_at,
      callerName: caller?.full_name || 'Bạn bè', callerAvatar: caller?.avatar_url || undefined,
      conversationId: row.conversation_id || (row.recipient_id === user.id ? row.caller_id : row.recipient_id),
      isGroup: Boolean(row.conversation_id),
      groupName: groups?.find((group) => group.id === row.conversation_id)?.title,
    }
  }) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Cần đăng nhập' }, { status: 401 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input.callId !== 'string' || !chatUuid.test(input.callId)) {
    return Response.json({ error: 'Mã cuộc gọi không hợp lệ' }, { status: 400 })
  }
  const { action, callId } = input
  const db = chatDb()
  try {
    if (action === 'invite') {
      const group = input.isGroup === true
      const recipient = typeof input.recipientId === 'string' ? input.recipientId : ''
      const conversation = typeof input.conversationId === 'string' ? input.conversationId : ''
      const audience = await chatAudience(user.id, conversation, group ? undefined : recipient)
      if (!audience.length && !group) {
        return Response.json({ error: 'Hai tài khoản cần kết bạn để gọi cho nhau.' }, { status: 403 })
      }
      let mode = input.callMode === 'video' ? 'video' : 'voice'
      if (group) {
        const { data } = await db.from('chat_call_sessions').select('call_type')
          .eq('id', callId).eq('conversation_id', conversation).eq('initiator_id', user.id)
          .in('status', ['active', 'ringing']).maybeSingle()
        if (!data) return Response.json({ error: 'Cuộc gọi nhóm đã kết thúc' }, { status: 409 })
        mode = data.call_type
      }
      const { data: recent, error: rateError } = await db.from('chat_call_invitations')
        .select('call_id').eq('caller_id', user.id).neq('call_id', callId)
        .gte('created_at', new Date(Date.now() - 60000).toISOString()).limit(1000)
      if (rateError) throw rateError
      if (new Set(recent.map((row) => row.call_id)).size >= 6) return Response.json({ error: 'Bạn vừa gọi nhiều lần. Hãy thử lại sau.' }, { status: 429 })
      if (!audience.length) return Response.json({ ok: true })
      const expiresAt = new Date(Date.now() + 45000).toISOString()
      const { data: inserted, error } = await db.from('chat_call_invitations').upsert(
        audience.map((id) => ({
          call_id: callId, recipient_id: id, caller_id: user.id, mode,
          conversation_id: group ? conversation : null, expires_at: expiresAt,
        })),
        { onConflict: 'call_id,recipient_id', ignoreDuplicates: true },
      ).select('recipient_id')
      if (error) throw error
      after(() => sendChatPush(inserted.map((row) => row.recipient_id), {
        kind: 'call', conversation: group ? conversation : user.id, callId, expiresAt,
      }))
      return Response.json({ ok: true, expiresAt })
    }

    if (action === 'accept' || action === 'decline') {
      const { data, error } = await db.from('chat_call_invitations')
        .update(action === 'accept' ? { state: 'accepted', accepted_at: new Date().toISOString() } : { state: 'declined' })
        .eq('call_id', callId).eq('recipient_id', user.id).eq('state', 'ringing')
        .gt('expires_at', new Date().toISOString()).select('call_id').maybeSingle()
      if (error) throw error
      if (!data) return Response.json({ error: 'Lời mời đã hết hạn hoặc đã được trả lời.' }, { status: 409 })
      return Response.json({ ok: true })
    }
    if (action === 'end') {
      const { error } = await db.from('chat_call_invitations').update({ state: 'ended' })
        .eq('call_id', callId).is('conversation_id', null)
        .or(`caller_id.eq.${user.id},recipient_id.eq.${user.id}`).in('state', ['ringing', 'accepted'])
      if (error) throw error
      return Response.json({ ok: true })
    }
    return Response.json({ error: 'Thao tác không hợp lệ' }, { status: 400 })
  } catch {
    return Response.json({ error: 'Máy chủ thông báo cuộc gọi chưa sẵn sàng.' }, { status: 503 })
  }
}
