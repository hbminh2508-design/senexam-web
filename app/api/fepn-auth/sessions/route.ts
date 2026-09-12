import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Fallback in-memory session store nếu database table chưa tạo
interface SessionRecord {
  id: string
  user_id: string
  device_id: string
  device_name: string
  device_type: string
  browser: string
  os: string
  ip_address: string
  is_active: boolean
  last_active_at: string
  created_at: string
}

const memorySessionsStore = new Map<string, SessionRecord[]>()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, userId, deviceId, currentDeviceId, sessionId, deviceName, deviceType, browser, os } = body

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    // 1. GHI NHẬN PHIÊN ĐĂNG NHẬP (RECORD)
    if (action === 'record') {
      if (!userId || !deviceId) {
        return NextResponse.json({ error: 'Thiếu userId hoặc deviceId' }, { status: 400 })
      }

      const cleanDeviceName = deviceName || 'Thiết bị không xác định'
      const cleanType = deviceType || 'desktop'
      const nowIso = new Date().toISOString()

      const recordItem: SessionRecord = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId,
        device_id: deviceId,
        device_name: cleanDeviceName,
        device_type: cleanType,
        browser: browser || 'Trình duyệt Web',
        os: os || 'Hệ điều hành',
        ip_address: ip,
        is_active: true,
        last_active_at: nowIso,
        created_at: nowIso,
      }

      // Lưu vào memory store
      const userSessions = memorySessionsStore.get(userId) || []
      const existingIdx = userSessions.findIndex((s) => s.device_id === deviceId)
      if (existingIdx >= 0) {
        userSessions[existingIdx] = {
          ...userSessions[existingIdx],
          device_name: cleanDeviceName,
          device_type: cleanType,
          browser: browser || userSessions[existingIdx].browser,
          os: os || userSessions[existingIdx].os,
          ip_address: ip,
          is_active: true,
          last_active_at: nowIso,
        }
      } else {
        userSessions.unshift(recordItem)
      }
      memorySessionsStore.set(userId, userSessions)

      // Cố gắng lưu vào database Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin.from('fepn_user_sessions').upsert(
          {
            user_id: userId,
            device_id: deviceId,
            device_name: cleanDeviceName,
            device_type: cleanType,
            browser: browser || 'Trình duyệt',
            os: os || 'Hệ điều hành',
            ip_address: ip,
            is_active: true,
            last_active_at: nowIso,
            created_at: nowIso,
          },
          { onConflict: 'user_id,device_id' }
        )
      } catch (err) {
        console.warn('Lưu session Supabase:', err)
      }

      return NextResponse.json({ success: true, session: recordItem })
    }

    // 2. LẤY DANH SÁCH THIẾT BỊ & LỊCH SỬ 15 NGÀY (LIST)
    if (action === 'list') {
      if (!userId) {
        return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })
      }

      let allSessions: SessionRecord[] = memorySessionsStore.get(userId) || []

      // Lấy từ Supabase Database nếu có
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabaseAdmin
          .from('fepn_user_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', fifteenDaysAgo)
          .order('last_active_at', { ascending: false })

        if (!error && data && data.length > 0) {
          allSessions = data
          memorySessionsStore.set(userId, data)
        }
      } catch (e) {}

      // Lọc danh sách đang hoạt động và lịch sử 15 ngày
      const fifteenDaysAgoMs = Date.now() - 15 * 24 * 60 * 60 * 1000
      const recentHistory = allSessions.filter((s) => new Date(s.created_at).getTime() >= fifteenDaysAgoMs)
      const activeSessions = allSessions.filter((s) => s.is_active)

      return NextResponse.json({
        success: true,
        totalActiveCount: activeSessions.length,
        activeSessions: activeSessions.map((s) => ({
          ...s,
          isCurrentDevice: s.device_id === currentDeviceId,
        })),
        recentHistory: recentHistory.map((s) => ({
          ...s,
          isCurrentDevice: s.device_id === currentDeviceId,
        })),
      })
    }

    // 3. ĐĂNG XUẤT 1 THIẾT BỊ CỤ THỂ (REVOKE)
    if (action === 'revoke') {
      if (!userId || !sessionId) {
        return NextResponse.json({ error: 'Thiếu userId hoặc sessionId' }, { status: 400 })
      }

      const userSessions = memorySessionsStore.get(userId) || []
      const updated = userSessions.map((s) => (s.id === sessionId || s.device_id === sessionId ? { ...s, is_active: false } : s))
      memorySessionsStore.set(userId, updated)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_user_sessions')
          .update({ is_active: false })
          .or(`id.eq.${sessionId},device_id.eq.${sessionId}`)
          .eq('user_id', userId)
      } catch (err) {
        console.warn('Thu hồi session Supabase:', err)
      }

      return NextResponse.json({ success: true, revokedId: sessionId })
    }

    // 4. ĐĂNG XUẤT TẤT CẢ CÁC THIẾT BỊ KHÁC (REVOKE OTHERS)
    if (action === 'revoke_others') {
      if (!userId || !currentDeviceId) {
        return NextResponse.json({ error: 'Thiếu userId hoặc currentDeviceId' }, { status: 400 })
      }

      const userSessions = memorySessionsStore.get(userId) || []
      const updated = userSessions.map((s) => (s.device_id === currentDeviceId ? s : { ...s, is_active: false }))
      memorySessionsStore.set(userId, updated)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_user_sessions')
          .update({ is_active: false })
          .eq('user_id', userId)
          .neq('device_id', currentDeviceId)
      } catch (err) {
        console.warn('Thu hồi sessions khác:', err)
      }

      return NextResponse.json({ success: true, message: 'Đã đăng xuất khỏi tất cả các thiết bị khác!' })
    }

    // 5. KIỂM TRA THIẾT BỊ HIỆN TẠI CÓ CÒN ACTIVE KHÔNG (CHECK ACTIVE)
    if (action === 'check_active') {
      if (!userId || !deviceId) {
        return NextResponse.json({ isActive: true })
      }

      let isActive = true
      const userSessions = memorySessionsStore.get(userId) || []
      const current = userSessions.find((s) => s.device_id === deviceId)
      if (current) {
        isActive = current.is_active
      }

      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_user_sessions')
          .select('is_active')
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .maybeSingle()

        if (data) {
          isActive = data.is_active
        }
      } catch (e) {}

      return NextResponse.json({ isActive })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi sessions route:', err)
    return NextResponse.json({ error: err.message || 'Lỗi quản lý phiên thiết bị' }, { status: 500 })
  }
}
