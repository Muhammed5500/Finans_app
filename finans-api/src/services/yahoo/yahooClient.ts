/**
 * Yahoo Finance Client for BIST Market Data
 * 
 * Uses yahoo-finance2 npm package for reliable data fetching.
 * Focuses on BIST (Borsa Istanbul) stocks with .IS suffix.
 */

// yahoo-finance2 is an ESM-only package, use dynamic import
// The default export is a class that needs to be instantiated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let yahooFinanceInstance: any = null;

async function getYahooFinanceInstance(): Promise<any> {
  if (!yahooFinanceInstance) {
    // Dynamic import for ESM module
    const module = await (Function('return import("yahoo-finance2")')() as Promise<any>);
    const YahooFinance = module.default;
    yahooFinanceInstance = new YahooFinance();
  }
  return yahooFinanceInstance;
}

import {
  BIST_SUFFIX,
  BIST_SYMBOL_REGEX,
  YAHOO_INTERVALS,
  YAHOO_RANGES,
  YahooInterval,
  YahooRange,
  YahooQuoteResult,
  YahooChartResult,
  YahooCandle,
  YahooFinanceError,
  YahooClientConfig,
  YahooDetailResult,
} from './types';

// -----------------------------------------------------------------------------
// DEFAULTS
// -----------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<YahooClientConfig> = {
  timeoutMs: 10000,
  validateResult: false,
};

// -----------------------------------------------------------------------------
// VALIDATION HELPERS
// -----------------------------------------------------------------------------

/**
 * Normalize BIST symbol to Yahoo Finance format (with .IS suffix)
 * Accepts: THYAO, thyao, THYAO.IS, thyao.is
 * Returns: THYAO.IS
 */
export function normalizeBistSymbol(symbol: string): string {
  if (!symbol || typeof symbol !== 'string') {
    throw new YahooFinanceError(
      'INVALID_SYMBOL',
      'Symbol must be a non-empty string'
    );
  }

  // Uppercase and trim
  let normalized = symbol.toUpperCase().trim();

  // Remove .IS suffix if present (we'll add it back)
  if (normalized.endsWith(BIST_SUFFIX)) {
    normalized = normalized.slice(0, -BIST_SUFFIX.length);
  }

  // Validate base symbol format
  if (!BIST_SYMBOL_REGEX.test(normalized)) {
    throw new YahooFinanceError(
      'INVALID_SYMBOL',
      `Invalid BIST symbol format: "${symbol}". Must be 3-6 uppercase letters (e.g., THYAO, GARAN)`
    );
  }

  // Add .IS suffix
  return `${normalized}${BIST_SUFFIX}`;
}

/**
 * Validate interval parameter
 */
export function validateYahooInterval(interval: string): asserts interval is YahooInterval {
  if (!YAHOO_INTERVALS.includes(interval as YahooInterval)) {
    throw new YahooFinanceError(
      'INVALID_INTERVAL',
      `Invalid interval: "${interval}". Must be one of: ${YAHOO_INTERVALS.join(', ')}`
    );
  }
}

/**
 * Validate range parameter
 */
export function validateYahooRange(range: string): asserts range is YahooRange {
  if (!YAHOO_RANGES.includes(range as YahooRange)) {
    throw new YahooFinanceError(
      'INVALID_RANGE',
      `Invalid range: "${range}". Must be one of: ${YAHOO_RANGES.join(', ')}`
    );
  }
}

/**
 * Check if interval is valid (non-throwing)
 */
export function isValidYahooInterval(interval: string): interval is YahooInterval {
  return YAHOO_INTERVALS.includes(interval as YahooInterval);
}

/**
 * Check if range is valid (non-throwing)
 */
export function isValidYahooRange(range: string): range is YahooRange {
  return YAHOO_RANGES.includes(range as YahooRange);
}

// -----------------------------------------------------------------------------
// ERROR NORMALIZATION
// -----------------------------------------------------------------------------

/**
 * Normalize errors from yahoo-finance2 to consistent internal format
 */
