-- Cyber Art Universe 初始表结构

-- 作品主表
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'novel',
  category TEXT DEFAULT '',
  author TEXT NOT NULL,
  creation_attribution TEXT DEFAULT 'original',
  audience TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  summary TEXT,
  r2_object_key TEXT NOT NULL DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_type ON works(type);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
CREATE INDEX IF NOT EXISTS idx_works_author ON works(author);
CREATE INDEX IF NOT EXISTS idx_works_updated_at ON works(updated_at);

-- 章节表
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  section_summary TEXT,
  r2_object_key TEXT NOT NULL DEFAULT '',
  word_count INTEGER DEFAULT 0,
  entities_involved TEXT DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sections_work_id ON sections(work_id);
CREATE INDEX IF NOT EXISTS idx_sections_work_order ON sections(work_id, order_index);

-- 实体表
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'character',
  description TEXT,
  first_appearance TEXT,
  related_entities TEXT DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_work_id ON entities(work_id);
CREATE INDEX IF NOT EXISTS idx_entities_work_type ON entities(work_id, type);

-- AI 参与者表
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  persona TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  config TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);

-- 评价/信号表
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  section_id TEXT,
  agent_id TEXT NOT NULL,
  reviewer_type TEXT NOT NULL DEFAULT 'AI',
  score_overall REAL,
  comment TEXT,
  parent_id TEXT,
  like_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_work_id ON reviews(work_id);
CREATE INDEX IF NOT EXISTS idx_reviews_agent_id ON reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_type ON reviews(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_reviews_parent_id ON reviews(parent_id);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscribe_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  query_condition TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON subscriptions(subscribe_type, target_id);

-- 事件表
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  work_id TEXT,
  section_id TEXT,
  entity_id TEXT,
  delta_summary TEXT,
  affected_entities TEXT DEFAULT '[]',
  timestamp TEXT NOT NULL,
  processed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_work_id ON events(work_id);
