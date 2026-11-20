/**
 * Sen Chat Chunk Cryptographic Engine (AES-256-GCM) - ESM Node/Browser
 */

import crypto from 'node:crypto'

export const DEFAULT_CHUNK_SIZE = 512 * 1024

export function generateFileKey() {
  const key = new Uint8Array(32)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(key)
  } else {
    key.set(crypto.randomBytes(32))
  }
  return key
}

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

export function base64ToBytes(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

function getSubtleCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle
  }
  return crypto.webcrypto.subtle
}

async function importAesKey(rawKey) {
  const subtle = getSubtleCrypto()
  return await subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptChunk(chunkData, rawKey) {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = new Uint8Array(12)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(iv)
  } else {
    iv.set(crypto.randomBytes(12))
  }

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    chunkData
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const output = new Uint8Array(iv.length + encryptedBytes.length)
  output.set(iv, 0)
  output.set(encryptedBytes, iv.length)

  return output
}

export async function decryptChunk(encryptedChunk, rawKey) {
  if (encryptedChunk.length < 12 + 16) {
    throw new Error('Dữ liệu chunk mã hóa không hợp lệ (quá ngắn)')
  }

  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = encryptedChunk.slice(0, 12)
  const ciphertextWithTag = encryptedChunk.slice(12)

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextWithTag
  )

  return new Uint8Array(decryptedBuffer)
}

export async function encryptFileMetadata(metadata, rawKey) {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = new Uint8Array(12)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(iv)
  } else {
    iv.set(crypto.randomBytes(12))
  }

  const jsonString = JSON.stringify(metadata)
  const encoded = new TextEncoder().encode(jsonString)

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  }
}

export async function decryptFileMetadata(encryptedMeta, rawKey) {
  const subtle = getSubtleCrypto()
  const key = await importAesKey(rawKey)

  const iv = base64ToBytes(encryptedMeta.iv)
  const ciphertext = base64ToBytes(encryptedMeta.ciphertext)

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  const jsonString = new TextDecoder().decode(decryptedBuffer)
  return JSON.parse(jsonString)
}

export async function* encryptFileInChunks(file, fileKey, options = {}) {
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

export async function encryptFileToBlob(file, fileKey, options = {}) {
  const blob = file instanceof Blob ? file : new Blob([file])
  const parts = [CHUNKED_MAGIC]

  for await (const { encryptedChunk } of encryptFileInChunks(blob, fileKey, options)) {
    const lenHeader = new Uint8Array(4)
    new DataView(lenHeader.buffer).setUint32(0, encryptedChunk.length, false)
    parts.push(lenHeader)
    parts.push(encryptedChunk)
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

export async function* decryptFileInChunks(encryptedBlob, rawKey, options = {}) {
  const { signal, onProgress } = options
  const blob = encryptedBlob instanceof Blob ? encryptedBlob : new Blob([encryptedBlob])
  const totalBytes = blob.size

  if (totalBytes < 4) {
    throw new Error('Dữ liệu tệp mã hóa không hợp lệ (kích thước quá nhỏ)')
  }

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

export async function decryptFileToBlob(encryptedBlob, rawKey, mimeType = 'application/octet-stream', options = {}) {
  const parts = []
  for await (const chunk of decryptFileInChunks(encryptedBlob, rawKey, options)) {
    parts.push(chunk)
  }
  return new Blob(parts, { type: mimeType })
}
