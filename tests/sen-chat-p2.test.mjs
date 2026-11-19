import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { escapeHtml, parseMessageLinks } from '../lib/chatSanitizer.mjs'

// Helper: tính SHA-256 hash của email đã chuẩn hóa (lowercase, trimmed)
function hashEmail(email) {
  const normalized = email.trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

// ========================================================
// 1. KIỂM THỬ BẢO VỆ CHỐNG RÀ QUÉT & ENUMERATION EMAIL
// ========================================================
test('Sen Chat P2: Chống Email Enumeration & Băm SHA-256 Server-side', async () => {
  const emailA = 'alice.student@senexam.me'
  const emailB = 'bob.teacher@senexam.me'
  const emailC = 'charlie.hidden@senexam.me'

  const hashA = hashEmail(emailA)
  const hashB = hashEmail(emailB)
  const hashC = hashEmail(emailC)

  assert.equal(hashA.length, 64, 'Email hash phải là chuỗi Hex 64 ký tự SHA-256')
  assert.notEqual(hashA, hashB, 'Hai email khác nhau phải tạo ra hai hash khác nhau')

  // Giả lập cơ sở dữ liệu profiles
  const mockProfiles = [
    {
      id: 'usr-alice',
      email: emailA,
      email_hash: hashA,
      full_name: 'Alice Nguyen',
      allow_search_by_email: true,
      avatar_url: 'https://senexam.me/avatars/alice.png',
    },
    {
      id: 'usr-bob',
      email: emailB,
      email_hash: hashB,
      full_name: 'Bob Tran',
      allow_search_by_email: true,
      avatar_url: null,
    },
    {
      id: 'usr-charlie',
      email: emailC,
      email_hash: hashC,
      full_name: 'Charlie Silent',
      allow_search_by_email: false, // Người dùng tắt tính năng tìm kiếm bằng email
      avatar_url: null,
    },
  ]

  // Giả lập RPC lookup_user_by_email_hash
  function simulateLookupUserByEmailHash(targetHash, currentUserId) {
    const user = mockProfiles.find((p) => p.email_hash === targetHash)
    
    // Nếu không tìm thấy hoặc người dùng tắt tìm kiếm qua email
    if (!user || user.allow_search_by_email === false || user.id === currentUserId) {
      return {
        success: false,
        found: false,
        message: 'Không tìm thấy người dùng phù hợp hoặc người dùng không cho phép tìm kiếm qua email.',
      }
    }

    // Nếu tìm thấy và cho phép: chỉ trả về thông tin công khai tối thiểu (không trả email thô)
    return {
      success: true,
      found: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
    }
  }

  // 1. Tìm thấy người dùng cho phép
  const resAlice = simulateLookupUserByEmailHash(hashA, 'caller-999')
  assert.equal(resAlice.success, true)
  assert.equal(resAlice.found, true)
  assert.equal(resAlice.user.id, 'usr-alice')
  assert.equal(resAlice.user.full_name, 'Alice Nguyen')
  assert.equal(resAlice.user.email, undefined, 'Tuyệt đối không để lộ trường email thô trong kết quả trả về')

  // 2. Tìm người dùng có email trong hệ thống nhưng tắt allow_search_by_email = false
  const resCharlie = simulateLookupUserByEmailHash(hashC, 'caller-999')
  assert.equal(resCharlie.success, false)
  assert.equal(resCharlie.found, false)

  // 3. Tìm email hoàn toàn không tồn tại
  const nonexistentHash = hashEmail('nonexistent.fake@senexam.me')
  const resNonexistent = simulateLookupUserByEmailHash(nonexistentHash, 'caller-999')
  assert.equal(resNonexistent.success, false)
  assert.equal(resNonexistent.found, false)

  // 4. Kiểm tra nguyên tắc Anti-Enumeration: Phản hồi giữa không tồn tại và tắt tìm kiếm phải hoàn toàn giống hệt nhau
  assert.deepEqual(
    resCharlie,
    resNonexistent,
    'Phản hồi cho email không tồn tại và email tắt cho phép tìm kiếm phải đồng nhất để chống kẻ tấn công dò quét sự tồn tại của tài khoản'
  )

  // 5. Tìm kiếm chính mình phải bị chặn
  const resSelf = simulateLookupUserByEmailHash(hashA, 'usr-alice')
  assert.equal(resSelf.success, false)
  assert.equal(resSelf.found, false)
})

// ========================================================
// 2. KIỂM THỬ GIỚI HẠN TỐC ĐỘ (RATE LIMITING)
// ========================================================
test('Sen Chat P2: Giới hạn tần suất tìm kiếm bạn bè (Rate Limiting 5 req/min)', () => {
  const store = new Map()

  function checkRateLimit(key, maxRequests, windowMs, now) {
    const record = store.get(key)
    if (!record || now > record.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs })
      return { allowed: true, remaining: maxRequests - 1 }
    }
    if (record.count >= maxRequests) {
      return { allowed: false, remaining: 0 }
    }
    record.count++
    return { allowed: true, remaining: maxRequests - record.count }
  }

  const clientKey = 'email_lookup_192.168.1.100'
  const windowMs = 60 * 1000
  let currentTime = 1700000000000

  // 5 yêu cầu đầu tiên được phép
  for (let i = 1; i <= 5; i++) {
    const res = checkRateLimit(clientKey, 5, windowMs, currentTime)
    assert.equal(res.allowed, true, `Yêu cầu thứ ${i} phải được cho phép`)
  }

  // Yêu cầu thứ 6 bị chặn vì vượt quá quota
  const blockedRes = checkRateLimit(clientKey, 5, windowMs, currentTime)
  assert.equal(blockedRes.allowed, false, 'Yêu cầu thứ 6 vượt quá hạn mức 5 req/phút phải bị từ chối 429')

  // Sau khi hết cửa sổ thời gian 60s, quota được reset
  currentTime += 61 * 1000
  const afterResetRes = checkRateLimit(clientKey, 5, windowMs, currentTime)
  assert.equal(afterResetRes.allowed, true, 'Sau khi hết cửa sổ 60s, yêu cầu mới phải được chấp thuận lại')
})

