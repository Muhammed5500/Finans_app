import { Injectable, Logger } from '@nestjs/common';
import { RawNewsItem } from '../collectors/collector.interface';

/**
 * Normalized news item ready for storage
 */
export interface NormalizedNewsItem {
  title: string;
  url: string;
  canonicalUrl: string;
  summary?: string;
  author?: string;
  publishedAt: Date;
  rawJson?: Record<string, unknown>;
}

/**
 * NormalizationService
 *
 * Standardizes raw news items from different sources into a consistent format.
 *
 * Responsibilities:
 * - URL canonicalization (remove tracking params, normalize protocol)
 * - Title cleanup (strip HTML, normalize whitespace)
 * - Date parsing (convert all to UTC)
 * - Summary truncation (max 2000 chars)
 * - Author extraction
 */
@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  /**
   * Maximum summary length
   */
  private readonly MAX_SUMMARY_LENGTH = 2000;

  /**
   * URL parameters to strip for canonicalization
   */
  private readonly STRIP_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'ref',
    'source',
    'fbclid',
    'gclid',
    'mc_eid',
  ];

  /**
   * Normalize a raw news item
   */
  normalize(raw: RawNewsItem): NormalizedNewsItem {
    // TODO: Implement full normalization
    //
    // Steps:
    // 1. Canonicalize URL (see canonicalizeUrl)
    // 2. Clean title (strip HTML, normalize whitespace)
    // 3. Parse and normalize date to UTC
    // 4. Truncate summary if too long
    // 5. Extract/clean author name

    return {
      title: this.cleanTitle(raw.title),
      url: raw.url,
      canonicalUrl: this.canonicalizeUrl(raw.url),
      summary: this.truncateSummary(raw.summary),
      author: raw.author,
      publishedAt: this.parseDate(raw.publishedAt),
      rawJson: raw.rawJson,
    };
  }

  /**
   * Canonicalize URL for consistent deduplication
   */
  canonicalizeUrl(url: string): string {
    // TODO: Implement URL canonicalization
    //
    // Steps:
    // 1. Parse URL
    // 2. Normalize protocol to https
    // 3. Lowercase hostname
    // 4. Remove trailing slashes
    // 5. Remove tracking parameters
    // 6. Sort remaining query params
    // 7. Reconstruct URL

    try {
      const parsed = new URL(url);

      // Remove tracking params
      for (const param of this.STRIP_PARAMS) {
        parsed.searchParams.delete(param);
      }

      // Sort remaining params
      parsed.searchParams.sort();

      // Remove trailing slash from pathname
      if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      return parsed.toString();
    } catch {
      this.logger.warn(`Failed to canonicalize URL: ${url}`);
      return url;
    }
  }

  /**
   * Clean and normalize title
   */
  cleanTitle(title: string): string {
    // TODO: Implement title cleaning
    //
    // Steps:
    // 1. Strip HTML tags
    // 2. Decode HTML entities
    // 3. Normalize whitespace
    // 4. Trim

    return title
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities (simple)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Truncate summary to max length
   */
  truncateSummary(summary?: string): string | undefined {
    if (!summary) return undefined;

    const cleaned = summary
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= this.MAX_SUMMARY_LENGTH) {
      return cleaned;
    }

    // Truncate at word boundary
    const truncated = cleaned.slice(0, this.MAX_SUMMARY_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace) + '...';
  }

  /**
   * Parse date string to Date object (UTC)
   */
  parseDate(date: string | Date): Date {
    if (date instanceof Date) {
      return date;
    }

    // TODO: Handle various date formats
    //
    // Common formats:
    // - ISO 8601: 2024-01-15T16:30:00Z
    // - RFC 2822: Mon, 15 Jan 2024 12:00:00 GMT
    // - GDELT: 20240115T163000Z
    // - Custom: 15.01.2024, 15/01/2024, etc.

    try {
      return new Date(date);
    } catch {
      this.logger.warn(`Failed to parse date: ${date}`);
      return new Date();
    }
  }
}
