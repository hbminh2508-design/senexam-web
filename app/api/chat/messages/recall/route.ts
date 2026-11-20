import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { deleteDriveFilesBatch } from '@/lib/senChatDriveService'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const messageId = body?.messageId

    if (!messageId) {
      return NextResponse.json({ error: 'Thiếu messageId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.rpc('recall_chat_message', {
      p_message_id: messageId,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ĐẶC TẢ P4: Khi tin nhắn bị thu hồi, xóa luôn file tương ứng trên Google Drive
    if (data?.drive_file_ids && Array.isArray(data.drive_file_ids) && data.drive_file_ids.length > 0) {
      const driveIdsToDelete = data.drive_file_ids.filter((id: string) => id && !id.startsWith('supabase:'))
      if (driveIdsToDelete.length > 0) {
        deleteDriveFilesBatch(driveIdsToDelete).catch((delErr) => {
          console.error('[SEN_CHAT_RECALL] Lỗi khi dọn dẹp file Drive thu hồi:', delErr)
        })
      }

      // Xóa tệp trên Supabase Storage nếu có
      const supabasePaths = data.drive_file_ids
        .filter((id: string) => id && id.startsWith('supabase:'))
        .map((id: string) => id.replace(/^supabase:/, ''))
      if (supabasePaths.length > 0) {
        supabaseAdmin.storage.from('chat_attachments').remove(supabasePaths).catch(() => {})
      }
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi thu hồi tin nhắn' }, { status: 500 })
  }
}
