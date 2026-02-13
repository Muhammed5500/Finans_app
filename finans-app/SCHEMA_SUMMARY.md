# AI Module Database Schema Summary

## Overview

The AI module adds 7 new tables and updates 2 existing tables to support:
- News ingestion and cleaning pipeline
- AI analysis of news items
- Vector embeddings for semantic search
- Portfolio snapshots and AI insights
- Investor profile inference

## New Tables

### 1. `news_sources`
**Purpose**: Store news source configuration (RSS, API, manual)

**Key Fields**:
- `id` (uuid, PK)
- `user_id` (uuid, FK to users, nullable)
- `name` (text)
- `type` (enum: rss, api, manual)
- `base_url` (text, nullable)
- `url` (text, nullable)
- `enabled` (boolean)

**Indexes**: user_id, type, enabled

### 2. `news_items_raw`
**Purpose**: Store raw ingested news before cleaning

**Key Fields**:
- `id` (uuid, PK)
- `source_id` (uuid, FK to news_sources)
- `fetched_at` (timestamp)
- `url` (text)
- `title_raw` (text)
- `content_raw` (text, nullable)
- `published_at_raw` (text, nullable) - Raw date string
- `language_guess` (text, nullable)
- `hash_dedup` (text, unique) - For deduplication

**Indexes**: source_id, fetched_at DESC, url, hash_dedup (unique)

### 3. `news_items_clean`
**Purpose**: Store cleaned and normalized news items

**Key Fields**:
- `id` (uuid, PK)
- `raw_id` (uuid, FK to news_items_raw, unique)
- `cleaned_at` (timestamp)
- `title` (text)
- `content` (text, nullable)
- `published_at` (timestamptz)
- `language` (text, default 'en')
- `tickers` (text[]) - Extracted ticker symbols
- `markets` (text[]) - Related markets (BIST, US, Crypto)

**Indexes**: raw_id (unique), published_at DESC, language, markets

### 4. `news_ai_analysis`
**Purpose**: Store AI analysis results in flexible JSONB format

**Key Fields**:
- `id` (uuid, PK)
- `clean_id` (uuid, FK to news_items_clean, unique)
- `analyzed_at` (timestamp)
- `model` (text, default 'gpt-4o-mini')
- `version` (text, default '1.0')
- `json_result` (jsonb) - Structured analysis data
- `safety_flags` (jsonb, nullable)

**json_result Structure**:
```json
{
  "summary": "string",
  "sentiment": "positive" | "neutral" | "negative",
  "impact_horizon": "immediate" | "short_term" | "medium_term" | "long_term",
  "confidence": 0.0-1.0,
  "related_symbols": ["AAPL", "BTC"],
  "key_reasons": ["reason1", "reason2"],
  "watch_items": ["item1"],
  "markets": ["US", "Crypto"]
}
```

**Indexes**: clean_id (unique), analyzed_at DESC, model, sentiment (GIN), impact_horizon (GIN)

### 5. `news_embeddings`
**Purpose**: Store vector embeddings for semantic search

**Key Fields**:
- `id` (uuid, PK)
- `clean_id` (uuid, FK to news_items_clean, unique)
- `analysis_id` (uuid, FK to news_ai_analysis, unique, nullable)
- `embedding` (jsonb) - Array of floats (1536 dimensions)
- `embedding_vector` (vector(1536)) - pgvector column for search
- `model` (text, default 'text-embedding-3-small')

**Indexes**: 
- clean_id (unique)
- analysis_id (unique)
- model
- embedding_vector (ivfflat index for cosine similarity)

### 6. `portfolio_snapshots`
**Purpose**: Store portfolio state at specific points in time

**Key Fields**:
- `id` (uuid, PK)
- `user_id` (uuid, FK to users)
- `captured_at` (timestamp)
- `holdings_json` (jsonb) - Portfolio holdings data

**holdings_json Structure**:
```json
{
  "holdings": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "quantity": 150,
      "avgCost": 142.5,
      "currentPrice": 185.92,
      "value": 27888,
      "currency": "USD"
    }
  ],
  "totalValue": 92728.75,
  "totalCostBasis": 71250,
  "unrealizedGain": 21478.75,
  "capturedAt": "2024-01-15T10:00:00Z"
}
```

**Indexes**: user_id, captured_at DESC, (user_id, captured_at DESC)

### 7. `portfolio_ai_insights`
**Purpose**: Store AI-generated portfolio insights

**Key Fields**:
- `id` (uuid, PK)
- `user_id` (uuid, FK to users)
- `computed_at` (timestamp)
- `version` (text, default '1.0')
- `json_result` (jsonb) - Array of insights

**json_result Structure**:
```json
[
  {
    "type": "risk" | "concentration" | "currency_exposure" | "volatility" | "diversification" | "sector_allocation",
    "title": "string",
    "description": "string",
    "severity": "info" | "warning" | "critical",
    "data": { ... },
    "recommendations": ["rec1", "rec2"]
  }
]
```

**Indexes**: user_id, computed_at DESC, (user_id, computed_at DESC)

## Updated Tables

### `users`
**Added Fields**:
- `locale` (text, default 'en-US')

### `investor_profiles`
**Added Fields**:
- `computed_at` (timestamp)
- `version` (text, default '1.0')
- `json_result` (jsonb)

**Note**: Legacy fields (risk_tolerance, investment_style, etc.) are preserved for backward compatibility. New code should use `json_result`.

## Extensions

- **pgvector**: Enabled for vector similarity search
  - Vector dimension: 1536 (text-embedding-3-small)
  - Index type: ivfflat (approximate, fast)
  - Distance function: cosine similarity

## Data Flow

1. **Ingestion**: `news_sources` → `news_items_raw`
2. **Cleaning**: `news_items_raw` → `news_items_clean`
3. **Analysis**: `news_items_clean` → `news_ai_analysis`
4. **Embedding**: `news_items_clean` → `news_embeddings`
5. **Portfolio**: `users` → `portfolio_snapshots` → `portfolio_ai_insights`

## Indexes Summary

- **Unique constraints**: hash_dedup, raw_id, clean_id, analysis_id
- **Foreign keys**: All tables properly linked with CASCADE deletes
- **Performance indexes**: Timestamps (DESC), user_id, source_id, model
- **JSONB indexes**: GIN indexes on sentiment and impact_horizon
- **Vector index**: ivfflat on embedding_vector for similarity search

## Migration Notes

- Migration is idempotent (uses IF NOT EXISTS where possible)
- Foreign keys are conditional (only added if parent tables exist)
- pgvector extension is enabled automatically
- Vector column is created but requires data conversion after seeding
