-- Findora D1 Schema Migration 009: F-030 Content Disclosure Fields
-- O-F030-06: Disclosure declaration validation for affiliate/sponsored content

-- Add content_type and disclosure columns to lists table for compliance tracking
ALTER TABLE lists ADD COLUMN content_type TEXT DEFAULT 'organic' CHECK(content_type IN ('organic', 'affiliate', 'sponsored'));
ALTER TABLE lists ADD COLUMN disclosure TEXT;

-- Index for content_type filtering
CREATE INDEX IF NOT EXISTS idx_lists_content_type ON lists(content_type);

-- Add structured fields to topic_products for enhanced content management (O-F030-01)
ALTER TABLE topic_products ADD COLUMN product_url TEXT;
ALTER TABLE topic_products ADD COLUMN highlight_tags TEXT; -- JSON array for key features
ALTER TABLE topic_products ADD COLUMN comparison_notes TEXT; -- Pros/Cons summary

-- Add scheduled_publish_at to content_topics for flexible publishing (O-F030-03)
ALTER TABLE content_topics ADD COLUMN scheduled_publish_at TEXT;

-- Add version tracking for content rollback (O-F030-04)
ALTER TABLE content_production ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE content_production ADD COLUMN parent_version_id TEXT; -- For version chain