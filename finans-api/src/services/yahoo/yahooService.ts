/**
 * Yahoo Finance Service with caching and request coalescing
 * 
 * Wraps YahooClient with:
 * - In-memory TTL caching
 * - Request coalescing (deduplication of in-flight requests)
 * - Stale-if-error fallback
 * - Dashboard-friendly response shapes
 */

import { TTLCache, createCache } from '../../utils/cache';
import { createThrottledLimiter, ThrottledLimiter } from '../../utils/limiter';
import {
  YahooClient,
  createYahooClient,
  YahooQuoteResult,
  YahooChartResult,
  YahooDetailResult,
  YahooInterval,
  YahooRange,
  YahooFinanceError,
  YahooClientConfig,
} from './index';

// -----------------------------------------------------------------------------
// CACHE TTLs
// -----------------------------------------------------------------------------

const QUOTE_CACHE_TTL_MS = 10000;    // 10 seconds
const CHART_CACHE_TTL_MS = 60000;    // 60 seconds
const DETAIL_CACHE_TTL_MS = 300000;  // 5 minutes (detail data changes slowly)

// Max stale age for stale-if-error (2 minutes beyond expiry)
const MAX_STALE_MS = 120000;

// -----------------------------------------------------------------------------
// THROTTLING CONFIG
// -----------------------------------------------------------------------------

/**
 * Maximum concurrent Yahoo Finance requests
 * Keep low to avoid triggering rate limits
 */
const YAHOO_CONCURRENCY = parseInt(process.env.YAHOO_CONCURRENCY || '3', 10);

/**
 * Minimum delay between Yahoo Finance requests (ms)
 * Helps prevent hitting rate limits
 */
const YAHOO_MIN_DELAY_MS = parseInt(process.env.YAHOO_MIN_DELAY_MS || '100', 10);

// -----------------------------------------------------------------------------
// INTERVAL MAPPING
// -----------------------------------------------------------------------------

/**
 * User-friendly intervals that we accept
 */
export const SUPPORTED_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
export type SupportedInterval = typeof SUPPORTED_INTERVALS[number];

/**
 * Map user-friendly intervals to Yahoo Finance intervals
 * Note: Yahoo doesn't have 4h, we use 1h and the frontend can aggregate if needed
 */
const INTERVAL_MAP: Record<SupportedInterval, YahooInterval> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '1h',   // Yahoo doesn't have 4h, use 1h
  '1d': '1d',
};

/**
 * Check if interval is supported
 */
export function isSupportedInterval(interval: string): interval is SupportedInterval {
  return SUPPORTED_INTERVALS.includes(interval as SupportedInterval);
}

/**
 * Map user interval to Yahoo interval
 */
export function mapInterval(interval: SupportedInterval): YahooInterval {
  return INTERVAL_MAP[interval];
}

// -----------------------------------------------------------------------------
// RESPONSE TYPES (Dashboard-Friendly)
// -----------------------------------------------------------------------------

/**
 * Normalized candle format for charts
 */
export interface NormalizedCandle {
  time: string;      // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Quote response with dashboard-friendly fields
 */
export interface YahooQuoteResponse {
  // Identity
  symbol: string;
  name: string;              // shortName or symbol
  displayName?: string;      // longName if available
  
  // Exchange info
  exchange: string;          // e.g., "IST"
  currency: string;          // e.g., "TRY"
  
  // Current price
  price: number;
  change: number;
  changePercent: number;
  
  // OHLC data
  previousClose?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  
  // Volume & Market cap
  volume?: number;
  marketCap?: number;
  
  // 52-week range
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  
  // Timestamps
  timestamp: string;         // Provider time or fetchedAt
  
  // Metadata
  market: string;
  source: 'yahoo';
  stale?: boolean;
  fetchedAt: string;
}

/**
 * Chart metadata
 */
export interface ChartMeta {
  requestedInterval: string;  // What user asked for
  providerInterval: string;   // What Yahoo returned
  requestedRange: string;
  timezone: string;
  gmtOffset: number;
  currency: string;
  exchange: string;
  candleCount: number;
  firstCandleTime?: string;
  lastCandleTime?: string;
}

/**
 * Chart response with dashboard-friendly fields
 */
export interface YahooChartResponse {
  symbol: string;
  name?: string;
  interval: string;          // User-requested interval
  range: YahooRange;
  candles: NormalizedCandle[];
  
