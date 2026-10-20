import { NextResponse } from 'next/server'
import {
  getFundById,
  updateStudentPayment,
  markStudentVerificationResult,
} from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { runOcrAudit, getRemainingGeminiCalls } from '@/lib/nopQuyLopOCR'

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
        processedCount: 0,
        remaining: 0,
      })
    }

    // Duyệt tối đa 15 bạn trong hạn mức 15 lượt / phút của gemini-3.5-flash-lite
    const processedStudents: any[] = []
    let rateLimited = false
    let lastMessage = ''

    for (const student of pendingStudents) {
      const remainingQuota = getRemainingGeminiCalls(15)
      if (remainingQuota <= 0) {
        rateLimited = true
        lastMessage = 'Đã đạt hạn mức 15 lượt / phút. Tự động tạm nghỉ 1 phút trước khi tiếp tục duyệt 15 lượt tiếp theo.'
        break
      }

      const paymentCode = student.paymentCode || ''
      const proofImage = student.proofImage || ''
      if (!proofImage) continue

      const auditRes = await runOcrAudit(fund, paymentCode, proofImage)

      if (auditRes.rateLimited || auditRes.timedOut) {
        rateLimited = true
        lastMessage = 'Đã đạt hạn mức 15 lượt / phút. Hệ thống tự động tiếp tục duyệt 15 lượt tiếp theo sau 1 phút.'
        break
      }

      if (!auditRes.success) {
        await markStudentVerificationResult(
          fund.id,
          student.id,
          false,
          auditRes.failedReasons.join(' ')
        )
        processedStudents.push({ ...student, paid: false, verificationStatus: 'failed' })
      } else {
        const updateRes = await updateStudentPayment(
          fund.id,
          student.id,
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

        processedStudents.push(updateRes.student || { ...student, paid: true, verificationStatus: 'verified' })
      }
    }

    const remaining = pendingStudents.length - processedStudents.length

    return NextResponse.json({
      success: true,
      processed: processedStudents.length > 0,
      processedCount: processedStudents.length,
      processedStudents,
      rateLimited,
      remaining,
      message:
        lastMessage ||
        (processedStudents.length > 0
          ? `Đã duyệt thành công cho ${processedStudents.length} bạn trong hàng chờ!`
          : 'Đang xếp hàng chờ duyệt...'),
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi xử lý hàng chờ xác minh' },
      { status: 500 }
    )
  }
}
