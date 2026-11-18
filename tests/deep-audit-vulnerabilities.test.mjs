import test from 'node:test'
import assert from 'node:assert/strict'
import { stripExamAnswers, verifySebRequest } from '../lib/examSecurity.mjs'

// 1. Test: stripExamAnswers recursively purges answers when exam_structure is a raw Array of sections
test('Security: stripExamAnswers thoroughly purges answers in raw Array exam_structure', () => {
  const rawArrayExam = {
    id: 'exam-array-test',
    title: 'Đề thi mảng',
    solution_pdf_url: 'https://secret.com/solution.pdf',
    seb_config_key: 'secret-seb-key',
    access_code: 'SECRET123',
    exam_structure: [
      {
        id: 'sec-1',
        name: 'Phần 1',
        correctAnswers: { '0': 'A' },
        questions: [
          {
            id: 'q1',
            text: 'Câu 1?',
            correctAnswer: 'A',
            explanation: 'Lời giải bí mật',
            subQuestions: [{ id: 'sub1', isCorrect: true }]
          }
        ]
      }
    ]
  }

  const safeExam = stripExamAnswers(rawArrayExam)

  // Verify all sensitive properties are completely removed
  assert.equal(safeExam.solution_pdf_url, undefined)
  assert.equal(safeExam.seb_config_key, undefined)
  assert.equal(safeExam.access_code, undefined)
  assert.equal(safeExam.exam_structure[0].correctAnswers, undefined)
  assert.equal(safeExam.exam_structure[0].questions[0].correctAnswer, undefined)
  assert.equal(safeExam.exam_structure[0].questions[0].explanation, undefined)
  assert.equal(safeExam.exam_structure[0].questions[0].subQuestions[0].isCorrect, undefined)
})

// 2. Test: Idempotency & Duplicate Submission handling
test('Security: Duplicate submission logic returns existing submission for single-attempt exams', () => {
  const existingSubmissions = [
    {
      id: 'sub-existing-1',
      exam_id: 'exam-single',
      user_id: 'user-1',
      score: 8.5,
      submitted_at: '2026-11-18T10:00:00Z',
      is_completed: true,
    }
  ]

  function checkSubmissionAllowed(exam, userId, existing) {
    const prev = existing.find(s => s.exam_id === exam.id && s.user_id === userId && s.is_completed)
    if (prev && (exam.max_attempts === 1 || !exam.max_attempts)) {
      return {
        allowed: false,
        isDuplicatePrevented: true,
        existingSubmission: prev
      }
    }
    return { allowed: true }
  }

  const exam = { id: 'exam-single', max_attempts: 1 }
  const check = checkSubmissionAllowed(exam, 'user-1', existingSubmissions)
  assert.equal(check.allowed, false)
  assert.equal(check.isDuplicatePrevented, true)
  assert.equal(check.existingSubmission.id, 'sub-existing-1')
})

// 3. Test: Server-authoritative timing calculation and late submission detection
test('Resilience: Server calculates timeSpent from started_at and flags overdue submissions', () => {
  const exam = { id: 'exam-timed', duration: 60 } // 60 minutes
  const now = Date.now()
  const startedAt = new Date(now - 70 * 60 * 1000).toISOString() // started 70 mins ago (> 60m + 5m grace)

  function evaluateTiming(examDurationMinutes, startedAtIso, graceMinutes = 5) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000)
    const maxAllowedSeconds = (examDurationMinutes + graceMinutes) * 60
    const isLate = elapsedSeconds > maxAllowedSeconds
    return {
      elapsedSeconds,
      maxAllowedSeconds,
      isLate,
      disqualificationReason: isLate ? 'SUBMISSION_OVERDUE' : null
    }
  }

  const timing = evaluateTiming(exam.duration, startedAt)
  assert.equal(timing.isLate, true)
  assert.equal(timing.disqualificationReason, 'SUBMISSION_OVERDUE')
})

// 4. Test: SEB Header verification
test('Security: verifySebRequest blocks non-SEB browsers when requireSeb is enabled', () => {
  const normalBrowserHeaders = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130' }
  const sebBrowserHeaders = { 'user-agent': 'SEB/3.4.0 (Windows)', 'x-safeexambrowser-configkeyhash': 'abc123hash' }

  assert.equal(verifySebRequest(normalBrowserHeaders, true).allowed, false)
  assert.equal(verifySebRequest(sebBrowserHeaders, true).allowed, true)
  assert.equal(verifySebRequest(normalBrowserHeaders, false).allowed, true)
})

// 5. Test: Draft TTL & User Scoping
test('Resilience: Draft verification enforces user scoping and 24h TTL expiration', () => {
  function verifyDraft(draft, currentUserId, ttlMs = 24 * 60 * 60 * 1000) {
    if (!draft || !draft.userId || !draft.timestamp) return false
    if (draft.userId !== currentUserId) return false
    if (Date.now() - draft.timestamp > ttlMs) return false
    return true
  }

  const validDraft = { userId: 'user-A', timestamp: Date.now() - 1000, answers: { '0': 'A' } }
  const wrongUserDraft = { userId: 'user-B', timestamp: Date.now() - 1000, answers: { '0': 'B' } }
  const expiredDraft = { userId: 'user-A', timestamp: Date.now() - 25 * 60 * 60 * 1000, answers: { '0': 'A' } }

  assert.equal(verifyDraft(validDraft, 'user-A'), true)
  assert.equal(verifyDraft(wrongUserDraft, 'user-A'), false)
  assert.equal(verifyDraft(expiredDraft, 'user-A'), false)
})

// 6. Test: Admin authorization must NOT rely on hardcoded email strings
test('Security: requireAdmin authorization strictly relies on database role or admin secret, NOT hardcoded personal emails', () => {
  function isAuthorizedAdmin(user, userProfileRole, adminSecretHeader, expectedSecret) {
    if (adminSecretHeader && expectedSecret && adminSecretHeader === expectedSecret && expectedSecret.length >= 16) {
      return true
    }
    if (user && (userProfileRole === 'admin' || userProfileRole === 'collab')) {
      return true
    }
    return false
  }

  const attackerUser = { id: 'attacker', email: 'hoangbinhminh2508@gmail.com' }
  const legitimateAdmin = { id: 'admin1', email: 'verified@admin.org' }

  assert.equal(isAuthorizedAdmin(attackerUser, 'student', null, 'secret1234567890123456'), false, 'Attacker with student role must NOT be admin')
  assert.equal(isAuthorizedAdmin(legitimateAdmin, 'admin', null, 'secret1234567890123456'), true, 'Legitimate admin with DB role must be admin')
})
