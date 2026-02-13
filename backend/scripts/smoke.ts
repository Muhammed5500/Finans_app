#!/usr/bin/env ts-node
/**
 * =============================================================================
 * FINANS BACKEND - SMOKE TEST
 * =============================================================================
 * 
 * Runs a quick end-to-end verification:
 * 1. Checks database connectivity
 * 2. Runs collectors (mocked if MOCK_MODE=true)
 * 3. Verifies items are stored in DB
 * 4. Tests API endpoints and pagination
 * 
 * Usage:
 *   npm run smoke                    # Run with real collectors
 *   MOCK_MODE=true npm run smoke     # Run with mocked data
 *   npm run smoke:mock               # Alias for mock mode
 * 
 * Exit codes:
 *   0 = All tests passed
 *   1 = Tests failed
 * =============================================================================
 */

import { PrismaClient, NewsSource, Market } from '@prisma/client';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  mockMode: process.env.MOCK_MODE === 'true',
  timeout: 30000, // 30 seconds
  verbose: process.env.VERBOSE === 'true',
};

const prisma = new PrismaClient();

// =============================================================================
// LOGGING
// =============================================================================

const log = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  },
  success: (msg: string) => {
    console.log(`[✓] ${msg}`);
  },
  error: (msg: string, err?: any) => {
    console.error(`[✗] ${msg}`, err?.message || err || '');
  },
  warn: (msg: string) => {
    console.warn(`[!] ${msg}`);
  },
  debug: (msg: string, data?: any) => {
    if (CONFIG.verbose) {
      console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  section: (title: string) => {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
  },
};

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_NEWS_ITEMS = [
  {
    source: NewsSource.GDELT,
    sourceId: 'mock-gdelt-001',
    title: 'Tesla announces new battery technology breakthrough',
    url: 'https://example.com/news/tesla-battery-2024-mock-001',
    publishedAt: new Date(Date.now() - 3600000), // 1 hour ago
    language: 'en',
    summary: 'Tesla unveils revolutionary solid-state battery with 500-mile range',
    raw: { mock: true, source: 'gdelt' },
  },
  {
    source: NewsSource.GDELT,
    sourceId: 'mock-gdelt-002',
    title: 'Federal Reserve signals potential rate cut in Q2',
    url: 'https://example.com/news/fed-rates-2024-mock-002',
    publishedAt: new Date(Date.now() - 7200000), // 2 hours ago
    language: 'en',
    summary: 'Fed Chair hints at monetary policy shift amid cooling inflation',
    raw: { mock: true, source: 'gdelt' },
  },
  {
    source: NewsSource.SEC_RSS,
    sourceId: 'mock-sec-001',
    title: '8-K - APPLE INC (AAPL)',
    url: 'https://example.com/edgar/aapl-8k-mock-001',
    publishedAt: new Date(Date.now() - 1800000), // 30 min ago
    language: 'en',
    summary: 'Apple files 8-K regarding material event',
    raw: { mock: true, source: 'sec', filingType: '8-K' },
  },
  {
    source: NewsSource.KAP,
    sourceId: 'mock-kap-001',
    title: 'THYAO - Finansal Durum Tablosu Açıklaması',
    url: 'https://example.com/kap/thyao-financial-mock-001',
    publishedAt: new Date(Date.now() - 5400000), // 1.5 hours ago
    language: 'tr',
    summary: 'Türk Hava Yolları finansal tabloları yayınladı',
    raw: { mock: true, source: 'kap' },
  },
  {
    source: NewsSource.GOOGLE_NEWS,
    sourceId: 'mock-google-001',
    title: 'Bitcoin surges past $50,000 as institutional buying accelerates',
    url: 'https://example.com/crypto/btc-surge-mock-001',
    publishedAt: new Date(Date.now() - 900000), // 15 min ago
    language: 'en',
    summary: 'BTC reaches new highs driven by ETF inflows',
    raw: { mock: true, source: 'google_news' },
  },
];

const MOCK_TICKERS = [
  { symbol: 'TSLA', market: Market.USA, name: 'Tesla Inc.' },
  { symbol: 'AAPL', market: Market.USA, name: 'Apple Inc.' },
  { symbol: 'THYAO', market: Market.BIST, name: 'Türk Hava Yolları' },
  { symbol: 'BTC', market: Market.CRYPTO, name: 'Bitcoin' },
  { symbol: 'FED', market: Market.MACRO, name: 'Federal Reserve' },
];

const MOCK_TAGS = ['earnings', 'macro', 'crypto', 'sec-filing', 'turkey'];

// =============================================================================
// TEST HELPERS
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log.success(`${name} (${duration}ms)`);
    return true;
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: err.message });
    log.error(`${name} (${duration}ms)`, err);
    return false;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<{ status: number; data: T }> {
  const url = `${CONFIG.apiBaseUrl}${path}`;
  log.debug(`Fetching: ${url}`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options?.headers,
      },
    });
    
    const data = await response.json();
    log.debug(`Response: ${response.status}`, data);
    
    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// TEST: DATABASE CONNECTIVITY
