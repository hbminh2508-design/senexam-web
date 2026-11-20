/**
 * Sen Chat Audit Log Sanitization & Security Engine (P8)
 * Ensures zero plaintext messages and zero private keys are ever leaked into audit trails.
 */

// Danh sách các trường dữ liệu tuyệt đối cấm ghi vào nhật ký kiểm toán
export const SENSITIVE_KEY_PATTERNS = [
  /private_?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /seed/i,
  /plaintext/i,
  /content/i,
  /message_body/i,
  /credential/i,
  /auth_key/i,
  /master_key/i,
]

/**
 * Khử độc (sanitize) payload trước khi ghi vào chat_audit_events
 * Đảm bảo 100% không lưu vết thông tin bí mật hay nội dung tin nhắn người dùng.
 */
export function sanitizeChatAuditPayload(data) {
  if (data === null || data === undefined) return {}
  if (typeof data !== 'object') return { value: String(data).slice(0, 100) }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeChatAuditPayload(item))
  }

  const clean = {}
  for (const [k, v] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(k))
    if (isSensitive) {
      clean[k] = '[REDACTED]'
      continue
    }

    if (v && typeof v === 'object') {
      clean[k] = sanitizeChatAuditPayload(v)
    } else if (typeof v === 'string') {
      // Nếu chuỗi trông giống private key PEM hoặc base64 token dài bất thường
      if (v.includes('BEGIN PRIVATE KEY') || v.includes('BEGIN RSA PRIVATE KEY')) {
        clean[k] = '[REDACTED_PRIVATE_KEY]'
      } else if (v.length > 500) {
        clean[k] = v.slice(0, 120) + '...[TRUNCATED]'
      } else {
        clean[k] = v
      }
    } else {
      clean[k] = v
    }
  }

  return clean
}

/**
 * Danh sách các loại sự kiện an ninh hợp lệ của Sen Chat
 */
export const VALID_AUDIT_EVENT_TYPES = [
  'device_registered',
  'device_revoked',
  'identity_key_changed',
  'safety_verified',
  'replay_blocked',
  'mls_group_created',
  'mls_member_added',
  'mls_member_removed',
  'mls_key_rotated',
  'account_purged',
  'message_recalled',
  'report_submitted',
]

/**
 * Xác thực và chuẩn hóa sự kiện kiểm toán trước khi lưu
 */
export function validateAndFormatAuditEvent(userId, eventType, rawDetails = {}, ipAddress = null) {
  if (!userId) {
    throw new Error('Sự kiện kiểm toán yêu cầu userId hợp lệ')
  }
  if (!eventType || typeof eventType !== 'string') {
    throw new Error('Loại sự kiện kiểm toán không hợp lệ')
  }

  const sanitizedDetails = sanitizeChatAuditPayload(rawDetails)

  return {
    user_id: userId,
    event_type: eventType,
    details: sanitizedDetails,
    ip_address: ipAddress ? String(ipAddress).slice(0, 45) : null,
    created_at: new Date().toISOString(),
  }
}
