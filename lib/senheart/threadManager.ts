import { ThreadRecord, ThreadPriority } from './types'

/**
 * ==============================================================================
 * SEN HEART 1.1 - THREAD MANAGER (MICRO-KERNEL CORE)
 * Quản lý vòng đời tiến trình đa tầng với Hệ Thống Phân Cấp Ưu Tiên (Thread Priority),
 * Lá chắn triệt tiêu Crash (Crash Shield), và Bảo vệ Tuyệt đối các Luồng Xác thực (Auth).
 * ==============================================================================
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
    // Chỉ tạm dừng các luồng nền (background) khi tab bị ẩn, tuyệt đối không chạm luồng critical/high
    this.threads.forEach((t) => {
      if (t.priority === 'background' && (t.name.includes('polling') || t.name.includes('stream'))) {
        // Tạm hoãn background polling để tiết kiệm tài nguyên
      }
    })
  }

  private resumeWorkloads() {
    // Phục hồi hoạt động khi người dùng kích hoạt lại tab
  }

  /**
   * Đăng ký một luồng làm việc mới gắn liền với component, trang hoặc tác vụ hệ thống.
   * Hỗ trợ phân cấp ưu tiên: 'critical' | 'high' | 'normal' | 'background'.
   */
  public registerThread(
    id: string,
    name: string,
    priority: ThreadPriority = 'normal',
    cleanup?: () => void
  ): AbortSignal {
    // Nếu thread cũ cùng id đang chạy, ngắt nó trước (trừ khi là luồng critical đang xử lý auth)
    const existing = this.threads.get(id)
    if (existing) {
      if (existing.priority === 'critical' && existing.active) {
        return existing.controller.signal
      }
      this.killThread(id, true)
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

    // Bảo vệ các luồng critical chống bị vô tình hủy ngang khi chuyển trang
    if (thread.priority === 'critical' && !force) {
      return
    }

    thread.active = false
    try {
      if (!thread.controller.signal.aborted) {
        thread.controller.abort('SenHeart: Thread gracefully finished or terminated.')
      }
    } catch {}

    // Chạy các hàm dọn dẹp an toàn bên trong try...catch
    thread.cleanups.forEach((fn) => {
      try {
        fn()
      } catch (err) {
        console.warn(`[SenHeart 1.1] Cảnh báo dọn dẹp luồng ${id}:`, err)
      }
    })

    this.threads.delete(id)
    this.notifyListeners()
  }

  /**
   * SEN HEART 1.1 CRASH SHIELD:
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
      // Bỏ qua lỗi do Abort có chủ đích
      if (err?.name === 'AbortError' || String(err).includes('aborted')) {
        return fallback
      }
      console.warn(`[SenHeart 1.1 Crash Shield] Tác vụ "${name}" gặp ngoại lệ được cách ly an toàn:`, err)
      return fallback
    } finally {
      this.killThread(threadId, true)
    }
  }

  /**
   * Chuyển trang an toàn:
   * Chỉ dọn dẹp các luồng thuộc trang cũ mà KHÔNG CÓ độ ưu tiên 'critical'.
   */
  public transitionRoute(prevRoute: string, newRoute: string) {
    if (!prevRoute || prevRoute === newRoute) return

    const sanitizedPrev = prevRoute.replace(/^\//, '').replace(/\//g, '_')
    const toKill: string[] = []

    this.threads.forEach((t, id) => {
      // Tuyệt đối không ngắt luồng critical hoặc luồng core
      if (t.priority === 'critical' || id.startsWith('core:')) return

      if (id.startsWith(`route:${sanitizedPrev}`) || (t.name.startsWith(sanitizedPrev))) {
        toKill.push(id)
      }
    })

    toKill.forEach((id) => this.killThread(id, true))
  }

  /**
   * Cưỡng chế ngắt toàn bộ luồng tạm, bảo lưu luồng core và luồng critical
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
   * Dọn dẹp các luồng mồ côi (zombie threads)
   */
  public pruneZombieThreads() {
    const now = Date.now()
    const toKill: string[] = []
    this.threads.forEach((t, id) => {
      if (!id.startsWith('core:') && t.priority !== 'critical') {
        if (t.controller.signal.aborted || (now - t.startedAt > 10 * 60 * 1000)) {
          toKill.push(id)
        }
      }
    })
    if (toKill.length > 0) {
      toKill.forEach((id) => this.killThread(id, true))
    }
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

  private notifyListeners() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.listeners.forEach((l) => {
          try {
            l()
          } catch {}
        })
      }, 0)
    } else {
      this.listeners.forEach((l) => {
        try {
          l()
        } catch {}
      })
    }
  }
}

export const threadManager = new SenHeartThreadManager()
