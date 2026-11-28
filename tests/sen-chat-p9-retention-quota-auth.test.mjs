import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  GROUP_STORAGE_QUOTA_BYTES,
  ATTACHMENT_RETENTION_DAYS,
  validateGroupStorageQuota,
  formatBytes,
} from '../lib/chatLimits.mjs'

// ==============================================================================
// 1. KIỂM THỬ HẠN MỨC DUNG LƯỢNG NHÓM (GROUP STORAGE QUOTA 15GB)
// ==============================================================================
test('Sen Chat P9: Hạn mức dung lượng media nhóm chuẩn xác 15GB (16,106,127,360 bytes)', () => {
  const expected15GB = 15 * 1024 * 1024 * 1024
  assert.equal(GROUP_STORAGE_QUOTA_BYTES, expected15GB)
  assert.equal(GROUP_STORAGE_QUOTA_BYTES, 16106127360)
  assert.equal(formatBytes(GROUP_STORAGE_QUOTA_BYTES), '15GB')

  // Trường hợp dung lượng còn trống nhiều: Cho phép upload
  const result1 = validateGroupStorageQuota(1024 * 1024 * 1024, 50 * 1024 * 1024) // 1GB + 50MB
  assert.equal(result1.allowed, true)
  assert.equal(result1.quota, expected15GB)

  // Trường hợp chuẩn bị chạm mốc: Vừa đủ 15GB
  const currentUsage = expected15GB - (100 * 1024 * 1024) // Còn 100MB
  const result2 = validateGroupStorageQuota(currentUsage, 100 * 1024 * 1024)
  assert.equal(result2.allowed, true, 'Vừa đúng 15GB vẫn được chấp nhận')

  // Trường hợp vượt hạn mức: 15GB + 1 byte -> Từ chối
  const result3 = validateGroupStorageQuota(currentUsage, (100 * 1024 * 1024) + 1)
  assert.equal(result3.allowed, false)
  assert.ok(result3.error?.includes('15GB'), 'Thông báo lỗi phải nêu rõ hạn mức 15GB')
  assert.ok(result3.error?.includes('Trưởng nhóm'), 'Thông báo nhắc trưởng nhóm dọn dẹp')
})

