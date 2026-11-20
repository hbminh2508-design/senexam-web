import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveDailyLimit } from '@/lib/senaiTiers'
import { getEffectivePlanTier, getTotalSenaiDailyLimit } from '@/lib/vipMembership'
import {
  validateE2eeDisclosureConsent,
  buildSecureSenAiChatPrompt,
  checkSenAiRateLimit,
  sanitizeAiResponse,
} from '@/lib/senChatAi'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }, { status: 401 })
    }

    // 1. Kiểm tra rate limit chống spam/DDoS
    const rateCheck = checkSenAiRateLimit(user.id, 5, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.error, retryAfterSeconds: rateCheck.retryAfterSeconds },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu yêu cầu không hợp lệ' }, { status: 400 })
    }

    const { query, contextMessages, userConfirmed, isGroup } = body

    // 2. Kiểm tra xác nhận rời vòng E2EE
    const consentValidation = validateE2eeDisclosureConsent({
      userConfirmed,
      query,
      selectedContextCount: Array.isArray(contextMessages) ? contextMessages.length : 0,
    })

    if (!consentValidation.allowed) {
      return NextResponse.json(
        { error: consentValidation.error, code: consentValidation.reason },
        { status: 403 }
      )
    }

    // 3. Kiểm tra hạn mức / Quota SenAI hàng ngày
    let userLimit = 10
    let userUsed = 0
    let supabaseAdmin: any = null

    try {
      supabaseAdmin = getSupabaseAdmin()
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
        .eq('id', user.id)
        .maybeSingle()

      const tierDailyLimit = getEffectiveDailyLimit(profile)
      const planTier = getEffectivePlanTier(profile)
      const dailyLimit = getTotalSenaiDailyLimit(tierDailyLimit, planTier)
      userLimit = dailyLimit

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count } = await supabaseAdmin
        .from('senai_question_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      const currentCount = count || 0
      userUsed = currentCount

      if (currentCount >= dailyLimit) {
        return NextResponse.json(
          {
            error: `Bạn đã dùng hết ${dailyLimit} lượt hỏi SenAI hôm nay. Nâng cấp gói tại Quản lý Quota (/new-senai) để hỏi thêm.`,
            used: currentCount,
            limit: dailyLimit,
            remaining: 0,
          },
          { status: 429 }
        )
      }
    } catch (dbErr: any) {
      console.warn('Cảnh báo kiểm tra quota cơ sở dữ liệu:', dbErr?.message)
    }

    // 4. Đóng gói Prompt an toàn: Chống Prompt Injection & Phân tách dữ liệu
    const securePrompt = buildSecureSenAiChatPrompt({
      query: consentValidation.cleanQuery,
      contextMessages: Array.isArray(contextMessages) ? contextMessages : [],
    })

    const apiKey = process.env.GEMINI_API_KEY
    let rawReply = ''

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })
        const res = await model.generateContent(securePrompt.prompt)
        rawReply = res.response.text()
      } catch (err: any) {
        console.warn('Lỗi gọi gemini-3.8-flash, thử gemini-3.5-flash-lite fallback:', err?.message)
        try {
          const genAI = new GoogleGenerativeAI(apiKey)
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' })
          const res = await fallbackModel.generateContent(securePrompt.prompt)
          rawReply = res.response.text()
        } catch (fbErr: any) {
          throw new Error(`Lỗi kết nối dịch vụ AI: ${fbErr?.message || err?.message}`)
        }
      }
    } else {
      // Mock phản hồi trong môi trường dev hoặc khi chưa cấu hình API key
      rawReply = `Chào bạn, tôi là **SenAI**!

Tôi đã nhận được câu hỏi từ bạn: "${consentValidation.cleanQuery}".

Ví dụ công thức Toán học bằng KaTeX:
Nghiệm của phương trình bậc hai $ax^2 + bx + c = 0$ được tính theo công thức:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Nếu cần giải chi tiết hoặc vẽ hình, hãy gửi thêm đề bài cụ thể nhé!`
    }

    // 5. Làm sạch đầu ra chống XSS / script injection, giữ nguyên KaTeX và TikZ
    const cleanReply = sanitizeAiResponse(rawReply)

    // 6. Ghi log câu hỏi vào bảng senai_question_log
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('senai_question_log').insert({ user_id: user.id })
        userUsed += 1
      } catch (logErr: any) {
        console.warn('Ghi log senai_question_log thất bại:', logErr?.message)
      }
    }

    return NextResponse.json({
      success: true,
      reply: cleanReply,
      text: cleanReply,
      senderName: 'SenAI',
      isSenAi: true,
      quota: {
        used: userUsed,
        limit: userLimit,
        remaining: Math.max(0, userLimit - userUsed),
      },
      isGroup: !!isGroup,
    })
  } catch (error: any) {
    console.error('Lỗi Route /api/chat/senai:', error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi xử lý yêu cầu SenAI',
        text: `Đã xảy ra lỗi khi trao đổi với SenAI: ${error.message || 'Vui lòng thử lại sau.'}`,
      },
      { status: 500 }
    )
  }
}
