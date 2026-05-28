# V4 计划：L1 层整理 + 版本历史

> 2026-05-27 制定 | 2026-05-28 编码完成 | V3.5 收敛完成后，下一个里程碑

---

## 背景

V3.5 完成了数据存储层的统一（三文件物理隔离 + modules 表 + legacy 端点收敛）。
当前 L0/L1/L2 的分层还不够清晰——`template.ts` 和 `work_content.ts` 游离在 `src/lib/` 根目录，
文件版本历史和 diff 能力缺失。V4 的目标是**把 L1 层整理干净，补齐版本尾巴**，
为 Story Elf L2 工作流编码铺平地基。

---

## 垂直三层架构（定稿）

```
╔══════════════════════════════════════════════════════════╗
║  L2  工作流层     Story Forger: generate→check→polish   ║
║                   Story Elf:   analyze→suggest→validate ║
║                   "先做什么、后做什么、条件分支"          ║
╠══════════════════════════════════════════════════════════╣
║  L1  内容操作层    R2 文件读写    模板/槽位 渲染/解析    ║
║                   上下文包组装    版本历史    diff 对比   ║
║                   "数据怎么存取、怎么变换"                ║
╠══════════════════════════════════════════════════════════╣
║  L0  AI 调用层     callAI()  重试  超时  JSON 模式      ║
║                   "模型怎么调、结果怎么解析"              ║
╚══════════════════════════════════════════════════════════╝
```

L0/L1/L2 是**垂直基础设施**，Story Forger 和 Story Elf 是**水平业务模块**。
两者正交——Story Forger 的 generate 流程和 Story Elf 的分析建议流程都在 L2 层，
但共用同一套 L1 数据操作和 L0 AI 调用。

---

## V4 任务清单

### 一、L1 层文件归位

**挪入 `src/lib/l1/`**：
| 当前路径 | 新路径 |
|---------|--------|
| `src/lib/template.ts` | `src/lib/l1/template.ts` |
| `src/lib/work_content.ts` | `src/lib/l1/work-content.ts` |

**更新 import 引用**：所有引用这两个文件的模块（`module.ts`、`worldbuilding.ts`、`outline.ts`、
`character_card.ts`、`foreshadowing.ts`、`foreshadowing_card.ts`、`original_concept.ts`、
`draft.ts`、`workspace.ts`、`context-package.ts`、`mcp.ts`、`work.ts` 等）更新 import 路径。

**L1 层最终文件清单**：
```
src/lib/l0/aiGateway.ts          ← L0: AI 调用
src/lib/l1/template.ts           ← L1: 模板定义 / 槽位渲染 / JSON 组装
src/lib/l1/work-content.ts       ← L1: R2 路径 / 多语言 / 读写
src/lib/l1/context-package.ts    ← L1: 上下文包组装与缓存
src/lib/l1/context.ts            ← L1: 上下文变量组装
src/lib/l1/render.ts             ← L1: Mustache 轻量模板
src/lib/l1/scenarios.ts          ← L1: 场景注册中心
src/lib/l1/instructions.ts       ← L1: System prompt 构建
src/lib/l1/types.ts              ← L1: 类型定义
src/lib/l1/version.ts            ← V4 新增: 版本历史
src/lib/l1/diff.ts               ← V4 新增: 内容 diff
```

### 二、版本历史（`src/lib/l1/version.ts`）

**接口设计**：
```typescript
// 保存时自动生成版本快照
// 返回 { versionId, versionNumber }
saveWithVersion(env, key, content): Promise<VersionMeta>

// 读取某个历史版本
getVersion(env, key, versionId): Promise<string | null>

// 列出某个文件的所有版本
listVersions(env, key): Promise<VersionMeta[]>

// 回滚到指定版本（本质是 saveWithVersion + 写回当前）
rollbackToVersion(env, key, versionId): Promise<void>
```

**存储策略**：
- 版本快照存储在 R2：`works/{id}/{lang}/.versions/{filename}/{versionId}.json`
- 版本元信息存储在 D1 `file_versions` 表：
  ```sql
  CREATE TABLE file_versions (
    id          TEXT PRIMARY KEY,
    work_id     TEXT NOT NULL,
    r2_key      TEXT NOT NULL,  -- 原始文件 R2 key
    version_num INTEGER NOT NULL,
    snapshot_key TEXT NOT NULL,  -- 快照 R2 key
    size_bytes  INTEGER,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX idx_file_versions_key ON file_versions(r2_key);
  ```
- 写入策略：每次 `saveModule`（PUT .json 或 .free.md）自动触发快照
- 保留策略：每个文件最多保留 50 个版本（超过则清理最旧的）
- 快照内容是当时写入的完整内容（JSON 或 Markdown 原文）

**不与 context-package 缓存冲突**：
版本快照只影响单个文件的 `.versions/` 子目录，不影响 `elf_context_package.md` 缓存策略。

### 三、内容 Diff（`src/lib/l1/diff.ts`）

**接口设计**：
```typescript
// 两个版本之间的差异
diffVersions(env, key, versionIdA, versionIdB): Promise<DiffResult>

// 当前内容与某个历史版本的差异
diffWithCurrent(env, key, versionId): Promise<DiffResult>

// 仅对比 slots（忽略 free_content），用于结构化变更追踪
diffSlots(current: Record<string, string>, previous: Record<string, string>): SlotDiff[]
```

