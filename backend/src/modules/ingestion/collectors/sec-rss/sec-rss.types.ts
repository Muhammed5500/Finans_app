/**
 * SEC RSS Feed Types
 *
 * SEC EDGAR RSS/Atom feed structures
 */

/**
 * Parsed RSS item from SEC feed
 */
export interface SecRssItem {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  guid?: string;
  // Atom-specific fields
  id?: string;
  updated?: string;
  summary?: string;
  category?: string | string[];
}

/**
 * Parsed RSS channel
 */
export interface SecRssChannel {
  title: string;
  link: string;
  description?: string;
  item?: SecRssItem | SecRssItem[];
  // Atom-specific
  entry?: SecRssItem | SecRssItem[];
}

/**
 * Parsed RSS feed
 */
export interface SecRssFeed {
  rss?: {
    channel: SecRssChannel;
  };
  feed?: {
    title?: string;
    entry?: SecRssItem | SecRssItem[];
  };
}

/**
 * SEC Filing types
 */
export type SecFilingType =
  | '8-K'
  | '10-K'
  | '10-Q'
  | '4'
  | 'S-1'
  | 'S-3'
  | '13F'
  | '13D'
  | '13G'
  | 'DEF 14A'
  | '6-K'
  | '20-F'
  | 'OTHER';

/**
 * Extracted filing info
 */
export interface FilingInfo {
  type: SecFilingType;
  companyName?: string;
  cik?: string;
  ticker?: string;
}

/**
 * Collector configuration
 */
export interface SecRssCollectorConfig {
  /** RSS feed URLs */
  feeds: string[];
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** User-Agent header */
  userAgent: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retries per request */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
  /** Rate limit: requests per second */
  rateLimit: number;
}

/**
 * Collection result for a single feed
 */
export interface FeedResult {
  feedUrl: string;
  itemsFound: number;
  itemsNew: number;
  errors: string[];
  lastPubDate?: string;
}
