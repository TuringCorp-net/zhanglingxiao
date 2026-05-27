# Story Forger V3 架构 Review 报告

> 2026-05-27 | V3 统一数据架构阶段性 review

---

## 一、Review 范围与方法

本次 review 以三个 **original_concept** 文档 + **business_concept** + **system_design**（general + story_forger）为"设计意图基准"，对照 V3 实际代码实现，从底层存储 → 中间 API 层 → 上层数据操作，逐层检查：

- 是否符合 **AI 优先、人类附属** 的核心定位
- 是否遵循 **同一份底层数据、同一份 API 层** 的原则
- 是否保持 **free_content → Story Elf → 结构化槽位** 的写作桥梁模式
- 是否存在因功能迭代或 bug 修复导致的架构漂移

**已阅读文件**：

| 层 | 文件 |
|---|------|
| 设计文档 | `original_concept.md` ×3, `business_concept.md`, `system_design.md` ×2, `SDS.md`, `milestone_review_0520.md` |
| 存储层 | `db/schema.ts`, `lib/work_content.ts`, `lib/template.ts`, `migrations/006_add_modules.sql` |
| API 层 | `api/write/index.ts`, `api/write/module.ts`, `api/write/worldbuilding.ts`, `api/write/workspace.ts`, `api/write/original_concept.ts`, `api/mcp.ts` |
| AI 层 | `lib/l1/context-package.ts`, `lib/l1/render.ts`, `lib/l1/scenarios.ts`, `lib/l0/aiGateway.ts` |
| 前端层 | `pages/write.js`, `pages/write-api.js` |

---

## 二、总体结论

**V3 架构在核心设计方向上高度正确，与 original concept 的设想基本一致。** 统一数据架构（Module/ModuleList）、物理隔离的 slots/free_content 存储、全模块槽位编辑器统一，这三项改进是 V3 最重要的架构资产。

但存在 **一个关键的架构不一致问题**：V3 module.ts 引入了 `.json` + `.free.md` 物理隔离的三文件存储，但 **legacy 端点（worldbuilding.ts 等）仍在使用旧的单文件混存方式**。这导致 **同一份数据有两种写入路径，行为不同**。需要在 V3.5 中收敛。

以下逐一展开。

---

## 三、与 Original Concept 的对齐度分析

### 3.1 AI 优先、人类附属

| Original Concept 要求 | V3 实现 | 判定 |
|----------------------|---------|------|
| Agent 是第一公民，人类阅读只是附属消费端 | MCP 暴露 Read + Write 全部工具，与 REST API 共用同一处理函数 | ✅ 一致 |
| 人类走 GUI 视图，Agent 走结构化接口，共享同一底层内容底座 | 前端调用 `loadModule`/`saveModule`，Agent 调用 MCP `generate_worldbuilding`/`generate_chapter` 等，底层都是同一 R2 + D1 | ✅ 一致 |
| 人类层和 Agent 层分离，但共享同一内容源（Agent 访问原则第10条） | V3 的 module API 同时服务 write.html 和 MCP，返回格式统一为 `{template, slots, free_content, rendered_md}` | ✅ 一致 |

### 3.2 同一份底层数据

| Original Concept 要求 | V3 实现 | 判定 |
|----------------------|---------|------|
| R2 存储 Markdown 语义资源树 | `works/{id}/{lang}/*.md` + `*.json` + `*.free.md` 三文件 | ✅ 一致 |
| D1 存储结构化元数据 | `modules` 表统一管理 M0-M6 所有实例 | ✅ 一致 |
| 多语言路径 `{lang}/` 前缀 | `workContentPath(workId, lang, filename)` 全面应用 | ✅ 一致 |

### 3.3 free_content → Story Elf → 结构化槽位

