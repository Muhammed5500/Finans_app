import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  BINANCE_KLINE_INTERVALS,
  SYMBOL_REGEX,
  BinanceKlineInterval,
  BinancePrice,
  Ticker24hr,
  Kline,
  BinanceClientConfig,
} from './types';

// --- Defaults ---
const DEFAULT_BASE_URL = 'https://api.binance.com';
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// --- Validation functions (exported for unit-like testing) ---

/**
 * Validate symbol format (uppercase alphanumeric, 5-20 chars)
 * @throws Error if invalid
 */
export function validateSymbol(symbol: string): void {
  if (typeof symbol !== 'string') {
    throw new Error(`Invalid symbol: expected string, got ${typeof symbol}`);
  }
  const normalized = symbol.toUpperCase();
  if (!SYMBOL_REGEX.test(normalized)) {
    throw new Error(
      `Invalid symbol: must match /^[A-Z0-9]{5,20}$/ (got: "${symbol}")`
    );
  }
}

/**
 * Validate kline interval
 * @throws Error if invalid
 */
export function validateInterval(
  interval: string
): asserts interval is BinanceKlineInterval {
  if (!BINANCE_KLINE_INTERVALS.includes(interval as BinanceKlineInterval)) {
    throw new Error(
      `Invalid interval: must be one of [${BINANCE_KLINE_INTERVALS.join(', ')}] (got: "${interval}")`
    );
  }
}

/**
 * Check if a symbol string is valid (non-throwing)
 */
export function isValidSymbol(symbol: string): boolean {
  if (typeof symbol !== 'string') return false;
  return SYMBOL_REGEX.test(symbol.toUpperCase());
}

/**
 * Check if an interval string is valid (non-throwing)
 */
export function isValidInterval(interval: string): boolean {
  return BINANCE_KLINE_INTERVALS.includes(interval as BinanceKlineInterval);
}

// --- Retry / error helpers ---

function isTransientError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    // 429 = rate limited, 5xx = server errors
    if (status === 429) return true;
    if (status != null && status >= 500) return true;
    // Network errors (no response)
    if (!err.response && err.code) {
      const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'];
      if (networkCodes.includes(err.code)) return true;
    }
  }
  // Generic network-like errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnreset')) {
      return true;
    }
  }
  return false;
}

function getRetryAfterMs(err: unknown): number | null {
  if (axios.isAxiosError(err)) {
    const header = err.response?.headers?.['retry-after'];
    if (header == null) return null;
    const seconds = parseInt(String(header), 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a request with retry logic for transient errors
 */
async function requestWithRetry<T>(
  request: () => Promise<T>,
  maxRetries: number,
  baseBackoffMs: number
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await request();
    } catch (err) {
      lastError = err;

      // Don't retry on last attempt or non-transient errors
      if (attempt === maxRetries - 1 || !isTransientError(err)) {
        throw err;
      }

      // Calculate delay: use Retry-After if present, else exponential backoff
      const retryAfter = getRetryAfterMs(err);
      const backoffMs = baseBackoffMs * Math.pow(2, attempt);
      const delayMs = retryAfter ?? backoffMs;

      await sleep(delayMs);
    }
  }

  throw lastError;
}

// --- BinanceClient class ---

export class BinanceClient {
  private readonly axios: AxiosInstance;
  private readonly config: BinanceClientConfig;

  constructor(config?: Partial<BinanceClientConfig>) {
    const baseURL =
      config?.baseURL ??
      process.env.BINANCE_BASE_URL ??
      DEFAULT_BASE_URL;

    this.config = {
      baseURL: baseURL.replace(/\/$/, ''), // remove trailing slash
      timeoutMs: config?.timeoutMs ?? REQUEST_TIMEOUT_MS,
      maxRetries: config?.maxRetries ?? MAX_RETRIES,
      baseBackoffMs: config?.baseBackoffMs ?? BASE_BACKOFF_MS,
    };

    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get price for a single symbol
   * @param symbol e.g. "BTCUSDT"
   */
  async getPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    const normalizedSymbol = symbol.toUpperCase();
    validateSymbol(normalizedSymbol);

    const { data } = await this.request<BinancePrice>(
      '/api/v3/ticker/price',
      { symbol: normalizedSymbol }
    );

    return { symbol: data.symbol, price: data.price };
  }

  /**
   * Get prices for multiple symbols (or all if no symbols provided)
   * @param symbols Optional array of symbols; if omitted, returns all
   */
  async getPrices(
    symbols?: string[]
  ): Promise<Array<{ symbol: string; price: string }>> {
    // Validate symbols if provided
    if (symbols && symbols.length > 0) {
      const normalizedSymbols = symbols.map((s) => s.toUpperCase());
      for (const s of normalizedSymbols) {
        validateSymbol(s);
      }

      // Fetch all prices and filter (efficient single request)
      const { data } = await this.request<BinancePrice[]>('/api/v3/ticker/price');
      const symbolSet = new Set(normalizedSymbols);

      return data
        .filter((p) => symbolSet.has(p.symbol))
        .map((p) => ({ symbol: p.symbol, price: p.price }));
    }

    // No symbols: return all
    const { data } = await this.request<BinancePrice[]>('/api/v3/ticker/price');
    return Array.isArray(data)
      ? data.map((p) => ({ symbol: p.symbol, price: p.price }))
      : [];
  }

  /**
   * Get 24hr ticker statistics for a symbol
   * @param symbol e.g. "BTCUSDT"
   */
  async get24hr(symbol: string): Promise<Ticker24hr> {
    const normalizedSymbol = symbol.toUpperCase();
    validateSymbol(normalizedSymbol);

    const { data } = await this.request<Ticker24hr>(
      '/api/v3/ticker/24hr',
      { symbol: normalizedSymbol }
    );

    return data;
  }

  /**
   * Get 24hr ticker statistics for ALL symbols (single API call)
   * Returns ~2000 tickers, caller should filter to desired symbols
   */
  async getAll24hr(): Promise<Ticker24hr[]> {
    const { data } = await this.request<Ticker24hr[]>('/api/v3/ticker/24hr');
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get kline/candlestick data
   * @param symbol e.g. "BTCUSDT"
   * @param interval e.g. "1h", "4h", "1d"
   * @param limit Optional number of klines (default 500, max 1000)
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit?: number
  ): Promise<Kline[]> {
    const normalizedSymbol = symbol.toUpperCase();
    validateSymbol(normalizedSymbol);
    validateInterval(interval);

    const params: Record<string, string | number> = {
      symbol: normalizedSymbol,
      interval,
    };

    if (limit != null) {
      if (limit < 1 || limit > 1000) {
        throw new Error('limit must be between 1 and 1000');
      }
      params.limit = limit;
    }

    const { data } = await this.request<Kline[]>('/api/v3/klines', params);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Internal request wrapper with retry logic
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<{ data: T }> {
    return requestWithRetry(
      () => this.axios.get<T>(endpoint, { params }),
      this.config.maxRetries,
      this.config.baseBackoffMs
    );
  }

  /**
   * Get current configuration (for debugging/testing)
   */
  getConfig(): Readonly<BinanceClientConfig> {
    return { ...this.config };
  }
}

/**
 * Factory function: creates a BinanceClient with env-based config
 */
export function createBinanceClient(
  config?: Partial<BinanceClientConfig>
): BinanceClient {
  return new BinanceClient(config);
}
