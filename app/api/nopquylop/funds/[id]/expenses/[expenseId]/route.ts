import { NextResponse } from 'next/server'
import {
  deleteExpenseFromFund,
  getFundById,
  isValidAdminDailyPassword,
  isAuthorizedAdminOrTreasurer,
} from '@/lib/nopQuyLopStore'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: fundId, expenseId } = await params
    const body = await request.json().catch(() => ({}))
    const { adminUsername, adminPassword, adminPasscode } = body

    const fund = await getFundById(fundId)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }

    const isAuth = isAuthorizedAdminOrTreasurer(fund, {
      adminUsername,
      adminPassword,
      adminPasscode,
    })

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Bạn cần mã bảo mật Thủ Quỹ hoặc mật khẩu Admin để xóa khoản chi!' },
        { status: 401 }
      )
    }

    const res = await deleteExpenseFromFund(fundId, expenseId)
    if (!res.success) {
      return NextResponse.json({ error: 'Không thể xóa khoản chi này' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa khoản chi thành công và hoàn lại số dư quỹ!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi xử lý xóa khoản chi' }, { status: 500 })
  }
}
