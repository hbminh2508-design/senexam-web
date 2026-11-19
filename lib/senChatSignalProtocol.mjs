/**
 * ==============================================================================
 * SEN CHAT SIGNAL PROTOCOL CRYPTOGRAPHIC ENGINE
 * Implementation of Signal Protocol (X3DH + Double Ratchet + Safety Numbers)
 * Using standard Web Crypto API (SubtleCrypto: ECDH P-256, ECDSA, HKDF, HMAC, AES-256-GCM)
 * Zero-Knowledge, Military-Grade End-to-End Encryption (E2EE)
 * ==============================================================================
 */

const subtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle

// ------------------------------------------------------------------------------
// Encoding & Binary Helpers
// ------------------------------------------------------------------------------
export function uint8ArrayToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64) {
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

export function uint8ArrayToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToUint8Array(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16)
  }
  return bytes
}

export function concatBuffers(...buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  return result
}

// ------------------------------------------------------------------------------
// 1. Key Generation (Identity, Signed Prekey, One-Time Prekeys)
// ------------------------------------------------------------------------------

/**
 * Tạo cặp khóa định danh Identity Key (ECDH để trao đổi khóa + ECDSA để ký xác thực)
 */
export async function generateIdentityKeyPair(extractable = true) {
  // 1. Cặp khóa ECDH cho trao đổi khóa X3DH
  const dhKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    extractable,
    ['deriveBits', 'deriveKey']
  )

  // 2. Cặp khóa ECDSA cho ký điện tử prekeys và xác thực danh tính
  const signingKeyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    extractable,
    ['sign', 'verify']
  )

  const rawDhPublic = await subtle.exportKey('raw', dhKeyPair.publicKey)
  const rawSigningPublic = await subtle.exportKey('raw', signingKeyPair.publicKey)

  const registrationId = Math.floor(Math.random() * 16380) + 1

  return {
    registrationId,
    dhKeyPair,
    signingKeyPair,
    publicKeys: {
      dhPublicKey: uint8ArrayToBase64(new Uint8Array(rawDhPublic)),
      signingPublicKey: uint8ArrayToBase64(new Uint8Array(rawSigningPublic)),
    },
  }
}

/**
 * Tạo Signed Prekey và ký bằng Signing Private Key của Identity
 */
export async function generateSignedPrekey(identitySigningPrivateKey, keyId = 1) {
  const prekeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  )

  const rawPrekeyPublic = await subtle.exportKey('raw', prekeyPair.publicKey)

  // Ký lên raw public key bằng ECDSA-SHA256
  const signatureBuffer = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    identitySigningPrivateKey,
    rawPrekeyPublic
  )

  return {
    keyId,
    keyPair: prekeyPair,
    publicKey: uint8ArrayToBase64(new Uint8Array(rawPrekeyPublic)),
    signature: uint8ArrayToBase64(new Uint8Array(signatureBuffer)),
  }
}

/**
 * Xác minh chữ ký Signed Prekey bằng Identity Signing Public Key của đối phương
 */
export async function verifySignedPrekey(signingPublicKeyBase64, prekeyPublicKeyBase64, signatureBase64) {
  try {
    const rawSigningKey = base64ToUint8Array(signingPublicKeyBase64)
    const rawPrekey = base64ToUint8Array(prekeyPublicKeyBase64)
    const signature = base64ToUint8Array(signatureBase64)

    const cryptoKey = await subtle.importKey(
      'raw',
      rawSigningKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )

    return await subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      cryptoKey,
      signature,
      rawPrekey
    )
  } catch (err) {
    return false
  }
}

/**
 * Tạo danh sách One-Time Prekeys (OPK)
 */
export async function generateOneTimePrekeys(startKeyId = 1, count = 10) {
  const prekeys = []
  for (let i = 0; i < count; i++) {
    const keyId = startKeyId + i
    const keyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    const rawPublic = await subtle.exportKey('raw', keyPair.publicKey)
    prekeys.push({
      keyId,
      keyPair,
      publicKey: uint8ArrayToBase64(new Uint8Array(rawPublic)),
    })
  }
  return prekeys
}

