-- Findora Runtime Tables Migration 013
-- Migration: 013_runtime_tables.sql
-- Description: Formalize runtime-created tables as proper migrations
-- Created: 2026-04-13
--
-- NOTE: price_history is defined in migrations/004_price_history.sql
-- NOTE: ai_review_records is defined in migrations/005_ai_review_records.sql
-- This migration only includes tables that were NOT already in prior migrations.

-- This migration formalizes tables that were previously created at runtime
-- via CREATE TABLE IF NOT EXISTS. Having them in a migration ensures
-- consistent schema across environments and makes deployment auditable.

-- Conversions table - F-012-05
-- Records conversion callbacks from affiliate networks
CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  click_id TEXT,
  product_id TEXT,
  user_id TEXT,
  anonymous_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT,
  revenue REAL,
  currency TEXT DEFAULT 'USD',
  partner TEXT,
  partner_event_id TEXT,
  reported_at TEXT,
  received_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_product_id ON conversions(product_id);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
CREATE INDEX IF NOT EXISTS idx_conversions_received_at ON conversions(received_at);

-- Explanation cache table - F-016-04
-- Caches AI-generated recommendation explanations
CREATE TABLE IF NOT EXISTS explanation_cache (
  cache_key TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  explanation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  ai_extended TEXT,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cache_product ON explanation_cache(product_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON explanation_cache(expires_at);

-- Email logs table - F-013-07
-- Tracks email delivery and engagement events
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'pending',
  provider_response TEXT,
  sent_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  bounced_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
