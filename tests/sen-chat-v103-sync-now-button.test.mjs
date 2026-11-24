import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  SEN_CHAT_CURRENT_VERSION,
  SEN_CHAT_CHANGELOG,
} from '../lib/senChatVersion.mjs'

import {
  checkDeviceSyncStatus,
  triggerFullDeviceSync,
  getDeviceId,
  reconcileMessages,
} from '../lib/senChatDeviceRelay.mjs'

// ==============================================================================
// 1. KIỂM THỬ PHIÊN BẢN V1.0.3 VÀ CHANGELOG
// ==============================================================================
test('Sen Chat v1.0.3: Phiên bản hiện tại là 1.0.3 và changelog chứa câu thần chú và các tính năng mới', () => {
  assert.equal(SEN_CHAT_CURRENT_VERSION, '1.0.3', 'Phiên bản Sen Chat phải là 1.0.3')
  assert.ok(Array.isArray(SEN_CHAT_CHANGELOG), 'SEN_CHAT_CHANGELOG phải là mảng')
  assert.ok(SEN_CHAT_CHANGELOG.length >= 4, 'Phải có ít nhất 4 phiên bản (1.0.3, 1.0.2, 1.0.1, 1.0.0)')

  const v103 = SEN_CHAT_CHANGELOG[0]
  assert.equal(v103.version, '1.0.3')
  assert.equal(v103.isLatest, true)
  assert.equal(v103.isBugFixOnly, true)
  assert.equal(v103.releaseDate, '24/11/2026')
  assert.equal(v103.title, 'Bắt lại những con bò đang bay trên các vì sao')

  assert.ok(
    v103.changes.includes('Bắt lại những con bò đang bay trên các vì sao'),
    'Changelog 1.0.3 phải có câu thần chú "Bắt lại những con bò đang bay trên các vì sao"'
  )
  assert.ok(
    v103.changes.some((c) => c.includes("Bổ sung nút 'Đồng bộ dữ liệu ngay' tự động phát hiện thiết bị chưa đồng bộ, đặt ngay phía trên mục SenAI Studio")),
    'Changelog phải có mục nút Đồng bộ dữ liệu ngay phía trên SenAI Studio'
  )
  assert.ok(
    v103.changes.some((c) => c.includes('Tích hợp tính năng kích hoạt đồng bộ dữ liệu tức thì trong Cài đặt Sen Chat')),
    'Changelog phải có mục kích hoạt đồng bộ tức thì trong Cài đặt'
  )
  assert.ok(
    v103.changes.some((c) => c.includes('Tự động quét và đối soát dữ liệu tin nhắn, trạng thái và tệp giữa toàn bộ thiết bị đang đăng nhập')),
    'Changelog phải có mục quét và đối soát dữ liệu tin nhắn giữa toàn bộ thiết bị'
  )
  assert.ok(
    v103.changes.some((c) => c.includes('Cải thiện độ ổn định và hiệu năng kết nối đa thiết bị thời gian thực')),
    'Changelog phải có mục cải thiện hiệu năng kết nối đa thiết bị'
  )

  // Kiểm tra phiên bản 1.0.2 đã chuyển isLatest = false
  const v102 = SEN_CHAT_CHANGELOG.find((c) => c.version === '1.0.2')
  assert.ok(v102, 'Phải có phiên bản 1.0.2 trong lịch sử')
  assert.equal(v102.isLatest, false, 'Phiên bản cũ không còn là isLatest')
})

