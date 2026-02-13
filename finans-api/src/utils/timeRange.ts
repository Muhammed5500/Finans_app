/**
 * Helpers for candle query ranges using UNIX timestamps (seconds).
 */

const SECONDS_PER_DAY = 86400;

/**
 * Current time as UNIX timestamp (seconds).
 */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * UNIX timestamp (seconds) for N days ago from now.
 */
export function daysAgoUnix(days: number): number {
  return nowUnix() - days * SECONDS_PER_DAY;
}

/**
 * Clamp days to [min, max]. Non-finite values resolve to min.
 */
export function clampDays(days: number, min: number = 1, max: number = 365): number {
  const d = Number(days);
  if (!Number.isFinite(d)) return min;
  return Math.max(min, Math.min(max, Math.floor(d)));
}
