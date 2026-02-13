/**
 * Finnhub API types
 * @see https://finnhub.io/docs/api/quote
 * @see https://finnhub.io/docs/api/stock-candles
 */

// -----------------------------------------------------------------------------
// RESOLUTION
// -----------------------------------------------------------------------------

/**
 * Candlestick resolution for /stock/candle.
 * 1,5,15,30,60 = minutes; D = day; W = week; M = month.
 */
export type FinnhubResolution = '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M';

export const FINNHUB_RESOLUTIONS: FinnhubResolution[] = [
  '1', '5', '15', '30', '60', 'D', 'W', 'M',
];

export function isFinnhubResolution(s: string): s is FinnhubResolution {
  return (FINNHUB_RESOLUTIONS as string[]).includes(s);
}

// -----------------------------------------------------------------------------
// QUOTE
// -----------------------------------------------------------------------------

/**
 * Quote response from GET /quote
 * c=current, d=change, dp=percent change, h=high, l=low, o=open, pc=previous close, t=timestamp
 */
export interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // percent change
  h: number;   // high price of the day
  l: number;   // low price of the day
  o: number;   // open price of the day
  pc: number;  // previous close price
  t: number;   // timestamp (Unix)
}

// -----------------------------------------------------------------------------
// STOCK CANDLES
// -----------------------------------------------------------------------------

/**
 * Stock candles response from GET /stock/candle
 * c,h,l,o,t,v = arrays; s = status "ok" | "no_data"
 */
export interface FinnhubCandles {
  c: number[];   // close
  h: number[];   // high
  l: number[];   // low
  o: number[];   // open
  t: number[];   // timestamp (Unix)
  v: number[];   // volume
  s: string;    // status: "ok" | "no_data"
}