// ========================================================
// 3. KIỂM THỬ SANITIZE DỮ LIỆU & BẢO VỆ LIÊN KẾT NGOÀI
// ========================================================
test('Sen Chat P2: Content Sanitization & Safe External Links (XSS Prevention)', () => {
  // 1. Kiểm tra escape HTML
  const dirtyHtml = '<script>alert("xss")</script><img src=x onerror=stealCookies()>'
  const sanitizedHtml = escapeHtml(dirtyHtml)
  assert.ok(!sanitizedHtml.includes('<script>'), 'Không được chứa thẻ script thô')
  assert.ok(!sanitizedHtml.includes('<img'), 'Thẻ img phải được mã hóa thành thực thể inert HTML')
  assert.equal(
    sanitizedHtml,
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;img src=x onerror=stealCookies()&gt;'
  )

  // 2. Kiểm tra phân tích link an toàn
  const textWithLinks = 'Truy cập tài liệu tại https://senexam.me/docs và xem thử http://test.vn nhé!'
  const parts = parseMessageLinks(textWithLinks)
  assert.equal(parts.length, 5)
  assert.equal(parts[0].type, 'text')
  assert.equal(parts[1].type, 'link')
  assert.equal(parts[1].url, 'https://senexam.me/docs')
  assert.equal(parts[2].type, 'text')
  assert.equal(parts[3].type, 'link')
  assert.equal(parts[3].url, 'http://test.vn/')
  assert.equal(parts[4].type, 'text')

  // 3. Kiểm tra chặn URL độc hại dạng javascript: và data:
  const maliciousText = 'Bấm vào javascript:alert(document.cookie) hoặc data:text/html,<script>alert(1)</script>'
  const maliciousParts = parseMessageLinks(maliciousText)
  const linksFound = maliciousParts.filter((p) => p.type === 'link')
  assert.equal(linksFound.length, 0, 'Các scheme nguy hiểm (javascript:, data:) tuyệt đối không được chuyển thành link click')
})

