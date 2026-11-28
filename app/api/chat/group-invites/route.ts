import { chatDb, chatUuid } from '@/lib/senChatAlertsServer'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Đăng nhập Sen Chat để tiếp tục.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || !['join', 'get', 'configure', 'rotate', 'approve', 'reject'].includes(body.action)) {
    return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 })
  }
  const validId = (value: unknown) => typeof value === 'string' && chatUuid.test(value)
  if (!(body.action === 'join' ? validId(body.token) : validId(body.conversationId)) ||
    (['approve', 'reject'].includes(body.action) && !validId(body.target))) {
    return Response.json({ error: 'Mã lời mời không hợp lệ.' }, { status: 400 })
  }
  const { data, error } = await chatDb().rpc('sen_chat_group_invite', {
    actor: user.id, action: body.action,
    group_id: validId(body.conversationId) ? body.conversationId : null,
    link_token: validId(body.token) ? body.token : null,
    target: validId(body.target) ? body.target : null,
    approval: typeof body.approval === 'boolean' ? body.approval : null,
  })
  if (error || !data) return Response.json({ error: 'Dịch vụ lời mời nhóm chưa sẵn sàng.' }, { status: 503 })
  return Response.json(data, { status: data.error ? 409 : 200, headers: { 'Cache-Control': 'no-store' } })
}