  // Metadata
  meta: ChartMeta;
  market: string;
  source: 'yahoo';
  stale?: boolean;
  fetchedAt: string;
}

/**
 * Detail response with fundamental data
 */
export interface YahooDetailResponse {
  symbol: string;
  name: string;
  displayName?: string;

  // Exchange info
  exchange: string;
  currency: string;

  // Company profile
  sector?: string;
  industry?: string;
  website?: string;
  description?: string;
  employees?: number;
  headquarters?: string;

  // Dividend info
  dividendRate?: number;
  dividendYield?: number;
  exDividendDate?: string;
  dividendDate?: string;
  paysDividend: boolean;

  // Key statistics
  marketCap?: number;
  beta?: number;
  peRatio?: number;
  forwardPE?: number;
  priceToBook?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;

  // Listing info
  listingDate?: string;

  // Metadata
  market: string;
  source: 'yahoo';
  stale?: boolean;
  fetchedAt: string;
}

// -----------------------------------------------------------------------------
// INTERNAL CACHE VALUE TYPES
// -----------------------------------------------------------------------------

interface CachedQuote {
  symbol: string;
  name: string;
  displayName?: string;
  exchange: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  timestamp: string;
  fetchedAt: string;
}

interface CachedChart {
  symbol: string;
  name?: string;
  interval: string;
  range: YahooRange;
  candles: NormalizedCandle[];
  meta: ChartMeta;
  fetchedAt: string;
}

interface CachedDetail {
  symbol: string;
  name: string;
  displayName?: string;
  exchange: string;
  currency: string;
  sector?: string;
  industry?: string;
  website?: string;
  description?: string;
  employees?: number;
  headquarters?: string;
  dividendRate?: number;
  dividendYield?: number;
  exDividendDate?: string;
  dividendDate?: string;
  paysDividend: boolean;
  marketCap?: number;
  beta?: number;
  peRatio?: number;
  forwardPE?: number;
  priceToBook?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  listingDate?: string;
  fetchedAt: string;
}

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Convert Yahoo chart candles to normalized format
 * - Filters out null/invalid candles
 * - Sorts by time ascending
 */
function normalizeCandles(chartResult: YahooChartResult): NormalizedCandle[] {
  const candles = chartResult.candles
    // Filter out invalid candles
    .filter((candle) => 
      candle.date && 
      candle.close !== null && 
      candle.close !== undefined &&
      !isNaN(candle.close)
    )
    // Map to normalized format
    .map((candle) => ({
      time: candle.date.toISOString(),
      open: candle.open ?? candle.close,
      high: candle.high ?? candle.close,
      low: candle.low ?? candle.close,
      close: candle.close,
      volume: candle.volume ?? 0,
    }));
  
  // Sort by time ascending
  candles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
  return candles;
}

/**
 * Convert YahooQuoteResult to CachedQuote
 */
function quoteToCacheValue(data: YahooQuoteResult): CachedQuote {
  const timestamp = data.regularMarketTime 
    ? data.regularMarketTime.toISOString() 
    : data.fetchedAt;

  return {
    symbol: data.symbol,
    name: data.shortName || data.symbol.replace('.IS', ''),
    displayName: data.longName,
    exchange: data.exchange || 'IST',
    currency: data.currency || 'TRY',
    price: data.regularMarketPrice,
    change: data.regularMarketChange,
    changePercent: data.regularMarketChangePercent,
    previousClose: data.regularMarketPreviousClose,
    open: data.regularMarketOpen,
    dayHigh: data.regularMarketDayHigh,
    dayLow: data.regularMarketDayLow,
    volume: data.regularMarketVolume,
    marketCap: data.marketCap,
    fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: data.fiftyTwoWeekLow,
    timestamp,
    fetchedAt: data.fetchedAt,
  };
}

/**
 * Convert CachedQuote to YahooQuoteResponse
 */
function cacheValueToQuoteResponse(cached: CachedQuote, stale?: boolean): YahooQuoteResponse {
  return {
    symbol: cached.symbol,
    name: cached.name,
    displayName: cached.displayName,
    exchange: cached.exchange,
    currency: cached.currency,
    price: cached.price,
    change: cached.change,
    changePercent: cached.changePercent,
    previousClose: cached.previousClose,
    open: cached.open,
    dayHigh: cached.dayHigh,
    dayLow: cached.dayLow,
    volume: cached.volume,
    marketCap: cached.marketCap,
    fiftyTwoWeekHigh: cached.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: cached.fiftyTwoWeekLow,
    timestamp: cached.timestamp,
    market: 'BIST',
    source: 'yahoo',
    stale,
    fetchedAt: cached.fetchedAt,
  };
}

/**
 * Convert CachedChart to YahooChartResponse
 */
function cacheValueToChartResponse(cached: CachedChart, stale?: boolean, market: string = 'BIST'): YahooChartResponse {
  return {
    symbol: cached.symbol,
    name: cached.name,
    interval: cached.interval,
    range: cached.range,
    candles: cached.candles,
    meta: cached.meta,
    market,
    source: 'yahoo',
    stale,
    fetchedAt: cached.fetchedAt,
  };
}

/**
 * Convert CachedDetail to YahooDetailResponse
 */
function cacheValueToDetailResponse(cached: CachedDetail, stale?: boolean, market: string = 'BIST'): YahooDetailResponse {
  return {
    symbol: cached.symbol,
    name: cached.name,
    displayName: cached.displayName,
    exchange: cached.exchange,
    currency: cached.currency,
    sector: cached.sector,
    industry: cached.industry,
    website: cached.website,
    description: cached.description,
    employees: cached.employees,
    headquarters: cached.headquarters,
    dividendRate: cached.dividendRate,
    dividendYield: cached.dividendYield,
    exDividendDate: cached.exDividendDate,
    dividendDate: cached.dividendDate,
    paysDividend: cached.paysDividend,
    marketCap: cached.marketCap,
    beta: cached.beta,
    peRatio: cached.peRatio,
    forwardPE: cached.forwardPE,
    priceToBook: cached.priceToBook,
    fiftyTwoWeekHigh: cached.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: cached.fiftyTwoWeekLow,
    fiftyDayAverage: cached.fiftyDayAverage,
    twoHundredDayAverage: cached.twoHundredDayAverage,
    listingDate: cached.listingDate,
    market,
    source: 'yahoo',
    stale,
    fetchedAt: cached.fetchedAt,
  };
}

// -----------------------------------------------------------------------------
// YAHOO SERVICE CLASS
// -----------------------------------------------------------------------------

export class YahooService {
  private readonly client: YahooClient;
  private readonly quoteCache: TTLCache<CachedQuote>;
  private readonly chartCache: TTLCache<CachedChart>;
  private readonly detailCache: TTLCache<CachedDetail>;

