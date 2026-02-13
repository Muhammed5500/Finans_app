import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from '../../../shared/types';
import { canonicalizeUrl } from '../../../shared/utils';
import { TaggingService } from '../../../shared/tagging';

/**
 * Ingestion statistics
 */
export interface IngestStats {
  /** Number of items successfully inserted */
  inserted: number;
  /** Number of items updated (existing URL) */
  updated: number;
  /** Number of items skipped (validation failed) */
  skipped: number;
  /** Number of tickers attached */
  tickersAttached: number;
  /** Number of tags attached */
  tagsAttached: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Errors encountered (non-fatal) */
  errors: string[];
}

/**
 * Batch configuration
 */
interface BatchConfig {
  /** Number of items per batch for DB operations */
  batchSize: number;
  /** Whether to use transactions */
  useTransactions: boolean;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  useTransactions: true,
};

/**
 * NewsIngestService
 *
 * Handles ingestion of normalized news items into the database.
 *
 * Features:
 * - URL canonicalization for consistent deduplication
 * - Upsert by URL (idempotent)
 * - Automatic ticker and tag extraction/attachment
 * - Race-safe upserts for tickers/tags
 * - Batch processing for performance
 * - Transaction support
 * - Comprehensive statistics
 */
@Injectable()
export class NewsIngestService {
  private readonly logger = new Logger(NewsIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taggingService: TaggingService,
  ) {}

  /**
   * Ingest an array of normalized news items
   *
   * @param items Array of NormalizedNewsItem to ingest
   * @param config Optional batch configuration
   * @returns Ingestion statistics
   */
  async ingest(
    items: NormalizedNewsItem[],
    config: Partial<BatchConfig> = {},
  ): Promise<IngestStats> {
    const startTime = Date.now();
    const cfg = { ...DEFAULT_BATCH_CONFIG, ...config };

    const stats: IngestStats = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      tickersAttached: 0,
      tagsAttached: 0,
      processingTimeMs: 0,
      errors: [],
    };

    if (items.length === 0) {
      stats.processingTimeMs = Date.now() - startTime;
      return stats;
    }

    this.logger.log(`Starting ingestion of ${items.length} items`);

    // Pre-process: canonicalize URLs and validate
    const validItems = this.preprocessItems(items, stats);

    if (validItems.length === 0) {
      stats.processingTimeMs = Date.now() - startTime;
      return stats;
    }

