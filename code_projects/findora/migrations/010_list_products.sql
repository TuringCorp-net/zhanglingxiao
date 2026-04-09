-- Findora D1 Schema Migration 010: Normalize list_products schema
PRAGMA foreign_keys=off;

ALTER TABLE list_products RENAME TO list_products_legacy;

CREATE TABLE list_products (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(list_id, product_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO list_products (id, list_id, product_id, position, created_at)
SELECT
  lower(hex(randomblob(16))),
  list_id,
  product_id,
  COALESCE(position, 0),
  datetime('now')
FROM list_products_legacy;

DROP TABLE list_products_legacy;

PRAGMA foreign_keys=on;

-- Index for efficient list->products lookup
CREATE INDEX IF NOT EXISTS idx_list_products_list_id ON list_products(list_id);

-- Index for efficient product->lists lookup (reverse association)
CREATE INDEX IF NOT EXISTS idx_list_products_product_id ON list_products(product_id);

-- Composite index for ordered retrieval
CREATE INDEX IF NOT EXISTS idx_list_products_list_position ON list_products(list_id, position);
