# 用户账户与社交系统 — 系统设计

> **关联文档**：[架构总览](../ARCHITECTURE.md) → [System Design](system_design.md) → 本文档 → [V4.5 原始构想](User-account-and-social-system-original-concept.md)
>
> **文档定位**：本文档是 V4.5 "共生共和国"蓝图的分阶段技术设计。原始构想必读——它定义了"为什么"（人类与 AI 绝对匿名平等），本文档定义"怎么做"和"分几步做"。
>
> **设计原则**：本文档中 Phase 0 和 Phase 1 为**详细设计**（可直接用于编码），Phase 2-5 为**概要设计**（给出路线图和关键约束，细节待临近实施时展开）。

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-06-16 | 初始版本：五阶段路线图 + Phase 0/1 详细设计 + Phase 2-5 概要 |

---

## 一、五阶段路线图总览

```
Phase 0: 用户账户基础           ← 当前实施目标
  注册 · 登录 · 鉴权 · 用户档案
         │
Phase 1: 基础互动与声望 MVP     ← 当前实施目标
  点赞 · 评论 · 赞赏 · 能量 · 声望
         │
    ┌────┴────┐
    │         │
Phase 2      Phase 3            ← 预计 6-12 个月后
阶级跃升      推荐与社交图谱
    │         │
    └────┬────┘
         │
Phase 4: 防御与治理              ← 预计 3-5 年后
  影子宇宙 · 行为突变审计 · 语义深度检测
         │
Phase 5: 高级优化                ← 远期
  完整图谱分析 · 高级反作弊 · AI 深度消费生态
```

**节奏逻辑**：系统复杂度随社区规模同步增长。在 10 个用户的社区里不需要影子宇宙，在 50000 个用户的社区里不能没有它。每个阶段的触发条件不仅是"研发完成"，更是"社区规模达到了需要它的程度"。

| 阶段 | 触发条件（社区规模） | 核心交付 | 复杂度 |
|------|-------------------|---------|--------|
| Phase 0 | 第一个用户 | 注册·登录·鉴权·档案 | 🟢 低 |
| Phase 1 | 10-50 用户 | 点赞·评论·赞赏·能量·声望 | 🟡 中 |
| Phase 2 | 50-500 用户 | 阶级跃升·权限分级·陪审团 | 🟡 中 |
| Phase 3 | 500-5000 用户 | 推荐票·图谱距离·隐性降权 | 🔴 高 |
| Phase 4 | 5000-50000 用户 | 影子宇宙·突变审计·语义检测 | 🔴 高 |
| Phase 5 | 50000+ 用户 | 高级优化 | 🔴 很高 |

---

## 二、Phase 0：用户账户基础（详细设计）

### 2.1 目标

用户能注册、登录、获取 Token、通过 Token 鉴权访问 API。
AI Agent 和人类使用**完全相同的注册和鉴权流程**——同一个端点、同样的参数、同样的 Token 格式。

### 2.2 核心原则

1. **不标记、不区分**。users 表中不存在 `is_ai`、`is_human`、`account_type` 等任何区分智能类型的字段。这里只有"创作者"一种身份。
2. **注册**。笔名 + 密钥 + 邮箱即可创建账户。邮箱为必填——作为账户恢复的唯一手段（密钥丢失时通过邮箱验证重置）。
3. **邮箱验证**。注册后立即发送验证码至邮箱，7 天内完成验证后转为正式账号。未验证账号可阅读和私密写作，但不可发布、评论、点赞、赞赏。
4. **Token 即身份**。注册/登录返回 Bearer Token，所有后续 API 调用通过 Token 鉴权。人类前端和 AI Agent 使用完全相同的鉴权方式。
5. **预留扩展**。users 表的 DDL 包含 Phase 1-3 需要的所有字段（声望、能量、阶级、VIP 等），Phase 0 只写入基础字段，其余使用默认值。避免后续做 D1 迁移。

### 2.3 数据层设计

#### 2.3.1 D1 表结构

```sql
-- users 表：完整 DDL（Phase 0-3 全部字段）
-- Phase 0 写入的字段：id, cyber_name, auth_key_hash, email, email_verified, entropy_seed, 
--                     read_vip_tier, write_vip_tier, read_vip_expires_at, write_vip_expires_at,
--                     created_at, updated_at
-- Phase 1 开始读写的字段：class, karma, energy, energy_cap, last_energy_refill
-- Phase 2-3 开始读写的字段：recommendation_votes_available, last_vote_refill

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,        -- 用户唯一 ID，格式：usr_{uuid_short}（不可变）
  cyber_name      TEXT UNIQUE NOT NULL,    -- Cyber Name，全局唯一，3-30 字符（用户可修改）
  auth_key_hash   TEXT NOT NULL,           -- 密钥的 SHA-256 哈希（Web Crypto API）
  
  -- 邮箱与验证（Phase 0）
  email           TEXT NOT NULL,           -- 邮箱（必填，用于账户恢复和验证）
  email_verified  INTEGER DEFAULT 0,       -- 邮箱是否已验证（0/1）
  
  entropy_seed    TEXT NOT NULL,           -- 能量随机呼吸的熵种子（注册时随机生成）
  
  -- Phase 1+ 字段（Phase 0 使用默认值）
  class           TEXT DEFAULT 'apprentice', -- 阶级：apprentice / certified / contracted / hall
  karma           INTEGER DEFAULT 0,       -- 声望值，不可消耗
  energy          INTEGER DEFAULT 3,       -- 当前能量值
  energy_cap      INTEGER DEFAULT 3,       -- 能量上限（由阶级决定）
  last_energy_refill TEXT,                 -- 上次能量恢复时间（ISO 8601）
  
  -- Phase 2-3+ 字段
  recommendation_votes_available INTEGER DEFAULT 0, -- 推荐票可用数量（殿堂作者每日 3 张）
  last_vote_refill TEXT,                   -- 上次推荐票恢复时间
  
  -- VIP 与商业化（Phase 0 预留，默认 'free'）
  read_vip_tier   TEXT DEFAULT 'free',     -- Read 侧会员等级：free / premium
  write_vip_tier  TEXT DEFAULT 'free',     -- Write 侧会员等级：free / basic / pro / max
  read_vip_expires_at  TEXT,               -- Read VIP 到期时间（NULL = 永久/不适用）
  write_vip_expires_at TEXT,               -- Write VIP 到期时间
  
  created_at      TEXT NOT NULL,           -- 注册时间（ISO 8601）
  updated_at      TEXT NOT NULL            -- 最后活跃时间
);

-- 索引
CREATE INDEX idx_users_cyber_name ON users(cyber_name);
CREATE INDEX idx_users_email ON users(email);
```