function normalizeError(error: unknown, context: string): YahooFinanceError {
  // Already our error type
  if (error instanceof YahooFinanceError) {
    return error;
  }

  // Handle yahoo-finance2 specific errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Symbol not found
    if (
      message.includes('not found') ||
      message.includes('no results') ||
      message.includes('no data')
    ) {
      return new YahooFinanceError(
        'SYMBOL_NOT_FOUND',
        `Symbol not found: ${context}`,
        error
      );
    }

    // Rate limiting / Throttling / Blocking detection
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return new YahooFinanceError(
        'RATE_LIMIT',
        'Yahoo Finance rate limit exceeded. Please try again later.',
        error
      );
    }

    // Provider throttling / blocking (401, 403, redirect issues, consent)
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('consent') ||
      message.includes('guce') ||
      message.includes('redirect') ||
      message.includes('blocked') ||
      message.includes('captcha') ||
      message.includes('access denied')
    ) {
      return new YahooFinanceError(
        'PROVIDER_THROTTLED',
        'Yahoo Finance is temporarily blocking requests. Please try again later or reduce request frequency.',
        error
      );
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket') ||
      message.includes('eproto') ||
      message.includes('ssl')
    ) {
      return new YahooFinanceError(
        'NETWORK_ERROR',
        `Network error while fetching ${context}`,
        error
      );
    }

    // Validation errors from yahoo-finance2
    if (message.includes('validation') || message.includes('invalid')) {
      return new YahooFinanceError(
        'VALIDATION_ERROR',
        `Validation error: ${error.message}`,
        error
      );
    }

    // Generic provider error
    return new YahooFinanceError(
      'PROVIDER_ERROR',
      `Yahoo Finance error: ${error.message}`,
      error
    );
  }

  // Unknown error type
  return new YahooFinanceError(
    'PROVIDER_ERROR',
    `Unknown error while fetching ${context}`,
    error
  );
}

// -----------------------------------------------------------------------------
// YAHOO FINANCE CLIENT
// -----------------------------------------------------------------------------

/**
 * Yahoo Finance client for BIST market data
 */
export class YahooClient {
  private readonly config: Required<YahooClientConfig>;
  private initialized = false;

