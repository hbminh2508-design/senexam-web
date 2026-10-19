import { NextResponse } from 'next/server'
import { getFundById, addExpenseToFund, isValidAdminDailyPassword } from '@/lib/nopQuyLopStore'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }
    return NextResponse.json({ expenses: fund.expenses || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi tải danh sách chi tiêu' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      amount,
      spentAt,
      spentBy,
      receiptImage,
      note,
      adminUsername,
      adminPassword,
    } = body

    // Xác thực Admin (Chỉ admin mới có quyền đưa bill chi tiêu vào quỹ)
    if (adminUsername !== 'admin' || !isValidAdminDailyPassword(adminPassword)) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu quản trị không chính xác!' },
        { status: 401 }
      )
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Tên mục chi không được để trống' }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền chi tiêu phải lớn hơn 0' }, { status: 400 })
    }

    const res = await addExpenseToFund(id, {
      title: title.trim(),
      amount: numAmount,
      spentAt: spentAt || new Date().toISOString().split('T')[0],
      spentBy: spentBy?.trim() || 'TRAN DUY KHUONG',
      receiptImage: receiptImage || undefined,
      note: note?.trim() || undefined,
    })

    if (!res.success) {
      return NextResponse.json({ error: 'Không thể thêm khoản chi vào quỹ' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      expense: res.expense,
      fund: res.fund,
      message: 'Đã thêm khoản chi thành công và trừ vào quỹ lớp!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi máy chủ khi thêm khoản chi' }, { status: 500 })
  }
}
