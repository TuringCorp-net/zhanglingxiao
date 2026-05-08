# Findora STR — 软件测试报告

> **项目名称：** Findora
> **版本：** v5.59（Reviewer定时任务；全面Code Review；发现ST-P21 SRS F-016-02/03状态不一致）
> **最后更新：** 2026-05-05
> **维护方式：** 以SRS F编号为主线的模块化测试状态文档

---

## 修改记录

> **规则：** 每次修改本文档后必须在此章节记录，只保留最新3天。

| 修改时间 | 修改内容 |
|----------|----------|
| 2026-05-05 | v5.59：Reviewer定时任务；全面Code Review完成；TS编译0错误；Migration 001~022完整；架构约束A-01~A-06全通过；发现ST-P21（SRS F-016-02/03状态标记🗓与代码实际🏗不一致）；更新日志清理 |
| 2026-05-05 | v5.58：Coder定时任务；修复ST-P20（API文档补充3个缺失admin端点路径）；ST-P20状态从🟡→✅；四文档v5.58同步；更新日志清理 |
| 2026-05-05 | v5.57：Reviewer定时任务；全面Code Review完成；TS编译0错误；Migration 001~022完整；架构约束A-01~A-06全通过；发现ST-P20（API文档缺失3个admin端点路径）；四文档v5.57同步；更新日志清理 |

---

## 基线状态（v5.59）

| 指标 | 状态 |
|------|------|
| TypeScript 编译 | ✅ `npx tsc --noEmit` 0 错误 |
| 阻塞项 | ✅ P0/P1安全问题已全部修复 |
| 代码基线 | 稳定，`src/` 无未审核变更 |
| 本次任务 | v5.59 Reviewer定时任务；全面Code Review；发现ST-P21 |
| Business Concept映射 | ✅ 17章节全量覆盖 |
| System Design约束核对 | ✅ A-01~A-06全部映射 |
| 三态状态一致性 | 🟡 发现ST-P21：SRS §7.7 F-016-02/03标记🗓但代码🏗（参见本次新发现问题） |
| 更新日志清理 | ✅ SRS/SDS/API/STR四文档已全部清理，仅保留最新3天 |
| 剩余P2优化项 | 🟡 4项非阻塞工程化优化待迭代（P1-5, P1-6, P1-7, P2-3） |
| ST-P20 | ✅ 已修复（v5.58：API文档补充3个缺失admin端点） |
| ST-P21 | 🟡 P3：SRS F-016-02/03代码实现状态标记🗓，应更新为🏗 |
| ST-C05 | ✅ 已修复（v5.56：提取verifyBearerAuth） |
| P2-2 | ✅ 已修复（v5.54：全部调用者迁移完成） |
| ST-C03 | ✅ 已修复（v5.54：parsePagination/parseLimit全项目迁移完成） |
| ST-P17 | ✅ 已修复（v5.52 email路由注释4处） |
| ST-P19 | ✅ 已修复（v5.54：全项目迁移完成） |

### 本次Reviewer定时任务验证通过项（v5.59）

1. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
2. ✅ **v5.58修复项确认**：ST-P20（API文档补充3个缺失admin端点）正确实现，三处均已添加
3. ✅ **迁移文件完整性**：001~022全部22个迁移文件存在
4. ✅ **架构约束A-01~A-06**：全部通过（代码级验证）
5. ✅ **安全修复ST-S01~S06**：全部生效，无回退
6. ✅ **禁用词表SSOT**：16项BANNED_WORDS在ai_content.ts定义，explain.ts/ai_review.ts正确导入
7. ✅ **verifyBearerAuth**：auth.ts:123定义，3处调用点（logout/getCurrentUser/changePassword）统一使用
8. ✅ **parsePagination/parseLimit**：products.ts正确从constants.ts导入，全项目迁移已完成
9. ✅ **路由遮蔽顺序**：categories子类目→通用、EMS members→ID路由、users/sessions→users/:id均已验证
10. ✅ **admin鉴权错误码**：index.ts `ADMIN_KEY_REQUIRED`正确
11. ✅ **四文档版本对齐**：SRS/SDS/API v5.58，STR v5.59（Reviewer版本号+1）
12. ✅ **无P0/P1阻塞项**：全部安全修复已验证
13. ✅ **API文档响应格式**：`ok`/`meta` 与代码实现一致
14. ✅ **F-016-02/03代码验证**：explain.ts:846 `explainComparison()`, explain.ts:901 `explainScenarios()` 均已完整实现，路由已注册（index.ts:206,211）
15. ✅ **review_report.md同步更新**：内容更新至v5.59

### 本次新发现问题（v5.59）

| 问题ID | 严重度 | 描述 | 位置 | 状态 |
|--------|--------|------|------|------|
| **ST-P21** | **P3** | SRS §7.7 F-016-02/03代码实现状态标记为🗓（未实现），但代码早已完整实现应为🏗 | `findora_SRS.md:1819-1820` vs `explain.ts:846,901` | 🟡 待修复 |

#### ST-P21 详细说明

**问题描述**：SRS §7.7 F-016子功能三态追踪表（第1819-1820行）将F-016-02（商品对比说明）和F-016-03（场景化描述）的代码实现列标记为🗓，但实际代码早已完整实现：

| 子功能 | SRS标记 | 代码实际状态 | 代码位置 |
|--------|---------|-------------|----------|
| F-016-02 商品对比说明 | 🗓 | 🏗 已实现 | `explain.ts:846` `explainComparison()`, `index.ts:206` 路由注册 |
| F-016-03 场景化描述 | 🗓 | 🏗 已实现 | `explain.ts:901` `explainScenarios()`, `index.ts:211` 路由注册 |

**交叉验证**：
- STR §F-016功能审核表（第436-437行）：F-016-02/03正确标记为🏗
- review_report.md §7.1（第281行）：已记录此差异并建议"SRS §9.6 F-016-02/03状态修正"
- explain.ts 文件头注释（第5-6行）：明确列出F-016-02/03实现

**影响评估**：P3（最低）。不影响系统功能，但SRS文档状态标记不准确可能导致协作者误判功能进度。F-016-02/03的代码实现是完整的（含DB查询、参数验证、响应构建），仅功能审核(F-016整个模块)受AI_API_KEY联调制约。

**修复建议**：将SRS §7.7第1819-1820行的F-016-02和F-016-03代码实现列从🗓更新为🏗，与STR、review_report.md、代码实际情况保持一致。

### 本次Coder定时任务验证通过项（v5.58）

1. ✅ **ST-P20修复**：API文档 `findora_API.md` 端点总览已补充3个缺失admin端点路径：
   - `GET /api/admin/tags` → "标签维度更新"表
   - `GET /api/admin/recommendations/behavior` → 新增"推荐与解释系统调试"章节
   - `GET /api/admin/explain/cache/stats` → 新增"推荐与解释系统调试"章节
2. ✅ **四文档版本对齐**：SRS/SDS/API/STR版本统一为v5.58
3. ✅ **更新日志清理**：四文档已清理过期日志（仅保留3天）
4. ✅ **无代码变更**：仅文档修复，TS编译0错误保持

### 本次Reviewer定时任务验证通过项（v5.57）

1. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
2. ✅ **v5.56修复项确认**：ST-C05（verifyBearerAuth）正确实现，3处调用统一使用共享函数
3. ✅ **迁移文件完整性**：001~022全部22个迁移文件存在
4. ✅ **架构约束A-01~A-06**：全部通过（代码级验证）
5. ✅ **禁用词表SSOT**：16项BANNED_WORDS在ai_content.ts定义，explain.ts/ai_review.ts正确导入
6. ✅ **安全修复ST-S01~S06**：全部生效，无回退
7. ✅ **路由遮蔽顺序**：categories子类目→通用、EMS members→ID路由、users/sessions→users/:id均已验证
8. ✅ **admin鉴权错误码**：index.ts:262 `ADMIN_KEY_REQUIRED`正确
9. ✅ **四文档版本对齐**：SRS/SDS/API/STR版本统一为v5.56（本次Review后将同步为v5.57）
10. ✅ **无P0/P1阻塞项**：全部安全修复已验证
11. ✅ **API文档响应格式**：`success`→`ok`、`pagination`→`meta` 与代码实现一致
12. ✅ **review_report.md同步更新**：内容更新至v5.57

### 本次新发现问题（v5.57）

| 问题ID | 严重度 | 描述 | 位置 | 状态 |
|--------|--------|------|------|------|
| **ST-P20** | **P3** | API文档端点总览缺失3个admin端点路径（代码已注册路由） | `findora_API.md` vs `index.ts` | ✅ 已修复（v5.58） |

#### ST-P20 详细说明

**问题描述**：API文档 `findora_API.md` 的端点总览章节缺失以下3个admin端点，但 `index.ts` 中已正确注册路由：

| 缺失端点 | 代码位置 | 功能 |
|----------|----------|------|
| `GET /api/admin/tags` | `index.ts:380` → `listTags()` | 标签列表（管理端） |
| `GET /api/admin/recommendations/behavior` | `index.ts:435` → `getProductBehaviorScore()` | 商品行为分数调试端点 |
| `GET /api/admin/explain/cache/stats` | `index.ts:440` → `getExplainCacheStats()` | 解释缓存统计 |

**影响评估**：轻微（P3）。这3个端点均需admin鉴权且代码实现正确，仅文档记载不完整。运营/开发Agent可能无法通过文档发现这些工具端点。

