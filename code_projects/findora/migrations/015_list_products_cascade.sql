-- Migration: 015_list_products_cascade.sql
-- 为 list_products 表的 product_id 外键添加 ON DELETE CASCADE
-- 基于: migrations/010_list_products.sql
-- NOTE: 此表在 migrations/010 中已定义为 ON DELETE CASCADE，此处重建以确保一致性

PRAGMA foreign_keys=off;

-- 步骤1: 创建带 CASCADE 的新表
CREATE TABLE list_products_new (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(list_id, product_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 步骤2: 复制数据
INSERT INTO list_products_new SELECT * FROM list_products;

-- 步骤3: 删除旧表
DROP TABLE list_products;

-- 步骤4: 重命名新表
ALTER TABLE list_products_new RENAME TO list_products;

PRAGMA foreign_keys=on;

-- 步骤5: 重建索引
CREATE INDEX IF NOT EXISTS idx_list_products_list_id ON list_products(list_id);
CREATE INDEX IF NOT EXISTS idx_list_products_product_id ON list_products(product_id);
CREATE INDEX IF NOT EXISTS idx_list_products_list_position ON list_products(list_id, position);