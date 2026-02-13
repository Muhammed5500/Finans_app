-- =============================================================================
-- FINANS BACKEND - DATABASE INITIALIZATION
-- =============================================================================
-- This script runs automatically when the PostgreSQL container starts
-- for the first time. It creates the database if it doesn't exist.
-- =============================================================================

-- Create database if not exists (PostgreSQL doesn't support IF NOT EXISTS for CREATE DATABASE)
-- The database is already created by POSTGRES_DB env var, so this is just a placeholder

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully';
END $$;


