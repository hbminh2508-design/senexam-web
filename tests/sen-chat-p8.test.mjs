import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

import {
  sanitizeChatAuditPayload,
  validateAndFormatAuditEvent,
  VALID_AUDIT_EVENT_TYPES,
  SENSITIVE_KEY_PATTERNS,
} from '../lib/senChatAudit.mjs'

import {
  filterDriveIdsToPurge,
  filterStoragePathsToPurge,
  validateDeletionPayload,
  purgeUserChatData,
  deleteUserFullAccount,
} from '../lib/senChatAccountCleanup.mjs'

// ==============================================================================
// 1. KIỂM TRA BẢO MẬT: PHỦ KÍN ROW LEVEL SECURITY (RLS) TRÊN TOÀN BỘ BẢNG CHAT_*
// ==============================================================================
test('Sen Chat P8: Toàn bộ bảng chat_* đều được kích hoạt Row Level Security (RLS)', () => {
  const migrationsDir = path.join(process.cwd(), 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))

  const allSqlContent = files
    .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
    .join('\n')

  // Tìm tất cả các bảng chat_* được tạo trong thư mục migrations
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(chat_[a-z0-9_]+)/gi
  const tables = new Set()
  let match
  while ((match = tableRegex.exec(allSqlContent)) !== null) {
    tables.add(match[1])
  }

  assert.ok(tables.size >= 10, `Cần có ít nhất 10 bảng chat_*, tìm thấy: ${tables.size}`)

  // Kiểm tra từng bảng xem có lệnh ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  for (const table of tables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i')
    const hasRls = rlsRegex.test(allSqlContent)
    assert.ok(hasRls, `Bảng ${table} PHẢI được kích hoạt ROW LEVEL SECURITY`)
  }
})

// ==============================================================================
// 2. KIỂM TRA BẢO MẬT: KHỬ ĐỘC NHẬT KÝ KIỂM TOÁN (AUDIT LOG ZERO-LEAK SANITIZATION)
// ==============================================================================
test('Sen Chat P8: Khử độc nhật ký kiểm toán - Tuyệt đối không log plaintext hay private key', () => {
  const dangerousPayload = {
    user_id: 'usr_abc_123',
    device_id: 'dev_phone_99',
    event_type: 'device_registered',
    private_key: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...',
    secret_seed: 'super_secret_mnemonic_phrase',
    password: 'UserSecretPassword123!',
    plaintext_message: 'Xin chào, đây là tin nhắn bí mật của tôi!',
    message_content: 'Nội dung tệp đính kèm cực kỳ nhạy cảm',
    nested: {
      auth_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      apiKey: 'AIzaSyTestApiKeyShouldBeSanitized',
      passphrase: 'super_secret_user_passphrase',
      session_key: 'ephemeral_session_secret_32b',
      chain_key: 'ratchet_chain_secret_key_123',
      safe_metadata: 'ok_to_log',
    },
    raw_pem: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
    ec_pem: '-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIP...\n-----END EC PRIVATE KEY-----',
    safe_info: 'Galaxy S24 Ultra',
  }

  const cleaned = sanitizeChatAuditPayload(dangerousPayload)

  // 1. Các trường nhạy cảm phải bị thay thế bằng [REDACTED]
  assert.equal(cleaned.private_key, '[REDACTED]')
  assert.equal(cleaned.secret_seed, '[REDACTED]')
  assert.equal(cleaned.password, '[REDACTED]')
  assert.equal(cleaned.plaintext_message, '[REDACTED]')
  assert.equal(cleaned.message_content, '[REDACTED]')
  assert.equal(cleaned.nested.auth_token, '[REDACTED]')
  assert.equal(cleaned.nested.apiKey, '[REDACTED]')
  assert.equal(cleaned.nested.passphrase, '[REDACTED]')
  assert.equal(cleaned.nested.session_key, '[REDACTED]')
  assert.equal(cleaned.nested.chain_key, '[REDACTED]')

  // 2. Khóa PEM phải bị phát hiện và thay thế
  assert.equal(cleaned.raw_pem, '[REDACTED_PRIVATE_KEY]')
  assert.equal(cleaned.ec_pem, '[REDACTED_PRIVATE_KEY]')

  // 3. Dữ liệu an toàn được bảo toàn
  assert.equal(cleaned.user_id, 'usr_abc_123')
  assert.equal(cleaned.device_id, 'dev_phone_99')
  assert.equal(cleaned.safe_info, 'Galaxy S24 Ultra')
  assert.equal(cleaned.nested.safe_metadata, 'ok_to_log')

  // 4. Kiểm tra hàm chuẩn hóa validateAndFormatAuditEvent
  const formatted = validateAndFormatAuditEvent('usr_abc_123', 'safety_verified', {
    safety_code: '12345 67890',
    privateKey: 'secret_leak',
  }, '192.168.1.100')

  assert.equal(formatted.user_id, 'usr_abc_123')
  assert.equal(formatted.event_type, 'safety_verified')
  assert.equal(formatted.ip_address, '192.168.1.100')
  assert.equal(formatted.details.privateKey, '[REDACTED]')
  assert.equal(formatted.details.safety_code, '12345 67890')
})

