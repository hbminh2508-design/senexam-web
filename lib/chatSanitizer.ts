/**
 * Sen Chat Input Sanitization & Safe External Link Utility
 * Enforces XSS-safety, HTML escaping, and rel="noopener noreferrer" on external links
 */

export interface TextPart {
  type: 'text' | 'link'
  content: string
  url?: string
}

export { escapeHtml, parseMessageLinks } from './chatSanitizer.mjs'
