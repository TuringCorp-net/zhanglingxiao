# Story Forger — 软件设计规格（SDS）

---

## 文档说明

- **本文档由代码驱动更新**：描述 Story Forger Write 侧代码中**实际实现**了什么。
- **与传统 SDS 的区别**：同 CAU SDS — 代码是 truth source，本文档是结构化解释层。与 system_design.md 的分工：system_design 描述"应该怎么做"，SDS 描述"实际做了什么"。
- **何时更新**：新增/删除模块或端点时、D1 表变更时。
- **关联文档**：[架构总览](../ARCHITECTURE.md) → [Business Concept](../general/business_concept.md) → [SRS](SRS.md) → [System Design](system_design.md) → 本文档 → [STR](STR.md) → [CAU SDS](../cau/SDS.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.2.0 | 2026-05-08 | 9 项延期需求全部实现：伏笔账本、冲突地图、章节重写、营销辅助、MCP Write 工具。31/31 全部完成 |
| v1.7.0 | 2026-05-09 | 冲突地图删除 + 伏笔 Markdown 模板 + 软木板合并入写作桌统一界面 |
| v2.0.0 | 2026-05-20 | M0 原始构想模块 + Story Elf 浮动伴侣 + 多语言 ?lang= 架构 + 三标记槽位编辑器 + M3/M4 统一 entity 存储 + ADMIN_TOKEN 独立 Secret + CSS 清理（textarea field-sizing） |
| v2.4.0 | 2026-05-21 | 模板分级系统（L0/L1/L2）+ 双语模板统一化（SlotDefinition）+ M3/M4 模板拆分（character_card.ts / foreshadowing_card.ts）+ 删 entities.ts + Level 前端可见性控制 + 作品级 config API |
| v3.0.0 | 2026-05-28 | **V3 统一数据架构 + V4 L1 层整理**：新增 `modules` D1 表 + 统一 Module API（GET/PUT/generate）+ R2 三文件物理隔离（.json / .free.md / .md）。L1 层文件归位（template.ts / work-content.ts 移入 l1/）。新增 `version.ts`（版本历史，每次 PUT 自动快照）+ `diff.ts`（JSON slot 级 + MD 行级 diff）。新增 `file_versions` D1 表。API 新增 `GET .../versions` 和 `GET .../diff` 端点。`src/lib/` 根目录收敛为 ai.ts / response.ts / errors.ts / constants.ts / telemetry.ts |

---

## 一、项目概况

- **部署位置**：CAU Worker `cyber_art_api` 的子路由（`/api/write/*`）
- **部署域名**：`CAU.turingcorp.net`（与 Read 侧共用）
- **代码目录**：`src/api/write/`（13 个模块：workspace / character_card / foreshadowing_card / worldbuilding / outline / foreshadowing / draft / marketing / original_concept / elf_chat / hints / module / index）+ `src/lib/l0/aiGateway.ts`（L0 AI 调用）+ `src/lib/l1/`（L1 内容操作层：template / work-content / version / diff / context-package / context / render / scenarios / instructions / types）
- **前端**：`src/pages/write.html` + `write.js`（统一写作桌 UI）
- **D1/R2**：与 CAU Read 侧共享，无新增迁移

---

## 二、源代码模块清单

### 2.1 共享层（`src/lib/`）

| 文件 | 行数 | 用途 | 来源 |
|------|------|------|------|
| `ai.ts` | 5 | L0 Re-export 兼容层 | v2.5.0 重构 |
| `l0/aiGateway.ts` | 250 | L0：AI Gateway 客户端。`callAI()` — Cloudflare AI Gateway BYOK 统一入口。支持多模型、三角色消息、重试、超时、JSON 模式、AIError | v2.5.0 从 ai.ts 迁移 |
| `l1/types.ts` | 57 | L1：ScenarioConfig / DomainDef / AgentVars 类型定义 | v2.5.0 |
| `l1/render.ts` | 90 | L1：轻量 Mustache 模板引擎。`{{ var.path \| filter }}` 变量替换 + 管道过滤器 | 从 turingcorp-workflow/decider 移植 |
| `l1/context-package.ts` | 185 | L1：M0-M5 写作上下文包组装。`getOrBuildContextPackage()` — 并发拉取 + R2 缓存 | v2.5.0 |
| `l1/context.ts` | 25 | L1：上下文变量组装。`assembleContext()` — 合并元信息+上下文包+动态参数 | v2.5.0 |
| `l1/instructions.ts` | 17 | L1：System prompt 构建。`buildSystemPrompt()` — 加载 .md 模板 → render → 完整 system prompt | v2.5.0 |
| `l1/scenarios.ts` | 64 | L1：场景注册中心。场景配置 + .md prompt import + 注册表 | v2.5.0 |
| `l1/prompts/` | 2 文件 | L1：人类维护的 prompt 模板。`reader_companion/system.md` + `writer_companion/system.md` | v2.5.0 |
| `l1/template.ts` | 400 | `SlotDef`/`TemplateDef` 类型 + `renderTemplate()`/`renderCard()`/`extractTemplateJson()` — 双语模板统一渲染与 JSON 解析 | v2.4.0，V4 移入 l1/ |
| `l1/work-content.ts` | 242 | R2 Markdown 读写层 — R2 路径构建、多语言回退、Frontmatter 编解码、作品/章节/大纲读写 | V4 从 lib/ 移入 l1/ |
| `l1/version.ts` | 170 | V4 新增：版本历史。`saveWithVersion()` — 写入 R2 + 自动快照 + D1 记录 + 超出上限清理。`getVersion()` / `listVersions()` / `rollbackToVersion()`。默认保留 10 个版本（可配置） | V4 |
| `l1/diff.ts` | 222 | V4 新增：内容 diff。`diffVersions()` / `diffWithCurrent()` — JSON slot 级对比 + MD 逐行对比。`diffSlots()` — 纯函数供 L2 使用 | V4 |
| `telemetry.ts` | 55 | 系统遥测：`recordAIUsage()` — AI 调用用量写入 D1 + console.log。`extractUserToken()` — 用户标识提取 | 新增，v2.5.0 |

### 2.2 Write API 模块（`src/api/write/`）

| 文件 | 行数 | 用途 | SRS 覆盖 |
|------|------|------|---------|
| `index.ts` | 190 | Write 侧路由分发（动态 segment 匹配，entity 按 type 分发，V4 版本/diff 路由） | — |
| `module.ts` | 620 | V3 统一 Module API：GET/PUT 单模块 + GET 列表 + POST generate + V4 versions/diff | V3/V4 |
| `workspace.ts` | 240 | 工作区 CRUD + 4 状态转换 + config 存取 | SF-001~005 |
| `character_card.ts` | 195 | M3 人物卡模板定义 + CRUD（create/read/update card） | SF-014 |
| `foreshadowing_card.ts` | 135 | M4 伏笔卡模板定义 + CRUD（create/read/update card） | SF-023 |
| `worldbuilding.ts` | 135 | AI 生成/读取/更新世界观设定 Bible + 约束提取 | SF-010~012 |
| `outline.ts` | 120 | AI 生成大纲（写入 D1 sections + R2 outline.md）+ 读取/手动编辑 | SF-020~022 |
| `foreshadowing.ts` | 120 | M4 伏笔策略总览 AI 生成/读取/更新 | SF-023 |
| `draft.ts` | 230 | 章节流水线：Intent Card → Draft v0 → Consistency Check → Polish → Output | SF-030~034 |
| `hints.ts` | 100 | 智能提示系统（静态 + 动态） | SF-067 |
| `elf_chat.ts` | 100 | Story Elf AI 对话 | SF-055~056 |
| `original_concept.ts` | 55 | M0 原始构想读写 | SF-019 |
| `marketing.ts` | 150 | 营销提取辅助 | SF-040~042 |

### 2.3 前端（`src/pages/`）

| 文件 | 行数 | 用途 |
|------|------|------|
| `write.html` | 100 | 写作桌 HTML — 工作区选择、Pipeline 导航、左右分栏 |
| `write.js` | 550 | 写作桌交互 — Pipeline、模块切换、槽位编辑器、Level 可见性控制 |
| `write-api.js` | 120 | HTTP 通信层（hGet/hPost/hPut + 语言切换） |
| `story-elf.js` | 377 | Story Elf 浮动伴侣组件 — 可拖拽、聊天窗口（左侧）、Hint 对话泡（上方，打字机效果 + markdown 渐进渲染）|
| `i18n-data.js` | 238 | 全站双语数据 |

---

## 三、API 端点清单

### 3.1 工作区管理（SF-001~005）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| GET | `/api/write/works` | `workspace.ts` | SF-002 | ✅ |
| POST | `/api/write/works` | `workspace.ts` | SF-001 | ✅ |
| GET | `/api/write/works/{id}` | `workspace.ts` | SF-003 读 | ✅ |
| PUT | `/api/write/works/{id}` | `workspace.ts` | SF-003 写 | ✅ |
| DELETE | `/api/write/works/{id}` | `workspace.ts` | SF-004 | ✅ |
| GET | `/api/write/works/{id}/preview` | `workspace.ts` | SF-005 | ✅ |
| PATCH | `/api/write/works/{id}/publish` | `workspace.ts` | 状态转换 | ✅ |
| PATCH | `/api/write/works/{id}/close` | `workspace.ts` | 状态转换 | ✅ |
| PATCH | `/api/write/works/{id}/reopen` | `workspace.ts` | 状态转换 | ✅ |

### 3.2 世界观引擎（SF-010~012）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/worldbuilding/generate` | `worldbuilding.ts` | SF-010 | ✅ |
| GET | `/api/write/worldbuilding/{work_id}` | `worldbuilding.ts` | SF-011 | ✅ |
| PUT | `/api/write/worldbuilding/{work_id}` | `worldbuilding.ts` | SF-012 | ✅ |
| GET | `/api/write/worldbuilding/{work_id}/constraints` | `worldbuilding.ts` | SF-013 | ✅ |

### 3.3 大纲引擎（SF-020~022）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/outline/generate` | `outline.ts` | SF-020 | ✅ |
| GET | `/api/write/outline/{work_id}` | `outline.ts` | SF-021 | ✅ |
| PUT | `/api/write/outline/{work_id}` | `outline.ts` | SF-022 | ✅ |

### 3.4 章节生产流水线（SF-030~034）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/draft/intent` | `draft.ts` | SF-030 | ✅ |
| POST | `/api/write/draft/generate` | `draft.ts` | SF-031 | ✅ |
| POST | `/api/write/draft/check/{work_id}/{section_id}` | `draft.ts` | SF-032 | ✅ |
| POST | `/api/write/draft/polish` | `draft.ts` | SF-033 | ✅ |
| GET | `/api/write/draft/output/{section_id}` | `draft.ts` | SF-034 | ✅ |

### 3.5 伏笔账本（SF-023）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/foreshadowing/generate` | `foreshadowing.ts` | SF-023 | ✅ |
| GET | `/api/write/foreshadowing/{work_id}` | `foreshadowing.ts` | SF-023 | ✅ |

### 3.6 章节重写（SF-035）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/draft/rewrite/{section_id}` | `draft.ts` | SF-035 | ✅ |

### 3.7 营销辅助（SF-040~042）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| POST | `/api/write/marketing/extract/{section_id}` | `marketing.ts` | SF-040 | ✅ |
| POST | `/api/write/marketing/titles/{work_id}` | `marketing.ts` | SF-041 | ✅ |
| POST | `/api/write/marketing/repurpose/{section_id}` | `marketing.ts` | SF-042 | ✅ |

### 3.8 MCP Write 工具（SF-050~052）

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| sf:// | 4 个 Write Resources | `mcp.ts` | SF-050 | ✅ |
| tools/call | 5 个 Write Tools | `mcp.ts` | SF-051 | ✅ |
| — | 与 REST 共用处理函数 | `mcp.ts` | SF-052 | ✅ |

| GET | `/api/write/works/{id}/config` | `workspace.ts` | 作品配置读取 | ✅ |
| PUT | `/api/write/works/{id}/config` | `workspace.ts` | 作品配置更新（如 template_level） | ✅ |

### 3.9 V4 版本历史 & Diff

| 方法 | 路径 | 模块 | SRS | 状态 |
|------|------|------|-----|------|
| GET | `/api/write/module/{id}/versions` | `module.ts` | V4 | ✅ |
| GET | `/api/write/module/{id}/diff?v1=X&v2=Y` | `module.ts` | V4 | ✅ |

`diff` 端点支持参数：`v2=current`（对比当前内容）、`key=free`（对比 .free.md 文件）、`slot_only=1`（仅返回 slots 级变更）。

**Write 侧端点总数**：33 个（+9 工作区 +2 config +4 世界观 +3 伏笔 +3 大纲 +6 流水线 +3 营销 +3 状态转换 +2 V4 versions/diff -2 entity 合并）

---

## 四、SRS 覆盖度

| SRS ID | 需求 | 状态 |
|--------|------|------|
| SF-001 | 创建作品 | ✅ 已实现 |
| SF-002 | 列出我的作品 | ✅ 已实现 |
| SF-003 | 更新作品元信息 | ✅ 已实现 |
| SF-004 | 删除作品 | ✅ 已实现 |
| SF-005 | 预览作品 | ✅ 已实现 |
| SF-010 | 生成设定圣经 | ✅ 已实现 |
| SF-011 | 读取设定圣经 | ✅ 已实现 |
| SF-012 | 更新设定圣经 | ✅ 已实现 |
| SF-013 | 设定约束清单 | ✅ 已实现 |
| SF-014 | 角色/实体管理 | ✅ 复用 CAU entities.ts |
| SF-020 | 生成大纲 | ✅ 已实现 |
| SF-021 | 读取大纲 | ✅ 已实现 |
| SF-022 | 编辑大纲 | ✅ 已实现 |
| SF-030 | 意图卡 | ✅ 已实现 |
| SF-031 | 初稿生成 | ✅ 已实现 |
| SF-032 | 一致性校验 | ✅ 已实现 |
| SF-033 | 润色优化 | ✅ 已实现 |
| SF-034 | 中稿输出 | ✅ 已实现 |
| SF-023 | 伏笔账本 | ✅ 已实现 |
| SF-024 | 冲突地图 | ❌ 已移除 |
| SF-025 | 章节拖拽重排 | ✅ 由 SF-022 覆盖 |
| SF-035 | 章节重写 | ✅ 已实现 |
| SF-040 | 爆点提炼 | ✅ 已实现 |
| SF-041 | 标题/简介生成 | ✅ 已实现 |
| SF-042 | 分发改写 | ✅ 已实现 |
| SF-050 | MCP Resources | ✅ 已实现 |
| SF-051 | MCP Tools | ✅ 已实现 |
| SF-052 | MCP/REST 共底 | ✅ 已实现 |
| SF-060 | 软木板视图 | ❌ 已合并入 SF-061 |
| SF-061 | 写作桌统一界面 | ✅ 已实现（三栏布局+章节树拖拽/筛选+Markdown 编辑/预览） |
| SF-062 | 活页夹面板系统 | ✅ 已实现（折叠/展开+拖拽调整宽度+状态持久化） |

**总计**：31/31 全部实现（SRS v1.4.0 已同步）

---

## 五、代码量统计

| 分类 | 文件数 | 总行数 |
|------|--------|--------|
| L0 (AI Gateway) | 1 | ~250 |
| 遥测（telemetry.ts） | 1 | ~55 |
| L1 (Agent 层) | 8 | ~2,000 |（含 V4 新增 version.ts ~170 行 + diff.ts ~220 行 + template.ts ~400 行 + work-content.ts ~240 行） |
| Write API 模块 | 13 | ~2,100 |（含 V3 新增 module.ts ~620 行）|
| 前端 | 5 | ~1,250 |
| **总计** | **27** | **~4,000** |

---

## 六、与 system_design 的差异

| 差异项 | system_design 描述 | 实际实现 | 原因 |
|--------|-------------------|----------|------|
| Write API 路径 | 未明确 | `/api/write/` 前缀，自包含路由 | 保持 Read/Write 代码隔离 |
| AI 模块位置 | `src/lib/ai.ts`（70行，直连 OpenAI/Anthropic） | `src/lib/ai.ts`（210行，Cloudflare AI Gateway 统一入口） | AI Gateway BYOK 模式，真实 key 不接触 Worker |
| constraints 提取 | 设计为独立 API | 生成时自动提取并缓存 R2 | 减少一次 AI 调用 |
| 状态转换 | 设计为 PUT 通用更新 | 独立 PATCH 端点 enforce 状态机 | publish/close/reopen 语义明确 |
| 前端范围 | 写作桌+软木板双模式 | 统一写作桌界面，软木板合并 | 2026-05-09 合并双模式 |
| 前端行数 | ~660 预估 | ~900（write.js 550 + write.html 130 + style.css +220） | 功能超出 MVP 预估 |
