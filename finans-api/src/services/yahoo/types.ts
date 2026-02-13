/**
 * Yahoo Finance Types for BIST Market Data
 */

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

/**
 * Valid intervals for chart data
 */
export const YAHOO_INTERVALS = [
  '1m', '2m', '5m', '15m', '30m', '60m', '90m',
  '1h', '1d', '5d', '1wk', '1mo', '3mo',
] as const;

export type YahooInterval = typeof YAHOO_INTERVALS[number];

/**
 * Valid ranges for chart data
 */
export const YAHOO_RANGES = [
  '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max',
] as const;

export type YahooRange = typeof YAHOO_RANGES[number];

/**
 * BIST stock exchange suffix
 */
export const BIST_SUFFIX = '.IS';

/**
 * Regex for validating BIST symbol format (without suffix)
 * BIST symbols:
 * - Stocks: 3-6 uppercase letters (e.g., THYAO, GARAN)
 * - Indices: Start with X, 3-6 chars with letters/numbers (e.g., XU100, XU030, XBANK)
 */
export const BIST_SYMBOL_REGEX = /^([A-Z]{3,6}|X[A-Z0-9]{2,5})$/;

// -----------------------------------------------------------------------------
// QUOTE TYPES
// -----------------------------------------------------------------------------

/**
 * Normalized quote result from Yahoo Finance
 */
export interface YahooQuoteResult {
  symbol: string;              // Original symbol with .IS suffix
  shortName: string;           // Company short name
  longName?: string;           // Company full name
  currency: string;            // Currency (TRY for BIST)
  exchange: string;            // Exchange name
  exchangeTimezoneName: string;
  
  // Price data
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketPreviousClose?: number;
  
  // 52-week data
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  
  // Market cap
  marketCap?: number;
  
  // Timestamps
  regularMarketTime?: Date;
  
  // Source metadata
  source: 'yahoo';
  fetchedAt: string;
}

// -----------------------------------------------------------------------------
// CHART TYPES
// -----------------------------------------------------------------------------

/**
 * Single candle/bar in chart data
 */
export interface YahooCandle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

/**
 * Chart result from Yahoo Finance
 */
export interface YahooChartResult {
  symbol: string;
  currency: string;
  exchange: string;
  interval: YahooInterval;
  range: YahooRange;
  
  // Candle data
  candles: YahooCandle[];
  
  // Metadata
  firstTradeDate?: Date;
  regularMarketTime?: Date;
  gmtOffset: number;
  timezone: string;
  
  // Source metadata
  source: 'yahoo';
  fetchedAt: string;
}

// -----------------------------------------------------------------------------
// DETAIL TYPES (quoteSummary)
// -----------------------------------------------------------------------------

/**
 * Detailed stock information from quoteSummary
 */
export interface YahooDetailResult {
  symbol: string;
  
  // Basic info
  shortName: string;
  longName?: string;
  currency: string;
  exchange: string;
  
  // Company profile
  sector?: string;
  industry?: string;
  website?: string;
  longBusinessSummary?: string;
  fullTimeEmployees?: number;
  city?: string;
  country?: string;
  
  // Dividend info
  dividendRate?: number;        // Annual dividend per share
  dividendYield?: number;       // Dividend yield percentage
  exDividendDate?: Date;        // Ex-dividend date
  dividendDate?: Date;          // Last dividend payment date
  
  // Key statistics
  marketCap?: number;
  beta?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  
  // Listing/founding info
  startDate?: Date;             // Company start/founded date
  firstTradeDate?: Date;        // First trade date on exchange
  
  // Source metadata
  source: 'yahoo';
  fetchedAt: string;
}

// -----------------------------------------------------------------------------
// ERROR TYPES
// -----------------------------------------------------------------------------

/**
 * Error codes for Yahoo Finance operations
 */
export type YahooErrorCode =
  | 'INVALID_SYMBOL'
  | 'SYMBOL_NOT_FOUND'
  | 'INVALID_INTERVAL'
  | 'INVALID_RANGE'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT'
  | 'PROVIDER_THROTTLED'  // Yahoo blocking/throttling us
  | 'PROVIDER_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Normalized error shape for Yahoo Finance operations
 */
export interface YahooError {
  code: YahooErrorCode;
  message: string;
  cause?: unknown;
}

/**
 * Custom error class for Yahoo Finance operations
 */
export class YahooFinanceError extends Error {
  readonly code: YahooErrorCode;
  readonly cause?: unknown;

  constructor(code: YahooErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'YahooFinanceError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, YahooFinanceError.prototype);
  }

  toJSON(): YahooError {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

// -----------------------------------------------------------------------------
// CLIENT CONFIG
// -----------------------------------------------------------------------------

/**
 * Configuration options for Yahoo Finance client
 */
export interface YahooClientConfig {
  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Whether to validate responses
   * @default false (yahoo-finance2 validates internally)
   */
  validateResult?: boolean;
}
