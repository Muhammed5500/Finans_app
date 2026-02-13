import { NormalizedNewsItem } from '../types';
import { canonicalizeUrl } from './normalize';

/**
 * Deduplicated item result
 */
export interface DedupedItem extends NormalizedNewsItem {
  /** Number of duplicates merged into this item */
  duplicateCount: number;

  /** All source IDs from merged items */
  mergedSourceIds: string[];

  /** All discovery timestamps from merged items */
  mergedDiscoveredAt: Date[];
}

/**
 * Dedupe result
 */
export interface DedupeResult {
  /** Unique items after deduplication */
  unique: DedupedItem[];

  /** Total items processed */
  totalProcessed: number;

  /** Number of duplicates found */
  duplicatesFound: number;

  /** URLs that had duplicates */
  duplicateUrls: string[];
}

/**
 * Deduplicate news items by canonical URL.
 *
 * When duplicates are found:
 * - Keep the item with the earliest publishedAt
 * - Merge raw metadata from all duplicates
 * - Track all sourceIds and discoveredAt timestamps
 *
 * @param items - Array of normalized news items
 * @returns Dedupe result with unique items and statistics
 */
export function dedupeByUrl(items: NormalizedNewsItem[]): DedupeResult {
  if (!items || items.length === 0) {
    return {
      unique: [],
      totalProcessed: 0,
      duplicatesFound: 0,
      duplicateUrls: [],
    };
  }

  // Map canonical URL -> array of items
  const urlMap = new Map<string, NormalizedNewsItem[]>();

  for (const item of items) {
    const canonical = canonicalizeUrl(item.url);

    if (!urlMap.has(canonical)) {
      urlMap.set(canonical, []);
    }
    urlMap.get(canonical)!.push(item);
  }

  const unique: DedupedItem[] = [];
  const duplicateUrls: string[] = [];
  let duplicatesFound = 0;

  for (const [canonicalUrl, itemGroup] of urlMap.entries()) {
    if (itemGroup.length > 1) {
      duplicateUrls.push(canonicalUrl);
      duplicatesFound += itemGroup.length - 1;
    }

    // Sort by publishedAt ascending (earliest first)
    itemGroup.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

    // Keep earliest item as base
    const base = itemGroup[0];

    // Merge metadata from all items
    const merged = mergeItems(base, itemGroup.slice(1));

    unique.push(merged);
  }

  return {
    unique,
    totalProcessed: items.length,
    duplicatesFound,
    duplicateUrls,
  };
}

/**
 * Merge duplicate items into base item.
 *
 * Strategy:
 * - Keep base item's main fields (earliest publishedAt)
 * - Merge raw JSON from all items
 * - Collect all sourceIds
 * - Collect all discoveredAt timestamps
 *
 * @param base - Base item (earliest publishedAt)
 * @param duplicates - Other items with same canonical URL
 * @returns Merged item
 */
function mergeItems(
  base: NormalizedNewsItem,
  duplicates: NormalizedNewsItem[],
): DedupedItem {
  const mergedSourceIds: string[] = [];
  const mergedDiscoveredAt: Date[] = [base.discoveredAt];
  const mergedRaw: Record<string, unknown> = { ...base.raw };

  // Add base sourceId if present
  if (base.sourceId) {
    mergedSourceIds.push(base.sourceId);
  }

  // Merge from duplicates
  for (const dup of duplicates) {
    if (dup.sourceId && !mergedSourceIds.includes(dup.sourceId)) {
      mergedSourceIds.push(dup.sourceId);
    }
    mergedDiscoveredAt.push(dup.discoveredAt);

    // Merge raw JSON (later values don't overwrite earlier ones)
    if (dup.raw) {
      for (const [key, value] of Object.entries(dup.raw)) {
        if (!(key in mergedRaw)) {
          mergedRaw[key] = value;
        } else if (key === '_duplicates') {
          // Special handling for _duplicates array
          const existing = Array.isArray(mergedRaw[key]) ? mergedRaw[key] : [];
          mergedRaw[key] = [...(existing as unknown[]), value];
        }
      }
    }
  }

  // Add duplicate info to raw
  if (duplicates.length > 0) {
    mergedRaw._duplicates = duplicates.map((d) => ({
      sourceId: d.sourceId,
      publishedAt: d.publishedAt.toISOString(),
      discoveredAt: d.discoveredAt.toISOString(),
    }));
  }

  return {
    ...base,
    raw: mergedRaw,
    duplicateCount: duplicates.length,
    mergedSourceIds,
    mergedDiscoveredAt,
  };
}

/**
 * Check if a URL already exists in a set of URLs.
 * The set should contain canonical URLs.
 *
 * @param url - URL to check (will be canonicalized)
 * @param existingCanonicalUrls - Set of existing canonical URLs
 * @returns true if URL already exists
 */
export function urlExists(
  url: string,
  existingCanonicalUrls: Set<string>,
): boolean {
  const canonical = canonicalizeUrl(url);
  return existingCanonicalUrls.has(canonical);
}

/**
 * Create a set of canonical URLs from items.
 *
 * @param items - Items to extract URLs from
 * @returns Set of canonical URLs
 */
export function createUrlSet(items: Array<{ url: string }>): Set<string> {
  const urls = new Set<string>();

  for (const item of items) {
    urls.add(canonicalizeUrl(item.url));
  }

  return urls;
}

/**
 * Filter items to only those with new URLs.
 *
 * @param items - Items to filter
 * @param existingCanonicalUrls - Set of existing canonical URLs
 * @returns Items with new URLs
 */
export function filterNewUrls<T extends { url: string }>(
  items: T[],
  existingCanonicalUrls: Set<string>,
): T[] {
  return items.filter((item) => !urlExists(item.url, existingCanonicalUrls));
}
