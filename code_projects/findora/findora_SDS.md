# Findora SDS — 软件设计说明书

> **项目名称：** Findora
> **版本：** v3.31
> **最后更新：** 2026-04-13
> **维护方式：** 以SRS F编号为主线的模块化设计文档

---

## 最近修改记录

> **规则：** 每次修改本文档后必须在此章节记录，只保留最新一次。

| 修改时间 | 修改内容 |
|----------|----------|
| 2026-04-15 | ST-T02/ST-T03 修复：注册 `POST /api/admin/configs` 路由（F-040-24a）；添加 key 格式验证 `[a-zA-Z][a-zA-Z0-9_]*`；删除 migration 011 冗余索引 |
| 2026-04-13 | 全文重构为以 F 编号为主线的模块化结构；各模块补充端点映射表、实现文件说明与数据模型说明；新增关键实现约束汇总与当前基线状态 |

---

## Actions

> **规则：** 每次修改本文档后必须更新此章节，反映当前项目最新待办方向，为后续协作者指明工作重点。

1. **AI 服务联调（优先）**：配置 `AI_API_KEY`（OpenAI 或 Anthropic），按 SDS AI 联调 SOP 完成 F-016（推荐解释 4 项）和 F-020（运营 AI 6 项）端到端验证，通过后将状态升级为 ✅
2. **本地 E2E 验证**：执行 `npm run build` + `wrangler d1 execute`，确认 001~014 迁移脚本在本地 D1 初始化成功
3. **端到端链路测试**：使用 Postman 对核心流（商品列表、标签精选、内容协商）进行完整 HTTP 链路验证
4. **优化项（非阻塞）**：P1-5 JSON 数组匹配改用 `json_each`、P1-6 时间存储策略统一、P1-7 前端 SSR 方案，待后续迭代处理

---

## 文档目标

本文档以SRS F编号为主线，记录每个功能模块的：
- 实现文件与代码位置
- 核心设计说明
- 数据模型对应
- API端点映射

不保留历史审核记录、阶段性整改过程、审计追溯叙述。

---

## 架构基线

- **运行平台：** Cloudflare Workers
- **结构化数据：** Cloudflare D1
- **内容正文与大文本：** Cloudflare R2
- **静态资源：** Workers Assets
- **统一入口：** `src/api/index.ts` 路由分发
- **管理端鉴权：** `X-Admin-Key` + `env.ADMIN_KEY`

---

## F-001~F-006 页面功能

### 设计说明
前端页面通过API层获取数据，支持JSON/Markdown内容协商。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/products.ts` | 商品列表/详情 |
| `src/api/lists.ts` | 榜单CRUD |
| `src/api/categories.ts` | 分类/子类目 |
| `src/api/subscribe.ts` | 订阅管理 |
| `src/api/favorites.ts` | 收藏管理 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/products` | GET | 商品列表（F-001） |
| `/api/products/:id` | GET | 商品详情（F-001） |
| `/api/lists` | GET | 榜单列表（F-003） |
| `/api/lists/:id` | GET | 榜单详情（F-003） |
| `/api/categories` | GET | 分类列表（F-002） |
| `/api/categories/:category/subcategories` | GET | 子类目筛选（F-002） |
| `/api/trending` | GET | 趋势内容（F-001-05） |
| `/api/favorites` | GET/POST/DELETE | 收藏管理（F-005） |
| `/api/favorites/lists` | GET/POST/DELETE | 榜单收藏（F-004-06） |

### 数据模型
- `products` 表 — 商品索引
- `lists` 表 — 榜单
- `list_products` 表 — 榜单商品关联
- `categories` 分类数据

---

## F-010 商品库管理

### 设计说明
商品全生命周期管理，支持D1+R2双写，内容与索引分离。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/products.ts` | 商品CRUD、批量导入 |
| `src/api/price_check.ts` | 价格监控 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/products` | POST | 创建商品（F-010-01） |
| `/api/admin/products/:id` | PUT | 更新商品（F-010-02） |
| `/api/admin/products/:id/status` | PATCH | 上下架（F-010-03） |
| `/api/admin/products/batch` | POST | 批量更新（F-010-04） |
| `/api/admin/products/import` | POST | 导入商品（F-010-01） |
| `/api/admin/price-check` | POST | 价格回推（F-010-05） |
| `/api/admin/price-check/batch` | POST | 批量价格检查 |

