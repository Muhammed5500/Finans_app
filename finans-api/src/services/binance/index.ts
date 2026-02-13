// Client and factory
export {
  BinanceClient,
  createBinanceClient,
  validateSymbol,
  validateInterval,
  isValidSymbol,
  isValidInterval,
} from './binanceClient';

// Service with caching
export {
  BinanceService,
  createBinanceService,
  type PriceResponse,
  type Ticker24hrResponse,
  type KlinesResponse,
} from './binanceService';

// WebSocket
export {
  BinanceWebSocket,
  getBinanceWebSocket,
  shutdownBinanceWebSocket,
  type PriceData,
} from './binanceWebSocket';

// Mock data (for fallback when API unavailable)
export {
  getMockPrice,
  getMockPrices,
  getMock24hr,
  getMockKlines,
  hasMockData,
  getMockSymbols,
} from './mockData';

// Types
export {
  BINANCE_KLINE_INTERVALS,
  SYMBOL_REGEX,
  type BinanceKlineInterval,
  type BinancePrice,
  type Ticker24hr,
  type Kline,
  type BinanceClientConfig,
} from './types';
