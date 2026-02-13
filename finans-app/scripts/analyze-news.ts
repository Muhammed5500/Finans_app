#!/usr/bin/env tsx

/* =============================================================================
   NEWS ANALYSIS CLI
   
   Analyzes cleaned news items using AI.
   ============================================================================= */

import { analyzeNews, analyzeAllNews } from '../src/lib/ai/news-analysis-v2.service';
import { db } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const cleanId = args.find((arg) => !arg.startsWith('--')) || args[0];
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  try {
    if (cleanId && !cleanId.startsWith('--')) {
      // Analyze specific item
      console.log(`🔍 Analyzing news item: ${cleanId}\n`);
      const result = await analyzeNews(cleanId);
      if (result.success) {
        console.log('✅ Analysis completed successfully');
        if (result.safetyFlags && result.safetyFlags.length > 0) {
          console.log(`⚠️  Safety flags: ${result.safetyFlags.join(', ')}`);
        }
      } else {
        console.error('❌ Analysis failed:', result.error);
        process.exit(1);
      }
    } else {
      // Analyze all items
      await analyzeAllNews(limit);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
