/**
 * Helper kiểm tra đề thi có thuộc diện độc quyền Đề thi Đại học (Portal UET) hay không.
 * Chỉ những đề thi có TAG Đề thi Đại học chính xác, exam_type là UNIVERSITY / PORTAL_UET,
 * hoặc định dạng format là university mới được phép sử dụng giao diện này.
 *
 * QUAN TRỌNG: Tuyệt đối KHÔNG gán nhầm các đề thi THPTQG, HSA, TSA thành Đề Đại học!
 */
export function isUniversityExam(exam: any): boolean {
  if (!exam || typeof exam !== 'object') return false

  // 0. BẢO VỆ TUYỆT ĐỐI: Nếu là đề thi THPTQG / HSA / TSA / SPT thì KHÔNG BAO GIỜ là Portal UET
  const examType = String(exam.exam_type || '').toUpperCase().trim()
  const title = String(exam.title || '').toUpperCase().trim()

  if (
    examType.includes('THPT') ||
    examType === 'HSA' ||
    examType === 'TSA' ||
    examType === 'SPT' ||
    examType === 'ĐGNL' ||
    examType.includes('1 TIẾT') ||
    examType.includes('HỌC KỲ') ||
    title.includes('THPT') ||
    title.includes('THPTQG') ||
    title.includes('TRUNG HỌC PHỔ THÔNG') ||
    title.includes('LỚP 12') ||
    title.includes('LỚP 11') ||
    title.includes('LỚP 10')
  ) {
    return false
  }

  const format = String(exam.format || '').toLowerCase().trim()
  if (format === 'hsa' || format === 'thptqg' || format === 'thpt' || format === 'tsa' || format === 'katex_thpt') {
    return false
  }

  // 1. Kiểm tra format trực tiếp
  if (format === 'university' || format === 'portal_uet') {
    return true
  }

  // 2. Kiểm tra trường exam_type là UNIVERSITY hoặc PORTAL_UET
  if (
    examType === 'UNIVERSITY' ||
    examType === 'PORTAL_UET' ||
    examType === 'ĐẠI HỌC (PORTAL UET)'
  ) {
    return true
  }

  // 3. Kiểm tra mảng tags: Phải chứa tag CHÍNH XÁC của Portal UET hoặc Đề thi Đại học học phần
  // Tuyệt đối không dùng str.includes('đại học') vì đề THPTQG thường có tag "Luyện thi đại học"
  if (Array.isArray(exam.tags)) {
    const hasTag = exam.tags.some((t: any) => {
      const str = String(t || '').toLowerCase().trim()
      return (
        str === 'portal uet' ||
        str === 'portal_uet' ||
        str === 'uet' ||
        str === 'đề thi đại học' ||
        str === 'de thi dai hoc' ||
        str === 'moodle uet' ||
        str === 'học phần đại học'
      )
    })
    if (hasTag) return true
  }

  // 4. Kiểm tra tags dạng chuỗi
  if (typeof exam.tags === 'string' && exam.tags.trim()) {
    const str = exam.tags.toLowerCase().trim()
    if (
      str === 'portal uet' ||
      str === 'uet' ||
      str === 'đề thi đại học' ||
      str.includes('portal uet') ||
      str.includes('portal_uet')
    ) {
      return true
    }
  }

  // 5. Kiểm tra subjects nếu có môn học phần đại học cụ thể VÀ format/type không phải THPT
  if (Array.isArray(exam.subjects) && !examType.includes('THPT')) {
    const hasUnivSubject = exam.subjects.some((s: any) => {
      const sub = String(s || '').toLowerCase().trim()
      return (
        sub === 'portal uet' ||
        sub === 'toán cao cấp' ||
        sub === 'giải tích 1' ||
        sub === 'giải tích 2' ||
        sub === 'đại số tuyến tính' ||
        sub === 'xác suất thống kê' ||
        sub === 'kỹ thuật lập trình' ||
        sub === 'cấu trúc dữ liệu và giải thuật'
      )
    })
    if (hasUnivSubject) return true
  }

  return false
}
