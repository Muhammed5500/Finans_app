# AI Module Setup Guide

## Prerequisites

1. **PostgreSQL with pgvector**: The AI module requires pgvector extension for vector similarity search
2. **OpenAI API Key**: Required for news analysis, embeddings, and profile inference

## Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-key-here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finans_dev?schema=public
```

### 2. Database Setup with pgvector

Start PostgreSQL with pgvector using Docker:
```bash
make docker-db
# or
docker-compose up -d db
```

The pgvector extension will be automatically enabled on first startup.

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This will create the AI-related tables:
- `news_analyses` - AI analysis of news items
- `news_embeddings` - Vector embeddings for semantic search
- `investor_profiles` - Inferred user profiles
- `portfolio_insights` - AI-generated portfolio insights

### 4. Verify Setup

Check that pgvector is enabled:
```bash
psql $DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

You should see:
```
 extname | extversion 
---------+------------
 vector  | 0.5.0
```

## Development Workflow

### Start Development Server

```bash
npm run dev
```

### Code Quality

```bash
# Run all checks
make check

# Or individually
make lint          # ESLint
make typecheck     # TypeScript
make format-check  # Prettier
```

### Database Operations

```bash
make db-setup      # Full setup (generate + migrate + seed)
make db-migrate    # Run migrations
make db-studio     # Open Prisma Studio
```

## AI Module Usage

### 1. Analyze News Items

Batch analyze unanalyzed news:
```bash
curl -X POST http://localhost:3000/api/admin/ai/ingest/news-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### 2. Semantic News Search

```bash
curl -X POST http://localhost:3000/api/ai/news/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Federal Reserve interest rates", "limit": 10}'
```

### 3. Infer Investor Profile

```bash
curl -X POST http://localhost:3000/api/ai/profile/infer \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Generate Portfolio Insights

```bash
curl -X POST http://localhost:3000/api/ai/portfolio/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### pgvector not found

If you see errors about pgvector:
1. Ensure you're using the `pgvector/pgvector:pg15` Docker image
2. Check that the init script ran: `docker-compose logs db | grep vector`
3. Manually enable: `psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"`

### OpenAI API Errors

- Verify your API key is correct in `.env.local`
- Check API quota/limits
- Ensure you have credits in your OpenAI account

### Migration Errors

If migrations fail:
```bash
# Reset database (WARNING: deletes all data)
npm run db:reset

# Or manually fix
npm run db:migrate:create
# Edit the migration file, then
npm run db:migrate
```

## Architecture

- **Services**: `src/lib/ai/*.service.ts` - Core AI logic
- **API Routes**: `src/app/api/ai/**` - REST endpoints
- **Database**: Prisma schema with AI models
- **Vector Search**: pgvector for semantic search

See `docs/AI_MODULE.md` for detailed documentation.
