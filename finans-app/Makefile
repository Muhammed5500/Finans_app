# =============================================================================
# FINANS APP - MAKEFILE
# =============================================================================
# Common development tasks
# =============================================================================

.PHONY: help dev build start lint format typecheck db-setup db-migrate db-seed docker-up docker-down

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# DEVELOPMENT
# =============================================================================

dev: ## Start development server
	npm run dev

build: ## Build for production
	npm run build

start: ## Start production server
	npm run start

# =============================================================================
# CODE QUALITY
# =============================================================================

lint: ## Run ESLint
	npm run lint

lint-fix: ## Fix ESLint errors
	npm run lint:fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

typecheck: ## Run TypeScript type checking
	npm run typecheck

check: ## Run all checks (lint + typecheck + format)
	npm run check

# =============================================================================
# DATABASE
# =============================================================================

db-setup: ## Setup database (generate, migrate, seed)
	npm run db:setup

db-generate: ## Generate Prisma client
	npm run db:generate

db-migrate: ## Run database migrations
	npm run db:migrate

db-migrate-create: ## Create new migration
	npm run db:migrate:create

db-push: ## Push schema changes to database
	npm run db:push

db-seed: ## Seed database
	npm run db:seed

db-studio: ## Open Prisma Studio
	npm run db:studio

db-reset: ## Reset database (WARNING: deletes all data)
	npm run db:reset

# =============================================================================
# DOCKER
# =============================================================================

docker-up: ## Start Docker services (PostgreSQL with pgvector)
	docker-compose up -d

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## Follow Docker logs
	docker-compose logs -f

docker-db: ## Start only database
	docker-compose up -d db

# =============================================================================
# NEWS INGESTION
# =============================================================================

ingest-rss: ## Fetch RSS feeds from all enabled sources
	npm run ingest:rss

ingest-rss-source: ## Fetch RSS feed for specific source (usage: make ingest-rss-source SOURCE_ID=xxx)
	npm run ingest:rss $(SOURCE_ID)

clean-news: ## Clean all raw news items
	npm run clean:news

clean-news-limit: ## Clean news items with limit (usage: make clean-news-limit LIMIT=500)
	npm run clean:news "" $(LIMIT)

embed-news: ## Generate embeddings for all cleaned news items
	npm run embed:news

embed-news-limit: ## Generate embeddings with limit (usage: make embed-news-limit LIMIT=500)
	npm run embed:news "" $(LIMIT)

analyze-news: ## Analyze all cleaned news items without analysis
	npm run ai:analyze-news

analyze-news-limit: ## Analyze news items with limit (usage: make analyze-news-limit LIMIT=20)
	npm run ai:analyze-news -- --limit=$(LIMIT)

# =============================================================================
# BACKGROUND JOBS
# =============================================================================

jobs-tick: ## Run all background jobs once
	npm run jobs:tick

# =============================================================================
# TESTING
# =============================================================================

test: ## Run all tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-ui: ## Run tests with UI
	npm run test:ui

test-coverage: ## Run tests with coverage
	npm run test:coverage

# =============================================================================
# AI MODULE
# =============================================================================

ai-analyze-news: ## Analyze unanalyzed news items (requires OPENAI_API_KEY)
	@echo "Use POST /api/admin/ai/ingest/news-analysis endpoint"

ai-infer-profile: ## Infer investor profile (requires OPENAI_API_KEY)
	@echo "Use POST /api/ai/profile/infer endpoint"

ai-generate-insights: ## Generate portfolio insights (requires OPENAI_API_KEY)
	@echo "Use POST /api/ai/portfolio/insights endpoint"
