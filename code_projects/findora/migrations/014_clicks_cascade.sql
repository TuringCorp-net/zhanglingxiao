-- Migration: 014_clicks_cascade.sql
-- 为 clicks 表的 product_id 外键添加 ON DELETE CASCADE
-- 基于: migrations/001_initial_schema.sql

PRAGMA foreign_keys=off;

-- 步骤1: 创建带 CASCADE 的新表
CREATE TABLE clicks_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  anonymous_id TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referer TEXT,
  ip_country TEXT,
  clicked_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 步骤2: 复制数据
INSERT INTO clicks_new SELECT * FROM clicks;

-- 步骤3: 删除旧表
DROP TABLE clicks;

-- 步骤4: 重命名新表
ALTER TABLE clicks_new RENAME TO clicks;

PRAGMA foreign_keys=on;

-- 步骤5: 重建索引
CREATE INDEX IF NOT EXISTS idx_clicks_product_id ON clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_clicks_anonymous_id ON clicks(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_clicks_product_id_clicked_at ON clicks(product_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_user_id_clicked_at ON clicks(user_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_anonymous_id_clicked_at ON clicks(anonymous_id, clicked_at);