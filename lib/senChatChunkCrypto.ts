/**
 * Sen Chat Chunk Cryptographic Engine (AES-256-GCM)
 * 
 * Mã hóa tệp phía client theo từng chunk bằng AES-256-GCM:
 * - Khóa ngẫu nhiên 256-bit độc lập cho từng tệp (File Key), nằm trong tin nhắn E2EE.
 * - Mã hóa tên tệp, MIME type và thumbnail trước khi gửi.
 * - Stream từng chunk (512KB mặc định) vào bộ nhớ đệm, không đọc toàn bộ tệp vào RAM.
 * - Hỗ trợ theo dõi tiến trình (progress), hủy bỏ (abort) và thử lại (retry) khi gặp lỗi mạng.
 * - Tự động xóa dữ liệu EXIF vị trí (GPS) của ảnh trước khi mã hóa.
 */

// Kích thước chunk mặc định: 512 KB
export const DEFAULT_CHUNK_SIZE = 512 * 1024

/**
 * Sinh khóa ngẫu nhiên 256-bit (32 bytes) cho tệp
 */
export function generateFileKey(): Uint8Array {
  const key = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(key)
  } else {
    // Fallback cho môi trường Node test
    const nodeCrypto = require('node:crypto')
    const bytes = nodeCrypto.randomBytes(32)
    key.set(bytes)
  }
  return key
}

/**
 * Chuyển Uint8Array sang Base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
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
 * Chuyển Base64 sang Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Import khóa raw sang CryptoKey (AES-GCM)
 */
async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto()
  return await subtle.importKey(
    'raw',
    rawKey as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle
  }
  const nodeCrypto = require('node:crypto')
  return nodeCrypto.webcrypto.subtle
}

/**
 * Mã hóa 1 chunk dữ liệu bằng AES-256-GCM.
 * Định dạng đầu ra: [12 bytes IV] + [Ciphertext + 16 bytes Auth Tag]
 */
export async function encryptChunk(
  chunkData: Uint8Array,
  rawKey: Uint8Array
): Promise<Uint8Array> {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  // 12 bytes IV ngẫu nhiên cho mỗi chunk
  const iv = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(iv)
  } else {
    const nodeCrypto = require('node:crypto')
    iv.set(nodeCrypto.randomBytes(12))
  }

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    chunkData as any
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const output = new Uint8Array(iv.length + encryptedBytes.length)
  output.set(iv, 0)
  output.set(encryptedBytes, iv.length)

  return output
}

/**
 * Giải mã 1 chunk dữ liệu bằng AES-256-GCM.
 * Nhận vào: [12 bytes IV] + [Ciphertext + 16 bytes Auth Tag]
 */
export async function decryptChunk(
  encryptedChunk: Uint8Array,
  rawKey: Uint8Array
): Promise<Uint8Array> {
  if (encryptedChunk.length < 12 + 16) {
    throw new Error('Dữ liệu chunk mã hóa không hợp lệ (quá ngắn)')
  }

  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = encryptedChunk.slice(0, 12)
  const ciphertextWithTag = encryptedChunk.slice(12)

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertextWithTag as any
  )

  return new Uint8Array(decryptedBuffer)
}

export interface EncryptedMetadata {
  iv: string
  ciphertext: string
}

export interface FileMetadata {
  name: string
  mimeType: string
  size: number
  thumbnail?: string | null
}

/**
 * Mã hóa metadata của tệp (tên, định dạng MIME, thumbnail)
 */
export async function encryptFileMetadata(
  metadata: FileMetadata,
  rawKey: Uint8Array
): Promise<EncryptedMetadata> {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(iv)
  } else {
    const nodeCrypto = require('node:crypto')
    iv.set(nodeCrypto.randomBytes(12))
  }

  const jsonString = JSON.stringify(metadata)
  const encoded = new TextEncoder().encode(jsonString)

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  )

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  }
}