  // In-flight registry for request coalescing
  private readonly inFlight: Map<string, Promise<unknown>>;

  // Throttled limiter for parallel fetches with rate limiting protection
  private readonly limiter: ThrottledLimiter;

  constructor(client?: YahooClient) {
    this.client = client ?? createYahooClient();
    this.quoteCache = createCache<CachedQuote>();
    this.chartCache = createCache<CachedChart>();
    this.detailCache = createCache<CachedDetail>();
    this.inFlight = new Map();
    
    // Use throttled limiter to prevent overwhelming Yahoo Finance
    this.limiter = createThrottledLimiter({
      concurrency: YAHOO_CONCURRENCY,
      minDelayMs: YAHOO_MIN_DELAY_MS,
    });
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
   * Get quote for a BIST symbol (cached 10s, with request coalescing and throttling)
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @returns Dashboard-friendly quote response
   */
  async getQuote(symbol: string): Promise<YahooQuoteResponse> {
    const normalizedSymbol = symbol.toUpperCase().replace(/\.IS$/, '');
    const cacheKey = `quote:${normalizedSymbol}`;

    // Try fresh cache first (no API call needed)
    const cached = this.quoteCache.get(cacheKey);
    if (cached) {
      return cacheValueToQuoteResponse(cached);
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        // Double-check cache after coalescing (another request might have filled it)
        const recheck = this.quoteCache.get(cacheKey);
        if (recheck) return recheck;

        // Fetch from Yahoo with throttling protection
        const data = await this.limiter(() => this.client.getQuote(normalizedSymbol));
        const cacheValue = quoteToCacheValue(data);

        this.quoteCache.set(cacheKey, cacheValue, QUOTE_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToQuoteResponse(result);
    } catch (error) {
      // Try stale cache on error
      const stale = this.quoteCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for ${normalizedSymbol}: ${(error as Error).message}`
        );
        return cacheValueToQuoteResponse(stale.value, true);
      }

      // Re-throw if no stale data available
      throw error;
    }
  }

  /**
   * Get chart/candle data for a BIST symbol (cached 60s, with request coalescing and throttling)
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @param interval - User-friendly interval (e.g., "1h", "4h", "1d")
   * @param range - Data range (e.g., "1mo", "1y")
   * @returns Dashboard-friendly chart response
   */
  async getChart(
    symbol: string,
    interval: SupportedInterval,
    range: YahooRange
  ): Promise<YahooChartResponse> {
    const normalizedSymbol = symbol.toUpperCase().replace(/\.IS$/, '');
    const yahooInterval = mapInterval(interval);
    const cacheKey = `chart:${normalizedSymbol}:${interval}:${range}`;

    // Try fresh cache first (no API call needed)
    const cached = this.chartCache.get(cacheKey);
    if (cached) {
      return cacheValueToChartResponse(cached);
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        // Double-check cache after coalescing
        const recheck = this.chartCache.get(cacheKey);
        if (recheck) return recheck;

        // Fetch from Yahoo with throttling protection
        const data = await this.limiter(() => 
          this.client.getChart(normalizedSymbol, yahooInterval, range)
        );
        const fetchedAt = new Date().toISOString();

        // Normalize candles (filter nulls, sort ascending)
        const candles = normalizeCandles(data);

        // Build metadata
        const meta: ChartMeta = {
          requestedInterval: interval,
          providerInterval: yahooInterval,
          requestedRange: range,
          timezone: data.timezone,
          gmtOffset: data.gmtOffset,
          currency: data.currency,
          exchange: data.exchange,
          candleCount: candles.length,
          firstCandleTime: candles.length > 0 ? candles[0].time : undefined,
          lastCandleTime: candles.length > 0 ? candles[candles.length - 1].time : undefined,
        };

        const cacheValue: CachedChart = {
          symbol: data.symbol,
          interval,
          range,
          candles,
          meta,
          fetchedAt,
        };

        this.chartCache.set(cacheKey, cacheValue, CHART_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToChartResponse(result);
    } catch (error) {
      // Try stale cache on error
      const stale = this.chartCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for ${normalizedSymbol} chart: ${(error as Error).message}`
        );
        return cacheValueToChartResponse(stale.value, true);
      }

      // Re-throw if no stale data available
      throw error;
    }
  }

