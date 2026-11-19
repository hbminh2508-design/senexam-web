/**
 * Sen Chat Signal Protocol TypeScript Interface & IndexedDB Secure Key Store
 * Non-extractable client key persistence using native IndexedDB
 */

import {
  generateIdentityKeyPair as mjsGenerateIdentityKeyPair,
  generateSignedPrekey as mjsGenerateSignedPrekey,
  verifySignedPrekey as mjsVerifySignedPrekey,
  generateOneTimePrekeys as mjsGenerateOneTimePrekeys,
  x3dhInitiateSession as mjsX3dhInitiateSession,
  x3dhReceiveSession as mjsX3dhReceiveSession,
  initDoubleRatchetSession as mjsInitDoubleRatchetSession,
  ratchetEncrypt as mjsRatchetEncrypt,
  ratchetDecrypt as mjsRatchetDecrypt,
  calculateSafetyNumber as mjsCalculateSafetyNumber,
  verifyIdentityKeyIntegrity as mjsVerifyIdentityKeyIntegrity,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from './senChatSignalProtocol.mjs'

export {
  mjsGenerateIdentityKeyPair as generateIdentityKeyPair,
  mjsGenerateSignedPrekey as generateSignedPrekey,
  mjsVerifySignedPrekey as verifySignedPrekey,
  mjsGenerateOneTimePrekeys as generateOneTimePrekeys,
  mjsX3dhInitiateSession as x3dhInitiateSession,
  mjsX3dhReceiveSession as x3dhReceiveSession,
  mjsInitDoubleRatchetSession as initDoubleRatchetSession,
  mjsRatchetEncrypt as ratchetEncrypt,
  mjsRatchetDecrypt as ratchetDecrypt,
  mjsCalculateSafetyNumber as calculateSafetyNumber,
  mjsVerifyIdentityKeyIntegrity as verifyIdentityKeyIntegrity,
  uint8ArrayToBase64,
  base64ToUint8Array,
}

// ------------------------------------------------------------------------------
// IndexedDB Non-Extractable Key Store for Browser / Mobile WebView
// ------------------------------------------------------------------------------
const DB_NAME = 'sen_chat_secure_keystore'
const STORE_NAME = 'non_extractable_keys'
const DB_VERSION = 1

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trong môi trường này'))
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'keyId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Lưu trữ CryptoKey non-extractable an toàn vào IndexedDB
 */
export async function saveSecureCryptoKey(keyId: string, keyObject: any): Promise<void> {
  const db = await openKeyStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put({ keyId, keyObject, savedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Tải CryptoKey từ IndexedDB
 */
export async function getSecureCryptoKey(keyId: string): Promise<any | null> {
  try {
    const db = await openKeyStore()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(keyId)
      req.onsuccess = () => resolve(req.result?.keyObject || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/**
 * Xóa CryptoKey khỏi IndexedDB
 */
export async function deleteSecureCryptoKey(keyId: string): Promise<void> {
  try {
    const db = await openKeyStore()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(keyId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {}
}
