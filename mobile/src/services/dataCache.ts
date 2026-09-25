import * as FileSystem from 'expo-file-system/legacy';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  etag?: string | null;
}

export const CACHE_TTL = {
  ATTENDANCE_STATUS: 30 * 1000, // 30 seconds
  DASHBOARD: 30 * 1000, // 30 seconds
  NOTIFICATIONS: 60 * 1000, // 1 minute
  PRODUCTS_STOCK: 5 * 60 * 1000, // 5 minutes
  STOCK_REQUIREMENTS: 60 * 1000, // 1 minute
  CUSTOMERS: 10 * 60 * 1000, // 10 minutes
  CATALOGUES: 15 * 60 * 1000, // 15 minutes
  OFFICE_CONFIG: 60 * 60 * 1000, // 1 hour
  EMPLOYEES: 15 * 60 * 1000, // 15 minutes
  CALENDAR: 10 * 60 * 1000, // 10 minutes
} as const;

class DataCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<any>>();
  private initialized = false;
  private saveDebounceTimer: any = null;

  private getCacheFilePath(): string {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    return `${baseDir}ecdial_app_cache_v1.json`;
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
              if (val && typeof val === 'object' && (val as any).data !== undefined) {
                this.memoryCache.set(key, val as CacheEntry);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[DataCache] Init from disk warning:', err);
    }
  }

  /**
   * Debounced save of memory cache to persistent disk.
   */
  private scheduleDiskSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      try {
        const filePath = this.getCacheFilePath();
        const serializable: Record<string, CacheEntry> = {};
        for (const [k, v] of this.memoryCache.entries()) {
          // Exclude huge transient data if any
          serializable[k] = v;
        }
        await FileSystem.writeAsStringAsync(filePath, JSON.stringify(serializable));
      } catch (err) {
        console.warn('[DataCache] Disk write warning:', err);
      }
    }, 1500);
  }

  /**
   * Synchronous 0ms read from memory cache.
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    return entry.data as T;
  }

  /**
   * Reads raw cache entry with timestamp and etag.
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    return entry as CacheEntry<T>;
  }

  /**
   * Saves or updates data in cache with current timestamp.
   */
  set<T>(key: string, data: T, etag?: string | null): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      etag: etag || null,
    });
    this.scheduleDiskSave();
  }

  /**
   * Checks whether cached key is still within TTL freshness.
   */
  isFresh(key: string, ttlMs: number): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < ttlMs;
  }

  /**
   * In-flight request deduplication.
   * If an identical request is already running, reuses the existing Promise.
   */
  dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = requestFn()
      .finally(() => {
        this.inFlightRequests.delete(key);
      });

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Stale-While-Revalidate (SWR) fetching engine:
   * 1. Returns cached data immediately if available (0ms, no spinner).
   * 2. Checks if data is stale. If stale, quietly fires background network revalidation.
   * 3. If server returns 304 (notModified), bumps cache timestamp.
   * 4. If server returns fresh data, updates cache and invokes onBackgroundUpdate callback.
   * 5. If no cache exists, fetches from network and caches.
   */
  async fetchWithCache<T>(
    key: string,
    fetchFn: (cachedEtag?: string | null) => Promise<{ data: T; etag?: string | null; notModified?: boolean }>,
    options: {
      ttlMs: number;
      forceRefresh?: boolean;
      onBackgroundUpdate?: (freshData: T) => void;
    }
  ): Promise<T> {
    const { ttlMs, forceRefresh = false, onBackgroundUpdate } = options;
    const cachedEntry = this.getEntry<T>(key);

    if (cachedEntry && !forceRefresh) {
      const isFresh = Date.now() - cachedEntry.timestamp < ttlMs;

      // If stale, revalidate in background quietly
      if (!isFresh) {
        this.dedupe(`revalidate:${key}`, async () => {
          try {
            const res = await fetchFn(cachedEntry.etag);
            if (res.notModified) {
              // Server says data hasn't changed (304) -> refresh timestamp
              cachedEntry.timestamp = Date.now();
              this.scheduleDiskSave();
            } else if (res.data !== undefined) {
              this.set(key, res.data, res.etag);
              if (onBackgroundUpdate) {
                onBackgroundUpdate(res.data);
              }
            }
          } catch (err) {
            // Background revalidation error is non-fatal: retain cached data
            console.log(`[DataCache SWR background revalidate error for ${key}]:`, err);
          }
        });
      }

      // Return cached data immediately
      return cachedEntry.data;
    }

    // No cached data exists OR forceRefresh requested
    return this.dedupe(key, async () => {
      const res = await fetchFn(cachedEntry?.etag);
      if (res.notModified && cachedEntry) {
        cachedEntry.timestamp = Date.now();
        this.scheduleDiskSave();
        return cachedEntry.data;
      }

      this.set(key, res.data, res.etag);
      return res.data;
    });
  }

  /**
   * Invalidate matching cache entries after mutation (create, edit, delete).
   */
  invalidate(pattern: string): void {
    let modified = false;
    for (const key of Array.from(this.memoryCache.keys())) {
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

export const dataCache = new DataCacheService();
