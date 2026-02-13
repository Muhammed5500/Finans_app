import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from './normalization.service';

/**
 * DedupService
 *
 * Handles deduplication of news items using URL uniqueness.
 *
 * The URL field in NewsItem is unique, so duplicate URLs
 * will be rejected at the database level.
 *
 * This service provides pre-check methods to avoid
 * unnecessary database writes.
 */
@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a URL already exists
   */
  async exists(url: string): Promise<boolean> {
    const existing = await this.prisma.newsItem.findUnique({
      where: { url },
      select: { id: true },
    });

    return existing !== null;
  }

  /**
   * Check multiple URLs at once (batch operation)
   */
  async existsBatch(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) {
      return new Set();
    }

    const existing = await this.prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });

    return new Set(existing.map((item) => item.url));
  }

  /**
   * Filter out items that already exist
   */
  async filterNew(items: NormalizedNewsItem[]): Promise<NormalizedNewsItem[]> {
    if (items.length === 0) {
      return [];
    }

    const urls = items.map((i) => i.url);
    const existingUrls = await this.existsBatch(urls);

    const newItems = items.filter((i) => !existingUrls.has(i.url));

    this.logger.debug(
      `Dedup: ${items.length} items -> ${newItems.length} new, ${existingUrls.size} duplicates`,
    );

    return newItems;
  }

  /**
   * Canonicalize URL for consistent deduplication
   *
   * Note: This method is provided for compatibility but
   * URL canonicalization is now handled in NormalizationService.
   */
  canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove common tracking params
      const trackingParams = [
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

      for (const param of trackingParams) {
        parsed.searchParams.delete(param);
      }

      // Sort remaining params for consistency
      parsed.searchParams.sort();

      // Remove trailing slash
      if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      return parsed.toString();
    } catch {
      this.logger.warn(`Failed to canonicalize URL: ${url}`);
      return url;
    }
  }
}
