# Findora SDS — 软件设计说明书（精简版）

> **项目名称：** Findora
> **版本：** v3.30
> **最后更新：** 2026-04-13
> **维护方式：** Agent维护（仅保留与SRS对应关系及简要设计说明）

---

## 1. 文档目标

本文件仅保留两类信息：
- SRS 功能编号与当前实现的对应关系
- 关键实现方式的简要说明（模块入口、数据边界、依赖组件）

不保留历史审核记录、阶段性整改过程、审计追溯叙述。

---

## 2. 架构基线（与 SRS 一致）

- **运行平台：** Cloudflare Workers
- **结构化数据：** Cloudflare D1
- **内容正文与大文本：** Cloudflare R2（通过统一内容读写层访问）
- **静态资源：** Workers Assets
- **统一入口：** `src/api/index.ts` 路由分发
- **管理端鉴权：** `X-Admin-Key` + `env.ADMIN_KEY`

设计边界：
- 前端/Agent 不直接访问 D1/R2，统一通过 API 层。
- 商品索引字段在 D1，富文本内容在 R2，避免列表场景读取 R2 造成性能退化。

---

## 3. SRS ↔ 实现映射（核心）

| SRS 模块 | 范围 | 主要实现文件 | 简要说明 |
|------|------|------|------|
| F-001~F-006 页面功能 | 首页/类目/详情/榜单/订阅/静态页 | `src/api/products.ts`, `src/api/lists.ts`, `src/api/categories.ts`, `src/api/subscribe.ts`, `src/api/favorites.ts` | F-001-05 趋势内容(/api/trending)、F-002-03 子类目筛选(/api/categories/:category/subcategories)、F-002-05 排序(sort_by 参数)、F-004-06 榜单收藏(/api/favorites/lists) |
| F-010 商品库管理 | 创建/编辑/上下架/批量/价格检查 | `src/api/products.ts`, `src/api/price_check.ts` | 管理端商品全生命周期与价格变动链路 |
| F-011 标签体系 | 标签 CRUD、打标、统计、精选 | `src/api/tags.ts`, `src/api/products.ts` | 支持标签层级与精选商品映射 |
| F-012 联盟追踪 | 点击记录、去重、转化回调 | `src/api/clicks.ts`, `src/api/conversions.ts` | 追踪参数 + 点击/转化数据沉淀 |
| F-013 用户订阅 | 订阅、偏好、收藏、分群、邮件 | `src/api/subscribe.ts`, `src/api/favorites.ts`, `src/api/admin/subscribers.ts`, `src/api/email.ts` | 完整订阅运营闭环 |
| F-014 基础推荐 | 同类目/同标签/价格带/热门/新品 | `src/api/recommendations.ts` | 规则推荐，包含 30 天窗口行为加权 |
| F-015 行为推荐 | 行为分、重排、多样性 | `src/api/behavior.ts`, `src/api/recommendations.ts` | 行为特征参与排序与结果重排 |
| F-016 AI 推荐解释 | 解释、对比、场景、缓存 | `src/api/explain.ts` | 解释结果缓存使用D1 explanation_cache表（不是KV），支持批量/对比/场景输出 |
| F-017 数据看板 | UV/CTR/转化/类目/榜单/趋势 | `src/api/analytics.ts` | 运营分析指标查询接口 |
| F-020 AI 辅助能力 | 选品、内容、社媒、洞察、补全 | `src/api/ai_content.ts` | 面向运营后台的 AI 生产力接口 |
| F-021 AI 边界限制 | AI 审核工作流 | `src/api/ai_review.ts` | 审核记录、校验、复审与修订闭环 |
| F-022 多语言支持 | locale、词条、内容翻译、同步队列 | `src/api/i18n.ts` | 公共读接口 + 管理写接口分离 |
| F-023 会员体系 | 会员层级、订阅、权益、专属内容 | `src/api/membership.ts` | 公共查询 + 管理配置双通道 |
| F-030 内容管理 | 选题、选品、发布、排期、统计 | `src/api/admin/content.ts` | 从选题到榜单发布的生产流程 |
| F-040 API 端点 | 公共端点 + 管理端点 | `src/api/index.ts` | 所有路由在统一入口分发 |
| F-050 数据模型 | 数据结构与索引 | `src/db/schema.ts`, `migrations/*.sql` | D1 表结构、索引与类型定义一致 |

