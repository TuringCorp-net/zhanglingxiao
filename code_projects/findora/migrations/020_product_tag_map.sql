-- Phase 2: Product-Tag Bridge Table
-- For SRS v4.12 D1 Schema Modification

CREATE TABLE IF NOT EXISTS product_tag_map (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  UNIQUE(product_id, tag_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Index for tag_id lookups
CREATE INDEX IF NOT EXISTS idx_ptm_tag_id ON product_tag_map(tag_id);

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_ptm_product_id ON product_tag_map(product_id);