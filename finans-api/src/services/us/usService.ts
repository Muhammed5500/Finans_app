/**
 * US market service: Finnhub + caching, request coalescing, stale-if-error.
 */

import { AppError } from '../../utils/errors';
import { TTLCache, createCache } from '../../utils/cache';
import { createLimiter, type Limiter } from '../../utils/limiter';
import { nowUnix, daysAgoUnix } from '../../utils/timeRange';
import { normalizeUsSymbol } from '../../utils/usSymbols';
import { createFinnhubClient, type FinnhubClient } from '../finnhub';
import type { FinnhubQuote, FinnhubCandles } from '../finnhub/types';
import { parseUsInterval, resolveUsInterval, parseRangeDays } from './usTypes';
import type { NormalizedUsQuote, NormalizedUsChart, Candle } from './normalizedTypes';

// -----------------------------------------------------------------------------
// CACHE & STALE
// -----------------------------------------------------------------------------

const QUOTE_TTL_MS = 5000;   // 5 seconds
const CHART_TTL_MS = 60000;  // 60 seconds
const MAX_STALE_MS = 120000; // 120 seconds

const QUOTES_MAX_SYMBOLS = 25;
const QUOTES_CONCURRENCY = 3;

// -----------------------------------------------------------------------------
// NORMALIZATION
// -----------------------------------------------------------------------------

function quoteToNormalized(q: FinnhubQuote, symbol: string, fetchedAt: string): NormalizedUsQuote {
  return {
    symbol,
    market: 'US',
    source: 'finnhub',
    fetchedAt,
    price: q.c != null && Number.isFinite(q.c) ? q.c : null,
    currency: 'USD',
    open: q.o != null && Number.isFinite(q.o) ? q.o : null,
    previousClose: q.pc != null && Number.isFinite(q.pc) ? q.pc : null,
    dayHigh: q.h != null && Number.isFinite(q.h) ? q.h : null,
    dayLow: q.l != null && Number.isFinite(q.l) ? q.l : null,
    change: q.d != null && Number.isFinite(q.d) ? q.d : null,
    changePercent: q.dp != null && Number.isFinite(q.dp) ? q.dp : null,
    timestamp: q.t != null && Number.isFinite(q.t) ? new Date(q.t * 1000).toISOString() : null,
  };
}

/**
 * Convert Finnhub arrays (t,o,h,l,c,v) to Candle[].
 * Removes invalid points, sorts asc by time, dedupes by time.
 * If status s !== "ok", throws PROVIDER_ERROR (caller must check before calling).
 */
