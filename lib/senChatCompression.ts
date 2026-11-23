/**
 * Sen Chat Message Compression Engine
 * 
 * NÃ©n vÃ  giáº£i nÃ©n tin nháº¯n vÄƒn báº£n cá»§a Sen Chat:
 * - Sá»­ dá»¥ng thuáº­t toÃ¡n nÃ©n chuáº©n Web Stream (gzip/deflate qua CompressionStream/DecompressionStream)
 * - Fallback linh hoáº¡t sang zlib khi cháº¡y trong Node.js / Serverless / Test Runner
 * - Tiáº¿t kiá»‡m tá»‘i Ä‘a dung lÆ°á»£ng lÆ°u trá»¯ CSDL vÃ  bÄƒng thÃ´ng truyá» n táº£i
 * - Giáº£i nÃ©n tá»± Ä‘á»™ng vÃ  minh báº¡ch táº¡i client
 */

export const COMPRESSION_PREFIX = 'SEN_Z:'

/**
 * Kiá»ƒm tra xem chuá»—i cÃ³ pháº£i lÃ  tin nháº¯n Ä‘Ã£ Ä‘Æ°á»£c nÃ©n hay khÃ´ng
 */
export function isCompressedChatMessage(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false
  return text.startsWith(COMPRESSION_PREFIX)
}

/**
 * Chuyá»ƒn Uint8Array sang Base64 an toÃ n trÃªn cáº£ TrÃ¬nh duyá»‡t vÃ  Node
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Chuyá»ƒn Base64 sang Uint8Array an toÃ n trÃªn cáº£ TrÃ¬nh duyá»‡t vÃ  Node
 */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * NÃ©n vÄƒn báº£n tin nháº¯n qua gzip/deflate
 * Náº¿u vÄƒn báº£n quÃ¡ ngáº¯n (< 30 kÃ½ tá»±) hoáº·c nÃ©n xong láº¡i dÃ i hÆ¡n, giÃºp tá»‘i Æ°u báº±ng cÃ¡ch
 * váº«n gáº¯n prefix hoáº·c tráº£ vá»  chuá»—i Ä‘Ã£ nÃ©n chuáº©n.
 */
export async function compressChatMessage(text: string): Promise<string> {
  if (!text || typeof text !== 'string') return ''

  // Náº¿u Ä‘Ã£ nÃ©n trÆ°á»›c Ä‘Ã³ thÃ¬ khÃ´ng nÃ©n láº¡i
  if (isCompressedChatMessage(text)) return text

  try {
    const rawBytes = new TextEncoder().encode(text)

    // 1. TrÃ¬nh duyá»‡t há»— trá»£ CompressionStream chuáº©n Web API
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Response(new Blob([rawBytes])).body?.pipeThrough(new CompressionStream('gzip'))
      if (stream) {
        const compressedBuffer = await new Response(stream).arrayBuffer()
        const base64 = uint8ArrayToBase64(new Uint8Array(compressedBuffer))
        return `${COMPRESSION_PREFIX}${base64}`
      }
    }

    // 2. MÃ´i trÆ°á» ng Node.js (zlib)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const zlib = await import('node:zlib')
      const compressedBuffer = zlib.gzipSync(Buffer.from(rawBytes))
      return `${COMPRESSION_PREFIX}${compressedBuffer.toString('base64')}`
    }

    // 3. Fallback: tráº£ vá»  chuá»—i gá»‘c náº¿u khÃ´ng cÃ³ cÃ´ng cá»¥ nÃ©n
    return text
  } catch (err) {
    console.warn('[SenChatCompression] Lá»—i nÃ©n tin nháº¯n, fallback chuá»—i gá»‘c:', err)
    return text
  }
}

