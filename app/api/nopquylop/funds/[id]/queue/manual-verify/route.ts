import { NextResponse } from 'next/server'
import {
  getFundById,
  updateStudentPayment,
  markStudentVerificationResult,
} from '@/lib/nopQuyLopStore'
import { isValidAdminDailyPassword } from '@/lib/nopQuyLopAuth'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fundId } = await params
    const fund = await getFundById(fundId)

    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = String(body.studentId || '').trim()
    const action = String(body.action || '').trim() // 'approve' | 'reject'
    const rejectReason = String(body.rejectReason || '').trim()
    const adminUsername = String(body.adminUsername || '').trim()
    const adminPassword = String(body.adminPassword || body.adminPasscode || '').trim()

    // Kiểm tra quyền Admin hoặc Thủ quỹ
    const isAdmin =
      adminUsername === 'admin' && isValidAdminDailyPassword(adminPassword)
    const isTreasurer =
      ['thuquy', 'thủ quỹ', 'treasurer'].includes(adminUsername.toLowerCase()) &&
      Boolean(fund.adminPasscode && adminPassword === fund.adminPasscode)

    if (!isAdmin && !isTreasurer) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hoặc Thủ quỹ mới được kiểm tra chay / duyệt minh chứng!' },
        { status: 403 }
      )
    }

    const student = fund.students.find(
      (s) => s.id === studentId || (s.mssv && s.mssv === studentId)
    )

    if (!student) {
      return NextResponse.json(
        { error: 'Không tìm thấy sinh viên trong danh sách' },
        { status: 404 }
      )
    }

    if (action === 'approve') {
      const updateRes = await updateStudentPayment(
        fund.id,
        student.id,
        true,
        student.paymentCode,
        student.proofImage,
        { verificationStatus: 'verified' }
      )

      if (student.paymentCode) {
        try {
          const supabaseAdmin = getSupabaseAdmin()
          await supabaseAdmin
            .from('class_fund_payments')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('order_code', student.paymentCode)
        } catch {}
      }

      return NextResponse.json({
        success: true,
        action: 'approve',
        student: updateRes.student,
        message: `Đã duyệt thủ công: Sinh viên "${student.name}" đã hoàn thành nộp tiền quỹ!`,
      })
    } else if (action === 'reject') {
      const markRes = await markStudentVerificationResult(
        fund.id,
        student.id,
        false,
        rejectReason || 'Thủ quỹ từ chối duyệt minh chứng này. Vui lòng nộp lại ảnh rõ nét.'
      )

      return NextResponse.json({
        success: true,
        action: 'reject',
        student: markRes.student,
        message: `Đã từ chối minh chứng của sinh viên "${student.name}".`,
      })
    } else {
      return NextResponse.json(
        { error: 'Hành động không hợp lệ. Chỉ chấp nhận approve hoặc reject.' },
        { status: 400 }
      )
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi duyệt minh chứng' },
      { status: 500 }
    )
  }
}
