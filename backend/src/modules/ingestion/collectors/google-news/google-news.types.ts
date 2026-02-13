/**
 * Google News RSS Collector Types
 */

/**
 * Parsed Google News RSS item
 */
export interface GoogleNewsRssItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  source?: string;
  guid?: string;
}

/**
 * Parsed RSS channel
 */
export interface GoogleNewsRssChannel {
  title: string;
  link: string;
  description?: string;
  item?: GoogleNewsRssItem | GoogleNewsRssItem[];
}

/**
 * Parsed RSS feed
 */
export interface GoogleNewsRssFeed {
  rss?: {
    channel: GoogleNewsRssChannel;
  };
}

/**
 * Collector configuration
 */
export interface GoogleNewsCollectorConfig {
  /** Whether the collector is enabled */
  enabled: boolean;
  /** Search queries */
  queries: string[];
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retries per request */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
  /** Rate limit: minimum seconds between requests */
  rateLimitSeconds: number;
  /** Language/region code */
  hl: string;
  /** Country/edition code */
  gl: string;
  /** Content encoding */
  ceid: string;
}

/**
 * Collection result for a single query
 */
export interface QueryResult {
  query: string;
  itemsFound: number;
  itemsNew: number;
  errors: string[];
  lastPubDate?: string;
}

/**
 * Extracted source info from Google News
 */
export interface SourceInfo {
  name: string;
  originalUrl?: string;
}