// ------------------------------------------------------------------------------
// 2. KDF & Cryptographic Primitives (HKDF & HMAC)
// ------------------------------------------------------------------------------

/**
 * Thực hiện ECDH derive bits giữa private key cục bộ và public key từ xa
 */
async function computeEcdh(privateKey, rawPublicKeyBase64OrBuffer) {
  const rawBytes = typeof rawPublicKeyBase64OrBuffer === 'string'
    ? base64ToUint8Array(rawPublicKeyBase64OrBuffer)
    : new Uint8Array(rawPublicKeyBase64OrBuffer)

  const remotePublicKey = await subtle.importKey(
    'raw',
    rawBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  const derivedBits = await subtle.deriveBits(
    { name: 'ECDH', public: remotePublicKey },
    privateKey,
    256
  )

  return new Uint8Array(derivedBits)
}

/**
 * HKDF-SHA256 Derivation
 */
export async function hkdfDerive(ikmBytes, saltBytes, infoString, outputLengthBytes = 64) {
  const baseKey = await subtle.importKey(
    'raw',
    ikmBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  )

  const salt = saltBytes || new Uint8Array(32)
  const info = new TextEncoder().encode(infoString)

  const derived = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: info,
    },
    baseKey,
    outputLengthBytes * 8
  )

  return new Uint8Array(derived)
}

/**
 * HMAC-SHA256 Derivation
 */
export async function hmacSha256(keyBytes, dataBytes) {
  const cryptoKey = await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await subtle.sign('HMAC', cryptoKey, dataBytes)
  return new Uint8Array(sig)
}

// ------------------------------------------------------------------------------
// 3. X3DH Protocol (Extended Triple Diffie-Hellman Handshake)
// ------------------------------------------------------------------------------

/**
 * Phía Alice: Khởi tạo phiên X3DH gửi cho Bob
 */
export async function x3dhInitiateSession({
  aliceIdentityKeyPair,
  bobIdentityKeyBase64,
  bobSignedPrekey,
  bobOneTimePrekey = null,
}) {
  // 1. Xác minh chữ ký Signed Prekey của Bob
  if (bobSignedPrekey.signature && bobIdentityKeyBase64.signingPublicKey) {
    const valid = await verifySignedPrekey(
      bobIdentityKeyBase64.signingPublicKey,
      bobSignedPrekey.publicKey,
      bobSignedPrekey.signature
    )
    if (!valid) {
      throw new Error('Chữ ký Signed Prekey của đối phương không hợp lệ! Phát hiện nguy cơ giả mạo.')
    }
  }

  // 2. Alice sinh cặp khóa Ephemeral (EK_A)
  const aliceEphemeralKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  )
  const rawEphemeralPublic = await subtle.exportKey('raw', aliceEphemeralKeyPair.publicKey)
  const ephemeralPublicKeyBase64 = uint8ArrayToBase64(new Uint8Array(rawEphemeralPublic))

  // 3. Tính toán các thành phần DH (Triple hoặc Quadruple Diffie-Hellman)
  // DH1 = DH(IK_A, SPK_B)
  const dh1 = await computeEcdh(aliceIdentityKeyPair.dhKeyPair.privateKey, bobSignedPrekey.publicKey)
  // DH2 = DH(EK_A, IK_B)
  const bobDhPublic = bobIdentityKeyBase64.dhPublicKey || bobIdentityKeyBase64
  const dh2 = await computeEcdh(aliceEphemeralKeyPair.privateKey, bobDhPublic)
  // DH3 = DH(EK_A, SPK_B)
  const dh3 = await computeEcdh(aliceEphemeralKeyPair.privateKey, bobSignedPrekey.publicKey)

  let combinedDh = concatBuffers(dh1, dh2, dh3)

  // DH4 = DH(EK_A, OPK_B) nếu có OPK
  if (bobOneTimePrekey?.publicKey) {
    const dh4 = await computeEcdh(aliceEphemeralKeyPair.privateKey, bobOneTimePrekey.publicKey)
    combinedDh = concatBuffers(combinedDh, dh4)
  }

  // 4. KDF tạo Master Shared Secret (SK)
  const masterSharedSecret = await hkdfDerive(
    combinedDh,
    new Uint8Array(32), // 32-byte zero salt
    'SenChat_Signal_X3DH_V1',
    32
  )

  return {
    masterSharedSecret,
    x3dhHeader: {
      ephemeralPublicKey: ephemeralPublicKeyBase64,
      usedSignedPrekeyId: bobSignedPrekey.keyId,
      usedOneTimePrekeyId: bobOneTimePrekey ? bobOneTimePrekey.keyId : null,
      aliceIdentityKey: aliceIdentityKeyPair.publicKeys,
    },
  }
}

