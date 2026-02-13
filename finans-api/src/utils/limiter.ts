/**
 * Simple concurrency limiter (like p-limit but no external dependency)
 * Limits the number of concurrent async operations.
 */

export interface Limiter {
  /**
   * Execute a function with concurrency limiting
   * @param fn Async function to execute
   * @returns Promise that resolves when the function completes
   */
  <T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Get current active count
   */
  activeCount: number;

  /**
   * Get pending count (waiting in queue)
   */
  pendingCount: number;
}

/**
 * Create a concurrency limiter
 * @param concurrency Maximum number of concurrent operations
 */
export function createLimiter(concurrency: number): Limiter {
  if (concurrency < 1) {
    throw new Error('Concurrency must be at least 1');
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && activeCount < concurrency) {
      const run = queue.shift();
      if (run) {
        run();
      }
    }
  };

  const limiter = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          next();
        }
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };

  Object.defineProperty(limiter, 'activeCount', {
    get: () => activeCount,
  });

  Object.defineProperty(limiter, 'pendingCount', {
    get: () => queue.length,
  });

  return limiter as Limiter;
}

// -----------------------------------------------------------------------------
// THROTTLED LIMITER
// -----------------------------------------------------------------------------

/**
 * Extended limiter with minimum delay between requests
 */
export interface ThrottledLimiter extends Limiter {
  /**
   * Get last request timestamp
   */
  lastRequestTime: number;

  /**
   * Get minimum delay in ms
   */
  minDelayMs: number;
}

export interface ThrottledLimiterOptions {
  /**
   * Maximum concurrent operations
   * @default 3
   */
  concurrency?: number;

  /**
   * Minimum delay between requests in milliseconds
   * @default 100
   */
  minDelayMs?: number;
}

/**
 * Delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a throttled concurrency limiter
 * 
 * Combines concurrency limiting with minimum delay between requests
 * to prevent overwhelming external APIs.
 * 
 * @param options Configuration options
 */
export function createThrottledLimiter(options: ThrottledLimiterOptions = {}): ThrottledLimiter {
  const {
    concurrency = 3,
    minDelayMs = 100,
  } = options;

  if (concurrency < 1) {
    throw new Error('Concurrency must be at least 1');
  }

  if (minDelayMs < 0) {
    throw new Error('minDelayMs must be non-negative');
  }

  let activeCount = 0;
  let lastRequestTime = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && activeCount < concurrency) {
      const run = queue.shift();
      if (run) {
        run();
      }
    }
  };

  const limiter = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        activeCount++;
        try {
          // Enforce minimum delay between requests
          const now = Date.now();
          const elapsed = now - lastRequestTime;
          if (elapsed < minDelayMs && lastRequestTime > 0) {
            await delay(minDelayMs - elapsed);
          }
          lastRequestTime = Date.now();

          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          next();
        }
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };

  Object.defineProperty(limiter, 'activeCount', {
    get: () => activeCount,
  });

  Object.defineProperty(limiter, 'pendingCount', {
    get: () => queue.length,
  });

  Object.defineProperty(limiter, 'lastRequestTime', {
    get: () => lastRequestTime,
  });

  Object.defineProperty(limiter, 'minDelayMs', {
    get: () => minDelayMs,
  });

  return limiter as ThrottledLimiter;
}