**修复建议**：在API文档端点总览中补充这3个路径条目。

### 本次Coder定时任务验证通过项（v5.56）

1. ✅ **ST-C05修复**：auth.ts中logout/getCurrentUser/changePassword三处Bearer token认证解析重复→提取verifyBearerAuth()共享函数
2. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
3. ✅ **代码简化**：每处调用从9行减至4行，消除认证逻辑重复
4. ✅ **迁移文件完整性**：001~022全部22个迁移文件存在
5. ✅ **架构约束A-01~A-06**：全部通过
6. ✅ **四文档版本对齐**：SRS/SDS/API/STR版本统一为v5.56
7. ✅ **更新日志清理**：四文档已清理过期日志
8. ✅ **无P0/P1阻塞项**：全部安全修复已验证

### 本次Reviewer定时任务验证通过项（v5.55）

1. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
2. ✅ **v5.54修复项确认**：ST-P19（parsePagination/parseLimit迁移14文件20处）已正确完成
3. ✅ **迁移文件完整性**：001~022全部22个迁移文件存在
4. ✅ **架构约束A-01~A-06**：全部满足
5. ✅ **禁用词表SSOT**：16项BANNED_WORDS在ai_content.ts定义，explain.ts/ai_review.ts正确导入
6. ✅ **共享函数迁移**：parsePagination（13处）+ parseLimit（7处）全部正确导入constants.ts
7. ✅ **四文档版本对齐**：SRS/SDS/API/STR版本统一为v5.55
8. ✅ **P2-2/ST-C03状态闭环**：共享函数基础设施+全部调用者迁移完成，遗留优化项从5→4
9. ✅ **无P0/P1阻塞项**：全部安全修复已验证
10. ✅ **路由顺序正确**：categories子类目→通用、EMS members→ID路由、users/sessions→users/:id均已验证
11. ✅ **admin鉴权错误码**：index.ts:263 `ADMIN_KEY_REQUIRED`正确
12. ✅ **review_report.md同步更新**：从v5.49更新至v5.55

### 本次Coder定时任务验证通过项（v5.54）

1. ✅ **ST-P19迁移完成**：全部14个文件20处调用点已采用parsePagination/parseLimit
2. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
3. ✅ **parsePagination迁移**：enterprise.ts, i18n.ts(x2), audit.ts(x2), record.ts, membership.ts(x2), admin/subscribers.ts, admin/content.ts, conversions.ts, email.ts, products.ts, ai_review.ts — 共13处
4. ✅ **parseLimit迁移**：behavior.ts, recommendations.ts, products.ts(getTrending), record.ts(expiring), price_check.ts(x2) — 共7处
5. ✅ **四文档版本对齐**：SRS/SDS/API/STR版本统一为v5.54
6. ✅ **P2-2彻底关闭**：共享函数基础设施+全部调用者迁移完成
7. ✅ **无回归风险**：功能逻辑等价替换，仅消除代码重复

### 本次Reviewer定时任务验证通过项（v5.53）

1. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
2. ✅ **v5.52修复项确认**：ST-P17（email.ts:453,533 + index.ts:419,424共4处注释）已正确修正为`/api/admin/email/send-*`
3. ✅ **迁移文件完整性**：001~022全部22个迁移文件存在
4. ✅ **禁用词表SSOT**：16项BANNED_WORDS在ai_content.ts定义，explain.ts/ai_review.ts正确导入
5. ✅ **四文档版本对齐**：SRS→v5.52、SDS→v5.52、API→v5.52（本次Review后将同步为v5.53）
6. ✅ **Business Concept约束**：A-01~A-06全部满足
7. ✅ **路由顺序正确**：categories子类目→通用、EMS members→ID路由屏蔽已验证
8. ✅ **admin鉴权错误码**：index.ts:263 `ADMIN_KEY_REQUIRED`正确
9. ✅ **explain.ts注释**：禁用词注释引用ai_content.ts(16项SSOT)正确
10. ✅ **email管理端点路径**：代码实现与API文档一致（`/api/admin/email/send-*`）
11. ✅ **无P0/P1阻塞项**：全部安全修复已验证
12. ✅ **行为推荐常量**：behavior.ts和recommendations.ts正确从constants.ts导入权重常量
13. ✅ **更新日志清理**：SRS/SDS/API/STR四文档均已清理，仅保留最新3天

### 本次新发现问题（v5.53）

| 问题ID | 严重度 | 描述 | 位置 | 状态 |
|--------|--------|------|------|------|
| **ST-P18** | **P3** | STR文档中ST-C02状态标记过期：权重常量已在constants.ts定义并被behavior.ts/recommendations.ts导入使用（P2-1已修复），但ST-C代码质量表仍标记为"🟡 建议提取" | STR §代码质量问题清单 line 588 | 🟡 待修复（本次Reviewer修正） |
| **ST-P19** | **P3** | `parsePagination`/`parseLimit`已在`constants.ts`定义，但`src/api/`下12+个文件仍使用内联分页解析，未采用共享函数 | `src/api/*.ts` | ✅ 已修复（v5.54：全部14个文件20处调用点迁移完成） |

#### ST-P18 详细说明

**问题描述**：STR §代码质量问题清单（ST-C表）中ST-C02的状态标记为"🟡 建议提取"，但该问题已通过P2-1修复。

**修复状态（P2-1）**：
- `src/lib/constants.ts` 定义了所有共享权重常量（RULE_*/BEHAVIOR_*/MMR_*）
- `behavior.ts` 正确从constants.ts导入 `BEHAVIOR_WEIGHT_*`/`COLD_START_*`/`RULE_WEIGHT`等11个常量
- `recommendations.ts` 正确从constants.ts导入 `RULE_CATEGORY_MATCH`/`RULE_TAG_MATCH`等7个常量
- **结论**：ST-C02已完全修复，STR表格状态应更新为✅

**本次修正**：ST-C02状态从🟡→✅。

#### ST-P19 详细说明

**问题描述**：`parsePagination`/`parseLimit`函数已在`src/lib/constants.ts`定义（第72-91行），但`src/api/`下12+个文件仍使用内联分页解析模式（`parseInt(url.searchParams.get('page')...)`），未采用共享函数。

**受影响的文件**（不完全列表）：
| 文件 | 行号 | 当前模式 |
|------|------|----------|
| `products.ts` | 111-112, 795 | 内联parseInt |
| `enterprise.ts` | 106-107 | 内联parseInt |
| `i18n.ts` | 186-187, 405-406 | 内联parseInt |
| `audit.ts` | 43-44, 97-98 | 内联parseInt |
| `record.ts` | 122-123, 415 | 内联parseInt |
| `membership.ts` | 497-498, 782-783 | 内联parseInt |
| `admin/subscribers.ts` | 152-153 | 内联Math.max/Math.min |
| `admin/content.ts` | 271-272 | 内联parseInt |
| `conversions.ts` | 129-130 | 内联Math.max/Math.min |
| `email.ts` | 643-644 | 内联Math.max/Math.min |
| `price_check.ts` | 290, 366 | 内联Math.max/Math.min |
| `recommendations.ts` | 80 | 内联parseInt |
| `behavior.ts` | 621 | 内联parseInt |
| `ai_review.ts` | 1035-1036 | 内联parseInt |

**修复方案（v5.54）**：在全部14个文件中导入并使用`parsePagination`/`parseLimit`共享函数替换内联解析：
- parsePagination迁移13处（page+limit+offset模式，使用不同defaultLimit参数）
- parseLimit迁移7处（纯limit模式）
- ai_review.ts特殊处理（对象属性 → 解构赋值）
- 全部文件通过TypeScript编译验证（`npx tsc --noEmit` 0错误）

**与P2-2的关系**：P2-2（分页参数解析逻辑在多文件重复）在v5.54彻底关闭。共享函数基础设施+全部调用者迁移完成。

### 本次Reviewer定时任务验证通过项（v5.51）

### 历次Coder定时任务验证通过项（v5.50）

1. ✅ **TypeScript编译检查**：`npx tsc --noEmit` 0错误
2. ✅ **四文档版本对齐**：SRS→v5.50、SDS→v5.50、API→v5.50、STR→v5.50
3. ✅ **更新日志清理**：按规则仅保留最新3天内容
4. ✅ **Business Concept约束**：A-01~A-06全部满足
5. ✅ **System Design约束**：A-01~A-06全部通过
6. ✅ **无P0/P1阻塞项**：全部安全修复已验证
7. ✅ **Migration文件完整性**：001~022全部22个迁移文件存在
8. ✅ **F-016/F-020状态一致性**：代码实现状态为🏗（待AI联调）
9. ✅ **代码与文档一致性**：SDS/API/STR端点数量与代码路由同步
10. ✅ **禁用词表SSOT**：16项禁用词在ai_content.ts/explain.ts/ai_review.ts三处统一
11. ✅ **API响应格式一致性**：API文档响应格式 `success`→`ok`、`pagination`→`meta` 与代码实现一致
12. ✅ **admin鉴权错误码修正**：index.ts:263从`INVALID_PARAMS`改为`ADMIN_KEY_REQUIRED`
13. ✅ **explain.ts注释修正**：禁用词注释从过期8项改为引用ai_content.ts(16项SSOT)
14. ✅ **email路由注释修正**：index.ts:414注释从`/api/email/send-weekly`改为`/api/admin/email/send-weekly`

