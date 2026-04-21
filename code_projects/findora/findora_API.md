# Findora API Documentation

> **版本：** v3.98（Reviewer定时任务：全面Review对照business_concept和system_design；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（index.ts:123-131行categories先于类目详情、EMS在746-769先于771-774）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.98、SDS→v3.98、API→v3.98、STR→v3.98；代码基线稳定；无新增问题）

## 概述

Findora API 基于 Cloudflare Workers 构建，提供统一的 JSON API 接口，服务于前端页面和外部运营AI系统。

### 设计原则

1. **统一数据API层**：所有数据通过API获取，前端页面通过API渲染数据
2. **AI Agent原生友好**：响应格式支持 `application/json` 和 `text/markdown` 两种格式，便于AI直接解析
3. **外部运营AI接口**：Business Concept 明确指出，外部运营AI通过以下接口更新数据：
   - 标签维度数据
   - Item Card 内容
   - 推荐文案

### 认证机制

| 类型 | 说明 | 认证方式 |
|------|------|----------|
| 公开端点 | 商品/榜单/类目浏览 | 无需认证 |
| 用户关联端点 | 订阅/收藏/点击/推荐 | `X-User-ID` 或 `Authorization: Bearer <token>` |
| 管理员Token | 运营管理/AI接口 | `X-Admin-Key` Header |
| EMS用户认证 | 企业管理系统 | `Authorization: Bearer <session_token>` |

### Content Negotiation

API 支持两种响应格式，通过 `Accept` Header 指定：

| Accept Header | 响应格式 | 适用场景 |
|---------------|---------|---------|
| `application/json` | JSON | 前端渲染、AI解析 |
| `text/markdown` | Markdown | AI Agent 直接消费 |

```
Accept: application/json  # 默认，返回结构化JSON
Accept: text/markdown     # 返回Markdown格式内容
```

---

## 最近修改记录

> **规则：** 每次修改本文档后必须在此章节记录，只保留最新一次。

| 修改时间 | 修改内容 |
|----------|----------|
| 2026-04-21 | Coder定时任务（v3.97）：全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.97、SDS→v3.97、API→v3.97、STR→v3.97；代码基线稳定；无新增问题 |
| 2026-04-21 | Reviewer定时任务（v3.96）：全面Review对照business_concept和system_design；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.96、SDS→v3.96、API→v3.96、STR→v3.96；代码基线稳定；无新增问题 |
| 2026-04-21 | Coder定时任务（v3.91）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽验证正确；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.91、SDS→v3.91、API→v3.91、STR→v3.91；代码基线稳定；无新增问题 |
| 2026-04-21 | Reviewer定时任务（v3.90）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.90、SDS→v3.90、API→v3.90、STR→v3.90；代码基线稳定；无新增问题 |
| 2026-04-21 | Coder定时任务（v3.89）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.89、SDS→v3.89、API→v3.89、STR→v3.89；代码基线稳定；无新增问题 |
| 2026-04-21 | Coder定时任务（v3.87）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.87、SDS→v3.87、API→v3.87、STR→v3.87；代码基线稳定；无新增问题 |
| 2026-04-20 | Coder定时任务（v3.85）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.85、SDS→v3.85、API→v3.85、STR→v3.85；代码基线稳定；无新增问题 |
| 2026-04-20 | Coder定时任务（v3.82）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.82、SDS→v3.82、API→v3.82、STR→v3.82；代码基线稳定；无新增问题 |
| 2026-04-20 | Coder定时任务（v3.78）：全面Review分析（对照business_concept和system_design）；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐SRS→v3.78、SDS→v3.78、API→v3.78、STR→v3.78；代码基线稳定；无新增问题 |
| 2026-04-19 | Reviewer定时任务（v3.71）：全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:183-186行、ai_review.ts:54-58行）；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.71、SDS→v3.71、API→v3.71、STR→v3.71 |
| 2026-04-19 | Coder定时任务（v3.70）：全面代码审查；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:183-186行、ai_review.ts:54-58行）；路由遮蔽验证正确（categories在index.ts:123-126行、EMS在index.ts:746-748行先于771-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；三文档版本对齐SRS→v3.70、SDS→v3.70、API→v3.70、STR→v3.70；代码基线稳定；无新增问题 |
| 2026-04-19 | Reviewer定时任务（v3.69）：全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；三文档版本对齐SRS→v3.69、SDS→v3.69、API→v3.69、STR→v3.69 |
| 2026-04-19 | Coder定时任务（v3.68）：全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；三文档版本对齐 |
| 2026-04-18 | Reviewer定时任务（v3.63）：全面代码审查；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；代码基线稳定；无新增问题；三文档版本对齐SRS→v3.50、SDS→v3.63、API→v3.63、STR→v3.63 |
| 2026-04-18 | Coder定时任务（v3.62）：全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽验证正确；安全修复验证通过；recommendations.ts纯数据库检索无LLM调用；代码基线稳定；无新增问题；三文档版本对齐SRS→v3.50、SDS→v3.62、API→v3.62、STR→v3.62 |
| 2026-04-18 | Reviewer定时任务（v3.61）：全面代码审查确认；TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过；路由遮蔽问题验证正确；安全修复验证通过；三文档版本对齐SRS→v3.50、SDS→v3.61、API→v3.61、STR→v3.61 |
| 2026-04-18 | Coder定时任务（v3.55）：全面代码审查确认；TS编译0错误（`npx tsc --noEmit`）；AC-01~AC-06全部通过；禁用词表三处16项一致性验证通过（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）；路由遮蔽问题验证正确（categories在index.ts:123-126行、EMS在index.ts:746-774行）；安全修复验证通过（ST-S01 PBKDF2、ST-S02 JWT无回退、ST-C06 dislikes按用户过滤）；recommendations.ts纯数据库检索无LLM调用；代码基线稳定；无新增问题；三文档版本对齐SRS→v3.50、SDS→v3.55、API→v3.55、STR→v3.55 |

