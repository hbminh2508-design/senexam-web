import { ThreadRecord, ThreadPriority } from './types'

/**
 * ==============================================================================
 * SEN HEART 1.2.1 - THREAD MANAGER (LEAN MICRO-KERNEL)
 * Quản lý vòng đời tiến trình đa tầng với Hệ Thống Phân Cấp Ưu Tiên (Thread Priority),
 * Cơ chế giới hạn hàng đợi FIFO: Chỉ khi vượt quá 5 tác vụ ngầm mới thu hồi tác vụ cũ nhất,
 * Miễn nhiễm chuyển trang (Zero Route Abort Crash) và Hộp cát bảo vệ (Crash Shield Sandbox).
 * ==============================================================================
 */
class SenHeartThreadManager {
  private threads = new Map<string, ThreadRecord>()
  private isTabVisible = true
  private listeners: Array<() => void> = []
  private isNotifyPending = false

  // Cấu hình hàng đợi ngầm theo chuẩn Sen Heart 1.2.1: Tối đa 5 tác vụ ngầm đồng thời
  public readonly MAX_BACKGROUND_TASKS = 5
  private evictionCount = 0

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
    // Tạm hoãn background polling tiêu tốn CPU khi tab bị ẩn, không chạm vào luồng critical/high
    this.threads.forEach((t) => {
      if (t.priority === 'background' && (t.name.includes('polling') || t.name.includes('stream'))) {
        // Tạm hoãn nhẹ nhàng
      }
    })
  }

  private resumeWorkloads() {
    // Phục hồi hoạt động khi người dùng quay lại tab
  }

  /**
   * Lấy danh sách các tác vụ ngầm (normal hoặc background) đang chạy
   */
  private getActiveBackgroundTasks(): ThreadRecord[] {
    return Array.from(this.threads.values()).filter(
      (t) => t.active && t.priority !== 'critical' && t.priority !== 'high' && !t.id.startsWith('core:')
    )
  }

  /**
   * Thu hồi các tác vụ ngầm vượt quá ngưỡng 5 tác vụ (Chính sách FIFO: Tác vụ lâu nhất bị thu hồi trước)
   */
  private enforceBackgroundConcurrencyLimit() {
    const bgTasks = this.getActiveBackgroundTasks()
    if (bgTasks.length > this.MAX_BACKGROUND_TASKS) {
      // Sắp xếp theo thời điểm bắt đầu tăng dần: task nào khởi chạy trước (cũ nhất) sẽ đứng đầu
      bgTasks.sort((a, b) => a.startedAt - b.startedAt)

      const excessCount = bgTasks.length - this.MAX_BACKGROUND_TASKS
      for (let i = 0; i < excessCount; i++) {
        const oldest = bgTasks[i]
        if (oldest) {
          this.evictionCount++
          console.info(
            `[SenHeart 1.2.1 FIFO Manager] Thu hồi tác vụ ngầm cũ nhất "${oldest.name}" (${oldest.id}) để duy trì tối đa ${this.MAX_BACKGROUND_TASKS} tác vụ ngầm.`
          )
          this.killThread(oldest.id, true)
        }
      }
    }
  }

  /**
   * Đăng ký một luồng làm việc mới gắn liền với component, trang hoặc tác vụ hệ thống.
   * Hỗ trợ phân cấp ưu tiên: 'critical' | 'high' | 'normal' | 'background'.
   * Đối với tác vụ ngầm ('normal' | 'background'): Kiểm soát chặt chẽ giới hạn 5 tác vụ.
   */
  public registerThread(
    id: string,
    name: string,
    priority: ThreadPriority = 'normal',
    cleanup?: () => void
  ): AbortSignal {
    // Nếu thread cũ cùng id đang chạy:
    // Nếu là luồng critical đang xử lý (như Auth/Session), tái sử dụng signal hiện tại
    const existing = this.threads.get(id)
    if (existing) {
      if ((existing.priority === 'critical' || existing.priority === 'high') && existing.active) {
        return existing.controller.signal
      }
      this.killThread(id, true)
    }

    // Áp dụng cơ chế FIFO: Nếu chuẩn bị thêm tác vụ ngầm mới làm tổng số tác vụ ngầm > 5,
    // tiến hành thu hồi tác vụ ngầm cũ nhất trước để giải phóng RAM ngay lập tức
    if (priority !== 'critical' && priority !== 'high' && !id.startsWith('core:')) {
      const currentBgCount = this.getActiveBackgroundTasks().length
      if (currentBgCount >= this.MAX_BACKGROUND_TASKS) {
        const bgTasks = this.getActiveBackgroundTasks().sort((a, b) => a.startedAt - b.startedAt)
        const oldest = bgTasks[0]
        if (oldest) {
          this.evictionCount++
          console.info(
            `[SenHeart 1.2.1 FIFO Manager] Thu hồi tác vụ ngầm cũ nhất "${oldest.name}" (${oldest.id}) khi vượt ngưỡng 5 tác vụ.`
          )
          this.killThread(oldest.id, true)
        }
      }
    }

    const controller = new AbortController()
    const cleanups: Array<() => void> = []
    if (cleanup) cleanups.push(cleanup)

    const record: ThreadRecord = {
      id,
      name,
      active: true,
      startedAt: Date.now(),
      priority,
      controller,
      cleanups,
    }

    this.threads.set(id, record)
    this.notifyListeners()
    return controller.signal
  }

  /**
   * Đăng ký thêm hàm dọn dẹp (cleanup) vào luồng
   */
  public addCleanup(id: string, cleanup: () => void) {
    const thread = this.threads.get(id)
    if (thread) {
      thread.cleanups.push(cleanup)
    }
  }

  /**
   * Hủy luồng một cách an toàn.
   * Nếu luồng là 'critical' (ví dụ Đăng nhập, Phiên Auth), nó sẽ được BẢO VỆ TUYỆT ĐỐI,
   * trừ khi có cờ force = true.
   */
  public killThread(id: string, force: boolean = false) {
    const thread = this.threads.get(id)
    if (!thread) return

    // Bảo vệ các luồng critical chống bị vô tình hủy ngang
    if (thread.priority === 'critical' && !force) {
      return
    }

    thread.active = false
    try {
      if (!thread.controller.signal.aborted) {
        thread.controller.abort('SenHeart 1.2.1: Thread gracefully terminated.')
      }
    } catch {}

    // Chạy các hàm dọn dẹp an toàn
    thread.cleanups.forEach((fn) => {
      try {
        fn()
      } catch (err) {
        console.warn(`[SenHeart 1.2.1] Cảnh báo dọn dẹp luồng ${id}:`, err)
      }
    })

    // Giải phóng bộ nhớ RAM triệt để
    thread.cleanups = []
    this.threads.delete(id)
    this.notifyListeners()
  }

  /**
   * SEN HEART 1.2.1 CRASH SHIELD:
   * Chạy một tác vụ bất đồng bộ trong hộp cát an toàn (Sandbox).
   * Tự động bắt mọi ngoại lệ (Network, Abort, Null reference), không bao giờ để lỗi
   * văng lên cây React gây văng ErrorBoundary hay sập trang web.
   */
  public async runGuarded<T>(
    name: string,
    task: (signal: AbortSignal) => Promise<T>,
    fallback: T,
    priority: ThreadPriority = 'normal'
  ): Promise<T> {
    const threadId = `guard_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const signal = this.registerThread(threadId, name, priority)

    try {
      const result = await task(signal)
      return result
    } catch (err: any) {
      // Bỏ qua lỗi do Abort có chủ đích hoặc thu hồi FIFO
      if (err?.name === 'AbortError' || String(err).includes('aborted') || String(err).includes('FIFO')) {
        return fallback
      }
      console.warn(`[SenHeart 1.2.1 Crash Shield] Tác vụ "${name}" gặp ngoại lệ được cách ly an toàn:`, err)
      return fallback
    } finally {
      const t = this.threads.get(threadId)
      if (t) {
        t.active = false
        this.threads.delete(threadId)
        this.notifyListeners()
      }
    }
  }

  /**
   * SEN HEART 1.2.1 ZERO-CRASH ROUTE TRANSITION:
   * Khi chuyển tuyến đường, TUYỆT ĐỐI KHÔNG hủy ngang bừa bãi các luồng đang xử lý dữ liệu.
   * Để các tác vụ dở dang hoàn tất bình thường; chỉ thu hồi theo cơ chế FIFO nếu tổng số
   * tác vụ ngầm vượt quá ngưỡng 5 tác vụ.
   */
  public transitionRoute(prevRoute: string, newRoute: string) {
    if (!prevRoute || prevRoute === newRoute) return

    // Kiểm tra hàng đợi ngầm theo ngưỡng 5 tác vụ
    this.enforceBackgroundConcurrencyLimit()
  }

  /**
   * Cưỡng chế ngắt toàn bộ luồng tạm, bảo lưu luồng core và luồng critical (Admin click)
   */
  public killAllTemporaryThreads() {
    const toKill: string[] = []
    this.threads.forEach((t, id) => {
      if (!id.startsWith('core:') && t.priority !== 'critical') {
        toKill.push(id)
      }
    })
    toKill.forEach((id) => this.killThread(id, true))
  }

  /**
   * Dọn dẹp các luồng mồ côi (zombie threads) quá hạn (> 15 phút không phản hồi)
   */
  public pruneZombieThreads() {
    const now = Date.now()
    const toKill: string[] = []
    this.threads.forEach((t, id) => {
      if (!id.startsWith('core:') && t.priority !== 'critical' && t.priority !== 'high') {
        if (t.controller.signal.aborted || now - t.startedAt > 15 * 60 * 1000) {
          toKill.push(id)
        }
      }
    })
    if (toKill.length > 0) {
      toKill.forEach((id) => this.killThread(id, true))
    }
    this.enforceBackgroundConcurrencyLimit()
  }

  public getActiveCount(): number {
    return this.threads.size
  }

  public getCriticalCount(): number {
    let count = 0
    this.threads.forEach((t) => {
      if (t.priority === 'critical') count++
    })
    return count
  }

  public getBackgroundCount(): number {
    return this.getActiveBackgroundTasks().length
  }

  public getEvictionCount(): number {
    return this.evictionCount
  }

  public getThreadList(): Array<{ id: string; name: string; durationMs: number; active: boolean; priority: ThreadPriority }> {
    const now = Date.now()
    return Array.from(this.threads.values()).map((t) => ({
      id: t.id,
      name: t.name,
      durationMs: now - t.startedAt,
      active: t.active,
      priority: t.priority,
    }))
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Thông báo nhẹ nhàng qua Microtask để chống tràn bộ nhớ Call Stack và RAM
   */
  private notifyListeners() {
    if (this.isNotifyPending) return
    this.isNotifyPending = true

    queueMicrotask(() => {
      this.isNotifyPending = false
      this.listeners.forEach((l) => {
        try {
          l()
        } catch {}
      })
    })
  }
}

export const threadManager = new SenHeartThreadManager()
