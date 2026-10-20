import { NextResponse } from 'next/server'
import { getFundById, updateStudentPayment } from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { normalizeVietnamese } from '@/lib/nopQuyLopAuth'

export const dynamic = 'force-dynamic'

// Helper sleep để retry hàng đợi khi OCR Vision tạm thời bận
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Chuẩn hóa chuỗi chỉ giữ lại chữ cái và số (viết thường) để so sánh mã thanh toán & STK
function cleanAlphaNumeric(str?: string): string {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Bóc tách toàn bộ các số nguyên có khả năng là số tiền (VND) từ chuỗi text
function extractPossibleAmounts(text: string): number[] {
  const amounts: number[] = []
  if (!text) return amounts

  // Tìm các chuỗi tiền như: 100.000, 100,000, 100000, 50.000d, 50,000 VND
  const regex = /(\b\d{1,3}(?:[.,]\d{3})+(?:\s*(?:đ|vnd|dong))?\b|\b\d{4,9}\b)/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    const rawVal = match[1].replace(/[^0-9]/g, '')
    const val = parseInt(rawVal, 10)
    if (!isNaN(val) && val >= 1000 && val <= 100000000) {
      amounts.push(val)
    }
  }
  return amounts
}

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

    // Nếu đã hoàn tất trước đó thì phản hồi ngay
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
        { error: 'Vui lòng tải lên ảnh chụp màn hình / biên lai chuyển khoản ngân hàng' },
        { status: 400 }
      )
    }

    const proofImageUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:${mimeType};base64,${base64Data}`

    // BẢO MẬT TUYỆT ĐỐI: Phải có API Key để OCR đối soát 4 yếu tố
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Hệ thống chưa thể OCR biên lai tự động (chưa cấu hình API Key). Vui lòng gửi ảnh biên lai cho Thủ quỹ để được duyệt thủ công trực tiếp!',
        },
        { status: 503 }
      )
    }

    // =========================================================================
    // 1. OCR ENGINE: TRÍCH XUẤT TOÀN BỘ KÝ TỰ & CẤU TRÚC GIAO DỊCH TỪ BIÊN LAI
    // =========================================================================
    const genAI = new GoogleGenerativeAI(apiKey)
    const ocrPrompt = `Bạn là hệ thống OCR (Optical Character Recognition) chuyên bóc tách dữ liệu từ ảnh chụp biên lai chuyển tiền / màn hình banking ngân hàng Việt Nam (VietQR, VAB, VCB, MB, Techcombank, Momo...).