| Original Concept 要求 | V3 实现 | 判定 |
|----------------------|---------|------|
| 人类和 Agent 都往 free_content 写入 Markdown 文章 | V3 module.ts PUT 端点接受 `{free_content: "..."}` 写入独立 `.free.md` 文件 | ✅ 一致 |
| Story Elf 负责将文章内容拆解到结构化槽位中 | `renderTemplateAsJson()` 生成 JSON schema 给 LLM，LLM 输出 `{slots:{...}}` JSON，服务端解析写入 `.json` | ✅ 一致 |
| Agent 无需学习每个模块的内部模板结构 | Agent 只需调用 `POST /api/write/module/{id}/generate` 或 MCP generate 工具，服务端组装完整 prompt | ✅ 一致 |

### 3.4 模板保护（人类只能改槽位）

| Original Concept 要求 | V3 实现 | 判定 |
|----------------------|---------|------|
| 前端可精确修改模板文档内容，但只能改槽位 | `TemplateDef` 是 TypeScript 源码中的唯一维护点；前端 `buildTemplateJson()` 渲染框架为只读 HTML，仅 slot textarea 可编辑 | ✅ 一致 |
| 保证模板不被改坏 | 模板框架部分由前端根据 TemplateDef 渲染，始终只读，不可能被作者误改 | ✅ 一致 |
| 人类前端有特例：可自由书写 free_content | `.free.md` 物理独立存储，前端自由编辑区为独立 textarea | ✅ 一致 |

---

## 四、三层架构逐层分析

### 4.1 底层存储（R2 + D1）

**V3 三文件物理隔离模型**（以 M1 世界观为例）：

```
works/{id}/{lang}/
├── world_bible.json      ← Story Elf 维护的结构化槽位数据
├── world_bible.free.md   ← 人类/Agent 自由书写的编辑区
└── world_bible.md        ← clean Markdown（slots + free_content 拼接渲染）
```

**评价**：

- **这是 V3 最优秀的架构设计**。`.json` 与 `.free.md` 物理隔离意味着：
  - 人类自由书写永远不会覆盖 Story Elf 的结构化数据
  - Story Elf 写入 slots 永远不会覆盖人类的自由笔记
  - `.md` 是只读渲染产物，供人类阅读和 AI 参考
- **`modules` D1 表** 统一了 M0-M6 所有实例管理，消除了之前分散在 `works`/`sections`/`entities` 三张表的碎片化。
- **隐患**：legacy `sections` 和 `entities` 表仍在被代码读取（`workspace.ts`、`context-package.ts`），技术上形成双源头。

### 4.2 API 中间层

**V3 统一 Module API**（`module.ts`）：

```
GET  /api/write/module/{module_id}           → 读单个 module
PUT  /api/write/module/{module_id}           → 写单个 module（slots + free_content 分离）
GET  /api/write/modules?work_id=X&type=Y      → 列出模块列表
POST /api/write/module/{module_id}/generate   → AI 生成（委托到各 handler）
```

**与 legacy 端点的对照**：

| 模块 | V3 端点 | Legacy 端点（仍存在） | 判定 |
|------|---------|---------------------|------|
| M0 | `GET/PUT /api/write/module/m0_{work_id}` | `GET/PUT /api/write/original-concept/{work_id}` | ⚠️ 双路径 |
| M1 | `GET/PUT /api/write/module/m1_{work_id}` | `GET/PUT /api/write/worldbuilding/{work_id}` | ⚠️ 双路径，行为不同 |
| M2 | `GET/PUT /api/write/module/m2_{work_id}` | `GET/PUT /api/write/outline/{work_id}` | ⚠️ 双路径 |
| M4 | `GET/PUT /api/write/module/m4_strategy_{work_id}` | `GET/PUT /api/write/foreshadowing/{work_id}` | ⚠️ 双路径 |
| M5/M6 | `POST /api/write/module/{id}/generate` | `POST /api/write/draft/intent` 等 | ⚠️ 双路径 |

