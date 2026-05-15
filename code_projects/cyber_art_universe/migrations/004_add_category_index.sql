-- 004: 为 works.category 添加索引（CAU catalog / Write 侧按分类筛选）
CREATE INDEX IF NOT EXISTS idx_works_category ON works(category);
