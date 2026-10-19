import { NextResponse } from 'next/server'
import { updateFundInitialBalance, isValidAdminDailyPassword } from '@/lib/nopQuyLopStore'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fundId } = await params
    const body = await request.json()
    const { initialBalance, adminUsername, adminPassword } = body

    if (adminUsername !== 'admin' || !isValidAdminDailyPassword(adminPassword)) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu quản trị không chính xác!' },
        { status: 401 }
      )
    }

    const numBalance = Number(initialBalance)
    if (isNaN(numBalance) || numBalance < 0) {
      return NextResponse.json({ error: 'Số tiền quỹ hiện có không hợp lệ' }, { status: 400 })
    }

    const res = await updateFundInitialBalance(fundId, numBalance)
    if (!res.success) {
      return NextResponse.json({ error: 'Không thể cập nhật số dư quỹ' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      fund: res.fund,
      message: 'Đã cập nhật số tiền quỹ hiện có lên cơ sở dữ liệu thành công!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi cập nhật số dư quỹ' }, { status: 500 })
  }
}
