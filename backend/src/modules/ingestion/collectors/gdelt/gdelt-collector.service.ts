import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsSource } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from '../../../../shared/types';
import { canonicalizeUrl, safeDateParse } from '../../../../shared/utils';
import { extractTickers, extractTags } from '../../../../shared/tagging';
import { TokenBucket } from './token-bucket';
import {
  GdeltArticle,
  GdeltResponse,
  GdeltCollectorConfig,
  QueryResult,
} from './gdelt.types';

/**
 * GdeltCollectorService
 *
 * Collects news from GDELT DOC 2.0 API.
 *
 * Features:
 * - Polls every 3 minutes
 * - Multiple configurable queries (env: GDELT_QUERIES)
 * - Per-query cursor tracking for incremental fetching
 * - Token bucket rate limiting (1 req/sec)
 * - Exponential backoff retries (max 3)
 * - Graceful error handling (no crashes)
 */
@Injectable()
export class GdeltCollectorService implements OnModuleInit {
  private readonly logger = new Logger(GdeltCollectorService.name);

  // GDELT API base URL
  private readonly API_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

  // Rate limiter: 1 request per second
  private readonly rateLimiter: TokenBucket;

  // Configuration
  private config: GdeltCollectorConfig;

  // Is currently running
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize rate limiter: 1 token max, 1 token per second
    this.rateLimiter = new TokenBucket(1, 1);

