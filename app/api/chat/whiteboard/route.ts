import { chatDb, chatUuid } from '@/lib/senChatAlertsServer'
import { validBoardItem } from '@/lib/senChatWhiteboard'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

async function boardAccess(request: Request) {
  const user = await getUserFromRequest(request)
  const params = new URL(request.url).searchParams
  const callId = params.get('callId')
  if (!user || !callId || !chatUuid.test(callId)) return null
  const db = chatDb()
  const { data: session } = await db.from('chat_call_sessions')
    .select('conversation_id, expires_at').eq('id', callId).eq('transport_mode', 'sfu')
    .in('status', ['active', 'reconnecting']).maybeSingle()
  if (!session || (session.expires_at && Date.parse(session.expires_at) <= Date.now())) return null
  const [{ data: participant }, { data: member }] = await Promise.all([
    db.from('chat_call_participants').select('user_id').eq('call_id', callId)
      .eq('user_id', user.id).eq('status', 'joined').maybeSingle(),
    db.from('chat_members').select('user_id').eq('conversation_id', session.conversation_id)
      .eq('user_id', user.id).maybeSingle(),
  ])
  return participant && member ? { callId, params, user, db } : null
}

export async function GET(request: Request) {
  const access = await boardAccess(request)
  if (!access) return Response.json({ error: 'Hãy tham gia cuộc gọi để xem bảng trắng.' }, { status: 403 })
  const { callId, params, db } = access
  const at = params.get('at')
  const id = params.get('id')
  const query = db.from('chat_whiteboard_items').select('id, author_id, item, created_at')
    .eq('call_id', callId).order('created_at').order('id').limit(200)
  if (at && id && chatUuid.test(id) && Number.isFinite(Date.parse(at))) {
    const timestamp = new Date(at).toISOString()
    // Preserve the precision of the timestamp returned by Postgres when advancing the cursor.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(\+00:00|Z)$/.test(at)) {
      query.or(`created_at.gt.${at},and(created_at.eq.${at},id.gt.${id})`)
    } else {
      query.gte('created_at', timestamp)
    }
  }
  const { data, error } = await query
  if (error) return Response.json({ error: 'Không thể tải bảng trắng.' }, { status: 503 })
  return Response.json({ entries: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  const callId = new URL(request.url).searchParams.get('callId')
  if (!user || !callId || !chatUuid.test(callId)) {
    return Response.json({ error: 'Hãy tham gia cuộc gọi để dùng bảng trắng.' }, { status: 403 })
  }
  const text = await request.text()
  if (text.length > 85000) return Response.json({ error: 'Nét vẽ quá dài.' }, { status: 413 })
  let input
  try { input = JSON.parse(text) } catch { input = null }
  const { id, item } = input || {}
  if (typeof id !== 'string' || !chatUuid.test(id) || !validBoardItem(item)) {
    return Response.json({ error: 'Nội dung bảng trắng không hợp lệ.' }, { status: 400 })
  }
  if (item.kind === 'undo') {
    if (!chatUuid.test(item.target)) return Response.json({ error: 'Ghi chú không hợp lệ.' }, { status: 400 })
  }
  const { data, error } = await chatDb().rpc('sen_chat_store_whiteboard_item', {
    session_id: callId, author: user.id, item_id: id, content: item,
  })
  if (data === 'ok' && !error) return Response.json({ ok: true })
  if (data === 'forbidden') return Response.json({ error: 'Bạn không thể thực hiện thao tác này trên bảng trắng.' }, { status: 403 })
  if (data === 'rate') return Response.json({ error: 'Hãy đợi một chút rồi tiếp tục.' }, { status: 429 })
  return Response.json({ error: 'Không thể lưu lên bảng trắng.' }, { status: 503 })
}
