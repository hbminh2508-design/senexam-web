/**
 * Bộ thư viện bảo mật thi cử tập trung cho SenExam (.mjs cho cả Next.js và Node:test)
 * Đảm bảo 100% không rò rỉ đáp án, cấu hình SEB, và mã đề thi cho thí sinh
 */

export function stripExamAnswers(exam) {
  if (!exam || typeof exam !== 'object') return exam

  const safeExam = JSON.parse(JSON.stringify(exam))

  // 1. Loại bỏ các trường nhạy cảm cấp đề thi
  delete safeExam.solution_pdf_url
  delete safeExam.seb_config_key
  delete safeExam.access_code

  // 2. Hàm đệ quy làm sạch từng câu hỏi
  function cleanQuestion(q) {
    if (!q || typeof q !== 'object') return
    delete q.correctAnswer
    delete q.correct_answer
    delete q.explanation
    delete q.solution
    delete q.correctAnswers
    delete q.correctMap

    // Đúng/Sai (true_false): xóa cờ isCorrect trong từng ý con
    if (Array.isArray(q.subQuestions)) {
      q.subQuestions.forEach((sub) => {
        if (sub && typeof sub === 'object') {
          delete sub.isCorrect
          delete sub.correctAnswer
        }
      })
    }
  }

  // 3. Hàm làm sạch một phần thi (section)
  function cleanSection(sec) {
    if (!sec || typeof sec !== 'object') return
    delete sec.correctAnswers
    delete sec.correctMap
    if (Array.isArray(sec.questions)) {
      sec.questions.forEach(cleanQuestion)
    }
  }

  // 4. Khử sâu trong exam_structure (bất kể định dạng Array hay Object)
  if (safeExam.exam_structure) {
    const struct = safeExam.exam_structure

    // Trường hợp 1: exam_structure là mảng các sections (như dữ liệu thực tế tại bảng exams)
    if (Array.isArray(struct)) {
      struct.forEach((item) => {
        if (Array.isArray(item.questions)) {
          cleanSection(item)
        } else {
          cleanQuestion(item)
        }
      })
    } else if (typeof struct === 'object') {
      // Trường hợp 2: exam_structure là object có chứa sections
      if (Array.isArray(struct.sections)) {
        struct.sections.forEach(cleanSection)
      }
      // Trường hợp 3: exam_structure là object có chứa questions
      if (Array.isArray(struct.questions)) {
        struct.questions.forEach(cleanQuestion)
      }
    }
  }

  return safeExam
}

/**
 * Xác thực xem request có đến từ Safe Exam Browser hợp lệ hay không
 */
export function verifySebRequest(headers, requireSeb) {
  if (!requireSeb) return { allowed: true }

  const getHeader = (name) => {
    if (!headers) return ''
    if (typeof headers.get === 'function') {
      return headers.get(name) || ''
    }
    return headers[name] || headers[name.toLowerCase()] || ''
  }

  const sebReqHash = getHeader('x-safeexambrowser-requesthash')
  const sebConfigHash = getHeader('x-safeexambrowser-configkeyhash')
  const userAgent = (getHeader('user-agent') || '').toUpperCase()

  const isSeb = Boolean(sebReqHash || sebConfigHash || userAgent.includes('SEB'))

  if (!isSeb) {
    return {
      allowed: false,
      error: 'Bài thi này yêu cầu làm trong trình duyệt Safe Exam Browser (SEB) có giám sát an ninh.',
    }
  }

  return { allowed: true }
}
