import { NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'

/**
 * Quản lý MLS KeyPackages (RFC 9420)
 * POST: Lưu trữ KeyPackage công khai của thiết bị người dùng
 * GET: Lấy KeyPackage của một người dùng theo email hoặc user_id để chuẩn bị mời vào nhóm
 */
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.keyPackageData || !body.deviceId) {
      return NextResponse.json({ error: 'Thiếu keyPackageData hoặc deviceId' }, { status: 400 })
    }

    const { deviceId, keyPackageData, ciphersuite = 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256' } = body

    // Tạo reference hash từ nội dung KeyPackage
    const keyPackageRef = crypto
      .createHash('sha256')
      .update(`${user.id}:${deviceId}:${keyPackageData}`)
      .digest('hex')

    const db = getSupabaseAdmin()

    // Lưu vào chat_mls_key_packages
    const { data, error } = await db
      .from('chat_mls_key_packages')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          key_package_ref: keyPackageRef,
          key_package_data: keyPackageData,
          ciphersuite,
          is_consumed: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'key_package_ref' }
      )
      .select('id, key_package_ref, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, keyPackageRef: data.key_package_ref })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')
    const targetEmail = searchParams.get('email')

    if (!targetUserId && !targetEmail) {
      return NextResponse.json({ error: 'Thiếu userId hoặc email' }, { status: 400 })
    }

    const db = getSupabaseAdmin()
    let resolvedUserId = targetUserId

    if (!resolvedUserId && targetEmail) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('email', targetEmail.trim().toLowerCase())
        .maybeSingle()

      if (!profile) {
        return NextResponse.json({ error: 'Không tìm thấy người dùng với email này' }, { status: 404 })
      }
      resolvedUserId = profile.id
    }

    // Lấy KeyPackage chưa bị tiêu thụ mới nhất của người dùng
    const { data: kp, error } = await db
      .from('chat_mls_key_packages')
      .select('id, user_id, device_id, key_package_ref, key_package_data, ciphersuite, created_at')
      .eq('user_id', resolvedUserId)
      .eq('is_consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !kp) {
      return NextResponse.json({ error: 'Người dùng chưa tạo MLS KeyPackage trên thiết bị của họ' }, { status: 404 })
    }

    return NextResponse.json({ success: true, keyPackage: kp })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 })
  }
}
