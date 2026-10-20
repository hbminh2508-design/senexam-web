import { NextResponse } from 'next/server'
import {
  getFundById,
  updateStudentPayment,
  deleteFund,
  isValidAdminDailyPassword,
  isAuthorizedAdminOrTreasurer,
} from '@/lib/nopQuyLopStore'

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

    const now = Date.now()
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const isOverdueOneWeek = fund.dueDate ? now - new Date(fund.dueDate).getTime() > ONE_WEEK_MS : false

    const totalStudents = fund.students.length
    const paidStudents = fund.students.filter((s) => s.paid).length
    const unpaidStudents = totalStudents - paidStudents
    const overdueOneWeekStudents = fund.students.filter((s) => !s.paid && isOverdueOneWeek).length
    const totalCollected = paidStudents * fund.amountPerPerson
    const targetAmount = totalStudents * fund.amountPerPerson

    return NextResponse.json({
      fund,
      stats: {
        totalStudents,
        paidStudents,
        unpaidStudents,
        overdueOneWeekStudents,
        totalCollected,
        targetAmount,
        progressPercent: targetAmount > 0 ? Math.round((totalCollected / targetAmount) * 100) : 0,
        isOverdueOneWeek,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi truy xuất quỹ' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      studentId,
      paid,
      paymentCode,
      proofImage,
      adminPasscode,
      adminPassword,
      adminUsername,
    } = body

    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp' }, { status: 404 })
    }

    // Kiểm tra quyền Admin hoặc Thủ Quỹ
    const isAuth = isAuthorizedAdminOrTreasurer(fund, {
      adminUsername,
      adminPassword,
      adminPasscode,
    })

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Mã xác thực thủ quỹ hoặc mật khẩu admin không chính xác!' },
        { status: 403 }
      )
    }

    const result = await updateStudentPayment(id, studentId, Boolean(paid), paymentCode, proofImage)
    if (!result.success) {
      return NextResponse.json({ error: 'Không tìm thấy sinh viên trong quỹ' }, { status: 404 })
    }

    return NextResponse.json({ success: true, student: result.student })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi cập nhật trạng thái nộp' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const adminUsername = String(body?.adminUsername || '').trim()
    const adminPassword = String(body?.adminPassword || '').trim()
    const adminPasscode = String(body?.adminPasscode || '').trim()

    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ cần xóa' }, { status: 404 })
    }

    // Kiểm tra quyền Admin hoặc Thủ Quỹ
    const isAuth = isAuthorizedAdminOrTreasurer(fund, {
      adminUsername,
      adminPassword,
      adminPasscode,
    })

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu quản trị không chính xác!' },
        { status: 401 }
      )
    }

    const success = await deleteFund(id)
    if (!success) {
      return NextResponse.json({ error: 'Không thể xóa đợt thu quỹ này' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Đã xóa đợt thu quỹ thành công' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý xóa quỹ' }, { status: 500 })
  }
}