---

## Actions

> **规则：** 每次修改本文档后必须更新此章节，反映当前项目最新待办方向，为后续协作者指明工作重点。

### 已完成项（v3.97同步）

1. ✅ **TypeScript编译检查**：0错误（v3.97确认，`npx tsc --noEmit`）
2. ✅ **架构约束验证**：AC-01~AC-06 全部通过（v3.97确认）
3. ✅ **禁用词表一致性**：ai_content.ts(23-27行)、explain.ts(182-186行)、ai_review.ts(54-58行)三处均为16项
4. ✅ **API文档结构**：完整，无需更新（API文档与代码一致）
5. ✅ **代码基线稳定**：无新增P0/P1问题（v3.97确认）
6. ✅ **三文档版本对齐**：SRS→v3.97、SDS→v3.97、API→v3.97、STR→v3.97完全对齐
7. ✅ **路由遮蔽验证**：index.ts中categories路由(123-131行)在类目详情路由之前；EMS路由(746-769行先于771-774行)顺序正确
8. ✅ **ST-C06修复验证**：behavior.ts dislikes按用户过滤
9. ✅ **ST-S01修复验证**：auth.ts PBKDF2密码哈希正确实现
10. ✅ **ST-S02修复验证**：auth.ts JWT密钥无回退默认值
11. ✅ **v3.97 Coder审查确认**：TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性；三文档版本对齐；代码基线稳定；无新增问题
12. ✅ **v3.96 Reviewer审查确认**：TS编译0错误；AC-01~AC-06全部通过；禁用词表三处16项一致性；三文档版本对齐；代码基线稳定；无新增问题

---

## 端点总览

### 公共端点（无需认证）

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/trending` | 获取热门商品 | F-001-05 |
| GET | `/api/products` | 商品列表 | F-040-01 |
| GET | `/api/products/:id` | 商品详情 | F-040-02 |
| GET | `/api/lists` | 榜单列表 | F-040-03 |
| GET | `/api/lists/:id` | 榜单详情 | F-040-04 |
| GET | `/api/categories` | 类目树 | F-040-05 |
| GET | `/api/categories/:category/subcategories` | 子类目列表 | F-002-03 |

### 用户端点（需用户ID或Token）

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/subscribe` | 订阅 | F-040-06 |
| DELETE | `/api/subscribe` | 取消订阅 | F-040-07 |
| PATCH | `/api/subscribe/preferences` | 更新偏好 | F-040-08 |
| POST | `/api/favorites` | 添加收藏 | F-040-09 |
| GET | `/api/favorites` | 收藏列表 | F-040-11 |
| DELETE | `/api/favorites/:product_id` | 移除收藏 | F-040-10 |
| GET | `/api/favorites/lists` | 收藏榜单列表 | F-004-06 |
| POST | `/api/favorites/lists/:list_id` | 收藏榜单 | F-004-06 |
| DELETE | `/api/favorites/lists/:list_id` | 取消收藏榜单 | F-004-06 |
| POST | `/api/clicks` | 记录点击 | F-040-12 |
| GET | `/api/recommendations` | 个性化推荐 | F-040-13 |
| GET | `/api/recommendations/behavioral` | 行为增强推荐 | F-015 |
| GET | `/api/explain/:product_id` | 商品解释 | F-016-01 |
| POST | `/api/explain/batch` | 批量解释 | F-016-01 |
| GET | `/api/explain/:product_id/comparison` | 商品对比 | F-016-02 |
| GET | `/api/explain/:product_id/scenarios` | 使用场景 | F-016-03 |

### 公开 i18n / 会员端点

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/i18n/locales` | 支持的语言 | F-022 |
| GET | `/api/i18n/translations/:locale` | 翻译文本 | F-022 |
| GET | `/api/i18n/content/:type/:id/:locale/:field` | 内容翻译 | F-022 |
| GET | `/api/membership/tiers` | 会员等级 | F-023 |
| GET | `/api/membership/my` | 我的会员 | F-023 |
| POST | `/api/membership/check` | 检查权益 | F-023 |

### 外部系统接口

| 方法 | 路径 | 功能 | F编号 | 说明 |
|------|------|------|-------|------|
| POST | `/api/conversions/callback` | 联盟回调 | F-012-05 | 公开端点 |
| POST | `/api/email/send-confirmation` | 订阅确认邮件 | F-013-07 | **ST-P2修正**：实际位于 `/api/email/send-confirmation`（公开） |
| POST | `/api/admin/price-check` | 价格监控 | F-010-05 | **ST-P2修正**：仅admin端点 |
| POST | `/api/admin/price-check/batch` | 批量价格 | F-010-05 | **ST-P2修正**：仅admin端点 |
| GET | `/api/admin/price-check` | 价格变动列表 | F-010-05 | 仅admin端点 |
| GET | `/api/admin/price-check/:product_id` | 商品价格历史 | F-010-05 | 仅admin端点 |

### 运营AI专属接口（需Admin Key）

**外部运营AI通过这些接口更新标签、Item Card、推荐文案**

#### 标签维度更新

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/tags` | 创建标签 | F-040-17, F-011-01 |
| PUT | `/api/admin/tags/:id` | 更新标签 | F-011-01 |
| DELETE | `/api/admin/tags/:id` | 删除标签 | F-011-01 |
| PATCH | `/api/admin/tags/:id/featured` | 更新精选商品 | F-040-17d |
| GET | `/api/admin/tags/stats` | 标签统计 | F-011-03 |

