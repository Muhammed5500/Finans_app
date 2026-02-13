#!/usr/bin/env ts-node
/**
 * Smoke test for US market (Finnhub) integration.
 *
 * Uses usService directly (no server). Requires FINNHUB_API_KEY or FINNHUB_TOKEN in env.
 *
 * Tests: Quote AAPL, Quote MSFT, Chart AAPL 1h rangeDays 5
 *
 * Usage:
 *   FINNHUB_API_KEY=xxx npx ts-node scripts/smoke-us.ts
 *   npm run smoke:us
 *
 * Exit: 0 = all pass, 1 = fail
 */

import 'dotenv/config';
import { createUsService } from '../src/services/us';
import { AppError } from '../src/utils/errors';

const g = '\x1b[32m';
const r = '\x1b[31m';
const d = '\x1b[2m';
const x = '\x1b[0m';

function ok(msg: string, extra?: string) {
  console.log(`${g}✓${x} ${msg}${extra ? ` ${d}(${extra})${x}` : ''}`);
}
function fail(msg: string, err?: string) {
  console.log(`${r}✗${x} ${msg}`);
  if (err) console.log(`  ${r}${err}${x}`);
}

async function main(): Promise<void> {
  const key = process.env.FINNHUB_API_KEY || process.env.FINNHUB_TOKEN;
  if (!key || !key.trim()) {
    fail('FINNHUB_API_KEY or FINNHUB_TOKEN is required');
    process.exit(1);
  }

  const svc = createUsService();
  let passed = 0;
  let failed = 0;

  // 1. Quote AAPL
  try {
    const start = Date.now();
    const q = await svc.getUsQuote('AAPL');
    const ms = Date.now() - start;
    const p = q.price != null ? q.price.toFixed(2) : '—';
    ok(`Quote AAPL: $${p}`, `${ms}ms`);
    passed++;
  } catch (e) {
    const msg = e instanceof AppError ? `${e.code}: ${e.message}` : (e as Error).message;
    fail('Quote AAPL', msg);
    failed++;
  }

  // 2. Quote MSFT
  try {
    const start = Date.now();
    const q = await svc.getUsQuote('MSFT');
    const ms = Date.now() - start;
    const p = q.price != null ? q.price.toFixed(2) : '—';
    ok(`Quote MSFT: $${p}`, `${ms}ms`);
    passed++;
  } catch (e) {
    const msg = e instanceof AppError ? `${e.code}: ${e.message}` : (e as Error).message;
    fail('Quote MSFT', msg);
    failed++;
  }

  // 3. Chart AAPL 1h rangeDays 5
  try {
    const start = Date.now();
    const ch = await svc.getUsChart('AAPL', '1h', '5');
    const ms = Date.now() - start;
    ok(`Chart AAPL 1h/5d: ${ch.candles.length} candles`, `${ms}ms`);
    passed++;
  } catch (e) {
    const msg = e instanceof AppError ? `${e.code}: ${e.message}` : (e as Error).message;
    fail('Chart AAPL 1h/5d', msg);
    failed++;
  }

  console.log('');
  if (failed === 0) {
    ok(`All ${passed} tests passed`);
    process.exit(0);
  }
  fail(`${failed}/${passed + failed} failed`);
  process.exit(1);
}

main().catch((e) => {
  fail('Unexpected error', (e as Error).message);
  process.exit(1);
});
