#!/usr/bin/env tsx

/* =============================================================================
   NEWS EMBEDDING CLI
   
   Generates embeddings for cleaned news items.
   ============================================================================= */

import { generateEmbeddingsForAll, generateAndStoreEmbedding } from '../src/lib/news/embeddings';
import { db } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const cleanId = args[0]; // Optional: specific clean item ID
  const limit = args[1] ? parseInt(args[1], 10) : undefined; // Optional: limit

  try {
    if (cleanId) {
      console.log(`🔮 Generating embedding for item: ${cleanId}\n`);
      const generated = await generateAndStoreEmbedding(cleanId);
      console.log(generated ? '✅ Embedding generated successfully' : '⏭️  Embedding already exists');
    } else {
      await generateEmbeddingsForAll(limit);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