/**
 * Phía Bob: Tiếp nhận phiên X3DH do Alice gửi tới
 */
export async function x3dhReceiveSession({
  bobIdentityKeyPair,
  bobSignedPrekeyPair,
  bobOneTimePrekeyPair = null,
  aliceIdentityKeyBase64,
  aliceEphemeralPublicKeyBase64,
}) {
  const aliceDhPublic = aliceIdentityKeyBase64.dhPublicKey || aliceIdentityKeyBase64

  // DH1 = DH(SPK_B, IK_A)
  const dh1 = await computeEcdh(bobSignedPrekeyPair.privateKey, aliceDhPublic)
  // DH2 = DH(IK_B, EK_A)
  const dh2 = await computeEcdh(bobIdentityKeyPair.dhKeyPair.privateKey, aliceEphemeralPublicKeyBase64)
  // DH3 = DH(SPK_B, EK_A)
  const dh3 = await computeEcdh(bobSignedPrekeyPair.privateKey, aliceEphemeralPublicKeyBase64)

  let combinedDh = concatBuffers(dh1, dh2, dh3)

  if (bobOneTimePrekeyPair) {
    const dh4 = await computeEcdh(bobOneTimePrekeyPair.privateKey, aliceEphemeralPublicKeyBase64)
    combinedDh = concatBuffers(combinedDh, dh4)
  }

  const masterSharedSecret = await hkdfDerive(
    combinedDh,
    new Uint8Array(32),
    'SenChat_Signal_X3DH_V1',
    32
  )

  return { masterSharedSecret }
}

// ------------------------------------------------------------------------------
// 4. Double Ratchet Implementation (Signal Protocol)
// ------------------------------------------------------------------------------

/**
 * Khởi tạo trạng thái phiên Double Ratchet (Session State)
 */
export async function initDoubleRatchetSession({
  masterSharedSecret,
  isInitiator,
  localRatchetKeyPair = null,
  remoteRatchetPublicKey = null,
}) {
  const rootKey = masterSharedSecret

  // Derive initial symmetric sending and receiving chain keys from master shared secret
  const initAliceSend = await hkdfDerive(rootKey, new Uint8Array(32), 'SenChat_Chain_A_to_B', 32)
  const initBobSend = await hkdfDerive(rootKey, new Uint8Array(32), 'SenChat_Chain_B_to_A', 32)

  const sendingChainKey = isInitiator ? initAliceSend : initBobSend
  const receivingChainKey = isInitiator ? initBobSend : initAliceSend

  const activeLocalRatchetKeyPair = localRatchetKeyPair || await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  )

  const rawLocalPublic = new Uint8Array(await subtle.exportKey('raw', activeLocalRatchetKeyPair.publicKey))
  const localRatchetPublicKeyBase64 = uint8ArrayToBase64(rawLocalPublic)

  return {
    rootKey,
    sendingChainKey,
    receivingChainKey,
    localRatchetKeyPair: activeLocalRatchetKeyPair,
    localRatchetPublicKey: localRatchetPublicKeyBase64,
    remoteRatchetPublicKey,
    sendCounter: 0,
    receiveCounter: 0,
    seenCounters: new Set(),
  }
}

/**
 * Mã hóa tin nhắn theo Double Ratchet
 */
