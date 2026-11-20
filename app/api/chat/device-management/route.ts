import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function detectPlatformAndName(userAgent: string): { platform: 'web' | 'android' | 'ios' | 'desktop'; deviceName: string } {
  const ua = userAgent || ''
  let platform: 'web' | 'android' | 'ios' | 'desktop' = 'web'
  let osName = 'Thiết bị Web'
  let browserName = 'Trình duyệt'

  if (/Android/i.test(ua)) {
    platform = 'android'
    osName = 'Android'
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    platform = 'ios'
    osName = 'iOS'
  } else if (/Windows/i.test(ua)) {
    platform = 'desktop'
    osName = 'Windows PC'
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = 'desktop'
    osName = 'macOS'
  } else if (/Linux/i.test(ua)) {
    platform = 'desktop'
    osName = 'Linux'
  }

  if (/Edg\//i.test(ua)) {
    browserName = 'Edge'
  } else if (/Chrome\//i.test(ua)) {
    browserName = 'Chrome'
  } else if (/Firefox\//i.test(ua)) {
    browserName = 'Firefox'
  } else if (/Safari\//i.test(ua)) {
    browserName = 'Safari'
  }

  const deviceName = `${osName} (${browserName})`
  return { platform, deviceName }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const currentDeviceId = request.nextUrl.searchParams.get('currentDeviceId')
    const supabaseAdmin = getSupabaseAdmin()

    // Cập nhật thời điểm hoạt động nếu có currentDeviceId
    if (currentDeviceId) {
      await supabaseAdmin
        .from('chat_devices')
        .update({ last_seen_at: new Date().toISOString(), is_active: true })
        .eq('user_id', user.id)
        .eq('device_id', currentDeviceId)
    }

    const { data: devices, error } = await supabaseAdmin
      .from('chat_devices')
      .select('id, device_id, device_name, platform, is_active, last_seen_at, created_at')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ devices: devices || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi lấy danh sách thiết bị' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const action = body?.action || (body?.deviceId && !body?.identityKey && !body?.isRegistration ? 'revoke' : 'register')
    const deviceId = body?.deviceId

    if (!deviceId) {
      return NextResponse.json({ error: 'Thiếu deviceId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    if (action === 'revoke') {
      const { data, error } = await supabaseAdmin.rpc('revoke_chat_device', {
        p_device_id: deviceId,
      })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data || { success: true })
    }

    // Hành động: Đăng ký thiết bị hiện tại (Register / Upsert)
    const ua = request.headers.get('user-agent') || ''
    const detected = detectPlatformAndName(ua)
    const platform = body?.platform || detected.platform
    const deviceName = body?.deviceName || detected.deviceName
    const identityKey = body?.identityKey || `ik_${user.id}_${deviceId}`
    const registrationId = Number(body?.registrationId) || (Math.floor(Math.random() * 16380) + 1)

    const { data: device, error: upsertErr } = await supabaseAdmin
      .from('chat_devices')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          device_name: deviceName,
          platform,
          identity_key: identityKey,
          registration_id: registrationId,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' }
      )
      .select('id, device_id, device_name, platform, is_active, last_seen_at, created_at')
      .single()

    if (upsertErr) {
      console.error('Lỗi đăng ký thiết bị chat_devices:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // Ghi nhận sự kiện kiểm toán an ninh (chat_audit_events)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    await supabaseAdmin.from('chat_audit_events').insert({
      user_id: user.id,
      event_type: 'device_registered',
      details: {
        device_id: deviceId,
        device_name: deviceName,
        platform,
        user_agent: ua,
      },
      ip_address: ip,
    })

    return NextResponse.json({ success: true, device, message: 'Đăng ký thiết bị thành công' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi thao tác thiết bị' }, { status: 500 })
  }
}
