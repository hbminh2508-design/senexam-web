import { GoogleGenerativeAI } from '@google/generative-ai'
import { normalizeVietnamese } from '@/lib/nopQuyLopAuth'
import type { ClassFund } from '@/lib/nopQuyLopStore'

function cleanAlphaNumeric(str?: string): string {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function extractPossibleAmounts(text: string): number[] {
  const amounts: number[] = []
  if (!text) return amounts
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

export interface OcrAuditResult {
  success: boolean
  rateLimited?: boolean
  timedOut?: boolean
  isBankingReceipt?: boolean
  failedReasons: string[]
  message: string
  audit?: any
}

// Bộ đếm sliding-window 15 lượt / phút cho model gemini-3.5-flash-lite
let geminiCallTimestamps: number[] = []

export function checkAndRegisterGeminiRateLimit(maxPerMinute = 15): boolean {
  const now = Date.now()
  const ONE_MINUTE = 60 * 1000
  geminiCallTimestamps = geminiCallTimestamps.filter((t) => now - t < ONE_MINUTE)
  if (geminiCallTimestamps.length >= maxPerMinute) {
    return false
  }
  geminiCallTimestamps.push(now)
  return true
}

export function getRemainingGeminiCalls(maxPerMinute = 15): number {
  const now = Date.now()
  const ONE_MINUTE = 60 * 1000
  geminiCallTimestamps = geminiCallTimestamps.filter((t) => now - t < ONE_MINUTE)
  return Math.max(0, maxPerMinute - geminiCallTimestamps.length)
}

export function parseImageBase64(rawImage: string): { base64Data: string; mimeType: string } {
  let mimeType = 'image/jpeg'
  let base64Data = rawImage.trim()

  if (base64Data.includes(';base64,')) {
    const parts = base64Data.split(';base64,')
    base64Data = parts[1].trim()
    const mimeMatch = parts[0].match(/data:([a-zA-Z0-9\/\-+.]+)/)
    if (mimeMatch) {
      mimeType = mimeMatch[1]
    }
  } else if (base64Data.startsWith('data:')) {
    const commaIdx = base64Data.indexOf(',')
    if (commaIdx !== -1) {
      base64Data = base64Data.slice(commaIdx + 1).trim()
    }
  }

  return { base64Data, mimeType }
}

export async function runOcrAudit(
  fund: ClassFund,
  paymentCode: string,
  rawImage: string
): Promise<OcrAuditResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      success: false,
      rateLimited: true,
      failedReasons: ['Chưa cấu hình API Key'],
      message: 'Hệ thống đã lưu minh chứng vào Hàng chờ để tiếp tục đối soát và duyệt!',
    }
  }

  // Kiểm tra hạn mức 15 lượt / phút của gemini-3.5-flash-lite
  if (!checkAndRegisterGeminiRateLimit(15)) {
    return {
      success: false,
      rateLimited: true,
      failedReasons: ['Hệ thống đã đạt giới hạn 15 lượt / phút.'],
      message:
        'Hệ thống đang đạt giới hạn 15 lượt / phút. Minh chứng đã được tự động lưu vào Hàng chờ để tiếp tục duyệt sau 1 phút!',
    }
  }

  const { base64Data, mimeType } = parseImageBase64(rawImage)
  if (!base64Data) {
    return {
      success: false,
      failedReasons: ['Không có dữ liệu ảnh minh chứng'],
      message: 'Vui lòng tải lên ảnh chụp màn hình / biên lai chuyển khoản ngân hàng.',
    }
  }

  const isTestFund = Boolean(fund.isTestFund || fund.id === 'quy-test-hoang-binh-minh' || fund.id.includes('test'))

  const ocrPrompt = `Bạn là hệ thống đối soát dữ liệu từ ảnh chụp biên lai chuyển tiền / màn hình banking ngân hàng Việt Nam (VietQR, VAB, VCB, MB, Techcombank, Momo...).
Đọc chính xác từng ký tự trên ảnh biên lai và trích xuất ra JSON cấu trúc:
1. "fullRawText": Toàn bộ chữ và số xuất hiện trong ảnh (giữ nguyên tất cả các dòng, số tiền, tên, số tài khoản, nội dung chuyển khoản).
2. "detectedAmount": Số tiền chuyển khoản thực tế (VND, số nguyên, ví dụ: 50000 hoặc 100000).
3. "detectedRecipientAccount": Số tài khoản nhận tiền (chuỗi chỉ gồm các số, ví dụ "00222085" hoặc "0336062007").
4. "detectedRecipientName": Tên người thụ hưởng nhận tiền (viết hoa, ví dụ "TRAN DUY KHUONG" hoặc "HOANG BINH MINH").
5. "detectedBank": Tên ngân hàng nhận (ví dụ "VietABank", "VAB", "MBBank", "Ngân hàng Quân đội"...).
6. "detectedTransferContent": Nội dung chuyển khoản / Lời nhắn / Ghi chú giao dịch.
7. "isBankingReceipt": true/false (đây có phải là biên lai chuyển tiền / hóa đơn giao dịch ngân hàng hợp lệ không).

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (KHÔNG markdown codeblock, KHÔNG thêm lời giải thích):
{
  "fullRawText": "toàn bộ text đọc được",
  "detectedAmount": 0,
  "detectedRecipientAccount": "",
  "detectedRecipientName": "",
  "detectedBank": "",
  "detectedTransferContent": "",
  "isBankingReceipt": true
}`

  const genAI = new GoogleGenerativeAI(apiKey)
  // Ưu tiên cao nhất 'gemini-3.5-flash-lite' theo đúng yêu cầu người dùng
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']

  let ocrRawResult = ''
  let lastError: any = null
  let isRateLimitedOrOverloaded = false

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      })

      const callPromise = model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'image/jpeg',
          },
        },
        { text: ocrPrompt },
      ])

      // Timeout 25 giây cho gemini-3.5-flash-lite đối soát kỹ càng và đầy đủ
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_LIMIT_REACHED')), 25000)
      )

      const result: any = await Promise.race([callPromise, timeoutPromise])
      ocrRawResult = result.response.text()
      if (ocrRawResult) break
    } catch (err: any) {
      lastError = err
      const msg = err?.message || ''
      if (
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('ResourceExhausted') ||
        msg.includes('overloaded') ||
        msg.includes('limit') ||
        msg.includes('rate') ||
        msg.includes('TIMEOUT_LIMIT_REACHED')
      ) {
        isRateLimitedOrOverloaded = true
      }
      // Thử fallback sang model kế tiếp
      continue
    }
  }

  // Nếu bị rate limit hoặc timeout: đưa vào hàng chờ
  if (!ocrRawResult) {
    return {
      success: false,
      rateLimited: isRateLimitedOrOverloaded,
      timedOut: lastError?.message?.includes('TIMEOUT'),
      failedReasons: [
        isRateLimitedOrOverloaded
          ? 'Hệ thống đạt giới hạn lượt xử lý (15 lượt/phút) hoặc đang có nhiều người cùng nộp tiền.'
          : 'Hệ thống tạm thời bận hoặc phản hồi chậm.',
      ],
      message:
        'Hệ thống đang đông hoặc đạt hạn mức 15 lượt/phút. Minh chứng đã được tự động lưu vào Hàng chờ để xử lý tuần tự!',
    }
  }

  // Parse JSON
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

  const failedReasons: string[] = []

  // 1. Mã chuyển khoản
  const cleanTargetCode = cleanAlphaNumeric(paymentCode)
  const cleanDetectedContent = cleanAlphaNumeric(detectedContent)
  const cleanFullText = cleanAlphaNumeric(fullRawText)
  const rawLowerText = fullRawText.toLowerCase()
  const rawLowerContent = detectedContent.toLowerCase()

  const codeWithoutDashes = paymentCode.replace(/-/g, '').toLowerCase()
  const codeWithSpaces = paymentCode.replace(/-/g, ' ').toLowerCase()

  const codeParts = paymentCode
    .split('-')
    .map((p) => cleanAlphaNumeric(p))
    .filter((p) => p.length >= 2)

  const allPartsPresent =
    codeParts.length >= 2 &&
    codeParts.every((part) => cleanDetectedContent.includes(part) || cleanFullText.includes(part))

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

  // 2. Số tiền
  const expectedAmount = fund.amountPerPerson || 0
  let finalDetectedAmount = detectedAmountNum

  if (!finalDetectedAmount || finalDetectedAmount <= 0) {
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

  // 3. Người nhận
  const targetRecipient = fund.accountName || (isTestFund ? 'HOANG BINH MINH' : 'TRAN DUY KHUONG')
  const normTargetRecipient = normalizeVietnamese(targetRecipient)
  const normDetectedRecipient = normalizeVietnamese(detectedRecipientName)
  const normFullText = normalizeVietnamese(fullRawText)

  const recipientMatched =
    (normDetectedRecipient.length > 0 &&
      (normDetectedRecipient.includes(normTargetRecipient) ||
        normTargetRecipient.includes(normDetectedRecipient) ||
        (isTestFund
          ? normDetectedRecipient.includes('hoang binh minh') || normDetectedRecipient.includes('binh minh')
          : normDetectedRecipient.includes('tran duy khuong') || normDetectedRecipient.includes('duy khuong')))) ||
    (isTestFund
      ? normFullText.includes('hoang binh minh') || normFullText.includes('binh minh')
      : normFullText.includes('tran duy khuong') || normFullText.includes('duy khuong')) ||
    normFullText.includes(normTargetRecipient)

  if (!recipientMatched) {
    failedReasons.push(`Người nhận tiền trên biên lai không khớp với người thụ hưởng "${targetRecipient}".`)
  }

  // 4. Số tài khoản & Ngân hàng
  const targetAccount = (fund.bankAccount || (isTestFund ? '0336062007' : '00222085')).replace(/\D/g, '')
  const targetAccountNoLeadingZero = targetAccount.replace(/^0+/, '')
  const cleanDetectedAcc = detectedRecipientAccount.replace(/\D/g, '')
  const cleanFullTextDigits = fullRawText.replace(/\D/g, '')

  const accountMatched =
    (cleanDetectedAcc.length > 0 &&
      (cleanDetectedAcc.includes(targetAccount) ||
        (targetAccountNoLeadingZero.length >= 6 && cleanDetectedAcc.includes(targetAccountNoLeadingZero)))) ||
    cleanFullTextDigits.includes(targetAccount) ||
    (targetAccountNoLeadingZero.length >= 6 && cleanFullTextDigits.includes(targetAccountNoLeadingZero))

  const bankKeywords = isTestFund
    ? ['mbbank', 'mb bank', 'mb', 'quan doi', 'ngan hang quan doi']
    : ['vietabank', 'vab', 'viet a', 'vieta']

  const bankMatched =
    bankKeywords.some((kw) => normFullText.includes(kw)) ||
    bankKeywords.some((kw) => normalizeVietnamese(detectedBank).includes(kw)) ||
    accountMatched

  if (!accountMatched) {
    failedReasons.push(`Số tài khoản nhận trên biên lai không phải là STK ${fund.bankAccount} (${fund.bankName}).`)
  }

  const allPassed = isBankingReceipt && codeMatched && amountMatched && recipientMatched && accountMatched

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
    return {
      success: false,
      failedReasons,
      audit: auditSummary,
      message:
        failedReasons.length > 0
          ? failedReasons.join(' ')
          : 'Biên lai không hợp lệ hoặc thiếu thông tin đối soát. Vui lòng kiểm tra lại!',
    }
  }

  return {
    success: true,
    failedReasons: [],
    audit: auditSummary,
    message: `Đối soát thành công 4 yếu tố: Mã nộp tiền (${paymentCode}), Số tiền (${finalDetectedAmount.toLocaleString('vi-VN')} đ), Người nhận (${targetRecipient}), STK (${fund.bankAccount}).`,
  }
}