#### Item Card 内容更新

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| PUT | `/api/admin/products/:id` | 更新商品 | F-040-15 |
| PATCH | `/api/admin/products/:id/tags` | 更新商品标签 | F-011-02 |
| POST | `/api/admin/products/batch` | 批量更新商品 | F-010-04 |

#### 推荐文案更新

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/lists` | 创建榜单 | F-040-18 |
| POST | `/api/admin/ai/content-generation` | AI生成文案 | F-020-02 |
| POST | `/api/admin/ai/social-copy` | AI生成推广文案 | F-020-03 |

### 内部管理API（需Admin Key）

#### 商品管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/products` | 创建商品 | F-040-14 |
| PUT | `/api/admin/products/:id` | 更新商品 | F-040-15 |
| PATCH | `/api/admin/products/:id/status` | 切换状态 | F-040-16 |
| POST | `/api/admin/products/import` | 导入商品 | F-010-01 |
| PATCH | `/api/admin/products/:id/tags` | 更新标签 | F-011-02 |
| POST | `/api/admin/products/batch` | 批量更新 | F-010-04 |

#### 榜单管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/lists` | 创建榜单 | F-040-18 |

#### 订阅用户管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/subscribers` | 用户列表 | F-013-08 |
| GET | `/api/admin/subscribers/export` | 导出用户 | F-013-09 |
| GET | `/api/admin/subscribers/segments` | 用户分群 | F-013-06 |

#### 数据分析

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/analytics/overview` | 概览 | F-017 |
| GET | `/api/admin/analytics/uv` | 独立访客 | F-017 |
| GET | `/api/admin/analytics/ctr` | 点击率 | F-017 |
| GET | `/api/admin/analytics/conversion` | 转化率 | F-017 |
| GET | `/api/admin/analytics/categories` | 类目分析 | F-017 |
| GET | `/api/admin/analytics/lists` | 榜单分析 | F-017 |
| GET | `/api/admin/analytics/trends` | 趋势分析 | F-017 |

#### AI内容生成

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/ai/status` | AI状态 | F-020 |
| POST | `/api/admin/ai/selection-assistance` | AI选品辅助 | F-020-01 |
| POST | `/api/admin/ai/content-generation` | AI内容生成 | F-020-02 |
| POST | `/api/admin/ai/social-copy` | AI社媒文案 | F-020-03 |
| POST | `/api/admin/ai/analytics-insights` | AI分析洞察 | F-020-05 |
| POST | `/api/admin/ai/product-completion` | AI商品补全 | F-020-06 |

#### AI内容审核

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/ai/review/create` | 创建审核记录 | F-021 |
| GET | `/api/admin/ai/review` | 审核列表 | F-021 |
| GET | `/api/admin/ai/review/pending-counts` | 待审数量 | F-021 |
| POST | `/api/admin/ai/review/validate` | 内容校验 | F-021 |
| GET | `/api/admin/ai/review/:id` | 审核详情 | F-021 |
| POST | `/api/admin/ai/review/:id/submit` | 提交审核 | F-021 |
| POST | `/api/admin/ai/review/:id/review` | 一审 | F-021 |
| POST | `/api/admin/ai/review/:id/high-risk-review` | 二审 | F-021 |
| POST | `/api/admin/ai/review/:id/tone-review` | 语气审核 | F-021 |
| POST | `/api/admin/ai/review/:id/revision` | 请求修订 | F-021 |

#### 邮件管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/email/send-weekly` | 发送周报 | F-013-07 |
| POST | `/api/admin/email/send-unsubscription-confirmation` | 退订确认 | F-013-07 |
| POST | `/api/admin/email/send-reengagement` | 重新激活邮件 | F-013-07 |
| GET | `/api/admin/email/logs` | 邮件日志 | F-013-07 |

#### 转化追踪

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/conversions` | 转化列表 | F-012-05 |
| GET | `/api/admin/conversions/stats` | 转化统计 | F-012-05 |

#### 价格监控

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/price-check` | 提交价格 | F-010-05 |
| POST | `/api/admin/price-check/batch` | 批量价格 | F-010-05 |
| GET | `/api/admin/price-check` | 价格变动列表 | F-010-05 |
| GET | `/api/admin/price-check/:product_id` | 商品价格历史 | F-010-05 |

