-- Global Configs Migration 014
-- Migration: 014_global_configs.sql
-- Description: Global configuration key-value store
-- Created: 2026-04-13

-- Global configs table for runtime configuration management
CREATE TABLE IF NOT EXISTS global_configs (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_configs_key ON global_configs(key);
CREATE INDEX IF NOT EXISTS idx_global_configs_updated_at ON global_configs(updated_at);

-- Seed default configs
INSERT OR IGNORE INTO global_configs (id, key, value, description, updated_at, created_at)
VALUES
  (lower(hex(randomblob(8))), 'site_name', 'Findora', 'Site display name', datetime('now'), datetime('now')),
  (lower(hex(randomblob(8))), 'home_tags', '["trending","new","featured"]', 'Home page featured tag slugs', datetime('now'), datetime('now')),
  (lower(hex(randomblob(8))), 'token_expiry', '86400', 'Session token expiry in seconds (default 24h)', datetime('now'), datetime('now')),
  (lower(hex(randomblob(8))), 'items_per_page', '20', 'Default pagination size', datetime('now'), datetime('now'));
