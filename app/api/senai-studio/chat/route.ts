import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectiveSenaiTier } from '@/lib/senaiTiers'

export const dynamic = 'force-dynamic'

type Attachment = { base64: string, mimeType: string, name?: string }

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent')
      .eq('id', user.id)
      .maybeSingle()
    if (getEffectiveSenaiTier(profile) !== 'ultra') {
      return NextResponse.json({ error: 'SenAI Studio chỉ dành cho thành viên SenAI Ultra' }, { status: 403 })
    }

    const { sessionId, message, attachments, deepThink } = (await req.json()) as {
      sessionId?: string
      message: string
      attachments?: Attachment[]
      deepThink?: boolean
    }
    if (!message?.trim() && !(attachments && attachments.length > 0)) {
      return NextResponse.json({ error: 'Thiếu nội dung câu hỏi' }, { status: 400 })
    }

    // Lấy hoặc tạo cuộc trò chuyện — không cho client tự insert để tránh giả mạo session của người khác
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const { data: newSession, error: sessionErr } = await supabaseAdmin
        .from('senai_studio_sessions')
        .insert({ user_id: user.id, title: message.trim().slice(0, 60) || 'Tệp đính kèm' })
        .select('id')
        .single()
      if (sessionErr) throw sessionErr
      activeSessionId = newSession.id
    } else {
      const { data: existing } = await supabaseAdmin.from('senai_studio_sessions').select('id, user_id').eq('id', activeSessionId).maybeSingle()
      if (!existing || existing.user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy cuộc trò chuyện' }, { status: 404 })
    }

    const { data: history } = await supabaseAdmin
      .from('senai_studio_messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true })
      .limit(30)

    await supabaseAdmin.from('senai_studio_messages').insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: 'user',
      content: message || '',
      attachments: attachments?.map(a => ({ name: a.name, mimeType: a.mimeType })) || [],
      deep_think: !!deepThink,
    })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống' }, { status: 500 })

    const genAI = new GoogleGenerativeAI(apiKey)
    // Deep Think dùng model riêng gemini-3.5-flash-lite, còn lại dùng model chuẩn của SenAI
    const model = genAI.getGenerativeModel({ model: deepThink ? 'gemini-3.5-flash-lite' : 'gemini-3.1-flash-lite' })

    const baseInstruction = `Bạn là SenAI Studio — phiên bản đầy đủ tính năng của trợ lý SenAI (SenExam, dữ liệu SenAI 3.1), dành riêng cho thành viên Ultra. Trả lời chính xác, chi tiết, có thể phân tích hình ảnh/tài liệu người dùng gửi kèm. Dùng dấu chấm "." cho phép nhân và dấu phẩy "," cho thập phân, luôn bọc công thức trong $ hoặc $$.`
    const deepThinkInstruction = deepThink
      ? `\n\nCHẾ ĐỘ DEEP THINK ĐANG BẬT: Hãy suy nghĩ từng bước thật kỹ lưỡng trước khi trả lời — phân tích đề bài/câu hỏi từ nhiều góc độ, liệt kê các giả thiết, kiểm tra lại logic và tính toán trước khi đưa ra kết luận cuối cùng. Trình bày rõ các bước suy luận quan trọng, sau đó chốt lại câu trả lời chính xác nhất.`
      : ''

    const historyText = (history || []).map(h => `${h.role === 'user' ? 'Người dùng' : 'SenAI'}: ${h.content}`).join('\n')
    const finalPrompt = `${baseInstruction}${deepThinkInstruction}\n\nLịch sử trò chuyện:\n${historyText}\n\nCâu hỏi mới: ${message || '(xem tệp đính kèm)'}`

    const parts: ({ text: string } | { inlineData: { data: string, mimeType: string } })[] = [{ text: finalPrompt }]
    for (const a of attachments || []) {
      parts.push({ inlineData: { data: a.base64, mimeType: a.mimeType } })
    }

    const result = await model.generateContent(parts)
    const responseText = result.response.text()

    await supabaseAdmin.from('senai_studio_messages').insert({
      session_id: activeSessionId,
      user_id: user.id,
      role: 'model',
      content: responseText,
      deep_think: !!deepThink,
    })
    await supabaseAdmin.from('senai_studio_sessions').update({ updated_at: new Date().toISOString() }).eq('id', activeSessionId)

    return NextResponse.json({ text: responseText, sessionId: activeSessionId })
  } catch (e) {
    console.error('SenAI Studio error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Đã có lỗi xảy ra' }, { status: 500 })
  }
}
