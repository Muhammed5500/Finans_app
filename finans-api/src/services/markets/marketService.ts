/**
 * Market Service - Batched Yahoo Finance fetcher for BIST and US markets
 *
 * Fetches prices for hundreds of symbols using:
 * - Batching: splits symbols into chunks to avoid overwhelming Yahoo
 * - Throttling: enforces delay between batch requests
 * - Caching: 30-second TTL for market-wide scans
 * - Graceful degradation: returns partial results on errors
 */

import { createThrottledLimiter, ThrottledLimiter } from '../../utils/limiter';
import { TTLCache, createCache } from '../../utils/cache';

// yahoo-finance2 ESM dynamic import
let yahooFinanceInstance: any = null;

async function getYf(): Promise<any> {
  if (!yahooFinanceInstance) {
    const module = await (Function('return import("yahoo-finance2")')() as Promise<any>);
    const YahooFinance = module.default;
    yahooFinanceInstance = new YahooFinance();
  }
  return yahooFinanceInstance;
}

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 300;
const CONCURRENCY = 2;
const MARKET_CACHE_TTL_MS = 30_000;  // 30 seconds
const MAX_STALE_MS = 120_000;         // 2 minutes stale grace

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  volume?: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface MarketResponse {
  market: string;
  count: number;
  success: number;
  failed: number;
  quotes: MarketQuote[];
  errors: Array<{ symbol: string; error: string }>;
  fetchedAt: string;
  stale?: boolean;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

class MarketService {
  private readonly limiter: ThrottledLimiter;
  private readonly cache: TTLCache<MarketResponse>;

  constructor() {
    this.limiter = createThrottledLimiter({
      concurrency: CONCURRENCY,
      minDelayMs: BATCH_DELAY_MS,
    });
    this.cache = createCache<MarketResponse>();
  }

  /**
   * Fetch quotes for a full market (BIST or US) via Yahoo Finance
   */
  async fetchMarket(
    symbols: string[],
    market: string,
  ): Promise<MarketResponse> {
    const cacheKey = `market:${market}`;

    // Check fresh cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.fetchBatched(symbols, market);
      this.cache.set(cacheKey, result, MARKET_CACHE_TTL_MS);
      return result;
    } catch (error) {
      // Try stale cache
      const stale = this.cache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        return { ...stale.value, stale: true };
      }
      throw error;
    }
  }

  /**
   * Fetch symbols in batches with throttling
   */
  private async fetchBatched(
    symbols: string[],
    market: string,
  ): Promise<MarketResponse> {
    const yf = await getYf();
    const quotes: MarketQuote[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `[MarketService] Fetching ${market}: ${symbols.length} symbols in ${batches.length} batches`,
    );

    for (const batch of batches) {
      // Transform symbols for Yahoo: BIST needs .IS suffix, US stays as-is
      const yahooSymbols = batch.map((s) =>
        market === 'BIST' ? `${s.toUpperCase()}.IS` : s.toUpperCase(),
      );

      try {
        const results = await this.limiter(async () => {
          // Use quote() for each symbol in the batch with Promise.allSettled
          const promises = yahooSymbols.map(async (yahooSymbol, idx) => {
            try {
              const q = await yf.quote(yahooSymbol, {}, { validateResult: false });
              if (!q || q.regularMarketPrice == null) {
                return { symbol: batch[idx], error: 'No data' };
              }
              return {
                symbol: batch[idx],
                data: q,
              };
            } catch (err: any) {
              return { symbol: batch[idx], error: err.message || 'Unknown error' };
            }
          });
          return Promise.all(promises);
        });

        for (const result of results) {
          if ('data' in result && result.data) {
            const q = result.data;
            quotes.push({
              symbol: result.symbol,
              name: q.shortName || q.longName || result.symbol,
              price: q.regularMarketPrice ?? 0,
              change: q.regularMarketChange ?? 0,
              changePercent: q.regularMarketChangePercent ?? 0,
              currency: q.currency || (market === 'BIST' ? 'TRY' : 'USD'),
              volume: q.regularMarketVolume,
              marketCap: q.marketCap,
              dayHigh: q.regularMarketDayHigh,
              dayLow: q.regularMarketDayLow,
              previousClose: q.regularMarketPreviousClose,
              fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: q.fiftyTwoWeekLow,
            });
          } else if ('error' in result) {
            errors.push({ symbol: result.symbol, error: result.error as string });
          }
        }
      } catch (err: any) {
        // Entire batch failed
        for (const s of batch) {
          errors.push({ symbol: s, error: err.message || 'Batch failed' });
        }
      }
    }

    // Sort by symbol
    quotes.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return {
      market,
      count: symbols.length,
      success: quotes.length,
      failed: errors.length,
      quotes,
      errors,
      fetchedAt: new Date().toISOString(),
    };
  }

  destroy(): void {
    this.cache.destroy();
  }
}

// Singleton
let instance: MarketService | null = null;

export function getMarketService(): MarketService {
  if (!instance) {
    instance = new MarketService();
  }
  return instance;
}