// =============================================================================

async function testDatabaseConnection(): Promise<void> {
  await prisma.$connect();
  const result = await prisma.$queryRaw`SELECT 1 as connected`;
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Database query returned unexpected result');
  }
}

// =============================================================================
// TEST: SEED MOCK DATA (when MOCK_MODE=true)
// =============================================================================

async function seedMockData(): Promise<void> {
  log.info('Seeding mock data...');
  
  // Ensure tickers exist
  for (const ticker of MOCK_TICKERS) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      update: {},
      create: ticker,
    });
  }
  log.debug(`Seeded ${MOCK_TICKERS.length} tickers`);
  
  // Ensure tags exist
  for (const tagName of MOCK_TAGS) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    });
  }
  log.debug(`Seeded ${MOCK_TAGS.length} tags`);
  
  // Insert mock news items
  for (const item of MOCK_NEWS_ITEMS) {
    await prisma.newsItem.upsert({
      where: { url: item.url },
      update: {},
      create: item,
    });
  }
  log.debug(`Seeded ${MOCK_NEWS_ITEMS.length} news items`);
  
  // Associate some tickers and tags
  const newsItems = await prisma.newsItem.findMany({
    where: { url: { in: MOCK_NEWS_ITEMS.map(i => i.url) } },
  });
  
  const tickers = await prisma.ticker.findMany({
    where: { symbol: { in: MOCK_TICKERS.map(t => t.symbol) } },
  });
  
  const tags = await prisma.tag.findMany({
    where: { name: { in: MOCK_TAGS } },
  });
  
  // Associate Tesla news with TSLA ticker
  const teslaNews = newsItems.find(n => n.title.includes('Tesla'));
  const tslaTicker = tickers.find(t => t.symbol === 'TSLA');
  if (teslaNews && tslaTicker) {
    await prisma.newsItemTicker.upsert({
      where: { newsItemId_tickerId: { newsItemId: teslaNews.id, tickerId: tslaTicker.id } },
      update: {},
      create: { newsItemId: teslaNews.id, tickerId: tslaTicker.id, confidence: 0.95 },
    });
  }
  
  // Associate SEC news with earnings tag
  const secNews = newsItems.find(n => n.source === 'SEC_RSS');
  const earningsTag = tags.find(t => t.name === 'earnings');
  if (secNews && earningsTag) {
    await prisma.newsItemTag.upsert({
      where: { newsItemId_tagId: { newsItemId: secNews.id, tagId: earningsTag.id } },
      update: {},
      create: { newsItemId: secNews.id, tagId: earningsTag.id },
    });
  }
  
  log.success('Mock data seeded successfully');
}

// =============================================================================
// TEST: VERIFY DATABASE HAS ITEMS
// =============================================================================

async function testDatabaseHasItems(): Promise<void> {
  const newsCount = await prisma.newsItem.count();
  const tickerCount = await prisma.ticker.count();
  const tagCount = await prisma.tag.count();
  
  log.info('Database counts:', { news: newsCount, tickers: tickerCount, tags: tagCount });
  
  if (newsCount === 0) {
    throw new Error('No news items found in database');
  }
  if (tickerCount === 0) {
    throw new Error('No tickers found in database');
  }
  if (tagCount === 0) {
    throw new Error('No tags found in database');
  }
}

// =============================================================================
// TEST: API HEALTH ENDPOINT
// =============================================================================

