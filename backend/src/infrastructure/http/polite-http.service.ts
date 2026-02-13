import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bottleneck from 'bottleneck';
import { LRUCache } from 'lru-cache';

export interface HttpGetOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeoutMs?: number;
  cacheTtlMs?: number;
  retries?: number;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * HTTP request statistics
 */
export interface HttpStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  retries: number;
  cacheHits: number;
  cacheMisses: number;
}

@Injectable()
export class PoliteHttpService {
  private readonly logger = new Logger(PoliteHttpService.name);
  private readonly limiterByHost = new Map<string, Bottleneck>();
  private readonly cache = new LRUCache<
    string,
    { expiresAt: number; value: string }
  >({
    max: 2000,
  });

  // Default timeouts and retries
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetries: number;
  private readonly defaultCacheTtlMs: number;

  // Statistics
  private stats: HttpStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeouts: 0,
    retries: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.defaultTimeoutMs = this.configService.get<number>(
      'HTTP_TIMEOUT_MS',
      8000,
    );
    this.defaultRetries = this.configService.get<number>('HTTP_RETRY_COUNT', 3);
    this.defaultCacheTtlMs = this.configService.get<number>(
      'HTTP_CACHE_TTL_MS',
      0,
    );

    this.logger.log({
      msg: 'HTTP client initialized',
      defaultTimeoutMs: this.defaultTimeoutMs,
      defaultRetries: this.defaultRetries,
    });
  }

  /**
   * Fetch text with:
   * - per-host rate limiting
   * - configurable timeout (default 8 seconds)
   * - retries with exponential backoff
   * - optional in-memory caching
   */
  async getText(url: string, opts: HttpGetOptions = {}): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const retries = opts.retries ?? this.defaultRetries;
    const cacheTtlMs = opts.cacheTtlMs ?? this.defaultCacheTtlMs;

    // Add query params to URL
    const finalUrl = this.buildUrl(url, opts.params);

    const cacheKey = this.cacheKey(finalUrl, opts.headers);
    if (cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.stats.cacheHits++;
        return cached.value;
      }
      this.stats.cacheMisses++;
    }

    const host = new URL(finalUrl).host;
    const limiter = this.getLimiter(host);

    const run = async () => {
      this.stats.totalRequests++;
      let attempt = 0;
      let lastErr: unknown;

      while (attempt <= retries) {
        const startTime = Date.now();

        try {
          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => {
            controller.abort();
            this.stats.timeouts++;
          }, timeoutMs);

          const res = await fetch(finalUrl, {
            method: 'GET',
            headers: opts.headers,
            signal: controller.signal,
          });
          clearTimeout(timeoutHandle);

          const elapsed = Date.now() - startTime;

          // Retry on 429/5xx
          if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
            const body = await res.text();
            this.logger.warn({
              msg: 'HTTP retryable error',
              url: this.truncateUrl(finalUrl),
              status: res.status,
              attempt,
              elapsed,
            });
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
          }

          const text = await res.text();
          if (!res.ok) {
            this.stats.failedRequests++;
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
          }

          if (cacheTtlMs > 0) {
            this.cache.set(cacheKey, {
              value: text,
              expiresAt: Date.now() + cacheTtlMs,
            });
          }

          this.stats.successfulRequests++;
          this.logger.debug({
            msg: 'HTTP request succeeded',
            url: this.truncateUrl(finalUrl),
            status: res.status,
            elapsed,
            size: text.length,
          });

          return text;
        } catch (e) {
          lastErr = e;

          // Check for timeout
          if (e instanceof Error && e.name === 'AbortError') {
            this.logger.warn({
              msg: 'HTTP request timeout',
              url: this.truncateUrl(finalUrl),
              timeoutMs,
              attempt,
            });
            lastErr = new Error(`Request timeout after ${timeoutMs}ms`);
          }

          if (attempt === retries) {
            this.stats.failedRequests++;
            this.logger.error({
              msg: 'HTTP request failed after retries',
              url: this.truncateUrl(finalUrl),
              attempts: attempt + 1,
              error:
                lastErr instanceof Error ? lastErr.message : String(lastErr),
            });
            break;
          }

          this.stats.retries++;
          const delay = this.backoffMs(attempt);
          this.logger.debug({
            msg: 'HTTP retry scheduled',
            url: this.truncateUrl(finalUrl),
            attempt: attempt + 1,
            delayMs: delay,
          });
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error('HTTP request failed');
    };

    return limiter.schedule(run);
  }

  /**
   * GET request returning typed JSON
   */
  async get<T>(
    url: string,
    opts: HttpGetOptions = {},
  ): Promise<HttpResponse<T>> {
    const text = await this.getText(url, {
      ...opts,
      headers: { Accept: 'application/json', ...(opts.headers ?? {}) },
    });
    return {
      data: JSON.parse(text) as T,
      status: 200,
      headers: new Headers(),
    };
  }

  /**
   * GET request returning JSON (legacy method name)
   */
  async getJson<T>(url: string, opts: HttpGetOptions = {}): Promise<T> {
    const response = await this.get<T>(url, opts);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(
    url: string,
    body: unknown,
    opts: HttpGetOptions = {},
  ): Promise<HttpResponse<T>> {
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    const host = new URL(url).host;
    const limiter = this.getLimiter(host);

    const run = async () => {
      this.stats.totalRequests++;
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
        this.stats.timeouts++;
      }, timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(opts.headers ?? {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);

        const elapsed = Date.now() - startTime;
        const text = await res.text();

        if (!res.ok) {
          this.stats.failedRequests++;
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        this.stats.successfulRequests++;
        this.logger.debug({
          msg: 'HTTP POST succeeded',
          url: this.truncateUrl(url),
          status: res.status,
          elapsed,
        });

        return {
          data: text ? (JSON.parse(text) as T) : (null as T),
          status: res.status,
          headers: res.headers,
        };
      } catch (e) {
        clearTimeout(timeoutHandle);

        if (e instanceof Error && e.name === 'AbortError') {
          this.stats.failedRequests++;
          throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        this.stats.failedRequests++;
        throw e;
      }
    };

    return limiter.schedule(run);
  }

  /**
   * Get HTTP statistics
   */
  getStats(): HttpStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 2000,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    url: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const urlObj = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    }
    return urlObj.toString();
  }

  /**
   * Get or create rate limiter for a host
   */
  private getLimiter(host: string): Bottleneck {
    const existing = this.limiterByHost.get(host);
    if (existing) return existing;

    // Host-specific rate limits
    let minTime = 350; // Default: ~3 req/sec
    let maxConcurrent = 2;

    if (host.includes('sec.gov')) {
      minTime = 100; // SEC allows 10 req/sec
      maxConcurrent = 5;
    } else if (host.includes('gdeltproject.org')) {
      minTime = 1000; // GDELT: 1 req/sec
      maxConcurrent = 1;
    } else if (host.includes('kap.org.tr')) {
      minTime = 5000; // KAP: polite 1 req/5sec
      maxConcurrent = 1;
    } else if (host.includes('google.com')) {
      minTime = 2000; // Google: polite 1 req/2sec
      maxConcurrent = 1;
    }

    const limiter = new Bottleneck({
      maxConcurrent,
      minTime,
    });

    this.logger.debug({
      msg: 'Created rate limiter',
      host,
      minTime,
      maxConcurrent,
    });

    this.limiterByHost.set(host, limiter);
    return limiter;
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private backoffMs(attempt: number): number {
    const base = 500 * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(10000, base + jitter);
  }

  /**
   * Generate cache key
   */
  private cacheKey(url: string, headers?: Record<string, string>): string {
    const h = headers
      ? Object.entries(headers)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`)
          .join('|')
      : '';
    return `${url}::${h}`;
  }

  /**
   * Truncate URL for logging
   */
  private truncateUrl(url: string, maxLength = 80): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
}
