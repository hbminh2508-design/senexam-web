/**
 * Sen Heart 1.1 - Data Dispatcher
 * Phân bố và chia sẻ dữ liệu tập trung giữa các trang và component.
 * Tích hợp cơ chế gộp yêu cầu mạng (Coalescing), Bộ đệm mềm TTL và
 * Tự động phục hồi lỗi (Error Isolation & Safe Fallback) để không làm sập Promise.all.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SenHeartDataDispatcher {
  private inFlight = new Map<string, Promise<any>>()
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL_MS = 25000 // 25 giây bộ đệm mềm

  /**
   * Gọi dữ liệu qua Sen Heart Dispatcher với cơ chế gộp yêu cầu (Coalescing) & TTL cache.
   * Nếu request bị lỗi mạng, tự động thử lại 1 lần và trả về fallback an toàn thay vì ném unhandled error.
   */
  public async fetchShared<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = this.DEFAULT_TTL_MS,
    fallback: T = null as any
  ): Promise<T> {
    const now = Date.now()

    // 1. Kiểm tra cache trong RAM còn hạn không
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > now) {
      return cached.data as T
    }

    // 2. Nếu đã có 1 request cùng key đang bay trên mạng, dùng chung Promise đó
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>
    }

    // 3. Thực thi request mới với cơ chế bảo vệ cách ly lỗi
    const promise = (async () => {
      try {
        let result: T
        try {
          result = await fetcher()
        } catch (firstErr) {
          // Thử lại 1 lần với độ trễ 250ms nếu mạng chập chờn
          await new Promise((r) => setTimeout(r, 250))
          try {
            result = await fetcher()
          } catch (secondErr) {
            console.warn(`[SenHeart 1.1 Dispatcher] Truy vấn "${key}" lỗi, dùng fallback:`, secondErr)
            return fallback
          }
        }

        if (result !== undefined) {
          this.cache.set(key, {
            data: result,
            expiresAt: Date.now() + ttlMs,
          })
        }
        return result
      } catch (fatalErr) {
        console.warn(`[SenHeart 1.1 Dispatcher] Lỗi ngoại lệ tại "${key}":`, fatalErr)
        return fallback
      } finally {
        this.inFlight.delete(key)
      }
    })()

    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * Xóa một key khỏi bộ đệm khi dữ liệu vừa được cập nhật
   */
  public invalidate(keyPrefix?: string) {
    if (!keyPrefix) {
      this.cache.clear()
      return
    }

    const toDelete: string[] = []
    this.cache.forEach((_, k) => {
      if (k.startsWith(keyPrefix)) toDelete.push(k)
    })
    toDelete.forEach((k) => this.cache.delete(k))
  }

  /**
   * Lấy số lượng dữ liệu đang được điều phối trong bộ nhớ
   */
  public getStats() {
    return {
      cachedEntries: this.cache.size,
      inFlightRequests: this.inFlight.size,
    }
  }
}

export const dataDispatcher = new SenHeartDataDispatcher()