// ==============================================================================
// 3. KIỂM TRA BẢO MẬT: QUÉT SECRET & TOKENS TRONG TOÀN BỘ REPO
// ==============================================================================
test('Sen Chat P8: Quét secret trong repo - Không lọt token, API key hoặc Private Key thật', () => {
  // Regex các mẫu bí mật nhạy cảm
  const patterns = [
    { name: 'Google API Key', regex: /AIzaSy[0-9A-Za-z_-]{33}/ },
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36}/ },
    { name: 'Private Key PEM', regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/ },
    { name: 'Slack Bot Token', regex: /xoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  ]

  // Lấy danh sách tất cả các file tracked trong git
  let gitFiles = []
  try {
    const output = execSync('git ls-files', { encoding: 'utf8' })
    gitFiles = output.split('\n').filter(f => f.trim().length > 0)
  } catch {
    // Fallback nếu không có git CLI
    gitFiles = ['package.json', 'middleware.ts', 'lib/version.ts']
  }

  for (const file of gitFiles) {
    // Bỏ qua file nhị phân, ảnh, lock files
    if (
      file.endsWith('.png') ||
      file.endsWith('.jpg') ||
      file.endsWith('.ico') ||
      file.endsWith('.pdf') ||
      file.endsWith('.woff') ||
      file.endsWith('.woff2') ||
      file.endsWith('.lock') ||
      file.includes('package-lock.json') ||
      file === 'tests/sen-chat-p8.test.mjs' // Bỏ qua chính file test định nghĩa regex
    ) {
      continue
    }

    const fullPath = path.join(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue

    const content = fs.readFileSync(fullPath, 'utf8')
    for (const { name, regex } of patterns) {
      assert.equal(
        regex.test(content),
        false,
        `Phát hiện khả năng rò rỉ secret [${name}] trong tệp tin: ${file}`
      )
    }
  }
})

