/**
 * TypeScript re-export and types for Sen Chat Audit Logging (P8)
 */

export interface ChatAuditEventPayload {
  user_id: string
  event_type: string
  details: Record<string, any>
  ip_address?: string | null
  created_at?: string
}

export {
  SENSITIVE_KEY_PATTERNS,
  VALID_AUDIT_EVENT_TYPES,
  sanitizeChatAuditPayload,
  validateAndFormatAuditEvent,
} from './senChatAudit.mjs'
