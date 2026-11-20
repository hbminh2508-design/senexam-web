/**
 * ==============================================================================
 * SEN CHAT MLS (RFC 9420) GROUP CRYPTOGRAPHIC ENGINE
 * Production implementation using audited `ts-mls` library.
 * Zero-knowledge, Post-Compromise Security (PCS), Forward Secrecy.
 * Handles key packages, group initialization, member additions/removals with
 * automatic key rotation (MLS Commits), welcome messages, and ratchet trees.
 * ==============================================================================
 */

import {
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  nobleCryptoProvider,
  defaultCapabilities,
  defaultLifetime,
  generateKeyPackage as tsMlsGenerateKeyPackage,
  createGroup as tsMlsCreateGroup,
  createCommit as tsMlsCreateCommit,
  joinGroup as tsMlsJoinGroup,
  emptyPskIndex,
  createApplicationMessage as tsMlsCreateApplicationMessage,
  processMessage as tsMlsProcessMessage,
  processPrivateMessage as tsMlsProcessPrivateMessage,
  acceptAll,
} from 'ts-mls'

export const DEFAULT_MLS_CIPHERSUITE = 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256'

// ------------------------------------------------------------------------------
// Serialization Helpers (Handles Uint8Array <-> Base64 and BigInt <-> String)
// ------------------------------------------------------------------------------
export function serializeMls(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value instanceof Uint8Array) {
      if (typeof Buffer !== 'undefined') {
        return { __u8: Buffer.from(value).toString('base64') }
      }
      let binary = ''
      for (let i = 0; i < value.byteLength; i++) {
        binary += String.fromCharCode(value[i])
      }
      return { __u8: btoa(binary) }
    }
    if (typeof value === 'bigint') {
      return { __bigint: value.toString() }
    }
    if (value instanceof Map) {
      return { __map: Array.from(value.entries()) }
    }
    return value
  })
}

export function deserializeMls(jsonStr) {
  if (typeof jsonStr !== 'string') return jsonStr
  return JSON.parse(jsonStr, (key, value) => {
    if (value && typeof value === 'object') {
      if (value.__u8) {
        if (typeof Buffer !== 'undefined') {
          return new Uint8Array(Buffer.from(value.__u8, 'base64'))
        }
        const binary = atob(value.__u8)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        return bytes
      }
      if (value.__bigint) {
        return BigInt(value.__bigint)
      }
      if (value.__map) {
        return new Map(value.__map)
      }
    }
    return value
  })
}

/**
 * Cache and retrieve MLS ciphersuite implementation
 */
let cachedCiphersuite = null
export async function getMlsCiphersuite(name = DEFAULT_MLS_CIPHERSUITE) {
  if (cachedCiphersuite && cachedCiphersuite.name === name) {
    return cachedCiphersuite
  }
  const csInfo = getCiphersuiteFromName(name)
  cachedCiphersuite = await getCiphersuiteImpl(csInfo, nobleCryptoProvider)
  return cachedCiphersuite
}

/**
 * Tạo cặp KeyPackage (Public Package + Private Package) cho người dùng
 */
export async function generateMlsKeyPackage(identityEmail, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const normalizedEmail = (identityEmail || 'anon@senexam.me').trim().toLowerCase()
  const cred = {
    credentialType: 'basic',
    identity: new TextEncoder().encode(normalizedEmail),
  }

  const kp = await tsMlsGenerateKeyPackage(
    cred,
    defaultCapabilities(),
    defaultLifetime,
    [],
    cs
  )

  const serializedPublic = serializeMls(kp.publicPackage)
  const serializedPrivate = serializeMls(kp.privatePackage)

  return {
    publicPackage: kp.publicPackage,
    privatePackage: kp.privatePackage,
    serializedPublic,
    serializedPrivate,
    identityEmail: normalizedEmail,
  }
}

/**
 * Khởi tạo nhóm chat MLS mới (Epoch 0)
 */
export async function createMlsGroup(groupIdStr, creatorKp, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const publicPackage = typeof creatorKp.publicPackage === 'string' 
    ? deserializeMls(creatorKp.publicPackage) 
    : creatorKp.publicPackage
  const privatePackage = typeof creatorKp.privatePackage === 'string'
    ? deserializeMls(creatorKp.privatePackage)
    : creatorKp.privatePackage

  const groupIdBytes = new TextEncoder().encode(groupIdStr)
  const groupState = await tsMlsCreateGroup(
    groupIdBytes,
    publicPackage,
    privatePackage,
    [],
    cs
  )

  return {
    state: groupState,
    epoch: Number(groupState.groupContext.epoch),
    serializedState: serializeMls(groupState),
    ratchetTree: groupState.ratchetTree,
    serializedRatchetTree: serializeMls(groupState.ratchetTree),
  }
}

/**
 * Thêm một thành viên vào nhóm MLS (Tạo Add Proposal + Commit xoay khóa + Welcome message)
 */
