import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsSource } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NormalizedNewsItem } from '../../../../shared/types';
import { canonicalizeUrl } from '../../../../shared/utils';
import { extractTickers, extractTags } from '../../../../shared/tagging';
import { KapClient } from './kap-client';
import { KapCache } from './kap-cache';
import { parseKapResponse, isValidKapItem } from './kap-parser';
import {
  KapCollectorConfig,
  KapCollectionResult,
  ParsedKapItem,
} from './kap.types';

/**
 * Default KAP configuration
 * Note: The actual endpoint needs to be discovered from browser network inspection
 */
const DEFAULT_CONFIG: KapCollectorConfig = {
  baseUrl: 'https://www.kap.org.tr',
  queryPath: '/tr/api/bildirim', // Placeholder - see docs/kap.md
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://www.kap.org.tr',
    Referer: 'https://www.kap.org.tr/tr/bildirim-sorgu',
  },
  body: {}, // Will be configured based on discovered endpoint
  pollingIntervalMs: 3 * 60 * 1000, // 3 minutes
  timeoutMs: 30000,
  rateLimitSeconds: 5, // Max 1 request per 5 seconds
  maxRetries: 3,
  retryBaseDelayMs: 2000,
  responseType: 'auto',
  enabled: true,
};

/**
 * KapCollectorService
 *
 * Collects disclosures from KAP (Kamuyu Aydınlatma Platformu).
 *
 * Features:
 * - Configuration-driven endpoints (no hardcoded API paths)
 * - Polls every 3 minutes
 * - Hard rate limit: max 1 request / 5 seconds
 * - Supports both JSON and HTML responses
 * - Strong in-memory caching for deduplication
 * - Graceful error handling (no crashes)
 */
@Injectable()
export class KapCollectorService implements OnModuleInit {
  private readonly logger = new Logger(KapCollectorService.name);