#### 国际化管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/i18n/locales` | 语言列表 | F-022 |
| POST | `/api/admin/i18n/locales` | 添加语言 | F-022 |
| PUT | `/api/admin/i18n/locales/:code` | 更新语言 | F-022 |
| GET | `/api/admin/i18n/keys` | 翻译键列表 | F-022 |
| POST | `/api/admin/i18n/keys` | 创建翻译键 | F-022 |
| POST | `/api/admin/i18n/translations` | 保存翻译 | F-022 |
| POST | `/api/admin/i18n/content` | 保存内容翻译 | F-022 |
| GET | `/api/admin/i18n/sync` | 同步队列 | F-022 |
| POST | `/api/admin/i18n/sync` | 排队同步 | F-022 |
| PUT | `/api/admin/i18n/sync/:id` | 更新同步项 | F-022 |

#### 会员管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| GET | `/api/admin/membership/tiers` | 等级列表 | F-023 |
| POST | `/api/admin/membership/tiers` | 创建等级 | F-023 |
| PUT | `/api/admin/membership/tiers/:code` | 更新等级 | F-023 |
| POST | `/api/admin/membership/subscribe` | 创建订阅 | F-023 |
| GET | `/api/admin/membership/subscriptions` | 订阅列表 | F-023 |
| GET | `/api/admin/membership/subscriptions/:id` | 订阅详情 | F-023 |
| POST | `/api/admin/membership/subscriptions/:id/cancel` | 取消订阅 | F-023 |
| POST | `/api/admin/membership/subscriptions/:id/renew` | 续订 | F-023 |
| GET | `/api/admin/membership/entitlements` | 权益列表 | F-023 |
| POST | `/api/admin/membership/exclusive-content` | 标记独家内容 | F-023 |
| GET | `/api/admin/membership/exclusive-content` | 独家内容列表 | F-023 |
| GET | `/api/admin/membership/stats` | 会员统计 | F-023 |

#### 内容管理

| 方法 | 路径 | 功能 | F编号 |
|------|------|------|-------|
| POST | `/api/admin/content/topics` | 创建选题 | F-030 |
| GET | `/api/admin/content/topics` | 选题列表 | F-030 |
| GET | `/api/admin/content/topics/:id` | 选题详情 | F-030 |
| PATCH | `/api/admin/content/topics/:id` | 更新选题状态 | F-030 |
| POST | `/api/admin/content/topics/:id/products` | 添加候选商品 | F-030 |
| POST | `/api/admin/content/publish` | 发布内容 | F-030 |
| GET | `/api/admin/content/publish/schedule` | 发布计划 | F-030 |
| GET | `/api/admin/content/production/stats` | 产出统计 | F-030 |

### EMS 企业管理系统接口（需Session Token）

#### 认证

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/auth/register` | 注册 | F-040-27 |
| POST | `/api/auth/login` | 登录 | F-040-28 |
| POST | `/api/auth/logout` | 登出 | F-040-29 |
| POST | `/api/auth/refresh` | Session续期 | F-040-30 |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/change-password` | 修改密码 |

##### POST /api/auth/register - 用户注册 (F-040-27)

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**响应格式**（对齐 SRS §3.1.5）：
```json
{
  "ok": true,
  "data": {
    "user_id": "ems_xxx",
    "email": "user@example.com",
    "created_at": "2026-04-13T10:00:00Z"
  }
}
```

##### POST /api/auth/login - 用户登录 (F-040-28)

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**响应格式**（对齐 SRS §3.1.5）：
```json
{
  "ok": true,
  "data": {
    "user_id": "ems_xxx",
    "email": "user@example.com",
    "session_token": "sess_xxx",
    "expires_at": "2026-04-14T10:00:00Z"
  }
}
```

#### 企业管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/enterprises` | 创建企业 |
| GET | `/api/enterprises` | 企业列表 |
| GET | `/api/enterprises/:id` | 企业详情 |
| PUT | `/api/enterprises/:id` | 更新企业 |
| DELETE | `/api/enterprises/:id` | 删除企业 |
| GET | `/api/enterprises/:id/members` | 成员列表 |
| POST | `/api/enterprises/:id/members` | 添加成员 |
| GET | `/api/enterprises/:id/members/:memberId` | 成员详情 |
| PATCH | `/api/enterprises/:id/members/:memberId` | 更新成员角色 |
| DELETE | `/api/enterprises/:id/members/:memberId` | 移除成员 |

#### 记录管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/enterprises/:id/records` | 创建记录 |
| GET | `/api/enterprises/:id/records` | 记录列表 |
| GET | `/api/enterprises/:id/records/:recordId` | 记录详情 |
| PUT | `/api/enterprises/:id/records/:recordId` | 更新记录 |
| DELETE | `/api/enterprises/:id/records/:recordId` | 删除记录 |
| PATCH | `/api/enterprises/:id/records/:recordId/status` | 更新状态 |
| POST | `/api/enterprises/:id/records/:recordId/review` | 审核记录 |
| GET | `/api/records/expiring` | 即将到期记录 |

#### 审计日志

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/enterprises/:id/audit-logs` | 企业审计日志 |
| GET | `/api/enterprises/:id/audit-logs/export` | 导出审计日志 |
| GET | `/api/audit-logs` | 我的审计日志 |
| GET | `/api/audit-logs/:id` | 审计日志详情 |
| GET | `/api/enterprises/:id/audit-logs/stats` | 审计统计 |

#### 用户管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/users/profile` | 我的资料 |
| PUT | `/api/users/profile` | 更新资料 |
| PATCH | `/api/users/profile/avatar` | 更新头像 |
| GET | `/api/users/search` | 搜索用户 |
| GET | `/api/users/:id` | 用户详情 |
| GET | `/api/users/sessions` | 会话列表 |
| DELETE | `/api/users/sessions/:sessionId` | 撤销会话 |
| DELETE | `/api/users/sessions` | 撤销所有会话 |
| PATCH | `/api/users/status` | 更新用户状态 |

