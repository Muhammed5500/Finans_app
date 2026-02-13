import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsSource } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from '../../../../shared/types';
import { canonicalizeUrl } from '../../../../shared/utils';
import { extractTickers, extractTags } from '../../../../shared/tagging';
import { TokenBucket } from '../gdelt/token-bucket';
import { SecRssCollectorConfig, SecRssItem, FeedResult } from './sec-rss.types';
import {
  parseRssFeed,
  parseRssDate,
  extractFilingType,
  isValidRssItem,
} from './rss-parser';

/**
 * Default SEC RSS feeds
 */
const DEFAULT_SEC_FEEDS = [
  // Latest filings (all types)
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&owner=include&count=100&output=atom',
  // 8-K filings (current reports)
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&owner=include&count=100&output=atom',
];

/**
 * SecRssCollectorService
 *
 * Collects SEC EDGAR filings from RSS/Atom feeds.
 *
 * Features:
 * - Polls every 15 minutes
 * - Configurable feed list via SEC_RSS_FEEDS env
 * - Proper SEC User-Agent header (required by SEC)
 * - Parses both RSS 2.0 and Atom formats
 * - Extracts filing type from title (8-K, 10-Q, etc.)
 * - Retries with exponential backoff
 * - Deduplication by URL
 */
@Injectable()
export class SecRssCollectorService implements OnModuleInit {
  private readonly logger = new Logger(SecRssCollectorService.name);

  // Rate limiter: 10 requests per second (SEC allows up to 10 req/sec)
  private readonly rateLimiter: TokenBucket;

  // Configuration
  private config: SecRssCollectorConfig;

  // Is currently running
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize rate limiter: 10 tokens max, 10 tokens per second
    this.rateLimiter = new TokenBucket(10, 10);