---

## 4. F-040 端点覆盖（基线）

以下为 SRS 基线端点集合（按能力归类）：
- 公共读：`/api/products`, `/api/products/:id`, `/api/lists`, `/api/lists/:id`, `/api/categories`, `/api/categories/:category/subcategories`, `/api/trending`
- 用户行为：`/api/subscribe`, `/api/subscribe/preferences`, `/api/favorites`, `/api/favorites/lists`, `/api/favorites/lists/:list_id`, `/api/clicks`, `/api/recommendations`
- 管理端基础：`/api/admin/products`, `/api/admin/products/:id`, `/api/admin/products/:id/status`, `/api/admin/tags`, `/api/admin/lists`

**新增端点（v3.08 实现）：**
- `GET /api/trending` - F-001-05 趋势内容（基于7天点击量）
- `GET /api/categories/:category/subcategories` - F-002-03 子类目筛选
- `GET /api/products?sort_by=newest|popular|price_asc|price_desc` - F-002-05 排序
- `GET /api/favorites/lists` - F-004-06 收藏榜单列表
- `POST /api/favorites/lists/:list_id` - F-004-06 收藏榜单
- `DELETE /api/favorites/lists/:list_id` - F-004-06 取消收藏榜单

扩展端点（F-013/F-015/F-016/F-017/F-020~F-023/F-030）在 `src/api/index.ts` 统一挂载，不再在本文逐条展开。

**外部系统接口（v3.13 实现）：**
- `POST /api/conversions/callback` - F-040-20 联盟追踪回调（Alibaba.com Affiliate等）
- `POST /api/email/send-confirmation` - F-040-21 邮件发送（Resend/SendGrid）
- `POST /api/admin/email/send-weekly` - F-040-21 周报邮件（cron: 0 9 * * 4，周四9:00 UTC）
- `POST /api/admin/email/send-unsubscription-confirmation` - F-040-21 退订确认邮件
- `POST /api/admin/email/send-reengagement` - F-040-21 召回邮件
- `GET /api/admin/email/logs` - F-040-21 邮件发送日志查询
- AI服务接口 - F-040-22 OpenAI/Anthropic生成式API（详见F-020/F-016）
- `POST /api/admin/price-check` - F-040-23 价格监控（外部服务回推方式）
- `POST /api/admin/price-check/batch` - F-040-23 批量价格检查
- `GET /api/admin/price-check` - F-040-23 价格变动列表
- `GET /api/admin/price-check/:product_id` - F-040-23 单商品价格历史

---

## 5. 数据模型对应（F-050）

| 设计对象 | 文件 | 说明 |
|------|------|------|
| D1 类型定义 | `src/db/schema.ts` | 所有核心表对应 TypeScript 类型 |
| 初始结构 | `migrations/001_initial_schema.sql` | 基础表结构 |
| 索引补齐 | `migrations/002_add_missing_indexes.sql` | 关键查询索引 |
| 榜单关联 | `migrations/010_list_products.sql` | 榜单与商品关联表 |
| v3.0 架构补齐 | `migrations/011_products_r2_index.sql` | `products/tags/users` 关键字段补齐（含 R2 索引字段） |
| EMS 企业管理 | `migrations/012_ems_schema.sql` | enterprises/enterprise_members/records/audit_logs/ems_users/user_sessions |
| 运行时表正式化 | `migrations/013_runtime_tables.sql` | conversions/explanation_cache/email_logs（conversions/explanation_cache/email_logs三表正式化）|
| 全局配置 | `migrations/014_global_configs.sql` | global_configs 表及默认配置项 |
| 运行时建表策略 | 业务代码中的`CREATE TABLE IF NOT EXISTS` | 作为migration的fallback，确保新环境部署时自动建表 |

---

## 6. 关键实现约束

