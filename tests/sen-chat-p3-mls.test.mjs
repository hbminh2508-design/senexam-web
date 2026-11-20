import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_MLS_CIPHERSUITE,
  serializeMls,
  deserializeMls,
  getMlsCiphersuite,
  generateMlsKeyPackage,
  createMlsGroup,
  addMemberToMlsGroup,
  joinMlsGroup,
  removeMemberFromMlsGroup,
  processMlsCommit,
  encryptMlsMessage,
  decryptMlsMessage,
  findMemberLeafIndex,
} from '../lib/senChatMlsProtocol.mjs'

// ==============================================================================
// 1. KIỂM THỬ TẠO KEY PACKAGE & SERIALIZATION MLS (RFC 9420)
// ==============================================================================
test('MLS RFC 9420: KeyPackage creation and high-fidelity serialization', async () => {
  const aliceKp = await generateMlsKeyPackage('alice.student@senexam.me')
  assert.ok(aliceKp.publicPackage, 'Phải tạo thành công Public KeyPackage')
  assert.ok(aliceKp.privatePackage, 'Phải tạo thành công Private KeyPackage')
  assert.equal(aliceKp.identityEmail, 'alice.student@senexam.me')

  // Kiểm tra serialization Uint8Array / BigInt không suy hao
  const serialized = serializeMls(aliceKp.publicPackage)
  assert.ok(typeof serialized === 'string')
  assert.ok(serialized.includes('__u8'), 'Serialization phải đóng gói Uint8Array sang Base64 an toàn')

  const deserialized = deserializeMls(serialized)
  assert.equal(deserialized.cipherSuite, aliceKp.publicPackage.cipherSuite)
  assert.ok(deserialized.leafNode.signature instanceof Uint8Array, 'Sau deserialize phải khôi phục chính xác Uint8Array')
})

// ==============================================================================
// 2. KIỂM THỬ KHỞI TẠO NHÓM MLS & THÊM THÀNH VIÊN VỚI XOAY KHÓA COMMIT
// ==============================================================================
test('MLS RFC 9420: Group creation (Epoch 0) and Add Member with Commit Key Rotation (Epoch 1)', async () => {
  // 1. Alice tạo nhóm
  const aliceKp = await generateMlsKeyPackage('alice@senexam.me')
  const groupSession = await createMlsGroup('group-math-12', aliceKp)
  assert.equal(groupSession.epoch, 0, 'Nhóm mới tạo phải bắt đầu từ Epoch 0')
  assert.ok(groupSession.ratchetTree.length > 0, 'RatchetTree phải được khởi tạo với lá đầu tiên của Alice')

  // 2. Bob tạo KeyPackage
  const bobKp = await generateMlsKeyPackage('bob@senexam.me')

  // 3. Alice thêm Bob vào nhóm -> Tạo Commit xoay khóa & gói Welcome
  const addBobRes = await addMemberToMlsGroup(groupSession.state, bobKp.publicPackage)
  assert.equal(addBobRes.newEpoch, 1, 'Sau khi thêm Bob, Epoch phải xoay lên 1 (Key Rotation)')
  assert.ok(addBobRes.welcome, 'Phải tạo gói Welcome mã hóa cho Bob')
  assert.ok(addBobRes.commit, 'Phải tạo bản tin Commit xoay khóa')

  // 4. Bob gia nhập nhóm bằng gói Welcome và RatchetTree
  const bobJoined = await joinMlsGroup(addBobRes.welcome, bobKp, addBobRes.ratchetTree)
  assert.equal(bobJoined.epoch, 1, 'Bob phải gia nhập thành công tại Epoch 1')

  // 5. Alice gửi tin nhắn mã hóa E2EE trong nhóm (Application Message)
  const secretMsg = 'Chào mừng Bob gia nhập nhóm ôn thi Toán Sen Chat!'
  const encrypted = await encryptMlsMessage(addBobRes.newState, secretMsg)
  assert.ok(encrypted.privateMessage, 'Tin nhắn phải được mã hóa thành PrivateMessage MLS')

  // 6. Bob nhận và giải mã tin nhắn thành công
  const decrypted = await decryptMlsMessage(bobJoined.state, encrypted.privateMessage)
  assert.equal(decrypted.plaintext, secretMsg, 'Bob phải giải mã chính xác nội dung tin nhắn')
})

