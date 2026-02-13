/**
 * Mock data for when Binance API is unavailable (e.g., network restrictions)
 */

export interface MockPrice {
  symbol: string;
  basePrice: number;
  volatility: number; // percentage variation
}

// Base prices with realistic values (as of 2024)
const MOCK_BASE_PRICES: MockPrice[] = [
  { symbol: 'BTCUSDT', basePrice: 43500, volatility: 2 },
  { symbol: 'ETHUSDT', basePrice: 2650, volatility: 3 },
  { symbol: 'BNBUSDT', basePrice: 315, volatility: 2.5 },
  { symbol: 'SOLUSDT', basePrice: 98, volatility: 4 },
  { symbol: 'XRPUSDT', basePrice: 0.62, volatility: 3 },
  { symbol: 'ADAUSDT', basePrice: 0.52, volatility: 3.5 },
  { symbol: 'DOGEUSDT', basePrice: 0.082, volatility: 5 },
  { symbol: 'DOTUSDT', basePrice: 7.5, volatility: 3 },
  { symbol: 'MATICUSDT', basePrice: 0.85, volatility: 4 },
  { symbol: 'LINKUSDT', basePrice: 15.2, volatility: 3.5 },
  { symbol: 'AVAXUSDT', basePrice: 38, volatility: 4 },
  { symbol: 'ATOMUSDT', basePrice: 9.8, volatility: 3 },
  { symbol: 'LTCUSDT', basePrice: 72, volatility: 2.5 },
  { symbol: 'UNIUSDT', basePrice: 6.2, volatility: 4 },
  { symbol: 'SHIBUSDT', basePrice: 0.0000092, volatility: 6 },
];

// Store for consistent prices within a session
const priceCache: Map<string, { price: number; lastUpdate: number }> = new Map();
const PRICE_UPDATE_INTERVAL = 5000; // Update prices every 5 seconds

/**
 * Get a simulated price with small random variations
 */
function getSimulatedPrice(mock: MockPrice): number {
  const cached = priceCache.get(mock.symbol);
  const now = Date.now();

  // Return cached price if recent
  if (cached && now - cached.lastUpdate < PRICE_UPDATE_INTERVAL) {
    return cached.price;
  }

  // Calculate new price with random variation
  const variation = (Math.random() - 0.5) * 2 * (mock.volatility / 100);
  const basePrice = cached?.price ?? mock.basePrice;
  const newPrice = basePrice * (1 + variation);

  // Keep price within reasonable bounds (±10% of base)
  const minPrice = mock.basePrice * 0.9;
  const maxPrice = mock.basePrice * 1.1;
  const boundedPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

  priceCache.set(mock.symbol, { price: boundedPrice, lastUpdate: now });
  return boundedPrice;
}

/**
 * Format price string based on value magnitude
 */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toFixed(10);
}

/**
 * Get mock price for a symbol
 */
export function getMockPrice(symbol: string): { symbol: string; price: string } | null {
  const mock = MOCK_BASE_PRICES.find((m) => m.symbol === symbol.toUpperCase());
  if (!mock) return null;

  const price = getSimulatedPrice(mock);
  return {
    symbol: mock.symbol,
    price: formatPrice(price),
  };
}

/**
 * Get mock prices for multiple symbols
 */
export function getMockPrices(symbols?: string[]): Array<{ symbol: string; price: string }> {
  if (!symbols || symbols.length === 0) {
    return MOCK_BASE_PRICES.map((mock) => ({
      symbol: mock.symbol,
      price: formatPrice(getSimulatedPrice(mock)),
    }));
  }

  return symbols
    .map((s) => getMockPrice(s.toUpperCase()))
    .filter((p): p is { symbol: string; price: string } => p !== null);
}

/**
 * Get mock 24hr ticker
 */
export function getMock24hr(symbol: string): Record<string, string> | null {
  const mock = MOCK_BASE_PRICES.find((m) => m.symbol === symbol.toUpperCase());
  if (!mock) return null;

  const currentPrice = getSimulatedPrice(mock);
  const openPrice = mock.basePrice;
  const priceChange = currentPrice - openPrice;
  const priceChangePercent = (priceChange / openPrice) * 100;
  const highPrice = Math.max(currentPrice, openPrice) * (1 + mock.volatility / 200);
  const lowPrice = Math.min(currentPrice, openPrice) * (1 - mock.volatility / 200);
  const volume = mock.basePrice * 1000 * (1 + Math.random() * 0.5);

  return {
    symbol: mock.symbol,
    priceChange: priceChange.toFixed(8),
    priceChangePercent: priceChangePercent.toFixed(2),
    weightedAvgPrice: ((currentPrice + openPrice) / 2).toFixed(8),
    prevClosePrice: openPrice.toFixed(8),
    lastPrice: formatPrice(currentPrice),
    bidPrice: (currentPrice * 0.9999).toFixed(8),
    askPrice: (currentPrice * 1.0001).toFixed(8),
    openPrice: openPrice.toFixed(8),
    highPrice: highPrice.toFixed(8),
    lowPrice: lowPrice.toFixed(8),
    volume: volume.toFixed(2),
    quoteVolume: (volume * currentPrice).toFixed(2),
    openTime: (Date.now() - 86400000).toString(),
    closeTime: Date.now().toString(),
    count: Math.floor(10000 + Math.random() * 50000).toString(),
  };
}

/**
 * Generate mock kline data
 */
export function getMockKlines(
  symbol: string,
  interval: string,
  limit: number = 100
): Array<(string | number)[]> | null {
  const mock = MOCK_BASE_PRICES.find((m) => m.symbol === symbol.toUpperCase());
  if (!mock) return null;

  const klines: Array<(string | number)[]> = [];
  const intervalMs = getIntervalMs(interval);
  const now = Date.now();
  let price = mock.basePrice;

  for (let i = limit - 1; i >= 0; i--) {
    const openTime = now - (i + 1) * intervalMs;
    const closeTime = openTime + intervalMs - 1;

    // Random price movement
    const change = (Math.random() - 0.5) * 2 * (mock.volatility / 100);
    const open = price;
    price = price * (1 + change);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = mock.basePrice * 100 * (0.5 + Math.random());

    klines.push([
      openTime,
      formatPrice(open),
      formatPrice(high),
      formatPrice(low),
      formatPrice(close),
      volume.toFixed(4),
      closeTime,
      (volume * ((open + close) / 2)).toFixed(2),
      Math.floor(100 + Math.random() * 1000),
      (volume * 0.5).toFixed(4),
      ((volume * 0.5) * ((open + close) / 2)).toFixed(2),
      '0',
    ]);
  }

  return klines;
}

/**
 * Convert interval string to milliseconds
 */
function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1s': 1000,
    '1m': 60000,
    '3m': 180000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '6h': 21600000,
    '8h': 28800000,
    '12h': 43200000,
    '1d': 86400000,
    '3d': 259200000,
    '1w': 604800000,
    '1M': 2592000000,
  };
  return map[interval] || 3600000;
}

/**
 * Check if mock data is available for a symbol
 */
export function hasMockData(symbol: string): boolean {
  return MOCK_BASE_PRICES.some((m) => m.symbol === symbol.toUpperCase());
}

/**
 * Get all supported mock symbols
 */
export function getMockSymbols(): string[] {
  return MOCK_BASE_PRICES.map((m) => m.symbol);
}
