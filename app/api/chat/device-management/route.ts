import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
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
    const deviceId = body?.deviceId

    if (!deviceId) {
      return NextResponse.json({ error: 'Thiếu deviceId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.rpc('revoke_chat_device', {
      p_device_id: deviceId,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi đăng xuất thiết bị' }, { status: 500 })
  }
}
