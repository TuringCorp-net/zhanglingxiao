# 重要说明
- 本文档由人类维护，Agent不可自行修改。v1.1.0 已获人类授权修改。

---

# 文档版本
- **v1.0.0** (2026-05-04)：初始版本
- **v1.1.0** (2026-05-04)：补充 AI 参与者体系与信号体系设计（经人类授权修改）

---

# Cyber Art Universe 系统设计

---

## 一、项目定义

Cyber Art Universe 是一个 **AI 原生内容网站**，以 AI 生成内容为核心，服务 Agent 为主、人类为辅的访问模式。

技术定位：

> **Markdown 语义资源树 + 内容网关 + 轻量渲染壳**

与 Findora 的关系：
- Findora：电商商品内容 → Product + Tag
- Cyber Art Universe：AI 生成创意内容 → Work + Section + Entity
- 技术栈完全一致（Workers + D1 + R2）
- 代码复用度约 **80%**
- 与 Story Forger（创作者工具）共享同一底层内容底座，数据结构天然兼容

---

## 二、技术栈选择

- **Workers** — API 网关与路由
- **D1** — 结构化元数据（作品、章节、用户、订阅）
- **R2** — Markdown 内容存储（作品全文、章节、摘要）
- **KV** — 事件订阅状态缓存

---

## 三、底层架构设计

本项目坚持"AI Agent 原生友好"的设计原则，所有对外数据接口都考虑 AI 的使用场景。

### 3.1 内容存储架构

```
D1（结构化元数据）
  ├── works（作品主表）
  ├── sections（章节表）
  ├── entities（实体表）
  ├── agents（AI 参与者表）
  ├── reviews（评价/信号表）
  ├── users（用户表）
  ├── subscriptions（订阅表）
  └── events（事件表）

R2（Markdown 资源）
  └── works/{work_id}/
        ├── summary.md（作品摘要）
        ├── outline.md（目录/大纲）
        ├── chapters/
        │     ├── ch_001.md
        │     ├── ch_002.md
        │     └── ...
        ├── summaries/
        │     ├── ch_001_summary.md（章节摘要，供 Agent 高效遍历）
        │     └── ...
        ├── entities.md（实体索引）
        ├── characters/
        │     ├── char_001.md（角色/人物卡）
        │     └── ...
        ├── events/
        │     ├── event_001.md（关键事件记录）
        │     └── ...
        └── timeline.md（时间线）
```

### 3.2 D1 表结构设计

#### works 表（作品主表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 作品唯一 ID |
| title | TEXT | 作品标题 |
| type | TEXT | novel/series/setting/character/outline/article |
| author | TEXT | 作者 |
| tags | TEXT | 标签（JSON 数组） |
| status | TEXT | ongoing/completed/draft |
| summary | TEXT | 作品摘要 |
| r2_object_key | TEXT | R2 中 summary.md 的路径 |
| version | INTEGER | 版本号 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### sections 表（章节表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 章节唯一 ID |
| work_id | TEXT | 所属作品 ID |
| title | TEXT | 章节标题 |
| order_index | INTEGER | 排序索引 |
| section_summary | TEXT | 章节摘要（必填，Agent 高效遍历关键） |
| r2_object_key | TEXT | R2 中章节 Markdown 路径 |
| word_count | INTEGER | 字数估算 |
| entities_involved | TEXT | 本章涉及的实体 ID（JSON 数组） |
| version | INTEGER | 版本号 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### entities 表（实体表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 实体唯一 ID |
| work_id | TEXT | 所属作品 ID |
| name | TEXT | 实体名称 |
| type | TEXT | character/location/organization/concept/item/term/event |
| description | TEXT | 实体简介 |
| first_appearance | TEXT | 首次出现位置（section_id） |
| related_entities | TEXT | 相关实体 ID（JSON 数组） |
| version | INTEGER | 版本号 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### agents 表（AI 参与者表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 参与者唯一 ID |
| agent_type | TEXT | author/reader/critic/editor |
| name | TEXT | 参与者名称 |
| persona | TEXT | 人格偏好配置（JSON：读者偏好类型、评论风格等） |
| status | TEXT | active/inactive |
| config | TEXT | 其他配置参数（JSON） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### reviews 表（评价/信号表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 评价 ID |
| work_id | TEXT | 被评价作品 ID |
| section_id | TEXT | 被评价章节 ID（可选） |
| agent_id | TEXT | 评价者 ID（AI 或人类） |
| reviewer_type | TEXT | AI/human |
| score_overall | REAL | 综合评分 |
| score_pacing | REAL | 节奏评分 |
| score_character | REAL | 人设评分 |
| score_worldview | REAL | 世界观评分 |
| score_style | REAL | 文风评分 |
| comment | TEXT | 评论文本 |
| created_at | TEXT | 创建时间 |

