# Finans App

Financial tracking application with AI-powered insights.

## Prerequisites

- Node.js 20+ 
- Docker & Docker Compose
- npm or yarn

## Quick Start

### 1. Environment Setup

Copy environment template:
```bash
cp .env.example .env.local
```

Edit `.env.local` and set:
```bash
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finans_dev?schema=public
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional
API_TOKEN=your-secret-api-token-here  # For API authentication
```

### 2. Start Database

```bash
# Start PostgreSQL with pgvector
npm run docker:db
# or
docker-compose up -d db
```

Wait for database to be ready (~10 seconds).

### 3. Database Setup

```bash
# Generate Prisma client, run migrations, and seed data
npm run db:setup
```

This will:
- Generate Prisma client
- Run database migrations
- Seed initial data (user, news sources, portfolio snapshot)

### 4. Run Background Jobs (Optional)

```bash
# Process news ingestion pipeline
npm run jobs:tick
```

This runs:
- RSS ingestion
- News cleaning
- Embedding generation
- News analysis
- Profile/insights recomputation

### 5. Start Development Server

```bash
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000)

## API Examples

### Authentication

Most endpoints require authentication. Use the `API_TOKEN` from `.env.local`:

```bash
export API_TOKEN="your-secret-api-token-here"
```

Or include in curl:
```bash
curl -H "Authorization: Bearer $API_TOKEN" ...
```

### 1. News Digest

Get latest analyzed news (3 items):

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:3000/api/ai/news/digest?limit=3
```

### 2. News Search

Semantic search for news:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "http://localhost:3000/api/ai/news/search?q=Federal+Reserve+interest+rates&limit=5"
```

### 3. Investor Profile

Get investor profile for a user:

```bash
# Replace USER_ID with actual user ID from database
curl -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:3000/api/ai/profile/USER_ID
```

Recompute profile:
```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"questionnaire": {"risk_tolerance": "medium", "time_horizon": "long"}}' \
  http://localhost:3000/api/ai/profile/USER_ID/recompute
```

### 4. Portfolio Insights

Get portfolio insights for a user:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:3000/api/ai/portfolio-insights/USER_ID
```

### 5. Dashboard Data

Get aggregated dashboard data:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:3000/api/ai/dashboard/USER_ID
```

Returns:
- Summary with notes
- News digest (3 items)
- Investor profile
- Portfolio insights

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:setup         # Setup database (generate + migrate + seed)
npm run db:migrate       # Run migrations
npm run db:seed          # Seed data
npm run db:studio        # Open Prisma Studio

# Background Jobs
npm run jobs:tick        # Run all background jobs

# News Pipeline
npm run ingest:rss       # Fetch RSS feeds
npm run clean:news       # Clean raw news items
npm run embed:news       # Generate embeddings
npm run ai:analyze-news  # Analyze news with AI

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # TypeScript check
npm run format           # Format code
```

## Project Structure

```
finans-app/
├── src/
│   ├── app/              # Next.js app router
│   │   └── api/          # API routes
│   ├── lib/
│   │   ├── ai/           # AI services (analysis, embeddings, profiles)
│   │   ├── news/         # News pipeline (RSS, cleaning, embeddings)
│   │   └── db.ts         # Prisma client
│   └── components/       # React components
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── scripts/              # CLI scripts
└── docker-compose.yml    # Docker setup
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if database is running
docker ps

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### Missing OpenAI API Key

```bash
# Verify key is set
echo $OPENAI_API_KEY

# Or check .env.local
cat .env.local | grep OPENAI_API_KEY
```

### Port Already in Use

```bash
# Change port in package.json or use:
PORT=3001 npm run dev
```

## Documentation

- `docs/NEWS_PIPELINE.md` - News ingestion pipeline
- `docs/NEWS_AI_ANALYSIS.md` - News AI analysis
- `docs/INVESTOR_PROFILE.md` - Investor profile inference
- `docs/PORTFOLIO_INSIGHTS.md` - Portfolio insights
- `docs/AI_DASHBOARD.md` - Dashboard endpoint
- `docs/BACKGROUND_JOBS.md` - Background jobs setup
- `docs/DESIGN_TOKENS.md` - Design system and semantic tokens
- `TESTING.md` - Testing guide

## Design Tokens

The application uses a minimal design system with semantic tokens for consistency and accessibility.

### Semantic Colors

- **Background**: `--color-background`, `--color-surface`, `--color-surface-elevated`
- **Borders**: `--color-border`, `--color-border-muted`, `--color-border-strong`
- **Text**: `--color-text`, `--color-text-muted`, `--color-text-subtle`
- **Semantic**: `--color-success` (gains), `--color-danger` (losses), `--color-warning` (alerts)

**Important**: Green/Red are ONLY used for price changes and alerts. Use neutral colors elsewhere.

### Spacing & Radius

- **Spacing**: Based on 4px grid (`--spacing-1` through `--spacing-16`)
- **Radius**: `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px)

### Interaction States

All interactive elements support:
- **Hover**: `:hover:not(:disabled)` - Subtle background change
- **Focus**: `:focus-visible` - 2px blue outline ring for accessibility
- **Active**: `:active:not(:disabled)` - Pressed state
- **Disabled**: `:disabled` - 50% opacity, no pointer events

### Usage

```css
/* In CSS Modules */
.myCard {
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
}
```

See `docs/DESIGN_TOKENS.md` for complete documentation.

## License

Private project.
