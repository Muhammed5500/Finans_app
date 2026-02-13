#!/usr/bin/env tsx

/* =============================================================================
   NEWS CLEANING CLI
   
   Converts raw news items to cleaned format.
   ============================================================================= */

import { cleanAllRawItems, cleanRawItemById } from '../src/lib/news/news-cleaner';

import { db } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const rawId = args[0]; // Optional: specific raw item ID
  const limit = args[1] ? parseInt(args[1], 10) : undefined; // Optional: limit

  try {
    if (rawId) {
      console.log(`🧹 Cleaning raw item: ${rawId}\n`);
      const cleaned = await cleanRawItemById(rawId);
      console.log(cleaned ? '✅ Item cleaned successfully' : '⏭️  Item already cleaned');
    } else {
      await cleanAllRawItems(limit);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
