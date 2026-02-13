# Backend Implementation Plan

## Overview

Production-quality NestJS backend for financial news aggregation from **100% free data sources**.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ NewsController│  │AdminController│  │TickerController│ HealthCtrl │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ NewsQueryService │  │IngestionService  │  │ TickerExtractor      │ │
│  │ - list news      │  │ - orchestrates   │  │ - extract symbols    │ │
│  │ - search         │  │   all collectors │  │ - tag normalization  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    INGESTION COLLECTORS                         │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────────────┐   │   │
│  │  │ GDELT  │  │SEC RSS │  │  KAP   │  │ Google News RSS    │   │   │
│  │  │Ingestor│  │Ingestor│  │Ingestor│  │ Ingestor (optional)│   │   │
│  │  └────────┘  └────────┘  └────────┘  └────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN LAYER                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ NewsItem Entity  │  │ Ticker Entity    │  │ Fingerprint Utils    │ │
│  │ - validation     │  │ - symbol rules   │  │ - canonical URL      │ │
│  │ - business rules │  │ - market info    │  │ - dedup hash         │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE LAYER                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ PrismaService    │  │PoliteHttpService │  │ RedisQueue (optional)│ │
│  │ - Postgres ORM   │  │ - rate limiting  │  │ - BullMQ jobs        │ │
│  │ - transactions   │  │ - caching        │  │ - retries            │ │
│  │                  │  │ - retries        │  │                      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Structure

### 2.1 IngestionModule
**Purpose**: Manages all data collectors and scheduling.

| Component | Responsibility |
|-----------|----------------|
| `GdeltIngestor` | Fetches from GDELT 2.1 DOC API |
| `SecRssIngestor` | Parses SEC EDGAR Atom/RSS feeds |
| `KapIngestor` | Scrapes KAP (kap.org.tr) public endpoints |
| `GoogleNewsRssIngestor` | Optional Google News RSS parser |
| `IngestionScheduler` | Cron-based polling orchestrator |
| `IngestionService` | Coordinates ingestors, handles dedup |

### 2.2 NewsModule
**Purpose**: News storage, normalization, and query APIs.

| Component | Responsibility |
|-----------|----------------|
| `NewsQueryService` | List, search, filter news items |
| `NewsNormalizer` | Standardize data from different sources |
| `NewsDedupService` | Fingerprint-based deduplication |
| `NewsRepository` | Prisma-based data access |

### 2.3 TickersModule
**Purpose**: Extract and manage stock tickers/tags.

| Component | Responsibility |
|-----------|----------------|
| `TickerExtractor` | Extract ticker symbols from text |
| `TickerNormalizer` | Normalize symbols (e.g., BIST, NYSE) |
| `TickerMatcher` | Match tickers against known symbols |
| `TickerRepository` | Store and query ticker associations |

### 2.4 HealthModule
**Purpose**: Health checks and monitoring endpoints.

| Component | Responsibility |
|-----------|----------------|
| `HealthController` | GET /health, /health/ready, /health/live |
| `DbHealthIndicator` | Check Postgres connectivity |
| `IngestionHealthIndicator` | Check last ingestion status |

---

## 3. Data Source Specifications

### 3.1 GDELT (Global Database of Events, Language, and Tone)

| Property | Value |
|----------|-------|
| **API URL** | `https://api.gdeltproject.org/api/v2/doc/doc` |
| **Rate Limit** | ~1 req/sec (polite) |
| **Polling Interval** | 15 minutes |
| **Data Format** | JSON |
| **Free Tier** | Unlimited |

**Query Parameters**:
```
query=finance OR stock OR market
mode=ArtList
format=json
maxrecords=250
sourcelang=eng
```

### 3.2 SEC EDGAR RSS

| Property | Value |
|----------|-------|
| **Feed URL** | `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&owner=include&count=100&output=atom` |
| **Rate Limit** | 10 req/sec (SEC fair use) |
| **Polling Interval** | 30 minutes |
| **Data Format** | Atom XML |
| **Free Tier** | Unlimited |

### 3.3 KAP (Kamuyu Aydınlatma Platformu)

| Property | Value |
|----------|-------|
| **API Base** | `https://www.kap.org.tr/tr/api/` |
| **Rate Limit** | ~2 req/sec (polite) |
| **Polling Interval** | 10 minutes |
| **Data Format** | JSON |
| **Free Tier** | Public data |

**Endpoints**:
- `/disclosures` - Latest disclosures
- `/company/{stockCode}` - Company info

### 3.4 Google News RSS (Optional)

| Property | Value |
|----------|-------|
| **Feed URL** | `https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en` |
| **Rate Limit** | ~1 req/min (very polite) |
| **Polling Interval** | 60 minutes |
| **Data Format** | RSS 2.0 XML |
| **Free Tier** | Unlimited |

---

## 4. Data Flow & Processing Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scheduler  │────▶│   Ingestor   │────▶│  Raw Items   │
│  (Cron Jobs) │     │  (Collector) │     │   (Array)    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Storage    │◀────│   Dedup      │◀────│  Normalizer  │
│  (Postgres)  │     │ (Fingerprint)│     │  (Clean)     │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │   Ticker     │
                                          │  Extractor   │
                                          └──────────────┘
