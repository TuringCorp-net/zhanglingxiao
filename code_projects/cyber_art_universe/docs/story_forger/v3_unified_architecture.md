# v3.0 统一数据架构重构方案

> 状态：方案 | 日期：2026-05-26 | 目标：明天完成

## 一、动机

当前系统 M0-M6 虽然经过 JSON 化统一了数据格式，但代码层面仍然存在 6 套并行的 loader / saver / cache / API 路径。每次改动需要逐个模块排查，容易遗漏差异点（如本次调试中反复出现的字段名不匹配、缓存格式不一致等问题）。

更深层的问题：**外部 AI Agent（Story Elf）和前端 UI 看到的是两套接口**——AI 通过 discovery.ts 学习 6 种 API 模式，前端通过 6 套 loader 函数操作数据。本质上它们操作的是同一种东西。

## 二、核心洞察

整个系统只有两种结构：

```
Module（单模板 + 自由编辑区）
  - 模板定义（TemplateDef | null）
  - 数据 { slots: {id: content}, free_content }
  - 编辑器类型（slot | text）← 仅影响前端渲染

ModuleList（模块的集合）
  - children: Module[]
  - 来源: D1 某张表
```

M0-M6 映射到这两种结构：

| 模块 | 类型 | 模板 | 编辑器 | D1 列表表 | 当前数量 |
|------|------|------|--------|-----------|---------|
| M0 | Module | null | text | `modules` (filter: type='m0') | 1 |
| M1 | Module | BIBLE_TEMPLATE | slot | `modules` (filter: type='m1') | 1 |
| M2 | Module | OUTLINE_TEMPLATE | slot | `modules` (filter: type='m2') | 1 |
| M3 | ModuleList | CHARACTER_TEMPLATE | slot | `entities` (filter: type='character') | N |
| M4 策略 | Module | FH_STRATEGY_TEMPLATE | slot | `modules` (filter: type='m4_strategy') | 1 |
| M4 卡片 | ModuleList | FH_CARD_SLOTS | slot | `entities` (filter: type='foreshadowing') | N |
| M5 | ModuleList | INTENT_TEMPLATE | slot | `sections` | N |
| M6 | ModuleList | null | text | `sections` | N |

**观察**：M0/M1/M2/M4策略 虽然在 D1 `modules` 表中各只有一行，但架构上和 M3/M4卡片/M5/M6 **完全一致**——都是一个 ModuleList，只是 children 数量 = 1。统一放入 D1 后，为未来 M0 支持多个原始构想、M1 支持多个世界观方案预留了空间。

## 三、统一 API 设计

### 3.1 Module API

所有 Module（无论模块/卡片/章节）使用同一组端点：

```
GET    /api/module/{module_id}
PUT    /api/module/{module_id}
POST   /api/module/{module_id}/generate
```

**GET 响应**（统一格式）：

```json
{
  "ok": true,
  "data": {
    "module_id": "m1_worldbuilding",
    "type": "m1",
    "template": { "sections": [...] },
    "slots": { "power_system": "...", ... },
    "free_content": "...",
    "rendered_md": "# 世界观设定圣经\n\n..."
  }
}
```

**PUT 请求体**（统一格式）：

```json
{
  "slots": { "power_system": "...", ... },
  "free_content": "..."
}
```

### 3.2 ModuleList API

```
GET    /api/modules?work_id={wid}&type=m3
```

**GET 响应**：

```json
{
  "ok": true,
  "data": {
    "type": "m3",
    "modules": [
      { "module_id": "m3_card_xxx", "name": "林默", "status": "done" },
      { "module_id": "m3_card_yyy", "name": "秦渊", "status": "in_progress" }
    ]
  }
}
```

### 3.3 AI Agent 视角

外部 Agent 只需知道两个端点：

```
GET  /api/modules?work_id=X&type=m3   → 列出某类型的全部 module
GET  /api/module/{module_id}          → 读某个 module 的数据
PUT  /api/module/{module_id}          → 写某个 module 的数据
POST /api/module/{module_id}/generate → AI 生成
```

不需要记住 M0-M6 的 6 套 URL 模式和字段差异。

