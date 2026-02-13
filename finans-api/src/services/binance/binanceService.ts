import { TTLCache, createCache } from '../../utils/cache';
import { createLimiter, Limiter } from '../../utils/limiter';
import { BinanceClient, createBinanceClient } from './binanceClient';
import { Ticker24hr, Kline, BinanceClientConfig } from './types';
import {
  getMockPrice,
  getMockPrices,
  getMock24hr,
  getMockKlines,
  hasMockData,
} from './mockData';

// --- Cache TTLs ---
const PRICE_CACHE_TTL_MS = 5000;      // 5 seconds
const TICKER_24HR_CACHE_TTL_MS = 15000; // 15 seconds
const KLINES_CACHE_TTL_MS = 60000;    // 60 seconds

// Max stale age for stale-if-error (60 seconds beyond expiry)
const MAX_STALE_MS = 60000;

// Concurrency limit for parallel requests
const FETCH_CONCURRENCY = 5;

// Enable/disable mock fallback via environment
const USE_MOCK_FALLBACK = process.env.DISABLE_MOCK_FALLBACK !== 'true';

// --- Response types ---

export interface PriceResponse {
  symbol: string;
  price: string;
  source: 'binance' | 'mock';
  stale?: boolean;
  mock?: boolean;
  fetchedAt: string;
}

export interface Ticker24hrResponse {
  symbol: string;
  data: Ticker24hr;
  source: 'binance' | 'mock';
  stale?: boolean;
  mock?: boolean;
  fetchedAt: string;
}

export interface KlinesResponse {
  symbol: string;
  interval: string;
  limit: number | undefined;
  data: Kline[];
  source: 'binance' | 'mock';
  stale?: boolean;
  mock?: boolean;
  fetchedAt: string;
}

// --- Internal cache value types ---

interface CachedPrice {
  symbol: string;
  price: string;
  fetchedAt: string;
  mock?: boolean;
}

interface CachedTicker24hr {
  symbol: string;
  data: Ticker24hr;
  fetchedAt: string;
  mock?: boolean;
}

interface CachedKlines {
  symbol: string;
  interval: string;
  limit: number | undefined;
  data: Kline[];
  fetchedAt: string;
  mock?: boolean;
}

// --- Service class ---

export class BinanceService {
  private readonly client: BinanceClient;
  private readonly priceCache: TTLCache<CachedPrice>;
  private readonly ticker24hrCache: TTLCache<CachedTicker24hr>;
  private readonly klinesCache: TTLCache<CachedKlines>;

  // In-flight registry for request coalescing
  private readonly inFlight: Map<string, Promise<unknown>>;

  // Concurrency limiter for parallel fetches
  private readonly limiter: Limiter;

  // Track if we're in mock mode (API unreachable)
  private mockMode = false;
  private lastApiAttempt = 0;
  private readonly apiRetryInterval = 30000; // Retry real API every 30s

  constructor(client?: BinanceClient) {
    this.client = client ?? createBinanceClient();
    this.priceCache = createCache<CachedPrice>();
    this.ticker24hrCache = createCache<CachedTicker24hr>();
    this.klinesCache = createCache<CachedKlines>();
    this.inFlight = new Map();
    this.limiter = createLimiter(FETCH_CONCURRENCY);
  }

  /**
   * Check if we should try real API
   */
  private shouldTryRealApi(): boolean {
    if (!this.mockMode) return true;
    // Periodically retry real API
    return Date.now() - this.lastApiAttempt > this.apiRetryInterval;
  }

