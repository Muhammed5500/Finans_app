import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsSource } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from '../../../../shared/types';
import { canonicalizeUrl } from '../../../../shared/utils';
import { extractTickers, extractTags } from '../../../../shared/tagging';
import {
  GoogleNewsCollectorConfig,
  GoogleNewsRssItem,
  QueryResult,
} from './google-news.types';
import {
  buildGoogleNewsRssUrl,
  parseGoogleNewsRss,
  parseGoogleNewsDate,
  isValidGoogleNewsItem,
  cleanTitle,
  extractSourceInfo,
  detectLanguage,
} from './google-news-parser';

/**
 * Default queries for Google News
 */
const DEFAULT_QUERIES = ['BIST', 'TUPRS', 'BTC', 'SP500'];

/**
 * GoogleNewsRssCollectorService
 *
 * Collects news from Google News RSS feeds.
 *
 * Features:
 * - Feature flag: ENABLE_GOOGLE_NEWS_RSS
 * - Polls every 10 minutes
 * - Configurable queries via GOOGLE_NEWS_QUERIES
 * - RSS parsing with source extraction
 * - Deduplication by canonical URL
 */
@Injectable()
export class GoogleNewsRssCollectorService implements OnModuleInit {
  private readonly logger = new Logger(GoogleNewsRssCollectorService.name);

