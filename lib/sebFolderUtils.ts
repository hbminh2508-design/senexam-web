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

  // 1. Ưu tiên tuyệt đối quyết định của Admin:
  // Nếu đề thi đã có folder_id (kể cả 'none' hay gán cho môn khác), không tự động đoán nữa
  if (exam.folder_id && typeof exam.folder_id === 'string' && exam.folder_id.trim() !== '') {
    return exam.folder_id === folder.id
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
  // Phân biệt rõ Tư duy Định lượng (Toán/Số học) vs Tư duy Định tính (Văn học/Ngôn ngữ)
  if (folderName.includes('định lượng')) {
    if (title.includes('định tính') || title.includes('ngữ văn') || title.includes('văn')) return false
    if (title.includes('định lượng') || title.includes('toán') || examType.includes('toán')) return true
  }

  if (folderName.includes('định tính')) {
    if (title.includes('định lượng') || title.includes('toán')) return false
    if (title.includes('định tính') || title.includes('ngữ văn') || title.includes('văn') || title.includes('tiếng việt')) return true
  }

  if (folderName.includes('toán') && (title.includes('toán') || examType.includes('toán'))) {
    if (title.includes('định tính')) return false
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

  // Khớp TSA / ĐGTD (tránh khớp nhầm chỉ vì từ 'tư duy' chung chung)
  if (
    (folderName.includes('tsa') || folderName.includes('đgtd')) &&
    (title.includes('tsa') || examType.includes('tsa') || title.includes('đgtd') || examType.includes('đgtd'))
  ) {
    return true
  }

  // Khớp HSA chung khi môn không phân định tính/lượng
  if (
    (folderName.includes('hsa') || folderName.includes('đgnl') || folderName.includes('năng lực')) &&
    !folderName.includes('định tính') && !folderName.includes('định lượng') &&
    (title.includes('hsa') || examType.includes('hsa') || title.includes('đgnl') || examType.includes('đgnl') || title.includes('năng lực'))
  ) {
    return true
  }

  if (
    (folderName.includes('văn') || folderName.includes('ngữ văn')) &&
    (title.includes('văn') || title.includes('ngữ văn') || examType.includes('văn'))
  ) {
    if (title.includes('định lượng')) return false
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

  // 4. Khớp trực tiếp nếu tên folder nằm trong title đề thi hoặc ngược lại (yêu cầu độ dài tối thiểu 4 ký tự)
  if (folderName.length >= 4 && title.includes(folderName)) {
    return true
  }

  return false
}
