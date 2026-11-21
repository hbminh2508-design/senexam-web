import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier } from '@/lib/vipMembership'
import {
  validateChatFileSize,
  validateGroupStorageQuota,
  GROUP_STORAGE_QUOTA_BYTES,
  ATTACHMENT_RETENTION_DAYS,
  formatBytes,
} from '@/lib/chatLimits'
import { uploadEncryptedImageToDrive } from '@/lib/senChatDriveService'

export const dynamic = 'force-dynamic'

const uploadRateLimitStore = new Map<string, number[]>()

function checkUploadRateLimit(userId: string, maxReqs = 20, windowMs = 60000): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const list = uploadRateLimitStore.get(userId) || []
  const windowStart = now - windowMs
  const recent = list.filter(t => t > windowStart)
  if (recent.length >= maxReqs) {
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }
  recent.push(now)
  uploadRateLimitStore.set(userId, recent)
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Rate limit tải tệp chống spam / cạn kiệt tài nguyên
    const rateCheck = checkUploadRateLimit(user.id, 20, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Tần suất tải tệp quá nhanh. Vui lòng chờ ${rateCheck.retryAfter} giây.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Đọc thông tin gói dịch vụ từ hồ sơ người dùng để xác định hạn mức tệp
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('vip_expires_at, plan_tier')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveTier = getEffectivePlanTier(profile)

    const contentType = request.headers.get('content-type') || ''

    // 2. XỬ LÝ INTENT PRE-CHECK, PREPARE_UPLOAD HOẶC COMPLETE_DIRECT_UPLOAD
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      const {
        action,
        conversationId,
        fileSizeBytes,
        fileName,
        fileType = 'file',
        storagePath,
        encryptedFileName,
        encryptedMimeType,
        encryptedThumbnail,
        encryptedFileHash,
        messageId,
      } = body

      if (!conversationId || typeof fileSizeBytes !== 'number') {
        return NextResponse.json({ error: 'Thiếu conversationId hoặc fileSizeBytes' }, { status: 400 })
      }

      // Xác minh người dùng là thành viên hội thoại
      const { data: member } = await supabaseAdmin
        .from('chat_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) {
        return NextResponse.json({ error: 'Bạn không phải thành viên của cuộc hội thoại này' }, { status: 403 })
      }

      // Kiểm tra hạn mức dung lượng nhóm 15GB nếu là cuộc trò chuyện nhóm
      const { data: conv } = await supabaseAdmin
        .from('chat_conversations')
        .select('id, type')
        .eq('id', conversationId)
        .maybeSingle()

      if (conv?.type === 'group') {
        const { data: usageData } = await supabaseAdmin.rpc('get_conversation_storage_usage', {
          p_conversation_id: conversationId,
          p_caller_id: user.id,
        })
        const usedBytes = Number(usageData?.used_bytes || 0)
        const groupValidation = validateGroupStorageQuota(usedBytes, fileSizeBytes)
        if (!groupValidation.allowed) {
          return NextResponse.json(
            {
              error: groupValidation.error,
              allowed: false,
              isGroupQuotaExceeded: true,
              groupUsedBytes: usedBytes,
              groupQuotaBytes: GROUP_STORAGE_QUOTA_BYTES,
            },
            { status: 413 }
          )
        }
      }

      // Kiểm tra hạn mức kích thước tệp theo gói
      const validation = validateChatFileSize(fileSizeBytes, effectiveTier)
      if (!validation.allowed) {
        return NextResponse.json(
          {
            error: validation.error,
            allowed: false,
            limitBytes: validation.limitBytes,
            fileSizeBytes: validation.fileSizeBytes,
            currentTier: validation.currentTier,
            suggestedTier: validation.suggestedTier,
            upgradeUrl: validation.upgradeUrl,
          },
          { status: 413 }
        )
      }

      // NẾU LÀ ACTION PREPARE_UPLOAD (Chuẩn bị upload trực tiếp lên Storage cho file lớn)
      if (action === 'prepare_upload') {
        const generatedPath = `${conversationId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.enc`
        const storageBucket = 'sen-chat-attachments'
        try {
          await supabaseAdmin.storage.createBucket(storageBucket, { public: false })
        } catch {}
        try {
          await supabaseAdmin.storage.createBucket('chat_attachments', { public: false })
        } catch {}

        let signedUploadUrl: string | null = null
        let signedToken: string | null = null
        try {
          const { data: signedData } = await supabaseAdmin.storage
            .from(storageBucket)
            .createSignedUploadUrl(generatedPath)
          if (signedData) {
            signedUploadUrl = signedData.signedUrl
            signedToken = signedData.token
          } else {
            // Fallback sang bucket chat_attachments
            const { data: fallbackSigned } = await supabaseAdmin.storage
              .from('chat_attachments')
              .createSignedUploadUrl(generatedPath)
            if (fallbackSigned) {
              signedUploadUrl = fallbackSigned.signedUrl
              signedToken = fallbackSigned.token
            }
          }
        } catch (sErr) {
          console.warn('[SEN_CHAT_UPLOAD] createSignedUploadUrl warning:', sErr)
        }

        return NextResponse.json({
          allowed: true,
          limitBytes: validation.limitBytes,
          currentTier: validation.currentTier,
          storageProvider: 'supabase_storage',
          storageBucket,
          storagePath: generatedPath,
          signedUploadUrl,
          token: signedToken,
        })
      }

      // NẾU LÀ ACTION COMPLETE_DIRECT_UPLOAD (Sau khi client đã upload blob lên Supabase Storage)
      if (action === 'complete_direct_upload') {
        if (!storagePath) {
          return NextResponse.json({ error: 'Thiếu storagePath của tệp đã tải lên' }, { status: 400 })
        }

        const driveFileId = `supabase:${storagePath}`

        const { data: attachmentRecord, error: dbErr } = await supabaseAdmin
          .from('chat_attachments')
          .insert({
            conversation_id: conversationId,
            message_id: messageId || null,
            uploader_id: user.id,
            drive_file_id: driveFileId,
            storage_provider: 'supabase_storage',
            storage_path: storagePath,
            encrypted_file_hash: encryptedFileHash || 'sha256-unverified',
            file_size_bytes: fileSizeBytes,
            mime_type: 'application/octet-stream',
            file_name_encrypted: encryptedFileName || null,
            mime_type_encrypted: encryptedMimeType || null,
            thumbnail_encrypted: encryptedThumbnail || null,
            is_deleted: false,
            expires_at: new Date(Date.now() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            is_pinned_permanent: false,
          })
          .select()
          .single()

        if (dbErr) {
          console.error('[SEN_CHAT_UPLOAD] Lỗi lưu metadata chat_attachments:', dbErr)
          return NextResponse.json({ error: 'Lỗi ghi nhận metadata tệp' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          attachment: {
            id: attachmentRecord.id,
            driveFileId,
            storageProvider: 'supabase_storage',
            storagePath,
            fileSizeBytes,
            createdAt: attachmentRecord.created_at,
            expiresAt: attachmentRecord.expires_at,
          },
        })
      }

      return NextResponse.json({
        allowed: true,
        limitBytes: validation.limitBytes,
        currentTier: validation.currentTier,
      })
    }

    // 3. XỬ LÝ TẢI LÊN MULTIPART/FORM-DATA THỰC TẾ
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string | null
    const fileType = (formData.get('fileType') as string | null) || 'file'
    const declaredSize = parseInt(formData.get('fileSizeBytes') as string || '0', 10)
    const encryptedFileName = formData.get('encryptedFileName') as string || ''
    const encryptedMimeType = formData.get('encryptedMimeType') as string || ''
    const encryptedThumbnail = formData.get('encryptedThumbnail') as string || ''
    const encryptedFileHash = formData.get('encryptedFileHash') as string || ''
    const messageId = formData.get('messageId') as string || null

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Thiếu file dữ liệu hoặc conversationId' }, { status: 400 })
    }

    // Xác minh người dùng là thành viên hội thoại
    const { data: member } = await supabaseAdmin
      .from('chat_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Bạn không phải thành viên của cuộc hội thoại này' }, { status: 403 })
    }

    // KIỂM TRA HẠN MỨC SERVER-SIDE (TUYỆT ĐỐI KHÔNG TIN CLIENT)
    // Kiểm tra cả declaredSize và actual file.size từ stream blob nhận được
    const actualSizeBytes = file.size
    const validationDeclared = validateChatFileSize(declaredSize || actualSizeBytes, effectiveTier)
    const validationActual = validateChatFileSize(actualSizeBytes, effectiveTier)

    if (!validationDeclared.allowed || !validationActual.allowed) {
      const failValidation = !validationActual.allowed ? validationActual : validationDeclared
      return NextResponse.json(
        {
          error: failValidation.error,
          allowed: false,
          limitBytes: failValidation.limitBytes,
          fileSizeBytes: actualSizeBytes,
          currentTier: failValidation.currentTier,
          suggestedTier: failValidation.suggestedTier,
          upgradeUrl: failValidation.upgradeUrl,
        },
        { status: 413 }
      )
    }

    // KIỂM TRA HẠN MỨC DUNG LƯỢNG NHÓM 15GB NẾU LÀ GROUP CONVERSATION
    const { data: convData } = await supabaseAdmin
      .from('chat_conversations')
      .select('id, type')
      .eq('id', conversationId)
      .maybeSingle()

    if (convData?.type === 'group') {
      const { data: usageData } = await supabaseAdmin.rpc('get_conversation_storage_usage', {
        p_conversation_id: conversationId,
        p_caller_id: user.id,
      })
      const usedBytes = Number(usageData?.used_bytes || 0)
      const groupValidation = validateGroupStorageQuota(usedBytes, actualSizeBytes)
      if (!groupValidation.allowed) {
        return NextResponse.json(
          {
            error: groupValidation.error,
            allowed: false,
            isGroupQuotaExceeded: true,
            groupUsedBytes: usedBytes,
            groupQuotaBytes: GROUP_STORAGE_QUOTA_BYTES,
          },
          { status: 413 }
        )
      }
    }

    // Chuyển File sang Buffer nhị phân
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let driveFileId: string | null = null
    let storageProvider: 'google_drive' | 'supabase_storage' = 'google_drive'
    let storagePath: string | null = null

    // 4. ĐIỀU PHỐI NƠI LƯU TRỮ THEO ĐẶC TẢ P4:
    // - Ảnh: Luôn lưu qua Google Drive API (chỉ chứa blob mã hóa nhị phân).
    // - Video và các tệp khác: Lưu trữ qua Supabase Storage.
    if (fileType === 'image') {
      try {
        const driveResult = await uploadEncryptedImageToDrive({
          buffer,
          fileName: `senchat-img-${Date.now()}-${user.id.substring(0, 8)}.enc`,
          mimeType: 'application/octet-stream',
        })
        driveFileId = driveResult.fileId
        storageProvider = 'google_drive'
      } catch (driveErr: any) {
        console.error('[SEN_CHAT_UPLOAD] Lỗi tải lên Google Drive:', driveErr)
        return NextResponse.json(
          { error: `Lỗi kết nối lưu trữ Google Drive: ${driveErr?.message || 'Không thể lưu trữ tệp'}` },
          { status: 502 }
        )
      }
    } else {
      // Video và tệp khác: Lưu qua Supabase Storage bucket 'chat_attachments'
      storageProvider = 'supabase_storage'
      const filePath = `${conversationId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.enc`

      // Đảm bảo bucket tồn tại
      try {
        await supabaseAdmin.storage.createBucket('chat_attachments', { public: false })
      } catch {}

      const { data: storageUpload, error: storageErr } = await supabaseAdmin.storage
        .from('chat_attachments')
        .upload(filePath, buffer, {
          contentType: 'application/octet-stream',
          upsert: true,
        })

      if (storageErr) {
        console.error('[SEN_CHAT_UPLOAD] Lỗi Supabase Storage:', storageErr)
        return NextResponse.json(
          { error: `Lỗi tải lên tệp: ${storageErr.message}` },
          { status: 500 }
        )
      }

      storagePath = filePath
      driveFileId = `supabase:${filePath}`
    }

    // 5. GHI RECORD VÀO BẢNG CHAT_ATTACHMENTS
    const { data: attachmentRecord, error: dbErr } = await supabaseAdmin
      .from('chat_attachments')
      .insert({
        conversation_id: conversationId,
        message_id: messageId || null,
        uploader_id: user.id,
        drive_file_id: driveFileId,
        storage_provider: storageProvider,
        storage_path: storagePath,
        encrypted_file_hash: encryptedFileHash || 'sha256-unverified',
        file_size_bytes: actualSizeBytes,
        mime_type: 'application/octet-stream',
        file_name_encrypted: encryptedFileName || null,
        mime_type_encrypted: encryptedMimeType || null,
        thumbnail_encrypted: encryptedThumbnail || null,
        is_deleted: false,
        expires_at: new Date(Date.now() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        is_pinned_permanent: false,
      })
      .select()
      .single()

    if (dbErr) {
      console.error('[SEN_CHAT_UPLOAD] Lỗi lưu metadata chat_attachments:', dbErr)
      return NextResponse.json({ error: 'Lỗi ghi nhận metadata tệp' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachmentRecord.id,
        driveFileId,
        storageProvider,
        storagePath,
        fileSizeBytes: actualSizeBytes,
        createdAt: attachmentRecord.created_at,
        expiresAt: attachmentRecord.expires_at,
      },
    })
  } catch (err: any) {
    console.error('[SEN_CHAT_UPLOAD] Lỗi xử lý ngoại lệ:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý tệp tải lên' }, { status: 500 })
  }
}
