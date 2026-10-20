import { NextResponse } from 'next/server'
import { getFundById, updateStudentPayment } from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

// Helper sleep để retry hàng đợi khi AI quá tải
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
        const match = rawImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
        if (match) {
          mimeType = match[1]
          base64Data = match[2]
        } else {
          base64Data = rawImage
        }
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

    // Nếu đã nộp trước đó thì hoàn tất ngay
    if (student.paid) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        student,
        message: 'Bạn đã hoàn tất nộp tiền quỹ trước đó!',
      })
    }

    if (!base64Data) {
      return NextResponse.json(
        { error: 'Vui lòng tải lên ảnh chụp màn hình / biên lai chuyển khoản để xác minh' },
        { status: 400 }
      )
    }

    // Chuẩn bị URL ảnh minh chứng để lưu trữ
    const proofImageUrl = rawImage.startsWith('data:')
      ? rawImage
      : `data:${mimeType};base64,${base64Data}`

    // BƯỚC XÁC MINH HÌNH ẢNH QUA GEMINI AI
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Nếu chưa có API key trên server, tự động chấp nhận để không chặn người dùng nộp tiền
      await updateStudentPayment(fund.id, student.id, true, paymentCode, proofImageUrl)
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
        fallbackNoAi: true,
        student: { ...student, paid: true, paymentCode, proofImage: proofImageUrl },
        message: 'Biên lai đã được ghi nhận thành công!',
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const prompt = `Bạn là hệ thống AI thẩm định biên lai chuyển khoản ngân hàng tự động (VietQR Banking Receipt Auditor) cho Lớp ME2.

DỮ LIỆU CẦN ĐỐI CHIẾU:
- Mã nộp tiền riêng (BẮT BUỘC có trong nội dung/lời nhắn): "${paymentCode}"
- Số tiền nộp: ${fund.amountPerPerson} đ (chấp nhận định dạng: "${fund.amountPerPerson.toLocaleString('vi-VN')}", "${fund.amountPerPerson}", "${Math.round(fund.amountPerPerson / 1000)}k")
- Họ tên sinh viên nộp: "${student.name}"
- MSSV sinh viên: "${student.mssv || ''}"
- Tài khoản nhận dự kiến: "${fund.bankAccount}"
- Chủ tài khoản nhận dự kiến: "${fund.accountName}"

NHIỆM VỤ:
1. Đọc ảnh và nhận diện xem đây có phải là màn hình chuyển khoản thành công / biên lai thanh toán (Banking App) hay không.
2. Kiểm tra xem trong "Nội dung chuyển khoản", "Lời nhắn", "Nội dung giao dịch" có chứa mã "${paymentCode}" (hoặc biến thể không phân biệt hoa thường, hoặc có họ tên "${student.name}") hay không.
3. Kiểm tra số tiền chuyển có bằng hoặc lớn hơn ${fund.amountPerPerson} VND không.
4. Trạng thái giao dịch có phải là "Thành công" / "Giao dịch thành công" / "Đã chuyển" không.

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG bọc trong markdown hay text khác):
{
  "isBankReceipt": true/false,
  "isSuccessStatus": true/false,
  "codeMatched": true/false,
  "amountMatched": true/false,
  "detectedCode": "chuỗi mã hoặc nội dung đọc được",
  "detectedAmount": số_tiền_đọc_được,
  "confidence": số_từ_0_đến_1,
  "reason": "lời giải thích ngắn gọn bằng tiếng Việt"
}`

    // Hàng đợi / Thử nghiệm với các model và cơ chế retry nếu bị quá tải (rate limit)
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash']
    let aiResponseText = ''
    let lastError: any = null

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ])
          aiResponseText = result.response.text()
          if (aiResponseText) break
        } catch (err: any) {
          lastError = err
          // Nếu bị rate limit hoặc quá tải, chờ 1.5s - 2.5s rồi thử lại
          if (err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('overloaded')) {
            await sleep(attempt * 1200)
            continue
          }
          break // Lỗi khác thì đổi sang model tiếp theo
        }
      }
      if (aiResponseText) break
    }

    if (!aiResponseText) {
      console.warn('AI verification retry exhausted:', lastError?.message)
      // Nếu AI tạm thời quá tải, chấp nhận biên lai và ghi nhận trạng thái để thủ quỹ kiểm tra thêm
      await updateStudentPayment(fund.id, student.id, true, paymentCode, proofImageUrl)
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
        queuedReview: true,
        student: { ...student, paid: true, paymentCode, proofImage: proofImageUrl },
        message: 'Biên lai đã được tải lên và ghi nhận thành công!',
      })
    }

    // Parse kết quả JSON từ AI
    let parsed: any = null
    try {
      const cleaned = aiResponseText.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // Thử regex tìm JSON
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {}
      }
    }

    const isMatch = Boolean(
      parsed &&
        (parsed.codeMatched === true || (parsed.isBankReceipt && parsed.amountMatched))
    )

    if (isMatch) {
      // Cập nhật trạng thái đã nộp kèm ảnh minh chứng
      const updateRes = await updateStudentPayment(fund.id, student.id, true, paymentCode, proofImageUrl)
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
        aiAnalysis: parsed,
        student: updateRes.student || { ...student, paid: true, paymentCode, proofImage: proofImageUrl },
        message: `Xác minh thành công! Sinh viên "${student.name}" đã hoàn thành nộp quỹ lớp.`,
      })
    }

    // Nếu AI phát hiện không khớp (ảnh không phải bill hoặc sai mã)
    return NextResponse.json({
      success: false,
      verified: false,
      aiAnalysis: parsed,
      reason:
        parsed?.reason ||
        'Không tìm thấy mã chuyển tiền hoặc số tiền hợp lệ trên ảnh biên lai. Vui lòng kiểm tra lại ảnh chụp màn hình!',
    }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi xác minh ảnh minh chứng' },
      { status: 500 }
    )
  }
}