export async function ratchetEncrypt(session, plaintextString, metadata = {}) {
  // 1. Symmetric KDF Ratchet: Sinh Message Key (MK) và Next Chain Key
  const messageKey = await hmacSha256(session.sendingChainKey, new Uint8Array([0x01]))
  session.sendingChainKey = await hmacSha256(session.sendingChainKey, new Uint8Array([0x02]))

  const currentCounter = session.sendCounter
  session.sendCounter++

  // 2. Chuẩn bị Nonce (IV 12 bytes ngẫu nhiên chuẩn GCM)
  const nonceBytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(nonceBytes)

  // 3. Chuẩn bị Associated Data (AD) xác thực metadata và counter chống giả mạo
  const localRatchetPublicBase64 = session.localRatchetPublicKey || ''
  const adString = `${currentCounter}:${localRatchetPublicBase64}:${metadata.senderId || ''}:${metadata.recipientId || ''}`
  const adBytes = new TextEncoder().encode(adString)

  // 4. Mã hóa AES-256-GCM
  const aesKey = await subtle.importKey(
    'raw',
    messageKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const plaintextBytes = new TextEncoder().encode(plaintextString)
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonceBytes,
      additionalData: adBytes,
      tagLength: 128,
    },
    aesKey,
    plaintextBytes
  )

  const idempotencyKey = metadata.idempotencyKey || `sen_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    nonce: uint8ArrayToBase64(nonceBytes),
    counter: currentCounter,
    ephemeralRatchetKey: localRatchetPublicBase64,
    idempotencyKey,
  }
}

/**
 * Giải mã tin nhắn theo Double Ratchet
 */
export async function ratchetDecrypt(session, messagePayload, metadata = {}) {
  const { ciphertext, nonce, counter, ephemeralRatchetKey } = messagePayload

  // 0. Chống Replay: Kiểm tra counter và idempotency
  const seenKey = `${counter}:${ephemeralRatchetKey || ''}`
  if (session.seenCounters.has(seenKey)) {
    throw new Error(`Phát hiện tấn công phát lại (Replay Attack)! Counter ${counter} đã được nhận trước đó.`)
  }

  // 1. Kiểm tra xem tin nhắn có mang Ratchet Public Key mới từ đối phương không (DH Ratchet step)
  if (ephemeralRatchetKey && session.remoteRatchetPublicKey && ephemeralRatchetKey !== session.remoteRatchetPublicKey) {
    session.remoteRatchetPublicKey = ephemeralRatchetKey

    // Step A: Tính DH với remote ratchet key mới để derive receivingChainKey mới
    const dhReceive = await computeEcdh(session.localRatchetKeyPair.privateKey, session.remoteRatchetPublicKey)
    const derivedReceive = await hkdfDerive(dhReceive, session.rootKey, 'SenChat_Ratchet_Root_V1', 64)
    session.rootKey = derivedReceive.slice(0, 32)
    session.receivingChainKey = derivedReceive.slice(32, 64)

    // Step B: Tạo local ratchet keypair mới cho các tin gửi tiếp theo
    session.localRatchetKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    const rawLocalPublic = new Uint8Array(await subtle.exportKey('raw', session.localRatchetKeyPair.publicKey))
    session.localRatchetPublicKey = uint8ArrayToBase64(rawLocalPublic)

    const dhSend = await computeEcdh(session.localRatchetKeyPair.privateKey, session.remoteRatchetPublicKey)
    const derivedSend = await hkdfDerive(dhSend, session.rootKey, 'SenChat_Ratchet_Root_V1', 64)
    session.rootKey = derivedSend.slice(0, 32)
    session.sendingChainKey = derivedSend.slice(32, 64)
  } else if (ephemeralRatchetKey && !session.remoteRatchetPublicKey) {
    session.remoteRatchetPublicKey = ephemeralRatchetKey
  }

  // 2. Symmetric KDF Ratchet: Sinh Message Key (MK)
  const messageKey = await hmacSha256(session.receivingChainKey, new Uint8Array([0x01]))
  session.receivingChainKey = await hmacSha256(session.receivingChainKey, new Uint8Array([0x02]))
  session.seenCounters.add(seenKey)

  // 3. Chuẩn bị AD kiểm tra tính toàn vẹn
  const adString = `${counter}:${ephemeralRatchetKey || ''}:${metadata.senderId || ''}:${metadata.recipientId || ''}`
  const adBytes = new TextEncoder().encode(adString)

  // 4. Giải mã AES-256-GCM
  const aesKey = await subtle.importKey(
    'raw',
    messageKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const ciphertextBytes = base64ToUint8Array(ciphertext)
  const nonceBytes = base64ToUint8Array(nonce)

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonceBytes,
      additionalData: adBytes,
      tagLength: 128,
    },
    aesKey,
    ciphertextBytes
  )

  return new TextDecoder().decode(decryptedBuffer)
}

// ------------------------------------------------------------------------------
// 5. Safety Number & QR Code (Mã an toàn Signal)
// ------------------------------------------------------------------------------

/**
 * Tính mã an toàn Safety Number (60 chữ số chia thành 12 nhóm 5 số) từ 2 khóa Identity
 * Đảm bảo tính giao hoán: calculateSafetyNumber(Alice, Bob) === calculateSafetyNumber(Bob, Alice)
 */
export async function calculateSafetyNumber(userAId, identityKeyA, userBId, identityKeyB) {
  const keyAStr = typeof identityKeyA === 'string' ? identityKeyA : (identityKeyA.dhPublicKey || JSON.stringify(identityKeyA))
  const keyBStr = typeof identityKeyB === 'string' ? identityKeyB : (identityKeyB.dhPublicKey || JSON.stringify(identityKeyB))

  // Sắp xếp thứ tự từ điển để cả 2 phía cho ra cùng một mã đối xứng
  const sorted = [
    { id: userAId, key: keyAStr },
    { id: userBId, key: keyBStr },
  ].sort((a, b) => a.key.localeCompare(b.key))

  const combinedString = `SENCHAT_SAFETY_V1:${sorted[0].id}:${sorted[0].key}:${sorted[1].id}:${sorted[1].key}`
  const encoder = new TextEncoder()
  const hashBuffer = await subtle.digest('SHA-512', encoder.encode(combinedString))
  const hashBytes = new Uint8Array(hashBuffer)

  // Rút gọn thành 12 cụm số (mỗi cụm 5 chữ số = 60 chữ số tổng cộng)
  const chunks = []
  for (let i = 0; i < 12; i++) {
    const offset = i * 4
    const value = (hashBytes[offset] << 24) | (hashBytes[offset + 1] << 16) | (hashBytes[offset + 2] << 8) | hashBytes[offset + 3]
    const positiveValue = Math.abs(value) % 100000
    chunks.push(positiveValue.toString().padStart(5, '0'))
  }

  const numericSafetyNumber = chunks.join(' ')
  const fingerprintHex = uint8ArrayToHex(hashBytes.slice(0, 32))
  const qrCodePayload = `senchat://safety-verify?v=1&u1=${sorted[0].id}&u2=${sorted[1].id}&fp=${fingerprintHex}`

  return {
    numericSafetyNumber,
    chunks,
    fingerprintHex,
    qrCodePayload,
  }
}