async function testHealthEndpoint(): Promise<void> {
  const { status, data } = await fetchApi<any>('/health');
  
  if (status !== 200) {
    throw new Error(`Health endpoint returned ${status}`);
  }
  
  if (!data.status) {
    throw new Error('Health response missing status field');
  }
  
  if (!data.uptime && data.uptime !== 0) {
    throw new Error('Health response missing uptime field');
  }
  
  log.debug('Health response:', data);
}

// =============================================================================
// TEST: API LIVENESS PROBE
// =============================================================================

async function testLivenessProbe(): Promise<void> {
  const { status, data } = await fetchApi<any>('/health/live');
  
  if (status !== 200) {
    throw new Error(`Liveness probe returned ${status}`);
  }
  
  if (data.status !== 'ok') {
    throw new Error(`Liveness probe status is ${data.status}, expected ok`);
  }
}

// =============================================================================
// TEST: API READINESS PROBE
// =============================================================================

async function testReadinessProbe(): Promise<void> {
  const { status, data } = await fetchApi<any>('/health/ready');
  
  if (status !== 200) {
    throw new Error(`Readiness probe returned ${status}`);
  }
  
  if (data.status !== 'ok') {
    throw new Error(`Readiness probe status is ${data.status}, expected ok`);
  }
}

// =============================================================================
// TEST: NEWS API - LIST
// =============================================================================

async function testNewsListEndpoint(): Promise<void> {
  const { status, data } = await fetchApi<any>('/api/v1/news');
  
  if (status !== 200) {
    throw new Error(`News list endpoint returned ${status}`);
  }
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('News response missing data array');
  }
  
  if (!data.meta) {
    throw new Error('News response missing meta object');
  }
  
  log.debug('News list response:', { itemCount: data.data.length, meta: data.meta });
}

// =============================================================================
// TEST: NEWS API - PAGINATION
// =============================================================================

async function testNewsPagination(): Promise<void> {
  // Get first page with small page size
  const page1 = await fetchApi<any>('/api/v1/news?page=1&pageSize=2');
  
  if (page1.status !== 200) {
    throw new Error(`Page 1 returned ${page1.status}`);
  }
  
  if (!page1.data.meta) {
    throw new Error('Page 1 response missing meta');
  }
  
  const { page, pageSize, total, totalPages } = page1.data.meta;
  
  if (page !== 1) {
    throw new Error(`Expected page 1, got ${page}`);
  }
  
  if (pageSize !== 2) {
    throw new Error(`Expected pageSize 2, got ${pageSize}`);
  }
  
  log.debug('Pagination meta:', { page, pageSize, total, totalPages });
  
  // If there are multiple pages, test page 2
  if (totalPages > 1) {
    const page2 = await fetchApi<any>('/api/v1/news?page=2&pageSize=2');
    
    if (page2.status !== 200) {
      throw new Error(`Page 2 returned ${page2.status}`);
    }
    
    if (page2.data.meta.page !== 2) {
      throw new Error(`Expected page 2, got ${page2.data.meta.page}`);
    }
    
    // Ensure different items on different pages
    if (page1.data.data.length > 0 && page2.data.data.length > 0) {
      const page1Ids = new Set(page1.data.data.map((item: any) => item.id));
      const page2Ids = page2.data.data.map((item: any) => item.id);
      const overlap = page2Ids.filter((id: string) => page1Ids.has(id));
      
      if (overlap.length > 0) {
        throw new Error(`Pages 1 and 2 have overlapping items: ${overlap.join(', ')}`);
      }
    }
    
    log.success('Pagination works correctly with multiple pages');
  } else {
    log.warn('Only 1 page of results, skipping multi-page pagination test');
  }
}

// =============================================================================
// TEST: NEWS API - FILTERS
// =============================================================================

async function testNewsFilters(): Promise<void> {
  // Test source filter
  const gdeltNews = await fetchApi<any>('/api/v1/news?source=GDELT');
  if (gdeltNews.status !== 200) {
    throw new Error(`Source filter returned ${gdeltNews.status}`);
  }
  
  // Verify all items have correct source
  for (const item of gdeltNews.data.data) {
    if (item.source !== 'GDELT') {
      throw new Error(`Expected source GDELT, got ${item.source}`);
    }
  }
  
  log.debug('Source filter works:', { count: gdeltNews.data.data.length });
  
  // Test date range filter
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateFilterUrl = `/api/v1/news?from=${yesterday.toISOString()}&to=${now.toISOString()}`;
  const dateNews = await fetchApi<any>(dateFilterUrl);
  
  if (dateNews.status !== 200) {
    throw new Error(`Date filter returned ${dateNews.status}`);
  }
  
  log.debug('Date filter works:', { count: dateNews.data.data.length });
}

