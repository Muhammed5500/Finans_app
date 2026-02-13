import { Logger } from '@nestjs/common';

/**
 * Collector job context for structured logging
 */
export interface CollectorContext {
  collector: string;
  jobId: string;
  query?: string;
  feed?: string;
}

/**
 * Collector operation result for logging
 */
export interface CollectorResult {
  itemsFound: number;
  itemsNew: number;
  itemsSkipped?: number;
  durationMs: number;
  errors?: string[];
}

/**
 * CollectorLogger
 *
 * Structured logging helper for collectors.
 * Provides consistent log format with context.
 */
export class CollectorLogger {
  private readonly logger: Logger;
  private readonly context: CollectorContext;
  private startTime: number = 0;

  constructor(context: CollectorContext) {
    this.context = context;
    this.logger = new Logger(`Collector:${context.collector}`);
  }

  /**
   * Log job start
   */
  logStart(): void {
    this.startTime = Date.now();
    this.logger.log({
      msg: 'Job started',
      ...this.context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log job completion
   */
  logComplete(result: CollectorResult): void {
    this.logger.log({
      msg: 'Job completed',
      ...this.context,
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log progress update
   */
  logProgress(message: string, data?: Record<string, unknown>): void {
    this.logger.debug({
      msg: message,
      ...this.context,
      ...data,
      elapsedMs: Date.now() - this.startTime,
    });
  }

  /**
   * Log info message
   */
  logInfo(message: string, data?: Record<string, unknown>): void {
    this.logger.log({
      msg: message,
      ...this.context,
      ...data,
    });
  }

  /**
   * Log warning
   */
  logWarn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn({
      msg: message,
      ...this.context,
      ...data,
    });
  }

  /**
   * Log error with stack trace
   */
  logError(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
  ): void {
    this.logger.error({
      msg: message,
      ...this.context,
      ...data,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  /**
   * Log rate limit event
   */
  logRateLimit(waitTimeMs: number): void {
    this.logger.debug({
      msg: 'Rate limit delay',
      ...this.context,
      waitTimeMs,
    });
  }

  /**
   * Log retry attempt
   */
  logRetry(attempt: number, maxAttempts: number, error: Error): void {
    this.logger.warn({
      msg: 'Retry attempt',
      ...this.context,
      attempt,
      maxAttempts,
      error: {
        name: error.name,
        message: error.message,
      },
    });
  }

  /**
   * Log circuit breaker event
   */
  logCircuitBreaker(state: string, message: string): void {
    this.logger.warn({
      msg: 'Circuit breaker event',
      ...this.context,
      circuitState: state,
      detail: message,
    });
  }

  /**
   * Get elapsed time since start
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Create a child logger for a specific query/feed
   */
  forQuery(query: string): CollectorLogger {
    return new CollectorLogger({
      ...this.context,
      query,
    });
  }

  /**
   * Create a child logger for a specific feed
   */
  forFeed(feed: string): CollectorLogger {
    return new CollectorLogger({
      ...this.context,
      feed,
    });
  }
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}
