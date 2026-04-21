-- Migration: 018_explanation_cache_cascade.sql
-- 为 explanation_cache 表的 product_id 外键添加 ON DELETE CASCADE
-- 基于: migrations/013_runtime_tables.sql

PRAGMA foreign_keys=off;

-- 步骤1: 创建带 CASCADE 的新表
CREATE TABLE explanation_cache_new (
  cache_key TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  explanation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  ai_extended TEXT,
  generated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 步骤2: 复制数据
INSERT INTO explanation_cache_new SELECT * FROM explanation_cache;

-- 步骤3: 删除旧表
DROP TABLE explanation_cache;

-- 步骤4: 重命名新表
ALTER TABLE explanation_cache_new RENAME TO explanation_cache;

PRAGMA foreign_keys=on;

-- 步骤5: 重建索引
CREATE INDEX IF NOT EXISTS idx_cache_product ON explanation_cache(product_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON explanation_cache(expires_at);