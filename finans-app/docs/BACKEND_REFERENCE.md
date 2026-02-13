# Finans Backend - Complete Reference

## Table of Contents
1. [API Reference](#api-reference)
2. [Local Development Runbook](#local-development-runbook)
3. [Deployment Notes](#deployment-notes)
4. [Troubleshooting Checklist](#troubleshooting-checklist)

---

# API Reference

## Authentication

All endpoints except `/api/health` and `/api/auth/*` require authentication via HTTP-only cookie.

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | ❌ | Login with email/password |
| POST | `/api/auth/logout` | ✅ | Clear session |
| GET | `/api/auth/me` | ✅ | Get current user |

#### POST /api/auth/login
```json
// Request
{ "email": "string", "password": "string" }

// Response 200
{ "success": true, "data": { "id": "string", "email": "string", "name": "string|null", "baseCurrency": "USD|TRY|EUR|GBP" } }

// Response 401
{ "success": false, "error": "Invalid credentials" }
```

---

## Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard` | ✅ | Aggregated dashboard data |

#### GET /api/dashboard
**Query:** `?baseCurrency=TRY`

```json
// Response 200
{
  "success": true,
  "data": {
    "portfolio": {
      "totalValue": "number|null",
      "totalCostBasis": "number",
      "unrealizedGain": "number|null",
      "unrealizedGainPercent": "number|null",
      "positionCount": "number",
      "currency": "string"
    },
    "topHoldings": [
      { "symbol": "string", "name": "string", "type": "string", "value": "number|null", "weight": "number|null" }
    ],
    "allocation": [
      { "type": "string", "value": "number|null", "percentage": "number|null" }
    ],
    "watchlist": {
      "id": "string", "name": "string",
      "items": [
        { "symbol": "string", "name": "string", "type": "string", "currency": "string",
          "price": { "value": "number", "timestamp": "ISO8601" } | null,
          "change": { "value": "number", "percent": "number" } | null }
      ]
    } | null,
    "news": {
      "items": [
        { "id": "string", "title": "string", "url": "string", "source": "string", "publishedAt": "ISO8601", "isRead": "boolean" }
      ],
      "unreadCount": "number"
    },
    "meta": { "calculatedAt": "ISO8601", "durationMs": "number", "pricesMissing?": "string[]" }
  }
}
```

---

## Accounts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/accounts` | ✅ | List accounts |
| POST | `/api/accounts` | ✅ | Create account |
| GET | `/api/accounts/:id` | ✅ | Get account |
| PATCH | `/api/accounts/:id` | ✅ | Update account |
| DELETE | `/api/accounts/:id` | ✅ | Delete account |

#### POST /api/accounts
```json
// Request
{
  "name": "string (required)",
  "type": "brokerage|crypto_exchange|bank|retirement|other",
  "currency": "USD|TRY|EUR|GBP",
  "institution?": "string",
  "accountNumber?": "string",
  "notes?": "string"
}

// Response 201
{ "success": true, "data": { "id": "string", "name": "string", ... } }
```

---

## Assets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/assets` | ✅ | List/search assets |
| POST | `/api/assets` | ✅ | Create asset |
| GET | `/api/assets/:id` | ✅ | Get asset |
| PATCH | `/api/assets/:id` | ✅ | Update asset |
| DELETE | `/api/assets/:id` | ✅ | Delete asset |

#### GET /api/assets
**Query:** `?type=stock&exchange=NASDAQ&query=apple&limit=50&offset=0`

#### POST /api/assets
```json
// Request
{
  "symbol": "string (required)",
  "name": "string (required)",
  "type": "stock|crypto|etf|bond|cash|commodity",
  "exchange?": "string (default: GLOBAL)",
  "currency?": "USD|TRY|EUR|GBP",
  "isin?": "string",
  "sector?": "string",
  "country?": "string"
}
```

---

## Trades

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/trades` | ✅ | List trades |
| POST | `/api/trades` | ✅ | Create trade |
| GET | `/api/trades/:id` | ✅ | Get trade |
| PATCH | `/api/trades/:id` | ✅ | Update trade |
| DELETE | `/api/trades/:id` | ✅ | Delete trade |

#### GET /api/trades
**Query:** `?accountId=xxx&assetId=xxx&startDate=2024-01-01&endDate=2024-12-31&limit=50&offset=0`

#### POST /api/trades
```json
// Request
{
  "accountId": "string (required)",
  "assetId": "string (required)",
  "type": "buy|sell|dividend|interest|deposit|withdrawal|transfer_in|transfer_out|split|fee",
  "quantity": "number (required)",
  "price": "number (required)",
  "fees?": "number (default: 0)",
  "currency?": "USD|TRY|EUR|GBP",
  "executedAt": "ISO8601 (required)",
  "notes?": "string",
  "externalId?": "string"
}
```

---

## Portfolio

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/portfolio/positions` | ✅ | Calculated positions |
| GET | `/api/portfolio/summary` | ✅ | Portfolio summary |

#### GET /api/portfolio/positions
**Query:** `?accountId=xxx&includeZero=true&baseCurrency=TRY`

```json
// Response 200
{
  "success": true,
  "data": {
    "positions": [
      {
        "assetId": "string",
        "asset": { "id": "string", "symbol": "string", "name": "string", "type": "string", "exchange": "string", "currency": "string" },
        "quantity": "number",
        "avgCost": "number",
        "costBasis": "number",
        "currentPrice": "number|null",
        "currentValue": "number|null",
        "unrealizedGain": "number|null",
        "unrealizedGainPercent": "number|null",
        "realizedGain": "number",
        "totalDividends": "number",
        "totalFees": "number"
      }
    ],
    "meta": { "count": "number", "pricesMissing": "string[]", "baseCurrency?": "string", "calculatedAt": "ISO8601" }
  }
}
```

---

## Watchlists

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/watchlists` | ✅ | List watchlists |
| POST | `/api/watchlists` | ✅ | Create watchlist |
| GET | `/api/watchlists/:id` | ✅ | Get watchlist |
| PATCH | `/api/watchlists/:id` | ✅ | Update watchlist |
| DELETE | `/api/watchlists/:id` | ✅ | Delete watchlist |
| GET | `/api/watchlists/:id/items` | ✅ | List items |
| POST | `/api/watchlists/:id/items` | ✅ | Add item |
| DELETE | `/api/watchlists/:id/items/:itemId` | ✅ | Remove item |

---

## Markets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/markets/watchlist/:id` | ✅ | Watchlist with prices |
| GET | `/api/markets/quotes` | ✅ | Quick price lookup |

#### GET /api/markets/quotes
**Query:** `?symbols=AAPL,BTC,ETH&exchange=NASDAQ`

---

## News

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/news/sources` | ✅ | List RSS sources |
| POST | `/api/news/sources` | ✅ | Create source |
| PATCH | `/api/news/sources/:id` | ✅ | Update source |
| DELETE | `/api/news/sources/:id` | ✅ | Delete source |
| GET | `/api/news/feed` | ✅ | Get news feed |
| POST | `/api/news/:id/read` | ✅ | Mark as read |
| POST | `/api/news/:id/unread` | ✅ | Mark as unread |

#### GET /api/news/feed
**Query:** `?since=2024-01-01T00:00:00Z&sourceId=xxx&unreadOnly=true&tag=crypto&limit=50&offset=0`

---

## Admin / Ingestion

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/ingest/crypto-prices` | ✅ | Ingest crypto prices |
| POST | `/api/admin/ingest/fx` | ✅ | Ingest FX rates |
| POST | `/api/admin/ingest/rss` | ✅ | Ingest RSS feeds |

#### POST /api/admin/ingest/crypto-prices
```json
// Request
{ "symbols?": ["BTC", "ETH"], "fromWatchlists?": true }

// Response 200
{ "success": true, "data": { "provider": "CoinGecko", "stats": { "requested": 4, "inserted": 3, "skipped": 1, "errors": 0 }, "durationMs": 1250 } }
```

---

## Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | ❌ | Health check |

```json
// Response 200
{ "status": "healthy", "timestamp": "ISO8601", "database": "connected" }

// Response 503
{ "status": "unhealthy", "timestamp": "ISO8601", "database": "disconnected", "error": "string" }
```

---

## Standard Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "string", "errors?": { "field": ["message"] } }
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `204` - No Content (DELETE)
- `400` - Validation Error
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Server Error
- `503` - Service Unavailable

---

# Local Development Runbook

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or Docker)
- npm or pnpm

## Step 1: Clone & Install

```bash
git clone <repo>
cd finans-app
npm install
```

## Step 2: Database Setup

**Option A: Docker (Recommended)**
```bash
docker run --name finans-postgres \
  -e POSTGRES_USER=finans \
  -e POSTGRES_PASSWORD=finans123 \
  -e POSTGRES_DB=finans \
  -p 5432:5432 \
  -d postgres:16
```

**Option B: Local PostgreSQL**
```sql
CREATE USER finans WITH PASSWORD 'finans123';
CREATE DATABASE finans OWNER finans;
```

## Step 3: Environment Variables

Create `.env`:
```env
# Database
DATABASE_URL="postgresql://finans:finans123@localhost:5432/finans"

# Auth
JWT_SECRET="your-secret-key-min-32-chars-long-change-me"
BCRYPT_ROUNDS=12

# Optional
NODE_ENV=development
```

## Step 4: Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

## Step 5: Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

## Step 6: Test Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "admin@finans.local", "password": "changeme123"}'

# Test protected endpoint
curl http://localhost:3000/api/dashboard -b cookies.txt
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |
| `npm run lint` | Run ESLint |

---

# Deployment Notes

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, used for JWT signing |
| `BCRYPT_ROUNDS` | ❌ | Password hashing rounds (default: 12) |
| `NODE_ENV` | ❌ | `production` for secure cookies |

## Database URL Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

**Example (Supabase):**
```
postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**Example (Neon):**
```
postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/finans?sslmode=require
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` (32+ random chars)
- [ ] Use `?sslmode=require` in DATABASE_URL
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm run db:migrate` before first deploy
- [ ] Seed initial user: `npm run db:seed`
- [ ] Change default password immediately

## Platform-Specific

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set env vars
vercel env add DATABASE_URL
vercel env add JWT_SECRET
```

### Railway
```bash
# Database URL auto-provisioned
# Add JWT_SECRET in dashboard
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

---

# Troubleshooting Checklist

## Authentication Issues

| Symptom | Check |
|---------|-------|
| "Unauthorized" on all endpoints | Cookie not being sent? Use `-b cookies.txt` with curl |
| "Invalid credentials" | Email case-sensitive? Use lowercase |
| Token expired | Re-login (tokens expire in 7 days) |
| Cookies not working locally | Ensure `NODE_ENV` != `production` or use HTTPS |

## Database Issues

| Symptom | Check |
|---------|-------|
| "Connection refused" | Is PostgreSQL running? Check port 5432 |
| "Database does not exist" | Run `npm run db:migrate` |
| "Relation does not exist" | Run `npm run db:generate` then `db:migrate` |
| Prisma client errors | Run `npm run db:generate` |

## Price/Portfolio Issues

| Symptom | Check |
|---------|-------|
| `totalValue: null` | Missing prices for assets. Run ingestion. |
| Wrong calculations | Trades must have correct `executedAt` dates |
| FX conversion missing | Run `/api/admin/ingest/fx` |

## Ingestion Issues

| Symptom | Check |
|---------|-------|
| Crypto prices not updating | CoinGecko rate limit (10 req/min) |
| RSS items not appearing | Source `isActive: true`? URL valid? |
| "Symbol not found" | Check `SYMBOL_MAP` in `crypto.ts` |

## Common Fixes

```bash
# Reset everything
npm run db:reset

# Regenerate Prisma client
npm run db:generate

# Clear and reseed
npm run db:reset && npm run db:seed

# Check database connection
curl http://localhost:3000/api/health
```

## Debug Queries

```bash
# Enable Prisma query logging
DATABASE_URL="..." npx prisma studio

# Check user exists
curl http://localhost:3000/api/auth/me -b cookies.txt

# Check database health
curl http://localhost:3000/api/health
```

---

# Review Notes

## Security ✅

- All protected endpoints use `withAuth()` wrapper
- JWT tokens stored in HTTP-only cookies
- Passwords hashed with bcrypt (12 rounds)
- User ownership verified on all mutations
- No secrets in code (all via env vars)

## Consistency ✅

- Standard response format: `{ success, data, error }`
- Consistent error codes and messages
- Snake_case for DB columns, camelCase for API
- All dates as ISO8601 strings
- Decimal(18,8) for all monetary values

## Correctness ✅

- Decimal math via Prisma Decimal type
- Time-series queries use `DISTINCT ON` for latest
- Trade calculations use weighted average method
- FX conversion handles inverse rates
- De-duplication on all time-series data

## Extensibility ✅

Schema supports future additions:
- AI: Add `AiAnalysis` model linking to assets/news
- Documents: Add `Document` model with file refs
- Alerts: Add `Alert` model for notifications
- Goals: Add `Goal` model for financial targets