**⚠️ 关键不一致**：`worldbuilding.ts` 的 legacy PUT 端点（`updateWorldbuilding`）将 `free_content` 写入 `.json` 文件内部（`slotData.free_content = body.free_content`，line 269），而 V3 `module.ts` 的 PUT 将 `free_content` 写入独立的 `.free.md` 文件。**这意味着通过不同端点写入的同一模块，free_content 的存储位置不同**——一个在 `.json` 内，一个在 `.free.md` 内。

**这个不一致的根因**：V3 module.ts 引入三文件隔离时，legacy 端点没有同步更新。如果 MCP Agent 通过 `PUT /api/write/worldbuilding/{id}`（legacy）写入 free_content，而前端通过 `GET /api/write/module/m1_{id}`（V3）读取，则 free_content 会丢失（因为 V3 读取的是 `.free.md`，但 legacy 写入的是 `.json` 内部字段）。

### 4.3 前端 / 人类操作层

**评价**：

- **Pipeline 导航 + 左右分栏 + Story Elf 浮动** 的设计完全符合 system_design §六的定义
- **`loadModule`/`saveModule`/`loadModuleList`** 前端数据层统一，消除了旧版多套数据加载逻辑
- **全模块槽位编辑器统一**（M0/M6 单槽位 content，M5 意图卡 14 槽位替代了表单编辑器）— 简洁一致
- **Story Elf 上下文包**（`getOrBuildContextPackage`）从 modules 表查询数据并缓存到 R2，支持 DeepSeek 缓存命中 — 设计正确

**M0 特例处理正确**：M0 定义为单槽位模板（`content` slot），story_elf 禁止修改 M0，但外部 AI/Agent 和人类作者可正常读写。V3 module.ts 中 M0 使用 `MODULE_CONFIG.m0`，遵循统一的 slot 编辑器路径。

---

## 五、重要发现（Issues）

### 🔴 高优先级（建议 V3.5 修复）

#### 5.1 Legacy 端点与 V3 Module API 的 free_content 存储位置不一致

**位置**：`worldbuilding.ts:269` vs `module.ts:409-412`

**问题**：
- `updateWorldbuilding()`（legacy）将 `free_content` 存入 `.json` 内部（`slotData.free_content = body.free_content`）
- `updateModule()`（V3）将 `free_content` 写入独立 `.free.md` 文件

**影响**：legacy 端点写入的 free_content 在 V3 读取路径下不可见（反之亦然）。如果前端已切换到 V3 module API，但 MCP Agent 仍使用 legacy 端点，则数据丢失。

**建议**：
1. 统一为 V3 的三文件物理隔离模型
2. Legacy 端点改为委托到 `module.ts` 的 `getModule`/`updateModule`（或直接更新 legacy handler 使用相同的存储逻辑）
3. 数据迁移：扫描现有 `.json` 文件，将其中嵌入的 `free_content` 字段迁移到独立 `.free.md`

#### 5.2 M0 双路径数据格式不同

**位置**：`original_concept.ts` vs `module.ts` MODULE_CONFIG.m0

**问题**：
- Legacy `GET /api/write/original-concept/{work_id}` 直接读取 `original_concept.md` 文件，返回 `{content: "..." }`
- V3 `GET /api/write/module/m0_{work_id}` 读取 `original_concept.json` + `original_concept.free.md`，返回 `{template, slots: {content: "..."}, free_content: "..."}`
- 两者的数据格式完全不同，前端 / Agent 需要不同的解析逻辑

**建议**：Legacy M0 端点改为委托到 V3 module API（兼容处理：若 `.json` 不存在，将 `.md` 内容迁移为 `{slots: {content: mdContent}}`）

#### 5.3 PUT 操作后未失效上下文包缓存

**位置**：`module.ts:478` (`touchModule`) vs `context-package.ts:62-69` (`invalidateContextPackage`)

**问题**：当用户/AI 修改了 M1-M5 的 slots 或 free_content 后，R2 中的 `elf_context_package.md` 缓存未被清除。Story Elf 在下一次对话中仍使用旧的上下文。