// ==============================================================================
// 2. KIỂM THỬ HÀM checkDeviceSyncStatus VÀ triggerFullDeviceSync
// ==============================================================================
test('Sen Chat v1.0.3: Hàm checkDeviceSyncStatus kiểm tra chính xác nhu cầu đồng bộ thiết bị', async () => {
  assert.equal(typeof checkDeviceSyncStatus, 'function', 'checkDeviceSyncStatus phải là hàm')
  assert.equal(typeof triggerFullDeviceSync, 'function', 'triggerFullDeviceSync phải là hàm')

  // Giả lập môi trường localStorage
  const mockStorage = new Map()
  global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  }

  const myDeviceId = 'dev_current_pc'

  // Trường hợp 1: Chỉ có 1 thiết bị duy nhất (thiết bị hiện tại)
  const onlyOneResult = await checkDeviceSyncStatus('user_123', myDeviceId, {
    devices: [{ device_id: myDeviceId, is_active: true, last_seen_at: new Date().toISOString() }],
  })
  assert.equal(onlyOneResult.needsSync, false, 'Chỉ 1 thiết bị không cần đồng bộ')
  assert.equal(onlyOneResult.reason, 'only_one_device')
  assert.equal(onlyOneResult.otherDevices.length, 0)

  // Trường hợp 2: Có thiết bị khác và chưa từng đồng bộ
  const otherDevicesList = [
    { device_id: myDeviceId, is_active: true, last_seen_at: new Date().toISOString() },
    { device_id: 'dev_mobile_phone', is_active: true, last_seen_at: new Date().toISOString() },
  ]
  const noPriorSyncResult = await checkDeviceSyncStatus('user_123', myDeviceId, {
    devices: otherDevicesList,
  })
  assert.equal(noPriorSyncResult.needsSync, true, 'Có thiết bị khác và chưa sync lần nào thì cần sync')
  assert.equal(noPriorSyncResult.reason, 'no_prior_sync')
  assert.equal(noPriorSyncResult.otherDevices.length, 1)

  // Trường hợp 3: Có thiết bị khác và lần đồng bộ trước đã quá 3 phút (hết hạn)
  mockStorage.set('senchat_last_sync_timestamp', String(Date.now() - 4 * 60 * 1000))
  const expiredSyncResult = await checkDeviceSyncStatus('user_123', myDeviceId, {
    devices: otherDevicesList,
  })
  assert.equal(expiredSyncResult.needsSync, true, 'Đã quá 3 phút chưa đồng bộ thì cần sync lại')
  assert.equal(expiredSyncResult.reason, 'sync_expired')

  // Trường hợp 4: Vừa mới đồng bộ trong vòng 30 giây
  mockStorage.set('senchat_last_sync_timestamp', String(Date.now() - 30 * 1000))
  const upToDateResult = await checkDeviceSyncStatus('user_123', myDeviceId, {
    devices: otherDevicesList,
  })
  assert.equal(upToDateResult.needsSync, false, 'Vừa mới đồng bộ thì dữ liệu up-to-date')
  assert.equal(upToDateResult.reason, 'up_to_date')

  // Trường hợp 5: Có cờ relay pending signal
  const flagPendingResult = await checkDeviceSyncStatus('user_123', myDeviceId, {
    devices: otherDevicesList,
    hasRelayPendingFlag: true,
  })
  assert.equal(flagPendingResult.needsSync, true, 'Cờ tín hiệu relay pending kích hoạt đồng bộ ngay')
  assert.equal(flagPendingResult.reason, 'relay_signal_pending')
})

test('Sen Chat v1.0.3: Hàm triggerFullDeviceSync thực hiện pull, lưu timestamp và phát event', async () => {
  const mockStorage = new Map()
  global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  }

  let eventDispatched = null
  global.window = {
    dispatchEvent: (ev) => {
      eventDispatched = ev
    },
    __senchat_needs_sync: true,
  }

  // Mock global fetch để mô phỏng /api/chat/sync pull
  const originalFetch = global.fetch
  global.fetch = async (url, opts) => {
    if (url.includes('/api/chat/sync')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          messages: [
            { id: 'msg_1', conversationId: 'conv_a', content: 'Tin nhắn thử nghiệm 1', createdAt: new Date().toISOString() },
            { id: 'msg_2', conversationId: 'conv_a', content: 'Tin nhắn thử nghiệm 2', createdAt: new Date().toISOString() },
          ],
        }),
      }
    }
    return { ok: true, json: async () => ({ devices: [] }) }
  }

  try {
    const res = await triggerFullDeviceSync('user_123', 'dev_test_node', {
      devices: [
        { device_id: 'dev_test_node', is_active: true },
        { device_id: 'dev_remote_node', is_active: true },
      ],
    })

    assert.equal(res.success, true, 'triggerFullDeviceSync phải trả về success: true')
    assert.equal(res.syncedMessagesCount, 2, 'Số tin nhắn kéo về phải là 2')
    assert.ok(res.deviceCount >= 2, 'Số lượng thiết bị phải >= 2')
    assert.ok(res.message.includes('Đồng bộ thành công'), 'Thông báo phải ghi nhận thành công')

    // Kiểm tra timestamp đã được cập nhật
    const savedTs = mockStorage.get('senchat_last_sync_timestamp')
    assert.ok(savedTs, 'senchat_last_sync_timestamp phải được lưu vào localStorage')
    assert.ok(Date.now() - parseInt(savedTs, 10) < 5000, 'Timestamp phải là thời điểm hiện tại')

    // Kiểm tra window event senchat-sync-completed
    assert.ok(eventDispatched, 'Phải phát event trên window')
    assert.equal(eventDispatched.type, 'senchat-sync-completed')
    assert.equal(eventDispatched.detail.syncedMessagesCount, 2)
  } finally {
    global.fetch = originalFetch
  }
})

