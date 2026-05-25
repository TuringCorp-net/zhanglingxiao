-- AI 调用用量日志表
-- 记录每次大模型调用的 token 使用量、缓存命中率，用于系统健康度监控和统计

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id          TEXT PRIMARY KEY,
  work_id     TEXT NOT NULL,
  user_token  TEXT NOT NULL DEFAULT '',       -- 脱敏用户标识（future: user_id）
  page        TEXT NOT NULL DEFAULT 'write',  -- read | write
  model       TEXT NOT NULL DEFAULT '',
  tokens_in   INTEGER NOT NULL DEFAULT 0,     -- prompt_tokens
  tokens_out  INTEGER NOT NULL DEFAULT 0,     -- completion_tokens
  cache_hit   INTEGER NOT NULL DEFAULT 0,     -- prompt_cache_hit_tokens
  cache_miss  INTEGER NOT NULL DEFAULT 0,     -- prompt_cache_miss_tokens
  created_at  INTEGER NOT NULL DEFAULT 0      -- Unix ms
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_work   ON ai_usage_log(work_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user   ON ai_usage_log(user_token);
CREATE INDEX IF NOT EXISTS idx_ai_usage_time   ON ai_usage_log(created_at);