- **鉴权约束：** 管理端接口统一走 `isAdmin(request, env)`。
- **内容协商约束：** 产品内容接口支持 JSON/Markdown 协商输出。
- **存储约束：** 结构化索引写入 D1，长文本写入 R2，并保持双写一致性。
- **推荐约束：** 推荐逻辑包含 `liked_tags` 与 `disliked_tags` 处理，并引入近期行为加权。
- **接口契约约束：** 错误响应统一由公共错误码与响应工具输出。

---

## 7. 维护规则（SDS精简版）

后续只维护以下内容：
- SRS 新增/调整编号对应到哪个实现模块
- 路由或数据模型发生变更时的映射更新
- 关键设计约束是否变化

不维护内容：
- 历史审核轮次
- 整改过程日志
- 审计追溯叙述

---

## 8. 当前基线状态（v3.30）

| 指标 | 数值 | 备注 |
|------|------|------|
| 总功能数 | 149项 | |
| 需求设计(🗓) | 149项 | 100% |
| 代码实现(🏗) | 149项 | 100% |
| 功能审核(✅) | 134项 | 90% |
| 待AI联调(🏗) | 15项 | F-016(4项) + F-020(6项) + F-040-22(1项) 等 |
| 完成度 | 90% | |

**遗留待推进项：**

| 编号 | 描述 | 当前状态 | 依赖 |
|------|------|----------|------|
| F-016（4项） | AI推荐解释 | 🏗 | 待AI服务（OpenAI/Anthropic）接入联调 |
| F-020（6项） | AI辅助能力 | 🏗 | 待AI服务（OpenAI/Anthropic）接入联调 |
| F-040-22 | AI服务接口 | 🏗 | 依赖F-016/F-020 |
| P1-5/6/7 | 优化项（非阻塞） | 待迭代 | 视运营需求优先级决定 |

**无 CRITICAL/HIGH 阻塞项。**

**代码基线确认（v3.30）：**
- TypeScript 编译 0 错误
- src/ 目录自第57次STR审核后无代码变更，代码基线持续稳定
- 所有核心模块已通过第58次STR审核验证

---

## 9. 下一步交接（给下一位Agent）

### 执行 Checklist

- [ ] 读取并对齐 `findora_SRS.md`、`findora_SDS.md`、`findora_STR.md`，确认当前基线版本与优先级。
- [ ] 从 SRS 中仅筛选”未完成/新增”功能编号，排除已完成项，形成本轮任务范围。
- [ ] 按功能编号定位代码落点（优先 `src/api/index.ts` 与对应模块），确认是否涉及路由、handler、schema、migration。
- [ ] 完成开发后同步更新本文件第 3 章（SRS↔实现映射）与第 5 章（数据模型对应）。
- [ ] 执行最小验证：`npx tsc --noEmit`；若改动 DB 结构，补充 D1 migration 验证；若改动核心接口，补充 HTTP 链路验证。

### 默认优先事项 Checklist

- [ ] P1：推进 F-016/F-020 AI 辅助能力联调，完成真实模型服务接入与关键端点联调（配置 AI_API_KEY 环境变量 via `wrangler secret put AI_API_KEY`）。
- [ ] P1：执行核心链路 E2E 回归，覆盖商品列表、详情内容协商、标签精选、推荐、导入双写。
- [ ] P2：持续收敛 SRS/SDS 映射，新功能仅补映射与简要说明，不回填历史过程记录。

### AI 联调 SOP（F-016/F-020）

1. **配置 AI API Key**：`wrangler secret put AI_API_KEY`，选择 OpenAI GPT-4 或 Anthropic Claude
2. **验证 AI 服务商配置**：确保 `wrangler.toml` 中 `AI_PROVIDER` 与实际 key 对应
3. **联调测试**：对 `explain.ts` 和 `ai_content.ts` 各端点进行真实 AI 调用测试
4. **内容审核验证**：确认 AI 生成内容经 `ai_review.ts` 审核后才可上线
5. **三态升级**：AI 联调验证通过后，将 F-016/F-020 状态从 🏗 升级为 ✅