  private config: GoogleNewsCollectorConfig;
  private isRunning = false;
  private lastRequestTime = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    if (this.config.enabled) {
      this.logger.log(
        `Google News RSS Collector initialized with ${this.config.queries.length} queries: ${this.config.queries.join(', ')}`,
      );
    } else {
      this.logger.log(
        'Google News RSS Collector is disabled (ENABLE_GOOGLE_NEWS_RSS=false)',
      );
    }
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): GoogleNewsCollectorConfig {
    const enabled =
      this.configService.get<string>('ENABLE_GOOGLE_NEWS_RSS', 'false') ===
      'true';

    const queriesStr = this.configService.get<string>(
      'GOOGLE_NEWS_QUERIES',
      '',
    );
    const queries = queriesStr
      ? queriesStr
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean)
      : DEFAULT_QUERIES;

    const hl = this.configService.get<string>('GOOGLE_NEWS_HL', 'en-US');
    const gl = this.configService.get<string>('GOOGLE_NEWS_GL', 'US');
    const ceid = this.configService.get<string>('GOOGLE_NEWS_CEID', 'US:en');

    return {
      enabled,
      queries,
      pollingIntervalMs: 10 * 60 * 1000, // 10 minutes
      timeoutMs: 30000,
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      rateLimitSeconds: 2, // Be polite to Google
      hl,
      gl,
      ceid,
    };
  }

  /**
   * Check if collector is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Scheduled job: runs every 10 minutes
   */
  @Cron('0 */10 * * * *') // Every 10 minutes
  async scheduledCollect(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Google News collection already in progress, skipping');
      return;
    }

    await this.collect();
  }

  /**
   * Main collection method
   */
  async collect(): Promise<QueryResult[]> {
    if (!this.isEnabled()) {
      this.logger.debug('Google News RSS collector is disabled');
      return [];
    }

    if (this.isRunning) {
      this.logger.warn('Collection already in progress');
      return [];
    }

    this.isRunning = true;
    const results: QueryResult[] = [];

    try {
      this.logger.log(
        `Starting Google News collection for ${this.config.queries.length} queries`,
      );

      for (const query of this.config.queries) {
        try {
          const result = await this.collectQuery(query);
          results.push(result);

          this.logger.log(
            `Query "${query}": found ${result.itemsFound}, new ${result.itemsNew}`,
          );
        } catch (error) {
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
        `Google News collection complete: ${totalFound} found, ${totalNew} new`,
      );
    } catch (error) {
      this.logger.error('Google News collection failed', error);
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
      // Build RSS URL
      const url = buildGoogleNewsRssUrl(
        query,
        this.config.hl,
        this.config.gl,
        this.config.ceid,
      );

      // Fetch with rate limiting and retries
      const xml = await this.fetchWithRetry(url);

      // Parse RSS
      const rssItems = parseGoogleNewsRss(xml);

      if (rssItems.length === 0) {
        return result;
      }

      // Filter valid items
      const validItems = rssItems.filter(isValidGoogleNewsItem);
      result.itemsFound = validItems.length;

      // Normalize items
      const items = validItems.map((item) =>
        this.normalizeRssItem(item, query),
      );

      // Dedupe and save
      const saved = await this.saveItems(items);
      result.itemsNew = saved;

      // Update cursor
      const latestDate = this.getLatestPubDate(validItems);
      if (latestDate) {
        result.lastPubDate = latestDate;
        await this.updateCursor(query, latestDate);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      throw error;
    }

    return result;
  }

  /**
   * Fetch RSS with rate limiting and retries
   */
  async fetchWithRetry(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Enforce rate limit
        await this.enforceRateLimit();

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs,
        );

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; FinansTakip/1.0)',
              Accept: 'application/rss+xml, application/xml, text/xml',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 429) {
              const waitMs =
                this.config.retryBaseDelayMs * Math.pow(2, attempt);
              this.logger.warn(`Rate limited, waiting ${waitMs}ms`);
              await this.sleep(waitMs);
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const text = await response.text();
          this.lastRequestTime = Date.now();
          return text;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.name === 'AbortError') {
          lastError = new Error(
            `Request timeout after ${this.config.timeoutMs}ms`,
          );
        }

        // Don't retry on 4xx errors (except 429)
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        const delayMs = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Google News fetch attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Enforce rate limit
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const minInterval = this.config.rateLimitSeconds * 1000;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      await this.sleep(waitTime);
    }
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message;
    if (message.includes('HTTP 4') && !message.includes('HTTP 429')) {
      return true;
    }
    return false;
  }

  /**
   * Normalize RSS item to NormalizedNewsItem
   */
  normalizeRssItem(item: GoogleNewsRssItem, query: string): NormalizedNewsItem {
    const publishedAt = parseGoogleNewsDate(item.pubDate);
    const title = cleanTitle(item.title);
    const sourceInfo = extractSourceInfo(item.description || '');
    const language = detectLanguage(item.link, title);

    return {
      source: NewsSource.GOOGLE_NEWS,
      sourceId: item.guid || item.link,
      title,
      url: canonicalizeUrl(item.link),
      publishedAt,
      language,
      summary: item.description ? cleanTitle(item.description) : undefined,
      raw: {
        googleNews: {
          originalTitle: item.title,
          description: item.description,
          sourceName: item.source || sourceInfo.name,
          originalUrl: sourceInfo.originalUrl,
          query,
          guid: item.guid,
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

    // Insert
    const result = await this.prisma.newsItem.createMany({
      data: newItems.map((item) => ({
        source: item.source,
        sourceId: item.sourceId,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        language: item.language,
        summary: item.summary,
        raw: item.raw as any,
      })),
      skipDuplicates: true,
    });

    // Tag items
    await this.tagItems(newItems);

    return result.count;
  }

  /**
   * Associate tickers and tags with news items
   */
  private async tagItems(items: NormalizedNewsItem[]): Promise<void> {
    for (const item of items) {
      try {
        const tickers = extractTickers(item.title);
        const tags = extractTags(item.title);

        // Get news item
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
                confidence: 0.8, // Lower confidence for Google News
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
        this.logger.warn(`Failed to tag item ${item.url}: ${error}`);
      }
    }
  }

  /**
   * Get latest pubDate from items
   */
  private getLatestPubDate(items: GoogleNewsRssItem[]): string | undefined {
    if (items.length === 0) return undefined;

    let latest: Date | undefined;

    for (const item of items) {
      const date = parseGoogleNewsDate(item.pubDate);
      if (!latest || date > latest) {
        latest = date;
      }
    }

    return latest?.toISOString();
  }

  /**
   * Update cursor for a query
   */
  async updateCursor(query: string, lastPubDate: string): Promise<void> {
    await this.prisma.ingestionCursor.upsert({
      where: {
        source_key: {
          source: NewsSource.GOOGLE_NEWS,
          key: `query:${query}`,
        },
      },
      create: {
        source: NewsSource.GOOGLE_NEWS,
        key: `query:${query}`,
        value: lastPubDate,
      },
      update: {
        value: lastPubDate,
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
   * Manual trigger
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
    config: Partial<GoogleNewsCollectorConfig>;
  } {
    return {
      enabled: this.config.enabled,
      queries: this.config.queries,
      isRunning: this.isRunning,
      config: {
        hl: this.config.hl,
        gl: this.config.gl,
        ceid: this.config.ceid,
        pollingIntervalMs: this.config.pollingIntervalMs,
      },
    };
  }
}
