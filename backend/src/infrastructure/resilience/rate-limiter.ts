import { Logger } from '@nestjs/common';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Minimum time between requests in milliseconds */
  minIntervalMs?: number;
  /** Name for logging */
  name: string;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  requestsInWindow: number;
  maxRequests: number;
  windowMs: number;
  minIntervalMs: number;
  lastRequestTime: number | null;
  windowStartTime: number;
  waitingRequests: number;
}

/**
 * RateLimiter
 *
 * Token bucket rate limiter with sliding window.
 *
 * Features:
 * - Maximum requests per time window
 * - Minimum interval between requests
 * - Automatic waiting (non-blocking)
 * - Statistics tracking
 */
export class RateLimiter {
  private readonly logger: Logger;
  private requestsInWindow = 0;
  private windowStartTime = Date.now();
  private lastRequestTime: number | null = null;
  private waitQueue: Array<() => void> = [];
  private readonly minIntervalMs: number;

  constructor(private readonly config: RateLimiterConfig) {
    this.logger = new Logger(`RateLimiter:${config.name}`);
    this.minIntervalMs = config.minIntervalMs ?? 0;
  }

  /**
   * Wait until a request is allowed
   * Returns the actual wait time in milliseconds
   */
  async acquire(): Promise<number> {
    const waitTime = await this.calculateWaitTime();

    if (waitTime > 0) {
      this.logger.debug({
        msg: 'Rate limit delay',
        waitTimeMs: waitTime,
        requestsInWindow: this.requestsInWindow,
      });
      await this.wait(waitTime);
    }

    this.recordRequest();
    return waitTime;
  }

  /**
   * Check if a request is allowed without waiting
   */
  isAllowed(): boolean {
    this.slideWindow();
    return (
      this.requestsInWindow < this.config.maxRequests && this.checkMinInterval()
    );
  }

  /**
   * Calculate how long to wait before next request is allowed
   */
  private async calculateWaitTime(): Promise<number> {
    this.slideWindow();

    let waitTime = 0;

    // Check window limit
    if (this.requestsInWindow >= this.config.maxRequests) {
      const windowRemaining =
        this.config.windowMs - (Date.now() - this.windowStartTime);
      waitTime = Math.max(waitTime, windowRemaining);
    }

    // Check minimum interval
    if (this.lastRequestTime && this.minIntervalMs > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.minIntervalMs) {
        waitTime = Math.max(waitTime, this.minIntervalMs - elapsed);
      }
    }

    return Math.max(0, waitTime);
  }

  /**
   * Check if minimum interval has passed
   */
  private checkMinInterval(): boolean {
    if (!this.lastRequestTime || this.minIntervalMs === 0) {
      return true;
    }
    return Date.now() - this.lastRequestTime >= this.minIntervalMs;
  }

  /**
   * Slide the window if needed
   */
  private slideWindow(): void {
    const now = Date.now();
    const elapsed = now - this.windowStartTime;

    if (elapsed >= this.config.windowMs) {
      // Reset window
      this.requestsInWindow = 0;
      this.windowStartTime = now;
    }
  }

  /**
   * Record a request
   */
  private recordRequest(): void {
    this.requestsInWindow++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get rate limiter statistics
   */
  getStats(): RateLimiterStats {
    this.slideWindow();
    return {
      requestsInWindow: this.requestsInWindow,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      minIntervalMs: this.minIntervalMs,
      lastRequestTime: this.lastRequestTime,
      windowStartTime: this.windowStartTime,
      waitingRequests: this.waitQueue.length,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestsInWindow = 0;
    this.windowStartTime = Date.now();
    this.lastRequestTime = null;
    this.logger.debug('Rate limiter reset');
  }
}

/**
 * Global rate limiters registry
 */
export class RateLimiterRegistry {
  private static instance: RateLimiterRegistry;
  private readonly limiters = new Map<string, RateLimiter>();
  private readonly logger = new Logger('RateLimiterRegistry');

  private constructor() {}

  static getInstance(): RateLimiterRegistry {
    if (!RateLimiterRegistry.instance) {
      RateLimiterRegistry.instance = new RateLimiterRegistry();
    }
    return RateLimiterRegistry.instance;
  }

  /**
   * Get or create a rate limiter
   */
  getLimiter(config: RateLimiterConfig): RateLimiter {
    let limiter = this.limiters.get(config.name);

    if (!limiter) {
      limiter = new RateLimiter(config);
      this.limiters.set(config.name, limiter);
      this.logger.debug({
        msg: 'Created rate limiter',
        name: config.name,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        minIntervalMs: config.minIntervalMs,
      });
    }

    return limiter;
  }

  /**
   * Get all rate limiter stats
   */
  getAllStats(): Record<string, RateLimiterStats> {
    const stats: Record<string, RateLimiterStats> = {};
    for (const [name, limiter] of this.limiters) {
      stats[name] = limiter.getStats();
    }
    return stats;
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}
