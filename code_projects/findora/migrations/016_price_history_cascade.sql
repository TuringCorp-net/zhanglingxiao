-- Migration: 016_price_history_cascade.sql
-- 为 price_history 表的 product_id 外键添加 ON DELETE CASCADE
-- 基于: migrations/004_price_history.sql

PRAGMA foreign_keys=off;

-- 步骤1: 创建带 CASCADE 的新表
CREATE TABLE price_history_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  price_min REAL,
  price_max REAL,
  currency TEXT DEFAULT 'USD',
  checked_at TEXT NOT NULL,
  source_url TEXT,
  status TEXT DEFAULT 'unchanged',
  change_direction TEXT,
  change_amount REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 步骤2: 复制数据
INSERT INTO price_history_new SELECT * FROM price_history;

-- 步骤3: 删除旧表
DROP TABLE price_history;

-- 步骤4: 重命名新表
ALTER TABLE price_history_new RENAME TO price_history;

PRAGMA foreign_keys=on;

-- 步骤5: 重建索引
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at);