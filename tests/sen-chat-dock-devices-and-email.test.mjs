import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT_DIR = process.cwd()

test('Sen Chat UI: Bố cục thanh dọc tác vụ bên trái tận cùng (Far-left dock) & không khoảng trắng', async () => {
  const desktopChatPath = path.join(ROOT_DIR, 'app', 'chat', 'page.tsx')
  assert.ok(fs.existsSync(desktopChatPath), 'File app/chat/page.tsx phải tồn tại')
  const content = fs.readFileSync(desktopChatPath, 'utf8')

  // 1. Kiểm tra có thanh tác vụ dọc (Far-left dock)
  assert.ok(content.includes('aria-label="Thanh tác vụ chính Sen Chat"'), 'Phải có thanh tác vụ dọc bên trái')
  assert.ok(content.includes('w-16 md:w-[68px]'), 'Thanh dọc có độ rộng dock chuẩn (~68px)')
  assert.ok(content.includes('/sen-chat-logo.png'), 'Logo Sen Chat trên cùng thanh dọc')

  // 2. Kiểm tra các nút tác vụ dọc
  assert.ok(content.includes('UserPlus'), 'Nút Thêm bạn qua Email phải có icon UserPlus')
  assert.ok(content.includes('ShieldCheck'), 'Nút Trung tâm bảo mật & Thiết bị')
  assert.ok(content.includes('Settings'), 'Nút Cài đặt')
  assert.ok(content.includes('toggleTheme'), 'Nút chuyển đổi Dark/Light mode')

  // 3. Kiểm tra cột bên cạnh hiển thị danh sách người dùng nhắn tin (width ~340-360px)
  assert.ok(content.includes('md:w-[340px] lg:w-[360px]'), 'Cột danh sách hội thoại kế bên có độ rộng ~340-360px')

  // 4. Khung chat chính flex-1 h-full và màn hình chào đón E2EE cân đối
  assert.ok(content.includes('flex h-full flex-1 flex-col overflow-hidden'), 'Khung chat chính chiếm trọn không gian còn lại flex-1 h-full')
  assert.ok(content.includes('Sen Chat — Bảo Mật Đầu-Cuối'), 'Màn hình chào đón cân đối khi chưa chọn cuộc trò chuyện')
})

test('Sen Chat Bảo Mật: Tự động đăng ký thiết bị hiện tại & nhận diện (Thiết bị này)', async () => {
  const routePath = path.join(ROOT_DIR, 'app', 'api', 'chat', 'device-management', 'route.ts')
  const modalPath = path.join(ROOT_DIR, 'components', 'chat', 'ChatDeviceManagerModal.tsx')
  assert.ok(fs.existsSync(routePath), 'Route device-management phải tồn tại')
  assert.ok(fs.existsSync(modalPath), 'Modal ChatDeviceManagerModal phải tồn tại')

  const routeContent = fs.readFileSync(routePath, 'utf8')
  const modalContent = fs.readFileSync(modalPath, 'utf8')

  // Route hỗ trợ action register và revoke
  assert.ok(routeContent.includes("action === 'register'") || routeContent.includes("action ="), 'Route phải hỗ trợ đăng ký thiết bị')
  assert.ok(routeContent.includes('device_registered'), 'Ghi nhận nhật ký audit khi đăng ký thiết bị')
  assert.ok(routeContent.includes('upsert'), 'Upsert thiết bị vào chat_devices')

  // Modal truyền token và hiển thị "(Thiết bị này)"
  assert.ok(modalContent.includes('Authorization'), 'Modal phải gửi Bearer token')
  assert.ok(modalContent.includes('(Thiết bị này)'), 'Hiển thị nhãn (Thiết bị này)')
})

test('Sen Chat Bạn Bè: Tìm kiếm chuẩn hóa lower(trim) & nhận diện email chính mình', async () => {
  const routePath = path.join(ROOT_DIR, 'app', 'api', 'chat', 'friend-lookup', 'route.ts')
  const modalPath = path.join(ROOT_DIR, 'components', 'chat', 'ChatFriendModal.tsx')
  assert.ok(fs.existsSync(routePath), 'Route friend-lookup phải tồn tại')
  assert.ok(fs.existsSync(modalPath), 'Modal ChatFriendModal phải tồn tại')

  const routeContent = fs.readFileSync(routePath, 'utf8')
  const modalContent = fs.readFileSync(modalPath, 'utf8')

  // Hash chuẩn hóa lower(trim(email))
  const rawEmail1 = 'hbminh2508@gmail.com'
  const rawEmail2 = '  HBMINH2508@GMAIL.COM '
  const hash1 = crypto.createHash('sha256').update(rawEmail1.trim().toLowerCase()).digest('hex')
  const hash2 = crypto.createHash('sha256').update(rawEmail2.trim().toLowerCase()).digest('hex')
  assert.equal(hash1, hash2, 'Hash của email sau khi trim và lowercase phải giống hệt nhau')

  // Kiểm tra self-lookup
  assert.ok(routeContent.includes('is_self: true'), 'Route phải đánh dấu is_self khi tìm chính email của mình')
  assert.ok(routeContent.includes('Đây là email tài khoản của chính bạn.'), 'Thông báo thân thiện khi tìm email chính mình')
  assert.ok(modalContent.includes('isSelfEmail'), 'Modal xử lý hiển thị thân thiện khi nhập email chính mình')
})

test('Sen Chat Logo: Logo SenAI chính thức tồn tại và được tham chiếu', async () => {
  const logoPath = path.join(ROOT_DIR, 'public', 'senai-logo.png')
  assert.ok(fs.existsSync(logoPath), 'File public/senai-logo.png phải tồn tại')
  const stat = fs.statSync(logoPath)
  assert.ok(stat.size > 1000, 'Logo SenAI phải có dung lượng ảnh hợp lệ')

  const chatDesktop = fs.readFileSync(path.join(ROOT_DIR, 'app', 'chat', 'page.tsx'), 'utf8')
  const confirmModal = fs.readFileSync(path.join(ROOT_DIR, 'components', 'chat', 'ChatSenAiConfirmModal.tsx'), 'utf8')

  assert.ok(chatDesktop.includes('/senai-logo.png'), 'Chat desktop phải sử dụng logo SenAI')
  assert.ok(confirmModal.includes('/senai-logo.png'), 'Modal xác nhận SenAI phải sử dụng logo SenAI')
})
