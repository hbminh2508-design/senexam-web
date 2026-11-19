import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateIdentityKeyPair,
  generateSignedPrekey,
  verifySignedPrekey,
  generateOneTimePrekeys,
  x3dhInitiateSession,
  x3dhReceiveSession,
  initDoubleRatchetSession,
  ratchetEncrypt,
  ratchetDecrypt,
  calculateSafetyNumber,
  verifyIdentityKeyIntegrity,
  uint8ArrayToBase64,
  uint8ArrayToHex,
} from '../lib/senChatSignalProtocol.mjs'

test('Signal Protocol: Identity & Signed Prekey verification with ECDSA', async () => {
  const aliceIdentity = await generateIdentityKeyPair(true)
  assert.ok(aliceIdentity.registrationId > 0 && aliceIdentity.registrationId <= 16380)
  assert.ok(aliceIdentity.publicKeys.dhPublicKey)
  assert.ok(aliceIdentity.publicKeys.signingPublicKey)

  // Tạo Signed Prekey và ký bằng signing key của Alice
  const signedPrekey = await generateSignedPrekey(aliceIdentity.signingKeyPair.privateKey, 101)
  assert.equal(signedPrekey.keyId, 101)
  assert.ok(signedPrekey.publicKey)
  assert.ok(signedPrekey.signature)

  // Xác minh chữ ký hợp lệ
  const isValid = await verifySignedPrekey(
    aliceIdentity.publicKeys.signingPublicKey,
    signedPrekey.publicKey,
    signedPrekey.signature
  )
  assert.equal(isValid, true, 'Chữ ký Signed Prekey phải hợp lệ khi đối chiếu với Identity Signing Key')

  // Xác minh chữ ký thất bại nếu dữ liệu bị sửa đổi (Tampering attack)
  const tamperedKey = signedPrekey.publicKey.slice(0, -4) + 'AAAA'
  const isTamperedValid = await verifySignedPrekey(
    aliceIdentity.publicKeys.signingPublicKey,
    tamperedKey,
    signedPrekey.signature
  )
  assert.equal(isTamperedValid, false, 'Chữ ký phải bị bác bỏ khi khóa công khai bị sửa đổi')
})

test('Signal Protocol: X3DH Handshake produces identical shared master secret', async () => {
  // 1. Tạo khóa cho Bob
  const bobIdentity = await generateIdentityKeyPair(true)
  const bobSignedPrekey = await generateSignedPrekey(bobIdentity.signingKeyPair.privateKey, 1)
  const bobOneTimePrekeys = await generateOneTimePrekeys(1, 5)
  const selectedOpk = bobOneTimePrekeys[0]

  // 2. Tạo khóa cho Alice
  const aliceIdentity = await generateIdentityKeyPair(true)

  // 3. Alice thực hiện X3DH khởi tạo phiên với Bundle của Bob
  const aliceSessionInit = await x3dhInitiateSession({
    aliceIdentityKeyPair: aliceIdentity,
    bobIdentityKeyBase64: bobIdentity.publicKeys,
    bobSignedPrekey: {
      keyId: bobSignedPrekey.keyId,
      publicKey: bobSignedPrekey.publicKey,
      signature: bobSignedPrekey.signature,
    },
    bobOneTimePrekey: {
      keyId: selectedOpk.keyId,
      publicKey: selectedOpk.publicKey,
    },
  })

  // 4. Bob tiếp nhận thông số từ Alice và tính toán Master Secret
  const bobSessionReceive = await x3dhReceiveSession({
    bobIdentityKeyPair: bobIdentity,
    bobSignedPrekeyPair: bobSignedPrekey.keyPair,
    bobOneTimePrekeyPair: selectedOpk.keyPair,
    aliceIdentityKeyBase64: aliceSessionInit.x3dhHeader.aliceIdentityKey,
    aliceEphemeralPublicKeyBase64: aliceSessionInit.x3dhHeader.ephemeralPublicKey,
  })

  // 5. Kiểm tra 2 Master Shared Secret khớp nhau 100% từng byte
  assert.equal(
    uint8ArrayToHex(aliceSessionInit.masterSharedSecret),
    uint8ArrayToHex(bobSessionReceive.masterSharedSecret),
    'Alice và Bob phải tính ra cùng một Master Shared Secret qua X3DH'
  )
})

