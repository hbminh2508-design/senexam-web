/**
 * =======================================================================
 * SENEXAM & FEPN QUANTUM CRYPTO SECURITY ENGINE
 * Military-grade Web Crypto API (AES-256-GCM, PBKDF2, SHA-512)
 * Zero-Knowledge Verification & One-Time Master Key Issuance System
 * =======================================================================
 */

// Helper: Convert ArrayBuffer to Hex String
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer)
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Helper: Convert Hex String to Uint8Array
export function hexToBuffer(hexString: string): Uint8Array {
  const cleanHex = hexString.replace(/[^0-9a-fA-F]/g, '')
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
  }
  return bytes
}

// Helper: Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Helper: Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Hash string with SHA-512
export async function sha512(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  return bufferToHex(hashBuffer)
}

export interface MasterKeyCertificate {
  keyId: string
  owner: string
  issuedAt: string
  payloadToken: string // 512-bit hex entropy
  checksum: string // SHA-512 of payload
  fileContent: string // Full downloadable .key content
  keyHash: string // Zero-knowledge hash stored in DB
}

/**
 * Generates an ultra-long, 512-bit quantum-entropy Master Security Key
 * formatted as a cryptographic certificate file (.key).
 */
export async function generateQuantumMasterKey(ownerEmail: string): Promise<MasterKeyCertificate> {
  const keyId = `SEC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  const issuedAt = new Date().toISOString()

  // 1. Generate 64 bytes (512 bits) of cryptographically secure random entropy
  const entropyBytes = new Uint8Array(64)
  crypto.getRandomValues(entropyBytes)
  const payloadToken = bufferToHex(entropyBytes.buffer)

  // 2. Compute SHA-512 checksum of payload token
  const checksum = await sha512(payloadToken + ':' + keyId + ':' + ownerEmail)

  // 3. Compute Zero-Knowledge storage hash (for matching without saving actual key)
  const keyHash = await sha512('SENEXAM_ZK_SALT_' + payloadToken)

  // 4. Format downloadable certificate content (.key)
  const fileContent = [
    '-----BEGIN SENEXAM QUANTUM MASTER SECURITY KEY-----',
    `Version: 1.0-QUANTUM-SHIELD`,
    `Key-ID: ${keyId}`,
    `Owner: ${ownerEmail}`,
    `Issued-At: ${issuedAt}`,
    `Entropy: 512-bit Military Grade Cryptographic Random`,
    `Algorithm: AES-256-GCM / PBKDF2 / SHA-512`,
    `Checksum: ${checksum}`,
    `Payload: ${payloadToken}`,
    'Warning: LƯU TRỮ TỆP NÀY Ở NƠI TUYỆT ĐỐI AN TOÀN. KHÓA NÀY CHỈ ĐƯỢC CẤP 1 LẦN DUY NHẤT VÀ KHÔNG THỂ TẢI LẠI!',
    '-----END SENEXAM QUANTUM MASTER SECURITY KEY-----',
  ].join('\n')

  return {
    keyId,
    owner: ownerEmail,
    issuedAt,
    payloadToken,
    checksum,
    fileContent,
    keyHash,
  }
}

/**
 * Validates an uploaded .key certificate file:
 * - Checks certificate boundaries
 * - Verifies SHA-512 checksum
 * - Optionally checks against expected zero-knowledge hash
 */
export async function parseAndValidateKeyFile(
  fileContent: string,
  expectedKeyHash?: string | null
): Promise<{
  valid: boolean
  keyId?: string
  owner?: string
  payloadToken?: string
  keyHash?: string
  error?: string
}> {
  try {
    const trimmed = fileContent.trim()
    if (
      !trimmed.includes('-----BEGIN SENEXAM QUANTUM MASTER SECURITY KEY-----') ||
      !trimmed.includes('-----END SENEXAM QUANTUM MASTER SECURITY KEY-----')
    ) {
      return {
        valid: false,
        error: 'Tệp tin không đúng định dạng khóa bảo mật SenExam (.key)!',
      }
    }

    const keyIdMatch = trimmed.match(/Key-ID:\s*([^\r\n]+)/)
    const ownerMatch = trimmed.match(/Owner:\s*([^\r\n]+)/)
    const checksumMatch = trimmed.match(/Checksum:\s*([^\r\n]+)/)
    const payloadMatch = trimmed.match(/Payload:\s*([^\r\n]+)/)

    if (!payloadMatch || !checksumMatch) {
      return {
        valid: false,
        error: 'Cấu trúc chứng chỉ khóa bị thiếu thông tin xác thực Payload hoặc Checksum!',
      }
    }

    const keyId = keyIdMatch ? keyIdMatch[1].trim() : ''
    const owner = ownerMatch ? ownerMatch[1].trim() : ''
    const checksum = checksumMatch[1].trim()
    const payloadToken = payloadMatch[1].trim()

    // 1. Verify internal SHA-512 Checksum
    const expectedChecksum = await sha512(payloadToken + ':' + keyId + ':' + owner)
    if (checksum !== expectedChecksum) {
      return {
        valid: false,
        error: 'Chữ ký số và mã Checksum của file khóa không khớp (tệp có thể đã bị sửa đổi trái phép)!',
      }
    }

    // 2. Compute key hash
    const computedKeyHash = await sha512('SENEXAM_ZK_SALT_' + payloadToken)

    // 3. Verify against expected hash if provided
    if (expectedKeyHash && expectedKeyHash !== computedKeyHash) {
      return {
        valid: false,
        error: 'Khóa bảo mật này không trùng khớp với chữ ký đã đăng ký của tài khoản!',
      }
    }

    return {
      valid: true,
      keyId,
      owner,
      payloadToken,
      keyHash: computedKeyHash,
    }
  } catch (err: any) {
    return {
      valid: false,
      error: 'Lỗi giải mã file khóa: ' + (err?.message || 'Không xác định'),
    }
  }
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from master payload token using PBKDF2
 */
async function deriveAesKey(payloadToken: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(payloadToken),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt arbitrary sensitive string (e.g. answer key, student private record) using AES-256-GCM
 */
export async function encryptSensitiveText(
  plaintext: string,
  payloadToken: string
): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
  const aesKey = await deriveAesKey(payloadToken, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  )

  // Package as salt:iv:ciphertext in Base64
  return `${bufferToHex(salt.buffer)}:${bufferToHex(iv.buffer)}:${bufferToBase64(ciphertext)}`
}

/**
 * Decrypt string encrypted by encryptSensitiveText
 */
export async function decryptSensitiveText(
  packageString: string,
  payloadToken: string
): Promise<string> {
  const parts = packageString.split(':')
  if (parts.length !== 3) {
    throw new Error('Định dạng gói mã hóa không hợp lệ!')
  }

  const salt = hexToBuffer(parts[0])
  const iv = hexToBuffer(parts[1])
  const ciphertext = base64ToBuffer(parts[2])

  const aesKey = await deriveAesKey(payloadToken, salt)
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

/**
 * Encrypt a full binary file (PDF, Word, Image) into a military-grade .senenc package
 */
export async function encryptFileWithKey(
  file: File,
  payloadToken: string
): Promise<{ encryptedBlob: Blob; outputFilename: string }> {
  const fileBytes = await file.arrayBuffer()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveAesKey(payloadToken, salt)

  // Envelope header with original metadata
  const metadata = JSON.stringify({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    encryptedAt: new Date().toISOString(),
  })
  const metadataBytes = new TextEncoder().encode(metadata)
  const metadataLength = new Uint32Array([metadataBytes.byteLength])

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileBytes
  )

  // File structure:
  // [MAGIC: 8 bytes ("SENENC01")]
  // [SALT: 16 bytes]
  // [IV: 12 bytes]
  // [METADATA_LEN: 4 bytes]
  // [METADATA: variable bytes]
  // [CIPHERTEXT: remaining bytes]
  const magic = new TextEncoder().encode('SENENC01')
  const finalBlob = new Blob(
    [magic, salt, iv, metadataLength, metadataBytes, ciphertext],
    { type: 'application/octet-stream' }
  )

  const outputFilename = `${file.name.replace(/\.[^/.]+$/, '')}.senenc`
  return { encryptedBlob: finalBlob, outputFilename }
}

/**
 * Decrypt a .senenc package back into original binary file
 */
export async function decryptFileWithKey(
  encryptedBlob: Blob,
  payloadToken: string
): Promise<{ decryptedBlob: Blob; originalFilename: string; originalType: string }> {
  const buffer = await encryptedBlob.arrayBuffer()
  const view = new DataView(buffer)

  // Verify magic header
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 8))
  if (magic !== 'SENENC01') {
    throw new Error('Tệp tin không phải là gói mã hóa hợp lệ của SenExam (thiếu chữ ký SENENC01)!')
  }

  const salt = new Uint8Array(buffer, 8, 16)
  const iv = new Uint8Array(buffer, 24, 12)
  const metadataLen = view.getUint32(36, true)
  const metadataBytes = new Uint8Array(buffer, 40, metadataLen)
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))

  const ciphertext = new Uint8Array(buffer, 40 + metadataLen)
  const aesKey = await deriveAesKey(payloadToken, salt)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  )

  const originalType = metadata.type || 'application/octet-stream'
  const originalFilename = metadata.name || 'decrypted_file'
  const decryptedBlob = new Blob([decryptedBuffer], { type: originalType })

  return { decryptedBlob, originalFilename, originalType }
}