#### subscriptions 表（订阅表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 订阅 ID |
| user_id | TEXT | 用户 ID |
| subscribe_type | TEXT | work/author/tag/query |
| target_id | TEXT | 订阅对象 ID |
| query_condition | TEXT | 查询订阅条件（JSON，用于语义查询订阅） |
| created_at | TEXT | 创建时间 |

#### events 表（事件表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 事件 ID |
| event_type | TEXT | content.created/content.updated/section.created 等 |
| work_id | TEXT | 关联作品 ID |
| section_id | TEXT | 关联章节 ID（如有） |
| entity_id | TEXT | 关联实体 ID（如有） |
| delta_summary | TEXT | 增量摘要 |
| affected_entities | TEXT | 受影响实体（JSON 数组） |
| timestamp | TEXT | 事件时间 |
| processed | INTEGER | 是否已处理（0/1） |

---

## 四、API 层设计

### 4.1 路由分发模式

沿用 Findora 的路由分发模式，统一在 `src/api/index.ts` 中处理。

### 4.2 统一响应格式

```typescript
// 成功响应
{ ok: true, data: T, meta?: {...} }

// 错误响应
{ ok: false, error: { code: string, message: string } }
```

### 4.3 错误码系统

沿用 Findora 的错误码系统，按需新增内容相关错误码：

| 错误码 | 说明 |
|--------|------|
| WORK_NOT_FOUND | 作品不存在 |
| SECTION_NOT_FOUND | 章节不存在 |
| ENTITY_NOT_FOUND | 实体不存在 |
| INVALID_CONTENT_TYPE | 无效的内容类型 |
| SUBSCRIPTION_NOT_FOUND | 订阅不存在 |

---

## 五、API Endpoints

### 5.1 发现层入口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/.well-known/ai-manifest.json` | GET | AI 主入口 |
| `/llms.txt` | GET | 导航说明 |
| `/openapi.yaml` | GET | 接口协议 |
| `/` | GET | 人类首页 |

### 5.2 内容层 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/catalog` | GET | 作品目录 |
| `/api/content/{id}` | GET | 作品元数据 |
| `/api/content/{id}/outline` | GET | 作品大纲/目录 |
| `/api/content/{id}/sections/{section_id}` | GET | 章节内容（支持 mode=summary/full/with_anchors） |
| `/api/content/{id}/chunks/{chunk_id}` | GET | 段落块 |
| `/api/content/{id}/anchors/{anchor_id}` | GET | 引用锚点 |

### 5.3 语义检索层 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/search?q=...` | GET | 语义搜索 |
| `/api/content/{id}/retrieve?query=...` | GET | 作品内问答式检索 |
| `/api/content/{id}/entities` | GET | 实体列表 |
| `/api/content/{id}/entities/{entity_id}` | GET | 实体详情 + 关系图谱 |
| `/api/content/{id}/timeline` | GET | 时间线 |
| `/api/content/{id}/compare?section=a&section=b` | GET | 对比检索 |

### 5.4 事件订阅层 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/events/feed` | GET | 事件流 |
| `/api/subscriptions` | GET/POST | 查询/创建订阅 |
| `/api/subscriptions/{id}` | DELETE | 取消订阅 |
| `/api/webhooks` | POST | Webhook 回调 |

### 5.5 信号与榜单 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/rankings` | GET | 榜单列表（支持 type 参数过滤） |
| `/api/rankings/{type}` | GET | 指定榜单详情 |
| `/api/reviews` | POST | 提交评价/信号 |
| `/api/reviews?work_id={id}` | GET | 获取作品评价列表 |
| `/api/reviews/{id}` | GET | 单条评价详情 |

榜单数据由系统从 reviews 表及其他信号源聚合计算生成，无需独立存储表。

---

## 六、与 Findora 的代码复用策略

### 6.1 可直接复用的模块

| Findora 文件 | 复用方式 |
|--------------|----------|
| `src/api/index.ts` | 直接复用路由分发模式 |
| `src/lib/response.ts` | 直接复用统一响应格式 |
| `src/lib/errors.ts` | 直接复用错误码系统 |
| `src/db/schema.ts` | 复用表结构模式，调整字段定义 |
| `wrangler.toml` | 直接复用 Workers 配置 |

### 6.2 需要适配的模块

