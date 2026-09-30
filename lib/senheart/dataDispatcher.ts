/**
 * Sen Heart 1.0 - Data Dispatcher
 * Phân bố và chia sẻ dữ liệu tập trung giữa các trang và component.
 * Ngăn chặn hiện tượng gửi trùng lặp yêu cầu mạng (Request Duplication) và giật lag
 * khi chuyển trang hoặc tải nhiều thành phần cùng lúc.
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
   */
  public async fetchShared<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = this.DEFAULT_TTL_MS
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

    // 3. Thực thi request mới và lưu vào in-flight map
    const promise = (async () => {
      try {
        const result = await fetcher()
        this.cache.set(key, {
          data: result,
          expiresAt: Date.now() + ttlMs,
        })
        return result
      } finally {
        this.inFlight.delete(key)
      }
    })()

    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * Xóa một key khỏi bộ đệm khi dữ liệu vừa được cập nhật (ví dụ: vừa điểm danh hoặc đổi điểm)
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
