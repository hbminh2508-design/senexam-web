import { NextResponse } from 'next/server'
import { deleteStudentFromFund, isValidAdminDailyPassword, getFundById } from '@/lib/nopQuyLopStore'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const { id, studentId } = await params
    const body = await request.json().catch(() => null)
    const adminUsername = String(body?.adminUsername || '').trim()
    const adminPassword = String(body?.adminPassword || '').trim()

    // Bắt buộc xác thực tài khoản & mật khẩu admin như lúc tạo quỹ
    if (adminUsername !== 'admin' || !isValidAdminDailyPassword(adminPassword)) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu quản trị không chính xác!' },
        { status: 401 }
      )
    }

    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp' }, { status: 404 })
    }

    const exists = fund.students.some((s) => s.id === studentId || s.mssv === studentId)
    if (!exists) {
      return NextResponse.json({ error: 'Không tìm thấy người nộp quỹ cần xóa' }, { status: 404 })
    }

    const success = await deleteStudentFromFund(id, studentId)
    if (!success) {
      return NextResponse.json({ error: 'Không thể xóa người nộp quỹ này' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa người nộp quỹ khỏi danh sách đợt thu này thành công',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý xóa người nộp quỹ' }, { status: 500 })
  }
}