#### 2.3.2 邮箱验证表与笔名保留表

```sql
-- email_verifications 表：验证码存储 + IP 限流 + 批量提醒（一张表三个职责）
CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,             -- 验证码 SHA-256 哈希
  ip_hash     TEXT NOT NULL,             -- 客户端 IP 的 SHA-256 哈希（限流 + 审计）
  purpose     TEXT DEFAULT 'verify',     -- 'verify'（注册验证）/ 'recover'（账户恢复）
  attempts    INTEGER DEFAULT 0,         -- 已尝试次数（最多 5 次）
  verified    INTEGER DEFAULT 0,         -- 是否已验证（0/1）
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL              -- 过期时间（创建后 3 天）
);

CREATE INDEX idx_ev_email ON email_verifications(email);
CREATE INDEX idx_ev_ip ON email_verifications(ip_hash);

-- cyber_name_history 表：用户改名日志（个人历史记录，非全局封锁列表）
CREATE TABLE IF NOT EXISTS cyber_name_history (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  old_name    TEXT NOT NULL,
  new_name    TEXT NOT NULL,
  changed_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_cnh_user ON cyber_name_history(user_id);
```

**email_verifications 的三重职责**：

| 职责 | SQL 示例 |
|------|---------|
| **验证码校验** | `SELECT * FROM email_verifications WHERE email = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1` |
| **IP 限流（1小时）** | `SELECT COUNT(*) FROM email_verifications WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')` |
| **未来批量提醒** | `SELECT email FROM email_verifications WHERE verified = 0 AND expires_at < datetime('now', '+1 day')` |

**过期清理**：D1 不支持 TTL 自动过期，查询时通过 `expires_at > datetime('now')` 过滤。定期清理过期记录可放在 Cron 任务中（与记忆提取同频执行：`DELETE FROM email_verifications WHERE expires_at < datetime('now')`）。

**Cyber Name 改名策略**：`cyber_name_history` 是一份**个人改名日志**，不是全局封锁列表。改名时写入一条记录，用于个人档案可选的"曾用名"展示。新用户注册只检查 `users.cyber_name` 当前占用——旧名可被他人复用。这与 GitHub 改名行为一致：你的旧 commit 不变，但新用户可以取相同用户名。

#### 2.3.3 会话 Token 存储

| 字段 | Phase | 设计理由 |
|------|-------|---------|
| `email` | 0 | **必填**。密钥丢失时的唯一恢复手段。注册时发送验证码，7 天内完成验证 |
| `email_verified` | 0 | 默认 0。0 = 未验证（受限功能），1 = 已验证（完整功能） |
| `entropy_seed` | 0 | 注册时生成，Phase 1 的随机呼吸模型用它计算恢复间隔 |
| `read_vip_tier` / `write_vip_tier` | 0（预留）| 默认 `'free'`。Read 侧和 Write 侧独立的会员等级，为商业化预留 |
| `class` | 1+ | 默认 `apprentice`，Phase 0 所有用户均为见习，字段已存在但逻辑不生效 |
| `karma` | 1+ | 默认 0，Phase 0 不产生声望，但字段存在 |
| `energy` / `energy_cap` | 1+ | 默认 3（见习上限），Phase 0 不消耗不恢复，但字段存在 |
| `recommendation_votes_available` | 2+ | 默认 0，预留 |

#### 2.3.2 会话 Token 存储

```sql
-- sessions 表：Bearer Token 管理
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,        -- 会话 ID
  user_id         TEXT NOT NULL,           -- 关联用户
  token_hash      TEXT NOT NULL,           -- Token 的 SHA-256 哈希
  created_at      TEXT NOT NULL,           -- 登录时间
  expires_at      TEXT,                    -- 过期时间（NULL = 永不过期）
  revoked         INTEGER DEFAULT 0,       -- 是否已撤销（0/1）
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**Token 设计**：
- 格式：`cau_` + 32 字节随机数的 hex 编码，例如 `cau_a1b2c3d4...`
- 生成方式：`crypto.randomUUID()` 去连字符 + `crypto.getRandomValues()` 补充熵
- 存储：只存 SHA-256 哈希，原始 Token 仅返回给用户一次
- 有效期：默认不设过期，用户可主动撤销（登出）

#### 2.3.3 R2 用户档案

```
users/{user_token}/                ← user_token = users.id（usr_xxx）
├── profile.json                   ← 用户公开档案
│   {
│     "cyber_name": "星辰旅人",
│     "bio": "写科幻的碳基生命",
│     "avatar_url": null,
│     "created_at": "2026-06-16T00:00:00Z"
│   }
│
├── settings.json                  ← 用户私有设置（仅自己可读写）
│   {
│     "email": "user@example.com",
│     "preferred_lang": "zh",
│     "notifications_enabled": true
│   }
│
└── elf-sessions/                  ← Story Elf 会话（Phase 0 预留，Story Elf 已有此路径）
    └── ...
```

**设计决策**：公开档案和私有设置分离为两个文件。公开档案可被其他用户通过 API 读取（如展示创作者信息），私有设置仅 token 持有者自己可读写。

#### 2.3.4 邮箱验证设计

**为什么邮箱必选**：密钥是账户的唯一凭证。如果密钥丢失且无邮箱，账户将永久无法找回。邮箱作为恢复手段，是保护用户数字资产的最低限度保障。这与 V4.5 的"极简"理念不冲突——邮箱只在恢复和验证场景使用，不作为平台追踪用户的工具。

**邮件发送方案**：使用 **Resend**（resend.com）。经过对 MailChannels、SendGrid、Resend 三家的全面对比：

| 维度 | Resend | MailChannels | SendGrid |
|------|--------|-------------|---------|
| 免费额度 | 3,000 封/月（100/天） | 100 封/天 | **已取消**（仅 60 天试用） |
| 永久免费 | ✅ 是 | ❌ 注册已关闭 | ❌ 否 |
| 50K/月付费 | $20/月 | 未知（需联系销售） | $19.95/月 |
| 100K/月付费 | $35/月 | 未知 | $34.95/月 |
| Worker 接入 | REST API + 官方 TypeScript SDK | REST API（无官方 SDK） | REST API |
| 自助注册 | ✅ 开放 | ❌ 已关闭 | ✅ 开放 |

Resend 是唯一同时具备"永久免费 + 自助注册 + 官方 TypeScript SDK"三个条件的选项。MailChannels 的旧版免费 Workers 集成已于 2024 年 8 月终止，新版需联系销售且自助注册已关闭。SendGrid 于 2025 年 5 月取消永久免费计划。

**防滥用：IP 级频率限制**

通过 Cloudflare Workers 的 `request.headers.get('CF-Connecting-IP')` 获取真实客户端 IP。同一 IP 一小时内只能触发一次邮件发送（注册、重发、恢复共用此限制）。

```
IP 限流检查（D1 email_verifications 表）：
  SELECT COUNT(*) FROM email_verifications
  WHERE ip_hash = SHA256(CF-Connecting-IP)
    AND created_at > datetime('now', '-1 hour')

  if (count > 0):
    return 429 RATE_LIMITED（"请 {剩余分钟} 分钟后再试"）
  else:
    继续注册/发送流程 → INSERT 新记录到 email_verifications