// ========================================================
// 4. KIỂM THỬ TIN NHẮN TỰ HỦY (TTL) & THU HỒI TIN NHẮN
// ========================================================
test('Sen Chat P2: Tin nhắn tự hủy (TTL) & Thu hồi tin nhắn (Recall)', () => {
  const now = 1700000000000

  // 1. Tính toán TTL tin nhắn
  function calculateExpiresAt(sentAtMs, ttlSeconds) {
    if (!ttlSeconds || ttlSeconds <= 0) return null
    return new Date(sentAtMs + ttlSeconds * 1000).toISOString()
  }

  assert.equal(calculateExpiresAt(now, 0), null, 'TTL = 0 nghĩa là tin nhắn vĩnh viễn không tự hủy')
  assert.equal(calculateExpiresAt(now, 30), new Date(now + 30000).toISOString(), 'TTL 30s tính toán chính xác')
  assert.equal(calculateExpiresAt(now, 3600), new Date(now + 3600000).toISOString(), 'TTL 1 giờ tính toán chính xác')

  // 2. Logic kiểm tra tin nhắn đã hết hạn hay chưa
  function isMessageExpired(expiresAtStr, checkTimeMs) {
    if (!expiresAtStr) return false
    return checkTimeMs >= new Date(expiresAtStr).getTime()
  }

  const exp30s = calculateExpiresAt(now, 30)
  assert.equal(isMessageExpired(exp30s, now + 10000), false, 'Chưa quá 30s thì chưa hết hạn')
  assert.equal(isMessageExpired(exp30s, now + 35000), true, 'Sau 35s thì tin nhắn đã hết hạn')

  // 3. Logic thu hồi tin nhắn (Recall)
  const message = {
    id: 'msg-123',
    sender_id: 'usr-alice',
    ciphertext: 'encrypted_content_bytes',
    is_recalled: false,
    created_at: new Date(now).toISOString(),
  }

  function recallMessage(msg, requesterId, requestTimeMs) {
    if (msg.sender_id !== requesterId) {
      return { success: false, error: 'Chỉ người gửi mới có quyền thu hồi tin nhắn này' }
    }
    const messageAgeHours = (requestTimeMs - new Date(msg.created_at).getTime()) / (1000 * 3600)
    if (messageAgeHours > 24) {
      return { success: false, error: 'Chỉ có thể thu hồi tin nhắn trong vòng 24 giờ kể từ khi gửi' }
    }
    return {
      success: true,
      message: {
        ...msg,
        ciphertext: '', // Xóa sạch nội dung mã hóa phía server
        is_recalled: true,
      },
    }
  }

  // Thu hồi bởi người khác -> Bị từ chối
  const recallByBob = recallMessage(message, 'usr-bob', now + 1000)
  assert.equal(recallByBob.success, false)

  // Thu hồi bởi chính mình trong thời gian hợp lệ -> Thành công
  const recallByAlice = recallMessage(message, 'usr-alice', now + 60000)
  assert.equal(recallByAlice.success, true)
  assert.equal(recallByAlice.message.is_recalled, true)
  assert.equal(recallByAlice.message.ciphertext, '')

  // Thu hồi sau hơn 24 giờ -> Bị từ chối
  const recallLate = recallMessage(message, 'usr-alice', now + 25 * 3600 * 1000)
  assert.equal(recallLate.success, false)
})

// ========================================================
// 5. KIỂM THỬ LUỒNG BẠN BÈ (FRIENDSHIP LIFECYCLE)
// ========================================================
test('Sen Chat P2: Friendship Lifecycle (Invite -> Accept / Block / Report)', () => {
  const friendships = new Map()

  function getFriendshipKey(idA, idB) {
    return [idA, idB].sort().join(':')
  }

  function sendInvitation(userA, userB) {
    if (userA === userB) return { success: false, error: 'Không thể kết bạn với chính mình' }
    const key = getFriendshipKey(userA, userB)
    const existing = friendships.get(key)
    if (existing && existing.status === 'blocked') {
      return { success: false, error: 'Không thể gửi lời mời do quan hệ bị chặn' }
    }
    if (existing && existing.status === 'accepted') {
      return { success: false, error: 'Hai người đã là bạn bè' }
    }
    friendships.set(key, {
      user_id: userA,
      friend_id: userB,
      status: 'pending',
    })
    return { success: true }
  }

  function respondInvitation(userA, userB, action) {
    const key = getFriendshipKey(userA, userB)
    const existing = friendships.get(key)
    if (!existing) return { success: false, error: 'Không tìm thấy lời mời' }

    if (action === 'accept') {
      existing.status = 'accepted'
    } else if (action === 'reject') {
      friendships.delete(key)
    } else if (action === 'block') {
      existing.status = 'blocked'
    }
    return { success: true, status: existing?.status || 'deleted' }
  }

  // 1. Không thể kết bạn với chính mình
  assert.equal(sendInvitation('usr-1', 'usr-1').success, false)

  // 2. Gửi lời mời kết bạn từ usr-1 tới usr-2
  const sendRes = sendInvitation('usr-1', 'usr-2')
  assert.equal(sendRes.success, true)

  // 3. Chấp nhận kết bạn
  const acceptRes = respondInvitation('usr-1', 'usr-2', 'accept')
  assert.equal(acceptRes.success, true)
  assert.equal(acceptRes.status, 'accepted')

  // 4. Chặn bạn bè
  const blockRes = respondInvitation('usr-1', 'usr-2', 'block')
  assert.equal(blockRes.success, true)
  assert.equal(blockRes.status, 'blocked')

  // 5. Sau khi chặn, không thể gửi lại lời mời
  const resendRes = sendInvitation('usr-1', 'usr-2')
  assert.equal(resendRes.success, false)
})