**建议**：在 `updateModule()` 的写操作完成后，调用 `invalidateContextPackage(env, mod.work_id, lang)`。

#### 5.4 `R2SlotData` 类型不含 `free_content`，但 `worldbuilding.ts` 向其中写入

**位置**：`template.ts:80-82` vs `worldbuilding.ts:268-269`

**问题**：
```typescript
// template.ts
export interface R2SlotData {
  slots: Record<string, string>;
  // 没有 free_content 字段！
}

// worldbuilding.ts:268-269
const slotData: R2SlotData = { slots: body.slots };
if (body.free_content) slotData.free_content = body.free_content;  // TS 类型错误
```

TypeScript 编译可能未报错（`as R2SlotData` 等类型断言），但这是一个类型安全隐患。

**建议**：统一后（5.1），`R2SlotData` 不再需要 `free_content` 字段（因为 free_content 已物理隔离到 `.free.md`）。

### 🟡 中优先级（建议 V3.5 关注）

#### 5.5 `sections` 和 `entities` 表仍作为数据源

**位置**：`workspace.ts`、`context-package.ts:201`

**问题**：V3 迁移明确声明 sections/entities 表"后续逐步废弃"，但 `context-package.ts` 的 `buildM5Intents()` 仍回退到 sections 表查询章节标题和摘要（line 201-206），`workspace.ts` 的 section CRUD 仍直接操作 sections 表。

**建议**：在 V3.5 中，M5/M6 的章节管理完全迁移到 modules 表，sections 表只保留给 CAU Read 侧。

#### 5.6 `context-package.ts` 读取 `.md` 文件，依赖正确时机

**位置**：`context-package.ts:82-85`

**问题**：上下文包构建时读取 `world_bible.md`、`outline.md` 等 clean Markdown 文件。这些文件由 `module.ts` 在 PUT 时渲染。如果渲染逻辑有 bug（或渲染未完成），上下文包可能读到过时数据。但这属于时序问题，当前代码路径是同步的（PUT → 渲染 .md → 返回响应），风险较小。

**建议**：V3.5 可考虑上下文包直接从 `.json` + `.free.md` 组装（而非依赖渲染后的 `.md`），彻底消除时序依赖。

#### 5.7 M5 Intent 存储格式双重兼容

**位置**：`module.ts:279-305`

**问题**：`getModule()` 中 M5 intent 有旧格式兼容逻辑（嵌套 JSON → 平铺 slots）。这是必要的工程实践，但随着时间推移，应清理旧格式。

**建议**：V3.5 中执行一次性数据迁移，将所有 M5 intent 转为标准 `{slots: {...}}` 格式，移除兼容代码。

### 🟢 低优先级（可延后）

#### 5.8 `worldbuilding.ts` 仍使用直接的 R2 写入

`writeBible()` 函数在 `worldbuilding.ts` 中定义，而非复用 module.ts 的 R2 写入逻辑。随着 V3 收敛，这些辅助函数应统一到 module.ts。

#### 5.9 `writeBible()` 同时写 `.json` 和 `.md`，但不写 `.free.md`

V3 三文件模型中 `.free.md` 是独立文件，但 `worldbuilding.ts` 的 `writeBible()` 不创建 `.free.md`。这意味着 AI generate 的结果没有独立的自由编辑区。

---

## 六、与 0520 Milestone Review 的对照

0520 报告中的 4 个高优先级问题：

| 0520 Issue | 当前状态 |
|-----------|---------|
| 3.1 拖拽排序缓存失效 | ✅ 应在 V3 `preWarmCache()` 重构中自然解决 |
| 3.2 Pipeline 状态渲染 | ✅ V3 `refreshPipelineGuide()` 使用 modules 表 status 字段 |
| 3.3 SDS/STR 过时 | ⚠️ SDS 已更新至 v2.4.0，但需更新至 V3.0.0 |
| 3.4 §10.8 槽位格式描述 | ✅ system_design 已更新为 v2.5 JSON 化描述 |