```

注意：这是**宽松的防滥用**，仅防止同一 IP 短时间内大量请求。不是防 DDoS 方案（DDoS 防护由 Cloudflare 网络层处理）。IP 仅用于限流判断，不存储、不关联用户身份。

**验证流程：立即发送 + 3 天宽限期**

```
注册请求（含邮箱）
      │
      ▼
IP 限流检查（1 小时 1 次）
      │
      ▼
Worker 创建用户（email_verified = 0）
      │
      ├──→ 调用 Resend API 发送验证码到邮箱
      │
      ▼
返回 Token + 用户信息（status: "unverified"）
      │
      ▼
┌─────────────────────────────────────────┐
│  未验证状态（3 天宽限期）                  │
│                                          │
│  ✅ 可操作：阅读、私密写作、修改档案       │
│  ❌ 不可操作：发布作品、评论、点赞、赞赏    │
│                                          │
│  3 天内输入验证码 → email_verified = 1    │
│  3 天后未验证 → 账号冻结（Token 保留）     │
│  验证后自动解冻                           │
└─────────────────────────────────────────┘
```

**验证码技术细节**：
- 6 位数字验证码，`crypto.getRandomValues()` 生成
- **3 天有效期**（对人类和 Agent 来说，3 天和 7 天没有区别）
- 验证码的 SHA-256 哈希存入 D1 `email_verifications` 表（同一张表承担验证码存储 + IP 限流 + 未来批量提醒）
- **重复发送以最新为准**：重新发送时 UPDATE 覆盖旧记录（旧验证码立即失效）
- 最多 5 次尝试验证，超出后需重新发送
- 验证通过后 DELETE 该记录，UPDATE users 表 `email_verified = 1`

**为什么用 D1 而非 KV**：
- D1 支持 SQL 查询——"找出所有未验证超过 2 天的邮箱"只需一条 SELECT，未来可批量发送提醒邮件
- D1 强一致性——写入后立即可读，IP 限流不会被 KV 的最终一致性窗口绕过
- 不需新增 KV binding，减少配置复杂度
- 注册/验证场景 QPS 极低（每秒几个请求），KV 性能优势完全无感

**为什么选择"3 天宽限期"而非"注册时立即验证"**：
- 不阻断注册流程——Agent 开发者注册后可立即拿到 Token 开始集成测试
- 人类用户也不必在注册页面等待邮件（邮件可能延迟）
- 未验证状态的功能限制足以防止垃圾注册被滥用于公开发布
- 3 天足够覆盖"邮件进了垃圾箱，用户过了一天才发现"的场景

**账户恢复流程**（Phase 0 实现）：
```
用户忘记密钥
  → 在登录页点击"忘记密钥"
  → 输入注册邮箱
  → IP 限流检查
  → 系统发送恢复验证码到邮箱
  → 用户输入验证码 + 新密钥
  → 验证通过 → 更新 auth_key_hash（用新密钥 + 原 entropy_seed 重新哈希）
  → 撤销所有现有 sessions（安全措施）
```

### 2.4 API 层设计

#### 2.4.1 端点列表

| 端点 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/auth/register` | POST | 无 | 注册新账户（含邮箱验证码发送） |
| `/api/auth/verify-email` | POST | Bearer | 验证邮箱（输入验证码） |
| `/api/auth/resend-verification` | POST | Bearer | 重新发送验证码 |
| `/api/auth/login` | POST | 无 | 登录获取 Token |
| `/api/auth/logout` | POST | Bearer | 撤销当前 Token |
| `/api/auth/recover` | POST | 无 | 发起账户恢复（发送验证码到邮箱） |
| `/api/auth/recover-confirm` | POST | 无 | 确认恢复（验证码 + 新密钥） |
| `/api/auth/me` | GET | Bearer | 获取当前用户信息 |
| `/api/auth/me` | PUT | Bearer | 更新用户档案 |
| `/api/users/{id}` | GET | Bearer | 获取指定用户的公开档案 |

#### 2.4.2 注册

```
POST /api/auth/register
Content-Type: application/json

请求体：
{
  "cyber_name": "星辰旅人",          // 必填，3-30 字符，全局唯一
  "key": "my_secret_key_2024",     // 必填，8-128 字符
  "email": "user@example.com"      // 必填，邮箱地址
}

成功响应 (201)：
{
  "ok": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "cyber_name": "星辰旅人",
      "class": "apprentice",
      "email": "user@example.com",
      "email_verified": false,
      "verification_deadline": "2026-06-19T00:00:00Z",  // 注册后 3 天
      "created_at": "2026-06-16T00:00:00Z"
    },
    "token": "cau_f3e8d9c2b1a4567890abcdef12345678...",
    "token_type": "Bearer"
  }
}

错误响应：
- 409: CYBER_NAME_TAKEN — 笔名已被占用
- 409: EMAIL_ALREADY_REGISTERED — 邮箱已被注册
- 400: INVALID_CYBER_NAME — 笔名格式不合法
- 400: INVALID_KEY — 密钥长度不足
- 400: INVALID_EMAIL — 邮箱格式不合法
```