    // Load configuration
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    this.logger.log(
      `GDELT Collector initialized with ${this.config.queries.length} queries: ${this.config.queries.join(', ')}`,
    );
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): GdeltCollectorConfig {
    const queriesStr = this.configService.get<string>(
      'GDELT_QUERIES',
      'Tesla,Fed,BTC,SP500',
    );
    const queries = queriesStr
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);

    return {
      queries,
      pollingIntervalMs: 3 * 60 * 1000, // 3 minutes
      maxRecords: 100,
      sourceLanguage: 'english',
      rateLimit: 1, // 1 request per second
      maxRetries: 3,
      retryBaseDelayMs: 1000,
    };
  }

  /**
   * Check if collector is enabled
   */
  isEnabled(): boolean {
    return this.configService.get<boolean>('GDELT_ENABLED', true);
  }

  /**
   * Scheduled job: runs every 3 minutes
   */
  @Cron('0 */3 * * * *') // Every 3 minutes
  async scheduledCollect(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.isRunning) {
      this.logger.warn('GDELT collection already in progress, skipping');
      return;
    }

    await this.collect();
  }

  /**
   * Main collection method
   */
  async collect(): Promise<QueryResult[]> {
    if (this.isRunning) {
      this.logger.warn('Collection already in progress');
      return [];
    }

    this.isRunning = true;
    const results: QueryResult[] = [];

    try {
      this.logger.log(
        `Starting GDELT collection for ${this.config.queries.length} queries`,
      );

      for (const query of this.config.queries) {
        try {
          const result = await this.collectQuery(query);
          results.push(result);

          this.logger.log(
            `Query "${query}": found ${result.itemsFound}, new ${result.itemsNew}`,
          );
        } catch (error) {
          // Log error but continue with next query
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Query "${query}" failed: ${errorMsg}`);
          results.push({
            query,
            itemsFound: 0,
            itemsNew: 0,
            errors: [errorMsg],
          });
        }
      }

      const totalFound = results.reduce((sum, r) => sum + r.itemsFound, 0);
      const totalNew = results.reduce((sum, r) => sum + r.itemsNew, 0);
      this.logger.log(
        `GDELT collection complete: ${totalFound} found, ${totalNew} new`,
      );
    } catch (error) {
      this.logger.error('GDELT collection failed', error);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Collect items for a single query
   */
  async collectQuery(query: string): Promise<QueryResult> {
    const result: QueryResult = {
      query,
      itemsFound: 0,
      itemsNew: 0,
      errors: [],
    };

    try {
      // Get cursor for this query
      const cursor = await this.getCursor(query);

      // Build API URL
      const url = this.buildApiUrl(query, cursor?.lastSeenDate);

      // Fetch with rate limiting and retries
      const response = await this.fetchWithRetry(url);

      if (!response.articles || response.articles.length === 0) {
        return result;
      }

      result.itemsFound = response.articles.length;

      // Normalize articles
      const items = response.articles.map((article) =>
        this.normalizeArticle(article, query),
      );

      // Dedupe and save
      const saved = await this.saveItems(items);
      result.itemsNew = saved;

      // Update cursor with latest seen date
      const latestDate = this.getLatestSeenDate(response.articles);
      if (latestDate) {
        result.lastSeenDate = latestDate;
        await this.updateCursor(query, latestDate);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      throw error; // Re-throw to be handled by caller
    }

    return result;
  }

  /**
   * Build GDELT API URL
   */
  private buildApiUrl(query: string, sinceDate?: string): string {
    const params = new URLSearchParams({
      query: query,
      mode: 'ArtList',
      format: 'json',
      maxrecords: String(this.config.maxRecords),
      sort: 'DateDesc',
    });

    // Add source language filter
    if (this.config.sourceLanguage) {
      params.set('sourcelang', this.config.sourceLanguage);
    }

    // Add time filter if we have a cursor
    if (sinceDate) {
      // GDELT uses format: YYYYMMDDHHMMSS
      const gdeltDate = this.toGdeltDateFormat(sinceDate);
      params.set('startdatetime', gdeltDate);
    }

    return `${this.API_BASE}?${params.toString()}`;
  }

  /**
   * Convert ISO date to GDELT format (YYYYMMDDHHMMSS)
   */
  private toGdeltDateFormat(isoDate: string): string {
    const date = new Date(isoDate);
    const pad = (n: number) => String(n).padStart(2, '0');

    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds())
    );
  }

  /**
   * Parse GDELT date format (20240115T163000Z) to ISO
   */
  private parseGdeltDate(gdeltDate: string): Date {
    // Format: 20240115T163000Z
    const match = gdeltDate.match(
      /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(
        Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second),
        ),
      );
    }
    return safeDateParse(gdeltDate);
  }

  /**
   * Fetch with rate limiting and exponential backoff retries
   */
  async fetchWithRetry(url: string): Promise<GdeltResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limiter
        await this.rateLimiter.consume();

        // Fetch
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'FinansBackend/1.0 (news aggregator)',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitMs = retryAfter
              ? parseInt(retryAfter) * 1000
              : this.config.retryBaseDelayMs * Math.pow(2, attempt);
            this.logger.warn(`Rate limited, waiting ${waitMs}ms`);
            await this.sleep(waitMs);
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as GdeltResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Exponential backoff
        const delayMs = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `GDELT fetch attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    // Don't retry on 4xx errors (except 429)
    const message = error.message;
    if (message.includes('HTTP 4') && !message.includes('HTTP 429')) {
      return true;
    }
    return false;
  }

  /**
   * Normalize GDELT article to NormalizedNewsItem
   */
  normalizeArticle(article: GdeltArticle, query: string): NormalizedNewsItem {
    const publishedAt = this.parseGdeltDate(article.seendate);

    return {
      source: NewsSource.GDELT,
      sourceId: article.url, // Use URL as source ID
      title: article.title || '',
      url: canonicalizeUrl(article.url),
      publishedAt,
      language: article.language || 'en',
      raw: {
        gdelt: {
          domain: article.domain,
          sourcecountry: article.sourcecountry,
          socialimage: article.socialimage,
          seendate: article.seendate,
          query,
        },
      },
      discoveredAt: new Date(),
    };
  }

  /**
   * Save items to database (with dedup)
   */
  async saveItems(items: NormalizedNewsItem[]): Promise<number> {
    if (items.length === 0) return 0;

    // Get existing URLs
    const urls = items.map((i) => i.url);
    const existing = await this.prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });
    const existingUrls = new Set(existing.map((e) => e.url));

    // Filter new items
    const newItems = items.filter((i) => !existingUrls.has(i.url));

    if (newItems.length === 0) return 0;

    // Insert new items
    const result = await this.prisma.newsItem.createMany({
      data: newItems.map((item) => ({
        source: item.source,
        sourceId: item.sourceId,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        language: item.language,
        raw: item.raw as any,
      })),
      skipDuplicates: true,
    });

    // Extract and associate tickers/tags for new items
    await this.associateTickersAndTags(newItems);

    return result.count;
  }

  /**
   * Associate tickers and tags with news items
   */
  private async associateTickersAndTags(
    items: NormalizedNewsItem[],
  ): Promise<void> {
    for (const item of items) {
      try {
        const tickers = extractTickers(item.title);
        const tags = extractTags(item.title);

        // Get news item ID
        const newsItem = await this.prisma.newsItem.findUnique({
          where: { url: item.url },
          select: { id: true },
        });

        if (!newsItem) continue;

        // Associate tickers
        for (const symbol of tickers) {
          const ticker = await this.prisma.ticker.findUnique({
            where: { symbol },
            select: { id: true },
          });

          if (ticker) {
            await this.prisma.newsItemTicker.upsert({
              where: {
                newsItemId_tickerId: {
                  newsItemId: newsItem.id,
                  tickerId: ticker.id,
                },
              },
              create: {
                newsItemId: newsItem.id,
                tickerId: ticker.id,
                confidence: 1.0,
              },
              update: {},
            });
          }
        }

        // Associate tags
        for (const tagName of tags) {
          const tag = await this.prisma.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          await this.prisma.newsItemTag.upsert({
            where: {
              newsItemId_tagId: {
                newsItemId: newsItem.id,
                tagId: tag.id,
              },
            },
            create: {
              newsItemId: newsItem.id,
              tagId: tag.id,
            },
            update: {},
          });
        }
      } catch (error) {
        // Log but don't fail - tagging is non-critical
        this.logger.warn(`Failed to tag item ${item.url}: ${error}`);
      }
    }
  }

  /**
   * Get latest seendate from articles
   */
  private getLatestSeenDate(articles: GdeltArticle[]): string | undefined {
    if (articles.length === 0) return undefined;

    let latest: Date | undefined;
    let latestStr: string | undefined;

    for (const article of articles) {
      const date = this.parseGdeltDate(article.seendate);
      if (!latest || date > latest) {
        latest = date;
        latestStr = date.toISOString();
      }
    }

    return latestStr;
  }

  /**
   * Get cursor for a query
   */
  async getCursor(query: string): Promise<{ lastSeenDate?: string } | null> {
    const cursor = await this.prisma.ingestionCursor.findUnique({
      where: {
        source_key: {
          source: NewsSource.GDELT,
          key: `query:${query}`,
        },
      },
    });

    if (!cursor) return null;

    return {
      lastSeenDate: cursor.value,
    };
  }

  /**
   * Update cursor for a query
   */
  async updateCursor(query: string, lastSeenDate: string): Promise<void> {
    await this.prisma.ingestionCursor.upsert({
      where: {
        source_key: {
          source: NewsSource.GDELT,
          key: `query:${query}`,
        },
      },
      create: {
        source: NewsSource.GDELT,
        key: `query:${query}`,
        value: lastSeenDate,
      },
      update: {
        value: lastSeenDate,
      },
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for testing
   */
  async triggerManual(): Promise<QueryResult[]> {
    return this.collect();
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    queries: string[];
    isRunning: boolean;
    rateLimit: { tokens: number; waitTime: number };
  } {
    return {
      enabled: this.isEnabled(),
      queries: this.config.queries,
      isRunning: this.isRunning,
      rateLimit: {
        tokens: this.rateLimiter.getTokens(),
        waitTime: this.rateLimiter.getWaitTime(),
      },
    };
  }
}