---

## 七、架构评分卡

| 维度 | 评分 | 说明 |
|------|------|------|
| **AI 优先定位** | ★★★★★ | MCP 与 REST 完全共用，Agent 是第一公民 |
| **数据统一性** | ★★★★☆ | V3 三文件模型 + modules 表是正确的方向，但 legacy 端点未收敛 |
| **free_content 桥梁** | ★★★★☆ | 物理隔离是优秀的架构决策，但 legacy 端点破坏了隔离 |
| **模板保护** | ★★★★★ | TemplateDef 单一来源 + 前端只读框架渲染 = 完美 |
| **API 简洁性** | ★★★☆☆ | V3 module API 只有 4 个端点，非常优雅；但 legacy 双路径增加认知负担 |
| **代码一致性** | ★★★☆☆ | module.ts 实现质量高，但 legacy handler 未同步更新 |
| **前端统一性** | ★★★★★ | 全模块槽位编辑器统一，M5 表单编辑器已移除 |
| **多语言支持** | ★★★★★ | `?lang=` 参数全面覆盖，双语生成默认开启 |

**综合评分**：★★★★☆（4.2/5）

---

## 八、V3.5 / V4 就绪度评估

### Story Elf L2 编码的前置条件

| 条件 | 状态 | 说明 |
|------|------|------|
| L0 AI Gateway 统一入口 | ✅ 就绪 | `callAI()` 支持多模型、JSON 模式、重试、超时 |
| L1 上下文包组装 | ✅ 就绪 | `getOrBuildContextPackage()` + R2 缓存 |
| L1 场景注册 + prompt 模板 | ✅ 就绪 | `scenarios.ts` + `prompts/` 目录 |
| L1 Mustache 渲染 | ✅ 就绪 | `render.ts` |
| 数据读写路径统一 | ⚠️ 建议先修 5.1/5.2 | Legacy 端点需收敛后再在 L2 中引用 |
| 上下文包失效机制 | ⚠️ 建议先修 5.3 | 否则 L2 可能读到过期上下文 |
| 提示词更新 | 📋 用户自行处理 | 用户已说明会自己更新提示词 |

**建议**：V3.5 先修 5.1（legacy 端点收敛到 V3 module API）、5.2（M0 双路径统一）、5.3（PUT 后失效上下文缓存）。这三项修复量不大（预计 2-3 小时），但能消除 V3 架构中唯一的实质性不一致。之后即可安全进入 Story Elf L2 编码。

---

## 九、建议行动计划

### V3.5（收敛清理，建议立即执行）

1. **Legacy 端点收敛**（5.1）：`worldbuilding.ts` / `outline.ts` / `foreshadowing.ts` / `original_concept.ts` 的 GET/PUT handler 改为委托到 `module.ts` 的 `getModule`/`updateModule`
2. **free_content 数据迁移**：扫描现有 `.json` 文件中内嵌的 `free_content`，迁移到独立 `.free.md`
3. **PUT 后失效上下文缓存**（5.3）：`updateModule()` 末尾调用 `invalidateContextPackage()`
4. **M0 数据格式统一**（5.2）：legacy M0 端点改为 V3 兼容格式
5. **SDS 更新至 v3.0.0**

### V4（Story Elf L2 编码）

1. L2 Agent 层编码：Story Elf 读取 free_content → 分析 → 建议拆解到 slots
2. 一致性校验增强：基于结构化 slots 的正向检查
3. 前端 Story Elf 交互：Hint 对话泡 → slot 建议填充

---

> **最终判断**：V3 架构在核心方向上没有走偏。AI 优先、数据统一、模板保护三大原则得到很好的贯彻。唯一需要立即处理的是 legacy 端点未随 V3 更新导致的 free_content 存储位置不一致——这是一个干净的工程收敛问题，无损于架构设计的正确性。
