import { threadManager } from './threadManager'
import { cacheTrimmer } from './cacheTrimmer'
import { securityGuard } from './securityGuard'
import { dataDispatcher } from './dataDispatcher'
import { SenHeartTelemetry, ThreadPriority } from './types'

/**
 * ==============================================================================
 * SEN HEART 1.1 - CORE ARCHITECTURE ENGINE
 * Hệ điều phối trung tâm: Quản lý phân luồng đa tầng (Thread Priority System),
 * Lá chắn triệt tiêu crash (Crash Shield Sandbox), tự động dọn dẹp bộ nhớ đệm
 * và bảo vệ an ninh thời gian thực cho toàn bộ nền tảng SenExam.
 * ==============================================================================
 */
class SenHeartCoreEngine {
  public readonly version = '1.1.0'
  public readonly buildSignature = 'SEN-HEART-ARMOR-1.1.0-ENTERPRISE-RESILIENT'
  private lastOptimization: number | null = null
  private initialized = false
  private telemetrySubscribers: Array<(t: SenHeartTelemetry) => void> = []

  public init() {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    // Đăng ký luồng Core của chính Sen Heart với quyền ưu tiên 'critical'
    threadManager.registerThread('core:senheart', 'Sen Heart System Core', 'critical')

    // Tự động kiểm tra an ninh khi khởi động
    securityGuard.verifySecurityIntegrity().then(() => {
      this.broadcastTelemetry()
    })

    // Dọn dẹp cache rác nhẹ khi tải xong trang (sau 5 giây để tránh tranh chấp lúc vừa mount)
    setTimeout(() => {
      this.trimCache()
    }, 5000)

    // Tự động dọn dẹp các luồng mồ côi định kỳ 30 giây một lần
    setInterval(() => {
      threadManager.pruneZombieThreads()
      if (typeof document !== 'undefined' && document.hidden) {
        this.trimCache()
      }
    }, 30000)

    // Lắng nghe thay đổi luồng để cập nhật telemetry cho Admin
    threadManager.subscribe(() => {
      this.broadcastTelemetry()
    })
  }

  /**
   * Xử lý di chuyển chuyển trang:
   * - Hủy luồng của trang cũ để không tiếp tục chạy ngầm gây lag.
   * - Tạm hoãn dọn cache 15 giây để không làm gián đoạn ghi session.
   */
  public transitionRoute(prevRoute: string, nextRoute: string) {
    if (prevRoute && prevRoute !== nextRoute) {
      cacheTrimmer.pauseTrimming(15000)
      threadManager.transitionRoute(prevRoute, nextRoute)
    }
  }

  /**
   * Tạm hoãn dọn cache khi đang thực hiện các thao tác nhạy cảm (Đăng nhập, Lưu đề thi...)
   */
  public pauseCacheTrimming(durationMs: number = 15000) {
    cacheTrimmer.pauseTrimming(durationMs)
  }

  /**
   * Đăng ký một luồng làm việc mới gắn với component/trang
   */
  public registerThread(
    id: string,
    name: string,
    priority: ThreadPriority = 'normal',
    cleanup?: () => void
  ): AbortSignal {
    return threadManager.registerThread(id, name, priority, cleanup)
  }

  /**
   * Hủy luồng làm việc
   */
  public killThread(id: string, force: boolean = false) {
    threadManager.killThread(id, force)
  }

  /**
   * Thêm hàm dọn dẹp khi luồng bị hủy
   */
  public addCleanup(id: string, cleanup: () => void) {
    threadManager.addCleanup(id, cleanup)
  }

  /**
   * SEN HEART 1.1 CRASH SHIELD:
   * Thực thi tác vụ trong Sandbox an toàn, tự động bắt lỗi và trả về fallback,
   * ngăn chặn 100% tình trạng sập component hay kích hoạt ErrorBoundary.
   */
  public async runGuarded<T>(
    name: string,
    task: (signal: AbortSignal) => Promise<T>,
    fallback: T,
    priority: ThreadPriority = 'normal'
  ): Promise<T> {
    return threadManager.runGuarded(name, task, fallback, priority)
  }

  /**
   * Chạy dọn dẹp cache
   */
  public trimCache() {
    const report = cacheTrimmer.trimCache()
    this.lastOptimization = Date.now()
    this.broadcastTelemetry()
    return report
  }

  /**
   * Thực thi tối ưu hóa toàn diện ngay lập tức (dành cho Admin click)
   */
  public async optimizeNow(): Promise<{
    threadsCleaned: number
    cacheSavedKb: number
    report: any
  }> {
    const beforeCount = threadManager.getActiveCount()
    threadManager.killAllTemporaryThreads()
    const afterCount = threadManager.getActiveCount()
    const report = cacheTrimmer.trimCache()
    this.lastOptimization = Date.now()

    this.broadcastTelemetry()

    return {
      threadsCleaned: Math.max(0, beforeCount - afterCount),
      cacheSavedKb: report.estimatedBytesSaved ? Math.round(report.estimatedBytesSaved / 1024) : 0,
      report,
    }
  }

  /**
   * Lấy dữ liệu telemetry hiện tại của hệ thống (chỉ hiển thị cho Admin)
   */
  public getTelemetry(): SenHeartTelemetry {
    return {
      version: this.version,
      buildSignature: this.buildSignature,
      activeThreads: threadManager.getActiveCount(),
      criticalThreadsCount: threadManager.getCriticalCount(),
      threadList: threadManager.getThreadList(),
      cacheSavingsKb: cacheTrimmer.getTotalSavingsKb(),
      totalCleanups: cacheTrimmer.getTotalCleanups(),
      securityStatus: securityGuard.getStatus(),
      memoryHealth: threadManager.getActiveCount() > 8 ? 'high' : threadManager.getActiveCount() > 4 ? 'moderate' : 'optimal',
      lastOptimizationAt: this.lastOptimization,
    }
  }

  /**
   * Đăng ký nhận thông báo thay đổi telemetry
   */
  public subscribeTelemetry(callback: (t: SenHeartTelemetry) => void): () => void {
    this.telemetrySubscribers.push(callback)
    callback(this.getTelemetry())
    return () => {
      this.telemetrySubscribers = this.telemetrySubscribers.filter((cb) => cb !== callback)
    }
  }

  private broadcastTelemetry() {
    if (this.telemetrySubscribers.length === 0) return
    const data = this.getTelemetry()
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.telemetrySubscribers.forEach((cb) => {
          try {
            cb(data)
          } catch {}
        })
      }, 0)
    } else {
      this.telemetrySubscribers.forEach((cb) => {
        try {
          cb(data)
        } catch {}
      })
    }
  }
}

export const senHeart = new SenHeartCoreEngine()

export { threadManager } from './threadManager'
export { cacheTrimmer } from './cacheTrimmer'
export { securityGuard } from './securityGuard'
export { dataDispatcher } from './dataDispatcher'
export * from './types'