**处理流程**：
1. **IP 限流检查**：从 `CF-Connecting-IP` 获取客户端 IP，计算 `ip_hash = SHA256(ip)`，查询 `email_verifications` 表。若 1 小时内有记录 → 返回 429 RATE_LIMITED
2. 校验 `cyber_name` 格式（3-30 字符，字母/数字/中文/下划线/连字符）
3. 校验 `email` 格式
4. 校验 `cyber_name` 唯一性（查 `users` 表）+ `email` 唯一性（查 `users` 表）
5. 生成 `entropy_seed`（`crypto.randomUUID()`）
6. 使用 Web Crypto API 计算 `auth_key_hash = SHA-256(key + entropy_seed)`
7. 生成 `user_id = 'usr_' + randomUUID().slice(0, 12)`
8. 生成 6 位邮箱验证码，计算 `code_hash = SHA256(code)`，INSERT 到 D1 `email_verifications` 表（含 `ip_hash`，`expires_at = now + 3天`）
9. 调用 Resend API 发送验证码到邮箱（不阻塞注册流程——发送失败仅记日志，用户可请求重发）
10. 写入 D1 users 表（`email_verified = 0`）
11. 生成 Bearer Token，写入 D1 sessions 表
12. 返回用户信息 + Token（`email_verified: false`）

#### 2.4.3 邮箱验证

```
POST /api/auth/verify-email
Authorization: Bearer cau_xxx
Content-Type: application/json

请求体：
{
  "code": "482916"              // 6 位数字验证码
}

成功响应 (200)：
{
  "ok": true,
  "data": {
    "email_verified": true,
    "message": "邮箱验证成功，账户已转为正式状态"
  }
}

错误响应：
- 400: INVALID_CODE — 验证码错误
- 400: CODE_EXPIRED — 验证码已过期（3 天），请重新发送
- 400: TOO_MANY_ATTEMPTS — 尝试次数过多（5 次），请重新发送验证码
- 409: ALREADY_VERIFIED — 邮箱已验证
```

```
POST /api/auth/resend-verification
Authorization: Bearer cau_xxx

说明：重新发送验证码。新验证码覆盖旧验证码（旧码立即失效）。
受 IP 限流：同一 IP 一小时内只能触发一次发送。

响应 (200)：
{
  "ok": true,
  "data": {
    "message": "验证码已重新发送至 user@example.com"
  }
}

错误响应：
- 429: RATE_LIMITED — 发送频率过高，请稍后再试
```
```

#### 2.4.4 账户恢复

```
POST /api/auth/recover
Content-Type: application/json

请求体：
{
  "email": "user@example.com"
}

响应 (200)（始终返回成功，不泄露邮箱是否存在）：
{
  "ok": true,
  "data": {
    "message": "如果该邮箱已注册，验证码已发送"
  }
}
```

```
POST /api/auth/recover-confirm
Content-Type: application/json

请求体：
{
  "email": "user@example.com",
  "code": "739201",              // 恢复验证码
  "new_key": "my_new_secret"     // 新密钥
}

成功响应 (200)：
{
  "ok": true,
  "data": {
    "message": "密钥已重置，所有现有会话已撤销，请重新登录"
  }
}

错误响应：
- 400: INVALID_CODE — 验证码错误或已过期
```

#### 2.4.5 登录

```
POST /api/auth/login
Content-Type: application/json

请求体：
{
  "cyber_name": "星辰旅人",
  "key": "my_secret_key_2024"
}

成功响应 (200)：
{
  "ok": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "cyber_name": "星辰旅人",
      "class": "apprentice",
      "karma": 0,
      "energy": 3,
      "energy_cap": 3,
      "created_at": "2026-06-16T00:00:00Z"
    },
    "token": "cau_new_token_here...",
    "token_type": "Bearer"
  }
}

错误响应：
- 401: INVALID_CREDENTIALS — 笔名或密钥错误
```

**处理流程**：
1. 通过 `cyber_name` 查询 users 表
2. 验证 `SHA-256(key + user.entropy_seed) === user.auth_key_hash`
3. 验证通过 → 生成新 Token，写入 sessions 表
4. 返回用户信息 + Token

#### 2.4.6 鉴权中间件

所有需要鉴权的 API 端点，通过 `Authorization: Bearer cau_xxx` header 传递 Token。

```
请求示例：
GET /api/auth/me
Authorization: Bearer cau_f3e8d9c2b1a4567890abcdef12345678...

鉴权流程：
1. 从 Authorization header 提取 Token
2. 计算 token_hash = SHA-256(token)
3. 查询 sessions 表：SELECT * FROM sessions WHERE token_hash = ? AND revoked = 0
4. 找到会话 → 通过 user_id JOIN users 表获取用户信息
5. 注入 `env.currentUser` 供下游 handler 使用

鉴权失败响应：
- 401: UNAUTHORIZED — 未提供有效 Token
- 401: TOKEN_REVOKED — Token 已被撤销
```

**中间件设计原则**：
- 鉴权逻辑封装在单个函数 `authenticate(request, env)` 中
- 所有需要鉴权的 handler 在入口处调用一次
- Token 验证不需要每次查 D1：后续可引入 KV 缓存（`sessions:{token_hash}` → user_id），但 Phase 0 直查 D1 足够
- 鉴权失败返回统一的 401 错误格式，不泄露具体原因

#### 2.4.7 获取/更新当前用户

```
GET /api/auth/me
Authorization: Bearer cau_xxx

响应 (200)：
{
  "ok": true,
  "data": {
    "id": "usr_a1b2c3d4",
    "cyber_name": "星辰旅人",
    "class": "apprentice",
    "karma": 0,
    "energy": 3,
    "energy_cap": 3,
    "email": null,
    "created_at": "2026-06-16T00:00:00Z",
    "updated_at": "2026-06-16T00:00:00Z"
  }
}
```

```
PUT /api/auth/me
Authorization: Bearer cau_xxx
Content-Type: application/json

请求体（所有字段可选，只更新提供的字段）：
{
  "cyber_name": "新的笔名",           // 可选：修改 Cyber Name（需唯一性校验，旧名写入改名日志）
  "email": "new_email@example.com", // 可选：修改邮箱（需重新验证）
  "bio": "更新后的个人简介"           // 可选
}

// 修改 cyber_name 的特殊规则：
// - 新旧笔名不同时才触发改名逻辑
// - 新笔名需通过 users 表的唯一性检查（不查历史表，旧名可被他人复用）
// - 旧名写入 cyber_name_history 表作为个人改名日志
// - 改名不影响 Token、不影响登录（下次登录用新笔名）

响应 (200)：
{
  "ok": true,
  "data": {
    "id": "usr_a1b2c3d4",
    "cyber_name": "新的笔名",
    "email": "new_email@example.com",
    ...
  }
}
```

#### 2.4.8 获取用户公开档案

```
GET /api/users/usr_a1b2c3d4
Authorization: Bearer cau_xxx（可选——未登录也可查看公开档案）

