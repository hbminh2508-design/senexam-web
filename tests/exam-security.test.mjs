import test from 'node:test'
import assert from 'node:assert/strict'

test('Exam Security: answer stripping removes correct answers from student payload', () => {
  const originalExam = {
    id: 'exam-123',
    title: 'Đề thi thử THPT Quốc Gia',
    solution_pdf_url: 'https://example.com/solution.pdf',
    exam_structure: {
      sections: [
        {
          id: 'sec-1',
          name: 'Phần I: Trắc nghiệm',
          correctAnswers: { '0': 'A', '1': 'B' },
          questions: [
            { id: 'q1', content: 'Câu 1?', correctAnswer: 'A', explanation: 'Lời giải 1' },
            {
              id: 'q2',
              content: 'Câu 2 (Đúng/Sai)?',
              type: 'true_false',
              subQuestions: [
                { id: 'a', text: 'Ý a', isCorrect: true },
                { id: 'b', text: 'Ý b', isCorrect: false },
              ],
            },
          ],
        },
      ],
    },
  }

  // Logic sanitization được dùng trong API /api/exams/[id]
  const safeExam = JSON.parse(JSON.stringify(originalExam))
  delete safeExam.solution_pdf_url

  safeExam.exam_structure.sections.forEach((sec) => {
    delete sec.correctAnswers
    delete sec.correctMap
    if (Array.isArray(sec.questions)) {
      sec.questions.forEach((q) => {
        delete q.correctAnswer
        delete q.explanation
        delete q.solution
        if (Array.isArray(q.subQuestions)) {
          q.subQuestions.forEach((sub) => {
            delete sub.isCorrect
          })
        }
      })
    }
  })

  // Kiểm tra tính bảo mật sau khi strip
  assert.strictEqual(safeExam.solution_pdf_url, undefined)
  assert.strictEqual(safeExam.exam_structure.sections[0].correctAnswers, undefined)
  assert.strictEqual(safeExam.exam_structure.sections[0].questions[0].correctAnswer, undefined)
  assert.strictEqual(safeExam.exam_structure.sections[0].questions[0].explanation, undefined)
  assert.strictEqual(safeExam.exam_structure.sections[0].questions[1].subQuestions[0].isCorrect, undefined)
})

test('Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)', () => {
  function scoreTrueFalse(userAnswers, correctAnswers, totalPoints) {
    let matchedSubs = 0
    ;['a', 'b', 'c', 'd'].forEach((sub) => {
      const u = String(userAnswers[sub] || '').toUpperCase()
      const c = String(correctAnswers[sub] || '').toUpperCase()
      const isUTrue = u === 'Đ' || u === 'T' || u === 'TRUE' || u === '1'
      const isUFalse = u === 'S' || u === 'F' || u === 'FALSE' || u === '0'
      const isCTrue = c === 'Đ' || c === 'T' || c === 'TRUE' || c === '1'
      const isCFalse = c === 'S' || c === 'F' || c === 'FALSE' || c === '0'
      if ((isUTrue && isCTrue) || (isUFalse && isCFalse)) matchedSubs++
    })

    if (matchedSubs === 4) return totalPoints * 1.0
    if (matchedSubs === 3) return totalPoints * 0.5
    if (matchedSubs === 2) return totalPoints * 0.25
    if (matchedSubs === 1) return totalPoints * 0.1
    return 0
  }

  const correct = { a: 'Đ', b: 'S', c: 'Đ', d: 'S' }
  const totalPoints = 1.0

  // 4 ý đúng -> 100%
  assert.strictEqual(scoreTrueFalse({ a: 'Đ', b: 'S', c: 'Đ', d: 'S' }, correct, totalPoints), 1.0)
  // 3 ý đúng -> 50%
  assert.strictEqual(scoreTrueFalse({ a: 'Đ', b: 'S', c: 'Đ', d: 'Đ' }, correct, totalPoints), 0.5)
  // 2 ý đúng -> 25%
  assert.strictEqual(scoreTrueFalse({ a: 'Đ', b: 'S', c: 'S', d: 'Đ' }, correct, totalPoints), 0.25)
  // 1 ý đúng -> 10%
  assert.strictEqual(scoreTrueFalse({ a: 'Đ', b: 'Đ', c: 'S', d: 'Đ' }, correct, totalPoints), 0.1)
  // 0 ý đúng -> 0%
  assert.strictEqual(scoreTrueFalse({ a: 'S', b: 'Đ', c: 'S', d: 'Đ' }, correct, totalPoints), 0)
})

test('Exam Security: Double submission lock blocks rapid clicks within lock window', () => {
  const locks = new Map()

  function submitWithLock(userId, examId) {
    const key = `${userId}_${examId}`
    const existing = locks.get(key)
    const now = Date.now()
    if (existing && now - existing.timestamp < 10000) {
      return { status: 200, isDuplicate: true, submissionId: existing.id }
    }
    const newSubId = `sub_${Math.random().toString(36).slice(2)}`
    locks.set(key, { timestamp: now, id: newSubId })
    return { status: 200, isDuplicate: false, submissionId: newSubId }
  }

  const res1 = submitWithLock('user1', 'exam1')
  assert.strictEqual(res1.isDuplicate, false)

  const res2 = submitWithLock('user1', 'exam1')
  assert.strictEqual(res2.isDuplicate, true)
  assert.strictEqual(res2.submissionId, res1.submissionId, 'Duplicate submission must return original ID')
})
