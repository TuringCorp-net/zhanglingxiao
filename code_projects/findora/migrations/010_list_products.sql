-- Findora D1 Schema Migration 010: F-004 list_products Association Table
-- C-01: Fix missing list_products table referenced by lists.ts and content.ts

-- Create list_products association table
CREATE TABLE IF NOT EXISTS list_products (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Index for efficient list->products lookup
CREATE INDEX IF NOT EXISTS idx_list_products_list_id ON list_products(list_id);

-- Index for efficient product->lists lookup (reverse association)
CREATE INDEX IF NOT EXISTS idx_list_products_product_id ON list_products(product_id);

-- Composite index for ordered retrieval
CREATE INDEX IF NOT EXISTS idx_list_products_list_position ON list_products(list_id, position);
