import { createHash } from 'crypto';

/**
 * Tracking parameters to strip from URLs
 */
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'utm_cid',
  // Social media tracking
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  // Analytics
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  // Common tracking
  'ref',
  'source',
  'referrer',
  'origin',
  'tracking_id',
  'campaign_id',
  // Mobile/App
  'mkt_tok',
  'trk',
  'trkCampaign',
  // Others
  'ncid',
  'ocid',
  'icid',
  's_kwcid',
  'ef_id',
];

/**
 * Canonicalize URL for consistent deduplication.
 *
 * Operations:
 * 1. Parse URL and validate
 * 2. Normalize protocol to https
 * 3. Lowercase hostname
 * 4. Remove www. prefix (optional consistency)
 * 5. Remove trailing slashes from path
 * 6. Remove tracking parameters
 * 7. Sort remaining query parameters
 * 8. Remove default ports
 * 9. Remove fragments (anchors)
 *
 * @param url - Raw URL to canonicalize
 * @returns Canonical URL string
 */
export function canonicalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    // Trim whitespace
    let cleanUrl = url.trim();

    // Add protocol if missing
    if (!cleanUrl.match(/^https?:\/\//i)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const parsed = new URL(cleanUrl);

    // 1. Normalize protocol to https
    parsed.protocol = 'https:';

    // 2. Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // 3. Remove www. prefix for consistency
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    // 4. Remove default ports
    if (parsed.port === '443' || parsed.port === '80') {
      parsed.port = '';
    }

    // 5. Remove trailing slashes from path (keep root /)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // 6. Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // 7. Sort remaining query parameters for consistency
    parsed.searchParams.sort();

    // 8. Remove fragments (anchors)
    parsed.hash = '';

    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Generate a stable hash ID from a URL.
 *
 * Uses SHA-256 and returns first 16 characters for reasonable uniqueness.
 * The URL is canonicalized first for consistency.
 *
 * @param url - URL to hash
 * @returns 16-character hex hash
 */
export function hashIdFromUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const canonical = canonicalizeUrl(url);
  const hash = createHash('sha256').update(canonical).digest('hex');

  // Return first 16 characters (64 bits of entropy)
  return hash.slice(0, 16);
}

/**
 * Parse date string from various formats with fallback.
 *
 * Handles:
 * - ISO 8601: 2024-01-15T16:30:00Z
 * - RFC 2822: Mon, 15 Jan 2024 12:00:00 GMT
 * - GDELT format: 20240115T163000Z
 * - Unix timestamps (seconds and milliseconds)
 * - European format: 15.01.2024, 15/01/2024
 * - US format: 01/15/2024, 01-15-2024
 *
 * @param input - Date input (string, Date, or number)
 * @param fallback - Fallback date (default: now)
 * @returns Parsed Date object
 */
export function safeDateParse(
  input: string | Date | number | null | undefined,
  fallback?: Date,
): Date {
  const fallbackDate = fallback ?? new Date();

  // Null/undefined -> fallback
  if (input == null) {
    return fallbackDate;
  }

  // Already a Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? fallbackDate : input;
  }

  // Number -> Unix timestamp
  if (typeof input === 'number') {
    // Detect if seconds or milliseconds
    // If < 10^12, assume seconds; otherwise milliseconds
    const timestamp = input < 1e12 ? input * 1000 : input;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? fallbackDate : date;
  }

  // String parsing
  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (!trimmed) {
      return fallbackDate;
    }

    // Try GDELT format: 20240115T163000Z or 20240115163000
    const gdeltMatch = trimmed.match(
      /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
    );
    if (gdeltMatch) {
      const [, year, month, day, hour, minute, second] = gdeltMatch;
      const date = new Date(
        Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second),
        ),
      );
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try European format: DD.MM.YYYY or DD/MM/YYYY
    const euroMatch = trimmed.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (euroMatch) {
      const [, day, month, year] = euroMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try US format: MM/DD/YYYY or MM-DD-YYYY
    const usMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      // Heuristic: if first number > 12, it's probably DD/MM/YYYY
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      if (monthNum > 12 && dayNum <= 12) {
        // Actually European format
        const date = new Date(parseInt(year), dayNum - 1, monthNum);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } else {
        const date = new Date(parseInt(year), monthNum - 1, dayNum);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try numeric string (Unix timestamp)
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed);
      const timestamp = num < 1e12 ? num * 1000 : num;
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Default: try native Date parser (handles ISO 8601, RFC 2822, etc.)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // All parsing failed -> fallback
  return fallbackDate;
}

/**
 * Clean and normalize title text.
 *
 * Operations:
 * 1. Strip HTML tags
 * 2. Decode HTML entities
 * 3. Normalize whitespace
 * 4. Trim
 *
 * @param title - Raw title string
 * @returns Cleaned title
 */
export function normalizeTitle(title: string): string {
  if (!title || typeof title !== 'string') {
    return '';
  }

  return (
    title
      // Strip HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Remove remaining numeric entities
      .replace(/&#\d+;/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
  );
}

/**
 * Truncate summary text to max length at word boundary.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 2000)
 * @returns Truncated text
 */
export function truncateSummary(
  text: string | null | undefined,
  maxLength = 2000,
): string | undefined {
  if (!text) {
    return undefined;
  }

  const cleaned = normalizeTitle(text);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Truncate at word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