#### 架构约束验证（AC）
| 检查项 | 验收标准 | 当前状态 | 验证位置 |
|--------|----------|----------|----------|
| AC-01 用户侧零实时LLM | Web链路0次外部模型调用 | ✅ 通过 | recommendations.ts, explain.ts |
| AC-02 运营AI鉴权 | 无Token拒绝401/403 | ✅ 通过 | index.ts isAdmin() |
| AC-03 标签动态扩展 | 新维度可立即用于检索 | ✅ 通过 | tags.ts CRUD |
| AC-04 纯查库推荐 | 仅DB检索+随机抽选 | ✅ 通过 | recommendations.ts评分公式 |
| AC-05 API唯一入口 | 无直连D1/R2路径 | ✅ 通过 | index.ts统一路由 |
| AC-06 Cloudflare优先 | Workers+D1+R2 | ✅ 通过 | wrangler.toml |

#### Business Concept & System Design 约束验证
| 约束编号 | 约束内容 | 验证结果 | 代码位置 |
|----------|----------|----------|----------|
| A-01 | 用户侧零实时LLM | ✅ 通过 | recommendations.ts仅做DB查询；explain.ts模板+缓存无实时LLM调用 |
| A-02 | 外部运营AI异步化 | ✅ 通过 | admin路由通过isAdmin()鉴权；F-040-22数据更新接口已实现 |
| A-03 | 纯数据库推荐链路 | ✅ 通过 | 评分公式：category_match×10 + tag_match×3 + click_count×1 + favorite_count×2 + price_match×5 + recency_days×0.1 |
| A-04 | 动态标签维度 | ✅ 通过 | tags.ts CRUD完整实现；标签维度可动态新增 |
| A-05 | 统一数据API层 | ✅ 通过 | index.ts统一路由分发；无直连D1/R2路径 |
| A-06 | Cloudflare优先 | ✅ 通过 | wrangler.toml配置Workers+D1+R2 |

#### 代码与文档一致性验证
| 检查项 | 状态 | 验证位置 |
|--------|------|----------|
| SDS vs 代码端点数量 | ✅ 同步 | SDS文档 vs index.ts |
| API文档 vs 代码路由 | ✅ 同步 | findora_API.md vs index.ts |
| Migration vs Schema | ✅ 同步 | 001~022 vs schema.ts |
| Business Concept约束 | ✅ 全部满足 | A-01~A-06 |
| 路由遮蔽问题（categories） | ✅ 正确顺序 | index.ts:124先于129 |
| 路由遮蔽问题（EMS） | ✅ 正确顺序 | index.ts:751-774先于776-789 |
| 禁用词表SSOT一致性（16项） | ✅ 单一真实源 | ai_content.ts→explain.ts→ai_review.ts |
| 四文档版本对齐 | ✅ 已同步 | SRS→v5.55, SDS→v5.55, API→v5.55, STR→v5.55 |
| API文档版本一致性 | ✅ 一致 | 头部v5.55 vs 端点总览v5.55 |
| constants.ts常量使用 | ✅ 正确引用 | behavior.ts/recommendations.ts导入并使用 |
| schema.ts Product接口 | ✅ 完整 | 包含rewritten_title/source_platform/last_checked_at |
| product_tag_map桥接表 | ✅ 正确实现 | products.ts syncProductTags() |
| Migration 001~022 | ✅ 完整 | 全部22个迁移文件存在 |

#### 核心代码文件审查结果（v5.36）

| 文件 | 验证项 | 结果 |
|------|--------|------|
| index.ts | 路由分发、鉴权 | ✅ |
| schema.ts | TypeScript类型定义 | ✅ Product/User/Click/List完整 |
| auth.ts | PBKDF2/JWT | ✅ 无回退密钥；salt$hash格式 |
| ai_content.ts | BANNED_WORDS导出 | ✅ 16项常量导出 |
| ai_review.ts | BANNED_WORDS导入 | ✅ 从ai_content.ts导入 |
| explain.ts | BANNED_WORDS导入 | ✅ 从ai_content.ts导入 |
| recommendations.ts | RULE_*常量使用 | ✅ 6个常量正确导入 |
| behavior.ts | BEHAVIOR_*/MMR_*常量使用 | ✅ 11个常量正确导入 |
| constants.ts | 常量定义 | ✅ P2-1/P1-8/P2-2已实现 |
| tags.ts | 动态标签CRUD | ✅ 桥接表JOIN正确 |
| products.ts | product_tag_map桥接表 | ✅ syncProductTags()正确实现 |
| explain.ts | 模板优先级/缓存TTL | ✅ 6级模板+24h/7d/72h TTL |

#### 安全问题验证（ST-S系列）

| 问题ID | 描述 | 状态 | 验证位置 |
|--------|------|------|----------|
| ST-S01 | PBKDF2 salt存储 | ✅ 已修复 | auth.ts:25-71 (salt$hash) |
| ST-S02 | JWT密钥无回退 | ✅ 已修复 | auth.ts:7-11 (无回退) |
| ST-S03 | products.ts SQL注入 | ✅ 已修复 | products.ts:33-73 (桥接表) |
| ST-S04 | recommendations.ts SQL注入 | ✅ 已修复 | 桥接表JOIN |
| ST-S05 | 审计日志IP伪造 | ✅ 已修复 | auth.ts:134 (仅CF-Connecting-IP) |
| ST-S06 | tags.ts SQL注入 | ✅ 已修复 | tags.ts (桥接表JOIN) |

#### 代码质量问题验证（ST-C系列）

| 问题ID | 描述 | 状态 | 验证位置 |
|--------|------|------|----------|
| ST-C01 | Record<string, unknown>滥用 | ✅ 已修复 | UserPreferences接口 |
| ST-C02 | 权重常量重复定义 | ✅ 已修复 | constants.ts |
| ST-C03 | 分页逻辑重复 | ✅ 已修复（v5.54全部迁移） | parsePagination/parseLimit |
| ST-C06 | dislikes未按用户过滤 | ✅ 已修复 | behavior.ts:100-180 |

---

## F-001~F-006 页面功能

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-001 商品列表 | `GET /api/products` | `products.ts` | ✅ |
| F-001-05 趋势内容 | `GET /api/trending` | `products.ts:getTrending` | ✅ |
| F-002-03 子类目筛选 | `GET /api/categories/:category/subcategories` | `categories.ts:getCategorySubcategories` | ✅ |
| F-002-05 排序功能 | `GET /api/products?sort_by=` | `products.ts:listProducts` | ✅ |
| F-003 榜单列表/详情 | `GET /api/lists`, `GET /api/lists/:id` | `lists.ts` | ✅ |
| F-004-06 榜单收藏 | `GET/POST/DELETE /api/favorites/lists` | `favorites.ts` | ✅ |
| F-005 商品收藏 | `GET/POST/DELETE /api/favorites` | `favorites.ts` | ✅ |

### 关键验证点

- D1+R2 主从读接口，无 N+1 读取 R2 性能风险
- 内容协商（JSON/Markdown）实现正确
- 趋势商品：7天点击量聚合，结构符合 SRS
- 子类目筛选：DISTINCT 查询 + ASC 排序，返回子分类数组
- 排序：支持 newest/popular/price_asc/price_desc 四种模式
- 榜单收藏：三端点完整实现，用户识别与去重逻辑正确

### 本次审核发现

| 问题ID | 严重度 | 描述 | 位置 |
|--------|--------|------|------|
| ST-S03 | P0 | LIKE 查询注入风险：`tag` 参数拼接方式不安全 | `products.ts:115-116` |

---

## F-010 商品库管理

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-010-01 创建/导入商品 | `POST /api/admin/products`, `POST /api/admin/products/import` | `products.ts` | ✅ |
| F-010-02 更新商品 | `PUT /api/admin/products/:id` | `products.ts` | ✅ |
| F-010-03 上下架 | `PATCH /api/admin/products/:id/status` | `products.ts` | ✅ |
| F-010-04 批量更新 | `POST /api/admin/products/batch` | `products.ts` | ✅ |
| F-010-05 价格回推 | `POST /api/admin/price-check` | `price_check.ts` | ✅ |

### 关键验证点

- D1+R2 双写导入正确实现
- 上下架状态机：active/inactive/archived 三态
- `MAX_BATCH_SIZE = 100`，超出返回 400 INVALID_PARAMS（P1-4 修复验证通过）
- `price_history` 表结构正确

---

## F-011 标签体系

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-011-01 标签 CRUD | `POST/PUT/DELETE /api/admin/tags` | `tags.ts` | ✅ |
| F-011-02 精选商品 | `PATCH /api/admin/tags/:id/featured` | `tags.ts` | ✅ |
| F-011-03 标签统计 | `GET /api/tags/stats` | `tags.ts` | ✅ |

### 关键验证点

- `dimension_level`（一/二级维度）字段正确实现
- `featured_products` 精选商品映射完整
- CRUD 接口全覆盖
- 标签维度可动态创建（支持 AC-03 动态扩展）

---

## F-012 联盟追踪

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-012-01~04 点击追踪 | `POST /api/clicks` | `clicks.ts` | ✅ |
| F-040-20 转化回调 | `POST /api/conversions/callback` | `conversions.ts` | ✅ |

### 关键验证点

- UTM 参数追踪正确记录
- 5 分钟去重窗口逻辑正确
- 转化回调：`conversions` 表结构正确，联盟回调处理完整

---

