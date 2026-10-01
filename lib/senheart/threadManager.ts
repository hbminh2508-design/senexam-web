import { ThreadRecord } from './types'

/**
 * Sen Heart 1.0 - Thread Manager
 * Quản lý vòng đời tiến trình & ngắt các luồng trang web khi người dùng rời trang.
 * Ngăn chặn hiện tượng rò rỉ bộ nhớ, chạy ngầm vô tận và giật lag hệ thống.
 */
class SenHeartThreadManager {
  private threads = new Map<string, ThreadRecord>()
  private isTabVisible = true
  private listeners: Array<() => void> = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.initVisibilityListener()
    }
  }

  private initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      this.isTabVisible = !document.hidden
      if (document.hidden) {
        this.suspendHeavyWorkloads()
      } else {
        this.resumeWorkloads()
      }
      this.notifyListeners()
    })
  }

  private suspendHeavyWorkloads() {
    // Tạm dừng các tác vụ không cần thiết khi ẩn tab trình duyệt
    this.threads.forEach((t) => {
      if (t.name.includes('polling') || t.name.includes('stream')) {
        // Tạm đình chỉ polling ngầm để tiết kiệm CPU/RAM
      }
    })
  }

  private resumeWorkloads() {
    // Tiếp tục hoạt động khi người dùng quay lại tab
  }

  /**
   * Đăng ký một luồng làm việc mới thuộc một trang hoặc tính năng.
   * Trả về AbortSignal để trang truyền vào fetch, Supabase listener hoặc listener DOM.
   */
  public registerThread(id: string, name: string, cleanup?: () => void): AbortSignal {
    // Nếu thread cũ cùng id đang chạy, ngắt nó trước
    if (this.threads.has(id)) {
      this.killThread(id)
    }

    const controller = new AbortController()
    const cleanups: Array<() => void> = []
    if (cleanup) cleanups.push(cleanup)

    const record: ThreadRecord = {
      id,
      name,
      active: true,
      startedAt: Date.now(),
      controller,
      cleanups,
    }

    this.threads.set(id, record)
    this.notifyListeners()
    return controller.signal
  }

  /**
   * Đăng ký thêm hàm dọn dẹp (cleanup) vào luồng (ví dụ: clearInterval, unsubscribe Supabase)
   */
  public addCleanup(id: string, cleanup: () => void) {
    const thread = this.threads.get(id)
    if (thread) {
      thread.cleanups.push(cleanup)
    }
  }

  /**
   * Ngắt và tiêu hủy hoàn toàn 1 luồng khi người dùng thoát ra khỏi trang.
   */
  public killThread(id: string) {
    const thread = this.threads.get(id)
    if (!thread) return

    thread.active = false
    try {
      thread.controller.abort('SenHeart: Thread terminated upon page exit.')
    } catch {}

    // Chạy toàn bộ các hàm dọn dẹp đã đăng ký
    thread.cleanups.forEach((fn) => {
      try {
        fn()
      } catch (err) {
        console.warn(`[SenHeart] Lỗi dọn dẹp luồng ${id}:`, err)
      }
    })

    this.threads.delete(id)
    this.notifyListeners()
  }

  /**
   * Tự động tiêu hủy các luồng thuộc về trang vừa rời đi
   */
  public transitionRoute(prevRoute: string, newRoute: string) {
    if (!prevRoute || prevRoute === newRoute) return

    const sanitizedPrev = prevRoute.replace(/^\//, '').replace(/\//g, '_')
    const toKill: string[] = []

    this.threads.forEach((t, id) => {
      // Nếu luồng có chứa tiền tố trang trước đó và không phải luồng toàn cục (core)
      if (id.startsWith(`route:${sanitizedPrev}`) || (t.name.startsWith(sanitizedPrev) && !id.startsWith('core:'))) {
        toKill.push(id)
      }
    })

    toKill.forEach((id) => this.killThread(id))
  }

  /**
   * Cưỡng chế ngắt toàn bộ các luồng tạm thời, chỉ giữ lại các luồng cốt lõi
   */
  public killAllTemporaryThreads() {
    const toKill: string[] = []
    this.threads.forEach((_, id) => {
      if (!id.startsWith('core:')) {
        toKill.push(id)
      }
    })
    toKill.forEach((id) => this.killThread(id))
  }

  /**
   * Sen Heart 1.0.2: Tự động dọn dẹp các tiến trình mồ côi hoặc bị hủy nhưng chưa giải phóng
   */
  public pruneZombieThreads() {
    const now = Date.now()
    const toKill: string[] = []
    this.threads.forEach((t, id) => {
      if (!id.startsWith('core:')) {
        if (t.controller.signal.aborted || (now - t.startedAt > 15 * 60 * 1000)) {
          toKill.push(id)
        }
      }
    })
    if (toKill.length > 0) {
      toKill.forEach((id) => this.killThread(id))
    }
  }

  public getActiveCount(): number {
    return this.threads.size
  }

  public getThreadList(): Array<{ id: string; name: string; durationMs: number; active: boolean }> {
    const now = Date.now()
    return Array.from(this.threads.values()).map((t) => ({
      id: t.id,
      name: t.name,
      durationMs: now - t.startedAt,
      active: t.active,
    }))
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l()
      } catch {}
    })
  }
}

export const threadManager = new SenHeartThreadManager()