// ==============================================================================
// 2. KIỂM THỬ CHÍNH SÁCH BẢO LƯU TỆP 30 NGÀY VÀ GIA HẠN
// ==============================================================================
test('Sen Chat P9: Chính sách bảo lưu tệp đính kèm 30 ngày mặc định & Gia hạn', () => {
  assert.equal(ATTACHMENT_RETENTION_DAYS, 30)

  // Giả lập tính toán ngày hết hạn của tệp
  const now = new Date('2026-11-20T10:00:00Z').getTime()
  const expiresAt = new Date(now + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const expectedExpires = '2026-12-20T10:00:00.000Z'
  assert.equal(expiresAt, expectedExpires)

  // Gia hạn thêm 30 ngày bởi trưởng nhóm
  const extendedDate = new Date(new Date(expiresAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(extendedDate, '2027-01-19T10:00:00.000Z')
})

// ==============================================================================
// 3. KIỂM THỬ CƠ CHẾ LƯU TRỮ TẠM THỜI (EPHEMERAL MESSAGES CLEANUP)
// ==============================================================================
test('Sen Chat P9: Cơ chế dọn dẹp tin nhắn tạm thời cục bộ bảo vệ riêng tư', () => {
  const storageFilePath = path.join(process.cwd(), 'lib/senChatStorage.ts')
  assert.ok(fs.existsSync(storageFilePath), 'lib/senChatStorage.ts phải tồn tại')
  const storageContent = fs.readFileSync(storageFilePath, 'utf8')

  assert.ok(storageContent.includes('isEphemeralStorageEnabled'), 'Phải có hàm kiểm tra chế độ Ephemeral')
  assert.ok(storageContent.includes('setEphemeralStorageEnabled'), 'Phải có hàm cấu hình chế độ Ephemeral')
  assert.ok(storageContent.includes('clearAllEphemeralMessages'), 'Phải có hàm dọn sạch tin nhắn tạm thời')
  assert.ok(storageContent.includes('clearAllLocalChatData'), 'Phải có hàm xóa toàn bộ dữ liệu khi đăng xuất')
  assert.ok(storageContent.includes('setupEphemeralCleanupListener'), 'Phải có listener beforeunload/pagehide')
  assert.ok(storageContent.includes('pagehide'), 'Phải lắng nghe sự kiện pagehide khi đóng web')
  assert.ok(storageContent.includes('beforeunload'), 'Phải lắng nghe sự kiện beforeunload khi rời trang')
})

// ==============================================================================
// 4. KIỂM THỬ XÁC THỰC SUPABASE & ĐIỀU HƯỚNG SEN IDP QUA RETURNURL
// ==============================================================================
test('Sen Chat P9: Bắt buộc đăng nhập Supabase và chuyển hướng sang /new-idp?returnUrl=...', () => {
  // Kiểm tra route desktop: app/chat/page.tsx
  const desktopChat = fs.readFileSync(path.join(process.cwd(), 'app/chat/page.tsx'), 'utf8')
  assert.ok(
    desktopChat.includes("router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))"),
    'Desktop Chat giữ tham số liên kết mời khi chuyển sang đăng nhập'
  )
  assert.ok(
    desktopChat.includes("onAuthStateChange"),
    'Desktop Chat phải lắng nghe sự kiện đăng xuất realtime'
  )
  assert.ok(
    desktopChat.includes("ChatSettingsModal"),
    'Desktop Chat phải tích hợp modal cài đặt Sen Chat'
  )

  // Kiểm tra route mobile: app/m/chat/page.tsx
  const mobileChat = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(
    mobileChat.includes("router.replace('/new-idp?returnUrl=' + encodeURIComponent(senChatLoginReturnUrl()))"),
    'Mobile Chat giữ tham số liên kết mời khi chuyển sang đăng nhập'
  )
  assert.ok(
    mobileChat.includes("ChatSettingsModal"),
    'Mobile Chat phải tích hợp modal cài đặt Sen Chat'
  )

  // Kiểm tra trang Sen IDP: app/new-idp/page.tsx
  const newIdp = fs.readFileSync(path.join(process.cwd(), 'app/new-idp/page.tsx'), 'utf8')
  assert.ok(
    newIdp.includes("params.get('returnUrl')"),
    'Sen IDP phải hỗ trợ nhận tham số ?returnUrl'
  )
})

// ==============================================================================
// 5. KIỂM THỬ MIGRATION 012 & RLS CHO CHAT_TRANSIT_QUEUE VÀ ATTACHMENTS
// ==============================================================================
test('Sen Chat P9: File migration 012 đầy đủ RLS, RPC 15GB quota và gia hạn tệp', () => {
  const migPath = path.join(process.cwd(), 'migrations/012_sen_chat_retention_and_group_quota.sql')
  assert.ok(fs.existsSync(migPath), 'Migration 012 phải tồn tại')
  const migContent = fs.readFileSync(migPath, 'utf8')

  // Bảng chat_transit_queue
  assert.ok(migContent.includes('public.chat_transit_queue'), 'Phải có bảng chat_transit_queue')
  assert.ok(
    migContent.includes('ALTER TABLE IF EXISTS public.chat_transit_queue ENABLE ROW LEVEL SECURITY;'),
    'Bảng chat_transit_queue phải bật RLS'
  )

  // Cột expires_at & gia hạn
  assert.ok(migContent.includes('expires_at TIMESTAMPTZ'), 'chat_attachments phải có cột expires_at')
  assert.ok(migContent.includes('retention_extended_by'), 'chat_attachments phải có retention_extended_by')
  assert.ok(migContent.includes('is_pinned_permanent'), 'chat_attachments phải có is_pinned_permanent')

  // RPCs
  assert.ok(migContent.includes('get_conversation_storage_usage'), 'Phải có RPC get_conversation_storage_usage')
  assert.ok(migContent.includes('extend_attachment_retention'), 'Phải có RPC extend_attachment_retention')
  assert.ok(migContent.includes('16106127360'), 'Hạn mức 15GB chuẩn xác trong SQL RPC')
})

// ==============================================================================
// 6. KIỂM THỬ API ROUTES MỚI CHO GIA HẠN VÀ TRUY VẤN DUNG LƯỢNG NHÓM
// ==============================================================================
test('Sen Chat P9: API routes gia hạn lưu trữ và kiểm tra dung lượng nhóm tồn tại', () => {
  const extendRoute = path.join(process.cwd(), 'app/api/chat/attachments/extend-retention/route.ts')
  const groupStorageRoute = path.join(process.cwd(), 'app/api/chat/group/storage/route.ts')

  assert.ok(fs.existsSync(extendRoute), 'API extend-retention route phải tồn tại')
  assert.ok(fs.existsSync(groupStorageRoute), 'API group/storage route phải tồn tại')

  const extendContent = fs.readFileSync(extendRoute, 'utf8')
  assert.ok(extendContent.includes('extend_attachment_retention'), 'API extend-retention phải gọi RPC tương ứng')
})

// ==============================================================================
// 7. KIỂM THỬ TUÂN THỦ THƯƠNG HIỆU & KHÔNG XUẤT HIỆN CHỮ CẤM TRONG APP/M/
// ==============================================================================
test('Sen Chat P9: Tuyệt đối không có chữ SC/SenCash trong app/m/chat & Tên duy nhất là Sen Chat', () => {
  const mobileDir = path.join(process.cwd(), 'app/m/chat')
  const mobileFiles = fs.readdirSync(mobileDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))

  for (const file of mobileFiles) {
    const content = fs.readFileSync(path.join(mobileDir, file), 'utf8')
    assert.ok(!content.includes('SenCash'), `Tệp ${file} trong app/m/chat không được chứa chữ SenCash`)
    // Kiểm tra chữ "SC " độc lập
    assert.ok(!/\bSC\b/i.test(content.replace(/SenChat/gi, '')), `Tệp ${file} không được chứa chữ SC độc lập`)
  }

  // Quét toàn bộ codebase các file mới: Tuyệt đối KHÔNG có thương hiệu bên thứ ba (như Zalo)
  const newFiles = [
    'components/chat/ChatSettingsModal.tsx',
    'app/api/chat/attachments/extend-retention/route.ts',
    'app/api/chat/group/storage/route.ts',
    'migrations/012_sen_chat_retention_and_group_quota.sql',
  ]

  for (const relPath of newFiles) {
    const fullPath = path.join(process.cwd(), relPath)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8').toLowerCase()
      assert.ok(!content.includes('zalo'), `Tệp ${relPath} tuyệt đối không được chứa tên thương hiệu bên ngoài`)
    }
  }
})

// ==============================================================================
// 8. KIỂM THỬ SỬA LỖI MIGRATION 013 & SERVICE ROLE AUTH CHO RPC GIA HẠN
// ==============================================================================
test('Sen Chat P9: Migration 013 và Service Role caller auth trong RPC gia hạn', () => {
  const mig13Path = path.join(process.cwd(), 'migrations/013_sen_chat_retention_rpc_auth_fix.sql')
  assert.ok(fs.existsSync(mig13Path), 'Migration 013 phải tồn tại')
  const mig13Content = fs.readFileSync(mig13Path, 'utf8')

  assert.ok(
    mig13Content.includes("auth.role() = 'service_role'"),
    'Migration 013 phải hỗ trợ service_role backend caller'
  )
  assert.ok(
    mig13Content.includes('p_caller_id UUID DEFAULT NULL'),
    'RPC extend_attachment_retention phải nhận p_caller_id'
  )

  const extendRouteContent = fs.readFileSync(
    path.join(process.cwd(), 'app/api/chat/attachments/extend-retention/route.ts'),
    'utf8'
  )
  assert.ok(
    extendRouteContent.includes('p_caller_id: user.id'),
    'API extend-retention route phải truyền p_caller_id: user.id vào RPC'
  )
})

// ==============================================================================
// 9. KIỂM THỬ TOÀN VẸN BIẾN SCOPE TRONG APP/M/CHAT & SESSION LIFECYCLE
// ==============================================================================
test('Sen Chat P9: Kiểm tra không lỗi biến undefined trong mobile chat và cờ session ephemeral', () => {
  const mobileChatContent = fs.readFileSync(path.join(process.cwd(), 'app/m/chat/page.tsx'), 'utf8')
  assert.ok(
    !mobileChatContent.includes('receiverId: user.id'),
    'Không được có biến undefined user.id trong mobile chat'
  )
  assert.ok(
    !mobileChatContent.includes('currentConversation?.isGroup'),
    'Không được có biến undefined currentConversation trong mobile chat'
  )
  assert.ok(
    mobileChatContent.includes('fileInputRef'),
    'Mobile Chat phải có fileInputRef để mở file picker'
  )
  assert.ok(
    mobileChatContent.includes('selectedAttachmentFile'),
    'Mobile Chat phải quản lý selectedAttachmentFile'
  )

  const storageContent = fs.readFileSync(path.join(process.cwd(), 'lib/senChatStorage.ts'), 'utf8')
  assert.ok(
    storageContent.includes('sen_chat_active_session'),
    'Phải có cơ chế session lifecycle token trong sessionStorage'
  )
})