### 数据模型
- `products` 表 — 商品主表（含r2_object_key图片索引）

---

## F-011 标签体系

### 设计说明
支持一/二级维度标签，支持精选商品映射，标签维度可动态扩展。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/tags.ts` | 标签CRUD |
| `src/api/products.ts` | 商品打标（PATCH /api/admin/products/:id/tags） |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/tags` | POST | 创建标签（F-011-01） |
| `/api/admin/tags/:id` | PUT/DELETE | 更新/删除标签 |
| `/api/admin/tags/:id/featured` | PATCH | 更新精选商品（F-011-02） |
| `/api/tags` | GET | 标签列表（F-011-01） |
| `/api/tags/stats` | GET | 标签统计（F-011-03） |

### 数据模型
- `tags` 表 — 含 `layer`（category/function/audience/style/price）、`dimension_level`、`featured_products`

---

## F-012 联盟追踪

### 设计说明
点击追踪参数记录，5分钟去重窗口，转化回调确认。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/clicks.ts` | 点击记录 |
| `src/api/conversions.ts` | 转化回调 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/clicks` | POST | 记录点击（F-012-01~04） |
| `/api/conversions/callback` | POST | 联盟回调（F-040-20） |

### 数据模型
- `clicks` 表 — 点击日志（含UTM参数）
- `conversions` 表 — 转化记录

---

## F-013 用户订阅

### 设计说明
完整订阅运营闭环：订阅/退订/偏好/邮件/分群。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/subscribe.ts` | 订阅/退订/偏好 |
| `src/api/favorites.ts` | 收藏管理 |
| `src/api/admin/subscribers.ts` | 订阅管理后台 |
| `src/api/email.ts` | 邮件发送 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/subscribe` | POST | 订阅（F-013-01） |
| `/api/subscribe/preferences` | PUT | 更新偏好（F-013-02） |
| `/api/unsubscribe` | POST | 退订（F-013-03） |
| `/api/favorites` | GET/POST/DELETE | 收藏管理（F-013-05） |
| `/api/admin/subscribers` | GET | 订阅列表（F-013-08） |
| `/api/admin/subscribers/export` | GET | 导出CSV（F-013-09） |

### 数据模型
- `users` 表 — 含 `subscribed_categories`、`liked_tags`、`disliked_tags`、`saved_items`
- `email_logs` 表 — 邮件发送日志

---

## F-014 基础推荐

### 设计说明
规则推荐：同类目/同标签/价格带/热门/新品，30天窗口行为加权。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/recommendations.ts` | 规则推荐引擎 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/recommendations` | GET | 个性化推荐feed（F-014） |

### 推荐评分公式
```
score = category_match×10 + tag_match×3 + click_count×1 + favorite_count×2 + price_match×5 + recency_days×0.1
```

---

## F-015 进阶推荐

### 设计说明
行为推荐：行为分计算、协同过滤、MMR多样性控制。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/behavior.ts` | 行为评分 |
| `src/api/recommendations.ts` | 结果重排 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/recommendations/behavioral` | GET | 行为推荐（F-015） |

### MMR多样性控制
- 同一subcategory商品 ≤ 推荐结果30%
- 覆盖用户偏好标签中至少3个不同标签
- 计算超时预算 ≤ 50ms

---

## F-016 AI推荐解释

### 设计说明
预生成文案检索+规则模板拼装，非实时LLM生成。用户×商品24h TTL，通用7d，AI生成72h。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/explain.ts` | 解释生成/缓存 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/explain/:product_id` | GET | 推荐理由（F-016-01） |
| `/api/explain/batch` | POST | 批量解释 |
| `/api/explain/:product_id/comparison` | GET | 对比说明（F-016-02） |
| `/api/explain/:product_id/scenarios` | GET | 场景描述（F-016-03） |