## F-013 用户订阅

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-013-01 订阅 | `POST /api/subscribe` | `subscribe.ts` | ✅ |
| F-013-02 更新偏好 | `PATCH /api/subscribe/preferences` | `subscribe.ts` | ✅ |
| F-013-03 退订 | `DELETE /api/subscribe` | `subscribe.ts` | ✅ |
| F-013-05 收藏管理 | `GET/POST/DELETE /api/favorites` | `favorites.ts` | ✅ |
| 邮件发送 | 内部调用 | `email.ts` | ✅ |
| F-013-08 订阅列表 | `GET /api/admin/subscribers` | `admin/subscribers.ts` | ✅ |
| F-013-09 导出 CSV | `GET /api/admin/subscribers/export` | `admin/subscribers.ts` | ✅ |

### 关键验证点

- 订阅/退订/偏好更新逻辑完整
- Resend/SendGrid 双 provider 支持
- `email_logs` 邮件日志表结构正确
- Cron 周报邮件已接入（`index.ts` `scheduled` 同时调用 `handleScheduledPublishing` 和 `sendWeeklyNewsletter`）— P1-3 修复验证通过

---

## F-014 基础推荐

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-014 推荐 feed | `GET /api/recommendations` | `recommendations.ts` | ✅ |

### 关键验证点

- 评分公式：`category_match×10 + tag_match×3 + click_count×1 + favorite_count×2 + price_match×5 + recency_days×0.1`
- `liked_tags`/`disliked_tags` 过滤逻辑正确
- 30 天行为窗口加权聚合正确
- 纯数据库检索，无实时 LLM 调用（AC-04 验证通过）

---

## F-015 进阶推荐

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-015 行为推荐 | `GET /api/recommendations/behavioral` | `behavior.ts` + `recommendations.ts` | ✅ |

### 关键验证点

- MMR 多样性打散：同类 ≤ 30%，覆盖 ≥ 3 个不同标签
- 冷启动阈值（< 5 次行为）降级逻辑正确
- 协同过滤相似度计算正确
- 计算超时预算 ≤ 50ms

---

## F-016 AI 推荐解释

### 审核结论：🏗 待 AI 联调（代码实现完整，SRS内部状态已统一为🏗）

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-016-01 推荐理由 | `GET /api/explain/:product_id` | `explain.ts` | 🏗 |
| 批量解释 | `POST /api/explain/batch` | `explain.ts` | 🏗 |
| F-016-02 对比说明 | `GET /api/explain/:product_id/comparison` | `explain.ts` | 🏗 |
| F-016-03 场景描述 | `GET /api/explain/:product_id/scenarios` | `explain.ts` | 🏗 |

### 关键验证点（代码层面 ✅）

- 模板优先级（6级）实现正确
- 缓存 TTL：用户×商品 24h / 通用 7d / AI 生成 72h
- 缓存时间格式：Unix 秒时间戳 `Math.floor(Date.now()/1000)`，`expires_at > nowUnix` 比较正确（P0-1 修复验证通过）
- Anthropic 响应解析：`result?.content?.[0]?.text`（P0-2 修复验证通过）
- 无 AI API Key 时优雅降级正确

### 遗留说明

代码实现通过审核，但依赖真实 AI 服务接入（配置 `AI_API_KEY`）后完成端到端联调验证。AI 联调 SOP 已补充至 SDS 文档。

---

## F-017 数据看板

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| 总览 | `GET /api/admin/analytics/overview` | `analytics.ts` | ✅ |
| UV 统计 | `GET /api/admin/analytics/uv` | `analytics.ts` | ✅ |
| CTR 统计 | `GET /api/admin/analytics/ctr` | `analytics.ts` | ✅ |
| 转化统计 | `GET /api/admin/analytics/conversion` | `analytics.ts` | ✅ |
| 分类统计 | `GET /api/admin/analytics/categories` | `analytics.ts` | ✅ |
| 榜单统计 | `GET /api/admin/analytics/lists` | `analytics.ts` | ✅ |
| 趋势分析 | `GET /api/admin/analytics/trends` | `analytics.ts` | ✅ |

### 关键验证点

- 8 个 KPI 端点（UV/CTR/转化/留存/分类统计）D1 聚合逻辑正确

---

## F-020 运营 AI 能力

### 审核结论：🏗 待 AI 联调

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-020-01 选品辅助 | `POST /api/admin/ai/selection` | `ai_content.ts` | 🏗 |
| F-020-02 内容生成 | `POST /api/admin/ai/generate` | `ai_content.ts` | 🏗 |
| F-020-03 社媒文案 | `POST /api/admin/ai/social` | `ai_content.ts` | 🏗 |
| F-020-04 推荐解释 | `POST /api/admin/ai/explain` | `ai_content.ts` | 🏗 |
| F-020-05 运营分析 | `POST /api/admin/ai/insights` | `ai_content.ts` | 🏗 |
| F-020-06 字段补全 | `POST /api/admin/ai/complete` | `ai_content.ts` | 🏗 |

### 关键验证点（代码层面 ✅）

- 6 个 AI 能力端点结构正确
- 运营 AI 为系统外角色，产出经 F-040-22 异步入库（A-02 约束满足）
- 无 AI API Key 时优雅降级正确

### 遗留说明

代码实现通过审核，依赖真实 AI 服务接入（OpenAI/Anthropic）后完成端到端联调验证。AI 联调 SOP 已补充至 SDS 文档。

---

## F-021 AI 边界限制

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| 提交审核 | `POST /api/admin/ai-review/submit` | `ai_review.ts` | ✅ |
| 执行审核 | `POST /api/admin/ai-review/:id/review` | `ai_review.ts` | ✅ |
| 批准 | `POST /api/admin/ai-review/:id/approve` | `ai_review.ts` | ✅ |
| 拒绝 | `POST /api/admin/ai-review/:id/reject` | `ai_review.ts` | ✅ |

### 关键验证点

- 5 步人工审核流程正确实现
- 禁用词表验证：三处均为16项（ai_content.ts:23-27行、explain.ts:182-186行、ai_review.ts:54-58行）
- 高风险类目（选品/合规/品牌/商业排序/夸张表述）强制人工确认
- ST-P4已修复：禁用词表三处统一为16项

### 本次审核发现

| 问题ID | 严重度 | 描述 | 位置 | 状态 |
|--------|--------|------|------|------|
| ST-P4 | ~~P2~~ | ai_review.ts禁用词表15项与ai_content.ts/explain.ts 12项不一致 | `ai_review.ts:54-58` | ✅ 已修复（v3.53：统一为16项） |

---

## F-022 多语言支持

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| 语言列表 | `GET /api/i18n/locales` | `i18n.ts` | ✅ |
| 翻译词条 | `GET /api/i18n/translations/:locale` | `i18n.ts` | ✅ |
| 内容翻译 | `GET /api/i18n/content/:type/:id/:locale/:field` | `i18n.ts` | ✅ |

### 关键验证点

- 读写分离架构通过
- 公共端点无鉴权正确
- MVP 阶段仅英语，架构支持扩展

---

## F-023 会员体系

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| F-023-01 会员层级 | `GET /api/membership/tiers` | `membership.ts` | ✅ |
| 我的会员 | `GET /api/membership/my` | `membership.ts` | ✅ |
| F-023-02 订阅 | `POST /api/membership/subscribe` | `membership.ts` | ✅ |
| F-023-03 权益验证 | `POST /api/membership/check` | `membership.ts` | ✅ |

### 关键验证点

- 会员层级/订阅管理/续期/独享内容正确实现
- `membership_tiers`/`user_memberships`/`subscription_events` 表结构正确

---

## F-030 内容管理

### 审核结论：✅ 已通过

| 子功能 | 端点 | 实现文件 | 审核结果 |
|--------|------|----------|----------|
| 选题管理 | `GET/POST /api/admin/topics` | `admin/content.ts` | ✅ |
| 添加候选商品 | `POST /api/admin/topics/:id/products` | `admin/content.ts` | ✅ |
| 发布内容 | `POST /api/admin/content/publish` | `admin/content.ts` | ✅ |
| 排期查看 | `GET /api/admin/content/schedule` | `admin/content.ts` | ✅ |
| 周产出统计 | `GET /api/admin/content/stats` | `admin/content.ts` | ✅ |

### 关键验证点

- 定时发布断环 Bug 已修复
- `executePublish` 正确写入 `lists` + `list_products` 两表
- `content_topics`/`topic_products`/`content_production` 表结构正确

---

## F-040 API 端点

### 审核结论：✅ 已通过

| 类别 | 数量 | 审核结果 |
|------|------|----------|
| 公开端点（F-040-01~06） | 6 | ✅ |
| 用户端点（F-040-07~13, F-040-26） | 8 | ✅ |
| 管理端点（F-040-14~18, F-040-24~25） | 6 | ✅ |
| 外部系统接口（F-040-20~23） | 4 | ✅ |

### 关键验证点

- 全部端点路由挂载正确（`index.ts`）
- `X-Admin-Key` / `env.ADMIN_KEY` 管理端鉴权闭环（AC-02 验证通过）
- 前端/Agent 无直连 D1/R2 路径（AC-05 验证通过）
- 用户端：`X-User-Email` 或 `X-Anonymous-Id` 识别逻辑正确
- F-040-22 运营 AI 数据更新接口：鉴权 + Payload 校验 + D1/R2 双写正确
- F-040-24~26 全局配置端点：admin CRUD + 公开读取正确

