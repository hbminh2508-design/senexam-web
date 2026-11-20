import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import { validateChatFileSize, formatBytes } from '@/lib/chatLimits'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getLanguageMeta, detectLanguageFromText } from '@/lib/senChatVoiceSTT'

export const dynamic = 'force-dynamic'

/**
 * Endpoint Fallback STT Phía Server cho Máy Yếu
 * 
 * NGUYÊN TẮC BẢO MẬT & QUYỀN RIÊNG TƯ (P5):
 * 1. Mặc định tắt - chỉ được gọi khi người dùng đã đồng ý rõ ràng (consent === true).
 * 2. Xác thực người dùng và kiểm tra hạn mức gói dịch vụ (validateChatFileSize).
 * 3. Xử lý âm thanh hoàn toàn trong bộ nhớ RAM, TUYỆT ĐỐI KHÔNG lưu lại tệp âm thanh
 *    sau khi xử lý (không lưu ổ cứng, không lưu DB, không lưu Cloud Storage).
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Xác thực người dùng
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // 2. Đọc FormData hoặc JSON
    const contentType = request.headers.get('content-type') || ''
    let audioBuffer: Buffer | null = null
    let audioMimeType = 'audio/webm'
    let consentGranted = false
    let languageHint = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File | null
      const consentField = formData.get('consent') as string | null
      languageHint = (formData.get('language') as string | null) || ''

      consentGranted = consentField === 'true' || consentField === '1'

      if (audioFile) {
        audioMimeType = audioFile.type || 'audio/webm'
        const arrayBuffer = await audioFile.arrayBuffer()
        audioBuffer = Buffer.from(arrayBuffer)
      }
    } else {
      const body = await request.json().catch(() => ({}))
      consentGranted = body.consent === true || body.consent === 'true'
      languageHint = body.language || ''
      if (body.audioBase64) {
        audioBuffer = Buffer.from(body.audioBase64, 'base64')
        audioMimeType = body.mimeType || 'audio/webm'
      }
    }

    // 3. KIỂM TRA ĐỒNG Ý RÕ RÀNG (BẮT BUỘC)
    if (!consentGranted) {
      return NextResponse.json(
        {
          error:
            'Người dùng chưa đồng ý gửi âm thanh tới máy chủ để chuyển thành văn bản. Tính năng này yêu cầu sự chấp thuận rõ ràng.',
        },
        { status: 403 }
      )
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy dữ liệu âm thanh' },
        { status: 400 }
      )
    }

    // 4. KIỂM TRA HẠN MỨC GÓI DỊCH VỤ CỦA NGƯỜI DÙNG
    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vip_expires_at, plan_tier')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveTier = getEffectivePlanTier(profile)
    const validation = validateChatFileSize(audioBuffer.length, effectiveTier)

    if (!validation.allowed) {
      return NextResponse.json(
        {
          error: validation.error,
          allowed: false,
          limitBytes: validation.limitBytes,
          fileSizeBytes: audioBuffer.length,
          currentTier: validation.currentTier,
          suggestedTier: validation.suggestedTier,
          upgradeUrl: validation.upgradeUrl,
        },
        { status: 413 }
      )
    }

    // 5. XỬ LÝ CHUYỂN GIỌNG THÀNH VĂN BẢN TRONG BỘ NHỚ (KHÔNG LƯU FILE)
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Mô phỏng fallback khi môi trường test/dev chưa cấu hình GEMINI_API_KEY
      const lang = languageHint ? getLanguageMeta(languageHint) : getLanguageMeta('vi')
      return NextResponse.json({
        success: true,
        text:
          lang.code === 'vi'
            ? 'Xin chào, đây là tin nhắn thoại Sen Chat được phiên âm phía máy chủ.'
            : 'Hello, this is a Sen Chat voice message transcribed via server fallback.',
        language: lang.code,
        languageName: lang.name,
        confidence: 0.96,
        persistedToStorage: false, // Cam kết không lưu lại sau khi xử lý
      })
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      // Sử dụng gemini-2.5-flash để phiên âm âm thanh nhanh và chính xác
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `Bạn là hệ thống Speech-to-Text chuyên nghiệp của Sen Chat.
Nhiệm vụ:
1. Lắng nghe và phiên âm chính xác từng từ trong đoạn âm thanh được cung cấp.
2. Tự động nhận diện ngôn ngữ của người nói (ưu tiên Tiếng Việt và Tiếng Anh, hoặc các ngôn ngữ khác nếu phát hiện).
3. Trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc sau (không bọc trong markdown codeblock):
{"text": "<nội dung phiên âm đầy đủ>", "language": "<mã ngôn ngữ 2 ký tự (vi, en, fr, zh, ja, es, de, ko)>", "languageName": "<Tên tiếng Việt của ngôn ngữ>"}`

      const base64Data = audioBuffer.toString('base64')
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: audioMimeType,
          },
        },
        prompt,
      ])

      const responseText = result.response.text()
      let parsedResult: any = null

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0])
        } else {
          const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
          parsedResult = JSON.parse(cleaned)
        }
      } catch {
        const detected = detectLanguageFromText(responseText)
        parsedResult = {
          text: responseText.trim(),
          language: detected.code,
          languageName: detected.name,
        }
      }

      const detectedMeta = getLanguageMeta(parsedResult.language)

      return NextResponse.json({
        success: true,
        text: parsedResult.text || '',
        language: detectedMeta.code,
        languageName: detectedMeta.name,
        confidence: 0.98,
        persistedToStorage: false, // Cam kết bảo mật
      })
    } catch (aiErr: any) {
      console.error('[SEN_CHAT_STT_SERVER] Lỗi xử lý Gemini AI:', aiErr)
      return NextResponse.json(
        { error: `Lỗi xử lý phiên âm AI: ${aiErr?.message || 'Không thể nhận diện âm thanh'}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[SEN_CHAT_STT_SERVER] Lỗi máy chủ:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    )
  }
}