### 数据模型
- `explanation_cache` 表 — 解释缓存（含TTL）

### 模板优先级
1. "Because you liked [类目] picks like [商品]"
2. "Picked for your [类目] feed"
3. "Matches your [budget/mid/premium] preference"
4. "Matches your interest in [标签]"
5. "Trending in [类目] this week"
6. 兜底

---

## F-017 数据看板

### 设计说明
运营分析指标：UV/CTR/转化/留存/分类/榜单/趋势。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/analytics.ts` | 分析端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/analytics/overview` | GET | 总览 |
| `/api/admin/analytics/uv` | GET | UV统计 |
| `/api/admin/analytics/ctr` | GET | CTR统计 |
| `/api/admin/analytics/conversion` | GET | 转化统计 |
| `/api/admin/analytics/categories` | GET | 分类统计 |
| `/api/admin/analytics/lists` | GET | 榜单统计 |
| `/api/admin/analytics/trends` | GET | 趋势分析 |

---

## F-020 运营AI能力

### 设计说明
系统外运营AI角色：选品/内容/社媒文案/推荐解释/运营分析/字段补全。异步产出后经F-040-22入库。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/ai_content.ts` | AI能力端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/ai/selection` | POST | 选品辅助（F-020-01） |
| `/api/admin/ai/generate` | POST | 内容生成（F-020-02） |
| `/api/admin/ai/social` | POST | 社媒文案（F-020-03） |
| `/api/admin/ai/explain` | POST | 推荐解释（F-020-04） |
| `/api/admin/ai/insights` | POST | 运营分析（F-020-05） |
| `/api/admin/ai/complete` | POST | 字段补全（F-020-06） |

---

## F-021 AI边界限制

### 设计说明
人工审核工作流：选品/合规/品牌/商业排序/夸张表述必须人工确认。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/ai_review.ts` | 审核工作流 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/ai-review/submit` | POST | 提交审核 |
| `/api/admin/ai-review/:id/review` | POST | 执行审核 |
| `/api/admin/ai-review/:id/approve` | POST | 批准 |
| `/api/admin/ai-review/:id/reject` | POST | 拒绝 |

### 禁用词
best/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving

---

## F-022 多语言支持

### 设计说明
国际化：locale/词条翻译/内容翻译/同步队列。MVP阶段仅英语。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/i18n.ts` | 多语言端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/i18n/locales` | GET | 支持语言列表 |
| `/api/i18n/translations/:locale` | GET | 翻译词条 |
| `/api/i18n/content/:type/:id/:locale/:field` | GET | 内容翻译 |

---

## F-023 会员体系

### 设计说明
会员层级/订阅/续期/权益/专属内容。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/membership.ts` | 会员端点 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/membership/tiers` | GET | 会员层级（F-023-01） |
| `/api/membership/my` | GET | 我的会员 |
| `/api/membership/subscribe` | POST | 订阅（F-023-02） |
| `/api/membership/check` | POST | 权益验证（F-023-03） |

### 数据模型
- `membership_tiers` 表
- `user_memberships` 表
- `subscription_events` 表

---

## F-030 内容管理

### 设计说明
选题/选品/发布/排期/统计的生产流程。

### 实现文件

| 文件 | 说明 |
|------|------|
| `src/api/admin/content.ts` | 内容管理 |

### 核心API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/topics` | GET/POST | 选题管理 |
| `/api/admin/topics/:id/products` | POST | 添加候选商品 |
| `/api/admin/content/publish` | POST | 发布内容 |
| `/api/admin/content/schedule` | GET | 排期查看 |
| `/api/admin/content/stats` | GET | 周产出统计 |

### 数据模型
- `content_topics` 表
- `topic_products` 表
- `content_production` 表

---

## F-040 API端点

### 设计说明
统一API入口，所有路由在`src/api/index.ts`分发。

### 端点分类

#### 公开端点（6个）
| 端点 | 说明 |
|------|------|
| GET `/api/products` | 商品列表 |
| GET `/api/products/:id` | 商品详情 |
| GET `/api/lists` | 榜单列表 |
| GET `/api/lists/:id` | 榜单详情 |
| GET `/api/categories` | 分类列表 |
| GET `/api/trending` | 趋势内容 |