**输出格式**：
```typescript
interface DiffResult {
  key: string;
  versionA: { id: string; num: number; createdAt: string };
  versionB: { id: string; num: number; createdAt: string };
  changes: DiffChange[];
}

interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string;           // 如 "slots.power_system" 或 "body"
  oldValue?: string;
  newValue?: string;
}

interface SlotDiff {
  slotId: string;
  label: string;
  oldValue: string;
  newValue: string;
}
```

**依赖**：
- 对于 JSON 文件（`.json`）：逐 slot 对比，精确到字段
- 对于 Markdown 文件（`.md`、`.free.md`）：逐行对比
- 不需要引入重量级 diff 库——对 JSON 做 key 级对比，对 MD 做行级对比即可

**未来 L2 的使用场景**：
- "作者修改了 M1 世界观 → diff 显示 power_system 变了 → L2 标记受影响的 M6 章节需要重新校验"
- "Story Elf 建议修改 3 个槽位 → 展示 diff → 作者确认后应用"

---

## 不做的事情（明确排除）

- **不实现 merge/conflict resolution** — 单用户场景，无需
- **不实现 Git 级 diff 算法** — JSON key 级 + MD 行级对比足够
- **不实现实时协作** — 不在 V4 范围内
- **不动 L0** — `aiGateway.ts` 已经稳定
- **不开始 L2 编码** — V4 只是 L1 整理收尾

---

## 预估工作量与顺序

| # | 任务 | 预估 |
|---|------|------|
| 1 | `template.ts` → `src/lib/l1/template.ts` + 更新所有 import | 30 min |
| 2 | `work_content.ts` → `src/lib/l1/work-content.ts` + 更新所有 import | 20 min |
| 3 | `file_versions` D1 表迁移 | 15 min |
| 4 | `src/lib/l1/version.ts` 实现 | 1.5 hr |
| 5 | `src/lib/l1/diff.ts` 实现 | 1 hr |
| 6 | `saveModule` 接入自动版本快照 | 30 min |
| 7 | 部署 + 验证 | 30 min |
| **总计** | | **~5 hr** |

---

## V4 完成标准

- [x] L1 层所有文件都在 `src/lib/l1/` 下，`src/lib/` 只留 `response.ts`、`errors.ts`、`constants.ts`、`telemetry.ts`、`ai.ts`（L0 re-export）
- [x] 每次 PUT module 自动生成版本快照（.json 和 .free.md 各自独立快照）
- [x] `GET /api/write/module/{id}/versions` 可列出历史版本
- [x] `GET /api/write/module/{id}/diff?v1=X&v2=Y` 可对比任意两个版本（支持 v2=current 对比当前）
- [x] JSON slots 提供字段级 diff，Markdown 提供行级 diff
- [x] TypeScript 零错误
- [ ] wrangler d1 migrations apply 007_file_versions（待部署）
- [ ] wrangler deploy（待部署）

---

## V4 实现总结

### 文件变更清单

**新增文件**：
- `src/lib/l1/template.ts` — 从 `src/lib/template.ts` 移入（无代码变更）
- `src/lib/l1/work-content.ts` — 从 `src/lib/work_content.ts` 移入（更新内部 import 路径）
- `src/lib/l1/version.ts` — 版本历史模块（saveWithVersion / getVersion / listVersions / rollbackToVersion）
- `src/lib/l1/diff.ts` — 内容 diff 模块（diffVersions / diffWithCurrent / diffSlots）
- `migrations/007_file_versions.sql` — D1 file_versions 表 + 索引

**删除文件**：
- `src/lib/template.ts` — 已移至 `src/lib/l1/template.ts`
- `src/lib/work_content.ts` — 已移至 `src/lib/l1/work-content.ts`

**修改文件（import 路径更新）**：
- `src/api/write/module.ts` — 更新 template/work-content import + 添加 saveWithVersion 自动快照 + 新增 listModuleVersions / diffModuleVersions handler
- `src/api/write/index.ts` — 添加 versions/diff 路由 + import 新 handler
- `src/api/write/worldbuilding.ts` — 更新 import 路径
- `src/api/write/outline.ts` — 更新 import 路径
- `src/api/write/foreshadowing.ts` — 更新 import 路径
- `src/api/write/foreshadowing_card.ts` — 更新 import 路径
- `src/api/write/character_card.ts` — 更新 import 路径
- `src/api/write/draft.ts` — 更新 import 路径
- `src/api/write/workspace.ts` — 更新 import 路径
- `src/api/write/marketing.ts` — 更新 import 路径
- `src/api/write/hints.ts` — 更新 import 路径
- `src/api/write/elf_chat.ts` — 更新 import 路径
- `src/lib/l1/context-package.ts` — 更新 import 路径
- `src/lib/l1/context.ts` — 更新 import 路径
- `src/api/works.ts` — 更新 import 路径
- `src/db/schema.ts` — 新增 FileVersion 接口

### API 变更

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/write/module/{id}/versions` | 列出 .json 和 .free.md 各自的版本列表 |
| `GET` | `/api/write/module/{id}/diff?v1=X&v2=Y` | 对比两个版本；v2=current 对比当前；支持 key=free 和 slot_only=1 |

### 版本存储策略

- R2 快照路径：`works/{id}/{lang}/.versions/{filename}/{versionId}.json`
- D1 表：`file_versions`（id / work_id / r2_key / version_num / snapshot_key / size_bytes / created_at）
- 每个文件默认保留 10 个版本（通过 `maxVersions` 参数可配置，为将来付费用户开放更多版本预留接口）
- `.versions/` 子目录不影响 `elf_context_package.md` 缓存