/**
 * Giáº£i nÃ©n tin nháº¯n vÄƒn báº£n tá»± Ä‘á»™ng vÃ  minh báº¡ch
 * Náº¿u tin nháº¯n khÃ´ng cÃ³ tiá» n tá»‘ nÃ©n (tin nháº¯n cÅ©/plaintext), tráº£ vá»  nguyÃªn váº¹n.
 */
export async function decompressChatMessage(compressedOrPlain: string): Promise<string> {
  if (!compressedOrPlain || typeof compressedOrPlain !== 'string') return ''

  // Náº¿u khÃ´ng pháº£i tin nháº¯n nÃ©n, tráº£ vá»  nguyÃªn gá»‘c
  if (!isCompressedChatMessage(compressedOrPlain)) {
    return compressedOrPlain
  }

  const base64Data = compressedOrPlain.slice(COMPRESSION_PREFIX.length)
  if (!base64Data) return ''

  try {
    const compressedBytes = base64ToUint8Array(base64Data)

    // 1. TrÃ¬nh duyá»‡t há»— trá»£ DecompressionStream chuáº©n Web API
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Response(new Blob([compressedBytes])).body?.pipeThrough(
        new DecompressionStream('gzip')
      )
      if (stream) {
        const decompressedBuffer = await new Response(stream).arrayBuffer()
        return new TextDecoder().decode(decompressedBuffer)
      }
    }

    // 2. MÃ´i trÆ°á» ng Node.js (zlib)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const zlib = await import('node:zlib')
      const decompressed = zlib.gunzipSync(Buffer.from(compressedBytes))
      return decompressed.toString('utf8')
    }

    return compressedOrPlain
  } catch (err) {
    console.warn('[SenChatCompression] Lá»—i giáº£i nÃ©n tin nháº¯n:', err)
    return compressedOrPlain
  }
}

/**
 * NÃ©n tin nháº¯n Ä‘á»“ng bá»™ (Node.js fallback / tiá»‡n Ã­ch cho test hoáº·c sync context)
 */
export function compressChatMessageSync(text: string): string {
  if (!text || typeof text !== 'string') return ''
  if (isCompressedChatMessage(text)) return text

  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const zlib = require('node:zlib')
      const compressedBuffer = zlib.gzipSync(Buffer.from(text, 'utf8'))
      return `${COMPRESSION_PREFIX}${compressedBuffer.toString('base64')}`
    }
  } catch {}
  return text
}

/**
 * Giáº£i nÃ©n tin nháº¯n Ä‘á»“ng bá»™ (Node.js fallback / tiá»‡n Ã­ch cho test hoáº·c sync context)
 */
export function decompressChatMessageSync(compressedOrPlain: string): string {
  if (!compressedOrPlain || typeof compressedOrPlain !== 'string') return ''
  if (!isCompressedChatMessage(compressedOrPlain)) return compressedOrPlain

  const base64Data = compressedOrPlain.slice(COMPRESSION_PREFIX.length)
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const zlib = require('node:zlib')
      const decompressed = zlib.gunzipSync(Buffer.from(base64Data, 'base64'))
      return decompressed.toString('utf8')
    }
  } catch {}
  return compressedOrPlain
}

/**
 * Thá»‘ng kÃª tá»· lá»‡ nÃ©n vÃ  dung lÆ°á»£ng tiáº¿t kiá»‡m
 */
export function getCompressionStats(originalText: string, compressedText: string): {
  originalBytes: number
  compressedBytes: number
  ratio: number
  savedBytes: number
  savingsPercent: number
} {
  const originalBytes = new TextEncoder().encode(originalText || '').length
  const compressedBytes = new TextEncoder().encode(compressedText || '').length
  const savedBytes = Math.max(0, originalBytes - compressedBytes)
  const ratio = originalBytes > 0 ? compressedBytes / originalBytes : 1
  const savingsPercent = originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0

  return {
    originalBytes,
    compressedBytes,
    ratio: Number(ratio.toFixed(2)),
    savedBytes,
    savingsPercent,
  }
}
