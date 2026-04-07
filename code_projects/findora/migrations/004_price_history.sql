-- Migration 004: Price History Table (F-010-05)
-- Purpose: Track price changes for products over time to support price sync checking
-- Usage: External price monitoring service submits price check results to /api/admin/price-check

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  price_min REAL,
  price_max REAL,
  currency TEXT DEFAULT 'USD',
  checked_at TEXT NOT NULL,
  source_url TEXT,
  status TEXT DEFAULT 'unchanged',
  change_direction TEXT,
  change_amount REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at);