  constructor(config?: YahooClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the Yahoo Finance module (lazy loading ESM module)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async init(): Promise<any> {
    const yf = await getYahooFinanceInstance();
    this.initialized = true;
    return yf;
  }

  /**
   * Get quote data for a BIST symbol
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @returns Normalized quote result
   */
  async getQuote(symbol: string): Promise<YahooQuoteResult> {
    const normalizedSymbol = normalizeBistSymbol(symbol);
    const yf = await this.init();

    try {
      const quote = await yf.quote(normalizedSymbol, {}, {
        validateResult: this.config.validateResult,
      });

      if (!quote) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No quote data found for symbol: ${normalizedSymbol}`
        );
      }

      // Normalize response
      return {
        symbol: quote.symbol,
        shortName: quote.shortName || quote.symbol,
        longName: quote.longName,
        currency: quote.currency || 'TRY',
        exchange: quote.exchange || 'IST',
        exchangeTimezoneName: quote.exchangeTimezoneName || 'Europe/Istanbul',

        // Price data
        regularMarketPrice: quote.regularMarketPrice ?? 0,
        regularMarketChange: quote.regularMarketChange ?? 0,
        regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,
        regularMarketVolume: quote.regularMarketVolume,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,

        // 52-week data
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,

        // Market cap
        marketCap: quote.marketCap,

        // Timestamps
        regularMarketTime: quote.regularMarketTime,

        // Metadata
        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, normalizedSymbol);
    }
  }

  /**
   * Get chart/candle data for a BIST symbol
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @param interval - Candle interval (e.g., "1d", "1h")
   * @param range - Data range (e.g., "1mo", "1y")
   * @returns Chart result with candles
   */
  async getChart(
    symbol: string,
    interval: YahooInterval,
    range: YahooRange
  ): Promise<YahooChartResult> {
    const normalizedSymbol = normalizeBistSymbol(symbol);
    validateYahooInterval(interval);
    validateYahooRange(range);
    const yf = await this.init();

    try {
      const result = await yf.chart(normalizedSymbol, {
        period1: this.getRangePeriod1(range),
        interval,
      }, {
        validateResult: this.config.validateResult,
      });

      if (!result || !result.quotes) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No chart data found for symbol: ${normalizedSymbol}`
        );
      }

      // Empty data: return 200 + empty candles instead of 404 (BIST intraday is often empty)
      if (result.quotes.length === 0) {
        const meta = result.meta ?? {};
        return {
          symbol: meta.symbol || normalizedSymbol,
          currency: meta.currency || 'TRY',
          exchange: meta.exchangeName || 'IST',
          interval,
          range,
          candles: [],
          firstTradeDate: meta.firstTradeDate ?? undefined,
          regularMarketTime: meta.regularMarketTime ?? undefined,
          gmtOffset: meta.gmtoffset ?? 10800,
          timezone: meta.timezone || 'Europe/Istanbul',
          source: 'yahoo',
          fetchedAt: new Date().toISOString(),
        };
      }

      // Transform quotes to candles
      type ChartQuote = {
        date?: Date;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        close?: number | null;
        volume?: number | null;
        adjclose?: number | null;
      };

      const candles: YahooCandle[] = result.quotes
        .filter((q: ChartQuote) => q.date && q.close !== null)
        .map((q: ChartQuote) => ({
          date: q.date!,
          open: q.open ?? q.close!,
          high: q.high ?? q.close!,
          low: q.low ?? q.close!,
          close: q.close!,
          volume: q.volume ?? 0,
          adjClose: q.adjclose,
        }));

      return {
        symbol: result.meta.symbol,
        currency: result.meta.currency || 'TRY',
        exchange: result.meta.exchangeName || 'IST',
        interval,
        range,

        candles,

        firstTradeDate: result.meta.firstTradeDate,
        regularMarketTime: result.meta.regularMarketTime,
        gmtOffset: result.meta.gmtoffset ?? 10800, // Default to Turkey GMT+3
        timezone: result.meta.timezone || 'Europe/Istanbul',

        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, `${normalizedSymbol} (${interval}, ${range})`);
    }
  }

  /**
   * Get detailed stock information using quoteSummary
   * 
   * @param symbol - BIST symbol (e.g., "THYAO" or "THYAO.IS")
   * @returns Detailed stock information
   */
  async getDetail(symbol: string): Promise<YahooDetailResult> {
    const normalizedSymbol = normalizeBistSymbol(symbol);
    const yf = await this.init();

    try {
      // Request multiple modules for comprehensive data
      const result = await yf.quoteSummary(normalizedSymbol, {
        modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics', 'calendarEvents', 'price'],
      }, {
        validateResult: this.config.validateResult,
      });

      if (!result) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No detail data found for symbol: ${normalizedSymbol}`
        );
      }

      const { assetProfile, summaryDetail, defaultKeyStatistics, calendarEvents, price } = result;

      return {
        symbol: normalizedSymbol,
        
        // Basic info from price module
        shortName: price?.shortName || normalizedSymbol.replace('.IS', ''),
        longName: price?.longName,
        currency: price?.currency || 'TRY',
        exchange: price?.exchangeName || 'IST',
        
        // Company profile from assetProfile
        sector: assetProfile?.sector,
        industry: assetProfile?.industry,
        website: assetProfile?.website,
        longBusinessSummary: assetProfile?.longBusinessSummary,
        fullTimeEmployees: assetProfile?.fullTimeEmployees,
        city: assetProfile?.city,
        country: assetProfile?.country,
        
        // Dividend info from summaryDetail and calendarEvents
        dividendRate: summaryDetail?.dividendRate,
        dividendYield: summaryDetail?.dividendYield,
        exDividendDate: calendarEvents?.exDividendDate,
        dividendDate: calendarEvents?.dividendDate,
        
        // Key statistics
        marketCap: summaryDetail?.marketCap || price?.marketCap,
        beta: defaultKeyStatistics?.beta,
        trailingPE: summaryDetail?.trailingPE,
        forwardPE: summaryDetail?.forwardPE || defaultKeyStatistics?.forwardPE,
        priceToBook: defaultKeyStatistics?.priceToBook,
        fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow,
        fiftyDayAverage: summaryDetail?.fiftyDayAverage,
        twoHundredDayAverage: summaryDetail?.twoHundredDayAverage,
        
        // Listing/founding info
        startDate: assetProfile?.startDate,
        firstTradeDate: defaultKeyStatistics?.lastFiscalYearEnd, // This is approximate
        
        // Source metadata
        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, normalizedSymbol);
    }
  }

  /**
   * Get detailed stock information for a US symbol using quoteSummary
   * (no .IS suffix — direct symbol like AAPL, MSFT)
   *
   * @param symbol - US stock symbol (e.g., "AAPL")
   * @returns Detailed stock information
   */
  async getUsStockDetail(symbol: string): Promise<YahooDetailResult> {
    if (!symbol || typeof symbol !== 'string') {
      throw new YahooFinanceError(
        'INVALID_SYMBOL',
        'Symbol must be a non-empty string'
      );
    }
    const normalizedSymbol = symbol.toUpperCase().trim();
    const yf = await this.init();

    try {
      const result = await yf.quoteSummary(normalizedSymbol, {
        modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics', 'calendarEvents', 'price'],
      }, {
        validateResult: this.config.validateResult,
      });

      if (!result) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No detail data found for symbol: ${normalizedSymbol}`
        );
      }

      const { assetProfile, summaryDetail, defaultKeyStatistics, calendarEvents, price } = result;

      return {
        symbol: normalizedSymbol,
        shortName: price?.shortName || normalizedSymbol,
        longName: price?.longName,
        currency: price?.currency || 'USD',
        exchange: price?.exchangeName || 'NMS',
        sector: assetProfile?.sector,
        industry: assetProfile?.industry,
        website: assetProfile?.website,
        longBusinessSummary: assetProfile?.longBusinessSummary,
        fullTimeEmployees: assetProfile?.fullTimeEmployees,
        city: assetProfile?.city,
        country: assetProfile?.country,
        dividendRate: summaryDetail?.dividendRate,
        dividendYield: summaryDetail?.dividendYield,
        exDividendDate: calendarEvents?.exDividendDate,
        dividendDate: calendarEvents?.dividendDate,
        marketCap: summaryDetail?.marketCap || price?.marketCap,
        beta: defaultKeyStatistics?.beta,
        trailingPE: summaryDetail?.trailingPE,
        forwardPE: summaryDetail?.forwardPE || defaultKeyStatistics?.forwardPE,
        priceToBook: defaultKeyStatistics?.priceToBook,
        fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow,
        fiftyDayAverage: summaryDetail?.fiftyDayAverage,
        twoHundredDayAverage: summaryDetail?.twoHundredDayAverage,
        startDate: assetProfile?.startDate,
        firstTradeDate: defaultKeyStatistics?.lastFiscalYearEnd,
        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, normalizedSymbol);
    }
  }

  /**
   * Get chart/candle data for a US stock symbol (no .IS suffix)
   *
   * @param symbol - US stock symbol (e.g., "AAPL")
   * @param interval - Candle interval (e.g., "1d", "1h")
   * @param range - Data range (e.g., "1mo", "1y")
   * @returns Chart result with candles
   */
  async getUsStockChart(
    symbol: string,
    interval: YahooInterval,
    range: YahooRange
  ): Promise<YahooChartResult> {
    if (!symbol || typeof symbol !== 'string') {
      throw new YahooFinanceError(
        'INVALID_SYMBOL',
        'Symbol must be a non-empty string'
      );
    }
    const normalizedSymbol = symbol.toUpperCase().trim();
    validateYahooInterval(interval);
    validateYahooRange(range);
    const yf = await this.init();

    try {
      const result = await yf.chart(normalizedSymbol, {
        period1: this.getRangePeriod1(range),
        interval,
      }, {
        validateResult: this.config.validateResult,
      });

      if (!result || !result.quotes) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No chart data found for symbol: ${normalizedSymbol}`
        );
      }

      if (result.quotes.length === 0) {
        const meta = result.meta ?? {};
        return {
          symbol: meta.symbol || normalizedSymbol,
          currency: meta.currency || 'USD',
          exchange: meta.exchangeName || 'NMS',
          interval,
          range,
          candles: [],
          firstTradeDate: meta.firstTradeDate ?? undefined,
          regularMarketTime: meta.regularMarketTime ?? undefined,
          gmtOffset: meta.gmtoffset ?? -18000,
          timezone: meta.timezone || 'America/New_York',
          source: 'yahoo',
          fetchedAt: new Date().toISOString(),
        };
      }

      type ChartQuote = {
        date?: Date;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        close?: number | null;
        volume?: number | null;
        adjclose?: number | null;
      };

      const candles: YahooCandle[] = result.quotes
        .filter((q: ChartQuote) => q.date && q.close !== null)
        .map((q: ChartQuote) => ({
          date: q.date!,
          open: q.open ?? q.close!,
          high: q.high ?? q.close!,
          low: q.low ?? q.close!,
          close: q.close!,
          volume: q.volume ?? 0,
          adjClose: q.adjclose,
        }));

      return {
        symbol: result.meta.symbol,
        currency: result.meta.currency || 'USD',
        exchange: result.meta.exchangeName || 'NMS',
        interval,
        range,
        candles,
        firstTradeDate: result.meta.firstTradeDate,
        regularMarketTime: result.meta.regularMarketTime,
        gmtOffset: result.meta.gmtoffset ?? -18000,
        timezone: result.meta.timezone || 'America/New_York',
        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, `${normalizedSymbol} (${interval}, ${range})`);
    }
  }

  /**
   * Get quote data for any symbol (no BIST normalization)
   *
   * @param symbol - Any Yahoo Finance symbol (e.g., "GC=F", "EURUSD=X", "SPY")
   * @returns Normalized quote result
   */
  async getGenericQuote(symbol: string): Promise<YahooQuoteResult> {
    if (!symbol || typeof symbol !== 'string') {
      throw new YahooFinanceError(
        'INVALID_SYMBOL',
        'Symbol must be a non-empty string'
      );
    }
    const normalizedSymbol = symbol.toUpperCase().trim();
    const yf = await this.init();

    try {
      const quote = await yf.quote(normalizedSymbol, {}, {
        validateResult: this.config.validateResult,
      });

      if (!quote) {
        throw new YahooFinanceError(
          'SYMBOL_NOT_FOUND',
          `No quote data found for symbol: ${normalizedSymbol}`
        );
      }

      return {
        symbol: quote.symbol,
        shortName: quote.shortName || quote.symbol,
        longName: quote.longName,
        currency: quote.currency || 'USD',
        exchange: quote.exchange || '',
        exchangeTimezoneName: quote.exchangeTimezoneName || 'America/New_York',
        regularMarketPrice: quote.regularMarketPrice ?? 0,
        regularMarketChange: quote.regularMarketChange ?? 0,
        regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,
        regularMarketVolume: quote.regularMarketVolume,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        marketCap: quote.marketCap,
        regularMarketTime: quote.regularMarketTime,
        source: 'yahoo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeError(error, normalizedSymbol);
    }
  }

  /**
   * Get multiple quotes at once
   *
   * @param symbols - Array of BIST symbols
   * @returns Array of quote results (or errors)
   */
  async getQuotes(
    symbols: string[]
  ): Promise<Array<{ symbol: string; data?: YahooQuoteResult; error?: YahooFinanceError }>> {
    const results: Array<{ symbol: string; data?: YahooQuoteResult; error?: YahooFinanceError }> = [];

    // Process in parallel with limited concurrency (handled by yahoo-finance2 queue)
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const data = await this.getQuote(symbol);
          results.push({ symbol, data });
        } catch (error) {
          results.push({
            symbol,
            error: error instanceof YahooFinanceError
              ? error
              : normalizeError(error, symbol),
          });
        }
      })
    );

    return results;
  }

  /**
   * Calculate period1 date from range string
   */
  private getRangePeriod1(range: YahooRange): Date {
    const now = new Date();
    const result = new Date(now);

    switch (range) {
      case '1d':
        result.setDate(now.getDate() - 1);
        break;
      case '5d':
        result.setDate(now.getDate() - 5);
        break;
      case '1mo':
        result.setMonth(now.getMonth() - 1);
        break;
      case '3mo':
        result.setMonth(now.getMonth() - 3);
        break;
      case '6mo':
        result.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        result.setFullYear(now.getFullYear() - 1);
        break;
      case '2y':
        result.setFullYear(now.getFullYear() - 2);
        break;
      case '5y':
        result.setFullYear(now.getFullYear() - 5);
        break;
      case '10y':
        result.setFullYear(now.getFullYear() - 10);
        break;
      case 'ytd':
        result.setMonth(0);
        result.setDate(1);
        break;
      case 'max':
        result.setFullYear(1970);
        break;
    }

    return result;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<YahooClientConfig>> {
    return { ...this.config };
  }
}

// -----------------------------------------------------------------------------
// FACTORY & SINGLETON
// -----------------------------------------------------------------------------

let defaultClient: YahooClient | null = null;

/**
 * Create a new Yahoo Finance client
 */
export function createYahooClient(config?: YahooClientConfig): YahooClient {
  return new YahooClient(config);
}

/**
 * Get the default singleton Yahoo Finance client
 */
export function getYahooClient(): YahooClient {
  if (!defaultClient) {
    defaultClient = new YahooClient();
  }
  return defaultClient;
}
