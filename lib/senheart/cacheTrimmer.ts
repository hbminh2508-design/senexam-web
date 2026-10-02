import { CacheCleanReport } from './types'

/**
 * Sen Heart 1.1 - Cache Trimmer
 * Thường xuyên quét và giảm thiểu cache rác, giải phóng RAM và LocalStorage cho người dùng.
 * Tích hợp cơ chế tạm hoãn thông minh (Smart Pause) khi đang đăng nhập hoặc chuyển trang,
 * bảo vệ tuyệt đối tất cả các token xác thực và cấu hình giao diện.
 */
class SenHeartCacheTrimmer {
  private totalSavingsKb = 0
  private cleanupsCount = 0
  private pauseUntil = 0

  // Danh sách các key BẢO MẬT & QUAN TRỌNG - TUYỆT ĐỐI KHÔNG XÓA
  private readonly PROTECTED_KEYS = [
    'supabase.auth.token',
    'sb-',
    'theme',
    'senexam_',
    'idp_',
    'fepn_',
    'sen_read_announcements_',
    'sen_chat_bubble_',
    'auth_',
    'seb_',
  ]

  /**
   * Tạm hoãn dọn cache trong một khoảng thời gian (ví dụ 15 giây sau khi đăng nhập / chuyển trang)
   * để tránh xung đột I/O với Supabase Auth khi lưu token phiên làm việc.
   */
  public pauseTrimming(durationMs: number = 15000) {
    this.pauseUntil = Date.now() + durationMs
  }

  /**
   * Quét và dọn dẹp các mục bộ nhớ đệm đã hết hạn hoặc tạm thời
   */
  public trimCache(): CacheCleanReport {
    if (typeof window === 'undefined') {
      return { timestamp: Date.now(), keysRemoved: 0, estimatedBytesSaved: 0, status: 'skipped' }
    }

    const now = Date.now()
    if (now < this.pauseUntil) {
      return { timestamp: now, keysRemoved: 0, estimatedBytesSaved: 0, status: 'skipped' }
    }

    let removedCount = 0
    let bytesSaved = 0

    try {
      // 1. Quét LocalStorage an toàn
      const keysToEvict: string[] = []
      const len = localStorage.length
      for (let i = 0; i < len; i++) {
        try {
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
            key.startsWith('exam_draft_expired_') ||
            key.startsWith('sen_ocr_cache_')

          if (isTemporary) {
            keysToEvict.push(key)
            continue
          }

          // Kiểm tra các cache có gắn TTL JSON
          if (key.startsWith('cache_')) {
            try {
              const raw = localStorage.getItem(key)
              if (raw && raw.length < 4096 && raw.startsWith('{')) {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed === 'object' && parsed._expiresAt && Number(parsed._expiresAt) < now) {
                  keysToEvict.push(key)
                }
              }
            } catch {}
          }
        } catch {}
      }

      // Tiến hành xóa các key đã chọn
      keysToEvict.forEach((k) => {
        try {
          const item = localStorage.getItem(k)
          if (item) {
            bytesSaved += item.length * 2
          }
          localStorage.removeItem(k)
          removedCount++
        } catch {}
      })

      // 2. Dọn SessionStorage các tab đã hết hạn
      const sessionEvict: string[] = []
      const sLen = sessionStorage.length
      for (let i = 0; i < sLen; i++) {
        try {
          const skey = sessionStorage.key(i)
          if (!skey) continue
          if (skey.startsWith('sen_temp_') || skey.startsWith('katex_prev_')) {
            sessionEvict.push(skey)
          }
        } catch {}
      }
      sessionEvict.forEach((k) => {
        try {
          sessionStorage.removeItem(k)
          removedCount++
        } catch {}
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
      console.warn('[SenHeart 1.1] Cảnh báo dọn dẹp cache:', err)
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
