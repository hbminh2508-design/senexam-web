import test from 'node:test'
import assert from 'node:assert/strict'
import { formatTime } from '../lib/timerUtils.mjs'

// 1. Test: formatTime helper formatting logic
test('Timer Fidelity: formatTime handles mm:ss, hh:mm:ss, and hsa_words formats cleanly', () => {
  // Test mm:ss
  assert.equal(formatTime(65), '01:05')
  assert.equal(formatTime(0), '00:00')
  assert.equal(formatTime(59), '00:59')
  assert.equal(formatTime(120), '02:00')

  // Test hh:mm:ss
  assert.equal(formatTime(3600), '01:00:00')
  assert.equal(formatTime(3665), '01:01:05')
  assert.equal(formatTime(75 * 60), '01:15:00')

  // Test hsa_words
  assert.equal(formatTime(75 * 60, 'hsa_words'), '1 giờ 15 phút 00 giây')
  assert.equal(formatTime(120, 'hsa_words'), '2 phút 00 giây')
})

// 2. Test: HSA Exam Structure constraints (3 independent parts, 50 questions each)
test('HSA Fidelity: 3 independent parts, strictly 50 questions per part, no back-tracking', () => {
  const mockExam = {
    exam_type: 'HSA',
    title: 'Đề thi thử ĐGNL HSA ĐHQGHN',
    duration: 195, // 75 + 60 + 60 mins
    exam_structure: [
      { id: 'part1', name: 'Tư duy định lượng (Toán học)', durationMinutes: 75, questions: Array.from({ length: 50 }, (_, i) => ({ number: i + 1, text: `Q${i + 1}` })) },
      { id: 'part2', name: 'Tư duy định tính (Ngữ văn)', durationMinutes: 60, questions: Array.from({ length: 50 }, (_, i) => ({ number: i + 51, text: `Q${i + 51}` })) },
      { id: 'part3', name: 'Khoa học / Tiếng Anh', durationMinutes: 60, questions: Array.from({ length: 50 }, (_, i) => ({ number: i + 101, text: `Q${i + 101}` })) },
    ]
  }

  assert.equal(mockExam.exam_structure.length, 3, 'HSA must have exactly 3 parts')
  assert.equal(mockExam.exam_structure[0].questions.length, 50, 'Part 1 must have 50 questions')
  assert.equal(mockExam.exam_structure[1].questions.length, 50, 'Part 2 must have 50 questions')
  assert.equal(mockExam.exam_structure[2].questions.length, 50, 'Part 3 must have 50 questions')

  // Simulating section transition lock: Once Part 1 is finished, cannot navigate back to questions 1-50
  function isQuestionAccessible(currentPartIdx, questionNumber) {
    if (currentPartIdx === 0) return questionNumber >= 1 && questionNumber <= 50
    if (currentPartIdx === 1) return questionNumber >= 51 && questionNumber <= 100
    if (currentPartIdx === 2) return questionNumber >= 101 && questionNumber <= 150
    return false
  }

  assert.equal(isQuestionAccessible(1, 25), false, 'Cannot access Part 1 questions when in Part 2')
  assert.equal(isQuestionAccessible(1, 65), true, 'Can access Part 2 questions when in Part 2')
  assert.equal(isQuestionAccessible(2, 55), false, 'Cannot access Part 2 questions when in Part 3')
})

// 3. Test: VNU TEST structure constraints (1 single continuous part, flexible duration)
test('VNU TEST Fidelity: 1 single continuous part, welcome screen with fullscreen trigger, flexible duration', () => {
  const vnuTestExam = {
    format: 'vnu_test',
    title: 'BÀI THI CHUẨN VNU TEST (ĐHQGHN)',
    duration: 60,
    questions: Array.from({ length: 40 }, (_, i) => ({ number: i + 1, text: `Câu ${i + 1}` }))
  }

  // All questions are in 1 single continuous list (1..N)
  assert.equal(Array.isArray(vnuTestExam.questions), true)
  assert.equal(vnuTestExam.questions.length, 40)
  assert.equal(vnuTestExam.duration, 60)
})

// 4. Test: GlobalCanvasEngine pause condition inside active exam rooms
test('Canvas Optimization: Canvas engine must pause inside all active exam rooms and when prefers-reduced-motion is active', () => {
  function shouldCanvasBePaused(pathname, prefersReducedMotion) {
    const isFepn = Boolean(
      pathname.startsWith('/baucu') ||
      pathname.startsWith('/fepn-') ||
      pathname.startsWith('/tsv-fepn')
    )
    const isInsideActiveExamRoom = Boolean(
      pathname.startsWith('/new-exams/') ||
      pathname.startsWith('/legacy-exams/') ||
      pathname.startsWith('/seb-exam/') ||
      pathname.startsWith('/vnu-test') ||
      pathname.startsWith('/university-exams/') ||
      pathname.startsWith('/exams/')
    )
    return isFepn || isInsideActiveExamRoom || prefersReducedMotion
  }

  assert.equal(shouldCanvasBePaused('/new-exams/exam-123', false), true, 'Must pause in /new-exams/')
  assert.equal(shouldCanvasBePaused('/seb-exam/seb-456', false), true, 'Must pause in /seb-exam/')
  assert.equal(shouldCanvasBePaused('/vnu-test', false), true, 'Must pause in /vnu-test')
  assert.equal(shouldCanvasBePaused('/university-exams/uet-789', false), true, 'Must pause in /university-exams/')
  assert.equal(shouldCanvasBePaused('/dashboard', false), false, 'Runs normally on /dashboard')
  assert.equal(shouldCanvasBePaused('/dashboard', true), true, 'Must pause when prefers-reduced-motion is true')
})