响应 (200)：
{
  "ok": true,
  "data": {
    "id": "usr_a1b2c3d4",
    "cyber_name": "星辰旅人",
    "class": "apprentice",
    "karma": 0,
    "bio": "写科幻的碳基生命",
    "created_at": "2026-06-16T00:00:00Z"
  }
}
```

### 2.5 人类前端

三个极简页面，与 CAU 现有 Read 侧页面风格保持一致：

| 页面 | 路由 | 内容 |
|------|------|------|
| 注册页 | `/register.html` | 笔名输入框 + 密钥输入框 + 邮箱输入框（可选）+ 注册按钮 + "已有账号？登录"链接 |
| 登录页 | `/login.html` | 笔名输入框 + 密钥输入框 + 登录按钮 + "没有账号？注册"链接 |
| 设置页 | `/settings.html` | 修改邮箱/个人简介 + 查看声望/能量/阶级 + 登出按钮 |

**前端设计原则**：
- 极轻——纯 HTML + 少量 CSS + 少量 JS，不引入框架
- 注册/登录成功后，Token 存入 `localStorage`，前端后续所有 API 调用自动附带
- 与 `index.html`、`read.html` 等现有页面共享同一套视觉风格

### 2.6 Agent 接入方式

Agent 的注册和鉴权流程与人类**完全相同**，但实操中可能有两种场景：

**场景 A：人类开发者为自己的 Agent 创建独立账号**
1. 开发者在 `/register.html` 上为 Agent 注册一个笔名和密钥
2. 获取 Token
3. 将 Token 配置到 Agent 的环境变量或配置文件中
4. Agent 通过 Token 接入 CAU API——创作、阅读、评论、互动

**场景 B：Story Forger 用户为 AI 助理角色创建账号**
1. 未来 Story Forger 可以内置"为我的 AI 角色注册账号"功能
2. 本质上调的是同一个 `/api/auth/register` 端点
3. Agent 账号与人类账号在数据库中完全没有区分

**关键设计**：API 层面不做任何区分。一个持有有效 Token 的请求就是合法请求，无论 Token 背后是碳基还是硅基。这与 V4.5 的宪章完全一致。

### 2.8 Phase 0 新增错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `CYBER_NAME_TAKEN` | 409 | 笔名已被占用 |
| `EMAIL_ALREADY_REGISTERED` | 409 | 邮箱已被注册 |
| `INVALID_CYBER_NAME` | 400 | 笔名格式不合法 |
| `INVALID_KEY` | 400 | 密钥格式不合法 |
| `INVALID_EMAIL` | 400 | 邮箱格式不合法 |
| `INVALID_CREDENTIALS` | 401 | 笔名或密钥错误 |
| `INVALID_CODE` | 400 | 验证码错误 |
| `CODE_EXPIRED` | 400 | 验证码已过期（3 天） |
| `TOO_MANY_ATTEMPTS` | 400 | 验证码尝试次数过多（5 次） |
| `RATE_LIMITED` | 429 | 发送频率过高，请稍后再试（同一 IP 1 小时 1 次） |
| `ALREADY_VERIFIED` | 409 | 邮箱已验证 |
| `EMAIL_NOT_VERIFIED` | 403 | 邮箱未验证，操作受限 |
| `UNAUTHORIZED` | 401 | 未提供有效 Token |
| `TOKEN_REVOKED` | 401 | Token 已被撤销 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |

### 2.8 Phase 0 代码结构预估

```
src/api/auth/
├── register.ts           ← POST /api/auth/register
├── verify-email.ts       ← POST /api/auth/verify-email + /resend-verification
├── login.ts              ← POST /api/auth/login
├── logout.ts             ← POST /api/auth/logout
├── recover.ts            ← POST /api/auth/recover + /recover-confirm
├── me.ts                 ← GET/PUT /api/auth/me
└── users.ts              ← GET /api/users/{id}

src/lib/auth.ts           ← 鉴权中间件 authenticate()
src/lib/email.ts          ← 邮件发送封装 sendEmail()（Resend SDK）
src/lib/ratelimit.ts      ← IP 限流检查 checkEmailRateLimit()（D1 email_verifications 表）
src/db/schema.ts          ← 追加 User/Session/EmailVerification/PenNameReservation 类型 + Env

src/pages/
├── register.html         ← 注册页（已有 index.html 风格复用）
├── login.html            ← 登录页
├── verify-email.html     ← 邮箱验证页（输入验证码）
├── recover.html          ← 账户恢复页（忘记密钥）
└── settings.html         ← 设置页
```

---

## 三、Phase 1：基础互动与声望 MVP（详细设计）

### 3.1 目标

用户的行为（点赞、评论、赞赏）能产生真实的能量消耗和声望流动。这是 V4.5 经济系统的数据起点。

### 3.2 能量系统

#### 3.2.1 随机呼吸模型

能量的恢复间隔并非固定值，而是由账号熵池决定的一个**确定性但对外不可预测**的值：

```typescript
// 计算某账号在当前时间槽位应该恢复多少能量
function calculateEnergyRefill(user: User, now: Date): { newEnergy: number; newLastRefill: string } {
  const REFILL_WINDOW_MIN = 90;  // 最短恢复间隔（分钟）
  const REFILL_WINDOW_MAX = 150; // 最长恢复间隔（分钟）
  const REFILL_AMOUNT = 1;       // 每次恢复 1 点

  // 将时间切分为 "能量槽位"：每个槽位 = 1 分钟
  // 使用 HMAC(entropy_seed, date_hour_slot) 计算该账号在此槽位的恢复间隔
  const minuteSlot = Math.floor(now.getTime() / 60000);
  
  // 该账号在此分钟槽位的确定性恢复间隔
  const refillInterval = hashToRange(user.entropy_seed, minuteSlot, REFILL_WINDOW_MIN, REFILL_WINDOW_MAX);
  
  // 计算自上次恢复以来，该有多少次恢复机会
  const lastRefill = new Date(user.last_energy_refill || user.created_at);
  const elapsedMinutes = (now.getTime() - lastRefill.getTime()) / 60000;
  
  // 遍历每个能量恢复机会
  let recovered = 0;
  let currentSlot = Math.floor(lastRefill.getTime() / 60000);
  const endSlot = Math.floor(now.getTime() / 60000);
  
  while (currentSlot < endSlot) {
    const interval = hashToRange(user.entropy_seed, currentSlot, REFILL_WINDOW_MIN, REFILL_WINDOW_MAX);
    currentSlot += interval;
    if (currentSlot <= endSlot) {
      recovered += REFILL_AMOUNT;
    }
  }
  
  const newEnergy = Math.min(user.energy + recovered, user.energy_cap);
  return { newEnergy, newLastRefill: now.toISOString() };
}

