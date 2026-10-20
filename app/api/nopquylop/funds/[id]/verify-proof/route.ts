import { NextResponse } from 'next/server'
import {
  getFundById,
  updateStudentPayment,
  saveStudentProofQueue,
  markStudentVerificationResult,
} from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { runOcrAudit, parseImageBase64 } from '@/lib/nopQuyLopOCR'

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

    let studentId = ''
    let paymentCode = ''
    let base64Data = ''
    let mimeType = 'image/jpeg'

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      studentId = String(formData.get('studentId') || '').trim()
      paymentCode = String(formData.get('paymentCode') || '').trim()
      const imageFile = formData.get('image') as File | null

      if (imageFile) {
        const buffer = Buffer.from(await imageFile.arrayBuffer())
        base64Data = buffer.toString('base64')
        mimeType = imageFile.type || 'image/jpeg'
      }
    } else {
      const body = await request.json().catch(() => ({}))
      studentId = String(body.studentId || '').trim()
      paymentCode = String(body.paymentCode || '').trim()
      const rawImage = String(body.image || '')
      if (rawImage) {
        const parsed = parseImageBase64(rawImage)
        base64Data = parsed.base64Data
        mimeType = parsed.mimeType
      }
    }

    if (!studentId || !paymentCode) {
      return NextResponse.json(
        { error: 'Thiếu mã thanh toán hoặc thông tin sinh viên' },
        { status: 400 }
      )
    }

    const student = fund.students.find(
      (s) => s.id === studentId || (s.mssv && s.mssv === studentId)
    )

    if (!student) {
      return NextResponse.json(
        { error: 'Không tìm thấy sinh viên này trong danh sách quỹ' },
        { status: 404 }
      )
    }

    const isTestFund = Boolean((fund as any).isTestFund || fund.id === 'quy-test-hoang-binh-minh' || fund.id.includes('test'))

    // Nếu đã hoàn tất trước đó thì phản hồi ngay (TRỪ KHI LÀ QUỸ TEST NỘP VÔ HẠN LẦN)
    if (student.paid && !isTestFund) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        student,
        message: 'Bạn đã hoàn tất nộp tiền quỹ trước đó!',
      })
    }

    if (!base64Data) {
      return NextResponse.json(
        { error: 'Vui lòng tải lên hoặc kéo thả ảnh chụp màn hình / biên lai chuyển khoản' },
        { status: 400 }
      )
    }

    const proofImageUrl = `data:${mimeType};base64,${base64Data}`

    // =========================================================================
    // 1. AN TOÀN TUYỆT ĐỐI: LƯU MINH CHỨNG VÀO HÀNG CHỜ TRƯỚC TIÊN (KHÔNG MẤT DỮ LIỆU)
    // =========================================================================
    const queueSave = await saveStudentProofQueue(
      fund.id,
      student.id,
      paymentCode,
      proofImageUrl
    )

    // Đồng bộ lên bảng class_fund_payments nếu có Supabase
    try {
      const supabaseAdmin = getSupabaseAdmin()
      await supabaseAdmin
        .from('class_fund_payments')
        .upsert({
          fund_id: fund.id,
          student_id: student.id,
          order_code: paymentCode,
          proof_image: proofImageUrl,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'order_code' })
    } catch {}

    // =========================================================================
    // 2. CHẠY THỬ OCR BẰNG 'gemini-3.5-flash-lite' (SIÊU NHANH, MAX 8.5s)
    // =========================================================================
    const auditRes = await runOcrAudit(fund, paymentCode, proofImageUrl)

    // TH 1: Bị giới hạn 15 lượt / phút (429) hoặc Token vượt quá hoặc Timeout
    // -> Giữ nguyên trong Hàng chờ, KHÔNG báo lỗi, không làm đơ giao diện
    if (auditRes.rateLimited || auditRes.timedOut) {
      return NextResponse.json({
        success: true,
        inQueue: true,
        queued: true,
        queuePosition: queueSave.queuePosition || 1,
        student: queueSave.student || {
          ...student,
          paid: false,
          verificationStatus: 'pending',
          proofImage: proofImageUrl,
          paymentCode,
        },
        message:
          'Minh chứng của bạn đã được ghi nhận và lưu an toàn vào Hàng chờ! Hệ thống sẽ tự động quét đối soát sau mỗi 5 phút hoặc Thủ quỹ sẽ duyệt trực tiếp cho bạn.',
      })
    }

    // TH 2: OCR đọc được nhưng không khớp 4 yếu tố (Sai tiền, sai người nhận, sai mã...)
    if (!auditRes.success) {
      await markStudentVerificationResult(
        fund.id,
        student.id,
        false,
        auditRes.failedReasons.join(' ')
      )

      return NextResponse.json(
        {
          success: false,
          verified: false,
          reasons: auditRes.failedReasons,
          audit: auditRes.audit,
          message: auditRes.message,
        },
        { status: 400 }
      )
    }

    // TH 3: Khớp tuyệt đối cả 4 yếu tố -> ĐÁNH DẤU ĐÃ NỘP THÀNH CÔNG!
    const updateRes = await updateStudentPayment(
      fund.id,
      student.id,
      true,
      paymentCode,
      proofImageUrl,
      { verificationStatus: 'verified' }
    )

    try {
      const supabaseAdmin = getSupabaseAdmin()
      await supabaseAdmin
        .from('class_fund_payments')
        .update({
          proof_image: proofImageUrl,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('order_code', paymentCode)
    } catch {}

    return NextResponse.json({
      success: true,
      verified: true,
      inQueue: false,
      audit: auditRes.audit,
      student:
        updateRes.student || {
          ...student,
          paid: true,
          verificationStatus: 'verified',
          paymentCode,
          proofImage: proofImageUrl,
        },
      message: auditRes.message,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi kiểm tra minh chứng' },
      { status: 500 }
    )
  }
}
