# 重要说明
- 本文为 2026-04-09 二次复核版。
- 已删除不再适用、已被近期迭代修复或缺乏当前代码证据支持的结论。
- 仅保留“当前代码仍可复现/可验证”的问题项。

# Findora Review 报告（仅保留有效问题）

> 版本号：v3.07-revalidated  
> 修改日期：2026-04-09

---

## 一、复核范围与结论

本次针对以下代码进行了逐项复核：`src/api/index.ts`、`src/api/explain.ts`、`src/api/products.ts`、`src/api/tags.ts`、`src/api/email.ts`、`src/api/membership.ts`、`src/pages/*.html`。

结论：仍有 7 项需要继续优化，其中 P0（高优先级缺陷）2 项，P1（短期优化）5 项。

---

## 二、仍成立的问题清单（已验证）

### P0（高优先级）

1. [ ] 未修改 / [ ] 已修改 / [ ] 已review — `explain.ts` 缓存 TTL 比较存在时间格式不一致风险  
   - 现状：写入 `expires_at` 使用 `toISOString()`，读取比较使用 `expires_at > datetime('now')`。  
   - 风险：ISO8601 与 SQLite `datetime` 字符串格式混用，缓存过期判断可能失真。  
   - 位置：`src/api/explain.ts`（`getCachedExplanation` / `setCachedExplanation`）

2. [ ] 未修改 / [ ] 已修改 / [ ] 已review — `explain.ts` 的 Anthropic 响应解析仍按 OpenAI 路径取值  
   - 现状：统一解析 `result?.choices?.[0]?.message?.content`。  
   - 风险：Anthropic `messages` 接口返回结构不同，可能导致 AI 解释为空。  
   - 位置：`src/api/explain.ts`（`generateAIExplanation`）

### P1（短期优化）

3. [ ] 未修改 / [ ] 已修改 / [ ] 已review — Cron 未接入周报邮件发送任务  
   - 现状：`scheduled` 只调用 `handleScheduledPublishing`，未调用 `sendWeeklyNewsletter`。  
   - 风险：自动化运营链路不完整。  
   - 位置：`src/api/index.ts`（`scheduled`）

4. [ ] 未修改 / [ ] 已修改 / [ ] 已review — `importProducts` 缺少单批导入上限与分批机制  
   - 现状：仅校验“非空数组”，未限制批量规模。  
   - 风险：大 payload 可能触发 Worker 资源压力、D1 写入超时。  
   - 位置：`src/api/products.ts`（`importProducts`）

5. [ ] 未修改 / [ ] 已修改 / [ ] 已review — 标签/类目相关查询仍大量使用 `LIKE` 字符串匹配  
   - 现状：如 `products.tags LIKE ?`、`subscribed_categories LIKE ?`、`COUNT(*) FROM products WHERE tags LIKE ?`。  
   - 风险：通配误匹配与查询性能不稳定；语义一致性依赖字符串格式。  
   - 位置：`src/api/products.ts`、`src/api/tags.ts`、`src/api/email.ts`

6. [ ] 未修改 / [ ] 已修改 / [ ] 已review — 时间存储与查询比较策略不统一（不仅限 explain 模块）  
   - 现状：多处写入 `toISOString()`，部分查询用 `datetime('now')` 直接比较。  
   - 风险：跨模块出现时间边界偏差（有效期、窗口统计、到期判断）。  
   - 位置：`src/api/membership.ts` 及其他时间敏感模块

7. [ ] 未修改 / [ ] 已修改 / [ ] 已review — 前端仍为纯静态 HTML + 客户端拉取数据模式  
   - 现状：页面首屏主要靠前端 `fetch` 填充内容。  
   - 风险：SEO、动态 OG/Twitter 卡片能力受限；公共结构复用成本高。  
   - 位置：`src/pages/index.html` 及其他 `src/pages/*.html`

---

## 三、建议执行顺序

1. 先修复 P0（`explain.ts` 时间比较与 Anthropic 解析）。
2. 其次补齐运营闭环（Cron 周报邮件）与导入保护（批量上限/分批）。
3. 再推进一致性重构（时间策略统一、`LIKE` 语义改造）。
4. 最后做前端工程化升级（在 Cloudflare 体系内优先考虑 Pages + 支持 SSR/SSG 的方案）。
