/**
 * Sen Chat SenAI Integration Types & Wrapper
 * Exports TypeScript types and delegates implementation to lib/senChatAi.mjs
 */

export interface SenAiSuggestion {
  id: string
  trigger: string
  name: string
  badge: string
  description: string
  avatar: string
}

export interface E2eeConsentValidationResult {
  allowed: boolean
  reason?: string
  error?: string
  cleanQuery?: string
  selectedContextCount?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
  error?: string
}

export interface QuotaCheckResult {
  allowed: boolean
  tier?: string
  dailyLimit?: number
  currentUsedToday?: number
  remaining?: number
  error?: string
}

export {
  SENAI_TRIGGER_PATTERN,
  hasSenAiMention,
  extractSenAiQuery,
  getSenAiAutocompleteSuggestions,
  validateE2eeDisclosureConsent,
  selectContextMessages,
  sanitizeChatInputForAi,
  buildSecureSenAiChatPrompt,
  checkSenAiRateLimit,
  resetRateLimitsForTesting,
  SENAI_DEFAULT_DAILY_LIMITS,
  checkSenAiChatQuota,
  sanitizeAiResponse,
  hasMathOrTikz,
  extractTikzBlocks,
  formatSenAiGroupNotice,
} from './senChatAi.mjs'
