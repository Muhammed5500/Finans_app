#!/usr/bin/env tsx

/* =============================================================================
   RSS INGESTION CLI
   
   Fetches RSS feeds from all enabled sources and stores raw news items.
   ============================================================================= */

import { fetchAllRssFeeds, fetchRssSource } from '../src/lib/news/rss-fetcher';

import { db } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const sourceId = args[0]; // Optional: specific source ID

  try {
    if (sourceId) {
      console.log(`📡 Fetching RSS feed for source: ${sourceId}\n`);
      const result = await fetchRssSource(sourceId);
      console.log('Result:', result);
    } else {
      await fetchAllRssFeeds({
        timeout: 10000, // 10 seconds
        maxConcurrent: 3, // Max 3 concurrent requests
        rateLimitMs: 1000, // 1 second between requests
      });
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
