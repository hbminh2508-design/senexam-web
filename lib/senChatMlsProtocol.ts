/**
 * Sen Chat MLS Protocol TypeScript Interface & Secure Group State Store
 * Persistent IndexedDB storage for group client states and key packages
 */

import {
  DEFAULT_MLS_CIPHERSUITE,
  serializeMls,
  deserializeMls,
  getMlsCiphersuite,
  generateMlsKeyPackage as mjsGenerateMlsKeyPackage,
  createMlsGroup as mjsCreateMlsGroup,
  addMemberToMlsGroup as mjsAddMemberToMlsGroup,
  joinMlsGroup as mjsJoinMlsGroup,
  removeMemberFromMlsGroup as mjsRemoveMemberFromMlsGroup,
  processMlsCommit as mjsProcessMlsCommit,
  encryptMlsMessage as mjsEncryptMlsMessage,
  decryptMlsMessage as mjsDecryptMlsMessage,
  findMemberLeafIndex as mjsFindMemberLeafIndex,
} from './senChatMlsProtocol.mjs'

export {
  DEFAULT_MLS_CIPHERSUITE,
  serializeMls,
  deserializeMls,
  getMlsCiphersuite,
  mjsGenerateMlsKeyPackage as generateMlsKeyPackage,
  mjsCreateMlsGroup as createMlsGroup,
  mjsAddMemberToMlsGroup as addMemberToMlsGroup,
  mjsJoinMlsGroup as joinMlsGroup,
  mjsRemoveMemberFromMlsGroup as removeMemberFromMlsGroup,
  mjsProcessMlsCommit as processMlsCommit,
  mjsEncryptMlsMessage as encryptMlsMessage,
  mjsDecryptMlsMessage as decryptMlsMessage,
  mjsFindMemberLeafIndex as findMemberLeafIndex,
}

// ------------------------------------------------------------------------------
// IndexedDB Secure Store for MLS Group States and Key Packages
// ------------------------------------------------------------------------------
const MLS_DB_NAME = 'sen_chat_mls_store'
const MLS_STORE_GROUPS = 'mls_group_states'
const MLS_STORE_KP = 'mls_key_packages'
const MLS_DB_VERSION = 1

function openMlsStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không khả dụng'))
    }
    const request = window.indexedDB.open(MLS_DB_NAME, MLS_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MLS_STORE_GROUPS)) {
        db.createObjectStore(MLS_STORE_GROUPS, { keyPath: 'groupId' })
      }
      if (!db.objectStoreNames.contains(MLS_STORE_KP)) {
        db.createObjectStore(MLS_STORE_KP, { keyPath: 'keyId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Lưu trạng thái nhóm MLS cục bộ
 */
export async function saveLocalMlsGroupState(groupId: string, serializedState: string, epoch: number): Promise<void> {
  try {
    const db = await openMlsStore()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MLS_STORE_GROUPS, 'readwrite')
      const store = tx.objectStore(MLS_STORE_GROUPS)
      const req = store.put({ groupId, serializedState, epoch, savedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`sen_mls_group_${groupId}`, serializedState)
    }
  }
}

/**
 * Lấy trạng thái nhóm MLS cục bộ
 */
export async function getLocalMlsGroupState(groupId: string): Promise<string | null> {
  try {
    const db = await openMlsStore()
    return new Promise((resolve) => {
      const tx = db.transaction(MLS_STORE_GROUPS, 'readonly')
      const store = tx.objectStore(MLS_STORE_GROUPS)
      const req = store.get(groupId)
      req.onsuccess = () => resolve(req.result?.serializedState || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`sen_mls_group_${groupId}`) || null
    }
    return null
  }
}

/**
 * Lưu cặp KeyPackage của người dùng
 */
export async function saveLocalMlsKeyPackage(keyId: string, publicPackageSerialized: string, privatePackageSerialized: string): Promise<void> {
  try {
    const db = await openMlsStore()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MLS_STORE_KP, 'readwrite')
      const store = tx.objectStore(MLS_STORE_KP)
      const req = store.put({ keyId, publicPackageSerialized, privatePackageSerialized, savedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`sen_mls_kp_${keyId}`, JSON.stringify({ publicPackageSerialized, privatePackageSerialized }))
    }
  }
}

/**
 * Lấy cặp KeyPackage của người dùng
 */
export async function getLocalMlsKeyPackage(keyId: string): Promise<{ publicPackageSerialized: string; privatePackageSerialized: string } | null> {
  try {
    const db = await openMlsStore()
    return new Promise((resolve) => {
      const tx = db.transaction(MLS_STORE_KP, 'readonly')
      const store = tx.objectStore(MLS_STORE_KP)
      const req = store.get(keyId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`sen_mls_kp_${keyId}`)
      return raw ? JSON.parse(raw) : null
    }
    return null
  }
}
