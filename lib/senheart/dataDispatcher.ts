/**
 * Passive No-Op Data Dispatcher Shim
 * Executes fetchers transparently without interference or cache collision
 */
class PassiveSenHeartDataDispatcher {
  public async fetchShared<T>(
    _key: string,
    fetcher: () => Promise<T>,
    _ttlMs?: number,
    fallback: T = null as any
  ): Promise<T> {
    try {
      return await fetcher()
    } catch {
      return fallback
    }
  }

  public invalidate(_keyPrefix?: string) {}

  public getStats() {
    return {
      cachedEntries: 0,
      inFlightRequests: 0,
      maxCap: 0,
    }
  }
}

export const dataDispatcher = new PassiveSenHeartDataDispatcher()