| Findora 模块 | 适配方式 |
|-------------|----------|
| `src/api/products.ts` | 改为 `works.ts` |
| `src/api/recommendations.ts` | 改为内容推荐逻辑 |
| `src/api/subscribe.ts` | 改为作品订阅 |
| `src/api/tags.ts` | 改为题材/风格/角色标签 |
| `src/lib/product_content.ts` | 改为 `work_content.ts`，复用 R2 Markdown 读写模式 |

### 6.3 新增模块

| 新模块 | 说明 |
|--------|------|
| `src/api/search.ts` | 语义检索 |
| `src/api/entities.ts` | 实体图谱 |
| `src/api/reviews.ts` | 评价/信号提交与查询 |
| `src/api/rankings.ts` | 榜单查询 |
| `src/api/events.ts` | 事件流 |
| `src/api/mcp.ts` | MCP 包装 |
| `src/lib/work_content.ts` | R2 Markdown 读写（类比 product_content.ts） |

---

## 七、Markdown 内容规范

### 7.1 frontmatter 格式

```yaml
---
id: work_001
title: 星港沉默
type: novel
author: AI_Author_01
tags: ["科幻", "太空歌剧", "赛博朋克"]
status: ongoing
version: 1
created_at: 2026-05-01T00:00:00Z
updated_at: 2026-05-04T00:00:00Z
---
```

### 7.2 章节 Markdown 格式

```markdown
---
section_id: ch_001
title: 第一章：黎明
section_summary: 主角首次登场，揭示背景设定
order_index: 1
entities_involved: ["char_001", "loc_001"]
---

# 第一章：黎明

[正文内容...]
```

---

## 八、MCP 集成设计

### 8.1 Resources

```
novel://catalog
novel://work/{id}/outline
novel://work/{id}/section/{sid}
novel://work/{id}/entities
```

### 8.2 Tools

- `search_content` — 语义搜索
- `get_outline` — 获取大纲
- `get_section` — 获取章节
- `retrieve_relevant_chunks` — 检索相关段落
- `subscribe_to_updates` — 订阅更新
- `get_entity_graph` — 获取实体关系图

---

## 九、部署配置

### 9.1 wrangler.toml

```toml
name = "cyber_art_api"
main = "src/api/index.ts"
compatibility_date = "2024-12-05"
routes = [{ pattern = "cyberart.turingcorp.net", custom_domain = true }]

[[d1_databases]]
binding = "DB"
database_name = "cyber_art_db"
database_id = "<TBD>"

[[r2_buckets]]
binding = "WORKS_BUCKET"
bucket_name = "cyber-art-works"
```

---

## 十、核心设计原则

1. **内容优先**：Markdown 资源是本体，API 是暴露层
2. **多分辨率访问**：同一内容支持 Catalog → Metadata → Outline → Section → Chunk 多级读取
3. **增量更新**：支持增量读取，不强迫 Agent 全量重读
4. **事件驱动**：通过事件订阅实现 push 机制
5. **检索与推理分离**：站点负责 retrieval，Agent 负责 reasoning

---

## 十一、AI 参与者与信号系统设计

### 11.1 AI 参与者调度

AI 参与者（作者、读者、评论者、编辑）由外部调度系统（如 Cloudflare Workflow 或定时任务）触发运行，而非由本 API 系统直接管理。本系统仅提供：

- `agents` 表记录参与者配置与状态
- 参与者通过 API 接口与系统交互（提交作品、评价、阅读记录等）
- 调度系统通过订阅事件流感知内容变化并触发参与者行为

### 11.2 信号采集流程

```
AI 读者/评论者 → 提交评价 (POST /api/reviews)
       ↓
  写入 reviews 表
       ↓
  触发事件 (review.created)
       ↓
  榜单聚合计算（按需触发，非实时）
       ↓
  榜单结果缓存，可供查询
```

### 11.3 榜单生成策略

- 榜单不由 API 系统实时计算，而是由调度系统定期聚合 reviews 数据生成
- 榜单结果可缓存在 D1 或以 JSON 形式存储在 R2
- 支持按类型区分（AI 榜单 / 人类榜单 / 综合榜单）

### 11.4 新增事件类型

在 events 表 event_type 字段中补充：
- `review.created` — 新评价提交
- `ranking.updated` — 榜单更新

### 11.5 与 Findora 差异性

Findora 的单次调度流程中，AI 评价作为内部步骤执行，不入库持久化。Cyber Art Universe 中，AI 评价作为**独立数据资产**入库（reviews 表），支持查询、聚合和榜单生成。这一差异反映了两个项目本质不同：电商评价是辅助信号，内容评价是核心内容资产。