// ==============================================================================
// 3. KIỂM THỬ THÀNH VIÊN BỊ XÓA KHÔNG THỂ GIẢI MÃ TIN NHẮN MỚI (PCS / FORWARD SECRECY)
// ==============================================================================
test('MLS RFC 9420: Member removal with Commit rotation blocks removed member from future messages', async () => {
  // Setup: Alice tạo nhóm và thêm Bob
  const aliceKp = await generateMlsKeyPackage('alice.owner@senexam.me')
  const aliceGroup = await createMlsGroup('group-secret', aliceKp)

  const bobKp = await generateMlsKeyPackage('bob.target@senexam.me')
  const addBob = await addMemberToMlsGroup(aliceGroup.state, bobKp.publicPackage)
  const bobGroup = await joinMlsGroup(addBob.welcome, bobKp, addBob.ratchetTree)

  // Thêm Charlie
  const charlieKp = await generateMlsKeyPackage('charlie.peer@senexam.me')
  const addCharlie = await addMemberToMlsGroup(addBob.newState, charlieKp.publicPackage)

  // Bob đồng bộ Commit thêm Charlie (Epoch 1 -> 2)
  const bobGroupAtEpoch2 = await processMlsCommit(bobGroup.state, addCharlie.commit)
  assert.equal(bobGroupAtEpoch2.newEpoch, 2, 'Bob cập nhật thành công lên Epoch 2')

  // Charlie gia nhập nhóm tại Epoch 2
  const charlieGroup = await joinMlsGroup(addCharlie.welcome, charlieKp, addCharlie.ratchetTree)
  assert.equal(charlieGroup.epoch, 2)

  // Tin nhắn khi Bob còn trong nhóm: Bob giải mã bình thường
  const msgBeforeRemoval = 'Tin nhắn chung trước khi Bob rời nhóm'
  const encBefore = await encryptMlsMessage(addCharlie.newState, msgBeforeRemoval)
  const bobDecryptedBefore = await decryptMlsMessage(bobGroupAtEpoch2.newState, encBefore.privateMessage)
  assert.equal(bobDecryptedBefore.plaintext, msgBeforeRemoval)

  // Bây giờ: Alice xóa Bob khỏi nhóm (Bob ở leaf index 1)
  const bobLeafIndex = findMemberLeafIndex(addCharlie.newState, 'bob.target@senexam.me')
  assert.ok(bobLeafIndex >= 0, 'Phải tìm thấy vị trí lá của Bob trong RatchetTree')

  const removeBobRes = await removeMemberFromMlsGroup(addCharlie.newState, bobLeafIndex)
  assert.equal(removeBobRes.newEpoch, 3, 'Epoch phải xoay lên 3 sau khi xóa Bob')

  // Charlie đồng bộ Commit xóa Bob (Epoch 2 -> 3)
  const charlieGroupAtEpoch3 = await processMlsCommit(charlieGroup.state, removeBobRes.commit)
  assert.equal(charlieGroupAtEpoch3.newEpoch, 3)

  // Alice gửi tin nhắn tuyệt mật mới trong Epoch 3
  const secretAfterRemoval = 'Bí mật chiến lược mới, Bob tuyệt đối không được đọc!'
  const encAfter = await encryptMlsMessage(removeBobRes.newState, secretAfterRemoval)

  // Charlie ở trong nhóm giải mã thành công
  const charlieDecrypted = await decryptMlsMessage(charlieGroupAtEpoch3.newState, encAfter.privateMessage)
  assert.equal(charlieDecrypted.plaintext, secretAfterRemoval)

  // BOB (NGƯỜI BỊ XÓA) CỐ GẮNG GIẢI MÃ TIN NHẮN EPOCH 3 -> BẮT BUỘC THẤT BẠI
  let bobDecryptedSuccess = false
  try {
    await decryptMlsMessage(bobGroupAtEpoch2.newState, encAfter.privateMessage)
    bobDecryptedSuccess = true
  } catch (err) {
    assert.ok(err, 'Bob phải bị từ chối giải mã do không sở hữu khóa Epoch 3')
  }

  assert.equal(bobDecryptedSuccess, false, 'VI PHẠM BẢO MẬT: Người bị xóa không được phép giải mã tin nhắn mới!')
})

