# Story Forger — 软件设计规格（SDS）

---

## 文档说明

- **本文档由代码驱动更新**：描述 Story Forger Write 侧代码中**实际实现**了什么。
- **与传统 SDS 的区别**：同 CAU SDS — 代码是 truth source，本文档是结构化解释层。与 system_design.md 的分工：system_design 描述"应该怎么做"，SDS 描述"实际做了什么"。
- **何时更新**：新增/删除模块或端点时、D1 表变更时。
- **关联文档**：[CAU Business Concept](../business_concept.md) → [Story Forger SRS](SRS.md) → [CAU System Design](../system_design.md) → 本文档 → [Story Forger STR](STR.md)

---

## 文档版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-05-07 | 初始版本，Phase 0-5 实现完毕，与 SRS v1.1.0 对齐 |

---

## 一、项目概况

- **部署位置**：CAU Worker `cyber_art_api` 的子路由（`/api/write/*`）
- **部署域名**：`CAU.turingcorp.net`（与 Read 侧共用）
- **代码目录**：`src/api/write/`（5 个模块）+ `src/lib/ai.ts`（共享 AI 层）
- **前端**：`src/pages/write.html` + `write.js`（软木板 UI）
- **D1/R2**：与 CAU Read 侧共享，无新增迁移

---

## 二、源代码模块清单

### 2.1 共享 AI 层（`src/lib/`）

| 文件 | 行数 | 用途 | 来源 |
|------|------|------|------|
| `ai.ts` | 70 | `generateWithAI(env, prompt, opts?)` — provider-agnostic AI 调用。支持 model/maxTokens/temperature 可配置 | Findora `ai_content.ts` 模式提取 |

### 2.2 Write API 模块（`src/api/write/`）

| 文件 | 行数 | 用途 | SRS 覆盖 |
|------|------|------|---------|
| `index.ts` | 80 | Write 侧路由分发（动态 segment 匹配） | — |
| `workspace.ts` | 210 | 工作区 CRUD + 4 个状态转换端点（publish/close/reopen/preview） | SF-001~005 |
| `worldbuilding.ts` | 155 | AI 生成/读取/更新世界观设定 Bible + 约束提取 | SF-010~012 |
| `outline.ts` | 135 | AI 生成大纲（写入 D1 sections + R2 outline.md）+ 读取/手动编辑 | SF-020~022 |
| `draft.ts` | 230 | 章节流水线：Intent Card → Draft v0 → Consistency Check → Polish → Output | SF-030~034 |

### 2.3 前端（`src/pages/`）

| 文件 | 行数 | 用途 |
|------|------|------|
| `write.html` | 100 | 软木板 UI — 工作区选择、卡片网格、章节编辑器 |
| `write.js` | 165 | 软木板交互 — 加载工作区、渲染卡片、AI 生成/保存/发布 |

### 2.4 已有文件的修改

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/api/index.ts` | +15 行 | 新增 `segments[0] === 'write'` 路由 dispatch |
| `src/lib/errors.ts` | +4 行 | 新增 `WORK_NOT_PUBLISHABLE`、`WORK_STATUS_CONFLICT` |
| `src/pages/index.html` | 状态参数修正 | `status=active` → `status=published` |
| `src/pages/browse.html` | 状态参数修正 | `status=active` → `status=published` |

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

**Write 侧端点总数**：22 个（+9 工作区 +4 世界观 +3 大纲 +5 流水线 +1 状态 = 19 个功能端点 + 3 个状态转换）

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
| SF-060 | 软木板视图 | ✅ 已实现 |

### 未实现（MVP 范围外）

| SRS ID | 原因 |
|--------|------|
| SF-023~025 | 伏笔账本/冲突地图/拖拽重排 — 延迟到 Phase 6+ |
| SF-035 | 章节重写 — 延迟 |
| SF-040~042 | 营销辅助 — 延迟 |
| SF-050~052 | MCP Write 工具 — 延迟 |
| SF-061~062 | 写作桌视图 — 延迟 |

**总计**：19/31 已实现（MVP 目标：19 项，100% 达成）

---

## 五、代码量统计

| 分类 | 文件数 | 总行数 |
|------|--------|--------|
| 共享 AI 层 | 1 | ~70 |
| Write API 模块 | 5 | ~810 |
| 前端 | 2 | ~265 |
| 基础修改 | 4 | +~25 |
| **总计** | **12** | **~1,170** |

---

## 六、与 system_design 的差异

| 差异项 | system_design 描述 | 实际实现 | 原因 |
|--------|-------------------|----------|------|
| Write API 路径 | 未明确 | `/api/write/` 前缀，自包含路由 | 保持 Read/Write 代码隔离 |
| AI 模块位置 | 未明确 | `src/lib/ai.ts` 共享模块 | 所有 Write 模块复用 |
| constraints 提取 | 设计为独立 API | 生成时自动提取并缓存 R2 | 减少一次 AI 调用 |
| 状态转换 | 设计为 PUT 通用更新 | 独立 PATCH 端点 enforce 状态机 | publish/close/reopen 语义明确 |
| 前端范围 | 写作桌+软木板双模式 | MVP 仅软木板 | 写作桌延迟至后续 |
