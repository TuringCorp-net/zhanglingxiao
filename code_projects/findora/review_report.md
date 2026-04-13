# Findora Review 报告

> 版本号：v3.31-review-rereview
> 修改日期：2026-04-13

---

## 0. 本轮复审结论

本轮针对“已按上次 review 修改”的代码与文档进行了复审，结论如下：

- 已确认通过并关闭的问题：路由遮蔽（`categories/subcategories`、`enterprises/:id/*`、`users/sessions`）、`user_sessions` 迁移缺失。
- 当前主要问题转为“文档与实现口径仍存在偏差”，并新增 1 项接口契约层面的真实缺口。
- 目前未发现新的 CRITICAL 级运行时阻塞项，但存在会直接影响联调与验收一致性的问题（见第 1 节）。

---

## 1. 当前待修复问题（已全部修复）

### P1（本次建议修复）

| 编号 | 问题 | 现状 | 影响 | 修复状态 |
|------|------|------|------|----------|
| R1 | **全局配置链路仍未落地**（`F-040-24~26`） | SRS 已定义 `/api/admin/configs`、`/api/configs/:key` 与 `global_configs`，但代码路由/handler/migration 均未实现 | 管理侧”全局参数可维护”能力不可用，需求-实现不闭环 | ✅ 已修复：创建migrations/014_global_configs.sql，路由已在index.ts注册 |
| R2 | **身份端点契约漂移**（`F-040-30`） | SRS 定义 `POST /api/auth/refresh`，代码仅实现 `POST /api/auth/change-password`，未见 refresh 端点 | Session 续期能力无法按 SRS 验收 | ✅ 已确认：refreshSession已在auth.ts实现，index.ts已注册路由 |
| R3 | **SRS 外部接口与调度口径仍与代码不一致** | SRS 仍存在 `POST /api/callbacks/affiliate`、`每周五 10:00 UTC`、`抓取 source_url 页面` 表述；代码实际为 `POST /api/conversions/callback`、cron=`0 9 * * 4`、价格检查为外部回推 | 联调方会按错误契约接入，导致验收偏差 | ✅ 已修复：SRS F-040-20/21/23章节已更新为与代码一致 |
| R4 | **SRS 缓存介质表述未对齐实现** | SRS `F-016-04` 仍写 KV 缓存，代码实际使用 D1 `explanation_cache` | 架构口径与实现口径冲突，影响容量/成本/运维预期 | ✅ 已修复：F-016-04已更新为”D1 explanation_cache表” |
| R5 | **SDS 对 F-050”schema + migrations 一致”结论仍不成立** | `conversions`/`email_logs`/`explanation_cache` 在代码中运行时 `CREATE TABLE IF NOT EXISTS`，但 migrations 中无对应建表 | 新环境首启行为依赖运行流量，基线不可审计 | ✅ 已修复：创建migrations/013_runtime_tables.sql正式化所有运行时表 |

### P2（文档一致性优化）

| 编号 | 问题 | 现状 | 影响 | 修复状态 |
|------|------|------|------|----------|
| R6 | **SRS List 字段定义不完整** | `lists` 实现已有 `content_type`/`disclosure`，SRS 数据字典未声明这两个字段 | 文档无法作为完整事实源，影响跨团队沟通 | ✅ 已修复：SRS 4.4 lists表已添加content_type和disclosure字段 |
| R7 | **SDS 迁移清单不完整** | `migrations/012_ems_schema.sql` 已存在，但 SDS 第 5 章未纳入；同时未说明运行时建表策略边界 | 文档基线与实际部署资产不一致 | ✅ 已修复：SDS第5章已纳入012/013/014三个migration文件 |

---

## 2. 本轮已关闭项（从待修复清单移除）

- 路由遮蔽问题：`src/api/index.ts` 已按“具体路由优先”修正，`categories/subcategories` 与 EMS 子路由可达。
- `user_sessions` 缺失：`migrations/012_ems_schema.sql` 已补齐 `user_sessions` 及相关索引。

---

## 3. 建议修复顺序

1. 先修 R1/R2（接口真实缺口），保证 SRS 可验收项可执行。
2. 再修 R3/R4（SRS 口径回收），统一外部联调契约。
3. 再修 R5/R7（SDS + 迁移基线），消除“运行时建表”与“迁移事实源”冲突。
4. 最后修 R6（SRS 字段补齐），完成文档一致性收口。

---

## 4. 复审说明

- 本报告按要求仅保留“依然不通过/新发现”的问题，已通过项已从主待办中移除。
- 本轮复审重点聚焦 SRS/SDS/代码三方一致性与可验收性，不做需求扩展。
