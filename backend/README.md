# Finans Backend

Production-quality news aggregation backend with clean architecture.

## Features

- **News Ingestion** from multiple free sources:
  - GDELT (Global news)
  - SEC RSS (US financial filings)
  - KAP (Turkish public disclosures)
  - Google News RSS (optional)
- **REST API** with filtering, pagination, and search
- **Job Scheduling** (BullMQ or cron-based)
- **Circuit Breaker** for resilient data fetching
- **Structured Logging** with context
- **Metrics** endpoint (JSON/Prometheus)
- **OpenAPI/Swagger** documentation

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Redis (optional, for BullMQ)

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Setup Environment

```bash
cp env.example .env
# Edit .env with your settings
```

### 3. Start Database

**Option A: Docker (Recommended)**
```bash
npm run docker:db
# or
docker-compose up -d db
```

**Option B: Local PostgreSQL**
```bash
# Create database manually
createdb finans_backend
```

### 4. Run Migrations

```bash
npm run db:setup
# This runs: prisma generate + migrate deploy + seed
```

### 5. Start Development Server

```bash
npm run dev
```

The server starts at `http://localhost:3001`

- API Docs: http://localhost:3001/api/docs
- Health: http://localhost:3001/health
- Metrics: http://localhost:3001/health/metrics

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run check` | Run lint + typecheck + test |

### Database Scripts

| Script | Description |
|--------|-------------|
| `npm run db:setup` | Generate client + migrate + seed |
| `npm run db:reset` | Reset database and re-seed |
| `npm run migrate` | Run migrations (production) |
| `npm run migrate:dev` | Create and run migrations (dev) |
| `npm run seed` | Seed database with sample data |
| `npm run prisma:studio` | Open Prisma Studio GUI |

### Docker Scripts

| Script | Description |
|--------|-------------|
| `npm run docker:db` | Start PostgreSQL |
| `npm run docker:redis` | Start PostgreSQL + Redis |
| `npm run docker:all` | Start all services |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | Follow container logs |

## Docker Compose

```bash
# Start only database (default)
docker-compose up -d

# Start with Redis
docker-compose --profile redis up -d

# Start with app container
docker-compose --profile app up -d

# Start everything
docker-compose --profile redis --profile app up -d

# View logs
docker-compose logs -f

# Stop and remove volumes
docker-compose down -v
```

## API Endpoints

### News

```
GET  /api/v1/news              # List news (paginated)
GET  /api/v1/news/:id          # Get single news item
GET  /api/v1/news/sources      # List sources with counts
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20, max: 100) |
| `market` | enum | Filter by market: USA, BIST, CRYPTO, MACRO |
| `ticker` | string | Filter by ticker symbol |
| `tickers` | string | Filter by multiple tickers (comma-separated) |
| `tag` | string | Filter by tag |
| `tags` | string | Filter by multiple tags (comma-separated) |
| `source` | enum | Filter by source: GDELT, SEC_RSS, KAP, GOOGLE_NEWS |
| `language` | string | Filter by language (en, tr) |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |
| `search` | string | Search in title/summary |
| `sortBy` | enum | Sort by: publishedAt, createdAt |
| `sortOrder` | enum | Sort order: asc, desc |

### Tickers

```
GET  /api/v1/tickers           # List tickers (paginated)
GET  /api/v1/tickers/all       # Get all tickers
```

### Tags

```
GET  /api/v1/tags              # List tags (paginated)
GET  /api/v1/tags/all          # Get all tags
```

### Health

```
GET  /health                   # Full health status
GET  /health/live              # Liveness probe
GET  /health/ready             # Readiness probe
GET  /health/collectors        # Collector statuses
GET  /health/collectors/:name  # Single collector status
GET  /health/metrics           # JSON metrics
GET  /health/metrics?format=prometheus  # Prometheus format
```

## Configuration

See `env.example` for all available environment variables.

### Key Settings

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finans_backend

# Job Scheduling
USE_REDIS_QUEUE=false  # true for BullMQ, false for cron

# Collectors
GDELT_ENABLED=true
SEC_RSS_ENABLED=true
KAP_ENABLED=true
ENABLE_GOOGLE_NEWS_RSS=false

