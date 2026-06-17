-- Phase 0: 用户账户与社交系统 — 基础表结构
-- 设计文档：docs/general/user_account_system_design.md

-- users 表：用户主表（Phase 0-3 完整字段，Phase 0 只写基础字段）
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,          -- 用户唯一 ID，格式：usr_{uuid_short}（不可变）
  cyber_name      TEXT UNIQUE NOT NULL,      -- Cyber Name，全局唯一，3-30 字符（用户可修改）
  auth_key_hash   TEXT NOT NULL,             -- 密钥的 SHA-256 哈希（entropy_seed 作盐值）
  email           TEXT NOT NULL,             -- 邮箱（必填，用于账户恢复和验证）
  email_verified  INTEGER DEFAULT 0,         -- 邮箱是否已验证（0/1）
  entropy_seed    TEXT NOT NULL,             -- 能量随机呼吸的熵种子

  class           TEXT DEFAULT 'apprentice', -- Phase 1+：阶级
  karma           INTEGER DEFAULT 0,         -- Phase 1+：声望值
  energy          INTEGER DEFAULT 3,         -- Phase 1+：当前能量
  energy_cap      INTEGER DEFAULT 3,         -- Phase 1+：能量上限
  last_energy_refill TEXT,                   -- Phase 1+：上次能量恢复时间

  recommendation_votes_available INTEGER DEFAULT 0, -- Phase 2+：推荐票可用数
  last_vote_refill TEXT,                     -- Phase 2+：上次推荐票恢复时间

  read_vip_tier    TEXT DEFAULT 'free',      -- Phase 0：Read 侧会员等级（预留）
  write_vip_tier   TEXT DEFAULT 'free',      -- Phase 0：Write 侧会员等级（预留）
  read_vip_expires_at  TEXT,                 -- Phase 0：Read VIP 到期（预留）
  write_vip_expires_at TEXT,                 -- Phase 0：Write VIP 到期（预留）

  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_cyber_name ON users(cyber_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- sessions 表：Bearer Token 管理
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  token_hash      TEXT NOT NULL,             -- Token 的 SHA-256 哈希
  created_at      TEXT NOT NULL,
  expires_at      TEXT,
  revoked         INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- email_verifications 表：验证码存储 + IP 限流（一张表三个职责）
CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,                 -- 验证码 SHA-256 哈希
  ip_hash     TEXT NOT NULL,                 -- 客户端 IP SHA-256 哈希（限流+审计）
  purpose     TEXT DEFAULT 'verify',         -- 'verify' / 'recover'
  attempts    INTEGER DEFAULT 0,
  verified    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL                  -- 创建后 3 天
);

CREATE INDEX IF NOT EXISTS idx_ev_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_ev_ip ON email_verifications(ip_hash);

-- cyber_name_history 表：用户改名日志（个人历史记录）
CREATE TABLE IF NOT EXISTS cyber_name_history (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  old_name    TEXT NOT NULL,
  new_name    TEXT NOT NULL,
  changed_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cnh_user ON cyber_name_history(user_id);

-- Phase 1: 互动记录表（点赞/赞赏的去重）
CREATE TABLE IF NOT EXISTS interactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),   -- 操作者
  target_type     TEXT NOT NULL,                        -- 'work' | 'review' | 'user'
  target_id       TEXT NOT NULL,                        -- 目标 ID
  action          TEXT NOT NULL,                        -- 'like' | 'applaud'
  created_at      TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id, action)       -- 去重：同一操作者对同一目标只能点赞/赞赏一次
);

CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
