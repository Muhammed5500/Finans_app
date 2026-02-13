/**
 * KAP (Kamuyu Aydınlatma Platformu) Types
 *
 * Turkish Public Disclosure Platform data structures
 */

/**
 * Raw KAP disclosure item (from JSON response)
 */
export interface KapDisclosure {
  /** Disclosure ID */
  disclosureId?: string | number;
  /** Alternative ID fields */
  id?: string | number;
  bildirrimId?: string | number;

  /** Company/Stock code */
  stockCode?: string;
  hisseKodu?: string;

  /** Company name */
  companyName?: string;
  sirketAdi?: string;

  /** Disclosure title */
  title?: string;
  baslik?: string;
  disclosureTitle?: string;

  /** Disclosure type */
  disclosureType?: string;
  bildirimTipi?: string;

  /** Published date/time */
  publishDate?: string;
  yayinTarihi?: string;
  disclosureDate?: string;

  /** URL or path to disclosure */
  url?: string;
  link?: string;
  pdfUrl?: string;

  /** Summary/content */
  summary?: string;
  ozet?: string;
  content?: string;

  /** Any other fields */
  [key: string]: unknown;
}

/**
 * KAP API response wrapper
 */
export interface KapApiResponse {
  /** Success indicator */
  success?: boolean;
  basarili?: boolean;

  /** Data array */
  data?: KapDisclosure[];
  bildirimler?: KapDisclosure[];
  disclosures?: KapDisclosure[];
  items?: KapDisclosure[];

  /** Total count */
  totalCount?: number;
  toplamSayfa?: number;

  /** Error message */
  error?: string;
  hata?: string;

  /** Raw response for unknown formats */
  [key: string]: unknown;
}

/**
 * Parsed disclosure item (normalized)
 */
export interface ParsedKapItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: Date;
  stockCode?: string;
  companyName?: string;
  disclosureType?: string;
  summary?: string;
  raw: Record<string, unknown>;
}

/**
 * Collector configuration
 */
export interface KapCollectorConfig {
  /** Base URL for KAP */
  baseUrl: string;
  /** Query path/endpoint */
  queryPath: string;
  /** HTTP method */
  method: 'GET' | 'POST';
  /** Request headers */
  headers: Record<string, string>;
  /** Request body for POST (JSON string or object) */
  body?: string | Record<string, unknown>;
  /** Query parameters for GET */
  queryParams?: Record<string, string>;
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Rate limit: minimum seconds between requests */
  rateLimitSeconds: number;
  /** Maximum retries per request */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
  /** Response type expected */
  responseType: 'json' | 'html' | 'auto';
  /** Whether collector is enabled */
  enabled: boolean;
}

/**
 * Collection result
 */
export interface KapCollectionResult {
  itemsFound: number;
  itemsNew: number;
  itemsCached: number;
  errors: string[];
  lastPublishedAt?: string;
}

/**
 * Cache entry for deduplication
 */
export interface KapCacheEntry {
  sourceId: string;
  url: string;
  seenAt: Date;
  publishedAt: Date;
}