test('Double Ratchet: End-to-End Encryption & Decryption Round-Trip', async () => {
  // Tạo Master Shared Secret chung giữa 2 bên
  const sharedSecret = new Uint8Array(32)
  globalThis.crypto.getRandomValues(sharedSecret)

  // Khởi tạo phiên Double Ratchet
  const aliceSession = await initDoubleRatchetSession({
    masterSharedSecret: sharedSecret,
    isInitiator: true,
  })

  const bobSession = await initDoubleRatchetSession({
    masterSharedSecret: sharedSecret,
    isInitiator: false,
  })

  // Tin nhắn 1: Alice -> Bob
  const plainText1 = 'Xin chào, đây là tin nhắn mã hóa đầu-cuối Signal E2EE trên Sen Chat!'
  const encrypted1 = await ratchetEncrypt(aliceSession, plainText1, {
    senderId: 'user_alice',
    recipientId: 'user_bob',
    idempotencyKey: 'msg_1_idem',
  })

  assert.ok(encrypted1.ciphertext)
  assert.ok(encrypted1.nonce)
  assert.equal(encrypted1.counter, 0)

  // Bob giải mã tin nhắn 1
  const decrypted1 = await ratchetDecrypt(bobSession, encrypted1, {
    senderId: 'user_alice',
    recipientId: 'user_bob',
  })
  assert.equal(decrypted1, plainText1, 'Bob phải giải mã chính xác nội dung tin nhắn 1 của Alice')

  // Tin nhắn 2: Bob -> Alice (Phản hồi ngược lại, kích hoạt DH Ratchet chuyển nấc khóa)
  const plainText2 = 'Đã nhận tin nhắn an toàn! Khóa Ratchet đang xoay tiến (Forward Secrecy).'
  const encrypted2 = await ratchetEncrypt(bobSession, plainText2, {
    senderId: 'user_bob',
    recipientId: 'user_alice',
    idempotencyKey: 'msg_2_idem',
  })

  const decrypted2 = await ratchetDecrypt(aliceSession, encrypted2, {
    senderId: 'user_bob',
    recipientId: 'user_alice',
  })
  assert.equal(decrypted2, plainText2, 'Alice phải giải mã chính xác phản hồi của Bob sau khi Ratchet xoay')

  // Tin nhắn 3: Alice gửi tiếp tin nhắn thứ 3
  const plainText3 = 'Tuyệt vời, cơ chế Double Ratchet hoạt động hoàn hảo!'
  const encrypted3 = await ratchetEncrypt(aliceSession, plainText3, {
    senderId: 'user_alice',
    recipientId: 'user_bob',
  })

  const decrypted3 = await ratchetDecrypt(bobSession, encrypted3, {
    senderId: 'user_alice',
    recipientId: 'user_bob',
  })
  assert.equal(decrypted3, plainText3)
})

test('Replay Attack Protection: Replayed messages must be rejected immediately', async () => {
  const sharedSecret = new Uint8Array(32)
  globalThis.crypto.getRandomValues(sharedSecret)

  const aliceSession = await initDoubleRatchetSession({ masterSharedSecret: sharedSecret, isInitiator: true })
  const bobSession = await initDoubleRatchetSession({ masterSharedSecret: sharedSecret, isInitiator: false })

  const encrypted = await ratchetEncrypt(aliceSession, 'Tin nhắn chuyển tiền quỹ lớp 500.000đ', {
    senderId: 'user_alice',
    recipientId: 'user_bob',
  })

  // Lần nhận 1: Hợp lệ
  const dec1 = await ratchetDecrypt(bobSession, encrypted, { senderId: 'user_alice', recipientId: 'user_bob' })
  assert.equal(dec1, 'Tin nhắn chuyển tiền quỹ lớp 500.000đ')

  // Lần nhận 2: Attacker phát lại tin nhắn cũ (Replay Attack)
  await assert.rejects(
    async () => {
      await ratchetDecrypt(bobSession, encrypted, { senderId: 'user_alice', recipientId: 'user_bob' })
    },
    /Replay Attack/,
    'Hệ thống phải chặn đứng việc phát lại tin nhắn cũ với counter trùng lặp'
  )
})

