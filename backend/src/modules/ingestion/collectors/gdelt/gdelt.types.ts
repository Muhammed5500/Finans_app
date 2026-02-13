/**
 * GDELT DOC 2.0 API Response Types
 *
 * Documentation: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

/**
 * Single article from GDELT response
 */
export interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // Format: 20240115T163000Z
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

/**
 * GDELT API Response
 */
export interface GdeltResponse {
  articles?: GdeltArticle[];
}

/**
 * Collector configuration
 */
export interface GdeltCollectorConfig {
  /** Queries to run (comma-separated in env) */
  queries: string[];
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Maximum records per query */
  maxRecords: number;
  /** Source language filter */
  sourceLanguage?: string;
  /** Rate limit: requests per second */
  rateLimit: number;
  /** Maximum retries per request */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
}

/**
 * Query cursor for incremental fetching
 */
export interface QueryCursor {
  query: string;
  lastSeenDate?: string; // ISO date string
  lastFetchedAt?: Date;
}

/**
 * Collection result for a single query
 */
export interface QueryResult {
  query: string;
  itemsFound: number;
  itemsNew: number;
  errors: string[];
  lastSeenDate?: string;
}