// =============================================================================
// TEST: TICKERS API
// =============================================================================

async function testTickersEndpoint(): Promise<void> {
  const { status, data } = await fetchApi<any>('/api/v1/tickers');
  
  if (status !== 200) {
    throw new Error(`Tickers endpoint returned ${status}`);
  }
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Tickers response missing data array');
  }
  
  log.debug('Tickers response:', { count: data.data.length });
}

// =============================================================================
// TEST: TAGS API
// =============================================================================

async function testTagsEndpoint(): Promise<void> {
  const { status, data } = await fetchApi<any>('/api/v1/tags');
  
  if (status !== 200) {
    throw new Error(`Tags endpoint returned ${status}`);
  }
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Tags response missing data array');
  }
  
  log.debug('Tags response:', { count: data.data.length });
}

// =============================================================================
// TEST: METRICS ENDPOINT
// =============================================================================

async function testMetricsEndpoint(): Promise<void> {
  const { status, data } = await fetchApi<any>('/health/metrics');
  
  if (status !== 200) {
    throw new Error(`Metrics endpoint returned ${status}`);
  }
  
  if (typeof data.uptime !== 'number') {
    throw new Error('Metrics response missing uptime');
  }
  
  if (!data.memory) {
    throw new Error('Metrics response missing memory info');
  }
  
  log.debug('Metrics response:', { uptime: data.uptime, memory: data.memory });
}

// =============================================================================
// TEST: COLLECTORS STATUS
// =============================================================================

async function testCollectorsStatus(): Promise<void> {
  const { status, data } = await fetchApi<any>('/health/collectors');
  
  if (status !== 200) {
    throw new Error(`Collectors endpoint returned ${status}`);
  }
  
  if (!data.collectors || !Array.isArray(data.collectors)) {
    throw new Error('Collectors response missing collectors array');
  }
  
  log.debug('Collectors status:', data.collectors.map((c: any) => ({ name: c.name, healthy: c.healthy })));
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          FINANS BACKEND - SMOKE TEST                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  log.info('Configuration:', {
    apiBaseUrl: CONFIG.apiBaseUrl,
    mockMode: CONFIG.mockMode,
    verbose: CONFIG.verbose,
  });
  
  const startTime = Date.now();
  
  try {
    // ==========================================================================
    // PHASE 1: Database
    // ==========================================================================
    log.section('PHASE 1: Database Connectivity');
    
    await runTest('Database connection', testDatabaseConnection);
    
    if (CONFIG.mockMode) {
      await runTest('Seed mock data', seedMockData);
    }
    
    await runTest('Database has items', testDatabaseHasItems);
    
    // ==========================================================================
    // PHASE 2: Health Endpoints
    // ==========================================================================
    log.section('PHASE 2: Health Endpoints');
    
    await runTest('Health endpoint', testHealthEndpoint);
    await runTest('Liveness probe', testLivenessProbe);
    await runTest('Readiness probe', testReadinessProbe);
    await runTest('Metrics endpoint', testMetricsEndpoint);
    await runTest('Collectors status', testCollectorsStatus);
    
    // ==========================================================================
    // PHASE 3: News API
    // ==========================================================================
    log.section('PHASE 3: News API');
    
    await runTest('News list endpoint', testNewsListEndpoint);
    await runTest('News pagination', testNewsPagination);
    await runTest('News filters', testNewsFilters);
    
    // ==========================================================================
    // PHASE 4: Supporting APIs
    // ==========================================================================
    log.section('PHASE 4: Supporting APIs');
    
    await runTest('Tickers endpoint', testTickersEndpoint);
    await runTest('Tags endpoint', testTagsEndpoint);
    
  } finally {
    await prisma.$disconnect();
  }
  
  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  log.section('TEST SUMMARY');
  
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('\n');
    process.exit(1);
  }
  
  console.log('\n✅ All smoke tests passed!\n');
  process.exit(0);
}

// Run main
main().catch((err) => {
  console.error('\n❌ Smoke test crashed:', err);
  process.exit(1);
});


