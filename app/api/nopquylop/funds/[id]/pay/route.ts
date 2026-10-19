import { NextResponse } from 'next/server'
import { getFundById, normalizeVietnamese } from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buildVietQrUrl } from '@/lib/vipMembership'
import { getNopQuyBankConfig } from '@/lib/vietQrHelper'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fund = await getFundById(id)

    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }

    const body = await request.json()
    const rawInput = String(body?.query || body?.name || body?.mssv || '').trim()
    const inputName = String(body?.name || '').trim()
    const inputMssv = String(body?.mssv || '').trim()

    if (!rawInput && !inputName && !inputMssv) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Họ và Tên hoặc Mã số sinh viên (MSSV) để xác nhận nộp tiền' },
        { status: 400 }
      )
    }

    const normRaw = normalizeVietnamese(rawInput)
    const normName = normalizeVietnamese(inputName)
    const normMssv = normalizeVietnamese(inputMssv)

    // Nhận diện 1 trong 2: Họ và tên HOẶC MSSV
    const matchedStudent = fund.students.find((s) => {
      const studentNormName = normalizeVietnamese(s.name)
      const studentMssv = s.mssv ? normalizeVietnamese(s.mssv) : ''

      // So khớp qua MSSV nếu có
      if (studentMssv && (studentMssv === normRaw || (normMssv && studentMssv === normMssv))) {
        return true
      }

      // So khớp qua Họ và Tên chính xác
      if (studentNormName === normRaw || (normName && studentNormName === normName)) {
        return true
      }

      // So khớp qua tên nếu người dùng nhập có đảo vị trí hoặc chứa họ tên đầy đủ
      if (normName && normName.length >= 4 && (studentNormName.includes(normName) || normName.includes(studentNormName))) {
        return true
      }

      if (normRaw && normRaw.length >= 4 && (studentNormName.includes(normRaw) || normRaw.includes(studentNormName))) {
        return true
      }

      return false
    })

    // Nếu không khớp cả 2: Cảnh báo và yêu cầu kiểm tra lại thông tin
    if (!matchedStudent) {
      return NextResponse.json(
        {
          error: 'Không tìm thấy thông tin của bạn trong danh sách lớp ME2. Vui lòng kiểm tra lại chính xác Họ & Tên hoặc MSSV!',
          isNotFound: true,
        },
        { status: 400 }
      )
    }

    // Đã nộp rồi thì thông báo
    if (matchedStudent.paid) {
      return NextResponse.json({
        student: matchedStudent,
        alreadyPaid: true,
        message: `Sinh viên "${matchedStudent.name}" (${matchedStudent.mssv || 'ME2'}) đã hoàn thành nộp tiền vào lúc ${matchedStudent.paidAt ? new Date(matchedStudent.paidAt).toLocaleDateString('vi-VN') : 'trước đó'}. Cảm ơn bạn!`,
      })
    }

    // Sinh mã nộp tiền riêng biệt cho mỗi người (gồm lớp ME2, MSSV/ID và mã ngẫu nhiên)
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const studentTag = matchedStudent.mssv ? matchedStudent.mssv.replace(/\s+/g, '') : `SV${matchedStudent.id}`
    const paymentCode = `ME2-${studentTag}-${randSuffix}`

    // Thông tin ngân hàng: Tách biệt hoàn toàn với SenExam
    // 1. Ưu tiên tài khoản cấu hình trong đợt quỹ này (fund.bankAccount, fund.accountName, fund.bankName)
    // 2. Ưu tiên biến môi trường riêng NOPQUYLOP_ACCOUNT_NO, NOPQUYLOP_ACCOUNT_NAME, NOPQUYLOP_BANK_BIN
    // 3. Không dùng đè tài khoản Hoàng Bình Minh của SenExam
    const bankConfig = getNopQuyBankConfig(fund)
    const bankBin = bankConfig.bankBin
    const accountNo = bankConfig.accountNo
    const accountName = bankConfig.accountName
    const bankName = bankConfig.bankName
    const transferNote = paymentCode

    // Tạo link VietQR chuẩn bằng bộ tạo VietQR (img.vietqr.io compact2)
    const qrUrl = buildVietQrUrl({
      bankBin,
      accountNo,
      accountName,
      amountVnd: fund.amountPerPerson,
      addInfo: transferNote,
    })

    // Lưu đơn nộp tiền vào cơ sở dữ liệu Supabase để đối soát webhook chống gian lận
    try {
      const supabaseAdmin = getSupabaseAdmin()
      await supabaseAdmin.from('class_fund_payments').insert({
        fund_id: fund.id,
        student_id: matchedStudent.id,
        student_name: matchedStudent.name,
        mssv: matchedStudent.mssv || '',
        order_code: paymentCode,
        amount_vnd: fund.amountPerPerson,
        status: 'pending',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    } catch (saveErr: any) {
      console.warn('Lỗi lưu class_fund_payments:', saveErr?.message)
    }

    // Cập nhật paymentCode vào hồ sơ sinh viên
    matchedStudent.paymentCode = paymentCode

    return NextResponse.json({
      success: true,
      student: matchedStudent,
      paymentCode,
      qrUrl,
      amount: fund.amountPerPerson,
      bankBin,
      bankName,
      bankAccount: accountNo,
      accountName,
      transferNote,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý sinh mã nộp tiền' }, { status: 500 })
  }
}
