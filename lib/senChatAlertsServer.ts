import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sendNotification } from 'web-push'

export const chatUuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

export function chatDb() {
  // These chat tables predate the generated application DB types.
  return getSupabaseAdmin() as import('@supabase/supabase-js').SupabaseClient
}

export async function chatAudience(sender: string, conversation: string, recipient?: string) {
  const db = chatDb()
  if (recipient) {
    if (!chatUuid.test(recipient) || recipient === sender) return []
    const { data, error } = await db.from('chat_friendships').select('status').or(
      `and(user_id.eq.${sender},friend_id.eq.${recipient}),and(user_id.eq.${recipient},friend_id.eq.${sender})`
    )
    if (error) throw error
    return data.some((row) => row.status === 'accepted') && !data.some((row) => row.status === 'blocked')
      ? [recipient] : []
  }
  if (!chatUuid.test(conversation)) return []
  const [{ data: group, error }, { data: members, error: membershipError }] = await Promise.all([
    db.from('chat_conversations').select('type').eq('id', conversation).maybeSingle(),
    db.from('chat_members').select('user_id').eq('conversation_id', conversation),
  ])
  if (error || membershipError) throw error || membershipError
  if (group?.type !== 'group' || !members.some((row) => row.user_id === sender)) return []
  return members.map((row) => row.user_id as string).filter((id) => id !== sender)
}

export function webPushConfig() {
  const publicKey = process.env.SEN_CHAT_VAPID_PUBLIC_KEY
  const privateKey = process.env.SEN_CHAT_VAPID_PRIVATE_KEY
  const subject = process.env.SEN_CHAT_VAPID_SUBJECT
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

export async function sendChatPush(
  users: string[],
  notification: { kind: 'call' | 'message'; conversation: string; callId?: string; expiresAt?: string },
) {
  const vapidDetails = webPushConfig()
  if (!vapidDetails || !users.length) return
  const db = chatDb()
  const { data: mutes } = await db.from('chat_notification_mutes').select('user_id')
    .eq('conversation_key', notification.conversation).in('user_id', users)
  const muted = new Set(mutes?.map((row) => row.user_id))
  const audience = users.filter((user) => !muted.has(user))
  if (!audience.length) return
  const { data } = await db.from('chat_web_push_subscriptions')
    .select('endpoint, keys, user_id').in('user_id', audience)
  for (let offset = 0; offset < (data?.length || 0); offset += 25) {
    await Promise.all((data || []).slice(offset, offset + 25).map(async (subscription) => {
      try {
        await sendNotification(
          subscription,
          JSON.stringify({ ...notification, user: subscription.user_id }),
          { vapidDetails, TTL: notification.kind === 'call' ? 45 : 3600, timeout: 4000 },
        )
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from('chat_web_push_subscriptions').delete()
            .eq('endpoint', subscription.endpoint).eq('user_id', subscription.user_id)
        }
      }
    }))
  }
}