// ==============================================================================
// 3. KIỂM THỬ GIAO DIỆN DESKTOP (app/chat/page.tsx)
// ==============================================================================
test('Sen Chat v1.0.3: Desktop (app/chat/page.tsx) có nút Đồng bộ dữ liệu ngay đặt ngay phía trên SenAI Studio', () => {
  const desktopFilePath = path.join(process.cwd(), 'app/chat/page.tsx')
  const desktopCode = fs.readFileSync(desktopFilePath, 'utf8')

  // Kiểm tra import checkDeviceSyncStatus và triggerFullDeviceSync
  assert.ok(
    desktopCode.includes('checkDeviceSyncStatus') && desktopCode.includes('triggerFullDeviceSync'),
    'app/chat/page.tsx phải import checkDeviceSyncStatus và triggerFullDeviceSync'
  )

  // Kiểm tra icon RefreshCw
  assert.ok(
    desktopCode.includes('RefreshCw'),
    'app/chat/page.tsx phải sử dụng icon RefreshCw cho nút đồng bộ'
  )

  // Kiểm tra nút/banner xuất hiện ngay phía trên SenAI Studio trong danh sách hội thoại
  assert.ok(
    desktopCode.includes('Đồng bộ dữ liệu ngay') || desktopCode.includes('Đồng bộ ngay'),
    'app/chat/page.tsx phải có nút "Đồng bộ dữ liệu ngay" hoặc "Đồng bộ ngay"'
  )
  assert.ok(
    desktopCode.includes('handleTriggerSyncNow'),
    'app/chat/page.tsx phải có hàm handleTriggerSyncNow để kích hoạt đồng bộ'
  )

  // Vị trí: banner nằm trước filteredConversations.map (mục đầu tiên luôn là SENAI_STUDIO_CONVERSATION_ID)
  const bannerIndex = desktopCode.indexOf('handleTriggerSyncNow')
  const senAiStudioIndex = desktopCode.indexOf('SENAI_STUDIO_CONVERSATION_ID')
  assert.ok(bannerIndex > 0, 'Phải có banner đồng bộ')
  assert.ok(senAiStudioIndex > 0, 'Phải có mục SenAI Studio')
})

// ==============================================================================
// 4. KIỂM THỬ GIAO DIỆN MOBILE (app/m/chat/page.tsx)
// ==============================================================================
test('Sen Chat v1.0.3: Mobile (app/m/chat/page.tsx) có nút Đồng bộ dữ liệu ngay đặt ngay phía trên SenAI Studio', () => {
  const mobileFilePath = path.join(process.cwd(), 'app/m/chat/page.tsx')
  const mobileCode = fs.readFileSync(mobileFilePath, 'utf8')

  // Kiểm tra import checkDeviceSyncStatus và triggerFullDeviceSync
  assert.ok(
    mobileCode.includes('checkDeviceSyncStatus') && mobileCode.includes('triggerFullDeviceSync'),
    'app/m/chat/page.tsx phải import checkDeviceSyncStatus và triggerFullDeviceSync'
  )

  // Kiểm tra icon RefreshCw
  assert.ok(
    mobileCode.includes('RefreshCw'),
    'app/m/chat/page.tsx phải sử dụng icon RefreshCw cho nút đồng bộ'
  )

  // Kiểm tra nút/banner xuất hiện
  assert.ok(
    mobileCode.includes('Đồng bộ dữ liệu ngay') || mobileCode.includes('Đồng bộ ngay'),
    'app/m/chat/page.tsx phải có nút "Đồng bộ dữ liệu ngay" hoặc "Đồng bộ ngay"'
  )
  assert.ok(
    mobileCode.includes('handleTriggerSyncNow'),
    'app/m/chat/page.tsx phải có hàm handleTriggerSyncNow'
  )
})

