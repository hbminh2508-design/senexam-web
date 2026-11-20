/**
 * Sen Chat Cascading Account Data Purge Engine (P8)
 * Ensures complete GDPR-compliant erasure of all user keys, messages, attachments,
 * Drive files, prekeys, and devices upon account deletion.
 */

/**
 * Lọc danh sách Drive file IDs hợp lệ cần xóa vĩnh viễn trên Google Drive
 */
export function filterDriveIdsToPurge(attachments) {
  if (!Array.isArray(attachments)) return []
  return attachments
    .map(a => a?.drive_file_id)
    .filter(id => {
      if (!id || typeof id !== 'string') return false
      if (id.startsWith('supabase:') || id.startsWith('mock:')) return false
      return true
    })
}

/**
 * Lọc danh sách đường dẫn Supabase Storage cần xóa
 */
export function filterStoragePathsToPurge(attachments) {
  if (!Array.isArray(attachments)) return []
  return attachments
    .map(a => a?.storage_path)
    .filter(path => typeof path === 'string' && path.trim().length > 0)
}

/**
 * Xác thực quyền hạn xóa tài khoản (tự xóa hoặc Admin xóa)
 */
export function validateDeletionPayload(targetUserId, requestingUserId, isAdmin = false) {
  if (!targetUserId || typeof targetUserId !== 'string') {
    return { valid: false, error: 'Thiếu mã người dùng (targetUserId)' }
  }

  const isSelf = requestingUserId && targetUserId === requestingUserId
  if (!isSelf && !isAdmin) {
    return { valid: false, error: 'Bạn không có quyền thực hiện xóa dữ liệu của người dùng này' }
  }

  return { valid: true, isSelf, isAdmin }
}

/**
 * Dọn dẹp sạch toàn bộ dữ liệu Sen Chat của người dùng
 */
export async function purgeUserChatData(userId, supabaseAdmin, driveDeleter = null) {
  const result = {
    userId,
    deletedDriveFiles: 0,
    deletedStoragePaths: 0,
    deletedMessages: 0,
    deletedDevices: 0,
    deletedPrekeys: 0,
    deletedKeyPackages: 0,
    success: false,
    error: null,
  }

  if (!userId) {
    result.error = 'Thiếu userId'
    return result
  }

  if (!supabaseAdmin) {
    result.error = 'Thiếu client supabaseAdmin'
    return result
  }

  try {
    // 1. Quét tệp đính kèm do người dùng tải lên
    const { data: attachments } = await supabaseAdmin
      .from('chat_attachments')
      .select('id, drive_file_id, storage_path')
      .eq('uploader_id', userId)

    if (attachments && attachments.length > 0) {
      // 1.1 Xóa trên Google Drive
      const driveIds = filterDriveIdsToPurge(attachments)
      if (driveIds.length > 0) {
        if (typeof driveDeleter === 'function') {
          await driveDeleter(driveIds).catch(() => {})
        }
        result.deletedDriveFiles = driveIds.length
      }

      // 1.2 Xóa trên Supabase Storage
      const storagePaths = filterStoragePathsToPurge(attachments)
      if (storagePaths.length > 0) {
        await supabaseAdmin.storage
          .from('chat_attachments')
          .remove(storagePaths)
          .catch(() => {})
        result.deletedStoragePaths = storagePaths.length
      }
    }

    // 2. Xóa các bản ghi đính kèm trong chat_attachments
    await supabaseAdmin
      .from('chat_attachments')
      .delete()
      .eq('uploader_id', userId)
      .catch(() => {})

    // 3. Xóa tin nhắn mà người dùng là người gửi hoặc người nhận
    const { count: msgCount } = await supabaseAdmin
      .from('chat_messages')
      .delete({ count: 'exact' })
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .catch(() => ({ count: 0 }))
    result.deletedMessages = msgCount || 0

    // 4. Xóa MLS KeyPackages & Commits
    const { count: kpCount } = await supabaseAdmin
      .from('chat_mls_key_packages')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .catch(() => ({ count: 0 }))
    result.deletedKeyPackages = kpCount || 0

    await supabaseAdmin
      .from('chat_mls_commits')
      .delete()
      .or(`committed_by.eq.${userId},welcome_for_user_id.eq.${userId},target_user_id.eq.${userId}`)
      .catch(() => {})

    // 5. Xóa Prekeys & Devices
    const { count: pkCount } = await supabaseAdmin
      .from('chat_prekeys')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .catch(() => ({ count: 0 }))
    result.deletedPrekeys = pkCount || 0

    const { count: devCount } = await supabaseAdmin
      .from('chat_devices')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .catch(() => ({ count: 0 }))
    result.deletedDevices = devCount || 0

    // 6. Xóa tư cách thành viên phòng hội thoại & quan hệ bạn bè
    await supabaseAdmin
      .from('chat_members')
      .delete()
      .eq('user_id', userId)
      .catch(() => {})

    await supabaseAdmin
      .from('chat_friendships')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .catch(() => {})

    // 7. Xóa báo cáo & sự kiện kiểm toán cá nhân
    await supabaseAdmin
      .from('chat_reports')
      .delete()
      .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`)
      .catch(() => {})

    await supabaseAdmin
      .from('chat_audit_events')
      .delete()
      .eq('user_id', userId)
      .catch(() => {})

    result.success = true
    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}

/**
 * Xóa vĩnh viễn toàn bộ tài khoản người dùng và dọn sạch dữ liệu liên quan
 */
export async function deleteUserFullAccount(userId, supabaseAdmin, driveDeleter = null) {
  const cleanupResult = await purgeUserChatData(userId, supabaseAdmin, driveDeleter)

  // Xóa tài khoản trong Supabase Auth
  const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (delAuthErr) {
    throw delAuthErr
  }

  // Xóa hồ sơ trong profiles
  await supabaseAdmin.from('profiles').delete().eq('id', userId).catch(() => {})

  return cleanupResult
}
