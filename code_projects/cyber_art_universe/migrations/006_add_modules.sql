-- V3 统一数据架构：modules 表
-- 将 M0-M6 所有模块实例统一管理，替代分散在 entities/sections/R2 的碎片化存储
-- 迁移策略：INSERT 新数据，不删除旧表（旧表后续逐步废弃）

-- 1. 创建 modules 表
CREATE TABLE IF NOT EXISTS modules (
  id          TEXT PRIMARY KEY,       -- module_id: 'm1_{work_id}', 'm3_card_{entity_id}', etc.
  work_id     TEXT NOT NULL,
  type        TEXT NOT NULL,          -- 'm0'|'m1'|'m2'|'m3_card'|'m4_strategy'|'m4_card'|'m5_intent'|'m6_chapter'
  name        TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  status      TEXT DEFAULT 'empty',   -- 'empty'|'in_progress'|'done'
  r2_json_key TEXT,                   -- R2 .json 相对路径（不含 works/{id}/{lang}/ 前缀）
  r2_md_key   TEXT,                   -- R2 .md 相对路径
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_modules_work_id ON modules(work_id);
CREATE INDEX IF NOT EXISTS idx_modules_work_type ON modules(work_id, type);

-- 2. 从 works 表迁移 M0（原始构想）— 每个作品 1 条
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm0_' || id,
  id,
  'm0',
  '原始构想',
  0,
  CASE WHEN summary IS NOT NULL AND summary != '' THEN 'in_progress' ELSE 'empty' END,
  'original_concept.json',
  'original_concept.md',
  created_at,
  updated_at
FROM works;

-- 3. 从 works 表创建 M1（世界观）— 每个作品 1 条
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm1_' || id,
  id,
  'm1',
  '世界观设定圣经',
  0,
  'empty',
  'world_bible.json',
  'world_bible.md',
  created_at,
  updated_at
FROM works;

-- 4. 从 works 表创建 M2（大纲）— 每个作品 1 条
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm2_' || id,
  id,
  'm2',
  '长篇框架大纲',
  0,
  'empty',
  'outline.json',
  'outline.md',
  created_at,
  updated_at
FROM works;

-- 5. 从 entities 表迁移 M3 角色卡（type='character' 或 type 为空/默认）
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm3_card_' || id,
  work_id,
  'm3_card',
  name,
  0,
  'empty',
  'characters/' || id || '.json',
  'characters/' || id || '.md',
  created_at,
  updated_at
FROM entities
WHERE type = 'character' OR type IS NULL OR type = '';

-- 6. 从 works 表创建 M4 策略（伏笔账本总览）— 每个作品 1 条
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm4_strategy_' || id,
  id,
  'm4_strategy',
  '伏笔策略总览',
  0,
  'empty',
  'foreshadowing.json',
  'foreshadowing.md',
  created_at,
  updated_at
FROM works;

-- 7. 从 entities 表迁移 M4 伏笔卡（type='foreshadowing'）
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm4_card_' || id,
  work_id,
  'm4_card',
  name,
  0,
  'empty',
  'foreshadowing/' || id || '.json',
  'foreshadowing/' || id || '.md',
  created_at,
  updated_at
FROM entities
WHERE type = 'foreshadowing';

-- 8. 从 sections 表迁移 M5 意图卡 + M6 章节（每 section 各 2 条）
INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, created_at, updated_at)
SELECT
  'm5_intent_' || id,
  work_id,
  'm5_intent',
  title || ' · 意图卡',
  order_index,
  'empty',
  'intents/' || id || '.json',
  created_at,
  updated_at
FROM sections;

INSERT OR IGNORE INTO modules (id, work_id, type, name, order_index, status, r2_json_key, r2_md_key, created_at, updated_at)
SELECT
  'm6_chapter_' || id,
  work_id,
  'm6_chapter',
  title,
  order_index,
  CASE WHEN word_count > 0 THEN 'done' WHEN version > 0 THEN 'in_progress' ELSE 'empty' END,
  'chapters/' || id || '.json',
  'chapters/' || id || '.md',
  created_at,
  updated_at
FROM sections;