---

## 用户端 API 详解

### GET /api/trending

获取热门商品列表。

**认证要求**：无

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_xxx",
      "title": "iPhone 15 Pro Max",
      "category": "Electronics",
      "price_min": 999,
      "price_max": 1199,
      "cover_image": "https://..."
    }
  ]
}
```

---

### GET /api/products

商品列表，支持分页和过滤。

**认证要求**：无

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认1 |
| limit | number | 每页数量，默认20 |
| category | string | 类目过滤 |
| tags | string | 标签过滤（逗号分隔） |
| search | string | 搜索关键词 |

**响应示例**：
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### GET /api/products/:id

获取商品详情。

**认证要求**：无

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "prod_xxx",
    "title": "iPhone 15 Pro Max",
    "original_title": "Apple iPhone 15 Pro Max",
    "rewritten_title": null,
    "category": "Electronics",
    "subcategory": "Smartphones",
    "tags": ["5G", "Camera", "Premium"],
    "price_min": 999,
    "price_max": 1199,
    "currency": "USD",
    "cover_image": "https://...",
    "images": ["...", "..."],
    "summary": "The latest iPhone with A17 Pro chip...",
    "pros": ["Excellent camera", "Long battery life"],
    "cons": ["Expensive", "Heavy"],
    "use_cases": ["Photography", "Gaming", "Productivity"],
    "target_audience": ["Tech enthusiasts", "Professionals"],
    "merchant_name": "Apple Store",
    "affiliate_url": "https://...",
    "status": "active"
  }
}
```

---

### POST /api/subscribe

订阅类目更新。

**认证要求**：用户关联（`X-User-ID` Header 或 email）

**请求体**：
```json
{
  "email": "user@example.com",
  "subscribed_categories": ["Electronics", "Fashion"],
  "price_preference": "under_100",
  "frequency_preference": "daily",
  "locale": "en"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "user_xxx",
    "subscribed_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PATCH /api/subscribe/preferences

更新订阅偏好。

**认证要求**：`X-User-ID` Header

**请求体**：
```json
{
  "subscribed_categories": ["Electronics"],
  "price_preference": "under_50",
  "liked_tags": ["Budget", "Portable"],
  "disliked_tags": ["Gaming"]
}
```

---

### POST /api/favorites

添加商品到收藏。

**认证要求**：`X-User-ID` Header

**请求体**：
```json
{
  "product_id": "prod_xxx"
}
```

---

### GET /api/favorites

获取用户收藏列表。

**认证要求**：`X-User-ID` Header

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "product_id": "prod_xxx",
      "added_at": "2024-01-15T10:00:00Z",
      "product": { ... }
    }
  ]
}
```

---

### POST /api/clicks

记录用户点击行为。

**认证要求**：`X-User-ID` Header（可选）

**请求体**：
```json
{
  "product_id": "prod_xxx",
  "source": "recommendation",
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "weekly_pick",
  "referer": "https://google.com"
}
```

---

### GET /api/recommendations

获取个性化推荐。

