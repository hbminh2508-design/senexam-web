import { GoogleGenAI } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveSenaiTier, SENAI_TIER_LABEL, type SenAiTierCode } from '@/lib/senaiTiers'

export const dynamic = 'force-dynamic'

const apiKey = process.env.GEMINI_API_KEY

// In-memory fallback tracking nếu bảng sengraph_ai_log chưa tạo trong database
const memUsage = new Map<string, number>()
function getMemoryUsage(userId: string, dateStr: string): number {
  return memUsage.get(`${userId}_${dateStr}`) || 0
}
function recordMemoryUsage(userId: string, dateStr: string) {
  const key = `${userId}_${dateStr}`
  memUsage.set(key, (memUsage.get(key) || 0) + 1)
}

// 🎯 HỆ THỐNG PROMPT ĐÃ TỐI ƯU HÓA TOKEN: NGẮN GỌN, SÚC TÍCH, CHUYÊN SÂU TOÁN HỌC & MẶT CẮT
const SENGRAPH_SYSTEM_PROMPT = `Bạn là Sen AI — Trợ lý Toán học & Đồ thị của SenGraph (SenExam).
Nhiệm vụ:
1. Nhận diện đề bài từ văn bản/ảnh (khảo sát hàm số, cực trị, tiệm cận, mặt cong 3D, thiết diện/mặt cắt, thể tích khối tròn xoay).
2. Trình bày lời giải sư phạm, đi thẳng vào các bước trọng tâm, súc tích, tránh dài dòng thừa thãi để tiết kiệm token.
3. Luôn bọc công thức toán học trong dấu $ (inline) hoặc $$ (block) để KaTeX hiển thị đẹp.
4. ĐẶC BIỆT KHI PHÂN TÍCH MẶT CONG 3D & MẶT CẮT (CROSS-SECTIONS):
   - Nêu rõ tên dạng hình khối (Paraboloid, Ellipsoid, Khối nón, Mặt yên ngựa, Trụ tròn xoay, v.v.).
   - Phân tích thiết diện khi cắt bởi mặt phẳng $z = c$ (level curves/đường đồng mức), $x = c$, $y = c$.
   - Giải thích cách xếp chồng hoặc quay các mặt cắt để dựng nên hình khối 3D hoàn chỉnh.
5. BẮT BUỘC: Đính kèm khối JSON sau ở cuối bài giải để SenGraph tự động nạp phương trình:
\`\`\`sen-graph-equations
{
  "mode": "2d", // "2d" hoặc "3d"
  "title": "Tên hình vẽ",
  "equations": ["y = x^2", "z = x^2 + y^2"],
  "explanation": "Mô tả ngắn gọn đồ thị"
}
\`\`\`
Quy tắc phương trình: 2D dạng "y = <biểu thức x>", 3D dạng "z = <biểu thức x, y>". Dùng ký hiệu: ^, sin, cos, tan, sqrt, abs, ln, exp, pi, e.`

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        tier: 'free',
        tierLabel: 'Chưa đăng nhập',
        dailyLimit: 0,
        usedToday: 0,
        remaining: 0,
        isAdmin: false,
        eligible: false,
      })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, email, senai_tier, senai_tier_expires_at, senai_tier_permanent')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin =
      profile?.role === 'admin' ||
      profile?.role === 'collab' ||
      profile?.email === 'hoangbinhminh2508@gmail.com'

    const tier: SenAiTierCode = getEffectiveSenaiTier(profile)
    const eligible = isAdmin || tier === 'plus' || tier === 'ultra' || tier === 'max'
    const dailyLimit = isAdmin ? 9999 : tier === 'max' ? 15 : tier === 'ultra' ? 5 : tier === 'plus' ? 1 : 0

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const dateKey = startOfToday.toISOString().slice(0, 10)

    let usedToday = 0
    try {
      const { count, error } = await supabaseAdmin
        .from('sengraph_ai_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      if (error) {
        usedToday = getMemoryUsage(user.id, dateKey)
      } else {
        usedToday = count || 0
      }
    } catch {
      usedToday = getMemoryUsage(user.id, dateKey)
    }

    const remaining = isAdmin ? 9999 : Math.max(0, dailyLimit - usedToday)

    return NextResponse.json({
      authenticated: true,
      tier,
      tierLabel: SENAI_TIER_LABEL[tier] || 'Miễn phí',
      dailyLimit,
      usedToday,
      remaining,
      isAdmin,
      eligible,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Lỗi kiểm tra hạn mức' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    // ==============================================================
    // 1. XÁC THỰC NGƯỜI DÙNG & KIỂM TRA HẠNG SENAI (PLUS / ULTRA)
    // ==============================================================
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json(
        {
          error: 'AUTH_REQUIRED',
          reply:
            '🔒 **Yêu cầu đăng nhập tài khoản SenExam**\n\nBạn cần đăng nhập để sử dụng trợ lý **Sen AI Toán Học**. Tính năng giải đề và dựng đồ thị từ ảnh dành riêng cho thành viên **SenAI Plus** (1 câu / ngày) và **SenAI Ultra** (5 câu / ngày).',
        },
        { status: 401 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, email, senai_tier, senai_tier_expires_at, senai_tier_permanent')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin =
      profile?.role === 'admin' ||
      profile?.role === 'collab' ||
      profile?.email === 'hoangbinhminh2508@gmail.com'

    const tier: SenAiTierCode = getEffectiveSenaiTier(profile)

    // Chỉ người dùng SenAI Plus trở lên (hoặc Admin) mới được sử dụng
    if (!isAdmin && tier !== 'plus' && tier !== 'ultra' && tier !== 'max') {
      return NextResponse.json(
        {
          error: 'TIER_REQUIRED',
          reply: `🔒 **Nâng cấp gói để sử dụng Sen AI Toán Học**\n\nHiện tại tài khoản của bạn đang ở gói: **${SENAI_TIER_LABEL[tier] || 'Miễn phí'}**.\n\nTheo quy định hệ thống, công cụ phân tích giải đề & dựng đồ thị Sen AI chỉ mở cho:\n- ⭐ **SenAI Plus**: **1 câu hỏi / ngày**\n- 💎 **SenAI Ultra**: **5 câu hỏi / ngày**\n- 👑 **Sen Max**: **15 câu hỏi / ngày**\n- 👑 **Admin / Collab**: Không giới hạn\n\nVui lòng nâng cấp gói tại [Ví Sen](/new-sencash) để kích hoạt ngay!`,
          tier,
        },
        { status: 403 }
      )
    }

    // Xác định hạn mức câu hỏi trong ngày
    const dailyLimit = isAdmin ? 9999 : tier === 'max' ? 15 : tier === 'ultra' ? 5 : 1

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const dateKey = startOfToday.toISOString().slice(0, 10)

    let usedToday = 0
    let canUseDbLog = true
    try {
      const { count, error } = await supabaseAdmin
        .from('sengraph_ai_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      if (error) {
        canUseDbLog = false
        usedToday = getMemoryUsage(user.id, dateKey)
      } else {
        usedToday = count || 0
      }
    } catch {
      canUseDbLog = false
      usedToday = getMemoryUsage(user.id, dateKey)
    }

    if (!isAdmin && usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          reply: `⏳ **Bạn đã sử dụng hết lượt hỏi hôm nay (${dailyLimit}/${dailyLimit} câu)**\n\n- Gói tài khoản hiện tại: **${SENAI_TIER_LABEL[tier]}** (Hạn mức: **${dailyLimit} câu / ngày**).\n- Lượt hỏi của bạn sẽ được làm mới tự động vào lúc **00:00** ngày mai.\n${
            tier === 'plus'
              ? '- 💡 *Mẹo: Nâng cấp lên gói **SenAI Ultra** tại [Ví Sen](/new-sencash) để nhận **5 câu hỏi / ngày** và toàn quyền sử dụng xưởng đề SenAI Studio!*'
              : ''
          }`,
          quota: {
            tier,
            limit: dailyLimit,
            used: usedToday,
            remaining: 0,
          },
        },
        { status: 429 }
      )
    }

    // ==============================================================
    // 2. PARSE BODY & KIỂM TRA ĐẦU VÀO
    // ==============================================================
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const {
      message = '',
      equations = [],
      mode = '2d',
      imageBase64,
      imageMimeType = 'image/jpeg',
      renderType = 'auto',
    } = body

    if (!message && (!equations || equations.length === 0) && !imageBase64) {
      return NextResponse.json({ error: 'Thiếu câu hỏi, phương trình hoặc ảnh đề bài để phân tích' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({
        reply: 'Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng liên hệ quản trị viên.',
        error: 'NO_API_KEY',
      })
    }

    // ==============================================================
    // 3. TỐI ƯU HÓA PROMPT (NGẮN GỌN TIẾT KIỆM TOKEN)
    // ==============================================================
    let graphContext = `[Đồ thị ${mode.toUpperCase()}]: `
    if (equations && equations.length > 0) {
      const eqStrs = equations
        .map((eq: any) => (typeof eq === 'string' ? eq : eq.expr || eq.expression || ''))
        .filter(Boolean)
      graphContext += `Các hàm: ${eqStrs.join('; ')}. `
    } else {
      graphContext += 'Chưa có hàm số. '
    }

    if (renderType === 'curve') graphContext += 'Ưu tiên: chỉ xuất đường cong chính. '
    else if (renderType === 'full') graphContext += 'Ưu tiên: xuất cả hình vẽ/thiết diện. '

    const userPromptText =
      message ||
      (imageBase64
        ? 'Phân tích đề trong ảnh, giải súc tích từng bước và xuất phương trình vẽ hình/mặt cắt 3D.'
        : 'Phân tích dạng hình học, thiết diện và tính chất của đồ thị trên.')

    const fullPrompt = `${graphContext}\n[Yêu cầu]: ${userPromptText}`

    let responseText = ''

    // Chuẩn bị dữ liệu hình ảnh (nếu có)
    let inlineDataPart: any = null
    if (imageBase64) {
      let rawBase64 = imageBase64
      let detectedMime = imageMimeType || 'image/jpeg'
      if (rawBase64.includes(';base64,')) {
        const [meta, data] = rawBase64.split(';base64,')
        rawBase64 = data
        const mimeMatch = meta.match(/data:([^;]+)/)
        if (mimeMatch) detectedMime = mimeMatch[1]
      }
      inlineDataPart = {
        inlineData: {
          data: rawBase64,
          mimeType: detectedMime,
        },
      }
    }

    // ==============================================================
    // 4. GỌI GEMINI 3.5 FLASH LITE VỚI GIỚI HẠN MAX TOKEN TIẾT KIỆM
    // ==============================================================
    try {
      const ai = new GoogleGenAI({ apiKey })
      const contents: any[] = []
      const parts: any[] = []
      if (inlineDataPart) parts.push(inlineDataPart)
      parts.push({ text: fullPrompt })
      contents.push({ role: 'user', parts })

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents,
        config: {
          systemInstruction: SENGRAPH_SYSTEM_PROMPT,
          maxOutputTokens: 1200, // Tối ưu: khống chế token tối đa, tránh câu trả lời tràn lan
          temperature: 0.2, // Nhiệt độ thấp cho kết quả toán học chính xác và chuẩn mực
        },
      })
      responseText = res.text ?? ''
    } catch (sdkErr: any) {
      console.warn('Lỗi gọi SDK GoogleGenAI gemini-3.5-flash-lite, thử fallback:', sdkErr?.message)
      try {
        const legacyAI = new GoogleGenerativeAI(apiKey)
        const model = legacyAI.getGenerativeModel({
          model: 'gemini-3.5-flash-lite',
          generationConfig: {
            maxOutputTokens: 1200,
            temperature: 0.2,
          },
        })
        const legacyParts: any[] = []
        if (inlineDataPart) legacyParts.push(inlineDataPart)
        legacyParts.push(`${SENGRAPH_SYSTEM_PROMPT}\n\n${fullPrompt}`)
        const res = await model.generateContent(legacyParts)
        responseText = res.response.text()
      } catch (fallbackErr: any) {
        throw new Error(`Không thể kết nối Gemini 3.5 Flash Lite: ${fallbackErr.message || sdkErr.message}`)
      }
    }

    // ==============================================================
    // 5. GHI NHẬN LƯỢT SỬ DỤNG HẠN MỨC
    // ==============================================================
    if (!isAdmin) {
      if (canUseDbLog) {
        try {
          await supabaseAdmin.from('sengraph_ai_log').insert({ user_id: user.id })
        } catch {
          recordMemoryUsage(user.id, dateKey)
        }
      } else {
        recordMemoryUsage(user.id, dateKey)
      }
    }

    // ==============================================================
    // 6. BÓC TÁCH KHỐI PHƯƠNG TRÌNH SEN-GRAPH-EQUATIONS
    // ==============================================================
    let extractedEquations: any = null
    try {
      const match = responseText.match(/```(?:sen-graph-equations|json)\s*([\s\S]*?)\s*```/)
      if (match) {
        const parsed = JSON.parse(match[1])
        if (parsed.equations && Array.isArray(parsed.equations)) {
          extractedEquations = parsed
        }
      }
    } catch {
      // Bỏ qua nếu parse JSON không thành công
    }

    const newUsed = usedToday + 1
    const remaining = isAdmin ? 9999 : Math.max(0, dailyLimit - newUsed)

    return NextResponse.json({
      success: true,
      reply: responseText,
      extractedEquations,
      model: 'gemini-3.5-flash-lite',
      quota: {
        tier,
        limit: dailyLimit,
        used: newUsed,
        remaining,
        isAdmin,
      },
    })
  } catch (error: any) {
    console.error('Lỗi API SenGraph AI:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Lỗi xử lý AI',
        reply: `Đã xảy ra lỗi khi trao đổi với Sen AI: ${error?.message || 'Vui lòng thử lại sau.'}`,
      },
      { status: 500 }
    )
  }
}
