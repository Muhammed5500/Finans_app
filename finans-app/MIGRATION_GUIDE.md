# AI Module Migration Guide

## Overview

This guide explains how to apply the AI module database migrations and set up the schema.

## Prerequisites

1. PostgreSQL database running (with pgvector support)
2. `DATABASE_URL` environment variable set
3. Prisma CLI installed

## Step 1: Apply Migration

The migration file is located at:
```
prisma/migrations/000_add_ai_tables/migration.sql
```

### Option A: Using Prisma Migrate (Recommended)

```bash
# Apply the migration
npm run db:migrate

# Or if migration already exists
npx prisma migrate deploy
```

### Option B: Manual SQL Execution

If Prisma migrate doesn't work, you can run the SQL directly:

```bash
psql $DATABASE_URL -f prisma/migrations/000_add_ai_tables/migration.sql
```

## Step 2: Generate Prisma Client

After migration, regenerate the Prisma client:

```bash
npm run db:generate
```

## Step 3: Seed Sample Data

Run the AI module seed script:

```bash
tsx prisma/seed-ai.ts
```

This will create:
- A demo user (if none exists)
- 3 news sources (Reuters, Bloomberg, CoinDesk)
- Sample raw news items
- Cleaned news items
- A portfolio snapshot

## Step 4: Convert Embeddings to Vector Format

After seeding data with embeddings, convert JSON embeddings to pgvector format:

```sql
-- Connect to database
psql $DATABASE_URL

-- Convert JSON embeddings to vector
UPDATE news_embeddings 
SET embedding_vector = (
    SELECT array_agg(value::float)::vector(1536)
    FROM jsonb_array_elements_text(embedding) AS value
)
WHERE embedding IS NOT NULL AND embedding_vector IS NULL;
```

## Verification

Check that tables were created:

```sql
-- List all AI-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'news_sources',
    'news_items_raw',
    'news_items_clean',
    'news_ai_analysis',
    'news_embeddings',
    'portfolio_snapshots',
    'portfolio_ai_insights'
  )
ORDER BY table_name;
```

Check pgvector extension:

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';
```

## Troubleshooting

### Migration Fails: Table Already Exists

If tables already exist, you can:
1. Drop and recreate (WARNING: deletes data):
```sql
DROP TABLE IF EXISTS news_embeddings CASCADE;
DROP TABLE IF EXISTS news_ai_analysis CASCADE;
DROP TABLE IF EXISTS news_items_clean CASCADE;
DROP TABLE IF EXISTS news_items_raw CASCADE;
DROP TABLE IF EXISTS news_sources CASCADE;
DROP TABLE IF EXISTS portfolio_ai_insights CASCADE;
DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
```

2. Then re-run the migration

### pgvector Extension Not Found

Ensure you're using the pgvector Docker image:
```bash
docker-compose up -d db
```

Or manually install:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Foreign Key Errors

The migration uses conditional foreign keys (DO blocks) to handle cases where the `users` table might not exist yet. If you get FK errors, ensure:
1. The `users` table exists
2. User IDs match between tables

## Next Steps

After migration:
1. Update your application code to use the new tables
2. Implement ingestion services for news_items_raw
3. Implement cleaning services for news_items_clean
4. Set up AI analysis pipelines
5. Configure vector search endpoints

## Schema Overview

### news_sources
- Stores RSS/API/manual news sources
- Links to users (optional for system-wide sources)

### news_items_raw
- Raw ingested news before processing
- Deduplicated by hash_dedup

### news_items_clean
- Cleaned and normalized news
- Extracted tickers and markets

### news_ai_analysis
- AI analysis results in JSONB format
- Includes sentiment, impact, related symbols

### news_embeddings
- Vector embeddings for semantic search
- JSONB for storage, vector column for search

### portfolio_snapshots
- Portfolio state at specific points in time
- JSONB format for flexibility

### portfolio_ai_insights
- AI-generated portfolio insights
- JSONB format for structured insights
