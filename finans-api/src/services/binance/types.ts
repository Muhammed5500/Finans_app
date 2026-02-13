/**
 * Binance kline intervals (spot).
 * @see https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
export const BINANCE_KLINE_INTERVALS = [
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
] as const;

export type BinanceKlineInterval = typeof BINANCE_KLINE_INTERVALS[number];

/** Symbol format: 5–20 alphanumeric uppercase, e.g. BTCUSDT */
export const SYMBOL_REGEX = /^[A-Z0-9]{5,20}$/;

// --- Response types ---

export interface BinancePrice {
  symbol: string;
  price: string;
}

export interface Ticker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * Raw kline tuple from Binance API:
 * [openTime, open, high, low, close, volume, closeTime, quoteVolume, count, takerBuyVolume, takerBuyQuoteVolume, ignore]
 */
export type Kline = [
  number,  // openTime
  string,  // open
  string,  // high
  string,  // low
  string,  // close
  string,  // volume
  number,  // closeTime
  string,  // quoteVolume
  number,  // count
  string,  // takerBuyVolume
  string,  // takerBuyQuoteVolume
  string,  // ignore
];

/** Client configuration */
export interface BinanceClientConfig {
  baseURL: string;
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
}
