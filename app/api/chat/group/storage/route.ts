import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { GROUP_STORAGE_QUOTA_BYTES } from '@/lib/chatLimits'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'Thiếu conversationId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Xác minh người dùng thuộc nhóm này
    const { data: member } = await supabaseAdmin
      .from('chat_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Không có quyền truy cập hội thoại này' }, { status: 403 })
    }

    const { data: usageData, error: usageErr } = await supabaseAdmin.rpc('get_conversation_storage_usage', {
      p_conversation_id: conversationId,
    })

    if (usageErr) {
      return NextResponse.json({ error: usageErr.message }, { status: 500 })
    }

    const usedBytes = Number(usageData?.used_bytes || 0)
    const fileCount = Number(usageData?.file_count || 0)
    const maxQuotaBytes = GROUP_STORAGE_QUOTA_BYTES
    const remainingBytes = Math.max(0, maxQuotaBytes - usedBytes)
    const usagePercent = Math.min(100, (usedBytes / maxQuotaBytes) * 100)

    return NextResponse.json({
      success: true,
      conversationId,
      usedBytes,
      maxQuotaBytes,
      remainingBytes,
      fileCount,
      usagePercent,
      isQuotaExceeded: usedBytes >= maxQuotaBytes,
      userRole: member.role,
    })
  } catch (err: any) {
    console.error('[SEN_CHAT_GROUP_STORAGE] Lỗi:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi máy chủ' }, { status: 500 })
  }
}
