/**
 * Quản lý bản nháp bài thi trong localStorage an toàn cho SenExam
 * - Ràng buộc chặt chẽ với userId (chống lộ bản nháp trên máy tính dùng chung/phòng lab)
 * - Tự động hết hạn và xóa bản nháp sau 24 giờ (TTL)
 * - Cung cấp hàm dọn dẹp sạch sẽ khi thí sinh nộp bài hoặc đăng xuất
 */

export interface ExamDraftData {
  userId: string
  examId: string
  timestamp: number
  answers: Record<string, any>
  bookmarked?: Record<string, boolean>
  tabSwitches?: number
}

const DRAFT_PREFIX = 'senexam_draft_'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24 giờ

export function saveExamDraft(
  examId: string,
  userId: string,
  answers: Record<string, any>,
  extra?: { bookmarked?: Record<string, boolean>; tabSwitches?: number }
) {
  if (typeof window === 'undefined' || !examId || !userId) return

  const draft: ExamDraftData = {
    userId,
    examId,
    timestamp: Date.now(),
    answers,
    bookmarked: extra?.bookmarked,
    tabSwitches: extra?.tabSwitches,
  }

  try {
    const key = `${DRAFT_PREFIX}${examId}_${userId}`
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (e) {
    console.warn('Lỗi ghi bản nháp localStorage:', e)
  }
}

export function loadExamDraft(examId: string, userId: string): ExamDraftData | null {
  if (typeof window === 'undefined' || !examId || !userId) return null

  try {
    const key = `${DRAFT_PREFIX}${examId}_${userId}`
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed: ExamDraftData = JSON.parse(raw)
    // Kiểm tra tính sở hữu và TTL
    if (parsed.userId !== userId) {
      localStorage.removeItem(key)
      return null
    }

    if (Date.now() - parsed.timestamp > DRAFT_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function removeExamDraft(examId: string, userId: string) {
  if (typeof window === 'undefined' || !examId || !userId) return
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${examId}_${userId}`)
    // Dọn dẹp cả các key phiên bản cũ nếu có
    localStorage.removeItem(`seb_draft_${examId}_${userId}`)
    localStorage.removeItem(`vnu_test_draft_${examId}_${userId}`)
  } catch {}
}

/**
 * Xóa sạch toàn bộ bản nháp bài thi trên trình duyệt (gọi khi đăng xuất hoặc hết hạn phiên làm việc)
 */
export function clearAllExamDrafts(userId?: string) {
  if (typeof window === 'undefined') return

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      if (
        key.startsWith(DRAFT_PREFIX) ||
        key.startsWith('seb_draft_') ||
        key.startsWith('vnu_test_draft_')
      ) {
        if (!userId || key.endsWith(`_${userId}`)) {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch (e) {
    console.warn('Lỗi dọn dẹp nháp bài thi:', e)
  }
}