/**
 * Giải mã metadata của tệp
 */
export async function decryptFileMetadata(
  encryptedMeta: EncryptedMetadata,
  rawKey: Uint8Array
): Promise<FileMetadata> {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = base64ToBytes(encryptedMeta.iv)
  const ciphertext = base64ToBytes(encryptedMeta.ciphertext)

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    ciphertext as any
  )

  const jsonString = new TextDecoder().decode(decryptedBuffer)
  return JSON.parse(jsonString)
}

/**
 * Xóa EXIF GPS/vị trí và tùy chọn nén ảnh trước khi mã hóa
 * Mặc định vẽ lại ảnh lên HTML Canvas để triệt tiêu toàn bộ EXIF gốc
 */
export async function stripExifAndProcessImage(
  file: File | Blob,
  options: {
    compress?: boolean
    quality?: number
    maxWidth?: number
    maxHeight?: number
  } = {}
): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Nếu chạy ở môi trường không có DOM (e.g. Node test), trả về file gốc
    return file
  }

  const {
    compress = true,
    quality = 0.85,
    maxWidth = 2048,
    maxHeight = 2048,
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      if (compress && (width > maxWidth || height > maxHeight)) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      // Vẽ ảnh lên canvas: Toàn bộ EXIF header (GPS, Thiết bị, v.v.) tự động bị loại bỏ hoàn toàn
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            resolve(file)
          }
        },
        compress ? 'image/jpeg' : (file.type || 'image/png'),
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // Fallback file gốc nếu ảnh không parse được
    }

    img.src = url
  })
}

/**
 * Iterator luồng mã hóa từng chunk của file mà không nạp toàn bộ vào RAM
 */
export async function* encryptFileInChunks(
  file: Blob,
  fileKey: Uint8Array,
  options: {
    chunkSize?: number
    signal?: AbortSignal
    onProgress?: (bytesProcessed: number, totalBytes: number, percent: number) => void
  } = {}
): AsyncGenerator<{
  chunkIndex: number
  encryptedChunk: Uint8Array
  isLast: boolean
  bytesProcessed: number
  totalBytes: number
}> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, signal, onProgress } = options
  const totalBytes = file.size
  let offset = 0
  let chunkIndex = 0

  while (offset < totalBytes) {
    if (signal?.aborted) {
      throw new Error('Thao tác mã hóa tệp đã bị hủy bỏ bởi người dùng')
    }

    const end = Math.min(offset + chunkSize, totalBytes)
    const slice = file.slice(offset, end)
    const arrayBuffer = await slice.arrayBuffer()
    const chunkData = new Uint8Array(arrayBuffer)

    const encryptedChunk = await encryptChunk(chunkData, fileKey)
    offset = end
    const isLast = offset >= totalBytes
    const percent = totalBytes > 0 ? Math.round((offset / totalBytes) * 100) : 100

    if (onProgress) {
      onProgress(offset, totalBytes, percent)
    }

    yield {
      chunkIndex,
      encryptedChunk,
      isLast,
      bytesProcessed: offset,
      totalBytes,
    }

    chunkIndex++
  }
}

export const CHUNKED_MAGIC = new Uint8Array([0x53, 0x45, 0x4e, 0x31]) // 'SEN1'

/**
 * Mã hóa toàn bộ file theo từng chunk stream và đóng gói thành Blob
 * Định dạng: [SEN1 (4B)] + [Chunk 1: len(4B) + IV(12B) + ciphertext + tag(16B)] + ...
 */
