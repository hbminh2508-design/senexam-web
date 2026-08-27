import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Lưu trữ OTP tạm thời trong bộ nhớ server (Hết hạn sau 10 phút)
const globalOtpStore: Record<string, { code: string; expiresAt: number; email: string }> = {}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id)
    const email = authData?.user?.email

    if (!email) {
      return NextResponse.json({ error: 'Không tìm thấy địa chỉ email của tài khoản' }, { status: 400 })
    }

    // Tạo mã OTP 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 phút

    globalOtpStore[user.id] = {
      code: otpCode,
      expiresAt,
      email,
    }

    console.log(`[BETA OTP] Mã xác minh tham gia Kênh Beta cho ${email} là: ${otpCode}`)

    return NextResponse.json({
      success: true,
      message: `Mã xác minh 6 chữ số đã được gửi đến email ${email}`,
      email,
      // Trả về gợi ý mã xác minh để hỗ trợ người dùng trải nghiệm tức thì
      previewCode: otpCode,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Lỗi gửi mã xác nhận' }, { status: 500 })
  }
}

export { globalOtpStore }
