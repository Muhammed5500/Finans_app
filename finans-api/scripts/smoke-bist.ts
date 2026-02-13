#!/usr/bin/env ts-node
/**
 * Smoke test for Yahoo Finance BIST integration
 * 
 * Tests basic functionality of the BIST endpoints:
 * - Quote fetching (XU100.IS index, THYAO.IS stock)
 * - Chart fetching (XU100.IS with 1h interval, 5d range)
 * 
 * Usage:
 *   npx ts-node scripts/smoke-bist.ts
 *   npm run smoke:bist
 * 
 * Exit codes:
 *   0 = All tests passed
 *   1 = One or more tests failed
 */

import { getYahooService, YahooFinanceError } from '../src/services/yahoo';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const TEST_SYMBOLS = {
  index: 'XU100',      // BIST 100 Index
  stock: 'THYAO',      // Turkish Airlines
};

const CHART_CONFIG = {
  interval: '1h' as const,
  range: '5d' as const,
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function log(message: string): void {
  console.log(message);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message: string): void {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logInfo(message: string): void {
  console.log(`${colors.cyan}ℹ${colors.reset} ${message}`);
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

// -----------------------------------------------------------------------------
// TEST CASES
// -----------------------------------------------------------------------------

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

async function testQuote(symbol: string, description: string): Promise<TestResult> {
  const start = Date.now();
  const name = `Quote: ${symbol} (${description})`;

  try {
    const service = getYahooService();
    const quote = await service.getQuote(symbol);
    const duration = Date.now() - start;

    const details = [
      `${quote.name}: ${formatPrice(quote.price, quote.currency)}`,
      `Change: ${formatPercent(quote.changePercent)}`,
      quote.stale ? '(stale)' : '',
    ].filter(Boolean).join(' | ');

    return { name, passed: true, duration, details };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof YahooFinanceError
      ? `${error.code}: ${error.message}`
      : (error as Error).message;

    return { name, passed: false, duration, error: errorMessage };
  }
}

async function testChart(symbol: string): Promise<TestResult> {
  const start = Date.now();
  const name = `Chart: ${symbol} (${CHART_CONFIG.interval}, ${CHART_CONFIG.range})`;

  try {
    const service = getYahooService();
    const chart = await service.getChart(symbol, CHART_CONFIG.interval, CHART_CONFIG.range);
    const duration = Date.now() - start;

    const details = [
      `${chart.candles.length} candles`,
      chart.meta.firstCandleTime ? `from ${new Date(chart.meta.firstCandleTime).toLocaleDateString()}` : '',
      chart.meta.lastCandleTime ? `to ${new Date(chart.meta.lastCandleTime).toLocaleDateString()}` : '',
      chart.stale ? '(stale)' : '',
    ].filter(Boolean).join(' | ');

    return { name, passed: true, duration, details };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof YahooFinanceError
      ? `${error.code}: ${error.message}`
      : (error as Error).message;

    return { name, passed: false, duration, error: errorMessage };
  }
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  log('');
  log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`${colors.cyan}  BIST Yahoo Finance Integration Smoke Test${colors.reset}`);
  log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log('');

  const results: TestResult[] = [];

  // Test 1: XU100 Quote (BIST 100 Index)
  logInfo(`Testing ${TEST_SYMBOLS.index} quote...`);
  results.push(await testQuote(TEST_SYMBOLS.index, 'BIST 100 Index'));

  // Test 2: THYAO Quote (Stock)
  logInfo(`Testing ${TEST_SYMBOLS.stock} quote...`);
  results.push(await testQuote(TEST_SYMBOLS.stock, 'Turkish Airlines'));

  // Test 3: XU100 Chart
  logInfo(`Testing ${TEST_SYMBOLS.index} chart...`);
  results.push(await testChart(TEST_SYMBOLS.index));

  // Summary
  log('');
  log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`${colors.cyan}  Results${colors.reset}`);
  log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log('');

  let passedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    if (result.passed) {
      passedCount++;
      logSuccess(`${result.name} ${colors.dim}(${result.duration}ms)${colors.reset}`);
      if (result.details) {
        log(`   ${colors.dim}${result.details}${colors.reset}`);
      }
    } else {
      failedCount++;
      logError(`${result.name} ${colors.dim}(${result.duration}ms)${colors.reset}`);
      if (result.error) {
        log(`   ${colors.red}${result.error}${colors.reset}`);
      }
    }
  }

  log('');
  log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  if (failedCount === 0) {
    logSuccess(`All ${passedCount} tests passed!`);
    log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log('');
    process.exit(0);
  } else {
    logError(`${failedCount} of ${results.length} tests failed`);
    log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log('');
    
    // If all failures are due to rate limiting, exit with warning instead of error
    const allRateLimited = results
      .filter(r => !r.passed)
      .every(r => r.error?.includes('RATE_LIMIT') || r.error?.includes('THROTTLED'));
    
    if (allRateLimited) {
      logWarning('All failures due to rate limiting. This is expected with VPN or frequent requests.');
      logWarning('Try again in a few minutes or check your network connection.');
      process.exit(0); // Exit success for CI, rate limiting is not a code bug
    }
    
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
