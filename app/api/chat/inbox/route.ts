import { after } from 'next/server'
import { chatAudience, chatDb, chatUuid, sendChatPush } from '@/lib/senChatAlertsServer'
import { getUserFromRequest } from '@/lib/supabaseAdmin'

const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value)
const base64 = (value: unknown, min: number, max = min): value is string => typeof value === 'string' &&
  value.length >= min && value.length <= max && /^[A-Za-z0-9+/_=-]+$/.test(value)
const validKey = (key: JsonWebKey | undefined): key is JsonWebKey => Boolean(
  key?.kty === 'EC' && key.crv === 'P-256' && base64(key.x, 43) && base64(key.y, 43) && !key.d,
)
const publicKey = (key: JsonWebKey) => ({ kty: key.kty, crv: key.crv, x: key.x, y: key.y })
const fail = (error: string, status: number) => Response.json({ error }, { status })

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return fail('Cần đăng nhập', 401)
  const device = new URL(request.url).searchParams.get('device')
  if (!device || !chatUuid.test(device)) return fail('Thiết bị không hợp lệ.', 400)
  const { data, error } = await chatDb().from('chat_inbox_deliveries')
    .select('sender_id, message_id, wrapped_key, wrap_iv, chat_inbox_messages!inner(group_id,ciphertext,iv,ephemeral_key,created_at)')
    .eq('user_id', user.id).eq('device_id', device).is('delivered_at', null)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at').limit(30)
  if (error) return fail('Không thể tải tin nhắn mới.', 503)
  return Response.json({ deliveries: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return fail('Cần đăng nhập', 401)
  const raw = await request.text()
  if (raw.length > 1200000) return fail('Tin nhắn quá lớn.', 413)
  let body
  try { body = JSON.parse(raw) } catch { return fail('Yêu cầu không hợp lệ.', 400) }
  const db = chatDb()
  try {
    if (body?.action === 'register') {
      if (typeof body.device !== 'string' || !chatUuid.test(body.device) || !validKey(body.key)) {
        return fail('Khóa thiết bị không hợp lệ.', 400)
      }
      const { count, error: countError } = await db.from('chat_inbox_devices').select('device_id', { count: 'exact', head: true })
        .eq('user_id', user.id).neq('device_id', body.device).gte('updated_at', new Date(Date.now() - 90 * 86400000).toISOString())
      if (countError) throw countError
      if ((count ?? 0) >= 20) return fail('Tài khoản đã có quá nhiều thiết bị nhận tin.', 409)
      const { error } = await db.from('chat_inbox_devices').upsert({
        user_id: user.id, device_id: body.device, public_key: publicKey(body.key), updated_at: new Date().toISOString(),
      })
      if (error) throw error
      return Response.json({ ok: true })
    }

    if (body?.action === 'ack') {
      if (typeof body.device !== 'string' || !chatUuid.test(body.device) || !Array.isArray(body.receipts) || body.receipts.length > 30) {
        return fail('Thiết bị không hợp lệ.', 400)
      }
      await Promise.all(body.receipts.map(async (entry: { sender?: string; id?: string }) => {
        if (!entry.sender || !chatUuid.test(entry.sender) || !validId(entry.id)) return
        const { error } = await db.from('chat_inbox_deliveries').update({ delivered_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('device_id', body.device).eq('sender_id', entry.sender).eq('message_id', entry.id)
        if (error) throw error
      }))
      return Response.json({ ok: true })
    }

    if (body?.action !== 'keys' && body?.action !== 'send') return fail('Yêu cầu không hợp lệ.', 400)
    const group = typeof body.group === 'string' && chatUuid.test(body.group) ? body.group : null
    const recipient = typeof body.recipient === 'string' && chatUuid.test(body.recipient) ? body.recipient : null
    if (Boolean(group) === Boolean(recipient)) return fail('Hội thoại không hợp lệ.', 400)
    const audience = await chatAudience(user.id, group || '', recipient || undefined)
    if (!audience.length) return fail('Bạn chưa có quyền gửi tin vào hội thoại này.', 403)

    const { data: devices, error: deviceError } = await db.from('chat_inbox_devices')
      .select('user_id,device_id,public_key').in('user_id', audience)
      .gte('updated_at', new Date(Date.now() - 90 * 86400000).toISOString()).limit(4000)
    if (deviceError) throw deviceError
    if (body.action === 'keys') return Response.json({ devices })

    if (!validId(body.id) || !base64(body.ciphertext, 24, 160000) || !base64(body.iv, 16) ||
      !validKey(body.ephemeral) || !Array.isArray(body.wraps) || body.wraps.length > 4000) {
      return fail('Dữ liệu tin nhắn không hợp lệ.', 400)
    }
    const { data: existing, error: existingError } = await db.from('chat_inbox_messages').select('message_id')
      .eq('sender_id', user.id).eq('message_id', body.id).maybeSingle()
    if (existingError) throw existingError
    if (existing) return Response.json({ ok: true })
    const { count, error: rateError } = await db.from('chat_inbox_messages').select('message_id', { count: 'exact', head: true })
      .eq('sender_id', user.id).gte('created_at', new Date(Date.now() - 60000).toISOString())
    if (rateError) throw rateError
    if ((count ?? 0) >= 90) return fail('Bạn gửi quá nhanh. Hãy thử lại sau.', 429)
    const validDevices = new Set(devices.map((device) => device.user_id + ':' + device.device_id))
    const wraps = body.wraps.filter((entry: Record<string, unknown>) => entry && validDevices.has(entry.user_id + ':' + entry.device_id) &&
      base64(entry.wrapped_key, 64) && base64(entry.wrap_iv, 16))
    if (!wraps.length) return fail('Người nhận cần mở Sen Chat một lần để kích hoạt thiết bị nhận tin.', 409)
    const { data: delivered, error: sendError } = await db.rpc('sen_chat_deliver_encrypted', {
      sender: user.id, message: body.id, group_id: group, encrypted: body.ciphertext,
      nonce: body.iv, ephemeral: publicKey(body.ephemeral), deliveries: wraps,
    })
    if (sendError) throw sendError
    if (Array.isArray(delivered) && delivered.length) {
      after(() => sendChatPush(delivered, { kind: 'message', conversation: group || user.id }))
    }
    return Response.json({ ok: true })
  } catch {
    return fail('Máy chủ tin nhắn chưa sẵn sàng. Hãy thử lại.', 503)
  }
}
