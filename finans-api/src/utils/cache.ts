/**
 * In-memory TTL cache with metadata for providers.
 *
 * Each entry stores: value, expiresAt (timestamp when it becomes stale),
 * and storedAt (timestamp when it was set). get() returns null if expired
 * unless allowExpired; getEntry() always returns the raw entry when present.
 * No external dependencies.
 */

/** Internal: value + expiration and storage metadata */
interface CacheEntry<T> {
  value: T;
  /** Unix ms when this entry is considered expired; after this, get() returns null unless allowExpired */
  expiresAt: number;
  /** Unix ms when the entry was stored (set-time) */
  storedAt: number;
}

export class TTLCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private cleanupIntervalId?: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60000) {
    // Periodic cleanup of expired entries to avoid unbounded growth
    if (cleanupIntervalMs > 0) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
    }
  }

  /**
   * Get value by key. Returns null if not found or expired.
   * Use { allowExpired: true } to return the value even when past expiresAt.
   */
  get(key: string, options?: { allowExpired?: boolean }): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const expired = Date.now() > entry.expiresAt;
    if (expired && !options?.allowExpired) return null;

    return entry.value;
  }

  /**
   * Get raw entry (value, expiresAt, storedAt) regardless of expiry.
   * Use when you need metadata (e.g. for stale-if-error or debugging).
   */
  getEntry(key: string): { value: T; expiresAt: number; storedAt: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    return {
      value: entry.value,
      expiresAt: entry.expiresAt,
      storedAt: entry.storedAt,
    };
  }

  /**
   * Return value even if expired, within maxStaleMs beyond expiresAt.
   * Useful for stale-if-error: serve stale when fresh fetch fails.
   * Returns { value, stale, storedAt }; stale is true when past expiresAt.
   */
  getWithStale(
    key: string,
    maxStaleMs = 60000
  ): { value: T; stale: boolean; storedAt: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    const stale = now > entry.expiresAt;

    if (stale && now > entry.expiresAt + maxStaleMs) return undefined;

    return {
      value: entry.value,
      stale,
      storedAt: entry.storedAt,
    };
  }

  /**
   * Set key to value with TTL. storedAt = now, expiresAt = now + ttlMs.
   */
  set(key: string, value: T, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      storedAt: now,
    });
  }

  /** Remove one key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Check if key exists and is not expired. */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of entries (including expired). */
  size(): number {
    return this.store.size;
  }

  /**
   * Remove entries that are expired plus a grace period (reduces thrash).
   * Returns count of removed entries.
   */
  cleanup(): number {
    const now = Date.now();
    const graceMs = 60000;
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt + graceMs) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /** Stop cleanup interval and clear store (e.g. on shutdown). */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.store.clear();
  }
}

/**
 * Create a new TTL cache. Pass cleanupIntervalMs (default 60s) for periodic
 * removal of expired entries; use 0 to disable.
 */
export function createCache<T = unknown>(cleanupIntervalMs = 60000): TTLCache<T> {
  return new TTLCache<T>(cleanupIntervalMs);
}
