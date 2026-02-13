# News Ingestion Pipeline

## Overview

The news ingestion pipeline consists of two stages:
1. **RSS Fetcher** - Fetches RSS feeds and stores raw items
2. **News Cleaner** - Cleans and normalizes raw items

## Architecture

```
RSS Sources (DB) → RSS Fetcher → news_items_raw → News Cleaner → news_items_clean
```

## RSS Fetcher

### Features

- ✅ Fetches from all enabled RSS sources
- ✅ Deduplication by hash (title + published date + source)
- ✅ Rate limiting (configurable)
- ✅ Request timeouts
- ✅ Concurrent fetching (with limits)
- ✅ Error handling per source/item

### Usage

```bash
# Fetch all enabled RSS sources
npm run ingest:rss

# Fetch specific source
npm run ingest:rss <source-id>
```

### Configuration

Default options:
- `timeout`: 10000ms (10 seconds)
- `maxConcurrent`: 3 sources at once
- `rateLimitMs`: 1000ms (1 second between requests)

### Deduplication

Items are deduplicated using SHA-256 hash of:
```
title | published_date | source_id
```

If an item with the same hash exists, it's skipped.

## News Cleaner

### Features

- ✅ Converts raw items to cleaned format
- ✅ Parses published dates (multiple formats)
- ✅ Strips HTML and normalizes text
- ✅ Detects language (basic heuristic)
- ✅ Extracts ticker symbols (BIST, US, Crypto)
- ✅ Infers markets (BIST, US, Crypto, General)
- ✅ Idempotent (won't duplicate clean rows)

### Usage

```bash
# Clean all raw items (default: 1000 limit)
npm run clean:news

# Clean with custom limit
npm run clean:news "" 500

# Clean specific raw item
npm run clean:news <raw-item-id>
```

### Ticker Extraction

**BIST Tickers:**
- Pattern: 4-5 uppercase letters
- Examples: THYAO, AKBNK, GARAN

**US Tickers:**
- Pattern: 1-5 uppercase letters
- Context: Preceded by $ or in parentheses
- Examples: AAPL, MSFT, GOOGL

**Crypto:**
- Hardcoded list of common cryptos
- Examples: BTC, ETH, SOL, BNB

### Market Inference

Markets are inferred from:
1. **Tickers**: Crypto tickers → Crypto market, etc.
2. **Source name**: "BIST" in name → BIST market
3. **Default**: "General" if no market detected

## Data Flow Example

1. **RSS Fetcher**:
   ```
   Source: Reuters Finance
   → Fetches feed
   → Finds 20 items
   → Checks deduplication hash
   → Stores 15 new items to news_items_raw
   → Skips 5 duplicates
   ```

2. **News Cleaner**:
   ```
   Reads news_items_raw (15 items)
   → Parses dates
   → Cleans HTML
   → Extracts tickers: ["AAPL", "MSFT"]
   → Infers markets: ["US"]
   → Stores to news_items_clean
   ```

## Error Handling

- **Source errors**: Logged but don't stop other sources
- **Item errors**: Logged but don't stop other items
- **Network timeouts**: Handled gracefully
- **Invalid feeds**: Skipped with error message

## Logging

Both modules provide clear console output:
- ✅ Success indicators
- ⚠️  Warnings
- ❌ Errors
- 📊 Summary statistics

## Database Schema

### news_items_raw
- Raw data from RSS feeds
- Deduplicated by `hash_dedup`
- Links to `news_sources`

### news_items_clean
- Cleaned and normalized
- Extracted metadata (tickers, markets)
- Links to `news_items_raw` (one-to-one)

## Next Steps

After ingestion and cleaning:
1. Run AI analysis: `POST /api/admin/ai/ingest/news-analysis`
2. Generate embeddings: (automatic with analysis)
3. Query cleaned news: Use `news_items_clean` table

## Troubleshooting

### No items fetched

1. Check sources are enabled:
   ```sql
   SELECT * FROM news_sources WHERE enabled = true AND type = 'rss';
   ```

2. Check source URLs are valid
3. Check network connectivity
4. Check RSS feed is accessible

### Items not cleaning

1. Check raw items exist:
   ```sql
   SELECT COUNT(*) FROM news_items_raw WHERE id NOT IN (
     SELECT raw_id FROM news_items_clean
   );
   ```

2. Check for errors in logs
3. Verify date parsing (check `published_at_raw` format)

### Tickers not extracted

- Ticker extraction uses simple patterns
- May miss some tickers in complex text
- Can be improved with NLP/AI later

## Performance

- **RSS Fetching**: ~1-2 seconds per source
- **Cleaning**: ~100-200 items/second
- **Deduplication**: Fast (indexed hash)

## Future Improvements

- [ ] Better language detection (use library)
- [ ] More sophisticated ticker extraction (NLP)
- [ ] Retry logic for failed fetches
- [ ] Incremental fetching (only new items)
- [ ] Webhook/API source support
