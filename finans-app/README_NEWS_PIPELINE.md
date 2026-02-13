# News Ingestion Pipeline - Quick Start

## Overview

The news ingestion pipeline fetches RSS feeds and processes them into a clean, structured format ready for AI analysis.

## Setup

1. **Ensure database is running**:
   ```bash
   npm run docker:db
   ```

2. **Run migrations** (if not already done):
   ```bash
   npm run db:migrate
   ```

3. **Seed news sources** (if not already done):
   ```bash
   tsx prisma/seed-ai.ts
   ```

## Usage

### Step 1: Fetch RSS Feeds

Fetch news from all enabled RSS sources:

```bash
npm run ingest:rss
```

Or fetch from a specific source:

```bash
npm run ingest:rss <source-id>
```

**What it does:**
- Reads enabled RSS sources from `news_sources` table
- Fetches each RSS feed
- Stores raw items to `news_items_raw`
- Deduplicates by hash (title + date + source)
- Logs progress and summary

**Example output:**
```
🚀 Starting RSS ingestion...

📋 Found 3 enabled RSS source(s)

📡 Fetching RSS feed: Reuters Finance (https://...)
   📰 Found 20 items in feed
   ✅ Fetched 15 new items, skipped 5 duplicates

==================================================
📊 Ingestion Summary:
   ✅ Fetched: 45 items
   ⏭️  Skipped: 12 duplicates
   ❌ Errors: 0
==================================================
```

### Step 2: Clean Raw Items

Convert raw items to cleaned format:

```bash
npm run clean:news
```

Or clean with a limit:

```bash
npm run clean:news "" 500
```

Or clean a specific item:

```bash
npm run clean:news <raw-item-id>
```

**What it does:**
- Reads raw items from `news_items_raw`
- Parses published dates
- Strips HTML and normalizes text
- Detects language (en/tr)
- Extracts ticker symbols (BIST, US, Crypto)
- Infers markets (BIST, US, Crypto, General)
- Stores to `news_items_clean`
- Idempotent (won't duplicate)

**Example output:**
```
🧹 Starting news cleaning...

📋 Found 45 raw item(s) to clean

   ✅ Cleaned 10 items...
   ✅ Cleaned 20 items...
   ✅ Cleaned 30 items...
   ✅ Cleaned 40 items...

==================================================
📊 Cleaning Summary:
   ✅ Cleaned: 45 items
   ⏭️  Skipped: 0 items
   ❌ Errors: 0
==================================================
```

## Pipeline Flow

```
1. RSS Sources (DB)
   ↓
2. npm run ingest:rss
   ↓
3. news_items_raw (raw data)
   ↓
4. npm run clean:news
   ↓
5. news_items_clean (cleaned data)
   ↓
6. AI Analysis (optional)
   ↓
7. news_ai_analysis (AI results)
```

## Configuration

### RSS Fetcher Options

Default settings in `src/lib/news/rss-fetcher.ts`:
- `timeout`: 10000ms (10 seconds per request)
- `maxConcurrent`: 3 sources at once
- `rateLimitMs`: 1000ms (1 second between requests)

### News Cleaner Options

Default settings in `src/lib/news/news-cleaner.ts`:
- `limit`: 1000 items per run (configurable)

## Ticker Extraction

The cleaner extracts tickers using simple patterns:

**BIST**: 4-5 uppercase letters (e.g., THYAO, AKBNK)
**US**: 1-5 uppercase letters, often with $ or () (e.g., AAPL, MSFT)
**Crypto**: Hardcoded list (BTC, ETH, SOL, etc.)

## Market Inference

Markets are inferred from:
- Extracted tickers
- Source name keywords
- Default: "General" if unclear

## Troubleshooting

### No items fetched

1. Check sources exist and are enabled:
   ```sql
   SELECT id, name, enabled, url FROM news_sources WHERE type = 'rss';
   ```

2. Test RSS feed URL manually:
   ```bash
   curl <rss-url>
   ```

3. Check network connectivity

### Items not cleaning

1. Check raw items exist:
   ```sql
   SELECT COUNT(*) FROM news_items_raw;
   ```

2. Check for items without clean versions:
   ```sql
   SELECT COUNT(*) FROM news_items_raw r
   LEFT JOIN news_items_clean c ON c.raw_id = r.id
   WHERE c.id IS NULL;
   ```

3. Check logs for parsing errors

### Tickers not extracted

- Simple pattern matching may miss some tickers
- Can be improved with AI/NLP analysis later
- Check extracted tickers:
  ```sql
  SELECT tickers FROM news_items_clean WHERE array_length(tickers, 1) > 0;
  ```

## Next Steps

After ingestion and cleaning:

1. **Run AI analysis**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/ai/ingest/news-analysis \
     -H "Authorization: Bearer <token>" \
     -d '{"limit": 10}'
   ```

2. **Query cleaned news**:
   ```sql
   SELECT title, tickers, markets, published_at 
   FROM news_items_clean 
   ORDER BY published_at DESC 
   LIMIT 10;
   ```

## Files

- `src/lib/news/rss-fetcher.ts` - RSS fetching logic
- `src/lib/news/news-cleaner.ts` - Cleaning logic
- `scripts/ingest-rss.ts` - CLI for RSS ingestion
- `scripts/clean-news.ts` - CLI for news cleaning

## See Also

- `docs/NEWS_INGESTION.md` - Detailed documentation
- `SCHEMA_SUMMARY.md` - Database schema overview
