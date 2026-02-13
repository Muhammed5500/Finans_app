/**
 * Normalized US market types for API responses.
 * Quote from Finnhub; chart candles in a generic Candle shape.
 */

export type NormalizedUsQuote = {
  symbol: string;
  market: 'US';
  source: 'finnhub';
  fetchedAt: string;
  stale?: boolean;

  price: number | null;
  currency: 'USD';
  open?: number | null;
  previousClose?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  change?: number | null;
  changePercent?: number | null;
  timestamp?: string | null;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type NormalizedUsChart = {
  symbol: string;
  market: 'US';
  source: 'finnhub';
  fetchedAt: string;
  stale?: boolean;

  interval: string;
  rangeDays: number;
  candles: Candle[];
  meta?: Record<string, unknown>;
};