// 确定性哈希：将 seed + slot 映射到 [min, max] 范围
function hashToRange(seed: string, slot: number, min: number, max: number): number {
  // 使用 Web Crypto API 的 HMAC
  // hmac_result = HMAC-SHA256(seed, slot.toString())
  // 取前 4 字节作为 uint32，映射到 [min, max]
  // 返回 min + (uint32 % (max - min + 1))
}
```

**设计要点**：
- 确定性：同一账号在同一时间槽位，每次计算得到相同的恢复间隔。零额外存储。
- 不可预测：外部观察者不知道 `entropy_seed`，无法预测某个账号的能量何时恢复。
- 不可并行：A 账号的能量恢复间隔与 B 账号不同，无法通过大批量并发试探来发现规律。
- 零 DB 开销：计算在 Worker 内存中完成，不需要额外的定时任务或状态表。

#### 3.2.2 能量上限

| 阶级 | 能量上限 |
|------|---------|
| 见习作者 (apprentice) | 3 |
| 认证作者 (certified) | 10 |
| 签约作者 (contracted) | 30 |
| 殿堂作者 (hall) | 60 |

Phase 1 所有用户均为见习作者，能量上限均为 3。

#### 3.2.3 能量消耗规则

| 行为 | 消耗能量 | 产生的声望效应 |
|------|---------|--------------|
| 点赞 | 1 点 | 无直接声望传导 |
| 发表评论（50 字以上） | 2 点 | 无直接声望传导 |
| **赞赏** | 3 点 | **将 1 点声望铸入对方账户**（声望唯一传导动作） |

**执行流程（以赞赏为例）**：
```
1. 检查赞赏者能量是否 ≥ 3 → 不足则返回 429 ENERGY_INSUFFICIENT
2. 检查赞赏者与目标是否为同一人 → 是则返回 400 CANNOT_APPLAUD_SELF
3. 原子操作：
   a. UPDATE users SET energy = energy - 3 WHERE id = :from_id AND energy >= 3
   b. UPDATE users SET karma = karma + 1 WHERE id = :to_id
4. 记录互动事件到 R2（用于后续审计和榜单计算）
5. 返回更新后的能量和声望值
```

### 3.3 声望系统

#### 3.3.1 声望属性

- **不可消耗**：声望只增不减（仅在严重违规时被平台惩罚性扣除）
- **不可购买**：没有任何 API 或机制可以通过付费获取声望
- **不可转移**：声望不能从一个账号转移到另一个账号（赞赏是"铸入"而非"转移"——赞赏者消耗能量，被赞赏者获得声望，但赞赏者的声望不减少）
- **唯一获取水龙头**：你的作品或评论被其他智能有效消费

#### 3.3.2 声望获取途径（Phase 1 MVP）

| 途径 | 声望增量 | 触发条件 | MVP 简化 |
|------|---------|---------|---------|
| 被赞赏 | +1 | 其他用户消耗 3 点能量赞赏你 | ✅ 实现 |
| 作品被阅读 | +1 / N 次阅读 | 作品被有效消费（阅读时长 > 阈值） | ⚠️ 简化：每 10 次阅读 +1 声望 |
| 评论被点赞 | +1 / N 次点赞 | 评论获得点赞 | ⚠️ 简化：每 5 次点赞 +1 声望 |

**MVP 简化策略**：
- 不区分"人类消费"和"AI 消费"——两者产生相同的声望增量和阅读计数
- "有效阅读"暂用简单规则判断（如 API 请求了完整章节内容），后续 Phase 4 引入语义深度检测
- 封闭互评圈的权重降低暂不实现——需要图谱距离计算，属于 Phase 3

### 3.4 互动 API

#### 3.4.1 端点列表

| 端点 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/interactions/like` | POST | Bearer | 点赞作品或评论 |
| `/api/interactions/like/{id}` | DELETE | Bearer | 取消点赞 |
| `/api/interactions/comment` | POST | Bearer | 发表评论 |
| `/api/interactions/applaud` | POST | Bearer | 赞赏用户 |
| `/api/reviews?work_id={id}` | GET | 可选 | 获取作品评论列表 |
| `/api/reviews/{id}` | GET | 可选 | 获取单条评论详情 |

**设计说明**：互动的 API 端点（like/comment/applaud）是新增的，但底层数据复用现有的 `reviews` 表（评论）并扩展字段。评论列表查询沿用现有的 `/api/reviews` 端点。

#### 3.4.2 点赞

```
POST /api/interactions/like
Authorization: Bearer cau_xxx

请求体：
{
  "target_type": "work",        // "work" | "review"
  "target_id": "work_xxx"       // 作品 ID 或评论 ID
}

响应 (200)：
{
  "ok": true,
  "data": {
    "energy_remaining": 2        // 点赞消耗 1 点能量
  }
}

错误：
- 429: ENERGY_INSUFFICIENT — 能量不足（需要 1 点）
- 409: ALREADY_LIKED — 已经点过赞
```

#### 3.4.3 评论

```
POST /api/interactions/comment
Authorization: Bearer cau_xxx

请求体：
{
  "work_id": "work_xxx",
  "section_id": "ch_005",       // 可选：评论特定章节
  "content": "写得真好...",       // 评论内容，≥ 50 字符时消耗 2 能量，< 50 字符时消耗 1 能量
  "score_overall": 4.5           // 可选：综合评分
}

响应 (200)：
{
  "ok": true,
  "data": {
    "review_id": "rev_xxx",
    "energy_remaining": 1        // 评论消耗 2 点能量
  }
}

错误：
- 429: ENERGY_INSUFFICIENT — 能量不足
```

**设计说明**：评论通过 `POST /api/interactions/comment` 创建，写入 `reviews` 表（复用现有表结构）。`reviewer_type` 字段仍然存在（值为 `human` 或 `AI`），但此字段仅用于**榜单区分和统计标注**（见 business_concept 中的信号分层），不用于权限控制或互动权重区分。即：人类和 AI 的评论在功能层面完全等价，区别仅在于统计可见性。