```

### 4.1 Normalization Rules

1. **URL Canonicalization**: Remove tracking params, normalize protocol
2. **Title Cleanup**: Strip HTML, normalize whitespace
3. **Date Parsing**: Convert all dates to UTC ISO-8601
4. **Author Extraction**: Extract from various source formats
5. **Summary Truncation**: Max 2000 characters

### 4.2 Deduplication Strategy

```typescript
fingerprint = sha256(canonicalUrl + normalizedTitle + sourceType)
```

- Check fingerprint before insert
- Skip if exists (increment `skippedCount`)
- Insert if new (increment `insertedCount`)

---

## 5. Job Scheduling Configuration

| Source | Cron Expression | Interval | Notes |
|--------|-----------------|----------|-------|
| GDELT | `*/15 * * * *` | 15 min | High volume |
| SEC RSS | `*/30 * * * *` | 30 min | Market hours priority |
| KAP | `*/10 * * * *` | 10 min | TR market hours |
| Google News | `0 * * * *` | 60 min | Low priority, optional |

### 5.1 Retry Policy

```typescript
{
  maxRetries: 3,
  backoffMs: [1000, 5000, 15000], // Exponential
  retryOn: [429, 503, 504]
}
```

---

## 6. API Endpoints

### 6.1 Public News API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/news` | List news (paginated) |
| GET | `/api/v1/news/:id` | Get single news item |
| GET | `/api/v1/news/search` | Search news |
| GET | `/api/v1/news/sources` | List news sources |

**Query Parameters**:
```
GET /api/v1/news?
  page=1
  limit=20
  source=GDELT,SEC_RSS
  ticker=AAPL,THYAO
  from=2024-01-01
  to=2024-01-31
  q=search+term
```

### 6.2 Ticker API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tickers` | List all tickers |
| GET | `/api/v1/tickers/:symbol` | Get ticker info |
| GET | `/api/v1/tickers/:symbol/news` | Get news for ticker |

### 6.3 Admin API (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/ingestion/trigger` | Manual trigger |
| GET | `/api/v1/admin/ingestion/runs` | List ingestion runs |
| GET | `/api/v1/admin/ingestion/status` | Current status |
| PATCH | `/api/v1/admin/sources/:id` | Update source config |

### 6.4 Health API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/live` | Liveness probe (K8s) |
| GET | `/health/ready` | Readiness probe (K8s) |

---

## 7. Database Schema

### 7.1 Tables

```sql
-- News Sources Configuration
news_sources (
  id, type, name, url, is_active, tags[], language,
  fetch_interval_minutes, last_fetched_at, last_error,
  created_at, updated_at
)

-- News Items (normalized)
news_items (
  id, source_id, title, url, canonical_url, summary,
  author, published_at, fetched_at, fingerprint, raw_json
)

-- Ingestion Run History
ingestion_runs (
  id, source_type, status, started_at, finished_at,
  inserted_count, skipped_count, error_count, error_message
)

-- Cursor for Incremental Fetch
ingestion_cursors (
  id, source_id, last_success_at, cursor_json, updated_at
)

-- Tickers (NEW)
tickers (
  id, symbol, name, market, country, is_active, created_at
)

-- News-Ticker Association (NEW)
news_item_tickers (
  news_item_id, ticker_id, confidence, created_at
)
```

---

## 8. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/finans_backend

# Redis (optional, for BullMQ)
REDIS_URL=redis://localhost:6379

# API Configuration
PORT=3001
NODE_ENV=development
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:3000

# Rate Limiting (internal)
THROTTLE_TTL=60000
THROTTLE_LIMIT=120

# Ingestion Settings
GDELT_ENABLED=true
GDELT_INTERVAL_MINUTES=15
SEC_RSS_ENABLED=true
SEC_RSS_INTERVAL_MINUTES=30
KAP_ENABLED=true
KAP_INTERVAL_MINUTES=10
GOOGLE_NEWS_ENABLED=false
GOOGLE_NEWS_INTERVAL_MINUTES=60

# Polite HTTP Settings
HTTP_MAX_CONCURRENT=5
HTTP_MIN_TIME_MS=200
HTTP_RETRY_COUNT=3
HTTP_CACHE_TTL_MS=300000
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)
- [x] Project scaffolding (NestJS)
- [x] Prisma schema & migrations
- [x] Docker Compose setup
- [ ] Basic module structure
- [ ] Health endpoints

### Phase 2: Ingestion Core (Week 2)
- [ ] PoliteHttpService with rate limiting
- [ ] GDELT ingestor implementation
- [ ] SEC RSS ingestor implementation
- [ ] Normalization pipeline

### Phase 3: KAP & Dedup (Week 3)
- [ ] KAP ingestor implementation
- [ ] Fingerprint deduplication
- [ ] Job scheduling (cron)
- [ ] Ingestion run tracking

### Phase 4: Tickers & API (Week 4)
- [ ] Ticker extraction service
- [ ] News API endpoints
- [ ] Ticker API endpoints
- [ ] Admin endpoints

### Phase 5: Polish (Week 5)
- [ ] Google News RSS (optional)
- [ ] Error handling improvements
- [ ] Logging & monitoring
- [ ] Documentation

---

## 10. Testing Strategy

### Unit Tests
- Each ingestor: mock HTTP responses
- Normalizer: various input formats
- Dedup: fingerprint collisions

### Integration Tests
- Database operations
- Full ingestion pipeline
- API endpoint responses

### E2E Tests
- Health check flow
- News list/search flow
- Admin trigger flow

---

## 11. Monitoring & Observability

### Metrics (Future)
- `ingestion_items_total{source, status}`
- `ingestion_duration_seconds{source}`
- `api_requests_total{endpoint, status}`

### Logging
- Structured JSON logs (Pino)
- Request ID tracing
- Error stack traces

### Alerts (Future)
- Ingestion failure rate > 50%
- No items ingested in 1 hour
- Database connection errors