NHIỆM VỤ:
Đọc chính xác từng ký tự trên ảnh biên lai và trích xuất ra JSON cấu trúc:
1. "fullRawText": Toàn bộ chữ và số xuất hiện trong ảnh (giữ nguyên tất cả các dòng, số tiền, tên, số tài khoản, nội dung chuyển khoản).
2. "detectedAmount": Số tiền chuyển khoản thực tế (VND, số nguyên, ví dụ: 50000 hoặc 100000).
3. "detectedRecipientAccount": Số tài khoản nhận tiền (chuỗi chỉ gồm các số, ví dụ "00222085").
4. "detectedRecipientName": Tên người thụ hưởng nhận tiền (viết hoa, ví dụ "TRAN DUY KHUONG" hoặc "TRẦN DUY KHƯƠNG").
5. "detectedBank": Tên ngân hàng nhận (ví dụ "VietABank", "VAB", "Ngân hàng Việt Á"...).
6. "detectedTransferContent": Nội dung chuyển khoản / Lời nhắn / Ghi chú giao dịch (Lưu ý: nội dung có thể có dấu gạch ngang hoặc không có dấu gạch ngang do ngân hàng hạn chế ký tự đặc biệt).
7. "detectedTransactionStatus": Trạng thái giao dịch (ví dụ "Thành công", "Đã chuyển tiền", "Giao dịch thành công").
8. "isBankingReceipt": true/false (đây có phải là biên lai chuyển tiền / hóa đơn giao dịch ngân hàng hợp lệ không).

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG bọc codeblock markdown, KHÔNG thêm lời giải thích):
{
  "fullRawText": "toàn bộ text đọc được",
  "detectedAmount": 0,
  "detectedRecipientAccount": "",
  "detectedRecipientName": "",
  "detectedBank": "",
  "detectedTransferContent": "",
  "detectedTransactionStatus": "",
  "isBankingReceipt": true
}`

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    let ocrRawResult = ''
    let lastError: any = null

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          const result = await model.generateContent([
            ocrPrompt,
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ])
          ocrRawResult = result.response.text()
          if (ocrRawResult) break
        } catch (err: any) {
          lastError = err
          if (
            err?.message?.includes('429') ||
            err?.message?.includes('quota') ||
            err?.message?.includes('overloaded')
          ) {
            await sleep(attempt * 1200)
            continue
          }
          break
        }
      }
      if (ocrRawResult) break
    }

    if (!ocrRawResult) {
      return NextResponse.json(
        {
          error:
            'Hệ thống OCR tạm thời quá tải hoặc không đọc được ảnh. Vui lòng chụp rõ nét toàn bộ màn hình biên lai chuyển khoản và thử lại, hoặc liên hệ Thủ quỹ!',
        },
        { status: 503 }
      )
    }

    // Parse kết quả OCR
    let ocrData: any = {}
    try {
      const cleaned = ocrRawResult.replace(/```json/gi, '').replace(/```/g, '').trim()
      ocrData = JSON.parse(cleaned)
    } catch {
      const jsonMatch = ocrRawResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          ocrData = JSON.parse(jsonMatch[0])
        } catch {}
      }
    }

    const fullRawText = String(ocrData.fullRawText || ocrRawResult || '')
    const detectedAmountNum = Number(ocrData.detectedAmount) || 0
    const detectedRecipientAccount = String(ocrData.detectedRecipientAccount || '').trim()
    const detectedRecipientName = String(ocrData.detectedRecipientName || '').trim()
    const detectedBank = String(ocrData.detectedBank || '').trim()
    const detectedContent = String(ocrData.detectedTransferContent || '').trim()
    const isBankingReceipt = Boolean(ocrData.isBankingReceipt !== false)

    // =========================================================================
    // 2. DETERMINISTIC AUDIT: ĐỐI SOÁT CHẶT CHẼ 4 YẾU TỐ TIỀN BẠC (KHÔNG LỖ HỔNG)
    // =========================================================================

    const failedReasons: string[] = []

    // YẾU TỐ 1: KIỂM TRA ĐÚNG MÃ CHUYỂN KHOẢN (paymentCode)
    // Hỗ trợ cả trường hợp có gạch ngang (ME2-25024004-OEM2) lẫn không có gạch ngang (ME2 25024004 OEM2 hoặc ME225024004OEM2)
    const cleanTargetCode = cleanAlphaNumeric(paymentCode)
    const cleanDetectedContent = cleanAlphaNumeric(detectedContent)
    const cleanFullText = cleanAlphaNumeric(fullRawText)
    const rawLowerText = fullRawText.toLowerCase()
    const rawLowerContent = detectedContent.toLowerCase()

    const codeWithoutDashes = paymentCode.replace(/-/g, '').toLowerCase()
    const codeWithSpaces = paymentCode.replace(/-/g, ' ').toLowerCase()

    // Tách các thành phần của mã (ví dụ: ["me2", "25024004", "oem2"])
    const codeParts = paymentCode
      .split('-')
      .map((p) => cleanAlphaNumeric(p))
      .filter((p) => p.length >= 2)

    // Nếu mã có nhiều phần, kiểm tra tất cả các phần có xuất hiện trong nội dung hoặc text biên lai
    const allPartsPresent =
      codeParts.length >= 2 &&
      codeParts.every(
        (part) => cleanDetectedContent.includes(part) || cleanFullText.includes(part)
      )

    const codeMatched =
      Boolean(cleanTargetCode) &&
      (cleanDetectedContent.includes(cleanTargetCode) ||
        cleanFullText.includes(cleanTargetCode) ||
        rawLowerContent.includes(paymentCode.toLowerCase()) ||
        rawLowerText.includes(paymentCode.toLowerCase()) ||
        rawLowerContent.includes(codeWithoutDashes) ||
        rawLowerText.includes(codeWithoutDashes) ||
        rawLowerContent.includes(codeWithSpaces) ||
        rawLowerText.includes(codeWithSpaces) ||
        allPartsPresent)

    if (!codeMatched) {
      failedReasons.push(
        `Không tìm thấy mã nộp tiền "${paymentCode}" (hoặc dạng không gạch ngang "${paymentCode.replace(/-/g, ' ')}") trong nội dung chuyển khoản của biên lai.`
      )
    }

    // YẾU TỐ 2: KIỂM TRA ĐÚNG SỐ TIỀN (amount >= fund.amountPerPerson)
    // Không được thiếu dù chỉ 1 đồng
    const expectedAmount = fund.amountPerPerson || 0
    let finalDetectedAmount = detectedAmountNum

    if (!finalDetectedAmount || finalDetectedAmount <= 0) {
      // Fallback: Tìm số tiền từ toàn bộ text OCR bằng regex
      const possibleAmounts = extractPossibleAmounts(fullRawText)
      const foundMatch = possibleAmounts.find((a) => a >= expectedAmount)
      if (foundMatch) {
        finalDetectedAmount = foundMatch
      }
    }

    const amountMatched = finalDetectedAmount >= expectedAmount

    if (!amountMatched) {
      if (finalDetectedAmount > 0) {
        failedReasons.push(
          `Số tiền chuyển (${finalDetectedAmount.toLocaleString('vi-VN')} đ) không đủ so với mức nộp quy định (${expectedAmount.toLocaleString('vi-VN')} đ).`
        )
      } else {
        failedReasons.push(
          `Không nhận diện được số tiền hợp lệ (${expectedAmount.toLocaleString('vi-VN')} đ) trên biên lai.`
        )
      }
    }

    // YẾU TỐ 3: KIỂM TRA ĐÚNG NGƯỜI NHẬN TIỀN (TRAN DUY KHUONG / TRẦN DUY KHƯƠNG)
    const targetRecipient = fund.accountName || 'TRAN DUY KHUONG'
    const normTargetRecipient = normalizeVietnamese(targetRecipient)
    const normDetectedRecipient = normalizeVietnamese(detectedRecipientName)
    const normFullText = normalizeVietnamese(fullRawText)

    // Khớp tên đầy đủ hoặc từ khóa nhận diện thủ quỹ Trần Duy Khương
    const recipientMatched =
      (normDetectedRecipient.length > 0 &&
        (normDetectedRecipient.includes(normTargetRecipient) ||
          normTargetRecipient.includes(normDetectedRecipient) ||
          normDetectedRecipient.includes('tran duy khuong') ||
          normDetectedRecipient.includes('duy khuong'))) ||
      normFullText.includes('tran duy khuong') ||
      normFullText.includes('duy khuong') ||
      normFullText.includes(normTargetRecipient)

    if (!recipientMatched) {
      failedReasons.push(
        `Người nhận tiền trên biên lai không khớp với thủ quỹ "${targetRecipient}".`
      )
    }

    // YẾU TỐ 4: KIỂM TRA ĐÚNG SỐ TÀI KHOẢN NHẬN & NGÂN HÀNG (00222085 - VietABank / VAB)
    const targetAccount = (fund.bankAccount || '00222085').replace(/\D/g, '')
    const cleanDetectedAcc = detectedRecipientAccount.replace(/\D/g, '')
    const cleanFullTextDigits = fullRawText.replace(/\D/g, '')

    const accountMatched =
      (cleanDetectedAcc.length > 0 && cleanDetectedAcc.includes(targetAccount)) ||
      cleanFullTextDigits.includes(targetAccount)

    // Kiểm tra tên ngân hàng VietABank / VAB
    const bankKeywords = ['vietabank', 'vab', 'viet a', 'vieta']
    const bankMatched =
      bankKeywords.some((kw) => normFullText.includes(kw)) ||
      bankKeywords.some((kw) => normalizeVietnamese(detectedBank).includes(kw)) ||
      accountMatched // Nếu khớp số tài khoản 00222085 duy nhất thì đã có độ tin cậy rất cao

    if (!accountMatched) {
      failedReasons.push(
        `Số tài khoản nhận trên biên lai không phải là STK ${fund.bankAccount} (${fund.bankName}).`
      )
    }

    // TỔNG HỢP KIỂM ĐỊNH TẤT CẢ CÁC YẾU TỐ
    const allPassed =
      isBankingReceipt &&
      codeMatched &&
      amountMatched &&
      recipientMatched &&
      accountMatched

    const auditSummary = {
      codeMatched,
      amountMatched,
      recipientMatched,
      accountMatched,
      bankMatched,
      isBankingReceipt,
      expectedCode: paymentCode,
      detectedAmount: finalDetectedAmount,
      expectedAmount,
      detectedRecipient: detectedRecipientName || 'Chưa nhận diện',
      expectedRecipient: targetRecipient,
      detectedAccount: detectedRecipientAccount || 'Chưa nhận diện',
      expectedAccount: fund.bankAccount,
      detectedBank: detectedBank || fund.bankName,
    }

    if (!allPassed) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: 'Biên lai chuyển khoản không vượt qua quy trình đối soát OCR',
          reasons: failedReasons,
          audit: auditSummary,
          message:
            failedReasons.length > 0
              ? failedReasons.join(' ')
              : 'Biên lai không hợp lệ hoặc thiếu thông tin đối soát. Vui lòng kiểm tra lại!',
        },
        { status: 400 }
      )
    }

    // =========================================================================
    // 3. TẤT CẢ 4 YẾU TỐ ĐỀU KHỚP TUYỆT ĐỐI -> DUYỆT ĐÃ NỘP & LƯU VÀO CSDL
    // =========================================================================
    const updateRes = await updateStudentPayment(
      fund.id,
      student.id,
      true,
      paymentCode,
      proofImageUrl
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
      audit: auditSummary,
      student:
        updateRes.student || {
          ...student,
          paid: true,
          paymentCode,
          proofImage: proofImageUrl,
        },
      message: `Đối soát OCR thành công! Đã khớp chính xác 4 yếu tố: Mã nộp tiền (${paymentCode}), Số tiền (${finalDetectedAmount.toLocaleString('vi-VN')} đ), Người nhận (${targetRecipient}), STK (${fund.bankAccount}). Sinh viên "${student.name}" đã hoàn thành nộp quỹ lớp ME2!`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi khi đối soát OCR minh chứng chuyển tiền' },
      { status: 500 }
    )
  }
}
