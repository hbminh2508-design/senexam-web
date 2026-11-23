import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getDriveFileStream } from '@/lib/senChatDriveService'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return new NextResponse('Chưa đăng nhập. Vui lòng làm mới trang.', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')
    const driveFileIdParam = searchParams.get('driveFileId')
    const forceDownload = searchParams.get('download') === '1'

    if (!attachmentId && !driveFileIdParam) {
      return new NextResponse('Thiếu attachmentId hoặc driveFileId', { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Tìm thông tin tệp đính kèm trong chat_attachments
    let query = supabaseAdmin
      .from('chat_attachments')
      .select('*')

    if (attachmentId) {
      query = query.eq('id', attachmentId)
    } else if (driveFileIdParam) {
      query = query.eq('drive_file_id', driveFileIdParam)
    }

    const { data: attachment, error: fetchErr } = await query.maybeSingle()

    if (fetchErr || !attachment || attachment.is_deleted) {
      return new NextResponse('Tệp không tồn tại hoặc đã bị thu hồi / tự hủy', { status: 404 })
    }

    // 2. BẢO MẬT: Kiểm tra xem người yêu cầu có phải là thành viên của cuộc hội thoại hay không
    let { data: member } = await supabaseAdmin
      .from('chat_members')
      .select('id')
      .eq('conversation_id', attachment.conversation_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      if (attachment.uploader_id === user.id) {
        try {
          await supabaseAdmin.from('chat_members').insert({
            conversation_id: attachment.conversation_id,
            user_id: user.id,
            role: 'member',
          })
          member = { id: 'uploader_member' }
        } catch {}
      } else {
        const { data: conv } = await supabaseAdmin
          .from('chat_conversations')
          .select('id, type')
          .eq('id', attachment.conversation_id)
          .maybeSingle()
        if (conv && conv.type !== 'group') {
          try {
            await supabaseAdmin.from('chat_members').insert({
              conversation_id: attachment.conversation_id,
              user_id: user.id,
              role: 'member',
            })
            member = { id: 'direct_member' }
          } catch {}
        } else {
          return new NextResponse('Truy cập bị từ chối: Bạn không phải thành viên của cuộc hội thoại này', { status: 403 })
        }
      }
    }

    // 3. Chuẩn bị header phản hồi an toàn
    const responseHeaders = new Headers()
    responseHeaders.set('Accept-Ranges', 'bytes')
    responseHeaders.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    responseHeaders.set('Content-Type', 'application/octet-stream')

    // Tệp mã hóa hoặc SVG/HTML luôn ép buộc tải về dạng attachment (không hiển thị inline)
    responseHeaders.set('Content-Disposition', 'attachment; filename="senchat-encrypted-blob.bin"')

    // 4. STREAM TỆP TỪ NGUỒN LƯU TRỮ TƯƠNG ỨNG
    if (attachment.storage_provider === 'google_drive' || (!attachment.storage_provider && attachment.drive_file_id && !attachment.drive_file_id.startsWith('supabase:'))) {
      const driveFileId = attachment.drive_file_id
      const rangeHeader = request.headers.get('range')

      try {
        const driveResult = await getDriveFileStream(driveFileId, rangeHeader)

        if (driveResult.contentLength) {
          responseHeaders.set('Content-Length', driveResult.contentLength)
        }
        if (driveResult.contentRange) {
          responseHeaders.set('Content-Range', driveResult.contentRange)
        }

        return new NextResponse(driveResult.stream as any, {
          status: driveResult.status || 200,
          headers: responseHeaders,
        })
      } catch (err: any) {
        console.error('[SEN_CHAT_STREAM] Lỗi stream từ Google Drive, thử fallback Supabase Storage:', err)
        // Cơ chế fallback: Nếu Google Drive lỗi tạm thời hoặc bị chặn, tự động thử fallback sang Supabase Storage tương ứng
        const fallbackPath = attachment.storage_path || `attachments/${attachment.id}`
        let { data: fileData } = await supabaseAdmin.storage
          .from('sen-chat-attachments')
          .download(fallbackPath)

        if (!fileData) {
          const fb = await supabaseAdmin.storage
            .from('chat_attachments')
            .download(fallbackPath)
          if (fb.data) fileData = fb.data
        }

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          responseHeaders.set('Content-Length', String(arrayBuffer.byteLength))
          return new NextResponse(Buffer.from(arrayBuffer), {
            status: 200,
            headers: responseHeaders,
          })
        }

        return new NextResponse(`Lỗi tải tệp từ Google Drive: ${err?.message || 'Không thể đọc tệp'}`, { status: 502 })
      }
    } else {
      // Stream từ Supabase Storage
      const storagePath = attachment.storage_path || attachment.drive_file_id.replace(/^supabase:/, '')
      let { data: fileData, error: downloadErr } = await supabaseAdmin.storage
        .from('sen-chat-attachments')
        .download(storagePath)

      if (downloadErr || !fileData) {
        const fallback = await supabaseAdmin.storage
          .from('chat_attachments')
          .download(storagePath)
        if (fallback.data) {
          fileData = fallback.data
          downloadErr = null
        }
      }

      if (downloadErr || !fileData) {
        console.error('[SEN_CHAT_STREAM] Lỗi download từ Supabase Storage:', downloadErr)
        return new NextResponse('Không tìm thấy tệp trong hệ thống lưu trữ', { status: 404 })
      }

      const arrayBuffer = await fileData.arrayBuffer()
      responseHeaders.set('Content-Length', String(arrayBuffer.byteLength))

      return new NextResponse(Buffer.from(arrayBuffer), {
        status: 200,
        headers: responseHeaders,
      })
    }
  } catch (err: any) {
    console.error('[SEN_CHAT_STREAM] Lỗi ngoại lệ hệ thống:', err)
    return new NextResponse(err?.message || 'Lỗi hệ thống khi tải tệp', { status: 500 })
  }
}
