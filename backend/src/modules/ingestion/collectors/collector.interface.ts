import { NewsSource } from '@prisma/client';

/**
 * Raw item structure returned by collectors before normalization
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
  /** Publication date (ISO string or Date) */
  publishedAt: string | Date;
  /** Raw JSON payload for debugging */
  rawJson?: Record<string, unknown>;
}

/**
 * Result of a single collector run
 */
export interface CollectorResult {
  /** Items successfully fetched */
  items: RawNewsItem[];
  /** New cursor for incremental fetch (optional) */
  nextCursor?: Record<string, unknown>;
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Options passed to collector.collect()
 */
export interface CollectorOptions {
  /** Previous cursor for incremental fetch */
  cursor?: Record<string, unknown>;
  /** Maximum items to fetch */
  maxItems?: number;
}

/**
 * Interface that all collectors must implement
 */
export interface ICollector {
  /** Unique source type identifier */
  readonly sourceType: NewsSource;

  /** Human-readable name */
  readonly name: string;

  /** Whether this collector is enabled */
  isEnabled(): boolean;

  /**
   * Fetch items from the source
   * @param options - Fetch options including cursor
   * @returns Collection result with items and optional next cursor
   */
  collect(options?: CollectorOptions): Promise<CollectorResult>;
}
