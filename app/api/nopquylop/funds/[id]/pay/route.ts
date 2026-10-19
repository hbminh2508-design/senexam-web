import { NextResponse } from 'next/server'
import { getFundById, normalizeVietnamese } from '@/lib/nopQuyLopStore'

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

    // Sinh mã nộp tiền độc nhất: ME2-[MSSV]-[RANDOM_4_DIGITS]
    const shortMssv = matchedStudent.mssv || matchedStudent.id
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const paymentCode = `ME2-${shortMssv}-${randomSuffix}`

    // Chuẩn hóa Bank ID cho VietQR
    const bankClean = (fund.bankName || 'MBBANK').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const accountClean = (fund.bankAccount || '').replace(/[^0-9]/g, '')
    const transferNote = paymentCode

    // Tạo link VietQR chuẩn
    const qrUrl = `https://img.vietqr.io/image/${bankClean}-${accountClean}-compact2.png?amount=${fund.amountPerPerson}&addInfo=${encodeURIComponent(transferNote)}&accountName=${encodeURIComponent(fund.accountName || 'THU QUY LOP ME2')}`

    return NextResponse.json({
      success: true,
      student: matchedStudent,
      paymentCode,
      qrUrl,
      amount: fund.amountPerPerson,
      bankName: fund.bankName,
      bankAccount: fund.bankAccount,
      accountName: fund.accountName,
      transferNote,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý sinh mã nộp tiền' }, { status: 500 })
  }
}
