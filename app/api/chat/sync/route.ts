import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { supabase as publicSupabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'

function getDb() {
  try {
    return getSupabaseAdmin()
  } catch (e) {
    return publicSupabase
  }
}

// In-Memory Fallback Store (Hàng đợi bộ nhớ tạm trong trường hợp bảng Supabase đang tạo hoặc migration)
interface MemoryQueueItem {
  id: string
  sender_id: string
  sender_name: string
  receiver_id: string
  device_id: string
  payload: any
  sync_type: string
  created_at: number
}

const memorySyncQueue: MemoryQueueItem[] = []

async function fetchUserConversationsFromDb(db: any, userId: string) {
  const { data: memberships, error } = await db
    .from('chat_members')
    .select(
      'role, joined_at, chat_conversations:conversation_id(id, type, title, avatar_url, mls_group_id, mls_epoch, updated_at, created_at)'
    )
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return (memberships || [])
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
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'sync_conversations'

    if (action === 'sync_conversations') {
      const user = await getUserFromRequest(request)
      if (!user) {
        return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
      }
      const db = getDb()
      const conversations = await fetchUserConversationsFromDb(db, user.id)
      return NextResponse.json({ success: true, conversations })
    }

    // 6.5 ĐỒNG BỘ DANH SÁCH NHÓM & HỘI THOẠI TỪ SUPABASE (sync_conversations)
    if (action === 'sync_conversations') {
      const user = await getUserFromRequest(request)
      if (!user) {
        return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
      }
      const conversations = await fetchUserConversationsFromDb(db, user.id)
      return NextResponse.json({
        success: true,
        conversations,
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi máy chủ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const { action = 'pull', receiverId, senderId, senderName, deviceId, message, query, payload, syncCode } = body
    const db = getDb()

    // 1. TÌM KIẾM BẠN BÈ / ĐỐI TÁC TRÒ CHUYỆN (Qua SĐT, Gmail, hoặc Họ tên)
    if (action === 'search_user') {
      const q = (query || '').toString().trim()
      if (!q || q.length < 2) {
        return NextResponse.json({ users: [] })
      }

      try {
        const { data: users, error } = await db
          .from('profiles')
          .select('id, full_name, email, phone_number, phone, avatar_url, school, class_name')
          .or(`email.ilike.%${q}%,phone_number.ilike.%${q}%,phone.ilike.%${q}%,full_name.ilike.%${q}%`)
          .limit(10)

        if (!error && users) {
          const formatted = users.map((u: any) => ({
            id: u.id,
            name: u.full_name || 'Người dùng',
            email: u.email || '',
            phone: u.phone_number || u.phone || '',
            identifier: u.phone_number || u.phone || u.email || u.id,
            avatar: u.avatar_url || '',
            school: u.school || '',
            className: u.class_name || '',
          }))
          return NextResponse.json({ users: formatted })
        }
      } catch (searchErr) {
        console.warn('Lỗi tìm kiếm user qua profiles:', searchErr)
      }

      return NextResponse.json({ users: [] })
    }

    // 2. GỬI TIN NHẮN VÀO HÀNG ĐỢI ĐỒNG BỘ TẠM THỜI (Send to Transit Queue)
    if (action === 'send') {
      if (!receiverId || !message) {
        return NextResponse.json({ error: 'Thiếu receiverId hoặc message' }, { status: 400 })
      }

      const syncItem = {
        sender_id: String(senderId || 'anon'),
        sender_name: String(senderName || 'Người gửi'),
        receiver_id: String(receiverId).trim().toLowerCase(),
        device_id: String(deviceId || 'dev_unknown'),
        payload: message,
        sync_type: 'message',
        created_at: new Date().toISOString(),
      }

      let insertedInDb = false
      try {
        const { error } = await db.from('chat_transit_queue').insert(syncItem)
        if (!error) {
          insertedInDb = true
        }
      } catch (dbErr) {
        // Fallback sang memory store
      }

      if (!insertedInDb) {
        memorySyncQueue.push({
          id: message.id || 'mem_' + Date.now() + '_' + Math.random(),
          sender_id: syncItem.sender_id,
          sender_name: syncItem.sender_name,
          receiver_id: syncItem.receiver_id,
          device_id: syncItem.device_id,
          payload: syncItem.payload,
          sync_type: syncItem.sync_type,
          created_at: Date.now(),
        })

        // Giữ in-memory queue dưới 1000 items để tiết kiệm RAM
        if (memorySyncQueue.length > 1000) {
          memorySyncQueue.splice(0, 200)
        }
      }

      return NextResponse.json({
        success: true,
        messageId: message.id,
        storedIn: insertedInDb ? 'database_queue' : 'memory_queue',
      })
    }

    // 3. THIẾT BỊ KÉO TIN NHẮN VỀ MÁY & XOÁ NGAY TỨC THÌ TRÊN MÁY CHỦ (Pull & Purge Immediately)
    if (action === 'pull') {
      if (!receiverId) {
        return NextResponse.json({ messages: [] })
      }

      const normReceiver = String(receiverId).trim().toLowerCase()
      const pulledMessages: any[] = []

      // 3.1 Kéo từ Supabase Database Table & Xóa Ngay Lập Tức
      try {
        const { data: rows, error } = await db
          .from('chat_transit_queue')
          .select('id, sender_id, sender_name, payload, sync_type, created_at')
          .eq('receiver_id', normReceiver)
          .order('created_at', { ascending: true })

        if (!error && rows && rows.length > 0) {
          const idsToDelete = rows.map((r: any) => r.id)

          // 🚨 BƯỚC QUYẾT ĐỊNH: XÓA NGAY LẬP TỨC TRÊN SERVER ĐỂ KHÔNG BỊ ĐẦY DUNG LƯỢNG
          await db.from('chat_transit_queue').delete().in('id', idsToDelete)

          rows.forEach((r: any) => {
            pulledMessages.push({
              ...(r.payload || {}),
              id: r.payload?.id || r.id,
              senderId: r.sender_id,
              senderName: r.sender_name,
              syncType: r.sync_type,
              serverTimestamp: r.created_at,
            })
          })
        }
      } catch (dbErr) {
        // Fallback sang memory
      }

      // 3.2 Kéo từ In-Memory Store & Xóa Ngay
      for (let i = memorySyncQueue.length - 1; i >= 0; i--) {
        const item = memorySyncQueue[i]
        if (item.receiver_id === normReceiver) {
          pulledMessages.push({
            ...(item.payload || {}),
            id: item.payload?.id || item.id,
            senderId: item.sender_id,
            senderName: item.sender_name,
            syncType: item.sync_type,
            serverTimestamp: new Date(item.created_at).toISOString(),
          })
          memorySyncQueue.splice(i, 1) // Xóa ngay khỏi memory
        }
      }

      return NextResponse.json({
        success: true,
        count: pulledMessages.length,
        messages: pulledMessages,
        serverCleared: true, // Xác nhận server đã xóa sạch
      })
    }

    // 4. ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ THIẾT BỊ NÀY SANG THIẾT BỊ KHÁC (Device-to-Device Full Sync)
    if (action === 'push_backup') {
      if (!payload || !senderId) {
        return NextResponse.json({ error: 'Thiếu dữ liệu sao lưu' }, { status: 400 })
      }

      const code = syncCode || Math.floor(100000 + Math.random() * 900000).toString()
      const syncKey = `backup_${senderId}_${code}`.toLowerCase()

      try {
        await db.from('chat_transit_queue').insert({
          sender_id: String(senderId),
          sender_name: String(senderName || 'Thiết bị nguồn'),
          receiver_id: syncKey,
          device_id: String(deviceId || 'dev_source'),
          payload: payload,
          sync_type: 'history_bundle',
          created_at: new Date().toISOString(),
        })
      } catch (e) {
        memorySyncQueue.push({
          id: 'bundle_' + code,
          sender_id: String(senderId),
          sender_name: String(senderName || 'Thiết bị nguồn'),
          receiver_id: syncKey,
          device_id: String(deviceId || 'dev_source'),
          payload: payload,
          sync_type: 'history_bundle',
          created_at: Date.now(),
        })
      }

      return NextResponse.json({
        success: true,
        syncCode: code,
        message: 'Gói dữ liệu đã sẵn sàng trên hàng đợi tạm. Hãy nhập mã này trên thiết bị mới.',
      })
    }

    if (action === 'pull_backup') {
      if (!syncCode || !receiverId) {
        return NextResponse.json({ error: 'Thiếu syncCode hoặc receiverId' }, { status: 400 })
      }

      const syncKey = `backup_${receiverId}_${syncCode}`.toLowerCase()
      let backupPayload: any = null

      try {
        const { data: rows } = await db
          .from('chat_transit_queue')
          .select('id, payload')
          .eq('receiver_id', syncKey)
          .limit(1)

        if (rows && rows.length > 0) {
          backupPayload = rows[0].payload
          // 🚨 XÓA NGAY LẬP TỨC GÓI SAO LƯU TRÊN SERVER
          await db.from('chat_transit_queue').delete().eq('id', rows[0].id)
        }
      } catch (e) {}

      if (!backupPayload) {
        const memIdx = memorySyncQueue.findIndex((item) => item.receiver_id === syncKey)
        if (memIdx >= 0) {
          backupPayload = memorySyncQueue[memIdx].payload
          memorySyncQueue.splice(memIdx, 1) // Xóa ngay
        }
      }

      if (!backupPayload) {
        return NextResponse.json({ error: 'Mã đồng bộ không chính xác hoặc đã hết hạn.' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        payload: backupPayload,
        message: 'Đồng bộ hoàn tất! Gói dữ liệu trên máy chủ đã được dọn sạch hoàn toàn.',
      })
    }

    // 5. TRUNG CHUYỂN TỆP (File Transit Relay) & PHÂN CHIA LUỒNG (Stream Dispatching)
    if (action === 'relay_stream') {
      const { streamTicket, fileMetadata, relayNodeId, targetDeviceId } = body
      const ticket = streamTicket || `stream_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const relayItem = {
        sender_id: String(senderId || relayNodeId || 'dev_node'),
        sender_name: String(senderName || 'Thiết bị trung gian'),
        receiver_id: String(targetDeviceId || receiverId || 'all_devices').toLowerCase(),
        device_id: String(deviceId || relayNodeId || 'dev_relay'),
        payload: { streamTicket: ticket, fileMetadata, relayNodeId, targetDeviceId, timestamp: Date.now() },
        sync_type: 'relay_stream',
        created_at: new Date().toISOString(),
      }

      let storedInDb = false
      try {
        const { error } = await db.from('chat_transit_queue').insert(relayItem)
        if (!error) storedInDb = true
      } catch (e) {}

      if (!storedInDb) {
        memorySyncQueue.push({
          id: ticket,
          ...relayItem,
          created_at: Date.now(),
        })
      }

      return NextResponse.json({
        success: true,
        streamTicket: ticket,
        dispatched: true,
        storedIn: storedInDb ? 'database_queue' : 'memory_queue',
        message: 'Đã thiết lập kênh phân chia luồng trung chuyển tệp thành công',
      })
    }

    // 6. ĐỒNG BỘ TIN NHẮN CHUẨN XÁC (Message Reconciliation Sync via Server)
    if (action === 'sync_messages') {
      const { conversationId, messages: newMessages, lastSyncTime } = body
      const syncedCount = Array.isArray(newMessages) ? newMessages.length : 0

      if (syncedCount > 0) {
        const syncItem = {
          sender_id: String(senderId || 'anon'),
          sender_name: String(senderName || 'Device Node'),
          receiver_id: String(receiverId || senderId || 'all_devices').toLowerCase(),
          device_id: String(deviceId || 'dev_node'),
          payload: { conversationId, messages: newMessages, lastSyncTime },
          sync_type: 'message_sync',
          created_at: new Date().toISOString(),
        }
        try {
          await db.from('chat_transit_queue').insert(syncItem)
        } catch (e) {
          memorySyncQueue.push({
            id: 'sync_' + Date.now(),
            ...syncItem,
            created_at: Date.now(),
          })
        }
      }

      return NextResponse.json({
        success: true,
        syncedCount,
        serverTimestamp: new Date().toISOString(),
        message: 'Đã đồng bộ phân chia luồng tin nhắn chuẩn xác về máy chủ trung gian',
      })
    }

    // 6.5 ĐỒNG BỘ DANH SÁCH NHÓM & HỘI THOẠI TỪ SUPABASE (sync_conversations)
    if (action === 'sync_conversations') {
      const user = await getUserFromRequest(request)
      if (!user) {
        return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
      }
      const conversations = await fetchUserConversationsFromDb(db, user.id)
      return NextResponse.json({
        success: true,
        conversations,
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    console.error('Lỗi Sen Chat Sync Queue Route:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi máy chủ' }, { status: 500 })
  }
}