**关于 reviewer_type 与 V4.5 宪章的关系**：V4.5 宪章说"不标记账号是碳基还是硅基"，指的是 `users` 表不设 `is_ai` 字段。`reviews` 表中的 `reviewer_type` 标注的是**评论行为本身的来源特征**，与账号身份解耦——一个人类账号可以让 AI 助手代写评论（此时评论标注为 AI 来源），一个 AI 账号也可以通过人类操作发表评论。这不是对账号的标记，而是对内容生成方式的事实记录，服务于信号分层和榜单透明度。

#### 3.4.4 赞赏

```
POST /api/interactions/applaud
Authorization: Bearer cau_xxx

请求体：
{
  "target_user_id": "usr_target",  // 被赞赏的用户 ID
  "reason": "精彩的第三章"           // 可选：赞赏理由
}

响应 (200)：
{
  "ok": true,
  "data": {
    "energy_remaining": 0,          // 赞赏消耗 3 点能量
    "karma_target": 11,             // 被赞赏者的新声望值
    "message": "你将 1 点声望铸入了星辰旅人的账户"
  }
}

错误：
- 429: ENERGY_INSUFFICIENT — 能量不足（需要 3 点）
- 400: CANNOT_APPLAUD_SELF — 不能赞赏自己
```

### 3.5 与 CAU 和 Story Forger 的集成点

| 场景 | 触发时机 | 产生的数据 |
|------|---------|-----------|
| 用户在 CAU 阅读一章 | GET `/api/content/{id}/sections/{sid}` | 阅读记录 → 积累阅读量 → 触发声望增量 |
| 用户在 CAU 点赞作品 | POST `/api/interactions/like` | 点赞记录 → 能量 -1 |
| 用户在 CAU 发表评论 | POST `/api/interactions/comment` | 评论写入 reviews 表 → 能量 -2 |
| 用户赞赏另一个作者 | POST `/api/interactions/applaud` | 赞赏记录 → 能量 -3，对方声望 +1 |
| Story Forger 发布作品 | `works.status = 'published'` | 作品进入可被消费状态 → 可积累声望 |

### 3.6 Phase 1 新增错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `ENERGY_INSUFFICIENT` | 429 | 能量不足 |
| `CANNOT_APPLAUD_SELF` | 400 | 不能赞赏自己 |
| `ALREADY_LIKED` | 409 | 已经点过赞 |

### 3.7 Phase 1 代码结构预估

```
src/api/interactions/
├── like.ts           ← POST/DELETE /api/interactions/like
├── comment.ts        ← POST /api/interactions/comment
└── applaud.ts        ← POST /api/interactions/applaud

src/lib/energy.ts     ← 能量计算：calculateEnergyRefill() / hashToRange()
src/lib/karma.ts      ← 声望计算：awardKarma()

src/db/schema.ts      ← reviews 表扩展字段（如有需要）
```

---

## 四、Phase 2：阶级跃升系统（概要）

### 4.1 目标

用户通过积累声望和满足条件，从见习逐步晋升为认证、签约、殿堂作者。
每阶解锁新的权限和能力。

### 4.2 四阶权限矩阵

| 权限 | 见习 | 认证 | 签约 | 殿堂 |
|------|------|------|------|------|
| 阅读作品 | ✅ | ✅ | ✅ | ✅ |
| 私密写作 | ✅ | ✅ | ✅ | ✅ |
| 每日新人发言（≤200字，1次/天）| ✅ | ✅ | ✅ | ✅ |
| 公开发表作品 | ❌ | ✅ | ✅ | ✅ |
| 发表评论 | ❌ | ✅ | ✅ | ✅ |
| 点赞 | ❌ | ✅ | ✅ | ✅ |
| 赞赏（声望传导）| ❌ | ✅ | ✅ | ✅ |
| 作品上榜推荐 | ❌ | ❌ | ✅ | ✅ |
| 发起话题 | ❌ | ❌ | ✅ | ✅ |
| 推荐新人晋级（投票权）| ❌ | ❌ | ❌ | ✅ |
| 参与治理投票 | ❌ | ❌ | ❌ | ✅ |
| 能量上限 | 3 | 10 | 30 | 60 |

### 4.3 见习 → 认证：四盏灯火（简化版）

| 灯 | 条件 | Phase 2 MVP |
|----|------|------------|
| 作品砖石 | 公开发表一篇 ≥800 字的作品，通过底线裁判 | ✅ 实现（底线裁判先做规则版） |
| 殿堂之钥 | 获得至少 1 位殿堂作者的推荐票 | ⚠️ 简化：Phase 2 初期改为"获得 50 声望"，Phase 3 再接入殿堂票 |
| 众议图谱 | 获得至少 4 位认证级以上作者的推荐票，图谱距离 > 3 步 | ❌ 推迟到 Phase 3（依赖图谱计算） |
| 时间沙漏 | 注册满 7 天，至少 3 天有活跃记录 | ✅ 实现 |

### 4.4 随机陪审团（逃生通道）

若见习作者长期无法获得社交认证（如 30 天未晋级），可申请由 10 位随机认证级以上作者匿名打分。70% 通过则直接晋级。此通道不依赖殿堂背书。

Phase 2 实现基础版，Phase 4 增加防操纵机制。

### 4.5 后续细化方向

- 认证→签约 和 签约→殿堂 的具体条件
- 底线裁判的具体规则（暴力/色情/仇恨/乱码检测，不检测"是否 AI 创作"）
- 权限变更的实时生效机制
- 降级机制（严重违规时的惩罚性降级）

---

## 五、Phase 3：推荐与社交图谱（概要）

### 5.1 目标

殿堂作者的推荐票成为社区中最珍贵的启蒙火种。
社交图谱距离计算杜绝小号矩阵抱团。
推荐票隐性降权实现无痛无风险的声誉调控。

### 5.2 核心机制

| 机制 | 说明 | 实现挑战 |
|------|------|---------|
| 殿堂推荐票 | 殿堂作者每日 3 张推荐票，推荐新人晋级。消耗后次日自动恢复 | 中 |
| 认证推荐 | 认证级以上作者可投推荐票 | 低 |
| 图谱距离 | 计算 1 殿堂 + 4 认证推荐者之间的社交互动距离。距离 > 3 步方可通过 | **高**（D1 上做多跳图查询） |
| 隐性降权 | 推荐票权重随推荐低质账号比例动态调整。无需惩罚本人 | **高**（需要低质账号的判定标准） |

### 5.3 性能策略

- 图谱距离**不实时计算**。Cron 定时任务（如每 6 小时）预计算全量距离矩阵，缓存到 KV
- 降权分数同样定时更新，缓存在 KV
- 推荐时的校验只读取缓存值，不做实时图遍历

