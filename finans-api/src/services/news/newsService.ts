import RssParser from 'rss-parser';
import crypto from 'crypto';
import { NewsItem, NewsCategory, NewsCategoryResult, RssSourceConfig } from './newsTypes';
import { getSourcesForCategory } from './newsSources';
import { scoreSentiment } from './newsSentiment';
import { deduplicateNews } from './newsDedup';

// ─── Cache Entry ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: NewsCategoryResult;
  fetchedAt: number;
  expireAt: number;
  staleAt: number; // stale-if-error window
}

// ─── News Service ────────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000;      // 5 minutes
const STALE_TTL = 10 * 60 * 1000;     // 10 minutes stale-if-error
const FETCH_TIMEOUT = 10_000;          // 10s per source
const MAX_SUMMARY_LEN = 300;

class NewsService {
  private parser: RssParser;
  private cache: Map<string, CacheEntry> = new Map();
  private inFlight: Map<string, Promise<NewsCategoryResult>> = new Map();

  constructor() {
    this.parser = new RssParser({
      timeout: FETCH_TIMEOUT,
      headers: {
        'User-Agent': 'KamilFinance/1.0 RSS Reader',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      customFields: {
        item: [
          ['media:content', { keepArray: false }],
          ['media:thumbnail', { keepArray: false }],
        ],
      },
    });
  }

  // ── Generate deterministic ID ──────────────────────────────────────────
  private makeId(source: string, url: string): string {
    return crypto.createHash('md5').update(`${source}:${url}`).digest('hex').slice(0, 12);
  }

  // ── Strip HTML tags and decode entities ────────────────────────────────
  private cleanText(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_SUMMARY_LEN);
  }

  // ── Fetch a single RSS source ──────────────────────────────────────────
  private async fetchSource(config: RssSourceConfig): Promise<NewsItem[]> {
    try {
      const feed = await this.parser.parseURL(config.feedUrl);
      const items: NewsItem[] = [];

      for (const entry of feed.items || []) {
        const title = (entry.title || '').trim();
        if (!title) continue;

        const url = entry.link || '';
        const summary = this.cleanText(entry.contentSnippet || entry.content || entry.summary || '');
        const imageUrl = config.imageExtractor(entry);
        const publishedAt = entry.isoDate || entry.pubDate || new Date().toISOString();
        const sentiment = scoreSentiment(title, summary);

        items.push({
          id: this.makeId(config.id, url),
          title,
          url,
          source: config.id,
          sourceDisplayName: config.displayName,
          publishedAt,
          summary,
          imageUrl: imageUrl || null,
          category: config.category,
          sentiment,
          language: config.language,
        });
      }

      return items;
    } catch (err) {
      console.error(`[NewsService] Failed to fetch ${config.id}:`, (err as Error).message);
      return [];
    }
  }

  // ── Get news by category ───────────────────────────────────────────────
  async getNewsByCategory(category: NewsCategory, limit: number = 20): Promise<NewsCategoryResult> {
    const cacheKey = category;
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && now < cached.expireAt) {
      return { ...cached.result, cached: true };
    }

    // Prevent duplicate concurrent fetches
    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const fetchPromise = this.doFetch(category, limit, cached);
    this.inFlight.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async doFetch(
    category: NewsCategory,
    limit: number,
    staleEntry?: CacheEntry,
  ): Promise<NewsCategoryResult> {
    const sources = getSourcesForCategory(category);
    const now = Date.now();

    try {
      // Fetch all sources in parallel
      const results = await Promise.allSettled(
        sources.map(s => this.fetchSource(s)),
      );

      let allItems: NewsItem[] = [];
      const activeSources: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value.length > 0) {
          allItems.push(...r.value);
          activeSources.push(sources[i].displayName);
        }
      }

      // Sort by date (newest first)
      allItems.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );

      // Deduplicate
      allItems = deduplicateNews(allItems);

      // Apply limit
      allItems = allItems.slice(0, limit);

      const result: NewsCategoryResult = {
        category,
        count: allItems.length,
        items: allItems,
        sources: activeSources,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };

      // Store in cache
      this.cache.set(category, {
        result,
        fetchedAt: now,
        expireAt: now + CACHE_TTL,
        staleAt: now + STALE_TTL,
      });

      return result;
    } catch (err) {
      console.error(`[NewsService] Category fetch failed for ${category}:`, err);
      // Stale-if-error: serve old data
      if (staleEntry && Date.now() < staleEntry.staleAt) {
        return { ...staleEntry.result, cached: true };
      }
      return {
        category,
        count: 0,
        items: [],
        sources: [],
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    }
  }

  // ── Get article by ID (search cache) ───────────────────────────────────
  getArticleById(id: string): NewsItem | null {
    for (const entry of this.cache.values()) {
      const found = entry.result.items.find(item => item.id === id);
      if (found) return found;
    }
    return null;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let instance: NewsService | null = null;

export function getNewsService(): NewsService {
  if (!instance) instance = new NewsService();
  return instance;
}