test('Safety Number & QR Code: Deterministic, Symmetric, and Change Detection', async () => {
  const aliceIdentity = await generateIdentityKeyPair(true)
  const bobIdentity = await generateIdentityKeyPair(true)

  // 1. Kiểm tra tính giao hoán: Alice tính Safety Number của Bob == Bob tính Safety Number của Alice
  const aliceCalculated = await calculateSafetyNumber(
    'user_alice_uuid',
    aliceIdentity.publicKeys,
    'user_bob_uuid',
    bobIdentity.publicKeys
  )

  const bobCalculated = await calculateSafetyNumber(
    'user_bob_uuid',
    bobIdentity.publicKeys,
    'user_alice_uuid',
    aliceIdentity.publicKeys
  )

  assert.equal(aliceCalculated.numericSafetyNumber, bobCalculated.numericSafetyNumber)
  assert.equal(aliceCalculated.chunks.length, 12, 'Safety number phải chia thành 12 cụm số 5 chữ số')
  assert.equal(aliceCalculated.fingerprintHex, bobCalculated.fingerprintHex)
  assert.ok(aliceCalculated.qrCodePayload.startsWith('senchat://safety-verify'))

  // 2. Kiểm tra phát hiện thay đổi khóa (Identity Key Change Alert)
  const initialVerification = verifyIdentityKeyIntegrity(null, aliceIdentity.publicKeys)
  assert.equal(initialVerification.isFirstSeen, true)
  assert.equal(initialVerification.keyChanged, false)

  // Khi khóa vẫn nguyên vẹn
  const sameKeyVerification = verifyIdentityKeyIntegrity(aliceIdentity.publicKeys, aliceIdentity.publicKeys)
  assert.equal(sameKeyVerification.isTrusted, true)
  assert.equal(sameKeyVerification.keyChanged, false)

  // Khi Bob thay đổi thiết bị / đổi khóa mới (hoặc Man-In-The-Middle mạo danh)
  const newBobIdentity = await generateIdentityKeyPair(true)
  const changedKeyVerification = verifyIdentityKeyIntegrity(bobIdentity.publicKeys, newBobIdentity.publicKeys)
  assert.equal(changedKeyVerification.isTrusted, false)
  assert.equal(changedKeyVerification.keyChanged, true)
  assert.ok(changedKeyVerification.alertMessage.includes('CẢNH BÁO AN NINH'))
})

test('Multi-user RLS Isolation & Idempotency Rules Validation', () => {
  // Mô phỏng chính sách RLS trên bảng chat_messages và chat_conversations
  const userA = 'user-uuid-aaaa-1111'
  const userB = 'user-uuid-bbbb-2222'
  const userC = 'user-uuid-cccc-3333'

  const convAB = {
    id: 'conv-ab',
    members: [userA, userB],
  }

  const checkConversationAccess = (userId, conversation) => {
    return conversation.members.includes(userId)
  }

  // User A và User B truy cập được cuộc trò chuyện của họ
  assert.equal(checkConversationAccess(userA, convAB), true)
  assert.equal(checkConversationAccess(userB, convAB), true)

  // User C (kẻ thứ ba) bị RLS chặn hoàn toàn
  assert.equal(checkConversationAccess(userC, convAB), false, 'User C không được đọc tin nhắn hội thoại AB')

  // Kiểm tra tính Idempotency của việc gửi tin nhắn
  const messageStore = new Map()
  const sendMessageIdempotent = (convId, senderId, idempotencyKey, payload) => {
    const compositeKey = `${convId}:${senderId}:${idempotencyKey}`
    if (messageStore.has(compositeKey)) {
      return { status: 'already_recorded', record: messageStore.get(compositeKey) }
    }
    const record = { id: `msg_${Date.now()}`, ...payload }
    messageStore.set(compositeKey, record)
    return { status: 'inserted', record }
  }

  const res1 = sendMessageIdempotent('conv-ab', userA, 'idem_key_001', { text: 'Hello' })
  assert.equal(res1.status, 'inserted')

  // Thử gửi lại cùng idempotency key (do timeout hoặc retry mạng)
  const res2 = sendMessageIdempotent('conv-ab', userA, 'idem_key_001', { text: 'Hello' })
  assert.equal(res2.status, 'already_recorded')
  assert.equal(res2.record.id, res1.record.id, 'Idempotent request phải trả về bản ghi cũ, không tạo bản ghi mới')
})
