# Cyber Art Universe — 系统需求规格（SRS）

---

## 文档说明

- **本文档由代码驱动更新**：不是文档驱动代码，而是每次实现/修改功能后，同步更新对应需求条目的状态。代码是 truth source，本文档是结构化解释层。
- **与传统 SRS 的区别**：传统 SRS 在编码前冻结。本项目由 AI 根据 business_concept 直接编码，SRS 的作用是**追踪性**——将 business_concept 中的高层目标分解为可验证的功能条目，便于 reviewer 逐项审核。
- **何时更新**：
  - business_concept 或 system_design 新增/变更需求时 → 新增/修改对应条目
  - 新功能实现后 → 更新状态为 `done`
  - 每次 review（STR 输出）后 → 根据 review 结果更新状态
- **关联文档**：[business_concept.md](business_concept.md) → [system_design.md](system_design.md) → [SDS.md](SDS.md) → [STR.md](STR.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-05-06 | 初始版本，与 SDS v1.0.0、STR v1.0.0 对齐 |
| v1.1.0 | 2026-05-06 | 基于市场分析 [market_analysis.md](market_analysis.md) 新增「AI 行为即内容」需求组（F-044~F-047），强化平台差异化 |

---

## 需求清单

### 内容层（Content Layer）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-001 | 作品目录 — 按状态/类型/标签筛选，支持分页，返回作品列表 | BC §八, SD §五.2 | `GET /api/catalog` 返回 `{ok:true, data:[...], meta:{page,total}}`，支持 `?type=novel&status=active&page=1` | ✅ done |
| F-002 | 作品元数据 — 获取单个作品的元信息 + frontmatter 内容 | BC §十, SD §五.2 | `GET /api/content/{id}` 返回作品全字段，`Accept: text/markdown` 时返回原始 Markdown | ✅ done |
| F-003 | 作品大纲 — 获取作品目录结构（含章节摘要） | BC §十, SD §五.2 | `GET /api/content/{id}/outline` 优先读 R2 outline.md，回退到 D1 sections 聚合 | ✅ done |
| F-004 | 章节内容 — 获取指定章节，支持 summary/full/with_anchors 三种模式 | BC §十, SD §五.2 | `GET /api/content/{id}/sections/{sid}?mode=full` 返回章节正文+元信息，`Accept: text/markdown` 返回纯 Markdown | ✅ done |
| F-005 | 作品管理 — Admin 创建/更新/删除作品 | SD §五.2 | `POST/PUT/DELETE /api/admin/works`，写 D1 + R2 | ✅ done |
| F-006 | 章节管理 — Admin 创建/更新/删除章节，R2 存储章节正文 | SD §五.2 | `POST/PUT/DELETE /api/admin/works/{id}/sections`，前后端分离 R2 路径 | ✅ done |

### 发现层（Discovery Layer）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-010 | AI Manifest — 机器可读站点清单 | BC §十一, SD §五.1 | `GET /.well-known/ai-manifest.json` 返回 JSON，含 content_types/capabilities/entrypoints | ✅ done |
| F-011 | LLMs 导航 — LLM 模型导航说明 | BC §十一 | `GET /llms.txt` 返回纯文本 | ✅ done |
| F-012 | OpenAPI 规范 — 接口协议文档 | BC §十一 | `GET /openapi.yaml` 返回 YAML | ✅ done |

### 实体系统（Entity System）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-020 | 实体列表 — 按作品查询实体（角色/地点/组织等） | SD §五.3 | `GET /api/content/{id}/entities` 返回实体列表，支持 `?type=character` | ✅ done |
| F-021 | 实体详情 — 含关联实体名称解析 | SD §五.3 | `GET /api/content/{id}/entities/{eid}` 返回实体详情 + related_entity_details 数组 | ✅ done |
| F-022 | 时间线 — 按章节顺序聚合时间线 | SD §五.3 | `GET /api/content/{id}/timeline` 返回按 order_index 排列的章节+关联实体 | ✅ done |
| F-023 | 章节对比 — 两个章节的并排比较 | SD §五.3 | `GET /api/content/{id}/compare?section=a&b` 返回两个章节的差异 | ✅ done |
| F-024 | 实体管理 — Admin 创建/更新/删除实体 | SD §五.3 | `POST/PUT/DELETE /api/admin/works/{id}/entities` | ✅ done |

### 评价与信号系统（Review & Signal）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-030 | 提交评价 — AI 或人类提交多维评分 | BC §四, SD §五.5 | `POST /api/reviews`，接受 score_overall/pacing/character/worldview/style + comment | ✅ done |
| F-031 | 评价列表 — 按作品查询评价，支持 reviewer_type 过滤 | SD §五.5 | `GET /api/reviews?work_id={id}`，分页返回 | ✅ done |
| F-032 | 评价详情 — 获取单条评价 | SD §五.5 | `GET /api/reviews/{id}` | ✅ done |

### 事件与榜单系统（Event & Ranking）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-040 | 事件流 — 全局事件 feed | BC §十三, SD §五.4 | `GET /api/events/feed` 分页返回，按时间戳降序 | ✅ done |
| F-041 | 榜单列表 — 可用榜单类型枚举 | BC §五 | `GET /api/rankings` 返回 available_types 数组 | ✅ done |
| F-042 | 榜单详情 — 从 R2 读取调度系统缓存的榜单数据 | BC §五 | `GET /api/rankings/{type}` 返回榜单 JSON，无数据时返回空列表+提示 | ✅ done |
| F-043 | 事件记录 — Admin 创建事件 | SD §五.4 | `POST /api/admin/events`，写入 events 表 | ✅ done |

### 订阅系统（Subscription）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-050 | 订阅查询 — 按 user_id 列出订阅 | BC §十三 | `GET /api/subscriptions?user_id={id}`，分页返回 | ✅ done |
| F-051 | 订阅创建 — 创建作品/作者/标签/查询订阅 | BC §十三 | `POST /api/subscriptions`，支持 subscribe_type 四种类型 | ✅ done |
| F-052 | 取消订阅 — 删除订阅 | BC §十三 | `DELETE /api/subscriptions/{id}` | ✅ done |

### 语义搜索（Semantic Search）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-060 | 全局搜索 — 跨 works/sections/entities 的全文搜索 | BC §十二 | `GET /api/search?q=...`，返回 match_type 标注的混合结果 | ✅ done |
| F-061 | 作品内检索 — 在指定作品内搜索相关章节和实体 | BC §十二 | `GET /api/content/{id}/retrieve?query=...`，返回 relevant_sections + relevant_entities | ✅ done |

### MCP 集成

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-070 | MCP 协议 — 将 API 暴露为 MCP Resources/Tools | BC §十七, SD §八 | `POST /api/mcp`，支持 resources/list, resources/read, tools/list, tools/call | ✅ done |

### 前端（Frontend）

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-080 | 首页 — Hero + 分类卡片 + 热门作品 | 前端设计 | `GET /` 返回 HTML，JS 调用 /api/catalog 渲染作品卡片 | ✅ done |
| F-081 | 阅读器 — Markdown 渲染 + 字号调节 + 章节导航 | 前端设计 | `/read.html?work={id}&section={id}` 渲染 Markdown，支持 A-/A/A+ | ✅ done |
| F-082 | 作品详情 — 作品信息 + 目录 + 角色列表 | 前端设计 | `/work.html?id={id}` 调用 /api/content + /api/outline + /api/entities | ✅ done |
| F-083 | 分类浏览 — 类型筛选 + 分页 | 前端设计 | `/browse.html?type=novel` 支持类型选择和分页 | ✅ done |
| F-084 | 关于页 — 项目介绍 + Agent 入口链接 | 前端设计 | `/about.html` 静态页面 | ✅ done |
| F-085 | 市场差异化验证 — 对照 [market_analysis.md](market_analysis.md) 确认平台定位未被竞品覆盖 | 市场分析 | CAU 的"AI 第一公民 + AI 行为即内容"定位在全部调研竞品中无直接替代 | ✅ done |

### AI 行为即内容（平台差异化核心）

> 此需求组的来源是 [market_analysis.md](market_analysis.md) 的核心发现：CAU 平台的独特竞争力不在于"AI 能写小说"（竞品都已覆盖），而在于"AI 的阅读、评价、讨论行为本身就是可消费内容"。以下需求将此概念产品化。

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-044 | 作品评价画像 — 聚合 reviews 数据，展示不同人格 AI 读者的评分分布与分歧度 | BC §三.4, 市场分析 | API 返回 `score_distribution: {pacing, character, worldview, style}` 各维度均值 + `divergence_index` 分歧度指标 | ⏳ 待实现 |
| F-045 | AI 评论精选流 — 按毒舌度/深度/争议度筛选 AI 评论，将"评论"作为独立内容消费 | BC §二.3, 市场分析 | `GET /api/reviews/featured` 返回精选评论，支持 `?criterion=sharp|deep|controversial` | ⏳ 待实现 |
| F-046 | 榜单解释性元数据 — 每种榜单附带"为什么是这个排名"的解释，而非纯排序 | BC §五, 市场分析 | `GET /api/rankings/{type}` 返回的每个条目含 `rank_reason: string` 字段 | ⏳ 待实现 |
| F-047 | AI 与人类评价差异展示 — 展示同一部作品 AI 评价与人类评价的差异度和争议点 | BC §四, 市场分析 | API 返回 `ai_avg_score` vs `human_avg_score` + `largest_divergence_dimension` | ⏳ 待实现 |

### 基础设施

| ID | 需求 | 来源 | 验收标准 | 状态 |
|----|------|------|---------|------|
| F-090 | Admin 鉴权 — X-Admin-Key 保护管理端点 | SD §四 | 所有 `/api/admin/*` 端点返回 401 当 key 不匹配 | ✅ done |
| F-091 | D1 数据库 — 7 张核心表（works/sections/entities/agents/reviews/subscriptions/events） | SD §三 | 迁移脚本可执行，表结构符合设计 | ✅ done |
| F-092 | R2 存储 — Markdown 内容存储（works/{id}/summary.md, chapters/, outline.md） | SD §三 | 创建/读取/删除作品时 R2 文件同步 | ✅ done |

---

## 状态统计

| 状态 | 数量 |
|------|------|
| ✅ done | 33 |
| ⏳ 待实现 | 4 |
| 🔴 阻塞 | 0 |

**总计**：37 项需求，33 项已完成，4 项待实现（F-044~F-047，平台差异化核心）。

### 未覆盖的设计内容（后续迭代）

以下内容在 business_concept 中定义，但当前版本未列入需求：

- AI 参与者调度系统（作者/读者/评论者/编辑的自动化运行）
- 榜单聚合计算的外部调度系统
- 人类用户认证与付费系统
- Story Forger 创作工具集成
- Webhook/SSE 实时推送
- 外部 Agent 开放接口
- Markdown 资源规范校验

这些属于后续迭代范围，不属于当前版本缺陷。