# HTTP Client
HTTP_TIMEOUT_MS=8000
HTTP_RETRY_COUNT=3

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_MS=1800000  # 30 min
```

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed script
├── src/
│   ├── config/              # Configuration & validation
│   ├── infrastructure/      # Cross-cutting concerns
│   │   ├── cache/           # In-memory caching
│   │   ├── http/            # Polite HTTP client
│   │   ├── logging/         # Structured logging
│   │   ├── metrics/         # Metrics collection
│   │   ├── prisma/          # Database client
│   │   └── resilience/      # Circuit breaker, rate limiter
│   ├── modules/
│   │   ├── health/          # Health check endpoints
│   │   ├── ingestion/       # Data collectors
│   │   │   └── collectors/
│   │   │       ├── gdelt/
│   │   │       ├── sec-rss/
│   │   │       ├── kap/
│   │   │       └── google-news/
│   │   ├── jobs/            # Job scheduling
│   │   ├── news/            # News API
│   │   ├── tickers/         # Ticker management
│   │   └── tags/            # Tag management
│   ├── shared/              # Shared utilities
│   │   ├── dto/             # Data transfer objects
│   │   ├── tagging/         # Ticker/tag extraction
│   │   ├── types/           # Type definitions
│   │   └── utils/           # Utility functions
│   ├── app.module.ts        # Root module
│   └── main.ts              # Entry point
├── docker-compose.yml       # Local dev services
├── Dockerfile               # Container build
└── env.example              # Environment template
```

## Troubleshooting

### Database Connection Failed

```
Error: P1001: Can't reach database server at `localhost:5432`
```

**Solution:**
1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps
   # or
   pg_isready -h localhost -p 5432
   ```
2. Verify DATABASE_URL in `.env`
3. If using Docker, ensure the container is healthy:
   ```bash
   docker-compose logs db
   ```

### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
npm run prisma:generate
```

### Migration Failed

```
Error: P3009: migrate found failed migrations
```

**Solution:**
```bash
# Reset and re-apply migrations
npm run db:reset
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>
# or change PORT in .env
```

### Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
1. Start Redis:
   ```bash
   npm run docker:redis
   ```
2. Or disable Redis queue:
   ```env
   USE_REDIS_QUEUE=false
   ```

### Collector Not Running

1. Check if collector is enabled:
   ```env
   GDELT_ENABLED=true
   ```
2. Check circuit breaker status:
   ```bash
   curl http://localhost:3001/health/collectors/gdelt
   ```
3. Check logs:
   ```bash
   npm run docker:logs
   ```

### High Memory Usage

1. Reduce cache size:
   ```env
   CACHE_MAX_SIZE=500
   ```
2. Check for memory leaks in collector logs

### Rate Limit Errors

1. Collectors automatically handle rate limiting
2. Check circuit breaker status for paused collectors
3. Adjust intervals if needed:
   ```env
   GDELT_INTERVAL_MINUTES=5
   ```

## Development

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# Single file
npm test -- --testPathPattern="gdelt"
```

### Smoke Test (E2E)

The smoke test verifies the entire system end-to-end:
1. Database connectivity
2. Data in database
3. API endpoints
4. Pagination

```bash
# Run smoke test (requires running server and database)
npm run smoke

# Run with mock data (for CI/testing without real collectors)
npm run smoke:mock

# Run with verbose output
npm run smoke:verbose

# Run with custom API URL
API_BASE_URL=http://localhost:4000 npm run smoke
```

**CI Usage:**
```bash
# Full CI pipeline with smoke test
npm run ci:smoke
```

The smoke test:
- Checks database connection
- Seeds mock data if `MOCK_MODE=true`
- Verifies news, tickers, tags exist
- Tests health endpoints
- Tests news API with pagination
- Tests filters (source, date range)
- Tests tickers and tags APIs
- Tests metrics endpoint

### Linting

```bash
npm run lint
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```

### Full Check (CI)

```bash
npm run check  # lint + typecheck + test
```

## Production Deployment

### Build

```bash
npm run build
```

### Run Migrations

```bash
NODE_ENV=production npm run migrate
```

### Start

```bash
NODE_ENV=production npm start
```

### Docker

```bash
# Build production image
docker build -t finans-backend --target production .

# Run
docker run -d -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  finans-backend
```

## License

UNLICENSED - Private project
