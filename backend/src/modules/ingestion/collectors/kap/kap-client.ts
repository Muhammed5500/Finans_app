import { Logger } from '@nestjs/common';
import { KapCollectorConfig, KapApiResponse } from './kap.types';

/**
 * KAP HTTP Client
 *
 * Generic HTTP client for making requests to KAP endpoints.
 * Supports both GET and POST methods with configurable headers.
 */
export class KapClient {
  private readonly logger = new Logger(KapClient.name);
  private lastRequestTime = 0;

  constructor(private readonly config: KapCollectorConfig) {}

  /**
   * Make a request to KAP endpoint
   */
  async fetch(): Promise<string> {
    // Enforce rate limit
    await this.enforceRateLimit();

    const url = this.buildUrl();
    const options = this.buildFetchOptions();

    this.logger.debug(`Fetching KAP: ${this.config.method} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      this.lastRequestTime = Date.now();

      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch with retries and exponential backoff
   */
  async fetchWithRetry(): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.fetch();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Handle abort (timeout)
        if (lastError.name === 'AbortError') {
          lastError = new Error(
            `Request timeout after ${this.config.timeoutMs}ms`,
          );
        }

        // Don't retry on 4xx errors (except 429)
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Exponential backoff
        const delayMs = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `KAP fetch attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Fetch and parse JSON response
   */
  async fetchJson(): Promise<KapApiResponse> {
    const text = await this.fetchWithRetry();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON response from KAP');
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const path = this.config.queryPath.startsWith('/')
      ? this.config.queryPath
      : `/${this.config.queryPath}`;

    const url = new URL(`${base}${path}`);

    // Add query parameters for GET requests
    if (this.config.method === 'GET' && this.config.queryParams) {
      for (const [key, value] of Object.entries(this.config.queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Build fetch options
   */
  private buildFetchOptions(): RequestInit {
    const options: RequestInit = {
      method: this.config.method,
      headers: {
        ...this.getDefaultHeaders(),
        ...this.config.headers,
      },
    };

    // Add body for POST requests
    if (this.config.method === 'POST' && this.config.body) {
      options.body =
        typeof this.config.body === 'string'
          ? this.config.body
          : JSON.stringify(this.config.body);
    }

    return options;
  }

  /**
   * Get default headers for KAP requests
   */
  private getDefaultHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json, text/html, */*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };
  }

  /**
   * Enforce rate limit (min seconds between requests)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const minInterval = this.config.rateLimitSeconds * 1000;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message;
    if (message.includes('HTTP 4') && !message.includes('HTTP 429')) {
      return true;
    }
    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<KapCollectorConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): KapCollectorConfig {
    return { ...this.config };
  }
}
