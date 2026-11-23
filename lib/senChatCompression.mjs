/**
 * Sen Chat Message Compression Engine (ES Module for Node.js / Test Runner)
 */
import zlib from 'node:zlib'

export const COMPRESSION_PREFIX = 'SEN_Z:'

export function isCompressedChatMessage(text) {
  if (!text || typeof text !== 'string') return false
  return text.startsWith(COMPRESSION_PREFIX)
}

function uint8ArrayToBase64(bytes) {
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

function base64ToUint8Array(base64) {
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

export async function compressChatMessage(text) {
  if (!text || typeof text !== 'string') return ''
  if (isCompressedChatMessage(text)) return text

  try {
    const rawBytes = Buffer.from(text, 'utf8')
    const compressedBuffer = zlib.gzipSync(rawBytes)
    return `${COMPRESSION_PREFIX}${compressedBuffer.toString('base64')}`
  } catch (err) {
    console.warn('[SenChatCompression] Error compressing chat message:', err)
    return text
  }
}

export async function decompressChatMessage(compressedOrPlain) {
  if (!compressedOrPlain || typeof compressedOrPlain !== 'string') return ''
  if (!isCompressedChatMessage(compressedOrPlain)) {
    return compressedOrPlain
  }

  const base64Data = compressedOrPlain.slice(COMPRESSION_PREFIX.length)
  if (!base64Data) return ''

  try {
    const compressedBytes = Buffer.from(base64Data, 'base64')
    const decompressed = zlib.gunzipSync(compressedBytes)
    return decompressed.toString('utf8')
  } catch (err) {
    console.warn('[SenChatCompression] Error decompressing chat message:', err)
    return compressedOrPlain
  }
}

export function compressChatMessageSync(text) {
  if (!text || typeof text !== 'string') return ''
  if (isCompressedChatMessage(text)) return text

  try {
    const compressedBuffer = zlib.gzipSync(Buffer.from(text, 'utf8'))
    return `${COMPRESSION_PREFIX}${compressedBuffer.toString('base64')}`
  } catch {
    return text
  }
}

export function decompressChatMessageSync(compressedOrPlain) {
  if (!compressedOrPlain || typeof compressedOrPlain !== 'string') return ''
  if (!isCompressedChatMessage(compressedOrPlain)) return compressedOrPlain

  const base64Data = compressedOrPlain.slice(COMPRESSION_PREFIX.length)
  try {
    const decompressed = zlib.gunzipSync(Buffer.from(base64Data, 'base64'))
    return decompressed.toString('utf8')
  } catch {
    return compressedOrPlain
  }
}

export function getCompressionStats(originalText, compressedText) {
  const originalBytes = Buffer.from(originalText || '', 'utf8').length
  const compressedBytes = Buffer.from(compressedText || '', 'utf8').length
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
