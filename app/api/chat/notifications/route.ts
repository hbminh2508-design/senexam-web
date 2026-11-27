import { chatDb, chatUuid, webPushConfig } from '@/lib/senChatAlertsServer'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
      url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com')
    )
  } catch { return false }
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Cần đăng nhập' }, { status: 401 })
  if (new URL(request.url).searchParams.has('mutes')) {
    const { data, error } = await chatDb().from('chat_notification_mutes').select('conversation_key').eq('user_id', user.id)
    if (error) return Response.json({ error: 'Không thể tải cài đặt thông báo.' }, { status: 503 })
    return Response.json({ mutes: data.map((row) => row.conversation_key) })
  }
  const config = webPushConfig()
  return config
    ? Response.json({ publicKey: config.publicKey })
    : Response.json({ error: 'Máy chủ chưa bật thông báo trình duyệt.' }, { status: 503 })
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Cần đăng nhập' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const db = chatDb()
  if (body?.action === 'subscribe') {
    const { endpoint, keys } = body.subscription || {}
    if (!validEndpoint(endpoint) || !/^[\w-]{87}$/.test(keys?.p256dh || '') || !/^[\w-]{22}$/.test(keys?.auth || '')) {
      return Response.json({ error: 'Đăng ký thiết bị không hợp lệ.' }, { status: 400 })
    }
    const { error } = await db.from('chat_web_push_subscriptions').upsert({
      endpoint, user_id: user.id, keys: { p256dh: keys.p256dh, auth: keys.auth }, updated_at: new Date().toISOString(),
    })
    if (!error) return Response.json({ ok: true })
  }
  if (body?.action === 'mute' && typeof body.conversation === 'string' && chatUuid.test(body.conversation)) {
    const key = { user_id: user.id, conversation_key: body.conversation }
    const { error } = await (body.muted === true
      ? db.from('chat_notification_mutes').upsert(key)
      : db.from('chat_notification_mutes').delete().match(key))
    if (!error) return Response.json({ ok: true })
  }
  return Response.json({ error: 'Không thể cập nhật cài đặt thông báo.' }, { status: 400 })
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return Response.json({ error: 'Cần đăng nhập' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!validEndpoint(body?.endpoint)) return Response.json({ error: 'Thiết bị không hợp lệ.' }, { status: 400 })
  const { error } = await chatDb().from('chat_web_push_subscriptions').delete()
    .eq('endpoint', body.endpoint).eq('user_id', user.id)
  return error ? Response.json({ error: 'Không thể tắt thông báo.' }, { status: 503 }) : Response.json({ ok: true })
}