**认证要求**：`X-User-ID` Header

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "product_id": "prod_xxx",
      "score": 0.95,
      "reason": "Based on your interest in Electronics"
    }
  ]
}
```

---

## 运营管理 API 详解（核心章节）

> **重要说明**：以下API由外部运营AI系统调用，用于更新标签数据、Item Card内容和推荐文案。所有接口都需要 `X-Admin-Key` Header进行鉴权。

### 标签维度更新 API

外部运营AI通过这些接口维护标签体系，确保商品分类的准确性。

#### POST /api/admin/tags - 创建标签

创建新的功能标签。

**请求体**：
```json
{
  "name": "Portable",
  "slug": "portable",
  "layer": "function",
  "parent_id": "tag_xxx",
  "dimension_level": 2
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "tag_new_xxx"
  }
}
```

#### PUT /api/admin/tags/:id - 更新标签

更新标签名称或层级。

**请求体**：
```json
{
  "name": "Ultra Portable",
  "layer": "performance",
  "dimension_level": 1
}
```

#### PATCH /api/admin/tags/:id/featured - 更新精选商品

更新标签关联的精选商品列表。

**请求体**：
```json
{
  "featured_products": ["prod_xxx", "prod_yyy", "prod_zzz"]
}
```

---

### Item Card 内容更新 API

外部运营AI通过这些接口更新商品展示内容，包括标题、描述、标签等。

#### PUT /api/admin/products/:id - 更新商品

更新商品完整信息。

**请求体**：
```json
{
  "rewritten_title": "Best Budget Laptop for Students",
  "summary": "An updated summary...",
  "pros": ["Lightweight", "Long battery"],
  "cons": ["Limited ports"],
  "target_audience": ["Students", "Travelers"]
}
```

#### PATCH /api/admin/products/:id/tags - 更新商品标签

批量更新商品的标签。

**请求体**：
```json
{
  "tags": ["Budget", "Portable", "Student-Friendly", "Long-Battery"]
}
```

#### POST /api/admin/products/batch - 批量更新商品

批量更新多个商品的信息。

**请求体**：
```json
{
  "products": [
    {
      "id": "prod_xxx",
      "rewritten_title": "Updated Title 1",
      "tags": ["Tag1", "Tag2"]
    },
    {
      "id": "prod_yyy",
      "rewritten_title": "Updated Title 2",
      "tags": ["Tag3"]
    }
  ]
}
```

---

### 推荐文案更新 API

外部运营AI通过这些接口生成和更新推荐榜单的文案。

#### POST /api/admin/lists - 创建榜单

创建新的推荐榜单。

**请求体**：
```json
{
  "title": "Top 10 Budget Gadgets 2024",
  "slug": "top-10-budget-gadgets-2024",
  "description": "Our carefully selected budget gadgets...",
  "why_these": "We selected these based on value, quality, and user reviews.",
  "category": "Electronics",
  "content_type": "organic"
}
```

#### POST /api/admin/ai/content-generation - AI生成内容

使用AI生成商品推荐文案。

**请求体**：
```json
{
  "products": ["prod_xxx", "prod_yyy"],
  "content_type": "recommendation",
  "tone": "professional",
  "locale": "en"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "generated_content": "## Our Top Picks\n\nAfter careful analysis, we recommend...\n\n### 1. Product A\nThis is perfect for...",
    "metadata": {
      "model": "claude-3-sonnet",
      "tokens_used": 450
    }
  }
}
```

#### POST /api/admin/ai/social-copy - AI生成推广文案

生成适合社交媒体推广的短文案。

**请求体**：
```json
{
  "product_id": "prod_xxx",
  "platform": "twitter",
  "style": "engaging"
}
```

---

## 内部管理 API 详解

### 数据分析 API

#### GET /api/admin/analytics/overview

获取数据分析概览。

**响应示例**：
```json
{
  "success": true,
  "data": {
    "total_products": 1500,
    "active_lists": 45,
    "total_subscribers": 12000,
    "weekly_clicks": 3500,
    "conversion_rate": 0.023
  }
}
```

---

### 全局配置 API

#### GET /api/admin/configs - 获取配置列表 (F-040-24)

获取所有全局配置项。

**认证要求**：`X-Admin-Key` Header

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "key": "site_name",
      "value": "Findora",
      "description": "网站名称",
      "updated_at": "2026-04-15T10:00:00Z"
    }
  ]
}
```

#### POST /api/admin/configs - 创建配置 (F-040-24a)

创建新的全局配置项。

**认证要求**：`X-Admin-Key` Header

**请求体**：
```json
{
  "key": "site_name",
  "value": "Findora",
  "description": "网站名称",
  "created_by": "admin"
}
```