  private client: KapClient;
  private cache: KapCache;
  private config: KapCollectorConfig;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = this.loadConfig();
    this.client = new KapClient(this.config);
    this.cache = new KapCache(10000, 24 * 60 * 60 * 1000); // 10k items, 24h TTL
  }

  async onModuleInit() {
    // Load existing KAP items into cache for deduplication
    await this.loadCacheFromDb();

    this.logger.log(
      `KAP Collector initialized. Base URL: ${this.config.baseUrl}, ` +
        `Path: ${this.config.queryPath || '(not configured)'}, ` +
        `Enabled: ${this.config.enabled}`,
    );

    if (!this.config.queryPath) {
      this.logger.warn(
        'KAP_QUERY_PATH not configured. See docs/kap.md for setup instructions.',
      );
    }
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): KapCollectorConfig {
    const enabled = this.configService.get<boolean>('KAP_ENABLED', true);
    const baseUrl = this.configService.get<string>(
      'KAP_BASE_URL',
      DEFAULT_CONFIG.baseUrl,
    );
    const queryPath = this.configService.get<string>('KAP_QUERY_PATH', '');
    const method = this.configService.get<string>('KAP_METHOD', 'POST') as
      | 'GET'
      | 'POST';

    // Parse headers from env (JSON string)
    let headers = { ...DEFAULT_CONFIG.headers };
    const headersJson = this.configService.get<string>('KAP_HEADERS', '');
    if (headersJson) {
      try {
        headers = { ...headers, ...JSON.parse(headersJson) };
      } catch {
        this.logger.warn('Failed to parse KAP_HEADERS, using defaults');
      }
    }

    // Parse body from env (JSON string)
    let body: string | Record<string, unknown> = {};
    const bodyJson = this.configService.get<string>('KAP_BODY', '');
    if (bodyJson) {
      try {
        body = JSON.parse(bodyJson);
      } catch {
        this.logger.warn('Failed to parse KAP_BODY, using empty object');
      }
    }

    // Parse query params from env (JSON string)
    let queryParams: Record<string, string> | undefined;
    const paramsJson = this.configService.get<string>('KAP_QUERY_PARAMS', '');
    if (paramsJson) {
      try {
        queryParams = JSON.parse(paramsJson);
      } catch {
        this.logger.warn('Failed to parse KAP_QUERY_PARAMS');
      }
    }

    const responseType = this.configService.get<string>(
      'KAP_RESPONSE_TYPE',
      'auto',
    ) as 'json' | 'html' | 'auto';

    return {
      ...DEFAULT_CONFIG,
      enabled,
      baseUrl,
      queryPath,
      method,
      headers,
      body,
      queryParams,
      responseType,
    };
  }

  /**
   * Load existing KAP items into cache from database
   */
  private async loadCacheFromDb(): Promise<void> {
    try {
      const recentItems = await this.prisma.newsItem.findMany({
        where: {
          source: NewsSource.KAP,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          sourceId: true,
          url: true,
          publishedAt: true,
        },
        take: 5000,
      });

      const cacheItems = recentItems.map((item) => ({
        sourceId: item.sourceId || item.url,
        url: item.url,
        publishedAt: item.publishedAt,
      }));

      this.cache.addMany(cacheItems);

      this.logger.log(`Loaded ${cacheItems.length} items into KAP cache`);
    } catch (error) {
      this.logger.warn(`Failed to load cache from DB: ${error}`);
    }
  }

  /**
   * Check if collector is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && Boolean(this.config.queryPath);
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
      this.logger.warn('KAP collection already in progress, skipping');
      return;
    }

    await this.collect();
  }

  /**
   * Main collection method
   */
  async collect(): Promise<KapCollectionResult> {
    const result: KapCollectionResult = {
      itemsFound: 0,
      itemsNew: 0,
      itemsCached: 0,
      errors: [],
    };

    if (!this.isEnabled()) {
      this.logger.debug('KAP collector not enabled or not configured');
      return result;
    }

    if (this.isRunning) {
      this.logger.warn('Collection already in progress');
      return result;
    }

    this.isRunning = true;

    try {
      this.logger.log('Starting KAP collection');

      // Fetch data
      const response = await this.client.fetchWithRetry();

      // Parse response
      const parsedItems = parseKapResponse(response, this.config.baseUrl);

      // Filter valid items
      const validItems = parsedItems.filter(isValidKapItem);
      result.itemsFound = validItems.length;

      // Filter out cached items (deduplication)
      const { newItems, cachedCount } = this.cache.filterNew(validItems);
      result.itemsCached = cachedCount;

      if (newItems.length === 0) {
        this.logger.log(
          `KAP collection: ${result.itemsFound} found, all cached`,
        );
        return result;
      }

      // Normalize items
      const normalizedItems = newItems.map((item) => this.normalizeItem(item));

      // Save to database
      const saved = await this.saveItems(normalizedItems);
      result.itemsNew = saved;

      // Update cursor
      const latestDate = this.getLatestPublishedAt(newItems);
      if (latestDate) {
        result.lastPublishedAt = latestDate;
        await this.updateCursor(latestDate);
      }

      this.logger.log(
        `KAP collection complete: ${result.itemsFound} found, ` +
          `${result.itemsNew} new, ${result.itemsCached} cached`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      this.logger.error(`KAP collection failed: ${errorMsg}`);
      // Don't rethrow - graceful failure
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Normalize parsed item to NormalizedNewsItem
   */
  normalizeItem(item: ParsedKapItem): NormalizedNewsItem {
    return {
      source: NewsSource.KAP,
      sourceId: item.sourceId,
      title: item.title,
      url: canonicalizeUrl(item.url),
      publishedAt: item.publishedAt,
      language: 'tr',
      summary: item.summary,
      raw: {
        kap: {
          ...item.raw,
          stockCode: item.stockCode,
          companyName: item.companyName,
          disclosureType: item.disclosureType,
        },
      },
      discoveredAt: new Date(),
    };
  }

  /**
   * Save items to database
   */
  async saveItems(items: NormalizedNewsItem[]): Promise<number> {
    if (items.length === 0) return 0;

    // Get existing URLs for double-check
    const urls = items.map((i) => i.url);
    const existing = await this.prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });
    const existingUrls = new Set(existing.map((e) => e.url));

    // Filter truly new items
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
        // Extract from title
        const tickers = extractTickers(item.title);
        const tags = extractTags(item.title);

        // Add KAP-specific tags
        tags.push('kap');
        tags.push('turkey');

        // Add stock code as ticker if present
        const stockCode = (item.raw as any)?.kap?.stockCode;
        if (stockCode && !tickers.includes(stockCode)) {
          tickers.push(stockCode);
        }

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
                confidence: 1.0,
              },
              update: {},
            });
          }
        }

        // Associate tags
        for (const tagName of [...new Set(tags)]) {
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
        this.logger.warn(`Failed to tag KAP item ${item.url}: ${error}`);
      }
    }
  }

  /**
   * Get latest published date from items
   */
  private getLatestPublishedAt(items: ParsedKapItem[]): string | undefined {
    if (items.length === 0) return undefined;

    let latest: Date | undefined;

    for (const item of items) {
      if (!latest || item.publishedAt > latest) {
        latest = item.publishedAt;
      }
    }

    return latest?.toISOString();
  }

  /**
   * Update cursor
   */
  async updateCursor(lastPublishedAt: string): Promise<void> {
    await this.prisma.ingestionCursor.upsert({
      where: {
        source_key: {
          source: NewsSource.KAP,
          key: 'lastPublishedAt',
        },
      },
      create: {
        source: NewsSource.KAP,
        key: 'lastPublishedAt',
        value: lastPublishedAt,
      },
      update: {
        value: lastPublishedAt,
      },
    });
  }

  /**
   * Manual trigger
   */
  async triggerManual(): Promise<KapCollectionResult> {
    return this.collect();
  }

  /**
   * Get collector status
   */
  getStatus(): {
    enabled: boolean;
    configured: boolean;
    isRunning: boolean;
    config: Partial<KapCollectorConfig>;
    cache: ReturnType<KapCache['getStats']>;
  } {
    return {
      enabled: this.config.enabled,
      configured: Boolean(this.config.queryPath),
      isRunning: this.isRunning,
      config: {
        baseUrl: this.config.baseUrl,
        queryPath: this.config.queryPath,
        method: this.config.method,
        responseType: this.config.responseType,
      },
      cache: this.cache.getStats(),
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<KapCollectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.client.updateConfig(this.config);
    this.logger.log('KAP collector configuration updated');
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
