import axios, { AxiosInstance } from 'axios';
import { AppError } from '../../utils/errors';
import { getRequestPacer } from './requestPacer';
import { FinnhubQuote, FinnhubCandles, FinnhubResolution, isFinnhubResolution } from './types';

// --- Defaults ---
const DEFAULT_BASE_URL = 'https://finnhub.io/api/v1';
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// --- Retry / error helpers ---

function isTransientError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 429) return true;
    if (status != null && status >= 500) return true;
    if (!err.response && err.code) {
      const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN'];
      if (networkCodes.includes(err.code)) return true;
    }
  }
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
      if (attempt === maxRetries - 1 || !isTransientError(err)) {
        throw err;
      }
      const retryAfter = getRetryAfterMs(err);
      const backoffMs = baseBackoffMs * Math.pow(2, attempt);
      const delayMs = retryAfter ?? backoffMs;
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function normalizeToAppError(err: unknown): AppError {
  if (axios.isAxiosError(err) && err.response?.status === 429) {
    return new AppError(
      429,
      'Data provider rate limit exceeded. Consider caching responses or upgrading your Finnhub plan.',
      'PROVIDER_THROTTLED'
    );
  }
  return new AppError(502, 'Data provider is temporarily unavailable', 'PROVIDER_ERROR');
}

// --- FinnhubClient ---

export class FinnhubClient {
  private readonly axios: AxiosInstance;
  private readonly token: string;

  constructor() {
    const baseURL = (process.env.FINNHUB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.token = process.env.FINNHUB_API_KEY || process.env.FINNHUB_TOKEN || '';

    this.axios = axios.create({
      baseURL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    this.axios.interceptors.request.use((config) => {
      config.params = { ...(config.params || {}), token: this.token };
      return config;
    });
  }

  /**
   * Internal request: pacer (min delay + max concurrent) -> retry/backoff -> AppError normalization.
   */
  private async request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    const scheduled = () => getRequestPacer().schedule(fn);
    try {
      const { data } = await requestWithRetry(scheduled, MAX_RETRIES, BASE_BACKOFF_MS);
      return data;
    } catch (err) {
      throw normalizeToAppError(err);
    }
  }

  /**
   * Get quote for a symbol
   * @param symbol e.g. "AAPL"
   */
  async getQuote(symbol: string): Promise<FinnhubQuote> {
    return this.request<FinnhubQuote>(() =>
      this.axios.get<FinnhubQuote>('/quote', { params: { symbol } })
    );
  }

  /**
   * Get stock candles
   * @param params symbol, resolution, from (Unix s), to (Unix s)
   */
  async getCandles(params: {
    symbol: string;
    resolution: FinnhubResolution;
    from: number;
    to: number;
  }): Promise<FinnhubCandles> {
    if (!isFinnhubResolution(params.resolution)) {
      throw new AppError(400, 'Invalid resolution');
    }

    return this.request<FinnhubCandles>(() =>
      this.axios.get<FinnhubCandles>('/stock/candle', {
        params: {
          symbol: params.symbol,
          resolution: params.resolution,
          from: params.from,
          to: params.to,
        },
      })
    );
  }
}

/**
 * Factory: creates a FinnhubClient with env-based config
 */
export function createFinnhubClient(): FinnhubClient {
  return new FinnhubClient();
}