// ==============================================================================
// 4. KIỂM TRA BẢO MẬT: CẤU HÌNH HEADERS BẢO MẬT VÀ CSP TRONG MIDDLEWARE
// ==============================================================================
test('Sen Chat P8: Security Headers bắt buộc chuẩn OWASP, CSP và frame-ancestors none', () => {
  const middlewarePath = path.join(process.cwd(), 'middleware.ts')
  const content = fs.readFileSync(middlewarePath, 'utf8')

  // 1. Kiểm tra frame-ancestors 'none' chống tấn công Clickjacking
  assert.ok(
    content.includes("frame-ancestors 'none'"),
    "Middleware CSP PHẢI chứa frame-ancestors 'none' cho Sen Chat"
  )

  // 2. Kiểm tra X-Frame-Options DENY
  assert.ok(
    content.includes("res.headers.set('X-Frame-Options', 'DENY')"),
    "applyChatSecurityHeaders PHẢI đặt X-Frame-Options là DENY"
  )

  // 3. Kiểm tra Strict-Transport-Security (HSTS)
  assert.ok(
    content.includes('Strict-Transport-Security'),
    'Middleware PHẢI cấu hình Strict-Transport-Security'
  )

  // 4. Kiểm tra X-Content-Type-Options nosniff
  assert.ok(
    content.includes("res.headers.set('X-Content-Type-Options', 'nosniff')"),
    'Middleware PHẢI đặt nosniff để chống MIME confusion'
  )

  // 5. Kiểm tra phân nhánh áp dụng header cho /api/chat
  assert.ok(
    content.includes("pathname.startsWith('/api/chat')"),
    "Middleware PHẢI áp dụng chat security headers cho đường dẫn /api/chat"
  )

  // 6. Kiểm tra hỗ trợ Chat trên subdomain m.senexam.me và chat.senexam.me
  assert.ok(
    content.includes("pathname === '/chat' || pathname.startsWith('/chat')"),
    "Middleware PHẢI điều hướng an toàn cho /chat trên subdomain mobile"
  )
  assert.ok(
    content.includes('!isChatSubdomain'),
    "Middleware KHÔNG được chuyển hướng sai chat.senexam.me sang m.senexam.me"
  )
})

