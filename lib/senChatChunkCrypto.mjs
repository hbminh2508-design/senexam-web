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