#### 用户端点（8个）
| 端点 | 说明 |
|------|------|
| POST `/api/subscribe` | 订阅 |
| PUT `/api/subscribe/preferences` | 更新偏好 |
| POST `/api/unsubscribe` | 退订 |
| GET/POST/DELETE `/api/favorites` | 收藏 |
| POST `/api/clicks` | 记录点击 |
| GET `/api/recommendations` | 推荐feed |

#### 管理端点（11个）
| 端点 | 说明 |
|------|------|
| POST `/api/admin/products` | 创建商品 |
| PUT `/api/admin/products/:id` | 更新商品 |
| PATCH `/api/admin/products/:id/status` | 上下架 |
| PATCH `/api/admin/products/:id/tags` | 打标 |
| POST `/api/admin/products/batch` | 批量更新 |
| POST `/api/admin/products/import` | 导入 |
| POST `/api/admin/tags` | 创建标签 |
| POST `/api/admin/lists` | 创建榜单 |
| GET `/api/admin/configs` | 全局配置列表（F-040-24） |
| POST `/api/admin/configs` | 创建配置（F-040-24a） |
| PUT `/api/admin/configs/:key` | 更新配置（F-040-25） |

#### 外部系统接口（4个）
| 端点 | 说明 |
|------|------|
| POST `/api/conversions/callback` | 联盟回调（F-040-20） |
| POST `/api/admin/price-check` | 价格回推（F-040-23） |
| GET `/api/configs/:key` | 公开配置读取（F-040-26） |

### 认证方式
- 管理端：`X-Admin-Key` Header
- 用户端：`X-User-Email` 或 `X-Anonymous-Id`

---

## F-050 数据模型

### D1表结构

| 表名 | 说明 | 对应Migrations |
|------|------|----------------|
| `products` | 商品主表 | 001_initial_schema |
| `users` | 用户表 | 001_initial_schema |
| `clicks` | 点击日志 | 001_initial_schema |
| `lists` | 榜单表 | 001_initial_schema |
| `list_products` | 榜单商品关联 | 010_list_products |
| `tags` | 标签表 | 001_initial_schema |
| `user_sessions` | 会话表 | 012_ems_schema |
| `conversions` | 转化记录 | 013_runtime_tables |
| `explanation_cache` | 解释缓存 | 013_runtime_tables |
| `email_logs` | 邮件日志 | 013_runtime_tables |
| `price_history` | 价格历史 | 004_price_history |
| `ai_review_records` | AI审核记录 | 005_ai_review_records |
| `global_configs` | 全局配置 | 014_global_configs |
| `ems_users` | EMS用户 | 012_ems_schema |
| `enterprises` | 企业 | 012_ems_schema |
| `enterprise_members` | 企业成员 | 012_ems_schema |
| `records` | 业务记录 | 012_ems_schema |
| `audit_logs` | 审计日志 | 012_ems_schema |

### TypeScript类型
`src/db/schema.ts` — 所有表对应TypeScript类型定义

---

## 关键实现约束

| 约束 | 说明 |
|------|------|
| 鉴权 | 管理端统一 `isAdmin(request, env)` |
| 内容协商 | 产品接口支持 JSON/Markdown |
| 存储分离 | D1存索引，R2存内容/图片 |
| 推荐链路 | 仅DB检索+随机抽选，无实时LLM |
| API唯一入口 | 前端/Agent禁止直连D1/R2 |

---

## 当前基线状态（v3.31）

| 指标 | 数值 | 备注 |
|------|------|------|
| 总功能数 | 149项 | |
| 需求设计(🗓) | 149项 | 100% |
| 代码实现(🏗) | 149项 | 100% |
| 功能审核(✅) | 134项 | 90% |
| 待AI联调(🏗) | 15项 | F-016(4项)+F-020(6项)+F-040-22(1项)等 |
| 完成度 | 90% | |

**无 CRITICAL/HIGH 阻塞项。**
