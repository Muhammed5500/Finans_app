/**
 * US stock symbol normalization (e.g. for Finnhub: AAPL, MSFT, BRK.B).
 * No market suffixes; simple tickers only.
 */

import { AppError } from './errors';

/**
 * Regex for simple US tickers: first char A-Z, then 0–9 chars from [A-Z0-9.-].
 * Supports BRK.B, BF-B etc. Rejects spaces and slashes.
 */
export const US_SYMBOL_REGEX = /^[A-Z][A-Z0-9.-]{0,9}$/;

/**
 * Normalize a US symbol: trim, uppercase, validate format.
 *
 * Accepts: AAPL, msft, brk.b, BF-B
 * Rejects: spaces, slashes, empty, symbols that don’t match /^[A-Z][A-Z0-9.-]{0,9}$/
 *
 * @param input - User input
 * @returns Normalized ticker (e.g. AAPL, BRK.B)
 * @throws AppError 400 BAD_REQUEST if invalid
 */
export function normalizeUsSymbol(input: string): string {
  if (input == null || typeof input !== 'string') {
    throw new AppError(400, 'Invalid US symbol format', 'BAD_REQUEST');
  }

  const normalized = input.trim().toUpperCase();

  if (!US_SYMBOL_REGEX.test(normalized)) {
    throw new AppError(400, 'Invalid US symbol format', 'BAD_REQUEST');
  }

  return normalized;
}
