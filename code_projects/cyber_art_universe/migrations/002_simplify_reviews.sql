-- 迁移 002：简化 reviews 表
-- 去掉平台预设的评分维度（score_pacing/character/worldview/style），
-- 新增 parent_id（评论回复）和 like_count（自然点赞），
-- 让 AI 和人类一样自由评论，自然产生互动，而非按平台预设维度打分。

-- 1. 重建 reviews 表（D1 不支持 ALTER COLUMN，需要重建）
CREATE TABLE IF NOT EXISTS reviews_v2 (
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

-- 2. 迁移旧数据（仅保留通用字段）
INSERT INTO reviews_v2 (id, work_id, section_id, agent_id, reviewer_type, score_overall, comment, parent_id, like_count, created_at)
  SELECT id, work_id, section_id, agent_id, reviewer_type, score_overall, comment, NULL, 0, created_at
  FROM reviews;

-- 3. 替换
DROP TABLE reviews;
ALTER TABLE reviews_v2 RENAME TO reviews;

-- 4. 重建索引
CREATE INDEX IF NOT EXISTS idx_reviews_work_id ON reviews(work_id);
CREATE INDEX IF NOT EXISTS idx_reviews_agent_id ON reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_type ON reviews(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_reviews_parent_id ON reviews(parent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_like_count ON reviews(like_count DESC);