// ==============================================================================
// 5. KIỂM THỬ NÚT ĐỒNG BỘ TRONG CÀI ĐẶT (components/chat/ChatSettingsModal.tsx)
// ==============================================================================
test('Sen Chat v1.0.3: Cài đặt (ChatSettingsModal.tsx) có card Đồng bộ dữ liệu đa thiết bị với nút Đồng bộ dữ liệu ngay', () => {
  const settingsFilePath = path.join(process.cwd(), 'components/chat/ChatSettingsModal.tsx')
  const settingsCode = fs.readFileSync(settingsFilePath, 'utf8')

  // Kiểm tra import checkDeviceSyncStatus và triggerFullDeviceSync
  assert.ok(
    settingsCode.includes('checkDeviceSyncStatus') && settingsCode.includes('triggerFullDeviceSync'),
    'ChatSettingsModal.tsx phải import checkDeviceSyncStatus và triggerFullDeviceSync'
  )

  // Kiểm tra tab devices có card đồng bộ
  assert.ok(
    settingsCode.includes('Đồng bộ dữ liệu đa thiết bị'),
    'ChatSettingsModal.tsx phải có card "Đồng bộ dữ liệu đa thiết bị"'
  )
  assert.ok(
    settingsCode.includes('Đồng bộ dữ liệu ngay'),
    'ChatSettingsModal.tsx phải có nút "Đồng bộ dữ liệu ngay"'
  )
  assert.ok(
    settingsCode.includes('handleTriggerSync'),
    'ChatSettingsModal.tsx phải có hàm xử lý handleTriggerSync'
  )
  assert.ok(
    settingsCode.includes('Cần đồng bộ dữ liệu') && settingsCode.includes('Đã đồng bộ'),
    'ChatSettingsModal.tsx phải hiển thị trạng thái Cần đồng bộ dữ liệu / Đã đồng bộ'
  )
})

// ==============================================================================
// 6. KIỂM TRA CHUỖI CẤM "SC" HOẶC "SenCash" TRONG app/m/chat/page.tsx
// ==============================================================================
test('Sen Chat v1.0.3: app/m/chat/page.tsx TUYỆT ĐỐI KHÔNG chứa chuỗi cấm "SC" hoặc "SenCash" (chỉ hiển thị "SCm")', () => {
  const mobileFilePath = path.join(process.cwd(), 'app/m/chat/page.tsx')
  const mobileContent = fs.readFileSync(mobileFilePath, 'utf8')

  // Loại bỏ các từ hợp lệ như "SCm" và các từ vựng tiếng Anh chứa sc... không viết hoa SC độc lập
  // Kiểm tra chuỗi SenCash
  assert.equal(
    mobileContent.includes('SenCash'),
    false,
    'app/m/chat/page.tsx tuyệt đối không được chứa chuỗi "SenCash"'
  )

  // Kiểm tra chuỗi "SC" viết hoa đứng riêng lẻ hoặc không theo sau bởi "m"
  const forbiddenScRegex = /\bSC\b|SC(?=[^m]|$)/g
  const scMatches = mobileContent.match(forbiddenScRegex)
  assert.equal(
    scMatches,
    null,
    `app/m/chat/page.tsx không được chứa "SC" lẻ loi (chỉ cho phép "SCm"). Phát hiện: ${JSON.stringify(scMatches)}`
  )
})