  /**
   * Get detailed stock information (cached 5min, with request coalescing and throttling)
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @returns Dashboard-friendly detail response
   */
  async getDetail(symbol: string): Promise<YahooDetailResponse> {
    const normalizedSymbol = symbol.toUpperCase().replace(/\.IS$/, '');
    const cacheKey = `detail:${normalizedSymbol}`;

    // Try fresh cache first (no API call needed)
    const cached = this.detailCache.get(cacheKey);
    if (cached) {
      return cacheValueToDetailResponse(cached);
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        // Double-check cache after coalescing
        const recheck = this.detailCache.get(cacheKey);
        if (recheck) return recheck;

        // Fetch from Yahoo with throttling protection
        const data = await this.limiter(() => this.client.getDetail(normalizedSymbol));
        const fetchedAt = new Date().toISOString();

        // Build headquarters string
        const headquarters = data.city && data.country 
          ? `${data.city}, ${data.country}` 
          : data.country || data.city;

        const cacheValue: CachedDetail = {
          symbol: data.symbol.replace('.IS', ''),
          name: data.shortName,
          displayName: data.longName,
          exchange: data.exchange,
          currency: data.currency,
          sector: data.sector,
          industry: data.industry,
          website: data.website,
          description: data.longBusinessSummary,
          employees: data.fullTimeEmployees,
          headquarters,
          dividendRate: data.dividendRate,
          dividendYield: data.dividendYield,
          exDividendDate: data.exDividendDate?.toISOString(),
          dividendDate: data.dividendDate?.toISOString(),
          paysDividend: !!(data.dividendRate || data.dividendYield),
          marketCap: data.marketCap,
          beta: data.beta,
          peRatio: data.trailingPE,
          forwardPE: data.forwardPE,
          priceToBook: data.priceToBook,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.fiftyTwoWeekLow,
          fiftyDayAverage: data.fiftyDayAverage,
          twoHundredDayAverage: data.twoHundredDayAverage,
          listingDate: data.startDate?.toISOString() || data.firstTradeDate?.toISOString(),
          fetchedAt,
        };

        this.detailCache.set(cacheKey, cacheValue, DETAIL_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToDetailResponse(result);
    } catch (error) {
      // Try stale cache on error
      const stale = this.detailCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for ${normalizedSymbol} detail: ${(error as Error).message}`
        );
        return cacheValueToDetailResponse(stale.value, true);
      }

      // Re-throw if no stale data available
      throw error;
    }
  }

  /**
   * Get detailed stock information for a US symbol (cached 5min, with request coalescing and throttling)
   *
   * @param symbol - US stock symbol (e.g., "AAPL")
   * @returns Dashboard-friendly detail response with market='US'
   */
  async getUsDetail(symbol: string): Promise<YahooDetailResponse> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const cacheKey = `us-detail:${normalizedSymbol}`;

    // Try fresh cache first
    const cached = this.detailCache.get(cacheKey);
    if (cached) {
      return cacheValueToDetailResponse(cached, undefined, 'US');
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        const recheck = this.detailCache.get(cacheKey);
        if (recheck) return recheck;

        const data = await this.limiter(() => this.client.getUsStockDetail(normalizedSymbol));
        const fetchedAt = new Date().toISOString();

        const headquarters = data.city && data.country
          ? `${data.city}, ${data.country}`
          : data.country || data.city;

        const cacheValue: CachedDetail = {
          symbol: normalizedSymbol,
          name: data.shortName,
          displayName: data.longName,
          exchange: data.exchange,
          currency: data.currency,
          sector: data.sector,
          industry: data.industry,
          website: data.website,
          description: data.longBusinessSummary,
          employees: data.fullTimeEmployees,
          headquarters,
          dividendRate: data.dividendRate,
          dividendYield: data.dividendYield,
          exDividendDate: data.exDividendDate?.toISOString(),
          dividendDate: data.dividendDate?.toISOString(),
          paysDividend: !!(data.dividendRate || data.dividendYield),
          marketCap: data.marketCap,
          beta: data.beta,
          peRatio: data.trailingPE,
          forwardPE: data.forwardPE,
          priceToBook: data.priceToBook,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.fiftyTwoWeekLow,
          fiftyDayAverage: data.fiftyDayAverage,
          twoHundredDayAverage: data.twoHundredDayAverage,
          listingDate: data.startDate?.toISOString() || data.firstTradeDate?.toISOString(),
          fetchedAt,
        };

        this.detailCache.set(cacheKey, cacheValue, DETAIL_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToDetailResponse(result, undefined, 'US');
    } catch (error) {
      const stale = this.detailCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for US ${normalizedSymbol} detail: ${(error as Error).message}`
        );
        return cacheValueToDetailResponse(stale.value, true, 'US');
      }
      throw error;
    }
  }

