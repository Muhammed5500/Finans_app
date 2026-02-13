/**
 * US market types: frontend intervals, range params, and Finnhub resolution mapping.
 */

import { AppError } from '../../utils/errors';
import type { FinnhubResolution } from '../finnhub/types';

// -----------------------------------------------------------------------------
// INTERVALS (frontend) -> Finnhub resolution
// -----------------------------------------------------------------------------

/** Input intervals we accept from the frontend */
export const US_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '1d'] as const;

export type UsInterval = (typeof US_INTERVALS)[number];

/** Map frontend interval to Finnhub /stock/candle resolution */
export const US_INTERVAL_TO_FINNHUB: Record<UsInterval, FinnhubResolution> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '1d': 'D',
};

/**
 * Parse frontend interval to Finnhub resolution.
 * @param input - Query value (e.g. "1m", "1h")
 * @param fallback - Used when input is missing or invalid (default "1h" -> "60")
 * @returns Finnhub resolution
 */
export function parseUsInterval(
  input?: string,
  fallback: UsInterval = '1h'
): FinnhubResolution {
  const key = (input?.trim().toLowerCase() || fallback) as UsInterval;
  return US_INTERVAL_TO_FINNHUB[key] ?? US_INTERVAL_TO_FINNHUB[fallback];
}

/**
 * Resolve frontend interval string (for cache keys and responses).
 * @param input - Query value (e.g. "1m", "1h")
 * @returns Valid UsInterval, or "1h" when missing/invalid
 */
export function resolveUsInterval(input?: string): UsInterval {
  const k = (input?.trim().toLowerCase() || '1h') as UsInterval;
  return US_INTERVALS.includes(k) ? k : '1h';
}

// -----------------------------------------------------------------------------
// RANGE (rangeDays)
// -----------------------------------------------------------------------------

/** Default rangeDays when missing or unparseable */
export const RANGE_DAYS_DEFAULT = 5;

/** Allowed range for rangeDays */
export const RANGE_DAYS_MIN = 1;
export const RANGE_DAYS_MAX = 365;

/**
 * Parse and validate rangeDays query param.
 * @param input - Query value (e.g. "7", "30")
 * @param fallback - Used when input is missing or not a number (default 5)
 * @returns Integer in [1, 365]
 * @throws AppError 400 BAD_REQUEST when value is outside 1..365
 */
export function parseRangeDays(
  input?: string,
  fallback: number = RANGE_DAYS_DEFAULT
): number {
  let n: number;
  if (input == null || input === '') {
    n = fallback;
  } else {
    const parsed = parseInt(String(input).trim(), 10);
    n = Number.isFinite(parsed) ? parsed : fallback;
  }

  if (n < RANGE_DAYS_MIN || n > RANGE_DAYS_MAX) {
    throw new AppError(
      400,
      `rangeDays must be between ${RANGE_DAYS_MIN} and ${RANGE_DAYS_MAX}`,
      'BAD_REQUEST'
    );
  }

  return n;
}