    // Process in batches
    const batches = this.createBatches(validItems, cfg.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.debug(
        `Processing batch ${i + 1}/${batches.length} (${batch.length} items)`,
      );

      try {
        if (cfg.useTransactions) {
          await this.processBatchWithTransaction(batch, stats);
        } else {
          await this.processBatch(batch, stats);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Batch ${i + 1} failed: ${errorMsg}`);
        stats.errors.push(`Batch ${i + 1}: ${errorMsg}`);
        // Continue with next batch
      }
    }

    stats.processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `Ingestion complete: ${stats.inserted} inserted, ${stats.updated} updated, ` +
        `${stats.skipped} skipped, ${stats.tickersAttached} tickers, ${stats.tagsAttached} tags ` +
        `(${stats.processingTimeMs}ms)`,
    );

    return stats;
  }

  /**
   * Pre-process items: canonicalize URLs and validate
   */
  private preprocessItems(
    items: NormalizedNewsItem[],
    stats: IngestStats,
  ): NormalizedNewsItem[] {
    const validItems: NormalizedNewsItem[] = [];
    const seenUrls = new Set<string>();

    for (const item of items) {
      // Canonicalize URL
      const canonicalUrl = canonicalizeUrl(item.url);

      if (!canonicalUrl) {
        stats.skipped++;
        continue;
      }

      // Skip if we've already seen this URL in this batch
      if (seenUrls.has(canonicalUrl)) {
        stats.skipped++;
        continue;
      }

      // Validate required fields
      if (!item.title || !item.source || !item.publishedAt) {
        stats.skipped++;
        continue;
      }

      seenUrls.add(canonicalUrl);
      validItems.push({
        ...item,
        url: canonicalUrl,
      });
    }

    return validItems;
  }

  /**
   * Create batches from items
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch with transaction
   */
  private async processBatchWithTransaction(
    batch: NormalizedNewsItem[],
    stats: IngestStats,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.processBatchInternal(batch, stats, tx);
    });
  }

  /**
   * Process a batch without transaction
   */
  private async processBatch(
    batch: NormalizedNewsItem[],
    stats: IngestStats,
  ): Promise<void> {
    await this.processBatchInternal(batch, stats, this.prisma);
  }

  /**
   * Internal batch processing logic
   */
  private async processBatchInternal(
    batch: NormalizedNewsItem[],
    stats: IngestStats,
    prisma: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    // Get existing items by URL for upsert decision
    const urls = batch.map((item) => item.url);
    const existingItems = await prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { id: true, url: true },
    });
    const existingUrlMap = new Map(
      existingItems.map((item) => [item.url, item.id]),
    );

    // Separate into inserts and updates
    const toInsert: NormalizedNewsItem[] = [];
    const toUpdate: Array<{ id: string; item: NormalizedNewsItem }> = [];

    for (const item of batch) {
      const existingId = existingUrlMap.get(item.url);
      if (existingId) {
        toUpdate.push({ id: existingId, item });
      } else {
        toInsert.push(item);
      }
    }

    // Batch insert new items
    if (toInsert.length > 0) {
      const insertResult = await prisma.newsItem.createMany({
        data: toInsert.map((item) => ({
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
          language: item.language || 'en',
          summary: item.summary,
          raw: item.raw as Prisma.InputJsonValue,
        })),
        skipDuplicates: true, // Extra safety
      });
      stats.inserted += insertResult.count;
    }

    // Update existing items (if needed - update raw data, title changes, etc.)
    for (const { id, item } of toUpdate) {
      await prisma.newsItem.update({
        where: { id },
        data: {
          // Only update fields that might change
          raw: item.raw as Prisma.InputJsonValue,
          // Don't update title/publishedAt to preserve original
        },
      });
      stats.updated++;
    }

    // Get IDs for all items (for tagging)
    const allUrls = batch.map((item) => item.url);
    const allNewsItems = await prisma.newsItem.findMany({
      where: { url: { in: allUrls } },
      select: { id: true, url: true, title: true },
    });
    const newsItemMap = new Map(allNewsItems.map((ni) => [ni.url, ni]));

    // Extract and attach tickers/tags
    await this.attachTickersAndTags(batch, newsItemMap, stats, prisma);
  }

  /**
   * Attach tickers and tags to news items
   * Uses upsert to avoid race conditions
   */
  private async attachTickersAndTags(
    items: NormalizedNewsItem[],
    newsItemMap: Map<string, { id: string; url: string; title: string }>,
    stats: IngestStats,
    prisma: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    // Collect all unique ticker symbols and tag names
    const allTickerSymbols = new Set<string>();
    const allTagNames = new Set<string>();
    const itemExtractions = new Map<
      string,
      { tickers: string[]; tags: string[] }
    >();

    for (const item of items) {
      const extraction = this.taggingService.extractAll(item.title);
      itemExtractions.set(item.url, extraction);

      extraction.tickers.forEach((t) => allTickerSymbols.add(t));
      extraction.tags.forEach((t) => allTagNames.add(t));
    }

    // Pre-fetch existing tickers
    const existingTickers = await prisma.ticker.findMany({
      where: { symbol: { in: Array.from(allTickerSymbols) } },
      select: { id: true, symbol: true },
    });
    const tickerMap = new Map(existingTickers.map((t) => [t.symbol, t.id]));

    // Ensure all tags exist (upsert for race safety)
    const tagMap = new Map<string, string>();
    for (const tagName of allTagNames) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        create: { name: tagName },
        update: {},
        select: { id: true },
      });
      tagMap.set(tagName, tag.id);
    }

    // Attach tickers and tags to news items
    for (const item of items) {
      const newsItem = newsItemMap.get(item.url);
      if (!newsItem) continue;

      const extraction = itemExtractions.get(item.url);
      if (!extraction) continue;

      // Attach tickers (only if ticker exists in DB)
      for (const symbol of extraction.tickers) {
        const tickerId = tickerMap.get(symbol);
        if (!tickerId) continue;

        try {
          await prisma.newsItemTicker.upsert({
            where: {
              newsItemId_tickerId: {
                newsItemId: newsItem.id,
                tickerId: tickerId,
              },
            },
            create: {
              newsItemId: newsItem.id,
              tickerId: tickerId,
              confidence: 1.0,
            },
            update: {},
          });
          stats.tickersAttached++;
        } catch (error) {
          // Ignore duplicate key errors (race condition)
          if (!this.isUniqueConstraintError(error)) {
            throw error;
          }
        }
      }

      // Attach tags
      for (const tagName of extraction.tags) {
        const tagId = tagMap.get(tagName);
        if (!tagId) continue;

        try {
          await prisma.newsItemTag.upsert({
            where: {
              newsItemId_tagId: {
                newsItemId: newsItem.id,
                tagId: tagId,
              },
            },
            create: {
              newsItemId: newsItem.id,
              tagId: tagId,
            },
            update: {},
          });
          stats.tagsAttached++;
        } catch (error) {
          // Ignore duplicate key errors (race condition)
          if (!this.isUniqueConstraintError(error)) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Check if error is a unique constraint violation
   */
  private isUniqueConstraintError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002'; // Unique constraint violation
    }
    return false;
  }

  /**
   * Ingest a single item (convenience method)
   */
  async ingestOne(item: NormalizedNewsItem): Promise<IngestStats> {
    return this.ingest([item], { useTransactions: false });
  }

  /**
   * Bulk upsert news items by URL (optimized for large batches)
   * Returns IDs of all items (existing and new)
   */
  async bulkUpsertByUrl(
    items: NormalizedNewsItem[],
  ): Promise<Map<string, string>> {
    const urlToId = new Map<string, string>();

    if (items.length === 0) return urlToId;

    // Canonicalize and dedupe
    const uniqueItems = new Map<string, NormalizedNewsItem>();
    for (const item of items) {
      const canonicalUrl = canonicalizeUrl(item.url);
      if (canonicalUrl && !uniqueItems.has(canonicalUrl)) {
        uniqueItems.set(canonicalUrl, { ...item, url: canonicalUrl });
      }
    }

    const urls = Array.from(uniqueItems.keys());

    // Get existing items
    const existing = await this.prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { id: true, url: true },
    });

    for (const item of existing) {
      urlToId.set(item.url, item.id);
    }

    // Insert missing items
    const existingUrls = new Set(existing.map((e) => e.url));
    const toInsert = Array.from(uniqueItems.values()).filter(
      (item) => !existingUrls.has(item.url),
    );

    if (toInsert.length > 0) {
      await this.prisma.newsItem.createMany({
        data: toInsert.map((item) => ({
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
          language: item.language || 'en',
          summary: item.summary,
          raw: item.raw as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });

      // Fetch IDs of newly inserted items
      const newlyInserted = await this.prisma.newsItem.findMany({
        where: { url: { in: toInsert.map((i) => i.url) } },
        select: { id: true, url: true },
      });

      for (const item of newlyInserted) {
        urlToId.set(item.url, item.id);
      }
    }

    return urlToId;
  }

  /**
   * Get ingestion statistics for a time range
   */
  async getIngestionStats(
    since: Date,
    until: Date = new Date(),
  ): Promise<{
    totalItems: number;
    bySource: Record<string, number>;
    byLanguage: Record<string, number>;
  }> {
    const items = await this.prisma.newsItem.groupBy({
      by: ['source'],
      where: {
        createdAt: {
          gte: since,
          lte: until,
        },
      },
      _count: true,
    });

    const languages = await this.prisma.newsItem.groupBy({
      by: ['language'],
      where: {
        createdAt: {
          gte: since,
          lte: until,
        },
      },
      _count: true,
    });

    const bySource: Record<string, number> = {};
    let totalItems = 0;
    for (const item of items) {
      bySource[item.source] = item._count;
      totalItems += item._count;
    }

    const byLanguage: Record<string, number> = {};
    for (const item of languages) {
      byLanguage[item.language] = item._count;
    }

    return {
      totalItems,
      bySource,
      byLanguage,
    };
  }
}
