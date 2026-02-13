/**
 * Request pacer for Finnhub: min delay between requests + max concurrent.
 * Reduces 429s by throttling upstream calls.
 */

export interface RequestPacerOptions {
  /** Min ms between starting upstream requests. Default 120. */
  minDelayMs?: number;
  /** Max concurrent upstream requests. Default 3. */
  maxConcurrent?: number;
}

const DEFAULT_MIN_DELAY_MS = 120;
const DEFAULT_MAX_CONCURRENT = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RequestPacer {
  /** Run fn through the pacer (concurrency + min delay). */
  schedule<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Create a Finnhub request pacer.
 * Options override env: FINNHUB_MIN_DELAY_MS, FINNHUB_MAX_CONCURRENT.
 */
export function createRequestPacer(options: RequestPacerOptions = {}): RequestPacer {
  const fromEnvDelay =
    typeof process !== 'undefined' && process.env?.FINNHUB_MIN_DELAY_MS
      ? parseInt(process.env.FINNHUB_MIN_DELAY_MS, 10)
      : NaN;
  const minDelayMs = options.minDelayMs ?? (Number.isFinite(fromEnvDelay) ? fromEnvDelay : DEFAULT_MIN_DELAY_MS);

  const fromEnvConcur =
    typeof process !== 'undefined' && process.env?.FINNHUB_MAX_CONCURRENT
      ? parseInt(process.env.FINNHUB_MAX_CONCURRENT, 10)
      : NaN;
  const maxConcurrent = options.maxConcurrent ?? (Number.isFinite(fromEnvConcur) ? fromEnvConcur : DEFAULT_MAX_CONCURRENT);

  if (minDelayMs < 0) throw new Error('minDelayMs must be non-negative');
  if (maxConcurrent < 1) throw new Error('maxConcurrent must be at least 1');

  let active = 0;
  let lastStart = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length === 0 || active >= maxConcurrent) return;
    const run = queue.shift();
    if (run) run();
  };

  const schedule = <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = async () => {
        active++;
        const now = Date.now();
        const elapsed = now - lastStart;
        if (elapsed < minDelayMs && lastStart > 0) {
          await delay(minDelayMs - elapsed);
        }
        lastStart = Date.now();

        try {
          const out = await fn();
          resolve(out);
        } catch (e) {
          reject(e);
        } finally {
          active--;
          next();
        }
      };

      if (active < maxConcurrent) {
        run();
      } else {
        queue.push(run);
      }
    });

  return { schedule };
}

let _default: RequestPacer | null = null;

/** Default pacer instance (env-configured). Use in finnhubClient. */
export function getRequestPacer(): RequestPacer {
  if (!_default) _default = createRequestPacer();
  return _default;
}