function candlesToNormalized(data: FinnhubCandles): Candle[] {
  const { t, o, h, l, c, v } = data;
  const len = Math.min(
    t?.length ?? 0,
    o?.length ?? 0,
    h?.length ?? 0,
    l?.length ?? 0,
    c?.length ?? 0,
    v?.length ?? 0
  );

  const list: Candle[] = [];
  for (let i = 0; i < len; i++) {
    const ts = t[i];
    const close = c[i];
    if (typeof ts !== 'number' || !Number.isFinite(ts) || typeof close !== 'number' || !Number.isFinite(close)) {
      continue;
    }
    const open = typeof o[i] === 'number' && Number.isFinite(o[i]) ? o[i]! : close;
    const high = typeof h[i] === 'number' && Number.isFinite(h[i]) ? h[i]! : close;
    const low = typeof l[i] === 'number' && Number.isFinite(l[i]) ? l[i]! : close;
    const vol = typeof v[i] === 'number' && Number.isFinite(v[i]) ? v[i]! : null;
    list.push({
      time: new Date(ts * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: vol,
    });
  }

  list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const seen = new Set<string>();
  return list.filter((x) => {
    if (seen.has(x.time)) return false;
    seen.add(x.time);
    return true;
  });
}

// -----------------------------------------------------------------------------
// CACHE VALUE TYPES (store normalized shape without `stale`)
// -----------------------------------------------------------------------------

type CachedQuote = NormalizedUsQuote;
type CachedChart = NormalizedUsChart;

// -----------------------------------------------------------------------------
// US SERVICE
// -----------------------------------------------------------------------------

export class UsService {
  private readonly client: FinnhubClient;
  private readonly quoteCache: TTLCache<CachedQuote>;
  private readonly chartCache: TTLCache<CachedChart>;
  private readonly inFlight: Map<string, Promise<unknown>>;
  private readonly quotesLimiter: Limiter;

  constructor(client?: FinnhubClient) {
    this.client = client ?? createFinnhubClient();
    this.quoteCache = createCache<CachedQuote>();
    this.chartCache = createCache<CachedChart>();
    this.inFlight = new Map();
    this.quotesLimiter = createLimiter(QUOTES_CONCURRENCY);
  }

  private async coalesce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Get quote for a US symbol. Cache 5s, coalescing, stale-if-error (120s).
   */
  async getUsQuote(symbolInput: string): Promise<NormalizedUsQuote> {
    const symbol = normalizeUsSymbol(symbolInput);
    const cacheKey = `us:quote:${symbol}`;

    const cached = this.quoteCache.get(cacheKey);
    if (cached) {
      return { ...cached };
    }

    try {
      const fetchedAt = new Date().toISOString();
      const result = await this.coalesce(cacheKey, async () => {
        const recheck = this.quoteCache.get(cacheKey);
        if (recheck) return recheck;

        const q = await this.client.getQuote(symbol);
        const val: CachedQuote = quoteToNormalized(q, symbol, fetchedAt);
        this.quoteCache.set(cacheKey, val, QUOTE_TTL_MS);
        return val;
      });
      return { ...result };
    } catch (e) {
      const stale = this.quoteCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        return { ...stale.value, stale: true };
      }
      if (e instanceof AppError) throw e;
      throw new AppError(502, 'Data provider is temporarily unavailable', 'PROVIDER_ERROR');
    }
  }

  /**
   * Get chart for a US symbol. Cache 60s, coalescing, stale-if-error (120s).
   * intervalInput/rangeDaysInput use parseUsInterval/parseRangeDays with fallbacks.
   */
  async getUsChart(
    symbolInput: string,
    intervalInput?: string,
    rangeDaysInput?: string
  ): Promise<NormalizedUsChart> {
    const symbol = normalizeUsSymbol(symbolInput);
    const intervalStr = resolveUsInterval(intervalInput);
    const rangeDays = parseRangeDays(rangeDaysInput, 5);
    const cacheKey = `us:chart:${symbol}:${intervalStr}:${rangeDays}`;

    const cached = this.chartCache.get(cacheKey);
    if (cached) {
      return { ...cached };
    }

    try {
      const fetchedAt = new Date().toISOString();
      const result = await this.coalesce(cacheKey, async () => {
        const recheck = this.chartCache.get(cacheKey);
        if (recheck) return recheck;

        const resolution = parseUsInterval(intervalStr);
        const to = nowUnix();
        const from = daysAgoUnix(rangeDays);

        const raw = await this.client.getCandles({ symbol, resolution, from, to });

        // If Finnhub returns s !== "ok", treat as provider error and throw.
        if (raw.s !== 'ok') {
          throw new AppError(502, 'Data provider returned no data or error status', 'PROVIDER_ERROR');
        }

        const candles = candlesToNormalized(raw);
        const val: CachedChart = {
          symbol,
          market: 'US',
          source: 'finnhub',
          fetchedAt,
          interval: intervalStr,
          rangeDays,
          candles,
          meta: { candleCount: candles.length },
        };
        this.chartCache.set(cacheKey, val, CHART_TTL_MS);
        return val;
      });
      return { ...result };
    } catch (e) {
      const stale = this.chartCache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        return { ...stale.value, stale: true };
      }
      if (e instanceof AppError) throw e;
      throw new AppError(502, 'Data provider is temporarily unavailable', 'PROVIDER_ERROR');
    }
  }

  /**
   * Get quotes for multiple symbols. Max 25, deduped, concurrency 3.
   * Uses getUsQuote per symbol (cache + coalescing).
   */
  async getUsQuotes(symbolInputs: string[]): Promise<NormalizedUsQuote[]> {
    if (symbolInputs.length > QUOTES_MAX_SYMBOLS) {
      throw new AppError(400, `At most ${QUOTES_MAX_SYMBOLS} symbols allowed`, 'BAD_REQUEST');
    }

    const normalized = symbolInputs.map((s) => normalizeUsSymbol(s));
    const unique = [...new Set(normalized)];

    const results = await Promise.all(
      unique.map((s) => this.quotesLimiter(() => this.getUsQuote(s)))
    );
    return results;
  }
}

/**
 * Factory: creates UsService with a default Finnhub client.
 */
export function createUsService(client?: FinnhubClient): UsService {
  return new UsService(client);
}