/**
 * Phát hiện khi Identity Key của đối phương thay đổi (Khóa mới / Thiết bị mới / Tấn công mạo danh)
 */
export function verifyIdentityKeyIntegrity(storedIdentityKey, incomingIdentityKey) {
  if (!storedIdentityKey) {
    return {
      isTrusted: true,
      isFirstSeen: true,
      keyChanged: false,
      alertMessage: null,
    }
  }

  const storedStr = typeof storedIdentityKey === 'string' ? storedIdentityKey : storedIdentityKey.dhPublicKey
  const incomingStr = typeof incomingIdentityKey === 'string' ? incomingIdentityKey : incomingIdentityKey.dhPublicKey

  if (storedStr !== incomingStr) {
    return {
      isTrusted: false,
      isFirstSeen: false,
      keyChanged: true,
      alertMessage: '⚠️ CẢNH BÁO AN NINH: Mã an toàn của đối phương đã thay đổi! Điều này có thể xảy ra khi họ cài lại ứng dụng hoặc có thiết bị mới, hoặc có kẻ tấn công mạo danh. Hãy quét lại mã QR an toàn trước khi tiếp tục trò chuyện.',
    }
  }

  return {
    isTrusted: true,
    isFirstSeen: false,
    keyChanged: false,
    alertMessage: null,
  }
}
