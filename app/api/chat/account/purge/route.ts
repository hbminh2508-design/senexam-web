import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { purgeUserChatData, deleteUserFullAccount } from '@/lib/senChatAccountCleanup'

export const dynamic = 'force-dynamic'

/**
 * API Tự xóa dữ liệu chat hoặc tài khoản theo chuẩn GDPR (Right to Erasure)
 * POST /api/chat/account/purge
 * Body: { deleteAccount: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const deleteAccount = body.deleteAccount === true
    const supabaseAdmin = getSupabaseAdmin()

    if (deleteAccount) {
      const result = await deleteUserFullAccount(user.id, supabaseAdmin)
      return NextResponse.json({
        success: true,
        message: 'Đã xóa vĩnh viễn tài khoản và toàn bộ dữ liệu Sen Chat liên quan.',
        cleanup: result,
      })
    }

    // Chỉ xóa dữ liệu trò chuyện E2EE (giữ lại tài khoản)
    const result = await purgeUserChatData(user.id, supabaseAdmin)
    return NextResponse.json({
      success: true,
      message: 'Đã dọn dẹp sạch toàn bộ lịch sử tin nhắn, thiết bị và tệp E2EE.',
      cleanup: result,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi thực hiện xóa dữ liệu' },
      { status: 500 }
    )
  }
}
