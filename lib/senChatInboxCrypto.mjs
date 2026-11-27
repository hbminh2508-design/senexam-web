const encoder = new TextEncoder()

/** @param {ArrayBuffer | Uint8Array<ArrayBuffer>} source */
const toBase64 = (source) => {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source)
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

/** @param {string} value */
const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

/** @param {CryptoKey} privateKey @param {JsonWebKey} publicJwk @param {string} context */
async function wrappingKey(privateKey, publicJwk, context) {
  const publicKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(context) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

export const generateInboxKeyPair = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])

/**
 * @param {string} payload
 * @param {string} context
 * @param {{ user_id: string, device_id: string, public_key: JsonWebKey }[]} targets
 */
export async function sealInboxPayload(payload, context, targets) {
  const pair = await generateInboxKeyPair()
  const content = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey('raw', content, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, key, encoder.encode(payload),
  )
  const wraps = await Promise.all(targets.map(async ({ user_id, device_id, public_key }) => {
    try {
      const wrapIv = crypto.getRandomValues(new Uint8Array(12))
      const deviceContext = context + ':' + user_id + ':' + device_id
      const wrapKey = await wrappingKey(pair.privateKey, public_key, deviceContext)
      const wrapped = await crypto.subtle.encrypt({
        name: 'AES-GCM', iv: wrapIv, additionalData: encoder.encode(deviceContext),
      }, wrapKey, content)
      return { user_id, device_id, wrapped_key: toBase64(wrapped), wrap_iv: toBase64(wrapIv) }
    } catch { return null }
  }))
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    ephemeral: await crypto.subtle.exportKey('jwk', pair.publicKey),
    wraps: wraps.filter((entry) => entry !== null),
  }
}

/**
 * @param {{ ciphertext: string, iv: string, ephemeral_key: JsonWebKey }} envelope
 * @param {{ wrapped_key: string, wrap_iv: string }} delivery
 * @param {CryptoKey} privateKey
 * @param {string} context
 * @param {string} userId
 * @param {string} deviceId
 */
export async function openInboxPayload(envelope, delivery, privateKey, context, userId, deviceId) {
  const deviceContext = context + ':' + userId + ':' + deviceId
  const wrapKey = await wrappingKey(privateKey, envelope.ephemeral_key, deviceContext)
  const rawKey = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: fromBase64(delivery.wrap_iv), additionalData: encoder.encode(deviceContext),
  }, wrapKey, fromBase64(delivery.wrapped_key))
  const messageKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: encoder.encode(context) },
    messageKey, fromBase64(envelope.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}
