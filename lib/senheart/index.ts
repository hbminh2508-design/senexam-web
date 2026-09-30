import { threadManager } from './threadManager'
import { cacheTrimmer } from './cacheTrimmer'
import { securityGuard } from './securityGuard'
import { dataDispatcher } from './dataDispatcher'
import { SenHeartTelemetry } from './types'

/**
 * ==============================================================================
 * SEN HEART 1.0 - CORE ARCHITECTURE ENGINE
 * Hệ điều phối trung tâm: Quản lý phân luồng, điều phối dữ liệu, tự động dọn cache
 * và bảo vệ an ninh thời gian thực cho toàn bộ nền tảng SenExam.
 * ==============================================================================
 */
class SenHeartCoreEngine {
  public readonly version = '1.0.4-LTS'
  public readonly buildSignature = 'SEN-HEART-ARMOR-2026-X'
  private lastOptimization: number | null = null
  private initialized = false
  private telemetrySubscribers: Array<(t: SenHeartTelemetry) => void> = []

  public init() {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    // Đăng ký luồng Core của chính Sen Heart
    threadManager.registerThread('core:senheart', 'Sen Heart System Core')

    // Tự động kiểm tra an ninh khi khởi động
    securityGuard.verifySecurityIntegrity().then(() => {
      this.broadcastTelemetry()
    })

    // Dọn dẹp cache rác nhẹ khi tải xong trang
    setTimeout(() => {
      this.trimCache()
    }, 4000)

    // Lắng nghe thay đổi luồng để cập nhật telemetry cho Admin
    threadManager.subscribe(() => {
      this.broadcastTelemetry()
    })
  }

  /**
   * Xử lý di chuyển chuyển trang:
   * - Hủy luồng của trang cũ để không tiếp tục chạy ngầm gây lag.
   * - Quét dọn cache rác nếu cần.
   */
  public transitionRoute(prevRoute: string, nextRoute: string) {
    if (prevRoute && prevRoute !== nextRoute) {
      threadManager.transitionRoute(prevRoute, nextRoute)
      // Dọn cache nhẹ sau khi đổi trang
      this.trimCache()
    }
  }

  /**
   * Đăng ký một luồng làm việc mới gắn với component/trang
   */
  public registerThread(id: string, name: string, cleanup?: () => void): AbortSignal {
    return threadManager.registerThread(id, name, cleanup)
  }

  /**
   * Hủy luồng làm việc
   */
  public killThread(id: string) {
    threadManager.killThread(id)
  }

  /**
   * Thêm hàm dọn dẹp khi luồng bị hủy
   */
  public addCleanup(id: string, cleanup: () => void) {
    threadManager.addCleanup(id, cleanup)
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
    securityStatus: string
  }> {
    // 1. Quét dọn các luồng không cần thiết
    const beforeCount = threadManager.getActiveCount()
    threadManager.killAllTemporaryThreads()
    const afterCount = threadManager.getActiveCount()
    const threadsCleaned = Math.max(0, beforeCount - afterCount)

    // 2. Dọn cache
    const report = cacheTrimmer.trimCache()

    // 3. Xóa cache in-memory data dispatcher
    dataDispatcher.invalidate()

    // 4. Kiểm tra lại an ninh
    const sec = await securityGuard.verifySecurityIntegrity()

    this.lastOptimization = Date.now()
    this.broadcastTelemetry()

    return {
      threadsCleaned,
      cacheSavedKb: Math.round(report.estimatedBytesSaved / 1024),
      securityStatus: sec.status,
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
    const data = this.getTelemetry()
    this.telemetrySubscribers.forEach((cb) => {
      try {
        cb(data)
      } catch {}
    })
  }
}

export const senHeart = new SenHeartCoreEngine()

export { threadManager } from './threadManager'
export { cacheTrimmer } from './cacheTrimmer'
export { securityGuard } from './securityGuard'
export { dataDispatcher } from './dataDispatcher'
export * from './types'