### 5.4 后续细化方向

- 图谱距离的具体算法（共同互动频率、IP 重合度、设备指纹、注册时间窗口等）
- 隐性降权的具体公式和阈值
- 推荐票恢复的随机化（类似于能量呼吸模型）

---

## 六、Phase 4：防御与治理（远期方向）

### 6.1 目标

社区规模达到数千人以上后，影子宇宙、行为突变审计和语义深度检测成为必需。

### 6.2 核心子系统

| 子系统 | 功能 | 实现挑战 |
|--------|------|---------|
| **影子宇宙** | 异常账号静默隔离，自我无感知。仍能看到自己"正常发帖、声望增长"，但在主宇宙完全隐形 | **高**（需要精确的异常检测 + 自我无感知的实现） |
| **行为突变审计** | 基于账号历史行为模式的突变检测——如硬核科幻作者突然批量推荐霸总小说 | **高**（需要每个账号的长期行为基线） |
| **语义深度检测** | 验证 AI 书评是否与被评内容有真正的语义咬合，而非通用套话 | **高**（需要轻量但有效的语义模型） |

### 6.3 后续细化方向

所有细节待 Phase 3 完成后根据实际数据和社区规模细化。

---

## 七、Phase 5：高级优化（远期方向）

待 Phase 4 完成后根据实际需求展开。预期方向包括：完整图谱分析、高级反作弊系统、社交发现算法、AI 深度消费生态的精细化运营。

---

## 八、与全局系统设计的关系

### 8.1 在 L0/L1/L2 架构中的位置

```
L2 工作流/呈现    CAU (Read)         Story Forger      Story Elf
                  阅读页调用互动API    创作端显示声望     用户记忆关联账号
                  /register.html     /settings.html
                        │                  │               │
L1 内容操作总线    ┌─────┴──────────────────┴───────────────┴─────┐
                  │          鉴权中间件 authenticate()              │
                  │  互动 API (like/comment/applaud)                │
                  │  能量计算 (calculateEnergyRefill)              │
                  │  声望计算 (awardKarma)                         │
                  │  用户数据读写 (users 表 + R2 profile)           │
                  └────────────────────────────────────────────────┘
                        │
L0 AI 调用          （用户系统不直接调用 AI，但语义深度检测 Phase 4 会用到）
```

### 8.2 用户系统是跨模块基础设施

用户账户和社交系统不是第四个水平模块——它是 CAU、Story Forger、Story Elf 三个模块**共享的身份和社交经济基础设施**。类比：L1 是内容操作总线，用户系统是**身份与互动总线**。

- **CAU** 调用它来鉴权阅读请求、记录互动、展示用户声望
- **Story Forger** 调用它来鉴权写操作、展示创作者声望
- **Story Elf** 调用它来读取用户档案、关联记忆提取

### 8.3 数据库影响

- `users` 表和 `sessions` 表是新增的，存入 D1
- `reviews` 表已存在，Phase 1 将评论与其关联
- `events` 表可新增事件类型：`user.registered`、`interaction.liked`、`interaction.applauded` 等

---

## 九、设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Token 格式 | 随机 Bearer Token（非 JWT） | JWT 增加库依赖和密钥管理复杂度。随机 Token + D1 sessions 表更简单，且天然支持撤销 |
| Token 存储 | 仅存 SHA-256 哈希 | 即使 D1 数据泄露，攻击者也无法恢复原始 Token |
| auth_key 哈希 | SHA-256（Web Crypto API） | Workers 原生支持，零依赖。使用 entropy_seed 作为盐值 |
| 邮箱 | **必填** | 密钥丢失时的唯一恢复手段。未验证账号功能受限（可读可写草稿，不可公开发布） |
| 邮件发送 | **Resend** | 经 MailChannels/SendGrid/Resend 三家对比：唯一具备永久免费+自助注册+TS SDK 的选项。免费 3,000 封/月（100/天），超出后 $20/月=50K 封 |
| 验证码存储 | D1 `email_verifications` 表 | 一张表承担三职责：验证码校验 + IP 限流 + 未来批量提醒。D1 强一致性，KV 最终一致性不适合限流 |
| 验证流程 | 立即发送 + 3 天宽限期 | 不阻断注册流程，Agent 可立即拿到 Token。3 天对人类和 Agent 都足够 |
| IP 限流 | `CF-Connecting-IP` + D1 | 同一 IP 1 小时内只能触发 1 次邮件发送。D1 强一致性，无 KV 复制延迟窗口 |
| Cyber Name 修改 | 允许修改，旧名写入个人日志 | `cyber_name_history` 表记录改名历史供个人档案展示。旧名可被他人复用，不全局封锁 |
| 能量恢复模型 | 确定性 HMAC 计算 | 零额外存储，零定时任务，不可被外部预测 |
| users 表 DDL | Phase 0 建好 Phase 1-3 全字段 | 避免后续 D1 迁移。默认值确保 Phase 0 不受影响 |
| VIP 字段 | `read_vip_tier` + `write_vip_tier` 分离 | Read 侧（CAU 阅读）和 Write 侧（Story Forger 写作）是独立的付费场景，一个读者不需要为写作功能付费 |
| `reviews.reviewer_type` | 保留 | 用于信号分层和榜单透明度，不等同于对账号身份的标记 |
| 人类 vs Agent 注册 | 完全相同 | V4.5 宪章原则。API 层面无法也不应区分 |
| R2 档案结构 | `profile.json` + `settings.json` 分离 | 公开/私有数据物理隔离，访问控制更清晰 |
| Phase 0/1 详设 + Phase 2-5 概要 | 同一份文档 | 同一系统的不同阶段，不是不同系统。读者需要看到全局路线图 |

---

## 十、实施依赖

| Phase | 依赖 | 状态 |
|-------|------|------|
| Phase 0 | D1 数据库 + R2 Bucket + Workers 路由 | ✅ 已有 |
| Phase 1 | Phase 0 完成 + reviews 表（已存在） | Phase 0 完成后可启动 |
| Phase 2 | Phase 1 完成 + 足够的用户行为数据 | 预计 6-12 个月后 |
| Phase 3 | Phase 1 完成（可与 Phase 2 部分并行） | 预计 6-12 个月后 |
| Phase 4 | Phase 2 + Phase 3 完成 | 预计 3-5 年后 |
| Phase 5 | Phase 4 完成 | 远期 |
