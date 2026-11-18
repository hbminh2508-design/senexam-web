import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  createBackButtonDispatcher,
  resolveSafeDownload,
  isExamPath,
  isHomePath,
  DOUBLE_PRESS_DELAY_MS,
} from '../lib/capacitorBridge.mjs'

test('Capacitor Back Button: Intercepts and prompts in exam rooms', () => {
  const dispatcher = createBackButtonDispatcher()

  // Trong phòng thi /m/exams/...
  const res1 = dispatcher.handleBackPress({
    currentPath: '/m/exams/exam-hsa-01',
    hasActiveExam: true,
  })
  assert.equal(res1.action, 'confirm_exam_exit')
  assert.equal(res1.shouldExit, false)
  assert.match(res1.message, /bài thi sẽ được nộp tự động/i)

  // Đang thi trên web mới /new-exams/...
  const res2 = dispatcher.handleBackPress({
    currentPath: '/new-exams/exam-vnu-02',
    hasActiveExam: false,
  })
  assert.equal(res2.action, 'confirm_exam_exit')
})

test('Capacitor Back Button: Double press within 2s to exit on Home screen', () => {
  const dispatcher = createBackButtonDispatcher()

  // Bấm lần 1 trên trang chủ /m
  const res1 = dispatcher.handleBackPress({ currentPath: '/m' })
  assert.equal(res1.action, 'prompt_exit_toast')
  assert.equal(res1.shouldExit, false)
  assert.match(res1.message, /nhấn một lần nữa trong 2 giây/i)

  // Bấm lần 2 ngay lập tức (< 2000ms)
  const res2 = dispatcher.handleBackPress({ currentPath: '/m' })
  assert.equal(res2.action, 'exit_app')
  assert.equal(res2.shouldExit, true)
})

test('Capacitor Back Button: Single press on internal screens navigates back', () => {
  const dispatcher = createBackButtonDispatcher()

  const screens = ['/m/pay', '/m/profile', '/m/sen-ground', '/m/submissions/sub-123']
  for (const screen of screens) {
    const res = dispatcher.handleBackPress({ currentPath: screen })
    assert.equal(res.action, 'navigate_back')
    assert.equal(res.shouldExit, false)
  }
})

test('Android WebView Safe Download: Delegates to external intent on native Capacitor', () => {
  const testUrl = 'https://drive.google.com/uc?export=download&id=doc123'

  // Trên Android Native Capacitor
  const nativeDownload = resolveSafeDownload(testUrl, true)
  assert.equal(nativeDownload.canDownload, true)
  assert.equal(nativeDownload.target, '_system')
  assert.equal(nativeDownload.strategy, 'external_browser_intent')

  // Trên trình duyệt Web thông thường
  const webDownload = resolveSafeDownload(testUrl, false)
  assert.equal(webDownload.canDownload, true)
  assert.equal(webDownload.target, '_blank')
  assert.equal(webDownload.strategy, 'standard_browser')
})

test('Mobile Exam Parity: Dedicated review page exists for mobile submissions', () => {
  const reviewPagePath = path.join(process.cwd(), 'app', 'm', 'submissions', '[id]', 'page.tsx')
  assert.ok(fs.existsSync(reviewPagePath), 'app/m/submissions/[id]/page.tsx must exist')

  const content = fs.readFileSync(reviewPagePath, 'utf8')
  assert.match(content, /export default function MobileSubmissionReviewPage/i)
  assert.match(content, /from\('submissions'\)/)
  assert.match(content, /SafeMathRenderer/)
})
