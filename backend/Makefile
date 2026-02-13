# =============================================================================
# FINANS BACKEND - MAKEFILE
# =============================================================================
# Usage: make <target>
# Run 'make help' to see all available commands
# =============================================================================

.PHONY: help install dev build test lint clean docker-up docker-down db-setup db-reset seed migrate

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# HELP
# =============================================================================

help: ## Show this help message
	@echo "Finans Backend - Available Commands"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# DEVELOPMENT
# =============================================================================

install: ## Install dependencies
	npm install

dev: ## Start development server
	npm run dev

build: ## Build for production
	npm run build

start: ## Start production server
	npm start

# =============================================================================
# TESTING & LINTING
# =============================================================================

test: ## Run unit tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-cov: ## Run tests with coverage
	npm run test:cov

lint: ## Run ESLint
	npm run lint

lint-fix: ## Fix ESLint errors
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	npm run typecheck

check: ## Run all checks (lint + typecheck + test)
	npm run check

smoke: ## Run smoke test (requires running server)
	npm run smoke

smoke-mock: ## Run smoke test with mock data
	npm run smoke:mock

smoke-verbose: ## Run smoke test with verbose output
	npm run smoke:verbose

ci: ## Run CI checks (lint + typecheck + test + build)
	npm run ci

ci-smoke: ## Run CI checks with smoke test
	npm run ci:smoke

# =============================================================================
# DATABASE
# =============================================================================

db-setup: ## Setup database (generate + migrate + seed)
	npm run db:setup

db-reset: ## Reset database and re-seed
	npm run db:reset

migrate: ## Run database migrations
	npm run migrate

migrate-dev: ## Create and run migrations (dev)
	npm run migrate:dev

seed: ## Seed database
	npm run seed

studio: ## Open Prisma Studio
	npm run prisma:studio

# =============================================================================
# DOCKER
# =============================================================================

docker-up: ## Start PostgreSQL container
	docker-compose up -d db

docker-redis: ## Start PostgreSQL + Redis
	docker-compose --profile redis up -d

docker-all: ## Start all containers
	docker-compose --profile redis --profile app up -d

docker-down: ## Stop all containers
	docker-compose down

docker-clean: ## Stop containers and remove volumes
	docker-compose down -v

docker-logs: ## Follow container logs
	docker-compose logs -f

docker-build: ## Build Docker image
	docker-compose build app

# =============================================================================
# UTILITIES
# =============================================================================

clean: ## Clean build artifacts
	npm run clean

env: ## Create .env from example
	cp env.example .env
	@echo ".env file created. Please edit it with your settings."

# =============================================================================
# SHORTCUTS
# =============================================================================

up: docker-up ## Alias for docker-up
down: docker-down ## Alias for docker-down
logs: docker-logs ## Alias for docker-logs
t: test ## Alias for test
l: lint ## Alias for lint