    // Load configuration
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    this.logger.log(
      `SEC RSS Collector initialized with ${this.config.feeds.length} feeds`,
    );
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): SecRssCollectorConfig {
    const feedsStr = this.configService.get<string>('SEC_RSS_FEEDS', '');
    const feeds = feedsStr
      ? feedsStr
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : DEFAULT_SEC_FEEDS;

    const userAgent = this.configService.get<string>(
      'APP_UA',
      'FinansTakip/1.0 (contact@example.com)',
    );

    return {
      feeds,
      pollingIntervalMs: 15 * 60 * 1000, // 15 minutes
      userAgent,
      timeoutMs: 30000, // 30 seconds
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      rateLimit: 10, // SEC allows 10 req/sec
    };
  }

  /**
   * Check if collector is enabled
   */
  isEnabled(): boolean {
    return this.configService.get<boolean>('SEC_RSS_ENABLED', true);
  }

  /**
   * Scheduled job: runs every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async scheduledCollect(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.isRunning) {
      this.logger.warn('SEC RSS collection already in progress, skipping');
      return;
    }

    await this.collect();
  }

  /**
   * Main collection method
   */
  async collect(): Promise<FeedResult[]> {
    if (this.isRunning) {
      this.logger.warn('Collection already in progress');
      return [];
    }

    this.isRunning = true;
    const results: FeedResult[] = [];

    try {
      this.logger.log(
        `Starting SEC RSS collection for ${this.config.feeds.length} feeds`,
      );

      for (const feedUrl of this.config.feeds) {
        try {
          const result = await this.collectFeed(feedUrl);
          results.push(result);

          this.logger.log(
            `Feed "${this.shortenUrl(feedUrl)}": found ${result.itemsFound}, new ${result.itemsNew}`,
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Feed "${this.shortenUrl(feedUrl)}" failed: ${errorMsg}`,
          );
          results.push({
            feedUrl,
            itemsFound: 0,
            itemsNew: 0,
            errors: [errorMsg],
          });
        }
      }

      const totalFound = results.reduce((sum, r) => sum + r.itemsFound, 0);
      const totalNew = results.reduce((sum, r) => sum + r.itemsNew, 0);
      this.logger.log(
        `SEC RSS collection complete: ${totalFound} found, ${totalNew} new`,
      );
    } catch (error) {
      this.logger.error('SEC RSS collection failed', error);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Collect items from a single feed
   */
  async collectFeed(feedUrl: string): Promise<FeedResult> {
    const result: FeedResult = {
      feedUrl,
      itemsFound: 0,
      itemsNew: 0,
      errors: [],
    };

    try {
      // Fetch feed with rate limiting and retries
      const xml = await this.fetchWithRetry(feedUrl);

      // Parse RSS/Atom XML
      const rssItems = parseRssFeed(xml);

      if (rssItems.length === 0) {
        return result;
      }

      // Filter valid items
      const validItems = rssItems.filter(isValidRssItem);
      result.itemsFound = validItems.length;

      // Normalize items
      const items = validItems.map((item) =>
        this.normalizeRssItem(item, feedUrl),
      );

      // Dedupe and save
      const saved = await this.saveItems(items);
      result.itemsNew = saved;

      // Get latest pubDate for cursor
      const latestDate = this.getLatestPubDate(validItems);
      if (latestDate) {
        result.lastPubDate = latestDate;
        await this.updateCursor(feedUrl, latestDate);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      throw error;
    }

    return result;
  }

  /**
   * Fetch RSS feed with rate limiting and retries
   */
  async fetchWithRetry(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limiter
        await this.rateLimiter.consume();

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs,
        );

        try {
          const response = await fetch(url, {
            headers: {
              // SEC requires descriptive User-Agent
              'User-Agent': this.config.userAgent,
              Accept:
                'application/atom+xml, application/rss+xml, application/xml, text/xml',
              // SEC polite headers
              'Accept-Encoding': 'gzip, deflate',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

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

          return await response.text();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Handle abort (timeout)
        if (lastError.name === 'AbortError') {
          lastError = new Error(
            `Request timeout after ${this.config.timeoutMs}ms`,
          );
        }

        // Don't retry on 4xx errors (except 429)
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Exponential backoff
        const delayMs = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `SEC RSS fetch attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms`,
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
    const message = error.message;
    if (message.includes('HTTP 4') && !message.includes('HTTP 429')) {
      return true;
    }
    return false;
  }

  /**
   * Normalize RSS item to NormalizedNewsItem
   */
  normalizeRssItem(item: SecRssItem, feedUrl: string): NormalizedNewsItem {
    const publishedAt = parseRssDate(item.pubDate);
    const filingInfo = extractFilingType(item.title);

    return {
      source: NewsSource.SEC_RSS,
      sourceId: item.guid || item.id || item.link,
      title: item.title,
      url: canonicalizeUrl(item.link),
      publishedAt,
      language: 'en',
      raw: {
        sec: {
          filingType: filingInfo.type,
          companyName: filingInfo.companyName,
          cik: filingInfo.cik,
          ticker: filingInfo.ticker,
          description: item.description || item.summary,
          category: item.category,
          feedUrl,
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
        // Extract tickers from title and filing info
        const tickers = extractTickers(item.title);

        // Also add ticker from SEC filing info if available
        const secTicker = (item.raw as any)?.sec?.ticker;
        if (secTicker && !tickers.includes(secTicker)) {
          tickers.push(secTicker);
        }

        const tags = extractTags(item.title);

        // Add filing-type specific tags
        const filingType = (item.raw as any)?.sec?.filingType;
        if (filingType && filingType !== 'OTHER') {
          tags.push('sec-filing');
          if (['8-K', '10-K', '10-Q'].includes(filingType)) {
            tags.push('earnings');
          }
          if (['4', '13D', '13G', '13F'].includes(filingType)) {
            tags.push('insider');
          }
          if (['S-1', 'S-3'].includes(filingType)) {
            tags.push('ipo');
          }
        }

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
        this.logger.warn(`Failed to tag item ${item.url}: ${error}`);
      }
    }
  }

  /**
   * Get latest pubDate from items
   */
  private getLatestPubDate(items: SecRssItem[]): string | undefined {
    if (items.length === 0) return undefined;

    let latest: Date | undefined;
    let latestStr: string | undefined;

    for (const item of items) {
      const date = parseRssDate(item.pubDate);
      if (!latest || date > latest) {
        latest = date;
        latestStr = date.toISOString();
      }
    }

    return latestStr;
  }

  /**
   * Get cursor for a feed
   */
  async getCursor(feedUrl: string): Promise<{ lastPubDate?: string } | null> {
    const cursor = await this.prisma.ingestionCursor.findUnique({
      where: {
        source_key: {
          source: NewsSource.SEC_RSS,
          key: `feed:${this.hashUrl(feedUrl)}`,
        },
      },
    });

    if (!cursor) return null;

    return {
      lastPubDate: cursor.value,
    };
  }

  /**
   * Update cursor for a feed
   */
  async updateCursor(feedUrl: string, lastPubDate: string): Promise<void> {
    await this.prisma.ingestionCursor.upsert({
      where: {
        source_key: {
          source: NewsSource.SEC_RSS,
          key: `feed:${this.hashUrl(feedUrl)}`,
        },
      },
      create: {
        source: NewsSource.SEC_RSS,
        key: `feed:${this.hashUrl(feedUrl)}`,
        value: lastPubDate,
      },
      update: {
        value: lastPubDate,
      },
    });
  }

  /**
   * Hash URL for cursor key (to avoid long keys)
   */
  private hashUrl(url: string): string {
    // Simple hash - take last 32 chars of URL or hash
    const simplified = url.replace(/https?:\/\//, '').slice(-32);
    return simplified.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Shorten URL for logging
   */
  private shortenUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname.slice(0, 20)}...`;
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
  async triggerManual(): Promise<FeedResult[]> {
    return this.collect();
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    feeds: string[];
    isRunning: boolean;
    userAgent: string;
  } {
    return {
      enabled: this.isEnabled(),
      feeds: this.config.feeds,
      isRunning: this.isRunning,
      userAgent: this.config.userAgent,
    };
  }
}
