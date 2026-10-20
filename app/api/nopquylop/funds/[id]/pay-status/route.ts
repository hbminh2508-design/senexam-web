import { NextResponse } from 'next/server'
import { getFundById } from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const studentId = searchParams.get('studentId')

    if (!code && !studentId) {
      return NextResponse.json({ error: 'Thiếu mã thanh toán hoặc ID sinh viên' }, { status: 400 })
    }

    // 1. Kiểm tra trạng thái đơn hàng trong bảng class_fund_payments (Supabase)
    if (code) {
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: order } = await supabaseAdmin
          .from('class_fund_payments')
          .select('*')
          .eq('order_code', code)
          .maybeSingle()

        if (order && order.status === 'paid') {
          return NextResponse.json({
            paid: true,
            status: 'paid',
            paidAt: order.paid_at,
            sepayId: order.sepay_id,
            studentId: order.student_id,
          })
        }
      } catch (err: any) {
        console.warn('Lỗi kiểm tra class_fund_payments:', err?.message)
      }
    }

    // 2. Kiểm tra trong danh sách sinh viên của quỹ
    const fund = await getFundById(id)
    if (fund && Array.isArray(fund.students)) {
      const student = fund.students.find(
        (s) =>
          (code && s.paymentCode === code) ||
          (studentId && (s.id === studentId || s.mssv === studentId))
      )

      if (student) {
        return NextResponse.json({
          paid: Boolean(student.paid),
          status: student.paid ? 'paid' : (student.verificationStatus || 'pending'),
          verificationStatus: student.verificationStatus,
          verificationError: student.verificationError,
          paidAt: student.paidAt,
          studentId: student.id,
        })
      }
    }

    return NextResponse.json({
      paid: false,
      status: 'pending',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi kiểm tra trạng thái thanh toán' }, { status: 500 })
  }
}