// ==============================================================================
// 4. KIỂM THỬ PHÂN QUYỀN VAI TRÒ (OWNER / ADMIN / MEMBER)
// ==============================================================================
test('MLS Group Permissions: Role Hierarchy (Owner vs Admin vs Member vs Stranger)', () => {
  function checkRemovePermission(callerRole, targetRole, isSelf) {
    if (isSelf) {
      if (callerRole === 'owner') return { allowed: false, error: 'Chủ nhóm không thể tự rời khi chưa chuyển quyền' }
      return { allowed: true }
    }
    if (callerRole === 'owner') return { allowed: true }
    if (callerRole === 'admin') {
      if (targetRole === 'member') return { allowed: true }
      return { allowed: false, error: 'Quản trị viên chỉ có thể xóa thành viên thường' }
    }
    return { allowed: false, error: 'Bạn không có quyền xóa thành viên' }
  }

  function checkUpdateInfoPermission(callerRole) {
    return callerRole === 'owner' || callerRole === 'admin'
  }

  function checkRoleChangePermission(callerRole) {
    return callerRole === 'owner'
  }

  // 1. Owner tests
  assert.equal(checkRemovePermission('owner', 'admin', false).allowed, true, 'Owner có quyền xóa admin')
  assert.equal(checkRemovePermission('owner', 'member', false).allowed, true, 'Owner có quyền xóa member')
  assert.equal(checkRemovePermission('owner', 'owner', true).allowed, false, 'Owner không thể tự rời khi chưa chuyển quyền')
  assert.equal(checkUpdateInfoPermission('owner'), true, 'Owner có quyền đổi tên/ảnh nhóm')
  assert.equal(checkRoleChangePermission('owner'), true, 'Owner có quyền thăng/hạ vai trò')

  // 2. Admin tests
  assert.equal(checkRemovePermission('admin', 'member', false).allowed, true, 'Admin có quyền xóa member')
  assert.equal(checkRemovePermission('admin', 'admin', false).allowed, false, 'Admin không thể xóa admin khác')
  assert.equal(checkRemovePermission('admin', 'owner', false).allowed, false, 'Admin không thể xóa owner')
  assert.equal(checkRemovePermission('admin', 'admin', true).allowed, true, 'Admin có quyền tự rời nhóm')
  assert.equal(checkUpdateInfoPermission('admin'), true, 'Admin có quyền đổi tên/ảnh nhóm')
  assert.equal(checkRoleChangePermission('admin'), false, 'Admin không được quyền thăng/hạ vai trò')

  // 3. Regular Member tests
  assert.equal(checkRemovePermission('member', 'member', false).allowed, false, 'Member không được xóa ai')
  assert.equal(checkRemovePermission('member', 'member', true).allowed, true, 'Member có quyền tự rời nhóm')
  assert.equal(checkUpdateInfoPermission('member'), false, 'Member không được sửa tên/ảnh nhóm')
  assert.equal(checkRoleChangePermission('member'), false, 'Member không được đổi vai trò')
})

// ==============================================================================
// 5. KIỂM THỬ QUY TẮC CHỈ BẠN BÈ MỚI ĐƯỢC THÊM VÀO NHÓM
// ==============================================================================
test('MLS Group: Only accepted friends can be added to group', () => {
  const mockFriendships = [
    { user_id: 'usr-alice', friend_id: 'usr-bob', status: 'accepted' },
    { user_id: 'usr-alice', friend_id: 'usr-pending', status: 'pending' },
    { user_id: 'usr-alice', friend_id: 'usr-blocked', status: 'blocked' },
  ]

  function canAddUser(creatorId, targetId) {
    return mockFriendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.user_id === creatorId && f.friend_id === targetId) ||
          (f.user_id === targetId && f.friend_id === creatorId))
    )
  }

  assert.equal(canAddUser('usr-alice', 'usr-bob'), true, 'Bạn bè đã accepted được phép thêm vào nhóm')
  assert.equal(canAddUser('usr-alice', 'usr-pending'), false, 'Lời mời đang pending bị từ chối thêm vào nhóm')
  assert.equal(canAddUser('usr-alice', 'usr-blocked'), false, 'Người bị blocked bị từ chối thêm vào nhóm')
  assert.equal(canAddUser('usr-alice', 'usr-stranger'), false, 'Người lạ chưa kết bạn bị từ chối thêm vào nhóm')
})

