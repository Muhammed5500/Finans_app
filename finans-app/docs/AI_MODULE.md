# AI Module Documentation

## Overview

The AI module provides intelligent analysis capabilities for the finance tracking application:
- News analysis (summary, sentiment, impact, related symbols)
- Vector embeddings for semantic search
- Investor profile inference
- Portfolio insights generation

## Database Schema

### New Models

1. **NewsAnalysis** - AI analysis of news items
   - Summary, sentiment, impact horizon
   - Related symbols extraction
   - Links to NewsItem

2. **NewsEmbedding** - Vector embeddings for semantic search
   - 1536-dimensional vectors (text-embedding-3-small)
   - Stored as JSON initially, converted to pgvector in migration

3. **InvestorProfile** - Inferred user profile
   - Risk tolerance, investment style, time horizon
   - Hybrid: rules-based + LLM refinement

4. **PortfolioInsight** - AI-generated portfolio insights
   - Risk, concentration, currency exposure, volatility
   - Severity levels: info, warning, critical

## Setup

### 1. Install Dependencies

```bash
npm install openai
```

### 2. Environment Variables

Add to `.env`:
```
OPENAI_API_KEY=sk-...
```

### 3. Database Migrations

```bash
# Run Prisma migration for AI models
npm run db:migrate

# Enable pgvector extension (run in PostgreSQL)
psql -d your_database -f prisma/migrations/001_add_pgvector/migration.sql
```

## API Endpoints

### News Analysis

**POST** `/api/ai/news/:id/analyze`
- Analyzes a news item
- Generates summary, sentiment, impact horizon, related symbols
- Creates embedding for semantic search

**POST** `/api/ai/news/search`
- Semantic search using vector embeddings
- Body: `{ query: string, limit?: number, threshold?: number }`

### Investor Profile

**POST** `/api/ai/profile/infer`
- Infers investor profile from portfolio
- Hybrid approach: rules + LLM

**GET** `/api/ai/profile/infer`
- Retrieves current profile

### Portfolio Insights

**GET** `/api/ai/portfolio/insights?refresh=true`
- Get latest insights (optionally refresh)

**POST** `/api/ai/portfolio/insights`
- Generate new insights

### Admin: Batch Processing

**POST** `/api/admin/ai/ingest/news-analysis`
- Batch analyze news items
- Body: `{ limit?: number, newsItemIds?: string[] }`

## Usage Examples

### Analyze a News Item

```bash
curl -X POST http://localhost:3000/api/ai/news/{newsItemId}/analyze \
  -H "Authorization: Bearer {token}"
```

### Search News Semantically

```bash
curl -X POST http://localhost:3000/api/ai/news/search \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"query": "Federal Reserve interest rates", "limit": 10}'
```

### Infer Investor Profile

```bash
curl -X POST http://localhost:3000/api/ai/profile/infer \
  -H "Authorization: Bearer {token}"
```

### Generate Portfolio Insights

```bash
curl -X POST http://localhost:3000/api/ai/portfolio/insights \
  -H "Authorization: Bearer {token}"
```

## Architecture

### Services

- `openai-client.ts` - OpenAI client singleton
- `news-analysis.service.ts` - News analysis logic
- `embedding.service.ts` - Embedding generation and vector search
- `investor-profile.service.ts` - Profile inference
- `portfolio-insights.service.ts` - Portfolio insights calculation

### Vector Search

Uses pgvector for cosine similarity search. Embeddings are stored as JSON initially, then converted to vector type in migration.

## Notes

- OpenAI API key is required
- Vector search requires pgvector extension
- Analysis is cached (one analysis per news item)
- Profile inference combines rules-based and LLM approaches
