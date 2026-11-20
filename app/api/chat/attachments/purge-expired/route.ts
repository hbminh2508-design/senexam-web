import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { deleteDriveFilesBatch } from '@/lib/senChatDriveService'

export const dynamic = 'force-dynamic'

/**
 * Endpoint dọn dẹp các tệp đính kèm của tin nhắn tự hủy (expired TTL)
 * hoặc tin nhắn đã thu hồi nhưng file Drive chưa xóa hết.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Gọi RPC lấy danh sách file cần dọn dẹp và đánh dấu đã xóa
    const { data, error } = await supabaseAdmin.rpc('get_and_mark_expired_chat_attachments', {
      p_limit: 50,
    })

    if (error) {
      console.error('[SEN_CHAT_PURGE] Lỗi RPC dọn dẹp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const expiredList = data?.expired_attachments || []
    if (expiredList.length === 0) {
      return NextResponse.json({ success: true, purgedCount: 0 })
    }

    // 2. Lọc các file trên Google Drive để xóa vĩnh viễn
    const driveIds = expiredList
      .filter((item: any) => item.drive_file_id && !item.drive_file_id.startsWith('supabase:'))
      .map((item: any) => item.drive_file_id)

    let driveDeleted = 0
    if (driveIds.length > 0) {
      const res = await deleteDriveFilesBatch(driveIds)
      driveDeleted = res.deleted
    }

    // 3. Lọc các file trên Supabase Storage để xóa
    const supabasePaths = expiredList
      .filter((item: any) => item.storage_path)
      .map((item: any) => item.storage_path)

    if (supabasePaths.length > 0) {
      await supabaseAdmin.storage.from('chat_attachments').remove(supabasePaths).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      purgedCount: expiredList.length,
      driveDeleted,
    })
  } catch (err: any) {
    console.error('[SEN_CHAT_PURGE] Lỗi ngoại lệ:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi dọn dẹp tệp hết hạn' }, { status: 500 })
  }
}
