/**
 * Helper kiểm tra đề thi có thuộc diện độc quyền Đề thi Đại học (Portal UET) hay không.
 * Chỉ những đề thi có TAG Đề thi Đại học, exam_type là UNIVERSITY / PORTAL_UET,
 * hoặc định dạng format là university mới được phép sử dụng giao diện này.
 */
export function isUniversityExam(exam: any): boolean {
  if (!exam || typeof exam !== 'object') return false

  // 1. Kiểm tra mảng tags
  if (Array.isArray(exam.tags)) {
    const hasTag = exam.tags.some((t: any) => {
      const str = String(t || '').toLowerCase().trim()
      return (
        str === 'đại học' ||
        str === 'dai hoc' ||
        str === 'university' ||
        str === 'uet' ||
        str.includes('đại học') ||
        str.includes('university')
      )
    })
    if (hasTag) return true
  }

  // 2. Kiểm tra tags dạng chuỗi
  if (typeof exam.tags === 'string' && exam.tags.trim()) {
    const str = exam.tags.toLowerCase()
    if (str.includes('đại học') || str.includes('dai hoc') || str.includes('university') || str.includes('uet')) {
      return true
    }
  }

  // 3. Kiểm tra trường exam_type
  const examType = String(exam.exam_type || '').toUpperCase().trim()
  if (
    examType === 'UNIVERSITY' ||
    examType === 'PORTAL_UET' ||
    examType === 'ĐẠI HỌC' ||
    examType === 'DAI HOC' ||
    examType === 'ĐẠI HỌC (PORTAL UET)'
  ) {
    return true
  }

  // 4. Kiểm tra format
  const format = String(exam.format || '').toLowerCase().trim()
  if (format === 'university' || format === 'portal_uet') {
    return true
  }

  // 5. Kiểm tra subjects nếu có môn đại học
  if (Array.isArray(exam.subjects)) {
    const hasUnivSubject = exam.subjects.some((s: any) => {
      const sub = String(s || '').toLowerCase()
      return (
        sub.includes('đại học') ||
        sub.includes('toán cao cấp') ||
        sub.includes('giải tích') ||
        sub.includes('đại số tuyến tính') ||
        sub.includes('xác suất thống kê') ||
        sub.includes('kỹ thuật lập trình') ||
        sub.includes('uet')
      )
    })
    if (hasUnivSubject) return true
  }

  return false
}