// ==============================================================================
// 5. KIỂM TRA BẢO MẬT: CƠ CHẾ DỌN DẸP SẠCH KHI XÓA TÀI KHOẢN (CASCADING PURGE)
// ==============================================================================
test('Sen Chat P8: Cơ chế xóa tài khoản dọn sạch toàn bộ dữ liệu Drive, Storage và E2EE', async () => {
  // 1. Kiểm tra lọc tệp Drive
  const sampleAttachments = [
    { id: '1', drive_file_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz', storage_path: 'user1/file1.enc' },
    { id: '2', drive_file_id: 'supabase:bucket/file2.enc', storage_path: 'user1/file2.enc' },
    { id: '3', drive_file_id: 'mock:test12345', storage_path: '' },
    { id: '4', drive_file_id: '1ZxYwVuTsRqPoNmLkJiHgFeDcBa', storage_path: 'user1/file4.enc' },
  ]

  const driveIds = filterDriveIdsToPurge(sampleAttachments)
  assert.deepEqual(driveIds, ['1AbCdEfGhIjKlMnOpQrStUvWxYz', '1ZxYwVuTsRqPoNmLkJiHgFeDcBa'])

  const storagePaths = filterStoragePathsToPurge(sampleAttachments)
  assert.deepEqual(storagePaths, ['user1/file1.enc', 'user1/file2.enc', 'user1/file4.enc'])

  // 2. Kiểm tra xác thực quyền xóa tài khoản (Self hoặc Admin)
  assert.equal(validateDeletionPayload('user_123', 'user_123', false).valid, true)
  assert.equal(validateDeletionPayload('user_123', 'admin_999', true).valid, true)
  assert.equal(validateDeletionPayload('user_123', 'stranger_456', false).valid, false)

  // 3. Kiểm tra hàm purgeUserChatData với Mock Supabase Client
  const mockQueries = []
  const mockStorageDeletions = []
  const mockSupabaseAdmin = {
    from: (table) => {
      const q = {
        table,
        action: 'select',
        filters: {},
        select: (cols) => {
          q.action = 'select'
          q.cols = cols
          return q
        },
        delete: (opts) => {
          q.action = 'delete'
          q.opts = opts
          return q
        },
        eq: (col, val) => {
          q.filters[col] = val
          mockQueries.push({ ...q })
          if (q.table === 'chat_attachments' && q.action === 'select') {
            return Promise.resolve({
              data: [
                { id: 'att_1', drive_file_id: '1MockDriveId123', storage_path: 'u1/file1.enc' },
              ],
            })
          }
          return Promise.resolve({ count: 5, error: null })
        },
        or: (condition) => {
          q.filters.or = condition
          mockQueries.push({ ...q })
          return Promise.resolve({ count: 12, error: null })
        },
      }
      return q
    },
    storage: {
      from: (bucket) => ({
        remove: (paths) => {
          mockStorageDeletions.push({ bucket, paths })
          return Promise.resolve({ data: paths, error: null })
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: (userId) => Promise.resolve({ error: null }),
      },
    },
  }

  const cleanupRes = await purgeUserChatData('user_test_p8', mockSupabaseAdmin)
  assert.equal(cleanupRes.success, true)
  assert.equal(cleanupRes.userId, 'user_test_p8')
  assert.ok(mockQueries.length > 5, 'PHẢI gọi lệnh dọn dẹp trên tất cả các bảng dữ liệu chat')
})

// ==============================================================================
// 6. KIỂM TRA TÀI LIỆU AN NINH & KIẾN TRÚC: CHAT_THREAT_MODEL & CHAT_ARCHITECTURE
// ==============================================================================
test('Sen Chat P8: Tài liệu CHAT_THREAT_MODEL.md và CHAT_ARCHITECTURE.md đầy đủ tiêu chuẩn', () => {
  const threatModelPath = path.join(process.cwd(), 'CHAT_THREAT_MODEL.md')
  const architecturePath = path.join(process.cwd(), 'CHAT_ARCHITECTURE.md')

  assert.ok(fs.existsSync(threatModelPath), 'Tệp CHAT_THREAT_MODEL.md PHẢI tồn tại')
  assert.ok(fs.existsSync(architecturePath), 'Tệp CHAT_ARCHITECTURE.md PHẢI tồn tại')

  const tm = fs.readFileSync(threatModelPath, 'utf8')
  const arch = fs.readFileSync(architecturePath, 'utf8')

  // Kiểm tra mô hình STRIDE trong Threat Model
  assert.ok(tm.includes('Spoofing'), 'Threat Model phải phân tích Spoofing')
  assert.ok(tm.includes('Tampering'), 'Threat Model phải phân tích Tampering')
  assert.ok(tm.includes('Repudiation'), 'Threat Model phải phân tích Repudiation')
  assert.ok(tm.includes('Information Disclosure'), 'Threat Model phải phân tích Information Disclosure')
  assert.ok(tm.includes('Denial of Service'), 'Threat Model phải phân tích Denial of Service')
  assert.ok(tm.includes('Elevation of Privilege'), 'Threat Model phải phân tích Elevation of Privilege')

  // Kiểm tra các rủi ro còn lại và phạm vi E2EE không bảo vệ được
  assert.ok(tm.includes('Compromised Endpoint'), 'Threat Model phải nêu rủi ro thiết bị bị nhiễm mã độc')
  assert.ok(tm.includes('Metadata Leakage'), 'Threat Model phải nêu rủi ro rò rỉ metadata')
  assert.ok(tm.includes('Zero-Knowledge'), 'Threat Model phải nêu triết lý Zero-Knowledge')

  // Kiểm tra kiến trúc P1 đến P7 trong Architecture Doc
  assert.ok(arch.includes('Signal Protocol'), 'Architecture phải mô tả Signal Protocol (P1)')
  assert.ok(arch.includes('MLS RFC 9420') || arch.includes('TreeKEM'), 'Architecture phải mô tả MLS (P2)')
  assert.ok(arch.includes('Chunked AES-256-GCM'), 'Architecture phải mô tả tệp phân đoạn (P3)')
  assert.ok(arch.includes('Whisper') || arch.includes('Opus'), 'Architecture phải mô tả tin nhắn thoại & STT (P4)')
  assert.ok(arch.includes('WebRTC') || arch.includes('Insertable Streams'), 'Architecture phải mô tả cuộc gọi (P5)')
  assert.ok(arch.includes('SenAI') || arch.includes('Prompt Injection'), 'Architecture phải mô tả SenAI (P6)')
  assert.ok(arch.includes('Capacitor') || arch.includes('FLAG_SECURE'), 'Architecture phải mô tả Native Mobile (P7)')
})
