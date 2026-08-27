import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { globalOtpStore } from '../send-otp/route'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const { code } = await request.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Vui lòng nhập mã xác minh 6 chữ số' }, { status: 400 })
    }

    const cleanInput = code.trim().replace(/\s+/g, '')
    const record = globalOtpStore[user.id]

    // Kiểm tra OTP
    if (!record) {
      return NextResponse.json({ error: 'Mã xác minh đã hết hạn hoặc chưa được tạo. Vui lòng bấm gửi lại mã.' }, { status: 400 })
    }

    if (Date.now() > record.expiresAt) {
      delete globalOtpStore[user.id]
      return NextResponse.json({ error: 'Mã xác minh đã hết hạn (quá 10 phút). Vui lòng yêu cầu mã mới.' }, { status: 400 })
    }

    if (record.code !== cleanInput) {
      return NextResponse.json({ error: 'Mã xác minh không chính xác. Vui lòng kiểm tra lại email.' }, { status: 400 })
    }

    // Xác minh thành công -> kích hoạt is_beta_tester
    const supabaseAdmin = getSupabaseAdmin()
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        is_beta_tester: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) throw updateErr

    // Xóa OTP sau khi dùng
    delete globalOtpStore[user.id]

    return NextResponse.json({
      success: true,
      message: 'Chúc mừng bạn đã gia nhập Kênh Thử Nghiệm Beta thành công!',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Lỗi xác minh mã OTP' }, { status: 500 })
  }
}
