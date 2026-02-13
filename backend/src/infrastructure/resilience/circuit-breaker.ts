import { Logger } from '@nestjs/common';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting recovery */
  recoveryTimeoutMs: number;
  /** Name for logging */
  name: string;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  openedAt: Date | null;
  closedAt: Date | null;
}

/**
 * CircuitBreaker
 *
 * Implements circuit breaker pattern to prevent cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are rejected
 * - HALF_OPEN: Testing recovery, single request allowed
 *
 * Behavior:
 * - After `failureThreshold` consecutive failures, circuit opens
 * - After `recoveryTimeoutMs`, circuit moves to half-open
 * - If half-open request succeeds, circuit closes
 * - If half-open request fails, circuit reopens
 */
export class CircuitBreaker {
  private readonly logger: Logger;
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private closedAt: Date | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {
    this.logger = new Logger(`CircuitBreaker:${config.name}`);
  }

  /**
   * Check if the circuit allows requests
   */
  isAllowed(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (this.openedAt) {
          const elapsed = Date.now() - this.openedAt.getTime();
          if (elapsed >= this.config.recoveryTimeoutMs) {
            this.transitionTo(CircuitState.HALF_OPEN);
            return true;
          }
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow single test request
        return true;

      default:
        return false;
    }
  }

  /**
   * Get remaining time until circuit might close (in ms)
   */
  getRemainingOpenTime(): number {
    if (this.state !== CircuitState.OPEN || !this.openedAt) {
      return 0;
    }
    const elapsed = Date.now() - this.openedAt.getTime();
    return Math.max(0, this.config.recoveryTimeoutMs - elapsed);
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
      this.logger.log('Circuit recovered and closed after successful test');
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(error?: Error): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = new Date();

    this.logger.warn({
      msg: 'Operation failed',
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.config.failureThreshold,
      error: error?.message,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test, reopen circuit
      this.transitionTo(CircuitState.OPEN);
      this.logger.warn('Circuit reopened after failed recovery test');
    } else if (
      this.state === CircuitState.CLOSED &&
      this.consecutiveFailures >= this.config.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
      this.logger.error({
        msg: 'Circuit opened due to consecutive failures',
        consecutiveFailures: this.consecutiveFailures,
        recoveryTimeoutMs: this.config.recoveryTimeoutMs,
      });
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.openedAt = new Date();
    } else if (newState === CircuitState.CLOSED) {
      this.closedAt = new Date();
      this.consecutiveFailures = 0;
    }

    this.logger.debug({
      msg: 'Circuit state transition',
      from: oldState,
      to: newState,
    });
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.closedAt = new Date();
    this.logger.log('Circuit manually reset');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isAllowed()) {
      const remainingMs = this.getRemainingOpenTime();
      throw new CircuitOpenError(
        `Circuit is open for ${this.config.name}. Retry after ${Math.ceil(remainingMs / 1000)}s`,
        remainingMs,
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
