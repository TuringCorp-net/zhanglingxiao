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
| v1.2.0 | 2026-05-08 | 9 项延期需求全部实现：伏笔账本、冲突地图、章节重写、营销辅助、MCP Write 工具。31/31 全部完成 |
| v1.7.0 | 2026-05-09 | 冲突地图删除 + 伏笔 Markdown 模板 + 软木板合并入写作桌统一界面 |
| v2.0.0 | 2026-05-20 | M0 原始构想模块 + Story Elf 浮动伴侣 + 多语言 ?lang= 架构 + 三标记槽位编辑器 + M3/M4 统一 entity 存储 + ADMIN_TOKEN 独立 Secret + CSS 清理（textareatarea field-sizing） |

---

## 一、项目概况

- **部署位置**：CAU Worker `cyber_art_api` 的子路由（`/api/write/*`）
- **部署域名**：`CAU.turingcorp.net`（与 Read 侧共用）
- **代码目录**：`src/api/write/`（9 个模块：workspace / entities / worldbuilding / outline / foreshadowing / draft / marketing / original_concept / elf_chat）+ `src/lib/ai.ts`（共享 AI 层）
- **前端**：`src/pages/write.html` + `write.js`（统一写作桌 UI）
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
| `write.html` | 100 | 写作桌 HTML — 工作区选择、三栏布局 |
| `write.js` | 165 | 写作桌交互 — 面板管理、章节树拖拽/筛选、AI 生成/保存 |

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

**Write 侧端点总数**：29 个（+9 工作区 +4 世界观 +1 伏笔 +3 大纲 +6 流水线 +3 营销 +3 状态转换）

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
| 共享 AI 层 | 1 | ~70 |
| Write API 模块 | 8 | ~1,420 |
| 前端 | 3 | ~1,110 |
| 基础修改 | 6 | +~40 |
| **总计** | **18** | **~2,640** |

---

## 六、与 system_design 的差异

| 差异项 | system_design 描述 | 实际实现 | 原因 |
|--------|-------------------|----------|------|
| Write API 路径 | 未明确 | `/api/write/` 前缀，自包含路由 | 保持 Read/Write 代码隔离 |
| AI 模块位置 | 未明确 | `src/lib/ai.ts` 共享模块 | 所有 Write 模块复用 |
| constraints 提取 | 设计为独立 API | 生成时自动提取并缓存 R2 | 减少一次 AI 调用 |
| 状态转换 | 设计为 PUT 通用更新 | 独立 PATCH 端点 enforce 状态机 | publish/close/reopen 语义明确 |
| 前端范围 | 写作桌+软木板双模式 | 统一写作桌界面，软木板合并 | 2026-05-09 合并双模式 |
| 前端行数 | ~660 预估 | ~900（write.js 550 + write.html 130 + style.css +220） | 功能超出 MVP 预估 |
