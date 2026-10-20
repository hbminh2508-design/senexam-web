import { NextResponse } from 'next/server'
import {
  getFundById,
  updateStudentPayment,
  markStudentVerificationResult,
} from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { runOcrAudit } from '@/lib/nopQuyLopOCR'

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

    // Lọc danh sách sinh viên đang trong Hàng chờ cần xử lý (FIFO)
    const pendingStudents = fund.students.filter(
      (s) => s.verificationStatus === 'pending' && !s.paid && Boolean(s.proofImage)
    )

    if (pendingStudents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Hàng chờ xác minh hiện đang trống.',
        processed: false,
        remaining: 0,
      })
    }

    // Bốc người tiếp theo trong hàng chờ (người nộp trước được duyệt trước)
    const nextStudent = pendingStudents[0]
    const paymentCode = nextStudent.paymentCode || ''
    const proofImage = nextStudent.proofImage || ''

    if (!proofImage) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy ảnh minh chứng của người tiếp theo.',
        remaining: pendingStudents.length,
      })
    }

    // Chạy đối soát OCR bằng model 'gemini-3.5-flash-lite'
    const auditRes = await runOcrAudit(fund, paymentCode, proofImage)

    // Nếu vẫn đang bị 429 hoặc quá tải: giữ nguyên trong hàng chờ, chờ lượt 5 phút sau
    if (auditRes.rateLimited || auditRes.timedOut) {
      return NextResponse.json({
        success: true,
        processed: false,
        rateLimited: true,
        message:
          'Hệ thống đang tạm thời đạt hạn mức 15 lượt/phút. Phiên của bạn vẫn được lưu nguyên vẹn và sẽ tự động thử lại sau 1 phút!',
        student: nextStudent,
        remaining: pendingStudents.length,
      })
    }

    // Nếu không khớp các yếu tố hợp lệ
    if (!auditRes.success) {
      await markStudentVerificationResult(
        fund.id,
        nextStudent.id,
        false,
        auditRes.failedReasons.join(' ')
      )

      return NextResponse.json({
        success: false,
        processed: true,
        verified: false,
        reasons: auditRes.failedReasons,
        student: { ...nextStudent, verificationStatus: 'failed' },
        message: auditRes.message,
        remaining: pendingStudents.length - 1,
      })
    }

    // Khớp 4 yếu tố -> ĐÁNH DẤU THÀNH CÔNG!
    const updateRes = await updateStudentPayment(
      fund.id,
      nextStudent.id,
      true,
      paymentCode,
      proofImage,
      { verificationStatus: 'verified' }
    )

    try {
      const supabaseAdmin = getSupabaseAdmin()
      await supabaseAdmin
        .from('class_fund_payments')
        .update({
          proof_image: proofImage,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('order_code', paymentCode)
    } catch {}

    return NextResponse.json({
      success: true,
      processed: true,
      verified: true,
      student: updateRes.student,
      message: `Đã đối soát thành công cho sinh viên "${nextStudent.name}"!`,
      remaining: pendingStudents.length - 1,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi xử lý hàng chờ xác minh' },
      { status: 500 }
    )
  }
}
