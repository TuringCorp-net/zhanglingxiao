-- 009: Story Elf 对话 Session 表
-- 统一服务端 Session 管理：API Agent 和前端人类用户共用
-- status: active（进行中）/ archived（已结束归档，数据保留用于记忆提取和审计）

CREATE TABLE IF NOT EXISTS elf_sessions (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  work_id TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT 'write',
  title TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_elf_sessions_user_status ON elf_sessions(user_token, status);
CREATE INDEX IF NOT EXISTS idx_elf_sessions_work ON elf_sessions(work_id);
