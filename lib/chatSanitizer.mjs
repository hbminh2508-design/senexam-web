/**
 * Sen Chat Input Sanitization & Safe External Link Utility (ESM)
 * Enforces XSS-safety, HTML escaping, and rel="noopener noreferrer" on external links
 */

export function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Parses plain text message into safe text segments and external URLs
 * All external links are validated and marked for rendering with rel="noopener noreferrer" target="_blank"
 */
export function parseMessageLinks(text) {
  if (!text) return []

  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi
  const parts = []
  let lastIndex = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      })
    }

    const rawUrl = match[0]
    try {
      const parsed = new URL(rawUrl)
      // Chặn javascript: or data: URL injection
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        parts.push({
          type: 'link',
          content: rawUrl,
          url: parsed.href,
        })
      } else {
        parts.push({
          type: 'text',
          content: rawUrl,
        })
      }
    } catch {
      parts.push({
        type: 'text',
        content: rawUrl,
      })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    })
  }

  return parts
}
