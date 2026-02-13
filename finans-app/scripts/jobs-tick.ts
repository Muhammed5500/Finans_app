#!/usr/bin/env tsx

/* =============================================================================
   BACKGROUND JOB RUNNER
   
   Runs all background jobs sequentially with sensible limits.
   Designed to be called periodically (e.g., via cron).
   
   Jobs:
   1. Ingest RSS feeds
   2. Clean raw news items
   3. Embed cleaned news items
   4. Analyze cleaned news items
   5. Recompute profile + insights for seed user
   ============================================================================= */

import { db } from '../src/lib/db';
import { fetchAllRssFeeds } from '../src/lib/news/rss-fetcher';
import { cleanAllRawItems } from '../src/lib/news/news-cleaner';
import { generateEmbeddingsForAll } from '../src/lib/news/embeddings';
import { analyzeAllNews } from '../src/lib/ai/news-analysis-v2.service';
import { inferInvestorProfileV2 } from '../src/lib/ai/investor-profile-v2.service';
import { generatePortfolioInsightsV2 } from '../src/lib/ai/portfolio-insights-v2.service';

// =============================================================================
// Configuration
// =============================================================================

const JOB_LIMITS = {
  cleanNews: 50,      // Clean up to 50 raw items per run
  embedNews: 20,      // Embed up to 20 items per run (OpenAI API rate limits)
  analyzeNews: 10,    // Analyze up to 10 items per run (OpenAI API rate limits)
};

// =============================================================================
// Job Execution
// =============================================================================

interface JobResult {
  job: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: unknown;
}

async function runJob(
  name: string,
  fn: () => Promise<unknown>
): Promise<JobResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Starting job: ${name}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    console.log(`\n✅ Job completed: ${name} (${duration}ms)\n`);
    return {
      job: name,
      success: true,
      duration,
      details: result,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Job failed: ${name} (${duration}ms)`);
    console.error(`   Error: ${errorMessage}\n`);
    return {
      job: name,
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Individual Jobs
// =============================================================================

async function jobIngestRss(): Promise<unknown> {
  await fetchAllRssFeeds({
    timeout: 10000,      // 10 seconds per feed
    maxConcurrent: 3,    // Max 3 concurrent requests
    rateLimitMs: 1000,   // 1 second between requests
  });
  return { message: 'RSS ingestion completed' };
}

async function jobCleanNews(): Promise<unknown> {
  return await cleanAllRawItems(JOB_LIMITS.cleanNews);
}

async function jobEmbedNews(): Promise<unknown> {
  return await generateEmbeddingsForAll(JOB_LIMITS.embedNews);
}

async function jobAnalyzeNews(): Promise<unknown> {
  return await analyzeAllNews(JOB_LIMITS.analyzeNews);
}

async function jobRecomputeProfileAndInsights(): Promise<unknown> {
  // Find seed user (first user or user with email containing 'demo' or 'seed')
  const seedUser = await db.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'demo', mode: 'insensitive' } },
        { email: { contains: 'seed', mode: 'insensitive' } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!seedUser) {
    // Fallback: get first user
    const firstUser = await db.user.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!firstUser) {
      throw new Error('No user found for profile/insights recomputation');
    }

    return await runProfileAndInsightsForUser(firstUser.id);
  }

  return await runProfileAndInsightsForUser(seedUser.id);
}

async function runProfileAndInsightsForUser(userId: string): Promise<unknown> {
  // Check if user has portfolio snapshot
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { capturedAt: 'desc' },
  });

  if (!snapshot) {
    console.log(`   ⏭️  Skipping user ${userId}: No portfolio snapshot`);
    return { message: 'Skipped - no portfolio snapshot', userId };
  }

  // Recompute profile
  const profileResult = await inferInvestorProfileV2(userId);
  if (!profileResult.success) {
    console.warn(`   ⚠️  Profile recomputation failed: ${profileResult.error}`);
  }

  // Recompute insights
  const insightsResult = await generatePortfolioInsightsV2(userId);
  if (!insightsResult.success) {
    console.warn(`   ⚠️  Insights recomputation failed: ${insightsResult.error}`);
  }

  return {
    userId,
    profile: profileResult.success ? 'updated' : 'failed',
    insights: insightsResult.success ? 'updated' : 'failed',
  };
}

// =============================================================================
// Main Runner
// =============================================================================

async function main() {
  const overallStartTime = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('🚀 BACKGROUND JOB RUNNER');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const results: JobResult[] = [];

  // Job 1: Ingest RSS
  results.push(await runJob('ingest-rss', jobIngestRss));

  // Job 2: Clean News
  results.push(await runJob('clean-news', jobCleanNews));

  // Job 3: Embed News
  results.push(await runJob('embed-news', jobEmbedNews));

  // Job 4: Analyze News
  results.push(await runJob('analyze-news', jobAnalyzeNews));

  // Job 5: Recompute Profile + Insights
  results.push(await runJob('recompute-profile-insights', jobRecomputeProfileAndInsights));

  // Summary
  const overallDuration = Date.now() - overallStartTime;
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 JOB RUN SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total duration: ${overallDuration}ms`);
  console.log(`Successful jobs: ${successCount}/${results.length}`);
  console.log(`Failed jobs: ${failureCount}/${results.length}`);

  if (failureCount > 0) {
    console.log('\nFailed jobs:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.job}: ${r.error}`);
      });
  }

  console.log('\nJob details:');
  results.forEach((r) => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.job}: ${r.duration}ms`);
  });

  console.log('='.repeat(60) + '\n');

  // Exit with error code if any job failed
  if (failureCount > 0) {
    process.exit(1);
  }
}

// =============================================================================
// Execution
// =============================================================================

main()
  .catch((error) => {
    console.error('\n❌ Fatal error in job runner:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