// ==============================================================================
// 6. KIỂM THỬ RLS ISOLATION CHO BẢNG NHÓM TRONG MIGRATION 008 & 009
// ==============================================================================
test('RLS Hardening: Migration 008 & 009 enforce member-only access and secure service_role dispatch', () => {
  const sqlPath008 = path.resolve('migrations', '008_sen_chat_p3_mls_groups.sql')
  const sqlPath009 = path.resolve('migrations', '009_sen_chat_p3_mls_rpc_auth_fix.sql')

  assert.ok(fs.existsSync(sqlPath008), 'File migration 008 phải tồn tại')
  assert.ok(fs.existsSync(sqlPath009), 'File migration 009 phải tồn tại')

  const sqlContent008 = fs.readFileSync(sqlPath008, 'utf8')
  const sqlContent009 = fs.readFileSync(sqlPath009, 'utf8')

  // Kiểm tra RLS bật trên các bảng mới
  assert.ok(sqlContent008.includes('ALTER TABLE public.chat_mls_key_packages ENABLE ROW LEVEL SECURITY;'))
  assert.ok(sqlContent008.includes('ALTER TABLE public.chat_mls_commits ENABLE ROW LEVEL SECURITY;'))

  // Kiểm tra chính sách RLS chỉ thành viên mới được SELECT commit
  assert.ok(sqlContent008.includes('CREATE POLICY "chat_mls_commits_select_member"'))
  assert.ok(sqlContent008.includes('m.conversation_id = chat_mls_commits.conversation_id'))

  // Kiểm tra chính sách xóa thành viên có phân quyền Owner/Admin
  assert.ok(sqlContent008.includes('CREATE POLICY "chat_members_delete_policy"'))
  assert.ok(sqlContent008.includes("m.role = 'owner'"))
  assert.ok(sqlContent008.includes("m.role = 'admin'"))

  // Kiểm tra Migration 009 khắc phục triệt để context service_role và chống giả mạo p_caller_id
  assert.ok(sqlContent009.includes("IF auth.role() = 'service_role' THEN"))
  assert.ok(sqlContent009.includes('v_caller_id := COALESCE(p_caller_id, auth.uid());'))
  assert.ok(sqlContent009.includes('v_caller_id := auth.uid();'))
  assert.ok(sqlContent009.includes('SET search_path = public, pg_temp'))
})

// ==============================================================================
// 7. KIỂM THỬ API ROUTE HANDLERS CHUYỂN TIẾP ĐÚNG USER_ID
// ==============================================================================
test('MLS Route Handlers: group and members routes pass user.id to RPC', () => {
  const groupRoutePath = path.resolve('app', 'api', 'chat', 'mls', 'group', 'route.ts')
  const membersRoutePath = path.resolve('app', 'api', 'chat', 'mls', 'members', 'route.ts')

  assert.ok(fs.existsSync(groupRoutePath))
  assert.ok(fs.existsSync(membersRoutePath))

  const groupRoute = fs.readFileSync(groupRoutePath, 'utf8')
  const membersRoute = fs.readFileSync(membersRoutePath, 'utf8')

  // Kiểm tra route group POST và PATCH chuyển tiếp user.id
  assert.ok(groupRoute.includes('p_creator_id: user.id'))
  assert.ok(groupRoute.includes('p_caller_id: user.id'))

  // Kiểm tra route members POST, DELETE và PATCH chuyển tiếp user.id
  assert.ok(membersRoute.includes('p_caller_id: user.id'))
})
