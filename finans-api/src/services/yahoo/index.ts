/**
 * Yahoo Finance Service
 * 
 * Provides BIST market data through Yahoo Finance API.
 */

// Client
export {
  YahooClient,
  createYahooClient,
  getYahooClient,
  normalizeBistSymbol,
  validateYahooInterval,
  validateYahooRange,
  isValidYahooInterval,
  isValidYahooRange,
} from './yahooClient';

// Service (with caching and request coalescing)
export {
  YahooService,
  createYahooService,
  getYahooService,
  // Response types
  type YahooQuoteResponse,
  type YahooChartResponse,
  type YahooDetailResponse,
  type NormalizedCandle,
  type ChartMeta,
  // Interval helpers
  SUPPORTED_INTERVALS,
  type SupportedInterval,
  isSupportedInterval,
  mapInterval,
} from './yahooService';

// Types
export {
  // Constants
  YAHOO_INTERVALS,
  YAHOO_RANGES,
  BIST_SUFFIX,
  BIST_SYMBOL_REGEX,

  // Types
  type YahooInterval,
  type YahooRange,
  type YahooQuoteResult,
  type YahooChartResult,
  type YahooCandle,
  type YahooDetailResult,
  type YahooError,
  type YahooErrorCode,
  type YahooClientConfig,

  // Error class
  YahooFinanceError,
} from './types';
