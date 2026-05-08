# Cyber Art Universe — 软件设计规格（SDS）

---

## 文档说明

- **本文档由代码驱动更新**：描述的是当前代码中**实际实现**了什么。每次新增模块或 API 端点后更新。
- **与传统 SDS 的区别**：传统 SDS 是编码前的详细设计。本 SDS 是编码后的实现记录——从代码中提取实际状态，而非预设设计。与 system_design.md 的分工：system_design.md 描述"应该怎么做"，SDS 描述"实际做了什么"。
- **何时更新**：
  - 新增/删除模块或端点时
  - D1 表结构变更时
  - 代码复用策略变化时
- **关联文档**：[Business Concept](../business_concept.md) → [SRS](SRS.md) → [System Design](../system_design.md) → 本文档 → [STR](STR.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-05-06 | 初始版本，与 SRS v1.0.0、STR v1.0.0 对齐 |
| v1.1.0 | 2026-05-06 | reviews 表简化 + L1 分类落地，works 表新增 category/creation_attribution/audience；前端 Read+Write 双入口；新增 /write.html |

---

## 一、项目概况

- **项目名**：`cyber-art-api`
- **部署域名**：`CAU.turingcorp.net`
- **Cloudflare Worker**：`cyber_art_api`
- **D1 数据库**：`cyber_art_db`（ID: `619a8b4f-fc5c-44f8-9035-4e7200f1ab15`）
- **R2 存储**：`cyber-art-works`（binding: `WORKS_BUCKET`）
- **静态资产目录**：`src/pages/`

---

## 二、源代码模块清单

### 2.1 核心库（`src/lib/`）

| 文件 | 行数 | 用途 | 来源 |
|------|------|------|------|
| `response.ts` | 37 | 统一响应格式 `jsonSuccess`/`jsonError`/`parseJSON` | 复用 Findora，精确复制 |
| `errors.ts` | 103 | 29 个错误码（常量+消息映射） | 适配 Findora，去掉 8 个 Findora 特有码，新增 6 个 CAU 码 |
| `constants.ts` | 37 | 分页参数 + `parsePagination`/`parseLimit` | 复用 Findora，仅保留分页函数 |
| `work_content.ts` | 147 | R2 Markdown 读写层（作品/章节 frontmatter 编解码 + 路径管理） | 基于 Findora `product_content.ts` 重写 |

### 2.2 API 模块（`src/api/`）

| 文件 | 行数 | 用途 | 端点数 |
|------|------|------|--------|
| `index.ts` | 152 | 路由分发入口 + Admin 鉴权 + Workers fetch/scheduled | — |
| `works.ts` | 295 | 作品+章节 CRUD（D1 + R2） | 10 |
| `entities.ts` | 199 | 实体 CRUD + 时间线 + 章节对比 | 9 |
| `reviews.ts` | 60 | 评价提交与查询 | 3 |
| `events.ts` | 68 | 事件流 + 榜单查询 | 4 |
| `subscriptions.ts` | 41 | 订阅 CRUD | 3 |
| `search.ts` | 72 | 全文搜索 + 作品内检索 | 2 |
| `discovery.ts` | 60 | AI Manifest / LLMs.txt / OpenAPI 静态端点 | 3 |
| `mcp.ts` | 97 | MCP 协议包装（Resources + Tools） | 1 |

### 2.3 数据层（`src/db/`）

| 文件 | 用途 |
|------|------|
| `schema.ts` | TypeScript 类型定义（Work/Section/Entity/Agent/Review/Subscription/Event/Env） |

### 2.4 前端（`src/pages/`）

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.html` | 50 | 首页（Hero + 分类卡片 + 热门作品 JS 加载） |
| `read.html` | 75 | 阅读器（Markdown 渲染 + 字号调节 + 章节导航） |
| `work.html` | 55 | 作品详情（信息 + 目录 + 角色） |
| `browse.html` | 65 | 分类浏览（类型筛选 + 分页） |
| `about.html` | 45 | 关于页（项目介绍 + Agent 入口） |
| `assets/style.css` | 185 | 全局样式（深色赛博主题） |
| `assets/app.js` | 77 | 共享脚本（API 封装 / 渲染组件 / 工具函数） |
| `robots.txt` | 2 | SEO |

### 2.5 数据库迁移（`migrations/`）

| 文件 | 用途 |
|------|------|
| `001_initial_schema.sql` | 7 张核心表 + 15 个索引 |

---

## 三、API 端点清单

### 3.1 发现层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/.well-known/ai-manifest.json` | `discovery.ts` | F-010 |
| GET | `/llms.txt` | `discovery.ts` | F-011 |
| GET | `/openapi.yaml` | `discovery.ts` | F-012 |

### 3.2 内容层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/api/catalog` | `works.ts` → `listWorks` | F-001 |
| GET | `/api/content/{id}` | `works.ts` → `getWork` | F-002 |
| GET | `/api/content/{id}/outline` | `works.ts` → `getWorkOutline` | F-003 |
| GET | `/api/content/{id}/sections/{section_id}` | `works.ts` → `getSection` | F-004 |
| POST | `/api/admin/works` | `works.ts` → `createWork` | F-005 |
| PUT | `/api/admin/works/{id}` | `works.ts` → `updateWork` | F-005 |
| DELETE | `/api/admin/works/{id}` | `works.ts` → `deleteWork` | F-005 |
| POST | `/api/admin/works/{id}/sections` | `works.ts` → `createSection` | F-006 |
| PUT | `/api/admin/works/{id}/sections/{sid}` | `works.ts` → `updateSection` | F-006 |
| DELETE | `/api/admin/works/{id}/sections/{sid}` | `works.ts` → `deleteSection` | F-006 |

### 3.3 实体层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/api/content/{id}/entities` | `entities.ts` → `listEntities` | F-020 |
| GET | `/api/content/{id}/entities/{eid}` | `entities.ts` → `getEntity` | F-021 |
| GET | `/api/content/{id}/timeline` | `entities.ts` → `getTimeline` | F-022 |
| GET | `/api/content/{id}/compare` | `entities.ts` → `compareSections` | F-023 |
| POST | `/api/admin/works/{id}/entities` | `entities.ts` → `createEntity` | F-024 |
| PUT | `/api/admin/works/{id}/entities/{eid}` | `entities.ts` → `updateEntity` | F-024 |
| DELETE | `/api/admin/works/{id}/entities/{eid}` | `entities.ts` → `deleteEntity` | F-024 |

### 3.4 评价/信号层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| POST | `/api/reviews` | `reviews.ts` → `submitReview` | F-030 |
| GET | `/api/reviews` | `reviews.ts` → `listReviews` | F-031 |
| GET | `/api/reviews/{id}` | `reviews.ts` → `getReview` | F-032 |

### 3.5 事件/榜单层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/api/events/feed` | `events.ts` → `getEventFeed` | F-040 |
| GET | `/api/rankings` | `events.ts` → `listRankings` | F-041 |
| GET | `/api/rankings/{type}` | `events.ts` → `getRanking` | F-042 |
| POST | `/api/admin/events` | `events.ts` → `createEvent` | F-043 |

### 3.6 订阅层

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/api/subscriptions` | `subscriptions.ts` → `listSubscriptions` | F-050 |
| POST | `/api/subscriptions` | `subscriptions.ts` → `createSubscription` | F-051 |
| DELETE | `/api/subscriptions/{id}` | `subscriptions.ts` → `deleteSubscription` | F-052 |

### 3.7 搜索

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| GET | `/api/search` | `search.ts` → `searchContent` | F-060 |
| GET | `/api/content/{id}/retrieve` | `search.ts` → `retrieveInWork` | F-061 |

### 3.8 MCP

| 方法 | 路径 | 模块 | SRS |
|------|------|------|-----|
| POST | `/api/mcp` | `mcp.ts` → `handleMCP` | F-070 |

### 3.9 其他

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/` | 静态首页 |
| GET | `/assets/*` | 静态资源 |

**总计数**：36 个 API 端点

---

## 四、D1 表结构

| 表名 | 列数 | 索引 | 用途 |
|------|------|------|------|
| `works` | 15 | 4 | 作品主表（含 category/creation_attribution/audience） |
| `sections` | 12 | 2 | 章节表，`works(id) ON DELETE CASCADE` |
| `entities` | 10 | 2 | 实体表，`works(id) ON DELETE CASCADE` |
| `agents` | 8 | 1 | AI 参与者配置表 |
| `reviews` | 13 | 3 | 评价/信号表 |
| `subscriptions` | 6 | 2 | 事件订阅表 |
| `events` | 9 | 3 | 事件日志表 |

---

## 五、与 system_design.md 的差异

| 差异项 | system_design 描述 | 实际实现 | 原因 |
|--------|-------------------|----------|------|
| Chunk/Anchor API | 定义但未实现 | ⏳ 待实现 | MVP 范围外，Agent 可使用 section 级 + body 解析 |
| agents 表管理 API | 未定义 | ⏳ 待实现 | 当前 agents 表仅建表，调度系统后续接入 |
| 语义搜索 | 提到 AI Search 的可能 | 当前用 D1 `LIKE` 实现 | 遵循"检索与推理分离"原则，"检索"用 SQL，不做向量嵌入 |
| rankings 存储 | 提到缓存在 D1 或 R2 | 当前从 R2 读取 JSON 缓存 | 等待外部调度系统写入 |
| ADMIN_KEY secret 值 | 未明确 | `CAU-TuringCorp-13572468` (已通过 wrangler secret 设置) | 部署时设置 |
| OpenAPI 规范 | 仅 5 端点 | 17 端点完整覆盖 | 2026-05-08 补全 |
| likeReview 去重 | 无去重 | ?reviewer_id 基本去重 | 2026-05-08 添加 |
| R2 写入错误处理 | 静默失败 | worldbuilding.ts 已加 try/catch | 2026-05-08 修复 |

---

## 六、代码量统计

| 分类 | 文件数 | 总行数（估计） |
|------|--------|---------------|
| 核心库（lib/） | 4 | ~340 |
| API 模块（api/） | 9 | ~1040 |
| 数据库（db/） | 1 | ~100 |
| 前端（pages/） | 8 | ~560 |
| 迁移（migrations/） | 1 | ~100 |
| **总计** | **23** | **~2,140** |
