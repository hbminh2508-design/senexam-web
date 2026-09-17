export interface SebFolderLike {
  id: string
  name: string
  parent_id?: string | null
  [key: string]: any
}

export interface SebExamLike {
  id: string
  title?: string | null
  exam_type?: string | null
  folder_id?: string | null
  subjects?: string[] | string | null
  is_hidden?: boolean
  [key: string]: any
}

/**
 * Kiểm tra xem một đề thi có thuộc vào thư mục con (môn thi) hay không.
 * Ưu tiên:
 * 1. Đã gán thủ công bằng `exam.folder_id === folder.id`.
 * 2. Khớp môn trong mảng `subjects`.
 * 3. Tự động nhận diện thông minh qua từ khóa môn học trong `title` hoặc `exam_type`.
 */
export function isExamInFolder(exam: SebExamLike, folder: SebFolderLike): boolean {
  if (!exam || !folder) return false

  // 1. Khớp tuyệt đối theo folder_id (Do Admin gán thủ công)
  if (exam.folder_id && exam.folder_id === folder.id) {
    return true
  }

  const folderName = (folder.name || '').toLowerCase().trim()
  const title = (exam.title || '').toLowerCase()
  const examType = (exam.exam_type || '').toLowerCase()

  // 2. Khớp theo danh sách môn học subjects (nếu có)
  const subjectsArray: string[] = Array.isArray(exam.subjects)
    ? exam.subjects.map((s) => String(s).toLowerCase().trim())
    : typeof exam.subjects === 'string'
    ? [exam.subjects.toLowerCase().trim()]
    : []

  if (subjectsArray.length > 0) {
    const matchSubject = subjectsArray.some((s) => {
      return folderName.includes(s) || s.includes(folderName)
    })
    if (matchSubject) return true
  }

  // 3. Khớp thông minh theo từ khóa môn học và kỳ thi
  if (folderName.includes('toán') && (title.includes('toán') || examType.includes('toán'))) {
    return true
  }

  if (
    (folderName.includes('vật lý') || folderName.includes('vật lí') || folderName.includes('lý') || folderName.includes('lí')) &&
    (title.includes('vật lý') || title.includes('vật lí') || examType.includes('lý') || examType.includes('lí'))
  ) {
    return true
  }

  if (
    (folderName.includes('hóa') || folderName.includes('hoá')) &&
    (title.includes('hóa') || title.includes('hoá') || examType.includes('hóa') || examType.includes('hoá'))
  ) {
    return true
  }

  if (folderName.includes('sinh') && (title.includes('sinh') || examType.includes('sinh'))) {
    return true
  }

  if (
    (folderName.includes('anh') || folderName.includes('english')) &&
    (title.includes('anh') || title.includes('tiếng anh') || title.includes('english') || examType.includes('anh'))
  ) {
    return true
  }

  if (
    (folderName.includes('hsa') || folderName.includes('đgnl') || folderName.includes('năng lực')) &&
    (title.includes('hsa') || examType.includes('hsa') || title.includes('đgnl') || examType.includes('đgnl') || title.includes('năng lực'))
  ) {
    return true
  }

  if (
    (folderName.includes('tsa') || folderName.includes('đgtd') || folderName.includes('tư duy')) &&
    (title.includes('tsa') || examType.includes('tsa') || title.includes('đgtd') || examType.includes('đgtd') || title.includes('tư duy'))
  ) {
    return true
  }

  if (
    (folderName.includes('văn') || folderName.includes('ngữ văn')) &&
    (title.includes('văn') || title.includes('ngữ văn') || examType.includes('văn'))
  ) {
    return true
  }

  if (
    (folderName.includes('sử') || folderName.includes('lịch sử')) &&
    (title.includes('sử') || title.includes('lịch sử') || examType.includes('sử'))
  ) {
    return true
  }

  if (
    (folderName.includes('địa') || folderName.includes('địa lí') || folderName.includes('địa lý')) &&
    (title.includes('địa') || examType.includes('địa'))
  ) {
    return true
  }

  if (
    (folderName.includes('tin') || folderName.includes('tin học')) &&
    (title.includes('tin') || title.includes('tin học') || examType.includes('tin'))
  ) {
    return true
  }

  if (
    (folderName.includes('kinh tế') || folderName.includes('gdkt')) &&
    (title.includes('kinh tế') || examType.includes('kinh tế') || title.includes('gdkt'))
  ) {
    return true
  }

  // 4. Khớp trực tiếp nếu tên folder nằm trong title đề thi hoặc ngược lại
  if (folderName.length >= 3 && title.includes(folderName)) {
    return true
  }

  return false
}
