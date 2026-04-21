-- Migration: 017_conversions_cascade.sql
-- 为 conversions 表的 product_id 外键添加 ON DELETE CASCADE
-- 基于: migrations/013_runtime_tables.sql

PRAGMA foreign_keys=off;

-- 步骤1: 创建带 CASCADE 的新表
CREATE TABLE conversions_new (
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
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 步骤2: 复制数据
INSERT INTO conversions_new SELECT * FROM conversions;

-- 步骤3: 删除旧表
DROP TABLE conversions;

-- 步骤4: 重命名新表
ALTER TABLE conversions_new RENAME TO conversions;

PRAGMA foreign_keys=on;

-- 步骤5: 重建索引
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_product_id ON conversions(product_id);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
CREATE INDEX IF NOT EXISTS idx_conversions_received_at ON conversions(received_at);