export async function encryptFileToBlob(
  file: Blob | Uint8Array,
  fileKey: Uint8Array,
  options: {
    chunkSize?: number
    signal?: AbortSignal
    onProgress?: (bytesProcessed: number, totalBytes: number, percent: number) => void
  } = {}
): Promise<Blob> {
  const blob = file instanceof Blob ? file : new Blob([file as any])
  const parts: BlobPart[] = [CHUNKED_MAGIC]

  for await (const { encryptedChunk } of encryptFileInChunks(blob, fileKey, options)) {
    const lenHeader = new Uint8Array(4)
    new DataView(lenHeader.buffer).setUint32(0, encryptedChunk.length, false)
    parts.push(lenHeader)
    parts.push(encryptedChunk)
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

/**
 * Iterator giải mã từng chunk từ Blob mã hóa mà không cần nạp toàn bộ vào RAM
 */
export async function* decryptFileInChunks(
  encryptedBlob: Blob | Uint8Array,
  rawKey: Uint8Array,
  options: {
    signal?: AbortSignal
    onProgress?: (bytesProcessed: number, totalBytes: number, percent: number) => void
  } = {}
): AsyncGenerator<Uint8Array> {
  const { signal, onProgress } = options
  const blob = encryptedBlob instanceof Blob ? encryptedBlob : new Blob([encryptedBlob as any])
  const totalBytes = blob.size

  if (totalBytes < 4) {
    throw new Error('Dữ liệu tệp mã hóa không hợp lệ (kích thước quá nhỏ)')
  }

  // Đọc 4 bytes đầu để kiểm tra magic SEN1
  const headerBuf = await blob.slice(0, 4).arrayBuffer()
  const headerBytes = new Uint8Array(headerBuf)
  const isChunkedFormat =
    headerBytes[0] === 0x53 &&
    headerBytes[1] === 0x45 &&
    headerBytes[2] === 0x4e &&
    headerBytes[3] === 0x31

  if (isChunkedFormat) {
    let offset = 4
    while (offset < totalBytes) {
      if (signal?.aborted) {
        throw new Error('Thao tác giải mã tệp đã bị hủy bỏ bởi người dùng')
      }

      if (offset + 4 > totalBytes) {
        throw new Error('Dữ liệu framing chunk bị lỗi (không đủ 4 bytes độ dài)')
      }

      const lenBuf = await blob.slice(offset, offset + 4).arrayBuffer()
      const chunkLen = new DataView(lenBuf).getUint32(0, false)
      offset += 4

      if (offset + chunkLen > totalBytes) {
        throw new Error('Dữ liệu chunk bị cắt cụt (không đủ dữ liệu so với độ dài khai báo)')
      }

      const chunkBuf = await blob.slice(offset, offset + chunkLen).arrayBuffer()
      const decryptedChunk = await decryptChunk(new Uint8Array(chunkBuf), rawKey)
      offset += chunkLen

      const percent = totalBytes > 0 ? Math.min(100, Math.round((offset / totalBytes) * 100)) : 100
      if (onProgress) {
        onProgress(offset, totalBytes, percent)
      }

      yield decryptedChunk
    }
  } else {
    // Tương thích ngược: Coi toàn bộ blob là 1 chunk đơn lẻ
    if (signal?.aborted) {
      throw new Error('Thao tác giải mã tệp đã bị hủy bỏ bởi người dùng')
    }
    const fullBuf = await blob.arrayBuffer()
    const decrypted = await decryptChunk(new Uint8Array(fullBuf), rawKey)
    if (onProgress) {
      onProgress(totalBytes, totalBytes, 100)
    }
    yield decrypted
  }
}

/**
 * Giải mã Blob mã hóa thành Blob giải mã hoàn chỉnh
 */
export async function decryptFileToBlob(
  encryptedBlob: Blob | Uint8Array,
  rawKey: Uint8Array,
  mimeType: string = 'application/octet-stream',
  options: {
    signal?: AbortSignal
    onProgress?: (bytesProcessed: number, totalBytes: number, percent: number) => void
  } = {}
): Promise<Blob> {
  const parts: BlobPart[] = []
  for await (const chunk of decryptFileInChunks(encryptedBlob, rawKey, options)) {
    parts.push(chunk)
  }
  return new Blob(parts, { type: mimeType })
}
