import * as FileSystem from 'expo-file-system/legacy';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  etag?: string | null;
}

export const CACHE_TTL = {
  // Attendance is time-sensitive.
  // We keep it short because the backend is the authority.
  ATTENDANCE_STATUS: 10 * 1000,
  DASHBOARD: 10 * 1000,

  NOTIFICATIONS: 60 * 1000,
  PRODUCTS_STOCK: 5 * 60 * 1000,
  STOCK_REQUIREMENTS: 60 * 1000,
  CUSTOMERS: 10 * 60 * 1000,
  CATALOGUES: 15 * 60 * 1000,
  OFFICE_CONFIG: 60 * 60 * 1000,
  EMPLOYEES: 15 * 60 * 1000,
  CALENDAR: 10 * 60 * 1000,
} as const;

class DataCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<any>>();
  private initialized = false;
  private saveDebounceTimer: any = null;

  private getCacheFilePath(): string {
    const baseDir =
      FileSystem.cacheDirectory ||
      FileSystem.documentDirectory ||
      '';

    return `${baseDir}ecdial_app_cache_v1.json`;
  }

  /**
   * Attendance data must NEVER be treated as persistent/offline
   * authoritative data because attendance depends on the current
   * date and current time.
   */
  private isPersistentCacheAllowed(key: string): boolean {
    return !key.startsWith('attendance:');
  }

  /**
   * Initializes persistent cache from device disk on app start.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    this.initialized = true;

    try {
      const filePath = this.getCacheFilePath();
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(filePath);

        if (content && content.length > 2) {
          const parsed = JSON.parse(content);

          if (parsed && typeof parsed === 'object') {
            for (const [key, val] of Object.entries(parsed)) {
              if (
                !this.isPersistentCacheAllowed(key)
              ) {
                continue;
              }

              if (
                val &&
                typeof val === 'object' &&
                (val as any).data !== undefined
              ) {
                this.memoryCache.set(
                  key,
                  val as CacheEntry
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        '[DataCache] Init from disk warning:',
        err
      );
    }
  }

  /**
   * Debounced save of persistent cache to device disk.
   *
   * Attendance entries are intentionally excluded.
   */
  private scheduleDiskSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      try {
        const filePath = this.getCacheFilePath();

        const serializable: Record<string, CacheEntry> = {};

        for (const [key, value] of this.memoryCache.entries()) {
          if (!this.isPersistentCacheAllowed(key)) {
            continue;
          }

          serializable[key] = value;
        }

        await FileSystem.writeAsStringAsync(
          filePath,
          JSON.stringify(serializable)
        );
      } catch (err) {
        console.warn(
          '[DataCache] Disk write warning:',
          err
        );
      }
    }, 1500);
  }

  /**
   * Synchronous memory-cache read.
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    return entry.data as T;
  }

  /**
   * Reads raw cache entry including timestamp and ETag.
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Saves/updates memory cache.
   */
  set<T>(
    key: string,
    data: T,
    etag?: string | null
  ): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      etag: etag || null,
    });

    this.scheduleDiskSave();
  }

  /**
   * Checks whether cached data is fresh.
   */
  isFresh(
    key: string,
    ttlMs: number
  ): boolean {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return false;
    }

    return (
      Date.now() - entry.timestamp <
      ttlMs
    );
  }

  /**
   * Prevents duplicate identical requests.
   */
  dedupe<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const existing =
      this.inFlightRequests.get(key);

    if (existing) {
      return existing as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(
      key,
      promise
    );

    return promise;
  }

  /**
   * Cache + stale-while-revalidate.
   *
   * Important:
   * - Cached data is only a UI optimization.
   * - The caller can use forceRefresh for time-sensitive data.
   * - 304 only refreshes the timestamp when the server explicitly
   *   confirms that the resource is unchanged.
   */
  async fetchWithCache<T>(
    key: string,
    fetchFn: (
      cachedEtag?: string | null
    ) => Promise<{
      data: T;
      etag?: string | null;
      notModified?: boolean;
    }>,
    options: {
      ttlMs: number;
      forceRefresh?: boolean;
      onBackgroundUpdate?: (
        freshData: T
      ) => void;
    }
  ): Promise<T> {
    const {
      ttlMs,
      forceRefresh = false,
      onBackgroundUpdate,
    } = options;

    const cachedEntry =
      this.getEntry<T>(key);

    /*
     * FORCE REFRESH
     *
     * Used by Attendance when the app opens,
     * resumes, or its refresh interval fires.
     */
    if (forceRefresh) {
      return this.dedupe(
        `force:${key}`,
        async () => {
          const res = await fetchFn(
            cachedEntry?.etag
          );

          if (
            res.notModified &&
            cachedEntry
          ) {
            cachedEntry.timestamp =
              Date.now();

            this.scheduleDiskSave();

            return cachedEntry.data;
          }

          this.set(
            key,
            res.data,
            res.etag
          );

          return res.data;
        }
      );
    }

    /*
     * NORMAL CACHE-FIRST BEHAVIOUR
     */
    if (cachedEntry) {
      const isFresh =
        Date.now() -
        cachedEntry.timestamp <
        ttlMs;

      /*
       * Stale data:
       * return it immediately but quietly
       * revalidate in the background.
       */
      if (!isFresh) {
        this.dedupe(
          `revalidate:${key}`,
          async () => {
            try {
              const res =
                await fetchFn(
                  cachedEntry.etag
                );

              if (res.notModified) {
                cachedEntry.timestamp =
                  Date.now();

                this.scheduleDiskSave();
              } else if (
                res.data !== undefined
              ) {
                this.set(
                  key,
                  res.data,
                  res.etag
                );

                if (
                  onBackgroundUpdate
                ) {
                  onBackgroundUpdate(
                    res.data
                  );
                }
              }
            } catch (err) {
              console.log(
                `[DataCache SWR background revalidate error for ${key}]:`,
                err
              );
            }
          }
        );
      }

      return cachedEntry.data;
    }

    /*
     * NO CACHE
     */
    return this.dedupe(
      key,
      async () => {
        const res =
          await fetchFn();

        this.set(
          key,
          res.data,
          res.etag
        );

        return res.data;
      }
    );
  }

  /**
   * Invalidate matching cache entries.
   */
  invalidate(pattern: string): void {
    let modified = false;

    for (
      const key of Array.from(
        this.memoryCache.keys()
      )
    ) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        modified = true;
      }
    }

    if (modified) {
      this.scheduleDiskSave();
    }
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.memoryCache.clear();
    this.scheduleDiskSave();
  }
}

export const dataCache =
  new DataCacheService();