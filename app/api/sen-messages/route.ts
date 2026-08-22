import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const BUCKET = 'sen-messages'
const MAX_FILE_SIZE = 25 * 1024 * 1024
const MESSAGE_TTL_MS = 60 * 1000

let bucketReady = false

async function ensureBucket() {
  if (bucketReady) return
  const admin = getSupabaseAdmin()
  const { data: buckets } = await admin.storage.listBuckets()
  const found = (buckets || []).find((b) => b.name === BUCKET)
  if (!found) {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_FILE_SIZE}`,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    })
  }
  bucketReady = true
}

async function cleanupExpiredMessages() {
  const admin = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - MESSAGE_TTL_MS).toISOString()

  const { data: expiredRows, error: selectError } = await admin
    .from('sen_messages')
    .select('id, attachment_path')
    .lt('created_at', cutoff)

  if (selectError || !expiredRows || expiredRows.length === 0) return

  const attachmentPaths = expiredRows
    .map((row: any) => row.attachment_path)
    .filter((p: string | null) => !!p)

  if (attachmentPaths.length > 0) {
    await ensureBucket()
    await admin.storage.from(BUCKET).remove(attachmentPaths)
  }

  await admin.from('sen_messages').delete().in('id', expiredRows.map((r: any) => r.id))
}

async function mapMessagesWithUrls(rows: any[]) {
  const admin = getSupabaseAdmin()
  await ensureBucket()

  const mapped = await Promise.all(rows.map(async (row) => {
    let attachmentUrl: string | null = null
    if (row.attachment_path) {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(row.attachment_path, 120)
      attachmentUrl = data?.signedUrl || null
    }
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      message: row.message,
      created_at: row.created_at,
      attachment_name: row.attachment_name,
      attachment_size: row.attachment_size,
      attachment_mime: row.attachment_mime,
      attachment_url: attachmentUrl,
    }
  }))

  return mapped
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    await cleanupExpiredMessages()

    const { data, error } = await getSupabaseAdmin()
      .from('sen_messages')
      .select('id, user_id, user_name, message, created_at, attachment_path, attachment_name, attachment_size, attachment_mime')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    const messages = await mapMessagesWithUrls(data || [])
    return NextResponse.json({ messages })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Không thể tải tin nhắn' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    await cleanupExpiredMessages()

    const formData = await request.formData()
    const rawMessage = (formData.get('message') || '').toString()
    const message = rawMessage.trim().slice(0, 2000)
    const file = formData.get('file') as File | null

    if (!message && !file) {
      return NextResponse.json({ error: 'Tin nhắn trống' }, { status: 400 })
    }

    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Tệp vượt quá giới hạn 25MB' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    let attachmentPath: string | null = null
    let attachmentName: string | null = null
    let attachmentSize: number | null = null
    let attachmentMime: string | null = null

    if (file && file.size > 0) {
      await ensureBucket()
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploadRes = await admin.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (uploadRes.error) throw uploadRes.error

      attachmentPath = path
      attachmentName = file.name
      attachmentSize = file.size
      attachmentMime = file.type || 'application/octet-stream'
    }

    const { data: inserted, error } = await admin
      .from('sen_messages')
      .insert({
        user_id: user.id,
        user_name: profile?.full_name || 'Người dùng SenExam',
        message,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        attachment_mime: attachmentMime,
      })
      .select('id, user_id, user_name, message, created_at, attachment_path, attachment_name, attachment_size, attachment_mime')
      .single()

    if (error) throw error

    const messages = await mapMessagesWithUrls([inserted])
    return NextResponse.json({ message: messages[0] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Không thể gửi tin nhắn' }, { status: 500 })
  }
}
