-- =============================================================================
-- PGVECTOR EXTENSION INITIALIZATION
-- =============================================================================
-- This script runs automatically when the PostgreSQL container starts
-- It enables the pgvector extension for vector similarity search
-- =============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
