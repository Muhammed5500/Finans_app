# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo financial analytics platform with three independent services:

- **backend/** — NestJS news aggregation API (port 3001). Collects from GDELT, SEC RSS, KAP, Google News. PostgreSQL via Prisma ORM.
- **finans-api/** — Express market data API (port 3002). Serves BIST, US, and crypto prices from Binance/Finnhub/Yahoo Finance. Includes WebSocket real-time price streams.
- **finans-app/** — React + Vite frontend (port 5173). Portfolio tracker with AI-powered insights, news feed, and market dashboards.

## Commands

### Backend (run from `backend/`)

```bash
npm run dev                # NestJS watch mode
npm run build              # Compile TypeScript
npm test                   # Jest unit tests
npm run test:e2e           # End-to-end tests
npm run test:watch         # Jest watch mode
npm run lint               # ESLint
npm run lint:fix           # ESLint autofix
npm run typecheck          # tsc --noEmit
npm run check              # lint + typecheck + test (all checks)
npm run db:setup           # prisma generate + migrate + seed
npm run db:reset           # Reset and re-seed database
npm run migrate:dev        # Create new migration
npm run prisma:studio      # Prisma Studio GUI
npm run docker:db          # Start PostgreSQL container only
npm run smoke              # Full smoke test
```

`make` shortcuts available — run `make help` to see targets.

### finans-api (run from `finans-api/`)

```bash
npm run dev                # ts-node-dev watch mode
npm run build              # Compile to dist/
npm run smoke:bist         # BIST market smoke test
npm run smoke:us           # US market smoke test
```

### finans-app (run from `finans-app/`)

```bash
npm run dev                # Vite dev server
npm run build              # Production build
npm run lint               # ESLint
```

## Architecture

```
Frontend (React/Vite :5173)
    ├── REST → backend (NestJS :3001) → PostgreSQL (news_items, tickers, tags)
    └── REST + WebSocket → finans-api (Express :3002) → Binance/Finnhub/Yahoo
```

### Backend — NestJS module structure

- **modules/ingestion/collectors/** — Source-specific collectors (GDELT, SEC RSS, KAP, Google News), each toggled via env vars (`GDELT_ENABLED`, etc.)
- **modules/jobs/** — Cron or BullMQ job scheduling (Redis optional via `USE_REDIS_QUEUE`)
- **modules/news/** — REST API for querying aggregated news with pagination, filtering, full-text search
- **modules/tickers/** and **modules/tags/** — Ticker/tag CRUD and management
- **infrastructure/** — Cross-cutting: LRU cache, polite HTTP client with rate limiting, circuit breaker, Pino structured logging, Prisma client, metrics
- **shared/tagging/** — Automatic ticker/tag extraction from news titles

Resilience patterns: circuit breaker on external APIs, token-bucket rate limiting per GDELT query, retry with exponential backoff, HTTP throttling via bottleneck.

### finans-api — Express layered architecture

- **controllers/** — Route handlers for BIST, US, crypto, news, health
- **services/** — Market-specific data fetchers (binance/, finnhub/, yahoo/, us/)
- **ws/** — WebSocket servers: `priceServer.ts` (crypto), `usWsServer.ts` (US stocks)
- Swagger docs auto-generated at `/api/docs`

### finans-app — React SPA

- **pages/** — Markets, AssetDetail, Portfolio, News, Favorites, Settings
- **contexts/** — React Context for global state
- **layouts/MainLayout.jsx** — App shell
- Path alias: `@/*` maps to `src/*`
- Vite proxies `/api/*` to backends in development

## Database

Two PostgreSQL databases, both managed with Prisma:

**finans_backend** (backend/prisma/schema.prisma):
- `news_items` with source enum (GDELT, SEC_RSS, KAP, GOOGLE_NEWS)
- `tickers` with market enum (BIST, USA, CRYPTO, MACRO)
- `tags` — many-to-many with news via junction tables
- URL-based deduplication for news items

**finans_dev** (finans-app/prisma/schema.prisma):
- Users, accounts, trades, watchlists
- AI tables: `investor_profiles`, `portfolio_insights`, `news_analyzed` (with embeddings)
- `portfolio_snapshots` for historical tracking

## Code Conventions

- **Backend**: single quotes, trailing commas, ESLint + Prettier. TypeScript strict mode OFF. NestJS decorators for DI/validation.
- **finans-api**: TypeScript strict mode ON. Express async handler wrappers. Custom `AppError` class.
- **finans-app**: TypeScript strict mode ON. JSX components (not TSX). ESLint flat config.
- Paginated API responses use `{ data, page, pageSize, total }` format.
- Backend uses class-validator DTOs with whitelist validation.

## Local Development Setup

1. Copy env files: `backend/env.example` → `.env`, `finans-api/.env.example` → `.env`, `finans-app/.env.example` → `.env`
2. Start PostgreSQL: `cd backend && npm run docker:db`
3. Setup DB: `cd backend && npm run db:setup`
4. Run each service in separate terminals with `npm run dev`
