-- Findora D1 Schema Migration 008: F-030 Content Management Workflow
-- Based on SRS Section 10: Content Storage Structure and Content Workflow (F-031)

-- Content topics (选题)
-- Tracks the 5-step workflow: idea → in_review → approved → published → archived
CREATE TABLE IF NOT EXISTS content_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'idea' CHECK(status IN ('idea', 'in_review', 'approved', 'published', 'archived')),
  priority INTEGER DEFAULT 3,
  target_week TEXT,
  created_by TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  approved_at TEXT,
  published_at TEXT,
  archived_at TEXT,
  weekly_output INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Topic-Product association (候选商品)
-- Links topics to candidate products (20-50 products per topic)
CREATE TABLE IF NOT EXISTS topic_products (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  ai_score REAL,
  ai_reason TEXT,
  human_verified INTEGER DEFAULT 0,
  is_selected INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES content_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Content production tracking
-- Tracks weekly output metrics for data review sessions (周四复盘)
CREATE TABLE IF NOT EXISTS content_production (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  list_id TEXT,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  products_published INTEGER DEFAULT 0,
  content_type TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  review_notes TEXT,
  review_completed INTEGER DEFAULT 0,
  review_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES content_topics(id) ON DELETE SET NULL,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL
);

-- Workflow audit log (for compliance tracking)
CREATE TABLE IF NOT EXISTS workflow_audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for content management tables
CREATE INDEX IF NOT EXISTS idx_content_topics_status ON content_topics(status);
CREATE INDEX IF NOT EXISTS idx_content_topics_created_by ON content_topics(created_by);
CREATE INDEX IF NOT EXISTS idx_content_topics_target_week ON content_topics(target_week);
CREATE INDEX IF NOT EXISTS idx_topic_products_topic_id ON topic_products(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_products_product_id ON topic_products(product_id);
CREATE INDEX IF NOT EXISTS idx_topic_products_selected ON topic_products(topic_id, is_selected);
CREATE INDEX IF NOT EXISTS idx_content_production_week ON content_production(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_content_production_status ON content_production(status);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_entity ON workflow_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_created ON workflow_audit_log(created_at);