  /**
   * Get chart/candle data for a US stock symbol (cached 60s, with coalescing and throttling)
   * Uses Yahoo Finance directly (no Finnhub API key required)
   *
   * @param symbol - US stock symbol (e.g., "AAPL")
   * @param interval - User-friendly interval (e.g., "1h", "1d")
   * @param range - Data range (e.g., "1mo", "1y")
   * @returns Dashboard-friendly chart response with market='US'
   */
  async getUsChart(
    symbol: string,
    interval: SupportedInterval,
    range: YahooRange
  ): Promise<YahooChartResponse> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const yahooInterval = mapInterval(interval);
    const cacheKey = `us-chart:${normalizedSymbol}:${interval}:${range}`;

    const cached = this.chartCache.get(cacheKey);
    if (cached) {
      return cacheValueToChartResponse(cached, undefined, 'US');
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        const recheck = this.chartCache.get(cacheKey);
        if (recheck) return recheck;

        const data = await this.limiter(() =>
          this.client.getUsStockChart(normalizedSymbol, yahooInterval, range)
        );
        const fetchedAt = new Date().toISOString();

        const candles = normalizeCandles(data);

        const meta: ChartMeta = {
          requestedInterval: interval,
          providerInterval: yahooInterval,
          requestedRange: range,
          timezone: data.timezone,
          gmtOffset: data.gmtOffset,
          currency: data.currency,
          exchange: data.exchange,
          candleCount: candles.length,
          firstCandleTime: candles.length > 0 ? candles[0].time : undefined,
          lastCandleTime: candles.length > 0 ? candles[candles.length - 1].time : undefined,
        };

        const cacheValue: CachedChart = {
          symbol: data.symbol,
          interval,
          range,
          candles,
          meta,
          fetchedAt,
        };

        this.chartCache.set(cacheKey, cacheValue, CHART_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToChartResponse(result, undefined, 'US');
    } catch (error) {
      const stale = this.chartCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for US ${normalizedSymbol} chart: ${(error as Error).message}`
        );
        return cacheValueToChartResponse(stale.value, true, 'US');
      }
      throw error;
    }
  }

  /**
   * Get quote for any Yahoo Finance symbol (cached 10s, with coalescing and throttling)
   * No BIST normalization — works for forex (=X), futures (=F), ETFs, etc.
   *
   * @param symbol - Any Yahoo Finance symbol (e.g., "GC=F", "EURUSD=X", "SPY")
   * @returns Dashboard-friendly quote response
   */
  async getGenericQuote(symbol: string): Promise<YahooQuoteResponse> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const cacheKey = `generic-quote:${normalizedSymbol}`;

    const cached = this.quoteCache.get(cacheKey);
    if (cached) {
      return cacheValueToQuoteResponse(cached);
    }

    try {
      const result = await this.coalesce(cacheKey, async () => {
        const recheck = this.quoteCache.get(cacheKey);
        if (recheck) return recheck;

        const data = await this.limiter(() => this.client.getGenericQuote(normalizedSymbol));
        const cacheValue = quoteToCacheValue(data);

        this.quoteCache.set(cacheKey, cacheValue, QUOTE_CACHE_TTL_MS);
        return cacheValue;
      });

      return cacheValueToQuoteResponse(result);
    } catch (error) {
      const stale = this.quoteCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        console.warn(
          `[YahooService] Using stale cache for ${normalizedSymbol}: ${(error as Error).message}`
        );
        return cacheValueToQuoteResponse(stale.value, true);
      }
      throw error;
    }
  }

  /**
   * Get multiple quotes with throttling protection
   * 
   * Note: Each getQuote() call already goes through the throttled limiter,
   * so we don't need additional limiting here. The coalescing and caching
   * ensure we don't make duplicate requests.
   * 
   * @param symbols - Array of BIST symbols
   * @returns Array of quote responses (or errors for failed symbols)
   */
  async getQuotes(
    symbols: string[]
  ): Promise<Array<YahooQuoteResponse | { symbol: string; error: string }>> {
    const results: Array<YahooQuoteResponse | { symbol: string; error: string }> = [];

    // Process sequentially to respect throttling
    // Each getQuote already uses the throttled limiter internally
    for (const symbol of symbols) {
      try {
        const quote = await this.getQuote(symbol);
        results.push(quote);
      } catch (error) {
        const errorMessage = error instanceof YahooFinanceError
          ? error.message
          : (error as Error).message;
        results.push({ symbol, error: errorMessage });
      }
    }

    return results;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.quoteCache.clear();
    this.chartCache.clear();
    this.detailCache.clear();
  }

  /**
   * Get cache and in-flight statistics
   */
  getStats(): {
    cache: { quote: number; chart: number; detail: number };
    inFlight: number;
    limiter: { active: number; pending: number };
  } {
    return {
      cache: {
        quote: this.quoteCache.size(),
        chart: this.chartCache.size(),
        detail: this.detailCache.size(),
      },
      inFlight: this.inFlight.size,
      limiter: {
        active: this.limiter.activeCount,
        pending: this.limiter.pendingCount,
      },
    };
  }

  /**
   * Cleanup and destroy caches (for graceful shutdown)
   */
  destroy(): void {
    this.quoteCache.destroy();
    this.chartCache.destroy();
    this.detailCache.destroy();
    this.inFlight.clear();
  }
}

// -----------------------------------------------------------------------------
// FACTORY & SINGLETON
// -----------------------------------------------------------------------------

let defaultService: YahooService | null = null;

/**
 * Create a new Yahoo Service
 */
export function createYahooService(clientConfig?: YahooClientConfig): YahooService {
  const client = createYahooClient(clientConfig);
  return new YahooService(client);
}

/**
 * Get the default singleton Yahoo Service
 */
export function getYahooService(): YahooService {
  if (!defaultService) {
    defaultService = new YahooService();
  }
  return defaultService;
}