## 四、前端架构

### 4.1 统一 `Module` 数据结构

```typescript
interface Module {
  module_id: string;          // 全局唯一 ID
  work_id: string;
  type: string;               // 'm0' | 'm1' | 'm2' | 'm3_card' | 'm4_strategy' | 'm4_card' | 'm5_intent' | 'm6_chapter'
  name: string;               // 显示名
  template_def: TemplateDef | null;  // null = 自由文本模式
  editor_type: 'slot' | 'text';     // 编辑器类型
  slots: Record<string, string>;
  free_content: string;
  rendered_md: string;
}
```

### 4.2 统一操作函数（替代当前的 6 套 if/else）

```javascript
// 加载 Module
async function loadModule(moduleId) {
  var cached = cacheGet(moduleId);
  var data = cached || await hGet('/api/module/' + moduleId);
  if (data && !cached) cacheSet(moduleId, data);
  return data;
}

// 保存 Module
async function saveModule(moduleId, slots, freeContent) {
  var resp = await hPut('/api/module/' + moduleId, { slots, free_content: freeContent });
  if (resp && resp.ok) cacheSet(moduleId, resp);
  else cacheClear([moduleId]);
  return resp;
}

// 加载 ModuleList
async function loadModuleList(workId, type) {
  var cached = cacheGet('list_' + type);
  var data = cached || await hGet('/api/modules?work_id=' + workId + '&type=' + type);
  if (data && !cached) cacheSet('list_' + type, data);
  return data;
}
```

### 4.3 M5 意图卡模板 → 槽位编辑器

当前 M5 使用 13 字段表单（`showFormEditor`）。重构为：

```typescript
const INTENT_TEMPLATE: TemplateDef = {
  title: { zh: '章节意图卡', en: 'Chapter Intent Card' },
  sections: [{
    heading: { zh: '创作意图', en: 'Writing Intent' },
    slots: [
      { id: 'goal_advance_conflict', level: 1, label: '推进冲突', hint: '...' },
      { id: 'goal_reveal_info',      level: 1, label: '揭示信息', hint: '...' },
      { id: 'goal_create_suspense',  level: 1, label: '制造悬念', hint: '...' },
      { id: 'emotional_goal',       level: 1, label: '情绪目标', hint: '...' },
      { id: 'pov_character',        level: 1, label: '视角角色', hint: '...' },
      { id: 'pov_strategy',         level: 2, label: '视角策略', hint: '...' },
      { id: 'scene_type',           level: 2, label: '场景类型', hint: '...' },
      { id: 'structure_opening',    level: 1, label: '开篇钩子', hint: '...' },
      { id: 'structure_reversal',   level: 2, label: '反转点',   hint: '...' },
      { id: 'structure_cliffhanger',level: 1, label: '章末卡点', hint: '...' },
      { id: 'foreshadowing_triggered', level: 2, label: '伏笔触发', hint: '...' },
      { id: 'characters_involved',  level: 1, label: '出场人物', hint: '...' },
      { id: 'estimated_words',      level: 2, label: '预估字数', hint: '...' },
      { id: 'style_notes',          level: 2, label: '风格备注', hint: '...' },
    ],
  }],
  outro: { zh: 'M5 自由编辑区', en: 'M5 Free editing zone' },
};
```

**平铺 slot vs 嵌套字段**：当前 `serializeFormContent` 做的是 `goal.advance_conflict` ↔ `{goal: {advance_conflict: ...}}` 的转换。这个转换逻辑保留在服务端——前端只管 slot 编辑，服务端在存取 intent 时做嵌套 ↔ 平铺转换。这是数据适配层的事，不影响架构统一。

### 4.4 渲染层只需三种模式

| 模式 | 条件 | DOM |
|------|------|-----|
| **槽位编辑器** | `editor_type === 'slot'` | `renderSlotEditor(template)` |
| **文本编辑器** | `editor_type === 'text'` | `showTextEditor(body)` |
| **（未来）表单** | 可被槽位编辑器替代 | 不再需要 `showFormEditor` |

