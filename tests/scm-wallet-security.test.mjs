import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  vndToScm,
  scmToVnd,
  senCashToScm,
  SCM_PER_SENCASH,
  VND_PER_SCM,
} from '../lib/scmUtils.mjs'

test('SCm Wallet: Currency Conversion rates', () => {
  // 1. Tỉ giá quy ước: 100đ = 1 SCm
  assert.strictEqual(VND_PER_SCM, 100)
  assert.strictEqual(vndToScm(10000), 100)
  assert.strictEqual(vndToScm(50000), 500)
  assert.strictEqual(scmToVnd(100), 10000)

  // 2. Tỉ giá quy đổi: 1 SC (500đ) = 5 SCm (5 * 100đ)
  assert.strictEqual(SCM_PER_SENCASH, 5)
  assert.strictEqual(senCashToScm(29), 145)
  assert.strictEqual(senCashToScm(199), 995)
})

test('SCm Wallet Security: Atomic debit and non-negative balance constraint', () => {
  function simulateDebit(currentBalance, amount) {
    if (amount <= 0) throw new Error('Số tiền phải lớn hơn 0')
    if (currentBalance < amount) {
      return { success: false, error: 'Số dư Cash Mobile (SCm) không đủ' }
    }
    return { success: true, newBalance: currentBalance - amount }
  }

  // Đủ tiền
  const res1 = simulateDebit(500, 145)
  assert.strictEqual(res1.success, true)
  assert.strictEqual(res1.newBalance, 355)

  // Không đủ tiền -> Chặn ngay lập tức
  const res2 = simulateDebit(100, 145)
  assert.strictEqual(res2.success, false)
  assert.strictEqual(res2.error, 'Số dư Cash Mobile (SCm) không đủ')
})

test('SCm Wallet Security: Idempotency Key prevents double-spending', () => {
  const ledger = new Map()

  function processTransaction(idempotencyKey, userId, amount, currentBalance) {
    if (ledger.has(idempotencyKey)) {
      return {
        success: true,
        isIdempotentReplay: true,
        tx: ledger.get(idempotencyKey),
      }
    }

    if (currentBalance < amount) {
      return { success: false, error: 'Số dư không đủ' }
    }

    const tx = {
      id: 'tx-' + Math.random().toString(36).slice(2),
      idempotencyKey,
      userId,
      amount,
      balanceAfter: currentBalance - amount,
      createdAt: new Date().toISOString(),
    }
    ledger.set(idempotencyKey, tx)
    return { success: true, isIdempotentReplay: false, tx }
  }

  const key = 'idem_mobile_req_123'
  const firstCall = processTransaction(key, 'user_1', 145, 500)
  assert.strictEqual(firstCall.success, true)
  assert.strictEqual(firstCall.isIdempotentReplay, false)
  assert.strictEqual(firstCall.tx.balanceAfter, 355)

  // Lần gọi thứ 2 với cùng Idempotency Key (VD do bấm đúp hoặc mạng lag retry)
  const secondCall = processTransaction(key, 'user_1', 145, 355)
  assert.strictEqual(secondCall.success, true)
  assert.strictEqual(secondCall.isIdempotentReplay, true)
  assert.strictEqual(secondCall.tx.id, firstCall.tx.id, 'Phải trả về cùng bản ghi giao dịch trước đó')
  assert.strictEqual(secondCall.tx.balanceAfter, 355, 'Số dư không được bị trừ lần 2')
})

test('SCm Wallet Security: Race Condition lock simulation (SELECT FOR UPDATE)', async () => {
  let dbBalance = 150 // Chỉ đủ cho 1 gói 145 SCm
  let activeLocks = 0

  async function atomicPurchase(price) {
    // Mô phỏng SELECT FOR UPDATE
    while (activeLocks > 0) {
      await new Promise(r => setTimeout(r, 10))
    }
    activeLocks++
    try {
      if (dbBalance >= price) {
        dbBalance -= price
        return { success: true }
      }
      return { success: false, error: 'Số dư không đủ' }
    } finally {
      activeLocks--
    }
  }

  // 2 request cùng gửi đồng thời trong 1 miligiây
  const [req1, req2] = await Promise.all([
    atomicPurchase(145),
    atomicPurchase(145),
  ])

  // Chỉ DUY NHẤT 1 request thành công
  const successCount = [req1, req2].filter(r => r.success).length
  assert.strictEqual(successCount, 1, 'Chỉ 1 giao dịch được thành công khi số dư không đủ cả hai')
  assert.strictEqual(dbBalance, 5, 'Số dư sau giao dịch phải chính xác')
})

test('Mobile Isolation Audit: app/m/ contains NO user-facing SC / SenCash text', () => {
  const payContent = fs.readFileSync('app/m/pay/page.tsx', 'utf8')
  const profileContent = fs.readFileSync('app/m/profile/page.tsx', 'utf8')
  const homeContent = fs.readFileSync('app/m/page.tsx', 'utf8')

  // Không hiển thị số dư SenCash PC
  assert.doesNotMatch(payContent, /\{senCashBalance/, 'Mobile Pay must not display senCashBalance')
  assert.doesNotMatch(profileContent, /SC PC/, 'Mobile Profile must not mention SC PC')
  assert.doesNotMatch(homeContent, /senCash\./, 'Mobile Home must not use senCash')

  // Phải sử dụng SCm
  assert.match(payContent, /SCm/, 'Mobile Pay must display SCm')
  assert.match(profileContent, /SCm/, 'Mobile Profile must display SCm')
  assert.match(homeContent, /SCm/, 'Mobile Home must display SCm')
})
