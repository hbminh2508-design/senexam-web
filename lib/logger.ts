/**
 * Structured Logging Module for SenExam
 * Version: 2.0.2194023.10599.01
 * 
 * Provides JSON/structured console logging while automatically redacting sensitive credentials
 * (passwords, tokens, service role keys, secrets, authorization headers).
 */

const REDACTED_KEYS = new Set([
  'password',
  'pwd',
  'secret',
  'adminsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'servicerolekey',
  'authorization',
  'cookie',
  'cvv',
  'cccd',
])

function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5) return '[Max Depth]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (REDACTED_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeObject(val, depth + 1)
    } else {
      sanitized[key] = val
    }
  }
  return sanitized
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export function logEvent(
  level: LogLevel,
  context: string,
  message: string,
  metadata?: Record<string, any>
) {
  const timestamp = new Date().toISOString()
  const cleanMeta = metadata ? sanitizeObject(metadata) : undefined
  const payload = {
    timestamp,
    level: level.toUpperCase(),
    context,
    message,
    ...(cleanMeta ? { metadata: cleanMeta } : {}),
  }

  if (level === 'error') {
    console.error(`[${timestamp}] [ERROR] [${context}]: ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '')
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] [WARN] [${context}]: ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '')
  } else {
    console.log(`[${timestamp}] [INFO] [${context}]: ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '')
  }
  return payload
}

export const logger = {
  info: (context: string, message: string, metadata?: Record<string, any>) =>
    logEvent('info', context, message, metadata),
  warn: (context: string, message: string, metadata?: Record<string, any>) =>
    logEvent('warn', context, message, metadata),
  error: (context: string, message: string, metadata?: Record<string, any>) =>
    logEvent('error', context, message, metadata),
  debug: (context: string, message: string, metadata?: Record<string, any>) =>
    logEvent('debug', context, message, metadata),
}