### 遗留观察项

- F-040 端点总数为 24 个（含 v3.31 新增 F-040-24~26），文档描述口径已在 SDS 中更新

### 本次审核发现

| 问题ID | 严重度 | 描述 | 位置 | 状态 |
|--------|--------|------|------|------|
| ST-T01 | ~~**P1**~~ | 缺失 `GlobalConfig` TypeScript 接口定义 | `schema.ts` | ✅ 已修复 |
| ST-T02 | ~~**P2**~~ | `createGlobalConfig` 函数未注册路由（死代码） | `admin/configs.ts`, `index.ts` | ✅ 已修复 |
| ST-T03 | ~~**P2**~~ | Key 格式验证缺失，应限制 `[a-zA-Z][a-zA-Z0-9_]*` | `admin/configs.ts` | ✅ 已修复 |

---

## F-050 数据模型

### 审核结论：✅ 已通过

### 关键验证点

- `schema.ts` TypeScript 类型定义与 D1 migrations **不完全一致**（见下方问题）
- D1+R2 分离字段完整（`r2_object_key` 图片索引正确）
- 18 张表迁移路径完整（001~014）
- products 表字段无重复定义（P0-1 修复验证通过）

### 本次审核发现

| 问题ID | 严重度 | 描述 | 位置 |
|--------|--------|------|------|------|
| ST-T04 | ~~**P0**~~ | `Product` 接口缺失 `source_platform`、`last_checked_at` 字段 | `schema.ts` | ✅ 已修复 |
| ST-T05 | ~~**P1**~~ | 缺失 5 个表接口：`PriceHistory`、`Conversions`、`ExplanationCache`、`EmailLogs`、`GlobalConfig` | `schema.ts` | ✅ 已修复 |
| ST-T06 | P2 | `004_price_history.sql` 文件头注释错误（写的是 005） | `migrations/004_*.sql` | ✅ 已修复（v4.34确认：现为Migration 004） |
| ST-T07 | ~~P2~~ | Migration 011 存在冗余索引创建（与 001 重复） | `migrations/011_*.sql` | ✅ 已修复 |

### 数据模型迁移状态

| Migration | 表 | 状态 |
|-----------|-----|------|
| 001_initial_schema | products/users/clicks/lists/tags | ✅ |
| 004_price_history | price_history | ✅ |
| 005_ai_review_records | ai_review_records | ✅ |
| 010_list_products | list_products | ✅ |
| 011_products_r2_index | products.r2_object_key | ✅ |
| 012_ems_schema | user_sessions/ems_users/enterprises/enterprise_members/records/audit_logs | ✅ |
| 013_runtime_tables | conversions/explanation_cache/email_logs | ✅ |
| 014_global_configs | global_configs | ✅ |

---

## 遗留优化项（非阻塞）