所有模块除了 M0/M6 用文本模式，其余全部用槽位模式。`renderSlotEditor` 已经支持 sections/slots 的 JSON 渲染。

## 五、D1 统一——`modules` 表

新增 `modules` 表，统一管理所有模块实例：

```sql
CREATE TABLE modules (
  id          TEXT PRIMARY KEY,       -- module_id: 'm1_worldbuilding', 'm3_card_{uuid}', etc.
  work_id     TEXT NOT NULL,          -- 所属作品
  type        TEXT NOT NULL,          -- 'm0'|'m1'|'m2'|'m3_card'|'m4_strategy'|'m4_card'|'m5_intent'|'m6_chapter'
  name        TEXT NOT NULL,          -- 显示名
  order_index INTEGER DEFAULT 0,      -- 排序
  status      TEXT DEFAULT 'empty',   -- 'empty'|'in_progress'|'done'
  r2_json_key TEXT,                   -- R2 .json 路径
  r2_md_key   TEXT,                   -- R2 .md 路径
  created_at  TEXT,
  updated_at  TEXT
);
```

**迁移**：
- M0/M1/M2/M4策略：各 INSERT 一行（`type = 'm0'/'m1'/'m2'/'m4_strategy'`）
- M3 角色卡：从现有 `entities` 表 `WHERE type='character'` 迁移
- M4 伏笔卡：从现有 `entities` 表 `WHERE type='foreshadowing'` 迁移
- M5/M6 章节：从现有 `sections` 表迁移（`type = 'm5_intent'/'m6_chapter'`）

`entities` 表和 `sections` 表后续可以逐步废弃合并入 `modules`。

## 六、执行步骤

### Step 1: 创建 `modules` D1 表 + 迁移数据
- 新增 migration SQL
- 写一次性脚本从 entities/sections 迁移数据到 modules

### Step 2: 统一 API 层
- 新增 `/api/module/{module_id}` GET/PUT 路由
- 新增 `/api/modules?work_id=&type=` GET 路由
- 新增 `/api/module/{module_id}/generate` POST 路由
- 内部根据 module 的 type 路由到对应的 generate handler

### Step 3: 统一前端数据层
- 定义 `Module` 接口 + `loadModule/saveModule/loadModuleList` 函数
- 替换所有 `capturePayload/sendPayload` 中的 6 路 if/else
- 统一缓存 key（`module_id` 本身就是 cache key）

### Step 4: M5 表单 → 槽位编辑器
- 定义 INTENT_TEMPLATE（14 个 slot）
- 服务端加 intent ↔ slots 转换（嵌套 ↔ 平铺）
- 删除 `showFormEditor` 和 `serializeFormContent`

### Step 5: 清理
- 删除旧的 6 套 loader 函数中的重复逻辑
- 删除 `entities` 表角色/伏笔部分（D1）
- 更新 discovery.ts Agent 文档

### Step 6: 验证 + 文档更新
- API 测试：GET/PUT/generate 所有 type
- 前端测试：M0-M6 全模块编辑/保存/切换
- SRS / system_design 更新至 v3.0

## 七、风险与缓解

| 风险 | 缓解 |
|------|------|
| D1 migration 数据丢失 | 先备份 D1，在 dev 环境验证 |
| API 重构时 Worker 路由冲突 | 新旧路由共存过渡，旧路由逐步 deprecate |
| M5 嵌套字段转换丢失数据 | 双向转换写好单元测试（intent ↔ slots 往返） |
| 前端重构引入回归 bug | 本次已有较完善的测试小说"镜中棋局"，可作为基准验收 |

## 八、收益

1. **代码量**：`capturePayload` 从 ~50 行 → ~10 行，`sendPayload` 从 ~40 行 → ~10 行，6 套 loader 合并为 2 个函数
2. **bug 面**：不再有"改 M1 的 bug 修了但 M2 的还在"这类问题
3. **AI Agent**：只需知道 `/api/module/{id}` 一个接口，`discovery.ts` 大幅简化
4. **Story Elf**：读写数据走统一 API，不需要记住 M0-M6 的 6 种路径
5. **扩展性**：加新模块类型只需 INSERT 一行 modules + 配一个 TemplateDef