  /**
   * Request coalescing: if a request for the same key is in-flight,
   * return the existing promise instead of making a new request.
   */
  private async coalesce<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in-flight
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Create new request and register it
    const promise = fetcher().finally(() => {
      // Remove from registry after completion (success or failure)
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Get price for a symbol (cached 5s, with request coalescing and mock fallback)
   */
  async getPrice(symbol: string): Promise<PriceResponse> {
    const normalizedSymbol = symbol.toUpperCase();
    const cacheKey = `price:${normalizedSymbol}`;

    // Try fresh cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached) {
      return {
        symbol: cached.symbol,
        price: cached.price,
        source: cached.mock ? 'mock' : 'binance',
        mock: cached.mock,
        fetchedAt: cached.fetchedAt,
      };
    }

    // Try real API if appropriate
    if (this.shouldTryRealApi()) {
      try {
        this.lastApiAttempt = Date.now();
        const result = await this.coalesce(cacheKey, async () => {
          const recheck = this.priceCache.get(cacheKey);
          if (recheck) return recheck;

          const data = await this.client.getPrice(normalizedSymbol);
          const fetchedAt = new Date().toISOString();

          // API worked, exit mock mode
          this.mockMode = false;

          const cacheValue: CachedPrice = {
            symbol: data.symbol,
            price: data.price,
            fetchedAt,
          };

          this.priceCache.set(cacheKey, cacheValue, PRICE_CACHE_TTL_MS);
          return cacheValue;
        });

        return {
          symbol: result.symbol,
          price: result.price,
          source: 'binance',
          fetchedAt: result.fetchedAt,
        };
      } catch (error) {
        // API failed, enter mock mode
        this.mockMode = true;
        console.warn(`[BinanceService] API failed, using mock data: ${(error as Error).message}`);

        // Try stale cache first
        const stale = this.priceCache.getWithStale(cacheKey, MAX_STALE_MS);
        if (stale) {
          return {
            symbol: stale.value.symbol,
            price: stale.value.price,
            source: stale.value.mock ? 'mock' : 'binance',
            stale: true,
            mock: stale.value.mock,
            fetchedAt: stale.value.fetchedAt,
          };
        }
      }
    }

    // Fall back to mock data
    if (USE_MOCK_FALLBACK && hasMockData(normalizedSymbol)) {
      const mockPrice = getMockPrice(normalizedSymbol);
      if (mockPrice) {
        const fetchedAt = new Date().toISOString();
        const cacheValue: CachedPrice = {
          symbol: mockPrice.symbol,
          price: mockPrice.price,
          fetchedAt,
          mock: true,
        };
        this.priceCache.set(cacheKey, cacheValue, PRICE_CACHE_TTL_MS);

        return {
          symbol: mockPrice.symbol,
          price: mockPrice.price,
          source: 'mock',
          mock: true,
          fetchedAt,
        };
      }
    }

    throw new Error(`No data available for ${normalizedSymbol}`);
  }

  /**
   * Get 24hr ticker for a symbol (cached 15s, with request coalescing and mock fallback)
   */
  async get24hr(symbol: string): Promise<Ticker24hrResponse> {
    const normalizedSymbol = symbol.toUpperCase();
    const cacheKey = `24hr:${normalizedSymbol}`;

    // Try fresh cache first
    const cached = this.ticker24hrCache.get(cacheKey);
    if (cached) {
      return {
        symbol: cached.symbol,
        data: cached.data,
        source: cached.mock ? 'mock' : 'binance',
        mock: cached.mock,
        fetchedAt: cached.fetchedAt,
      };
    }

    // Try real API if appropriate
    if (this.shouldTryRealApi()) {
      try {
        this.lastApiAttempt = Date.now();
        const result = await this.coalesce(cacheKey, async () => {
          const recheck = this.ticker24hrCache.get(cacheKey);
          if (recheck) return recheck;

          const data = await this.client.get24hr(normalizedSymbol);
          const fetchedAt = new Date().toISOString();

          this.mockMode = false;

          const cacheValue: CachedTicker24hr = {
            symbol: normalizedSymbol,
            data,
            fetchedAt,
          };

          this.ticker24hrCache.set(cacheKey, cacheValue, TICKER_24HR_CACHE_TTL_MS);
          return cacheValue;
        });

        return {
          symbol: result.symbol,
          data: result.data,
          source: 'binance',
          fetchedAt: result.fetchedAt,
        };
      } catch (error) {
        this.mockMode = true;
        console.warn(`[BinanceService] API failed, using mock data: ${(error as Error).message}`);

        const stale = this.ticker24hrCache.getWithStale(cacheKey, MAX_STALE_MS);
        if (stale) {
          return {
            symbol: stale.value.symbol,
            data: stale.value.data,
            source: stale.value.mock ? 'mock' : 'binance',
            stale: true,
            mock: stale.value.mock,
            fetchedAt: stale.value.fetchedAt,
          };
        }
      }
    }

    // Fall back to mock data
    if (USE_MOCK_FALLBACK && hasMockData(normalizedSymbol)) {
      const mockData = getMock24hr(normalizedSymbol);
      if (mockData) {
        const fetchedAt = new Date().toISOString();
        const cacheValue: CachedTicker24hr = {
          symbol: normalizedSymbol,
          data: mockData as unknown as Ticker24hr,
          fetchedAt,
          mock: true,
        };
        this.ticker24hrCache.set(cacheKey, cacheValue, TICKER_24HR_CACHE_TTL_MS);

        return {
          symbol: normalizedSymbol,
          data: mockData as unknown as Ticker24hr,
          source: 'mock',
          mock: true,
          fetchedAt,
        };
      }
    }

    throw new Error(`No data available for ${normalizedSymbol}`);
  }

  /**
   * Get klines for a symbol (cached 60s, with request coalescing and mock fallback)
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit?: number
  ): Promise<KlinesResponse> {
    const normalizedSymbol = symbol.toUpperCase();
    const resolvedLimit = limit ?? 100;
    const cacheKey = `klines:${normalizedSymbol}:${interval}:${resolvedLimit}`;

    // Try fresh cache first
    const cached = this.klinesCache.get(cacheKey);
    if (cached) {
      return {
        symbol: cached.symbol,
        interval: cached.interval,
        limit: cached.limit,
        data: cached.data,
        source: cached.mock ? 'mock' : 'binance',
        mock: cached.mock,
        fetchedAt: cached.fetchedAt,
      };
    }

    // Try real API if appropriate
    if (this.shouldTryRealApi()) {
      try {
        this.lastApiAttempt = Date.now();
        const result = await this.coalesce(cacheKey, async () => {
          const recheck = this.klinesCache.get(cacheKey);
          if (recheck) return recheck;

          const data = await this.client.getKlines(normalizedSymbol, interval, resolvedLimit);
          const fetchedAt = new Date().toISOString();

          this.mockMode = false;

          const cacheValue: CachedKlines = {
            symbol: normalizedSymbol,
            interval,
            limit: resolvedLimit,
            data,
            fetchedAt,
          };

          this.klinesCache.set(cacheKey, cacheValue, KLINES_CACHE_TTL_MS);
          return cacheValue;
        });

        return {
          symbol: result.symbol,
          interval: result.interval,
          limit: result.limit,
          data: result.data,
          source: 'binance',
          fetchedAt: result.fetchedAt,
        };
      } catch (error) {
        this.mockMode = true;
        console.warn(`[BinanceService] API failed, using mock data: ${(error as Error).message}`);

        const stale = this.klinesCache.getWithStale(cacheKey, MAX_STALE_MS);
        if (stale) {
          return {
            symbol: stale.value.symbol,
            interval: stale.value.interval,
            limit: stale.value.limit,
            data: stale.value.data,
            source: stale.value.mock ? 'mock' : 'binance',
            stale: true,
            mock: stale.value.mock,
            fetchedAt: stale.value.fetchedAt,
          };
        }
      }
    }

    // Fall back to mock data
    if (USE_MOCK_FALLBACK && hasMockData(normalizedSymbol)) {
      const mockData = getMockKlines(normalizedSymbol, interval, resolvedLimit);
      if (mockData) {
        const fetchedAt = new Date().toISOString();
        const cacheValue: CachedKlines = {
          symbol: normalizedSymbol,
          interval,
          limit: resolvedLimit,
          data: mockData as unknown as Kline[],
          fetchedAt,
          mock: true,
        };
        this.klinesCache.set(cacheKey, cacheValue, KLINES_CACHE_TTL_MS);

        return {
          symbol: normalizedSymbol,
          interval,
          limit: resolvedLimit,
          data: mockData as unknown as Kline[],
          source: 'mock',
          mock: true,
          fetchedAt,
        };
      }
    }

    throw new Error(`No data available for ${normalizedSymbol}`);
  }

  /**
   * Get multiple prices with concurrency limiting and mock fallback
   */
  async getPrices(symbols?: string[]): Promise<PriceResponse[]> {
    const fetchedAt = new Date().toISOString();

    // If in mock mode or no symbols, use mock data
    if (this.mockMode || !this.shouldTryRealApi()) {
      if (USE_MOCK_FALLBACK) {
        const mockPrices = getMockPrices(symbols);
        return mockPrices.map((p) => ({
          symbol: p.symbol,
          price: p.price,
          source: 'mock' as const,
          mock: true,
          fetchedAt,
        }));
      }
    }

    // Try real API for all prices
    if (!symbols || symbols.length === 0) {
      try {
        this.lastApiAttempt = Date.now();
        const results = await this.client.getPrices();
        this.mockMode = false;
        return results.map((r) => ({
          symbol: r.symbol,
          price: r.price,
          source: 'binance' as const,
          fetchedAt,
        }));
      } catch (error) {
        this.mockMode = true;
        console.warn(`[BinanceService] API failed, using mock data: ${(error as Error).message}`);
        
        if (USE_MOCK_FALLBACK) {
          const mockPrices = getMockPrices();
          return mockPrices.map((p) => ({
            symbol: p.symbol,
            price: p.price,
            source: 'mock' as const,
            mock: true,
            fetchedAt,
          }));
        }
        throw error;
      }
    }

    // For specific symbols, use getPrice with coalescing and concurrency limiting
    const normalizedSymbols = symbols.map((s) => s.toUpperCase());

    const results = await Promise.all(
      normalizedSymbols.map((symbol) =>
        this.limiter(() => this.getPrice(symbol))
      )
    );

    return results;
  }

  /**
   * Check if currently using mock data
   */
  isUsingMock(): boolean {
    return this.mockMode;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.priceCache.clear();
    this.ticker24hrCache.clear();
    this.klinesCache.clear();
  }

  /**
   * Get cache and in-flight statistics
   */
  getStats(): {
    cache: { price: number; ticker24hr: number; klines: number };
    inFlight: number;
    limiter: { active: number; pending: number };
    mockMode: boolean;
  } {
    return {
      cache: {
        price: this.priceCache.size(),
        ticker24hr: this.ticker24hrCache.size(),
        klines: this.klinesCache.size(),
      },
      inFlight: this.inFlight.size,
      limiter: {
        active: this.limiter.activeCount,
        pending: this.limiter.pendingCount,
      },
      mockMode: this.mockMode,
    };
  }

  /**
   * Cleanup and destroy caches (for graceful shutdown)
   */
  destroy(): void {
    this.priceCache.destroy();
    this.ticker24hrCache.destroy();
    this.klinesCache.destroy();
    this.inFlight.clear();
  }
}

/**
 * Factory function to create a BinanceService
 */
export function createBinanceService(
  clientConfig?: Partial<BinanceClientConfig>
): BinanceService {
  const client = createBinanceClient(clientConfig);
  return new BinanceService(client);
}