export async function addMemberToMlsGroup(groupState, newMemberPublicPackage, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState
  const newMemberKp = typeof newMemberPublicPackage === 'string' 
    ? deserializeMls(newMemberPublicPackage) 
    : newMemberPublicPackage

  const addProposal = {
    proposalType: 'add',
    add: { keyPackage: newMemberKp },
  }

  const commitRes = await tsMlsCreateCommit(
    { state, cipherSuite: cs, pskIndex: emptyPskIndex },
    { extraProposals: [addProposal], ratchetTreeExtension: true }
  )

  return {
    newState: commitRes.newState,
    newEpoch: Number(commitRes.newState.groupContext.epoch),
    welcome: commitRes.welcome,
    commit: commitRes.commit,
    welcomeSerialized: serializeMls(commitRes.welcome),
    commitSerialized: serializeMls(commitRes.commit),
    ratchetTree: commitRes.newState.ratchetTree,
    ratchetTreeSerialized: serializeMls(commitRes.newState.ratchetTree),
  }
}

/**
 * Thành viên mới gia nhập nhóm từ gói Welcome và RatchetTree
 */
export async function joinMlsGroup(welcome, memberKp, ratchetTree, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const welcomeObj = typeof welcome === 'string' ? deserializeMls(welcome) : welcome
  const publicPackage = typeof memberKp.publicPackage === 'string' 
    ? deserializeMls(memberKp.publicPackage) 
    : memberKp.publicPackage
  const privatePackage = typeof memberKp.privatePackage === 'string'
    ? deserializeMls(memberKp.privatePackage)
    : memberKp.privatePackage
  const tree = typeof ratchetTree === 'string' ? deserializeMls(ratchetTree) : ratchetTree

  const joinedState = await tsMlsJoinGroup(
    welcomeObj,
    publicPackage,
    privatePackage,
    emptyPskIndex,
    cs,
    tree
  )

  return {
    state: joinedState,
    epoch: Number(joinedState.groupContext.epoch),
    serializedState: serializeMls(joinedState),
    ratchetTree: joinedState.ratchetTree,
  }
}

/**
 * Xóa thành viên khỏi nhóm MLS (Tạo Remove Proposal + Commit xoay khóa mới)
 */
export async function removeMemberFromMlsGroup(groupState, leafIndex, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState

  const removeProposal = {
    proposalType: 'remove',
    remove: { removed: leafIndex },
  }

  const commitRes = await tsMlsCreateCommit(
    { state, cipherSuite: cs, pskIndex: emptyPskIndex },
    { extraProposals: [removeProposal], ratchetTreeExtension: true }
  )

  return {
    newState: commitRes.newState,
    newEpoch: Number(commitRes.newState.groupContext.epoch),
    commit: commitRes.commit,
    commitSerialized: serializeMls(commitRes.commit),
    ratchetTree: commitRes.newState.ratchetTree,
    ratchetTreeSerialized: serializeMls(commitRes.newState.ratchetTree),
  }
}

/**
 * Áp dụng Commit xoay khóa do thành viên khác gửi để chuyển trạng thái nhóm sang Epoch mới
 */
export async function processMlsCommit(groupState, commitMessage, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState
  const commitObj = typeof commitMessage === 'string' ? deserializeMls(commitMessage) : commitMessage

  const result = await tsMlsProcessMessage(commitObj, state, emptyPskIndex, acceptAll, cs)

  return {
    newState: result.newState,
    newEpoch: Number(result.newState.groupContext.epoch),
    serializedState: serializeMls(result.newState),
    ratchetTree: result.newState.ratchetTree,
  }
}

/**
 * Mã hóa tin nhắn nhóm MLS (MLS Application Message)
 */
export async function encryptMlsMessage(groupState, plaintext, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState
  const textBytes = new TextEncoder().encode(plaintext)

  const msgRes = await tsMlsCreateApplicationMessage(state, textBytes, cs)

  return {
    newState: msgRes.newState,
    privateMessage: msgRes.privateMessage,
    messageSerialized: serializeMls(msgRes.privateMessage),
  }
}

/**
 * Giải mã tin nhắn nhóm MLS (MLS Application Message)
 */
export async function decryptMlsMessage(groupState, privateMessage, ciphersuiteName = DEFAULT_MLS_CIPHERSUITE) {
  const cs = await getMlsCiphersuite(ciphersuiteName)
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState
  const msgObj = typeof privateMessage === 'string' ? deserializeMls(privateMessage) : privateMessage

  const res = await tsMlsProcessPrivateMessage(state, msgObj, emptyPskIndex, cs)
  const plaintext = new TextDecoder().decode(res.message)

  return {
    newState: res.newState,
    plaintext,
  }
}

/**
 * Tìm chỉ số leafIndex của thành viên trong cây RatchetTree theo email/identity
 */
export function findMemberLeafIndex(groupState, identityEmail) {
  const state = typeof groupState === 'string' ? deserializeMls(groupState) : groupState
  const tree = state.ratchetTree || []
  const target = (identityEmail || '').trim().toLowerCase()

  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node?.nodeType === 'leaf' && node.leaf?.credential) {
      try {
        const idStr = new TextDecoder().decode(node.leaf.credential.identity).trim().toLowerCase()
        if (idStr === target) {
          // Node tại i là leaf => leafIndex tương ứng là i / 2
          return Math.floor(i / 2)
        }
      } catch {
        // ignore
      }
    }
  }
  return -1
}