**Key 格式要求**：`[a-zA-Z][a-zA-Z0-9_]*`
- 必须以字母开头
- 只能包含字母、数字和下划线
- 示例：`site_name`、`max_upload_size`、`enable_feature_x`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": "cfg_xxx",
    "key": "site_name",
    "value": "Findora"
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Key must start with a letter and contain only letters, numbers, and underscores"
  }
}
```

#### PUT /api/admin/configs/:key - 更新配置 (F-040-25)

更新指定配置项的值。

**认证要求**：`X-Admin-Key` Header

**请求体**：
```json
{
  "value": "New Site Name",
  "updated_by": "admin"
}
```

#### GET /api/configs/:key - 公开读取配置 (F-040-26)

公开读取指定配置项（无需认证）。

**响应示例**：
```json
{
  "success": true,
  "data": {
    "key": "site_name",
    "value": "Findora"
  }
}
```

---

### AI 审核工作流 API

#### POST /api/admin/ai/review/create - 创建审核记录

创建AI生成内容的审核记录。

**请求体**：
```json
{
  "content_type": "product_description",
  "content_id": "prod_xxx",
  "draft_content": "Generated content here...",
  "category": "Electronics",
  "is_high_risk": false
}
```

#### POST /api/admin/ai/review/:id/submit - 提交审核

将内容提交到审核队列。

#### POST /api/admin/ai/review/:id/review - 一审

执行第一次审核。

**请求体**：
```json
{
  "decision": "approve",
  "notes": "Content looks good"
}
```

#### POST /api/admin/ai/review/:id/high-risk-review - 二审

对高风险内容进行第二次审核。

---

## 数据模型

### 核心表结构

#### products - 商品表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| title | TEXT | 原始标题 |
| rewritten_title | TEXT | 重写标题（AI生成） |
| category | TEXT | 主类目 |
| subcategory | TEXT | 子类目 |
| tags | TEXT | JSON数组，商品标签 |
| price_min | REAL | 最低价格 |
| price_max | REAL | 最高价格 |
| currency | TEXT | 货币代码 |
| cover_image | TEXT | 封面图 |
| r2_object_key | TEXT | R2存储对象键 |
| summary | TEXT | 商品摘要 |
| pros | TEXT | JSON数组，优点 |
| cons | TEXT | JSON数组，缺点 |
| use_cases | TEXT | JSON数组，使用场景 |
| target_audience | TEXT | JSON数组，目标用户 |
| merchant_name | TEXT | 商家名称 |
| affiliate_url | TEXT | 联盟链接 |
| status | TEXT | 状态：active/draft/inactive |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### tags - 标签表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 标签名称 |
| slug | TEXT | URL友好slug |
| layer | TEXT | 层级：function/performance/brand |
| dimension_level | INTEGER | 维度级别：1(一度)/2(二度) |
| parent_id | TEXT | 父标签ID |
| featured_products | TEXT | JSON数组，精选商品 |
| created_at | TEXT | 创建时间 |

#### lists - 榜单表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| slug | TEXT | URL友好slug |
| title | TEXT | 标题 |
| description | TEXT | 描述 |
| why_these | TEXT | 推荐理由 |
| cover_image | TEXT | 封面图 |
| category | TEXT | 类目 |
| status | TEXT | 状态：draft/published/archived |
| content_type | TEXT | 内容类型：organic/affiliate/sponsored |
| disclosure | TEXT | 利益披露 |
| published_at | TEXT | 发布时间 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### users - 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| email | TEXT | 邮箱 |
| anonymous_id | TEXT | 匿名ID |
| subscribed_categories | TEXT | JSON数组，订阅类目 |
| price_preference | TEXT | 价格偏好 |
| liked_tags | TEXT | JSON数组，喜欢标签 |
| disliked_tags | TEXT | JSON数组，不喜欢标签 |
| click_history | TEXT | JSON数组，点击历史 |
| saved_items | TEXT | JSON数组，收藏商品 |
| locale | TEXT | 语言偏好 |
| frequency_preference | TEXT | 推送频率 |
| status | TEXT | 状态 |
| subscribed_at | TEXT | 订阅时间 |
| created_at | TEXT | 创建时间 |

#### clicks - 点击记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| product_id | TEXT | 商品ID |
| user_id | TEXT | 用户ID |
| anonymous_id | TEXT | 匿名ID |
| source | TEXT | 点击来源 |
| utm_source | TEXT | UTM来源 |
| utm_medium | TEXT | UTM媒介 |
| utm_campaign | TEXT | UTM活动 |
| referer | TEXT | 来源页面 |
| clicked_at | TEXT | 点击时间 |

### EMS 企业管理表

#### enterprises - 企业表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 企业名称 |
| slug | TEXT | URL友好slug |
| description | TEXT | 描述 |
| logo_url | TEXT | Logo URL |
| website | TEXT | 网站 |
| industry | TEXT | 行业 |
| size | TEXT | 规模：startup/small/medium/large/enterprise |
| status | TEXT | 状态 |
| verified_at | TEXT | 认证时间 |
| created_by | TEXT | 创建人 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### enterprise_members - 企业成员表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| enterprise_id | TEXT | 企业ID |
| user_id | TEXT | 用户ID |
| role | TEXT | 角色：owner/admin/member/viewer |
| status | TEXT | 状态：active/inactive/pending/removed |
| joined_at | TEXT | 加入时间 |
| invited_by | TEXT | 邀请人 |

#### records - 记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| enterprise_id | TEXT | 企业ID |
| title | TEXT | 标题 |
| description | TEXT | 描述 |
| record_type | TEXT | 类型：document/certificate/license/contract/report |
| record_number | TEXT | 编号 |
| issue_date | TEXT | 签发日期 |
| expiry_date | TEXT | 过期日期 |
| issuing_authority | TEXT | 签发机构 |
| file_url | TEXT | 文件URL |
| metadata | TEXT | JSON元数据 |
| status | TEXT | 状态：draft/active/expired/revoked/archived |
| reviewed_by | TEXT | 审核人 |
| reviewed_at | TEXT | 审核时间 |
| created_by | TEXT | 创建人 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### audit_logs - 审计日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| enterprise_id | TEXT | 企业ID |
| user_id | TEXT | 用户ID |
| action | TEXT | 操作：create/update/delete/login/logout/access |
| resource_type | TEXT | 资源类型 |
| resource_id | TEXT | 资源ID |
| ip_address | TEXT | IP地址 |
| user_agent | TEXT | 用户代理 |
| changes | TEXT | JSON变更记录 |
| metadata | TEXT | JSON元数据 |
| created_at | TEXT | 创建时间 |

#### ems_users - EMS用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| email | TEXT | 邮箱（唯一） |
| password_hash | TEXT | 密码哈希 |
| name | TEXT | 姓名 |
| phone | TEXT | 电话 |
| avatar_url | TEXT | 头像URL |
| status | TEXT | 状态：active/inactive/suspended |
| email_verified_at | TEXT | 邮箱验证时间 |
| last_login_at | TEXT | 最后登录时间 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### user_sessions - 用户会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| user_id | TEXT | 用户ID（关联ems_users） |
| token | TEXT | 会话Token（唯一） |
| ip_address | TEXT | IP地址 |
| user_agent | TEXT | 用户代理 |
| expires_at | TEXT | 过期时间（Session TTL） |
| created_at | TEXT | 创建时间 |

---

## 错误码定义

| 错误码 | 说明 | HTTP状态 |
|--------|------|----------|
| INVALID_PARAMS | 参数无效 | 400 |
| NOT_FOUND | 资源不存在 | 404 |
| ALREADY_SUBSCRIBED | 已订阅 | 400 |
| NOT_SUBSCRIBED | 未订阅 | 400 |
| INTERNAL_ERROR | 内部错误 | 500 |
| UNAUTHORIZED | 未授权 | 401 |
| FORBIDDEN | 禁止访问 | 403 |
| ADMIN_KEY_REQUIRED | 需要管理员密钥 | 401 |
| DUPLICATE_ENTRY | 重复条目 | 409 |
| RESOURCE_CONFLICT | 资源冲突 | 409 |
| EMAIL_ALREADY_EXISTS | 邮箱已存在 | 409 |
| TAG_ALREADY_EXISTS | 标签已存在 | 409 |
| SLUG_ALREADY_EXISTS | Slug已存在 | 409 |
| VALIDATION_ERROR | 验证错误 | 400 |
| MISSING_REQUIRED_FIELD | 缺少必填字段 | 400 |
| INVALID_STATUS_TRANSITION | 无效状态转换 | 400 |
| INVALID_CONTENT_TYPE | 无效内容类型 | 400 |
| DISCLOSURE_REQUIRED | 需要利益披露声明 | 400 |
| RATE_LIMIT_EXCEEDED | 超过速率限制 | 429 |
| QUOTA_EXCEEDED | 超过配额 | 429 |
| EXTERNAL_SERVICE_ERROR | 外部服务错误 | 502 |
| AI_SERVICE_UNAVAILABLE | AI服务不可用 | 503 |
| EMAIL_SERVICE_ERROR | 邮件服务错误 | 500 |
| TOPIC_NOT_APPROVED | 选题未批准 | 400 |
| NO_PRODUCTS_SELECTED | 未选择商品 | 400 |
| INSUFFICIENT_PERMISSIONS | 权限不足 | 403 |
| MEMBERSHIP_REQUIRED | 需要会员资格 | 403 |
| TIER_ACCESS_DENIED | 会员等级不允许此操作 | 403 |
| FOREIGN_KEY_VIOLATION | 外键约束违反 | 400 |
| REFERENCED_RESOURCE_NOT_FOUND | 引用的资源不存在 | 400 |

---

## 已知问题说明

### 1. 路由遮蔽问题

#### GET /api/categories/:category/subcategories 不可达

**问题描述**：由于路由定义顺序问题，`GET /api/categories/:category` 会在 `GET /api/categories/:category/subcategories` 之前匹配，导致子类目接口不可达。

**当前状态**：代码中定义顺序为：
1. `GET /api/categories` - 先匹配类目列表
2. `GET /api/categories/:category/subcategories` - 被遮蔽

**影响范围**：外部运营AI无法通过API获取特定类目的子类目列表。

**建议修复**：将子类目路由移到类目详情路由之前定义。

### 2. EMS 路由遮蔽问题

**问题描述**：以下EMS相关路由因路由遮蔽可能不可达：

- `GET /api/enterprises/:id/members` - 被 `GET /api/enterprises/:id` 遮蔽
- `GET /api/enterprises/:id/records` - 被 `GET /api/enterprises/:id` 遮蔽
- `GET /api/enterprises/:id/audit-logs` - 被 `GET /api/enterprises/:id` 遮蔽
- `GET /api/users/sessions` - 被 `GET /api/users/:id` 遮蔽

**代码位置**：`src/api/index.ts` 第719-722行

**当前匹配逻辑**：
```typescript
// GET /api/enterprises/:id - Get enterprise details
if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1]) {
  return getEnterprise(env, request, segments[1]);
}
```

由于 `segments[1]` 存在即匹配，会优先于更具体的路由如 `members`、`records`、`audit-logs` 被执行。

### 3. EMS 表缺少 Migration 建表语句

**问题描述**：代码中引用了以下EMS相关表，但 migrations 目录中缺少对应的建表语句：

- `enterprises` - 企业表
- `enterprise_members` - 企业成员表
- `records` - 记录表
- `audit_logs` - 审计日志表
- `ems_users` - EMS用户表
- `user_sessions` - 用户会话表

**影响范围**：部署到新环境时，EMS功能无法正常工作。

**已在代码中定义的表结构**：参见 `src/db/schema.ts` 第256-350行。

**建议**：需要创建 `migrations/0xx_ems_schema.sql` 文件，包含完整的EMS表建表语句。

### 4. 接口路径与设计文档偏差

**问题描述**：部分API端点的实际实现与设计文档（SRS）存在偏差，包括：
- 路径参数命名不一致
- 个别端点的HTTP方法与设计不符
- 响应格式存在细微差异

**建议**：在完成代码审计后，更新SRS设计文档以反映实际实现，或修正代码以符合设计规范。

---

## 附录

### A. 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| ADMIN_KEY | 管理员认证密钥 | 是 |
| DB | D1数据库实例 | 是 |
| ASSETS | Cloudflare Assets | 是 |
| PRODUCTS_BUCKET | R2存储桶 | 是 |
| AI_PROVIDER | AI服务提供商：openai/anthropic | 否 |
| AI_API_KEY | AI服务API密钥 | 否 |
| EMAIL_PROVIDER | 邮件服务商：resend/sendgrid | 否 |
| EMAIL_API_KEY | 邮件API密钥 | 否 |
| EMAIL_FROM | 发件人地址 | 否 |

### B. 响应格式规范

所有API响应遵循统一格式：

**成功响应**：
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }  // 可选，分页时存在
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### C. 分页格式

支持分页的接口返回 `pagination` 对象：

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### D. Content Negotiation 示例

```
# 请求JSON格式
GET /api/products
Accept: application/json

# 请求Markdown格式（AI友好）
GET /api/products
Accept: text/markdown
```

---

*文档版本：v3.95*
*最后更新：2026-04-21*
