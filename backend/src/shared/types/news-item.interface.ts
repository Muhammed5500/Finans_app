import { NewsSource } from '@prisma/client';

/**
 * NormalizedNewsItem
 *
 * Unified structure for news items from all sources.
 * Used after collection and before storage.
 */
export interface NormalizedNewsItem {
  /** News source type */
  source: NewsSource;

  /** External ID from the source (optional) */
  sourceId?: string;

  /** Article title/headline */
  title: string;

  /** Canonical URL (after normalization) */
  url: string;

  /** Publication date */
  publishedAt: Date;

  /** Language code (e.g., "en", "tr") */
  language?: string;

  /** Brief summary or description (optional) */
  summary?: string;

  /** Raw JSON payload from source (for debugging/reprocessing) */
  raw: Record<string, unknown>;

  /** When this item was discovered/fetched */
  discoveredAt: Date;
}

/**
 * RawNewsItem
 *
 * Structure returned by collectors before normalization.
 */
export interface RawNewsItem {
  /** Original URL from source */
  url: string;

  /** Title/headline */
  title: string;

  /** Summary or description */
  summary?: string;

  /** Author name */
  author?: string;

  /** Publication date (various formats) */
  publishedAt: string | Date | number;

  /** Language code */
  language?: string;

  /** External ID from source */
  sourceId?: string;

  /** Raw JSON payload */
  raw?: Record<string, unknown>;
}
