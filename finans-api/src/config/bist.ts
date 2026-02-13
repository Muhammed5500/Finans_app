/**
 * BIST (Borsa Istanbul) Configuration
 */

import { YahooRange, SupportedInterval } from '../services/yahoo';

// -----------------------------------------------------------------------------
// DEFAULT SYMBOLS
// -----------------------------------------------------------------------------

/**
 * Default BIST symbols to return when no symbols are specified
 * Popular blue-chip stocks from BIST30
 */
export const BIST_DEFAULT_SYMBOLS = [
  'THYAO',  // Turkish Airlines
  'GARAN',  // Garanti Bank
  'AKBNK',  // Akbank
  'KCHOL',  // Koc Holding
  'ASELS',  // Aselsan
  'SISE',   // Sisecam
  'EREGL',  // Eregli Demir Celik
  'BIMAS',  // BIM
  'SAHOL',  // Sabanci Holding
  'TUPRS',  // Tupras
] as const;

export type DefaultBistSymbol = typeof BIST_DEFAULT_SYMBOLS[number];

// -----------------------------------------------------------------------------
// DEFAULT CHART PARAMETERS
// -----------------------------------------------------------------------------

/**
 * Default interval for chart/candle data
 * Supported: 1m, 5m, 15m, 30m, 1h, 4h, 1d
 */
export const BIST_DEFAULT_INTERVAL: SupportedInterval = '1h';

/**
 * Default range for chart/candle data
 */
export const BIST_DEFAULT_RANGE: YahooRange = '5d';

// -----------------------------------------------------------------------------
// LIMITS
// -----------------------------------------------------------------------------

/**
 * Maximum number of symbols that can be requested at once
 */
export const MAX_SYMBOLS_PER_REQUEST = 25;

// -----------------------------------------------------------------------------
// BIST SUFFIX
// -----------------------------------------------------------------------------

/**
 * Yahoo Finance suffix for BIST stocks
 */
export const BIST_YAHOO_SUFFIX = '.IS';
