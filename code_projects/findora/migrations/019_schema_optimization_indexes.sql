-- Phase 1: Schema Optimization Indexes
-- For SRS v4.12 D1 Schema Modification

-- Index for category + status + created_at combination (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_products_cat_status_created ON products(category, status, created_at);

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_min, price_max);

-- Index for tag layer filtering
CREATE INDEX IF NOT EXISTS idx_tags_layer ON tags(layer);