| 编号 | 描述 | 涉及模块 | 状态 |
|------|------|----------|------|
| P1-5 | 标签/类目查询部分场景使用 LIKE 字符串匹配，JSON 数组匹配未完全用 `json_each` | F-011/F-014 | ⚠️ 优化项 |
| P1-6 | 时间存储与查询策略不统一（写入用 `toISOString()`，查询用 `datetime('now')`） | 多模块 | ⚠️ 优化项 |
| P1-7 | 前端纯静态 HTML，首屏依赖客户端 fetch | `src/pages/*.html` | ⚠️ 优化项 |
| P2-2 | 分页参数解析逻辑在多文件重复 | 跨模块 | ✅ 已修复（v5.54：全部14文件20处调用点已迁移至parsePagination/parseLimit） |
| P2-3 | `parseJSON` 强制类型断言 `as string` 不安全 | 跨模块 | ⚠️ 优化项 |
| ST-C05 | 认证头解析逻辑在 `auth.ts` 重复 3 次 | `auth.ts` | ✅ 已修复（v5.56：提取verifyBearerAuth） |
| **ST-P17** | **email.ts/index.ts路由注释路径不准确（4处`/api/email/send-*`应为`/api/admin/email/send-*`）** | **email.ts, index.ts** | **✅ 已修复（v5.52）** |
| **ST-P18** | **STR文档ST-C02状态标记过期：权重常量已修复（P2-1），但ST-C表仍标记"🟡 建议提取"** | **STR §ST-C** | **✅ 已修复（v5.53 Reviewer修正）** |
| **ST-P19** | **parsePagination/parseLimit已在constants.ts定义但12+个API文件仍使用内联分页解析（调用者迁移未完成）** | **src/api/*.ts** | **✅ 已修复（v5.54：全项目迁移完成）** |
| P2-5 | SRS内部F-016/F-020状态表不一致（ST-P5） | SRS §2.2 vs 模块基线状态 | ✅ 已修复（v4.34 Coder修复，v4.35 Reviewer确认） |
| P2-6 | 四文档版本号偏差（ST-P6） | 跨文档 | ✅ 已修复（v4.34 Coder修复，v4.35 Reviewer确认） |
| P2-7 | SDS F-050 migration表缺失021条目（ST-P7） | SDS §F-050 | ✅ 已修复（v4.33 Coder修复，v4.34 Reviewer确认） |
| ST-P5 | SRS §2.2 F-016/F-020代码状态不一致 | SRS §2.2 vs 模块基线 | ✅ 已修复（v4.34 §2.2修正，v4.35 模块基线表修正） |
| **P2-8** | **SRS内部F-016代码实现状态不一致（§2.2 🏗 vs 模块基线表 ✅）** | **SRS §2.2 + 模块基线** | **✅ 已修复（v4.37：模块基线表→🏗）** |
| **P3-1** | **API文档尾部版本号v4.33未更新为v4.34** | **findora_API.md:1508** | **✅ 已修复（v4.36 Reviewer直接修复）** |
| **P2-1** | **权重常量重复定义：behavior.ts 和 recommendations.ts** | **F-014~015** | **✅ 已修复（v4.91：新建constants.ts，behavior.ts已迁移）** |
| **P1-8** | **F-015推荐多样性控制（MMR）实现细节待完善** | **F-015-04** | **✅ 已修复（v4.91：mmrRerank增加timeoutMs参数，50ms超时控制）** |
| **ST-S05/P2-4** | **审计日志 X-Forwarded-For 可被客户端伪造** | **auth.ts** | **✅ 已修复（v4.80：仅使用CF-Connecting-IP）** |

以上P2-5~P2-8及ST-P5~ST-P14均已修复。P2-1和P1-8已在v4.91修复。ST-P17已在v5.52修复。ST-P18已在v5.53修正。P2-2和ST-P19已在v5.54全部完成（全项目迁移至parsePagination/parseLimit）。ST-C05已在v5.56修复（提取verifyBearerAuth）。剩余4项P2非阻塞工程化优化（P1-5~P1-7, P2-3），不影响功能正确性，待后续迭代处理。

---

## 安全问题清单（ST-S）

> **说明：** 本章节记录代码安全相关问题。P0/P1已全部修复，P2为建议项不影响功能。

| 问题ID | 严重度 | 标题 | 位置 | 状态 |
|--------|--------|------|------|------|
| ST-S01 | ~~**P0**~~ | `verifyPassword` PBKDF2 salt 问题 | `auth.ts` | ✅ 已修复（salt存储在哈希中） |
| ST-S02 | ~~**P0**~~ | JWT 密钥回退至硬编码默认值 | `auth.ts` | ✅ 已修复（移除回退密钥） |
| ST-S03 | ~~**P0**~~ | LIKE 查询注入风险 | `products.ts` | ✅ 已修复（json_each） |
| ST-S04 | ~~**P1**~~ | `recommendations.ts` LIKE 注入风险 | `recommendations.ts` | ✅ 已修复（json_each） |
| ST-S05 | ~~**P2**~~ | 审计日志 `X-Forwarded-For` 可被客户端伪造 | `auth.ts` | ✅ 已修复（v4.80：仅使用CF-Connecting-IP） |
| ST-S06 | ~~**P0**~~ | `tags.ts` LIKE 查询未修复 | `tags.ts` | ✅ 已修复（json_each） |

### ST-S05 修复说明（v4.80）

**修复方案**：移除 `X-Forwarded-For` 回退，仅使用 Cloudflare 提供的真实 IP。

**修复后代码**（`auth.ts:133`）：
```typescript
const ip = request.headers.get('CF-Connecting-IP') || null;
```

**修复后状态**：✅ 审计日志现在仅使用 Cloudflare 提供的 `CF-Connecting-IP` 头，无法被客户端伪造。

---

## 代码质量问题清单（ST-C）

> **说明：** 本章节记录代码质量和架构相关问题，不影响功能正确性。

| 问题ID | 严重度 | 标题 | 位置 | 状态 |
|--------|--------|------|------|------|
| ST-C01 | ~~**P1**~~ | `Record<string, unknown>` 滥用绕过类型检查 | `recommendations.ts` | ✅ 已修复（添加UserPreferences接口） |
| ST-C02 | P2 | 权重常量在 `behavior.ts` 和 `recommendations.ts` 重复定义 | 多文件 | ✅ 已修复（v4.91：constants.ts共享常量，behavior.ts/recommendations.ts正确导入） |
| ST-C03 | P2 | 分页参数解析逻辑在多个文件重复 | 多文件 | ✅ 已修复（v5.54：parsePagination/parseLimit全项目迁移完成） |
| ST-C04 | P2 | `parseJSON` 强制类型断言 `as string` 不安全 | 多文件 | 🟡 建议改进 |
| ST-C05 | ~~P2~~ | 认证头解析逻辑在 `auth.ts` 重复 3 次 | `auth.ts` | ✅ 已修复（v5.56：提取verifyBearerAuth） |
| ST-C06 | ~~P2~~ | `behavior.ts` dislikes查询逻辑错误：未按用户过滤 | `behavior.ts:105-115` | ✅ 已修复（传入userId参数按用户过滤） |

### ST-C06 修复说明

**修复方案**：`getProductBehaviorScores` 函数新增 `userId` 参数，有用户ID时：
1. 查询该用户的 `disliked_tags`
2. 检查商品 `tags` 是否匹配用户的 `disliked_tags` 中的任一标签
3. 如果匹配则计入该商品的 dislike_count

**修复后状态**：✅ dislikes查询现在正确按用户过滤，推荐结果中用户讨厌的商品会被适当降权。

### ST-P4 修复说明

**问题描述**：`ai_review.ts` 禁用词表与 `ai_content.ts`/`explain.ts` 不一致。

**修复方案**：采用单一真实源（Single Source of Truth）模式：
- `ai_content.ts` 第23行定义并导出 `BANNED_WORDS` 常量（16项）
- `explain.ts` 第28行从 `ai_content.ts` 导入 `BANNED_WORDS`
- `ai_review.ts` 第24行从 `ai_content.ts` 导入 `BANNED_WORDS` 和 `validateAgainstBannedWords`

**修复后状态**：✅ 三处禁用词表统一为16项（best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous/amazing/incredible/unbelievable/game-changing），实现单一真实源管理

---

## 其他发现清单（ST-P）

> **说明：** 本章节记录非阻塞的文档、架构和工程化问题。

| 问题ID | 严重度 | 标题 | 位置 | 状态 |
|--------|--------|------|------|------|
| ST-P1 | ~~P2~~ | explanation_cache 存储Unix整数 vs schema定义TEXT类型不一致 | `explain.ts` + `migrations/013` | ✅ 已修复（统一为INTEGER） |
| ST-P2 | ~~P2~~ | API文档与代码端点偏差（4项不一致） | 文档 vs 代码 | ✅ 已修正（文档更新） |
| ST-P3 | ~~P2~~ | 禁用词表代码与SRS定义不一致 | `ai_content.ts:22-26` + `explain.ts:181-185` | ✅ 已修复（v3.36 SRS禁用词表已与代码对齐：best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous） |
| ST-P4 | ~~P2~~ | ai_review.ts禁用词表16项与ai_content.ts/explain.ts 12项不一致 | `ai_review.ts:54-58` | ✅ 已修复（v3.53：ai_content.ts/explain.ts扩展为16项，统一） |
| ST-P5 | ~~P2~~ | SRS Section 2.2 overview表中F-016/F-020代码实现状态与同文档"模块基线状态"表不一致 | SRS §2.2 vs 模块基线状态 | ✅ 已修复（v4.34 §2.2修正，v4.35 模块基线表修正） |
| ST-P6 | ~~P2~~ | 四文档版本号偏差：SDS/API v4.31已更新但SRS v4.26/STR v4.32需要后续同步 | 跨文档 | ✅ 已修复（v4.35：SRS/SDS/API v4.35，STR v4.37；v4.59：SRS/SDS/API v4.57，STR v4.59） |
| ST-P7 | ~~P3~~ | SDS F-050 migration状态表未列出021_clicks_cascade迁移条目 | SDS §F-050 | ✅ 已修复（v4.33：SDS clicks行补充021_clicks_cascade） |
| **P2-8** | **P2** | **SRS内部F-016代码实现状态不一致：§2.2 overview表=🏗 vs 模块基线表=✅（ST-P5残留）** | **SRS §2.2 (line 264) + 模块基线 (line 141)** | **✅ 已修复（v4.35：模块基线表→🏗）** |
| **P3-1** | **P3** | **API文档尾部版本号v4.33未更新为v4.34** | **findora_API.md:1508** | **✅ 已修复（v4.36 Reviewer直接修复）** |
| **ST-P8** | **P2** | **SDS F-020/F-021端点路径与代码不一致共14处** | **SDS §F-020、§F-021** | **✅ 已修复（v4.37 Coder修复）** |
| **ST-P9** | **P2** | **STR内部"遗留优化项"表P2-8仍标记为"🟡 待修复"与头部和ST-P章节不一致（v4.38 Reviewer发现并修复）** | **STR "遗留优化项"表** | **✅ 已修复（v4.38：统一为✅）** |
| **ST-P10** | **P2** | **SDS/STR §F-013 HTTP方法修正遗漏：PUT→PATCH /api/subscribe/preferences、POST /api/unsubscribe→DELETE /api/subscribe（v4.39 Coder已修复）** | **SDS §F-013 + STR §F-013** | **✅ 已修复（v4.39：两文档均已完成修正）** |
| **ST-P11** | **P2** | **STR "遗留优化项"表遗漏SRS P1-8条目（F-015 MMR多样性控制优化项）；SRS line 107有P1-8但STR未列出** | **SRS §非阻塞优化项 vs STR "遗留优化项"** | **✅ 已修复（v4.40 Reviewer已补充P1-8至STR"遗留优化项"表）** |
| **ST-P12** | **P3** | **SRS P1-8编号前缀为"P1"但严重度列标注为"P2"，编号前缀与严重度不一致** | **SRS §非阻塞优化项 line 107** | **✅ 已修复（v4.41：SRS严重度列P2→P1）** |
| **ST-P13** | **P3** | **STR v4.39头部P2-8修复声明与v4.38的ST-P9修复重复（v4.39 Coder声明"修复STR内部P2-8状态残留"，但v4.38 Reviewer已通过ST-P9修复）** | **STR v4.39头部** | **✅ 已修复（v4.41：v4.39修改记录去重）** |
| **ST-P14** | **P2** | **SRS §9.6 F-020子功能三态追踪表代码实现列全部为🗓，与§2.2（🏗）和模块基线表（🏗）不一致；ai_content.ts已实现6个AI端点** | **SRS §9.6 (line 2319-2326)** | **✅ 已修复（v4.43 Coder）** |
| **ST-P15** | **P3** | **TypeScript Product接口缺少 `rewritten_title` 字段（D1 migration和SRS数据字典中有定义，但schema.ts未包含）** | **src/db/schema.ts** | **✅ 已修复（v4.43 Coder）** |
| **ST-P16** | **P3** | **STR "按模块分布"表P2合计行显示7，实际非阻塞优化项共9项（v4.42已在表中修正并新增未归类行）** | **STR §汇总统计** | **✅ 已修复（v4.42 Reviewer修复）** |
| **P3-2** | **P3** | **API文档尾部版本号v4.66与头部v4.68不一致** | **findora_API.md:1471** | **✅ 已修复（v4.69 Coder：尾部版本更新为v4.69）** |
| **ST-P20** | **P3** | **API文档端点总览缺失3个admin端点路径（GET/admin/tags, GET/admin/recommendations/behavior, GET/admin/explain/cache/stats）** | **findora_API.md vs index.ts** | **✅ 已修复（v5.58）** |
| **ST-P21** | **P3** | **SRS §7.7 F-016-02/03代码实现状态标记🗓（未实现），代码实际已完整实现应为🏗** | **SRS line 1819-1820 vs explain.ts:846,901** | **🟡 待修复** |

### ST-P5 详细说明

**问题描述**：SRS v4.26 文档内部存在模块状态不一致。v4.34 Coder修复了§2.2的🗓→🏗。v4.35 Coder修复了模块基线表F-016的✅→🏗，两处现已统一。

- **Section 2.2 overview表**（第264行，v4.34已修正）：
  - F-016 推荐解释检索：代码实现 = 🏗

- **"模块基线状态（本次重点）"表**（第141行，v4.35已修正）：
  - F-016：代码实现 = 🏗（与§2.2一致）

**修复状态**：✅ 已完全修复（v4.34 §2.2修正 + v4.35 模块基线表修正）。

### P2-8 详细说明（已修复）

**问题描述**：SRS文档内部F-016代码实现状态存在不一致。

- **§2.2 overview表**（line 264）：F-016 代码实现 = 🏗
- **模块基线状态表**（line 141，v4.35修复前）：F-016 代码实现 = ✅

两个表格在同一文档中对同一功能模块描述的状态不一致。

**修复方案**（v4.35）：将模块基线表F-016代码实现统一为🏗（与§2.2一致），因为该功能虽代码已完整实现但待AI API Key联调。

**修复状态**：✅ 已修复（v4.35 Coder修复）。

### P3-1 详细说明（已修复）

**问题描述**：API文档 `findora_API.md` 尾部版本号与头部不一致。

- **头部**（line 3）：`版本：v4.35`
- **尾部**（line 1508）：`文档版本：v4.34`

**修复状态**：✅ 已修复（v4.36 Reviewer直接修复了尾部版本号；v4.37 Coder确认）。

### ST-P6 详细说明

**问题描述**：四文档版本号存在偏差。v4.34已修复。

| 文档 | 版本 | 最后更新 | 状态 |
|------|------|----------|------|
| SRS | v4.36 | 2026-04-25 | ✅ 已对齐（ST-P10已修复） |
| SDS | v4.36 | 2026-04-25 | ✅ 已对齐（ST-P10已修复：§F-013 HTTP方法修正） |
| API | v4.36 | 2026-04-25 | ✅ 已对齐（端点路径与代码一致） |
| STR | v4.39 | 2026-04-25 | ✅ Coder版本号+3 |

**修复状态**：✅ ST-P6已修复。SRS/SDS/API头部版本均为v4.36，STR为v4.39。

### ST-P7 详细说明

**问题描述**：SDS §F-050（数据模型）的migration状态表列出了001~014所有主要表，但未包含021_clicks_cascade迁移条目。

- SDS基线状态行明确写了"Migration编号 | ✅ 001~021连续无冲突 | v4.31修复014重复"
- 但F-050的D1表结构表格中只列出了`products`表对应"001_initial_schema"，未提及021_clicks_cascade为clicks表添加的级联删除约束

**影响评估**：轻微。021是ALTER TABLE添加外键约束，不创建新表。但为完整性起见，应在表格中体现。

**修复建议**：在SDS §F-050的D1表结构表格中，将`clicks`行的"对应Migrations"列更新为"001_initial_schema, 021_clicks_cascade"，或在表格下方添加注释说明。

### ST-P4 详细说明

**问题描述**：`ai_review.ts` 第54-58行定义的 `BANNED_EXPRESSIONS` 包含16项，而 `ai_content.ts` 第22-26行和 `explain.ts` 第181-185行的 `BANNED_WORDS` 各只有12项。

**差异项**：
| 文件 | 禁用词数量 | 额外词汇 |
|------|-----------|---------|
| ai_content.ts | 12项 | - |
| explain.ts | 12项 | - |
| ai_review.ts | 16项 | amazing, incredible, unbelievable, game-changing |

**修复方案（v3.53）**：采用方案A，将 `ai_content.ts` 和 `explain.ts` 的禁用词表扩展为16项，与 `ai_review.ts` 保持一致。

**修复后状态**：✅ 三处禁用词表统一为16项（best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous/amazing/incredible/unbelievable/game-changing）

### ST-P1 详细说明

**问题描述**：`explain.ts` 中 `expires_at` / `generated_at` 使用 Unix 秒整数（`Math.floor(Date.now()/1000)`）存储，但 `migrations/013_runtime_tables.sql` 定义为 `TEXT` 类型。

**修复方案**：将 `migrations/013_runtime_tables.sql` 中 `explanation_cache` 表的 `generated_at` 和 `expires_at` 字段类型从 `TEXT` 改为 `INTEGER`，与代码实际行为一致。

**修复后状态**：✅ schema、代码、runtime建表语句三方统一为 INTEGER 类型。

### ST-P2 详细说明

**问题描述**：API 文档（findora_API.md）与代码实现（src/api/index.ts）存在端点偏差。

**修复方案**：更新 API 文档，修正外部系统接口描述。

**修复后状态**：✅ 文档已更新，反映实际路由位置（`/api/email/send-confirmation` 公开；`/api/admin/price-check` 系列仅admin）

### ST-P3 详细说明

**问题描述**：SRS v3.35 禁用词表与代码实际实现不一致。

- **SRS v3.35 描述**（12项）：`best`, `safest`, `guaranteed`, `proven`, `clinically`, `miracle`, `revolutionary`, `lifesaving`, `officially`, `must-have`, `first-ever`, `game-changer`
- **代码实际定义**（12项，`ai_content.ts:22-26` + `explain.ts:181-185`）：`best`, `worst`, `safest`, `guaranteed`, `proven`, `clinically`, `miracle`, `revolutionary`, `lifesaving`, `official`, `authentic`, `dangerous`

**差异项**：
| SRS描述 | 代码实际 |
|---------|----------|
| officially | official（代码有，语义相近但不同） |
| must-have | authentic（完全不同） |
| first-ever | dangerous（完全不同） |
| game-changer | worst（完全不同） |

**影响评估**：代码实际定义同样覆盖了夸张表述风险（official/authentic/dangerous/worst），实际防护效果不差于SRS描述，但SRS文档应及时与代码对齐以避免后续开发歧义。

**修复方案**：将 SRS 禁用词表更新为与代码一致，或将代码改为与SRS一致（建议以代码为准，因为 `official`/`authentic`/`dangerous` 同样是常见营销夸张词）。

**建议行动**：Reviewer建议将禁用词表统一为代码版本（`best/worst/safest/guaranteed/proven/clinically/miracle/revolutionary/lifesaving/official/authentic/dangerous`），同时更新 SRS v3.35 禁用词表描述。

### ST-P9 详细说明

**问题描述**：STR文档内部存在P2-8状态不一致。

- **"遗留优化项"表**（line 637，v4.38修复前）：P2-8标记为"🟡 待修复（v4.36新发现）"
- **文档头部**（line 4）：已声明"修复P2-8"
- **ST-P章节**（line 724）：已标记为"✅ 已修复"

**原因**：v4.37 Coder修复了P2-8（SRS模块基线表），但未同步更新STR "遗留优化项"表中的P2-8状态。

**修复方案**（v4.38 Reviewer直接修复）：将"遗留优化项"表中P2-8状态更新为"✅ 已修复（v4.37：模块基线表→🏗）"。

**修复状态**：✅ 已修复（v4.38）。

### ST-P10 详细说明

**问题描述**：SDS v4.35头部声称已修复F-013用户端点HTTP方法，但修复不完整——仅§F-040章节更新，§F-013章节遗漏。

| 位置 | 显示内容 | 应为 | 状态 |
|------|----------|------|------|
| SDS §F-013 (line 279) | `PATCH /api/subscribe/preferences` | — | ✅ 已修正（v4.39） |
| SDS §F-013 (line 280) | `DELETE /api/subscribe` | — | ✅ 已修正（v4.39） |
| SDS §F-040 (line 555) | `PATCH /api/subscribe/preferences` | — | ✅ 已更新 |
| SDS §F-040 (line 556) | `DELETE /api/subscribe` | — | ✅ 已更新 |

**代码实际路由**（`index.ts:146`）：`PATCH /api/subscribe/preferences`
**代码实际路由**（`index.ts:141`）：`DELETE /api/subscribe`

**影响评估**：轻微。API文档（findora_API.md）中的端点方法已正确。SDS §F-040章节也已正确。仅§F-013模块详情章节不一致，不影响开发者理解，但违反文档一致性原则。

**修复方案**：SDS §F-013 line 279的`PUT`→`PATCH /api/subscribe/preferences`，line 280的`POST /api/unsubscribe`→`DELETE /api/subscribe`。同时同步修复STR §F-013相同遗漏。

**修复状态**：✅ 已修复（v4.39 Coder修复，v4.40 Reviewer验证通过）。

### ST-P11 详细说明

**问题描述**：SRS "非阻塞优化项" 表（line 107）定义了 P1-8（F-015 MMR多样性控制），但STR "遗留优化项" 表中未列出此条目。

- **SRS line 107**：`| P1-8 | F-015推荐多样性控制（MMR）实现细节待完善 | F-015-04 | P2 | 🗓 |`
- **STR "遗留优化项" 表**：v4.39及之前版本缺少 P1-8

**影响评估**：轻微。SRS和STR的优化项清单不一致，SRS多出的P1-8（MMR控制）是真实存在的优化需求。STR遗漏可能导致后续Coder忽略此项。

**修复方案**：STR "遗留优化项" 表中补充 P1-8 条目。

**修复状态**：✅ 已修复（v4.40 Reviewer补充）。

### ST-P12 详细说明

**问题描述**：SRS P1-8 的编号前缀使用 "P1"，但严重度列标注为 "P2"，编号体系不一致。

**SRS line 107**：
```
| P1-8 | F-015推荐多样性控制（MMR）实现细节待完善 | F-015-04 | P2 | 🗓 |
```
- 编号前缀：`P1`（暗示 P1 级严重度）
- 严重度列：`P2`（实际标注为 P2 级）

**影响评估**：轻微。编号前缀与严重度列不一致可能引起混淆，但不影响系统功能。

**修复建议**：
- 方案A：将编号改为 `P2-5`（若严重度确为 P2），保持与 P2-1~P2-4 一致
- 方案B：将严重度列改为 `P1`（若确实应作为 P1 优先级）

**修复状态**：✅ 已修复（v4.41 Coder修复：SRS P1-5~P1-8严重度列P2→P1，编号前缀与严重度一致）。

### ST-P13 详细说明

**问题描述**：STR v4.39 头部声明"修复STR内部'遗留优化项'表P2-8状态残留"，但 v4.38 Reviewer 已通过 ST-P9 完成相同修复。该修复声明存在冗余。

- **v4.38 Reviewer** 头部声明：`修复ST-P9（STR内部"遗留优化项"表P2-8仍标记为"🟡 待修复"→"✅ 已修复"）`
- **v4.39 Coder 原声明**：`修复STR内部"遗留优化项"表P2-8状态残留`

**修复结果**：v4.41 已将v4.39修改记录改为"确认v4.38 Reviewer ST-P9修复（P2-8状态残留已清除）"，消除冗余。

**影响评估**：轻微。P2-8 状态在"遗留优化项"表中已正确显示为 "✅ 已修复"，功能不受影响。

**修复状态**：✅ 已修复（v4.41 Coder修复：去重v4.39修改记录中的重复声明）。

### ST-P14 详细说明

**问题描述**：SRS §9.6 F-020子功能三态追踪表（line 2319-2326）中，F-020-01~F-020-06的"代码实现"列全部标记为🗓，但与SRS §2.2（line 272，🏗）和模块基线表（line 149，🏗）不一致。

| 位置 | F-020 代码实现 | 说明 |
|------|---------------|------|
| SRS §2.2（line 272） | 🏗 | 运营AI异步生产 |
| SRS 模块基线表（line 149） | 🏗 | ai_content.ts已实现6个AI能力端点 |
| SRS §9.6（line 2319-2326） | ~~🗓~~ → 🏗 ✅ | F-020-01~F-020-06全部更新为🏗 |

**实际代码状态**：`src/api/ai_content.ts` 已完整实现6个AI能力端点（selection-assistance/content-generation/social-copy/analytics-insights/product-completion + status端点），代码实现应为🏗。

**影响评估**：轻微。§9.6子功能表与§2.2全局表状态不一致，可能误导协作者对F-020各子功能进度的判断。

**修复状态**：✅ 已修复（v4.43 Coder）：SRS §9.6 F-020-01~06代码实现列已从🗓更新为🏗，与§2.2和模块基线表统一。

### ST-P15 详细说明

**问题描述**：TypeScript `Product` 接口（`src/db/schema.ts` line 10-37）缺少 `rewritten_title` 字段。

| 位置 | 状态 |
|------|------|
| D1 migration `001_initial_schema.sql:10` | `rewritten_title TEXT` ✅ 已定义 |
| SRS §4.1 数据字典（line 1069） | `rewritten_title \| TEXT \| 重写后标题（用于前端展示）` ✅ 已定义 |
| TypeScript `schema.ts` Product 接口 | ~~❌ 缺少~~ → ✅ 已补充 |

**影响评估**：中等。TypeScript类型定义与D1 schema不一致，可能导致编译时类型检查遗漏。

**修复状态**：✅ 已修复（v4.43 Coder）：schema.ts的Product接口已添加`rewritten_title: string | null;`字段。

### ST-P16 详细说明

**问题描述**：STR §汇总统计 "按模块分布" 表（line 966-973）P2合计行显示7，但实际非阻塞优化项共8项。

| 模块 | 表显P2数 |
|------|---------|
| F-014~015 (推荐) | 2 |
| auth.ts | 2 |
| F-021 (AI审核) | 0 |
| 跨模块 | 3 |
| 文档一致性 | 0 |
| **合计（表显）** | **7** |
| **实际P2总量** | **8**（P1-5~P1-8共4+P2-1~P2-4共4） |

**原因**：P1-5涉及F-011和F-014两个模块，可能在按模块分类时被归并导致计数偏差。实际上P1-5~P1-8（4项）均为P2级严重度（v4.41修复后），P2-1~P2-4（4项）也均为P2级，总计8项。

**影响评估**：P3（最低）。仅为计数展示偏差，不影响任何功能。表头上方"严重度分布"表正确显示P2=8。

**修复建议**：v4.42已补正"按模块分布"表合计行为9，新增"未归类(P1-7前端)"行（P1-7涉及src/pages，不属于原表任何模块）。原表之所以合计数错，是因为P1-7（前端纯静态HTML）不属于F-014~015/auth.ts/跨模块/文档一致性中任何一类。

### ST-P20 详细说明（v5.57 新发现）

**问题描述**：API文档 `findora_API.md` 端点总览章节缺失3个admin端点。这3个端点在 `index.ts` 中已正确注册路由且功能实现完整，但API文档中未列出。

**缺失端点清单**：

| 端点路径 | 代码位置 | 功能 | 缺失位置 |
|----------|----------|------|----------|
| `GET /api/admin/tags` | `index.ts:380` → `listTags()` | 标签列表（管理端） | API文档"运营AI专属接口 > 标签维度更新"表 |
| `GET /api/admin/recommendations/behavior` | `index.ts:435` → `getProductBehaviorScore()` | 商品行为分数调试 | API文档"内部管理API"章节 |
| `GET /api/admin/explain/cache/stats` | `index.ts:440` → `getExplainCacheStats()` | 解释缓存统计 | API文档"内部管理API"章节 |

**代码验证**：
- `GET /api/admin/tags`：存在，调用`listTags(env, request)`，已有完整分页和维度过滤支持
- `GET /api/admin/recommendations/behavior`：存在，调用`getProductBehaviorScore(env, request)`，需admin鉴权
- `GET /api/admin/explain/cache/stats`：存在，调用`getExplainCacheStats(env)`，需admin鉴权

**影响评估**：P3（最低）。这3个端点均需admin鉴权且代码实现正确，仅文档记载不完整。运营/开发Agent可能无法通过查阅文档发现这些管理工具端点。

**修复建议**：在API文档的端点总览相应章节（标签维度更新、内部管理API）补充这3个路径条目。

### ST-P21 详细说明（v5.59 新发现）

**问题描述**：SRS §7.7 F-016子功能三态追踪表（第1819-1820行）将F-016-02（商品对比说明）和F-016-03（场景化描述）的"代码实现"列标记为🗓，表示代码未实现。但实际代码早已完整实现。

**差异对照**：

| 子功能 | SRS §7.7 标记 | 代码实际状态 | 代码位置 |
|--------|---------------|-------------|----------|
| F-016-02 商品对比说明 | 🗓 | 🏗 已实现 | `explain.ts:846` `explainComparison()`, `index.ts:206` 路由注册 |
| F-016-03 场景化描述 | 🗓 | 🏗 已实现 | `explain.ts:901` `explainScenarios()`, `index.ts:211` 路由注册 |

**代码验证**：
- `explainComparison()`（explain.ts:846-895）：接收compare_with参数，查询两个商品，生成对比解释，返回JSON响应。功能完整（含参数验证、404处理、DB查询）。
- `explainScenarios()`（explain.ts:901-960）：查询商品use_cases和target_audience字段，生成场景化描述，返回JSON响应。功能完整。
- explain.ts文件头注释（第5-6行）明确列出："F-016-02: Product comparison explanations"、"F-016-03: Scenario-based descriptions"。

**已有交叉引用**：
- STR §F-016功能审核表（第436-437行）：正确标记F-016-02/03为🏗
- review_report.md §7.1（第281行）：已记录"SRS §9.6 F-016-02/03状态修正：代码已实现（🏗），下轮SRS更新时同步修正"
- SRS §2.2 模块基线表（第170行）：F-016整个模块标记为🏗

**影响评估**：P3（最低）。不影响系统功能。F-016-02/03代码已完整实现且通过TypeScript编译，仅SRS文档中§7.7子功能表状态标记不准确。与F-016模块整体🏗状态一致（模块级标记正确，子功能级标记有误）。

**修复建议**：将SRS §7.7第1819-1820行F-016-02和F-016-03的代码实现列从🗓更新为🏗。

## 汇总统计

### 问题严重度分布

| 严重度 | 数量 | 说明 |
|--------|------|------|
| P0 | 0 | ✅ **全部修复** |
| P1 | 0 | ✅ **全部修复** |
| P2 | 4 | 🟡 非阻塞工程化优化（P1-5, P1-6, P1-7, P2-3） |
| P3 | 1 | 🟡 ST-P21（SRS F-016-02/03状态标记不一致） |
| 合计 | 5 | P0/P1均清零；4项P2非阻塞优化+1项P3文档一致性 |

**已修复的P2项**：P1-8(MMR超时)、P2-1(权重常量)、P2-2(分页函数迁移)、P2-4(审计日志IP) ✅
**已修复的P3项**：ST-P20(v5.58) ✅

### 按模块分布

| 模块 | P2 | P3 |
|------|----|-----|
| F-014~015 (推荐) | 0 | 0 |
| auth.ts | 0 | 0 |
| F-021 (AI审核) | 0 | 0 |
| 跨模块 | 2 (P1-6, P2-3) | 0 |
| 未归类(P1-7前端) | 1 | 0 |
| F-011 (标签) | 1 (P1-5) | 0 |
| email.ts/index.ts | 0 | 0 (ST-P17/ST-P18/ST-P19已修复) |
| 文档一致性 | 0 | 1 (ST-P21) |
| **合计** | **4** | **1** |

### 修复历史

| 日期 | 修复内容 |
|------|----------|
| 2026-05-05 | v5.59：Reviewer定时任务；全面Code Review完成；TS编译0错误；Migration 001~022完整；架构约束全通过；发现ST-P21（SRS F-016-02/03状态不一致P3）；更新日志清理 |
| 2026-05-05 | v5.58：Coder定时任务；修复ST-P20（API文档补充3个缺失admin端点）；四文档v5.58同步；P3清零 |
| 2026-05-05 | v5.57：Reviewer定时任务；全面Code Review完成；TS编译0错误；Migration 001~022完整；架构约束A-01~A-06全通过；发现ST-P20（API文档缺失3个admin端点路径P3）；四文档v5.57同步；更新日志清理 |
| 2026-05-05 | v5.56：Coder定时任务；ST-C05修复auth.ts认证解析重复→verifyBearerAuth()；四文档v5.56同步 |
| 2026-05-05 | v5.55：Reviewer定时任务；全面Code Review完成；P2-2/ST-C03状态闭环（v5.54全项目迁移完成）→✅；TS编译0错误；Migration 001~022完整；架构约束A-01~A-06全通过；禁用词表SSOT一致；遗留优化项从5项减至4项；review_report.md同步更新至v5.55；四文档v5.55同步 |
