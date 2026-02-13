import { KapCacheEntry, ParsedKapItem } from './kap.types';

/**
 * KAP In-Memory Cache
 *
 * Provides strong deduplication for KAP disclosures.
 * Uses both sourceId and URL for matching.
 */
export class KapCache {
  // Cache by sourceId
  private bySourceId: Map<string, KapCacheEntry> = new Map();

  // Cache by URL
  private byUrl: Map<string, KapCacheEntry> = new Map();

  // Maximum cache size (prevent memory bloat)
  private readonly maxSize: number;

  // TTL in milliseconds (default: 24 hours)
  private readonly ttlMs: number;

  constructor(maxSize = 10000, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Check if an item exists in cache
   */
  has(item: ParsedKapItem): boolean {
    // Clean expired entries first
    this.cleanExpired();

    // Check by sourceId
    if (item.sourceId && this.bySourceId.has(item.sourceId)) {
      return true;
    }

    // Check by URL
    if (item.url && this.byUrl.has(this.normalizeUrl(item.url))) {
      return true;
    }

    return false;
  }

  /**
   * Add item to cache
   */
  add(item: ParsedKapItem): void {
    // Ensure we don't exceed max size
    if (this.bySourceId.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: KapCacheEntry = {
      sourceId: item.sourceId,
      url: item.url,
      seenAt: new Date(),
      publishedAt: item.publishedAt,
    };

    // Store by sourceId
    if (item.sourceId) {
      this.bySourceId.set(item.sourceId, entry);
    }

    // Store by URL
    if (item.url) {
      this.byUrl.set(this.normalizeUrl(item.url), entry);
    }
  }

  /**
   * Filter out items already in cache
   */
  filterNew(items: ParsedKapItem[]): {
    newItems: ParsedKapItem[];
    cachedCount: number;
  } {
    const newItems: ParsedKapItem[] = [];
    let cachedCount = 0;

    for (const item of items) {
      if (this.has(item)) {
        cachedCount++;
      } else {
        newItems.push(item);
        this.add(item);
      }
    }

    return { newItems, cachedCount };
  }

  /**
   * Bulk add items to cache (for initial loading from DB)
   */
  addMany(
    items: Array<{ sourceId: string; url: string; publishedAt: Date }>,
  ): void {
    for (const item of items) {
      if (this.bySourceId.size >= this.maxSize) {
        break; // Stop if we're at capacity
      }

      const entry: KapCacheEntry = {
        sourceId: item.sourceId,
        url: item.url,
        seenAt: new Date(),
        publishedAt: item.publishedAt,
      };

      if (item.sourceId) {
        this.bySourceId.set(item.sourceId, entry);
      }
      if (item.url) {
        this.byUrl.set(this.normalizeUrl(item.url), entry);
      }
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.bySourceId.entries()) {
      if (now - entry.seenAt.getTime() > this.ttlMs) {
        this.bySourceId.delete(key);
        cleaned++;
      }
    }

    for (const [key, entry] of this.byUrl.entries()) {
      if (now - entry.seenAt.getTime() > this.ttlMs) {
        this.byUrl.delete(key);
      }
    }

    return cleaned;
  }

  /**
   * Evict oldest entries (when at capacity)
   */
  private evictOldest(): void {
    // Sort by seenAt and remove oldest 10%
    const entries = Array.from(this.bySourceId.entries()).sort(
      (a, b) => a[1].seenAt.getTime() - b[1].seenAt.getTime(),
    );

    const toRemove = Math.ceil(this.maxSize * 0.1);

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [sourceId, entry] = entries[i];
      this.bySourceId.delete(sourceId);
      if (entry.url) {
        this.byUrl.delete(this.normalizeUrl(entry.url));
      }
    }
  }

  /**
   * Normalize URL for consistent lookup
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove tracking parameters
      parsed.searchParams.delete('utm_source');
      parsed.searchParams.delete('utm_medium');
      parsed.searchParams.delete('utm_campaign');
      // Lowercase host
      parsed.hostname = parsed.hostname.toLowerCase();
      return parsed.toString();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    sizeBySourceId: number;
    sizeByUrl: number;
    maxSize: number;
    ttlMs: number;
  } {
    return {
      sizeBySourceId: this.bySourceId.size,
      sizeByUrl: this.byUrl.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.bySourceId.clear();
    this.byUrl.clear();
  }
}
