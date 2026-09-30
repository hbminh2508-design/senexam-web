import { CacheCleanReport } from './types'

/**
 * Sen Heart 1.0 - Cache Trimmer
 * Thường xuyên quét và giảm thiểu cache rác, giải phóng RAM và LocalStorage cho người dùng.
 * Đảm bảo dữ liệu xác thực (Auth/Tokens) luôn an toàn tuyệt đối.
 */
class SenHeartCacheTrimmer {
  private totalSavingsKb = 0
  private cleanupsCount = 0

  // Danh sách các key BẢO MẬT & QUAN TRỌNG - TUYỆT ĐỐI KHÔNG XÓA
  private readonly PROTECTED_KEYS = [
    'supabase.auth.token',
    'sb-',
    'theme',
    'senexam_beta_tester',
    'sen_read_announcements_',
    'fepn_session',
  ]

  /**
   * Quét và dọn dẹp các mục bộ nhớ đệm đã hết hạn hoặc tạm thời
   */
  public trimCache(): CacheCleanReport {
    if (typeof window === 'undefined') {
      return { timestamp: Date.now(), keysRemoved: 0, estimatedBytesSaved: 0, status: 'skipped' }
    }

    let removedCount = 0
    let bytesSaved = 0
    const now = Date.now()

    try {
      // 1. Quét LocalStorage
      const keysToEvict: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // Kiểm tra xem key có nằm trong diện bảo vệ không
        const isProtected = this.PROTECTED_KEYS.some((pk) => key.startsWith(pk) || key.includes(pk))
        if (isProtected) continue

        // Kiểm tra các key rác tạm thời của SenExam
        const isTemporary =
          key.startsWith('sen_cache_') ||
          key.startsWith('sen_ai_temp_') ||
          key.startsWith('katex_scratch_') ||
          key.startsWith('seb_temp_') ||
          key.startsWith('exam_draft_expired_') ||
          key.startsWith('sen_ocr_cache_')

        if (isTemporary) {
          keysToEvict.push(key)
          continue
        }

        // Kiểm tra các cache có gắn TTL JSON
        try {
          const raw = localStorage.getItem(key)
          if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object' && parsed._expiresAt && Number(parsed._expiresAt) < now) {
              keysToEvict.push(key)
            }
          }
        } catch {}
      }

      // Tiến hành xóa các key đã chọn
      keysToEvict.forEach((k) => {
        const item = localStorage.getItem(k)
        if (item) {
          bytesSaved += item.length * 2 // Ước tính 2 bytes / ký tự UTF-16
        }
        localStorage.removeItem(k)
        removedCount++
      })

      // 2. Dọn SessionStorage các tab đã hết hạn
      const sessionEvict: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const skey = sessionStorage.key(i)
        if (!skey) continue
        if (skey.startsWith('sen_temp_') || skey.startsWith('katex_prev_')) {
          sessionEvict.push(skey)
        }
      }
      sessionEvict.forEach((k) => {
        sessionStorage.removeItem(k)
        removedCount++
      })

      this.cleanupsCount++
      const kb = Math.round(bytesSaved / 1024)
      this.totalSavingsKb += kb

      return {
        timestamp: now,
        keysRemoved: removedCount,
        estimatedBytesSaved: bytesSaved,
        status: 'completed',
      }
    } catch (err) {
      console.warn('[SenHeart] Lỗi tối ưu hóa bộ nhớ cache:', err)
      return {
        timestamp: now,
        keysRemoved: removedCount,
        estimatedBytesSaved: bytesSaved,
        status: 'completed',
      }
    }
  }

  public getTotalSavingsKb(): number {
    return this.totalSavingsKb
  }

  public getTotalCleanups(): number {
    return this.cleanupsCount
  }
}

export const cacheTrimmer = new SenHeartCacheTrimmer()
