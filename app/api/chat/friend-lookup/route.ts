import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const email = (body?.email || '').toString().trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        success: false,
        found: false,
        message: 'Vui lòng nhập địa chỉ email hợp lệ',
      })
    }

    // 1. Kiểm tra nếu người dùng nhập email của chính mình
    if (user.email && user.email.toLowerCase().trim() === email) {
      return NextResponse.json({
        success: false,
        found: false,
        is_self: true,
        message: 'Đây là email tài khoản của chính bạn.',
      })
    }

    // 2. Tính toán SHA-256 hash của email (Constant-time matching)
    const emailHash = crypto.createHash('sha256').update(email).digest('hex')

    // 3. Gọi Stored Procedure nguyên tử bảo mật
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.rpc('lookup_user_by_email_hash', {
      p_email_hash: emailHash,
      p_caller_id: user.id,
    })

    if (error) {
      console.error('Lỗi lookup_user_by_email_hash:', error)
      return NextResponse.json({
        success: false,
        found: false,
        message: 'Không tìm thấy người dùng phù hợp',
      })
    }

    // 4. Trả về kết quả an toàn (không bao giờ lộ email thô của người dùng khác)
    return NextResponse.json(data || { success: false, found: false, message: 'Không tìm thấy người dùng phù hợp' })
  } catch (err: any) {
    console.error('Friend lookup route error:', err)
    return NextResponse.json({
      success: false,
      found: false,
      message: 'Không tìm thấy người dùng phù hợp',
    })
  }
}
